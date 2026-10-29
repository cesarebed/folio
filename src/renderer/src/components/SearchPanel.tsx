import { useEffect, useRef, useState } from 'react'
import { basename, dirname, tildify } from '../lib/path'

interface Props {
  root: string
  focusToken: number
  onOpen(path: string, newTab: boolean, line?: number): void
}

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  const start = Math.max(0, i - 40)
  return (
    <>
      {start > 0 && '…'}
      {text.slice(start, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

export function SearchPanel({ root, focusToken, onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContentHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [focusToken])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    const id = ++seq.current
    const h = setTimeout(async () => {
      setBusy(true)
      const hits = await window.api.searchContent(root, q)
      if (id === seq.current) {
        setResults(hits)
        setBusy(false)
      }
    }, 350)
    return () => clearTimeout(h)
  }, [query, root])

  const q = query.trim()

  return (
    <div className="search-panel">
      <div className="search-box">
        <input
          ref={inputRef}
          value={query}
          placeholder="Cerca nei file…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        />
      </div>
      <div className="search-scope">
        in <strong>{tildify(root)}</strong>
        {busy && <span className="spinner" />}
      </div>
      <div className="search-results">
        {results && !results.length && !busy && <div className="tree-note">Nessun risultato</div>}
        {results?.map((hit) => (
          <div key={hit.path} className="hit">
            <button className="hit-file" onClick={(e) => onOpen(hit.path, e.metaKey)} title={hit.path}>
              <span className="hit-name">{basename(hit.path)}</span>
              <span className="hit-dir">{tildify(dirname(hit.path))}</span>
            </button>
            {hit.matches.map((m) => (
              <button key={m.line} className="hit-line" onClick={(e) => onOpen(hit.path, e.metaKey, m.line)}>
                {highlight(m.text.trim(), q)}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
