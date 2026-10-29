import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  ArrowsInLineVertical,
  CaretRight,
  Cloud,
  Desktop,
  DownloadSimple,
  FileText,
  FolderSimple,
  FolderOpen,
  FolderSimplePlus,
  Folders,
  GearSix,
  House,
  MagnifyingGlass,
  NotePencil,
  PushPin,
  TreeStructure
} from '@phosphor-icons/react'
import type { Settings } from '../types'
import type { TreeState } from '../lib/useTree'
import { basename, dirname, isUnder, tildify } from '../lib/path'
import { SearchPanel } from './SearchPanel'
import { SettingsPanel } from './SettingsPanel'

interface Props {
  settings: Settings
  patchSettings(p: Partial<Settings> | ((s: Settings) => Partial<Settings>)): void
  locations: Location[]
  tree: TreeState
  activePath: string | null
  selectedDir: string | null
  setSelectedDir(d: string | null): void
  view: 'files' | 'search'
  setView(v: 'files' | 'search'): void
  searchToken: number
  onOpen(path: string, newTab: boolean, line?: number): void
  onNewNote(dir?: string): void
  onNewFolder(dir: string): Promise<string | null>
  onRename(path: string, name: string): Promise<string | null>
  onMove(path: string, toDir: string): void
  onTrash(path: string): void
  onOpenFolder(): void
}

const LOCATION_ICON: Record<string, typeof House> = {
  home: House,
  desktop: Desktop,
  documents: Folders,
  downloads: DownloadSimple,
  icloud: Cloud
}

interface Row {
  entry: Entry
  depth: number
}

export function Sidebar(props: Props) {
  const { settings, patchSettings, tree } = props
  const root = settings.root
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [locationsOpen, setLocationsOpen] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const expanded = useMemo(() => new Set(settings.expanded), [settings.expanded])

  const rows = useMemo(() => {
    const out: (Row | { loading: string; depth: number } | { error: string; depth: number })[] = []
    const walk = (dir: string, depth: number) => {
      if (tree.errors[dir]) out.push({ error: tree.errors[dir], depth })
      for (const entry of tree.children[dir] ?? []) {
        out.push({ entry, depth })
        if (entry.kind === 'dir' && expanded.has(entry.path)) {
          if (tree.children[entry.path]) walk(entry.path, depth + 1)
          else out.push({ loading: entry.path, depth: depth + 1 })
        }
      }
    }
    walk(root, 0)
    return out
  }, [tree.children, tree.errors, expanded, root])

  // reveal the active file: expand its ancestors and scroll it into view
  useEffect(() => {
    const p = props.activePath
    if (!p || !isUnder(p, root) || p === root) return
    const ancestors: string[] = []
    for (let d = dirname(p); d !== root && isUnder(d, root); d = dirname(d)) ancestors.push(d)
    const missing = ancestors.filter((a) => !expanded.has(a))
    if (missing.length) patchSettings((s) => ({ expanded: [...s.expanded, ...missing] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.activePath, root])

  useEffect(() => {
    const el = listRef.current?.querySelector('.row.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [props.activePath, rows.length])

  const toggleDir = (dir: string) =>
    patchSettings((s) => ({
      expanded: s.expanded.includes(dir) ? s.expanded.filter((x) => !isUnder(x, dir)) : [...s.expanded, dir]
    }))

  const setRoot = (dir: string) => {
    patchSettings({ root: dir })
    props.setSelectedDir(null)
    props.setView('files')
  }

  const contextMenu = async (e: React.MouseEvent, entry: Entry | null) => {
    e.preventDefault()
    e.stopPropagation()
    const path = entry?.path ?? root
    const isDir = !entry || entry.kind === 'dir'
    const pinned = settings.pinned.includes(path)
    const items: MenuItemSpec[] = isDir
      ? [
          { id: 'new-note', label: 'New Note' },
          { id: 'new-folder', label: 'New Folder' },
          { type: 'separator' },
          ...(entry ? [{ id: 'set-root', label: 'Open as Root' }] : []),
          { id: 'pin', label: pinned ? 'Remove from Favorites' : 'Add to Favorites' },
          { type: 'separator' },
          ...(entry ? [{ id: 'rename', label: 'Rename…' }] : []),
          { id: 'reveal', label: 'Reveal in Finder' },
          { id: 'copy', label: 'Copy Path' },
          ...(entry ? [{ type: 'separator' as const }, { id: 'trash', label: 'Move to Trash' }] : [])
        ]
      : [
          { id: 'open-tab', label: 'Open in New Tab' },
          { type: 'separator' },
          { id: 'rename', label: 'Rename…' },
          { id: 'reveal', label: 'Reveal in Finder' },
          { id: 'open-default', label: 'Open with Default App' },
          { id: 'copy', label: 'Copy Path' },
          { type: 'separator' },
          { id: 'trash', label: 'Move to Trash' }
        ]
    const choice = await window.api.popupMenu(items)
    switch (choice) {
      case 'new-note':
        if (entry && !expanded.has(path)) toggleDir(path)
        return props.onNewNote(path)
      case 'new-folder': {
        const created = await props.onNewFolder(path)
        if (created) setRenaming(created)
        return
      }
      case 'set-root':
        return setRoot(path)
      case 'pin':
        return patchSettings((s) => ({ pinned: pinned ? s.pinned.filter((p) => p !== path) : [...s.pinned, path] }))
      case 'rename':
        return setRenaming(path)
      case 'reveal':
        return window.api.reveal(path)
      case 'open-default':
        return window.api.openPath(path)
      case 'copy':
        return navigator.clipboard.writeText(path)
      case 'open-tab':
        return props.onOpen(path, true)
      case 'trash':
        return props.onTrash(path)
    }
  }

  const pinMenu = async (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    const choice = await window.api.popupMenu([
      { id: 'reveal', label: 'Reveal in Finder' },
      { id: 'unpin', label: 'Remove from Favorites' }
    ])
    if (choice === 'unpin') patchSettings((s) => ({ pinned: s.pinned.filter((p) => p !== path) }))
    if (choice === 'reveal') window.api.reveal(path)
  }

  const startResize = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startW = settings.sidebarWidth
    const move = (ev: MouseEvent) => {
      const w = Math.min(520, Math.max(200, startW + ev.clientX - startX))
      document.querySelector<HTMLElement>('.app')?.style.setProperty('--sidebar-width', `${w}px`)
    }
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      patchSettings({ sidebarWidth: Math.min(520, Math.max(200, startW + ev.clientX - startX)) })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const places = [
    ...props.locations.map((l) => ({ ...l, pinned: false })),
    ...settings.pinned.map((p) => ({ id: p, label: basename(p) || p, path: p, pinned: true }))
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="segmented small">
          <button className={props.view === 'files' ? 'on' : ''} onClick={() => props.setView('files')} title="Files">
            <TreeStructure size={15} weight="bold" />
          </button>
          <button className={props.view === 'search' ? 'on' : ''} onClick={() => props.setView('search')} title="Search in files (⌘⇧F)">
            <MagnifyingGlass size={15} weight="bold" />
          </button>
        </div>
        <div className="spacer" />
        <button className="icon-btn" onClick={() => props.onNewNote()} title="New note (⌘N)">
          <NotePencil size={16} weight="bold" />
        </button>
        <button
          className="icon-btn"
          onClick={async () => {
            const created = await props.onNewFolder(props.selectedDir ?? root)
            if (created) setRenaming(created)
          }}
          title="New folder"
        >
          <FolderSimplePlus size={16} weight="bold" />
        </button>
      </div>

      {props.view === 'search' ? (
        <SearchPanel root={root} focusToken={props.searchToken} onOpen={props.onOpen} />
      ) : (
        <>
          <section className="places">
            <button className="section-label" onClick={() => setLocationsOpen((o) => !o)}>
              <CaretRight size={10} weight="bold" className={`chev${locationsOpen ? ' open' : ''}`} />
              Locations
            </button>
            {locationsOpen &&
              places.map((pl) => {
                const Icon = pl.pinned ? PushPin : (LOCATION_ICON[pl.id] ?? FolderSimple)
                return (
                  <button
                    key={pl.id}
                    className={`place${root === pl.path ? ' active' : ''}`}
                    onClick={() => setRoot(pl.path)}
                    onContextMenu={pl.pinned ? (e) => pinMenu(e, pl.path) : undefined}
                    title={tildify(pl.path)}
                  >
                    <Icon size={15} weight={root === pl.path ? 'fill' : 'regular'} />
                    <span>{pl.label}</span>
                  </button>
                )
              })}
            {locationsOpen && (
              <button className="place muted" onClick={props.onOpenFolder}>
                <FolderOpen size={15} />
                <span>Open folder…</span>
              </button>
            )}
          </section>

          <div className="tree-head" onContextMenu={(e) => contextMenu(e, null)}>
            <button className="icon-btn" disabled={root === '/'} onClick={() => setRoot(dirname(root))} title="Parent folder">
              <ArrowUp size={14} weight="bold" />
            </button>
            <span className="tree-root" title={tildify(root)}>
              {basename(root) || 'Macintosh HD'}
            </span>
            <button
              className="icon-btn"
              onClick={() => patchSettings((s) => ({ expanded: s.expanded.filter((p) => !isUnder(p, root)) }))}
              title="Collapse all"
            >
              <ArrowsInLineVertical size={14} weight="bold" />
            </button>
          </div>

          <div
            className={`tree${dropTarget === root ? ' drop' : ''}`}
            ref={listRef}
            onContextMenu={(e) => contextMenu(e, null)}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('application/x-folio-path')) {
                e.preventDefault()
                setDropTarget(root)
              }
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => {
              const from = e.dataTransfer.getData('application/x-folio-path')
              setDropTarget(null)
              if (from) {
                e.preventDefault()
                e.stopPropagation()
                props.onMove(from, root)
              }
            }}
          >
            {!tree.isLoaded(root) && <div className="tree-note">Loading…</div>}
            {tree.isLoaded(root) && !rows.length && <div className="tree-note">No Markdown files here</div>}
            {rows.map((r, i) => {
              if ('loading' in r)
                return (
                  <div key={`l${r.loading}`} className="row ghost" style={{ paddingLeft: 12 + r.depth * 14 }}>
                    …
                  </div>
                )
              if ('error' in r)
                return (
                  <div key={`e${i}`} className="row ghost" style={{ paddingLeft: 12 + r.depth * 14 }}>
                    {r.error}
                  </div>
                )
              const { entry, depth } = r
              const isDir = entry.kind === 'dir'
              const open = isDir && expanded.has(entry.path)
              const active = entry.path === props.activePath
              const selected = isDir && entry.path === props.selectedDir
              return (
                <div
                  key={entry.path}
                  className={`row${active ? ' active' : ''}${selected ? ' selected' : ''}${dropTarget === entry.path ? ' drop' : ''}`}
                  style={{ paddingLeft: 8 + depth * 14 }}
                  draggable={renaming !== entry.path}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-folio-path', entry.path)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    if (isDir && e.dataTransfer.types.includes('application/x-folio-path')) {
                      e.preventDefault()
                      e.stopPropagation()
                      setDropTarget(entry.path)
                    }
                  }}
                  onDrop={(e) => {
                    if (!isDir) return
                    const from = e.dataTransfer.getData('application/x-folio-path')
                    setDropTarget(null)
                    if (from) {
                      e.preventDefault()
                      e.stopPropagation()
                      props.onMove(from, entry.path)
                    }
                  }}
                  onClick={(e) => {
                    if (renaming === entry.path) return
                    if (isDir) {
                      props.setSelectedDir(entry.path)
                      toggleDir(entry.path)
                    } else {
                      props.setSelectedDir(dirname(entry.path))
                      props.onOpen(entry.path, e.metaKey)
                    }
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1 && !isDir) props.onOpen(entry.path, true)
                  }}
                  onContextMenu={(e) => contextMenu(e, entry)}
                  title={tildify(entry.path)}
                >
                  {isDir ? (
                    <CaretRight size={10} weight="bold" className={`chev${open ? ' open' : ''}`} />
                  ) : (
                    <span className="chev-space" />
                  )}
                  {isDir ? (
                    <FolderSimple size={15} weight={open ? 'fill' : 'regular'} className="row-icon dir" />
                  ) : (
                    <FileText size={15} weight={active ? 'fill' : 'regular'} className="row-icon" />
                  )}
                  {renaming === entry.path ? (
                    <RenameInput
                      initial={entry.name}
                      isFile={!isDir}
                      onDone={async (name) => {
                        setRenaming(null)
                        if (name && name !== entry.name) await props.onRename(entry.path, name)
                      }}
                    />
                  ) : (
                    <span className="row-name">{isDir ? entry.name : entry.name.replace(/\.(md|markdown|mdown|mkdn?|mdx)$/i, '')}</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="sidebar-bottom">
        <button className="icon-btn" onClick={() => setShowSettings((s) => !s)} title="Settings">
          <GearSix size={16} weight="bold" />
        </button>
        <span className="sidebar-path" title={root}>
          {tildify(root)}
        </span>
      </div>
      {showSettings && <SettingsPanel settings={settings} patchSettings={patchSettings} onClose={() => setShowSettings(false)} />}
      <div className="resizer" onMouseDown={startResize} />
    </aside>
  )
}

function RenameInput({ initial, isFile, onDone }: { initial: string; isFile: boolean; onDone(name: string | null): void }) {
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = isFile ? initial.lastIndexOf('.') : -1
    el.setSelectionRange(0, dot > 0 ? dot : initial.length)
  }, [initial, isFile])
  const finish = (v: string | null) => {
    if (done.current) return
    done.current = true
    onDone(v)
  }
  return (
    <input
      ref={ref}
      className="rename"
      defaultValue={initial}
      spellCheck={false}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => finish(e.target.value.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish((e.target as HTMLInputElement).value.trim())
        if (e.key === 'Escape') finish(null)
      }}
    />
  )
}
