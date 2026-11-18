"""Particles, particle textures, block textures, procedural sounds and pack art."""
from __future__ import annotations

import math
import os
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .paint import fbm

# =========================================================================
# PARTICLE TEXTURES (white, tinted at runtime)
# =========================================================================


def tex_soft(n=32):
    y, x = np.mgrid[0:n, 0:n] + 0.5
    d = np.sqrt((x - n / 2) ** 2 + (y - n / 2) ** 2) / (n / 2)
    a = np.clip(1 - d, 0, 1) ** 1.8
    img = np.zeros((n, n, 4))
    img[..., :3] = 255
    img[..., 3] = a * 255
    return Image.fromarray(img.astype(np.uint8), "RGBA")


def tex_spark(n=32):
    y, x = np.mgrid[0:n, 0:n] + 0.5
    cx = cy = n / 2
    dx, dy = np.abs(x - cx) / (n / 2), np.abs(y - cy) / (n / 2)
    star = np.clip(1 - (dx * 8 * dy + dx * 0.9 + dy * 0.9), 0, 1)
    core = np.clip(1 - np.sqrt(dx ** 2 + dy ** 2) * 2.2, 0, 1)
    a = np.clip(star + core, 0, 1)
    img = np.zeros((n, n, 4))
    img[..., :3] = 255
    img[..., 3] = a * 255
    return Image.fromarray(img.astype(np.uint8), "RGBA")


def tex_smoke(n=32, seed=3):
    y, x = np.mgrid[0:n, 0:n] + 0.5
    d = np.sqrt((x - n / 2) ** 2 + (y - n / 2) ** 2) / (n / 2)
    nz = fbm(x / 6.0, y / 6.0, np.zeros_like(x) + 0.5, seed, 4)
    a = np.clip((1 - d) * 1.4 - (1 - nz) * 0.7, 0, 1)
    img = np.zeros((n, n, 4))
    img[..., :3] = (200 + 55 * nz)[..., None]
    img[..., 3] = a * 235
    return Image.fromarray(img.astype(np.uint8), "RGBA").filter(ImageFilter.GaussianBlur(0.6))


def tex_rune(n=32):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, 2, n - 3, n - 3), outline=(255, 255, 255, 255), width=2)
    d.ellipse((8, 8, n - 9, n - 9), outline=(255, 255, 255, 180), width=1)
    for i in range(6):
        a = i * math.pi / 3
        d.line((n / 2 + math.cos(a) * 6, n / 2 + math.sin(a) * 6, n / 2 + math.cos(a) * 13, n / 2 + math.sin(a) * 13), fill=(255, 255, 255, 230), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.4))


def tex_bolt(w=16, h=64):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(7)
    x = w / 2
    pts = []
    for yy in range(0, h + 1, 6):
        pts.append((x, yy))
        x = np.clip(x + rng.uniform(-4, 4), 3, w - 3)
    d.line(pts, fill=(255, 255, 255, 255), width=3)
    glow = img.filter(ImageFilter.GaussianBlur(2))
    glow.alpha_composite(img)
    return glow


def tex_leaf(n=32):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((6, 10, n - 6, n - 10), fill=(255, 255, 255, 255))
    d.line((6, n / 2, n - 6, n / 2), fill=(200, 200, 200, 255), width=1)
    return img.rotate(35, resample=Image.BICUBIC)


def tex_flake(n=32):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = n / 2
    for i in range(6):
        a = i * math.pi / 3
        d.line((c, c, c + math.cos(a) * 13, c + math.sin(a) * 13), fill=(255, 255, 255, 255), width=2)
        for t in (0.55,):
            px, py = c + math.cos(a) * 13 * t, c + math.sin(a) * 13 * t
            for s in (-1, 1):
                d.line((px, py, px + math.cos(a + s * 0.8) * 4, py + math.sin(a + s * 0.8) * 4), fill=(255, 255, 255, 230), width=1)
    return img


def tex_feather(n=32):
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(c, c2) for c, c2 in ((16, 2), (22, 12), (19, 26), (16, 30), (13, 26), (10, 12))], fill=(255, 255, 255, 255))
    d.line((16, 4, 16, 30), fill=(170, 170, 170, 255), width=1)
    return img


PARTICLE_TEXTURES = {
    "soft": tex_soft, "spark": tex_spark, "smoke": tex_smoke, "rune": tex_rune, "bolt": tex_bolt,
    "leaf": tex_leaf, "flake": tex_flake, "feather": tex_feather,
}


# =========================================================================
# PARTICLE DEFINITIONS
# =========================================================================
def _pfx(ident, tex, material, comps, tw=32, th=32):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {"identifier": ident, "basic_render_parameters": {"material": material, "texture": f"textures/eclipse/particles/{tex}"}},
            "components": comps,
        },
    }


def _billboard(size, tw=32, th=32, mode="rotate_xyz"):
    return {"size": size, "facing_camera_mode": mode,
            "uv": {"texture_width": tw, "texture_height": th, "uv": [0, 0], "uv_size": [tw, th]}}


def _grad(c0, c1, c2=None):
    g = {"0.0": c0, "1.0": c1} if c2 is None else {"0.0": c0, "0.5": c1, "1.0": c2}
    return {"color": {"gradient": g, "interpolant": "v.particle_age / v.particle_lifetime"}}


VAR_COLOR = {"color": ["v.color.r", "v.color.g", "v.color.b", "math.clamp(1.2 - v.particle_age / v.particle_lifetime, 0, 1)"]}


def particles():
    P = {}
    P["shadow_manifest"] = _pfx("eclipse:shadow_manifest", "smoke", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 26},
        "minecraft:emitter_lifetime_once": {"active_time": 0.2},
        "minecraft:emitter_shape_disc": {"radius": 1.1, "direction": "outwards", "plane_normal": "y"},
        "minecraft:particle_initial_speed": 1.4,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.6, 0], "linear_drag_coefficient": 2.2},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.9 + v.particle_random_1 * 0.7"},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_2 * 360", "rotation_rate": 40},
        "minecraft:particle_appearance_billboard": _billboard(["0.35 + v.particle_age * 0.6", "0.35 + v.particle_age * 0.6"]),
        "minecraft:particle_appearance_tinting": _grad("#E0140C22", "#B0391A6E", "#00090510"),
    })
    P["shadow_recall"] = _pfx("eclipse:shadow_recall", "smoke", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 22},
        "minecraft:emitter_lifetime_once": {"active_time": 0.2},
        "minecraft:emitter_shape_sphere": {"radius": 1.2, "direction": "inwards", "offset": [0, 0.8, 0]},
        "minecraft:particle_initial_speed": 1.6,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -2.0, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.7 + v.particle_random_1 * 0.4"},
        "minecraft:particle_appearance_billboard": _billboard(["0.5 - v.particle_age * 0.3", "0.5 - v.particle_age * 0.3"]),
        "minecraft:particle_appearance_tinting": _grad("#C0251344", "#00090510"),
    })
    P["violet_burst"] = _pfx("eclipse:violet_burst", "spark", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 30},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_initial_speed": "4 + v.particle_random_1 * 3",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -1.5, 0], "linear_drag_coefficient": 3},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.6 + v.particle_random_2 * 0.5"},
        "minecraft:particle_appearance_billboard": _billboard(["0.22 * (1 - v.particle_age / v.particle_lifetime) + 0.04", "0.22 * (1 - v.particle_age / v.particle_lifetime) + 0.04"]),
        "minecraft:particle_appearance_tinting": _grad("#FFE8D0FF", "#FFA050FF", "#008040FF"),
    })
    P["ground_impact"] = _pfx("eclipse:ground_impact", "smoke", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 34},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_disc": {"radius": 0.6, "direction": "outwards", "plane_normal": "y"},
        "minecraft:particle_initial_speed": "6 + v.particle_random_1 * 2",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 4},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.8 + v.particle_random_2 * 0.5"},
        "minecraft:particle_appearance_billboard": _billboard(["0.4 + v.particle_age * 0.8", "0.4 + v.particle_age * 0.8"]),
        "minecraft:particle_appearance_tinting": _grad("#C04A3C5A", "#00221A2C"),
    })
    P["shadow_breath"] = _pfx("eclipse:shadow_breath", "soft", "particles_add", {
        "minecraft:emitter_local_space": {"position": True, "rotation": True},
        "minecraft:emitter_rate_steady": {"spawn_rate": 60, "max_particles": 80},
        "minecraft:emitter_lifetime_once": {"active_time": 1.2},
        "minecraft:emitter_shape_point": {"direction": ["(v.particle_random_1 - 0.5) * 0.5", "(v.particle_random_2 - 0.5) * 0.4", -1]},
        "minecraft:particle_initial_speed": 7,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 2},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
        "minecraft:particle_appearance_billboard": _billboard(["0.3 + v.particle_age * 1.4", "0.3 + v.particle_age * 1.4"]),
        "minecraft:particle_appearance_tinting": _grad("#FFF0D8FF", "#C08A3CFF", "#00300A60"),
    })
    P["cast_sparks"] = _pfx("eclipse:cast_sparks", "spark", "particles_add", {
        "minecraft:emitter_rate_steady": {"spawn_rate": 14, "max_particles": 24},
        "minecraft:emitter_lifetime_looping": {"active_time": 1},
        "minecraft:emitter_shape_sphere": {"radius": 0.35, "direction": "outwards"},
        "minecraft:particle_initial_speed": 0.6,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.8, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
        "minecraft:particle_appearance_billboard": _billboard([0.12, 0.12]),
        "minecraft:particle_appearance_tinting": _grad("#FFE6C8FF", "#00A050FF"),
    })
    # ----- parameterised (color passed from script via v.color)
    P["spark_burst"] = _pfx("eclipse:spark_burst", "spark", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": "v.count ?? 18"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.1},
        "minecraft:emitter_shape_sphere": {"radius": "v.radius ?? 0.4", "direction": "outwards"},
        "minecraft:particle_initial_speed": "(v.speed ?? 3) * (0.6 + v.particle_random_1 * 0.8)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, "v.gravity ?? -1.0", 0], "linear_drag_coefficient": 2.5},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.5 + v.particle_random_2 * 0.5"},
        "minecraft:particle_appearance_billboard": _billboard(["0.18 * (1 - v.particle_age / v.particle_lifetime) + 0.03", "0.18 * (1 - v.particle_age / v.particle_lifetime) + 0.03"]),
        "minecraft:particle_appearance_tinting": VAR_COLOR,
    })
    P["trail"] = _pfx("eclipse:trail", "soft", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 3},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
        "minecraft:particle_initial_speed": 0.2,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.35 + v.particle_random_1 * 0.25"},
        "minecraft:particle_appearance_billboard": _billboard(["(v.size ?? 0.3) * (1 - v.particle_age / v.particle_lifetime)", "(v.size ?? 0.3) * (1 - v.particle_age / v.particle_lifetime)"]),
        "minecraft:particle_appearance_tinting": VAR_COLOR,
    })
    P["mote"] = _pfx("eclipse:mote", "soft", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": "v.count ?? 4"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_disc": {"radius": "v.radius ?? 0.8", "direction": "outwards", "plane_normal": "y"},
        "minecraft:particle_initial_speed": 0.15,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.5, 0], "linear_drag_coefficient": 1},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "1.2 + v.particle_random_1 * 0.8"},
        "minecraft:particle_appearance_billboard": _billboard(["0.14 * math.sin(v.particle_age / v.particle_lifetime * 180) + 0.02", "0.14 * math.sin(v.particle_age / v.particle_lifetime * 180) + 0.02"]),
        "minecraft:particle_appearance_tinting": VAR_COLOR,
    })
    P["smoke_puff"] = _pfx("eclipse:smoke_puff", "smoke", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": "v.count ?? 10"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": "v.radius ?? 0.5", "direction": "outwards"},
        "minecraft:particle_initial_speed": "v.speed ?? 0.8",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.8 + v.particle_random_1 * 0.6"},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_2 * 360", "rotation_rate": 30},
        "minecraft:particle_appearance_billboard": _billboard(["0.3 + v.particle_age * 0.7", "0.3 + v.particle_age * 0.7"]),
        "minecraft:particle_appearance_tinting": VAR_COLOR,
    })
    P["ring"] = _pfx("eclipse:ring", "rune", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life ?? 0.7"},
        "minecraft:particle_appearance_billboard": {"size": ["(v.radius ?? 3) * v.particle_age / v.particle_lifetime + 0.2", "(v.radius ?? 3) * v.particle_age / v.particle_lifetime + 0.2"],
                                                    "facing_camera_mode": "lookat_y",
                                                    "uv": {"texture_width": 32, "texture_height": 32, "uv": [0, 0], "uv_size": [32, 32]}},
        "minecraft:particle_appearance_tinting": VAR_COLOR,
    })
    P["ground_rune"] = _pfx("eclipse:ground_rune", "rune", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_initial_spin": {"rotation": 0, "rotation_rate": 60},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "v.life ?? 1.2"},
        "minecraft:particle_appearance_billboard": {"size": ["v.radius ?? 1.5", "v.radius ?? 1.5"], "facing_camera_mode": "emitter_transform_xz",
                                                    "uv": {"texture_width": 32, "texture_height": 32, "uv": [0, 0], "uv_size": [32, 32]}},
        "minecraft:particle_appearance_tinting": VAR_COLOR,
    })
    P["lightning_column"] = _pfx("eclipse:lightning_column", "bolt", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_box": {"half_dimensions": [0.25, 9, 0.25], "offset": [0, 9, 0], "direction": "outwards"},
        "minecraft:particle_initial_speed": 0.0,
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.25 + v.particle_random_1 * 0.2"},
        "minecraft:particle_appearance_billboard": {"size": [0.6, 2.6], "facing_camera_mode": "lookat_y",
                                                    "uv": {"texture_width": 16, "texture_height": 64, "uv": [0, 0], "uv_size": [16, 64]}},
        "minecraft:particle_appearance_tinting": {"color": ["v.color.r ?? 0.85", "v.color.g ?? 0.7", "v.color.b ?? 1.0", "1 - v.particle_age / v.particle_lifetime * 0.6"]},
    }, 16, 64)
    P["flash"] = _pfx("eclipse:flash", "soft", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.3},
        "minecraft:particle_appearance_billboard": _billboard(["(v.radius ?? 4) * (1 - v.particle_age / v.particle_lifetime * 0.5)", "(v.radius ?? 4) * (1 - v.particle_age / v.particle_lifetime * 0.5)"]),
        "minecraft:particle_appearance_tinting": VAR_COLOR,
    })
    P["materialize"] = _pfx("eclipse:materialize", "spark", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 22},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 1.0, "direction": "inwards", "surface_only": True},
        "minecraft:particle_initial_speed": 2.2,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.0},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
        "minecraft:particle_appearance_billboard": _billboard([0.12, 0.12]),
        "minecraft:particle_appearance_tinting": VAR_COLOR,
    })
    P["leaf_burst"] = _pfx("eclipse:leaf_burst", "leaf", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": 14},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.6, "direction": "outwards"},
        "minecraft:particle_initial_speed": 2.0,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -2, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 360", "rotation_rate": 120},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.9 + v.particle_random_2 * 0.6"},
        "minecraft:particle_appearance_billboard": _billboard([0.2, 0.2]),
        "minecraft:particle_appearance_tinting": {"color": [0.35, 0.75, 0.3, 1.0]},
    })
    P["frost_burst"] = _pfx("eclipse:frost_burst", "flake", "particles_add", {
        "minecraft:emitter_rate_instant": {"num_particles": 16},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.7, "direction": "outwards"},
        "minecraft:particle_initial_speed": 1.8,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -0.6, 0], "linear_drag_coefficient": 2},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 360", "rotation_rate": 90},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.9 + v.particle_random_2 * 0.5"},
        "minecraft:particle_appearance_billboard": _billboard([0.18, 0.18]),
        "minecraft:particle_appearance_tinting": {"color": [0.75, 0.9, 1.0, 1.0]},
    })
    P["feather_fall"] = _pfx("eclipse:feather_fall", "feather", "particles_alpha", {
        "minecraft:emitter_rate_instant": {"num_particles": "v.count ?? 3"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_box": {"half_dimensions": [0.8, 0.3, 0.4], "direction": "outwards"},
        "minecraft:particle_initial_speed": 0.3,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 300) * 0.8", -0.6, 0], "linear_drag_coefficient": 1.5},
        "minecraft:particle_initial_spin": {"rotation": "v.particle_random_1 * 360", "rotation_rate": 50},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 1.6},
        "minecraft:particle_appearance_billboard": _billboard([0.16, 0.16]),
        "minecraft:particle_appearance_tinting": {"color": ["v.color.r ?? 0.1", "v.color.g ?? 0.08", "v.color.b ?? 0.15", 1.0]},
    })
    P["form_shift"] = _pfx("eclipse:form_shift", "smoke", "particles_blend", {
        "minecraft:emitter_rate_instant": {"num_particles": 30},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 1.0, "direction": "outwards", "offset": [0, 1, 0]},
        "minecraft:particle_initial_speed": 2.4,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.0, 0], "linear_drag_coefficient": 2.5},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "0.8 + v.particle_random_1 * 0.6"},
        "minecraft:particle_appearance_billboard": _billboard(["0.4 + v.particle_age * 0.8", "0.4 + v.particle_age * 0.8"]),
        "minecraft:particle_appearance_tinting": _grad("#E0180C2C", "#A0461E80", "#000A0612"),
    })
    return P


# =========================================================================
# BLOCK TEXTURES
# =========================================================================
BLOCKS = {
    # key: (name, light, render, base, hi, style)
    "shadow_block": ("Bloco de Sombra", 4, "opaque", (22, 16, 34), (160, 80, 255), "veins"),
    "radiant_block": ("Bloco Radiante", 12, "opaque", (226, 216, 190), (255, 235, 160), "glow"),
    "ember_block": ("Bloco de Brasa", 10, "opaque", (90, 24, 12), (255, 150, 60), "veins"),
    "tide_block": ("Barreira de Maré", 3, "blend", (40, 110, 210), (170, 225, 255), "waves"),
    "earth_block": ("Pedra Erguida", 0, "opaque", (96, 78, 60), (150, 126, 96), "rock"),
    "gale_block": ("Barreira de Vento", 2, "blend", (210, 230, 240), (255, 255, 255), "swirl"),
    "storm_block": ("Cristal de Tempestade", 12, "opaque", (40, 60, 120), (220, 240, 255), "veins"),
    "frost_block": ("Gelo Arcano", 2, "blend", (150, 200, 245), (235, 248, 255), "crystal"),
    "root_block": ("Raízes Vivas", 2, "opaque", (60, 44, 30), (110, 200, 90), "roots"),
    "shadow_lantern": ("Lanterna Sombria", 15, "opaque", (30, 20, 46), (230, 190, 255), "lantern"),
}


def block_texture(key, n=32):
    name, light, render, base, hi, style = BLOCKS[key]
    y, x = np.mgrid[0:n, 0:n] + 0.5
    z = np.zeros_like(x) + hash(key) % 97
    base = np.array(base, dtype=float)
    hi = np.array(hi, dtype=float)
    nz = fbm(x / 5, y / 5, z, 11, 4)
    rgb = base[None, None] * (0.75 + 0.5 * nz[..., None])
    alpha = np.full((n, n), 255.0)
    if style == "veins":
        v = fbm(x / 7, y / 7, z + 3, 5, 3)
        m = np.clip(1 - np.abs(v - 0.5) / 0.045, 0, 1)
        rgb = rgb * (1 - m[..., None]) + hi[None, None] * m[..., None]
    elif style == "glow":
        rgb = base[None, None] * (0.9 + 0.15 * nz[..., None])
        edge = np.minimum(np.minimum(x, n - x), np.minimum(y, n - y))
        rgb = rgb * (1 - np.clip(1 - edge / 2.5, 0, 1)[..., None] * 0.35)
        cross = (np.abs(x - n / 2) < 1.2) | (np.abs(y - n / 2) < 1.2)
        rgb[cross] = hi
    elif style == "waves":
        w = 0.5 + 0.5 * np.sin(y / 2.2 + np.sin(x / 4) * 1.5 + nz * 3)
        rgb = base[None, None] * (1 - w[..., None] * 0.4) + hi[None, None] * (w[..., None] * 0.4)
        alpha = np.full((n, n), 150.0)
    elif style == "rock":
        c = fbm(x / 4, y / 4, z + 8, 9, 3)
        crack = np.clip(1 - np.abs(c - 0.5) / 0.04, 0, 1)
        rgb = rgb * (1 - 0.55 * crack[..., None])
    elif style == "swirl":
        a = np.arctan2(y - n / 2, x - n / 2)
        r = np.sqrt((x - n / 2) ** 2 + (y - n / 2) ** 2)
        s = 0.5 + 0.5 * np.sin(a * 2 + r / 2.5)
        rgb = base[None, None] * (0.8 + 0.2 * s[..., None])
        alpha = 70 + 80 * s
    elif style == "crystal":
        f = np.abs(np.sin((x * 0.4 + y * 0.25))) * np.abs(np.cos((x * 0.15 - y * 0.35)))
        rgb = base[None, None] * (1 - f[..., None] * 0.4) + hi[None, None] * (f[..., None] * 0.4)
        alpha = np.full((n, n), 185.0)
    elif style == "roots":
        r1 = np.abs(np.sin(x / 2.0 + fbm(x / 6, y / 6, z, 2, 2) * 6))
        m = r1 < 0.25
        rgb[m] = rgb[m] * 1.6 + 10
        leaves = fbm(x / 3, y / 3, z + 4, 3, 2) > 0.62
        rgb[leaves] = hi
    elif style == "lantern":
        edge = np.minimum(np.minimum(x, n - x), np.minimum(y, n - y))
        frame = edge < 3.5
        rgb = np.where(frame[..., None], base[None, None] * 1.3, hi[None, None] * (0.75 + 0.35 * nz[..., None]))
        bars = (np.abs(x - n / 2) < 1.0) & ~frame
        rgb[bars] = base * 1.5
    edge = np.minimum(np.minimum(x, n - x), np.minimum(y, n - y))
    rgb = rgb * (1 - np.clip(1 - edge / 1.2, 0, 1)[..., None] * 0.25)
    img = np.zeros((n, n, 4))
    img[..., :3] = np.clip(rgb, 0, 255)
    img[..., 3] = alpha
    return Image.fromarray(img.astype(np.uint8), "RGBA")


# =========================================================================
# PROCEDURAL SOUNDS (numpy -> wav -> ogg vorbis via ffmpeg)
# =========================================================================
SR = 44100


def _env(n, a=0.01, d=0.3, curve=2.0):
    t = np.arange(n) / SR
    att = np.clip(t / max(a, 1e-4), 0, 1)
    dec = np.exp(-np.maximum(t - a, 0) / max(d, 1e-4) * curve)
    return att * dec


def _noise(n, seed=0):
    return np.random.default_rng(seed).standard_normal(n)


def _lp(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def _lp_fast(x, cutoff):
    # one-pole low-pass via FFT smoothing (good enough for effects)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X * H, len(x))


def _sweep(n, f0, f1, shape="sine"):
    t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (t / t[-1]) ** 1.5
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph)


def _chime(n, freqs, decay=0.8, seed=0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for i, f in enumerate(freqs):
        out += np.sin(2 * np.pi * f * t + i) * np.exp(-t / (decay * (1 - i * 0.08))) / (1 + i * 0.4)
    return out


def _reverb(x, amount=0.3, delays=(0.031, 0.047, 0.071, 0.113, 0.157)):
    y = x.copy()
    for i, d in enumerate(delays):
        k = int(d * SR)
        g = amount * (0.8 ** i)
        y[k:] += x[:-k] * g
    return y


def synth(name, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    if name == "manifest":
        whoosh = _lp_fast(_noise(n, 1), 900) * _env(n, 0.35, 0.5, 2.5) * 2.2
        rise = _sweep(n, 70, 240) * _env(n, 0.3, 0.5, 2) * 0.5
        sh = _chime(n, [880, 1320, 1760], 0.4) * np.clip((t - 0.25) * 4, 0, 1) * 0.25
        out = whoosh + rise + sh
    elif name == "recall":
        whoosh = _lp_fast(_noise(n, 2), 700) * np.clip(1 - t / dur, 0, 1) ** 2 * 2.0
        fall = _sweep(n, 260, 60) * np.clip(1 - t / dur, 0, 1) * 0.5
        out = whoosh + fall
    elif name == "materialize":
        out = _chime(n, [660, 990, 1485, 1980], 0.5) * 0.5 + _lp_fast(_noise(n, 3), 3000) * _env(n, 0.01, 0.12) * 0.6
    elif name == "awaken":
        boom = np.sin(2 * np.pi * (45 + 20 * np.exp(-t * 3)) * t) * _env(n, 0.02, 1.4, 1.5)
        pad = sum(np.sin(2 * np.pi * f * t) for f in (110, 165, 220, 277)) * _env(n, 0.8, 1.6, 1.2) * 0.18
        sh = _chime(n, [880, 1100, 1320], 1.2) * np.clip((t - 0.6), 0, 1) * 0.3
        out = boom + pad + sh + _lp_fast(_noise(n, 4), 400) * _env(n, 0.05, 0.6) * 0.8
    elif name == "shadow_cast":
        out = _lp_fast(_noise(n, 5), 1400) * _env(n, 0.05, 0.25, 2) * 2.0 + _sweep(n, 400, 120) * _env(n, 0.02, 0.3) * 0.4
    elif name == "divine_pulse":
        out = _chime(n, [523, 659, 784, 1047, 1319], 0.9) * 0.55 + _lp_fast(_noise(n, 6), 5000) * _env(n, 0.01, 0.2) * 0.3
    elif name == "element_cast":
        crackle = _noise(n, 7) * (np.random.default_rng(8).random(n) > 0.985) * 1.5
        out = crackle * _env(n, 0.01, 0.35) + _lp_fast(_noise(n, 9), 2000) * _env(n, 0.02, 0.2) * 1.2
    elif name == "howl":
        f = 380 + 140 * np.sin(np.clip(t / dur, 0, 1) * np.pi) + 6 * np.sin(2 * np.pi * 5.5 * t)
        ph = 2 * np.pi * np.cumsum(f) / SR
        voice = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
        out = voice * _env(n, 0.4, dur, 0.8) * np.clip((dur - t) * 2, 0, 1) * 0.6
        out = _reverb(out, 0.45)
    elif name == "transform":
        out = _lp_fast(_noise(n, 10), 600) * _env(n, 0.1, 0.5) * 2.0 + np.sin(2 * np.pi * (90 - 40 * t) * t) * _env(n, 0.05, 0.6) * 0.6
    elif name == "wings_open":
        flaps = np.zeros(n)
        for k in range(3):
            st = int((0.05 + k * 0.16) * SR)
            seg = _lp_fast(_noise(int(0.2 * SR), 20 + k), 1100) * _env(int(0.2 * SR), 0.02, 0.1)
            flaps[st:st + len(seg)] += seg[: max(0, n - st)]
        out = flaps * 2.2
    elif name == "hammer_throw":
        out = _lp_fast(_noise(n, 11), 1800) * np.sin(np.pi * t / dur) ** 2 * 1.8 * (0.7 + 0.3 * np.sin(2 * np.pi * 14 * t))
    elif name == "hammer_return":
        out = _lp_fast(_noise(n, 12), 1500) * np.sin(np.pi * t / dur) ** 2 * 1.5 + _chime(n, [784, 1176], 0.4) * np.clip(t - dur * 0.6, 0, 1) * 1.2
    elif name == "construct":
        out = _chime(n, [440, 660], 0.25) * 0.4 + _lp_fast(_noise(n, 13), 2500) * _env(n, 0.005, 0.08) * 0.8
    elif name == "levelup":
        out = np.zeros(n)
        for i, f in enumerate((523, 659, 784, 1047)):
            st = int(i * 0.09 * SR)
            seg = _chime(n - st, [f, f * 2], 0.6)
            out[st:] += seg * 0.5
    elif name == "ui_click":
        out = np.sin(2 * np.pi * 1400 * t) * _env(n, 0.002, 0.03) * 0.5
    elif name == "thunder":
        rumble = _lp_fast(_noise(n, 14), 180) * _env(n, 0.02, 1.6, 1.2) * 4.0
        crack = _lp_fast(_noise(n, 15), 6000) * _env(n, 0.001, 0.08) * 1.6
        out = rumble + crack
    else:
        raise KeyError(name)
    out = out / (np.max(np.abs(out)) + 1e-9) * 0.85
    fade = min(n, int(0.02 * SR))
    out[-fade:] *= np.linspace(1, 0, fade)
    return out


SOUNDS = {
    "manifest": 1.1, "recall": 0.8, "materialize": 0.9, "awaken": 2.6, "shadow_cast": 0.6, "divine_pulse": 1.4,
    "element_cast": 0.6, "howl": 2.4, "transform": 1.0, "wings_open": 0.6, "hammer_throw": 0.7, "hammer_return": 0.8,
    "construct": 0.35, "levelup": 1.2, "ui_click": 0.08, "thunder": 2.4,
}


def write_ogg(path, samples):
    wav = path + ".wav"
    data = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with wave.open(wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-c:a", "libvorbis", "-q:a", "4", path + ".ogg"], check=True)
    os.remove(wav)


# =========================================================================
# PACK ICON / LOGO
# =========================================================================
def pack_icon(size=256, variant="bp"):
    n = size
    y, x = np.mgrid[0:n, 0:n] + 0.5
    cx = cy = n / 2
    r = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (n / 2)
    bg = np.zeros((n, n, 3))
    bg[:] = (10, 6, 18)
    nz = fbm(x / 30, y / 30, np.zeros_like(x), 4, 4)
    bg += (nz[..., None] * np.array([40, 16, 70]))
    corona = np.exp(-((r - 0.52) ** 2) / 0.012) * (0.75 + 0.5 * fbm(np.arctan2(y - cy, x - cx) * 3, r * 4, np.zeros_like(x), 9, 3))
    bg += corona[..., None] * np.array([190, 110, 255])
    glow = np.exp(-((r - 0.5) ** 2) / 0.05)
    bg += glow[..., None] * np.array([60, 20, 120])
    disc = r < 0.44
    bg[disc] = (6, 4, 10)
    rim = (r > 0.43) & (r < 0.46)
    bg[rim] = (235, 210, 255)
    if variant == "rp":
        ring2 = np.exp(-((r - 0.78) ** 2) / 0.002)
        bg += ring2[..., None] * np.array([230, 186, 92])
    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    d = ImageDraw.Draw(img)
    # stylised 'E' sigil inside the eclipse
    w = n * 0.16
    x0, y0 = cx - w * 0.9, cy - w * 1.15
    for i, yy in enumerate((y0, cy - w * 0.12, cy + w * 0.9)):
        d.rectangle((x0, yy, x0 + w * (1.8 if i != 1 else 1.4), yy + w * 0.28), fill=(190, 120, 255, 255))
    d.rectangle((x0, y0, x0 + w * 0.32, cy + w * 1.18), fill=(190, 120, 255, 255))
    return img.filter(ImageFilter.SMOOTH)
