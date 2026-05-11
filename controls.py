"""Reusable Streamlit controls for app.py."""

from __future__ import annotations

import streamlit as st


def render_wind_control(default_value: float = 15.0) -> float:
    return st.slider(
        "Wind Speed (km/h)",
        min_value=0.0,
        max_value=100.0,
        value=default_value,
        step=1.0,
    )


def render_passenger_load_control(default_value: int = 50) -> int:
    return st.slider(
        "Passenger Load (%)",
        min_value=0,
        max_value=100,
        value=default_value,
        step=1,
    )


def render_run_toggle(default_value: bool = True) -> bool:
    return st.toggle("Simulation Running", value=default_value)


def render_emergency_stop() -> bool:
    return st.button("EMERGENCY STOP", type="primary", use_container_width=True)
