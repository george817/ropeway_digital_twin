from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from simulation import RopewaySimulation
from physics import calculate_sag, estimate_power_kw

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sim = RopewaySimulation()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Run a background task to receive control updates
    async def receive_controls():
        try:
            while True:
                data = await websocket.receive_text()
                controls = json.loads(data)
                if 'speed' in controls and 'load' in controls:
                    sim.set_controls(float(controls['speed']), float(controls['load']))
        except:
            pass

    asyncio.create_task(receive_controls())

    try:
        while True:
            cabin_state = sim.step()
            
            # Compute KPI metrics
            power_kw = estimate_power_kw(sim.passenger_load, sim.line_speed_mps)
            throughput = (sim.line_speed_mps / 70.0) * 3600 * (sim.passenger_load / 100.0) * 10 # 10 passengers per cabin
            
            payload = {
                "cabins": cabin_state,
                "metrics": {
                    "line_speed": sim.line_speed_mps,
                    "power_kw": power_kw,
                    "throughput_pph": throughput,
                    "passenger_load": sim.passenger_load
                }
            }
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(0.05) # 20Hz update rate
    except Exception as e:
        print(f"Connection closed: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
