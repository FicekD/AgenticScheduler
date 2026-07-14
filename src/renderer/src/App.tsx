import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  FileText,
  Settings as SettingsIcon,
  ListChecks,
  CalendarClock,
  ScrollText
} from 'lucide-react'
import { useStore } from './store'
import { cx } from './components/common'
import TitleBar from './components/TitleBar'
import { applyTheme } from './components/ThemePicker'
import Dashboard from './components/Dashboard'
import PlanEditor from './components/PlanEditor'
import Reports from './components/Reports'
import Settings from './components/Settings'
import Logs from './components/Logs'

type Tab = 'dashboard' | 'plan' | 'reports' | 'settings' | 'logs'

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'plan', label: 'Plan', icon: <ListChecks size={18} /> },
  { id: 'reports', label: 'Reports', icon: <FileText size={18} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  { id: 'logs', label: 'Logs', icon: <ScrollText size={18} /> }
]

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('dashboard')
  const { refreshAll, refreshRuns, pushLog, pushAppLog, config } = useStore()

  useEffect(() => {
    void refreshAll()
    const offEvent = window.api.onRunEvent(pushLog)
    const offChanged = window.api.onRunsChanged(() => void refreshRuns())
    const offLog = window.api.onLogEntry(pushAppLog)
    const tick = setInterval(() => void refreshRuns(), 30_000)

    // A crash in the UI is exactly what the Logs tab exists for.
    const onError = (e: ErrorEvent): void =>
      window.api.writeLog('error', e.message, `${e.filename}:${e.lineno}`)
    const onRejection = (e: PromiseRejectionEvent): void =>
      window.api.writeLog('error', 'unhandled rejection in the UI', String(e.reason))
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      offEvent()
      offChanged()
      offLog()
      clearInterval(tick)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [refreshAll, refreshRuns, pushLog, pushAppLog])

  useEffect(() => {
    if (config?.uiScale) window.api.setUiScale(config.uiScale)
  }, [config?.uiScale])

  useEffect(() => {
    if (config?.theme) applyTheme(config.theme)
  }, [config?.theme])

  const repoName = config?.repoPath ? config.repoPath.split(/[\\/]/).pop() : 'no repo set'

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/8 bg-black/20">
        <div
          className="flex items-center gap-2 px-5 py-5"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg acc-solid">
            <CalendarClock size={20} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Agentic</div>
            <div className="text-xs text-zinc-500">Scheduler</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm',
                tab === t.id ? 'acc-soft text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/8 px-5 py-4">
          <div className="text-xs text-zinc-500">Target</div>
          <div className="truncate text-sm text-zinc-300" title={config?.repoPath}>
            {repoName}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <div className="min-h-0 flex-1">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'plan' && <PlanEditor />}
          {tab === 'reports' && <Reports />}
          {tab === 'settings' && <Settings />}
          {tab === 'logs' && <Logs />}
        </div>
      </main>
    </div>
  )
}
