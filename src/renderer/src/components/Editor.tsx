import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from 'react'
import { EditorView } from '@codemirror/view'
import { openSearchPanel } from '@codemirror/search'
import { createState, editorStates, External } from '../lib/editor'

export interface EditorHandle {
  getTopLine(): number
  scrollToLine(line: number): void
  openSearch(): void
  focus(): void
}

interface Props {
  tabId: string
  content: string
  rev: number
  scroller: RefObject<HTMLDivElement | null>
  onChange(id: string, doc: string): void
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const tabRef = useRef(props.tabId)
  const onChangeRef = useRef(props.onChange)
  onChangeRef.current = props.onChange

  const stateFor = (id: string, content: string) => {
    const cached = editorStates.get(id)
    if (cached) return cached
    return createState(content, (doc) => onChangeRef.current(id, doc))
  }

  useEffect(() => {
    const view = new EditorView({ state: stateFor(props.tabId, props.content), parent: hostRef.current! })
    viewRef.current = view
    tabRef.current = props.tabId
    return () => {
      editorStates.set(tabRef.current, view.state)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // switching tabs while in edit mode: swap the state, keeping each tab's undo history
  useEffect(() => {
    const view = viewRef.current
    if (!view || tabRef.current === props.tabId) return
    editorStates.set(tabRef.current, view.state)
    tabRef.current = props.tabId
    view.setState(stateFor(props.tabId, props.content))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.tabId])

  // content changed outside the editor (reload from disk, task toggled in reading mode).
  // Keyed on rev, not content: content also changes while typing and may lag a keystroke behind.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const doc = view.state.doc
    if (doc.length === props.content.length && doc.toString() === props.content) return
    view.dispatch({ changes: { from: 0, to: doc.length, insert: props.content }, annotations: External.of(true) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.rev])

  useImperativeHandle(ref, () => ({
    getTopLine() {
      const view = viewRef.current
      const scroller = props.scroller.current
      if (!view || !scroller) return 0
      const offset = scroller.getBoundingClientRect().top + 24 - view.documentTop
      const block = view.lineBlockAtHeight(Math.max(0, offset))
      return view.state.doc.lineAt(block.from).number - 1
    },
    scrollToLine(line) {
      const view = viewRef.current
      const scroller = props.scroller.current
      if (!view || !scroller) return
      const n = Math.min(Math.max(1, line + 1), view.state.doc.lines)
      const block = view.lineBlockAt(view.state.doc.line(n).from)
      scroller.scrollTop += view.documentTop + block.top - scroller.getBoundingClientRect().top - 24
    },
    openSearch() {
      const view = viewRef.current
      if (view) openSearchPanel(view)
    },
    focus() {
      viewRef.current?.focus()
    }
  }))

  return <div className="editor" ref={hostRef} />
})
