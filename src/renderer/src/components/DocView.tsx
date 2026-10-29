import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpenText, PencilSimpleLine, ListBullets, CaretRight } from '@phosphor-icons/react'
import type { Tab } from '../types'
import { Reader, type ReaderHandle } from './Reader'
import { Editor, type EditorHandle } from './Editor'
import { FindBar } from './FindBar'
import { basename, dirname, isMarkdownPath, join, normalize, stem, tildify } from '../lib/path'
import { isMarkdownLink } from '../lib/markdown'

export interface DocHandle {
  getTopLine(): number
  scrollToLine(line: number): void
  scrollToAnchor(id: string): void
  find(): void
}

interface Props {
  tab: Tab
  dark: boolean
  outlineOpen: boolean
  onChange(id: string, doc: string): void
  onToggleMode(): void
  onToggleOutline(): void
  onBack(): void
  onForward(): void
  onOpenLink(path: string, opts: { newTab?: boolean; anchor?: string }): void
  onWikilink(target: string, newTab: boolean): void
  onToggleTask(line: number): void
  onRenameTitle(name: string): Promise<void>
  onPendingDone(): void
  onTopLine(line: number): void
  onNavigateDir(dir: string): void
}


export const DocView = forwardRef<DocHandle, Props>(function DocView(props, ref) {
  const { tab } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<ReaderHandle>(null)
  const editorRef = useRef<EditorHandle>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const scrollMemory = useRef(new Map<string, number>())
  const [findOpen, setFindOpen] = useState(false)
  const [title, setTitle] = useState(tab.path ? stem(tab.path) : '')

  const baseDir = tab.realPath ? dirname(tab.realPath) : '/'
  const readMode = tab.mode === 'read'
  const memKey = `${tab.id}:${tab.path}:${tab.mode}`

  useEffect(() => setTitle(tab.path ? stem(tab.path) : ''), [tab.path])

  const getTopLine = () => (readMode ? readerRef.current?.getTopLine() : editorRef.current?.getTopLine()) ?? 0
  const scrollToLine = (line: number) => (readMode ? readerRef.current?.scrollToLine(line) : editorRef.current?.scrollToLine(line))

  useImperativeHandle(ref, () => ({
    getTopLine,
    scrollToLine,
    scrollToAnchor: (id) => readerRef.current?.scrollToAnchor(id),
    find: () => {
      if (readMode) setFindOpen(true)
      else editorRef.current?.openSearch()
    }
  }))

  // restore scroll per tab+mode, or apply a pending jump
  useLayoutEffect(() => {
    if (tab.status !== 'ready') return
    const el = scrollRef.current
    if (!el) return
    const p = tab.pending
    if (p) {
      requestAnimationFrame(() => {
        if (p.anchor) readerRef.current?.scrollToAnchor(p.anchor)
        else if (p.line != null) scrollToLine(p.line)
        else el.scrollTop = 0
        if (p.focusTitle && titleRef.current) {
          titleRef.current.focus()
          titleRef.current.select()
        }
        props.onPendingDone()
      })
    } else {
      el.scrollTop = scrollMemory.current.get(memKey) ?? 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memKey, tab.status, tab.pending])

  useEffect(() => setFindOpen(false), [tab.id, tab.mode])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    scrollMemory.current.set(memKey, el.scrollTop)
    props.onTopLine(getTopLine())
  }

  const handleLink = (href: string, newTab: boolean) => {
    if (href.startsWith('#')) return readerRef.current?.scrollToAnchor(decodeURIComponent(href.slice(1)))
    if (/^(https?|mailto):/i.test(href)) return window.api.openExternal(href)
    let raw = href.replace(/^file:\/\//i, '')
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return
    const [pathPart, anchor] = raw.split('#')
    try {
      raw = decodeURI(pathPart)
    } catch {
      raw = pathPart
    }
    const abs = raw.startsWith('/') ? normalize(raw) : join(baseDir, raw)
    if (isMarkdownLink(abs) || isMarkdownPath(abs)) props.onOpenLink(abs, { newTab, anchor: anchor ? decodeURIComponent(anchor) : undefined })
    else window.api.openPath(abs)
  }

  const commitTitle = async () => {
    if (!tab.path) return
    if (title.trim() && title.trim() !== stem(tab.path)) await props.onRenameTitle(title.trim())
    else setTitle(stem(tab.path))
  }

  const crumbs = tab.path ? tildify(dirname(tab.path)).split('/').filter(Boolean) : []
  const crumbPath = (i: number) => {
    const parts = dirname(tab.path!).split('/')
    const offset = parts.length - crumbs.length
    return parts.slice(0, offset + i + 1).join('/') || '/'
  }

  return (
    <section className="doc">
      <header className="doc-header">
        <div className="doc-nav">
          <button className="icon-btn" disabled={!tab.back.length} onClick={props.onBack} title="Back (⌘[)">
            <ArrowLeft size={15} weight="bold" />
          </button>
          <button className="icon-btn" disabled={!tab.fwd.length} onClick={props.onForward} title="Forward (⌘])">
            <ArrowRight size={15} weight="bold" />
          </button>
        </div>
        <nav className="crumbs" title={tab.path ?? ''}>
          {crumbs.map((c, i) => (
            <span key={i} className="crumb-wrap">
              <button className="crumb" onClick={() => props.onNavigateDir(crumbPath(i))}>
                {c}
              </button>
              <CaretRight size={10} weight="bold" className="crumb-sep" />
            </span>
          ))}
          <span className="crumb current">{tab.path ? basename(tab.path) : ''}</span>
        </nav>
        <div className="doc-actions">
          <div className="segmented" role="tablist">
            <button className={readMode ? 'on' : ''} onClick={() => !readMode && props.onToggleMode()} title="Read (⌘E)">
              <BookOpenText size={14} weight="bold" />
              Read
            </button>
            <button className={!readMode ? 'on' : ''} onClick={() => readMode && props.onToggleMode()} title="Edit (⌘E)">
              <PencilSimpleLine size={14} weight="bold" />
              Edit
            </button>
          </div>
          <button
            className={`icon-btn${props.outlineOpen ? ' on' : ''}`}
            onClick={props.onToggleOutline}
            title="Outline (⌘⇧\)"
          >
            <ListBullets size={16} weight="bold" />
          </button>
        </div>
      </header>

      {findOpen && readMode && <FindBar scope={() => readerRef.current?.element() ?? null} onClose={() => setFindOpen(false)} />}

      <div className="doc-scroll" ref={scrollRef} onScroll={onScroll}>
        {tab.status === 'loading' && <div className="doc-state">Opening…</div>}
        {tab.status === 'error' && (
          <div className="doc-state error">
            <strong>{tab.error}</strong>
            <span>{tab.path && tildify(tab.path)}</span>
          </div>
        )}
        {tab.status === 'ready' && (
          <div className="page">
            {readMode ? (
              <Reader
                ref={readerRef}
                content={tab.content}
                baseDir={baseDir}
                dark={props.dark}
                scroller={scrollRef}
                onLink={handleLink}
                onWikilink={props.onWikilink}
                onToggleTask={props.onToggleTask}
              />
            ) : (
              <>
                <input
                  ref={titleRef}
                  className="inline-title"
                  value={title}
                  spellCheck={false}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      editorRef.current?.focus()
                    } else if (e.key === 'Escape') {
                      setTitle(stem(tab.path!))
                      editorRef.current?.focus()
                    }
                  }}
                />
                <Editor
                  ref={editorRef}
                  tabId={tab.id}
                  content={tab.content}
                  rev={tab.rev}
                  scroller={scrollRef}
                  onChange={props.onChange}
                />
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
})
