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


// app.commandLine.appendSwitch('high-dpi-support', '1');
// app.commandLine.appendSwitch('force-device-scale-factor', '1');

const isProd = process.env.NODE_ENV === 'production'

if (!isProd) {
  dotenv.config();
}

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

// Initialize config repository after setting userData path
initConfigRepository();

const openaiApiKey = configRepository.getConfig('openaiApiKey') || "";
const anthropicApiKey = configRepository.getConfig('anthropicApiKey') || "";
const customApiKey = configRepository.getConfig('customApiKey') || "";
const customBaseURL = configRepository.getConfig('customBaseURL') || "";
const llmProvider = configRepository.getConfig('llmProvider') || configRepository.getConfig('llmService') || "openai";
const selectedModel = configRepository.getConfig('selectedModel') || "gpt-5";
const temperature = configRepository.getConfig('temperature') || 1;
const characterName = configRepository.getConfig('characterName') as string || "minkee";
const displayScale = configRepository.getConfig('displayScale') as number || 0.5;
const speechBubbleWidth = configRepository.getConfig('speechBubbleWidth') as number || 500;
console.log('[DEBUG] displayScale loaded:', displayScale);
console.log('[DEBUG] speechBubbleWidth loaded:', speechBubbleWidth);

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

const ghost = new GhostService(
  {
    llm_properties: {
      llmService: (llmProvider === 'openai' || llmProvider === 'anthropic') ? llmProvider : 'openai',
      modelName: selectedModel as string,
      apiKey: getApiKeyForProvider(llmProvider),
      temperature: temperature as number,
      baseURL: customBaseURL || undefined,
    },
    character_setting: CharacterSettingLoader.getCharacterSetting(characterName),
  }
)

console.log("ghost", ghost);

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

  let userChatInputWindow: BrowserWindow | null = null;
  let configWindow: BrowserWindow | null = null;
  let speechBubbleWindow: BrowserWindow | null = null;
  let logsWindow: BrowserWindow | null = null;

  let ghostIsProcessingMessage = false;

  let startMouse = null;
  let startWindow: { x: number, y: number } | null = null;

  let appExitTimeout: NodeJS.Timeout | null = null;
  let chitChatTimeout: NodeJS.Timeout | null = null;
  let isAppExiting = false;

  const sendGhostMessage = async (messageBlock: (ghost: Ghost) => Promise<GhostResponse>) => {
    ghostIsProcessingMessage = true;
    mainWindow.webContents.send('user-action', 'BUBBLE_OPENED')
    if (!speechBubbleWindow) {
      const screenWidth = screen.getPrimaryDisplay().workAreaSize.width
      const screenHeight = screen.getPrimaryDisplay().workAreaSize.height
      const scaledBubbleWidth = Math.floor(speechBubbleWidth * displayScale);
      const scaledBubbleHeight = Math.floor(characterAppearance.character_height * displayScale);
      const scaledCharWidth = Math.floor(characterAppearance.character_width * displayScale);

      speechBubbleWindow = createWindow('speech-bubble', {
        width: speechBubbleWidth,
        height: characterAppearance.character_height,
        transparent: true,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
        },
      }, displayScale, true)
      loadUrlOnBrowserWindow(speechBubbleWindow, 'speechBubblePage')

      if (mainWindow.getBounds().x < screenWidth / 2) {
        speechBubbleWindow.setPosition(
          mainWindow.getBounds().x + scaledCharWidth + 50,
          mainWindow.getBounds().y
        )
      } else {
        speechBubbleWindow.setPosition(
          mainWindow.getBounds().x - scaledBubbleWidth - 50,
          mainWindow.getBounds().y
        )
      }
      speechBubbleWindow.once('ready-to-show', () => {
        speechBubbleWindow.showInactive()
      })
    }
    if (!speechBubbleWindow.isVisible()) {
        speechBubbleWindow.showInactive()
    }
    

    try {
      speechBubbleWindow.webContents.send('ghost-message-loading', true)
      const response = await messageBlock(ghost)
      if (isAppExiting && appExitTimeout) {
        clearTimeout(appExitTimeout)
        appExitTimeout = null;
      }
      speechBubbleWindow.webContents.send('ghost-message', response)
      mainWindow.webContents.send('ghost-message', response)
      const chatHistory = getChatHistory(characterName)
      logsWindow?.webContents.send('receive_chatlogs', chatHistory.toChatLogs())
      ghostIsProcessingMessage = false;
    } catch (error) {
      console.error(error)
      speechBubbleWindow.webContents.send('ghost-message-loading', false)
      speechBubbleWindow.webContents.send('ghost-message', { error: error })
      mainWindow.webContents.send('ghost-message', { error: error })
      ghostIsProcessingMessage = false;
    }
  }

  const isSpeechBubbleOpen = () => {
    return speechBubbleWindow !== null;
  }

  ipcMain.on('user-action', async (event, arg) => {
    console.log(arg)
    if (arg === 'APP_STARTED') {
      const characterProperties: CharacterProperties = {
        character_name: characterName,
        character_width: characterAppearance.character_width,
        character_height: characterAppearance.character_height,
        graphics: characterAppearance.graphics.map(graphic => ({
          emoticon: graphic.emoticon,
          imgSrc: `local-resource://character/${characterName}/images/${graphic.imgSrc}`
        })),
        touchable_areas: characterAppearance.touchable_areas,
      }
      mainWindow.webContents.send('character_loaded', characterProperties)
    }
    else if (arg === 'CHARACTER_LOADED') {
      sendGhostMessage((g) => g.sayHello())
    }
    else if (arg === 'CHAT_OPENED' && userChatInputWindow === null) {
      userChatInputWindow = createWindow('user-chat-input', {
        width: 600,
        height: 600,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
        },
      }, displayScale, true)
      loadUrlOnBrowserWindow(userChatInputWindow, 'chatDialog')
      setTimeout(() => {
        userChatInputWindow.focus()
      }, 100)
    }
    else if (arg === 'CHAT_CLOSED' && userChatInputWindow !== null) {
      userChatInputWindow.close()
      userChatInputWindow = null
    }
    else if (arg === 'APP_QUIT') {
      if (isAppExiting) {
        return;
      }
      isAppExiting = true;
      sendGhostMessage((g) => g.sayGoodbye())
      appExitTimeout = setTimeout(() => {
        app.quit()
      }, 6000)
    }
    else if (arg === 'BUBBLE_CLOSED') {
      if (isSpeechBubbleOpen() && !ghostIsProcessingMessage) {
        speechBubbleWindow.close()
        speechBubbleWindow = null
      }
    }
    else if (arg === 'REQUEST_CONFIG') {
      configWindow?.webContents.send('config_response', {
        openaiApiKey: configRepository.getConfig('openaiApiKey') as string || "",
        anthropicApiKey: configRepository.getConfig('anthropicApiKey') as string || "",
        llmService: configRepository.getConfig('llmService') as string || "",
        selectedModel: configRepository.getConfig('selectedModel') as string || "",
        temperature: configRepository.getConfig('temperature') as number || 1,
        openweathermapApiKey: configRepository.getConfig('openweathermapApiKey') as string || "",
        coinmarketcapApiKey: configRepository.getConfig('coinmarketcapApiKey') as string || "",
        chatHistoryLimit: configRepository.getConfig('chatHistoryLimit') as number || 100,
        displayScale: configRepository.getConfig('displayScale') as number || 0.5,
        speechBubbleWidth: configRepository.getConfig('speechBubbleWidth') as number || 500,
        enableLightweightModel: configRepository.getConfig('enableLightweightModel') !== false,
        enableAutoSummarization: configRepository.getConfig('enableAutoSummarization') !== false,
        summarizationThreshold: configRepository.getConfig('summarizationThreshold') as number || 40
      });
    }
    else if (arg === 'OPEN_CONFIG') {
      if (!configWindow) {
        configWindow = createWindow('config', {
          width: 600,
          height: 800,
          transparent: false,
          frame: true,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
          },
        }, displayScale, true)
        configWindow.setMenuBarVisibility(false)
        loadUrlOnBrowserWindow(configWindow, 'config')
        configWindow.on('close', () => {
          configWindow = null
        })
      } else {
        configWindow.show()
      }
    }
    else if (arg === 'CLOSE_CONFIG') {
      configWindow?.close()
      configWindow = null
    }
    else if (arg === 'DISPLAY_TEXT_COMPLETE') {
      if (isAppExiting) {
        if (appExitTimeout) {
          clearTimeout(appExitTimeout)
          appExitTimeout = null;
        }
        setTimeout(() => {
          app.quit()
        }, 3000)
      }
    }
    else if (arg === 'RESET_CHAT_HISTORY') {
      ghost.resetChatHistory()
      sendGhostMessage((g) => g.sayHello())
    }
    else if (arg === 'OPEN_LOG') {
      if (!logsWindow) {
        logsWindow = createWindow('logs', {
          width: 1000,
          height: 750,
          transparent: false,
          frame: true,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
          },
        }, displayScale, true)
        loadUrlOnBrowserWindow(logsWindow, 'logs')
        logsWindow.setMenuBarVisibility(false)
        logsWindow.on('close', () => {
          logsWindow = null
        })
      } else {
        logsWindow.show()
      }
    }
    else if (arg === 'LOG_OPENED') {
      const chatHistory = getChatHistory(characterName)
      const archiveList = chatHistoryRepository.getArchiveList(characterName)
      logsWindow?.webContents.send('receive_chatlogs', {
        current: chatHistory.toChatLogs(),
        archives: archiveList.map(key => ({
          key,
          timestamp: key.split('_').pop()?.replace('.json', '') || ''
        }))
      })
    }
    else if (arg === 'LOAD_ARCHIVE') {
      // This will be sent with data from renderer
    }
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
    if (speechBubbleWindow) {
      const scaledCharWidth = Math.floor(characterAppearance.character_width * displayScale);
      const scaledBubbleWidth = Math.floor(speechBubbleWidth * displayScale);
      if (newX < screen.getPrimaryDisplay().workAreaSize.width / 2) {
        speechBubbleWindow.setPosition(newX + scaledCharWidth + 50, newY, false)
      } else {
        speechBubbleWindow.setPosition(newX - scaledBubbleWidth - 50, newY, false)
      }
    }
  })

  ipcMain.on('save_config', (event, { openaiApiKey, anthropicApiKey, llmService, selectedModel, temperature, openweathermapApiKey, coinmarketcapApiKey, chatHistoryLimit, displayScale, speechBubbleWidth, enableLightweightModel, enableAutoSummarization, summarizationThreshold }) => {
    console.log(openaiApiKey, anthropicApiKey, llmService, selectedModel, temperature, openweathermapApiKey)
    const previousOpenaiApiKey = configRepository.getConfig('openaiApiKey') as string || "";
    const previousAnthropicApiKey = configRepository.getConfig('anthropicApiKey') as string || "";
    const previousLlmService = configRepository.getConfig('llmService') as string || "";
    const previousSelectedModel = configRepository.getConfig('selectedModel') as string || "";
    const previousTemperature = configRepository.getConfig('temperature') as number || 1;
    const previousOpenweathermapApiKey = configRepository.getConfig('openweathermapApiKey') as string || "";
    const previousCoinmarketcapApiKey = configRepository.getConfig('coinmarketcapApiKey') as string || "";
    const previousChatHistoryLimit = configRepository.getConfig('chatHistoryLimit') as number || 100;
    const previousDisplayScale = configRepository.getConfig('displayScale') as number || 0.5;
    const previousSpeechBubbleWidth = configRepository.getConfig('speechBubbleWidth') as number || 500;

    let updateRequired = false;
    if (previousOpenaiApiKey !== openaiApiKey) {
      configRepository.setConfig('openaiApiKey', openaiApiKey);
      updateRequired = true;
    }
    if (previousAnthropicApiKey !== anthropicApiKey) {
      configRepository.setConfig('anthropicApiKey', anthropicApiKey);
      updateRequired = true;
    }
    if (previousLlmService !== llmService || previousSelectedModel !== selectedModel) {
      configRepository.setConfig('llmService', llmService);
      configRepository.setConfig('selectedModel', selectedModel);
      updateRequired = true;
    }
    if (previousTemperature !== temperature) {
      configRepository.setConfig('temperature', temperature);
      updateRequired = true;
    }
    if (previousOpenweathermapApiKey !== openweathermapApiKey) {
      configRepository.setConfig('openweathermapApiKey', openweathermapApiKey);
    }
    if (previousChatHistoryLimit !== chatHistoryLimit) {
      configRepository.setConfig('chatHistoryLimit', chatHistoryLimit);
    }
    if (previousCoinmarketcapApiKey !== coinmarketcapApiKey) {
      configRepository.setConfig('coinmarketcapApiKey', coinmarketcapApiKey);
    }
    if (previousDisplayScale !== displayScale) {
      configRepository.setConfig('displayScale', displayScale);
      app.relaunch();
      app.quit();
    }
    if (previousSpeechBubbleWidth !== speechBubbleWidth) {
      configRepository.setConfig('speechBubbleWidth', speechBubbleWidth);
      app.relaunch();
      app.quit();
    }
    configRepository.setConfig('enableLightweightModel', enableLightweightModel);
    configRepository.setConfig('enableAutoSummarization', enableAutoSummarization);
    configRepository.setConfig('summarizationThreshold', summarizationThreshold);
    if (updateRequired) {
      ghost.updateExecuter({ openaiApiKey: openaiApiKey, anthropicApiKey: anthropicApiKey, llmService: llmService as 'openai' | 'anthropic', modelName: selectedModel, temperature: temperature });
    }
  })

  ipcMain.on('load-archive', (event, archiveKey: string) => {
    const archiveMessages = chatHistoryRepository.getArchive(archiveKey)
    const chatLogs = archiveMessages
      .filter(msg => msg.type !== 'system')
      .map(msg => msg.toChatLog())
    logsWindow?.webContents.send('receive_archive_logs', chatLogs)
  })

  ipcMain.on('user-message', async (event, message: UserInput) => {
    sendGhostMessage((g) => g.sendRawMessage(message))
    userChatInputWindow?.close()
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


