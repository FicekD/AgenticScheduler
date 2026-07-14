import { app, BrowserWindow } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { LogEntry, LogLevel } from '../shared/types'

const MAX_ENTRIES = 2000
const RETAIN_DAYS = 14
const FILE_PATTERN = /^app-(\d{4}-\d{2}-\d{2})\.log$/

const buffer: LogEntry[] = []
let cachedDay = ''
let cachedPath = ''

// Local date, not UTC: a log named for "today" should match the user's day.
function dayStamp(ts: number): string {
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function prune(dir: string): void {
  const cutoff = dayStamp(Date.now() - RETAIN_DAYS * 86_400_000)
  try {
    for (const name of readdirSync(dir)) {
      const match = FILE_PATTERN.exec(name)
      if (match && match[1] < cutoff) unlinkSync(join(dir, name))
    }
  } catch {
    /* housekeeping must never take the app down */
  }
}

// Rolls over on its own: the first entry written after midnight lands in a new file.
export function logFilePath(): string {
  const today = dayStamp(Date.now())
  if (today === cachedDay) return cachedPath

  const dir = join(app.getPath('userData'), 'logs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  prune(dir)

  cachedDay = today
  cachedPath = join(dir, `app-${today}.log`)
  return cachedPath
}

function format(e: LogEntry): string {
  const stamp = new Date(e.ts).toISOString()
  const detail = e.detail ? ` :: ${e.detail}` : ''
  return `${stamp} ${e.level.toUpperCase().padEnd(5)} [${e.scope}] ${e.message}${detail}`
}

function record(level: LogLevel, scope: string, message: string, detail?: string): void {
  const entry: LogEntry = { ts: Date.now(), level, scope, message, detail }
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) buffer.splice(0, buffer.length - MAX_ENTRIES)

  const line = format(entry)
  console.log(line)
  try {
    appendFileSync(logFilePath(), `${line}\n`)
  } catch {
    /* logging must never throw into the caller */
  }
  BrowserWindow.getAllWindows()[0]?.webContents.send('log:entry', entry)
}

export const log = {
  debug: (scope: string, message: string, detail?: string) => record('debug', scope, message, detail),
  info: (scope: string, message: string, detail?: string) => record('info', scope, message, detail),
  warn: (scope: string, message: string, detail?: string) => record('warn', scope, message, detail),
  error: (scope: string, message: string, detail?: string) => record('error', scope, message, detail),
  raw: record
}

export function listLogs(): LogEntry[] {
  return buffer
}

export function clearLogs(): void {
  buffer.length = 0
}

export function errText(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message
  return String(err)
}
