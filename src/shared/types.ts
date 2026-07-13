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

export interface Config {
  repoPath: string
  claudePath: string
  model: string
  reportsDir: string // relative to repo
  planPath: string // relative to repo
  maxBudgetUsd: number | null
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
