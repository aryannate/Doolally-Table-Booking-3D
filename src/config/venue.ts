/** Venue configuration — every time calculation runs in the venue's own timezone. */
export const VENUE = {
  name: 'Doolally Taproom',
  timezone: 'Asia/Kolkata',
  utcOffset: '+05:30',
  /** first and last bookable start times (24h, venue local) */
  firstSlot: '12:00',
  lastSlot: '22:30',
  slotStepMinutes: 30,
  /** length of a reservation */
  durationMinutes: 120,
  /** a table is held for this long while the guest fills in their details */
  holdMinutes: 5,
  /** how far ahead guests can book */
  bookingWindowDays: 30,
  maxGuests: 8,
  /** minimum lead time before a slot can be booked */
  leadMinutes: 30,
} as const
