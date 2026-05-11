"""Plotly visuals for 3D ropeway and time-series charts."""

from __future__ import annotations

from typing import Any, Dict, List, Sequence, Tuple

import numpy as np
import plotly.graph_objects as go
import streamlit as st


DARK_PAPER = "rgba(0,0,0,0)" # Use transparent to let Streamlit CSS show
DARK_PLOT = "rgba(0,0,0,0)"
ROPE_COLOR = "#ffaa00"  # Vibrant industrial orange
CABIN_COLOR = "#ff8c00"  # Orange 
STEEL_COLOR = "#64748b"
WARN_COLOR = "#ef4444"


def _ground_elevation(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Low-amplitude terrain shape for believable urban corridor profile."""
    return 3.0 + 0.55 * np.sin(x / 170.0) + 0.35 * np.cos(y / 55.0)


def _cabin_value(cabin: Any, key: str) -> Any:
    """Read cabin value from dataclass/object or dict."""
    if hasattr(cabin, key):
        return getattr(cabin, key)
    return cabin[key]


def _segment_with_sag(
    x0: float,
    y0: float,
    z0: float,
    x1: float,
    y1: float,
    z1: float,
    sag_depth: float,
    n: int = 55,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Create a smooth suspended cable span between two support points."""
    t = np.linspace(0.0, 1.0, n)
    x = x0 + (x1 - x0) * t
    y = y0 + (y1 - y0) * t
    base = z0 + (z1 - z0) * t
    sag = sag_depth * 4.0 * t * (1.0 - t)  # max sag at midspan
    z = base - sag
    return x, y, z


@st.cache_data
def build_static_route(route_length_m: float, _count: int = 500) -> Dict[str, np.ndarray]:
    """Build a long monocable detachable gondola-like loop path."""
    forward_pts = [
        (0.0, 0.0, 28.0),    # Station: Varanasi Cantt
        (110.0, 6.0, 32.0),  # Tower 1
        (255.0, 10.0, 30.0), # Tower 2
        (420.0, 15.0, 34.0), # Station: Vidyapeeth
        (570.0, 10.0, 31.0), # Tower 3
        (740.0, 5.0, 29.0),  # Tower 4
        (930.0, 0.0, 33.0),  # Station: Rath Yatra
    ]
    forward_sag = [2.2, 2.8, 2.3, 2.6, 2.7, 2.2]

    return_pts = [
        (930.0, -26.0, 31.0),
        (740.0, -22.0, 28.0),
        (570.0, -18.0, 30.0),
        (420.0, -14.0, 32.0),
        (255.0, -10.0, 28.5),
        (110.0, -7.0, 30.0),
        (0.0, -3.0, 27.0),
    ]
    return_sag = [2.0, 2.5, 2.2, 2.4, 2.6, 2.1]

    x_all, y_all, z_all = [], [], []
    tower_indices = []

    def add_segment(p0, p1, sag, is_tower=True):
        if is_tower:
            tower_indices.append(len(x_all))
        seg_x, seg_y, seg_z = _segment_with_sag(*p0, *p1, sag)
        x_all.extend(seg_x[:-1])
        y_all.extend(seg_y[:-1])
        z_all.extend(seg_z[:-1])

    for i in range(len(forward_pts) - 1):
        add_segment(forward_pts[i], forward_pts[i + 1], forward_sag[i])
    tower_indices.append(len(x_all)) # Station C

    r_turn = 13.0
    a_end = np.linspace(np.pi / 2, -np.pi / 2, 40)
    ex = 930.0 + r_turn * np.cos(a_end)
    ey = -13.0 + r_turn * np.sin(a_end)
    ez = np.linspace(forward_pts[-1][2], return_pts[0][2], 40)
    x_all.extend(ex[:-1])
    y_all.extend(ey[:-1])
    z_all.extend(ez[:-1])

    for i in range(len(return_pts) - 1):
        add_segment(return_pts[i], return_pts[i + 1], return_sag[i])
    tower_indices.append(len(x_all)) # Station A (return side)

    a_start = np.linspace(-np.pi / 2, np.pi / 2, 40)
    sx = 0.0 + r_turn * np.cos(a_start)
    sy = -1.5 + r_turn * np.sin(a_start)
    ez2 = np.linspace(return_pts[-1][2], forward_pts[0][2], 40)
    x_all.extend(sx)
    y_all.extend(sy)
    z_all.extend(ez2)

    x = np.array(x_all)
    y = np.array(y_all)
    z = np.array(z_all)

    ds_xy = np.sqrt(np.diff(x) ** 2 + np.diff(y) ** 2)
    xy_len = float(np.sum(ds_xy))
    scale = route_length_m / max(xy_len, 1.0)
    x *= scale
    y *= scale

    ds = np.sqrt(np.diff(x) ** 2 + np.diff(y) ** 2 + np.diff(z) ** 2)
    s = np.insert(np.cumsum(ds), 0, 0.0)
    s *= route_length_m / max(float(s[-1]), 1.0)

    # Use actual point indices for towers to align perfectly with catenary peaks
    tower_fracs = s[tower_indices] / route_length_m

    station_fracs = np.array([tower_fracs[0], tower_fracs[3], tower_fracs[6]], dtype=float)
    station_names = np.array(["Varanasi Cantt", "Vidyapeeth", "Rath Yatra"])

    return {
        "x": x,
        "y": y,
        "z": z,
        "s": s,
        "route_length": np.array([route_length_m]),
        "tower_fracs": tower_fracs,
        "station_fracs": station_fracs,
        "station_names": station_names,
    }


def _distance_to_xyz(position_m: float, route: Dict[str, np.ndarray]) -> Tuple[float, float, float]:
    """Map travel distance to position on route using arc-length interpolation."""
    route_length_m = float(route["route_length"][0])
    s_mod = position_m % route_length_m
    x = float(np.interp(s_mod, route["s"], route["x"]))
    y = float(np.interp(s_mod, route["s"], route["y"]))
    z = float(np.interp(s_mod, route["s"], route["z"]))
    return x, y, z


def get_route_geometry(route_length_m: float) -> Dict[str, np.ndarray]:
    """Public accessor for cached route geometry."""
    return build_static_route(route_length_m)


def create_ropeway_static_figure(route_length_m: float) -> go.Figure:
    """Draw static 3D elements only (rope, towers, stations)."""
    route = build_static_route(route_length_m)
    fig = go.Figure()

    # Lightweight terrain/base strip for digital-twin context.
    tx = np.linspace(np.min(route["x"]) - 80.0, np.max(route["x"]) + 80.0, 70)
    ty = np.linspace(np.min(route["y"]) - 50.0, np.max(route["y"]) + 50.0, 30)
    gx, gy = np.meshgrid(tx, ty)
    gz = _ground_elevation(gx, gy) - 1.5
    fig.add_trace(
        go.Surface(
            x=gx,
            y=gy,
            z=gz,
            showscale=False,
            opacity=0.28,
            colorscale=[[0, "#111827"], [1, "#1f2937"]],
            hoverinfo="skip",
            name="Terrain",
        )
    )

    # Urban wireframe blocks for spatial context
    ux, uy, uz = [], [], []
    np.random.seed(42)
    for _ in range(18):
        xc = np.random.uniform(np.min(route["x"]) + 50, np.max(route["x"]) - 50)
        yc = np.random.uniform(-40, 40)
        w = np.random.uniform(15, 35)
        d = np.random.uniform(15, 35)
        h = np.random.uniform(10, 25)
        zg_val = float(_ground_elevation(np.array([xc]), np.array([yc]))[0])
        
        # Bottom perimeter
        ux.extend([xc, xc+w, xc+w, xc, xc, None])
        uy.extend([yc, yc, yc+d, yc+d, yc, None])
        uz.extend([zg_val, zg_val, zg_val, zg_val, zg_val, None])
        # Top perimeter
        ux.extend([xc, xc+w, xc+w, xc, xc, None])
        uy.extend([yc, yc, yc+d, yc+d, yc, None])
        uz.extend([zg_val+h, zg_val+h, zg_val+h, zg_val+h, zg_val+h, None])
        # Pillars (corners)
        for px, py in [(xc, yc), (xc+w, yc), (xc+w, yc+d), (xc, yc+d)]:
            ux.extend([px, px, None])
            uy.extend([py, py, None])
            uz.extend([zg_val, zg_val+h, None])
            
    fig.add_trace(
        go.Scatter3d(
            x=ux, y=uy, z=uz,
            mode="lines",
            line=dict(color="rgba(34, 211, 238, 0.15)", width=2),
            name="Urban Context",
            hoverinfo="skip"
        )
    )

    # Rope main line.
    fig.add_trace(
        go.Scatter3d(
            x=route["x"],
            y=route["y"],
            z=route["z"],
            mode="lines",
            line=dict(color=ROPE_COLOR, width=5),
            name="Monocable",
            hoverinfo="skip",
        )
    )

    # Towers with detailed MDG support structures
    mast_x, mast_y, mast_z = [], [], []
    cross_x, cross_y, cross_z = [], [], []
    sheave_x, sheave_y, sheave_z = [], [], []
    brace_x, brace_y, brace_z = [], [], []

    for idx, frac in enumerate(route["tower_fracs"]):
        xt, yt, zt_rope = _distance_to_xyz(float(frac) * route_length_m, route)
        zg = float(_ground_elevation(np.array([xt]), np.array([yt]))[0])
        
        # Tower geometry parameters
        mast_top_z = zt_rope - 1.2
        sheave_len = 4.5
        sheave_z_level = zt_rope - 0.4
        
        # 1. Main Vertical Mast
        mast_x.extend([xt, xt, None])
        mast_y.extend([yt, yt, None])
        mast_z.extend([zg, mast_top_z, None])
        
        # 2. Perpendicular Cross-arm (adds 3D thickness)
        cross_x.extend([xt, xt, None])
        cross_y.extend([yt - 1.5, yt + 1.5, None])
        cross_z.extend([mast_top_z, mast_top_z, None])
        
        # 3. Longitudinal Sheave Beam
        sheave_x.extend([xt - sheave_len, xt + sheave_len, None])
        sheave_y.extend([yt, yt, None])
        sheave_z.extend([sheave_z_level, sheave_z_level, None])
        
        # 4. Diagonal Braces and Sheave Wheels
        brace_x.extend([
            xt, xt - 2.5, None,  # Left brace
            xt, xt + 2.5, None,  # Right brace
        ])
        brace_y.extend([
            yt, yt, None,
            yt, yt, None,
        ])
        brace_z.extend([
            mast_top_z - 2.5, sheave_z_level, None,
            mast_top_z - 2.5, sheave_z_level, None,
        ])
        
        # Add 4 wheel indicators per sheave train
        for offset in [-3.5, -1.5, 1.5, 3.5]:
            brace_x.extend([xt + offset, xt + offset, None])
            brace_y.extend([yt, yt, None])
            brace_z.extend([sheave_z_level, zt_rope, None])

    fig.add_trace(
        go.Scatter3d(
            x=mast_x, y=mast_y, z=mast_z,
            mode="lines",
            line=dict(color=STEEL_COLOR, width=9),
            name="Tower Masts",
            hoverinfo="skip",
        )
    )
    fig.add_trace(
        go.Scatter3d(
            x=cross_x, y=cross_y, z=cross_z,
            mode="lines",
            line=dict(color="#94a3b8", width=7),
            name="Tower Cross-Arms",
            hoverinfo="skip",
            showlegend=False,
        )
    )
    fig.add_trace(
        go.Scatter3d(
            x=sheave_x, y=sheave_y, z=sheave_z,
            mode="lines",
            line=dict(color="#cbd5e1", width=5),
            name="Sheave Trains",
            hoverinfo="skip",
            showlegend=False,
        )
    )
    fig.add_trace(
        go.Scatter3d(
            x=brace_x, y=brace_y, z=brace_z,
            mode="lines",
            line=dict(color="#475569", width=3),
            name="Bracing & Wheels",
            hoverinfo="skip",
            showlegend=False,
        )
    )

    # Station markers and labels.
    sx, sy, sz, stxt = [], [], [], []
    for name, frac in zip(route["station_names"], route["station_fracs"]):
        xs, ys, zs = _distance_to_xyz(float(frac) * route_length_m, route)
        sx.append(xs)
        sy.append(ys)
        sz.append(zs + 0.8)
        stxt.append(str(name))

    fig.add_trace(
        go.Scatter3d(
            x=sx,
            y=sy,
            z=sz,
            mode="markers+text",
            marker=dict(size=7, color="#22d3ee", symbol="square"),
            text=stxt,
            textposition="top center",
            textfont=dict(color="#e5e7eb", size=11),
            name="Stations",
            hovertemplate="%{text}<extra></extra>",
        )
    )

    fig.update_layout(
        margin=dict(l=0, r=0, t=20, b=0),
        paper_bgcolor=DARK_PAPER,
        plot_bgcolor=DARK_PLOT,
        scene=dict(
            bgcolor=DARK_PLOT,
            xaxis=dict(title="", color="#7d8594", showbackground=False, showgrid=False, zeroline=False),
            yaxis=dict(title="", color="#7d8594", showbackground=False, showgrid=False, zeroline=False),
            zaxis=dict(title="", color="#7d8594", showbackground=False, showgrid=False, zeroline=False),
            aspectmode="data",
            camera=dict(
                eye=dict(x=2.8, y=1.55, z=0.62),
                center=dict(x=0.05, y=-0.08, z=-0.16),
            ),
        ),
        legend=dict(font=dict(color="#e5e7eb")),
        uirevision="ropeway-static-camera",
    )
    return fig


def _cabin_payload(
    cabins: List[Any], route_length_m: float, wind_speed_kmh: float
) -> Dict[str, Any]:
    route = build_static_route(route_length_m)
    body_x, body_y, body_z = [], [], []
    shadow_x, shadow_y, shadow_z = [], [], []
    hanger_x, hanger_y, hanger_z = [], [], []
    roof_x, roof_y, roof_z = [], [], []
    labels = []

    for cabin in cabins:
        cabin_position = float(_cabin_value(cabin, "position"))
        cabin_id = int(_cabin_value(cabin, "id"))
        cabin_status = str(_cabin_value(cabin, "status"))
        cabin_speed = float(_cabin_value(cabin, "speed"))
        x, y, z = _distance_to_xyz(cabin_position, route)
        zg = float(_ground_elevation(np.array([x]), np.array([y]))[0])

        # Wind Sway mapping
        sway_factor = max(0.0, (wind_speed_kmh - 10) / 40.0) # Sway increases above 10km/h
        sway = sway_factor * 2.5 * np.sin(0.035 * cabin_position + cabin_id * 0.7)
        if wind_speed_kmh > 40:
            sway += np.random.uniform(-0.15, 0.15) # Add jitter for high winds

        cx = x + 0.05 * sway
        cy = y + sway
        body_bottom_z = z - 2.5
        body_top_z = z - 1.5
        
        shadow_x.append(cx)
        shadow_y.append(cy)
        shadow_z.append(zg + 0.1)

        hanger_x.extend([x, cx, None])
        hanger_y.extend([y, cy, None])
        hanger_z.extend([z, body_top_z, None])

        body_x.append(cx)
        body_y.append(cy)
        body_z.append((body_bottom_z + body_top_z) / 2.0)
        
        roof_x.append(cx)
        roof_y.append(cy)
        roof_z.append(body_top_z)

        labels.append(f"Cabin {cabin_id} | {cabin_status} | {cabin_speed:.1f} m/s<br>Wind Sway: {sway:.1f}m")

    return {
        "shadow_x": shadow_x, "shadow_y": shadow_y, "shadow_z": shadow_z,
        "hanger_x": hanger_x, "hanger_y": hanger_y, "hanger_z": hanger_z,
        "body_x": body_x, "body_y": body_y, "body_z": body_z,
        "roof_x": roof_x, "roof_y": roof_y, "roof_z": roof_z,
        "labels": labels
    }


def add_cabin_trace(
    fig: go.Figure,
    cabins: List[Any],
    route_length_m: float,
    cabin_asset_exists: bool,
    wind_speed_kmh: float = 15.0,
) -> go.Figure:
    """Add dynamic cabin markers onto a static 3D figure copy."""
    payload = _cabin_payload(cabins, route_length_m, wind_speed_kmh)
    
    fig.add_trace(go.Scatter3d(
        x=payload["shadow_x"], y=payload["shadow_y"], z=payload["shadow_z"],
        mode="markers", marker=dict(color="rgba(0,0,0,0.6)", size=8, symbol="circle"),
        hoverinfo="skip", name="Shadows"
    ))
    
    fig.add_trace(go.Scatter3d(
        x=payload["hanger_x"], y=payload["hanger_y"], z=payload["hanger_z"],
        mode="lines", line=dict(color="#475569", width=2),
        hoverinfo="skip", name="Hangers"
    ))
    
    fig.add_trace(go.Scatter3d(
        x=payload["body_x"], y=payload["body_y"], z=payload["body_z"],
        mode="markers", marker=dict(color=CABIN_COLOR, size=12, symbol="square", line=dict(color="#111827", width=1)),
        text=payload["labels"], hovertemplate="%{text}<extra></extra>", name="Cabins"
    ))
    
    fig.add_trace(go.Scatter3d(
        x=payload["roof_x"], y=payload["roof_y"], z=payload["roof_z"],
        mode="markers", marker=dict(color="#ffffff", size=8, symbol="diamond", opacity=0.8),
        hoverinfo="skip", name="Roof Glow"
    ))

    return fig


def get_cabin_trace_payload(
    cabins: List[Any], route_length_m: float, wind_speed_kmh: float
) -> Dict[str, Any]:
    """Return cabin x/y/z/text arrays for efficient figure trace updates."""
    return _cabin_payload(cabins, route_length_m, wind_speed_kmh)


def create_ropeway_3d_figure(
    cabins: List[Dict], route_length_m: float, cabin_asset_exists: bool, wind_speed_kmh: float = 15.0
) -> go.Figure:
    """Draw full 3D ropeway view from static base + dynamic cabins."""
    fig = go.Figure(create_ropeway_static_figure(route_length_m))
    return add_cabin_trace(fig, cabins, route_length_m, cabin_asset_exists, wind_speed_kmh)


def create_timeseries_figure(
    time_s: Sequence[float], values: Sequence[float], title: str, y_label: str, color: str
) -> go.Figure:
    """Create a dark-themed time-series chart."""
    fill_color = "rgba(255, 170, 0, 0.1)" if color in ("#ffaa00", "#f59e0b") else "rgba(239, 68, 68, 0.1)"
    if color == "#10b981":
        fill_color = "rgba(16, 185, 129, 0.1)"
    if color == WARN_COLOR:
        fill_color = "rgba(239, 68, 68, 0.1)"

    time_s = list(time_s)
    values = list(values)
    fig = go.Figure(
        go.Scattergl(
            x=time_s,
            y=values,
            mode="lines",
            line=dict(color=color, width=2.5),
            fill="tozeroy",
            fillcolor=fill_color,
        )
    )
    fig.update_layout(
        title=dict(
            text=title.upper(),
            font=dict(family="Rajdhani", size=16, color="#e2e8f0", letterspacing=1),
        ),
        xaxis_title="TIME (S)",
        yaxis_title=y_label.upper(),
        margin=dict(l=40, r=20, t=50, b=40),
        paper_bgcolor=DARK_PAPER,
        plot_bgcolor="rgba(10, 20, 40, 0.3)",
        font=dict(family="Inter", color="#94a3b8"),
        xaxis=dict(
            gridcolor="rgba(148, 163, 184, 0.1)",
            zerolinecolor="rgba(148, 163, 184, 0.2)",
            range=[time_s[0], max(time_s[-1], 10)] if len(time_s) > 0 else [0, 10],
        ),
        yaxis=dict(
            gridcolor="rgba(148, 163, 184, 0.1)",
            zerolinecolor="rgba(148, 163, 184, 0.2)",
        ),
        uirevision=title,
    )
    return fig
