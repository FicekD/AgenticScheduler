import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage } from 'electron'
import { join, dirname } from 'path'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs'
import type { Config, ReportFile } from '../shared/types'
import { loadConfig, saveConfig } from './config'
import { listRuns } from './store'
import { runOrchestrator, cancelRun, isBusy } from './runner'
import { applySchedule, nextRunFor } from './scheduler'
import { loadWindowState, trackWindowState } from './windowState'
import { ensureAgenticIgnored } from './repo'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let config: Config = null as unknown as Config

const iconPath = join(__dirname, '../../resources/icon.png')

function createWindow(): void {
  const state = loadWindowState()
  win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 560,
    show: false,
    frame: false,
    backgroundColor: '#0e1213',
    icon: existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (state.isFullScreen) win.setFullScreen(true)
  else if (state.isMaximized) win.maximize()

  win.setOpacity(0.95)
  trackWindowState(win)
  win.on('ready-to-show', () => win?.show())
  win.on('maximize', () => win?.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win?.webContents.send('window:maximized', false))
  win.on('close', (e) => {
    // Keep running in the tray instead of quitting.
    if (!(app as any).isQuitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const img = existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
  tray = new Tray(img)
  tray.setToolTip('Agentic Scheduler')
  const menu = Menu.buildFromTemplate([
    { label: 'Open', click: () => (win ? win.show() : createWindow()) },
    {
      label: 'Run now',
      click: () => {
        if (!isBusy()) {
          try {
            runOrchestrator(config, 'Manual (tray)', null)
          } catch {
            /* ignore */
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        ;(app as any).isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', () => (win ? win.show() : createWindow()))
}

function listReports(): ReportFile[] {
  const dir = join(config.repoPath || '', config.reportsDir)
  if (!config.repoPath || !existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .map((name) => {
      const full = join(dir, name)
      return { name, path: full, mtime: statSync(full).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
}

function registerIpc(): void {
  ipcMain.on('window:minimize', () => win?.minimize())
  ipcMain.on('window:toggleMaximize', () => {
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })
  ipcMain.on('window:close', () => win?.close())
  ipcMain.handle('window:isMaximized', () => win?.isMaximized() ?? false)

  ipcMain.handle('plan:read', () => {
    if (!config.repoPath) return ''
    try {
      return readFileSync(join(config.repoPath, config.planPath), 'utf-8')
    } catch {
      return ''
    }
  })
  ipcMain.handle('plan:write', (_e, content: string) => {
    if (!config.repoPath) return { ok: false, error: 'No repository set.' }
    try {
      const p = join(config.repoPath, config.planPath)
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, content, 'utf-8')
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) }
    }
  })

  ipcMain.handle('config:get', () => config)
  ipcMain.handle('config:save', (_e, next: Config) => {
    config = saveConfig(next)
    ensureAgenticIgnored(config.repoPath)
    applySchedule(() => config)
    return config
  })
  ipcMain.handle('config:pickRepo', async () => {
    const res = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return res.canceled ? null : res.filePaths[0]
  })
  ipcMain.handle('runs:list', () => listRuns())
  ipcMain.handle('runs:nextTimes', () =>
    config.slots.map((s) => ({ id: s.id, time: s.time, enabled: s.enabled, next: nextRunFor(s) }))
  )
  ipcMain.handle('runs:runNow', (_e, label?: string) => {
    if (isBusy()) return { ok: false, error: 'A run is already active.' }
    try {
      const run = runOrchestrator(config, label || 'Manual', null)
      return { ok: true, run }
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) }
    }
  })
  ipcMain.handle('runs:cancel', (_e, runId: string) => cancelRun(runId))
  ipcMain.handle('reports:list', () => listReports())
  ipcMain.handle('reports:read', (_e, path: string) => {
    try {
      return readFileSync(path, 'utf-8')
    } catch (err: any) {
      return `Failed to read report: ${err?.message ?? err}`
    }
  })
}

app.whenReady().then(() => {
  config = loadConfig()
  ensureAgenticIgnored(config.repoPath)
  registerIpc()
  createWindow()
  createTray()
  applySchedule(() => config)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Stay alive in the tray; do not quit on window close.
})
