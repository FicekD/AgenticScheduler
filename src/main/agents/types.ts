import type { Config, Run, RunEventKind } from '../../shared/types'

export type Emit = (kind: RunEventKind, text: string) => void

export interface AgentAdapter {
  label: string
  bin(cfg: Config): string
  args(cfg: Config): string[]
  // Returns a line handler; the closure owns whatever per-run state the stream needs.
  createParser(run: Run, emit: Emit): (line: string) => void
}
