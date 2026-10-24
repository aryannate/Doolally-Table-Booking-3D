import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BOUNDS } from '../data/layout'
import { useStore } from '../state/store'
import { TABLE_BOUNDS } from './Furniture'

/**
 * Camera behaviour modelled on the reference: an elevated three-quarter overview, a smooth
 * pan-and-zoom onto a tapped table, and a gentle return. Poses are tweened in spherical
 * space (target, azimuth, polar, log-distance) with ease-in-out, ~550 ms.
 *
 * UI that covers the canvas (top bar, details card, bottom sheet) is handled with
 * `camera.setViewOffset`, which shifts the projection centre into the uncovered area —
 * the selected table always lands in the middle of what the guest can actually see.
 */

interface Pose { target: THREE.Vector3; az: number; polar: number; dist: number }

const AZ_LIMIT = 1.75
const MAX_POLAR = 1.22
const DURATION = 560
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function overviewAngles(aspect: number, top: boolean) {
  if (top) return { az: 0, polar: 0.0001 }
  // portrait screens look better with the long side of the room running up the screen
  return aspect < 0.8 ? { az: 0.95, polar: 0.86 } : aspect < 1.25 ? { az: 0.72, polar: 0.9 } : { az: 0.55, polar: 0.92 }
}

/** Smallest distance at which every point fits inside the visible (un-covered) part of the frustum. */
function fitDistance(points: THREE.Vector3[], target: THREE.Vector3, az: number, polar: number, fov: number, visW: number, visH: number, H: number) {
  const dir = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az))
  const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az))
  const up = new THREE.Vector3().crossVectors(dir, right)
  const tv = Math.tan(THREE.MathUtils.degToRad(fov) / 2)
  const tanV = (tv * visH) / H
  const tanH = (tv * visW) / H
  let d = 0
  const p = new THREE.Vector3()
  for (const pt of points) {
    p.subVectors(pt, target)
    const need = p.dot(dir) + Math.max(Math.abs(p.dot(right)) / tanH, Math.abs(p.dot(up)) / tanV)
    d = Math.max(d, need)
  }
  return d
}

/** Fit, then slide the target so the projected model sits centred in the visible area. */
function frame(points: THREE.Vector3[], target0: THREE.Vector3, az: number, polar: number, fov: number, visW: number, visH: number, H: number) {
  const target = target0.clone()
  const dir = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az))
  const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az))
  const up = new THREE.Vector3().crossVectors(dir, right)
  const p = new THREE.Vector3()
  let d = 0
  for (let it = 0; it < 4; it++) {
    d = fitDistance(points, target, az, polar, fov, visW, visH, H)
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const pt of points) {
      p.subVectors(pt, target)
      const depth = d - p.dot(dir)
      const sx = p.dot(right) / depth, sy = p.dot(up) / depth
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    if (Math.abs(cx) < 1e-4 && Math.abs(cy) < 1e-4) break
    // move along the ground plane only
    const shift = right.clone().multiplyScalar(cx * d).add(up.clone().multiplyScalar(cy * d))
    shift.y = 0
    if (polar > 0.01) {
      const upFlat = new THREE.Vector3(up.x, 0, up.z)
      const k = upFlat.lengthSq() > 1e-6 ? (cy * d) / Math.cos(polar) : 0
      shift.copy(right).multiplyScalar(cx * d).addScaledVector(upFlat.normalize(), k)
    }
    target.add(shift)
  }
  return { target, dist: fitDistance(points, target, az, polar, fov, visW, visH, H) }
}

function boxPoints(x1: number, x2: number, z1: number, z2: number, y1: number, y2: number) {
  const out: THREE.Vector3[] = []
  for (const x of [x1, x2]) for (const y of [y1, y2]) for (const z of [z1, z2]) out.push(new THREE.Vector3(x, y, z))
  return out
}

export function CameraRig({ reduced }: { reduced: boolean }) {
  const ctl = useRef<OrbitControlsImpl>(null!)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const selectedId = useStore((s) => s.selectedId)
  const insets = useStore((s) => s.insets)
  const topView = useStore((s) => s.topView)
  const panMode = useStore((s) => s.panMode)
  const camCmd = useStore((s) => s.camCmd)

  const tween = useRef<{ from: Pose; to: Pose; t0: number; dur: number } | null>(null)
  const offset = useRef({ x: 0, y: 0, ready: false })
  const maxDist = useRef(80)

  const current = useCallback((): Pose => {
    const target = ctl.current.target.clone()
    const o = camera.position.clone().sub(target)
    const dist = o.length()
    return { target, dist, polar: Math.acos(clamp(o.y / dist, -1, 1)), az: Math.atan2(o.x, o.z) }
  }, [camera])

  const visible = useCallback(() => {
    const pad = 16
    return { visW: Math.max(120, size.width - insets.left - insets.right - pad * 2), visH: Math.max(120, size.height - insets.top - insets.bottom - pad * 2) }
  }, [size, insets])

  const overviewPose = useCallback((top = topView): Pose => {
    const aspect = size.width / size.height
    const target = new THREE.Vector3((BOUNDS.x1 + BOUNDS.x2) / 2, 0, (BOUNDS.z1 + BOUNDS.z2) / 2)
    const { visW, visH } = visible()
    const pts = boxPoints(BOUNDS.x1, BOUNDS.x2, BOUNDS.z1, BOUNDS.z2, 0, top ? 0 : 1.6)
    let { az, polar } = overviewAngles(aspect, top)
    let best = frame(pts, target, az, polar, camera.fov, visW, visH, size.height)
    if (!top && visW / visH < 1.05) {
      // tall screens: turn the model so its long side runs up the screen (largest fit wins)
      for (let a = 0.5; a <= 1.5; a += 0.1) for (const pl of [0.74, 0.84]) {
        const f = frame(pts, target, a, pl, camera.fov, visW, visH, size.height)
        if (f.dist < best.dist * 0.97) { best = f; az = a; polar = pl }
      }
    }
    const dist = best.dist * 1.03
    target.copy(best.target)
    maxDist.current = dist * 1.6
    if (ctl.current) ctl.current.maxDistance = maxDist.current
    return { target, az, polar, dist }
  }, [size, visible, camera, topView])

  const tablePose = useCallback((id: string): Pose => {
    const b = TABLE_BOUNDS[id]
    const c = b.getCenter(new THREE.Vector3())
    const cur = ctl.current ? current() : overviewPose()
    const top = topView
    const polar = top ? 0.0001 : 0.84
    const az = top ? 0 : clamp(cur.az, -1.05, 1.05) // look in from the street side so booths and walls never block the table
    const target = new THREE.Vector3(c.x, top ? 0 : 0.45, c.z)
    const { visW, visH } = visible()
    const m = 2.4 // keep neighbouring tables in view for context
    const pts = boxPoints(b.min.x - m, b.max.x + m, b.min.z - m, b.max.z + m, 0, 1.1)
    const dist = clamp(fitDistance(pts, target, az, polar, camera.fov, visW, visH, size.height), 7.5, 17)
    return { target, az, polar, dist }
  }, [current, overviewPose, visible, camera, size, topView])

  const go = useCallback((to: Pose, dur = DURATION) => {
    if (!ctl.current) return
    tween.current = { from: current(), to, t0: performance.now(), dur: reduced ? 0 : dur }
    invalidate()
  }, [current, invalidate, reduced])

  const apply = (p: Pose) => {
    const s = Math.sin(p.polar)
    camera.position.set(p.target.x + p.dist * s * Math.sin(p.az), p.target.y + p.dist * Math.cos(p.polar), p.target.z + p.dist * s * Math.cos(p.az))
    ctl.current.target.copy(p.target)
    camera.lookAt(p.target)
  }

  // first frame: jump straight to the overview
  useEffect(() => {
    if (!ctl.current) return
    apply(overviewPose())
    ctl.current.update()
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // selection, panel size, viewport and top-view changes all re-frame
  useEffect(() => {
    if (!ctl.current) return
    go(selectedId ? tablePose(selectedId) : overviewPose())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, topView, size.width, size.height, insets.right, insets.bottom, insets.top, insets.left])

  // on-screen buttons
  useEffect(() => {
    if (!camCmd || !ctl.current) return
    const p = current()
    switch (camCmd.cmd) {
      case 'zoomIn': go({ ...p, dist: Math.max(3.5, p.dist * 0.72) }, 380); break
      case 'zoomOut': go({ ...p, dist: Math.min(maxDist.current, p.dist * 1.38) }, 380); break
      case 'rotL': go({ ...p, az: clamp(p.az - 0.45, -AZ_LIMIT, AZ_LIMIT), polar: Math.max(p.polar, 0.3) }, 420); break
      case 'rotR': go({ ...p, az: clamp(p.az + 0.45, -AZ_LIMIT, AZ_LIMIT), polar: Math.max(p.polar, 0.3) }, 420); break
      case 'reset': if (useStore.getState().selectedId) useStore.getState().close(); else go(overviewPose(false)); break
      case 'top': break // handled by the topView effect
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camCmd])

  // keyboard: arrows pan, +/- zoom, [ ] rotate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (!ctl.current) return
      const p = current()
      const step = Math.max(0.6, p.dist * 0.08)
      const fwd = new THREE.Vector3(-Math.sin(p.az), 0, -Math.cos(p.az))
      const rgt = new THREE.Vector3(Math.cos(p.az), 0, -Math.sin(p.az))
      const move = (v: THREE.Vector3) => { e.preventDefault(); go({ ...p, target: p.target.clone().addScaledVector(v, step) }, 220) }
      if (e.key === 'ArrowUp') move(fwd)
      else if (e.key === 'ArrowDown') move(fwd.negate())
      else if (e.key === 'ArrowLeft') move(rgt.negate())
      else if (e.key === 'ArrowRight') move(rgt)
      else if (e.key === '+' || e.key === '=') useStore.getState().camera('zoomIn')
      else if (e.key === '-' || e.key === '_') useStore.getState().camera('zoomOut')
      else if (e.key === '[') useStore.getState().camera('rotL')
      else if (e.key === ']') useStore.getState().camera('rotR')
      else if (e.key === 'Escape') useStore.getState().close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, go])

  // pan-mode toggle: one finger / left button pans instead of orbiting
  useEffect(() => {
    const c = ctl.current
    if (!c) return
    c.mouseButtons = { LEFT: panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN }
    c.touches = { ONE: panMode ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
  }, [panMode])

  useFrame(() => {
    const c = ctl.current
    if (!c) return
    // ── view offset toward the uncovered area
    const tx = (insets.right - insets.left) / 2
    const ty = (insets.bottom - insets.top) / 2
    const o = offset.current
    const k = reduced || !o.ready ? 1 : 0.2
    o.x += (tx - o.x) * k
    o.y += (ty - o.y) * k
    o.ready = true
    if (Math.abs(tx - o.x) < 0.5) o.x = tx
    if (Math.abs(ty - o.y) < 0.5) o.y = ty
    camera.setViewOffset(size.width, size.height, o.x, o.y, size.width, size.height)
    if (o.x !== tx || o.y !== ty) invalidate()

    // ── tween
    const tw = tween.current
    if (tw) {
      const t = tw.dur ? clamp((performance.now() - tw.t0) / tw.dur, 0, 1) : 1
      const e = ease(t)
      const lerpAng = (a: number, b: number) => a + (b - a) * e
      apply({
        target: tw.from.target.clone().lerp(tw.to.target, e),
        az: lerpAng(tw.from.az, tw.to.az),
        polar: lerpAng(tw.from.polar, tw.to.polar),
        dist: Math.exp(Math.log(tw.from.dist) + (Math.log(tw.to.dist) - Math.log(tw.from.dist)) * e),
      })
      c.update()
      if (t >= 1) tween.current = null
      else invalidate()
    }
  })

  const clampTarget = () => {
    const c = ctl.current
    if (!c) return
    c.target.x = clamp(c.target.x, BOUNDS.x1 - 2, BOUNDS.x2 + 2)
    c.target.z = clamp(c.target.z, BOUNDS.z1 - 2, BOUNDS.z2 + 2)
    c.target.y = clamp(c.target.y, 0, 1.5)
  }

  return (
    <OrbitControls
      ref={ctl}
      makeDefault
      enableDamping={!reduced}
      dampingFactor={0.12}
      rotateSpeed={0.55}
      zoomSpeed={0.85}
      panSpeed={0.9}
      screenSpacePanning={false}
      minDistance={3.5}
      maxDistance={maxDist.current}
      maxPolarAngle={MAX_POLAR}
      minAzimuthAngle={-AZ_LIMIT}
      maxAzimuthAngle={AZ_LIMIT}
      onStart={() => { tween.current = null }}
      onChange={clampTarget}
    />
  )
}
