import { Canvas } from '@react-three/fiber'
import Scene from './Scene'
import HUD from './HUD'

export default function App() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-stone-950">
      <HUD />
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [430, 150, 430], fov: 43, near: 0.1, far: 1600 }}
      >
        <Scene />
      </Canvas>
    </main>
  )
}
