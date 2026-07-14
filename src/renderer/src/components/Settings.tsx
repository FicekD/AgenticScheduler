import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen, Save, Plus, Trash2, RotateCw } from 'lucide-react'
import type { AgentInfo, AgentKind, Config, Slot } from '@shared/types'
import { useStore } from '../store'
import { Card } from './common'
import Markdown from './Markdown'
import ThemePicker from './ThemePicker'

const field = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none acc-focus'
const label = 'text-xs font-medium uppercase tracking-wide text-zinc-500'

const AGENTS: Array<[AgentKind, string]> = [
  ['claude', 'Claude Code'],
  ['codex', 'Codex']
]

const title = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export default function Settings(): JSX.Element {
  const { config, saveConfig } = useStore()
  const [draft, setDraft] = useState<Config | null>(config)
  const [saved, setSaved] = useState(false)
  const [agents, setAgents] = useState<AgentInfo[] | null>(null)
  const [detecting, setDetecting] = useState(false)

  // Initialize once; a live repo commit must not clobber other unsaved edits.
  useEffect(() => setDraft((prev) => prev ?? config), [config])

  const detect = useCallback(async (force: boolean): Promise<void> => {
    setDetecting(true)
    try {
      setAgents(await window.api.detectAgents(force))
    } finally {
      setDetecting(false)
    }
  }, [])

  useEffect(() => void detect(false), [detect])

  // Pin the schedule panel to the general panel's height so it scrolls instead of growing.
  const ro = useRef<ResizeObserver>()
  const [rowH, setRowH] = useState<number>()
  const generalRef = useCallback((node: HTMLDivElement | null) => {
    ro.current?.disconnect()
    if (node) {
      ro.current = new ResizeObserver(() => setRowH(node.offsetHeight))
      ro.current.observe(node)
      setRowH(node.offsetHeight)
    }
  }, [])
  useEffect(() => () => ro.current?.disconnect(), [])

  // Persist every change automatically so settings survive between runs.
  const firstPass = useRef(true)
  useEffect(() => {
    if (!draft) return
    if (firstPass.current) {
      firstPass.current = false
      return
    }
    const t = setTimeout(() => void saveConfig(draft), 500)
    return () => clearTimeout(t)
  }, [draft])

  if (!draft) return <div className="p-6 text-zinc-500">Loading your settings…</div>

  const set = <K extends keyof Config>(k: K, v: Config[K]): void => {
    setDraft({ ...draft, [k]: v })
    setSaved(false)
  }

  const info = agents?.find((a) => a.kind === draft.agent) ?? null
  const models = info?.models ?? []
  // A model the CLI no longer advertises (or a hand-edited config) must still show as selected.
  const options = models.some((m) => m.id === draft.model)
    ? models
    : [{ id: draft.model, label: `${draft.model} (custom)`, efforts: [], defaultEffort: null }, ...models]
  const efforts = models.find((m) => m.id === draft.model)?.efforts ?? []
  const defaultEffort = models.find((m) => m.id === draft.model)?.defaultEffort

  // Each agent has its own models and effort levels, carrying the old ones over is nonsense.
  const setAgent = (kind: AgentKind): void => {
    const next = agents?.find((a) => a.kind === kind)?.models[0]
    setDraft({ ...draft, agent: kind, model: next?.id ?? '', reasoningEffort: null })
    setSaved(false)
  }

  const setSlot = (id: string, patch: Partial<Slot>): void =>
    set('slots', draft.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  const addSlot = (): void =>
    set('slots', [...draft.slots, { id: `slot-${Date.now()}`, time: '21:00', enabled: true }])

  const removeSlot = (id: string): void =>
    set('slots', draft.slots.filter((s) => s.id !== id))

  // Repository takes effect immediately, persist it without waiting for Save,
  // touching only repoPath so other in-progress edits stay unsaved.
  const commitRepo = async (path: string): Promise<void> => {
    set('repoPath', path)
    if (config) await saveConfig({ ...config, repoPath: path })
  }

  const pick = async (): Promise<void> => {
    const p = await window.api.pickRepo()
    if (p) await commitRepo(p)
  }

  const save = async (): Promise<void> => {
    await saveConfig(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const rendered = draft.promptTemplate
    .replaceAll('{{PLAN_PATH}}', draft.planPath || 'PLAN.md')
    .replaceAll('{{REPORTS_DIR}}', draft.reportsDir || 'reports')

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="relative z-30 mb-4 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-zinc-400">
            Pick which repository to work on, when the runs should happen, which model to use, and
            how the orchestrator is briefed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemePicker value={draft.theme} onChange={(k) => set('theme', k)} />
          <button
            onClick={save}
            className="flex items-center gap-2 rounded-lg acc-solid px-4 py-2 text-sm font-medium text-white"
          >
            <Save size={16} /> {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex shrink-0 items-start gap-4">
          <div ref={generalRef} className="min-w-0 flex-2">
            <Card className="space-y-4 p-5">
              <div>
                <div className={label}>Repository</div>
                <div className="mt-1 flex gap-2">
                  <input
                    className={field}
                    value={draft.repoPath}
                    onChange={(e) => set('repoPath', e.target.value)}
                    onBlur={(e) => void commitRepo(e.target.value)}
                    placeholder="D:\\path\\to\\your\\repo"
                  />
                  <button
                    onClick={pick}
                    className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 hover:bg-white/5"
                  >
                    <FolderOpen size={15} /> Browse
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={label}>Agent</div>
                  <select
                    className={`${field} select-field mt-1`}
                    value={draft.agent}
                    onChange={(e) => setAgent(e.target.value as AgentKind)}
                  >
                    {AGENTS.map(([kind, name]) => (
                      <option key={kind} value={kind}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-zinc-500">
                    {detecting && 'Looking for the CLI…'}
                    {!detecting && info?.available && `Found ${info.version}`}
                    {!detecting && info && !info.available && (
                      <span className="text-amber-400">{info.note}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className={label}>CLI path</div>
                  <div className="mt-1 flex gap-2">
                    <input
                      className={field}
                      value={draft.agent === 'claude' ? draft.claudePath : draft.codexPath}
                      onChange={(e) =>
                        set(draft.agent === 'claude' ? 'claudePath' : 'codexPath', e.target.value)
                      }
                      onBlur={() => void detect(true)}
                      placeholder={draft.agent}
                    />
                    <button
                      onClick={() => void detect(true)}
                      title="Re-detect the CLI and its models"
                      className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-300 hover:bg-white/5"
                    >
                      <RotateCw size={15} className={detecting ? 'animate-spin' : undefined} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={label}>Model</div>
                  {models.length === 0 && info?.available ? (
                    <input
                      className={`${field} mt-1`}
                      value={draft.model}
                      onChange={(e) => set('model', e.target.value)}
                      placeholder="model name"
                    />
                  ) : (
                    <select
                      className={`${field} select-field mt-1`}
                      value={draft.model}
                      onChange={(e) => set('model', e.target.value)}
                    >
                      {options.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {info?.note && info.available && (
                    <div className="mt-1 text-xs text-amber-400">{info.note}</div>
                  )}
                </div>
                <div>
                  <div className={label}>Reasoning effort</div>
                  <select
                    className={`${field} select-field mt-1`}
                    value={draft.reasoningEffort ?? ''}
                    disabled={efforts.length === 0}
                    onChange={(e) => set('reasoningEffort', e.target.value || null)}
                  >
                    <option value="">
                      {efforts.length === 0 ? 'Not offered by this model' : "Default (the agent decides)"}
                    </option>
                    {efforts.map((e) => (
                      <option key={e} value={e}>
                        {title(e)}
                        {e === defaultEffort ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={label}>Plan file</div>
                  <input className={`${field} mt-1`} value={draft.planPath} onChange={(e) => set('planPath', e.target.value)} />
                </div>
                <div>
                  <div className={label}>Reports folder</div>
                  <input className={`${field} mt-1`} value={draft.reportsDir} onChange={(e) => set('reportsDir', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={label}>UI scale</div>
                  <select
                    className={`${field} select-field mt-1`}
                    value={draft.uiScale}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      set('uiScale', v)
                      window.api.setUiScale(v)
                    }}
                  >
                    <option value={75}>75%</option>
                    <option value={100}>100%</option>
                    <option value={125}>125%</option>
                  </select>
                </div>
              </div>
            </Card>
          </div>

          <Card className="flex min-w-0 flex-1 flex-col p-5" style={{ height: rowH }}>
            <div className="mb-3 flex items-center justify-between">
              <div className={label}>When runs happen<br></br>(your local time)</div>
              <button onClick={addSlot} className="flex items-center gap-1 text-sm acc-text acc-text-hover">
                <Plus size={14} /> Add another time
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
              {draft.slots.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => setSlot(s.id, { enabled: e.target.checked })}
                    className="h-4 w-4 acc-check"
                  />
                  <input
                    type="time"
                    value={s.time}
                    onChange={(e) => setSlot(s.id, { time: e.target.value })}
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white outline-none acc-focus"
                  />
                  <button onClick={() => removeSlot(s.id)} className="text-zinc-500 hover:text-rose-400">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col p-5">
          <div className={`${label} shrink-0`}>Orchestrator prompt template</div>
          <p className="mb-3 mt-1 shrink-0 text-xs text-zinc-500">
            Placeholders <code className="text-zinc-400">{'{{PLAN_PATH}}'}</code> and{' '}
            <code className="text-zinc-400">{'{{REPORTS_DIR}}'}</code> are substituted at launch
          </p>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
            <div className="flex min-h-0 flex-col">
              <div className={`${label} mb-1`}>Edit</div>
              <textarea
                className={`${field} min-h-0 flex-1 resize-none font-mono text-xs leading-relaxed`}
                value={draft.promptTemplate}
                onChange={(e) => set('promptTemplate', e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="flex min-h-0 flex-col">
              <div className={`${label} mb-1`}>Live view</div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3">
                <Markdown>{rendered}</Markdown>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
