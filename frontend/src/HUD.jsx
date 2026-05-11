import useRopewayStore from './store'
import { motion } from 'framer-motion'

function Slider({ label, value, min, max, step, unit, onChange, disabled = false }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-200/75">{label}</span>
        <span className="font-mono text-xs text-amber-100">
          {Number(value).toFixed(step < 1 ? Math.abs(Math.log10(step)) : 0)}
          {unit}
        </span>
      </div>
      <input
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-stone-900/80 accent-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export default function HUD() {
  const lineSpeed = useRopewayStore((state) => state.lineSpeed)
  const windSpeed = useRopewayStore((state) => state.windSpeed)
  const passengerLoad = useRopewayStore((state) => state.passengerLoad)
  const powerDraw = useRopewayStore((state) => state.powerDraw)
  const operationalState = useRopewayStore((state) => state.operationalState)
  const collisionState = useRopewayStore((state) => state.collisionState)
  const dispatchAllowed = useRopewayStore((state) => state.dispatchAllowed)
  const antiCollisionEvent = useRopewayStore((state) => state.antiCollisionEvent)
  const recoveryCountdown = useRopewayStore((state) => state.recoveryCountdown)
  const cameraPreset = useRopewayStore((state) => state.cameraPreset)
  const selectedCabinId = useRopewayStore((state) => state.selectedCabinId)
  const cabinsSafe = useRopewayStore((state) => state.cabinsSafe)
  const totalCabins = useRopewayStore((state) => state.totalCabins)
  const systemWarnings = useRopewayStore((state) => state.systemWarnings)
  const showRestoredBanner = useRopewayStore((state) => state.showRestoredBanner)
  const cameraFollowSpeed = useRopewayStore((state) => state.cameraFollowSpeed)
  const trackMode = useRopewayStore((state) => state.trackMode)
  const trackReverse = useRopewayStore((state) => state.trackReverse)
  const trackSpeedRatio = useRopewayStore((state) => state.trackSpeedRatio)
  const minimizedPanels = useRopewayStore((state) => state.minimizedPanels)
  const draggablePanelPositions = useRopewayStore((state) => state.draggablePanelPositions)

  const setLineSpeed = useRopewayStore((state) => state.setLineSpeed)
  const setWindSpeed = useRopewayStore((state) => state.setWindSpeed)
  const setPassengerLoad = useRopewayStore((state) => state.setPassengerLoad)
  const simulateAntiCollisionEvent = useRopewayStore((state) => state.simulateAntiCollisionEvent)
  const clearAntiCollisionEvent = useRopewayStore((state) => state.clearAntiCollisionEvent)
  const setCameraPreset = useRopewayStore((state) => state.setCameraPreset)
  const setSelectedCabinId = useRopewayStore((state) => state.setSelectedCabinId)
  const setCameraFollowSpeed = useRopewayStore((state) => state.setCameraFollowSpeed)
  const setTrackMode = useRopewayStore((state) => state.setTrackMode)
  const toggleTrackReverse = useRopewayStore((state) => state.toggleTrackReverse)
  const setTrackSpeedRatio = useRopewayStore((state) => state.setTrackSpeedRatio)
  const togglePanelMinimized = useRopewayStore((state) => state.togglePanelMinimized)
  const setPanelPosition = useRopewayStore((state) => state.setPanelPosition)
  const resetLayout = useRopewayStore((state) => state.resetLayout)

  const emergencyMode = windSpeed >= 50
  const windCapped = emergencyMode
  const activeSpeed =
    collisionState === 'CRITICAL'
      ? Math.min(lineSpeed, 0.95)
      : collisionState === 'WARNING'
        ? Math.min(lineSpeed, 3.0)
        : collisionState === 'RECOVERY'
          ? Math.min(lineSpeed, 3.2 + ((20 - recoveryCountdown) / 20) * 2.8)
          : windSpeed >= 50
          ? Math.min(lineSpeed, 2.4)
          : windSpeed >= 40
            ? Math.min(lineSpeed, 3.2)
            : lineSpeed

  const stateTone = operationalState.includes('EMERGENCY') || operationalState.includes('EVACUATION')
    ? 'text-red-200'
    : operationalState === 'WIND WARNING' || operationalState === 'RECOVERY MODE'
      ? 'text-amber-200'
      : 'text-emerald-200'

  const cameraOptions = [
    ['overview', 'Overview'],
    ['station', 'Station'],
    ['tracking', 'Track'],
    ['urban', 'Urban'],
  ]

  return (
    <div className="pointer-events-none absolute inset-0 z-10 p-3 text-white sm:p-4">
      <div className="flex items-start justify-between gap-3 h-full">
        <motion.section
          drag
          dragMomentum={false}
          onDragEnd={(e, info) => {
            setPanelPosition('controls', {
              x: draggablePanelPositions.controls.x + info.offset.x,
              y: draggablePanelPositions.controls.y + info.offset.y
            })
          }}
          animate={{ x: draggablePanelPositions.controls.x, y: draggablePanelPositions.controls.y }}
          className={`pointer-events-auto rounded-lg border border-white/15 bg-stone-950/72 shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300 ${minimizedPanels.controls ? 'w-12 h-12 flex items-center justify-center cursor-pointer' : 'w-[18.5rem] p-3'}`}
          onClick={() => minimizedPanels.controls && togglePanelMinimized('controls')}
        >
          {minimizedPanels.controls ? (
            <div className="font-black text-amber-200" title="Restore Controls">CTRL</div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h1 className="text-base font-semibold tracking-wide text-amber-100">Varanasi MDG Digital Twin</h1>
                  <p className="mt-0.5 text-xs text-stone-300">Urban MDG operations simulator</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePanelMinimized('controls'); }}
                  className="text-stone-400 hover:text-white px-2 py-0.5 font-bold bg-stone-800/50 rounded"
                >
                  −
                </button>
              </div>
              <details className="group mt-3" open>
                <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">
                  Controls
                </summary>
                <div className="mt-3 space-y-3">
                  <Slider
                    label="Line Speed"
                    value={lineSpeed}
                    min={0}
                    max={6}
                    step={0.1}
                    unit=" m/s"
                    disabled={windCapped}
                    onChange={setLineSpeed}
                  />
                  <Slider
                    label="Wind"
                    value={windSpeed}
                    min={0}
                    max={80}
                    step={1}
                    unit=" km/h"
                    onChange={setWindSpeed}
                  />
                  <Slider
                    label="Passenger Load"
                    value={passengerLoad}
                    min={0}
                    max={100}
                    step={1}
                    unit="%"
                    onChange={setPassengerLoad}
                  />
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      className="rounded border border-red-300/60 bg-red-950/60 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-100 transition hover:bg-red-900/75"
                      type="button"
                      onClick={simulateAntiCollisionEvent}
                    >
                      Simulate Anti-Collision Event
                    </button>
                    {antiCollisionEvent && (
                      <button
                        className="rounded border border-stone-300/35 bg-stone-900/70 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-100 transition hover:bg-stone-800"
                        type="button"
                        onClick={clearAntiCollisionEvent}
                      >
                        Reset Spacing Simulation
                      </button>
                    )}
                  </div>
                </div>
              </details>

              <details className="group mt-3" open>
                <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">
                  Camera
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {cameraOptions.map(([value, label]) => (
                    <button
                      key={value}
                      className={`rounded border px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] transition ${
                        cameraPreset === value
                          ? 'border-amber-300/80 bg-amber-500/20 text-amber-100'
                          : 'border-stone-500/35 bg-stone-900/70 text-stone-200 hover:bg-stone-800'
                      }`}
                      type="button"
                      onClick={() => setCameraPreset(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {selectedCabinId !== null && (
                  <div className="mt-3 rounded border border-stone-700 bg-stone-900/70 p-2 text-[10px] uppercase tracking-[0.14em] text-stone-200">
                    <div className="mb-2 font-semibold text-amber-200">Following Gondola #{selectedCabinId + 1}</div>
                    <button
                      type="button"
                      className="rounded border border-stone-500/35 bg-stone-800/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-stone-100 hover:bg-stone-700"
                      onClick={() => setSelectedCabinId(null)}
                    >
                      Clear Follow
                    </button>
                  </div>
                )}
                {cameraPreset === 'tracking' && (
                  <div className="mt-4 space-y-3">
                    <Slider
                      label="Camera Follow Speed"
                      value={cameraFollowSpeed}
                      min={0.01}
                      max={0.1}
                      step={0.01}
                      unit=""
                      onChange={setCameraFollowSpeed}
                    />
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-300">Track Speed Mode</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          ['slow', 'Slower'],
                          ['match', 'Match'],
                          ['fast', 'Faster'],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            className={`rounded border px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] transition ${
                              trackMode === value
                                ? 'border-amber-300/80 bg-amber-500/20 text-amber-100'
                                : 'border-stone-500/35 bg-stone-900/70 text-stone-200 hover:bg-stone-800'
                            }`}
                            type="button"
                            onClick={() => setTrackMode(value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Slider
                      label="Track Speed Ratio"
                      value={trackSpeedRatio}
                      min={0.4}
                      max={1.6}
                      step={0.05}
                      unit="x"
                      disabled={trackMode === 'match'}
                      onChange={setTrackSpeedRatio}
                    />
                    <button
                      className={`rounded border px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                        trackReverse
                          ? 'border-rose-300/80 bg-rose-500/20 text-rose-100'
                          : 'border-stone-500/35 bg-stone-900/70 text-stone-200 hover:bg-stone-800'
                      }`}
                      type="button"
                      onClick={toggleTrackReverse}
                    >
                      {trackReverse ? 'Reverse Track' : 'Forward Track'}
                    </button>
                  </div>
                )}
              </details>
            </>
          )}
        </motion.section>

        <motion.section
          drag
          dragMomentum={false}
          onDragEnd={(e, info) => {
            setPanelPosition('telemetry', {
              x: draggablePanelPositions.telemetry.x + info.offset.x,
              y: draggablePanelPositions.telemetry.y + info.offset.y
            })
          }}
          animate={{ x: draggablePanelPositions.telemetry.x, y: draggablePanelPositions.telemetry.y }}
          className={`pointer-events-auto rounded-lg border border-white/15 bg-stone-950/72 shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300 ${minimizedPanels.telemetry ? 'w-12 h-12 flex items-center justify-center cursor-pointer' : 'w-[23rem] p-2'}`}
          onClick={() => minimizedPanels.telemetry && togglePanelMinimized('telemetry')}
        >
          {minimizedPanels.telemetry ? (
            <div className="font-black text-amber-200" title="Restore Telemetry">TLM</div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300">Telemetry</span>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePanelMinimized('telemetry'); }}
                  className="text-stone-400 hover:text-white px-2 py-0.5 font-bold bg-stone-800/50 rounded"
                >
                  −
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-amber-200/20 bg-stone-950/72 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-300">Power</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-amber-200">{powerDraw.toFixed(1)}</div>
                  <div className="text-[10px] text-stone-400">kW</div>
                </div>

                <div className="rounded-lg border border-amber-200/20 bg-stone-950/72 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-300">Speed</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-sky-200">{activeSpeed.toFixed(1)}</div>
                  <div className="text-[10px] text-stone-400">m/s</div>
                </div>

                <div className="rounded-lg border border-amber-200/20 bg-stone-950/72 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-300">System</div>
                  <div className={`mt-1 text-sm font-black uppercase leading-tight ${stateTone}`}>{operationalState}</div>
                  {recoveryCountdown > 0 && <div className="mt-1 font-mono text-xs text-amber-100">{recoveryCountdown}s</div>}
                </div>

                <div className="rounded-lg border border-amber-200/20 bg-stone-950/72 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-300">Spacing</div>
                  <div className={`mt-1 text-xl font-black ${collisionState === 'SAFE' ? 'text-emerald-200' : collisionState === 'WARNING' || collisionState === 'RECOVERY' ? 'text-amber-200' : 'text-red-200'}`}>
                    {collisionState}
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200/20 bg-stone-950/72 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-300">Evacuation</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-teal-200">{cabinsSafe}/{totalCabins || 0}</div>
                </div>

                <div className="rounded-lg border border-amber-200/20 bg-stone-950/72 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-300">Dispatch</div>
                  <div className={`mt-1 text-lg font-black uppercase ${dispatchAllowed ? 'text-emerald-200' : 'text-red-200'}`}>
                    {dispatchAllowed ? 'Allowed' : 'Locked'}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.section>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col justify-end">
        {systemWarnings.length > 0 && (
          <div className="pointer-events-auto max-w-md animate-pulse rounded-lg border border-red-300/60 bg-red-950/82 p-3 text-red-50 shadow-2xl backdrop-blur-md mb-4">
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-200">PLC Safety Alert</div>
            <div className="space-y-1 font-mono text-xs">
              {systemWarnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          </div>
        )}
        
        {showRestoredBanner && systemWarnings.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto max-w-md rounded-lg border border-emerald-400/60 bg-emerald-950/82 p-3 text-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-md mb-4"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">System Restored</div>
            <div className="mt-1 font-mono text-sm font-bold">NORMAL OPERATIONS RESTORED</div>
          </motion.div>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-4 right-4">
        <button
          className="rounded border border-stone-500/50 bg-stone-900/80 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-stone-300 hover:bg-stone-800 hover:text-white transition shadow-lg backdrop-blur-md"
          onClick={resetLayout}
        >
          Reset Layout
        </button>
      </div>
    </div>
  )
}
