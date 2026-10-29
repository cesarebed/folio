import { useEffect, useRef } from 'react'
import type { Settings } from '../types'

interface Props {
  settings: Settings
  patchSettings(p: Partial<Settings>): void
  onClose(): void
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <div className="segmented small full">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function SettingsPanel({ settings, patchSettings, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('.sidebar-bottom')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="settings" ref={ref}>
      <label>Tema</label>
      <Choice
        value={settings.theme}
        options={[
          ['system', 'Sistema'],
          ['light', 'Chiaro'],
          ['dark', 'Scuro']
        ]}
        onChange={(theme) => patchSettings({ theme })}
      />
      <label>Carattere di lettura</label>
      <Choice
        value={settings.readerFont}
        options={[
          ['sans', 'Sans'],
          ['serif', 'Serif']
        ]}
        onChange={(readerFont) => patchSettings({ readerFont })}
      />
      <label>
        Dimensione testo <span className="value">{settings.fontSize}px</span>
      </label>
      <input
        type="range"
        min={13}
        max={24}
        value={settings.fontSize}
        onChange={(e) => patchSettings({ fontSize: Number(e.target.value) })}
      />
      <label>Larghezza pagina</label>
      <Choice
        value={settings.width}
        options={[
          ['narrow', 'Stretta'],
          ['wide', 'Ampia'],
          ['full', 'Piena']
        ]}
        onChange={(width) => patchSettings({ width })}
      />
      <label>Apri i file in</label>
      <Choice
        value={settings.defaultMode}
        options={[
          ['read', 'Lettura'],
          ['edit', 'Modifica']
        ]}
        onChange={(defaultMode) => patchSettings({ defaultMode })}
      />
      <label className="check">
        <input type="checkbox" checked={settings.showHidden} onChange={(e) => patchSettings({ showHidden: e.target.checked })} />
        Mostra file e cartelle nascosti
      </label>
    </div>
  )
}
