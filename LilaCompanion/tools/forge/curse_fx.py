"""Partículas da MALDIÇÃO (fumaça preta, cubinhos, cinzas, brasas) e as névoas.

Contínuas (presas ao corpo pelas animações): fumaça da base, cubinhos subindo, fiapos que escorrem
pela coluna e brasas no ar em volta.
De golpe: impacto do soco, rasgo da garra, tremor da pancada, rugido, terra estourando ao sair do
chão, desmanchar/remontar, sugar (devorar).
Do jogador (o script manda a cada poucos ticks): asas de fumaça, forma de fumaça, névoa gigante e
cinzas no ar.
"""
from __future__ import annotations

import os

SMOKE = "textures/particle/lila/vfx/smoke"
GLOW = "textures/particle/lila/vfx/glow"
CUBE = "textures/particle/lila/nano"
SHARD = "textures/particle/lila/vfx/shard"
T = "(v.particle_age / v.particle_lifetime)"


def _p(ident, tex, comps, add=False):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": ident, "basic_render_parameters": {"material": "particles_add" if add else "particles_blend", "texture": tex}},
        "components": comps}}


def _bb(size, tw=32, mode="rotate_xyz"):
    return {"size": [size, size], "facing_camera_mode": mode, "uv": {"texture_width": tw, "texture_height": tw, "uv": [0, 0], "uv_size": [tw, tw]}}


def _rgba(r, g, b, a):
    return {"color": [str(r), str(g), str(b), a]}


LOOP = lambda t=2.0: {"minecraft:emitter_lifetime_looping": {"active_time": t}}  # noqa: E731
ONCE = {"minecraft:emitter_lifetime_once": {"active_time": 0.08}}
INIT = {"minecraft:emitter_initialization": {"creation_expression":
                                             "v.yaw = v.yaw ?? 0; v.flap = v.flap ?? 0; v.span = v.span ?? 3.4; v.size = v.size ?? 1;"}}
DARK = ("0.05", "0.045", "0.065")


def curse_particles(RP, wjson):
    fx = {}
    life = lambda a, b: {"minecraft:particle_lifetime_expression": {"max_lifetime": f"math.random({a}, {b})"}}  # noqa: E731
    spin = {"minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-60, 60)"}}
    # ---------------------------------------------------------------- contínuas do corpo
    fx["curse_smoke"] = _p("lila:curse_smoke", SMOKE, {
        **LOOP(), "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_steady": {"spawn_rate": 16, "max_particles": 60},
        "minecraft:emitter_shape_disc": {"offset": [0, 0, 0], "radius": 0.55, "plane_normal": "y", "direction": "outwards"},
        **life(1.6, 2.6), "minecraft:particle_initial_speed": "math.random(0.15, 0.5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 120 + v.particle_random_1 * 360) * 0.4", 0.35, 0],
                                              "linear_drag_coefficient": 0.9},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.35 + {T} * 0.9"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"math.min(1, {T} * 6) * (1 - {T}) * 0.85")})
    fx["curse_cubes"] = _p("lila:curse_cubes", CUBE, {
        **LOOP(), "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_steady": {"spawn_rate": 12, "max_particles": 40},
        "minecraft:emitter_shape_disc": {"offset": [0, 0.1, 0], "radius": 0.9, "plane_normal": "y", "direction": "outwards"},
        **life(1.2, 2.2), "minecraft:particle_initial_speed": "math.random(0.2, 0.7)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 1.2},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-200, 200)"},
        "minecraft:particle_appearance_billboard": _bb(f"(0.06 + v.particle_random_3 * 0.12) * (1 - {T} * 0.7)", tw=8),
        "minecraft:particle_appearance_tinting": {"color": ["0.07 + v.particle_random_2 * 0.08", "0.065 + v.particle_random_2 * 0.07",
                                                            "0.09 + v.particle_random_2 * 0.1", f"(1 - {T})"]}})
    fx["curse_wisps"] = _p("lila:curse_wisps", SMOKE, {
        **LOOP(), "minecraft:emitter_local_space": {"position": True, "rotation": False},
        "minecraft:emitter_rate_steady": {"spawn_rate": 8, "max_particles": 24},
        "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.6, "direction": "outwards"},
        **life(1.0, 1.8), "minecraft:particle_initial_speed": "math.random(0.1, 0.4)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -0.8, 0], "linear_drag_coefficient": 1.5},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.22 + {T} * 0.35"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"math.min(1, {T} * 5) * (1 - {T}) * 0.7")})
    fx["curse_embers"] = _p("lila:curse_embers", GLOW, {
        **LOOP(), "minecraft:emitter_rate_steady": {"spawn_rate": 10, "max_particles": 40},
        "minecraft:emitter_shape_box": {"offset": [0, 1.5, 0], "half_dimensions": [4.5, 2.5, 4.5], "direction": "outwards"},
        **life(1.6, 3.0), "minecraft:particle_initial_speed": "math.random(0.05, 0.3)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 300 + v.particle_random_1 * 360) * 0.8", 0.7, 0],
                                              "linear_drag_coefficient": 1.1},
        "minecraft:particle_appearance_billboard": _bb("0.045 + v.particle_random_3 * 0.05"),
        "minecraft:particle_appearance_tinting": {"color": ["1", "0.38 + v.particle_random_2 * 0.3", "0.08",
                                                            f"math.min(1, {T} * 5) * (1 - {T}) * (0.6 + 0.4 * math.sin(v.particle_age * 1600 + v.particle_random_1 * 360))"]}},
        add=True)
    fx["curse_ash"] = _p("lila:curse_ash", CUBE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_shape_box": {"offset": [0, 4, 0], "half_dimensions": [9, 3, 9], "direction": [0, -1, 0]},
        **life(3.0, 5.0), "minecraft:particle_initial_speed": "math.random(0.1, 0.3)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 90 + v.particle_random_1 * 360) * 0.25", -0.12,
                                                                      "math.cos(v.particle_age * 70 + v.particle_random_2 * 360) * 0.25"],
                                              "linear_drag_coefficient": 1.0},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-90, 90)"},
        "minecraft:particle_appearance_billboard": _bb("0.035 + v.particle_random_3 * 0.03", tw=8),
        "minecraft:particle_appearance_tinting": {"color": ["0.32 + v.particle_random_2 * 0.2", "0.3 + v.particle_random_2 * 0.2",
                                                            "0.33 + v.particle_random_2 * 0.2", f"math.min(1, {T} * 4) * math.min(1, (1 - {T}) * 4) * 0.85"]}})
    # ---------------------------------------------------------------- golpes
    fx["curse_hit"] = _p("lila:curse_hit", SMOKE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 18},
        "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.3, "direction": "outwards"},
        **life(0.5, 1.0), "minecraft:particle_initial_speed": "math.random(2, 5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 4},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.3 + {T} * 0.8"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"(1 - {T}) * 0.9")})
    fx["curse_spark"] = _p("lila:curse_spark", GLOW, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.2, "direction": "outwards"},
        **life(0.3, 0.7), "minecraft:particle_initial_speed": "math.random(3, 8)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -6, 0], "linear_drag_coefficient": 2.5},
        "minecraft:particle_appearance_billboard": _bb("0.06 + v.particle_random_3 * 0.05"),
        "minecraft:particle_appearance_tinting": {"color": ["1", "0.5 + v.particle_random_2 * 0.3", "0.12", f"1 - {T}"]}}, add=True)
    arc = "(v.particle_random_1 * 160 - 80)"
    fx["curse_slash"] = _p("lila:curse_slash", SMOKE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 30}, "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        **life(0.4, 0.7),
        "minecraft:particle_motion_parametric": {"relative_position": [f"math.sin({arc}) * (1.2 + {T} * 0.6)", f"math.cos({arc}) * (1.2 + {T} * 0.6) - 0.6",
                                                                       "v.particle_random_2 * 0.3"]},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.25 + {T} * 0.4"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"(1 - {T}) * 0.95")})
    ring = f"(1.0 + {T} * 6.0)"
    fx["curse_quake"] = _p("lila:curse_quake", SMOKE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 48}, "minecraft:emitter_shape_point": {"offset": [0, 0.2, 0]},
        **life(0.7, 1.1),
        "minecraft:particle_motion_parametric": {"relative_position": [f"math.cos(v.particle_random_1 * 360) * {ring}", f"v.particle_random_2 * 0.6 + {T} * 0.6",
                                                                       f"math.sin(v.particle_random_1 * 360) * {ring}"]},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.5 + {T} * 0.9"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"(1 - {T}) * 0.9")})
    fx["curse_roar"] = _p("lila:curse_roar", SMOKE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 26},
        "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.4, "direction": "outwards"},
        **life(0.6, 1.0), "minecraft:particle_initial_speed": "math.random(4, 8)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3.5},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.3 + {T} * 1.1"),
        "minecraft:particle_appearance_tinting": _rgba("0.07", "0.05", "0.08", f"(1 - {T}) * 0.7")})
    fx["curse_ground"] = _p("lila:curse_ground", SHARD, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 26},
        "minecraft:emitter_shape_disc": {"offset": [0, 0.15, 0], "radius": 1.6, "plane_normal": "y", "direction": ["math.random(-1, 1)", "math.random(1, 2.5)", "math.random(-1, 1)"]},
        **life(0.8, 1.6), "minecraft:particle_initial_speed": "math.random(3, 7)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -16, 0], "linear_drag_coefficient": 0.5},
        "minecraft:particle_motion_collision": {"collision_drag": 4, "coefficient_of_restitution": 0.3, "collision_radius": 0.1},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-500, 500)"},
        "minecraft:particle_appearance_billboard": _bb("0.1 + v.particle_random_3 * 0.18", tw=16),
        "minecraft:particle_appearance_tinting": {"color": ["0.28 + v.particle_random_2 * 0.12", "0.2 + v.particle_random_2 * 0.08", "0.14 + v.particle_random_2 * 0.06",
                                                            f"math.min(1, (1 - {T}) * 4)"]}})
    fx["curse_ground_smoke"] = _p("lila:curse_ground_smoke", SMOKE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 22},
        "minecraft:emitter_shape_disc": {"offset": [0, 0.3, 0], "radius": 2.2, "plane_normal": "y", "direction": "outwards"},
        **life(1.4, 2.4), "minecraft:particle_initial_speed": "math.random(0.4, 1.4)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 1.4},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.6 + {T} * 1.4"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"math.min(1, {T} * 6) * (1 - {T}) * 0.9")})
    fx["curse_burst"] = _p("lila:curse_burst", CUBE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 70},
        "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 1.6, "direction": "outwards"},
        **life(0.8, 1.6), "minecraft:particle_initial_speed": "math.random(1, 5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0], "linear_drag_coefficient": 1.8},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-300, 300)"},
        "minecraft:particle_appearance_billboard": _bb(f"(0.08 + v.particle_random_3 * 0.2) * (1 - {T} * 0.6)", tw=8),
        "minecraft:particle_appearance_tinting": {"color": ["0.06 + v.particle_random_2 * 0.07", "0.055 + v.particle_random_2 * 0.06", "0.08 + v.particle_random_2 * 0.09",
                                                            f"1 - {T}"]}})
    inw = f"(6.0 * (1 - {T}))"
    fx["curse_inhale"] = _p("lila:curse_inhale", SMOKE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 40}, "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        **life(0.5, 0.8),
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.cos(v.particle_random_1 * 360) * math.cos(v.particle_random_2 * 120 - 60) * {inw}",
            f"math.sin(v.particle_random_2 * 120 - 60) * {inw}",
            f"math.sin(v.particle_random_1 * 360) * math.cos(v.particle_random_2 * 120 - 60) * {inw}"]},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.4 * (1 - {T}) + 0.1"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"math.min(1, {T} * 4) * 0.85")})
    # ---------------------------------------------------------------- do jogador
    # asas de fumaça: o script passa v.yaw (graus) e v.flap (fase da batida). Cada partícula escolhe um
    # ponto da asa (envergadura u, lado ±1) e dura pouco: com emissões seguidas, as asas ficam "vivas".
    u = "v.particle_random_1"
    side = "(v.particle_random_2 > 0.5 ? 1 : -1)"
    flap = "math.sin(v.flap)"
    lat = f"({u} * v.span)"
    up = f"(1.0 + math.sin({u} * 180) * 0.9 - {u} * 0.4 + {flap} * {u} * 1.1 - v.particle_random_3 * {u} * 1.4)"
    back = f"(0.35 + {u} * 0.6 + (1 - {flap}) * {u} * 0.3)"
    fx["curse_wing"] = _p("lila:curse_wing", SMOKE, {
        **INIT, **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 46}, "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        **life(0.22, 0.34),
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.cos(v.yaw) * {side} * {lat} - math.sin(v.yaw) * -{back}",
            up,
            f"math.sin(v.yaw) * {side} * {lat} + math.cos(v.yaw) * -{back}"]},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"(0.32 + (1 - {u}) * 0.3) * (1 + {T} * 0.4)"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"math.min(1, {T} * 8) * (1 - {T}) * 0.95")})
    fx["curse_form"] = _p("lila:curse_form", SMOKE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 16},
        "minecraft:emitter_shape_box": {"offset": [0, 0.9, 0], "half_dimensions": [0.5, 0.9, 0.5], "direction": "outwards"},
        **life(0.5, 0.9), "minecraft:particle_initial_speed": "math.random(0.1, 0.6)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.4, 0], "linear_drag_coefficient": 2},
        **spin, "minecraft:particle_appearance_billboard": _bb(f"0.4 + {T} * 0.6"),
        "minecraft:particle_appearance_tinting": _rgba(*DARK, f"math.min(1, {T} * 6) * (1 - {T}) * 0.9")})
    fx["curse_fog_cloud"] = _p("lila:curse_fog_cloud", SMOKE, {
        **ONCE, "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_shape_box": {"offset": [0, 1.5, 0], "half_dimensions": [14, 2.5, 14], "direction": "outwards"},
        **life(3.0, 5.0), "minecraft:particle_initial_speed": "math.random(0.05, 0.3)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 40 + v.particle_random_1 * 360) * 0.2", 0.05, 0],
                                              "linear_drag_coefficient": 0.6},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-12, 12)"},
        "minecraft:particle_appearance_billboard": _bb("2.2 + v.particle_random_3 * 2.4"),
        "minecraft:particle_appearance_tinting": _rgba("0.04", "0.035", "0.05", f"math.min(1, {T} * 3) * math.min(1, (1 - {T}) * 3) * 0.55")})
    for k, data in fx.items():
        wjson(os.path.join(RP, "particles", f"lila_{k}.json"), data)
    # névoa gigante (poder "Névoa da Maldição"): preta e fechada; e a névoa leve de cinzas
    wjson(os.path.join(RP, "fogs", "curse_fog.json"), {"format_version": "1.16.100", "minecraft:fog_settings": {
        "description": {"identifier": "lila:curse_fog"},
        "distance": {"air": {"fog_start": 0.0, "fog_end": 0.3, "fog_color": "#0D0A11", "render_distance_type": "render"},
                     "water": {"fog_start": 0.0, "fog_end": 12.0, "fog_color": "#0A0710", "render_distance_type": "fixed"}}}})
    return sorted(f"lila:{k}" for k in fx)
