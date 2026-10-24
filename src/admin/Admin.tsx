import { useCallback, useEffect, useState } from 'react'
import logoWord from '../assets/logo-word.png'
import { TABLES, ZONES } from '../data/layout'
import { addDays, formatDateLong, formatInstantTime, venueNow } from '../lib/time'
import { repo } from '../services'
import { SupabaseRepo } from '../services/supabaseRepo'
import type { Reservation, TableBlock } from '../types'

/**
 * Staff view, kept apart from the guest experience (open at #/admin).
 * Demo mode uses a local PIN; with Supabase configured it signs in through Supabase Auth
 * and every admin RPC re-checks `is_admin()` server-side.
 */
const DEMO_PIN = '2580'

function Gate({ onPass }: { onPass: () => void }) {
  const live = repo instanceof SupabaseRepo
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (live) {
      try { await (repo as SupabaseRepo).signIn(a, b); onPass() } catch { setErr('Sign-in failed') }
    } else if (a === DEMO_PIN) {
      try { sessionStorage.setItem('doolally.admin', '1') } catch { /* ignore */ }
      onPass()
    } else setErr('Incorrect PIN')
  }
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-paper p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[22px] bg-paper-card p-6 shadow-card">
        <img src={logoWord} alt="Doolally" className="h-4" />
        <h1 className="mt-4 font-slab text-2xl font-bold">Staff sign-in</h1>
        {live ? (
          <>
            <input className="field mt-4" type="email" placeholder="Email" value={a} onChange={(e) => setA(e.target.value)} />
            <input className="field mt-2" type="password" placeholder="Password" value={b} onChange={(e) => setB(e.target.value)} />
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft">Demo PIN: {DEMO_PIN}</p>
            <input className="field mt-4" inputMode="numeric" placeholder="PIN" value={a} onChange={(e) => setA(e.target.value)} autoFocus />
          </>
        )}
        {err && <p className="mt-2 text-sm text-booked">{err}</p>}
        <button className="btn-primary mt-4">Continue</button>
        <a href="#/" className="mt-3 block text-center text-sm text-ink-soft">← Back to booking</a>
      </form>
    </div>
  )
}

export default function Admin() {
  const [ok, setOk] = useState(() => {
    try { return repo instanceof SupabaseRepo ? (repo as SupabaseRepo).isSignedIn : sessionStorage.getItem('doolally.admin') === '1' } catch { return false }
  })
  const today = venueNow().date
  const [date, setDate] = useState(today)
  const [rows, setRows] = useState<Reservation[]>([])
  const [blocks, setBlocks] = useState<TableBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [armed, setArmed] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const [r, b] = await Promise.all([repo.adminListDay(date), repo.listBlocks(date)])
      setRows(r)
      setBlocks(b)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [date])
  useEffect(() => { if (ok) load() }, [ok, load])

  if (!ok) return <Gate onPass={() => setOk(true)} />

  const confirmed = rows.filter((r) => r.status === 'confirmed')
  const covers = confirmed.reduce((a, r) => a + r.guests, 0)

  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-paper-line bg-paper-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <img src={logoWord} alt="Doolally" className="h-3.5" />
          <span className="text-sm font-semibold text-ink-soft">Reservations</span>
          <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink-mute">{repo.label}</span>
          <div className="ml-auto flex items-center gap-2">
            <button className="pill" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
            <input type="date" className="pill" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
            <button className="pill" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
            <a href="#/" className="pill">Guest view</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <h1 className="font-slab text-2xl font-bold">{formatDateLong(date)}</h1>
          <p className="text-sm text-ink-soft">{confirmed.length} bookings · {covers} covers{loading ? ' · loading…' : ''}</p>
        </div>
        {err && <p className="mt-3 text-sm text-booked">{err}</p>}

        <section className="mt-5 overflow-hidden rounded-2xl bg-paper-card shadow-pill">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-paper text-[11px] uppercase tracking-wider text-ink-mute">
                <tr>{['Time', 'Table', 'Guests', 'Name', 'Phone', 'Ref', 'Status', ''].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-mute">No reservations</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-paper-line">
                    <td className="px-4 py-2.5 tabular-nums">{formatInstantTime(r.start)}–{formatInstantTime(r.end)}</td>
                    <td className="px-4 py-2.5 font-medium">{r.tableId} <span className="text-ink-mute">{ZONES[TABLES.find((t) => t.id === r.tableId)!.zone].label}</span></td>
                    <td className="px-4 py-2.5 tabular-nums">{r.guests}</td>
                    <td className="px-4 py-2.5">{r.name ?? '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.phone ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.ref || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${r.status === 'held' ? 'text-[#b57711]' : r.status === 'cancelled' ? 'text-ink-mute' : 'text-avail'}`}>
                        <i className={`dot ${r.status === 'held' ? 'bg-held' : r.status === 'cancelled' ? 'bg-[#cfc7bb]' : 'bg-avail'}`} />{r.status}{r.source === 'seed' ? ' · demo' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.status !== 'cancelled' && (
                        armed === r.id ? (
                          <span className="inline-flex gap-2">
                            <button className="text-xs font-semibold text-booked hover:underline" onClick={async () => { setArmed(null); await repo.adminCancel(r.id); load() }}>Confirm cancel</button>
                            <button className="text-xs text-ink-soft hover:underline" onClick={() => setArmed(null)}>Keep</button>
                          </span>
                        ) : (
                          <button className="text-xs font-semibold text-booked hover:underline" onClick={() => setArmed(r.id)}>Cancel</button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Table availability on this date</h2>
          <p className="text-xs text-ink-soft">Switch a table off to stop it being booked (maintenance, private hire, walk-ins).</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {TABLES.map((t) => {
              const blocked = blocks.some((b) => b.tableId === t.id)
              return (
                <button key={t.id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm shadow-pill transition-colors ${blocked ? 'bg-[#fbe9e7] text-booked' : 'bg-paper-card'}`}
                  aria-pressed={!blocked}
                  onClick={async () => { await repo.adminSetBlock(t.id, date, !blocked); load() }}>
                  <span><span className="font-semibold">{t.id}</span><span className="block text-[11px] text-ink-mute">{ZONES[t.zone].label} · {t.capacity}</span></span>
                  <span className={`relative h-5 w-9 rounded-full transition-colors ${blocked ? 'bg-[#e5d4d1]' : 'bg-avail'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${blocked ? 'left-0.5' : 'left-[18px]'}`} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
        <p className="mt-8 text-xs text-ink-mute">Times shown in venue time (Asia/Kolkata).</p>
      </main>
    </div>
  )
}
