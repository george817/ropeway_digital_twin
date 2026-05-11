import numpy as np

# System specifications
ROPE_DIAMETER_MM = 45.0
ROPE_WEIGHT_PER_M = 7.0  # kg/m
TENSION_KN = 350.0  # Constant tension from hydraulic carriage

def calculate_sag(L: float, passenger_load_percentage: float) -> float:
    """
    Calculate maximum mid-span catenary sag using T = wL^2 / 8s -> s = wL^2 / 8T
    w (weight) increases as passenger load increases.
    """
    # Base weight (rope + empty cabins)
    base_w_kg = ROPE_WEIGHT_PER_M + (800 / 70.0) # 800kg cabin every 70m
    
    # Payload (10 passengers per cabin * 80kg = 800kg max)
    payload_w_kg = (800 * (passenger_load_percentage / 100.0)) / 70.0
    
    total_w_n = (base_w_kg + payload_w_kg) * 9.81
    tension_n = TENSION_KN * 1000.0
    
    sag = (total_w_n * (L ** 2)) / (8 * tension_n)
    return sag

def estimate_power_kw(passenger_load: float, line_speed: float) -> float:
    """Estimate motor power consumption in kW."""
    base_power = 50.0 # friction, baseline
    speed_factor = (line_speed / 6.0) ** 2
    load_factor = 1.0 + (passenger_load / 100.0)
    return (base_power * load_factor) * speed_factor * 10.0 # rough estimate
