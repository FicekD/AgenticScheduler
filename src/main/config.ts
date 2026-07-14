import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Config } from '../shared/types'
import { DEFAULT_PROMPT_TEMPLATE } from './prompt'
import { errText, log } from './log'

function configPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'config.json')
}

function defaults(): Config {
  return {
    repoPath: '',
    agent: 'claude',
    claudePath: 'claude',
    codexPath: 'codex',
    model: 'opus',
    reasoningEffort: null,
    reportsDir: '.agentic-scheduler/reports',
    planPath: '.agentic-scheduler/PLAN.md',
    maxBudgetUsd: null,
    slots: [
      { id: 'slot-morning', time: '06:00', enabled: true },
      { id: 'slot-midday', time: '11:00', enabled: true },
      { id: 'slot-afternoon', time: '16:00', enabled: true }
    ],
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
    uiScale: 100,
    theme: 'teal'
  }
}

export function loadConfig(): Config {
  const p = configPath()
  if (!existsSync(p)) {
    const d = defaults()
    writeFileSync(p, JSON.stringify(d, null, 2))
    log.info('config', 'no config found — wrote defaults', p)
    return d
  }
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8'))
    const merged = { ...defaults(), ...parsed }
    // Migrate the old root-level defaults into the gitignored scheduler dir.
    if (parsed.planPath === 'PLAN.md') merged.planPath = '.agentic-scheduler/PLAN.md'
    if (parsed.reportsDir === 'reports') merged.reportsDir = '.agentic-scheduler/reports'
    log.info('config', `loaded config: ${merged.agent} / ${merged.model}`, p)
    return merged
  } catch (err) {
    log.error('config', 'config is unreadable — falling back to defaults', errText(err))
    return defaults()
  }
}

export function saveConfig(cfg: Config): Config {
  const merged = { ...defaults(), ...cfg }
  try {
    writeFileSync(configPath(), JSON.stringify(merged, null, 2))
    log.debug('config', `saved config: ${merged.agent} / ${merged.model}`)
  } catch (err) {
    log.error('config', 'could not write config', errText(err))
  }
  return merged
}
