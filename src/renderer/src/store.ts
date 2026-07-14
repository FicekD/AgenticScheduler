import { create } from 'zustand'
import type { Config, LogEntry, LogLevel, Run, RunEvent, ReportFile } from '@shared/types'
import type { SlotNext } from '../../preload/index'

export interface LogLine {
  ts: number
  kind: RunEvent['kind']
  text: string
}

interface AppState {
  config: Config | null
  runs: Run[]
  nextTimes: SlotNext[]
  reports: ReportFile[]
  log: LogLine[]
  appLogs: LogEntry[]
  logLevel: LogLevel // lowest severity shown in the Logs tab
  activeRunId: string | null
  refreshAll: () => Promise<void>
  refreshRuns: () => Promise<void>
  refreshReports: () => Promise<void>
  saveConfig: (cfg: Config) => Promise<void>
  runNow: () => Promise<string | null>
  pushLog: (ev: RunEvent) => void
  clearLog: () => void
  pushAppLog: (entry: LogEntry) => void
  clearAppLogs: () => Promise<void>
  setLogLevel: (level: LogLevel) => void
}

export const useStore = create<AppState>((set, get) => ({
  config: null,
  runs: [],
  nextTimes: [],
  reports: [],
  log: [],
  appLogs: [],
  logLevel: 'info',
  activeRunId: null,

  refreshAll: async () => {
    const [config, runs, nextTimes, reports, appLogs] = await Promise.all([
      window.api.getConfig(),
      window.api.listRuns(),
      window.api.nextTimes(),
      window.api.listReports(),
      window.api.listLogs()
    ])
    const active = runs.find((r) => r.status === 'running')?.id ?? null
    set({ config, runs, nextTimes, reports, appLogs, activeRunId: active })
  },

  refreshRuns: async () => {
    const [runs, nextTimes] = await Promise.all([window.api.listRuns(), window.api.nextTimes()])
    const active = runs.find((r) => r.status === 'running')?.id ?? null
    set({ runs, nextTimes, activeRunId: active })
    void get().refreshReports()
  },

  refreshReports: async () => {
    set({ reports: await window.api.listReports() })
  },

  saveConfig: async (cfg) => {
    const saved = await window.api.saveConfig(cfg)
    set({ config: saved })
    void get().refreshRuns()
  },

  runNow: async () => {
    const res = await window.api.runNow('Manual')
    if (!res.ok) return res.error ?? 'Failed to start run'
    set({ log: [] })
    void get().refreshRuns()
    return null
  },

  pushLog: (ev) => {
    if (ev.runId === 'scheduler' || ev.runId === get().activeRunId || get().activeRunId === null) {
      set((s) => ({ log: [...s.log.slice(-400), { ts: ev.ts, kind: ev.kind, text: ev.text }] }))
    }
  },

  clearLog: () => set({ log: [] }),

  pushAppLog: (entry) => set((s) => ({ appLogs: [...s.appLogs.slice(-1999), entry] })),

  clearAppLogs: async () => {
    await window.api.clearLogs()
    set({ appLogs: [] })
  },

  setLogLevel: (level) => set({ logLevel: level })
}))
