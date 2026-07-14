import type { AgentKind } from '../../shared/types'
import { claude } from './claude'
import { codex } from './codex'
import type { AgentAdapter } from './types'

const adapters: Record<AgentKind, AgentAdapter> = { claude, codex }

export function adapterFor(kind: AgentKind): AgentAdapter {
  return adapters[kind] ?? claude
}

export { detectAgents, resolveBin, shellQuote } from './detect'
export type { AgentAdapter, Emit } from './types'
