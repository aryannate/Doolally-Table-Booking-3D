import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MARKERS, PRIMS, TABLES, type Mat, type Prim, type Shape } from '../data/layout'
import { useStore } from '../state/store'
import { MAT_CLASS, MAT_COLOR, markerTint, tableTint, type MatClass } from './palette'

/**
 * All furniture and fittings are composed from four shared geometries and drawn with
 * one InstancedMesh per (shape × material class) — ~10 draw calls for ~2,500 parts.
 * Per-instance colours carry wood/cushion tones and the selection / availability tints,
 * and animate smoothly when state changes.
 */

const GEO: Record<Shape, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  sphere: new THREE.IcosahedronGeometry(0.5, 2),
  dome: new THREE.CylinderGeometry(0.12, 0.5, 1, 20, 1, true),
}

const MATERIAL: Record<MatClass, THREE.Material> = {
  matte: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0 }),
  metal: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.38, metalness: 0.55 }),
  glow: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
}

const tmpObj = new THREE.Object3D()
const tmpColor = new THREE.Color()

function useTint(reduced: boolean) {
  const status = useStore((s) => s.status)
  const selectedId = useStore((s) => s.selectedId)
  const hoveredId = useStore((s) => s.hoveredId)
  return { status, selectedId, hoveredId, reduced }
}

function PrimGroup({ prims, shape, cls, reduced }: { prims: Prim[]; shape: Shape; cls: MatClass; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const invalidate = useThree((s) => s.invalidate)
  const { status, selectedId, hoveredId } = useTint(reduced)
  const n = prims.length
  const base = useMemo(() => prims.map((p) => new THREE.Color(MAT_COLOR[p.mat as Mat])), [prims])
  const cur = useMemo(() => new Float32Array(n * 3), [n])
  const target = useMemo(() => new Float32Array(n * 3), [n])
  const animating = useRef(false)

  useLayoutEffect(() => {
    const mesh = ref.current
    prims.forEach((p, i) => {
      tmpObj.position.set(...p.p)
      tmpObj.rotation.set(0, p.r, 0)
      tmpObj.scale.set(...p.s)
      tmpObj.updateMatrix()
      mesh.setMatrixAt(i, tmpObj.matrix)
      base[i].toArray(cur, i * 3)
      base[i].toArray(target, i * 3)
      mesh.setColorAt(i, base[i])
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    invalidate()
  }, [prims, base, cur, target, invalidate])

  useLayoutEffect(() => {
    const anySel = !!selectedId
    let changed = false
    prims.forEach((p, i) => {
      if (!p.t) return
      tableTint(p.mat, base[i], status[p.t], p.t === selectedId, anySel, p.t === hoveredId, tmpColor)
      if (target[i * 3] !== tmpColor.r || target[i * 3 + 1] !== tmpColor.g || target[i * 3 + 2] !== tmpColor.b) changed = true
      tmpColor.toArray(target, i * 3)
    })
    if (changed) { animating.current = true; invalidate() }
  }, [status, selectedId, hoveredId, prims, base, target, invalidate])

  useFrame((_, dt) => {
    if (!animating.current) return
    const mesh = ref.current
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 14)
    let maxDiff = 0
    for (let i = 0; i < cur.length; i++) {
      const d = target[i] - cur[i]
      cur[i] += d * k
      if (Math.abs(d) > maxDiff) maxDiff = Math.abs(d)
    }
    if (maxDiff < 0.002) { cur.set(target); animating.current = false }
    ;(mesh.instanceColor!.array as Float32Array).set(cur)
    mesh.instanceColor!.needsUpdate = true
    if (animating.current) invalidate()
  })

  return (
    <instancedMesh
      ref={ref}
      args={[GEO[shape], MATERIAL[cls], n]}
      castShadow={cls !== 'glow'}
      receiveShadow={cls !== 'glow'}
      frustumCulled={false}
    />
  )
}

export function Furniture({ reduced }: { reduced: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, { shape: Shape; cls: MatClass; prims: Prim[] }>()
    for (const p of PRIMS) {
      const cls = MAT_CLASS[p.mat]
      const key = `${p.shape}:${cls}`
      if (!map.has(key)) map.set(key, { shape: p.shape, cls, prims: [] })
      map.get(key)!.prims.push(p)
    }
    return [...map.values()]
  }, [])
  return (
    <group>
      {groups.map((g) => <PrimGroup key={`${g.shape}:${g.cls}`} {...g} reduced={reduced} />)}
      <Markers reduced={reduced} />
      <HitTargets />
    </group>
  )
}

/** Small availability dot on each tabletop (or on the counter in front of bar / counter seats). */
function Markers({ reduced }: { reduced: boolean }) {
  const ring = useRef<THREE.InstancedMesh>(null!)
  const dot = useRef<THREE.InstancedMesh>(null!)
  const invalidate = useThree((s) => s.invalidate)
  const { status, selectedId } = useTint(reduced)
  const n = TABLES.length
  const cur = useMemo(() => new Float32Array(n * 3), [n])
  const target = useMemo(() => new Float32Array(n * 3), [n])
  const anim = useRef(false)

  useLayoutEffect(() => {
    TABLES.forEach((t, i) => {
      const [x, y, z] = MARKERS[t.id]
      tmpObj.rotation.set(0, 0, 0)
      tmpObj.position.set(x, y + 0.003, z)
      tmpObj.scale.set(0.19, 0.006, 0.19)
      tmpObj.updateMatrix()
      ring.current.setMatrixAt(i, tmpObj.matrix)
      tmpObj.position.set(x, y + 0.007, z)
      tmpObj.scale.set(0.13, 0.006, 0.13)
      tmpObj.updateMatrix()
      dot.current.setMatrixAt(i, tmpObj.matrix)
    })
    ring.current.instanceMatrix.needsUpdate = true
    dot.current.instanceMatrix.needsUpdate = true
  }, [])

  useLayoutEffect(() => {
    TABLES.forEach((t, i) => {
      markerTint(status[t.id], t.id === selectedId, !!selectedId, tmpColor)
      tmpColor.toArray(target, i * 3)
    })
    anim.current = true
    invalidate()
  }, [status, selectedId, target, invalidate])

  useFrame((_, dt) => {
    if (!anim.current) return
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 14)
    let max = 0
    for (let i = 0; i < cur.length; i++) {
      const d = target[i] - cur[i]
      cur[i] += d * k
      max = Math.max(max, Math.abs(d))
    }
    if (max < 0.002) { cur.set(target); anim.current = false }
    for (let i = 0; i < n; i++) dot.current.setColorAt(i, tmpColor.fromArray(cur, i * 3))
    dot.current.instanceColor!.needsUpdate = true
    if (anim.current) invalidate()
  })

  return (
    <>
      <instancedMesh ref={ring} args={[GEO.cyl, undefined, n]} frustumCulled={false}>
        <meshBasicMaterial color="#fbf8f2" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={dot} args={[GEO.cyl, undefined, n]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </>
  )
}

/** Per-table bounding boxes (chairs included), padded for comfortable touch targets. */
export const TABLE_BOUNDS: Record<string, THREE.Box3> = (() => {
  const out: Record<string, THREE.Box3> = {}
  const v = new THREE.Vector3()
  for (const p of PRIMS) {
    if (!p.t) continue
    const b = (out[p.t] ??= new THREE.Box3().makeEmpty())
    const r = Math.max(p.s[0], p.s[2]) * 0.5
    b.expandByPoint(v.set(p.p[0] - r, 0, p.p[2] - r))
    b.expandByPoint(v.set(p.p[0] + r, p.p[1] + p.s[1] / 2, p.p[2] + r))
  }
  return out
})()

function HitTargets() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const select = useStore((s) => s.select)
  const hover = useStore((s) => s.hover)
  const n = TABLES.length

  useLayoutEffect(() => {
    const c = new THREE.Vector3(), s = new THREE.Vector3()
    TABLES.forEach((t, i) => {
      const b = TABLE_BOUNDS[t.id]
      b.getCenter(c)
      b.getSize(s)
      tmpObj.rotation.set(0, 0, 0)
      tmpObj.position.set(c.x, (s.y + 0.1) / 2, c.z)
      tmpObj.scale.set(Math.max(0.9, s.x + 0.08), s.y + 0.1, Math.max(0.9, s.z + 0.08))
      tmpObj.updateMatrix()
      ref.current.setMatrixAt(i, tmpObj.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [])

  const idOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId != null ? TABLES[e.instanceId]?.id : undefined)

  return (
    <instancedMesh
      ref={ref}
      args={[GEO.box, undefined, n]}
      onClick={(e) => {
        if (e.delta > 8) return // a drag, not a tap
        e.stopPropagation()
        const id = idOf(e)
        if (id) select(id)
      }}
      onPointerMove={(e) => {
        if ((e.nativeEvent as PointerEvent).pointerType !== 'mouse') return
        e.stopPropagation()
        const id = idOf(e) ?? null
        hover(id)
        document.body.style.cursor = id ? 'pointer' : ''
      }}
      onPointerOut={() => { hover(null); document.body.style.cursor = '' }}
    >
      <meshBasicMaterial colorWrite={false} depthWrite={false} transparent opacity={0} />
    </instancedMesh>
  )
}
