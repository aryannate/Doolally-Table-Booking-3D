import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import logoUrl from '../assets/logo-full.png'
import { BRICK, FLOORS, LOGO, S, WALLS, WALL_H, m, w, type WallDef } from '../data/layout'
import { BG } from './palette'
import { brick, chalkboard, concrete, glow, streetLabel, tile, woodFloor } from './textures'

const T = 0.15 // wall thickness (m)
const STUB = 0.14 // height a wall drops to when it would block the view

const plaster = new THREE.MeshStandardMaterial({ color: '#f5f1ea', roughness: 0.92 })
const cap = new THREE.MeshStandardMaterial({ color: '#d8cfc2', roughness: 0.9 })
const frame = new THREE.MeshStandardMaterial({ color: '#3c3935', roughness: 0.6 })
const glass = new THREE.MeshStandardMaterial({ color: '#d7e7ec', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false })
const boxGeo = new THREE.BoxGeometry(1, 1, 1)

function Floor({ r, mat, y = 0, tex, tile: tileM }: { r: readonly [number, number, number, number]; mat?: THREE.Material; y?: number; tex?: THREE.Texture; tile?: number }) {
  const [x1, z1] = w(r[0], r[1])
  const [x2, z2] = w(r[2], r[3])
  const wd = x2 - x1, dp = z2 - z1
  const material = useMemo(() => {
    if (mat) return mat
    const t = tex!.clone()
    t.needsUpdate = true
    t.repeat.set(wd / tileM!, dp / tileM!)
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })
  }, [mat, tex, wd, dp, tileM])
  return (
    <mesh position={[(x1 + x2) / 2, y, (z1 + z2) / 2]} rotation-x={-Math.PI / 2} receiveShadow material={material}>
      <planeGeometry args={[wd, dp]} />
    </mesh>
  )
}

/**
 * Exterior walls lower to a short stub whenever they sit between the camera and the room,
 * so the miniature always reads as an open-roof architectural model.
 */
function Wall({ def, children }: { def: WallDef; children?: React.ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  const scale = useRef(1)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const dir = useMemo(() => new THREE.Vector3(), [])
  const [ax, az] = w(...def.a)
  const [bx, bz] = w(...def.b)
  const angle = -Math.atan2(bz - az, bx - ax)
  const glazed = def.kind === 'glazed'

  useFrame(() => {
    if (!def.normal) return
    camera.getWorldDirection(dir)
    // camera looks along `dir`; the wall faces it when its outward normal points back at the camera
    const facing = -(def.normal[0] * dir.x + def.normal[1] * dir.z) / Math.max(0.0001, Math.hypot(dir.x, dir.z))
    const want = facing > 0.12 ? STUB / def.h : 1
    const next = scale.current + (want - scale.current) * 0.22
    scale.current = Math.abs(want - next) < 0.003 ? want : next
    g.current.scale.y = scale.current
    if (scale.current !== want) invalidate()
  })

  // split the run around door gaps
  const runs = useMemo(() => {
    const along = (p: [number, number]) => (Math.abs(def.b[0] - def.a[0]) > Math.abs(def.b[1] - def.a[1]) ? p[0] : p[1])
    const a0 = along(def.a), a1 = along(def.b)
    const cuts: [number, number][] = []
    let cur = a0
    for (const [g0, g1] of def.gaps ?? []) { cuts.push([cur, g0]); cur = g1 }
    cuts.push([cur, a1])
    return cuts.map(([p, q]) => [m(p - a0), m(q - a0)] as [number, number])
  }, [def])

  return (
    <group position={[ax, 0, az]} rotation-y={angle}>
      <group ref={g}>
        {runs.map(([s0, s1], i) => {
          const L = s1 - s0
          const cx = (s0 + s1) / 2
          if (!glazed) {
            return (
              <group key={i}>
                <mesh geometry={boxGeo} material={plaster} position={[cx, def.h / 2, 0]} scale={[L + T, def.h, T]} receiveShadow />
                <mesh geometry={boxGeo} material={cap} position={[cx, def.h + 0.01, 0]} scale={[L + T + 0.004, 0.02, T + 0.004]} />
              </group>
            )
          }
          const sill = def.sill ?? 0.5
          const head = 0.32
          const bays = Math.max(1, Math.round(L / 1.35))
          return (
            <group key={i}>
              <mesh geometry={boxGeo} material={plaster} position={[cx, sill / 2, 0]} scale={[L + T, sill, T]} receiveShadow />
              <mesh geometry={boxGeo} material={plaster} position={[cx, def.h - head / 2, 0]} scale={[L + T, head, T]} />
              <mesh geometry={boxGeo} material={cap} position={[cx, def.h + 0.01, 0]} scale={[L + T + 0.004, 0.02, T + 0.004]} />
              <mesh geometry={boxGeo} material={glass} position={[cx, (sill + def.h - head) / 2, 0]} scale={[L, def.h - head - sill, 0.02]} renderOrder={2} />
              {Array.from({ length: bays + 1 }, (_, k) => (
                <mesh key={k} geometry={boxGeo} material={frame} position={[s0 + (L * k) / bays, (sill + def.h - head) / 2, 0]} scale={[0.05, def.h - head - sill, 0.07]} />
              ))}
            </group>
          )
        })}
        {children}
      </group>
    </group>
  )
}

/** Whitewashed brick feature wall with the backlit Doolally logo and tap board (west wall, behind the bar). */
function BrickFeature() {
  const logo = useTexture(logoUrl)
  logo.colorSpace = THREE.SRGBColorSpace
  logo.anisotropy = 8
  const brickTex = useMemo(() => {
    const t = brick()
    t.repeat.set(m(BRICK.y2 - BRICK.y1) / 1.2, WALL_H / 0.9)
    return t
  }, [])
  const halo = useMemo(() => glow(), [])
  const len = m(BRICK.y2 - BRICK.y1)
  // The west wall runs north→south; the parent group is turned 180° so local +z faces east into the bar,
  // which makes "distance along the wall" run toward −x here.
  const along = -(m(BRICK.y1 - 345) + len / 2)
  const logoAlong = -m(LOGO.y - 345)
  const lh = 0.92
  const lw = lh * (564 / 262)
  return (
    <group position={[0, 0, T / 2 + 0.004]}>
      <mesh position={[along, WALL_H / 2, 0]} receiveShadow>
        <planeGeometry args={[len, WALL_H]} />
        <meshStandardMaterial map={brickTex} roughness={0.95} />
      </mesh>
      <mesh position={[logoAlong, LOGO.height, 0.006]}>
        <planeGeometry args={[lw * 1.75, lh * 1.9]} />
        <meshBasicMaterial map={halo} transparent opacity={0.85} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[logoAlong, LOGO.height, 0.04]}>
        <planeGeometry args={[lw, lh]} />
        <meshBasicMaterial map={logo} transparent alphaTest={0.05} color="#26211d" toneMapped={false} />
      </mesh>
      {/* tap board */}
      <mesh position={[-m(535 - 345), 1.36, 0.03]} castShadow={false}>
        <boxGeometry args={[m(115), 0.32, 0.05]} />
        <meshStandardMaterial color="#a97848" roughness={0.7} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[-m(486 + i * 12.5 - 345), 1.36, 0.08]}>
          <mesh position={[0, 0.02, 0]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.012, 0.012, 0.08, 8]} />
            <meshStandardMaterial color="#cfd2d4" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.07, 0.03]}>
            <cylinderGeometry args={[0.012, 0.016, 0.16, 8]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#2d2a27' : '#d6d8da'} metalness={i % 3 === 0 ? 0 : 0.7} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Chalkboards() {
  const tex = useMemo(() => [
    chalkboard(['On Tap', 'Hefeweizen', 'Apricot Ale', 'Belgian Witbier', 'Coffee Stout'], 3),
    chalkboard(['Tonight', 'Quiz night', '8 PM onwards', 'Board games', 'at the bar'], 9),
  ], [])
  return (
    <>
      {[812, 870].map((x0, i) => {
        const [x, z] = w(x0 + 25, 325.6)
        return (
          <mesh key={x0} position={[x, 1.75, z + 0.001]}>
            <planeGeometry args={[m(46), 0.92]} />
            <meshStandardMaterial map={tex[i]} roughness={0.95} />
          </mesh>
        )
      })}
    </>
  )
}

function Street() {
  const ground = useMemo(() => new THREE.MeshBasicMaterial({ color: BG }), [])
  const road = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e7e3dc' }), [])
  const curb = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f7f4ef', roughness: 0.9 }), [])
  const label13 = useMemo(() => streetLabel('13TH STREET'), [])
  const labelW = useMemo(() => streetLabel('WAVERLY STREET'), [])
  const [cx1, cz1] = w(20, 886)
  const [cx2] = w(1090, 886)
  const [ex, ez1] = w(1090, 120)
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} material={ground}>
        <planeGeometry args={[160, 160]} />
      </mesh>
      {/* road bands just beyond the kerbs */}
      <mesh rotation-x={-Math.PI / 2} position={[(cx1 + cx2) / 2 - 2, -0.02, cz1 + 2.2]} material={road}>
        <planeGeometry args={[cx2 - cx1 + 14, 4.2]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[ex + 2.2, -0.02, (ez1 + cz1) / 2 + 2]} material={road}>
        <planeGeometry args={[4.2, cz1 - ez1 + 8]} />
      </mesh>
      <mesh position={[(cx1 + cx2) / 2, 0.05, cz1]} material={curb} receiveShadow>
        <boxGeometry args={[cx2 - cx1, 0.1, 0.16]} />
      </mesh>
      <mesh position={[ex, 0.05, (ez1 + cz1) / 2]} material={curb} receiveShadow>
        <boxGeometry args={[0.16, 0.1, cz1 - ez1]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[w(330, 0)[0], -0.015, cz1 + 1.6]}>
        <planeGeometry args={[6.4, 0.8]} />
        <meshBasicMaterial map={label13} transparent depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[ex + 1.6, -0.015, w(0, 360)[1]]}>
        <planeGeometry args={[7.6, 0.95]} />
        <meshBasicMaterial map={labelW} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

export function Architecture() {
  const tex = useMemo(() => ({ wood: woodFloor(), tile: tile(), conc: concrete() }), [])
  const west = WALLS.find((d) => d.a[0] === 150 && d.a[1] === 345 && d.b[1] === 731)!
  return (
    <group>
      <Street />
      <Floor r={FLOORS.sidewalk} tex={tex.conc} tile={1.6} y={0.002} />
      <Floor r={FLOORS.sidewalkEast} tex={tex.conc} tile={1.6} y={0.002} />
      <Floor r={FLOORS.wood} tex={tex.wood} tile={2} y={0.004} />
      <Floor r={FLOORS.tileBack} tex={tex.tile} tile={1.22} y={0.006} />
      <Floor r={FLOORS.tileOpenKitchen} tex={tex.tile} tile={1.22} y={0.006} />
      <Floor r={FLOORS.tileService} tex={tex.tile} tile={1.22} y={0.006} />
      {WALLS.map((d, i) => (
        <Wall key={i} def={d}>{d === west ? <group rotation-y={Math.PI}><BrickFeature /></group> : null}</Wall>
      ))}
      <Chalkboards />
    </group>
  )
}

export { S }
