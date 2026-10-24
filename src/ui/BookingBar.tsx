import { useMemo, useRef } from 'react'
import logoWord from '../assets/logo-word.png'
import logoMark from '../assets/logo-mark.png'
import { VENUE } from '../config/venue'
import { TABLES } from '../data/layout'
import { fitsAnyTable } from '../lib/availability'
import { addDays, formatDateShort, formatTime, openSlots, venueNow } from '../lib/time'
import { useStore } from '../state/store'
import { IconCalendar, IconChevron, IconClock, IconMinus, IconPlus, IconUsers } from './icons'

function DatePill({ compact }: { compact?: boolean }) {
  const date = useStore((s) => s.date)
  const setQuery = useStore((s) => s.setQuery)
  const input = useRef<HTMLInputElement>(null)
  const today = venueNow().date
  const label = date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : formatDateShort(date)
  return (
    <label className="pill relative cursor-pointer">
      {!compact && <IconCalendar className="shrink-0 text-ink-mute" width={16} height={16} />}
      <span className="truncate whitespace-nowrap">{label}</span>
      <IconChevron className="shrink-0 text-ink-mute" />
      <input
        ref={input}
        type="date"
        aria-label="Booking date"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={date}
        min={today}
        max={addDays(today, VENUE.bookingWindowDays)}
        onClick={(e) => { try { e.currentTarget.showPicker() } catch { /* older browsers open on focus */ } }}
        onChange={(e) => e.target.value && setQuery({ date: e.target.value })}
      />
    </label>
  )
}

function TimePill({ compact }: { compact?: boolean }) {
  const date = useStore((s) => s.date)
  const time = useStore((s) => s.time)
  const setQuery = useStore((s) => s.setQuery)
  const slots = useMemo(() => openSlots(date), [date])
  return (
    <label className="pill relative">
      {!compact && <IconClock className="shrink-0 text-ink-mute" width={16} height={16} />}
      <span className="truncate whitespace-nowrap">{slots.length ? formatTime(time) : 'Closed'}</span>
      <IconChevron className="shrink-0 text-ink-mute" />
      <select aria-label="Booking time" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={time} onChange={(e) => setQuery({ time: e.target.value })}>
        {slots.map((s) => <option key={s} value={s}>{formatTime(s)}</option>)}
      </select>
    </label>
  )
}

function GuestsPill({ compact }: { compact?: boolean }) {
  const guests = useStore((s) => s.guests)
  const setQuery = useStore((s) => s.setQuery)
  return (
    <div className="pill gap-0 px-1.5" role="group" aria-label="Number of guests">
      <button className="step-btn" aria-label="Fewer guests" disabled={guests <= 1} onClick={() => setQuery({ guests: guests - 1 })}><IconMinus width={15} height={15} /></button>
      <span className={`flex items-center justify-center gap-1.5 ${compact ? 'min-w-[46px]' : 'min-w-[64px]'}`} aria-live="polite">
        <IconUsers className="text-ink-mute" width={16} height={16} />
        <span className="tabular-nums">{guests}</span>
        <span className="sr-only">guests</span>
      </span>
      <button className="step-btn" aria-label="More guests" disabled={guests >= VENUE.maxGuests} onClick={() => setQuery({ guests: guests + 1 })}><IconPlus width={15} height={15} /></button>
    </div>
  )
}

export function Legend({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-[11px] font-medium text-ink-soft ${className}`} aria-hidden>
      <span className="flex items-center gap-1.5"><i className="dot bg-avail" />Available</span>
      <span className="flex items-center gap-1.5"><i className="dot bg-booked" />Booked</span>
      <span className="flex items-center gap-1.5"><i className="dot bg-held" />On hold</span>
    </div>
  )
}

function Notice() {
  const guests = useStore((s) => s.guests)
  const date = useStore((s) => s.date)
  const status = useStore((s) => s.status)
  const loading = useStore((s) => s.loading)
  const open = openSlots(date).length > 0
  let msg: string | null = null
  if (!open) msg = 'No more bookable times today — pick another date.'
  else if (!fitsAnyTable(TABLES, guests)) msg = `For ${guests}+ guests, call the taproom and we'll put tables together.`
  else if (!loading && !Object.values(status).some((s) => s === 'available')) msg = 'Fully booked at this time — try another time.'
  if (!msg) return null
  return <div className="pointer-events-auto mt-2 rounded-xl bg-ink px-3 py-2 text-center text-xs font-medium text-white shadow-pill" role="status">{msg}</div>
}

/** Desktop & tablet: logo top-left, booking controls top-centre/right. Phone: one compact card. */
export function BookingBar({ layout, measureRef }: { layout: 'wide' | 'compact'; measureRef: (el: HTMLElement | null) => void }) {
  if (layout === 'compact') {
    return (
      <header ref={measureRef} className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-[max(10px,env(safe-area-inset-top))]">
        <div className="pointer-events-auto rounded-2xl bg-paper-card/95 p-2.5 shadow-card backdrop-blur">
          <div className="mb-2 flex items-center justify-between px-1">
            <h1 className="flex items-center gap-2">
              <img src={logoMark} alt="" className="h-[18px] w-auto" />
              <img src={logoWord} alt="Doolally" className="h-[13px] w-auto" />
            </h1>
            <Legend className="gap-2 text-[10px]" />
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 [&_.pill]:justify-between [&_.pill]:px-2.5">
            <DatePill compact />
            <TimePill compact />
            <GuestsPill compact />
          </div>
        </div>
        <Notice />
      </header>
    )
  }
  return (
    <header ref={measureRef} className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-5 pt-[max(18px,env(safe-area-inset-top))]">
      <h1 className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-paper-card/95 px-4 py-3 shadow-pill backdrop-blur">
        <img src={logoMark} alt="" className="h-6 w-auto" />
        <span className="flex flex-col">
          <img src={logoWord} alt="Doolally" className="h-[14px] w-auto self-start" />
          <span className="mt-1 text-[11px] font-medium tracking-wide text-ink-mute">Taproom · Book a table</span>
        </span>
      </h1>
      <div className="flex flex-col items-end">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl bg-paper-card/95 p-1.5 shadow-pill backdrop-blur">
          <DatePill />
          <TimePill />
          <GuestsPill />
        </div>
        <Notice />
      </div>
    </header>
  )
}
