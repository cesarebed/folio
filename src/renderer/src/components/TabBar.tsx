import { useState } from 'react'
import { Plus, SidebarSimple, X } from '@phosphor-icons/react'
import type { Tab } from '../types'
import { basename, stem, tildify } from '../lib/path'

interface Props {
  tabs: Tab[]
  activeId: string | null
  sidebarOpen: boolean
  onActivate(id: string): void
  onClose(id: string): void
  onNew(): void
  onReorder(tabs: Tab[]): void
  onToggleSidebar(): void
  onCloseOthers(id: string): void
}

export function TabBar(props: Props) {
  const [dragId, setDragId] = useState<string | null>(null)

  const menu = async (e: React.MouseEvent, tab: Tab) => {
    e.preventDefault()
    const choice = await window.api.popupMenu([
      { id: 'close', label: 'Close Tab' },
      { id: 'others', label: 'Close Other Tabs', enabled: props.tabs.length > 1 },
      { type: 'separator' },
      { id: 'reveal', label: 'Reveal in Finder', enabled: !!tab.path },
      { id: 'copy', label: 'Copy Path', enabled: !!tab.path }
    ])
    if (choice === 'close') props.onClose(tab.id)
    if (choice === 'others') props.onCloseOthers(tab.id)
    if (choice === 'reveal' && tab.path) window.api.reveal(tab.path)
    if (choice === 'copy' && tab.path) navigator.clipboard.writeText(tab.path)
  }

  return (
    <div className={`tabbar${props.sidebarOpen ? '' : ' inset'}`} onDoubleClick={(e) => e.target === e.currentTarget && props.onNew()}>
      <button className="icon-btn sidebar-toggle" onClick={props.onToggleSidebar} title="Sidebar (⌘\)">
        <SidebarSimple size={16} weight="bold" />
      </button>
      <div className="tabs" onDoubleClick={(e) => e.target === e.currentTarget && props.onNew()}>
        {props.tabs.map((t) => {
          const dirty = t.content !== t.saved
          const title = t.path ? stem(t.path) || basename(t.path) : 'New Tab'
          return (
            <div
              key={t.id}
              className={`tab${t.id === props.activeId ? ' active' : ''}${dragId === t.id ? ' dragging' : ''}`}
              title={t.path ? tildify(t.path) : ''}
              draggable
              onDragStart={(e) => {
                setDragId(t.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('application/x-folio-tab', t.id)
              }}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => {
                if (!dragId || dragId === t.id) return
                e.preventDefault()
                const from = props.tabs.findIndex((x) => x.id === dragId)
                const to = props.tabs.findIndex((x) => x.id === t.id)
                const next = [...props.tabs]
                const [moved] = next.splice(from, 1)
                next.splice(to, 0, moved)
                props.onReorder(next)
              }}
              onMouseDown={(e) => e.button === 0 && props.onActivate(t.id)}
              onAuxClick={(e) => e.button === 1 && props.onClose(t.id)}
              onContextMenu={(e) => menu(e, t)}
            >
              <span className="tab-title">{title}</span>
              <button
                className={`tab-close${dirty ? ' dirty' : ''}`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => props.onClose(t.id)}
                title="Close (⌘W)"
              >
                <X size={11} weight="bold" className="x" />
                <span className="dot" />
              </button>
            </div>
          )
        })}
        <button className="icon-btn new-tab" onClick={props.onNew} title="New tab (⌘T)">
          <Plus size={14} weight="bold" />
        </button>
      </div>
    </div>
  )
}
