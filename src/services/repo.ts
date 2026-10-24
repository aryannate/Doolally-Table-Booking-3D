import type { Contact, Reservation, TableBlock } from '../types'

export class BookingError extends Error {
  constructor(public code: 'conflict' | 'expired' | 'invalid' | 'network' | 'auth', message: string) {
    super(message)
  }
}

/**
 * Persistence boundary. The customer UI and the admin page only talk to this interface,
 * so swapping the mock for Supabase (or any backend) touches nothing else.
 *
 * Contract every implementation must keep:
 *  - `hold` and `confirm` are atomic: two overlapping active rows for one table can never exist.
 *  - `listDay` never returns guest contact details to the public UI.
 */
export interface ReservationRepo {
  readonly label: string
  /** active rows (confirmed + unexpired holds) touching this venue-local date, contact fields stripped */
  listDay(date: string): Promise<Reservation[]>
  listBlocks(date: string): Promise<TableBlock[]>
  /** place a short hold on a table; throws BookingError('conflict') if anything overlaps */
  hold(input: { tableId: string; date: string; time: string; guests: number; sessionId: string }): Promise<Reservation>
  release(holdId: string, sessionId: string): Promise<void>
  /** turn a live hold into a confirmed reservation */
  confirm(holdId: string, sessionId: string, contact: Contact): Promise<Reservation>

  // ── admin (separate surface; protect with auth in production)
  adminListDay(date: string): Promise<Reservation[]>
  adminCancel(id: string): Promise<void>
  adminSetBlock(tableId: string, date: string, blocked: boolean): Promise<void>
}

export function makeRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  const buf = new Uint32Array(5)
  crypto.getRandomValues(buf)
  for (const n of buf) s += alphabet[n % alphabet.length]
  return `DLY-${s}`
}

export function sessionId() {
  const KEY = 'doolally.session'
  try {
    const existing = sessionStorage.getItem(KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}
