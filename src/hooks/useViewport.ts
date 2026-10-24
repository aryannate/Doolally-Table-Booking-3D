import { useEffect, useState } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

function read() {
  const w = window.innerWidth
  const h = window.innerHeight
  const bp: Breakpoint = w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'
  const landscape = w > h
  // the details panel floats beside the scene on desktop and on landscape tablets / phones with room;
  // everywhere else it is a bottom sheet
  const panel: 'side' | 'sheet' = bp === 'desktop' || (landscape && w >= 700) ? 'side' : 'sheet'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return { w, h, bp, landscape, panel, coarse }
}

export function useViewport() {
  const [v, setV] = useState(read)
  useEffect(() => {
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setV(read())) }
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
      window.visualViewport?.removeEventListener('resize', on)
    }
  }, [])
  return v
}

export function useReducedMotion() {
  const [r, setR] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setR(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return r
}

/** Report an element's size into the store-backed camera insets. */
export function useMeasure<T extends HTMLElement>(cb: (rect: DOMRect | null) => void, deps: unknown[] = []) {
  const [el, setEl] = useState<T | null>(null)
  useEffect(() => {
    if (!el) { cb(null); return }
    const ro = new ResizeObserver(() => cb(el.getBoundingClientRect()))
    ro.observe(el)
    cb(el.getBoundingClientRect())
    return () => { ro.disconnect(); cb(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, ...deps])
  return setEl
}
