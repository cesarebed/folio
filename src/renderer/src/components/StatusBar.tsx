import { useMemo } from 'react'
import type { Tab } from '../types'
import { splitFrontmatter } from '../lib/markdown'

export function StatusBar({ tab }: { tab: Tab }) {
  const stats = useMemo(() => {
    const body = splitFrontmatter(tab.content).body
    const text = body.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`~\-[\]()!|]/g, ' ')
    const words = text.split(/\s+/).filter(Boolean).length
    return { words, chars: body.length, minutes: Math.max(1, Math.round(words / 220)) }
  }, [tab.content])

  const dirty = tab.content !== tab.saved
  const state = tab.saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'

  return (
    <footer className="statusbar">
      <span>{stats.words.toLocaleString('en-US')} words</span>
      <span>{stats.chars.toLocaleString('en-US')} characters</span>
      <span>{stats.minutes} min read</span>
      <span className="spacer" />
      <span className={`save-state${dirty ? ' dirty' : ''}`}>{state}</span>
    </footer>
  )
}
