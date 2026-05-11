import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Cabin from './Cabin'
import useRopewayStore from './store'

const LANE_OFFSET = 9
const VEHICLE_SPACING = 71.7
const WARNING_SPACING = 65
const CRITICAL_SPACING = 45
const RECOVERY_HOLD_SECONDS = 30
const CAMERA_PRESETS = {
  overview: { position: [450, 450, 600], target: [450, 0, 150] },
  station: { position: [0, 96, 150], target: [0, 48, 0] },
  tracking: { position: [0, 0, 0], target: [0, 0, 0] },
  urban: { position: [800, 310, 400], target: [760, 24, 180] },
}
const STATIONS = [
  { name: 'Varanasi Cantt', x: 0, z: 0, width: 132, height: 34, terminalY: 48 },
  { name: 'Vidyapeeth', x: 450, z: 0, width: 94, height: 26, terminalY: 51 },
  { name: 'Rath Yatra', x: 900, z: 0, width: 118, height: 31, terminalY: 50 },
  { name: 'Girja Ghar', x: 760, z: 180, width: 90, height: 25, terminalY: 48 },
  { name: 'Godowlia', x: 620, z: 340, width: 136, height: 35, terminalY: 49 },
]
const TOWERS = [
  { id: 'T01', x: 50, z: 0, ground: 1.2, mast: 52, section: 'Cantt' },
  { id: 'T02', x: 100, z: 0, ground: 2.4, mast: 55, section: 'Cantt' },
  { id: 'T03', x: 150, z: 0, ground: 3.9, mast: 51, section: 'Cantt' },
  { id: 'T04', x: 200, z: 0, ground: 5.3, mast: 54, section: 'Cantt' },
  { id: 'T05', x: 250, z: 0, ground: 5.9, mast: 50, section: 'Cantt' },
  { id: 'T06', x: 300, z: 0, ground: 5.2, mast: 53, section: 'Cantt' },
  { id: 'T07', x: 350, z: 0, ground: 4.4, mast: 56, section: 'Cantt' },
  { id: 'T08', x: 400, z: 0, ground: 3.7, mast: 51, section: 'Cantt' },
  { id: 'T19', x: 540, z: 0, ground: 3.1, mast: 50, section: 'Vidyapeeth' },
  { id: 'T20', x: 630, z: 0, ground: 3.6, mast: 52, section: 'Vidyapeeth' },
  { id: 'T21', x: 720, z: 0, ground: 4.8, mast: 53, section: 'Rath Yatra' },
  { id: 'T22', x: 810, z: 0, ground: 5.6, mast: 50, section: 'Rath Yatra' },
  { id: 'T17', x: 860, z: 0, ground: 6.2, mast: 54, section: 'Rath Yatra' },
  { id: 'T18', x: 880, z: 0, ground: 6.7, mast: 51, section: 'Rath Yatra' },
  { id: 'T23', x: 880, z: 25, ground: 6.1, mast: 55, section: 'Rath Yatra' },
  { id: 'T24', x: 860, z: 50, ground: 5.2, mast: 52, section: 'Rath Yatra' },
  { id: 'T25', x: 835, z: 80, ground: 4.6, mast: 54, section: 'Rath Yatra' },
  { id: 'T26', x: 810, z: 110, ground: 3.8, mast: 50, section: 'Rath Yatra' },
  { id: 'T27', x: 785, z: 140, ground: 3.1, mast: 53, section: 'Rath Yatra' },
  { id: 'T28', x: 710, z: 230, ground: 2.7, mast: 51, section: 'Girja Ghar' },
  { id: 'T29', x: 660, z: 280, ground: 2.3, mast: 52, section: 'Girja Ghar' },
]
const ROUTE_SUPPORTS = [
  { x: STATIONS[0].x, y: STATIONS[0].terminalY, z: STATIONS[0].z },
  ...TOWERS.map((tower) => ({ x: tower.x, y: tower.ground + tower.mast + 2.7, z: tower.z })),
  { x: STATIONS[STATIONS.length - 1].x, y: STATIONS[STATIONS.length - 1].terminalY, z: STATIONS[STATIONS.length - 1].z },
]

function terrainHeight(x, z = 0) {
  const profile =
    3.2 * Math.sin((x + 360) * 0.0065) +
    1.55 * Math.sin(x * 0.018) +
    0.65 * Math.cos(z * 0.075)

  return THREE.MathUtils.clamp(profile + 3.3, 0, 9)
}

function makeSagSpan(a, b, segments = 14) {
  const span = Math.hypot(b.x - a.x, b.z - a.z)
  const sag = THREE.MathUtils.clamp(span * 0.023, 1.1, 5.2)

  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments
    const x = THREE.MathUtils.lerp(a.x, b.x, t)
    const y = THREE.MathUtils.lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * sag
    const z = THREE.MathUtils.lerp(a.z, b.z, t)
    return new THREE.Vector3(x, y, z)
  })
}

function makeLanePoints(offsetMagnitude, supports = ROUTE_SUPPORTS) {
  const points = []
  for (let i = 0; i < supports.length - 1; i += 1) {
    const v0 = i > 0 ? supports[i - 1] : supports[i]
    const v1 = supports[i]
    const v2 = supports[i + 1]
    const v3 = i < supports.length - 2 ? supports[i + 2] : supports[i + 1]

    const t1 = { dx: v2.x - v0.x, dz: v2.z - v0.z }
    const t2 = { dx: v3.x - v1.x, dz: v3.z - v1.z }

    const len1 = Math.hypot(t1.dx, t1.dz) || 1
    const len2 = Math.hypot(t2.dx, t2.dz) || 1

    const off1 = { x: (-t1.dz / len1) * offsetMagnitude, z: (t1.dx / len1) * offsetMagnitude }
    const off2 = { x: (-t2.dz / len2) * offsetMagnitude, z: (t2.dx / len2) * offsetMagnitude }

    const a = { x: supports[i].x + off1.x, y: supports[i].y, z: supports[i].z + off1.z }
    const b = { x: supports[i + 1].x + off2.x, y: supports[i + 1].y, z: supports[i + 1].z + off2.z }

    const span = makeSagSpan(a, b)
    points.push(...(i === 0 ? span : span.slice(1)))
  }
  return points
}

function makeTurnaround(cx, cz, dx, dz, y, side) {
  const angleBase = Math.atan2(dz, dx)
  return Array.from({ length: 28 }, (_, index) => {
    const t = index / 27
    const angle = angleBase + (side === 'right' ? -Math.PI / 2 + Math.PI * t : Math.PI / 2 + Math.PI * t)

    const forwardOffset = Math.cos(side === 'right' ? -Math.PI / 2 + Math.PI * t : Math.PI / 2 + Math.PI * t) * 22
    const perpOffset = Math.sin(side === 'right' ? -Math.PI / 2 + Math.PI * t : Math.PI / 2 + Math.PI * t) * LANE_OFFSET

    const rotatedX = forwardOffset * Math.cos(angleBase) - perpOffset * Math.sin(angleBase)
    const rotatedZ = forwardOffset * Math.sin(angleBase) + perpOffset * Math.cos(angleBase)

    return new THREE.Vector3(cx + rotatedX, y - Math.sin(Math.PI * t) * 1.15, cz + rotatedZ)
  })
}

function makeRoute() {
  const outbound = makeLanePoints(-LANE_OFFSET)
  const inboundForward = makeLanePoints(LANE_OFFSET)
  const inboundMotion = inboundForward.slice().reverse()

  const tEnd = { dx: STATIONS[4].x - TOWERS[TOWERS.length - 1].x, dz: STATIONS[4].z - TOWERS[TOWERS.length - 1].z }
  const lenEnd = Math.hypot(tEnd.dx, tEnd.dz) || 1
  const rightTurn = makeTurnaround(STATIONS[4].x, STATIONS[4].z, tEnd.dx / lenEnd, tEnd.dz / lenEnd, STATIONS[4].terminalY, 'right')

  const tStart = { dx: STATIONS[0].x - TOWERS[0].x, dz: STATIONS[0].z - TOWERS[0].z }
  const lenStart = Math.hypot(tStart.dx, tStart.dz) || 1
  const leftTurn = makeTurnaround(STATIONS[0].x, STATIONS[0].z, tStart.dx / lenStart, tStart.dz / lenStart, STATIONS[0].terminalY, 'left')

  const motionPoints = [...outbound, ...rightTurn.slice(1), ...inboundMotion.slice(1), ...leftTurn.slice(1)]
  const motionCurve = new THREE.CatmullRomCurve3(motionPoints, true, 'catmullrom', 0.12)

  return {
    motionCurve,
    outbound,
    inbound: inboundForward,
    turnarounds: [rightTurn, leftTurn],
  }
}

function findNearestCurveProgress(curve, target, samples = 1400) {
  let bestProgress = 0
  let bestDistance = Infinity

  for (let i = 0; i <= samples; i += 1) {
    const progress = i / samples
    const point = curve.getPointAt(progress)
    const distance = point.distanceTo(target)
    if (distance < bestDistance) {
      bestDistance = distance
      bestProgress = progress
    }
  }

  return bestProgress
}

function makeStationStops(curve) {
  return STATIONS.flatMap((station) => [
    {
      name: station.name,
      progress: findNearestCurveProgress(curve, new THREE.Vector3(station.x, station.terminalY, -LANE_OFFSET)),
    },
    {
      name: station.name,
      progress: findNearestCurveProgress(curve, new THREE.Vector3(station.x, station.terminalY, LANE_OFFSET)),
    },
  ])
}

function makeTerrainGeometry() {
  const width = 1550
  const depth = 180
  const geometry = new THREE.PlaneGeometry(width, depth, 52, 8)
  geometry.rotateX(-Math.PI / 2)

  const positions = geometry.attributes.position
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index)
    const z = positions.getZ(index)
    positions.setY(index, terrainHeight(x, z) - 1.25)
  }

  geometry.computeVertexNormals()
  return geometry
}

function makeUrbanBlocks() {
  const blocks = []
  for (let row = 0; row < 6; row += 1) {
    const zBase = row < 3 ? -88 + row * 19 : 34 + (row - 3) * 20
    for (let col = 0; col < 18; col += 1) {
      const x = -720 + col * 82 + ((row % 2) * 17)
      if (Math.abs(zBase) < 32 || x < -785 || x > 785) continue
      const width = 24 + ((col * 7 + row * 5) % 20)
      const depth = 10 + ((col * 3 + row * 11) % 12)
      const height = 5 + ((col * 13 + row * 17) % 18)
      blocks.push({ x, z: zBase, width, depth, height, tone: (col + row) % 4 })
    }
  }
  return blocks
}

function VaranasiUrbanContext() {
  const ambienceRef = useRef(null)
  const blocks = useMemo(() => makeUrbanBlocks(), [])
  const streetLines = useMemo(() => {
    const lines = []
    for (let x = -760; x <= 760; x += 82) {
      lines.push([new THREE.Vector3(x, terrainHeight(x, -76) + 0.08, -104), new THREE.Vector3(x + 28, terrainHeight(x + 28, 78) + 0.08, 102)])
    }
    for (let z = -94; z <= 94; z += 24) {
      lines.push([new THREE.Vector3(-780, terrainHeight(-780, z) + 0.1, z), new THREE.Vector3(780, terrainHeight(780, z) + 0.1, z + Math.sin(z) * 5)])
    }
    return lines
  }, [])

  useFrame((state) => {
    if (ambienceRef.current) {
      ambienceRef.current.intensity = 0.75 + Math.sin(state.clock.elapsedTime * 0.65) * 0.12
    }
  })

  return (
    <group>
      {streetLines.map((points, index) => (
        <Line key={index} points={points} color={index % 3 === 0 ? '#7c4a20' : '#303842'} lineWidth={index % 3 === 0 ? 1.8 : 1.1} />
      ))}

      {blocks.map((block, index) => {
        const y = terrainHeight(block.x, block.z) + block.height / 2 - 0.75
        const colors = ['#302820', '#3a3027', '#27313a', '#3b3428']
        return (
          <mesh key={index} position={[block.x, y, block.z]} castShadow receiveShadow>
            <boxGeometry args={[block.width, block.height, block.depth]} />
            <meshStandardMaterial
              color={colors[block.tone]}
              emissive={block.tone === 1 ? '#2f1605' : '#05080b'}
              emissiveIntensity={block.tone === 1 ? 0.12 : 0.04}
              metalness={0.08}
              roughness={0.72}
            />
          </mesh>
        )
      })}

      {[-690, -620, -548, -474, -402, -330].map((x, index) => {
        const z = -116 - index * 3
        const baseY = terrainHeight(x, z) + 0.2
        return (
          <mesh key={x} position={[x, baseY + index * 0.75, z]} receiveShadow>
            <boxGeometry args={[78, 1.1, 11]} />
            <meshStandardMaterial color="#4b3929" emissive="#2a1204" emissiveIntensity={0.08} roughness={0.82} />
          </mesh>
        )
      })}

      {[-610, -75, 305, 635].map((x, index) => {
        const z = index % 2 === 0 ? -82 : 86
        const y = terrainHeight(x, z)
        return (
          <group key={x} position={[x, y, z]}>
            <mesh position={[0, 7.5, 0]} castShadow>
              <cylinderGeometry args={[6, 7.5, 15, 8]} />
              <meshStandardMaterial color="#4c3421" emissive="#2d1204" emissiveIntensity={0.1} roughness={0.65} />
            </mesh>
            <mesh position={[0, 18, 0]} castShadow>
              <coneGeometry args={[8.5, 15, 8]} />
              <meshStandardMaterial color="#c26a20" emissive="#411600" emissiveIntensity={0.25} metalness={0.1} roughness={0.45} />
            </mesh>
            <mesh position={[0, 27, 0]}>
              <coneGeometry args={[2.8, 7, 8]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f97316" emissiveIntensity={0.45} roughness={0.35} />
            </mesh>
          </group>
        )
      })}

      {[-520, -130, 210, 560].map((x) => (
        <pointLight key={x} ref={x === -130 ? ambienceRef : null} position={[x, 18, x > 0 ? 70 : -78]} intensity={0.5} color="#f97316" distance={135} />
      ))}
    </group>
  )
}

function Beam({ from, to, radius = 0.28, color = '#7d8790' }) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const midpoint = start.clone().add(end).multiplyScalar(0.5)
    const direction = end.clone().sub(start)
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    )

    return { position: midpoint, quaternion: quat, length: direction.length() }
  }, [from, to])

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial color={color} metalness={0.58} roughness={0.28} />
    </mesh>
  )
}

function SheaveTrain({ z }) {
  const wheels = [-3.9, -2.2, -0.5, 1.2, 2.9]

  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, -1.35, 0]}>
        <boxGeometry args={[11, 0.65, 1.1]} />
        <meshStandardMaterial color="#333b43" metalness={0.7} roughness={0.22} />
      </mesh>
      {wheels.map((x) => (
        <mesh key={x} position={[x, -0.72, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.95, 0.95, 0.52, 20]} />
          <meshStandardMaterial color="#151a20" metalness={0.82} roughness={0.18} />
        </mesh>
      ))}
    </group>
  )
}

function Tower({ tower, rotationY = 0 }) {
  const headY = tower.ground + tower.mast

  return (
    <group position={[tower.x, 0, tower.z]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, tower.ground + 0.35, 0]} receiveShadow>
        <boxGeometry args={[12, 0.7, 13]} />
        <meshStandardMaterial color="#30343a" metalness={0.32} roughness={0.42} />
      </mesh>

      <mesh position={[0, tower.ground + tower.mast / 2, 0]} castShadow>
        <cylinderGeometry args={[1.15, 1.75, tower.mast, 18]} />
        <meshStandardMaterial color="#717982" metalness={0.56} roughness={0.3} />
      </mesh>

      <Beam from={[-5, tower.ground + 5, -4]} to={[0, headY - 2.8, 0]} radius={0.16} color="#5e6871" />
      <Beam from={[5, tower.ground + 5, 4]} to={[0, headY - 2.8, 0]} radius={0.16} color="#5e6871" />
      <Beam from={[-5, tower.ground + 5, 4]} to={[0, headY - 2.8, 0]} radius={0.16} color="#5e6871" />
      <Beam from={[5, tower.ground + 5, -4]} to={[0, headY - 2.8, 0]} radius={0.16} color="#5e6871" />

      <mesh position={[0, headY, 0]} castShadow>
        <boxGeometry args={[19, 1.35, 26]} />
        <meshStandardMaterial color="#808a93" metalness={0.62} roughness={0.24} />
      </mesh>

      <mesh position={[0, headY + 1.35, 0]}>
        <boxGeometry args={[12, 0.95, 22]} />
        <meshStandardMaterial color="#aab1b8" metalness={0.58} roughness={0.22} />
      </mesh>

      <SheaveTrain z={-LANE_OFFSET} />
      <SheaveTrain z={LANE_OFFSET} />

      <Html position={[0, headY + 5, 0]} center distanceFactor={48}>
        <div className="rounded border border-orange-300/40 bg-slate-950/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-orange-200">
          {tower.id}
        </div>
      </Html>
    </group>
  )
}

function Station({ station, rotationY = 0 }) {
  const y = terrainHeight(station.x, station.z)
  const hasBullwheel = ['Varanasi Cantt', 'Rath Yatra', 'Godowlia'].includes(station.name)
  const terminalDeckY = station.terminalY - y - 7

  return (
    <group position={[station.x, y, station.z]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[station.width + 18, 4.8, 70]} />
        <meshStandardMaterial color="#1d232a" metalness={0.35} roughness={0.42} />
      </mesh>

      <mesh position={[0, terminalDeckY - 7.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[station.width + 6, station.height * 0.58, 54]} />
        <meshStandardMaterial color="#242b33" metalness={0.4} roughness={0.34} />
      </mesh>

      <mesh position={[0, terminalDeckY, 0]} castShadow receiveShadow>
        <boxGeometry args={[station.width + 20, 4.2, 76]} />
        <meshStandardMaterial color="#4a535c" metalness={0.52} roughness={0.24} />
      </mesh>

      <mesh position={[0, terminalDeckY + 5.8, 0]} castShadow>
        <boxGeometry args={[station.width - 12, 4.8, 42]} />
        <meshStandardMaterial color="#e87922" emissive="#5a1e05" emissiveIntensity={0.38} metalness={0.3} roughness={0.28} />
      </mesh>

      {[-21, 21].map((z) => (
        <mesh key={z} position={[0, terminalDeckY + 0.8, z]}>
          <boxGeometry args={[station.width + 4, 0.62, 8]} />
          <meshStandardMaterial color="#c0c8cf" metalness={0.72} roughness={0.2} />
        </mesh>
      ))}

      {[-station.width * 0.35, 0, station.width * 0.35].map((x) => (
        <group key={x}>
          <Beam from={[x, 4.8, -26]} to={[x, terminalDeckY + 4.5, -26]} radius={0.22} color="#69737c" />
          <Beam from={[x, 4.8, 26]} to={[x, terminalDeckY + 4.5, 26]} radius={0.22} color="#69737c" />
        </group>
      ))}

      {hasBullwheel && (
        <BullwheelBay station={station} terminalY={station.terminalY - y} />
      )}

      <mesh position={[0, terminalDeckY + 12.5, 0]} castShadow>
        <boxGeometry args={[station.width + 34, 3.5, 86]} />
        <meshStandardMaterial color="#181e25" metalness={0.56} roughness={0.24} />
      </mesh>

      <mesh position={[0, terminalDeckY + 14.8, 0]} castShadow>
        <boxGeometry args={[station.width + 18, 1.4, 66]} />
        <meshStandardMaterial color="#78838c" metalness={0.62} roughness={0.22} />
      </mesh>

      {[-28, 28].map((z) => (
        <pointLight key={z} position={[0, terminalDeckY + 9.8, z]} intensity={0.65} color="#f59e0b" distance={95} />
      ))}

      <Html position={[0, terminalDeckY + 20, 0]} center distanceFactor={140}>
        <div className="rounded-xl border border-amber-300/60 bg-stone-950/90 px-8 py-3 text-center text-2xl font-black uppercase tracking-[0.35em] text-amber-50 shadow-[0_0_50px_rgba(251,191,36,0.8)] backdrop-blur-md">
          {station.name}
        </div>
      </Html>
    </group>
  )
}

function BullwheelWheel({ x = 0, z = 0, radius, direction = 1 }) {
  const assemblyRef = useRef(null)

  useFrame((_, delta) => {
    if (assemblyRef.current) assemblyRef.current.rotation.y += delta * 0.42 * direction
  })

  return (
    <group position={[x, 0, z]}>
      <group ref={assemblyRef}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.65, 16, 64]} />
          <meshStandardMaterial color="#949ea8" metalness={0.88} roughness={0.15} />
        </mesh>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 0.85, 0.35, 12, 48]} />
          <meshStandardMaterial color="#6a7580" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh castShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[radius * 0.25, radius * 0.25, 2.2, 32]} />
          <meshStandardMaterial color="#2d353e" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[radius * 0.15, radius * 0.18, 0.4, 16]} />
          <meshStandardMaterial color="#e87922" emissive="#5a1e05" emissiveIntensity={0.2} metalness={0.6} roughness={0.3} />
        </mesh>
        {Array.from({ length: 16 }, (_, i) => (
          <mesh key={i} rotation={[0, (i / 16) * Math.PI * 2, 0]} position={[0, 0, 0]}>
            <boxGeometry args={[radius * 2, 0.4, 0.5]} />
            <meshStandardMaterial color="#aab4bd" metalness={0.78} roughness={0.22} />
          </mesh>
        ))}
      </group>
      {/* Wrapped rope path indicator around the wheel */}
      <Line
        points={Array.from({ length: 33 }, (_, i) => {
          // Half circle wrap
          const angle = Math.PI / 2 + (i / 32) * Math.PI * direction
          return new THREE.Vector3(Math.cos(angle) * (radius + 0.65), 0, Math.sin(angle) * (radius + 0.65))
        })}
        color="#f6d38c"
        lineWidth={2.8}
      />
    </group>
  )
}

function BullwheelBay({ station, terminalY }) {
  const radius = Math.max(16, station.width * 0.14)
  const isEndStation = station.name === 'Varanasi Cantt' || station.name === 'Godowlia'
  const isAngleStation = station.name === 'Rath Yatra'

  return (
    <group position={[0, terminalY + 2.8, 0]}>
      <pointLight position={[0, 4, 0]} intensity={1.5} color="#f59e0b" distance={120} />

      <mesh position={[0, -2.4, 0]} castShadow>
        <boxGeometry args={[station.width * 0.6, 1.4, radius * 3.5]} />
        <meshStandardMaterial color="#1a2026" metalness={0.65} roughness={0.3} />
      </mesh>

      <mesh position={[station.width * 0.18, -1.0, 0]} castShadow>
        <boxGeometry args={[4.5, 2.2, radius * 3.0]} />
        <meshStandardMaterial color="#2d353c" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[-station.width * 0.18, -1.0, 0]} castShadow>
        <boxGeometry args={[4.5, 2.2, radius * 3.0]} />
        <meshStandardMaterial color="#2d353c" metalness={0.7} roughness={0.25} />
      </mesh>

      {isAngleStation ? (
        <>
          <BullwheelWheel x={-station.width * 0.12} z={0} radius={radius * 0.85} direction={1} />
          <BullwheelWheel x={station.width * 0.12} z={0} radius={radius * 0.85} direction={-1} />
        </>
      ) : isEndStation ? (
        <BullwheelWheel
          x={station.name === 'Godowlia' ? -station.width * 0.18 : station.width * 0.18}
          z={0}
          radius={radius}
          direction={station.name === 'Godowlia' ? -1 : 1}
        />
      ) : null}

      {isEndStation && (
        <mesh position={[station.name === 'Godowlia' ? -station.width * 0.18 : station.width * 0.18, 2.8, 0]}>
          <cylinderGeometry args={[radius * 0.35, radius * 0.35, 0.4, 32]} />
          <meshStandardMaterial color="#e87922" emissive="#3a1000" emissiveIntensity={0.2} metalness={0.4} roughness={0.6} />
        </mesh>
      )}
    </group>
  )
}

function TensioningUnit() {
  const passengerLoad = useRopewayStore((state) => state.passengerLoad)
  const z = THREE.MathUtils.mapLinear(passengerLoad, 0, 100, -4.5, 4.5)

  return (
    <group position={[-766, terrainHeight(-720) + 13.5, z]}>
      <mesh castShadow>
        <boxGeometry args={[13, 4.8, 8]} />
        <meshStandardMaterial color="#f18424" emissive="#3f1600" emissiveIntensity={0.25} metalness={0.52} roughness={0.23} />
      </mesh>
      <mesh position={[8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.65, 0.65, 10, 18]} />
        <meshStandardMaterial color="#cad1d8" metalness={0.86} roughness={0.14} />
      </mesh>
    </group>
  )
}

function SafetyController({ telemetryRef, curveLength, totalCabins }) {
  const lastPowerUpdate = useRef(0)
  const recoveryStartRef = useRef(null)
  const interventionStartRef = useRef(null)

  useFrame((state) => {
    const store = useRopewayStore.getState()
    const warnings = []
    const cabins = Object.values(telemetryRef.current).filter(Boolean)
    const safeCabins = cabins.filter((cabin) => cabin.safe).length

    let operationalState = 'NORMAL'
    let collisionState = 'SAFE'
    let dispatchAllowed = true
    let minimumSpacing = Infinity
    let recoveryCountdown = 0

    if (store.lineSpeed === 0 && store.windSpeed < 40) {
      operationalState = 'SYSTEM STOPPED'
    } else if (store.windSpeed >= 50) {
      dispatchAllowed = false
      warnings.push('HIGH WIND EMERGENCY: STOP NEW DEPARTURES')

      if (safeCabins >= totalCabins && totalCabins > 0) {
        operationalState = 'EVACUATION COMPLETE'
        warnings.push('ALL CABINS AT STATIONS: ROPE LOCKED')
      } else {
        operationalState = 'EMERGENCY RETURN MODE'
        warnings.push('FORWARD-ONLY EVACUATION TO NEXT STATIONS')
        warnings.push('EVACUATION SPEED ACTIVE')
      }
    } else if (store.windSpeed >= 40) {
      operationalState = 'WIND WARNING'
      dispatchAllowed = false
      warnings.push('WIND WARNING: REDUCED ROPE SPEED')
      warnings.push('DISPATCH PREPARATION SUSPENDED')
    }

    const movingCabins = cabins
      .filter((cabin) => !cabin.safe && cabin.lineMonitored)
      .sort((a, b) => a.progress - b.progress)

    if (movingCabins.length > 1) {
      for (let i = 0; i < movingCabins.length; i += 1) {
        const current = movingCabins[i]
        const next = movingCabins[(i + 1) % movingCabins.length]

        if (next) {
          let progressDiff = next.progress - current.progress
          if (progressDiff < 0) {
            progressDiff += 1
          }

          const pathDistance = progressDiff * curveLength
          minimumSpacing = Math.min(minimumSpacing, pathDistance)
        }
      }
    }

    if (!store.antiCollisionEvent) {
      interventionStartRef.current = null
      recoveryStartRef.current = null
    }

    if (store.antiCollisionEvent) {
      if (interventionStartRef.current === null) {
        interventionStartRef.current = state.clock.elapsedTime
      }

      const elapsed = state.clock.elapsedTime - interventionStartRef.current
      recoveryCountdown = Math.max(0, Math.ceil(RECOVERY_HOLD_SECONDS - elapsed))

      if (elapsed < 2) {
        collisionState = 'CRITICAL'
        dispatchAllowed = false
        warnings.push('ANTI-COLLISION CRITICAL: SERVICE SPEED RESTRICTED')
      } else if (elapsed < RECOVERY_HOLD_SECONDS) {
        if (recoveryStartRef.current === null) {
          recoveryStartRef.current = state.clock.elapsedTime
        }

        operationalState = 'RECOVERY MODE'
        collisionState = 'RECOVERY'
        dispatchAllowed = false
        warnings.push(`RECOVERY MODE: STABILIZING FLOW (${recoveryCountdown}s)`)
      } else {
        store.clearAntiCollisionEvent()
        recoveryStartRef.current = null
        interventionStartRef.current = null
        collisionState = 'SAFE'
        operationalState = 'NORMAL'
        dispatchAllowed = true
        recoveryCountdown = 0
        minimumSpacing = Infinity
        warnings.length = 0
      }
    }

    if (store.antiCollisionEvent && collisionState !== 'RECOVERY') {
      warnings.push('SIMULATED SPACING FAULT ACTIVE')
    }

    store.setOperationalSnapshot({
      operationalState,
      collisionState,
      dispatchAllowed,
      recoveryCountdown,
      cabinsSafe: safeCabins,
      totalCabins: cabins.length,
      minimumSpacing,
    })

    store.setSystemWarnings([...new Set(warnings)])

    if (state.clock.elapsedTime - lastPowerUpdate.current > 0.15) {
      lastPowerUpdate.current = state.clock.elapsedTime

      const windLimited =
        store.windSpeed >= 50
          ? Math.min(store.lineSpeed, 2.4)
          : store.windSpeed >= 40
            ? Math.min(store.lineSpeed, 3.2)
            : store.lineSpeed

      const collisionLimited =
        collisionState === 'CRITICAL'
          ? Math.min(windLimited, 0.8)
          : collisionState === 'RECOVERY'
            ? Math.min(windLimited, 3.0)
            : windLimited

      store.setPowerDraw(
        Number(((store.passengerLoad * 0.5) * collisionLimited).toFixed(1))
      )
    }
  })

  return null
}

function CameraRig({ curve, curveLength, controlsRef, telemetryRef }) {
  const { camera } = useThree()
  const preset = useRopewayStore((state) => state.cameraPreset)
  const cameraFollowSpeed = useRopewayStore((state) => state.cameraFollowSpeed)
  const lineSpeed = useRopewayStore((state) => state.lineSpeed)
  const trackMode = useRopewayStore((state) => state.trackMode)
  const trackReverse = useRopewayStore((state) => state.trackReverse)
  const trackSpeedRatio = useRopewayStore((state) => state.trackSpeedRatio)
  const selectedCabinId = useRopewayStore((state) => state.selectedCabinId)

  const isAnimatingPreset = useRef(false)
  const targetCameraPos = useRef(new THREE.Vector3())
  const targetCameraLookAt = useRef(new THREE.Vector3())
  const stationIndexRef = useRef(0)

  const cameraTrigger = useRopewayStore((state) => state.cameraTrigger)

  // Initialize and handle preset changes
  useEffect(() => {
    if (preset !== 'tracking') {
      if (preset === 'station') {
        const station = STATIONS[stationIndexRef.current]
        const dx = station.x === 0 ? 115 : station.x === 900 ? -115 : 0
        const dz = station.z > 0 ? 115 : 0
        targetCameraPos.current.set(station.x + (dx || -115), station.terminalY + 68, station.z + (dz || 150))
        targetCameraLookAt.current.set(station.x, station.terminalY, station.z)
      } else {
        const config = CAMERA_PRESETS[preset] || CAMERA_PRESETS.overview
        targetCameraPos.current.set(...config.position)
        targetCameraLookAt.current.set(...config.target)
      }
      isAnimatingPreset.current = true
    }
  }, [preset, cameraTrigger])

  // Handle keyboard navigation between stations
  useEffect(() => {
    const handleKeyDown = (e) => {
      let changed = false
      if (e.key === 'ArrowRight') {
        stationIndexRef.current = (stationIndexRef.current + 1) % STATIONS.length
        changed = true
      } else if (e.key === 'ArrowLeft') {
        stationIndexRef.current = (stationIndexRef.current - 1 + STATIONS.length) % STATIONS.length
        changed = true
      }

      if (changed) {
        const store = useRopewayStore.getState()
        if (store.cameraPreset !== 'station') {
          store.setCameraPreset('station')
        } else {
          // Preset is already 'station', trigger transition manually
          const station = STATIONS[stationIndexRef.current]
          const dx = station.x === 0 ? 115 : station.x === 900 ? -115 : 0
          const dz = station.z > 0 ? 115 : 0
          targetCameraPos.current.set(station.x + (dx || -115), station.terminalY + 68, station.z + (dz || 150))
          targetCameraLookAt.current.set(station.x, station.terminalY, station.z)
          isAnimatingPreset.current = true
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useFrame((state) => {
    const selectedCabin = selectedCabinId !== null ? telemetryRef.current[selectedCabinId] : null
    if (selectedCabin) {
      const progress = selectedCabin.progress
      const point = curve.getPointAt(progress)
      const forward = curve.getTangentAt(progress).normalize()
      const desiredPosition = point.clone().add(forward.clone().multiplyScalar(-18)).add(new THREE.Vector3(0, 18, 10))
      const desiredTarget = point.clone().add(forward.clone().multiplyScalar(12))

      camera.position.lerp(desiredPosition, cameraFollowSpeed)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(desiredTarget, cameraFollowSpeed)
        controlsRef.current.update()
      }
      return
    }

    if (preset === 'tracking') {
      // Cinematic tracking mode auto-updates every frame and follows rope direction.
      // Match the rope progress speed to actual line speed along the curve.
      const baseProgressSpeed = lineSpeed / curveLength
      const ratio =
        trackMode === 'match'
          ? 1
          : trackMode === 'slow'
            ? Math.min(trackSpeedRatio, 0.99)
            : 1 + trackSpeedRatio * 3
      const progressSpeed = baseProgressSpeed * ratio * (trackReverse ? -1 : 1)
      const progress = ((state.clock.elapsedTime * progressSpeed) % 1 + 1) % 1
      const point = curve.getPointAt(progress)
      const forward = curve.getTangentAt(progress).normalize()
      const desiredPosition = point.clone().add(forward.clone().multiplyScalar(-72)).add(new THREE.Vector3(0, 58, 22))
      const desiredTarget = point.clone().add(forward.clone().multiplyScalar(42))

      camera.position.lerp(desiredPosition, cameraFollowSpeed)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(desiredTarget, cameraFollowSpeed)
        controlsRef.current.update()
      }
    } else if (isAnimatingPreset.current) {
      // Smoothly reposition camera to preset coordinates
      camera.position.lerp(targetCameraPos.current, 0.06)
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetCameraLookAt.current, 0.06)
        controlsRef.current.update()
      }

      // Prevent camera lock by checking if we reached the target
      if (camera.position.distanceTo(targetCameraPos.current) < 2.0) {
        isAnimatingPreset.current = false
      }
    }
  })

  return null
}

export default function Scene() {
  const telemetryRef = useRef({})
  const controlsRef = useRef(null)
  const route = useMemo(() => makeRoute(), [])
  const terrainGeometry = useMemo(() => makeTerrainGeometry(), [])
  const curveLength = useMemo(() => route.motionCurve.getLength(), [route])
  const stationStops = useMemo(() => makeStationStops(route.motionCurve), [route])
  const antiCollisionEvent = useRopewayStore((state) => state.antiCollisionEvent)
  const cabinOffsets = useMemo(() => {
    const count = Math.max(18, Math.floor(curveLength / VEHICLE_SPACING))
    return Array.from({ length: count }, (_, index) => index / count)
  }, [curveLength])
  const cabinStations = useMemo(
    () => STATIONS.map((station) => ({ name: station.name, position: [station.x, 0, station.z] })),
    [],
  )

  return (
    <>
      <color attach="background" args={['#080c12']} />
      <fog attach="fog" args={['#080c12', 180, 1220]} />
      <ambientLight intensity={0.45} color="#9db4c7" />
      <directionalLight position={[-180, 130, 130]} intensity={1.65} color="#ff9b42" castShadow />
      <pointLight position={[0, 58, 0]} intensity={1.1} color="#f97316" distance={620} />
      <Environment preset="city" />

      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial color="#161c22" metalness={0.08} roughness={0.86} flatShading />
      </mesh>

      <VaranasiUrbanContext />

      {[-54, 54].map((z) => (
        <Line
          key={z}
          points={[
            new THREE.Vector3(-780, terrainHeight(-720) + 0.08, z),
            new THREE.Vector3(780, terrainHeight(720) + 0.08, z),
          ]}
          color="#28313a"
          lineWidth={1}
        />
      ))}

      <Line points={route.outbound} color="#dfe8ed" lineWidth={2.2} />
      <Line points={route.inbound} color="#dfe8ed" lineWidth={2.2} />
      {route.turnarounds.map((points, index) => (
        <Line key={index} points={points} color="#dfe8ed" lineWidth={2.2} />
      ))}

      <Line points={route.outbound.map((point) => point.clone().add(new THREE.Vector3(0, -0.38, 0)))} color="#64707b" lineWidth={1} />
      <Line points={route.inbound.map((point) => point.clone().add(new THREE.Vector3(0, -0.38, 0)))} color="#64707b" lineWidth={1} />

      {STATIONS.map((station, index) => {
        const prev = index > 0 ? STATIONS[index - 1] : station
        const next = index < STATIONS.length - 1 ? STATIONS[index + 1] : station
        const dx = next.x - prev.x
        const dz = next.z - prev.z
        const rotationY = -Math.atan2(dz, dx)
        return <Station key={station.name} station={station} rotationY={rotationY} />
      })}
      <TensioningUnit />

      {TOWERS.map((tower, index) => {
        const prev = index > 0 ? TOWERS[index - 1] : STATIONS[0]
        const next = index < TOWERS.length - 1 ? TOWERS[index + 1] : STATIONS[STATIONS.length - 1]
        const dx = next.x - prev.x
        const dz = next.z - prev.z
        const rotationY = -Math.atan2(dz, dx)
        return <Tower key={tower.id} tower={tower} rotationY={rotationY} />
      })}

      {cabinOffsets.map((offset, index) => (
        <Cabin
          key={index}
          id={index}
          offset={offset}
          curve={route.motionCurve}
          curveLength={curveLength}
          stations={cabinStations}
          stationStops={stationStops}
          telemetryRef={telemetryRef}
          spacingCompression={antiCollisionEvent ? 0.004 : 0.00035}
        />
      ))}

      <SafetyController telemetryRef={telemetryRef} curveLength={curveLength} totalCabins={cabinOffsets.length} />
      <CameraRig curve={route.motionCurve} curveLength={curveLength} controlsRef={controlsRef} telemetryRef={telemetryRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 32, 0]}
        minDistance={90}
        maxDistance={1200}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.49}
        enableDamping
        dampingFactor={0.05}
        panSpeed={0.8}
        rotateSpeed={0.65}
        zoomSpeed={0.8}
        screenSpacePanning
      />
    </>
  )
}
