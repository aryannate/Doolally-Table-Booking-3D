import { VENUE } from '../config/venue'
import { TABLES } from '../data/layout'
import { conflicts } from '../lib/availability'
import { allSlots, fromMinutes, slotRange, toMinutes, venueISO, venueNow } from '../lib/time'
import type { Contact, Reservation, TableBlock } from '../types'
import { BookingError, makeRef, type ReservationRepo } from './repo'

/**
 * In-browser mock backend.
 * - Seeded, deterministic "other guests" bookings for every day (busier in the evening and at weekends).
 * - Your own bookings, cancellations and admin blocks persist in localStorage.
 * - All writes run synchronously inside one JS task, so the overlap check + insert is atomic,
 *   mirroring the Postgres exclusion constraint in supabase/schema.sql.
 */

const STORE_KEY = 'doolally.mock.v1'
const LATENCY = 220

interface Store {
  rows: Reservation[]
  cancelledSeeds: string[]
  blocks: TableBlock[]
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* storage unavailable */ }
  return { rows: [], cancelledSeeds: [], blocks: [] }
}

const wait = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms))

// small deterministic PRNG
function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = ['Aarav M.', 'Ishita R.', 'Kabir S.', 'Meera J.', 'Rohan D.', 'Sana K.', 'Vikram P.', 'Ananya G.', 'Neil F.', 'Tara B.']

function seedDay(date: string): Reservation[] {
  const rnd = hash(`doolally:${date}`)
  const weekday = new Date(venueISO(date, '12:00')).getUTCDay()
  const weekend = weekday === 0 || weekday === 5 || weekday === 6
  const out: Reservation[] = []
  const slots = allSlots()
  for (const t of TABLES) {
    // lunch and dinner sittings; evening is busier
    for (const [from, to, p] of [[0, 6, weekend ? 0.35 : 0.2], [12, slots.length - 1, weekend ? 0.62 : 0.45]] as const) {
      if (rnd() > p) continue
      const time = slots[from + Math.floor(rnd() * (to - from + 1))]
      const { start, end } = slotRange(date, time)
      if (conflicts(out, t.id, start, end).length) continue
      const guests = Math.max(t.minGuests, Math.min(t.capacity, 1 + Math.floor(rnd() * t.capacity)))
      out.push({
        id: `seed:${date}:${t.id}:${time}`, ref: `DLY-S${Math.floor(rnd() * 90000 + 10000)}`, tableId: t.id,
        start: start.toISOString(), end: end.toISOString(), guests, status: 'confirmed', createdAt: start.toISOString(),
        name: NAMES[Math.floor(rnd() * NAMES.length)], phone: '+91 98•••• ••' + Math.floor(rnd() * 90 + 10), source: 'seed',
      })
    }
  }
  // one table is mid-checkout by "another guest" around dinner so the amber state is visible
  const ht = TABLES[Math.floor(rnd() * TABLES.length)]
  const holdTime = fromMinutes(toMinutes('19:00') + 30 * Math.floor(rnd() * 3))
  const hr = slotRange(date, holdTime)
  if (!conflicts(out, ht.id, hr.start, hr.end).length) {
    out.push({
      id: `seed:${date}:${ht.id}:hold`, ref: '', tableId: ht.id, start: hr.start.toISOString(), end: hr.end.toISOString(),
      guests: ht.minGuests, status: 'held', sessionId: 'someone-else', expiresAt: new Date(Date.now() + 365 * 864e5).toISOString(),
      createdAt: new Date().toISOString(), source: 'seed',
    })
  }
  return out
}

const strip = (r: Reservation): Reservation => ({ ...r, name: undefined, phone: undefined, email: undefined })

export class MockRepo implements ReservationRepo {
  readonly label = 'Demo data (in-browser)'
  private store = load()

  private save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.store)) } catch { /* ignore */ }
  }

  /** re-read so several open tabs (= several "guests") see each other's holds */
  private sync() { this.store = load() }

  private all(date: string) {
    const dayStart = new Date(venueISO(date, '00:00')).getTime()
    const dayEnd = dayStart + 864e5
    const seeds = seedDay(date).filter((r) => !this.store.cancelledSeeds.includes(r.id))
    const own = this.store.rows.filter((r) => {
      const s = new Date(r.start).getTime()
      return s < dayEnd && new Date(r.end).getTime() > dayStart
    })
    return [...seeds, ...own]
  }

  private active(date: string) {
    const now = Date.now()
    return this.all(date).filter((r) => r.status === 'confirmed' || (r.status === 'held' && new Date(r.expiresAt!).getTime() > now))
  }

  async listDay(date: string) {
    await wait(120)
    this.sync()
    return this.active(date).map(strip)
  }

  async listBlocks(date: string) {
    this.sync()
    return this.store.blocks.filter((b) => b.date === date)
  }

  async hold({ tableId, date, time, guests, sessionId }: { tableId: string; date: string; time: string; guests: number; sessionId: string }) {
    await wait()
    const table = TABLES.find((t) => t.id === tableId)
    if (!table) throw new BookingError('invalid', 'Unknown table')
    if (guests > table.capacity || guests < table.minGuests) throw new BookingError('invalid', `This table seats ${table.minGuests}–${table.capacity}.`)
    if (this.store.blocks.some((b) => b.tableId === tableId && b.date === date)) throw new BookingError('conflict', 'This table is unavailable that day.')
    const { start, end } = slotRange(date, time)
    if (start.getTime() < Date.now()) throw new BookingError('invalid', 'That time has already passed.')
    // ── atomic section: check + insert in the same synchronous turn
    this.sync()
    this.store.rows = this.store.rows.filter((r) => !(r.status === 'held' && r.sessionId === sessionId))
    if (conflicts(this.all(date), tableId, start, end).length) throw new BookingError('conflict', 'Someone just took this table for that time.')
    const row: Reservation = {
      id: crypto.randomUUID(), ref: '', tableId, start: start.toISOString(), end: end.toISOString(), guests,
      status: 'held', sessionId, expiresAt: new Date(Date.now() + VENUE.holdMinutes * 60_000).toISOString(),
      createdAt: new Date().toISOString(), source: 'web',
    }
    this.store.rows.push(row)
    this.save()
    return { ...row }
  }

  async release(holdId: string, sessionId: string) {
    this.sync()
    this.store.rows = this.store.rows.filter((r) => !(r.id === holdId && r.sessionId === sessionId && r.status === 'held'))
    this.save()
  }

  async confirm(holdId: string, sessionId: string, contact: Contact) {
    await wait(380)
    this.sync()
    const row = this.store.rows.find((r) => r.id === holdId)
    if (!row || row.sessionId !== sessionId || row.status !== 'held') throw new BookingError('expired', 'Your hold was released. Please pick the table again.')
    if (new Date(row.expiresAt!).getTime() < Date.now()) throw new BookingError('expired', 'Your 5-minute hold expired. Please pick the table again.')
    const date = venueNow(new Date(row.start)).date
    if (conflicts(this.all(date), row.tableId, new Date(row.start), new Date(row.end), Date.now(), row.id).length)
      throw new BookingError('conflict', 'Someone just took this table for that time.')
    Object.assign(row, { status: 'confirmed', ref: makeRef(), name: contact.name, phone: contact.phone, email: contact.email, expiresAt: undefined })
    this.save()
    return { ...row }
  }

  async adminListDay(date: string) {
    await wait(100)
    this.sync()
    return this.all(date).filter((r) => r.status !== 'held' || new Date(r.expiresAt!).getTime() > Date.now())
      .sort((a, b) => a.start.localeCompare(b.start) || a.tableId.localeCompare(b.tableId))
  }

  async adminCancel(id: string) {
    this.sync()
    if (id.startsWith('seed:')) this.store.cancelledSeeds.push(id)
    else this.store.rows = this.store.rows.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r))
    this.save()
  }

  async adminSetBlock(tableId: string, date: string, blocked: boolean) {
    this.sync()
    this.store.blocks = this.store.blocks.filter((b) => !(b.tableId === tableId && b.date === date))
    if (blocked) this.store.blocks.push({ tableId, date })
    this.save()
  }
}
