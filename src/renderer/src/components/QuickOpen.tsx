import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, MagnifyingGlass } from '@phosphor-icons/react'
import { basename, dirname, isUnder, tildify } from '../lib/path'

interface Props {
  root: string
  recent: string[]
  openTabs: string[]
  onPick(path: string, newTab: boolean): void
  onClose(): void
}

/** Subsequence match; rewards consecutive runs and word starts. Returns matched indices or null. */
function fuzzy(query: string, text: string): { score: number; hits: number[] } | null {
  const t = text.toLowerCase()
  let ti = 0
  let score = 0
  let run = 0
  const hits: number[] = []
  for (const ch of query) {
    const i = t.indexOf(ch, ti)
    if (i < 0) return null
    run = i === ti && hits.length ? run + 1 : 0
    const boundary = i === 0 || /[\s/_\-.]/.test(t[i - 1])
    score += 1 + run * 3 + (boundary ? 4 : 0) - Math.min(i - ti, 8) * 0.25
    hits.push(i)
    ti = i + 1
  }
  return { score, hits }
}

function Highlighted({ text, hits }: { text: string; hits: number[] }) {
  const set = new Set(hits)
  return (
    <>
      {[...text].map((c, i) => (set.has(i) ? <mark key={i}>{c}</mark> : c))}
    </>
  )
}

export function QuickOpen({ root, recent, openTabs, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [pool, setPool] = useState<string[]>(() => [...new Set([...openTabs, ...recent])])
  const [loading, setLoading] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const add = (paths: string[]) => alive && setPool((p) => [...new Set([...p, ...paths])])
    Promise.all([window.api.walk(root).then(add), window.api.spotlight().then(add)]).finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [root])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '')
    if (!q) {
      const recentSet = [...new Set([...recent, ...openTabs])]
      return recentSet.slice(0, 30).map((path) => ({ path, nameHits: [] as number[] }))
    }
    const scored: { path: string; score: number; nameHits: number[] }[] = []
    for (const path of pool) {
      const name = basename(path)
      const n = fuzzy(q, name)
      // Matching against the whole path is too permissive for plain names, so only do it for "dir/name" queries.
      const p = !n && q.includes('/') ? fuzzy(q, tildify(path)) : null
      const s = n ? { score: n.score * 2, nameHits: n.hits } : p ? { score: p.score, nameHits: [] } : null
      if (!s) continue
      let score = s.score
      if (isUnder(path, root)) score += 6
      if (recent.includes(path)) score += 8
      score -= path.split('/').length * 0.15
      scored.push({ path, score, nameHits: s.nameHits })
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 60)
  }, [query, pool, recent, openTabs, root])

  useEffect(() => setIndex(0), [query])
  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }, [index])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="quick-open">
        <div className="qo-input">
          <MagnifyingGlass size={16} weight="bold" />
          <input
            autoFocus
            value={query}
            placeholder="Search Markdown files across your Mac…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && results[index]) {
                onPick(results[index].path, e.metaKey)
              } else if (e.key === 'Escape') onClose()
            }}
          />
          {loading && <span className="spinner" />}
        </div>
        <div className="qo-list" ref={listRef}>
          {results.map((r, i) => (
            <button
              key={r.path}
              className={`qo-item${i === index ? ' on' : ''}`}
              onMouseMove={() => setIndex(i)}
              onClick={(e) => onPick(r.path, e.metaKey)}
            >
              <FileText size={15} />
              <span className="qo-name">
                <Highlighted text={basename(r.path)} hits={r.nameHits} />
              </span>
              <span className="qo-dir">{tildify(dirname(r.path))}</span>
            </button>
          ))}
          {!results.length && <div className="tree-note">{query ? 'No files found' : 'Type to search'}</div>}
        </div>
        <div className="qo-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↩</kbd> open</span>
          <span><kbd>⌘</kbd><kbd>↩</kbd> new tab</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
