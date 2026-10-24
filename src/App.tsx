import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useMeasure, useViewport } from './hooks/useViewport'
import { useStore } from './state/store'
import { BookingBar } from './ui/BookingBar'
import { CameraControls } from './ui/CameraControls'
import { FloorPlan2D } from './ui/FloorPlan2D'
import { TableList } from './ui/TableList'
import { TablePanel } from './ui/TablePanel'

const Scene = lazy(() => import('./scene/Scene'))
const Admin = lazy(() => import('./admin/Admin'))

function webglAvailable() {
  if (new URLSearchParams(location.search).get('mode') === '2d') return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

function Loader() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-ink-mute"><span className="h-2 w-2 animate-pulse rounded-full bg-wood" />Setting the tables…</div>
    </div>
  )
}

function Booking() {
  const vp = useViewport()
  const [three, setThree] = useState(webglAvailable)
  const refresh = useStore((s) => s.refresh)
  const setInsets = useStore((s) => s.setInsets)
  const insets = useStore((s) => s.insets)
  const hasSel = useStore((s) => !!s.selectedId)

  useEffect(() => { refresh() }, [refresh])

  const compact = vp.bp === 'mobile' || (vp.bp === 'tablet' && !vp.landscape) || vp.w < 700
  // top bar: on phones it spans the width, so it covers the top of the scene
  const measureTop = useMeasure<HTMLElement>(useCallback((r: DOMRect | null) => setInsets({ top: r ? Math.round(r.bottom) : 0 }), [setInsets]))
  // details panel: a side card covers the right, a sheet covers the bottom
  const measurePanel = useMeasure<HTMLElement>(useCallback((r: DOMRect | null) => {
    if (!r) return setInsets({ right: 0, bottom: 0 })
    if (vp.panel === 'side') setInsets({ right: Math.round(window.innerWidth - r.left), bottom: 0 })
    else setInsets({ right: 0, bottom: Math.round(window.innerHeight - r.top) })
  }, [setInsets, vp.panel]), [vp.panel])

  return (
    <div className="fixed inset-0 overflow-hidden bg-paper text-ink">
      <div className="absolute inset-0">
        {three ? (
          <SceneBoundary onError={() => setThree(false)}>
            <Suspense fallback={<Loader />}>
              <Scene onFail={() => setThree(false)} />
            </Suspense>
          </SceneBoundary>
        ) : (
          <FloorPlan2D insets={insets} />
        )}
      </div>
      <BookingBar layout={compact ? 'compact' : 'wide'} measureRef={measureTop} />
      {three && vp.h - insets.top - (vp.panel === 'sheet' && hasSel ? insets.bottom : 0) > 300 && <CameraControls placement={vp.coarse || compact ? 'right' : 'left'} bottom={vp.panel === 'sheet' && hasSel ? insets.bottom : 0} />}
      {!compact && vp.h > 560 && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-paper-card/80 px-3 py-1.5 text-[12px] text-ink-soft shadow-pill backdrop-blur transition-opacity duration-300" style={{ opacity: hasSel ? 0 : 1 }}>
          Tap a table to see availability · drag to look around
        </p>
      )}
      {!compact && !hasSel && <a href="#/admin" className="absolute bottom-4 right-5 z-10 text-[11px] text-ink-mute hover:text-ink">Staff</a>}
      <TablePanel mode={vp.panel} measureRef={measurePanel} />
      <TableList />
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState(location.hash)
  useEffect(() => {
    const on = () => setRoute(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  if (route.startsWith('#/admin')) return <Suspense fallback={null}><Admin /></Suspense>
  return <Booking />
}
