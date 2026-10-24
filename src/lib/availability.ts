import { VENUE } from '../config/venue'
import type { Reservation, TableBlock, TableDef, TableStatus } from '../types'
import { openSlots, slotRange } from './time'

export interface Query {
  date: string
  time: string
  guests: number
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd

/** A reservation row still occupies its table (confirmed, or an unexpired hold). */
export function isActive(r: Reservation, now = Date.now()) {
  if (r.status === 'confirmed') return true
  if (r.status === 'held') return !!r.expiresAt && new Date(r.expiresAt).getTime() > now
  return false
}

export function conflicts(rows: Reservation[], tableId: string, start: Date, end: Date, now = Date.now(), ignoreId?: string) {
  const s = start.getTime(), e = end.getTime()
  return rows.filter((r) => r.tableId === tableId && r.id !== ignoreId && isActive(r, now) && overlaps(s, e, new Date(r.start).getTime(), new Date(r.end).getTime()))
}

/**
 * Status of one table for a date/time/party size.
 * `sessionId` lets a guest see their own hold as their own, not as "held".
 */
export function tableStatus(t: TableDef, q: Query, rows: Reservation[], blocks: TableBlock[], sessionId?: string, now = new Date()): TableStatus {
  if (!t.bookable || blocks.some((b) => b.tableId === t.id && b.date === q.date)) return 'blocked'
  if (!openSlots(q.date, now).includes(q.time)) return 'past'
  const { start, end } = slotRange(q.date, q.time)
  const hits = conflicts(rows, t.id, start, end, now.getTime())
  if (hits.some((r) => r.status === 'confirmed')) return 'booked'
  if (hits.some((r) => r.sessionId !== sessionId)) return 'held'
  if (q.guests > t.capacity || q.guests < t.minGuests) return 'unfit'
  return 'available'
}

export function statusMap(tables: TableDef[], q: Query, rows: Reservation[], blocks: TableBlock[], sessionId?: string, now = new Date()) {
  const out: Record<string, TableStatus> = {}
  for (const t of tables) out[t.id] = tableStatus(t, q, rows, blocks, sessionId, now)
  return out
}

/** Next open start time on the same date for this table (used to suggest an alternative). */
export function nextFreeSlot(t: TableDef, q: Query, rows: Reservation[], blocks: TableBlock[], sessionId?: string, now = new Date()) {
  const slots = openSlots(q.date, now)
  const from = slots.indexOf(q.time)
  for (let i = Math.max(0, from + 1); i < slots.length; i++) {
    if (tableStatus(t, { ...q, time: slots[i] }, rows, blocks, sessionId, now) === 'available') return slots[i]
  }
  for (let i = from - 1; i >= 0; i--) {
    if (tableStatus(t, { ...q, time: slots[i] }, rows, blocks, sessionId, now) === 'available') return slots[i]
  }
  return null
}

export const STATUS_LABEL: Record<TableStatus, string> = {
  available: 'Available',
  booked: 'Booked',
  held: 'On hold',
  unfit: 'Not suited to party size',
  blocked: 'Unavailable',
  past: 'Time has passed',
}

export const fitsAnyTable = (tables: TableDef[], guests: number) => tables.some((t) => guests <= t.capacity && guests >= t.minGuests)
export { VENUE }
