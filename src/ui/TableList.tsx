import { TABLES, ZONES } from '../data/layout'
import { STATUS_LABEL } from '../lib/availability'
import { useStore } from '../state/store'

/**
 * Keyboard and screen-reader route to every table. Visually hidden until it receives focus,
 * so the 3D scene stays uncluttered for pointer users.
 */
export function TableList() {
  const status = useStore((s) => s.status)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  return (
    <nav aria-label="All tables" className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:bottom-4 focus-within:left-4 focus-within:z-40 focus-within:max-h-[50vh] focus-within:w-64 focus-within:overflow-auto focus-within:rounded-2xl focus-within:bg-paper-card focus-within:p-2 focus-within:shadow-card">
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink-mute">Tables</p>
      <ul>
        {TABLES.map((t) => (
          <li key={t.id}>
            <button
              className={`w-full rounded-lg px-2 py-1.5 text-left text-[13px] ${selectedId === t.id ? 'bg-sel text-white' : 'text-ink hover:bg-paper'}`}
              aria-current={selectedId === t.id}
              onClick={() => select(t.id)}
            >
              {t.id} · {ZONES[t.zone].label} · seats {t.capacity} · {STATUS_LABEL[status[t.id] ?? 'available']}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
