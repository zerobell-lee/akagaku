import { BrowserWindow, IpcMainEvent, screen } from 'electron';
import path from 'path';
import { GhostService } from '../../infrastructure/ghost/GhostService';
import { CharacterAppearance, CharacterProperties, GhostResponse, UserInput } from '@shared/types';
import { ConfigRepository } from '../../infrastructure/config/ConfigRepository';
import { ToolConfigRepository } from '../../infrastructure/tools/ToolConfigRepository';
import { chatHistoryRepository, getChatHistory } from '../../infrastructure/chat/ChatHistoryRepository';
import { createWindow } from '../../helpers';
import { PlatformUtils } from '../../helpers/PlatformUtils';
import { ScreenUtils } from '../../helpers/ScreenUtils';
import { skinRepository } from '../../infrastructure/character/SkinRepository';
import { ListSkinsUseCase } from '../../application/use-cases/ListSkinsUseCase';
import { ChangeSkinUseCase } from '../../application/use-cases/ChangeSkinUseCase';
import { relationshipRepository } from '../../infrastructure/user/RelationshipRepository';
import { IIPCHandler } from '../ipc/IIPCHandler';
import { logger } from '../../infrastructure/config/logger';

// Constants
const SPEECH_BUBBLE_HEIGHT = 768; // Fixed height based on Minkee's character height

/**
 * UserActionHandler - Presentation layer handler for user actions
 *
 * Handles all user-initiated actions from the renderer process.
 * Follows Clean Architecture by depending on infrastructure services
 * through dependency injection.
 */
export class UserActionHandler implements IIPCHandler {
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
  private characterInfoWindow: BrowserWindow | null = null;

  // State management
  private ghostIsProcessingMessage = false;
  private streamHasStarted = false;
  private appExitTimeout: NodeJS.Timeout | null = null;
  private isAppExiting = false;
  private lastInteractionTime: Date = new Date();
  private onCharacterLoadedCallback: (() => void) | null = null;

  // Streaming buffer
  private streamBuffer: Array<{ type: string; data: any }> = [];
  private speechBubbleReady = false;

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

  /**
   * Update display scale at runtime
   */
  updateDisplayScale(newScale: number): void {
    this.displayScale = newScale;
    logger.debug('[UserActionHandler] Display scale updated to:', newScale);
  }

  /**
   * Update speech bubble width at runtime
   */
  updateSpeechBubbleWidth(newWidth: number): void {
    this.speechBubbleWidth = newWidth;
    logger.debug('[UserActionHandler] Speech bubble width updated to:', newWidth);
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

  // IIPCHandler implementation
  getEventNames(): string[] {
    return ['user-action'];
  }

  canHandle(eventName: string): boolean {
    return eventName === 'user-action';
  }

  async handle(eventName: string, event: IpcMainEvent, ...args: any[]): Promise<void> {
    if (eventName === 'user-action') {
      const action = args[0] as string;

      // Update ghost hidden state when moving to tray
      if (action === 'MOVE_TO_TRAY') {
        // This state should be managed by TrayHandler in the future
        // For now, handle it here for compatibility
      }

      await this.handleAction(action);
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
        imgSrc: this.buildImagePath(graphic.imgSrc)
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
    // Check if we should skip greeting (e.g., after zoom factor change restart)
    const skipNextGreeting = this.configRepository.getConfig('skipNextGreeting') as boolean;

    if (skipNextGreeting) {
      console.log('[UserActionHandler] Skipping greeting due to app restart');
      this.configRepository.setConfig('skipNextGreeting', false);
    } else {
      await this.sendGhostMessage((g) => g.sayHello());
    }

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
        width: 900,
        height: 800,
        title: 'Akagaku - Settings',
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
   * Handle streaming complete event from renderer
   * Called when streaming message display is finished
   */
  handleStreamingComplete(): void {
    console.log('[UserActionHandler] Streaming complete received');
    if (this.isAppExiting) {
      console.log('[UserActionHandler] App is exiting, clearing timeout and setting 3s exit timer');
      if (this.appExitTimeout) {
        clearTimeout(this.appExitTimeout);
        this.appExitTimeout = null;
      }
      setTimeout(() => {
        console.log('[UserActionHandler] 3s timer elapsed, quitting app');
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
        width: 1400,
        height: 800,
        title: 'Akagaku - Chat History',
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
      archives: archiveList.map(key => {
        // Extract date and time from key: character_name/archive_YYYY-MM-DD_HH-MM-SS.json
        const parts = key.split('/').pop()?.replace('archive_', '').replace('.json', '') || '';
        const [dateStr, timeStr] = parts.split('_');
        const displayName = timeStr ? `${dateStr} ${timeStr.replace(/-/g, ':')}` : parts;
        return {
          key,
          timestamp: displayName
        };
      }),
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

    // Hide speech bubble when going to tray
    if (this.speechBubbleWindow && !this.speechBubbleWindow.isDestroyed()) {
      this.speechBubbleWindow.hide();
    }

    // isGhostHidden state is tracked in background.ts
  }

  /**
   * Handle OPEN_CHARACTER_INFO action
   * Opens character info window with skins
   */
  async handleOpenCharacterInfo(): Promise<void> {
    if (!this.characterInfoWindow) {
      this.characterInfoWindow = createWindow('character-info', {
        width: 1000,
        height: 800,
        title: 'Akagaku - Character Info',
        transparent: false,
        frame: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
        },
      }, this.displayScale, true);

      this.characterInfoWindow.setMenuBarVisibility(false);
      this.loadUrlOnBrowserWindow(this.characterInfoWindow, 'characterInfo');

      // Send data after window is ready
      this.characterInfoWindow.once('ready-to-show', async () => {
        this.characterInfoWindow?.show();
        // Wait a bit for React to mount
        setTimeout(() => {
          this.sendCharacterInfoData();
        }, 100);
      });

      this.characterInfoWindow.on('close', () => {
        this.characterInfoWindow = null;
      });
    } else {
      this.characterInfoWindow.show();
      this.sendCharacterInfoData();
    }
  }

  /**
   * Send character info data to window
   */
  private sendCharacterInfoData(): void {
    if (!this.characterInfoWindow) return;

    const listSkinsUseCase = new ListSkinsUseCase(skinRepository);
    const skins = listSkinsUseCase.execute(this.characterName);
    const activeSkinId = skinRepository.getActiveSkin(this.characterName);
    const relationshipData = relationshipRepository.getCharacterRelationships(this.characterName);

    console.log('[UserActionHandler] Sending character info:', {
      characterName: this.characterName,
      activeSkinId,
      skinsCount: skins.length,
      relationship: relationshipData
    });

    this.characterInfoWindow.webContents.send('character-info-response', {
      characterName: this.characterName,
      activeSkinId,
      skins,
      relationship: {
        affection: relationshipData.affection_to_user,
        attitude: relationshipData.attitude_to_user
      }
    });
  }

  /**
   * Broadcast relationship update to character info window
   * Called from UpdateNode when relationship changes during conversation
   */
  broadcastRelationshipUpdate(affection: number, attitude: string): void {
    if (this.characterInfoWindow && !this.characterInfoWindow.isDestroyed()) {
      logger.debug('[UserActionHandler] Broadcasting relationship update:', { affection, attitude });
      this.characterInfoWindow.webContents.send('relationship-updated', {
        affection,
        attitude
      });
    }
  }

  /**
   * Handle GET_CHARACTER_INFO action
   * Sends character info and skins to renderer
   */
  async handleGetCharacterInfo(): Promise<void> {
    this.sendCharacterInfoData();
  }

  /**
   * Handle CHANGE_SKIN action
   * Changes character skin and triggers AI reaction
   */
  async handleChangeSkin(skinId: string): Promise<void> {
    console.log(`[UserActionHandler] Changing skin to ${skinId}`);

    const changeSkinUseCase = new ChangeSkinUseCase(skinRepository);
    const result = changeSkinUseCase.execute({
      characterId: this.characterName,
      skinId
    });

    // Reload character appearance
    const { characterRepository } = require('../../infrastructure/character/CharacterRepository');
    this.characterAppearance = characterRepository.getCharacterAppearance(this.characterName);

    // Reload character graphics without triggering greeting
    const characterProperties: CharacterProperties = {
      character_name: this.characterName,
      character_width: this.characterAppearance.character_width,
      character_height: this.characterAppearance.character_height,
      graphics: this.characterAppearance.graphics.map(graphic => ({
        emoticon: graphic.emoticon,
        imgSrc: this.buildImagePath(graphic.imgSrc)
      })),
      touchable_areas: this.characterAppearance.touchable_areas,
      skipGreeting: true, // Don't trigger greeting on skin change
    };
    this.mainWindow.webContents.send('character_loaded', characterProperties);

    // macOS: Force window redraw to clear shadow ghosting
    if (process.platform === 'darwin') {
      // Method 1: Invalidate compositing to force re-render
      this.mainWindow.webContents.invalidate();

      // Method 2: Micro-resize trick to force macOS to recalculate window shadow
      const currentBounds = this.mainWindow.getBounds();
      this.mainWindow.setBounds({
        ...currentBounds,
        width: currentBounds.width + 1
      });
      setTimeout(() => {
        this.mainWindow.setBounds(currentBounds);
      }, 50);
    }

    // Send system message to ghost about skin change
    await this.handleUserMessage({
      input: result.triggerMessage,
      isSystemMessage: true
    });
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
      case 'OPEN_CHARACTER_INFO':
        await this.handleOpenCharacterInfo();
        break;
      case 'GET_CHARACTER_INFO':
        await this.handleGetCharacterInfo();
        break;
      default:
        console.warn('[UserActionHandler] Unknown action:', action);
    }
  }

  /**
   * Flush buffered stream chunks to speechBubble window
   */
  private flushStreamBuffer(): void {
    if (!this.speechBubbleWindow || this.streamBuffer.length === 0) {
      return;
    }

    console.log(`[UserActionHandler] Flushing ${this.streamBuffer.length} buffered chunks`);

    for (const item of this.streamBuffer) {
      if (item.type === 'chunk') {
        this.speechBubbleWindow.webContents.send('ghost-message-chunk', item.data);
      } else if (item.type === 'emoticon') {
        this.speechBubbleWindow.webContents.send('ghost-message-emoticon-update', item.data);
      }
    }

    this.streamBuffer = [];
  }

  /**
   * Add chunk to buffer or send directly if speechBubble is ready
   */
  public handleStreamChunk(type: string, data: any): void {
    if (this.speechBubbleReady && this.speechBubbleWindow) {
      // SpeechBubble is ready, send directly
      if (type === 'chunk') {
        this.speechBubbleWindow.webContents.send('ghost-message-chunk', data);
      } else if (type === 'emoticon') {
        this.speechBubbleWindow.webContents.send('ghost-message-emoticon-update', data);
      }
    } else {
      // SpeechBubble not ready yet, buffer it
      this.streamBuffer.push({ type, data });
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

    // Reset buffer state for new message
    this.streamBuffer = [];
    this.speechBubbleReady = false;

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

      // Add buffer delay to ensure window is fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.speechBubbleWindow.isVisible()) {
      this.speechBubbleWindow.showInactive();
    }

    // Mark speechBubble as ready and flush any buffered chunks
    this.speechBubbleReady = true;
    this.flushStreamBuffer();

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

      // Update logs window with ALL messages (not just windowed history)
      if (this.logsWindow) {
        const allMessages = chatHistoryRepository.getAllMessages(this.characterName);
        const chatLogs = allMessages
          .filter(msg => msg.type !== 'system')
          .map(msg => msg.toChatLog());

        this.logsWindow.webContents.send('receive_chatlogs', {
          current: chatLogs,
          archives: [],
          stats: {
            total: allMessages.length,
            conversation: allMessages.length,
            summary: 0
          }
        });
      }

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
      height: SPEECH_BUBBLE_HEIGHT,
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

    const screenWidth = ScreenUtils.getScreenWidth();
    const scaledBubbleWidth = Math.floor(this.speechBubbleWidth * this.displayScale);
    const scaledCharWidth = Math.floor(this.characterAppearance.character_width * this.displayScale);
    const mainBounds = this.mainWindow.getBounds();

    // Adjust gap based on zoom factor to maintain consistent visual spacing
    const gap = Math.floor(50 * this.displayScale);

    if (mainBounds.x < screenWidth / 2) {
      this.speechBubbleWindow.setPosition(
        mainBounds.x + scaledCharWidth + gap,
        mainBounds.y
      );
    } else {
      this.speechBubbleWindow.setPosition(
        mainBounds.x - scaledBubbleWidth - gap,
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

    const screenWidth = ScreenUtils.getScreenWidth();
    const scaledCharWidth = Math.floor(this.characterAppearance.character_width * this.displayScale);
    const scaledBubbleWidth = Math.floor(this.speechBubbleWidth * this.displayScale);

    if (newX < screenWidth / 2) {
      this.speechBubbleWindow.setPosition(newX + scaledCharWidth + 50, newY, false);
    } else {
      this.speechBubbleWindow.setPosition(newX - scaledBubbleWidth - 50, newY, false);
    }
  }

  /**
   * Build image path with current skin
   */
  private buildImagePath(filename: string): string {
    const activeSkinId = skinRepository.getActiveSkin(this.characterName);
    return `local-resource://character/${this.characterName}/skins/${activeSkinId}/images/${filename}`;
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

  /**
   * Handle chit-chat trigger with topic content
   * Public method for trigger manager to initiate ghost conversations
   */
  async handleChitChatTrigger(topicContent?: string): Promise<void> {
    // Don't update last interaction time - this is ghost-initiated
    await this.sendGhostMessage((g) => g.doChitChat(topicContent));
  }
}
