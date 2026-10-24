import * as THREE from 'three'

/**
 * Procedural canvas textures — generated once at load, so the scene needs no texture downloads.
 * Sizes are kept small (512–1024px) and mipmapped.
 */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function finish(c: HTMLCanvasElement, repeat = true, aniso = 4) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = aniso
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  return t
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** Honey timber planks — tile covers 2 m × 2 m, planks run east–west */
export function woodFloor() {
  const [c, g] = canvas(1024, 1024)
  const r = rng(7)
  const rows = 14
  const ph = 1024 / rows
  for (let i = 0; i < rows; i++) {
    let x = -r() * 400
    while (x < 1024) {
      const len = 300 + r() * 420
      const tone = 0.88 + r() * 0.16
      const base = [222 * tone, 178 * tone, 122 * tone].map((v) => Math.min(255, v))
      g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`
      g.fillRect(x, i * ph, len, ph)
      // grain
      g.globalAlpha = 0.09
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = r() > 0.5 ? '#8a5a2b' : '#fff1d8'
        g.lineWidth = 1 + r() * 1.5
        g.beginPath()
        const y0 = i * ph + 4 + r() * (ph - 8)
        g.moveTo(x, y0)
        for (let s = 0; s <= 6; s++) g.lineTo(x + (len * s) / 6, y0 + (r() - 0.5) * 3)
        g.stroke()
      }
      g.globalAlpha = 1
      g.fillStyle = 'rgba(110,70,35,0.35)'
      g.fillRect(x, i * ph, 1.5, ph)
      x += len
    }
    g.fillStyle = 'rgba(110,70,35,0.28)'
    g.fillRect(0, i * ph, 1024, 1.5)
  }
  return finish(c, true, 8)
}

/** Whitewashed exposed brick with terracotta flecks (photo: tap wall) — tile covers ~1.2 m × 0.9 m */
export function brick() {
  const [c, g] = canvas(512, 512)
  const r = rng(3)
  g.fillStyle = '#d9d2c7'
  g.fillRect(0, 0, 512, 512)
  const bh = 512 / 12, bw = 512 / 4.5
  for (let row = 0; row < 12; row++) {
    const off = row % 2 ? bw / 2 : 0
    for (let x = -bw + off; x < 512 + bw; x += bw) {
      const y = row * bh
      const l = 236 + r() * 14
      g.fillStyle = `rgb(${l},${l - 4},${l - 10})`
      g.fillRect(x + 3, y + 3, bw - 6, bh - 6)
      // terracotta showing through the whitewash
      const n = 3 + Math.floor(r() * 10)
      for (let k = 0; k < n; k++) {
        g.fillStyle = `rgba(${150 + r() * 40},${70 + r() * 30},${45 + r() * 20},${0.35 + r() * 0.45})`
        const px = x + 4 + r() * (bw - 10), py = y + 4 + r() * (bh - 10)
        g.fillRect(px, py, 2 + r() * 9, 1 + r() * 3)
      }
    }
  }
  return finish(c)
}

/** 6"×6" quarry tile (kitchen + service) */
export function tile() {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#e6e3de'
  g.fillRect(0, 0, 256, 256)
  const r = rng(11)
  const n = 8
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const l = 226 + r() * 10
    g.fillStyle = `rgb(${l},${l - 2},${l - 5})`
    g.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29)
  }
  return finish(c)
}

/** Concrete sidewalk with expansion joints (~1.5 m) */
export function concrete() {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#e4e0d9'
  g.fillRect(0, 0, 256, 256)
  const r = rng(5)
  for (let k = 0; k < 900; k++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '120,110,100'},${r() * 0.08})`
    g.fillRect(r() * 256, r() * 256, 2, 2)
  }
  g.fillStyle = 'rgba(140,130,118,0.35)'
  g.fillRect(0, 0, 256, 2)
  g.fillRect(0, 0, 2, 256)
  return finish(c)
}

/** Soft radial glow for the backlit logo */
export function glow(color = '255,226,170') {
  const [c, g] = canvas(256, 128)
  const grd = g.createRadialGradient(128, 64, 4, 128, 64, 128)
  grd.addColorStop(0, `rgba(${color},0.9)`)
  grd.addColorStop(0.45, `rgba(${color},0.35)`)
  grd.addColorStop(1, `rgba(${color},0)`)
  g.save()
  g.scale(1, 0.5)
  g.fillStyle = grd
  g.fillRect(0, 0, 256, 256)
  g.restore()
  return finish(c, false)
}

/** Chalkboard with hand-lettered specials */
export function chalkboard(lines: string[], seed = 1) {
  const [c, g] = canvas(256, 320)
  g.fillStyle = '#2b312d'
  g.fillRect(0, 0, 256, 320)
  const r = rng(seed)
  for (let k = 0; k < 500; k++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.04})`
    g.fillRect(r() * 256, r() * 320, 3, 1)
  }
  g.fillStyle = '#f3efe6'
  g.textAlign = 'center'
  lines.forEach((l, i) => {
    g.font = i === 0 ? '600 34px "Zilla Slab", Georgia, serif' : '22px "DM Sans", system-ui, sans-serif'
    g.globalAlpha = i === 0 ? 0.95 : 0.82
    g.fillText(l, 128 + (r() - 0.5) * 4, 58 + i * 42)
  })
  return finish(c, false)
}

/** Street name painted on the road edge */
export function streetLabel(text: string) {
  const [c, g] = canvas(1024, 128)
  g.fillStyle = 'rgba(0,0,0,0)'
  g.fillRect(0, 0, 1024, 128)
  g.fillStyle = '#b9b2a7'
  g.font = '700 74px "DM Sans", system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '10px'
  g.fillText(text, 512, 66)
  return finish(c, false)
}
