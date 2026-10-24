/**
 * Doolally Taproom — floor plan reconstruction.
 *
 * Every coordinate below is measured in pixels on the supplied architectural floor plan
 * (Floorplan.jpeg, 1200×971) so the 3D scene can be checked against the drawing directly.
 * `w()` converts plan pixels to world metres. Scale was calibrated from the dimensioned
 * items on the plan (36"×36" tables, 18"×14ft counter, 18"×12ft bar).
 *
 * World axes: +x → east (Waverly Street), +z → south (13th Street), +y → up.
 */
import type { TableDef, ZoneId } from '../types'

export const S = 0.0215 // metres per plan pixel
export const ORIGIN = { x: 575, y: 500 }
export const w = (px: number, py: number): [number, number] => [(px - ORIGIN.x) * S, (py - ORIGIN.y) * S]
export const m = (px: number) => px * S

export const ZONES: Record<ZoneId, { label: string; outdoor?: boolean }> = {
  main: { label: 'Main Dining' },
  booth: { label: 'Window Booth' },
  bar: { label: 'Bar' },
  counter: { label: "Chef's Counter" },
  communal: { label: 'Communal Table' },
  banquette: { label: 'Banquette' },
  lounge: { label: 'Lounge' },
  patio: { label: 'Front Patio', outdoor: true },
  sidewalk: { label: 'Sidewalk', outdoor: true },
}

// ───────────────────────────────────────────── primitives ──

export type Shape = 'box' | 'cyl' | 'sphere' | 'dome'
export type Mat =
  | 'wood' // honey tabletops
  | 'woodLight' // pine chairs / stools
  | 'woodDark' // shelves, sideboards
  | 'cushion' // off-white seat pads
  | 'upholstery' // banquettes, armchairs
  | 'steel'
  | 'black'
  | 'white'
  | 'fridge'
  | 'plant'
  | 'plantDark'
  | 'pot'
  | 'glow'
  | 'bulb'
  | 'chalk'

export interface Prim {
  shape: Shape
  mat: Mat
  p: [number, number, number] // centre, metres
  s: [number, number, number] // full size, metres
  r: number // rotation about Y
  t?: string // owning table id (for highlight)
}

const prims: Prim[] = []
let owner: string | undefined

/** rotate a local (lx, lz) offset around a centre by `rot` */
function place(cx: number, cz: number, rot: number, lx: number, lz: number): [number, number] {
  const c = Math.cos(rot), s = Math.sin(rot)
  return [cx + lx * c + lz * s, cz - lx * s + lz * c]
}

function box(mat: Mat, cx: number, cz: number, rot: number, l: [number, number, number], s: [number, number, number]) {
  const [x, z] = place(cx, cz, rot, l[0], l[2])
  prims.push({ shape: 'box', mat, p: [x, l[1], z], s, r: rot, t: owner })
}
function cyl(mat: Mat, cx: number, cz: number, rot: number, l: [number, number, number], d: number, h: number) {
  const [x, z] = place(cx, cz, rot, l[0], l[2])
  prims.push({ shape: 'cyl', mat, p: [x, l[1], z], s: [d, h, d], r: rot, t: owner })
}
/** axis-aligned box from a plan rectangle; y0..y1 in metres */
function rect(mat: Mat, x1: number, y1: number, x2: number, y2: number, h0: number, h1: number) {
  const [ax, az] = w(x1, y1), [bx, bz] = w(x2, y2)
  prims.push({ shape: 'box', mat, p: [(ax + bx) / 2, (h0 + h1) / 2, (az + bz) / 2], s: [Math.abs(bx - ax), h1 - h0, Math.abs(bz - az)], r: 0, t: owner })
}

/** facing angle so local +z points from (x,z) toward (tx,tz) */
const face = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z)

// ──────────────────────────────────────────── furniture kit ──

function chair(x: number, z: number, rot: number) {
  // sitter faces local +z; backrest at −z
  box('woodLight', x, z, rot, [0, 0.45, 0], [0.44, 0.04, 0.42])
  box('cushion', x, z, rot, [0, 0.487, 0.015], [0.39, 0.035, 0.36])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('woodLight', x, z, rot, [sx * 0.19, 0.225, sz * 0.18], [0.035, 0.45, 0.035])
  for (const sx of [-1, 1]) box('woodLight', x, z, rot, [sx * 0.19, 0.66, -0.19], [0.035, 0.42, 0.035])
  box('woodLight', x, z, rot, [0, 0.8, -0.19], [0.42, 0.13, 0.03])
  box('woodLight', x, z, rot, [0, 0.63, -0.19], [0.42, 0.045, 0.025])
}

function stool(x: number, z: number, rot: number, h = 0.75, back = true) {
  cyl('woodLight', x, z, rot, [0, h, 0], 0.36, 0.045)
  cyl('cushion', x, z, rot, [0, h + 0.035, 0], 0.31, 0.03)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('woodLight', x, z, rot, [sx * 0.12, h / 2, sz * 0.12], [0.032, h, 0.032])
  box('woodLight', x, z, rot, [0, h * 0.38, 0.12], [0.26, 0.025, 0.025])
  if (back) {
    for (const sx of [-1, 1]) box('woodLight', x, z, rot, [sx * 0.12, h + 0.17, -0.13], [0.03, 0.3, 0.03])
    box('woodLight', x, z, rot, [0, h + 0.27, -0.13], [0.3, 0.11, 0.028])
  }
}

function armchair(x: number, z: number, rot: number) {
  box('upholstery', x, z, rot, [0, 0.22, 0], [0.64, 0.3, 0.62])
  box('cushion', x, z, rot, [0, 0.4, 0.04], [0.46, 0.08, 0.5])
  box('upholstery', x, z, rot, [0, 0.58, -0.25], [0.64, 0.44, 0.13])
  for (const sx of [-1, 1]) box('upholstery', x, z, rot, [sx * 0.26, 0.5, 0], [0.12, 0.26, 0.62])
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('woodDark', x, z, rot, [sx * 0.26, 0.04, sz * 0.25], [0.04, 0.08, 0.04])
}

/** table centred at (x,z) — width along local x, depth along local z */
function table(x: number, z: number, rot: number, wid: number, dep: number, h = 0.75) {
  box('wood', x, z, rot, [0, h - 0.025, 0], [wid, 0.05, dep])
  const ix = wid / 2 - 0.06, iz = dep / 2 - 0.06
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('wood', x, z, rot, [sx * ix, (h - 0.05) / 2, sz * iz], [0.06, h - 0.05, 0.06])
  if (h > 0.9) box('wood', x, z, rot, [0, 0.3, 0], [wid - 0.1, 0.04, Math.max(0.04, dep - 0.1)])
}

/** banquette segment from a plan rectangle; back sits on the given side */
function bench(x1: number, y1: number, x2: number, y2: number, back: 'n' | 's' | 'e' | 'w') {
  rect('woodLight', x1, y1, x2, y2, 0, 0.4)
  const inset = 6 // plan px (~13cm) for the back cushion
  const r = { x1, y1, x2, y2 }
  const seat = { ...r }
  const bk = { ...r }
  if (back === 'n') { seat.y1 += inset; bk.y2 = y1 + inset }
  if (back === 's') { seat.y2 -= inset; bk.y1 = y2 - inset }
  if (back === 'e') { seat.x2 -= inset; bk.x1 = x2 - inset }
  if (back === 'w') { seat.x1 += inset; bk.x2 = x1 + inset }
  rect('upholstery', seat.x1, seat.y1, seat.x2, seat.y2, 0.4, 0.47)
  rect('upholstery', bk.x1, bk.y1, bk.x2, bk.y2, 0.4, 0.98)
}

// ─────────────────────────────────────────────── tables ──

interface Spec {
  id: string
  zone: ZoneId
  x: number
  y: number
  rot?: number
  capacity: number
  minGuests: number
  kind?: 'table' | 'counter'
  /** marker position override (plan px + height in m) */
  marker?: [number, number, number]
  build: (cx: number, cz: number) => void
}

const SPECS: Spec[] = []

// Main dining — six 36"×36" tables set on the diagonal, four chairs each.
const MAIN: [number, number][] = [[564, 539], [656, 539], [747, 539], [564, 675], [656, 675], [747, 675]]
MAIN.forEach(([x, y], i) => {
  SPECS.push({
    id: `T0${i + 1}`, zone: 'main', x, y, rot: Math.PI / 4, capacity: 4, minGuests: 2,
    build: (cx, cz) => {
      table(cx, cz, Math.PI / 4, 0.88, 0.88)
      for (const [dx, dy] of [[-25, -25], [25, -25], [-25, 25], [25, 25]]) {
        const [px, pz] = w(x + dx, y + dy)
        chair(px, pz, face(px, pz, cx, cz))
      }
    },
  })
})

// Window booth along Waverly Street — L-shaped banquette, one loose chair per table.
const BOOTH: { id: string; t: [number, number]; c: [number, number]; seg: [number, number, number, number, 'n' | 's' | 'e' | 'w'][] }[] = [
  { id: 'W01', t: [849, 452], c: [849, 484], seg: [[832, 405, 900, 432, 'n']] },
  { id: 'W02', t: [932, 452], c: [899, 452], seg: [[900, 405, 977, 432, 'n'], [950, 432, 977, 478, 'e']] },
  { id: 'W03', t: [932, 505], c: [899, 505], seg: [[950, 478, 977, 532, 'e']] },
  { id: 'W04', t: [932, 559], c: [899, 559], seg: [[950, 532, 977, 585, 'e']] },
  { id: 'W05', t: [932, 611], c: [899, 611], seg: [[950, 585, 977, 638, 'e']] },
  { id: 'W06', t: [932, 665], c: [899, 665], seg: [[950, 638, 977, 685, 'e']] },
  { id: 'W07', t: [849, 665], c: [849, 633], seg: [[817, 685, 905, 715, 's']] },
]
BOOTH.forEach((b) => {
  SPECS.push({
    id: b.id, zone: 'booth', x: b.t[0], y: b.t[1], capacity: 2, minGuests: 1,
    build: (cx, cz) => {
      table(cx, cz, 0, 0.72, 0.72)
      const [px, pz] = w(...b.c)
      chair(px, pz, face(px, pz, cx, cz))
      b.seg.forEach(([a, bb, c, d, side]) => bench(a, bb, c, d, side))
    },
  })
})

// Bar — seven stools on the east face of the 18"×12ft counter.
const BAR_Y = [456, 481, 506, 531, 556, 581, 606]
const BAR_GROUPS: [string, number[], number][] = [['B01', [0, 1], 2], ['B02', [2, 3], 2], ['B03', [4, 5, 6], 3]]
BAR_GROUPS.forEach(([id, idx, cap]) => {
  const ys = idx.map((i) => BAR_Y[i])
  const yc = ys.reduce((a, b) => a + b, 0) / ys.length
  SPECS.push({
    id, zone: 'bar', x: 307, y: yc, capacity: cap, minGuests: 1, kind: 'counter', marker: [285, yc, 1.075],
    build: () => ys.forEach((y) => { const [px, pz] = w(308, y); stool(px, pz, -Math.PI / 2) }),
  })
})

// Chef's counter — eight stools facing the open kitchen, booked in pairs.
const CC_X = [565, 590, 615, 640, 665, 690, 715, 740]
for (let i = 0; i < 4; i++) {
  const xs = [CC_X[i * 2], CC_X[i * 2 + 1]]
  const xc = (xs[0] + xs[1]) / 2
  SPECS.push({
    id: `C0${i + 1}`, zone: 'counter', x: xc, y: 452, capacity: 2, minGuests: 1, kind: 'counter', marker: [xc, 427, 1.075],
    build: () => xs.forEach((x) => { const [px, pz] = w(x, 453); stool(px, pz, Math.PI) }),
  })
}

// Communal high table between bar and dining room.
SPECS.push({
  id: 'H01', zone: 'communal', x: 424, y: 531, capacity: 6, minGuests: 3,
  build: (cx, cz) => {
    table(cx, cz, 0, 0.44, m(129), 1.05)
    for (const y of [480, 515, 550, 585]) { const [px, pz] = w(401, y); stool(px, pz, Math.PI / 2) }
    for (const y of [497, 565]) { const [px, pz] = w(447, y); stool(px, pz, -Math.PI / 2) }
  },
})

// Banquette under the glowing shelves — four 24"×24" tables.
const BANQ: [string, number, number, number][] = [['L01', 241, 200, 262], ['L02', 284, 262, 306], ['L03', 329, 306, 351], ['L04', 373, 351, 420]]
BANQ.forEach(([id, x, a, b]) => {
  SPECS.push({
    id, zone: 'banquette', x, y: 366, capacity: 2, minGuests: 1,
    build: (cx, cz) => {
      table(cx, cz, 0, 0.6, 0.6)
      const [px, pz] = w(x, 394)
      chair(px, pz, Math.PI)
      bench(a, 322, b, 349, 'n')
      if (id === 'L01') bench(200, 349, 214, 378, 'w')
      if (id === 'L04') bench(406, 349, 420, 378, 'e')
    },
  })
})

// Front lounge — armchairs and low stools by the 13th Street windows.
SPECS.push({
  id: 'F01', zone: 'lounge', x: 282, y: 675, capacity: 5, minGuests: 2,
  build: (cx, cz) => {
    table(cx, cz, 0, 0.74, 0.42, 0.5)
    for (const [ax, ay] of [[230, 652], [230, 696]]) { const [px, pz] = w(ax, ay); armchair(px, pz, face(px, pz, cx, cz)) }
    for (const [sx, sy] of [[282, 650], [260, 702], [292, 702]]) { const [px, pz] = w(sx, sy); stool(px, pz, face(px, pz, cx, cz), 0.45, false) }
  },
})
SPECS.push({
  id: 'F02', zone: 'lounge', x: 349, y: 675, capacity: 4, minGuests: 2,
  build: (cx, cz) => {
    table(cx, cz, 0, 0.74, 0.42, 0.5)
    for (const [sx, sy] of [[318, 661], [382, 652], [379, 691], [341, 702]]) { const [px, pz] = w(sx, sy); stool(px, pz, face(px, pz, cx, cz), 0.45, false) }
  },
})

// Front patio under the canopy line, and sidewalk seating along 13th Street.
const two = (x: number, y: number, gap = 32) => (cx: number, cz: number) => {
  table(cx, cz, 0, 0.72, 0.72)
  for (const d of [-gap, gap]) { const [px, pz] = w(x + d, y); chair(px, pz, face(px, pz, cx, cz)) }
}
;[[579, 757], [745, 757], [879, 757]].forEach(([x, y], i) =>
  SPECS.push({ id: `P0${i + 1}`, zone: 'patio', x, y, capacity: 2, minGuests: 1, build: two(x, y) }))
;[[138, 855], [272, 855], [447, 855], [578, 855], [742, 855], [880, 855]].forEach(([x, y], i) =>
  SPECS.push({ id: `S0${i + 1}`, zone: 'sidewalk', x, y, capacity: 2, minGuests: 1, build: two(x, y, 33) }))

// ── build table furniture
export const TABLES: TableDef[] = []
export const MARKERS: Record<string, [number, number, number]> = {}
for (const s of SPECS) {
  const [cx, cz] = w(s.x, s.y)
  owner = s.id
  const start = prims.length
  s.build(cx, cz)
  owner = undefined
  // marker sits on the tabletop (highest wood surface of this table)
  if (s.marker) {
    const [mx, mz] = w(s.marker[0], s.marker[1])
    MARKERS[s.id] = [mx, s.marker[2], mz]
  } else {
    let top = 0
    for (let i = start; i < prims.length; i++) if (prims[i].mat === 'wood') top = Math.max(top, prims[i].p[1] + prims[i].s[1] / 2)
    MARKERS[s.id] = [cx, top + 0.004, cz]
  }
  TABLES.push({
    id: s.id, zone: s.zone, plan: { x: s.x, y: s.y }, pos: [cx, cz], rotation: s.rot ?? 0,
    capacity: s.capacity, minGuests: s.minGuests, kind: s.kind ?? 'table', bookable: true,
  })
}
export const TABLE_BY_ID = Object.fromEntries(TABLES.map((t) => [t.id, t])) as Record<string, TableDef>

// ──────────────────────────────────────── fixed interior ──

// Bar counter (L-shaped), back bar, POS
rect('wood', 275, 447, 295, 617, 0, 1.0)
rect('woodDark', 272, 444, 299, 620, 1.0, 1.06)
rect('wood', 195, 597, 275, 617, 0, 1.0)
rect('woodDark', 195, 595, 275, 620, 1.0, 1.06)
rect('wood', 198, 447, 275, 462, 0, 0.92)
rect('white', 252, 470, 270, 594, 0, 0.9)
rect('black', 203, 450, 218, 459, 0.92, 1.05)
// Under-counter beer fridges + beverage storage + closed storage on the west wall
for (const y of [480, 517, 554]) { rect('fridge', 158, y, 196, y + 35, 0, 0.88); rect('steel', 194, y + 6, 197, y + 29, 0.3, 0.8) }
rect('woodDark', 156, 356, 194, 446, 0, 1.9)
for (const hh of [0.45, 0.9, 1.35]) rect('woodLight', 158, 358, 192, 444, hh, hh + 0.03)
rect('white', 156, 600, 194, 724, 0, 1.1)
// Open kitchen: sideboard, hot line, dessert station, cold cook station, chef's counter
rect('woodDark', 482, 323, 555, 340, 0, 0.9)
rect('steel', 560, 323, 697, 350, 0, 0.9)
rect('black', 605, 326, 650, 347, 0.9, 0.93)
rect('steel', 700, 323, 786, 350, 0, 0.9)
rect('steel', 580, 386, 747, 413, 0, 0.92)
rect('white', 583, 389, 744, 410, 0.92, 0.95)
rect('wood', 556, 416, 752, 437, 0, 1.0)
rect('woodDark', 553, 414, 755, 439, 1.0, 1.06)
rect('steel', 556, 388, 577, 410, 0, 0.92)
// Waiter station + coffee
rect('woodDark', 836, 375, 930, 399, 0, 0.95)
rect('steel', 880, 378, 905, 396, 0.95, 1.3)
rect('black', 842, 380, 856, 394, 0.95, 1.05)
// Host desk and vestibule
rect('wood', 462, 636, 487, 660, 0, 1.0)
rect('black', 455, 661, 497, 671, 0, 1.05)
// Service stands either side of the dining room
rect('woodDark', 499, 530, 511, 550, 0, 0.85)
rect('woodDark', 798, 530, 810, 550, 0, 0.85)
// Booth end panel
rect('woodLight', 829, 403, 833, 470, 0, 1.0)

// Back of house — kitchen line, prep, office, restrooms (visible but never selectable)
rect('fridge', 578, 158, 640, 196, 0, 2.0)
rect('fridge', 645, 158, 700, 196, 0, 2.0)
rect('steel', 700, 158, 742, 196, 0, 0.9)
rect('steel', 745, 158, 870, 196, 0, 0.92)
for (const x of [757, 790, 823]) rect('white', x, 165, x + 28, 190, 0.92, 0.93)
rect('steel', 872, 158, 950, 196, 0, 0.9)
rect('steel', 955, 158, 994, 196, 0, 0.9)
rect('steel', 665, 222, 770, 255, 0, 0.9)
rect('woodDark', 775, 236, 890, 252, 0, 1.8)
for (const hh of [0.5, 1.0, 1.5]) rect('steel', 775, 236, 890, 252, hh, hh + 0.03)
rect('steel', 598, 286, 735, 318, 0, 0.9)
rect('fridge', 740, 284, 800, 318, 0, 1.4)
rect('steel', 876, 290, 935, 318, 0, 0.95)
rect('fridge', 488, 122, 572, 202, 0, 2.2) // walk-in fridge
rect('wood', 200, 130, 280, 160, 0, 0.76) // office desk
rect('black', 228, 165, 250, 187, 0, 0.5)
rect('woodDark', 196, 260, 222, 315, 0, 1.9) // office shelving
rect('white', 340, 125, 362, 150, 0, 0.42) // restroom fixtures
rect('white', 338, 172, 362, 196, 0, 0.8)
rect('white', 437, 125, 459, 150, 0, 0.42)
rect('white', 393, 122, 416, 140, 0, 0.82)
rect('black', 300, 286, 415, 290, 1.5, 1.55) // coat rail
rect('woodDark', 520, 210, 545, 240, 0, 1.6)
rect('white', 518, 285, 540, 307, 0, 1.5) // water heater

// Glowing display shelves above the banquette (photo reference)
for (const hh of [1.38, 1.74, 2.1]) {
  rect('woodDark', 214, 323, 406, 336, hh, hh + 0.045)
  rect('glow', 218, 324, 402, 333, hh - 0.012, hh)
  for (let x = 222; x < 400; x += 11 + ((x * 7) % 5)) {
    const tall = 0.06 + ((x * 13) % 7) * 0.012
    rect((x * 3) % 4 === 0 ? 'white' : 'pot', x, 326, x + 5, 332, hh + 0.045, hh + 0.045 + tall)
  }
}
// Chalkboards on the kitchen wall facing the dining room
for (const x0 of [812, 870]) {
  rect('woodDark', x0, 321, x0 + 50, 324, 1.25, 2.25)
  rect('chalk', x0 + 2, 323.5, x0 + 48, 325.5, 1.29, 2.21)
}

// Plants — pots by the windows and a planted sill like the photo
function plant(px: number, py: number, h = 1.0, d = 0.55) {
  const [x, z] = w(px, py)
  prims.push({ shape: 'cyl', mat: 'pot', p: [x, 0.2, z], s: [0.34, 0.4, 0.34], r: 0 })
  prims.push({ shape: 'sphere', mat: 'plant', p: [x, 0.4 + h * 0.4, z], s: [d, h * 0.7, d], r: 0 })
  prims.push({ shape: 'sphere', mat: 'plantDark', p: [x + 0.08, 0.4 + h * 0.62, z - 0.05], s: [d * 0.7, h * 0.5, d * 0.7], r: 0.5 })
}
plant(392, 714)
plant(512, 714)
plant(802, 714, 1.2)
plant(470, 452, 0.9)
plant(984, 388, 1.1, 0.5)
rect('woodDark', 200, 717, 380, 726, 0, 0.5)
for (let x = 206; x < 378; x += 14) {
  const [px, pz] = w(x, 721.5)
  prims.push({ shape: 'sphere', mat: (x / 14) % 2 < 1 ? 'plant' : 'plantDark', p: [px, 0.6, pz], s: [0.34, 0.38, 0.26], r: 0 })
}
// Street tree grates with low planting
for (const x of [57, 357, 660, 962]) {
  rect('pot', x - 24, 831, x + 24, 879, 0, 0.02)
  const [px, pz] = w(x, 855)
  prims.push({ shape: 'cyl', mat: 'woodDark', p: [px, 0.5, pz], s: [0.12, 1.0, 0.12], r: 0 })
  prims.push({ shape: 'sphere', mat: 'plant', p: [px, 1.15, pz], s: [0.95, 0.8, 0.95], r: 0 })
  prims.push({ shape: 'sphere', mat: 'plantDark', p: [px + 0.15, 1.4, pz + 0.1], s: [0.6, 0.55, 0.6], r: 0 })
}

export const PRIMS: Prim[] = prims

// ───────────────────────────────────────────── pendants ──
/** dome pendants (hidden while a table is focused so nothing sits over it) */
export const PENDANTS: [number, number][] = [
  ...MAIN.map(([x, y]) => w(x, y)),
  w(424, 488), w(424, 575),
  w(600, 430), w(655, 430), w(710, 430),
  w(285, 490), w(285, 575),
  w(282, 676), w(349, 676),
]

// ──────────────────────────────────────────── architecture ──

export interface WallDef {
  a: [number, number]
  b: [number, number]
  h: number
  /** outward normal for exterior walls — they lower automatically when between camera and room */
  normal?: [number, number]
  kind?: 'plaster' | 'glazed'
  /** glazed: sill height */
  sill?: number
  /** door / opening gaps along the wall in plan px [from, to] measured on the wall's axis */
  gaps?: [number, number][]
}

export const WALL_H = 2.75
export const WALLS: WallDef[] = [
  // exterior
  { a: [190, 110], b: [575, 110], h: WALL_H, normal: [0, -1] },
  { a: [575, 110], b: [575, 152], h: WALL_H, normal: [1, 0] },
  { a: [575, 152], b: [998, 152], h: WALL_H, normal: [0, -1] },
  { a: [998, 152], b: [998, 400], h: WALL_H, normal: [1, 0] },
  { a: [998, 400], b: [998, 731], h: WALL_H, normal: [1, 0], kind: 'glazed', sill: 0.95 },
  { a: [190, 110], b: [190, 345], h: WALL_H, normal: [-1, 0] },
  { a: [150, 345], b: [190, 345], h: WALL_H, normal: [0, -1] },
  { a: [150, 345], b: [150, 731], h: WALL_H, normal: [-1, 0] },
  { a: [150, 728], b: [998, 728], h: WALL_H, normal: [0, 1], kind: 'glazed', sill: 0.5, gaps: [[407, 487]] },
  // interior partitions
  { a: [190, 320], b: [420, 320], h: WALL_H },
  { a: [480, 320], b: [932, 320], h: WALL_H },
  { a: [977, 320], b: [998, 320], h: WALL_H },
  { a: [290, 110], b: [290, 250], h: WALL_H },
  { a: [290, 295], b: [290, 320], h: WALL_H },
  { a: [370, 110], b: [370, 228], h: WALL_H },
  { a: [290, 228], b: [330, 228], h: WALL_H },
  { a: [362, 228], b: [445, 228], h: WALL_H },
  { a: [475, 228], b: [485, 228], h: WALL_H },
  { a: [485, 110], b: [485, 262], h: WALL_H },
  { a: [485, 205], b: [575, 205], h: WALL_H },
  { a: [575, 152], b: [575, 205], h: WALL_H },
  // vestibule glass
  { a: [402, 660], b: [402, 728], h: 2.3, kind: 'glazed', sill: 0.15 },
]

/** brick feature wall behind the bar (inner face of the west wall) and logo placement */
export const BRICK = { y1: 425, y2: 645, x: 150 }
export const LOGO = { y: 535, height: 2.05 }

/** floor regions (plan px rect) */
export const FLOORS = {
  wood: [150, 320, 998, 728] as const,
  tileOpenKitchen: [480, 320, 762, 466] as const,
  tileService: [762, 320, 998, 402] as const,
  tileBack: [190, 110, 998, 320] as const,
  sidewalk: [20, 731, 1090, 886] as const,
  sidewalkEast: [998, 120, 1090, 731] as const,
}

/** overall bounds used for camera framing and pan limits (metres) */
export const BOUNDS = (() => {
  const [x1, z1] = w(30, 108)
  const [x2, z2] = w(1000, 886)
  return { x1, x2, z1, z2 }
})()
