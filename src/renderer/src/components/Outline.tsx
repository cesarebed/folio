import { X } from '@phosphor-icons/react'
import type { Heading } from '../lib/markdown'

interface Props {
  headings: Heading[]
  topLine: number
  onSelect(line: number): void
  onClose(): void
}

export function Outline({ headings, topLine, onSelect, onClose }: Props) {
  const min = Math.min(...headings.map((h) => h.level), 6)
  let current = -1
  headings.forEach((h, i) => {
    if (h.line <= topLine) current = i
  })
  return (
    <aside className="outline">
      <div className="outline-head">
        <span>Indice</span>
        <button className="icon-btn" onClick={onClose} title="Chiudi indice">
          <X size={13} weight="bold" />
        </button>
      </div>
      <div className="outline-list">
        {!headings.length && <div className="tree-note">Nessun titolo nel documento</div>}
        {headings.map((h, i) => (
          <button
            key={`${h.line}-${i}`}
            className={`outline-item${i === current ? ' current' : ''}`}
            style={{ paddingLeft: 12 + (h.level - min) * 12 }}
            onClick={() => onSelect(h.line)}
            title={h.text}
          >
            {h.text || 'Senza titolo'}
          </button>
        ))}
      </div>
    </aside>
  )
}
