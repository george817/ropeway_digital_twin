import time
import math
from typing import List, Dict

ROUTE_LENGTH_M = 2295.9
STATION_SPEED_MPS = 0.28
CABIN_SPACING_M = 70.0
NUM_CABINS = int(ROUTE_LENGTH_M / CABIN_SPACING_M)

# Stations boundaries (simplified interval for detachment)
# Cantt: 0.0, Vidyapeeth: 940.0, Rath Yatra: 2295.0
STATION_ZONES = [
    (0.0, 30.0), # Cantt start
    (ROUTE_LENGTH_M - 30.0, ROUTE_LENGTH_M), # Cantt end
    (920.0, 960.0), # Vidyapeeth
]

class Cabin:
    def __init__(self, id: int, pos: float):
        self.id = id
        self.position = pos
        self.speed = 0.0
        self.status = "MOVING"

class RopewaySimulation:
    def __init__(self):
        self.cabins = [Cabin(i, i * CABIN_SPACING_M) for i in range(NUM_CABINS)]
        self.line_speed_mps = 6.0
        self.passenger_load = 50.0 # percentage
        self.last_update = time.time()
        
    def set_controls(self, speed: float, load: float):
        self.line_speed_mps = speed
        self.passenger_load = load

    def step(self):
        now = time.time()
        dt = min(now - self.last_update, 0.1) # cap dt to avoid jumps
        self.last_update = now

        cabin_data = []
        for cabin in self.cabins:
            # Check if in station (MDG detachment)
            in_station = False
            for z_start, z_end in STATION_ZONES:
                if z_start <= cabin.position <= z_end:
                    in_station = True
                    break
            
            # MDG Mechanics: Detach and slow down to 0.28 m/s
            if in_station:
                cabin.speed = min(self.line_speed_mps, STATION_SPEED_MPS)
                cabin.status = "DETACHED"
            else:
                # Accelerate back to line speed
                cabin.speed = self.line_speed_mps
                cabin.status = "ATTACHED"

            cabin.position = (cabin.position + cabin.speed * dt) % ROUTE_LENGTH_M
            
            cabin_data.append({
                "id": cabin.id,
                "position": cabin.position,
                "speed": cabin.speed,
                "status": cabin.status
            })

        return cabin_data
