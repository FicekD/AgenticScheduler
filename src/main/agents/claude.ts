import type { AgentAdapter } from './types'

export const claude: AgentAdapter = {
  label: 'Claude Code',

  bin: (cfg) => cfg.claudePath || 'claude',

  args: (cfg) => {
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
    if (cfg.reasoningEffort) args.push('--effort', cfg.reasoningEffort)
    if (cfg.maxBudgetUsd && cfg.maxBudgetUsd > 0) {
      args.push('--max-budget-usd', String(cfg.maxBudgetUsd))
    }
    return args
  },

  createParser: (run, emit) => (line) => {
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
          emit('status', `session started (${obj.session_id ?? '?'})`)
        }
        break
      case 'assistant': {
        const content = obj.message?.content ?? []
        for (const block of content) {
          if (block.type === 'text' && block.text?.trim()) {
            emit('assistant', block.text.trim())
          } else if (block.type === 'tool_use') {
            const name = block.name ?? 'tool'
            const hint = block.input?.description || block.input?.command || block.input?.prompt
            emit('tool', hint ? `${name} — ${String(hint).slice(0, 120)}` : name)
          }
        }
        break
      }
      case 'result': {
        run.costUsd = typeof obj.total_cost_usd === 'number' ? obj.total_cost_usd : run.costUsd
        run.numTurns = typeof obj.num_turns === 'number' ? obj.num_turns : run.numTurns
        emit('result', obj.subtype ? `result: ${obj.subtype}` : 'result')
        break
      }
      default:
        break
    }
  }
}
