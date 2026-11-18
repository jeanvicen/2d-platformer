"""LEGION: the ten summonable creatures.

Each creature has its own rig (bones that follow its anatomy), its own baked
texture and its own animation set. Shared *technical* pieces (phase
controller, manifest/recall timing, look-at) are reused; motion itself is
authored per species.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..anim import anim, bone, keys, osc, smooth_keys, walk
from ..geom import Model, Paint
from ..palette import *  # noqa: F401,F403


@dataclass
class Creature:
    key: str
    name: str
    title: str
    desc: str
    special: str
    flying: bool
    collision: tuple
    health: int
    damage: int
    speed: float
    model: Model
    anims: dict
    fidgets: list = field(default_factory=list)  # extra idle variants (anim keys)
    fly_speed: float = 0.0
    sounds: dict = field(default_factory=dict)
    scale: float = 1.0
    knockback_resist: float = 0.0
    family: list = field(default_factory=list)
    emoji: str = "✦"
    group: int = 1                 # how many spawn per summon (Corvus flock)
    aquatic: bool = False


def P(mat, color, color2=None, **kw):
    params = kw.pop("params", {})
    decals = kw.pop("decals", [])
    glow = kw.pop("glow", False)
    seed = kw.pop("seed", hash((mat, color)) & 0xFFFF)
    params.update(kw)
    return Paint(mat=mat, color=color, color2=color2, glow=glow, seed=seed, params=params, decals=decals)


def phase_anims(k, rise=1.2):
    """Manifest from the shadow / sink back into it (every creature)."""
    a = {}
    a["manifest"] = anim(f"animation.eclipse.{k}.manifest", {
        "root": bone(
            scale=keys([(0.0, [0.2, 0.0, 0.2]), (rise * 0.45, [0.9, 1.15, 0.9]), (rise * 0.75, [1.05, 0.95, 1.05]), (rise, [1, 1, 1])]),
            pos=keys([(0.0, [0, -6, 0]), (rise * 0.6, [0, 0.6, 0]), (rise, [0, 0, 0])]),
            rot=keys([(0.0, [0, -90, 0]), (rise, [0, 0, 0])]),
        )
    }, loop="hold", length=rise, particles=[{"effect": "manifest", "locator": "ground"}],
        sounds=[{"effect": "manifest"}])
    a["recall"] = anim(f"animation.eclipse.{k}.recall", {
        "root": bone(
            scale=keys([(0.0, [1, 1, 1]), (0.25, [1.08, 0.9, 1.08]), (0.9, [0.15, 0.0, 0.15])]),
            pos=keys([(0.0, [0, 0, 0]), (0.9, [0, -7, 0])]),
            rot=keys([(0.0, [0, 0, 0]), (0.9, [0, 120, 0])]),
        )
    }, loop="hold", length=0.9, particles=[{"effect": "recall", "locator": "ground"}], sounds=[{"effect": "recall"}])
    return a


def look(k, head="head", yaw_clamp=55, pitch_clamp=35):
    return anim(f"animation.eclipse.{k}.look", {
        head: bone(rot=[f"math.clamp(q.target_x_rotation, -{pitch_clamp}, {pitch_clamp})",
                        f"math.clamp(q.target_y_rotation, -{yaw_clamp}, {yaw_clamp})", 0])
    })


# =========================================================================
# 1. UMBRA — Lobo das Sombras
# =========================================================================
def umbra():
    m = Model("geometry.eclipse.umbra", 64, 64, density=4, bounds=(3, 2.5, (0, 1, 0)))
    fur = P("fur", CHAR, SMOKE, flow="z")
    fur_dark = P("fur", VOID, CHAR2, flow="z")
    ruff = P("fur", CHAR2, ASH, flow="y", grain=1.3)
    crystal = P("crystal", VIOLET_DEEP, VIOLET_HI)
    claw = P("bone", (60, 52, 74))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"ground": (0, 0.2, 0), "aura": (0, 14, 0)}
    body = m.bone("body", "root", pivot=(0, 12, 0))
    body.box((0, 12.5, -3), (8.5, 8.5, 9), fur)
    body.box((0, 12, 5), (7.2, 7.2, 8), fur)
    body.box((0, 9.2, 4.5), (6.2, 1.6, 7), fur_dark)
    body.box((0, 13.5, -6.5), (10, 9.5, 4.5), ruff)
    for i, z in enumerate((-4, -1, 2, 5)):
        body.box((0, 17.2 - i * 0.25, z), (1.1, 2.2 - i * 0.3, 1.6), crystal, rotation=(-25, 0, 0), pivot=(0, 16.5, z))
    neck = m.bone("neck", "body", pivot=(0, 14.5, -7.5))
    neck.box((0, 15.5, -9.2), (6, 6, 5), ruff, rotation=(-18, 0, 0), pivot=(0, 15, -8))
    head = m.bone("head", "neck", pivot=(0, 16.5, -11))
    head.locators = {"mouth": (0, 15, -19), "eyes": (0, 17.5, -15)}
    eyes = [("north", "eyes", {"t": 2.3, "sep": 1.75, "r": 0.75, "ry": 0.45})]
    head.box((0, 17, -13), (7, 6, 6), P("fur", CHAR, SMOKE, flow="z", decals=eyes))
    head.box((0, 15.6, -17.4), (3.8, 3.2, 4.6), fur)
    head.box((0, 16.6, -19.8), (1.8, 1.2, 0.5), P("matte", VOID))
    for sx in (-1, 1):
        head.box((sx * 2.3, 21.0, -12.5), (1.8, 3.4, 1.4), fur_dark, rotation=(0, 0, sx * -12), pivot=(sx * 2.3, 19.5, -12.5))
        head.box((sx * 3.9, 16.5, -12.0), (1.2, 3.5, 3.5), ruff)
    jaw = m.bone("jaw", "head", pivot=(0, 14.6, -14.5))
    jaw.box((0, 14.0, -17.2), (3.4, 1.2, 4.6), P("fur", VOID, CHAR2, decals=[("up", "teeth", {"t": 0.5})]))
    for side, sx in (("l", 1), ("r", -1)):
        fl = m.bone(f"leg_f{side}", "body", pivot=(sx * 3.0, 12, -5))
        fl.box((sx * 3.0, 9.5, -5), (2.8, 7, 3), fur)
        fl.box((sx * 3.0, 3.4, -5.4), (2.4, 5.6, 2.4), fur_dark)
        fl.box((sx * 3.0, 0.75, -6.1), (2.9, 1.5, 3.4), fur_dark)
        fl.box((sx * 3.0, 0.4, -8.0), (2.2, 0.8, 0.6), claw)
        bl = m.bone(f"leg_b{side}", "body", pivot=(sx * 3.0, 12, 6.5))
        bl.box((sx * 3.0, 9.6, 6.8), (3.2, 6.6, 4.2), fur)
        bl.box((sx * 3.0, 4.0, 8.0), (2.4, 5.2, 2.4), fur_dark, rotation=(-12, 0, 0), pivot=(sx * 3, 6.5, 8))
        bl.box((sx * 3.0, 0.75, 7.6), (2.9, 1.5, 3.4), fur_dark)
    tail = m.bone("tail", "body", pivot=(0, 14.5, 8.5), rotation=(-28, 0, 0))
    tail.box((0, 14.5, 11.5), (2.6, 2.6, 6), fur)
    tail2 = m.bone("tail2", "tail", pivot=(0, 14.5, 14.2), rotation=(12, 0, 0))
    tail2.box((0, 14.5, 17.0), (2.2, 2.2, 5.6), P("fur", CHAR2, VIOLET_HI, flow="z"))
    tail2.box((0, 14.5, 20.2), (1.2, 1.2, 1.2), crystal)

    k = "umbra"
    A = {}
    A.update(phase_anims(k))
    A["look"] = look(k)
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {
        "body": bone(scale=[1, osc(0.015, 120, base=1.0), 1]),
        "tail": bone(rot=[osc(4, 90, base=0), osc(12, 140), 0]),
        "tail2": bone(rot=[osc(6, 90, 40), osc(10, 140, 60), 0]),
        "jaw": bone(rot=[osc(2, 120, base=2), 0, 0]),
    })
    A["walk"] = anim(f"animation.eclipse.{k}.walk", {
        "leg_fl": bone(rot=[walk(38), 0, 0]),
        "leg_fr": bone(rot=[walk(38, phase=180), 0, 0]),
        "leg_bl": bone(rot=[walk(34, phase=180), 0, 0]),
        "leg_br": bone(rot=[walk(34), 0, 0]),
        "body": bone(pos=[0, walk(0.4, freq=76.34), 0], rot=[0, 0, walk(2.0)]),
        "neck": bone(rot=[walk(4, freq=76.34), 0, 0]),
        "tail": bone(rot=[0, walk(14), 0]),
    })
    A["run"] = anim(f"animation.eclipse.{k}.run", {
        "leg_fl": bone(rot=[walk(62, freq=30), 0, 0]),
        "leg_fr": bone(rot=[walk(62, freq=30, phase=40), 0, 0]),
        "leg_bl": bone(rot=[walk(58, freq=30, phase=180), 0, 0]),
        "leg_br": bone(rot=[walk(58, freq=30, phase=220), 0, 0]),
        "body": bone(rot=[walk(7, freq=30, phase=90), 0, 0], pos=[0, walk(1.0, freq=60), 0]),
        "neck": bone(rot=[walk(-8, freq=30, phase=90, base=8), 0, 0]),
        "tail": bone(rot=[-25, walk(8, freq=30), 0]),
        "jaw": bone(rot=[12, 0, 0]),
    })
    A["sit"] = anim(f"animation.eclipse.{k}.sit", {
        "body": bone(rot=[-22, 0, 0], pos=[0, -2.6, 2]),
        "leg_bl": bone(rot=[-68, 0, 0], pos=[0, -1.6, -1.6]),
        "leg_br": bone(rot=[-68, 0, 0], pos=[0, -1.6, -1.6]),
        "leg_fl": bone(rot=[22, 0, 0], pos=[0, 0, 0]),
        "leg_fr": bone(rot=[22, 0, 0], pos=[0, 0, 0]),
        "neck": bone(rot=[18, 0, 0]),
        "tail": bone(rot=[-45, osc(10, 120), 0]),
    })
    A["sniff"] = anim(f"animation.eclipse.{k}.sniff", {
        "neck": bone(rot=keys([(0, [0, 0, 0]), (0.4, [32, 10, 0]), (0.8, [36, -14, 0]), (1.2, [30, 6, 0]), (1.8, [0, 0, 0])])),
        "head": bone(rot=[osc(4, 900), 0, 0]),
    }, loop=False, length=1.8)
    A["howl"] = anim(f"animation.eclipse.{k}.howl", {
        "neck": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-55, 0, 0]), (2.2, [-58, 0, 0]), (2.8, [0, 0, 0])])),
        "jaw": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [22, 0, 0]), (2.2, [24, 0, 0]), (2.8, [0, 0, 0])])),
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-8, 0, 0]), (2.4, [-8, 0, 0]), (2.8, [0, 0, 0])])),
    }, loop=False, length=2.8, sounds=[{"effect": "special"}])
    A["special"] = A["howl"]
    A["interact"] = anim(f"animation.eclipse.{k}.interact", {
        "tail": bone(rot=[-20, osc(35, 900), 0]),
        "tail2": bone(rot=[0, osc(25, 900, 60), 0]),
        "body": bone(rot=keys([(0, [0, 0, 0]), (0.3, [10, 0, 0]), (0.9, [10, 0, 0]), (1.3, [0, 0, 0])])),
        "leg_fl": bone(rot=keys([(0, [0, 0, 0]), (0.3, [-30, 0, 0]), (0.9, [-30, 0, 0]), (1.3, [0, 0, 0])])),
        "leg_fr": bone(rot=keys([(0, [0, 0, 0]), (0.3, [-30, 0, 0]), (0.9, [-30, 0, 0]), (1.3, [0, 0, 0])])),
    }, loop=False, length=1.3)
    return Creature("umbra", "Umbra", "Lobo das Sombras",
                    "Lobo colossal de pelagem de fumaça. Fareja ameaças, uiva para marcar território e luta ao seu lado.",
                    "Uivo da Lua Negra: enfraquece monstros próximos.",
                    False, (0.9, 1.25), 40, 7, 0.32, m, A, fidgets=["sniff"],
                    sounds={"ambient": "mob.wolf.growl", "hurt": "mob.wolf.hurt", "death": "mob.wolf.death", "step": "mob.wolf.step"},
                    family=["canine"], emoji="🐺")
