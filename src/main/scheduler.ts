import cron, { ScheduledTask } from 'node-cron'
import { BrowserWindow } from 'electron'
import type { Config, Slot } from '../shared/types'
import { runOrchestrator, isBusy } from './runner'
import { errText, log } from './log'

let jobs: ScheduledTask[] = []

function cronExpr(time: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${min} ${h} * * *`
}

export function nextRunFor(slot: Slot): number | null {
  const expr = cronExpr(slot.time)
  if (!expr || !slot.enabled) return null
  const [, hh, mm] = /^(\d{1,2}):(\d{2})$/.exec(slot.time)!
  const now = new Date()
  const next = new Date()
  next.setHours(Number(hh), Number(mm), 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime()
}

export function applySchedule(getConfig: () => Config): void {
  for (const j of jobs) j.stop()
  jobs = []

  const cfg = getConfig()
  for (const slot of cfg.slots) {
    if (!slot.enabled) continue
    const expr = cronExpr(slot.time)
    if (!expr) {
      log.warn('scheduler', `slot ${slot.id} has an unusable time "${slot.time}", skipped`)
      continue
    }
    const task = cron.schedule(expr, () => {
      const current = getConfig()
      const s = current.slots.find((x) => x.id === slot.id)
      if (!s || !s.enabled) {
        log.debug('scheduler', `slot ${slot.time} fired but is now disabled`)
        return
      }
      if (isBusy()) {
        log.warn('scheduler', `slot ${s.time} skipped, a run is already active`)
        BrowserWindow.getAllWindows()[0]?.webContents.send('run: event', {
          runId: 'scheduler',
          ts: Date.now(),
          kind: 'status',
          text: `slot ${s.time} skipped, a run is already active`
        })
        return
      }
      log.info('scheduler', `slot ${s.time} fired`)
      try {
        runOrchestrator(current, `Scheduled ${s.time}`, s.id)
      } catch (err) {
        log.error('scheduler', `slot ${s.time} could not start a run`, errText(err))
      }
    })
    jobs.push(task)
  }

  const times = cfg.slots.filter((s) => s.enabled).map((s) => s.time)
  log.info('scheduler', `${jobs.length} slot(s) armed`, times.join(', ') || 'none enabled')
}
