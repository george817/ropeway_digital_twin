"""Core ropeway simulation logic."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class Cabin:
    """Represents one ropeway cabin."""

    id: int
    position: float
    speed: float
    status: str
    evacuation_station: Optional[float] = None

    def to_dict(self) -> Dict:
        return asdict(self)


DESIGN_SPACING_M = 71.7
WARNING_SPACING_M = 65.0
CRITICAL_SPACING_M = 45.0
EMERGENCY_EVACUATION_SPEED_MPS = 2.0
WIND_WARNING_SPEED_MPS = 3.2
STATION_DOCK_TOLERANCE_M = 4.0


def speed_from_wind(wind_speed_kmh: float) -> float:
    """Return rope speed (m/s) based on wind speed."""
    if wind_speed_kmh < 40:
        return 6.0
    if wind_speed_kmh < 50:
        return WIND_WARNING_SPEED_MPS
    return EMERGENCY_EVACUATION_SPEED_MPS


def station_positions(route_length_m: float) -> List[float]:
    """Simplified station chain used by the operational safety model."""
    return [0.0, route_length_m * 0.5, route_length_m * 0.75]


def forward_distance(position: float, target: float, route_length_m: float) -> float:
    """Distance to a target when cabins are only allowed to continue forward."""
    return (target - position + route_length_m) % route_length_m


def nearest_station_ahead(position: float, route_length_m: float) -> float:
    """Find the next reachable station without reversing the haul rope."""
    stations = station_positions(route_length_m)
    return min(stations, key=lambda station: forward_distance(position, station, route_length_m))


def evaluate_system_status(
    wind_speed_kmh: float, running: bool, emergency_stop: bool
) -> Tuple[float, str, str]:
    """Compute rope speed, status, and alert text."""
    if emergency_stop:
        return 0.0, "EMERGENCY STOP", "Emergency stop is active. Reset to resume."
    if not running:
        return 0.0, "STOPPED", "Simulation paused by operator."

    rope_speed = speed_from_wind(wind_speed_kmh)
    if wind_speed_kmh >= 50:
        return rope_speed, "EMERGENCY RETURN MODE", "High wind emergency. Cabins continue forward to the next stations."
    if wind_speed_kmh >= 40:
        return rope_speed, "WIND WARNING", "Wind warning. Rope speed reduced and dispatch preparation suspended."
    return rope_speed, "RUNNING", ""


def initialize_cabins(count: int, route_length_m: float) -> List[Cabin]:
    """Create evenly spaced cabins on route."""
    spacing = route_length_m / max(count, 1)
    return [
        Cabin(id=i + 1, position=i * spacing, speed=0.0, status="IDLE")
        for i in range(count)
    ]


def initialize_cabins_by_spacing(vehicle_spacing_m: float, route_length_m: float) -> List[Cabin]:
    """Create cabins based on engineering vehicle spacing."""
    count = max(int(route_length_m / max(vehicle_spacing_m, 1.0)), 1)
    return initialize_cabins(count=count, route_length_m=route_length_m)


def update_cabins(
    cabins: List[Cabin],
    rope_speed: float,
    dt_seconds: float,
    route_length_m: float,
    emergency_return_mode: bool = False,
) -> List[Cabin]:
    """Advance cabin positions. Emergency movement is forward-only to station stops."""
    for cabin in cabins:
        if emergency_return_mode and cabin.status == "SAFE_AT_STATION":
            cabin.speed = 0.0
            continue

        if emergency_return_mode:
            if cabin.evacuation_station is None:
                cabin.evacuation_station = nearest_station_ahead(cabin.position, route_length_m)

            gap_to_station = forward_distance(cabin.position, cabin.evacuation_station, route_length_m)
            move_distance = rope_speed * dt_seconds
            if gap_to_station <= max(move_distance, STATION_DOCK_TOLERANCE_M):
                cabin.position = cabin.evacuation_station
                cabin.speed = 0.0
                cabin.status = "SAFE_AT_STATION"
                continue

            cabin.speed = rope_speed
            cabin.status = "EVACUATING"
            cabin.position = (cabin.position + move_distance) % route_length_m
            continue

        cabin.evacuation_station = None
        cabin.speed = rope_speed
        cabin.status = "MOVING" if rope_speed > 0 else "STOPPED"
        cabin.position = (cabin.position + rope_speed * dt_seconds) % route_length_m
    return cabins


def evaluate_cabin_spacing(cabins: List[Cabin], route_length_m: float) -> Tuple[str, float]:
    """Monitor adjacent forward gaps around the rope loop."""
    if len(cabins) < 2:
        return "SAFE", route_length_m

    positions = sorted(cabin.position % route_length_m for cabin in cabins)
    gaps = [
        (positions[(idx + 1) % len(positions)] - pos + route_length_m) % route_length_m
        for idx, pos in enumerate(positions)
    ]
    min_gap = min(gaps)
    if min_gap < CRITICAL_SPACING_M:
        return "CRITICAL", min_gap
    if min_gap < WARNING_SPACING_M:
        return "WARNING", min_gap
    return "SAFE", min_gap


def inject_spacing_fault(cabins: List[Cabin], route_length_m: float) -> None:
    """Compress several cabins to demonstrate anti-collision intervention."""
    for idx, cabin in enumerate(sorted(cabins, key=lambda c: c.position)[:4]):
        cabin.position = (cabins[0].position + idx * 28.0) % route_length_m


def step_simulation(
    cabins: List[Cabin],
    wind_speed_kmh: float,
    running: bool,
    emergency_stop: bool,
    dt_seconds: float,
    route_length_m: float,
    simulate_collision_event: bool = False,
) -> Dict:
    """Run one simulation step and return dashboard state."""
    if simulate_collision_event:
        inject_spacing_fault(cabins, route_length_m)

    rope_speed, system_status, alert_text = evaluate_system_status(
        wind_speed_kmh=wind_speed_kmh, running=running, emergency_stop=emergency_stop
    )
    collision_state, min_spacing_m = evaluate_cabin_spacing(cabins, route_length_m)
    dispatch_allowed = wind_speed_kmh < 40 and collision_state == "SAFE" and running and not emergency_stop

    if collision_state == "CRITICAL":
        rope_speed = min(rope_speed, 1.2)
        alert_text = f"Anti-collision critical: minimum spacing {min_spacing_m:.1f} m. Speed restricted and dispatch locked."
    elif collision_state == "WARNING":
        rope_speed = min(rope_speed, 3.0)
        alert_text = f"Anti-collision warning: minimum spacing {min_spacing_m:.1f} m. Dispatch locked."

    emergency_return_mode = running and not emergency_stop and wind_speed_kmh >= 50
    cabins = update_cabins(cabins, rope_speed, dt_seconds, route_length_m, emergency_return_mode)

    if emergency_return_mode and all(cabin.status == "SAFE_AT_STATION" for cabin in cabins):
        rope_speed = 0.0
        system_status = "EVACUATION COMPLETE"
        alert_text = "All cabins reached stations. Rope movement stopped and operation locked."

    return {
        "rope_speed_mps": rope_speed,
        "system_status": system_status,
        "alert_text": alert_text,
        "collision_state": collision_state,
        "min_spacing_m": min_spacing_m,
        "dispatch_allowed": dispatch_allowed,
        # Keep objects for internal updates; include dict snapshots for compatibility.
        "cabins": cabins,
        "cabins_dict": [c.to_dict() for c in cabins],
    }
