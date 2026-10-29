export type Mode = 'read' | 'edit'

export interface Tab {
  id: string
  path: string | null
  realPath: string | null
  content: string
  saved: string
  /** Bumped whenever content changes from outside the editor (load, reload, task toggle). */
  rev: number
  mode: Mode
  back: string[]
  fwd: string[]
  status: 'empty' | 'loading' | 'ready' | 'error'
  error?: string
  saving?: boolean
  /** Scroll target applied once the document is shown (source line or heading id). */
  pending?: { line?: number; anchor?: string; focusTitle?: boolean } | null
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  readerFont: 'sans' | 'serif'
  fontSize: number
  width: 'narrow' | 'wide' | 'full'
  showHidden: boolean
  defaultMode: Mode
  sidebarOpen: boolean
  sidebarWidth: number
  outlineOpen: boolean
  root: string
  pinned: string[]
  expanded: string[]
  recent: string[]
}

export const DEFAULT_SETTINGS: Omit<Settings, 'root'> = {
  theme: 'system',
  readerFont: 'sans',
  fontSize: 17,
  width: 'narrow',
  showHidden: false,
  defaultMode: 'read',
  sidebarOpen: true,
  sidebarWidth: 270,
  outlineOpen: false,
  pinned: [],
  expanded: [],
  recent: []
}

let n = 0
export const newId = () => `t${Date.now().toString(36)}${(n++).toString(36)}`

export const emptyTab = (): Tab => ({
  id: newId(),
  path: null,
  realPath: null,
  content: '',
  saved: '',
  rev: 0,
  mode: 'read',
  back: [],
  fwd: [],
  status: 'empty'
})
