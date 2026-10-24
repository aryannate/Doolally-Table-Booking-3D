import { create } from 'zustand'
import { TABLES, TABLE_BY_ID } from '../data/layout'
import { statusMap, type Query } from '../lib/availability'
import { defaultBooking, openSlots } from '../lib/time'
import { BookingError, repo, sessionId } from '../services'
import type { Contact, Reservation, TableBlock, TableStatus } from '../types'

export type Step = 'details' | 'form' | 'done'
export type CameraCmd = 'zoomIn' | 'zoomOut' | 'rotL' | 'rotR' | 'reset' | 'top'

interface State extends Query {
  session: string
  rows: Reservation[]
  blocks: TableBlock[]
  status: Record<string, TableStatus>
  loading: boolean
  selectedId: string | null
  hoveredId: string | null
  step: Step
  hold: Reservation | null
  confirmed: Reservation | null
  busy: boolean
  error: string | null
  /** pixels of the canvas covered by UI (top bar, card/sheet) — the camera recentres into what is left */
  insets: { top: number; right: number; bottom: number; left: number }
  topView: boolean
  panMode: boolean
  camCmd: { cmd: CameraCmd; n: number } | null

  setQuery: (q: Partial<Query>) => void
  refresh: () => Promise<void>
  select: (id: string | null) => void
  hover: (id: string | null) => void
  reserve: () => Promise<void>
  confirm: (c: Contact) => Promise<void>
  back: () => void
  close: () => void
  setInsets: (i: Partial<State['insets']>) => void
  camera: (cmd: CameraCmd) => void
  setPanMode: (v: boolean) => void
}

const recompute = (s: Pick<State, 'date' | 'time' | 'guests' | 'rows' | 'blocks' | 'session'>) =>
  statusMap(TABLES, { date: s.date, time: s.time, guests: s.guests }, s.rows, s.blocks, s.session)

const init = defaultBooking()
let reqId = 0

export const useStore = create<State>((set, get) => ({
  ...init,
  guests: 2,
  session: sessionId(),
  rows: [],
  blocks: [],
  status: {},
  loading: true,
  selectedId: null,
  hoveredId: null,
  step: 'details',
  hold: null,
  confirmed: null,
  busy: false,
  error: null,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  topView: false,
  panMode: false,
  camCmd: null,

  setQuery: (q) => {
    const prev = get()
    const next = { ...prev, ...q }
    // keep the time valid when the date changes
    const slots = openSlots(next.date)
    if (!slots.includes(next.time)) next.time = slots[0] ?? next.time
    const dateChanged = next.date !== prev.date
    if (prev.hold) repo.release(prev.hold.id, prev.session).catch(() => {})
    set({ date: next.date, time: next.time, guests: next.guests, hold: null, step: 'details', error: null, status: recompute(next) })
    if (dateChanged) get().refresh()
  },

  refresh: async () => {
    const id = ++reqId
    set({ loading: true })
    const { date } = get()
    try {
      const [rows, blocks] = await Promise.all([repo.listDay(date), repo.listBlocks(date)])
      if (id !== reqId) return
      set((s) => ({ rows, blocks, loading: false, status: recompute({ ...s, rows, blocks }) }))
    } catch (e) {
      if (id !== reqId) return
      set({ loading: false, error: e instanceof Error ? e.message : 'Could not load availability' })
    }
  },

  select: (id) => {
    const s = get()
    if (id === s.selectedId) return
    if (s.hold) repo.release(s.hold.id, s.session).catch(() => {})
    if (s.hold || s.step === 'done') get().refresh()
    set({ selectedId: id && TABLE_BY_ID[id] ? id : null, step: 'details', hold: null, confirmed: null, error: null })
  },

  hover: (id) => { if (get().hoveredId !== id) set({ hoveredId: id }) },

  reserve: async () => {
    const s = get()
    if (!s.selectedId || s.busy) return
    set({ busy: true, error: null })
    try {
      const hold = await repo.hold({ tableId: s.selectedId, date: s.date, time: s.time, guests: s.guests, sessionId: s.session })
      set((st) => {
        const rows = [...st.rows.filter((r) => r.id !== hold.id), hold]
        return { hold, rows, step: 'form', busy: false, status: recompute({ ...st, rows }) }
      })
    } catch (e) {
      set({ busy: false, error: e instanceof BookingError ? e.message : 'Could not hold this table. Please try again.' })
      get().refresh()
    }
  },

  confirm: async (c) => {
    const s = get()
    if (!s.hold || s.busy) return
    set({ busy: true, error: null })
    try {
      const res = await repo.confirm(s.hold.id, s.session, c)
      set((st) => {
        const rows = [...st.rows.filter((r) => r.id !== res.id), res]
        return { confirmed: res, hold: null, step: 'done', busy: false, rows, status: recompute({ ...st, rows }) }
      })
    } catch (e) {
      const expired = e instanceof BookingError && (e.code === 'expired' || e.code === 'conflict')
      set({ busy: false, error: e instanceof Error ? e.message : 'Booking failed', ...(expired ? { step: 'details', hold: null } : {}) })
      if (expired) get().refresh()
    }
  },

  back: () => {
    const s = get()
    if (s.hold) repo.release(s.hold.id, s.session).catch(() => {})
    set((st) => {
      const rows = st.rows.filter((r) => r.id !== s.hold?.id)
      return { step: 'details', hold: null, error: null, rows, status: recompute({ ...st, rows }) }
    })
  },

  close: () => get().select(null),

  setInsets: (i) => {
    const cur = get().insets
    const next = { ...cur, ...i }
    if (next.top !== cur.top || next.right !== cur.right || next.bottom !== cur.bottom || next.left !== cur.left) set({ insets: next })
  },

  camera: (cmd) => set((s) => ({ camCmd: { cmd, n: (s.camCmd?.n ?? 0) + 1 }, ...(cmd === 'top' ? { topView: !s.topView } : cmd === 'reset' ? { topView: false } : {}) })),
  setPanMode: (v) => set({ panMode: v }),
}))

// keep holds from blocking a table after the tab closes
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    const { hold, session } = useStore.getState()
    if (hold) repo.release(hold.id, session).catch(() => {})
  })
  // availability drifts as time passes (slots close, holds expire) — re-evaluate every minute
  setInterval(() => {
    const s = useStore.getState()
    if (document.visibilityState === 'visible' && s.step !== 'form') s.refresh()
  }, 60_000)
}
