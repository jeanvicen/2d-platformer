#!/usr/bin/env python3
"""
Generates the client-side animation, animation controller and render controller JSON
for the companion. State numbers MUST match scripts/core/constants.ts (AnimState).
Run:  python3 tools/art/generate_anims.py
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "resource_pack")

# Keep in sync with AnimState in scripts/core/constants.ts
STATES = {
    "idle": 0, "walk": 1, "run": 2, "attack": 3, "chop": 4, "mine": 5, "build": 6, "eat": 7,
    "guard": 8, "summon": 9, "despawn": 10, "cast": 11, "wave": 12, "dig": 13,
}
P = "query.property('shadowbound:anim')"
MOOD = "query.property('shadowbound:mood')"


def v3(x, y, z):
    return [x, y, z]


A = {}

# ---- always-on layers -------------------------------------------------------------
A["animation.shadowbound.look_at"] = {
    "loop": True,
    "bones": {"head": {"rotation": v3("query.target_x_rotation", "query.target_y_rotation", 0)}},
}
A["animation.shadowbound.blink"] = {
    "loop": True,
    "bones": {"lids": {"scale": v3(1, "math.mod(query.life_time + variable.blink_offset, 3.6) < 0.13 ? 1 : 0", 1)}},
}
# mood: 0 neutral, 1 happy, 2 focused, 3 talking
A["animation.shadowbound.face"] = {
    "loop": True,
    "bones": {
        "eyes_happy": {"scale": f"{MOOD} == 1 ? 1 : 0"},
        "blush": {"scale": f"{MOOD} == 1 ? 1 : 0"},
        "brows": {"scale": f"{MOOD} == 2 ? 1 : 0"},
        "mouth_smile": {"scale": f"{MOOD} == 0 ? 1 : 0"},
        "mouth_open": {"scale": f"({MOOD} == 1 || ({MOOD} == 3 && math.mod(query.life_time * 7, 2) < 1)) ? 1 : 0"},
        "mouth_flat": {"scale": f"({MOOD} == 2 || ({MOOD} == 3 && math.mod(query.life_time * 7, 2) >= 1)) ? 1 : 0"},
    },
}
# secondary motion (hair, hat tip, scarf, skirt) - subtle, always on
A["animation.shadowbound.secondary"] = {
    "loop": True,
    "bones": {
        "hair_back": {"rotation": v3("3 + math.sin(query.life_time * 70) * 2", 0, "math.sin(query.life_time * 45) * 1.5")},
        "lock_r": {"rotation": v3("math.sin(query.life_time * 80) * 2", 0, "math.sin(query.life_time * 60) * 2")},
        "lock_l": {"rotation": v3("math.sin(query.life_time * 80 + 40) * 2", 0, "-math.sin(query.life_time * 60) * 2")},
        "hat_tip": {"rotation": v3("math.sin(query.life_time * 80) * 4", 0, "math.cos(query.life_time * 60) * 4")},
        "ahoge": {"rotation": v3(0, 0, "math.sin(query.life_time * 150) * 9")},
        "ponytail": {"rotation": v3("math.sin(query.life_time * 70) * 4", 0, "math.sin(query.life_time * 50) * 6")},
        "scarf_tail": {"rotation": v3("12 + math.sin(query.life_time * 120) * 9", 0, "math.sin(query.life_time * 90) * 7")},
        "coat_tail": {"rotation": v3("4 + math.sin(query.life_time * 60) * 2", 0, 0)},
        "skirt": {"rotation": v3(0, 0, "math.sin(query.life_time * 50) * 1")},
    },
}

# ---- body states ------------------------------------------------------------------
A["animation.shadowbound.idle"] = {
    "loop": True,
    "bones": {
        "body": {"position": v3(0, "math.sin(query.life_time * 120) * 0.12", 0)},
        "head": {"rotation": v3(0, 0, "math.sin(query.life_time * 40) * 2")},
        "rightArm": {"rotation": v3("math.sin(query.life_time * 90) * 2", 0, "4 + math.sin(query.life_time * 75) * 2")},
        "leftArm": {"rotation": v3("-math.sin(query.life_time * 90) * 2", 0, "-4 - math.sin(query.life_time * 75) * 2")},
    },
}
# native movement (distance based, weight = move speed)
A["animation.shadowbound.walk_native"] = {
    "loop": True,
    "bones": {
        "rightLeg": {"rotation": v3("math.cos(query.modified_distance_moved * 38.17) * 50 * query.modified_move_speed", 0, 0)},
        "leftLeg": {"rotation": v3("-math.cos(query.modified_distance_moved * 38.17) * 50 * query.modified_move_speed", 0, 0)},
        "rightArm": {"rotation": v3("-math.cos(query.modified_distance_moved * 38.17) * 45 * query.modified_move_speed", 0, 0)},
        "leftArm": {"rotation": v3("math.cos(query.modified_distance_moved * 38.17) * 45 * query.modified_move_speed", 0, 0)},
        "hair_back": {"rotation": v3("10 * query.modified_move_speed", 0, 0)},
        "ponytail": {"rotation": v3("20 * query.modified_move_speed", 0, 0)},
    },
}


def gait(freq, leg, arm, lean, bob, hair):
    return {
        "loop": True,
        "bones": {
            "root": {"position": v3(0, f"math.abs(math.sin(query.anim_time * 360 * {freq})) * {bob}", 0)},
            "body": {"rotation": v3(lean, f"math.sin(query.anim_time * 360 * {freq}) * 4", 0)},
            "rightLeg": {"rotation": v3(f"math.cos(query.anim_time * 360 * {freq}) * {leg}", 0, 0)},
            "leftLeg": {"rotation": v3(f"-math.cos(query.anim_time * 360 * {freq}) * {leg}", 0, 0)},
            "rightArm": {"rotation": v3(f"-math.cos(query.anim_time * 360 * {freq}) * {arm}", 0, 3)},
            "leftArm": {"rotation": v3(f"math.cos(query.anim_time * 360 * {freq}) * {arm}", 0, -3)},
            "hair_back": {"rotation": v3(f"{hair} + math.sin(query.anim_time * 720 * {freq}) * 3", 0, 0)},
            "ponytail": {"rotation": v3(f"{hair * 2} + math.sin(query.anim_time * 720 * {freq}) * 6", 0, 0)},
            "skirt": {"rotation": v3(f"math.cos(query.anim_time * 360 * {freq}) * 4", 0, 0)},
            "scarf_tail": {"rotation": v3(f"{hair * 3}", 0, 0)},
            "hat_tip": {"rotation": v3(f"-{hair}", 0, 0)},
        },
    }


A["animation.shadowbound.walk"] = gait(1.7, 32, 28, 2, 0.5, 8)
A["animation.shadowbound.run"] = gait(2.6, 55, 50, 12, 1.0, 20)

A["animation.shadowbound.attack"] = {
    "loop": True, "animation_length": 0.5,
    "bones": {
        "rightArm": {"rotation": {"0.0": v3(0, 0, 0), "0.12": v3(-150, -10, 10), "0.3": v3(35, 10, -5), "0.5": v3(0, 0, 0)}},
        "leftArm": {"rotation": {"0.0": v3(-20, 0, 0), "0.3": v3(-35, 0, -15), "0.5": v3(-20, 0, 0)}},
        "body": {"rotation": {"0.0": v3(0, 0, 0), "0.12": v3(0, -15, 0), "0.3": v3(6, 25, 0), "0.5": v3(0, 0, 0)}},
        "rightLeg": {"rotation": v3(-12, 0, 4)},
        "leftLeg": {"rotation": v3(12, 0, -4)},
    },
}
A["animation.shadowbound.chop"] = {
    "loop": True, "animation_length": 0.6,
    "bones": {
        "rightArm": {"rotation": {"0.0": v3(-160, 0, -15), "0.35": v3(-25, 0, -5), "0.6": v3(-160, 0, -15)}},
        "leftArm": {"rotation": {"0.0": v3(-160, 0, 15), "0.35": v3(-25, 0, 5), "0.6": v3(-160, 0, 15)}},
        "body": {"rotation": {"0.0": v3(-6, 0, 0), "0.35": v3(12, 0, 0), "0.6": v3(-6, 0, 0)}},
        "head": {"rotation": v3(10, 0, 0)},
    },
}
A["animation.shadowbound.mine"] = {
    "loop": True, "animation_length": 0.5,
    "bones": {
        "rightArm": {"rotation": {"0.0": v3(-140, 0, 10), "0.25": v3(-30, 0, 0), "0.5": v3(-140, 0, 10)}},
        "leftArm": {"rotation": v3(-30, 0, -10)},
        "body": {"rotation": {"0.0": v3(0, 0, 0), "0.25": v3(12, 0, 0), "0.5": v3(0, 0, 0)}},
        "head": {"rotation": v3(15, 0, 0)},
    },
}
A["animation.shadowbound.dig"] = {
    "loop": True, "animation_length": 0.6,
    "bones": {
        "rightArm": {"rotation": {"0.0": v3(-70, 0, 0), "0.3": v3(-15, 0, 0), "0.6": v3(-70, 0, 0)}},
        "leftArm": {"rotation": {"0.0": v3(-60, 0, 0), "0.3": v3(-10, 0, 0), "0.6": v3(-60, 0, 0)}},
        "body": {"rotation": {"0.0": v3(10, 0, 0), "0.3": v3(22, 0, 0), "0.6": v3(10, 0, 0)}},
        "head": {"rotation": v3(15, 0, 0)},
    },
}
A["animation.shadowbound.build"] = {
    "loop": True, "animation_length": 0.5,
    "bones": {
        "rightArm": {"rotation": {"0.0": v3(-80, 0, 0), "0.25": v3(-45, 10, 0), "0.5": v3(-80, 0, 0)}},
        "head": {"rotation": v3(12, 0, 0)},
    },
}
A["animation.shadowbound.eat"] = {
    "loop": True, "animation_length": 0.8,
    "bones": {
        "rightArm": {"rotation": v3("-95 + math.sin(query.anim_time * 720) * 8", 25, 0)},
        "head": {"rotation": v3("6 + math.sin(query.anim_time * 720) * 3", 0, 0)},
    },
}
A["animation.shadowbound.guard"] = {
    "loop": True,
    "bones": {
        "rightLeg": {"rotation": v3(-6, 0, 8)},
        "leftLeg": {"rotation": v3(6, 0, -8)},
        "body": {"rotation": v3(5, "math.sin(query.life_time * 40) * 6", 0)},
        "rightArm": {"rotation": v3("-55 + math.sin(query.life_time * 100) * 3", 0, 12)},
        "leftArm": {"rotation": v3(-30, 0, -18)},
        "root": {"position": v3(0, -0.4, 0)},
    },
}
A["animation.shadowbound.summon"] = {
    "loop": "hold_on_last_frame", "animation_length": 1.4,
    "bones": {
        "root": {
            "scale": {"0.0": v3(0.05, 0.05, 0.05), "0.6": v3(1.12, 1.12, 1.12), "0.8": v3(1, 1, 1)},
            "rotation": {"0.0": v3(0, -360, 0), "0.8": v3(0, 0, 0)},
        },
        "rightArm": {"rotation": {"0.5": v3(-170, 0, 20), "1.1": v3(-170, 0, 20), "1.4": v3(0, 0, 0)}},
        "leftArm": {"rotation": {"0.5": v3(-170, 0, -20), "1.1": v3(-170, 0, -20), "1.4": v3(0, 0, 0)}},
    },
}
A["animation.shadowbound.despawn"] = {
    "loop": "hold_on_last_frame", "animation_length": 1.0,
    "bones": {
        "root": {
            "scale": {"0.0": v3(1, 1, 1), "0.25": v3(1.08, 0.9, 1.08), "1.0": v3(0.02, 0.02, 0.02)},
            "rotation": {"0.0": v3(0, 0, 0), "1.0": v3(0, 540, 0)},
            "position": {"0.0": v3(0, 0, 0), "1.0": v3(0, -6, 0)},
        },
        "rightArm": {"rotation": v3(-160, 0, 25)},
        "leftArm": {"rotation": v3(-160, 0, -25)},
    },
}
A["animation.shadowbound.cast"] = {
    "loop": True, "animation_length": 1.0,
    "bones": {
        "rightArm": {"rotation": v3("-90 + math.sin(query.anim_time * 360) * 10", -10, 20)},
        "leftArm": {"rotation": v3("-90 - math.sin(query.anim_time * 360) * 10", 10, -20)},
        "body": {"rotation": v3(0, "math.sin(query.anim_time * 360) * 8", 0)},
        "hat_tip": {"rotation": v3(0, "query.anim_time * 360", 0)},
    },
}
A["animation.shadowbound.wave"] = {
    "loop": True, "animation_length": 1.0,
    "bones": {
        "rightArm": {"rotation": v3(-10, 0, "150 + math.sin(query.anim_time * 720) * 20")},
        "head": {"rotation": v3(0, 0, "math.sin(query.anim_time * 360) * 6")},
        "body": {"rotation": v3(0, 0, -3)},
    },
}

animations = {"format_version": "1.8.0", "animations": A}

# ---- controller -------------------------------------------------------------------
# idle is the "default" state; native walking blends on top of it.
ctrl_states = {}
body_states = [s for s in STATES if s != "idle"]
ctrl_states["default"] = {
    "animations": ["idle", {"walk_native": "query.modified_move_speed > 0.05"}],
    "transitions": [{s: f"{P} == {STATES[s]}"} for s in body_states],
    "blend_transition": 0.18,
}
for s in body_states:
    trans = [{"default": f"{P} == 0"}] + [{o: f"{P} == {STATES[o]}"} for o in body_states if o != s]
    st = {"animations": [s], "transitions": trans, "blend_transition": 0.15}
    if s == "guard":
        st["animations"] = ["guard", {"walk_native": "query.modified_move_speed > 0.05"}]
    ctrl_states[s] = st

controllers = {
    "format_version": "1.10.0",
    "animation_controllers": {
        "controller.animation.shadowbound.main": {"initial_state": "default", "states": ctrl_states}
    },
}

render = {
    "format_version": "1.10.0",
    "render_controllers": {
        "controller.render.shadowbound.companion": {
            "arrays": {
                "textures": {"Array.skins": ["Texture.luna", "Texture.raven"]},
                "geometries": {"Array.geos": ["Geometry.luna", "Geometry.raven"]},
            },
            "geometry": "Array.geos[query.property('shadowbound:persona')]",
            "materials": [{"*": "Material.default"}, {"glow_eyes": "Material.glow"}],
            "textures": ["Array.skins[query.property('shadowbound:persona')]"],
            "is_hurt_color": {},
            "on_fire_color": {},
        }
    },
}

anim_names = {k.split(".")[-1]: k for k in A}
client = {
    "format_version": "1.10.0",
    "minecraft:client_entity": {
        "description": {
            "identifier": "shadowbound:companion",
            "materials": {"default": "entity_alphatest", "glow": "entity_emissive_alpha"},
            "textures": {
                "luna": "textures/entity/shadowbound/luna",
                "raven": "textures/entity/shadowbound/raven",
            },
            "geometry": {
                "luna": "geometry.shadowbound.luna",
                "raven": "geometry.shadowbound.raven",
            },
            "animations": dict(anim_names, main="controller.animation.shadowbound.main"),
            "scripts": {
                "initialize": ["variable.blink_offset = math.random(0, 3.6);"],
                "animate": ["main", "look_at", "blink", "face", "secondary"],
            },
            "render_controllers": ["controller.render.shadowbound.companion"],
            "enable_attachables": True,
            "hide_armor": False,
        }
    },
}

os.makedirs(os.path.join(RP, "animations"), exist_ok=True)
os.makedirs(os.path.join(RP, "animation_controllers"), exist_ok=True)
os.makedirs(os.path.join(RP, "render_controllers"), exist_ok=True)
os.makedirs(os.path.join(RP, "entity"), exist_ok=True)
for path, data in (
    ("animations/shadowbound_companion.animation.json", animations),
    ("animation_controllers/shadowbound_companion.animation_controllers.json", controllers),
    ("render_controllers/shadowbound_companion.render_controllers.json", render),
    ("entity/shadowbound_companion.entity.json", client),
):
    with open(os.path.join(RP, path), "w") as f:
        json.dump(data, f, indent=2)
print("animations generated:", len(A))
