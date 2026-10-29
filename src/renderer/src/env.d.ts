/// <reference types="vite/client" />

declare module 'markdown-it-footnote'
declare module 'markdown-it-task-lists'

interface Entry {
  name: string
  path: string
  kind: 'dir' | 'file'
}

interface Location {
  id: string
  label: string
  path: string
}

interface ContentHit {
  path: string
  matches: { line: number; text: string }[]
}

interface MenuItemSpec {
  id?: string
  label?: string
  type?: 'separator'
  enabled?: boolean
}

interface Window {
  api: {
    info(): Promise<{ home: string; locations: Location[]; pendingOpen: string[] }>
    storeGet(): Promise<Record<string, any>>
    storeSet(patch: Record<string, unknown>): Promise<void>
    readDir(dir: string, showHidden: boolean): Promise<Entry[]>
    readFile(p: string): Promise<{ content: string; realPath: string; mtime: number }>
    writeFile(p: string, content: string): Promise<number>
    exists(p: string): Promise<boolean>
    createFile(dir: string, base: string): Promise<string>
    createFolder(dir: string, base: string): Promise<string>
    rename(from: string, newName: string): Promise<string>
    move(from: string, toDir: string): Promise<string>
    trash(p: string): Promise<void>
    reveal(p: string): Promise<void>
    openExternal(url: string): Promise<void>
    openPath(p: string): Promise<string>
    openFolderDialog(): Promise<string | null>
    openFilesDialog(): Promise<string[]>
    saveAsDialog(defaultPath: string): Promise<string | null>
    spotlight(): Promise<string[]>
    walk(root: string): Promise<string[]>
    searchContent(root: string, query: string): Promise<ContentHit[]>
    setWatched(dirs: string[]): Promise<void>
    popupMenu(items: MenuItemSpec[]): Promise<string | null>
    setTheme(mode: 'system' | 'light' | 'dark'): Promise<void>
    pathForFile(f: File): string
    flushed(): void
    onMenu(fn: (cmd: string) => void): () => void
    onOpenPaths(fn: (paths: string[]) => void): () => void
    onFsChanged(fn: (path: string) => void): () => void
    onFlush(fn: () => void): () => void
  }
}
