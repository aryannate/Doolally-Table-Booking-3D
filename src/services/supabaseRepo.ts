import type { Contact, Reservation, TableBlock } from '../types'
import { BookingError, sessionId, type ReservationRepo } from './repo'

/**
 * Supabase implementation using plain PostgREST RPC calls (no SDK in the bundle).
 * All writes go through SECURITY DEFINER functions in supabase/schema.sql, where an
 * exclusion constraint makes double bookings impossible at the database level.
 */
interface Row {
  id: string; ref: string | null; table_id: string; starts_at: string; ends_at: string; guests: number
  status: Reservation['status']; session_id?: string | null; expires_at?: string | null
  guest_name?: string | null; guest_phone?: string | null; guest_email?: string | null; created_at: string
}

const toRes = (r: Row): Reservation => ({
  id: r.id, ref: r.ref ?? '', tableId: r.table_id, start: r.starts_at, end: r.ends_at, guests: r.guests, status: r.status,
  sessionId: r.session_id ?? undefined, expiresAt: r.expires_at ?? undefined, name: r.guest_name ?? undefined,
  phone: r.guest_phone ?? undefined, email: r.guest_email ?? undefined, createdAt: r.created_at, source: 'web',
})

export class SupabaseRepo implements ReservationRepo {
  readonly label = 'Live (Supabase)'
  private adminToken: string | null = null

  constructor(private url: string, private anonKey: string) {
    try { this.adminToken = sessionStorage.getItem('doolally.admin.token') } catch { /* ignore */ }
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>, asAdmin = false): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: this.anonKey,
          Authorization: `Bearer ${asAdmin && this.adminToken ? this.adminToken : this.anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      })
    } catch {
      throw new BookingError('network', 'Could not reach the booking service. Check your connection.')
    }
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T
    const body = await res.json().catch(() => ({}))
    const code: string = body.code ?? ''
    const msg: string = body.message ?? 'Something went wrong'
    if (code === '23P01' || /overlap|taken/i.test(msg)) throw new BookingError('conflict', 'Someone just took this table for that time.')
    if (/expired|released/i.test(msg)) throw new BookingError('expired', msg)
    if (res.status === 401 || res.status === 403) throw new BookingError('auth', 'Admin sign-in required.')
    throw new BookingError('invalid', msg)
  }

  /** admin sign-in with Supabase Auth email/password */
  async signIn(email: string, password: string) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: this.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new BookingError('auth', 'Sign-in failed')
    const json = await res.json()
    this.adminToken = json.access_token
    try { sessionStorage.setItem('doolally.admin.token', json.access_token) } catch { /* ignore */ }
  }
  get isSignedIn() { return !!this.adminToken }

  async listDay(date: string) {
    return (await this.rpc<Row[]>('day_availability', { p_date: date, p_session: sessionId() })).map(toRes)
  }
  async listBlocks(date: string) {
    return (await this.rpc<{ table_id: string; block_date: string }[]>('day_blocks', { p_date: date })).map((b) => ({ tableId: b.table_id, date: b.block_date }) as TableBlock)
  }
  async hold(i: { tableId: string; date: string; time: string; guests: number; sessionId: string }) {
    return toRes(await this.rpc<Row>('hold_table', { p_table: i.tableId, p_date: i.date, p_time: i.time, p_guests: i.guests, p_session: i.sessionId }))
  }
  async release(holdId: string, sessionId: string) {
    await this.rpc('release_hold', { p_hold: holdId, p_session: sessionId })
  }
  async confirm(holdId: string, sessionId: string, c: Contact) {
    return toRes(await this.rpc<Row>('confirm_reservation', { p_hold: holdId, p_session: sessionId, p_name: c.name, p_phone: c.phone, p_email: c.email ?? null }))
  }
  async adminListDay(date: string) {
    return (await this.rpc<Row[]>('admin_day_reservations', { p_date: date }, true)).map(toRes)
  }
  async adminCancel(id: string) {
    await this.rpc('admin_cancel', { p_id: id }, true)
  }
  async adminSetBlock(tableId: string, date: string, blocked: boolean) {
    await this.rpc('admin_set_block', { p_table: tableId, p_date: date, p_blocked: blocked }, true)
  }
}
