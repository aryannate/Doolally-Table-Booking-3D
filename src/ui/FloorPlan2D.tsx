import { TABLES, WALLS } from '../data/layout'
import { MARKER_COLOR } from '../config/colors'
import { useStore } from '../state/store'

/**
 * 2D fallback for browsers without WebGL — the same floor-plan data drawn as SVG,
 * with the same selection, status colours and booking panel.
 */
export function FloorPlan2D({ insets }: { insets: { top: number; bottom: number; right: number } }) {
  const status = useStore((s) => s.status)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingRight: insets.right + 16 }}>
      <svg viewBox="20 100 1080 800" className="h-full w-full" role="group" aria-label="Floor plan" onClick={() => select(null)}>
        <rect x="150" y="320" width="848" height="408" fill="#efe2cc" />
        <rect x="190" y="110" width="808" height="210" fill="#e7e4df" />
        <rect x="20" y="731" width="1070" height="155" fill="#e4e0d9" />
        {WALLS.map((wl, i) => (
          <line key={i} x1={wl.a[0]} y1={wl.a[1]} x2={wl.b[0]} y2={wl.b[1]} stroke={wl.kind === 'glazed' ? '#8aa' : '#4a443e'} strokeWidth={wl.normal ? 6 : 4} strokeLinecap="square" />
        ))}
        <rect x="195" y="447" width="100" height="170" rx="4" fill="none" stroke="#9b6b40" strokeWidth="6" />
        <rect x="556" y="416" width="196" height="21" fill="#d49c5a" />
        <text x="245" y="540" textAnchor="middle" fontSize="16" fill="#9b6b40" fontWeight="600">BAR</text>
        <text x="620" y="380" textAnchor="middle" fontSize="14" fill="#8f877e">Open kitchen</text>
        <text x="560" y="940" textAnchor="middle" fontSize="22" fill="#b9b2a7" fontWeight="700" letterSpacing="6">13TH STREET</text>
        {TABLES.map((t) => {
          const st = status[t.id]
          const sel = selectedId === t.id
          const r = t.kind === 'counter' ? 10 + t.capacity * 3 : 12 + t.capacity * 3.5
          const fill = sel ? MARKER_COLOR.selected : st === 'available' ? '#d49c5a' : st === 'booked' || st === 'blocked' ? '#e08f86' : st === 'held' ? '#f1bf6c' : '#e2dbd0'
          return (
            <g key={t.id} role="button" tabIndex={0} aria-label={`Table ${t.id}`} style={{ cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); select(t.id) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t.id) } }}>
              <rect x={t.plan.x - r} y={t.plan.y - r} width={r * 2} height={r * 2} rx={t.kind === 'counter' ? r : 6} fill={fill} opacity={selectedId && !sel ? 0.45 : 1} transform={t.rotation ? `rotate(45 ${t.plan.x} ${t.plan.y})` : undefined} />
              <text x={t.plan.x} y={t.plan.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={sel ? '#fff' : '#3b3734'}>{t.id}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
