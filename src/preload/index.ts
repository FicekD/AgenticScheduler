import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { Api, SlotNext } from '../shared/api'
import type {
  AgentInfo,
  Config,
  LogEntry,
  LogLevel,
  Run,
  RunEvent,
  ReportFile
} from '../shared/types'

const api: Api = {
  detectAgents: (force?: boolean): Promise<AgentInfo[]> =>
    ipcRenderer.invoke('agents:detect', force),
  getConfig: (): Promise<Config> => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: Config): Promise<Config> => ipcRenderer.invoke('config:save', cfg),
  pickRepo: (): Promise<string | null> => ipcRenderer.invoke('config:pickRepo'),
  listRuns: (): Promise<Run[]> => ipcRenderer.invoke('runs:list'),
  nextTimes: (): Promise<SlotNext[]> => ipcRenderer.invoke('runs:nextTimes'),
  runNow: (label?: string): Promise<{ ok: boolean; run?: Run; error?: string }> =>
    ipcRenderer.invoke('runs:runNow', label),
  cancelRun: (runId: string): Promise<boolean> => ipcRenderer.invoke('runs:cancel', runId),
  listReports: (): Promise<ReportFile[]> => ipcRenderer.invoke('reports:list'),
  readReport: (path: string): Promise<string> => ipcRenderer.invoke('reports:read', path),
  setUiScale: (percent: number): void => webFrame.setZoomFactor(percent / 100),

  readPlan: (): Promise<string> => ipcRenderer.invoke('plan:read'),
  writePlan: (content: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('plan:write', content),

  minimize: (): void => ipcRenderer.send('window:minimize'),
  toggleMaximize: (): void => ipcRenderer.send('window:toggleMaximize'),
  closeWindow: (): void => ipcRenderer.send('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (cb: (max: boolean) => void): (() => void) => {
    const h = (_e: unknown, max: boolean): void => cb(max)
    ipcRenderer.on('window:maximized', h)
    return () => ipcRenderer.removeListener('window:maximized', h)
  },
  onRunEvent: (cb: (ev: RunEvent) => void): (() => void) => {
    const h = (_e: unknown, ev: RunEvent): void => cb(ev)
    ipcRenderer.on('run:event', h)
    return () => ipcRenderer.removeListener('run:event', h)
  },
  onRunsChanged: (cb: () => void): (() => void) => {
    const h = (): void => cb()
    ipcRenderer.on('runs:changed', h)
    return () => ipcRenderer.removeListener('runs:changed', h)
  },

  listLogs: (): Promise<LogEntry[]> => ipcRenderer.invoke('logs:list'),
  clearLogs: (): Promise<void> => ipcRenderer.invoke('logs:clear'),
  revealLogFile: (): Promise<void> => ipcRenderer.invoke('logs:reveal'),
  writeLog: (level: LogLevel, message: string, detail?: string): void =>
    ipcRenderer.send('logs:write', level, message, detail),
  onLogEntry: (cb: (entry: LogEntry) => void): (() => void) => {
    const h = (_e: unknown, entry: LogEntry): void => cb(entry)
    ipcRenderer.on('log:entry', h)
    return () => ipcRenderer.removeListener('log:entry', h)
  }
}

contextBridge.exposeInMainWorld('api', api)
