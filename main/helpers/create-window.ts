import {
  screen,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  Rectangle,
} from 'electron'
import Store from 'electron-store'
import { dataPathManager } from '../infrastructure/config/DataPathManager'
import path from 'path'

export const createWindow = (
  windowName: string,
  options: BrowserWindowConstructorOptions,
  zoomFactor: number = 1.0,
  applyScaleToSize: boolean = true
): BrowserWindow => {
  const scaledOptions = applyScaleToSize ? {
    ...options,
    width: options.width ? Math.floor(options.width * zoomFactor) : undefined,
    height: options.height ? Math.floor(options.height * zoomFactor) : undefined,
  } : options;

  const key = 'window-state'
  const name = `window-state-${windowName}`
  const windowStatePath = dataPathManager.getWindowStatePath(windowName);
  const store = new Store<Rectangle>({
    name,
    cwd: path.dirname(windowStatePath)
  })
  const defaultSize = {
    width: scaledOptions.width,
    height: scaledOptions.height,
  }
  let state = {}
  console.log(`window name ${windowName} zoomFactor ${zoomFactor}`)

  const restore = () => {
    const saved = store.get(key, defaultSize) as any
    // Only restore position, not size
    return {
      x: saved.x,
      y: saved.y,
    }
  }

  const getCurrentPosition = () => {
    const position = win.getPosition()
    return {
      x: position[0],
      y: position[1],
    }
  }

  const windowWithinBounds = (windowState, bounds) => {
    return (
      windowState.x >= bounds.x &&
      windowState.y >= bounds.y &&
      windowState.x + (scaledOptions.width || 800) <= bounds.x + bounds.width &&
      windowState.y + (scaledOptions.height || 600) <= bounds.y + bounds.height
    )
  }

  const resetToDefaults = () => {
    const bounds = screen.getPrimaryDisplay().bounds
    return {
      x: (bounds.width - (scaledOptions.width || 800)) / 2,
      y: (bounds.height - (scaledOptions.height || 600)) / 2,
    }
  }

  const ensureVisibleOnSomeDisplay = (windowState) => {
    const visible = screen.getAllDisplays().some((display) => {
      return windowWithinBounds(windowState, display.bounds)
    })
    if (!visible) {
      // Window is partially or fully not visible now.
      // Reset it to safe defaults.
      return resetToDefaults()
    }
    return windowState
  }

  const saveState = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      Object.assign(state, getCurrentPosition())
    }
    store.set(key, state)
  }

  state = ensureVisibleOnSomeDisplay(restore())

  const win = new BrowserWindow({
    ...state,
    ...scaledOptions,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      ...scaledOptions.webPreferences,
    },
  })

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(zoomFactor)
  })

  win.on('close', saveState)

  return win
}
