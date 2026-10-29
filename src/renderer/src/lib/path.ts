export const basename = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? p
export const dirname = (p: string) => {
  const i = p.replace(/\/+$/, '').lastIndexOf('/')
  return i <= 0 ? '/' : p.slice(0, i)
}
export const extname = (p: string) => {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i > 0 ? b.slice(i).toLowerCase() : ''
}
export const stem = (p: string) => {
  const b = basename(p)
  const e = extname(b)
  return e ? b.slice(0, -e.length) : b
}
export const join = (...parts: string[]) => normalize(parts.filter(Boolean).join('/'))

export function normalize(p: string) {
  const abs = p.startsWith('/')
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return (abs ? '/' : '') + out.join('/')
}

export const isUnder = (p: string, root: string) => p === root || p.startsWith(root.endsWith('/') ? root : root + '/')

let home = ''
export const setHome = (h: string) => (home = h)
export const tildify = (p: string) => (home && isUnder(p, home) ? '~' + p.slice(home.length) : p)

const MD_EXT = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdx', '.textbundle', '.txt'])
export const isMarkdownPath = (p: string) => MD_EXT.has(extname(p))

/** The directory relative links/images resolve against (a .textbundle is its own base). */
export const baseDirOf = (realPath: string) => dirname(realPath)

export const toLocalUrl = (abs: string) => 'local://file' + abs.split('/').map(encodeURIComponent).join('/')
