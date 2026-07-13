import { app, BrowserWindow, Rectangle } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
  isFullScreen: boolean
}

const DEFAULT: WindowState = {
  width: 1600,
  height: 900,
  isMaximized: false,
  isFullScreen: false
}

function statePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'window-state.json')
}

export function loadWindowState(): WindowState {
  try {
    return { ...DEFAULT, ...JSON.parse(readFileSync(statePath(), 'utf-8')) }
  } catch {
    return { ...DEFAULT }
  }
}

export function trackWindowState(win: BrowserWindow): void {
  let bounds: Rectangle = win.getBounds()
  let timer: NodeJS.Timeout | null = null

  const save = (): void => {
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: win.isMaximized(),
      isFullScreen: win.isFullScreen()
    }
    try {
      writeFileSync(statePath(), JSON.stringify(state, null, 2))
    } catch {
      /* ignore */
    }
  }

  const onChange = (): void => {
    // Only remember normal bounds so a restore doesn't inherit maximized size.
    if (!win.isMaximized() && !win.isFullScreen()) bounds = win.getBounds()
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, 400)
  }

  win.on('resize', onChange)
  win.on('move', onChange)
  win.on('maximize', save)
  win.on('unmaximize', save)
  win.on('enter-full-screen', save)
  win.on('leave-full-screen', save)
  win.on('close', save)
}
