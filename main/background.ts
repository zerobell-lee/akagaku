import path from 'path'
import { app, BrowserWindow, dialog, ipcMain, protocol, screen, Tray } from 'electron'
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
import { UserInfoToolMetadata, createUserInfoTool } from './domain/tools/definitions/UserTool'
import { OpenUrlToolMetadata, createOpenUrlTool, BookmarksToolMetadata, createBookmarksTool } from './domain/tools/definitions/BrowserTool'
import { InstalledAppsToolMetadata, createInstalledAppsTool, OpenAppToolMetadata, createOpenAppTool } from './domain/tools/definitions/AppTool'
import { ScheduleToolMetadata, createScheduleTool } from './domain/tools/definitions/ScheduleTool'
import { streamingEvents } from './domain/ghost/graph/utils/StreamingEventEmitter'
import { UserActionHandler } from './presentation/handlers/UserActionHandler'
import { ConfigHandler } from './presentation/handlers/ConfigHandler'


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
let toolRegistry: ToolRegistry;
let toolConfigRepository: ToolConfigRepository;

// Force device scale factor to 1.0 to prevent scaling issues on high-DPI displays
// This ensures consistent rendering across all platforms (Windows, macOS Retina, Linux)


const createGhostWindow = (characterAppearance: CharacterAppearance) => {
  const screenWidth = screen.getPrimaryDisplay().workAreaSize.width
  const screenHeight = screen.getPrimaryDisplay().workAreaSize.height
  const scaledWidth = Math.floor(characterAppearance.character_width * displayScale);
  const scaledHeight = Math.floor(characterAppearance.character_height * displayScale);

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
  }, displayScale, true)

  ghostWindow.setPosition(
    Math.floor(screenWidth * 0.8) - scaledWidth,
    screenHeight - scaledHeight
  )

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
  toolRegistry.registerTool(UserInfoToolMetadata, toolConfigRepository.getToolConfig('get_user_info'), createUserInfoTool);
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

  const characterAppearance = CharacterSettingLoader.getCharacterAppearance(characterName);
  const mainWindow = createGhostWindow(characterAppearance)

  loadUrlOnBrowserWindow(mainWindow, 'home')
  
  // macOS에서 앱이 제대로 표시되도록 함
  if (process.platform === 'darwin') {
    app.dock?.show()
    mainWindow.show()
    app.focus()
  }

  // Tray 아이콘 설정 (macOS에서는 .ico 파일이 지원되지 않을 수 있음)
  try {
    const tray = new Tray(path.join(__dirname, '../resources/icon.ico'))
    tray.setToolTip('Akagaku')
    tray.on('click', () => {
      mainWindow.show()
    })
  } catch (error) {
    console.warn('Tray icon could not be loaded:', error)
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

  // Initialize ConfigHandler
  const configHandler = new ConfigHandler({
    configRepository,
    toolConfigRepository,
    toolRegistry,
    ghost,
    userActionHandler
  });

  let startMouse = null;
  let startWindow: { x: number, y: number } | null = null;

  let chitChatTimeout: NodeJS.Timeout | null = null;

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

    // If app is exiting, quit after streaming completes
    if (userActionHandler.getIsAppExiting()) {
      console.log('[App Exit] Streaming complete, quitting in 5 seconds');
      setTimeout(() => {
        app.quit();
      }, 5000);
    }
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

  // User action IPC handler - delegate to UserActionHandler
  ipcMain.on('user-action', async (event, arg) => {
    await userActionHandler.handleAction(arg);
  })

  ipcMain.on('drag-start', (event, arg) => {
    startMouse = screen.getCursorScreenPoint()
    const [x, y] = mainWindow.getPosition()
    startWindow = { x, y }
  })

  ipcMain.on('move-window', (event, arg) => {
    if (!startWindow || !startMouse) {
      return
    }
    const currentMouse = screen.getCursorScreenPoint()
    const dx = currentMouse.x - startMouse.x
    const { newX, newY } = { newX: startWindow.x + dx, newY: startWindow.y }
    mainWindow.setBounds({ x: newX, y: newY, width: mainWindow.getBounds().width, height: mainWindow.getBounds().height }, false)

    // Update speech bubble position via handler
    userActionHandler.updateSpeechBubblePosition(newX, newY);
  })

  // Config IPC handler - delegate to ConfigHandler
  ipcMain.on('save_config', async (event, configData) => {
    await configHandler.saveConfig(configData);
  })

  // Get system fonts - delegate to ConfigHandler
  ipcMain.handle('get-system-fonts', async () => {
    return await configHandler.getSystemFonts();
  })

  // Get available tools - delegate to ConfigHandler
  ipcMain.handle('get-available-tools', async () => {
    return configHandler.getAvailableTools();
  })

  ipcMain.on('load-archive', (event, archiveKey: string) => {
    const archiveMessages = chatHistoryRepository.getArchive(archiveKey)
    const chatLogs = archiveMessages
      .filter(msg => msg.type !== 'system')
      .map(msg => msg.toChatLog())
    const logsWindow = userActionHandler.getLogsWindow();
    logsWindow?.webContents.send('receive_archive_logs', chatLogs)
  })

  // Debounce state for duplicate message prevention
  let lastMessageHash = '';
  let lastMessageTime = 0;
  const DEBOUNCE_MS = 300; // 300ms debounce window

  ipcMain.on('user-message', async (event, message: UserInput) => {
    // Create hash from message content
    const messageHash = `${message.input}-${message.isSystemMessage}`;
    const now = Date.now();

    // Ignore duplicate messages within debounce window
    if (messageHash === lastMessageHash && (now - lastMessageTime) < DEBOUNCE_MS) {
      console.log('[IPC] Duplicate message ignored (debounce):', message.input.substring(0, 50));
      return;
    }

    // Ignore if already processing a message
    if (userActionHandler.getGhostIsProcessingMessage()) {
      console.log('[IPC] Message ignored (already processing):', message.input.substring(0, 50));
      return;
    }

    lastMessageHash = messageHash;
    lastMessageTime = now;

    // Delegate to handler
    await userActionHandler.handleUserMessage(message);
  })

  mainWindow.on('close', () => {
    app.quit()
  })
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})


