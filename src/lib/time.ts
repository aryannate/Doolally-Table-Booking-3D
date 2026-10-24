import { VENUE } from '../config/venue'

/** All reservation maths happens in venue-local wall-clock time (Asia/Kolkata, fixed +05:30, no DST). */

const pad = (n: number) => String(n).padStart(2, '0')

/** Current venue-local date & minutes-since-midnight, regardless of the browser's own timezone. */
export function venueNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  const date = `${get('year')}-${get('month')}-${get('day')}`
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  return { date, minutes }
}

export const toMinutes = (hhmm: string) => {
  const [h, mm] = hhmm.split(':').map(Number)
  return h * 60 + mm
}
export const fromMinutes = (mins: number) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`

/** ISO instant for a venue-local date + time, e.g. 2026-10-25T19:00:00+05:30 */
export const venueISO = (date: string, hhmm: string) => `${date}T${hhmm}:00${VENUE.utcOffset}`

export function slotRange(date: string, hhmm: string, durationMinutes: number = VENUE.durationMinutes) {
  const start = new Date(venueISO(date, hhmm))
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return { start, end }
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00${VENUE.utcOffset}`)
  d.setUTCDate(d.getUTCDate() + days)
  return venueNow(d).date
}

export function allSlots(): string[] {
  const out: string[] = []
  for (let t = toMinutes(VENUE.firstSlot); t <= toMinutes(VENUE.lastSlot); t += VENUE.slotStepMinutes) out.push(fromMinutes(t))
  return out
}

/** Slots still bookable on `date` (drops past slots and those inside the lead time today). */
export function openSlots(date: string, now = new Date()): string[] {
  const n = venueNow(now)
  if (date < n.date) return []
  if (date > n.date) return allSlots()
  return allSlots().filter((s) => toMinutes(s) >= n.minutes + VENUE.leadMinutes)
}

/** Sensible default: today 7 PM if still open, otherwise the next open slot, otherwise tomorrow 7 PM. */
export function defaultBooking(now = new Date()) {
  const { date } = venueNow(now)
  const today = openSlots(date, now)
  if (today.includes('19:00')) return { date, time: '19:00' }
  if (today.length) return { date, time: today[0] }
  return { date: addDays(date, 1), time: '19:00' }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function fmt(opts: Intl.DateTimeFormatOptions) {
  const key = JSON.stringify(opts)
  if (!fmtCache.has(key)) fmtCache.set(key, new Intl.DateTimeFormat('en-IN', { timeZone: VENUE.timezone, ...opts }))
  return fmtCache.get(key)!
}

export const formatTime = (hhmm: string) => fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(venueISO('2026-01-01', hhmm))).toUpperCase()
export const formatDateLong = (date: string) => fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(venueISO(date, '12:00')))
export const formatDateShort = (date: string) => fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(venueISO(date, '12:00')))
export const formatInstantTime = (iso: string) => fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso)).toUpperCase()
export const formatDuration = (mins: number) => (mins % 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins / 60} hr${mins > 60 ? 's' : ''}`)
