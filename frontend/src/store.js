import { create } from 'zustand'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export const useRopewayStore = create((set, get) => ({
  lineSpeed: 6.0,
  windSpeed: 10,
  passengerLoad: 50,
  powerDraw: 150,
  operationalState: 'NORMAL',
  collisionState: 'SAFE',
  dispatchAllowed: true,
  antiCollisionEvent: false,
  recoveryCountdown: 0,
  cameraPreset: 'overview',
  selectedCabinId: null,
  cabinsSafe: 0,
  totalCabins: 0,
  systemWarnings: [],
  cameraFollowSpeed: 0.03,
  cameraTrigger: 0,
  trackMode: 'match',
  trackReverse: false,
  trackSpeedRatio: 1.0,
  minimizedPanels: { controls: false, telemetry: false },
  showRestoredBanner: false,
  draggablePanelPositions: { controls: { x: 0, y: 0 }, telemetry: { x: 0, y: 0 } },

  setLineSpeed: (lineSpeed) => {
    const safeSpeed = clamp(Number(lineSpeed), 0, 6)
    set({ lineSpeed: safeSpeed })
  },

  setWindSpeed: (windSpeed) => {
    set({ windSpeed: clamp(Number(windSpeed), 0, 80) })
  },

  setPassengerLoad: (passengerLoad) => {
    set({ passengerLoad: clamp(Number(passengerLoad), 0, 100) })
  },

  simulateAntiCollisionEvent: () => {
    set({ antiCollisionEvent: true })
  },

  clearAntiCollisionEvent: () =>
    set({
      antiCollisionEvent: false,
    }),

  setCameraPreset: (cameraPreset) => {
    set({ cameraPreset, cameraTrigger: Date.now() })
  },

  setSelectedCabinId: (selectedCabinId) => {
    set({ selectedCabinId })
  },

  setCameraFollowSpeed: (cameraFollowSpeed) => {
    set({ cameraFollowSpeed: clamp(Number(cameraFollowSpeed), 0.01, 0.1) })
  },

  setTrackMode: (trackMode) => {
    set({ trackMode })
  },

  toggleTrackReverse: () => {
    set((state) => ({ trackReverse: !state.trackReverse }))
  },

  setTrackSpeedRatio: (trackSpeedRatio) => {
    set({ trackSpeedRatio: clamp(Number(trackSpeedRatio), 0.4, 1.6) })
  },

  togglePanelMinimized: (panel) => {
    set((state) => ({ minimizedPanels: { ...state.minimizedPanels, [panel]: !state.minimizedPanels[panel] } }))
  },

  setPanelPosition: (panel, position) => {
    set((state) => ({ draggablePanelPositions: { ...state.draggablePanelPositions, [panel]: position } }))
  },

  resetLayout: () => {
    set({
      minimizedPanels: { controls: false, telemetry: false },
      draggablePanelPositions: { controls: { x: 0, y: 0 }, telemetry: { x: 0, y: 0 } },
    })
  },

  setPowerDraw: (powerDraw) => {
    set({ powerDraw })
  },

  setOperationalSnapshot: ({ operationalState, collisionState, dispatchAllowed, recoveryCountdown = 0, cabinsSafe, totalCabins }) => {
    const current = get()
    if (
      current.operationalState !== operationalState ||
      current.collisionState !== collisionState ||
      current.dispatchAllowed !== dispatchAllowed ||
      current.recoveryCountdown !== recoveryCountdown ||
      current.cabinsSafe !== cabinsSafe ||
      current.totalCabins !== totalCabins
    ) {
      set({ operationalState, collisionState, dispatchAllowed, recoveryCountdown, cabinsSafe, totalCabins })
    }
  },

  setSystemWarnings: (systemWarnings) => {
    const current = get().systemWarnings
    const same =
      current.length === systemWarnings.length &&
      current.every((warning, index) => warning === systemWarnings[index])

    if (!same) {
      set({ systemWarnings })
    }
  },
}))

export default useRopewayStore
