"""LEGION part 3: Serpent, Stag, Golem, Manta."""
from __future__ import annotations

from ..anim import anim, bone, keys, osc, smooth_keys, walk
from ..geom import Model
from ..palette import *  # noqa: F401,F403
from .creatures import Creature, P, look, phase_anims


# =========================================================================
# 7. SERPENT — Serpente Sombria
# =========================================================================
SEGMENTS = 9


def serpent():
    m = Model("geometry.eclipse.serpent", 64, 64, density=4, bounds=(4, 2, (0, 0.6, 0)))
    sc = P("scales", (24, 26, 36), (70, 110, 120), size=1.2)
    belly = P("bone", (82, 74, 100))
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0)}
    head = None
    # segment 0 is the neck; the chain goes backwards (+Z)
    prev = "root"
    seg_len = 4.6
    for i in range(SEGMENTS):
        w = 5.2 - i * 0.42
        z0 = i * seg_len - 2
        b = m.bone(f"seg{i}", prev, pivot=(0, w / 2 + 0.2, z0))
        b.box((0, w / 2 + 0.2, z0 + seg_len / 2), (w, w * 0.85, seg_len + 0.4), sc)
        b.box((0, 0.35, z0 + seg_len / 2), (w * 0.8, 0.3, seg_len), belly)
        if i % 2 == 0:
            b.box((0, w * 0.85 + 0.6, z0 + seg_len / 2), (0.5, 0.8, 1.6), P("crystal", (40, 120, 120), (150, 255, 230)))
        prev = f"seg{i}"
    neck = m.bone("neck", "seg0", pivot=(0, 2.8, -2))
    neck.box((0, 3.0, -3.6), (4.6, 4.0, 3.6), sc)
    hood = m.bone("hood", "neck", pivot=(0, 3.4, -3.4))
    for sx in (-1, 1):
        hood.cube((min(sx * 2.2, sx * 4.6), 1.6, -3.0), (2.4, 3.2, 0.4), P("membrane", (26, 30, 44), (90, 200, 190)), rotation=(0, sx * 35, 0), pivot=(sx * 2.2, 3.2, -3.0))
    head = m.bone("head", "neck", pivot=(0, 3.2, -5.2))
    head.box((0, 3.3, -7.6), (4.4, 2.8, 5), P("scales", (24, 26, 36), (70, 110, 120), size=1.0,
                                             decals=[("up", "eyes", {"t": 1.2, "sep": 1.5, "r": 0.5, "ry": 0.35, "color": (120, 255, 220)})]))
    head.box((0, 4.9, -7.0), (3.4, 0.6, 3.4), sc)
    jaw = m.bone("jaw", "head", pivot=(0, 2.2, -5.4))
    jaw.box((0, 1.7, -7.6), (3.8, 1.0, 4.6), P("scales", (24, 26, 36), (70, 110, 120), size=0.8, decals=[("up", "teeth", {"t": 0.6})]))
    tongue = m.bone("tongue", "jaw", pivot=(0, 2.0, -9.6))
    tongue.box((0, 2.0, -11.0), (0.5, 0.15, 2.8), P("glow", (120, 255, 220)))

    k = "serpent"
    A = dict(phase_anims(k))
    A["look"] = look(k, yaw_clamp=60)

    def wave(speed, amp, lag=55, extra=None):
        bs = {}
        for i in range(SEGMENTS):
            bs[f"seg{i}"] = bone(rot=[0, osc(amp * (0.5 + 0.08 * i), speed, -i * lag), 0])
        bs["neck"] = bone(rot=[0, osc(-amp * 0.4, speed, 40), 0])
        if extra:
            bs.update(extra)
        return bs

    tongue = {"tongue": bone(scale=["1", "1", "math.sin(q.anim_time * 400) > 0.7 ? 1.0 : 0.01"])}
    A["idle"] = anim(f"animation.eclipse.{k}.idle", wave(60, 6, 40, {**tongue, "head": bone(rot=[osc(4, 70), 0, 0])}))
    A["walk"] = anim(f"animation.eclipse.{k}.slither", wave(300, 20, 55))
    A["run"] = anim(f"animation.eclipse.{k}.slither_fast", wave(520, 26, 55))
    coil = {}
    for i in range(SEGMENTS):
        coil[f"seg{i}"] = bone(rot=[0, 34 if i > 0 else 10, 0])
    coil["neck"] = bone(rot=[-35, -60, 0])
    coil["head"] = bone(rot=[25, 0, 0])
    A["sit"] = anim(f"animation.eclipse.{k}.coil", {**coil, **tongue})
    A["special"] = anim(f"animation.eclipse.{k}.rise", {
        "seg0": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-55, 0, 0]), (2.0, [-55, 0, 0]), (2.6, [0, 0, 0])])),
        "seg1": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [20, 0, 0]), (2.0, [20, 0, 0]), (2.6, [0, 0, 0])])),
        "neck": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [45, 0, 0]), (2.0, [45, 0, 0]), (2.6, [0, 0, 0])])),
        "hood": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.6, [1.9, 1.5, 1]), (2.0, [1.9, 1.5, 1]), (2.6, [1, 1, 1])])),
        "jaw": bone(rot=smooth_keys([(0.4, [0, 0, 0]), (0.7, [40, 0, 0]), (1.3, [40, 0, 0]), (1.6, [0, 0, 0])])),
    }, loop=False, length=2.6, sounds=[{"effect": "special"}])
    A["interact"] = anim(f"animation.eclipse.{k}.nuzzle", {
        "neck": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [-30, 0, 0]), (1.0, [-30, 0, 20]), (1.4, [0, 0, 0])])),
        "head": bone(rot=[0, 0, osc(12, 300)]),
    }, loop=False, length=1.4)
    return Creature("serpent", "Serpent", "Serpente Sombria",
                    "Serpente de nove anéis articulados com escamas de jade sombrio. Desliza sem som e se enrola para proteger.",
                    "Capelo Erguido: ergue o corpo e envenena inimigos ao redor.",
                    False, (0.8, 0.7), 36, 7, 0.3, m, A,
                    sounds={"ambient": "mob.silverfish.say", "hurt": "mob.silverfish.hit", "death": "mob.silverfish.kill", "step": "mob.silverfish.step"},
                    family=["serpent"], emoji="🐍")


# =========================================================================
# 8. STAG — Cervo Astral
# =========================================================================
def stag():
    m = Model("geometry.eclipse.stag", 64, 64, density=4, bounds=(3, 3, (0, 1.4, 0)))
    stars = [("east", "runes", {"cell": 1.3, "seed": 21, "margin": 0.8, "color": (200, 220, 255)}),
             ("west", "runes", {"cell": 1.3, "seed": 22, "margin": 0.8, "color": (200, 220, 255)}),
             ("up", "runes", {"cell": 1.4, "seed": 23, "margin": 0.6, "color": (200, 220, 255)})]
    fur = P("fur", (34, 32, 66), (110, 120, 190), flow="z", decals=stars)
    fur_plain = P("fur", (34, 32, 66), (110, 120, 190), flow="z")
    leg = P("fur", (22, 20, 40), (70, 70, 120), flow="y")
    hoof = P("metal", (60, 62, 80), SILVER)
    antler = P("crystal", (90, 140, 255), (235, 245, 255))
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0)}
    body = m.bone("body", "root", pivot=(0, 17, 0))
    body.box((0, 17.5, -1), (6.4, 7.2, 14), fur)
    body.box((0, 18, -7.2), (6.8, 7.4, 3.5), fur_plain)
    body.box((0, 21.6, 6.6), (1.6, 2.4, 1.2), P("fur", (220, 225, 245), flow="y"))
    neck = m.bone("neck", "body", pivot=(0, 19.5, -7.5), rotation=(-38, 0, 0))
    neck.box((0, 21.5, -9.4), (3.8, 7.5, 3.8), fur_plain)
    head = m.bone("head", "neck", pivot=(0, 25, -9.8), rotation=(40, 0, 0))
    head.locators = {"antlers": (0, 29, -11)}
    head.box((0, 25.6, -11.4), (4.2, 3.8, 4.4), P("fur", (34, 32, 66), (110, 120, 190), flow="z",
                                                 decals=[("north", "eyes", {"t": 1.1, "sep": 1.35, "r": 0.5, "ry": 0.35, "color": (170, 210, 255)})]))
    head.box((0, 24.6, -14.6), (2.6, 2.4, 3.2), fur_plain)
    head.box((0, 25.4, -16.3), (1.2, 0.9, 0.4), P("matte", (20, 18, 30)))
    for sx in (-1, 1):
        head.box((sx * 2.9, 27.4, -10.6), (2.2, 0.9, 1.0), fur_plain, rotation=(0, 0, sx * 25), pivot=(sx * 2.0, 27.4, -10.6))
    ant = m.bone("antlers", "head", pivot=(0, 27.6, -11))
    for sx in (-1, 1):
        ant.box((sx * 1.5, 30.0, -11), (0.9, 5, 0.9), antler, rotation=(0, 0, sx * -25), pivot=(sx * 1.2, 27.6, -11))
        ant.box((sx * 3.6, 32.8, -11), (0.8, 4.4, 0.8), antler, rotation=(0, 0, sx * -10), pivot=(sx * 3.0, 31.0, -11))
        ant.box((sx * 2.2, 33.6, -11.2), (0.7, 3.0, 0.7), antler, rotation=(-20, 0, sx * 20), pivot=(sx * 2.6, 32.0, -11))
        ant.box((sx * 5.4, 34.6, -11), (0.7, 3.2, 0.7), antler, rotation=(0, 0, sx * -40), pivot=(sx * 4.4, 33.2, -11))
        ant.box((sx * 3.8, 36.0, -10.6), (0.6, 2.6, 0.6), antler, rotation=(15, 0, sx * -5), pivot=(sx * 3.8, 34.6, -11))
    for side, sx in (("l", 1), ("r", -1)):
        for fb, z in (("f", -6.0), ("b", 5.0)):
            up = m.bone(f"leg_{fb}{side}", "body", pivot=(sx * 2.1, 15.5, z))
            up.box((sx * 2.1, 12.5, z), (2.2, 7, 2.6 if fb == "f" else 3.4), fur_plain)
            lo = m.bone(f"shin_{fb}{side}", f"leg_{fb}{side}", pivot=(sx * 2.1, 9.2, z))
            lo.box((sx * 2.1, 5.0, z + (0.0 if fb == "f" else 0.4)), (1.4, 8.6, 1.4), leg)
            lo.box((sx * 2.1, 0.6, z - 0.2), (1.8, 1.2, 2.0), hoof)

    k = "stag"
    A = dict(phase_anims(k, rise=1.4))
    A["look"] = look(k, yaw_clamp=50)
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {
        "body": bone(scale=[1, osc(0.012, 90, base=1.0), 1]),
        "antlers": bone(scale=osc(0.03, 100, base=1.0)),
        "neck": bone(rot=[osc(2, 40), 0, 0]),
    })
    gait = lambda amp, freq: {
        "leg_fl": bone(rot=[walk(amp, freq=freq), 0, 0]),
        "leg_fr": bone(rot=[walk(amp, freq=freq, phase=180), 0, 0]),
        "leg_bl": bone(rot=[walk(amp, freq=freq, phase=180), 0, 0]),
        "leg_br": bone(rot=[walk(amp, freq=freq), 0, 0]),
        "shin_fl": bone(rot=[f"math.max(0, {walk(amp * 1.2, freq=freq, phase=90)})", 0, 0]),
        "shin_fr": bone(rot=[f"math.max(0, {walk(amp * 1.2, freq=freq, phase=270)})", 0, 0]),
        "shin_bl": bone(rot=[f"-math.max(0, {walk(amp, freq=freq, phase=270)})", 0, 0]),
        "shin_br": bone(rot=[f"-math.max(0, {walk(amp, freq=freq, phase=90)})", 0, 0]),
    }
    A["walk"] = anim(f"animation.eclipse.{k}.walk", {**gait(24, 32), "neck": bone(rot=[walk(4, freq=64), 0, 0])})
    A["run"] = anim(f"animation.eclipse.{k}.trot", {**gait(42, 26), "body": bone(pos=[0, f"math.abs({walk(1.4, freq=26)})", 0], rot=[walk(4, freq=26, phase=90), 0, 0]),
                                                    "neck": bone(rot=[-8, 0, 0])})
    A["sit"] = anim(f"animation.eclipse.{k}.lie", {
        "body": bone(pos=[0, -10.5, 0]),
        "leg_fl": bone(rot=[-85, 0, 0]), "shin_fl": bone(rot=[160, 0, 0]),
        "leg_fr": bone(rot=[-85, 0, 0]), "shin_fr": bone(rot=[160, 0, 0]),
        "leg_bl": bone(rot=[80, 0, 0]), "shin_bl": bone(rot=[-160, 0, 0]),
        "leg_br": bone(rot=[80, 0, 0]), "shin_br": bone(rot=[-160, 0, 0]),
        "neck": bone(rot=[15, osc(5, 30), 0]),
    })
    A["graze"] = anim(f"animation.eclipse.{k}.graze", {
        "neck": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.7, [80, 0, 0]), (2.4, [80, 0, 0]), (3.0, [0, 0, 0])])),
        "head": bone(rot=[osc(5, 400), 0, 0]),
    }, loop=False, length=3.0)
    A["special"] = anim(f"animation.eclipse.{k}.leap", {
        "root": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.3, [0, -1, 0]), (0.8, [0, 14, -6]), (1.4, [0, 0, -10]), (1.8, [0, 0, 0])])),
        "body": bone(rot=smooth_keys([(0.2, [0, 0, 0]), (0.5, [-25, 0, 0]), (1.1, [20, 0, 0]), (1.5, [0, 0, 0])])),
        "leg_fl": bone(rot=smooth_keys([(0.3, [0, 0, 0]), (0.6, [-80, 0, 0]), (1.2, [-30, 0, 0]), (1.5, [0, 0, 0])])),
        "leg_fr": bone(rot=smooth_keys([(0.3, [0, 0, 0]), (0.6, [-80, 0, 0]), (1.2, [-30, 0, 0]), (1.5, [0, 0, 0])])),
        "leg_bl": bone(rot=smooth_keys([(0.3, [0, 0, 0]), (0.6, [60, 0, 0]), (1.2, [20, 0, 0]), (1.5, [0, 0, 0])])),
        "leg_br": bone(rot=smooth_keys([(0.3, [0, 0, 0]), (0.6, [60, 0, 0]), (1.2, [20, 0, 0]), (1.5, [0, 0, 0])])),
        "antlers": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.8, [1.3, 1.3, 1.3]), (1.8, [1, 1, 1])])),
    }, loop=False, length=1.8, particles=[{"effect": "burst", "locator": "antlers"}], sounds=[{"effect": "special"}])
    A["antler_manifest"] = anim(f"animation.eclipse.{k}.antler_manifest", {
        "antlers": bone(scale=smooth_keys([(0, [0, 0, 0]), (1.2, [0, 0, 0]), (2.0, [1.15, 1.15, 1.15]), (2.4, [1, 1, 1])])),
    }, loop=False, length=2.4)
    A["interact"] = anim(f"animation.eclipse.{k}.bow", {
        "neck": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [55, 0, 0]), (1.3, [55, 0, 0]), (1.8, [0, 0, 0])])),
        "leg_fl": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-40, 0, 0]), (1.3, [-40, 0, 0]), (1.8, [0, 0, 0])])),
    }, loop=False, length=1.8)
    return Creature("stag", "Stag", "Cervo Astral",
                    "Cervo de pelagem estrelada e chifres de cristal. Seus saltos deixam rastros de constelações.",
                    "Salto Astral: concede salto e velocidade a você e aos aliados próximos.",
                    False, (0.9, 1.9), 42, 6, 0.34, m, A, fidgets=["graze"],
                    sounds={"ambient": "mob.goat.ambient", "hurt": "mob.goat.hurt", "death": "mob.goat.death", "step": "mob.goat.step"},
                    family=["stag"], emoji="🦌")


# =========================================================================
# 9. GOLEM — Colosso de Sombra
# =========================================================================
def golem():
    m = Model("geometry.eclipse.golem", 128, 128, density=3, bounds=(4, 4, (0, 1.6, 0)))
    st = P("stone", (44, 40, 56), (180, 90, 255), glow_cracks=True)
    st_dark = P("stone", (30, 28, 40), (150, 70, 240), glow_cracks=True)
    crystal = P("crystal", VIOLET_DEEP, VIOLET_HI)
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0), "core": (0, 30, -6)}
    body = m.bone("body", "root", pivot=(0, 22, 0))
    body.box((0, 32, -0.5), (18, 13, 11), P("stone", (44, 40, 56), (180, 90, 255), glow_cracks=True,
                                           decals=[("north", "gem", {"t": 5.0, "r": 2.2, "color": (170, 80, 255)})]))
    body.box((0, 23.5, 0.5), (12, 6, 8), st_dark)
    body.box((0, 38.8, 1.5), (14, 3, 7), st)
    for sx in (-1, 1):
        body.box((sx * 6.5, 41.5, 1.0), (1.6, 4.5, 1.6), crystal, rotation=(10, 0, sx * -20), pivot=(sx * 6.5, 39.5, 1))
        body.box((sx * 3.6, 42.8, 2.2), (1.2, 3.2, 1.2), crystal, rotation=(-15, 0, sx * -10), pivot=(sx * 3.6, 40.0, 2))
    head = m.bone("head", "body", pivot=(0, 37, -4))
    head.box((0, 37.2, -6.5), (7, 6.5, 6.5), P("stone", (44, 40, 56), (180, 90, 255), glow_cracks=True,
                                               decals=[("north", "eyes", {"t": 2.6, "sep": 1.7, "r": 0.85, "ry": 0.5})]))
    head.box((0, 35.0, -8.2), (5, 1.6, 3.2), st_dark)
    for side, sx in (("l", 1), ("r", -1)):
        arm = m.bone(f"arm_{side}", "body", pivot=(sx * 10.5, 35, 0))
        arm.box((sx * 12.2, 35.5, 0), (6, 6, 7), st)
        arm.box((sx * 12.4, 28.5, 0), (5, 9, 5.4), st_dark)
        fore = m.bone(f"fore_{side}", f"arm_{side}", pivot=(sx * 12.4, 24.5, 0))
        fore.box((sx * 12.6, 19.5, -0.5), (6, 10, 6.6), st)
        fore.box((sx * 12.6, 11.5, -1.0), (7.4, 6.4, 7.8), P("stone", (36, 32, 48), (180, 90, 255), glow_cracks=True,
                                                             decals=[("north", "runes", {"cell": 1.8, "seed": sx + 40, "margin": 1})]))
        lg = m.bone(f"leg_{side}", "body", pivot=(sx * 4.2, 21, 0.5))
        lg.box((sx * 4.4, 15.0, 0.5), (6.2, 8, 6.8), st_dark)
        lg.box((sx * 4.4, 5.6, 0.2), (6.6, 11, 7.2), st)
        lg.box((sx * 4.4, 0.9, -0.8), (7.2, 1.8, 8.4), st_dark)

    k = "golem"
    A = dict(phase_anims(k, rise=2.0))
    A["look"] = look(k, yaw_clamp=35, pitch_clamp=20)
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {
        "body": bone(pos=[0, osc(0.35, 50), 0], scale=[osc(0.012, 50, base=1.0), 1, osc(0.012, 50, base=1.0)]),
        "arm_l": bone(rot=[osc(2, 50, 30), 0, 0]),
        "arm_r": bone(rot=[osc(2, 50, 210), 0, 0]),
        "head": bone(rot=[osc(2, 25), 0, 0]),
    })
    A["walk"] = anim(f"animation.eclipse.{k}.walk", {
        "leg_l": bone(rot=[walk(22, freq=22), 0, 0]),
        "leg_r": bone(rot=[walk(22, freq=22, phase=180), 0, 0]),
        "arm_l": bone(rot=[walk(-18, freq=22), 0, 0]),
        "arm_r": bone(rot=[walk(18, freq=22), 0, 0]),
        "body": bone(rot=[3, walk(7, freq=22), walk(2.5, freq=22)], pos=[0, f"-math.abs({walk(1.2, freq=22)})", 0]),
    })
    A["run"] = anim(f"animation.eclipse.{k}.lumber", {
        "leg_l": bone(rot=[walk(32, freq=20), 0, 0]),
        "leg_r": bone(rot=[walk(32, freq=20, phase=180), 0, 0]),
        "arm_l": bone(rot=[walk(-30, freq=20, base=-10), 0, 0]),
        "arm_r": bone(rot=[walk(30, freq=20, base=-10), 0, 0]),
        "body": bone(rot=[12, walk(10, freq=20), 0], pos=[0, f"-math.abs({walk(2.0, freq=20)})", 0]),
    })
    A["sit"] = anim(f"animation.eclipse.{k}.guard", {
        "body": bone(rot=[18, 0, 0], pos=[0, -3, 0]),
        "leg_l": bone(rot=[-30, 0, -6]), "leg_r": bone(rot=[-30, 0, 6]),
        "arm_l": bone(rot=[-22, 0, 0]), "arm_r": bone(rot=[-22, 0, 0]),
        "fore_l": bone(rot=[-10, 0, 0]), "fore_r": bone(rot=[-10, 0, 0]),
        "head": bone(rot=[-15, osc(15, 30), 0]),
    })
    A["special"] = anim(f"animation.eclipse.{k}.slam", {
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-160, 0, 10]), (0.9, [-160, 0, 10]), (1.15, [-40, 0, 0]), (2.0, [0, 0, 0])])),
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-160, 0, -10]), (0.9, [-160, 0, -10]), (1.15, [-40, 0, 0]), (2.0, [0, 0, 0])])),
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-14, 0, 0]), (1.15, [28, 0, 0]), (2.0, [0, 0, 0])])),
    }, loop=False, length=2.0, particles=[{"effect": "impact", "locator": "ground"}], sounds=[{"effect": "special"}])
    A["interact"] = anim(f"animation.eclipse.{k}.palm", {
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-70, 0, 0]), (1.6, [-70, 0, 0]), (2.2, [0, 0, 0])])),
        "fore_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-30, 0, 0]), (1.6, [-30, 0, 0]), (2.2, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [15, 0, 0]), (1.6, [15, 0, 0]), (2.2, [0, 0, 0])])),
    }, loop=False, length=2.2)
    A["twist"] = anim(f"animation.eclipse.{k}.twist", {
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.8, [0, 35, 0]), (1.6, [0, -35, 0]), (2.4, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.8, [0, -20, 0]), (1.6, [0, 20, 0]), (2.4, [0, 0, 0])])),
    }, loop=False, length=2.4)
    return Creature("golem", "Golem", "Colosso de Sombra",
                    "Titã de rocha com rachaduras de energia violeta e um núcleo pulsante no peito. Lento, mas inabalável.",
                    "Impacto Sísmico: golpe no chão que arremessa inimigos.",
                    False, (1.4, 2.9), 140, 16, 0.22, m, A, fidgets=["twist"],
                    sounds={"ambient": "mob.irongolem.walk", "hurt": "mob.irongolem.hit", "death": "mob.irongolem.death", "step": "mob.irongolem.walk"},
                    knockback_resist=1.0, family=["golem"], emoji="🗿")


# =========================================================================
# 10. MANTA — Arraia Sombria planadora
# =========================================================================
def manta():
    m = Model("geometry.eclipse.manta", 64, 64, density=4, bounds=(5, 2, (0, 1, 0)))
    skin = P("matte", (26, 22, 44), seed=5)
    top = P("scales", (26, 22, 44), (90, 70, 170), size=2.0,
            decals=[("up", "line", {"axis": "t", "w": 0.22, "color": (140, 220, 255)})])
    under = P("matte", (120, 116, 150))
    glow = P("glow", (120, 200, 255), (230, 250, 255))
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0)}
    body = m.bone("body", "root", pivot=(0, 6, 0))
    body.box((0, 6.4, 0), (9, 2.8, 13), top)
    body.box((0, 4.8, 0), (8, 0.4, 12), under)
    body.box((0, 7.0, -7.4), (7, 1.8, 2.4), P("matte", (26, 22, 44), decals=[("north", "eyes", {"t": 0.8, "sep": 2.5, "r": 0.5, "ry": 0.35, "color": (140, 220, 255)})]))
    for sx in (-1, 1):
        body.box((sx * 2.9, 6.6, -9.6), (1.4, 1.0, 3.0), skin, rotation=(0, sx * -10, 0), pivot=(sx * 2.9, 6.6, -8))
    for side, sx in (("l", 1), ("r", -1)):
        w1 = m.bone(f"wing_{side}", "body", pivot=(sx * 4.5, 6.5, 0))
        w1.cube((min(sx * 4.5, sx * 12.5), 5.8, -5.5), (8, 1.4, 10.5), top)
        w2 = m.bone(f"wingtip_{side}", f"wing_{side}", pivot=(sx * 12.5, 6.4, 0))
        w2.cube((min(sx * 12.5, sx * 19.5), 6.0, -4.0), (7, 0.9, 6.5), top)
        w2.cube((min(sx * 18.5, sx * 21), 6.1, -2.6), (2.5, 0.7, 2.6), glow)
    tail = m.bone("tail", "body", pivot=(0, 6.2, 6.5))
    tail.box((0, 6.2, 10.5), (1.2, 1.2, 8), skin)
    tail2 = m.bone("tail2", "tail", pivot=(0, 6.2, 14.5))
    tail2.box((0, 6.2, 18.5), (0.7, 0.7, 8), skin)
    tail2.box((0, 6.2, 22.8), (0.9, 0.9, 1.0), glow)

    k = "manta"
    A = dict(phase_anims(k))
    A["look"] = anim(f"animation.eclipse.{k}.look", {"body": bone(rot=[0, "math.clamp(q.target_y_rotation, -20, 20) * 0.4", 0])})
    undulate = lambda speed, amp, base=0: {
        "wing_l": bone(rot=[0, 0, osc(amp, speed, base=base)]),
        "wingtip_l": bone(rot=[0, 0, osc(amp * 1.1, speed, -70)]),
        "wing_r": bone(rot=[0, 0, osc(-amp, speed, base=-base)]),
        "wingtip_r": bone(rot=[0, 0, osc(-amp * 1.1, speed, -70)]),
        "tail": bone(rot=[osc(5, speed, 180), osc(6, speed * 0.5), 0]),
        "tail2": bone(rot=[osc(8, speed, 230), osc(10, speed * 0.5, 60), 0]),
    }
    A["idle"] = anim(f"animation.eclipse.{k}.rest", {**undulate(50, 4), "body": bone(pos=[0, -4.6, 0])})
    A["walk"] = A["idle"]
    A["run"] = A["idle"]
    A["sit"] = A["idle"]
    A["hover"] = anim(f"animation.eclipse.{k}.hover", {**undulate(160, 22), "body": bone(pos=[0, osc(1.2, 160, 90), 0])})
    A["fly"] = anim(f"animation.eclipse.{k}.swim", {**undulate(220, 30),
                                                   "body": bone(pos=[0, osc(1.5, 220, 90), 0], rot=["math.clamp(-q.vertical_speed * 3, -25, 25)", 0, "math.clamp(q.yaw_speed * -0.12, -40, 40)"])})
    A["glide"] = anim(f"animation.eclipse.{k}.glide", {**undulate(70, 6), "body": bone(rot=[5, 0, "math.clamp(q.yaw_speed * -0.15, -45, 45)"])})
    A["takeoff"] = anim(f"animation.eclipse.{k}.takeoff", {"body": bone(pos=smooth_keys([(0, [0, -4.6, 0]), (0.6, [0, 0, 0])])),
                                                          **undulate(300, 30)}, loop=False, length=0.6)
    A["land"] = anim(f"animation.eclipse.{k}.land", {"body": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.6, [0, -4.6, 0])]))}, loop=False, length=0.6)
    A["special"] = anim(f"animation.eclipse.{k}.barrel_roll", {
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.0, [0, 0, 360])]), pos=smooth_keys([(0, [0, 0, 0]), (0.5, [0, 6, 0]), (1.0, [0, 0, 0])])),
        **{k2: v for k2, v in undulate(300, 25).items() if k2.startswith("tail")},
    }, loop=False, length=1.0, sounds=[{"effect": "special"}])
    A["interact"] = anim(f"animation.eclipse.{k}.dip", {
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [20, 0, 0]), (0.8, [-10, 0, 0]), (1.2, [0, 0, 0])])),
        **undulate(240, 20),
    }, loop=False, length=1.2)
    return Creature("manta", "Manta", "Arraia das Sombras",
                    "Arraia planadora que nada pelo ar como se fosse o fundo do mar. Deixa trilhas de luz azul-violeta.",
                    "Corrente de Vento: dá queda suave e impulso a você.",
                    True, (1.2, 0.6), 30, 4, 0.3, m, A, fly_speed=0.2,
                    sounds={"ambient": "mob.dolphin.idle", "hurt": "mob.dolphin.hurt", "death": "mob.dolphin.death", "step": "mob.chicken.step"},
                    family=["manta"], emoji="🌀")
