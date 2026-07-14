import type { AgentAdapter } from './types'

// `codex exec --json` streams JSONL: thread.started, turn.*, and item.started/updated/completed
// carrying a typed item (agent_message, command_execution, file_change, mcp_tool_call, ...).
function describe(item: any): string | null {
  switch (item.type) {
    case 'command_execution':
      return `bash — ${String(item.command ?? '').replace(/\s+/g, ' ').slice(0, 120)}`
    case 'file_change': {
      const paths = (item.changes ?? []).map((c: any) => c.path).filter(Boolean)
      return `edit — ${paths.join(', ').slice(0, 120) || 'files'}`
    }
    case 'mcp_tool_call':
      return `${item.server ?? 'mcp'}.${item.tool ?? 'tool'}`
    case 'web_search':
      return `search — ${String(item.query ?? '').slice(0, 120)}`
    default:
      return null
  }
}

export const codex: AgentAdapter = {
  label: 'Codex',

  bin: (cfg) => cfg.codexPath || 'codex',

  args: (cfg) => {
    const args = [
      'exec',
      '--json',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check'
    ]
    if (cfg.model) args.push('-m', cfg.model)
    // Unquoted values fail TOML parsing and fall back to a raw string literal, which is what we want
    // here and keeps the shell command line free of nested quotes.
    if (cfg.reasoningEffort) args.push('-c', `model_reasoning_effort=${cfg.reasoningEffort}`)
    args.push('-') // read the prompt from stdin
    return args
  },

  createParser: (run, emit) => {
    const announced = new Set<string>()

    return (line) => {
      let obj: any
      try {
        obj = JSON.parse(line)
      } catch {
        return
      }
      switch (obj.type) {
        case 'thread.started':
          run.sessionId = obj.thread_id ?? null
          emit('status', `session started (${obj.thread_id ?? '?'})`)
          break
        case 'item.started':
        case 'item.updated':
        case 'item.completed': {
          const item = obj.item ?? {}
          if (item.type === 'agent_message') {
            if (obj.type === 'item.completed' && item.text?.trim()) {
              emit('assistant', item.text.trim())
            }
            break
          }
          if (item.type === 'error') {
            emit('error', item.message ?? 'agent error')
            break
          }
          // Tools stream start → completed; announce each item once, as soon as it appears.
          const text = describe(item)
          if (text && !announced.has(item.id)) {
            announced.add(item.id)
            emit('tool', text)
          }
          break
        }
        case 'turn.completed': {
          run.numTurns = (run.numTurns ?? 0) + 1
          const out = obj.usage?.output_tokens
          emit('result', out != null ? `turn complete (${out} output tokens)` : 'turn complete')
          break
        }
        case 'turn.failed':
          emit('error', obj.error?.message ?? 'turn failed')
          break
        case 'error':
          emit('error', obj.message ?? 'error')
          break
        default:
          break
      }
    }
  }
}
