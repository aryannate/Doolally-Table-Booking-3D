import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VENUE } from '../config/venue'
import { TABLE_BY_ID, TABLES, ZONES } from '../data/layout'
import { nextFreeSlot } from '../lib/availability'
import { formatDateLong, formatDateShort, formatDuration, formatInstantTime, formatTime, fromMinutes, toMinutes } from '../lib/time'
import { useStore } from '../state/store'
import type { TableStatus } from '../types'
import { IconBack, IconCalendar, IconCheck, IconClock, IconClose, IconUsers } from './icons'

const STATUS: Record<TableStatus, { label: string; dot: string; text: string }> = {
  available: { label: 'Available', dot: 'bg-avail', text: 'text-avail' },
  booked: { label: 'Booked at this time', dot: 'bg-booked', text: 'text-booked' },
  held: { label: 'Someone is booking this table', dot: 'bg-held', text: 'text-[#b57711]' },
  unfit: { label: '', dot: 'bg-[#cfc7bb]', text: 'text-ink-soft' },
  blocked: { label: 'Not available on this date', dot: 'bg-booked', text: 'text-booked' },
  past: { label: 'This time has passed', dot: 'bg-[#cfc7bb]', text: 'text-ink-soft' },
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 text-[14px] text-ink"><span className="text-ink-mute">{icon}</span>{children}</div>
}

function Details() {
  const id = useStore((s) => s.selectedId)!
  const st = useStore((s) => s.status[s.selectedId!])
  const { date, time, guests, rows, blocks, session, busy, error, loading } = useStore()
  const reserve = useStore((s) => s.reserve)
  const setQuery = useStore((s) => s.setQuery)
  const t = TABLE_BY_ID[id]
  const s = STATUS[st ?? 'available']
  const end = fromMinutes(toMinutes(time) + VENUE.durationMinutes)
  const alt = useMemo(() => (st === 'booked' || st === 'held' ? nextFreeSlot(t, { date, time, guests }, rows, blocks, session) : null), [st, t, date, time, guests, rows, blocks, session])
  const unfitText = guests > t.capacity ? `Seats up to ${t.capacity} — too small for ${guests}` : `Best for ${t.minGuests}+ guests`
  const better = useMemo(() => (st === 'unfit' ? TABLES.find((x) => useStore.getState().status[x.id] === 'available' && x.zone === t.zone) ?? TABLES.find((x) => useStore.getState().status[x.id] === 'available') : null), [st, t])
  const select = useStore((s) => s.select)

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Table</p>
      <h2 className="font-slab text-[30px] font-bold leading-none tracking-tight text-ink">{t.id}</h2>
      <p className="mt-1.5 text-[14px] text-ink-soft">{ZONES[t.zone].label}{ZONES[t.zone].outdoor ? ' · Outdoors' : ''} · {t.kind === 'counter' ? `${t.capacity} seats` : `Seats ${t.capacity}`}</p>

      <div className={`mt-3 flex items-center gap-2 text-[13px] font-semibold ${s.text}`} role="status">
        <i className={`dot ${s.dot}`} />
        {loading && !st ? 'Checking…' : st === 'unfit' ? unfitText : s.label}
      </div>

      <div className="mt-4 space-y-2 border-t border-paper-line pt-4">
        <Row icon={<IconCalendar width={16} height={16} />}>{formatDateLong(date)}</Row>
        <Row icon={<IconClock width={16} height={16} />}>{formatTime(time)} – {formatTime(end)}</Row>
        <Row icon={<IconUsers width={16} height={16} />}>{guests} {guests === 1 ? 'guest' : 'guests'}</Row>
      </div>

      {error && <p className="mt-3 rounded-lg bg-[#fdeceb] px-3 py-2 text-[13px] text-booked" role="alert">{error}</p>}

      {st === 'available' && (
        <button className="btn-primary mt-5" onClick={reserve} disabled={busy}>{busy ? 'Holding table…' : 'Reserve Table'}</button>
      )}
      {alt && (
        <button className="btn-secondary mt-5" onClick={() => setQuery({ time: alt })}>Free at {formatTime(alt)} — switch time</button>
      )}
      {(st === 'booked' || st === 'held') && !alt && <p className="mt-5 text-[13px] text-ink-soft">No other free times for this table on {formatDateShort(date)}.</p>}
      {st === 'unfit' && better && (
        <button className="btn-secondary mt-5" onClick={() => select(better.id)}>Show {better.id} — fits {guests}</button>
      )}
    </div>
  )
}

function useCountdown(iso?: string) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!iso) return
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [iso])
  if (!iso) return null
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000))
}

const PHONE = /^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Form() {
  const { selectedId, date, guests, hold, busy, error } = useStore()
  const confirm = useStore((s) => s.confirm)
  const back = useStore((s) => s.back)
  const t = TABLE_BY_ID[selectedId!]
  const left = useCountdown(hold?.expiresAt)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => { first.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => {
    if (left === 0) { back(); useStore.setState({ error: `Your ${VENUE.holdMinutes}-minute hold ran out. Tap Reserve to try again.` }) }
  }, [left, back])

  const errs = {
    name: name.trim().length < 2 ? 'Please enter your name' : '',
    phone: !PHONE.test(phone.trim()) ? 'Enter a 10-digit mobile number' : '',
    email: email.trim() && !EMAIL.test(email.trim()) ? 'That email looks incomplete' : '',
  }
  const valid = !errs.name && !errs.phone && !errs.email
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (valid) confirm({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined })
  }
  if (!hold) return null
  const mm = left != null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''

  return (
    <form onSubmit={submit} noValidate>
      <button type="button" onClick={back} className="-ml-1 mb-2 flex items-center gap-1 text-[13px] font-medium text-ink-soft hover:text-ink"><IconBack width={16} height={16} />Back</button>
      <h2 className="font-slab text-[22px] font-bold leading-tight text-ink">Reserve {t.id}</h2>
      <div className="mt-3 rounded-xl bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-ink">
        <div className="flex justify-between gap-3"><span className="text-ink-soft">Table</span><span className="text-right font-medium">{t.id} · {ZONES[t.zone].label}</span></div>
        <div className="flex justify-between gap-3"><span className="text-ink-soft">When</span><span className="text-right font-medium">{formatDateShort(date)}, {formatInstantTime(hold.start)} – {formatInstantTime(hold.end)}</span></div>
        <div className="flex justify-between gap-3"><span className="text-ink-soft">Guests</span><span className="font-medium">{guests}</span></div>
        <div className="flex justify-between gap-3"><span className="text-ink-soft">Duration</span><span className="font-medium">{formatDuration(VENUE.durationMinutes)}</span></div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-[#b57711]" aria-live="off"><i className="dot bg-held" />Held for you · {mm}</p>

      <div className="mt-4 space-y-3">
        <Field label="Name" error={touched ? errs.name : ''}>
          <input ref={first} className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Phone" error={touched ? errs.phone : ''}>
          <input className="field" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
        </Field>
        <Field label="Email" hint="optional" error={touched ? errs.email : ''}>
          <input className="field" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
      </div>
      {error && <p className="mt-3 rounded-lg bg-[#fdeceb] px-3 py-2 text-[13px] text-booked" role="alert">{error}</p>}
      <button type="submit" className="btn-primary mt-5" disabled={busy}>{busy ? 'Confirming…' : 'Confirm reservation'}</button>
    </form>
  )
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-[12px] font-medium text-ink-soft">{label}{hint && <span className="text-ink-mute">{hint}</span>}</span>
      {children}
      {error && <span className="mt-1 block text-[12px] text-booked">{error}</span>}
    </label>
  )
}

function ics(r: { ref: string; start: string; end: string; tableId: string }) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Doolally//Booking//EN', 'BEGIN:VEVENT', `UID:${r.ref}@doolally`, `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(r.start)}`, `DTEND:${f(r.end)}`, `SUMMARY:Doolally Taproom · Table ${r.tableId}`, `DESCRIPTION:Booking reference ${r.ref}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  return URL.createObjectURL(new Blob([body], { type: 'text/calendar' }))
}

// downloads are blocked inside sandboxed embeds (e.g. a hosted preview frame)
const canDownload = (() => { try { return window.self === window.top } catch { return false } })()

function Done() {
  const r = useStore((s) => s.confirmed)!
  const guests = r.guests
  const close = useStore((s) => s.close)
  const t = TABLE_BY_ID[r.tableId]
  const href = useMemo(() => ics(r), [r])
  useEffect(() => () => URL.revokeObjectURL(href), [href])
  return (
    <div className="text-center">
      <div className="mx-auto mt-1 flex h-12 w-12 items-center justify-center rounded-full bg-sel text-white"><IconCheck width={24} height={24} strokeWidth={2.4} /></div>
      <h2 className="mt-3 font-slab text-[24px] font-bold text-ink">You're booked</h2>
      <p className="mt-1 text-[13px] text-ink-soft">Show this reference when you arrive</p>
      <p className="mt-3 inline-block rounded-xl bg-paper px-4 py-2 font-mono text-[20px] font-semibold tracking-[0.12em] text-ink" aria-label={`Reference ${r.ref.split('').join(' ')}`}>{r.ref}</p>
      <div className="mt-4 space-y-1 text-[13px] text-ink">
        <p className="font-medium">Table {t.id} · {ZONES[t.zone].label}</p>
        <p className="text-ink-soft">{formatDateLong(new Date(r.start).toLocaleDateString('en-CA', { timeZone: VENUE.timezone }))}, {formatInstantTime(r.start)} · {guests} {guests === 1 ? 'guest' : 'guests'} · {formatDuration(VENUE.durationMinutes)}</p>
        {r.name && <p className="text-ink-soft">Booked for {r.name}</p>}
      </div>
      <div className={`mt-5 grid gap-2 ${canDownload ? 'grid-cols-2' : ''}`}>
        {canDownload && <a className="btn-secondary" href={href} download={`doolally-${r.ref}.ics`}>Add to calendar</a>}
        <button className="btn-primary" onClick={close}>Done</button>
      </div>
    </div>
  )
}

function Content() {
  const step = useStore((s) => s.step)
  return step === 'form' ? <Form /> : step === 'done' ? <Done /> : <Details />
}

/**
 * The floating details card (desktop / landscape) or bottom sheet (phones, portrait tablets).
 * It reports its footprint so the camera can keep the selected table in the uncovered area.
 */
export function TablePanel({ mode, measureRef }: { mode: 'side' | 'sheet'; measureRef: (el: HTMLElement | null) => void }) {
  const selectedId = useStore((s) => s.selectedId)
  const close = useStore((s) => s.close)
  const step = useStore((s) => s.step)
  const [shown, setShown] = useState<string | null>(selectedId)
  const drag = useRef<{ y: number; dy: number } | null>(null)
  const sheet = useRef<HTMLDivElement | null>(null)
  const open = !!selectedId
  const sheetRef = useCallback((el: HTMLDivElement | null) => { sheet.current = el; measureRef(open ? el : null) }, [open, measureRef])

  // keep the last table rendered while the panel animates out
  useEffect(() => { if (selectedId) setShown(selectedId) }, [selectedId])
  const id = selectedId ?? shown
  if (!id) return null

  if (mode === 'side') {
    return (
      <aside
        ref={open ? measureRef : undefined}
        aria-label={`Table ${id}`}
        className={`absolute right-5 top-[104px] z-30 w-[340px] max-w-[calc(100vw-40px)] rounded-[22px] bg-paper-card p-5 shadow-card transition-all duration-300 ease-out ${open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0'}`}
        style={{ maxHeight: 'calc(100% - 124px)', overflowY: 'auto' }}
      >
        {step !== 'done' && (
          <button onClick={close} aria-label="Close" className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full text-ink-mute hover:bg-paper hover:text-ink"><IconClose width={16} height={16} /></button>
        )}
        {open && <Content />}
      </aside>
    )
  }

  const onDown = (e: React.PointerEvent) => { drag.current = { y: e.clientY, dy: 0 }; (e.target as HTMLElement).setPointerCapture(e.pointerId) }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !sheet.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    sheet.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const onUp = () => {
    if (!drag.current || !sheet.current) return
    const far = drag.current.dy > 70
    sheet.current.style.transform = ''
    drag.current = null
    if (far) close()
  }

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label={`Table ${id}`}
      className={`absolute inset-x-0 bottom-0 z-30 mx-auto max-w-[560px] rounded-t-[24px] bg-paper-card shadow-[0_-8px_30px_-8px_rgba(40,30,20,.22)] transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'pointer-events-none translate-y-[105%]'}`}
      style={{ maxHeight: '78dvh' }}
    >
      <div className="flex touch-none justify-center pb-1 pt-2.5" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="h-1.5 w-10 rounded-full bg-[#ddd5ca]" />
      </div>
      {step !== 'done' && (
        <button onClick={close} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-mute active:bg-paper"><IconClose width={17} height={17} /></button>
      )}
      <div className="overflow-y-auto px-5 pb-[max(18px,env(safe-area-inset-bottom))]" style={{ maxHeight: 'calc(78dvh - 24px)' }}>
        {open && <Content />}
      </div>
    </div>
  )
}
