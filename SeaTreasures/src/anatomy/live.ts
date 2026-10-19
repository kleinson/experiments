import { useEffect, useRef, useState } from 'react'

/**
 * Runs an idle tour only while the figure is on screen, nobody is touching
 * it and motion is allowed. Returns handlers that pause it.
 */
export function useIdleTour(
  step: () => void,
  interval: number,
  reducedMotion: boolean,
) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [held, setHeld] = useState(false)
  const [touched, setTouched] = useState(false)
  const latest = useRef(step)
  useEffect(() => {
    latest.current = step
  })
  useEffect(() => {
    const element = host.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(Boolean(entry?.isIntersecting)),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const running = visible && !held && !touched && !reducedMotion
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      if (!document.hidden) latest.current()
    }, interval)
    return () => window.clearInterval(timer)
  }, [running, interval])
  return {
    host,
    running,
    hold: () => setHeld(true),
    release: () => setHeld(false),
    touch: () => setTouched(true),
  }
}

/** Remembers recent renders so scrubbing back and forth stays instant. */
export function memo<T>(limit: number, build: (key: string) => T) {
  const cache = new Map<string, T>()
  return (key: string) => {
    const hit = cache.get(key)
    if (hit !== undefined) {
      cache.delete(key)
      cache.set(key, hit)
      return hit
    }
    const value = build(key)
    cache.set(key, value)
    if (cache.size > limit) cache.delete(cache.keys().next().value!)
    return value
  }
}
