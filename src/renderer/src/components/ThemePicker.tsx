import { useState } from 'react'
import { cx } from './common'

export const THEMES: { key: string; label: string; color: string }[] = [
  { key: 'teal', label: 'Teal', color: '#0f766e' },
  { key: 'red', label: 'Red', color: '#843030' },
  { key: 'amber', label: 'Amber', color: '#98763a' },
  { key: 'violet', label: 'Violet', color: '#685c98' },
  { key: 'slate', label: 'Slate', color: '#4a6472' },
  { key: 'green', label: 'Green', color: '#4f7a52' }
]

export function applyTheme(key: string): void {
  document.documentElement.setAttribute('data-theme', key)
}

export default function ThemePicker({
  value,
  onChange
}: {
  value: string
  onChange: (key: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const current = THEMES.find((t) => t.key === value) ?? THEMES[0]

  const pick = (key: string): void => {
    applyTheme(key)
    onChange(key)
    setOpen(false)
  }

  return (
    <div className="relative flex self-stretch">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Theme color"
        style={{ backgroundColor: current.color }}
        className="h-full w-9 rounded-md border border-white/20 shadow-inner transition hover:brightness-110"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-max rounded-xl border border-white/10 bg-[#161c1d] p-4 shadow-2xl">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Accent theme
            </div>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => pick(t.key)}
                  title={t.label}
                  style={{ backgroundColor: t.color }}
                  className={cx(
                    'h-10 w-10 rounded-md border transition hover:brightness-110',
                    value === t.key ? 'border-white ring-2 ring-white/30' : 'border-white/15'
                  )}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
