import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({ width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p })

export const IconPlus = (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
export const IconMinus = (p: P) => <svg {...base(p)}><path d="M5 12h14" /></svg>
export const IconClose = (p: P) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const IconBack = (p: P) => <svg {...base(p)}><path d="M15 18l-6-6 6-6" /></svg>
export const IconCalendar = (p: P) => <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
export const IconClock = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
export const IconUsers = (p: P) => <svg {...base(p)}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3 3-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><path d="M15.5 5.6a3 3 0 010 5.8M17.5 14.6c1.6.6 2.7 2 3 4.4" /></svg>
export const IconRotL = (p: P) => <svg {...base(p)}><path d="M4 12a8 8 0 108-8 8.2 8.2 0 00-5.7 2.3L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>
export const IconRotR = (p: P) => <svg {...base(p)}><path d="M20 12a8 8 0 11-8-8 8.2 8.2 0 015.7 2.3L20 8.5" /><path d="M20 4v4.5h-4.5" /></svg>
export const IconHome = (p: P) => <svg {...base(p)}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
export const IconTop = (p: P) => <svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M4 11h9v9M13 4v7" /></svg>
export const IconHand = (p: P) => <svg {...base(p)}><path d="M12 3v9M12 3l-2.5 2.5M12 3l2.5 2.5M12 21v-9M12 21l-2.5-2.5M12 21l2.5-2.5M3 12h18M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" /></svg>
export const IconCheck = (p: P) => <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
export const IconChevron = (p: P) => <svg {...base({ width: 14, height: 14, ...p })}><path d="M6 9l6 6 6-6" /></svg>
export const IconSeat = (p: P) => <svg {...base(p)}><path d="M7 4v8h10M7 12v8M17 12v8M6 12h12" /></svg>
