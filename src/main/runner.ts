import { spawn, ChildProcess } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { BrowserWindow, Notification } from 'electron'
import type { Config, Run, RunEvent, RunEventKind, RunStatus } from '../shared/types'
import { addRun, updateRun } from './store'
import { ensureAgenticIgnored } from './repo'
import { adapterFor, resolveBin, shellQuote } from './agents'
import { errText, log } from './log'

const active = new Map<string, ChildProcess>()

export function isBusy(): boolean {
  return active.size > 0
}

function emit(win: BrowserWindow | null, runId: string, kind: RunEventKind, text: string): void {
  const ev: RunEvent = { runId, ts: Date.now(), kind, text }
  win?.webContents.send('run:event', ev)
}

function reportSet(cfg: Config): Set<string> {
  const dir = join(cfg.repoPath, cfg.reportsDir)
  if (!existsSync(dir)) return new Set()
  try {
    return new Set(readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')))
  } catch (err) {
    log.warn('runner', `could not read reports dir ${dir}`, errText(err))
    return new Set()
  }
}

function renderPrompt(cfg: Config): string {
  return cfg.promptTemplate
    .replaceAll('{{PLAN_PATH}}', cfg.planPath)
    .replaceAll('{{REPORTS_DIR}}', cfg.reportsDir)
}

export function runOrchestrator(cfg: Config, label: string, slotId: string | null): Run | null {
  if (isBusy()) {
    log.warn('runner', `"${label}" not started — a run is already active`)
    return null
  }
  if (!cfg.repoPath || !existsSync(cfg.repoPath)) {
    log.error('runner', `"${label}" not started — repository path is unset or missing`, cfg.repoPath)
    throw new Error('Repository path is not set or does not exist.')
  }
  ensureAgenticIgnored(cfg.repoPath)

  const win = BrowserWindow.getAllWindows()[0] ?? null
  const run: Run = {
    id: randomUUID(),
    slotId,
    label,
    startedAt: Date.now(),
    endedAt: null,
    status: 'running',
    exitCode: null,
    sessionId: null,
    reportCreated: false,
    newReports: [],
    costUsd: null,
    numTurns: null,
    error: null
  }
  addRun(run)
  win?.webContents.send('runs:changed')

  const agent = adapterFor(cfg.agent)
  let failText = ''
  const emitEvent: (kind: RunEventKind, text: string) => void = (kind, text) => {
    // Claude reports usage limits on stderr; Codex reports them as stream error events.
    if (kind === 'error' || kind === 'stderr') failText = (failText + '\n' + text).slice(-4000)
    if (kind === 'error') log.error('agent', text)
    else if (kind === 'stderr') log.debug('agent', text)
    emit(win, run.id, kind, text)
  }
  const parseLine = agent.createParser(run, emitEvent)

  const before = reportSet(cfg)
  const bin = shellQuote(resolveBin(cfg.agent, cfg))
  const args = agent.args(cfg)
  log.info(
    'runner',
    `starting "${label}" with ${agent.label} (${cfg.model}${cfg.reasoningEffort ? `, effort ${cfg.reasoningEffort}` : ''})`,
    `run ${run.id} in ${cfg.repoPath}`
  )
  log.debug('runner', `${bin} ${args.join(' ')}`)

  const child = spawn(bin, args, {
    cwd: cfg.repoPath,
    shell: true,
    windowsHide: true,
    env: { ...process.env }
  })
  active.set(run.id, child)

  emitEvent('status', `launching ${agent.label} (${cfg.model}) in ${cfg.repoPath}`)
  child.stdin.write(renderPrompt(cfg))
  child.stdin.end()

  let buf = ''
  child.stdout.setEncoding('utf-8')
  child.stdout.on('data', (chunk: string) => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) parseLine(line)
    }
  })

  child.stderr.setEncoding('utf-8')
  child.stderr.on('data', (chunk: string) => {
    const t = chunk.trim()
    if (t) emitEvent('stderr', t.slice(0, 300))
  })

  const finalize = (code: number | null): void => {
    if (buf.trim()) parseLine(buf.trim())
    active.delete(run.id)

    const after = reportSet(cfg)
    const created = [...after].filter((f) => !before.has(f))
    const limitHit = /usage limit|rate limit|limit reached|resets? at/i.test(failText)

    let status: RunStatus
    if (run.status === 'cancelled') {
      status = 'cancelled'
    } else if (created.length > 0) {
      status = 'completed'
    } else if (limitHit) {
      status = 'limit'
    } else if (code && code !== 0) {
      status = 'error'
    } else {
      status = 'incomplete'
    }

    const updated = updateRun(run.id, {
      endedAt: Date.now(),
      exitCode: code,
      status,
      sessionId: run.sessionId,
      reportCreated: created.length > 0,
      newReports: created,
      costUsd: run.costUsd,
      numTurns: run.numTurns,
      error: status === 'error' ? failText.trim().slice(-400) || null : null
    })

    const secs = Math.round((Date.now() - run.startedAt) / 1000)
    const summary = `"${label}" finished: ${status} (exit ${code ?? '?'}) after ${secs}s`
    const detail = created.length ? `wrote ${created.join(', ')}` : 'no report written'
    if (status === 'error') log.error('runner', summary, failText.trim().slice(-400) || detail)
    else if (status === 'limit' || status === 'incomplete') log.warn('runner', summary, detail)
    else log.info('runner', summary, detail)

    emit(win, run.id, 'status', `finished: ${status} (exit ${code ?? '?'})`)
    win?.webContents.send('runs:changed')
    notify(status, label, created)
    void updated
  }

  child.on('close', (code) => finalize(code))
  child.on('error', (err) => {
    emitEvent('error', `could not launch ${bin}: ${err.message}`)
    finalize(null)
  })

  return run
}

export function cancelRun(runId: string): boolean {
  const child = active.get(runId)
  if (!child) {
    log.warn('runner', `cancel ignored — run ${runId} is not active`)
    return false
  }
  log.info('runner', `cancelling run ${runId}`)
  updateRun(runId, { status: 'cancelled' })
  child.kill()
  return true
}

function notify(status: RunStatus, label: string, created: string[]): void {
  if (!Notification.isSupported()) return
  const titles: Record<string, string> = {
    completed: '✅ Point completed',
    limit: '⏸ Usage limit — will resume',
    incomplete: '⚠️ Ended without report',
    error: '❌ Run errored',
    cancelled: '⏹ Run cancelled'
  }
  const body = created.length ? `${label}: ${created.join(', ')}` : label
  new Notification({ title: titles[status] ?? 'Run finished', body }).show()
}
