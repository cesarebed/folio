import { useCallback, useEffect, useRef, useState } from 'react'
import { isUnder } from './path'

export interface TreeState {
  children: Record<string, Entry[]>
  errors: Record<string, string>
  reload: (dir: string) => void
  isLoaded: (dir: string) => boolean
}

export function useTree(root: string, showHidden: boolean, expanded: string[]): TreeState {
  const [children, setChildren] = useState<Record<string, Entry[]>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const inflight = useRef(new Set<string>())
  const generation = useRef(0)

  const load = useCallback(
    async (dir: string) => {
      const gen = generation.current
      inflight.current.add(dir)
      try {
        const list = await window.api.readDir(dir, showHidden)
        if (gen !== generation.current) return
        setChildren((c) => ({ ...c, [dir]: list }))
        setErrors((e) => {
          if (!(dir in e)) return e
          const next = { ...e }
          delete next[dir]
          return next
        })
      } catch (err) {
        if (gen !== generation.current) return
        const msg = String((err as Error).message ?? err)
        setChildren((c) => ({ ...c, [dir]: [] }))
        setErrors((e) => ({ ...e, [dir]: /EPERM|EACCES/.test(msg) ? 'Permission denied' : 'Folder unavailable' }))
      } finally {
        inflight.current.delete(dir)
      }
    },
    [showHidden]
  )

  useEffect(() => {
    generation.current++
    inflight.current.clear()
    setChildren({})
    setErrors({})
  }, [root, showHidden])

  useEffect(() => {
    for (const dir of [root, ...expanded.filter((p) => isUnder(p, root))]) {
      if (!(dir in children) && !inflight.current.has(dir)) load(dir)
    }
  }, [root, expanded, children, load])

  const reload = useCallback(
    (dir: string) => {
      if (dir in children) load(dir)
    },
    [children, load]
  )

  return { children, errors, reload, isLoaded: (dir) => dir in children }
}
