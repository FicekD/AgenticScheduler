import { execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import type { AgentInfo, AgentKind, AgentModel, Config } from '../../shared/types'

const pexec = promisify(execFile)

// Where each CLI installs itself when it is not on PATH.
function fallbackPaths(kind: AgentKind): string[] {
  const local = process.env['LOCALAPPDATA']
  const roaming = process.env['APPDATA']
  const paths: string[] = []
  if (kind === 'claude') {
    paths.push(join(homedir(), '.local', 'bin', 'claude.exe'))
    if (roaming) paths.push(join(roaming, 'npm', 'claude.cmd'))
  } else {
    if (local) paths.push(join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'))
    if (roaming) paths.push(join(roaming, 'npm', 'codex.cmd'))
  }
  return paths
}

export function resolveBin(kind: AgentKind, cfg: Config): string {
  const explicit = (kind === 'claude' ? cfg.claudePath : cfg.codexPath)?.trim()
  if (explicit) return explicit
  return fallbackPaths(kind).find((p) => existsSync(p)) ?? kind
}

// spawn goes through a shell so .cmd/.ps1 shims resolve; a path with spaces must survive that.
export function shellQuote(bin: string): string {
  return bin.includes(' ') && !bin.startsWith('"') ? `"${bin}"` : bin
}

async function cli(bin: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await pexec(shellQuote(bin), args, {
      timeout: 15000,
      windowsHide: true,
      shell: true
    })
    return stdout
  } catch {
    return null
  }
}

const CLAUDE_ALIASES: Array<[string, string]> = [
  ['opus', 'Opus'],
  ['sonnet', 'Sonnet'],
  ['haiku', 'Haiku']
]

// Claude Code has no "list models" command: the aliases always work, and the account's extra
// entitlements (e.g. Fable) are cached by the CLI itself in ~/.claude.json.
function claudeModels(efforts: string[]): AgentModel[] {
  const models: AgentModel[] = CLAUDE_ALIASES.map(([id, label]) => ({
    id,
    label,
    description: null,
    efforts,
    defaultEffort: null
  }))
  try {
    const cache = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf-8'))
    for (const extra of cache.additionalModelOptionsCache ?? []) {
      if (!extra?.value || models.some((m) => m.id === extra.value)) continue
      models.push({
        id: extra.value,
        label: extra.label ?? extra.value,
        description: extra.description ?? null,
        efforts,
        defaultEffort: null
      })
    }
  } catch {
    /* no cache yet — the aliases are enough */
  }
  return models
}

async function detectClaude(cfg: Config): Promise<AgentInfo> {
  const bin = resolveBin('claude', cfg)
  const version = (await cli(bin, ['--version']))?.trim().split('\n')[0] ?? null
  if (!version) {
    return {
      kind: 'claude',
      label: 'Claude Code',
      available: false,
      version: null,
      models: [],
      note: `Could not run "${bin}". Install Claude Code or set the CLI path.`
    }
  }
  // "--effort <level>  Effort level for the current session (low, medium, high, max)"
  const help = await cli(bin, ['--help'])
  const match = help?.match(/--effort <level>[^(\n]*\(([^)]+)\)/)
  const efforts = match ? match[1].split(',').map((s) => s.trim()).filter(Boolean) : []

  return {
    kind: 'claude',
    label: 'Claude Code',
    available: true,
    version,
    models: claudeModels(efforts),
    note: null
  }
}

// Codex caches the models its account may use, with each model's reasoning levels.
function codexModels(): AgentModel[] {
  const home = process.env['CODEX_HOME'] || join(homedir(), '.codex')
  const cachePath = join(home, 'models_cache.json')
  if (!existsSync(cachePath)) return []
  try {
    const cache = JSON.parse(readFileSync(cachePath, 'utf-8'))
    return (cache.models ?? [])
      .filter((m: any) => m.slug && m.visibility !== 'hide')
      .sort((a: any, b: any) => (a.priority ?? 999) - (b.priority ?? 999))
      .map((m: any) => ({
        id: m.slug,
        label: m.display_name || m.slug,
        description: m.description ?? null,
        efforts: (m.supported_reasoning_levels ?? []).map((e: any) => e.effort).filter(Boolean),
        defaultEffort: m.default_reasoning_level ?? null
      }))
  } catch {
    return []
  }
}

async function detectCodex(cfg: Config): Promise<AgentInfo> {
  const bin = resolveBin('codex', cfg)
  const version = (await cli(bin, ['--version']))?.trim().split('\n')[0] ?? null
  if (!version) {
    return {
      kind: 'codex',
      label: 'Codex',
      available: false,
      version: null,
      models: [],
      note: `Could not run "${bin}". Install the Codex CLI or set the CLI path.`
    }
  }
  const models = codexModels()
  return {
    kind: 'codex',
    label: 'Codex',
    available: true,
    version,
    models,
    note: models.length
      ? null
      : 'No model list cached yet — sign in and run codex once, then refresh.'
  }
}

let cache: AgentInfo[] | null = null

export async function detectAgents(cfg: Config, force = false): Promise<AgentInfo[]> {
  if (cache && !force) return cache
  cache = await Promise.all([detectClaude(cfg), detectCodex(cfg)])
  return cache
}
