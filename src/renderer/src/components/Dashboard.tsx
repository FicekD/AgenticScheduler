import { useEffect, useRef } from 'react'
import { Play, Square, Clock, Zap } from 'lucide-react'
import { useStore } from '../store'
import { Card, StatusBadge, cx, fmtTime, fmtDuration, fmtCountdown } from './common'

const KIND_COLOR: Record<string, string> = {
  status: 'acc-text',
  assistant: 'text-zinc-200',
  tool: 'acc-text',
  result: 'text-emerald-300',
  stderr: 'text-amber-300',
  error: 'text-rose-300'
}

export default function Dashboard(): JSX.Element {
  const { runs, nextTimes, log, activeRunId, runNow, clearLog } = useStore()
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const active = runs.find((r) => r.id === activeRunId)

  const start = async (): Promise<void> => {
    const err = await runNow()
    if (err) alert(err)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400">
            Where your orchestrator runs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearLog}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
          >
            Clear
          </button>
          <button
            onClick={start}
            disabled={!!active}
            className={cx(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
              active
                ? 'cursor-not-allowed bg-zinc-700 text-zinc-400'
                : 'acc-solid text-white'
            )}
          >
            {active ? <Square size={16} /> : <Play size={16} />}
            {active ? 'A run is already going' : 'Start a run now'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {nextTimes.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Clock size={15} />
              <span className="text-sm">{s.time}</span>
              {!s.enabled && <span className="text-xs text-zinc-600">(turned off)</span>}
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {s.enabled ? fmtCountdown(s.next) : 'Turned off'}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-5 gap-4">
        <Card className="col-span-3 flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
            <Zap size={15} className="acc-text" />
            <span className="text-sm font-medium text-white">Current status</span>
            {active && (
              <span className="ml-auto flex items-center gap-1.5 text-xs acc-text">
                <span className="h-2 w-2 animate-pulse rounded-full acc-dot" />
                {active.label}
              </span>
            )}
          </div>
          <div ref={logRef} className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
            {log.length === 0 && (
              <div className="text-zinc-600">
                Nothing is happening yet. Once you start a run, you'll see it unfold here line by line.
              </div>
            )}
            {log.map((l, i) => (
              <div key={i} className="flex gap-2 py-0.5">
                <span className="shrink-0 text-zinc-600">
                  {new Date(l.ts).toLocaleTimeString(undefined, { hour12: false })}
                </span>
                <span className={cx('shrink-0 uppercase', KIND_COLOR[l.kind] ?? 'text-zinc-400')}>
                  {l.kind}
                </span>
                <span className="whitespace-pre-wrap break-words text-zinc-300">{l.text}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2 flex min-h-0 flex-col">
          <div className="border-b border-white/8 px-4 py-3 text-sm font-medium text-white">
            Recent runs
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {runs.length === 0 && (
              <div className="p-4 text-sm text-zinc-600">You haven't run anything yet.</div>
            )}
            {runs.slice(0, 40).map((r) => {
              const bits = [`started ${fmtTime(r.startedAt)}`]
              bits.push(r.endedAt ? `ran for ${fmtDuration(r.startedAt, r.endedAt)}` : 'is still going')
              if (r.numTurns != null) bits.push(`took ${r.numTurns} turns`)
              if (r.costUsd != null) bits.push(`cost about $${r.costUsd.toFixed(2)}`)
              return (
                <div key={r.id} className="border-b border-white/5 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{r.label}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">It {bits.join(', ')}.</div>
                  {r.newReports.length > 0 && (
                    <div className="mt-0.5 text-xs text-emerald-400">
                      It finished a point and wrote {r.newReports.join(', ')}.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
