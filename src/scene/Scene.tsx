import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BOUNDS } from '../data/layout'
import { useStore } from '../state/store'
import { Architecture } from './Architecture'
import { CameraRig } from './CameraRig'
import { Furniture } from './Furniture'
import { BG } from './palette'
import { Pendants } from './Pendants'

/**
 * Rendering budget:
 *  - frameloop="demand": nothing renders while the scene is idle; tweens, damping and colour
 *    fades call invalidate() only while they are moving.
 *  - One directional shadow, rendered once ("baked") because the furniture never moves.
 *  - Pixel ratio capped (1.5 on phones/tablets, 2 on desktop), shadows off on low-end devices.
 */
function quality() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const low = (coarse && (cores <= 4 || mem <= 2)) || new URLSearchParams(location.search).has('lowq')
  return { low, dpr: (low ? [1, 1.25] : coarse ? [1, 1.6] : [1, 2]) as [number, number], shadowSize: low ? 0 : coarse ? 1024 : 2048 }
}

function BakeShadows() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    invalidate()
  }, [gl, invalidate])
  return null
}

function Lights({ shadowSize }: { shadowSize: number }) {
  const cx = (BOUNDS.x1 + BOUNDS.x2) / 2
  const cz = (BOUNDS.z1 + BOUNDS.z2) / 2
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight('#fff3e2', 1.55)
    l.position.set(cx - 7, 16, cz + 8)
    l.target.position.set(cx, 0, cz)
    if (shadowSize) {
      l.castShadow = true
      l.shadow.mapSize.set(shadowSize, shadowSize)
      const c = l.shadow.camera as THREE.OrthographicCamera
      c.left = -14; c.right = 14; c.top = 12; c.bottom = -12; c.near = 2; c.far = 45
      l.shadow.bias = -0.0005
      l.shadow.normalBias = 0.025
      l.shadow.radius = 3
    }
    return l
  }, [cx, cz, shadowSize])
  return (
    <>
      <hemisphereLight args={['#fffaf1', '#d9ccb9', 1.25]} />
      <ambientLight intensity={0.18} color="#fff6ea" />
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  )
}

export default function Scene({ onFail }: { onFail?: () => void }) {
  const q = useMemo(quality, [])
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, [])
  const close = useStore((s) => s.close)
  return (
    <Canvas
      frameloop="demand"
      dpr={q.dpr}
      shadows={q.shadowSize ? 'soft' : false}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false }}
      camera={{ fov: 30, near: 0.5, far: 220, position: [10, 22, 26] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.02
        scene.background = new THREE.Color(BG)
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail?.() })
      }}
      onPointerMissed={(e) => { if ((e as MouseEvent).button === 0) close() }}
      style={{ touchAction: 'none' }}
      aria-label="3D model of Doolally Taproom. Tap a table to select it."
    >
      <Lights shadowSize={q.shadowSize} />
      <Suspense fallback={null}>
        <Architecture />
        <Furniture reduced={reduced} />
        <Pendants />
        <BakeShadows />
      </Suspense>
      <CameraRig reduced={reduced} />
    </Canvas>
  )
}
