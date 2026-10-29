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
  [['⌘', 'P'], 'Quick open'],
  [['⌘', 'N'], 'New note'],
  [['⌘', 'E'], 'Read / Edit'],
  [['⌘', '⇧', 'F'], 'Search in files'],
  [['⌘', '\\'], 'Sidebar']
]

export function EmptyState({ recent, onOpen, onQuickOpen, onNewNote, onOpenFolder }: Props) {
  return (
    <div className="empty">
      <div className="empty-inner">
        <h1 className="empty-title">Folio</h1>
        <p className="empty-sub">Read and write the Markdown files already on your Mac.</p>
        <div className="empty-actions">
          <button className="btn primary" onClick={onQuickOpen}>
            Open a file
          </button>
          <button className="btn" onClick={onNewNote}>
            New note
          </button>
          <button className="btn" onClick={onOpenFolder}>
            Open folder
          </button>
        </div>
        {recent.length > 0 && (
          <section className="recent">
            <h2>Recent</h2>
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
