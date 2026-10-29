import { EditorState, EditorSelection, Annotation } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine, placeholder, dropCursor, rectangularSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search'
import { tags as t } from '@lezer/highlight'
import { yamlFrontmatter } from '@codemirror/lang-yaml'

/** Marks transactions that come from outside the editor (file reloaded, task toggled). */
export const External = Annotation.define<boolean>()

const serif = 'var(--font-serif)'
const mono = 'var(--font-mono)'

const highlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.75em', fontWeight: '600', fontFamily: serif, letterSpacing: '-0.02em' },
  { tag: t.heading2, fontSize: '1.45em', fontWeight: '600', fontFamily: serif, letterSpacing: '-0.015em' },
  { tag: t.heading3, fontSize: '1.22em', fontWeight: '600', fontFamily: serif },
  { tag: [t.heading4, t.heading5, t.heading6], fontSize: '1.05em', fontWeight: '600' },
  { tag: t.strong, fontWeight: '650' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--muted)' },
  { tag: t.link, color: 'var(--link)' },
  { tag: t.url, color: 'var(--muted)', textDecoration: 'underline', textDecorationColor: 'var(--border-strong)' },
  { tag: t.monospace, fontFamily: mono, fontSize: '0.88em', color: 'var(--code-ink)' },
  { tag: t.processingInstruction, color: 'var(--faint)', fontWeight: '400' },
  { tag: t.quote, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: t.contentSeparator, color: 'var(--faint)' },
  { tag: t.meta, color: 'var(--muted)' },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--hl-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--hl-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--hl-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--hl-title)' },
  { tag: [t.typeName, t.className, t.tagName], color: 'var(--hl-type)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--hl-attr)' }
])

function wrap(before: string, after = before) {
  return (view: EditorView) => {
    view.dispatch(
      view.state.changeByRange((range) => {
        const text = view.state.sliceDoc(range.from, range.to)
        const outside =
          view.state.sliceDoc(range.from - before.length, range.from) === before &&
          view.state.sliceDoc(range.to, range.to + after.length) === after
        if (outside) {
          return {
            changes: [
              { from: range.from - before.length, to: range.from, insert: '' },
              { from: range.to, to: range.to + after.length, insert: '' }
            ],
            range: EditorSelection.range(range.from - before.length, range.to - before.length)
          }
        }
        return {
          changes: { from: range.from, to: range.to, insert: before + text + after },
          range: EditorSelection.range(range.from + before.length, range.to + before.length)
        }
      })
    )
    return true
  }
}

function insertLink(view: EditorView) {
  view.dispatch(
    view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to)
      const insert = `[${text}]()`
      const cursor = text ? range.from + insert.length - 1 : range.from + 1
      return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.cursor(cursor) }
    })
  )
  return true
}

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'visible', fontFamily: 'inherit', lineHeight: 'inherit' },
  '.cm-gutters': { display: 'none' }
})

export function createState(doc: string, onChange: (doc: string) => void) {
  return EditorState.create({
    doc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      EditorView.lineWrapping,
      EditorState.allowMultipleSelections.of(true),
      placeholder('Inizia a scrivere…'),
      yamlFrontmatter({ content: markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }) }),
      syntaxHighlighting(highlight),
      theme,
      keymap.of([
        { key: 'Mod-b', run: wrap('**') },
        { key: 'Mod-i', run: wrap('*') },
        { key: 'Mod-Shift-x', run: wrap('~~') },
        { key: 'Mod-Shift-c', run: wrap('`') },
        { key: 'Mod-k', run: insertLink },
        ...searchKeymap,
        ...historyKeymap,
        indentWithTab,
        ...defaultKeymap
      ]),
      EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'off', autocapitalize: 'off' }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !u.transactions.some((tr) => tr.annotation(External))) onChange(u.state.doc.toString())
      })
    ]
  })
}

/** Keeps undo history per tab while the single editor view moves between tabs. */
export const editorStates = new Map<string, EditorState>()
