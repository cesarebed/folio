import { useEffect, useRef, useState } from 'react'
import { CaretDown, CaretUp, X } from '@phosphor-icons/react'

interface Props {
  scope(): HTMLElement | null
  onClose(): void
}

function findRanges(root: HTMLElement, query: string) {
  const ranges: Range[] = []
  if (!query) return ranges
  const q = query.toLowerCase()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue?.toLowerCase() ?? ''
    let i = text.indexOf(q)
    while (i >= 0) {
      const r = new Range()
      r.setStart(node, i)
      r.setEnd(node, i + q.length)
      ranges.push(r)
      i = text.indexOf(q, i + q.length)
    }
  }
  return ranges
}

export function FindBar({ scope, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)
  const ranges = useRef<Range[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    return () => {
      CSS.highlights.delete('find')
      CSS.highlights.delete('find-current')
    }
  }, [])

  useEffect(() => {
    const root = scope()
    ranges.current = root ? findRanges(root, query) : []
    setCount(ranges.current.length)
    setIndex(0)
    CSS.highlights.set('find', new Highlight(...ranges.current))
  }, [query, scope])

  useEffect(() => {
    const r = ranges.current[index]
    if (!r) {
      CSS.highlights.delete('find-current')
      return
    }
    CSS.highlights.set('find-current', new Highlight(r))
    r.startContainer.parentElement?.scrollIntoView({ block: 'center' })
  }, [index, count])

  const step = (d: number) => count && setIndex((i) => (i + d + count) % count)

  return (
    <div className="findbar">
      <input
        ref={inputRef}
        value={query}
        placeholder="Trova nel documento"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') step(e.shiftKey ? -1 : 1)
          if (e.key === 'Escape') onClose()
        }}
      />
      <span className="find-count">{query ? (count ? `${index + 1} di ${count}` : 'Nessun risultato') : ''}</span>
      <button className="icon-btn" onClick={() => step(-1)} title="Precedente (⇧↩)">
        <CaretUp size={14} weight="bold" />
      </button>
      <button className="icon-btn" onClick={() => step(1)} title="Successivo (↩)">
        <CaretDown size={14} weight="bold" />
      </button>
      <button className="icon-btn" onClick={onClose} title="Chiudi (Esc)">
        <X size={14} weight="bold" />
      </button>
    </div>
  )
}
