import { useStore } from '../state/store'
import { IconHand, IconHome, IconMinus, IconPlus, IconRotL, IconRotR, IconTop } from './icons'

function B({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${active ? 'bg-ink text-white' : 'text-ink-soft hover:bg-paper hover:text-ink active:bg-paper'}`}
    >
      {children}
    </button>
  )
}

/** Small, quiet camera controls on the edge of the screen. */
export function CameraControls({ placement, bottom }: { placement: 'left' | 'right'; bottom?: number }) {
  const camera = useStore((s) => s.camera)
  const topView = useStore((s) => s.topView)
  const panMode = useStore((s) => s.panMode)
  const setPanMode = useStore((s) => s.setPanMode)
  const touchLayout = placement === 'right'
  const style: React.CSSProperties = touchLayout
    ? { right: 12, bottom: (bottom ?? 0) + 14, transition: 'bottom 300ms ease-out' }
    : { left: 20, top: '50%', transform: 'translateY(-50%)' }
  return (
    <nav aria-label="Camera" className="absolute z-20 flex flex-col gap-0.5 rounded-2xl bg-paper-card/95 p-1 shadow-pill backdrop-blur" style={style}>
      <B label="Zoom in" onClick={() => camera('zoomIn')}><IconPlus /></B>
      <B label="Zoom out" onClick={() => camera('zoomOut')}><IconMinus /></B>
      {!touchLayout && <B label="Rotate left" onClick={() => camera('rotL')}><IconRotL /></B>}
      {!touchLayout && <B label="Rotate right" onClick={() => camera('rotR')}><IconRotR /></B>}
      <span className="mx-2 my-0.5 h-px bg-paper-line" />
      <B label={panMode ? 'Drag to pan (on)' : 'Drag to pan'} active={panMode} onClick={() => setPanMode(!panMode)}><IconHand /></B>
      <B label={topView ? 'Back to 3D view' : 'Floor-plan view'} active={topView} onClick={() => camera('top')}><IconTop /></B>
      <B label="Reset view" onClick={() => camera('reset')}><IconHome /></B>
    </nav>
  )
}
