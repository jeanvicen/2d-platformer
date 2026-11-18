"""LYRA — a Sombra Viva. Humanoid companion with a full action animation set
(walk/run/chop/mine/build/eat/attack/cast/float/wave/sit/carry)."""
from __future__ import annotations

from ..anim import anim, bone, keys, osc, smooth_keys, walk
from ..geom import Model
from ..palette import *  # noqa: F401,F403
from .creatures import P, look, phase_anims

ACTIONS = ["idle", "walk", "run", "chop", "mine", "build", "eat", "attack", "cast", "sit", "wave", "float", "carry", "dig"]


def lyra_model():
    m = Model("geometry.eclipse.lyra", 64, 64, density=8, bounds=(2.5, 2.6, (0, 1.2, 0)))
    skin = P("skin", (226, 210, 228))
    hair = P("hair", (26, 18, 40), (150, 100, 230), shine_y=28.5)
    cloak = P("cloth", (30, 22, 52), (96, 64, 170))
    dress = P("cloth", (44, 30, 78), (140, 96, 220))
    trim = P("metal", (120, 110, 150), (220, 210, 240))
    boots = P("leather", (36, 26, 40))
    glow = P("glow", VIOLET, VIOLET_HI)
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0), "hands": (0, 14, -4)}
    waist = m.bone("waist", "root", pivot=(0, 11, 0))
    body = m.bone("body", "waist", pivot=(0, 11, 0))
    body.box((0, 16.0, 0), (6.4, 9.5, 3.4), P("cloth", (44, 30, 78), (140, 96, 220),
                                             decals=[("north", "line", {"axis": "t", "pos": 3.2, "w": 0.18, "color": (190, 130, 255)}),
                                                     ("north", "gem", {"t": 2.2, "r": 0.55, "color": (190, 110, 255)})]))
    body.box((0, 12.0, 0), (6.8, 1.2, 3.8), trim)
    body.box((0, 19.9, 0), (7.0, 1.6, 3.9), P("cloth", (30, 22, 52), (96, 64, 170)))
    skirt = m.bone("skirt", "waist", pivot=(0, 11.5, 0))
    skirt.box((0, 9.4, 0), (7.4, 4.2, 4.4), dress)
    skirt.box((0, 6.6, 0), (8.4, 2.4, 5.2), P("cloth", (30, 22, 52), (120, 80, 200),
                                             decals=[("sides", "line", {"axis": "s", "pos": 2.0, "w": 0.15, "color": (180, 120, 255)})]))
    head = m.bone("head", "body", pivot=(0, 21, 0))
    head.locators = {"eyes": (0, 25, -4)}
    face = [("north", "eyes", {"t": 3.6, "sep": 1.35, "r": 0.62, "ry": 0.78, "color": (176, 98, 255), "core": (255, 240, 255)}),
            ("north", "blush", {"t": 4.9, "r": 0.8}),
            ("north", "mouth", {"t": 5.8, "w": 1.1, "h": 0.12})]
    head.box((0, 25, 0), (7, 7.4, 7), P("skin", (226, 210, 228), decals=face))
    head.box((0, 28.3, 0.3), (7.6, 1.6, 7.6), hair)
    head.box((0, 25.5, 2.9), (7.6, 7.0, 2.2), hair)
    for sx in (-1, 1):
        head.box((sx * 3.6, 25.2, -0.3), (0.9, 6.4, 6.0), hair)
        head.box((sx * 2.4, 27.8, -3.4), (2.4, 2.0, 0.8), hair, rotation=(0, 0, sx * 12), pivot=(sx * 2.4, 28.5, -3.4))
    head.box((0, 28.4, -3.5), (2.0, 1.4, 0.7), hair)
    head.box((2.2, 29.6, -0.6), (1.4, 1.4, 1.4), glow, rotation=(0, 45, 0), pivot=(2.2, 29.6, -0.6))
    hb = m.bone("hair_back", "head", pivot=(0, 27, 3.6))
    hb.box((0, 19.5, 4.0), (6.8, 10, 1.6), hair)
    hb.box((0, 14.2, 4.0), (5.4, 2.6, 1.4), hair)
    hb.box((0, 13.2, 4.0), (1.0, 1.0, 1.0), glow)
    cape = m.bone("cape", "body", pivot=(0, 20.5, 2))
    cape.box((0, 13.6, 2.4), (7.6, 13.8, 0.6), P("cloth", (24, 18, 42), (90, 60, 160),
                                                 decals=[("south", "runes", {"cell": 1.6, "seed": 77, "margin": 1.6})]))
    for side, sx in (("l", 1), ("r", -1)):
        arm = m.bone(f"arm_{side}", "body", pivot=(sx * 4.2, 19.6, 0))
        arm.box((sx * 4.4, 19.6, 0), (2.9, 2.4, 3.1), cloak)
        arm.box((sx * 4.4, 16.3, 0), (2.4, 5.4, 2.4), P("cloth", (44, 30, 78), (140, 96, 220)))
        fore = m.bone(f"fore_{side}", f"arm_{side}", pivot=(sx * 4.4, 13.8, 0))
        fore.box((sx * 4.4, 12.4, 0), (2.5, 3.0, 2.5), trim)
        fore.box((sx * 4.4, 10.1, 0), (2.1, 1.8, 2.1), skin)
        leg = m.bone(f"leg_{side}", "waist", pivot=(sx * 1.6, 11, 0))
        leg.box((sx * 1.6, 7.5, 0), (2.6, 6.0, 2.6), P("cloth", (24, 18, 36), (60, 44, 90)))
        shin = m.bone(f"shin_{side}", f"leg_{side}", pivot=(sx * 1.6, 4.6, 0))
        shin.box((sx * 1.6, 2.6, 0), (2.7, 4.6, 2.8), boots)
        shin.box((sx * 1.6, 0.4, -0.4), (2.8, 0.8, 3.6), boots)
        shin.box((sx * 1.6, 4.8, 0), (2.9, 0.5, 3.0), trim)
    ri = m.bone("rightItem", "fore_r", pivot=(-4.4, 9.4, -1.0))
    li = m.bone("leftItem", "fore_l", pivot=(4.4, 9.4, -1.0))
    _ = (ri, li)
    return m


def lyra_anims():
    k = "lyra"
    A = dict(phase_anims(k, rise=1.4))
    A["look"] = look(k, yaw_clamp=60, pitch_clamp=40)
    sway = {
        "hair_back": bone(rot=[osc(3, 70, base=4), 0, osc(2, 50)]),
        "cape": bone(rot=[osc(3, 60, base=5), 0, osc(1.5, 45)]),
    }
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {
        **sway,
        "body": bone(scale=[1, osc(0.01, 110, base=1.0), 1], rot=[0, 0, osc(1.2, 30)]),
        "arm_l": bone(rot=[osc(2, 80), 0, osc(2, 80, base=-4)]),
        "arm_r": bone(rot=[osc(2, 80, 180), 0, osc(-2, 80, base=4)]),
        "skirt": bone(rot=[0, 0, osc(1.0, 30, 90)]),
    })
    legs = lambda amp, freq: {
        "leg_l": bone(rot=[walk(amp, freq=freq), 0, 0]),
        "leg_r": bone(rot=[walk(amp, freq=freq, phase=180), 0, 0]),
        "shin_l": bone(rot=[f"math.max(0, {walk(amp, freq=freq, phase=90)})", 0, 0]),
        "shin_r": bone(rot=[f"math.max(0, {walk(amp, freq=freq, phase=270)})", 0, 0]),
        "arm_l": bone(rot=[walk(-amp * 0.7, freq=freq), 0, -4]),
        "arm_r": bone(rot=[walk(amp * 0.7, freq=freq), 0, 4]),
        "skirt": bone(rot=[0, walk(5, freq=freq), 0]),
    }
    # Lyra is often moved by script (teleport-walk), so time-based gaits are used for scripted actions.
    tlegs = lambda amp, speed: {
        "leg_l": bone(rot=[osc(amp, speed), 0, 0]),
        "leg_r": bone(rot=[osc(amp, speed, 180), 0, 0]),
        "shin_l": bone(rot=[f"math.max(0, {osc(amp, speed, 90)})", 0, 0]),
        "shin_r": bone(rot=[f"math.max(0, {osc(amp, speed, 270)})", 0, 0]),
        "arm_l": bone(rot=[osc(-amp * 0.7, speed), 0, -4]),
        "arm_r": bone(rot=[osc(amp * 0.7, speed), 0, 4]),
        "skirt": bone(rot=[0, osc(5, speed), 0]),
        "body": bone(pos=[0, f"-math.abs({osc(0.4, speed)})", 0]),
    }
    A["walk"] = anim(f"animation.eclipse.{k}.walk", {**legs(36, 40), **sway, "cape": bone(rot=[12, 0, 0])})
    A["walk_scripted"] = anim(f"animation.eclipse.{k}.walk_scripted", {**tlegs(36, 360), **sway, "cape": bone(rot=[12, 0, 0])})
    A["run"] = anim(f"animation.eclipse.{k}.run", {**tlegs(60, 560), "body": bone(rot=[10, 0, 0]),
                                                  "cape": bone(rot=[34, 0, osc(4, 280)]), "hair_back": bone(rot=[26, 0, osc(3, 280)])})
    A["chop"] = anim(f"animation.eclipse.{k}.chop", {
        "arm_r": bone(rot=smooth_keys([(0, [-60, 0, 0]), (0.25, [-160, 20, 0]), (0.45, [-30, -10, 0]), (0.7, [-60, 0, 0])])),
        "arm_l": bone(rot=smooth_keys([(0, [-50, 0, 0]), (0.25, [-140, -20, 0]), (0.45, [-30, 10, 0]), (0.7, [-50, 0, 0])])),
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.25, [-8, 18, 0]), (0.45, [10, -12, 0]), (0.7, [0, 0, 0])])),
        **sway,
    }, loop=True, length=0.7)
    A["mine"] = anim(f"animation.eclipse.{k}.mine", {
        "arm_r": bone(rot=smooth_keys([(0, [-80, 0, 0]), (0.2, [-150, 0, 0]), (0.38, [-40, 0, 0]), (0.55, [-80, 0, 0])])),
        "body": bone(rot=smooth_keys([(0, [6, 0, 0]), (0.2, [-4, 0, 0]), (0.38, [14, 0, 0]), (0.55, [6, 0, 0])])),
        "head": bone(rot=[18, 0, 0]),
    }, loop=True, length=0.55)
    A["dig"] = A["mine"]
    A["build"] = anim(f"animation.eclipse.{k}.build", {
        "arm_r": bone(rot=smooth_keys([(0, [-40, 0, 10]), (0.2, [-95, 10, 0]), (0.35, [-80, -10, 0]), (0.5, [-40, 0, 10])])),
        "arm_l": bone(rot=[osc(10, 720, base=-35), 0, -10]),
        "head": bone(rot=[osc(6, 720, base=6), osc(10, 360), 0]),
        **sway,
    }, loop=True, length=0.5)
    A["float"] = anim(f"animation.eclipse.{k}.float", {
        "root": bone(pos=[0, osc(0.8, 120), 0]),
        "leg_l": bone(rot=[10, 0, -4]), "leg_r": bone(rot=[18, 0, 4]),
        "shin_l": bone(rot=[25, 0, 0]), "shin_r": bone(rot=[15, 0, 0]),
        "arm_l": bone(rot=[osc(8, 120, base=-20), 0, -28]), "arm_r": bone(rot=[osc(8, 120, 180, base=-60), 0, 20]),
        "skirt": bone(scale=[osc(0.05, 240, base=1.08), 1, osc(0.05, 240, base=1.08)]),
        "hair_back": bone(rot=[osc(8, 120, base=18), 0, osc(5, 90)]),
        "cape": bone(rot=[osc(10, 120, base=22), 0, osc(5, 90)]),
    })
    A["eat"] = anim(f"animation.eclipse.{k}.eat", {
        "arm_r": bone(rot=[osc(8, 900, base=-110), -30, 0]),
        "fore_r": bone(rot=[-30, 0, 0]),
        "head": bone(rot=[osc(6, 900, base=-6), 0, 0]),
    })
    A["attack"] = anim(f"animation.eclipse.{k}.attack", {
        "arm_r": bone(rot=smooth_keys([(0, [-20, 0, 0]), (0.15, [-150, -30, 0]), (0.3, [-20, 40, 0]), (0.45, [-20, 0, 0])])),
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.15, [0, 25, 0]), (0.3, [0, -30, 0]), (0.45, [0, 0, 0])])),
    }, loop=True, length=0.45)
    A["cast"] = anim(f"animation.eclipse.{k}.cast", {
        "arm_r": bone(rot=[osc(6, 300, base=-85), 0, 12]),
        "arm_l": bone(rot=[osc(6, 300, 90, base=-85), 0, -12]),
        "hair_back": bone(rot=[osc(6, 200, base=20), 0, 0]),
        "cape": bone(rot=[osc(8, 200, base=25), 0, 0]),
        "root": bone(pos=[0, osc(0.6, 200, base=0.6), 0]),
    }, particles=[{"effect": "cast", "locator": "hands"}])
    A["sit"] = anim(f"animation.eclipse.{k}.sit", {
        "waist": bone(pos=[0, -6.5, 0]),
        "leg_l": bone(rot=[-85, -8, 0]), "leg_r": bone(rot=[-85, 8, 0]),
        "shin_l": bone(rot=[50, 0, 0]), "shin_r": bone(rot=[50, 0, 0]),
        "arm_l": bone(rot=[-20, 0, -10]), "arm_r": bone(rot=[-20, 0, 10]),
        "head": bone(rot=[osc(4, 40), osc(12, 25), 0]),
        **sway,
    })
    A["wave"] = anim(f"animation.eclipse.{k}.wave", {
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-170, 0, -20]), (1.5, [-170, 0, -20]), (1.8, [0, 0, 0])])),
        "fore_r": bone(rot=[0, 0, "q.anim_time > 0.3 && q.anim_time < 1.5 ? math.sin(q.anim_time * 900) * 25 : 0"]),
        "head": bone(rot=[0, 0, "math.sin(q.anim_time * 180) * 8"]),
        "body": bone(rot=[0, 0, osc(3, 180)]),
    }, loop=False, length=1.8)
    A["carry"] = anim(f"animation.eclipse.{k}.carry", {
        "arm_l": bone(rot=[-55, -15, 0]), "arm_r": bone(rot=[-55, 15, 0]),
        "fore_l": bone(rot=[-20, 0, 0]), "fore_r": bone(rot=[-20, 0, 0]),
    })
    A["special"] = anim(f"animation.eclipse.{k}.shadow_burst", {
        "root": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.8, [0, 360, 0])]),
                     pos=smooth_keys([(0, [0, 0, 0]), (0.4, [0, 4, 0]), (1.2, [0, 0, 0])])),
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [0, 0, -100]), (1.2, [0, 0, 0])])),
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [0, 0, 100]), (1.2, [0, 0, 0])])),
        "skirt": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.4, [1.3, 1, 1.3]), (1.2, [1, 1, 1])])),
    }, loop=False, length=1.2, particles=[{"effect": "burst", "locator": "hands"}], sounds=[{"effect": "special"}])
    A["interact"] = A["wave"]
    return A
