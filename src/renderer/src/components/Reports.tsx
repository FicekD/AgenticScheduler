import { useEffect, useState } from 'react'
import { FileText, RefreshCw } from 'lucide-react'
import { useStore } from '../store'
import { Card, fmtTime } from './common'
import Markdown from './Markdown'

export default function Reports(): JSX.Element {
  const { reports, refreshReports } = useStore()
  const [selected, setSelected] = useState<string | null>(null)
  const [content, setContent] = useState('')

  useEffect(() => {
    void refreshReports()
  }, [refreshReports])

  useEffect(() => {
    if (!selected && reports.length) setSelected(reports[0].path)
  }, [reports, selected])

  useEffect(() => {
    if (selected) window.api.readReport(selected).then(setContent)
  }, [selected])

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Reports</h1>
          <p className="text-sm text-zinc-400">
            Whenever the orchestrator finishes a point, it leaves a short note here about what it
            changed and what it thinks comes next.
          </p>
        </div>
        <button
          onClick={() => void refreshReports()}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
        >
          <RefreshCw size={15} /> Check for new reports
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-4 gap-4">
        <Card className="col-span-1 flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-auto">
            {reports.length === 0 && (
              <div className="p-4 text-sm text-zinc-600">
                No reports yet. They appear after the orchestrator finishes a point.
              </div>
            )}
            {reports.map((r) => (
              <button
                key={r.path}
                onClick={() => setSelected(r.path)}
                className={`flex w-full items-center gap-2 border-b border-white/5 px-4 py-3 text-left text-sm ${
                  selected === r.path ? 'acc-soft text-white' : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <FileText size={15} className="shrink-0 acc-text" />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="col-span-3 flex min-h-0 flex-col">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <span className="text-sm font-medium text-white">
                  {reports.find((r) => r.path === selected)?.name}
                </span>
                <span className="text-xs text-zinc-500">
                  {fmtTime(reports.find((r) => r.path === selected)?.mtime ?? null)}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-5">
                <Markdown>{content}</Markdown>
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-zinc-600">Select a report</div>
          )}
        </Card>
      </div>
    </div>
  )
}
