import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { GhostService } from '../../infrastructure/ghost/GhostService';
import { CharacterAppearance, CharacterProperties, GhostResponse } from '@shared/types';
import { ConfigRepository } from '../../infrastructure/config/ConfigRepository';
import { ToolConfigRepository } from '../../infrastructure/tools/ToolConfigRepository';
import { chatHistoryRepository, getChatHistory } from '../../infrastructure/chat/ChatHistoryRepository';
import { createWindow } from '../../helpers';

/**
 * UserActionHandler - Presentation layer handler for user actions
 *
 * Handles all user-initiated actions from the renderer process.
 * Follows Clean Architecture by depending on infrastructure services
 * through dependency injection.
 */
export class UserActionHandler {
  private mainWindow: BrowserWindow;
  private characterName: string;
  private characterAppearance: CharacterAppearance;
  private displayScale: number;
  private speechBubbleWidth: number;
  private ghost: GhostService;
  private configRepository: ConfigRepository;
  private toolConfigRepository: ToolConfigRepository;
  private isProd: boolean;

  // Window references
  private speechBubbleWindow: BrowserWindow | null = null;
  private userChatInputWindow: BrowserWindow | null = null;
  private configWindow: BrowserWindow | null = null;
  private logsWindow: BrowserWindow | null = null;

  // State management
  private ghostIsProcessingMessage = false;
  private streamHasStarted = false;
  private appExitTimeout: NodeJS.Timeout | null = null;
  private isAppExiting = false;
  private lastInteractionTime: Date = new Date();
  private onCharacterLoadedCallback: (() => void) | null = null;

  constructor({
    mainWindow,
    characterName,
    characterAppearance,
    displayScale,
    speechBubbleWidth,
    ghost,
    configRepository,
    toolConfigRepository,
    isProd
  }: {
    mainWindow: BrowserWindow;
    characterName: string;
    characterAppearance: CharacterAppearance;
    displayScale: number;
    speechBubbleWidth: number;
    ghost: GhostService;
    configRepository: ConfigRepository;
    toolConfigRepository: ToolConfigRepository;
    isProd: boolean;
  }) {
    this.mainWindow = mainWindow;
    this.characterName = characterName;
    this.characterAppearance = characterAppearance;
    this.displayScale = displayScale;
    this.speechBubbleWidth = speechBubbleWidth;
    this.ghost = ghost;
    this.configRepository = configRepository;
    this.toolConfigRepository = toolConfigRepository;
    this.isProd = isProd;
  }

  // Getters for external window access
  getSpeechBubbleWindow(): BrowserWindow | null {
    return this.speechBubbleWindow;
  }

  getUserChatInputWindow(): BrowserWindow | null {
    return this.userChatInputWindow;
  }

  getConfigWindow(): BrowserWindow | null {
    return this.configWindow;
  }

  getLogsWindow(): BrowserWindow | null {
    return this.logsWindow;
  }

  getGhostIsProcessingMessage(): boolean {
    return this.ghostIsProcessingMessage;
  }

  getLastInteractionTime(): Date {
    return this.lastInteractionTime;
  }

  setStreamHasStarted(value: boolean): void {
    this.streamHasStarted = value;
  }

  setIsAppExiting(value: boolean): void {
    this.isAppExiting = value;
  }

  /**
   * Update last interaction time
   * Should be called after any user interaction with the ghost
   */
  updateLastInteraction(): void {
    this.lastInteractionTime = new Date();
  }

  /**
   * Set callback to be called when character is loaded
   * Used to start trigger manager
   */
  setOnCharacterLoaded(callback: () => void): void {
    this.onCharacterLoadedCallback = callback;
  }

  getIsAppExiting(): boolean {
    return this.isAppExiting;
  }

  clearAppExitTimeout(): void {
    if (this.appExitTimeout) {
      clearTimeout(this.appExitTimeout);
      this.appExitTimeout = null;
    }
  }

  /**
   * Handle APP_STARTED action
   * Sends character properties to the renderer
   */
  async handleAppStarted(): Promise<void> {
    const characterProperties: CharacterProperties = {
      character_name: this.characterName,
      character_width: this.characterAppearance.character_width,
      character_height: this.characterAppearance.character_height,
      graphics: this.characterAppearance.graphics.map(graphic => ({
        emoticon: graphic.emoticon,
        imgSrc: `local-resource://character/${this.characterName}/images/${graphic.imgSrc}`
      })),
      touchable_areas: this.characterAppearance.touchable_areas,
    };
    this.mainWindow.webContents.send('character_loaded', characterProperties);
  }

  /**
   * Handle CHARACTER_LOADED action
   * Initiates greeting from the character
   */
  async handleCharacterLoaded(): Promise<void> {
    await this.sendGhostMessage((g) => g.sayHello());

    // Trigger callback after character is loaded (e.g., start trigger manager)
    if (this.onCharacterLoadedCallback) {
      this.onCharacterLoadedCallback();
    }
  }

  /**
   * Handle CHAT_OPENED action
   * Opens the user chat input window
   */
  async handleChatOpened(): Promise<void> {
    if (this.userChatInputWindow !== null) {
      return;
    }

    this.userChatInputWindow = createWindow('user-chat-input', {
      width: 600,
      height: 600,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    }, this.displayScale, true);

    this.loadUrlOnBrowserWindow(this.userChatInputWindow, 'chatDialog');

    // Reset reference when window is closed
    this.userChatInputWindow.on('close', () => {
      this.userChatInputWindow = null;
    });

    setTimeout(() => {
      this.userChatInputWindow?.focus();
    }, 100);
  }

  /**
   * Handle CHAT_CLOSED action
   * Closes the user chat input window
   */
  async handleChatClosed(): Promise<void> {
    if (this.userChatInputWindow !== null) {
      this.userChatInputWindow.close();
      this.userChatInputWindow = null;
    }
  }

  /**
   * Handle APP_QUIT action
   * Initiates goodbye sequence and app exit
   */
  async handleAppQuit(): Promise<void> {
    if (this.isAppExiting) {
      return;
    }
    this.isAppExiting = true;
    // Don't reset streamHasStarted - it will be managed by streaming events

    await this.sendGhostMessage((g) => g.sayGoodbye());

    // Safety timeout: quit after 15 seconds no matter what
    this.appExitTimeout = setTimeout(() => {
      console.log('[App Exit] Safety timeout reached (15s), force quitting');
      require('electron').app.quit();
    }, 15000);
  }

  /**
   * Handle BUBBLE_CLOSED action
   * Closes speech bubble window
   */
  async handleBubbleClosed(): Promise<void> {
    console.log('[UserActionHandler] BUBBLE_CLOSED');
    if (this.speechBubbleWindow !== null) {
      this.speechBubbleWindow.close();
      this.speechBubbleWindow = null;
    }
  }

  /**
   * Handle REQUEST_CONFIG action
   * Sends current configuration to config window
   */
  async handleRequestConfig(): Promise<void> {
    this.configWindow?.webContents.send('config_response', {
      openaiApiKey: this.configRepository.getConfig('openaiApiKey') as string || "",
      anthropicApiKey: this.configRepository.getConfig('anthropicApiKey') as string || "",
      llmService: this.configRepository.getConfig('llmService') as string || "",
      selectedModel: this.configRepository.getConfig('selectedModel') as string || "",
      temperature: this.configRepository.getConfig('temperature') as number || 1,
      openweathermapApiKey: this.configRepository.getConfig('openweathermapApiKey') as string || "",
      coinmarketcapApiKey: this.configRepository.getConfig('coinmarketcapApiKey') as string || "",
      chatHistoryLimit: this.configRepository.getConfig('chatHistoryLimit') as number || 20,
      displayScale: this.configRepository.getConfig('displayScale') as number || 0.5,
      speechBubbleWidth: this.configRepository.getConfig('speechBubbleWidth') as number || 500,
      enableLightweightModel: this.configRepository.getConfig('enableLightweightModel') !== false,
      enableAutoSummarization: this.configRepository.getConfig('enableAutoSummarization') !== false,
      summarizationThreshold: this.configRepository.getConfig('summarizationThreshold') as number || 40,
      langsmithApiKey: this.configRepository.getConfig('langsmithApiKey') as string || "",
      enableLangsmithTracing: this.configRepository.getConfig('enableLangsmithTracing') as boolean || false,
      langsmithProjectName: this.configRepository.getConfig('langsmithProjectName') as string || "akagaku",
      toolConfigs: this.toolConfigRepository.getAllToolConfigs()
    });
  }

  /**
   * Handle OPEN_CONFIG action
   * Opens or shows the configuration window
   */
  async handleOpenConfig(): Promise<void> {
    if (!this.configWindow) {
      this.configWindow = createWindow('config', {
        width: 600,
        height: 800,
        transparent: false,
        frame: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
        },
      }, this.displayScale, true);

      this.configWindow.setMenuBarVisibility(false);
      this.loadUrlOnBrowserWindow(this.configWindow, 'config');

      this.configWindow.on('close', () => {
        this.configWindow = null;
      });
    } else {
      this.configWindow.show();
    }
  }

  /**
   * Handle CLOSE_CONFIG action
   * Closes the configuration window
   */
  async handleCloseConfig(): Promise<void> {
    this.configWindow?.close();
    this.configWindow = null;
  }

  /**
   * Handle DISPLAY_TEXT_COMPLETE action
   * Handles app exit after text display completion
   */
  async handleDisplayTextComplete(): Promise<void> {
    if (this.isAppExiting) {
      if (this.appExitTimeout) {
        clearTimeout(this.appExitTimeout);
        this.appExitTimeout = null;
      }
      setTimeout(() => {
        require('electron').app.quit();
      }, 3000);
    }
  }

  /**
   * Handle RESET_CHAT_HISTORY action
   * Resets chat history and initiates new greeting
   */
  async handleResetChatHistory(): Promise<void> {
    this.ghost.resetChatHistory();
    await this.sendGhostMessage((g) => g.sayHello());
  }

  /**
   * Handle OPEN_LOG action
   * Opens or shows the logs window
   */
  async handleOpenLog(): Promise<void> {
    if (!this.logsWindow) {
      this.logsWindow = createWindow('logs', {
        width: 1000,
        height: 750,
        transparent: false,
        frame: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
        },
      }, this.displayScale, true);

      this.loadUrlOnBrowserWindow(this.logsWindow, 'logs');
      this.logsWindow.setMenuBarVisibility(false);

      this.logsWindow.on('close', () => {
        this.logsWindow = null;
      });
    } else {
      this.logsWindow.show();
    }
  }

  /**
   * Handle LOG_OPENED action
   * Sends chat history to logs window
   */
  async handleLogOpened(): Promise<void> {
    const allMessages = chatHistoryRepository.getAllMessages(this.characterName);
    const archiveList = chatHistoryRepository.getArchiveList(this.characterName);

    const chatLogs = allMessages
      .filter(msg => msg.type !== 'system')
      .map(msg => msg.toChatLog());

    this.logsWindow?.webContents.send('receive_chatlogs', {
      current: chatLogs,
      archives: archiveList.map(key => ({
        key,
        timestamp: key.split('_').pop()?.replace('.json', '') || ''
      })),
      stats: {
        total: allMessages.length,
        conversation: allMessages.length,
        summary: 0
      }
    });
  }

  /**
   * Handle LOAD_ARCHIVE action
   * Placeholder for archive loading (requires data from renderer)
   */
  async handleLoadArchive(): Promise<void> {
    // This will be sent with data from renderer
  }

  /**
   * Handle MOVE_TO_TRAY action
   * Hides the ghost window and shows it in tray
   */
  async handleMoveToTray(): Promise<void> {
    console.log('[UserActionHandler] Moving ghost to tray');
    this.mainWindow.hide();
    // isGhostHidden state is tracked in background.ts
  }

  /**
   * Main action handler dispatcher
   * Routes actions to appropriate handler methods
   */
  async handleAction(action: string): Promise<void> {
    console.log('[UserActionHandler]', action);

    switch (action) {
      case 'APP_STARTED':
        await this.handleAppStarted();
        break;
      case 'CHARACTER_LOADED':
        await this.handleCharacterLoaded();
        break;
      case 'CHAT_OPENED':
        await this.handleChatOpened();
        break;
      case 'CHAT_CLOSED':
        await this.handleChatClosed();
        break;
      case 'APP_QUIT':
        await this.handleAppQuit();
        break;
      case 'BUBBLE_CLOSED':
        await this.handleBubbleClosed();
        break;
      case 'REQUEST_CONFIG':
        await this.handleRequestConfig();
        break;
      case 'OPEN_CONFIG':
        await this.handleOpenConfig();
        break;
      case 'CLOSE_CONFIG':
        await this.handleCloseConfig();
        break;
      case 'DISPLAY_TEXT_COMPLETE':
        await this.handleDisplayTextComplete();
        break;
      case 'RESET_CHAT_HISTORY':
        await this.handleResetChatHistory();
        break;
      case 'OPEN_LOG':
        await this.handleOpenLog();
        break;
      case 'LOG_OPENED':
        await this.handleLogOpened();
        break;
      case 'LOAD_ARCHIVE':
        await this.handleLoadArchive();
        break;
      case 'MOVE_TO_TRAY':
        await this.handleMoveToTray();
        break;
      default:
        console.warn('[UserActionHandler] Unknown action:', action);
    }
  }

  /**
   * Send message to ghost and display in speech bubble
   * Core orchestration method for ghost message flow
   */
  private async sendGhostMessage(
    messageBlock: (ghost: GhostService) => Promise<GhostResponse>
  ): Promise<void> {
    this.ghostIsProcessingMessage = true;
    this.mainWindow.webContents.send('user-action', 'BUBBLE_OPENED');

    // Create speech bubble window if not exists
    const isNewWindow = !this.speechBubbleWindow;
    if (isNewWindow) {
      this.speechBubbleWindow = this.createSpeechBubbleWindow();
      this.loadUrlOnBrowserWindow(this.speechBubbleWindow, 'speechBubblePage');
      this.positionSpeechBubble();

      // Wait for window to be ready before starting message flow
      await new Promise<void>((resolve) => {
        this.speechBubbleWindow!.once('ready-to-show', () => {
          this.speechBubbleWindow?.showInactive();
          this.applySpeechBubbleStyle();
          resolve();
        });
      });
    }

    if (!this.speechBubbleWindow.isVisible()) {
      this.speechBubbleWindow.showInactive();
    }

    try {
      this.speechBubbleWindow.webContents.send('ghost-message-loading', true);
      const response = await messageBlock(this.ghost);

      if (this.isAppExiting && this.appExitTimeout) {
        clearTimeout(this.appExitTimeout);
        this.appExitTimeout = null;
      }

      // If window was closed during message processing, recreate it
      if (!this.speechBubbleWindow) {
        console.log('[UserActionHandler] Speech bubble closed during processing, recreating...');
        this.speechBubbleWindow = this.createSpeechBubbleWindow();
        this.loadUrlOnBrowserWindow(this.speechBubbleWindow, 'speechBubblePage');
        this.positionSpeechBubble();

        this.speechBubbleWindow.once('ready-to-show', () => {
          this.speechBubbleWindow?.showInactive();
          this.applySpeechBubbleStyle();
          this.speechBubbleWindow?.webContents.send('ghost-message-loading', false);
          this.speechBubbleWindow?.webContents.send('ghost-message', response);
        });
      } else {
        this.speechBubbleWindow.webContents.send('ghost-message-loading', false);
        this.speechBubbleWindow.webContents.send('ghost-message', response);
      }
      this.mainWindow.webContents.send('ghost-message', response);

      const chatHistory = getChatHistory(this.characterName);
      this.logsWindow?.webContents.send('receive_chatlogs', chatHistory.toChatLogs());

      this.ghostIsProcessingMessage = false;
    } catch (error) {
      console.error(error);
      // If window was closed during error, recreate it to show error
      if (!this.speechBubbleWindow) {
        console.log('[UserActionHandler] Speech bubble closed during error, recreating...');
        this.speechBubbleWindow = this.createSpeechBubbleWindow();
        this.loadUrlOnBrowserWindow(this.speechBubbleWindow, 'speechBubblePage');
        this.positionSpeechBubble();

        this.speechBubbleWindow.once('ready-to-show', () => {
          this.speechBubbleWindow?.showInactive();
          this.applySpeechBubbleStyle();
          this.speechBubbleWindow?.webContents.send('ghost-message-loading', false);
          this.speechBubbleWindow?.webContents.send('ghost-message', { error: error });
        });
      } else {
        this.speechBubbleWindow.webContents.send('ghost-message-loading', false);
        this.speechBubbleWindow.webContents.send('ghost-message', { error: error });
      }
      this.mainWindow.webContents.send('ghost-message', { error: error });
      this.ghostIsProcessingMessage = false;
    }
  }

  /**
   * Create speech bubble window with proper configuration
   */
  private createSpeechBubbleWindow(): BrowserWindow {
    return createWindow('speech-bubble', {
      width: this.speechBubbleWidth,
      height: this.characterAppearance.character_height,
      transparent: true,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    }, this.displayScale, true);
  }

  /**
   * Position speech bubble relative to character
   */
  private positionSpeechBubble(): void {
    if (!this.speechBubbleWindow) return;

    const screenWidth = screen.getPrimaryDisplay().workAreaSize.width;
    const scaledBubbleWidth = Math.floor(this.speechBubbleWidth * this.displayScale);
    const scaledCharWidth = Math.floor(this.characterAppearance.character_width * this.displayScale);
    const mainBounds = this.mainWindow.getBounds();

    if (mainBounds.x < screenWidth / 2) {
      this.speechBubbleWindow.setPosition(
        mainBounds.x + scaledCharWidth + 50,
        mainBounds.y
      );
    } else {
      this.speechBubbleWindow.setPosition(
        mainBounds.x - scaledBubbleWidth - 50,
        mainBounds.y
      );
    }
  }

  /**
   * Apply custom styling to speech bubble
   */
  private applySpeechBubbleStyle(): void {
    const speechBubbleFontFamily = this.configRepository.getConfig('speechBubbleFontFamily') as string;
    const speechBubbleFontSize = this.configRepository.getConfig('speechBubbleFontSize') as number;
    const speechBubbleCustomCSS = this.configRepository.getConfig('speechBubbleCustomCSS') as string;

    if (speechBubbleFontFamily || speechBubbleFontSize || speechBubbleCustomCSS) {
      this.speechBubbleWindow?.webContents.send('update-speech-bubble-style', {
        fontFamily: speechBubbleFontFamily || '',
        fontSize: speechBubbleFontSize || 16,
        customCSS: speechBubbleCustomCSS || ''
      });
    }
  }

  /**
   * Load URL on browser window with proper prod/dev handling
   */
  private loadUrlOnBrowserWindow(window: BrowserWindow, url: string): void {
    if (this.isProd) {
      window.loadURL(`app://./${url}`);
    } else {
      const port = process.argv[2] || '8888';
      const fullUrl = `http://localhost:${port}/${url}`;
      console.log(`Loading URL: ${fullUrl}`);
      window.loadURL(fullUrl);
    }
  }

  /**
   * Update speech bubble position when main window moves
   */
  updateSpeechBubblePosition(newX: number, newY: number): void {
    if (!this.speechBubbleWindow) return;

    const screenWidth = screen.getPrimaryDisplay().workAreaSize.width;
    const scaledCharWidth = Math.floor(this.characterAppearance.character_width * this.displayScale);
    const scaledBubbleWidth = Math.floor(this.speechBubbleWidth * this.displayScale);

    if (newX < screenWidth / 2) {
      this.speechBubbleWindow.setPosition(newX + scaledCharWidth + 50, newY, false);
    } else {
      this.speechBubbleWindow.setPosition(newX - scaledBubbleWidth - 50, newY, false);
    }
  }

  /**
   * Close user chat input window
   */
  closeUserChatInputWindow(): void {
    this.userChatInputWindow?.close();
  }

  /**
   * Handle user message input
   * Public method for external message handling
   */
  async handleUserMessage(message: { input: string; isSystemMessage: boolean }): Promise<void> {
    // Close input first, then process message
    this.closeUserChatInputWindow();

    // Update last interaction time for non-system messages
    if (!message.isSystemMessage) {
      this.updateLastInteraction();
    }

    await this.sendGhostMessage((g) => g.sendRawMessage(message));
  }
}
