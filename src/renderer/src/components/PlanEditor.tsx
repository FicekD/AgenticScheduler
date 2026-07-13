import { useEffect, useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { Card } from './common'
import Markdown from './Markdown'

export default function PlanEditor(): JSX.Element {
  const { config, refreshRuns } = useStore()
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState('')
  const [saved, setSaved] = useState(false)

  const load = async (): Promise<void> => {
    const content = await window.api.readPlan()
    setText(content)
    setLoaded(content)
    setSaved(false)
  }

  useEffect(() => {
    void load()
  }, [config?.repoPath, config?.planPath])

  const dirty = text !== loaded

  const save = async (): Promise<void> => {
    const res = await window.api.writePlan(text)
    if (!res.ok) {
      alert(res.error ?? 'Failed to save plan')
      return
    }
    setLoaded(text)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    void refreshRuns()
  }

  if (!config?.repoPath) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        Choose a repository over in <span className="text-zinc-300">Settings</span> first, and then
        you can write its plan here.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Plan</h1>
          <p className="text-sm text-zinc-400">
            Write the work out as numbered points, top to bottom. Each run picks up the first point
            that isn't finished yet. Your plan is saved to{' '}
            <code className="text-zinc-300">{config.planPath}</code>.
            {dirty && <span className="ml-2 text-amber-300">You have changes you haven't saved.</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={!dirty}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-40"
          >
            <RotateCcw size={15} /> Undo
          </button>
          <button
            onClick={save}
            className="flex items-center gap-2 rounded-lg acc-solid px-4 py-2 text-sm font-medium text-white"
          >
            <Save size={16} /> {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <Card className="flex min-h-0 flex-col p-0">
          <div className="border-b border-white/8 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Your plan
          </div>
          <textarea
            className="min-h-0 flex-1 w-full resize-none bg-transparent p-5 font-mono text-sm leading-relaxed text-zinc-200 outline-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={'# Work Plan\n\n1. The first thing you want done\n2. The next thing after that'}
          />
        </Card>
        <Card className="flex min-h-0 flex-col p-0">
          <div className="border-b border-white/8 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            How it will look
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            {text.trim() ? (
              <Markdown>{text}</Markdown>
            ) : (
              <div className="text-sm text-zinc-600">
                Nothing to preview yet. Start typing on the left.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
