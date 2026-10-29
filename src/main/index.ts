import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  protocol,
  net,
  nativeTheme,
  type MenuItemConstructorOptions
} from 'electron'
import { join, dirname, basename, extname, sep } from 'node:path'
import { promises as fsp, watch, existsSync, type FSWatcher } from 'node:fs'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const MD_EXT = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx', '.textbundle'])
const PACKAGE_EXT = new Set(['.app', '.photoslibrary', '.bundle', '.framework', '.musiclibrary', '.tvlibrary', '.xcodeproj', '.xcworkspace', '.pkg', '.plugin', '.kext', '.photolibrary', '.imovielibrary', '.fcpbundle', '.logicx', '.band'])
const SKIP_DIRS = new Set(['node_modules', '__pycache__', '.git'])
const HOME = homedir()
const ICLOUD = join(HOME, 'Library', 'Mobile Documents', 'com~apple~CloudDocs')

protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
])

if (process.env.FOLIO_USER_DATA) app.setPath('userData', process.env.FOLIO_USER_DATA)

let win: BrowserWindow | null = null
const pendingOpen: string[] = []

/* ---------- settings store ---------- */

const storePath = () => join(app.getPath('userData'), 'settings.json')
let store: Record<string, unknown> = {}
let storeTimer: NodeJS.Timeout | null = null

async function loadStore() {
  try {
    store = JSON.parse(await fsp.readFile(storePath(), 'utf8'))
  } catch {
    store = {}
  }
}

function saveStore() {
  if (storeTimer) clearTimeout(storeTimer)
  storeTimer = setTimeout(() => {
    fsp.mkdir(dirname(storePath()), { recursive: true })
      .then(() => fsp.writeFile(storePath(), JSON.stringify(store, null, 2)))
      .catch(() => {})
  }, 300)
}

/* ---------- file system ---------- */

const isMarkdown = (p: string) => MD_EXT.has(extname(p).toLowerCase())

function isNoisyPath(p: string) {
  return (
    p.includes(`${sep}node_modules${sep}`) ||
    p.includes(`${sep}.`) ||
    (p.includes(`${sep}Library${sep}`) && !p.startsWith(ICLOUD)) ||
    p.startsWith('/System/') ||
    p.startsWith('/private/') ||
    p.includes('.app/')
  )
}

interface Entry {
  name: string
  path: string
  kind: 'dir' | 'file'
}

async function readDir(dir: string, showHidden: boolean): Promise<Entry[]> {
  const dirents = await fsp.readdir(dir, { withFileTypes: true })
  const out: Entry[] = []
  for (const d of dirents) {
    if (!showHidden && d.name.startsWith('.')) continue
    if (SKIP_DIRS.has(d.name)) continue
    if (dir === HOME && d.name === 'Library' && !showHidden) continue
    const full = join(dir, d.name)
    let isDir = d.isDirectory()
    if (d.isSymbolicLink()) {
      try {
        isDir = (await fsp.stat(full)).isDirectory()
      } catch {
        continue
      }
    }
    const ext = extname(d.name).toLowerCase()
    if (isDir) {
      if (ext === '.textbundle') out.push({ name: d.name, path: full, kind: 'file' })
      else if (!PACKAGE_EXT.has(ext)) out.push({ name: d.name, path: full, kind: 'dir' })
    } else if (isMarkdown(d.name)) {
      out.push({ name: d.name, path: full, kind: 'file' })
    }
  }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return out.sort((a, b) => (a.kind === b.kind ? collator.compare(a.name, b.name) : a.kind === 'dir' ? -1 : 1))
}

/** A .textbundle is a folder: the document lives in text.md / text.markdown inside it. */
async function resolveDoc(p: string): Promise<string> {
  if (extname(p).toLowerCase() !== '.textbundle') return p
  for (const name of ['text.md', 'text.markdown', 'text.txt']) {
    const candidate = join(p, name)
    if (existsSync(candidate)) return candidate
  }
  return join(p, 'text.md')
}

async function uniquePath(dir: string, base: string, ext: string) {
  let candidate = join(dir, `${base}${ext}`)
  let i = 2
  while (existsSync(candidate)) candidate = join(dir, `${base} ${i++}${ext}`)
  return candidate
}

/* ---------- Spotlight ---------- */

function mdfind(args: string[], timeoutMs = 15000): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn('mdfind', args)
    let buf = ''
    const timer = setTimeout(() => proc.kill(), timeoutMs)
    proc.stdout.on('data', (d) => (buf += d))
    proc.on('error', () => resolve([]))
    proc.on('close', () => {
      clearTimeout(timer)
      resolve(buf.split('\n').filter(Boolean))
    })
  })
}

let spotlightCache: string[] | null = null
let spotlightPending: Promise<string[]> | null = null

function refreshSpotlight() {
  if (!spotlightPending) {
    const query = [...MD_EXT].map((e) => `kMDItemFSName == "*${e}"c`).join(' || ')
    spotlightPending = mdfind([query]).then((paths) => {
      spotlightCache = paths.filter((p) => !isNoisyPath(p)).slice(0, 60000)
      spotlightPending = null
      return spotlightCache
    })
  }
  return spotlightPending
}

async function walkMarkdown(root: string, limit: number, deadline: number): Promise<string[]> {
  const out: string[] = []
  const queue = [root]
  while (queue.length && out.length < limit && Date.now() < deadline) {
    const dir = queue.shift()!
    let entries
    try {
      entries = await readDir(dir, false)
    } catch {
      continue
    }
    for (const e of entries) {
      if (e.kind === 'dir') queue.push(e.path)
      else out.push(e.path)
    }
  }
  return out
}

interface ContentHit {
  path: string
  matches: { line: number; text: string }[]
}

async function searchContent(root: string, query: string): Promise<ContentHit[]> {
  const q = query.toLowerCase()
  const fromSpotlight = (await mdfind(['-onlyin', root, query], 8000)).filter((p) => isMarkdown(p) && !isNoisyPath(p))
  let candidates = fromSpotlight
  if (candidates.length < 5) {
    const walked = await walkMarkdown(root, 4000, Date.now() + 4000)
    candidates = [...new Set([...fromSpotlight, ...walked])]
  }
  const hits: ContentHit[] = []
  for (const p of candidates) {
    if (hits.length >= 200) break
    try {
      const real = await resolveDoc(p)
      const stat = await fsp.stat(real)
      if (stat.size > 2_000_000) continue
      const text = await fsp.readFile(real, 'utf8')
      const nameHit = basename(p).toLowerCase().includes(q)
      if (!nameHit && !text.toLowerCase().includes(q)) continue
      const matches: ContentHit['matches'] = []
      const lines = text.split('\n')
      for (let i = 0; i < lines.length && matches.length < 6; i++) {
        if (lines[i].toLowerCase().includes(q)) matches.push({ line: i, text: lines[i].slice(0, 240) })
      }
      hits.push({ path: p, matches })
    } catch {
      /* unreadable, skip */
    }
  }
  return hits
}

/* ---------- watchers ---------- */

const watchers = new Map<string, FSWatcher>()
const changeTimers = new Map<string, NodeJS.Timeout>()

function emitChange(full: string) {
  if (isNoisyPath(full)) return
  const prev = changeTimers.get(full)
  if (prev) clearTimeout(prev)
  changeTimers.set(
    full,
    setTimeout(() => {
      changeTimers.delete(full)
      win?.webContents.send('fs:changed', full)
    }, 200)
  )
}

function setWatchedDirs(dirs: string[]) {
  const wanted = new Set(dirs)
  for (const [dir, w] of watchers) {
    if (!wanted.has(dir)) {
      w.close()
      watchers.delete(dir)
    }
  }
  for (const dir of wanted) {
    if (watchers.has(dir) || !existsSync(dir)) continue
    try {
      // The tree root is watched recursively (FSEvents on macOS is cheap); other dirs shallowly.
      const recursive = dir === dirs[0]
      const w = watch(dir, { recursive }, (_event, filename) => {
        if (filename) emitChange(join(dir, filename.toString()))
      })
      w.on('error', () => {
        w.close()
        watchers.delete(dir)
      })
      watchers.set(dir, w)
    } catch {
      /* permission denied etc. */
    }
  }
}

/* ---------- IPC ---------- */

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    home: HOME,
    locations: [
      { id: 'home', label: 'Inizio', path: HOME },
      { id: 'desktop', label: 'Scrivania', path: join(HOME, 'Desktop') },
      { id: 'documents', label: 'Documenti', path: join(HOME, 'Documents') },
      { id: 'downloads', label: 'Download', path: join(HOME, 'Downloads') },
      ...(existsSync(ICLOUD) ? [{ id: 'icloud', label: 'iCloud Drive', path: ICLOUD }] : [])
    ],
    pendingOpen: pendingOpen.splice(0)
  }))

  ipcMain.handle('store:get', () => store)
  ipcMain.handle('store:set', (_e, patch: Record<string, unknown>) => {
    Object.assign(store, patch)
    saveStore()
  })

  ipcMain.handle('fs:readDir', (_e, dir: string, showHidden: boolean) => readDir(dir, showHidden))
  ipcMain.handle('fs:readFile', async (_e, p: string) => {
    const real = await resolveDoc(p)
    const [content, stat] = await Promise.all([fsp.readFile(real, 'utf8'), fsp.stat(real)])
    return { content, realPath: real, mtime: stat.mtimeMs }
  })
  ipcMain.handle('fs:writeFile', async (_e, p: string, content: string) => {
    await fsp.writeFile(p, content, 'utf8')
    return (await fsp.stat(p)).mtimeMs
  })
  ipcMain.handle('fs:exists', (_e, p: string) => existsSync(p))
  ipcMain.handle('fs:createFile', async (_e, dir: string, base: string) => {
    const p = await uniquePath(dir, base, '.md')
    await fsp.writeFile(p, '', { flag: 'wx' })
    return p
  })
  ipcMain.handle('fs:createFolder', async (_e, dir: string, base: string) => {
    const p = await uniquePath(dir, base, '')
    await fsp.mkdir(p)
    return p
  })
  ipcMain.handle('fs:rename', async (_e, from: string, newName: string) => {
    const to = join(dirname(from), newName)
    if (to !== from && existsSync(to)) throw new Error(`Esiste già "${newName}"`)
    await fsp.rename(from, to)
    return to
  })
  ipcMain.handle('fs:move', async (_e, from: string, toDir: string) => {
    const to = join(toDir, basename(from))
    if (existsSync(to)) throw new Error(`Esiste già "${basename(from)}" in quella cartella`)
    await fsp.rename(from, to)
    return to
  })
  ipcMain.handle('fs:trash', (_e, p: string) => shell.trashItem(p))
  ipcMain.handle('shell:reveal', (_e, p: string) => shell.showItemInFolder(p))
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (/^(https?|mailto):/i.test(url)) return shell.openExternal(url)
  })
  ipcMain.handle('shell:openPath', (_e, p: string) => shell.openPath(p))

  ipcMain.handle('dialog:openFolder', async () => {
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('dialog:openFiles', async () => {
    const r = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Markdown', extensions: [...MD_EXT].map((e) => e.slice(1)).concat('txt') }]
    })
    return r.canceled ? [] : r.filePaths
  })
  ipcMain.handle('dialog:saveAs', async (_e, defaultPath: string) => {
    const r = await dialog.showSaveDialog(win!, { defaultPath, filters: [{ name: 'Markdown', extensions: ['md'] }] })
    return r.canceled ? null : r.filePath
  })

  ipcMain.handle('search:spotlight', async () => {
    if (spotlightCache) {
      refreshSpotlight()
      return spotlightCache
    }
    return refreshSpotlight()
  })
  ipcMain.handle('search:walk', (_e, root: string) => walkMarkdown(root, 8000, Date.now() + 3000))
  ipcMain.handle('search:content', (_e, root: string, query: string) => searchContent(root, query))

  ipcMain.handle('watch:set', (_e, dirs: string[]) => setWatchedDirs(dirs))

  ipcMain.handle('menu:popup', (e, items: { id?: string; label?: string; type?: 'separator'; enabled?: boolean }[]) => {
    return new Promise<string | null>((resolve) => {
      let done = false
      const finish = (v: string | null) => {
        if (!done) {
          done = true
          resolve(v)
        }
      }
      const menu = Menu.buildFromTemplate(
        items.map((it) =>
          it.type === 'separator'
            ? { type: 'separator' as const }
            : { label: it.label, enabled: it.enabled !== false, click: () => finish(it.id ?? null) }
        )
      )
      menu.popup({
        window: BrowserWindow.fromWebContents(e.sender) ?? undefined,
        callback: () => setTimeout(() => finish(null), 50)
      })
    })
  })

  ipcMain.handle('theme:set', (_e, mode: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = mode
  })

  ipcMain.on('app:flushed', () => finishClose())
}

/* ---------- menu ---------- */

function buildMenu() {
  const send = (cmd: string) => () => win?.webContents.send('menu', cmd)
  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        { label: 'Nuova nota', accelerator: 'CmdOrCtrl+N', click: send('new-note') },
        { label: 'Nuova tab', accelerator: 'CmdOrCtrl+T', click: send('new-tab') },
        { type: 'separator' },
        { label: 'Apri file…', accelerator: 'CmdOrCtrl+O', click: send('open-file') },
        { label: 'Apri cartella…', accelerator: 'CmdOrCtrl+Shift+O', click: send('open-folder') },
        { label: 'Apertura rapida…', accelerator: 'CmdOrCtrl+P', click: send('quick-open') },
        { type: 'separator' },
        { label: 'Salva', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: 'Salva con nome…', accelerator: 'CmdOrCtrl+Shift+S', click: send('save-as') },
        { label: 'Mostra nel Finder', accelerator: 'CmdOrCtrl+Alt+R', click: send('reveal') },
        { type: 'separator' },
        { label: 'Chiudi tab', accelerator: 'CmdOrCtrl+W', click: send('close-tab') },
        { label: 'Riapri tab chiusa', accelerator: 'CmdOrCtrl+Shift+T', click: send('reopen-tab') }
      ]
    },
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo', label: 'Annulla' },
        { role: 'redo', label: 'Ripeti' },
        { type: 'separator' },
        { role: 'cut', label: 'Taglia' },
        { role: 'copy', label: 'Copia' },
        { role: 'paste', label: 'Incolla' },
        { role: 'selectAll', label: 'Seleziona tutto' },
        { type: 'separator' },
        { label: 'Trova nel documento', accelerator: 'CmdOrCtrl+F', click: send('find') },
        { label: 'Cerca nei file', accelerator: 'CmdOrCtrl+Shift+F', click: send('search') }
      ]
    },
    {
      label: 'Vista',
      submenu: [
        { label: 'Lettura / Modifica', accelerator: 'CmdOrCtrl+E', click: send('toggle-mode') },
        { label: 'Barra laterale', accelerator: 'CmdOrCtrl+\\', click: send('toggle-sidebar') },
        { label: 'Indice del documento', accelerator: 'CmdOrCtrl+Shift+\\', click: send('toggle-outline') },
        { type: 'separator' },
        { label: 'Ingrandisci testo', accelerator: 'CmdOrCtrl+=', click: send('font-up') },
        { label: 'Riduci testo', accelerator: 'CmdOrCtrl+-', click: send('font-down') },
        { label: 'Dimensione predefinita', accelerator: 'CmdOrCtrl+0', click: send('font-reset') },
        { type: 'separator' },
        { label: 'Indietro', accelerator: 'CmdOrCtrl+[', click: send('back') },
        { label: 'Avanti', accelerator: 'CmdOrCtrl+]', click: send('forward') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Schermo intero' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' as const }])
      ]
    },
    {
      label: 'Finestra',
      submenu: [
        { label: 'Tab successiva', accelerator: 'Ctrl+Tab', click: send('next-tab') },
        { label: 'Tab precedente', accelerator: 'Ctrl+Shift+Tab', click: send('prev-tab') },
        { type: 'separator' },
        { role: 'minimize', label: 'Contrai' },
        { role: 'zoom', label: 'Ridimensiona' },
        { role: 'close', label: 'Chiudi finestra', accelerator: 'CmdOrCtrl+Shift+W' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* ---------- window ---------- */

let closing = false
let quitting = false
let flushTimer: NodeJS.Timeout | null = null

app.on('before-quit', () => {
  quitting = true
})

function finishClose() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  if (closing || !win) return
  closing = true
  win.close()
  // Closing was deferred to save pending edits, which cancels a quit in progress: resume it.
  if (quitting) app.quit()
}

function createWindow() {
  const bounds = store.bounds as Electron.Rectangle | undefined
  const theme = (store.theme as 'system' | 'light' | 'dark') ?? 'system'
  nativeTheme.themeSource = theme
  win = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 820,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 640,
    minHeight: 420,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      spellcheck: true
    }
  })

  win.once('ready-to-show', () => win?.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win?.webContents.getURL()) {
      e.preventDefault()
      if (/^(https?|mailto):/i.test(url)) shell.openExternal(url)
    }
  })

  const persistBounds = () => {
    if (win && !win.isFullScreen() && !win.isMinimized()) {
      store.bounds = win.getBounds()
      saveStore()
    }
  }
  win.on('resize', persistBounds)
  win.on('move', persistBounds)

  // Give the renderer a chance to save pending edits before the window goes away.
  win.on('close', (e) => {
    if (closing) return
    e.preventDefault()
    win?.webContents.send('app:flush')
    flushTimer = setTimeout(finishClose, 1500)
  })
  win.on('closed', () => {
    win = null
    closing = false
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function openPaths(paths: string[]) {
  const docs = paths.filter((p) => existsSync(p))
  if (!docs.length) return
  if (win && !win.webContents.isLoading()) win.webContents.send('open-paths', docs)
  else pendingOpen.push(...docs)
}

app.on('open-file', (e, p) => {
  e.preventDefault()
  openPaths([p])
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    openPaths(argv.slice(1).filter((a) => !a.startsWith('-')))
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    await loadStore()
    protocol.handle('local', (req) => {
      const p = decodeURIComponent(new URL(req.url).pathname)
      return net.fetch(pathToFileURL(p).toString())
    })
    registerIpc()
    buildMenu()
    if (app.isPackaged) openPaths(process.argv.slice(1).filter((a) => !a.startsWith('-') && isMarkdown(a)))
    createWindow()
    app.on('activate', () => {
      if (!win) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    for (const w of watchers.values()) w.close()
    watchers.clear()
    if (process.platform !== 'darwin') app.quit()
  })
}
