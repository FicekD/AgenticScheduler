import type { RunStatus } from '@shared/types'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function fmtTime(ts: number | null): string {
  if (!ts) return 'no time yet'
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function fmtDuration(a: number, b: number | null): string {
  if (!b) return 'still in progress'
  const s = Math.round((b - a) / 1000)
  if (s < 60) return `${s} seconds`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem ? `${m} min ${rem} sec` : `${m} min`
}

export function fmtCountdown(ts: number | null): string {
  if (!ts) return 'Not scheduled'
  const ms = ts - Date.now()
  if (ms <= 0) return 'Starting now'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${m}m`
}

const STATUS_STYLES: Record<RunStatus, string> = {
  running: 'acc-soft-15 acc-text acc-border',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  limit: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  incomplete: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  error: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  cancelled: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
}

export function StatusBadge({ status }: { status: RunStatus }): JSX.Element {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
        STATUS_STYLES[status]
      )}
    >
      {status}
    </span>
  )
}

export function Card({
  children,
  className,
  style
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}): JSX.Element {
  return (
    <div
      style={style}
      className={cx(
        'rounded-xl border border-white/8 bg-white/[0.03] backdrop-blur-sm',
        className
      )}
    >
      {children}
    </div>
  )
}
