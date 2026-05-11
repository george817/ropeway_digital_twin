import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useRopewayStore from './store'

const BOARDING_SPEED = 0.28
const STATION_CAPTURE_RADIUS = 24
const STATION_APPROACH_RADIUS = 78
const EMERGENCY_DOCK_RADIUS = 7.5
const HANGER_DROP = 7.2
const tempStation = new THREE.Vector3()
const tempForward = new THREE.Vector3()
const tempLookAt = new THREE.Vector3()

function nearestStationDistance(point, stations) {
  let nearest = Infinity

  for (const station of stations) {
    tempStation.set(station.position[0], point.y, station.position[2])
    nearest = Math.min(nearest, point.distanceTo(tempStation))
  }

  return nearest
}

function nearestForwardStop(progress, stops) {
  let best = null

  for (const stop of stops) {
    const forward = (stop.progress - progress + 1) % 1

    if (!best || forward < best.distance) {
      best = { ...stop, direction: 1, distance: forward }
    }
  }

  return best
}

export default function Cabin({ id, offset, curve, curveLength, stations, stationStops, telemetryRef, spacingCompression = 0 }) {
  const groupRef = useRef(null)
  const swayRef = useRef(null)
  const bodyMaterialRef = useRef(null)
  const progressRef = useRef(offset)
  const localSpeedRef = useRef(6)
  const emergencyTargetRef = useRef(null)
  const safeRef = useRef(false)
  const spacingFaultAppliedRef = useRef(false)
  const baseProgressRef = useRef(0.18)
  const lineSpeed = useRopewayStore((state) => state.lineSpeed)
  const windSpeed = useRopewayStore((state) => state.windSpeed)
  const collisionState = useRopewayStore((state) => state.collisionState)
  const recoveryCountdown = useRopewayStore((state) => state.recoveryCountdown)
  const antiCollisionEvent = useRopewayStore((state) => state.antiCollisionEvent)
  const selectedCabinId = useRopewayStore((state) => state.selectedCabinId)
  const setSelectedCabinId = useRopewayStore((state) => state.setSelectedCabinId)
  const emergencyMode = windSpeed >= 50

  useFrame((state, delta) => {
    if (spacingCompression > 0 && !spacingFaultAppliedRef.current && id < 5) {
      progressRef.current = (0.18 + id * spacingCompression) % 1
      baseProgressRef.current = 0.18
      spacingFaultAppliedRef.current = true
    } else if (collisionState === 'RECOVERY' && spacingFaultAppliedRef.current && id < 5) {
      baseProgressRef.current = (baseProgressRef.current + (localSpeedRef.current * delta) / curveLength) % 1
      const restoredProgress = (baseProgressRef.current + id * 0.042) % 1
      progressRef.current = THREE.MathUtils.damp(progressRef.current, restoredProgress, 0.85, delta)
    } else if (spacingCompression === 0) {
      spacingFaultAppliedRef.current = false
    }

    const point = curve.getPointAt(progressRef.current)
    const horizontalStationDistance = nearestStationDistance(point, stations)
    const detached = horizontalStationDistance < STATION_CAPTURE_RADIUS
    const stationApproachGap = stationStops.reduce((nearest, stop) => {
      const gap = ((stop.progress - progressRef.current + 1) % 1) * curveLength
      return Math.min(nearest, gap)
    }, Infinity)
    const approachFactor = THREE.MathUtils.clamp(
      (STATION_APPROACH_RADIUS - stationApproachGap) / STATION_APPROACH_RADIUS,
      0,
      1,
    )
    const windLimitedSpeed = windSpeed >= 50 ? Math.min(lineSpeed, 2.4) : windSpeed >= 40 ? Math.min(lineSpeed, 3.2) : lineSpeed
    const recoveryProgress = recoveryCountdown > 0 ? (20 - recoveryCountdown) / 20 : 1
    const recoveryLimitedSpeed = THREE.MathUtils.lerp(Math.min(windLimitedSpeed, 3.2), windLimitedSpeed, recoveryProgress)
    const collisionLimitedSpeed =
      collisionState === 'CRITICAL' ? Math.min(windLimitedSpeed, 0.95) :
        collisionState === 'WARNING' ? Math.min(windLimitedSpeed, 3.0) :
          collisionState === 'RECOVERY' ? recoveryLimitedSpeed :
          windLimitedSpeed
    const recoveryBias = antiCollisionEvent && id < 5
      ? THREE.MathUtils.mapLinear(id, 0, 4, -0.36, 0.72)
      : 0
    const stationEntrySpeed = THREE.MathUtils.lerp(collisionLimitedSpeed, 1.05, approachFactor)
    let targetSpeed = detached ? Math.min(BOARDING_SPEED, collisionLimitedSpeed) : THREE.MathUtils.clamp(stationEntrySpeed + recoveryBias, 0.18, lineSpeed)
    let emergencyReturning = false

    if (!emergencyMode) {
      emergencyTargetRef.current = null
      safeRef.current = false
    } else if (!safeRef.current) {
      if (!emergencyTargetRef.current) {
        emergencyTargetRef.current = nearestForwardStop(progressRef.current, stationStops)
      }

      const target = emergencyTargetRef.current
      const forwardGap = (target.progress - progressRef.current + 1) % 1
      const distanceToTarget = forwardGap * curveLength
      emergencyReturning = true
      targetSpeed = THREE.MathUtils.clamp(lineSpeed * 0.42, 1.0, 2.4)

      if (distanceToTarget < EMERGENCY_DOCK_RADIUS) {
        progressRef.current = target.progress
        safeRef.current = true
        targetSpeed = 0
        emergencyReturning = false
      }
    } else {
      targetSpeed = 0
    }

    const damping = targetSpeed < localSpeedRef.current ? 1.85 : 1.15
    localSpeedRef.current = THREE.MathUtils.damp(localSpeedRef.current, targetSpeed, damping, delta)
    if (!safeRef.current) {
      progressRef.current = (progressRef.current + (localSpeedRef.current * delta) / curveLength) % 1
    }

    const ropePoint = curve.getPointAt(progressRef.current)
    const nextPoint = curve.getPointAt((progressRef.current + 0.002) % 1)
    tempForward.copy(nextPoint).sub(ropePoint).normalize()

    const visualPosition = ropePoint.clone()
    visualPosition.y -= HANGER_DROP

    if (detached) {
      visualPosition.y -= 2.2
      visualPosition.z = THREE.MathUtils.damp(visualPosition.z, 0, 5.5, delta)
    }

    if (groupRef.current) {
      groupRef.current.position.copy(visualPosition)
      tempLookAt.copy(visualPosition).add(tempForward)
      groupRef.current.lookAt(tempLookAt)
    }

    if (swayRef.current) {
      const windFactor = THREE.MathUtils.clamp((windSpeed - 28) / 52, 0, 1)
      const sway = Math.sin(state.clock.elapsedTime * 2.1 + id * 0.74) * windFactor * (emergencyMode ? 0.16 : 0.11)
      swayRef.current.rotation.z = THREE.MathUtils.damp(swayRef.current.rotation.z, sway, 5, delta)
      swayRef.current.rotation.x = THREE.MathUtils.damp(swayRef.current.rotation.x, -sway * 0.45, 5, delta)
    }

    if (bodyMaterialRef.current) {
      const baseColor = safeRef.current ? '#2dd4bf' : emergencyMode ? '#ff3b1f' : '#ef7a1a'
      const targetColor = selectedCabinId === id ? '#34d399' : baseColor
      bodyMaterialRef.current.color.lerp(new THREE.Color(targetColor), 0.12)
      bodyMaterialRef.current.emissive.lerp(new THREE.Color(emergencyMode && !safeRef.current ? '#4d0700' : '#000000'), 0.12)
      bodyMaterialRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        bodyMaterialRef.current.emissiveIntensity,
        emergencyMode && !safeRef.current ? 0.45 : 0,
        0.12,
      )
    }

    telemetryRef.current[id] = {
      detached,
      emergencyReturning,
      lineMonitored: !detached && stationApproachGap > STATION_APPROACH_RADIUS,
      safe: safeRef.current,
      progress: progressRef.current,
      position: visualPosition,
      speed: localSpeedRef.current,
    }
  })

  return (
    <group
      ref={groupRef}
      onPointerDown={(event) => {
        event.stopPropagation()
        setSelectedCabinId(id)
      }}
    >
      <mesh position={[0, HANGER_DROP / 2, 0]}>
        <cylinderGeometry args={[0.14, 0.14, HANGER_DROP, 12]} />
        <meshStandardMaterial color="#c1c7cd" metalness={0.82} roughness={0.18} />
      </mesh>

      <mesh position={[0, HANGER_DROP + 0.1, 0]}>
        <boxGeometry args={[2.4, 0.55, 1.1]} />
        <meshStandardMaterial color="#aeb6be" metalness={0.78} roughness={0.18} />
      </mesh>

      <group ref={swayRef}>
        <mesh position={[0, -1.2, 0]} castShadow>
          <boxGeometry args={[4.8, 3.6, 4.2]} />
          <meshStandardMaterial
            ref={bodyMaterialRef}
            color="#ef7a1a"
            metalness={0.35}
            roughness={0.26}
          />
        </mesh>

        <mesh position={[0, -1.12, 2.14]}>
          <boxGeometry args={[3.6, 1.65, 0.08]} />
          <meshStandardMaterial color="#111820" metalness={0.2} roughness={0.12} />
        </mesh>

        <mesh position={[0, -1.12, -2.14]}>
          <boxGeometry args={[3.6, 1.65, 0.08]} />
          <meshStandardMaterial color="#111820" metalness={0.2} roughness={0.12} />
        </mesh>

        <mesh position={[-2.45, -1.12, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[3.1, 1.55, 0.08]} />
          <meshStandardMaterial color="#111820" metalness={0.2} roughness={0.12} />
        </mesh>

        <mesh position={[2.45, -1.12, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[3.1, 1.55, 0.08]} />
          <meshStandardMaterial color="#111820" metalness={0.2} roughness={0.12} />
        </mesh>

        <mesh position={[0, 0.82, 0]} castShadow>
          <boxGeometry args={[5.1, 0.55, 4.5]} />
          <meshStandardMaterial color="#111318" metalness={0.52} roughness={0.2} />
        </mesh>

        <mesh position={[0, -3.15, 0]}>
          <boxGeometry args={[4.1, 0.35, 3.5]} />
          <meshStandardMaterial color="#171b20" metalness={0.45} roughness={0.25} />
        </mesh>
      </group>
    </group>
  )
}
