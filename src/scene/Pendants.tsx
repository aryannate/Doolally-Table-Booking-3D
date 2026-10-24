import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { PENDANTS, WALL_H } from '../data/layout'
import { useStore } from '../state/store'

/** White dome pendants from the photos. Hidden while a table is focused so nothing hangs over it. */
const dome = new THREE.LatheGeometry(
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 11) * (Math.PI / 2)
    return new THREE.Vector2(0.03 + Math.sin(a) * 0.2, 0.17 - (1 - Math.cos(a)) * 0.17)
  }),
  24,
)
const cord = new THREE.CylinderGeometry(0.006, 0.006, 1, 4)
const bulb = new THREE.CircleGeometry(0.15, 20)
const tmp = new THREE.Object3D()
const Y = 2.2

export function Pendants() {
  const visible = useStore((s) => !s.selectedId)
  const a = useRef<THREE.InstancedMesh>(null!)
  const b = useRef<THREE.InstancedMesh>(null!)
  const c = useRef<THREE.InstancedMesh>(null!)
  const invalidate = useThree((s) => s.invalidate)

  useLayoutEffect(() => {
    PENDANTS.forEach(([x, z], i) => {
      tmp.rotation.set(0, 0, 0)
      tmp.scale.set(1, 1, 1)
      tmp.position.set(x, Y, z)
      tmp.updateMatrix()
      a.current.setMatrixAt(i, tmp.matrix)
      tmp.position.set(x, (Y + 0.17 + WALL_H) / 2, z)
      tmp.scale.set(1, WALL_H - Y - 0.17, 1)
      tmp.updateMatrix()
      b.current.setMatrixAt(i, tmp.matrix)
      tmp.scale.set(1, 1, 1)
      tmp.rotation.set(Math.PI / 2, 0, 0)
      tmp.position.set(x, Y - 0.005, z)
      tmp.updateMatrix()
      c.current.setMatrixAt(i, tmp.matrix)
    })
    for (const r of [a, b, c]) { r.current.instanceMatrix.needsUpdate = true; r.current.computeBoundingSphere() }
  }, [])

  useLayoutEffect(() => invalidate(), [visible, invalidate])

  return (
    <group visible={visible}>
      <instancedMesh ref={a} args={[dome, undefined, PENDANTS.length]}>
        <meshStandardMaterial color="#ecebe8" roughness={0.45} metalness={0.15} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={b} args={[cord, undefined, PENDANTS.length]}>
        <meshBasicMaterial color="#4a4541" />
      </instancedMesh>
      <instancedMesh ref={c} args={[bulb, undefined, PENDANTS.length]}>
        <meshBasicMaterial color="#fff1d2" toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  )
}
