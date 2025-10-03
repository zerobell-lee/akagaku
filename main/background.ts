import path from 'path'
import { app, BrowserWindow, ipcMain, protocol, screen, Tray, nativeImage, shell } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import { GhostService } from './infrastructure/ghost/GhostService'
import { configRepository, initConfigRepository } from './infrastructure/config/ConfigRepository'
import { CharacterSettingLoader } from './infrastructure/character/CharacterRepository'
import fs from 'fs'
import { CharacterAppearance, CharacterProperties, UserInput, GhostResponse } from '@shared/types'
import dotenv from 'dotenv'
import { getChatHistory, chatHistoryRepository } from './infrastructure/chat/ChatHistoryRepository'
import { ToolRegistry } from './domain/services/ToolRegistry'
import { ToolConfigRepository } from './infrastructure/tools/ToolConfigRepository'
import { WeatherToolMetadata, createWeatherTool } from './domain/tools/definitions/WeatherTool'
import { CryptoToolMetadata, createCryptoTool } from './domain/tools/definitions/CryptoTool'
import { UserToolMetadata, createUserTool } from './domain/tools/definitions/UserTool'
import { OpenUrlToolMetadata, createOpenUrlTool, BookmarksToolMetadata, createBookmarksTool } from './domain/tools/definitions/BrowserTool'
import { InstalledAppsToolMetadata, createInstalledAppsTool, OpenAppToolMetadata, createOpenAppTool } from './domain/tools/definitions/AppTool'
import { ScheduleToolMetadata, createScheduleTool } from './domain/tools/definitions/ScheduleTool'
import { streamingEvents } from './domain/ghost/graph/utils/StreamingEventEmitter'
import { UserActionHandler } from './presentation/handlers/UserActionHandler'
import { ConfigHandler } from './presentation/handlers/ConfigHandler'
import { TriggerManager } from './domain/services/TriggerManager'
import { triggerRegistry } from './infrastructure/triggers/TriggerRegistry'
import { logger } from './infrastructure/config/logger'
import { setRelationshipUpdateCallback } from './domain/ghost/graph/nodes/UpdateNode'
import { TopicManager } from './domain/services/TopicManager'
import { topicRepository } from './infrastructure/topic/TopicRepository'
import { relationshipRepository } from './infrastructure/user/RelationshipRepository'


// app.commandLine.appendSwitch('high-dpi-support', '1');
// app.commandLine.appendSwitch('force-device-scale-factor', '1');

const isProd = process.env.NODE_ENV === 'production'

console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
console.log('[DEBUG] isProd:', isProd);

if (!isProd) {
  dotenv.config();
}

if (isProd) {
  serve({ directory: 'app' })
}

// Config and ghost will be initialized after app.whenReady()
let ghost: GhostService;
let characterName: string;
let displayScale: number;
let speechBubbleWidth: number;

// Setter functions for runtime updates
export function setDisplayScale(scale: number): void {
  displayScale = scale;
  logger.debug('[background] displayScale updated to:', scale);
}

export function setSpeechBubbleWidth(width: number): void {
  speechBubbleWidth = width;
  logger.debug('[background] speechBubbleWidth updated to:', width);
}
let toolRegistry: ToolRegistry;
let toolConfigRepository: ToolConfigRepository;

// Force device scale factor to 1.0 to prevent scaling issues on high-DPI displays
// This ensures consistent rendering across all platforms (Windows, macOS Retina, Linux)


const isPositionVisible = (x: number, y: number, width: number, height: number): boolean => {
  const displays = screen.getAllDisplays();

  // Check if window is visible on any display
  for (const display of displays) {
    const { x: dx, y: dy, width: dw, height: dh } = display.bounds;

    // Window is visible if any part of it is within display bounds
    if (
      x + width > dx &&
      x < dx + dw &&
      y + height > dy &&
      y < dy + dh
    ) {
      return true;
    }
  }

  return false;
};

const createGhostWindow = (characterAppearance: CharacterAppearance) => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const screenWidth = primaryDisplay.bounds.width;
  const screenHeight = primaryDisplay.bounds.height;

  const ghostWindow = createWindow('main', {
    width: characterAppearance.character_width,
    height: characterAppearance.character_height,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  }, displayScale, true)  // applyScaleToSize: true

  // Window size is already scaled by createWindow
  const scaledWidth = Math.floor(characterAppearance.character_width * displayScale);
  const scaledHeight = Math.floor(characterAppearance.character_height * displayScale);

  const actualBounds = ghostWindow.getBounds();
  console.log('[Window] Character dimensions:', {
    original: { width: characterAppearance.character_width, height: characterAppearance.character_height },
    displayScale,
    scaled: { width: scaledWidth, height: scaledHeight },
    actualWindowBounds: actualBounds,
    screenHeight
  });

  // Try to load saved position
  const savedPosition = configRepository.getConfig('windowPosition') as { x: number; y: number } | undefined;

  let finalX: number;
  let finalY: number;

  if (savedPosition && isPositionVisible(savedPosition.x, 0, scaledWidth, scaledHeight)) {
    // Use saved X position, but always pin to bottom of screen for Y
    finalX = savedPosition.x;
    finalY = screenHeight - scaledHeight;
    console.log('[Window] Using saved X position, bottom-aligned Y:', { x: finalX, y: finalY });
  } else {
    // Fall back to default position
    finalX = Math.floor(screenWidth * 0.8) - scaledWidth;
    finalY = screenHeight - scaledHeight;
    console.log('[Window] Using default position (saved position not visible or not found):', { x: finalX, y: finalY });
  }

  ghostWindow.setPosition(finalX, finalY)

  return ghostWindow
};

const loadUrlOnBrowserWindow = (window: BrowserWindow, url: string) => {
  if (isProd) {
    window.loadURL(`app://./${url}`)
  } else {
    // nextron에서 포트가 제대로 전달되지 않을 경우 기본 포트 사용
    const port = process.argv[2] || '8888'
    const fullUrl = `http://localhost:${port}/${url}`
    console.log(`Loading URL: ${fullUrl}`)
    console.log(`Process args:`, process.argv)
    window.loadURL(fullUrl)
  }
}

const createOnboardingWindow = () => {
  const onboardingWindow = createWindow('onboarding', {
    width: 800,
    height: 600,
    title: 'Akagaku Setup',
    transparent: false,
    frame: true,
    resizable: false,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  }, 1.0, false)

  onboardingWindow.setMenuBarVisibility(false);
  loadUrlOnBrowserWindow(onboardingWindow, 'onboarding');

  return onboardingWindow;
}

const hasApiKey = (): boolean => {
  const openaiKey = configRepository.getConfig('openaiApiKey') || '';
  const anthropicKey = configRepository.getConfig('anthropicApiKey') || '';
  const customKey = configRepository.getConfig('customApiKey') || '';

  return openaiKey.length > 0 || anthropicKey.length > 0 || customKey.length > 0;
}

(async () => {
  await app.whenReady()

  // Set userData path after app is ready
  if (!isProd) {
    const devPath = `${app.getPath('userData')} (development)`;
    console.log('[DEBUG] Setting userData to:', devPath);
    app.setPath('userData', devPath);
  }

  console.log('[DEBUG] userData path:', app.getPath('userData'));

  // Initialize config repository after setting userData path
  initConfigRepository();

  // Initialize tool registry
  toolRegistry = new ToolRegistry();
  toolConfigRepository = new ToolConfigRepository();

  // Register all tools with their factories
  toolRegistry.registerTool(WeatherToolMetadata, toolConfigRepository.getToolConfig('get_weather'), createWeatherTool);
  toolRegistry.registerTool(CryptoToolMetadata, toolConfigRepository.getToolConfig('get_crypto_price'), createCryptoTool);
  toolRegistry.registerTool(UserToolMetadata, toolConfigRepository.getToolConfig('get_user_info'), createUserTool);
  toolRegistry.registerTool(OpenUrlToolMetadata, toolConfigRepository.getToolConfig('open_url'), createOpenUrlTool);
  toolRegistry.registerTool(BookmarksToolMetadata, toolConfigRepository.getToolConfig('get_bookmarks'), createBookmarksTool);
  toolRegistry.registerTool(InstalledAppsToolMetadata, toolConfigRepository.getToolConfig('get_installed_apps'), createInstalledAppsTool);
  toolRegistry.registerTool(OpenAppToolMetadata, toolConfigRepository.getToolConfig('open_app'), createOpenAppTool);
  toolRegistry.registerTool(ScheduleToolMetadata, toolConfigRepository.getToolConfig('get_schedule'), createScheduleTool);

  console.log('[ToolRegistry] Initialized with tools:', toolRegistry.getEnabledToolIds());

  // Load config values
  const openaiApiKey = configRepository.getConfig('openaiApiKey') || "";
  const anthropicApiKey = configRepository.getConfig('anthropicApiKey') || "";
  const customApiKey = configRepository.getConfig('customApiKey') || "";
  const customBaseURL = configRepository.getConfig('customBaseURL') || "";
  const llmProvider = configRepository.getConfig('llmProvider') || configRepository.getConfig('llmService') || "openai";
  const selectedModel = configRepository.getConfig('selectedModel') || "gpt-5";
  const temperature = configRepository.getConfig('temperature') || 1;
  characterName = configRepository.getConfig('characterName') as string || "minkee";
  displayScale = configRepository.getConfig('displayScale') as number || 0.5;
  speechBubbleWidth = configRepository.getConfig('speechBubbleWidth') as number || 500;
  console.log('[DEBUG] displayScale loaded:', displayScale);
  console.log('[DEBUG] speechBubbleWidth loaded:', speechBubbleWidth);

  // LangSmith configuration
  const enableLangsmithTracing = configRepository.getConfig('enableLangsmithTracing') as boolean || false;
  const langsmithApiKey = configRepository.getConfig('langsmithApiKey') as string || "";
  const langsmithProjectName = configRepository.getConfig('langsmithProjectName') as string || "akagaku";

  if (enableLangsmithTracing && langsmithApiKey) {
    process.env.LANGCHAIN_TRACING_V2 = "true";
    process.env.LANGCHAIN_API_KEY = langsmithApiKey;
    process.env.LANGCHAIN_PROJECT = langsmithProjectName;
    console.log('[LangSmith] Tracing enabled for project:', langsmithProjectName);
  } else {
    process.env.LANGCHAIN_TRACING_V2 = "false";
    console.log('[LangSmith] Tracing disabled');
  }

  // Determine API key based on provider
  const getApiKeyForProvider = (provider: string): string => {
    switch (provider) {
      case 'openai':
      case 'azure-openai':
        return openaiApiKey;
      case 'anthropic':
        return anthropicApiKey;
      case 'openrouter':
      case 'aws-bedrock':
      case 'google-vertex':
      case 'custom':
        return customApiKey || openaiApiKey;
      default:
        return openaiApiKey;
    }
  };

  // Initialize ghost service
  ghost = new GhostService(
    {
      llm_properties: {
        llmService: (llmProvider === 'openai' || llmProvider === 'anthropic') ? llmProvider : 'openai',
        modelName: selectedModel as string,
        apiKey: getApiKeyForProvider(llmProvider),
        temperature: temperature as number,
        baseURL: customBaseURL || undefined,
      },
      character_setting: CharacterSettingLoader.getCharacterSetting(characterName),
      toolRegistry: toolRegistry,
    }
  );

  console.log("ghost", ghost);

  // macOS에서는 추가적인 초기화 시간이 필요할 수 있음
  if (process.platform === 'darwin') {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  protocol.handle('local-resource', async (request) => {
    const url = request.url.replace('local-resource://', '')
    const decodedUrl = decodeURI(url)
    try {
      const filePath = path.join(app.getAppPath(), '/data', decodedUrl)
      const data = fs.readFileSync(filePath)

      // MIME 타입 결정
      const ext = path.extname(filePath).toLowerCase()
      let mimeType = 'application/octet-stream'
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
      else if (ext === '.png') mimeType = 'image/png'
      else if (ext === '.gif') mimeType = 'image/gif'

      const blob = new Blob([data], { type: mimeType })
      return new Response(blob)
    } catch (error) {
      console.error('Failed to handle protocol', error)
      return new Response('File not found', { status: 404 })
    }
  })

  // Check if user needs onboarding (no API key configured)
  if (!hasApiKey()) {
    console.log('[Onboarding] No API key found, showing onboarding window');
    const onboardingWindow = createOnboardingWindow();

    // Import and initialize OnboardingHandler
    const { OnboardingHandler } = require('./presentation/handlers/OnboardingHandler');
    const onboardingHandler = new OnboardingHandler({
      configRepository,
      toolConfigRepository
    });

    // Set callback to restart app after onboarding
    onboardingHandler.setOnComplete(() => {
      console.log('[Onboarding] Complete, restarting app');
      onboardingWindow.close();

      // Restart the app to initialize with new config
      app.relaunch();
      app.exit(0);
    });

    // Register onboarding handler
    const { IPCRegistry } = require('./presentation/ipc/IPCRegistry');
    IPCRegistry.instance.registerHandler(onboardingHandler);
    IPCRegistry.instance.initialize(ipcMain);

    return;
  }

  // Normal flow: create ghost window directly
  const characterAppearance = CharacterSettingLoader.getCharacterAppearance(characterName);
  const mainWindow = createGhostWindow(characterAppearance)

  loadUrlOnBrowserWindow(mainWindow, 'home')
  
  // macOS에서 앱이 제대로 표시되도록 함
  if (process.platform === 'darwin') {
    app.dock?.show()
    mainWindow.show()
    app.focus()
  }

  // Tray icon setup with platform-specific handling
  let tray: Tray | null = null;
  let isGhostHidden = false;

  try {
    // macOS uses template images for proper dark/light mode support
    // Windows uses .ico files
    let iconPath: string;
    if (process.platform === 'darwin') {
      // macOS: Use template PNG (16x16, automatically scales for Retina)
      iconPath = path.join(__dirname, '../resources/iconTemplate.png');
      const trayIcon = nativeImage.createFromPath(iconPath);
      trayIcon.setTemplateImage(true); // Enable template mode for macOS
      tray = new Tray(trayIcon);
    } else {
      // Windows: Use .ico file
      iconPath = path.join(__dirname, '../resources/icon.ico');
      tray = new Tray(iconPath);
    }

    tray.setToolTip('Akagaku - Desktop Character');

    tray.on('click', () => {
      if (isGhostHidden) {
        // Show ghost and activate tray trigger
        console.log('[Tray] Ghost activated from tray');
        mainWindow.show();
        isGhostHidden = false;

        // Update last interaction time to prevent interval trigger from firing
        userActionHandler.updateLastInteraction();

        // Resume triggers when restoring from tray
        triggerManager.resume();

        // Activate tray trigger
        const trayTrigger = triggerManager.getTrigger('tray-activation');
        if (trayTrigger && 'activate' in trayTrigger) {
          (trayTrigger as any).activate();
          // Force immediate trigger check
          triggerManager.checkTriggers();
        }
      } else {
        // Just show window if not hidden
        mainWindow.show();
      }
    });

    console.log('[Tray] Tray icon initialized');
  } catch (error) {
    console.warn('[Tray] Tray icon could not be loaded:', error);
  }

  // Initialize UserActionHandler
  const userActionHandler = new UserActionHandler({
    mainWindow,
    characterName,
    characterAppearance,
    displayScale,
    speechBubbleWidth,
    ghost,
    configRepository,
    toolConfigRepository,
    isProd
  });

  // Set up relationship update callback from UpdateNode to UserActionHandler
  setRelationshipUpdateCallback((affection: number, attitude: string) => {
    userActionHandler.broadcastRelationshipUpdate(affection, attitude);
  });

  // Initialize ConfigHandler
  const configHandler = new ConfigHandler({
    configRepository,
    toolConfigRepository,
    toolRegistry,
    ghost,
    userActionHandler
  });


  // Initialize TopicManager for conversation topics
  const topicManager = new TopicManager();
  const topics = topicRepository.loadTopicsForCharacter(characterName);
  topicManager.loadTopics(topics);
  console.log(`[TopicManager] Loaded ${topics.length} topics for ${characterName}`);

  // Initialize TriggerManager
  const triggerManager = new TriggerManager(60000); // Check every minute
  const triggers = triggerRegistry.createDefaultTriggers();
  triggers.forEach(trigger => triggerManager.registerTrigger(trigger));

  // Set up trigger callback to send system messages to ghost
  triggerManager.setOnTriggerFire(async (message, triggerId) => {
    console.log(`[TriggerManager] Trigger ${triggerId} fired, sending message to ghost`);
    try {
      // For interval-idle trigger, use topic system
      if (triggerId === 'interval-idle') {
        const relationship = relationshipRepository.getCharacterRelationships(characterName);
        const currentAffection = relationship?.affection_to_user || 50;

        // Select random topic
        const topic = topicManager.selectTopic(currentAffection);

        if (topic) {
          console.log(`[TriggerManager] Selected topic: ${topic.id}`);

          // Send chit-chat with topic content (via UserActionHandler to show in UI)
          await userActionHandler.handleChitChatTrigger(topic.content);

          // Mark topic as used
          topicManager.markTopicUsed(topic.id);
          topicRepository.saveTopicUsage(characterName, topic.id);
        } else {
          console.log('[TriggerManager] No available topics, using default chit-chat');
          await userActionHandler.handleChitChatTrigger();
        }
      } else {
        // Other triggers use normal system message
        await userActionHandler.handleUserMessage({
          input: message,
          isSystemMessage: true
        });
      }
    } catch (error) {
      console.error(`[TriggerManager] Failed to send trigger message:`, error);
    }
  });

  // Start trigger manager after character loads
  userActionHandler.setOnCharacterLoaded(() => {
    console.log('[TriggerManager] Starting trigger manager');
    triggerManager.start(() => ({
      lastInteractionTime: userActionHandler.getLastInteractionTime(),
      characterId: characterName,
      metadata: {}
    }));
  });

  // Setup streaming event listeners
  streamingEvents.on('stream-start', ({ characterId }) => {
    console.log('[Streaming] Stream started for character:', characterId);
    userActionHandler.setStreamHasStarted(true);

    // Clear app exit timeout since streaming has started
    if (userActionHandler.getIsAppExiting()) {
      console.log('[App Exit] Stream started, clearing exit timeout');
      userActionHandler.clearAppExitTimeout();
    }

    const speechBubbleWindow = userActionHandler.getSpeechBubbleWindow();
    if (speechBubbleWindow) {
      speechBubbleWindow.webContents.send('ghost-message-start-stream');
    }
  });

  streamingEvents.on('emoticon-parsed', ({ characterId, emoticon }) => {
    console.log('[Streaming] Emoticon parsed:', emoticon);
    // Send to main window to update character expression immediately
    mainWindow.webContents.send('ghost-emoticon', emoticon);
  });

  streamingEvents.on('stream-chunk', ({ characterId, chunk }) => {
    const speechBubbleWindow = userActionHandler.getSpeechBubbleWindow();
    if (speechBubbleWindow) {
      speechBubbleWindow.webContents.send('ghost-message-chunk', chunk);
    }
  });

  streamingEvents.on('stream-complete', ({ characterId }) => {
    console.log('[Streaming] Stream completed for character:', characterId);
    userActionHandler.setStreamHasStarted(false);

    // If app is exiting, let DISPLAY_TEXT_COMPLETE handle the quit timing
    // This ensures the UI has time to display the complete message
  });

  streamingEvents.on('stream-error', ({ characterId, error }) => {
    console.error('[Streaming] Stream error for character:', characterId, error);
    userActionHandler.setStreamHasStarted(false);

    // If app is exiting and stream errored, quit after delay
    if (userActionHandler.getIsAppExiting()) {
      console.log('[App Exit] Streaming error, quitting in 3 seconds');
      setTimeout(() => {
        app.quit();
      }, 3000);
    }
  });

  // Import IPC infrastructure
  const { IPCRegistry } = require('./presentation/ipc/IPCRegistry');
  const { WindowEventHandler } = require('./presentation/handlers/WindowEventHandler');
  const { MessageHandler } = require('./presentation/handlers/MessageHandler');
  const { ArchiveHandler } = require('./presentation/handlers/ArchiveHandler');
  const { CharacterHandler } = require('./presentation/handlers/CharacterHandler');

  // Create specialized handlers
  const windowEventHandler = new WindowEventHandler(
    mainWindow,
    configRepository,
    userActionHandler
  );

  const messageHandler = new MessageHandler(userActionHandler);

  const archiveHandler = new ArchiveHandler();
  // Set logs window reference when it's created
  const originalGetLogsWindow = userActionHandler.getLogsWindow.bind(userActionHandler);
  userActionHandler.getLogsWindow = () => {
    const logsWindow = originalGetLogsWindow();
    if (logsWindow) {
      archiveHandler.setLogsWindow(logsWindow);
    }
    return logsWindow;
  };

  const characterHandler = new CharacterHandler(userActionHandler);

  // Register all handlers with IPCRegistry
  IPCRegistry.instance.registerHandler(userActionHandler);
  IPCRegistry.instance.registerHandler(configHandler);
  IPCRegistry.instance.registerHandler(windowEventHandler);
  IPCRegistry.instance.registerHandler(messageHandler);
  IPCRegistry.instance.registerHandler(archiveHandler);
  IPCRegistry.instance.registerHandler(characterHandler);

  // Initialize registry (this binds all handlers to ipcMain)
  IPCRegistry.instance.initialize(ipcMain);

  // Log registered events
  console.log('[IPCRegistry] Registered events:', IPCRegistry.instance.getRegisteredEvents());

  // Handle MOVE_TO_TRAY state (temporary until TrayHandler is created)
  const originalHandleAction = userActionHandler.handleAction.bind(userActionHandler);
  userActionHandler.handleAction = async function(action: string) {
    if (action === 'MOVE_TO_TRAY') {
      isGhostHidden = true;
      // Pause triggers when moving to tray
      triggerManager.pause();
    }
    return originalHandleAction(action);
  };

  mainWindow.on('close', () => {
    // Stop trigger manager on app close
    triggerManager.stop();
    app.quit()
  })
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})

// Open external URL in default browser
ipcMain.on('open-external', async (event, url: string) => {
  await shell.openExternal(url);
})


