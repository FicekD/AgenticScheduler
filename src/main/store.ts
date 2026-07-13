import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Run } from '../shared/types'

function runsPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'runs.json')
}

let cache: Run[] | null = null

export function listRuns(): Run[] {
  if (cache) return cache
  const p = runsPath()
  if (!existsSync(p)) {
    cache = []
    return cache
  }
  try {
    cache = JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    cache = []
  }
  return cache!
}

function persist(): void {
  writeFileSync(runsPath(), JSON.stringify(cache ?? [], null, 2))
}

export function addRun(run: Run): void {
  const runs = listRuns()
  runs.unshift(run)
  persist()
}

export function updateRun(id: string, patch: Partial<Run>): Run | null {
  const runs = listRuns()
  const idx = runs.findIndex((r) => r.id === id)
  if (idx === -1) return null
  runs[idx] = { ...runs[idx], ...patch }
  persist()
  return runs[idx]
}

export function getRun(id: string): Run | null {
  return listRuns().find((r) => r.id === id) ?? null
}
