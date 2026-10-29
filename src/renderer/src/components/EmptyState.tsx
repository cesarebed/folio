import { FileText } from '@phosphor-icons/react'
import { basename, dirname, stem, tildify } from '../lib/path'

interface Props {
  recent: string[]
  onOpen(path: string): void
  onQuickOpen(): void
  onNewNote(): void
  onOpenFolder(): void
}

const SHORTCUTS: [string[], string][] = [
  [['⌘', 'P'], 'Apertura rapida'],
  [['⌘', 'N'], 'Nuova nota'],
  [['⌘', 'E'], 'Lettura / Modifica'],
  [['⌘', '⇧', 'F'], 'Cerca nei file'],
  [['⌘', '\\'], 'Barra laterale']
]

export function EmptyState({ recent, onOpen, onQuickOpen, onNewNote, onOpenFolder }: Props) {
  return (
    <div className="empty">
      <div className="empty-inner">
        <h1 className="empty-title">Folio</h1>
        <p className="empty-sub">Leggi e scrivi i file Markdown che hai sul Mac.</p>
        <div className="empty-actions">
          <button className="btn primary" onClick={onQuickOpen}>
            Apri un file
          </button>
          <button className="btn" onClick={onNewNote}>
            Nuova nota
          </button>
          <button className="btn" onClick={onOpenFolder}>
            Apri cartella
          </button>
        </div>
        {recent.length > 0 && (
          <section className="recent">
            <h2>Recenti</h2>
            {recent.slice(0, 8).map((p) => (
              <button key={p} className="recent-item" onClick={() => onOpen(p)}>
                <FileText size={15} />
                <span className="recent-name">{stem(p) || basename(p)}</span>
                <span className="recent-dir">{tildify(dirname(p))}</span>
              </button>
            ))}
          </section>
        )}
        <section className="shortcuts">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="shortcut">
              <span>{label}</span>
              <span>
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
