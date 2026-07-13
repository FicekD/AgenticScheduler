import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'

const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export default function TitleBar(): JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.api.isMaximized().then(setMaximized)
    return window.api.onMaximizeChange(setMaximized)
  }, [])

  return (
    <div style={drag} className="flex h-9 shrink-0 items-center justify-end select-none">
      <div style={noDrag} className="flex h-full">
        <button
          onClick={() => window.api.minimize()}
          className="flex w-11 items-center justify-center text-zinc-400 hover:bg-white/8 hover:text-white"
        >
          <Minus size={15} />
        </button>
        <button
          onClick={() => window.api.toggleMaximize()}
          className="flex w-11 items-center justify-center text-zinc-400 hover:bg-white/8 hover:text-white"
        >
          {maximized ? <Copy size={13} /> : <Square size={12} />}
        </button>
        <button
          onClick={() => window.api.closeWindow()}
          className="flex w-11 items-center justify-center text-zinc-400 hover:bg-rose-600 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
