import { MockRepo } from './mockRepo'
import type { ReservationRepo } from './repo'
import { SupabaseRepo } from './supabaseRepo'

/**
 * Picks the backend. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example)
 * to switch from demo data to live availability — nothing else changes.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const repo: ReservationRepo = url && key ? new SupabaseRepo(url, key) : new MockRepo()
export { BookingError, sessionId } from './repo'
