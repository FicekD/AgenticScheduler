import { spawn, ChildProcess } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { BrowserWindow, Notification } from 'electron'
import type { Config, Run, RunEvent, RunEventKind, RunStatus } from '../shared/types'
import { addRun, updateRun } from './store'
import { ensureAgenticIgnored } from './repo'

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
  } catch {
    return new Set()
  }
}

function buildArgs(cfg: Config): string[] {
  const args = [
    '-p',
    '--model',
    cfg.model,
    '--permission-mode',
    'bypassPermissions',
    '--output-format',
    'stream-json',
    '--verbose'
  ]
  if (cfg.maxBudgetUsd && cfg.maxBudgetUsd > 0) {
    args.push('--max-budget-usd', String(cfg.maxBudgetUsd))
  }
  return args
}

function renderPrompt(cfg: Config): string {
  return cfg.promptTemplate
    .replaceAll('{{PLAN_PATH}}', cfg.planPath)
    .replaceAll('{{REPORTS_DIR}}', cfg.reportsDir)
}

function parseLine(line: string, win: BrowserWindow | null, run: Run): void {
  let obj: any
  try {
    obj = JSON.parse(line)
  } catch {
    return
  }
  switch (obj.type) {
    case 'system':
      if (obj.subtype === 'init') {
        run.sessionId = obj.session_id ?? null
        emit(win, run.id, 'status', `session started (${obj.session_id ?? '?'})`)
      }
      break
    case 'assistant': {
      const content = obj.message?.content ?? []
      for (const block of content) {
        if (block.type === 'text' && block.text?.trim()) {
          emit(win, run.id, 'assistant', block.text.trim())
        } else if (block.type === 'tool_use') {
          const name = block.name ?? 'tool'
          const hint = block.input?.description || block.input?.command || block.input?.prompt
          emit(win, run.id, 'tool', hint ? `${name} — ${String(hint).slice(0, 120)}` : name)
        }
      }
      break
    }
    case 'result': {
      run.costUsd = typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : run.costUsd
      run.numTurns = typeof obj.num_turns === 'number' ? obj.num_turns : run.numTurns
      const summary = obj.subtype ? `result: ${obj.subtype}` : 'result'
      emit(win, run.id, 'result', summary)
      break
    }
    default:
      break
  }
}

export function runOrchestrator(cfg: Config, label: string, slotId: string | null): Run | null {
  if (isBusy()) return null
  if (!cfg.repoPath || !existsSync(cfg.repoPath)) {
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

  const before = reportSet(cfg)
  const child = spawn(cfg.claudePath || 'claude', buildArgs(cfg), {
    cwd: cfg.repoPath,
    shell: true,
    windowsHide: true,
    env: { ...process.env }
  })
  active.set(run.id, child)

  emit(win, run.id, 'status', `launching ${cfg.model} orchestrator in ${cfg.repoPath}`)
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
      if (line) parseLine(line, win, run)
    }
  })

  let stderrTail = ''
  child.stderr.setEncoding('utf-8')
  child.stderr.on('data', (chunk: string) => {
    stderrTail = (stderrTail + chunk).slice(-2000)
    const t = chunk.trim()
    if (t) emit(win, run.id, 'stderr', t.slice(0, 300))
  })

  const finalize = (code: number | null): void => {
    if (buf.trim()) parseLine(buf.trim(), win, run)
    active.delete(run.id)

    const after = reportSet(cfg)
    const created = [...after].filter((f) => !before.has(f))
    const limitHit = /usage limit|rate limit|limit reached|resets? at/i.test(stderrTail)

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
      error: status === 'error' ? stderrTail.slice(-400) || null : null
    })

    emit(win, run.id, 'status', `finished: ${status} (exit ${code ?? '?'})`)
    win?.webContents.send('runs:changed')
    notify(status, label, created)
    void updated
  }

  child.on('close', (code) => finalize(code))
  child.on('error', (err) => {
    emit(win, run.id, 'error', err.message)
    stderrTail += `\n${err.message}`
    finalize(null)
  })

  return run
}

export function cancelRun(runId: string): boolean {
  const child = active.get(runId)
  if (!child) return false
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
