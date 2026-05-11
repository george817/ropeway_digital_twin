"""Simple energy estimation for ropeway operation.

Assumption:
- Power draw scales with rope speed and passenger load.
- This is a demo model, not a detailed engineering calculation.
"""

from __future__ import annotations


def estimate_power_kw(passenger_load_pct: float, rope_speed_mps: float) -> float:
    """Estimate power in kW using a simple linear model.

    Model is tuned for internship demo realism:
    - Rated line speed is around 6.0 m/s.
    - Higher passenger loading and speed increase traction demand.
    """
    if rope_speed_mps <= 0:
        return 0.0

    # Tuned for visible dashboard variation:
    # power = speed * (base + load_component)
    base_factor = 30.0
    load_factor = 1.2
    return rope_speed_mps * (base_factor + load_factor * passenger_load_pct)
