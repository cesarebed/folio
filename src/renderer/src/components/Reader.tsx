import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type RefObject } from 'react'
import { renderMarkdown, renderMermaid } from '../lib/markdown'

export interface ReaderHandle {
  getTopLine(): number
  scrollToLine(line: number): void
  scrollToAnchor(id: string): void
  element(): HTMLElement | null
}

interface Props {
  content: string
  baseDir: string
  dark: boolean
  scroller: RefObject<HTMLDivElement | null>
  onLink(href: string, newTab: boolean): void
  onWikilink(target: string, newTab: boolean): void
  onToggleTask(line: number): void
}

const HEADER_GAP = 24

export const Reader = forwardRef<ReaderHandle, Props>(function Reader(props, ref) {
  const articleRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = articleRef.current
    if (!el) return
    el.replaceChildren(renderMarkdown(props.content, props.baseDir))
    renderMermaid(el, props.dark)
  }, [props.content, props.baseDir, props.dark])

  const lineElements = () => [...(articleRef.current?.querySelectorAll<HTMLElement>('[data-line]') ?? [])]

  const scrollToElement = (target: Element) => {
    const scroller = props.scroller.current
    if (!scroller) return
    const delta = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    scroller.scrollTop += delta - HEADER_GAP
    target.classList.remove('flash')
    void (target as HTMLElement).offsetWidth
    target.classList.add('flash')
  }

  useImperativeHandle(ref, () => ({
    element: () => articleRef.current,
    getTopLine() {
      const scroller = props.scroller.current
      if (!scroller) return 0
      const top = scroller.getBoundingClientRect().top + HEADER_GAP
      let line = 0
      for (const el of lineElements()) {
        if (el.getBoundingClientRect().top > top) break
        line = Number(el.dataset.line)
      }
      return line
    },
    scrollToLine(line) {
      let best: HTMLElement | null = null
      for (const el of lineElements()) {
        const l = Number(el.dataset.line)
        if (l > line) break
        best = el
      }
      if (best) scrollToElement(best)
      else if (props.scroller.current) props.scroller.current.scrollTop = 0
    },
    scrollToAnchor(id) {
      const el = articleRef.current?.querySelector(`[id="${CSS.escape(id)}"]`) ?? articleRef.current?.querySelector(`[id="${CSS.escape(id.toLowerCase())}"]`)
      if (el) scrollToElement(el)
    }
  }))

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const newTab = e.metaKey || e.button === 1

    const checkbox = target.closest('input.task-list-item-checkbox') as HTMLInputElement | null
    if (checkbox) {
      e.preventDefault()
      const li = checkbox.closest<HTMLElement>('[data-line]')
      if (li) props.onToggleTask(Number(li.dataset.line))
      return
    }

    const copy = target.closest('.code-copy') as HTMLButtonElement | null
    if (copy) {
      const code = copy.closest('.code-block')?.querySelector('code')?.textContent ?? ''
      navigator.clipboard.writeText(code)
      copy.textContent = 'Copiato'
      copy.classList.add('done')
      setTimeout(() => {
        copy.textContent = 'Copia'
        copy.classList.remove('done')
      }, 1400)
      return
    }

    const calloutTitle = target.closest('.callout-title')
    if (calloutTitle) {
      calloutTitle.parentElement?.classList.toggle('collapsed')
      return
    }

    const a = target.closest('a') as HTMLAnchorElement | null
    if (!a) return
    e.preventDefault()
    if (a.dataset.wikilink) return props.onWikilink(a.dataset.wikilink, newTab)
    const href = a.getAttribute('href')
    if (href) props.onLink(href, newTab)
  }

  return <article ref={articleRef} className="markdown" onClick={onClick} onAuxClick={onClick} />
})
