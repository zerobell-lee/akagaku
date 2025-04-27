import path from 'path'
import { app, BrowserWindow, dialog, ipcMain, protocol, screen, Tray } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import { Ghost } from './domain/ghost/ghost_graph'
import { configRepository } from './infrastructure/config/ConfigRepository'
import { CharacterSettingLoader } from './infrastructure/character/CharacterRepository'
import fs from 'fs'
import { CharacterAppearance, CharacterProperties } from '@shared/types'
import dotenv from 'dotenv'
import { getChatHistory } from './infrastructure/chat/ChatHistoryRepository'


const isProd = process.env.NODE_ENV === 'production'

if (!isProd) {
  dotenv.config();
}

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

const openaiApiKey = configRepository.getConfig('openaiApiKey') || "";
const anthropicApiKey = configRepository.getConfig('anthropicApiKey') || "";
const llmService = configRepository.getConfig('llmService') || "openai";
const selectedModel = configRepository.getConfig('selectedModel') || "gpt-4o-mini";
const temperature = configRepository.getConfig('temperature') || 1;
const characterName = configRepository.getConfig('characterName') as string || "minkee";

const ghost = new Ghost(
  {
    llm_properties: {
      llmService: llmService as string,
      modelName: selectedModel as string,
      apiKey: llmService === 'openai' ? openaiApiKey as string : anthropicApiKey as string,
      temperature: temperature as number,
    },
    character_setting: CharacterSettingLoader.getCharacterSetting(characterName),
  }
)

console.log("ghost", ghost);

app.commandLine.appendSwitch('force-device-scale-factor', '1');

const createGhostWindow = (characterAppearance: CharacterAppearance) => {
  const screenWidth = screen.getPrimaryDisplay().workAreaSize.width
  const screenHeight = screen.getPrimaryDisplay().workAreaSize.height

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
  })

  ghostWindow.setBounds({
    x: Math.floor(screenWidth * 0.8) - characterAppearance.character_width,
    y: screenHeight - characterAppearance.character_height,
    width: characterAppearance.character_width,
    height: characterAppearance.character_height,
  })

  return ghostWindow
};

const loadUrlOnBrowserWindow = (window: BrowserWindow, url: string) => {
  if (isProd) {
    window.loadURL(`app://./${url}`)
  } else {
    const port = process.argv[2]
    window.loadURL(`http://localhost:${port}/${url}`)
  }
}

(async () => {
  await app.whenReady()

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

  const tray = new Tray(path.join(__dirname, '../resources/icon.ico'))
  tray.setToolTip('Akagaku')
  tray.on('click', () => {
    mainWindow.show()
  })
  // mainWindow.webContents.openDevTools()

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

  const sendGhostMessage = async (isSystemMessage: boolean, input: string) => {
    ghostIsProcessingMessage = true;
    mainWindow.webContents.send('user-action', 'BUBBLE_OPENED')
    if (!speechBubbleWindow) {
      const screenWidth = screen.getPrimaryDisplay().workAreaSize.width
      const screenHeight = screen.getPrimaryDisplay().workAreaSize.height
      speechBubbleWindow = createWindow('speech-bubble', {
        width: 500,
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
      })
      loadUrlOnBrowserWindow(speechBubbleWindow, 'speechBubblePage')

      if (mainWindow.getBounds().x < screenWidth / 2) {
        speechBubbleWindow.setBounds({
          width: 500,
          height: characterAppearance.character_height,
          x: mainWindow.getBounds().x + 550,
          y: mainWindow.getBounds().y,
        })
      } else {
        speechBubbleWindow.setBounds({
          width: 500,
          height: characterAppearance.character_height,
          x: mainWindow.getBounds().x - 450,
          y: mainWindow.getBounds().y,
        })
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
      console.log('Here is sendGhostMessage', isSystemMessage, input)
      const response = await ghost.invoke({ isSystemMessage, input })
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
    resetChitChatTimeout(!isSystemMessage);
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
      let welcomeMessage = undefined;
      if (ghost.isNewRendezvous()) {
        sendGhostMessage(true, `This is your first time to talk to the user.
        Please introduce yourself and gather user's information. Call 'update_user_info' tool if you need to store user's information.
        `)
      } else {
        sendGhostMessage(true, "User entered. say hello to the user. when you say hello, you can consider how long it has passed since last conversation by referring timestamp of last message.")
      }
      console.log(welcomeMessage)
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
      })
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
      sendGhostMessage(true, "User is exiting. Please say goodbye to the user. Don't use any tools. User is in hurry.")
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
        chatHistoryLimit: configRepository.getConfig('chatHistoryLimit') as number || 100
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
        })
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
      sendGhostMessage(true, `This is your first time to talk to the user.
        Please introduce yourself and gather user's information. Call 'update_user_info' tool if you need to store user's information.
        `)
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
        })
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
      logsWindow?.webContents.send('receive_chatlogs', chatHistory.toChatLogs())
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
      if (newX < screen.getPrimaryDisplay().workAreaSize.width / 2) {
        speechBubbleWindow.setPosition(newX + 550, newY, false)
      } else {
        speechBubbleWindow.setPosition(newX - 450, newY, false)
      }
    }
  })

  ipcMain.on('save_config', (event, { openaiApiKey, anthropicApiKey, llmService, selectedModel, temperature, openweathermapApiKey, chatHistoryLimit }) => {
    console.log(openaiApiKey, anthropicApiKey, llmService, selectedModel, temperature, openweathermapApiKey)
    const previousOpenaiApiKey = configRepository.getConfig('openaiApiKey') as string || "";
    const previousAnthropicApiKey = configRepository.getConfig('anthropicApiKey') as string || "";
    const previousLlmService = configRepository.getConfig('llmService') as string || "";
    const previousSelectedModel = configRepository.getConfig('selectedModel') as string || "";
    const previousTemperature = configRepository.getConfig('temperature') as number || 1;
    const previousOpenweathermapApiKey = configRepository.getConfig('openweathermapApiKey') as string || "";
    const previousChatHistoryLimit = configRepository.getConfig('chatHistoryLimit') as number || 100;

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
    if (updateRequired) {
      ghost.updateExecuter({ openaiApiKey: openaiApiKey, anthropicApiKey: anthropicApiKey, llmService: llmService, modelName: selectedModel, temperature: temperature });
    }
  })

  ipcMain.on('user-message', async (event, message: string) => {
    sendGhostMessage(false, message)
    userChatInputWindow?.close()
  })

  mainWindow.on('close', () => {
    app.quit()
  })

  const requestCharacterToChitChat = async (isLastMessageFromUser: boolean) => {
    if (!isSpeechBubbleOpen()) {
      if (isLastMessageFromUser) {
        sendGhostMessage(true, "Character, pick an episode about yourself and have a chit chat with the user. Since it has passed 5 minutes from last conversation, you don't need to be obsessed with the last conversation. Just have a chit chat with the user.")
      } else {
        sendGhostMessage(true, "Character, pick an episode about yourself and have a chit chat with the user. it has passed 5 minutes from last conversation, but unfortunately it seems user couldn't respond to you. Even though you're not sure whether user is busy or not, you can have a chit chat with the user.")
      }
    }
  }

  const resetChitChatTimeout = (isLastMessageFromUser: boolean) => {
    if (chitChatTimeout) {
      clearTimeout(chitChatTimeout)
    }
    chitChatTimeout = setTimeout(() => requestCharacterToChitChat(isLastMessageFromUser), 5 * 60 * 1000)
  }
  
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})


