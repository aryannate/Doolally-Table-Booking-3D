import type { TableStatus } from '../types'

/** Availability colours shared by the 3D scene, the 2D fallback and the UI. */
export const MARKER_COLOR: Record<TableStatus | 'selected', string> = {
  available: '#3fa465',
  booked: '#d9574c',
  blocked: '#d9574c',
  held: '#e9a02a',
  unfit: '#cfc7bb',
  past: '#cfc7bb',
  selected: '#2f7cf6',
}
