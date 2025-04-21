import path from 'path'
import { app, BrowserWindow, dialog, ipcMain, screen, Tray } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import Ghost, { ApiKeyNotDefinedError } from './domain/ghost/ghost'
import { configRepository } from './infrastructure/config/ConfigRepository'
import { TouchableArea } from './infrastructure/character/CharacterRepository'
const isProd = process.env.NODE_ENV === 'production'

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
const characterName = configRepository.getConfig('characterName') || "minkee";

const ghost = new Ghost(
  {
    character_name: characterName as string,
    llmService: llmService as string,
    modelName: selectedModel as string,
    openaiApiKey: openaiApiKey as string,
    anthropicApiKey: anthropicApiKey as string,
    temperature: temperature as number
  }
)

interface CharacterProps {
  touchable_areas: TouchableArea[];
}

console.log("ghost", ghost);

app.commandLine.appendSwitch('force-device-scale-factor', '1');

const createGhostWindow = ({ width, height }: { width: number, height: number }) => {
  const screenWidth = screen.getPrimaryDisplay().workAreaSize.width
  const screenHeight = screen.getPrimaryDisplay().workAreaSize.height

  const ghostWindow = createWindow('main', {
    width,
    height,
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
    x: Math.floor(screenWidth * 0.8) - width,
    y: screenHeight - height,
    width: width,
    height: height,
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

  const ghostSize = ghost.getCharacterSize();
  const mainWindow = createGhostWindow({ width: ghostSize.width, height: ghostSize.height })
  const tray = new Tray(path.join(__dirname, '../resources/icon.ico'))
  tray.setToolTip('Akagaku')
  tray.on('click', () => {
    mainWindow.show()
  })

  loadUrlOnBrowserWindow(mainWindow, 'home')
  // mainWindow.webContents.openDevTools()

  console.log(ghost.getTouchableAreas())

  let userChatInputWindow: BrowserWindow | null = null;
  let configWindow: BrowserWindow | null = null;
  let speechBubbleWindow: BrowserWindow | null = null;

  let ghostIsProcessingMessage = false;

  const sendGhostMessage = async (isSystemMessage: boolean, input: string) => {
    ghostIsProcessingMessage = true;
    mainWindow.webContents.send('user-action', 'BUBBLE_OPENED')
    if (!speechBubbleWindow) {
      const screenWidth = screen.getPrimaryDisplay().workAreaSize.width
      const screenHeight = screen.getPrimaryDisplay().workAreaSize.height
      speechBubbleWindow = createWindow('speech-bubble', {
        width: 500,
        height: ghostSize.height,
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
          height: ghostSize.height,
          x: mainWindow.getBounds().x + 550,
          y: mainWindow.getBounds().y,
        })
      } else {
        speechBubbleWindow.setBounds({
          width: 500,
          height: ghostSize.height,
          x: mainWindow.getBounds().x - 450,
          y: mainWindow.getBounds().y,
        })
      }
      speechBubbleWindow.once('ready-to-show', () => {
        speechBubbleWindow.showInactive()
      })
    }

    try {
      speechBubbleWindow.webContents.send('ghost-message-loading', true)
      const response = await ghost.invoke({ isSystemMessage, input })
      speechBubbleWindow.webContents.send('ghost-message', response)
      mainWindow.webContents.send('ghost-message', response)
      ghostIsProcessingMessage = false;
    } catch (error) {
      console.error(error)
      if (error instanceof ApiKeyNotDefinedError) {
        speechBubbleWindow.webContents.send('ghost-message-loading', false)
        speechBubbleWindow.webContents.send('ghost-message', { error: error.message })
        mainWindow.webContents.send('ghost-message', { error: error.message })        
      }
      ghostIsProcessingMessage = false;
    }
  }

  const isSpeechBubbleOpen = () => {
    return speechBubbleWindow !== null;
  }

  ipcMain.on('user-action', async (event, arg) => {
    console.log(arg)
    if (arg === 'APP_STARTED') {
      let welcomeMessage = undefined;
      if (await ghost.isNewRendezvous()) {
        sendGhostMessage(true, "This is your first time to talk to the user. Please introduce yourself and gather user's information. Call 'update_user_info' tool if you need to store user's information.")
      } else {
        sendGhostMessage(true, "User entered.")
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
      sendGhostMessage(true, "User is exiting. Please say goodbye to the user.")
      setTimeout(() => {
        app.quit()
      }, 3000)
    }
    else if (arg === 'BUBBLE_CLOSED') {
      if (isSpeechBubbleOpen() && !ghostIsProcessingMessage) {
        speechBubbleWindow.close()
        speechBubbleWindow = null
      }
    }
    else if (arg === 'REQUEST_CONFIG') {
      configWindow?.webContents.send('config_response', { 
        openaiApiKey: openaiApiKey,
        anthropicApiKey: anthropicApiKey,
        llmService: llmService,
        selectedModel: selectedModel,
        temperature: temperature
      });
    }
    else if (arg === 'OPEN_CONFIG') {
      configWindow = createWindow('config', {
        width: 600,
        height: 600,
        transparent: false,
        frame: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
        },
      })
      loadUrlOnBrowserWindow(configWindow, 'config')
    }
    else if (arg === 'CLOSE_CONFIG') {
      configWindow?.close()
      configWindow = null
    }
  })

  ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
    const { x, y } = mainWindow.getBounds()
    if (Math.abs(deltaX) > 100) {
      deltaX = 100 * Math.sign(deltaX);
    }
    mainWindow.setPosition(x + deltaX, y, false)
    if (speechBubbleWindow) {
      const { x: speechBubbleX, y: speechBubbleY } = speechBubbleWindow.getBounds()
      speechBubbleWindow.setPosition(speechBubbleX + deltaX, speechBubbleY, false)
    }
  })

  ipcMain.on('save_config', (event, { openaiApiKey, anthropicApiKey, llmService, selectedModel, temperature }) => {
    console.log(openaiApiKey, anthropicApiKey, llmService, selectedModel, temperature)
    const previousOpenaiApiKey = configRepository.getConfig('openaiApiKey') as string || "";
    const previousAnthropicApiKey = configRepository.getConfig('anthropicApiKey') as string || "";
    const previousLlmService = configRepository.getConfig('llmService') as string || "";
    const previousSelectedModel = configRepository.getConfig('selectedModel') as string || "";
    const previousTemperature = configRepository.getConfig('temperature') as number || 1;
    if (previousOpenaiApiKey !== openaiApiKey) {
      configRepository.setConfig('openaiApiKey', openaiApiKey);
      ghost.updateExecuter({ openaiApiKey: openaiApiKey, anthropicApiKey: previousAnthropicApiKey, llmService: previousLlmService, modelName: previousSelectedModel, temperature: previousTemperature });
    }
    if (previousAnthropicApiKey !== anthropicApiKey) {
      configRepository.setConfig('anthropicApiKey', anthropicApiKey);
      ghost.updateExecuter({ openaiApiKey: previousOpenaiApiKey, anthropicApiKey: anthropicApiKey, llmService: previousLlmService, modelName: previousSelectedModel, temperature: previousTemperature });
    }
    if (previousLlmService !== llmService || previousSelectedModel !== selectedModel) {
      configRepository.setConfig('llmService', llmService);
      configRepository.setConfig('selectedModel', selectedModel);
      ghost.updateExecuter({ openaiApiKey: previousOpenaiApiKey, anthropicApiKey: previousAnthropicApiKey, llmService: llmService, modelName: selectedModel, temperature: previousTemperature });
    }
    if (previousTemperature !== temperature) {
      configRepository.setConfig('temperature', temperature);
      ghost.updateExecuter({ openaiApiKey: previousOpenaiApiKey, anthropicApiKey: previousAnthropicApiKey, llmService: llmService, modelName: selectedModel, temperature: temperature });
    }
  })

  ipcMain.on('user-message', async (event, message: string) => {
    sendGhostMessage(false, message)
    userChatInputWindow?.close()
  })

  mainWindow.webContents.send('character_loaded', {touchable_areas: ghost.getTouchableAreas()})

  mainWindow.on('close', () => {
    app.quit()
  })

  const requestCharacterToChitChat = async () => {
    if (!isSpeechBubbleOpen()) {
      sendGhostMessage(true, "Have a chit chat with the user.")
    }
  }

  setInterval(requestCharacterToChitChat, 5 * 60 * 1000)
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})


