import * as THREE from 'three'
import type { Mat } from '../data/layout'
import { MARKER_COLOR } from '../config/colors'
import type { TableStatus } from '../types'

export const BG = '#f3efe9'

export const MAT_COLOR: Record<Mat, string> = {
  wood: '#d49c5a',
  woodLight: '#e4bf86',
  woodDark: '#9b6b40',
  cushion: '#f4f0e9',
  upholstery: '#ebdfcb',
  steel: '#cbcdd0',
  black: '#3b3734',
  white: '#f7f5f1',
  fridge: '#e8eaeb',
  plant: '#77a35c',
  plantDark: '#517f40',
  pot: '#cfbda5',
  glow: '#ffd8a0',
  bulb: '#fff3d6',
  chalk: '#2e3431',
}

export type MatClass = 'matte' | 'metal' | 'glow'
export const MAT_CLASS: Record<Mat, MatClass> = {
  wood: 'matte', woodLight: 'matte', woodDark: 'matte', cushion: 'matte', upholstery: 'matte', black: 'matte', white: 'matte',
  fridge: 'matte', plant: 'matte', plantDark: 'matte', pot: 'matte', chalk: 'matte',
  steel: 'metal', glow: 'glow', bulb: 'glow',
}

const SOFT_MATS = new Set<Mat>(['cushion', 'upholstery'])

const C = (hex: string) => new THREE.Color(hex)
export const COLORS = {
  sel: C('#2f7cf6'),
  selSoft: C('#8db8ff'),
  booked: C('#d4564b'),
  held: C('#f0a838'),
  fade: C('#efebe4'),
  hover: C('#9fc3ff'),
}

export { MARKER_COLOR }

const tmp = new THREE.Color()

/** Final colour of a furniture part that belongs to a table, given its state. */
export function tableTint(mat: Mat, base: THREE.Color, st: TableStatus | undefined, selected: boolean, anySelected: boolean, hovered: boolean, out: THREE.Color) {
  const soft = SOFT_MATS.has(mat)
  if (selected) return out.copy(soft ? COLORS.selSoft : COLORS.sel)
  out.copy(base)
  if (st === 'booked' || st === 'blocked') out.lerp(COLORS.booked, soft ? 0.6 : 0.64)
  else if (st === 'held') out.lerp(COLORS.held, soft ? 0.55 : 0.5)
  else if (st === 'unfit' || st === 'past') out.lerp(COLORS.fade, 0.62)
  else if (hovered) out.lerp(COLORS.hover, 0.38)
  if (anySelected) out.lerp(COLORS.fade, st === 'booked' || st === 'held' ? 0.45 : 0.6)
  return out
}

export function markerTint(st: TableStatus | undefined, selected: boolean, anySelected: boolean, out: THREE.Color) {
  out.set(MARKER_COLOR[selected ? 'selected' : st ?? 'unfit'])
  if (anySelected && !selected) out.lerp(tmp.copy(COLORS.fade), 0.55)
  return out
}
