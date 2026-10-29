import { contextBridge, ipcRenderer, webUtils } from 'electron'

const invoke = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

function on(channel: string, fn: (...args: any[]) => void) {
  const listener = (_e: unknown, ...args: unknown[]) => fn(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  info: invoke('app:info'),
  storeGet: invoke('store:get'),
  storeSet: invoke('store:set'),
  readDir: invoke('fs:readDir'),
  readFile: invoke('fs:readFile'),
  writeFile: invoke('fs:writeFile'),
  exists: invoke('fs:exists'),
  createFile: invoke('fs:createFile'),
  createFolder: invoke('fs:createFolder'),
  rename: invoke('fs:rename'),
  move: invoke('fs:move'),
  trash: invoke('fs:trash'),
  reveal: invoke('shell:reveal'),
  openExternal: invoke('shell:openExternal'),
  openPath: invoke('shell:openPath'),
  openFolderDialog: invoke('dialog:openFolder'),
  openFilesDialog: invoke('dialog:openFiles'),
  saveAsDialog: invoke('dialog:saveAs'),
  spotlight: invoke('search:spotlight'),
  walk: invoke('search:walk'),
  searchContent: invoke('search:content'),
  setWatched: invoke('watch:set'),
  popupMenu: invoke('menu:popup'),
  setTheme: invoke('theme:set'),
  pathForFile: (f: File) => webUtils.getPathForFile(f),
  flushed: () => ipcRenderer.send('app:flushed'),
  onMenu: (fn: (cmd: string) => void) => on('menu', fn),
  onOpenPaths: (fn: (paths: string[]) => void) => on('open-paths', fn),
  onFsChanged: (fn: (path: string) => void) => on('fs:changed', fn),
  onFlush: (fn: () => void) => on('app:flush', fn)
}

contextBridge.exposeInMainWorld('api', api)
