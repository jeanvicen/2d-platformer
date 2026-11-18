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
def S(expr):
    return [expr, expr, expr]


A["animation.shadowbound.face"] = {
    "loop": True,
    "bones": {
        "eyes_happy": {"scale": S(f"{MOOD} == 1 ? 1 : 0")},
        "blush": {"scale": S(f"{MOOD} == 1 ? 1 : 0")},
        "brows": {"scale": S(f"{MOOD} == 2 ? 1 : 0")},
        "mouth_smile": {"scale": S(f"{MOOD} == 0 ? 1 : 0")},
        "mouth_open": {"scale": S(f"({MOOD} == 1 || ({MOOD} == 3 && math.mod(query.life_time * 7, 2) < 1)) ? 1 : 0")},
        "mouth_flat": {"scale": S(f"({MOOD} == 2 || ({MOOD} == 3 && math.mod(query.life_time * 7, 2) >= 1)) ? 1 : 0")},
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
        "hair_top": {"rotation": v3("math.sin(query.life_time * 60) * 1.5", 0, 0)},
        "coat": {"rotation": v3("math.sin(query.life_time * 55) * 1", 0, 0)},
        # Sora floats (telekinesis): only her geometry has the 'levitate' bone
        "levitate": {"position": v3(0, "2.2 + math.sin(query.life_time * 90) * 0.6", 0)},
    },
}

# ---- body states ------------------------------------------------------------------
A["animation.shadowbound.idle"] = {
    "loop": True,
    "bones": {
        "root": {"position": v3("math.sin(query.life_time * 35) * 0.25", 0, 0)},
        "waist": {"rotation": v3(0, 0, "math.sin(query.life_time * 35) * 1.5")},
        "body": {"position": v3(0, "math.sin(query.life_time * 120) * 0.12", 0), "scale": v3(1, "1 + math.sin(query.life_time * 120) * 0.01", 1)},
        "head": {"rotation": v3("math.sin(query.life_time * 55) * 1.5", 0, "math.sin(query.life_time * 40) * 2")},
        "rightLeg": {"rotation": v3(0, 0, "math.max(0, math.sin(query.life_time * 35)) * 2")},
        "leftLeg": {"rotation": v3(0, 0, "-math.max(0, -math.sin(query.life_time * 35)) * 2")},
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
        "root": {"position": v3(0, "math.abs(math.sin(query.modified_distance_moved * 38.17)) * 0.6 * query.modified_move_speed", 0)},
        "body": {"rotation": v3("4 * query.modified_move_speed", "math.sin(query.modified_distance_moved * 38.17) * 5 * query.modified_move_speed", 0)},
        "head": {"rotation": v3("-3 * query.modified_move_speed", "-math.sin(query.modified_distance_moved * 38.17) * 4 * query.modified_move_speed", 0)},
        "skirt": {"rotation": v3("math.cos(query.modified_distance_moved * 38.17) * 5 * query.modified_move_speed", 0, 0)},
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
    "loop": "hold_on_last_frame", "animation_length": 1.6,
    "bones": {
        "root": {
            "position": {"0.0": v3(0, -30, 0), "0.7": v3(0, 1.5, 0), "0.9": v3(0, 0, 0)},
            "scale": {"0.0": v3(0.7, 0.7, 0.7), "0.7": v3(1.06, 1.06, 1.06), "0.95": v3(1, 1, 1)},
            "rotation": {"0.0": v3(0, -200, 0), "0.85": v3(0, 0, 0)},
        },
        "head": {"rotation": {"0.0": v3(25, 0, 0), "0.8": v3(25, 0, 0), "1.1": v3(-10, 0, 0), "1.4": v3(0, 0, 0)}},
        "rightArm": {"rotation": {"0.0": v3(-20, 0, 40), "0.8": v3(-175, 0, 25), "1.2": v3(-175, 0, 25), "1.6": v3(0, 0, 0)}},
        "leftArm": {"rotation": {"0.0": v3(-20, 0, -40), "0.8": v3(-175, 0, -25), "1.2": v3(-175, 0, -25), "1.6": v3(0, 0, 0)}},
        "hair_back": {"rotation": {"0.0": v3(-40, 0, 0), "0.9": v3(-40, 0, 0), "1.3": v3(5, 0, 0)}},
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
    "blend_transition": 0.25,
}
for s in body_states:
    trans = [{"default": f"{P} == 0"}] + [{o: f"{P} == {STATES[o]}"} for o in body_states if o != s]
    st = {"animations": [s], "transitions": trans, "blend_transition": 0.2}
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
                "textures": {"Array.skins": ["Texture.luna", "Texture.raven", "Texture.sora", "Texture.yuki", "Texture.hana", "Texture.aiko"]},
                "geometries": {"Array.geos": ["Geometry.luna", "Geometry.raven", "Geometry.sora", "Geometry.yuki", "Geometry.hana", "Geometry.aiko"]},
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
                "sora": "textures/entity/shadowbound/sora",
                "yuki": "textures/entity/shadowbound/yuki",
                "hana": "textures/entity/shadowbound/hana",
                "aiko": "textures/entity/shadowbound/aiko",
            },
            "geometry": {
                "luna": "geometry.shadowbound.luna",
                "raven": "geometry.shadowbound.raven",
                "sora": "geometry.shadowbound.sora",
                "yuki": "geometry.shadowbound.yuki",
                "hana": "geometry.shadowbound.hana",
                "aiko": "geometry.shadowbound.aiko",
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


# =====================================================================================
# Shadow beasts — every species has its OWN animation set (idle, move, walk, run,
# attack, ability, guard, summon) and an always-on "secondary" layer (breathing,
# blinking, tail/ear/wing motion). One controller routes to the species' own states.
# =====================================================================================
BEASTS = ["wolf", "owl", "serpent", "toad", "elephant", "rabbit", "deer", "bull", "tiger", "lion", "dragon", "colossus", "dog_white", "totality"]
SPECIES = "query.property('shadowbound:species')"
T = "query.life_time"
AT = "query.anim_time"
SPD = "query.modified_move_speed"
B = {}


def R(x=0, y=0, z=0):
    return {"rotation": v3(x, y, z)}


def Pz(x=0, y=0, z=0):
    return {"position": v3(x, y, z)}


def kf(*pairs):
    """kf((t, [x,y,z]), ...) -> keyframe dict."""
    return {f"{t:.2f}": list(v) for t, v in pairs}


def merge(*ds):
    out = {}
    for d in ds:
        for bone, ch in d.items():
            tgt = out.setdefault(bone, {})
            for k, v in ch.items():
                if k in tgt and isinstance(v, list) and isinstance(tgt[k], list):
                    tgt[k] = [f"({a}) + ({b})" if (a not in (0, "0") and b not in (0, "0")) else (b if a in (0, "0") else a)
                              for a, b in zip(tgt[k], v)]
                else:
                    tgt[k] = v
    return out


BLINK = {"glow_eyes": {"scale": [1, f"math.mod({T} + 1.3, 4.3) < 0.12 ? 0.1 : 1", 1]}}


# ---- gaits (t = phase in degrees, m = amplitude multiplier) ----------------------------
def trot(t, m, amp=30, bob=0.4, head=3, tail=12, low=0.0, roll=0.0, headx=0.0):
    return {
        "leg_fl": R(f"math.cos({t}) * {amp} * {m}"), "leg_br": R(f"math.cos({t}) * {amp} * {m}"),
        "leg_fr": R(f"-math.cos({t}) * {amp} * {m}"), "leg_bl": R(f"-math.cos({t}) * {amp} * {m}"),
        "root": Pz(0, f"({low} + math.abs(math.sin({t})) * {bob}) * {m}", 0),
        "body": R(f"math.sin({t} * 2) * 1.5 * {m}", 0, f"math.sin({t}) * {roll} * {m}"),
        "head": R(f"({headx} + math.sin({t} * 2) * {head}) * {m}"),
        "tail": R(0, f"math.sin({t}) * {tail} * {m}", 0),
    }


def bound(t, m, amp=45, bob=1.2, pitch=6, spread=25, headx=0.0):
    return {
        "leg_fl": R(f"math.cos({t}) * {amp} * {m}"), "leg_fr": R(f"math.cos({t} - {spread}) * {amp} * {m}"),
        "leg_bl": R(f"-math.cos({t}) * {amp} * {m}"), "leg_br": R(f"-math.cos({t} - {spread}) * {amp} * {m}"),
        "root": Pz(0, f"math.abs(math.sin({t})) * {bob} * {m}", 0),
        "body": R(f"math.sin({t}) * {pitch} * {m}"),
        "head": R(f"({headx} - math.sin({t}) * {pitch * 0.7}) * {m}"),
        "tail": R(f"math.cos({t}) * 10 * {m}", f"math.sin({t}) * 8 * {m}", 0),
    }


def hop(t, m, back=60, front=30, height=2.0, pitch=10, ears=0):
    s = f"math.max(0, math.sin({t}))"
    d = {
        "leg_bl": R(f"{s} * {back} * {m}"), "leg_br": R(f"{s} * {back} * {m}"),
        "leg_fl": R(f"-{s} * {front} * {m}"), "leg_fr": R(f"-{s} * {front} * {m}"),
        "root": Pz(0, f"{s} * {height} * {m}", 0),
        "body": R(f"-math.cos({t}) * {pitch} * {m}"),
    }
    if ears:
        d["ear_l"] = R(f"-{s} * {ears} * {m}")
        d["ear_r"] = R(f"-{s} * {ears} * {m}")
    return d


def pace(t, m, amp=22):
    d = {
        "leg_fl": R(f"math.cos({t}) * {amp} * {m}"), "leg_fr": R(f"math.cos({t} + 180) * {amp} * {m}"),
        "leg_bl": R(f"math.cos({t} + 90) * {amp} * {m}"), "leg_br": R(f"math.cos({t} + 270) * {amp} * {m}"),
        "body": R(0, f"math.sin({t}) * 2 * {m}", f"math.sin({t}) * 2.5 * {m}"),
        "root": Pz(0, f"-math.abs(math.sin({t} * 2)) * 0.35 * {m}", 0),
        "head": R(f"math.sin({t} * 2) * 2 * {m}", f"math.sin({t}) * 3 * {m}", 0),
        "ear_l": R(0, f"math.sin({t} * 2) * 8 * {m}", 0), "ear_r": R(0, f"-math.sin({t} * 2) * 8 * {m}", 0),
        "tail": R(0, f"math.sin({t}) * 14 * {m}", 0),
    }
    for i in range(4):
        d[f"trunk{i}"] = R(f"math.sin({t} - {i * 35}) * {6 + i * 3} * {m}", f"math.sin({t} * 0.5 - {i * 30}) * {3 + i} * {m}", 0)
    return d


def slither(t, m, amp=16, lag=45):
    d = {f"seg{i}": R(0, f"math.sin({t} - {i * lag}) * {amp} * {0.6 + i * 0.08} * {m}", 0) for i in range(7)}
    d["head"] = R(0, f"math.sin({t} + 30) * {amp * 0.35} * {m}", 0)
    return d


def flap(t, m, amp=40, pitch=12, lift=1.0):
    return {
        "wing_l": R(0, 0, f"(-10 - math.sin({t}) * {amp}) * {m}"),
        "wing_r": R(0, 0, f"(10 + math.sin({t}) * {amp}) * {m}"),
        "levitate": Pz(0, f"math.sin({t} + 90) * {lift} * {m}", 0),
        "body": R(f"{pitch} * {m}"),
        "head": R(f"-{pitch * 0.8} * {m}"),
        "leg_fl": R(f"35 * {m}"), "leg_fr": R(f"35 * {m}"),
        "tail": R(f"math.sin({t}) * 6 * {m}"),
    }


def stomp(t, m, amp=20):
    return {
        "leg_l": R(f"math.cos({t}) * {amp} * {m}"), "leg_r": R(f"-math.cos({t}) * {amp} * {m}"),
        "arm_l": R(f"-math.cos({t}) * {amp * 0.7} * {m}"), "arm_r": R(f"math.cos({t}) * {amp * 0.7} * {m}"),
        "body": R(0, f"math.sin({t}) * 4 * {m}", f"math.sin({t}) * 4 * {m}"),
        "root": Pz(0, f"-math.abs(math.sin({t})) * 0.8 * {m}", 0),
        "head": R(f"math.sin({t} * 2) * 2 * {m}"),
    }


def dragon_walk(t, m):
    d = trot(t, m, amp=26, bob=0.3, head=0, tail=0, roll=1.5)
    d.update({"wing_l": R(0, 0, f"(-8 + math.sin({t}) * 4) * {m}"), "wing_r": R(0, 0, f"(8 - math.sin({t}) * 4) * {m}"),
              "neck": R(0, f"-math.sin({t}) * 6 * {m}", 0)})
    for i, n in enumerate(("tail", "tail1", "tail2", "tail3")):
        d[n] = R(0, f"math.sin({t} - {i * 40}) * 10 * {m}", 0)
    return d


def dragon_run(t, m):
    d = bound(t, m, amp=40, bob=1.5, pitch=5)
    d.update({"wing_l": R(0, 0, f"(-15 - math.sin({t} * 2) * 45) * {m}"), "wing_r": R(0, 0, f"(15 + math.sin({t} * 2) * 45) * {m}"),
              "neck": R(f"-10 * {m}"), "root": Pz(0, f"(2 + math.abs(math.sin({t})) * 1.5) * {m}", 0)})
    for i, n in enumerate(("tail", "tail1", "tail2", "tail3")):
        d[n] = R(f"math.sin({t} - {i * 40}) * 6 * {m}", 0, 0)
    return d


# ---- per-species definitions ----------------------------------------------------------
# gait: (function, kwargs);  stride: degrees of gait phase per unit of distance moved
S = {}
S["wolf"] = dict(
    stride=36, walk=(trot, dict(amp=34, bob=0.35, head=3, tail=10)), walk_f=1.8,
    run=(bound, dict(amp=50, bob=1.3, pitch=7)), run_f=2.8,
    secondary={"tail": R(-10, f"math.sin({T} * 420) * 16", 0), "jaw": R(f"4 + math.sin({T} * 700) * 3"),
               "body": Pz(0, f"math.sin({T} * 120) * 0.15", 0)},
    idle={"head": R(f"math.sin({T} * 50) * 3", 0, f"math.sin({T} * 35) * 6")},
    attack=(0.5, {"body": {"position": kf((0, [0, 0, 0]), (0.15, [0, 0, -2.5]), (0.5, [0, 0, 0]))},
                  "head": {"rotation": kf((0, [0, 0, 0]), (0.1, [-15, 0, 0]), (0.22, [20, 0, 0]), (0.5, [0, 0, 0]))},
                  "jaw": {"rotation": kf((0, [0, 0, 0]), (0.1, [35, 0, 0]), (0.22, [0, 0, 0]))},
                  "leg_fl": {"rotation": kf((0, [0, 0, 0]), (0.15, [-40, 0, 0]), (0.5, [0, 0, 0]))},
                  "leg_fr": {"rotation": kf((0, [0, 0, 0]), (0.15, [-40, 0, 0]), (0.5, [0, 0, 0]))},
                  "leg_bl": {"rotation": kf((0, [0, 0, 0]), (0.15, [25, 0, 0]), (0.5, [0, 0, 0]))},
                  "leg_br": {"rotation": kf((0, [0, 0, 0]), (0.15, [25, 0, 0]), (0.5, [0, 0, 0]))}}),
    pose={"head": [-45, 0, 0], "jaw": [28, 0, 0], "body": [-14, 0, 0]},          # howl
    guard={"root": Pz(0, -0.6, 0), "head": R(10), "tail": R(-25), "jaw": R(8), "leg_fl": R(-8), "leg_fr": R(-8)},
)
S["owl"] = dict(
    stride=24, walk=(flap, dict(amp=35, pitch=12)), walk_f=1.5, run=(flap, dict(amp=55, pitch=25, lift=1.5)), run_f=2.6,
    secondary={"levitate": Pz(0, f"3 + math.sin({T} * 90) * 1.2", 0),
               "wing_l": R(0, 0, f"-6 - math.abs(math.sin({T} * 150)) * 10"), "wing_r": R(0, 0, f"6 + math.abs(math.sin({T} * 150)) * 10"),
               "head": R(0, f"math.sin({T} * 25) * 55", 0)},
    idle={"body": R(f"math.sin({T} * 40) * 3"), "tail": R(f"math.sin({T} * 60) * 5")},
    attack=(0.8, {"levitate": {"position": kf((0, [0, 0, 0]), (0.2, [0, 4, 0]), (0.45, [0, -3, 0]), (0.8, [0, 0, 0]))},
                  "body": {"rotation": kf((0, [0, 0, 0]), (0.2, [-10, 0, 0]), (0.45, [45, 0, 0]), (0.8, [0, 0, 0]))},
                  "wing_l": {"rotation": kf((0, [0, 0, 0]), (0.2, [0, 0, -80]), (0.45, [0, 0, -15]), (0.8, [0, 0, 0]))},
                  "wing_r": {"rotation": kf((0, [0, 0, 0]), (0.2, [0, 0, 80]), (0.45, [0, 0, 15]), (0.8, [0, 0, 0]))},
                  "leg_fl": {"rotation": kf((0, [0, 0, 0]), (0.2, [0, 0, 0]), (0.45, [-70, 0, 0]), (0.8, [0, 0, 0]))},
                  "leg_fr": {"rotation": kf((0, [0, 0, 0]), (0.2, [0, 0, 0]), (0.45, [-70, 0, 0]), (0.8, [0, 0, 0]))},
                  "head": {"rotation": kf((0, [0, 0, 0]), (0.2, [-20, 0, 0]), (0.45, [-35, 0, 0]), (0.8, [0, 0, 0]))}}),
    pose={"wing_l": [0, 0, -95], "wing_r": [0, 0, 95], "head": [-15, 0, 0], "body": [-15, 0, 0], "tail": [-25, 0, 0]},   # screech
    guard={"wing_l": R(0, 0, 6), "wing_r": R(0, 0, -6), "head": R(10), "body": R(8), "levitate": Pz(0, -1, 0)},
)
S["serpent"] = dict(
    stride=30, walk=(slither, dict(amp=18)), walk_f=1.2, run=(slither, dict(amp=24, lag=40)), run_f=2.2,
    secondary=dict({f"seg{i}": R(0, f"math.sin({T} * 90 - {i * 40}) * 7", 0) for i in range(7)},
                   head=R(f"-12 + math.sin({T} * 70) * 4", f"math.sin({T} * 45) * 10", 0),
                   jaw=R(f"math.mod({T}, 2.6) < 0.25 ? 14 : 2")),
    idle={"root": Pz(0, f"math.sin({T} * 60) * 0.2", 0), "seg0": R(-6)},
    attack=(0.7, {"seg0": {"rotation": kf((0, [0, 0, 0]), (0.2, [-25, 0, 0]), (0.35, [10, 0, 0]), (0.7, [0, 0, 0]))},
                  "root": {"position": kf((0, [0, 0, 0]), (0.2, [0, 1, 3]), (0.32, [0, 0, -5]), (0.7, [0, 0, 0]))},
                  "head": {"rotation": kf((0, [0, 0, 0]), (0.2, [-25, 0, 0]), (0.32, [15, 0, 0]), (0.7, [0, 0, 0]))},
                  "jaw": {"rotation": kf((0, [0, 0, 0]), (0.25, [45, 0, 0]), (0.33, [45, 0, 0]), (0.45, [0, 0, 0]))}}),
    pose={"seg0": [-30, 0, 0], "seg1": [-8, 0, 0], "head": [10, 0, 0], "jaw": [40, 0, 0]},                         # rear up
    pose_pos={"root": [0, 5, 0]},
    guard={"root": Pz(0, 2, 0), "seg0": R(-15), "head": R(5), "jaw": R(6)},
)
S["toad"] = dict(
    stride=26, walk=(hop, dict(back=55, front=25, height=2.5, pitch=8)), walk_f=1.1,
    run=(hop, dict(back=65, front=30, height=3.5, pitch=10)), run_f=1.8,
    secondary={"body": {"scale": [f"1 + math.sin({T} * 200) * 0.03", f"1 + math.sin({T} * 200) * 0.04", 1]},
               "head": R(f"math.sin({T} * 30) * 2")},
    idle={"leg_bl": R(f"math.sin({T} * 40) * 2"), "leg_br": R(f"-math.sin({T} * 40) * 2")},
    attack=(0.6, {"tongue": {"scale": kf((0, [1, 1, 1]), (0.15, [1, 1, 14]), (0.25, [1, 1, 14]), (0.4, [1, 1, 1]))},
                  "head": {"rotation": kf((0, [0, 0, 0]), (0.1, [-15, 0, 0]), (0.3, [5, 0, 0]), (0.6, [0, 0, 0]))},
                  "body": {"scale": kf((0, [1, 1, 1]), (0.15, [1.05, 0.92, 1]), (0.4, [1, 1, 1]))}}),
    cast=(1.2, {"body": {"scale": kf((0, [1, 1, 1]), (0.4, [1.25, 1.25, 1.2]), (0.6, [1.25, 1.25, 1.2]), (1.0, [1, 1, 1]))},
                "tongue": {"scale": kf((0, [1, 1, 1]), (0.6, [1, 1, 18]), (0.75, [1, 1, 18]), (1.0, [1, 1, 1]))},
                "head": {"rotation": kf((0, [0, 0, 0]), (0.4, [-20, 0, 0]), (1.0, [0, 0, 0]))}}),
    pose={"head": [-20, 0, 0]}, pose_scale={"body": [1.2, 1.2, 1.15]},                                            # croak
    guard={"root": Pz(0, -0.5, 0), "head": R(8), "leg_bl": R(20), "leg_br": R(20)},
)
S["elephant"] = dict(
    stride=16, walk=(pace, dict(amp=22)), walk_f=1.0, run=(pace, dict(amp=30)), run_f=1.7,
    secondary={"ear_l": R(0, f"math.sin({T} * 80) * 14", 0), "ear_r": R(0, f"-math.sin({T} * 80) * 14", 0),
               "trunk0": R(f"math.sin({T} * 60) * 6", 0, f"math.sin({T} * 45) * 4"), "trunk1": R(f"math.sin({T} * 60 - 30) * 8"),
               "trunk2": R(f"math.sin({T} * 60 - 60) * 10"), "trunk3": R(f"-15 + math.sin({T} * 60 - 90) * 12"),
               "tail": R(0, f"math.sin({T} * 110) * 15", 0)},
    idle={"head": R(f"math.sin({T} * 30) * 3"), "body": Pz(0, f"math.sin({T} * 60) * 0.2", 0)},
    attack=(1.0, {"body": {"rotation": kf((0, [0, 0, 0]), (0.35, [-18, 0, 0]), (0.6, [6, 0, 0]), (1.0, [0, 0, 0]))},
                  "leg_fl": {"rotation": kf((0, [0, 0, 0]), (0.35, [-45, 0, 0]), (0.6, [0, 0, 0]))},
                  "leg_fr": {"rotation": kf((0, [0, 0, 0]), (0.35, [-45, 0, 0]), (0.6, [0, 0, 0]))},
                  "trunk0": {"rotation": kf((0, [0, 0, 0]), (0.35, [-60, 0, 0]), (0.6, [40, 0, 0]), (1.0, [0, 0, 0]))},
                  "trunk1": {"rotation": kf((0, [0, 0, 0]), (0.35, [-30, 0, 0]), (0.6, [25, 0, 0]), (1.0, [0, 0, 0]))},
                  "trunk2": {"rotation": kf((0, [0, 0, 0]), (0.35, [-20, 0, 0]), (0.6, [15, 0, 0]), (1.0, [0, 0, 0]))},
                  "head": {"rotation": kf((0, [0, 0, 0]), (0.35, [-15, 0, 0]), (0.6, [10, 0, 0]), (1.0, [0, 0, 0]))},
                  "root": {"position": kf((0, [0, 0, 0]), (0.6, [0, -0.6, 0]), (1.0, [0, 0, 0]))}}),
    pose={"trunk0": [-70, 0, 0], "trunk1": [-45, 0, 0], "trunk2": [-30, 0, 0], "trunk3": [-20, 0, 0], "head": [-15, 0, 0],
          "ear_l": [0, 40, 0], "ear_r": [0, -40, 0]},                                                                # trumpet / water jet
    guard={"ear_l": R(0, 30, 0), "ear_r": R(0, -30, 0), "head": R(10), "trunk0": R(10), "trunk1": R(15), "root": Pz(0, -0.3, 0)},
)
S["rabbit"] = dict(
    stride=60, walk=(hop, dict(back=70, front=30, height=1.6, pitch=10, ears=25)), walk_f=1.6,
    run=(hop, dict(back=80, front=35, height=2.5, pitch=12, ears=35)), run_f=2.6,
    secondary={"ear_l": R(f"math.sin({T} * 150) * 5", 0, f"math.mod({T}, 7) < 1.5 ? -25 : 0"), "ear_r": R(f"math.sin({T} * 150 + 60) * 5"),
               "head": R(f"math.sin({T} * 1400) * 1.2"), "jaw": R(f"math.abs(math.sin({T} * 900)) * 6")},
    idle={"body": R(f"math.sin({T} * 50) * 2")},
    attack=(0.6, {"body": {"rotation": kf((0, [0, 0, 0]), (0.12, [30, 0, 0]), (0.45, [30, 0, 0]), (0.6, [0, 0, 0]))},
                  "leg_bl": {"rotation": kf((0, [0, 0, 0]), (0.15, [80, 0, 0]), (0.25, [10, 0, 0]), (0.35, [80, 0, 0]), (0.5, [0, 0, 0]))},
                  "leg_br": {"rotation": kf((0, [0, 0, 0]), (0.15, [80, 0, 0]), (0.25, [10, 0, 0]), (0.35, [80, 0, 0]), (0.5, [0, 0, 0]))},
                  "head": {"rotation": kf((0, [0, 0, 0]), (0.15, [-20, 0, 0]), (0.6, [0, 0, 0]))}}),
    cast=(1.0, {"leg_bl": {"rotation": kf((0, [0, 0, 0]), (0.1, [-30, 0, 0]), (0.2, [20, 0, 0]), (0.3, [-30, 0, 0]), (0.4, [20, 0, 0]), (0.6, [0, 0, 0]))},
                "leg_br": {"rotation": kf((0, [0, 0, 0]), (0.1, [-30, 0, 0]), (0.2, [20, 0, 0]), (0.3, [-30, 0, 0]), (0.4, [20, 0, 0]), (0.6, [0, 0, 0]))},
                "ear_l": {"rotation": kf((0, [0, 0, 0]), (0.2, [10, 0, -10]), (1.0, [0, 0, 0]))},
                "ear_r": {"rotation": kf((0, [0, 0, 0]), (0.2, [10, 0, 10]), (1.0, [0, 0, 0]))},
                "body": {"rotation": v3(f"math.sin({AT} * 1800) * 3", 0, f"math.sin({AT} * 1500) * 3")}}),
    pose={"ear_l": [10, 0, -10], "ear_r": [10, 0, 10], "head": [-15, 0, 0]}, pose_pos={"root": [0, 1.5, 0]},
    guard={"root": Pz(0, -0.3, 0), "head": R(5), "ear_l": R(5), "ear_r": R(5)},
)
S["deer"] = dict(
    stride=28, walk=(trot, dict(amp=38, bob=0.5, head=4, tail=6)), walk_f=1.5,
    run=(bound, dict(amp=55, bob=2.2, pitch=10)), run_f=2.4,
    secondary={"tail": R(f"math.mod({T}, 4) < 0.4 ? -40 : 0"), "body": Pz(0, f"math.sin({T} * 90) * 0.12", 0)},
    idle={"head": R(f"math.max(0, math.sin({T} * 22)) * 60"),
          "jaw": R(f"math.max(0, math.sin({T} * 22)) * math.abs(math.sin({T} * 500)) * 8")},                     # grazing + chewing
    attack=(0.8, {"head": {"rotation": kf((0, [0, 0, 0]), (0.25, [45, 0, 0]), (0.45, [45, 0, 0]), (0.8, [0, 0, 0]))},
                  "body": {"position": kf((0, [0, 0, 0]), (0.2, [0, 0, 1]), (0.4, [0, 0, -3]), (0.8, [0, 0, 0]))},
                  "leg_bl": {"rotation": kf((0, [0, 0, 0]), (0.4, [35, 0, 0]), (0.8, [0, 0, 0]))},
                  "leg_br": {"rotation": kf((0, [0, 0, 0]), (0.4, [35, 0, 0]), (0.8, [0, 0, 0]))}}),
    pose={"head": [-30, 0, 0], "leg_fr": [-50, 0, 0], "body": [-6, 0, 0]},                                          # healing pose
    guard={"head": R(25), "root": Pz(0, -0.4, 0), "leg_fl": R(-10)},
)
S["bull"] = dict(
    stride=24, walk=(trot, dict(amp=28, bob=0.35, head=4, tail=8, roll=2)), walk_f=1.3,
    run=(bound, dict(amp=45, bob=1.0, pitch=5, headx=25)), run_f=2.4,
    secondary={"tail": R(0, f"math.sin({T} * 160) * 20", 0),
               "head": R(0, f"math.mod({T}, 3.5) < 0.35 ? math.sin({T} * 2000) * 6 : 0", 0),
               "body": Pz(0, f"math.sin({T} * 80) * 0.18", 0)},
    idle={"leg_fr": R(f"math.mod({T}, 6) < 1.2 ? math.sin({T} * 600) * 25 : 0"), "head": R(6)},             # paws the ground
    attack=(0.7, {"head": {"rotation": kf((0, [0, 0, 0]), (0.2, [30, 0, 0]), (0.4, [-35, 0, 0]), (0.7, [0, 0, 0]))},
                  "body": {"position": kf((0, [0, 0, 0]), (0.25, [0, 0, -2.5]), (0.7, [0, 0, 0]))},
                  "root": {"position": kf((0, [0, 0, 0]), (0.4, [0, 0.6, 0]), (0.7, [0, 0, 0]))},
                  "leg_fl": {"rotation": kf((0, [0, 0, 0]), (0.35, [-30, 0, 0]), (0.7, [0, 0, 0]))},
                  "leg_fr": {"rotation": kf((0, [0, 0, 0]), (0.35, [-30, 0, 0]), (0.7, [0, 0, 0]))}}),
    cast=(1.4, {"leg_fr": {"rotation": kf((0, [0, 0, 0]), (0.15, [-35, 0, 0]), (0.35, [25, 0, 0]), (0.55, [-35, 0, 0]), (0.75, [25, 0, 0]), (1.0, [0, 0, 0]))},
                "head": {"rotation": kf((0, [0, 0, 0]), (0.3, [20, 0, 0]), (1.2, [20, 0, 0]), (1.4, [0, 0, 0]))},
                "tail": {"rotation": kf((0, [0, 0, 0]), (0.3, [-40, 0, 0]), (1.4, [0, 0, 0]))}}),
    pose={"head": [-30, 0, 0], "tail": [-40, 0, 0]},
    guard={"head": R(25), "root": Pz(0, -0.5, 0), "tail": R(-20)},
)
S["tiger"] = dict(
    stride=26, walk=(trot, dict(amp=30, bob=0.2, head=1, tail=6, low=-0.8, roll=3, headx=8)), walk_f=1.4,
    run=(bound, dict(amp=55, bob=1.2, pitch=9)), run_f=2.8,
    secondary={"tail": R(f"-5 + math.sin({T} * 35) * 6", f"math.sin({T} * 55) * 18", 0), "body": Pz(0, f"math.sin({T} * 60) * 0.15", 0)},
    idle={"head": R(0, f"math.sin({T} * 20) * 15", 0),
          "jaw": R(f"math.mod({T}, 9) < 1.0 ? math.sin(math.mod({T}, 9) * 180) * 30 : 0")},                     # yawns
    attack=(0.7, {"root": {"position": kf((0, [0, 0, 0]), (0.2, [0, 2, 0]), (0.35, [0, 0, 0]))},
                  "body": {"position": kf((0, [0, 0, 0]), (0.25, [0, 0, -3]), (0.7, [0, 0, 0])),
                           "rotation": kf((0, [0, 0, 0]), (0.2, [-20, 0, 0]), (0.35, [5, 0, 0]), (0.7, [0, 0, 0]))},
                  "leg_fl": {"rotation": kf((0, [0, 0, 0]), (0.2, [-100, 0, 0]), (0.35, [-40, 0, 0]), (0.5, [-90, 0, 0]), (0.7, [0, 0, 0]))},
                  "leg_fr": {"rotation": kf((0, [0, 0, 0]), (0.25, [-90, 0, 0]), (0.4, [-100, 0, 0]), (0.55, [-30, 0, 0]), (0.7, [0, 0, 0]))},
                  "jaw": {"rotation": kf((0, [0, 0, 0]), (0.3, [30, 0, 0]), (0.6, [0, 0, 0]))}}),
    pose={"head": [-20, 0, 0], "jaw": [38, 0, 0], "tail": [-30, 0, 0]}, pose_pos={"root": [0, -0.8, 0]},          # roar
    guard={"root": Pz(0, -1.2, 0), "head": R(12), "tail": R(0, f"math.sin({AT} * 600) * 8", 0)},
)
S["lion"] = dict(
    stride=26, walk=(trot, dict(amp=30, bob=0.35, head=2, tail=10, roll=1.5, headx=-5)), walk_f=1.3,
    run=(bound, dict(amp=50, bob=1.2, pitch=8)), run_f=2.6,
    secondary={"tail": R(0, f"math.sin({T} * 50) * 14", 0), "body": Pz(0, f"math.sin({T} * 60) * 0.15", 0),
               "head": R(0, 0, f"math.mod({T}, 8) < 0.6 ? math.sin({T} * 1500) * 8 : 0")},                     # mane shake
    idle={"head": R(-6, f"math.sin({T} * 18) * 12", 0)},
    attack=(0.8, {"body": {"rotation": kf((0, [0, 0, 0]), (0.25, [-22, 0, 0]), (0.45, [5, 0, 0]), (0.8, [0, 0, 0]))},
                  "leg_fr": {"rotation": kf((0, [0, 0, 0]), (0.25, [-110, 0, 0]), (0.45, [-30, 0, 0]), (0.8, [0, 0, 0]))},
                  "head": {"rotation": kf((0, [0, 0, 0]), (0.25, [-10, 0, 0]), (0.45, [25, 0, 0]), (0.8, [0, 0, 0]))},
                  "jaw": {"rotation": kf((0, [0, 0, 0]), (0.3, [35, 0, 0]), (0.5, [0, 0, 0]))}}),
    pose={"head": [-28, 0, 0], "jaw": [40, 0, 0], "body": [-8, 0, 0], "leg_fl": [-10, 0, 0], "leg_fr": [-10, 0, 0]},   # roar
    guard={"head": R(10), "root": Pz(0, -0.6, 0), "tail": R(-15)},
)
S["dragon"] = dict(
    stride=18, walk=(dragon_walk, {}), walk_f=1.2, run=(dragon_run, {}), run_f=2.2,
    secondary=dict({n: R(0, f"math.sin({T} * 60 - {i * 40}) * 10", 0) for i, n in enumerate(("tail", "tail1", "tail2", "tail3"))},
                   body={"scale": [1, f"1 + math.sin({T} * 70) * 0.02", 1]},
                   wing_l=R(0, 0, f"-6 + math.sin({T} * 50) * 5"), wing_r=R(0, 0, f"6 - math.sin({T} * 50) * 5"),
                   neck=R(0, f"math.sin({T} * 35) * 8", 0), dhead=R(f"math.sin({T} * 45) * 4"),
                   jaw=R(f"3 + math.sin({T} * 120) * 2")),
    idle={"root": Pz(0, f"math.sin({T} * 70) * 0.3", 0)},
    attack=(0.8, {"neck": {"rotation": kf((0, [0, 0, 0]), (0.2, [-20, 0, 0]), (0.4, [25, 0, 0]), (0.8, [0, 0, 0]))},
                  "dhead": {"rotation": kf((0, [0, 0, 0]), (0.2, [-15, 0, 0]), (0.4, [10, 0, 0]), (0.8, [0, 0, 0]))},
                  "jaw": {"rotation": kf((0, [0, 0, 0]), (0.2, [40, 0, 0]), (0.4, [0, 0, 0]))},
                  "tail": {"rotation": kf((0, [0, 0, 0]), (0.3, [0, 35, 0]), (0.55, [0, -35, 0]), (0.8, [0, 0, 0]))},
                  "tail1": {"rotation": kf((0, [0, 0, 0]), (0.35, [0, 30, 0]), (0.6, [0, -30, 0]), (0.8, [0, 0, 0]))}}),
    cast=(1.8, {"body": {"rotation": kf((0, [0, 0, 0]), (0.4, [-12, 0, 0]), (1.4, [-12, 0, 0]), (1.8, [0, 0, 0]))},
                "neck": {"rotation": kf((0, [0, 0, 0]), (0.4, [-25, 0, 0]), (0.6, [15, 0, 0]), (1.4, [15, 0, 0]), (1.8, [0, 0, 0]))},
                "dhead": {"rotation": kf((0, [0, 0, 0]), (0.4, [-20, 0, 0]), (0.6, [-5, 0, 0]), (1.4, [-5, 0, 0]), (1.8, [0, 0, 0]))},
                "jaw": {"rotation": kf((0, [0, 0, 0]), (0.4, [10, 0, 0]), (0.6, [38, 0, 0]), (1.4, [38, 0, 0]), (1.8, [0, 0, 0]))},
                "wing_l": {"rotation": kf((0, [0, 0, 0]), (0.4, [0, 0, -65]), (1.4, [0, 0, -65]), (1.8, [0, 0, 0]))},
                "wing_r": {"rotation": kf((0, [0, 0, 0]), (0.4, [0, 0, 65]), (1.4, [0, 0, 65]), (1.8, [0, 0, 0]))}}),
    pose={"wing_l": [0, 0, -75], "wing_r": [0, 0, 75], "neck": [-25, 0, 0], "jaw": [35, 0, 0]},
    guard={"wing_l": R(0, 0, -30), "wing_r": R(0, 0, 30), "neck": R(-10), "jaw": R(10), "root": Pz(0, -0.4, 0)},
)
S["colossus"] = dict(
    stride=14, walk=(stomp, dict(amp=20)), walk_f=0.9, run=(stomp, dict(amp=28)), run_f=1.5,
    secondary={"body": Pz(0, f"math.sin({T} * 45) * 0.4", 0), "arm_l": R(0, 0, f"-4 + math.sin({T} * 45) * 2"),
               "arm_r": R(0, 0, f"4 - math.sin({T} * 45) * 2"), "head": R(0, f"math.sin({T} * 15) * 10", 0)},
    idle={"body": R(f"math.sin({T} * 30) * 1.5")},
    attack=(1.1, {"arm_l": {"rotation": kf((0, [0, 0, 0]), (0.45, [-170, 0, 0]), (0.65, [-20, 0, 0]), (1.1, [0, 0, 0]))},
                  "arm_r": {"rotation": kf((0, [0, 0, 0]), (0.45, [-170, 0, 0]), (0.65, [-20, 0, 0]), (1.1, [0, 0, 0]))},
                  "body": {"rotation": kf((0, [0, 0, 0]), (0.45, [-12, 0, 0]), (0.65, [18, 0, 0]), (1.1, [0, 0, 0]))},
                  "root": {"position": kf((0, [0, 0, 0]), (0.45, [0, 0, 0]), (0.65, [0, -1.2, 0]), (1.1, [0, 0, 0]))},
                  "head": {"rotation": kf((0, [0, 0, 0]), (0.45, [-10, 0, 0]), (0.65, [15, 0, 0]), (1.1, [0, 0, 0]))}}),
    cast=(1.6, {"arm_l": {"rotation": kf((0, [0, 0, 0]), (0.4, [0, 0, -75]), (1.2, [0, 0, -75]), (1.6, [0, 0, 0]))},
                "arm_r": {"rotation": kf((0, [0, 0, 0]), (0.4, [0, 0, 75]), (1.2, [0, 0, 75]), (1.6, [0, 0, 0]))},
                "head": {"rotation": kf((0, [0, 0, 0]), (0.4, [-25, 0, 0]), (1.2, [-25, 0, 0]), (1.6, [0, 0, 0]))},
                "body": {"scale": kf((0, [1, 1, 1]), (0.5, [1.06, 1.06, 1.06]), (0.8, [1, 1, 1]), (1.1, [1.06, 1.06, 1.06]), (1.4, [1, 1, 1]))}}),
    pose={"arm_l": [0, 0, -75], "arm_r": [0, 0, 75], "head": [-25, 0, 0]},
    guard={"arm_l": R(-40, 0, -10), "arm_r": R(-40, 0, 10), "root": Pz(0, -1, 0), "head": R(8)},
)


# Divine Dogs: the white one shares the black one's moves; Totality is heavier and fiercer
S["dog_white"] = dict(S["wolf"])
S["totality"] = dict(S["wolf"], stride=28, walk=(trot, dict(amp=30, bob=0.3, head=2, tail=8)), walk_f=1.5,
                     run=(bound, dict(amp=48, bob=1.5, pitch=8)), run_f=2.4,
                     pose={"head": [-50, 0, 0], "jaw": [34, 0, 0], "body": [-16, 0, 0]},
                     guard={"root": Pz(0, -0.9, 0), "head": R(14), "tail": R(-30), "jaw": R(14), "leg_fl": R(-10), "leg_fr": R(-10)})
# Mahoraga: the wheel turns 45° per adaptation step (property synced from the server)
S["colossus"]["secondary"] = dict(S["colossus"]["secondary"], wheel=R(0, "query.property('shadowbound:adapt') * 45", 0))


def cast_from_pose(sp, length=1.4):
    d = S[sp]
    bones = {}
    for bone, rot in d["pose"].items():
        bones.setdefault(bone, {})["rotation"] = kf((0, [0, 0, 0]), (0.3, rot), (length - 0.3, rot), (length, [0, 0, 0]))
    for bone, pos in d.get("pose_pos", {}).items():
        bones.setdefault(bone, {})["position"] = kf((0, [0, 0, 0]), (0.3, pos), (length - 0.3, pos), (length, [0, 0, 0]))
    for bone, sc in d.get("pose_scale", {}).items():
        bones.setdefault(bone, {})["scale"] = kf((0, [1, 1, 1]), (0.3, sc), (length - 0.3, sc), (length, [1, 1, 1]))
    return (length, bones)


def summon(sp):
    """Rises out of the shadow pool, then its own flourish (howl, roar, wings, trumpet...)."""
    d = S[sp]
    bones = {"root": {"position": kf((0, [0, -45, 0]), (1.0, [0, 2, 0]), (1.3, [0, 0, 0])),
                      "scale": kf((0, [0.6, 0.6, 0.6]), (1.0, [1.08, 1.08, 1.08]), (1.4, [1, 1, 1]))}}
    for bone, rot in d["pose"].items():
        bones.setdefault(bone, {})["rotation"] = kf((0, [0, 0, 0]), (1.05, [0, 0, 0]), (1.35, rot), (1.65, rot), (2.0, [0, 0, 0]))
    for bone, pos in d.get("pose_pos", {}).items():
        if bone == "root":
            continue
        bones.setdefault(bone, {})["position"] = kf((0, [0, 0, 0]), (1.05, [0, 0, 0]), (1.35, pos), (1.65, pos), (2.0, [0, 0, 0]))
    for bone, sc in d.get("pose_scale", {}).items():
        bones.setdefault(bone, {})["scale"] = kf((0, [1, 1, 1]), (1.05, [1, 1, 1]), (1.35, sc), (1.65, sc), (2.0, [1, 1, 1]))
    return {"loop": "hold_on_last_frame", "animation_length": 2.0, "bones": bones}


for sp in BEASTS:
    d = S[sp]
    pre = f"animation.shadowbound_beast.{sp}"
    wfn, wkw = d["walk"]
    rfn, rkw = d["run"]
    B[f"{pre}.secondary"] = {"loop": True, "bones": merge(d["secondary"], BLINK)}
    B[f"{pre}.idle"] = {"loop": True, "bones": d["idle"]}
    B[f"{pre}.move"] = {"loop": True, "bones": wfn(f"query.modified_distance_moved * {d['stride']}", SPD, **wkw)}
    B[f"{pre}.walk"] = {"loop": True, "bones": wfn(f"{AT} * 360 * {d['walk_f']}", 1, **wkw)}
    B[f"{pre}.run"] = {"loop": True, "bones": rfn(f"{AT} * 360 * {d['run_f']}", 1, **rkw)}
    length, bones = d["attack"]
    B[f"{pre}.attack"] = {"loop": True, "animation_length": length, "bones": bones}
    length, bones = d.get("cast") or cast_from_pose(sp)
    B[f"{pre}.cast"] = {"loop": True, "animation_length": length, "bones": bones}
    B[f"{pre}.guard"] = {"loop": True, "bones": d["guard"]}
    B[f"{pre}.summon"] = summon(sp)

B["animation.shadowbound_beast.look_at"] = {"loop": True, "bones": {
    "head": {"rotation": v3("query.target_x_rotation * 0.6", "query.target_y_rotation * 0.7", 0)},
    "dhead": {"rotation": v3("query.target_x_rotation * 0.5", "query.target_y_rotation * 0.6", 0)},
}}
B["animation.shadowbound_beast.despawn"] = {"loop": "hold_on_last_frame", "animation_length": 1.0, "bones": {
    "root": {"position": {"0.0": v3(0, 0, 0), "1.0": v3(0, -45, 0)}, "scale": {"0.0": v3(1, 1, 1), "1.0": v3(0.5, 0.5, 0.5)}},
}}

# ---- controller: "start" routes to the species' own state machine ----------------------
BSTATES = ["walk", "run", "attack", "cast", "guard", "summon", "despawn"]
bctrl = {"start": {"transitions": [{f"{sp}_default": f"{SPECIES} == {i}"} for i, sp in enumerate(BEASTS)]}}
for i, sp in enumerate(BEASTS):
    other = {"start": f"{SPECIES} != {i}"}
    sec = f"{sp}_secondary"
    mv = {f"{sp}_move": f"{SPD} > 0.03"}
    bctrl[f"{sp}_default"] = {
        "animations": [sec, f"{sp}_idle", mv],
        "transitions": [other] + [{f"{sp}_{s}": f"{P} == {STATES[s]}"} for s in BSTATES],
        "blend_transition": 0.25,
    }
    for s in BSTATES:
        rest = [o for o in BSTATES if o != s]
        tr = [other, {f"{sp}_default": " && ".join(f"{P} != {STATES[o]}" for o in BSTATES)}] + [{f"{sp}_{o}": f"{P} == {STATES[o]}"} for o in rest]
        anims = [sec, "despawn" if s == "despawn" else f"{sp}_{s}"]
        if s == "guard":
            anims.append(mv)
        bctrl[f"{sp}_{s}"] = {"animations": anims, "transitions": tr, "blend_transition": 0.2}


def short(full):
    parts = full.split(".")
    return parts[-1] if parts[-2] == "shadowbound_beast" else f"{parts[-2]}_{parts[-1]}"


banims = {"format_version": "1.8.0", "animations": B}
bcontrollers = {"format_version": "1.10.0", "animation_controllers": {"controller.animation.shadowbound_beast.main": {"initial_state": "start", "states": bctrl}}}
brender = {"format_version": "1.10.0", "render_controllers": {"controller.render.shadowbound.beast": {
    "arrays": {
        "textures": {"Array.skins": [f"Texture.{b}" for b in BEASTS]},
        "geometries": {"Array.geos": [f"Geometry.{b}" for b in BEASTS]},
    },
    "geometry": "Array.geos[query.property('shadowbound:species')]",
    "materials": [{"*": "Material.default"}, {"glow_eyes*": "Material.glow"}],
    "textures": ["Array.skins[query.property('shadowbound:species')]"],
    "is_hurt_color": {},
    "on_fire_color": {},
}}}
bclient = {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "shadowbound:beast",
    "materials": {"default": "entity_alphatest", "glow": "entity_emissive_alpha"},
    "textures": {b: f"textures/entity/shadowbound/beast_{b}" for b in BEASTS},
    "geometry": {b: f"geometry.shadowbound.beast_{b}" for b in BEASTS},
    "animations": dict({short(k): k for k in B}, main="controller.animation.shadowbound_beast.main"),
    "scripts": {"animate": ["main", "look_at"]},
    "render_controllers": ["controller.render.shadowbound.beast"],
    "enable_attachables": False,
}}}
for path, data in (
    ("animations/shadowbound_beast.animation.json", banims),
    ("animation_controllers/shadowbound_beast.animation_controllers.json", bcontrollers),
    ("render_controllers/shadowbound_beast.render_controllers.json", brender),
    ("entity/shadowbound_beast.entity.json", bclient),
):
    with open(os.path.join(RP, path), "w") as f:
        json.dump(data, f, indent=2)
print("beast animations generated:", len(B), "(", len(B) // len(BEASTS), "per species )")
