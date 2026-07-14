export type RunStatus =
  | 'running'
  | 'completed'
  | 'limit'
  | 'error'
  | 'incomplete'
  | 'cancelled'

export interface Slot {
  id: string
  time: string // "HH:MM" local
  enabled: boolean
}

export type AgentKind = 'claude' | 'codex'

export interface AgentModel {
  id: string // value passed to --model / -m
  label: string
  description: string | null
  efforts: string[] // reasoning levels this model accepts; empty = not selectable
  defaultEffort: string | null
}

export interface AgentInfo {
  kind: AgentKind
  label: string
  available: boolean
  version: string | null
  models: AgentModel[]
  note: string | null // why the model list is empty / how to fix it
}

export interface Config {
  repoPath: string
  agent: AgentKind
  claudePath: string
  codexPath: string
  model: string
  reasoningEffort: string | null // null = let the agent pick
  reportsDir: string // relative to repo
  planPath: string // relative to repo
  maxBudgetUsd: number | null // Claude Code only
  slots: Slot[]
  promptTemplate: string
  uiScale: number // 75 | 100 | 125
  theme: string // accent theme key: teal | red | amber | violet | slate | green
}

export interface Run {
  id: string
  slotId: string | null
  label: string
  startedAt: number
  endedAt: number | null
  status: RunStatus
  exitCode: number | null
  sessionId: string | null
  reportCreated: boolean
  newReports: string[]
  costUsd: number | null
  numTurns: number | null
  error: string | null
}

export type RunEventKind =
  | 'status'
  | 'assistant'
  | 'tool'
  | 'result'
  | 'stderr'
  | 'error'

export interface RunEvent {
  runId: string
  ts: number
  kind: RunEventKind
  text: string
}

export interface ReportFile {
  name: string
  path: string
  mtime: number
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

export interface LogEntry {
  ts: number
  level: LogLevel
  scope: string // which part of the app spoke: runner, scheduler, config, …
  message: string
  detail?: string
}
