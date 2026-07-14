import { useEffect, useRef } from 'react'
import { Trash2, FolderOpen } from 'lucide-react'
import { LOG_LEVELS, type LogLevel } from '@shared/types'
import { useStore } from '../store'
import { Card, cx } from './common'

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: 'text-zinc-500',
  info: 'text-sky-300',
  warn: 'text-amber-300',
  error: 'text-rose-300'
}

const FILTER_LABEL: Record<LogLevel, string> = {
  debug: 'Debug',
  info: 'Info',
  warn: 'Warnings',
  error: 'Errors'
}

export default function Logs(): JSX.Element {
  const { appLogs, logLevel, setLogLevel, clearAppLogs } = useStore()
  const endRef = useRef<HTMLDivElement>(null)

  const threshold = LOG_LEVELS.indexOf(logLevel)
  const visible = appLogs.filter((e) => LOG_LEVELS.indexOf(e.level) >= threshold)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [visible.length])

  const problems = appLogs.filter((e) => e.level === 'warn' || e.level === 'error').length

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Logs</h1>
          <p className="text-sm text-zinc-400">
            What the app itself is doing, the place to look when something goes wrong.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={logLevel}
            onChange={(e) => setLogLevel(e.target.value as LogLevel)}
            className="select-field rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none acc-focus"
          >
            {LOG_LEVELS.map((l) => (
              <option key={l} value={l}>
                {FILTER_LABEL[l]}
              </option>
            ))}
          </select>
          <button
            onClick={() => void window.api.revealLogFile()}
            title="Show today's log file in the file explorer"
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
          >
            <FolderOpen size={15} /> Log file
          </button>
          <button
            onClick={() => void clearAppLogs()}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
          >
            <Trash2 size={15} /> Clear
          </button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3 text-xs text-zinc-500">
          <span>
            Showing {visible.length} of {appLogs.length} entries
          </span>
          {problems > 0 && (
            <span className="text-amber-300">
              {problems} warning{problems === 1 ? '' : 's'} or error{problems === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
          {visible.length === 0 && (
            <div className="text-zinc-600">
              {appLogs.length === 0
                ? 'Nothing logged yet.'
                : 'Nothing at this severity, try a lower one.'}
            </div>
          )}
          {visible.map((e, i) => (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-zinc-600">
                {new Date(e.ts).toLocaleTimeString(undefined, { hour12: false })}
              </span>
              <span className={cx('w-10 shrink-0 uppercase', LEVEL_COLOR[e.level])}>{e.level}</span>
              <span className="shrink-0 text-zinc-500">[{e.scope}]</span>
              <span className="min-w-0 break-words text-zinc-300">
                {e.message}
                {e.detail && (
                  <span className="whitespace-pre-wrap text-zinc-600"> :: {e.detail}</span>
                )}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </Card>
    </div>
  )
}
