import type { AgentInfo, Config, LogEntry, LogLevel, ReportFile, Run, RunEvent } from './types'

export interface SlotNext {
  id: string
  time: string
  enabled: boolean
  next: number | null
}

// The contract between the preload bridge and the renderer. Preload implements it, the renderer
// sees it as window.api. It lives in shared so neither side has to import the other's source.
export interface Api {
  detectAgents(force?: boolean): Promise<AgentInfo[]>

  getConfig(): Promise<Config>
  saveConfig(cfg: Config): Promise<Config>
  pickRepo(): Promise<string | null>
  setUiScale(percent: number): void

  listRuns(): Promise<Run[]>
  nextTimes(): Promise<SlotNext[]>
  runNow(label?: string): Promise<{ ok: boolean; run?: Run; error?: string }>
  cancelRun(runId: string): Promise<boolean>

  listReports(): Promise<ReportFile[]>
  readReport(path: string): Promise<string>
  readPlan(): Promise<string>
  writePlan(content: string): Promise<{ ok: boolean; error?: string }>

  minimize(): void
  toggleMaximize(): void
  closeWindow(): void
  isMaximized(): Promise<boolean>
  onMaximizeChange(cb: (max: boolean) => void): () => void

  onRunEvent(cb: (ev: RunEvent) => void): () => void
  onRunsChanged(cb: () => void): () => void

  listLogs(): Promise<LogEntry[]>
  clearLogs(): Promise<void>
  revealLogFile(): Promise<void>
  writeLog(level: LogLevel, message: string, detail?: string): void
  onLogEntry(cb: (entry: LogEntry) => void): () => void
}
