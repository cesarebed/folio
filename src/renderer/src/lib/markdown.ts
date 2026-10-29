import MarkdownItCtor, { type MarkdownIt } from 'markdown-it'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import katexModule from '@vscode/markdown-it-katex'
import hljs from 'highlight.js/lib/common'
import DOMPurify from 'dompurify'
import { load as loadYaml } from 'js-yaml'
import { join, normalize, toLocalUrl, extname } from './path'

const katexPlugin = (katexModule as any).default ?? katexModule

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* ---------- headings ---------- */

export interface Heading {
  level: number
  text: string
  line: number
}

export function plainInline(s: string) {
  return s
    .replace(/!?\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_m, t, a) => a || t)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~=]{1,3}/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}

export function slugify(s: string) {
  return plainInline(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** Fast line scan used for the outline, works in both reading and editing mode. */
export function extractHeadings(src: string): Heading[] {
  const lines = src.split('\n')
  const out: Heading[] = []
  let i = 0
  if (/^---\s*$/.test(lines[0] ?? '')) {
    const end = lines.findIndex((l, j) => j > 0 && /^(---|\.\.\.)\s*$/.test(l))
    if (end > 0) i = end + 1
  }
  let fence: string | null = null
  for (; i < lines.length; i++) {
    const l = lines[i]
    const f = l.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (f) {
      if (!fence) fence = f[1]
      else if (l.trim().startsWith(fence)) fence = null
      continue
    }
    if (fence) continue
    const m = l.match(/^\s{0,3}(#{1,6})\s+(.*?)(\s+#+)?\s*$/)
    if (m) {
      out.push({ level: m[1].length, text: plainInline(m[2]), line: i })
      continue
    }
    const prev = lines[i - 1]
    if (i > 0 && prev?.trim() && !/^\s{0,3}(#|>|[-*+]\s|\d+[.)]\s)/.test(prev)) {
      if (/^\s{0,3}=+\s*$/.test(l)) out.push({ level: 1, text: plainInline(prev), line: i - 1 })
      else if (/^\s{0,3}-{2,}\s*$/.test(l)) out.push({ level: 2, text: plainInline(prev), line: i - 1 })
    }
  }
  return out
}

/* ---------- frontmatter ---------- */

export function splitFrontmatter(src: string) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/)
  if (!m) return { body: src, data: null as Record<string, unknown> | null, offset: 0 }
  let data: Record<string, unknown> | null = null
  try {
    const parsed = loadYaml(m[1])
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
  } catch {
    data = { yaml: m[1] }
  }
  const newlines = (m[0].match(/\n/g) ?? []).length
  return { body: src.slice(m[0].length), data, offset: m[0].endsWith('\n') ? newlines : newlines + 1 }
}

function renderProperties(data: Record<string, unknown>) {
  const value = (v: unknown): string => {
    if (Array.isArray(v)) return `<span class="prop-list">${v.map((x) => `<span class="prop-chip">${esc(String(x))}</span>`).join('')}</span>`
    if (v instanceof Date) return esc(v.toISOString().slice(0, 10))
    if (v && typeof v === 'object') return `<code>${esc(JSON.stringify(v))}</code>`
    return esc(String(v ?? ''))
  }
  const rows = Object.entries(data)
    .map(([k, v]) => `<div class="prop-row"><div class="prop-key">${esc(k)}</div><div class="prop-val">${value(v)}</div></div>`)
    .join('')
  return `<div class="properties" data-line="0">${rows}</div>`
}

/* ---------- markdown-it setup ---------- */

function wikilinks(md: MarkdownIt) {
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const src = state.src
    const s = state.pos
    const embed = src.charCodeAt(s) === 0x21 && src.startsWith('[[', s + 1)
    if (!embed && !src.startsWith('[[', s)) return false
    const start = s + (embed ? 3 : 2)
    const end = src.indexOf(']]', start)
    if (end < 0) return false
    const inner = src.slice(start, end)
    if (!inner.trim() || inner.includes('\n')) return false
    if (!silent) {
      const [target, alias] = inner.split('|')
      const tok = state.push(embed ? 'wikiembed' : 'wikilink', '', 0)
      tok.meta = { target: target.trim(), alias: alias?.trim() }
    }
    state.pos = end + 2
    return true
  })
  md.renderer.rules.wikilink = (tokens, idx) => {
    const { target, alias } = tokens[idx].meta as { target: string; alias?: string }
    return `<a class="wikilink" href="#" data-wikilink="${esc(target)}">${esc(alias || target)}</a>`
  }
  md.renderer.rules.wikiembed = (tokens, idx) => {
    const { target, alias } = tokens[idx].meta as { target: string; alias?: string }
    if (/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(target)) return `<img src="${esc(encodeURI(target))}" alt="${esc(alias ?? '')}">`
    return `<a class="wikilink embed" href="#" data-wikilink="${esc(target)}">${esc(alias || target)}</a>`
  }
}

function sourceLines(md: MarkdownIt) {
  md.core.ruler.push('folio_lines', (state) => {
    const off = (state.env?.lineOffset as number) ?? 0
    const used = new Map<string, number>()
    const toks = state.tokens
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]
      if (t.map && t.nesting === 1) t.attrSet('data-line', String(t.map[0] + off))
      if (t.type === 'heading_open') {
        let slug = slugify(toks[i + 1]?.content ?? '') || 'section'
        const n = used.get(slug) ?? 0
        used.set(slug, n + 1)
        if (n) slug += `-${n}`
        t.attrSet('id', slug)
      }
    }
  })
}

const md: MarkdownIt = new MarkdownItCtor({ html: true, linkify: true, typographer: true })

md.renderer.rules.fence = (tokens, idx, _opts, env) => {
  const t = tokens[idx]
  const lang = t.info.trim().split(/\s+/)[0] ?? ''
  const line = t.map ? t.map[0] + ((env?.lineOffset as number) ?? 0) : ''
  if (lang === 'mermaid') {
    return `<div class="mermaid-block" data-line="${line}"><pre class="mermaid-src">${esc(t.content)}</pre></div>`
  }
  let body = esc(t.content)
  if (lang && hljs.getLanguage(lang)) {
    try {
      body = hljs.highlight(t.content, { language: lang, ignoreIllegals: true }).value
    } catch {
      /* fall back to plain */
    }
  }
  return (
    `<div class="code-block" data-line="${line}"><div class="code-head"><span class="code-lang">${esc(lang)}</span>` +
    `<button class="code-copy" type="button">Copia</button></div><pre><code class="hljs">${body}</code></pre></div>`
  )
}

md.use(footnote)
md.use(taskLists, { enabled: true })
md.use(katexPlugin, { enableFencedBlocks: true, throwOnError: false })
md.use(wikilinks)
md.use(sourceLines)

/* ---------- sanitizing + post-processing ---------- */

let currentBase = '/'

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const el = node as Element
  if (!el.getAttribute) return
  for (const attr of ['src', 'poster']) {
    const v = el.getAttribute(attr)
    if (!v || /^(https?:|data:|local:|blob:)/i.test(v)) continue
    let p = v.replace(/^file:\/\//i, '')
    try {
      p = decodeURI(p)
    } catch {
      /* keep raw */
    }
    p = p.split(/[?#]/)[0]
    const abs = p.startsWith('/') ? normalize(p) : join(currentBase, p)
    el.setAttribute(attr, toLocalUrl(abs))
  }
  if (el.tagName === 'IMG') el.setAttribute('loading', 'lazy')
})

const CALLOUT_KIND: Record<string, string> = {
  note: 'blue', info: 'blue', abstract: 'blue', summary: 'blue', tldr: 'blue', todo: 'blue',
  tip: 'green', hint: 'green', success: 'green', check: 'green', done: 'green', important: 'green',
  question: 'yellow', help: 'yellow', faq: 'yellow', warning: 'yellow', caution: 'yellow', attention: 'yellow',
  danger: 'red', error: 'red', bug: 'red', failure: 'red', fail: 'red', missing: 'red',
  example: 'purple', quote: 'gray', cite: 'gray'
}

function postProcess(frag: DocumentFragment) {
  for (const bq of frag.querySelectorAll('blockquote')) {
    const p = bq.firstElementChild
    if (p?.tagName !== 'P') continue
    const m = p.innerHTML.match(/^\s*\[!([\w-]+)\]([+-]?)[ \t]*([^\n<]*)(\n|<br>\n?)?/)
    if (!m) continue
    const type = m[1].toLowerCase()
    bq.classList.add('callout', `callout-${CALLOUT_KIND[type] ?? 'gray'}`)
    if (m[2] === '-') bq.classList.add('collapsed')
    const title = document.createElement('div')
    title.className = 'callout-title'
    title.innerHTML = m[3].trim() || esc(type.charAt(0).toUpperCase() + type.slice(1))
    p.innerHTML = p.innerHTML.slice(m[0].length)
    if (!p.innerHTML.trim()) p.remove()
    bq.prepend(title)
  }
  for (const table of frag.querySelectorAll('table')) {
    const wrap = document.createElement('div')
    wrap.className = 'table-wrap'
    table.replaceWith(wrap)
    wrap.append(table)
  }
}

export function renderMarkdown(src: string, baseDir: string): DocumentFragment {
  const { body, data, offset } = splitFrontmatter(src)
  currentBase = baseDir
  let html = md.render(body, { lineOffset: offset })
  if (data && Object.keys(data).length) html = renderProperties(data) + html
  const frag = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ['semantics', 'annotation'],
    ADD_ATTR: ['data-wikilink', 'data-line', 'loading', 'checked']
  }) as DocumentFragment
  postProcess(frag)
  return frag
}

/* ---------- mermaid (lazy) ---------- */

let mermaidId = 0
export async function renderMermaid(root: HTMLElement, dark: boolean) {
  const blocks = [...root.querySelectorAll<HTMLElement>('.mermaid-block:not([data-done])')]
  if (!blocks.length) return
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: dark ? 'dark' : 'neutral',
    fontFamily: 'inherit'
  })
  for (const block of blocks) {
    block.dataset.done = '1'
    const src = block.querySelector('.mermaid-src')?.textContent ?? ''
    try {
      const { svg } = await mermaid.render(`mmd-${++mermaidId}`, src)
      block.innerHTML = svg
    } catch (e) {
      block.classList.add('error')
      block.title = String(e)
    }
  }
}

export const isMarkdownLink = (href: string) => /\.(md|markdown|mdown|mkd|mkdn|mdx|textbundle|txt)$/i.test(href.split('#')[0])
export { extname }
