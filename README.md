# ropeway_digital_twin

Starter Streamlit project for a ropeway operational digital twin demo.

## What it simulates
- Cabin movement on a looping 3D rope route
- Wind-based rope speed control
- Emergency stop behavior
- Power consumption estimate based on load and speed

## File overview
- `app.py`: Main Streamlit dashboard and update loop
- `simulation.py`: Cabin model and simulation step logic
- `energy.py`: Simple power estimation function
- `controls.py`: Reusable Streamlit controls
- `visuals.py`: Plotly 3D scene and time-series charts
- `assets/cabin.png`: Optional image placeholder (app does not fail if missing)
- `data/`: Reserved for future sensor/sample files

## Run instructions
1. Open terminal inside `ropeway_digital_twin`.
2. (Recommended) create and activate a virtual environment:
   - PowerShell:
     ```powershell
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Launch app:
   ```bash
   streamlit run app.py
   ```

## Notes
- The physics and power model are intentionally simplified for a student demo.
- UI uses a dark industrial style with orange/green alert accents.
