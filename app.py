"""Streamlit app for ropeway_digital_twin.

Run:
    streamlit run app.py
"""

from __future__ import annotations

import time
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

st.set_page_config(
    page_title="Ropeway Digital Twin",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown(
    """
    <style>
        .block-container {
            max-width: 100% !important;
            padding-top: 0.6rem;
            padding-left: 1rem;
            padding-right: 1rem;
        }
        header, footer, #MainMenu {
            visibility: hidden;
            height: 0;
        }
    </style>
    """,
    unsafe_allow_html=True
)

from controls import (
    render_emergency_stop,
    render_passenger_load_control,
    render_run_toggle,
    render_wind_control,
)
from energy import estimate_power_kw
from simulation import initialize_cabins_by_spacing, step_simulation
from visuals import (
    WARN_COLOR,
    create_ropeway_static_figure,
    create_timeseries_figure,
    get_cabin_trace_payload,
    add_cabin_trace,
)


ROUTE_LENGTH_M = 2295.9
ROPE_SPEED_MPS_RATED = 6.0
VEHICLE_SPACING_M = 71.7
TRANSPORT_CAPACITY_PPH = 3000
ROPE_DIAMETER_MM = 52
TRAVEL_TIME_MIN = 8.96
STATION_SPEED_MPS = 0.28
DT_SECONDS = 1.0
MAX_HISTORY = 120
REFRESH_MS = 200

st.markdown(
    """
    <style>
    /* SCADA Premium Industrial Theme */
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

    .stApp {
        background-color: #030811;
        background-image: radial-gradient(circle at 50% 0%, #0a1428 0%, #030811 100%);
        color: #e2e8f0;
        font-family: 'Inter', sans-serif;
    }

    /* Headings */
    h1, h2, h3, h4 {
        font-family: 'Rajdhani', sans-serif !important;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: #f1f5f9;
        text-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
    }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: rgba(6, 15, 30, 0.7) !important;
        backdrop-filter: blur(12px) !important;
        border-right: 1px solid rgba(255, 140, 0, 0.25);
        box-shadow: 2px 0 15px rgba(0, 0, 0, 0.5);
    }
    
    /* KPI Metric Cards */
    [data-testid="stMetric"] {
        background: rgba(10, 20, 40, 0.5);
        border: 1px solid rgba(255, 140, 0, 0.2);
        border-top: 2px solid #ff8c00;
        border-radius: 8px;
        padding: 1rem 1.2rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(255, 140, 0, 0.05);
        backdrop-filter: blur(10px);
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        position: relative;
        overflow: hidden;
    }
    
    [data-testid="stMetric"]:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(255, 140, 0, 0.15), inset 0 0 20px rgba(255, 140, 0, 0.1);
        border-color: rgba(255, 140, 0, 0.5);
    }
    
    [data-testid="stMetricValue"] {
        color: #ffaa00 !important; /* Industrial Orange */
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 2.2rem !important;
        text-shadow: 0 0 15px rgba(255, 170, 0, 0.4);
    }
    
    [data-testid="stMetricLabel"] {
        color: #94a3b8 !important;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        font-size: 0.85rem !important;
        font-weight: 600;
        margin-bottom: 0.3rem;
    }

    /* Add a scanner line effect to metrics */
    [data-testid="stMetric"]::after {
        content: "";
        position: absolute;
        top: 0; left: -100%;
        width: 50%; height: 2px;
        background: linear-gradient(90deg, transparent, #ff8c00, transparent);
        animation: scanline 4s linear infinite;
    }
    @keyframes scanline {
        0% { left: -100%; }
        50% { left: 200%; }
        100% { left: 200%; }
    }

    /* Containers and panels */
    div[data-testid="stVerticalBlock"] > div > div[data-testid="stVerticalBlock"] {
        background: rgba(10, 20, 40, 0.3);
        border: 1px solid rgba(148, 163, 184, 0.1);
        border-radius: 8px;
        padding: 1rem;
        box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
    }

    /* Customizing Alerts */
    .stAlert {
        border-radius: 4px !important;
        border-left: 4px solid;
        background-color: rgba(10, 20, 35, 0.8) !important;
        backdrop-filter: blur(5px);
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        letter-spacing: 0.5px;
    }
    
    /* Buttons */
    .stButton > button {
        background: rgba(255, 140, 0, 0.1) !important;
        border: 1px solid rgba(255, 140, 0, 0.5) !important;
        color: #ffaa00 !important;
        font-family: 'Rajdhani', sans-serif !important;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 600;
        border-radius: 4px;
        transition: all 0.3s ease;
    }
    .stButton > button:hover {
        background: rgba(255, 140, 0, 0.25) !important;
        box-shadow: 0 0 15px rgba(255, 140, 0, 0.4);
        transform: scale(1.02);
    }
    .stButton > button[kind="primary"] {
        background: rgba(220, 38, 38, 0.15) !important;
        border-color: rgba(220, 38, 38, 0.6) !important;
        color: #ef4444 !important;
    }
    .stButton > button[kind="primary"]:hover {
        background: rgba(220, 38, 38, 0.3) !important;
        box-shadow: 0 0 15px rgba(220, 38, 38, 0.5);
    }

    /* Sliders */
    .stSlider [data-testid="stTickBar"] {
        background: #1e293b !important;
    }
    .stSlider [role="slider"] {
        background: #ff8c00 !important;
        box-shadow: 0 0 10px #ff8c00 !important;
    }
    
    hr {
        border-color: rgba(255, 140, 0, 0.2);
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("Ropeway Digital Twin")
st.caption("Operational demo: wind control, cabin movement, and power estimate")


if "cabins" not in st.session_state:
    st.session_state.cabins = initialize_cabins_by_spacing(
        vehicle_spacing_m=VEHICLE_SPACING_M,
        route_length_m=ROUTE_LENGTH_M,
    )
expected_cabin_count = max(int(ROUTE_LENGTH_M / VEHICLE_SPACING_M), 1)
if len(st.session_state.cabins) != expected_cabin_count:
    st.session_state.cabins = initialize_cabins_by_spacing(
        vehicle_spacing_m=VEHICLE_SPACING_M,
        route_length_m=ROUTE_LENGTH_M,
    )
if "sim_time" not in st.session_state:
    st.session_state.sim_time = 0
if "emergency_active" not in st.session_state:
    st.session_state.emergency_active = False
if "history" not in st.session_state:
    st.session_state.history = {
        "time_s": [0],
        "wind_kmh": [10.0],
        "rope_mps": [ROPE_SPEED_MPS_RATED],
        "power_kw": [estimate_power_kw(50, ROPE_SPEED_MPS_RATED)],
    }
if "wind_speed" not in st.session_state:
    st.session_state.wind_speed = float(st.session_state.history["wind_kmh"][-1])
if "passenger_load" not in st.session_state:
    st.session_state.passenger_load = 50
if "running" not in st.session_state:
    st.session_state.running = True
if "last_update" not in st.session_state:
    st.session_state.last_update = time.perf_counter()


with st.sidebar:
    st.header("Control Panel")
    wind_speed = render_wind_control(st.session_state.wind_speed)
    passenger_load = render_passenger_load_control(st.session_state.passenger_load)
    running = render_run_toggle(st.session_state.running)
    st.session_state.wind_speed = wind_speed
    st.session_state.passenger_load = passenger_load
    st.session_state.running = running
    if render_emergency_stop():
        st.session_state.emergency_active = True
    if st.button("Simulate Anti-Collision Event", use_container_width=True):
        st.session_state.simulate_collision_event = True
    if st.button("Reset Emergency Stop", use_container_width=True):
        st.session_state.emergency_active = False
    st.divider()
    presentation_mode = st.toggle("Executive Presentation Mode", value=False)

asset_path = Path(__file__).parent / "assets" / "cabin.png"
has_cabin_asset = asset_path.exists()

if presentation_mode:
    ropeway_slot = st.empty()
    metric_cols = st.columns(6)
    metric_slots = [col.empty() for col in metric_cols]
    with st.expander("Detailed Telemetry & Parameters", expanded=False):
        c1, c2 = st.columns([1, 1])
        with c1:
            wind_slot = st.empty()
            speed_slot = st.empty()
            power_slot = st.empty()
        with c2:
            params_slot = st.empty()
            ai_slot = st.empty()
            alert_slot = st.empty()
else:
    left, right = st.columns([1.4, 1.0])
    metric_cols = st.columns(6)
    metric_slots = [col.empty() for col in metric_cols]
    alert_slot = st.empty()
    params_slot = st.empty()
    ai_slot = st.empty()
    
    with left:
        ropeway_slot = st.empty()
        if not has_cabin_asset:
            st.caption("No `assets/cabin.png` found. Showing placeholder cabin markers.")

    with right:
        wind_slot = st.empty()
        speed_slot = st.empty()
        power_slot = st.empty()

# Cache static geometry/scene in session state once.
if "static_route_length_m" not in st.session_state:
    st.session_state.static_route_length_m = ROUTE_LENGTH_M
if (
    "static_3d_fig" not in st.session_state
    or st.session_state.static_route_length_m != ROUTE_LENGTH_M
):
    st.session_state.static_3d_fig = create_ropeway_static_figure(ROUTE_LENGTH_M)
    st.session_state.static_route_length_m = ROUTE_LENGTH_M
if "live_3d_fig" not in st.session_state:
    st.session_state.live_3d_fig = add_cabin_trace(
        fig=go.Figure(st.session_state.static_3d_fig),
        cabins=st.session_state.cabins,
        route_length_m=ROUTE_LENGTH_M,
        cabin_asset_exists=has_cabin_asset,
        wind_speed_kmh=st.session_state.wind_speed,
    )
elif st.session_state.static_route_length_m != ROUTE_LENGTH_M:
    st.session_state.live_3d_fig = add_cabin_trace(
        fig=go.Figure(st.session_state.static_3d_fig),
        cabins=st.session_state.cabins,
        route_length_m=ROUTE_LENGTH_M,
        cabin_asset_exists=has_cabin_asset,
        wind_speed_kmh=st.session_state.wind_speed,
    )


def _tick_and_render() -> None:
    """Advance simulation and update only dynamic placeholders."""
    def _cabin_status(cabin: object) -> str:
        if hasattr(cabin, "status"):
            return str(getattr(cabin, "status"))
        return str(cabin["status"])

    now = time.perf_counter()
    dt_seconds = now - st.session_state.last_update
    st.session_state.last_update = now
    # Clamp dt to avoid jumps after tab inactivity.
    dt_seconds = min(max(dt_seconds, 0.2), 0.8)

    sim_result = step_simulation(
        cabins=st.session_state.cabins,
        wind_speed_kmh=st.session_state.wind_speed,
        running=st.session_state.running,
        emergency_stop=st.session_state.emergency_active,
        dt_seconds=dt_seconds,
        route_length_m=ROUTE_LENGTH_M,
        simulate_collision_event=st.session_state.pop("simulate_collision_event", False),
    )

    rope_speed = sim_result["rope_speed_mps"]
    system_status = sim_result["system_status"]
    alert_text = sim_result["alert_text"]
    power_kw = estimate_power_kw(st.session_state.passenger_load, rope_speed)

    st.session_state.sim_time += dt_seconds
    st.session_state.history["time_s"].append(st.session_state.sim_time)
    st.session_state.history["wind_kmh"].append(st.session_state.wind_speed)
    st.session_state.history["rope_mps"].append(rope_speed)
    st.session_state.history["power_kw"].append(power_kw)
    for k in st.session_state.history:
        st.session_state.history[k] = st.session_state.history[k][-MAX_HISTORY:]

    active_cabins = sum(1 for c in sim_result["cabins"] if _cabin_status(c) in ("MOVING", "EVACUATING"))
    metric_slots[0].metric("Wind Speed", f"{st.session_state.wind_speed:.1f} km/h")
    metric_slots[1].metric("Rope Speed", f"{rope_speed:.1f} m/s")
    metric_slots[2].metric("Active Cabins", active_cabins)
    metric_slots[3].metric("Power Consumption", f"{power_kw:.1f} kW")
    metric_slots[4].metric("System Status", system_status)
    metric_slots[5].metric("Collision State", sim_result["collision_state"])

    with params_slot.container():
        st.markdown("### System Parameters")
        p1, p2, p3 = st.columns(3)
        p1.write(f"**Rope speed (rated):** {ROPE_SPEED_MPS_RATED:.1f} m/s")
        p1.write(f"**Route length:** {ROUTE_LENGTH_M:.1f} m")
        p2.write(f"**Capacity:** {TRANSPORT_CAPACITY_PPH} people/hour")
        p2.write(f"**Rope diameter:** {ROPE_DIAMETER_MM} mm")
        p3.write(f"**Travel time:** {TRAVEL_TIME_MIN:.2f} min")
        p3.write(f"**Station speed:** {STATION_SPEED_MPS:.2f} m/s")
        st.caption(
            f"Live wind: {st.session_state.wind_speed:.1f} km/h | "
            f"Live power: {power_kw:.1f} kW | "
            f"Minimum spacing: {sim_result['min_spacing_m']:.1f} m | "
            f"Dispatch: {'allowed' if sim_result['dispatch_allowed'] else 'locked'}"
        )
    with ai_slot.container():
        st.markdown("### AI Recommendation")
        if st.session_state.wind_speed > 60:
            st.error("Hold service. Keep emergency protocol active and notify station operators.")
        elif st.session_state.wind_speed > 40:
            st.warning("Operate in reduced-speed mode. Increase monitoring cadence for cabin sway.")
        elif not st.session_state.running:
            st.info("System paused by operator. Safe to resume after procedural checks.")
        else:
            st.success("Nominal operation. Maintain rated service and routine observation.")

    with alert_slot.container():
        if st.session_state.wind_speed >= 50:
            st.error("High wind emergency: forward-only evacuation to upcoming stations.")
        elif st.session_state.wind_speed >= 40:
            st.warning("Wind warning: Reduced speed mode active. Dispatch preparation suspended.")

        if sim_result["collision_state"] == "CRITICAL":
            st.error("Anti-collision critical: spacing below safe threshold. Speed restricted.")
        elif sim_result["collision_state"] == "WARNING":
            st.warning("Anti-collision warning: headway below target. Dispatch locked.")

        if system_status in ("STOPPED", "EMERGENCY STOP"):
            st.warning(alert_text or "System is stopped.")
        elif alert_text:
            st.info(alert_text)

    # Update multi-trace cabin visualization
    payload = get_cabin_trace_payload(sim_result["cabins"], ROUTE_LENGTH_M, st.session_state.wind_speed)
    st.session_state.live_3d_fig.data[-4].x = payload["shadow_x"]
    st.session_state.live_3d_fig.data[-4].y = payload["shadow_y"]
    st.session_state.live_3d_fig.data[-4].z = payload["shadow_z"]

    st.session_state.live_3d_fig.data[-3].x = payload["hanger_x"]
    st.session_state.live_3d_fig.data[-3].y = payload["hanger_y"]
    st.session_state.live_3d_fig.data[-3].z = payload["hanger_z"]

    st.session_state.live_3d_fig.data[-2].x = payload["body_x"]
    st.session_state.live_3d_fig.data[-2].y = payload["body_y"]
    st.session_state.live_3d_fig.data[-2].z = payload["body_z"]
    st.session_state.live_3d_fig.data[-2].text = payload["labels"]

    st.session_state.live_3d_fig.data[-1].x = payload["roof_x"]
    st.session_state.live_3d_fig.data[-1].y = payload["roof_y"]
    st.session_state.live_3d_fig.data[-1].z = payload["roof_z"]
    ropeway_slot.plotly_chart(
        st.session_state.live_3d_fig,
        use_container_width=True,
        key="ropeway-3d-live",
        theme=None,
    )

    hist_df = pd.DataFrame(st.session_state.history)
    wind_slot.plotly_chart(
        create_timeseries_figure(
            hist_df["time_s"], hist_df["wind_kmh"], "Wind Speed Trend", "km/h", "#f59e0b"
        ),
        use_container_width=True,
        key="wind-trend-live",
        theme=None,
    )
    speed_slot.plotly_chart(
        create_timeseries_figure(
            hist_df["time_s"], hist_df["rope_mps"], "Rope Speed Trend", "m/s", "#10b981"
        ),
        use_container_width=True,
        key="speed-trend-live",
        theme=None,
    )
    power_slot.plotly_chart(
        create_timeseries_figure(
            hist_df["time_s"], hist_df["power_kw"], "Power Consumption Trend", "kW", WARN_COLOR
        ),
        use_container_width=True,
        key="power-trend-live",
        theme=None,
    )


if hasattr(st, "fragment"):
    @st.fragment(run_every=f"{REFRESH_MS}ms")
    def _live_update_fragment() -> None:
        _tick_and_render()

    _live_update_fragment()
else:
    _tick_and_render()
