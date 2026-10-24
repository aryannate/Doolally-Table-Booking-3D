export type ZoneId =
  | 'main'
  | 'booth'
  | 'bar'
  | 'counter'
  | 'communal'
  | 'banquette'
  | 'lounge'
  | 'patio'
  | 'sidewalk'

/** A bookable table, positioned in floor-plan pixel space of the supplied architectural plan. */
export interface TableDef {
  id: string
  zone: ZoneId
  /** centre in plan pixels (x → east / Waverly St, y → south / 13th St) */
  plan: { x: number; y: number }
  /** world-space centre in metres (x, z) */
  pos: [number, number]
  /** orientation in radians about the vertical axis */
  rotation: number
  capacity: number
  minGuests: number
  /** a seat at the bar/counter rather than a table */
  kind: 'table' | 'counter'
  bookable: boolean
}

export type TableStatus = 'available' | 'booked' | 'held' | 'unfit' | 'blocked' | 'past'

export interface Reservation {
  id: string
  ref: string
  tableId: string
  /** ISO timestamps with +05:30 offset */
  start: string
  end: string
  guests: number
  status: 'held' | 'confirmed' | 'cancelled'
  sessionId?: string
  expiresAt?: string
  name?: string
  phone?: string
  email?: string
  createdAt: string
  source?: 'seed' | 'web' | 'admin'
}

export interface TableBlock {
  tableId: string
  date: string // YYYY-MM-DD (venue local date)
}

export interface Contact {
  name: string
  phone: string
  email?: string
}
