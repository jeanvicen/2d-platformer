"""LEGION part 2: Nyx, Aegis, Nox, Vesper, Corvus."""
from __future__ import annotations

from ..anim import anim, bone, keys, osc, smooth_keys, walk
from ..geom import Model
from ..palette import *  # noqa: F401,F403
from .creatures import Creature, P, look, phase_anims


# =========================================================================
# 2. NYX — Pantera do Eclipse
# =========================================================================
def nyx():
    m = Model("geometry.eclipse.nyx", 64, 64, density=4, bounds=(3, 2, (0, 0.8, 0)))
    runes = [("east", "runes", {"cell": 1.6, "seed": 11, "margin": 1.2}), ("west", "runes", {"cell": 1.6, "seed": 12, "margin": 1.2})]
    fur = P("fur", (22, 18, 34), INDIGO, flow="z", grain=1.4)
    fur_r = P("fur", (22, 18, 34), INDIGO, flow="z", grain=1.4, decals=runes)
    dark = P("fur", VOID, (40, 30, 70), flow="y")
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0)}
    body = m.bone("body", "root", pivot=(0, 10, 0))
    body.box((0, 10.2, -4.5), (7, 7, 9), fur_r)
    body.box((0, 10.0, 4.5), (6.2, 6.4, 9), fur_r)
    body.box((0, 12.6, -5), (7.6, 2.2, 6), fur)
    body.box((0, 7.1, 0), (5.4, 1.2, 14), dark)
    neck = m.bone("neck", "body", pivot=(0, 12, -8.5))
    neck.box((0, 12.2, -10.2), (5, 5, 4.5), fur, rotation=(-8, 0, 0), pivot=(0, 12, -9))
    head = m.bone("head", "neck", pivot=(0, 13, -12))
    head.box((0, 13.6, -14.3), (6.2, 5.2, 5), P("fur", (22, 18, 34), INDIGO, flow="z",
                                                  decals=[("north", "eyes", {"t": 1.9, "sep": 1.55, "r": 0.85, "ry": 0.4, "color": (190, 120, 255)})]))
    head.box((0, 12.3, -17.4), (3.6, 2.8, 2.4), fur)
    head.box((0, 13.2, -18.7), (1.4, 0.9, 0.4), P("matte", (60, 40, 70)))
    for sx in (-1, 1):
        head.box((sx * 2.1, 16.8, -13.8), (1.8, 1.8, 1.1), dark, rotation=(0, 0, sx * -20), pivot=(sx * 2.1, 16, -13.8))
        head.box((sx * 1.9, 12.4, -18.0), (0.15, 0.15, 0.15), P("glow", VIOLET_HI))
    jaw = m.bone("jaw", "head", pivot=(0, 11.6, -15.5))
    jaw.box((0, 11.2, -17.2), (3.2, 0.9, 3.0), dark)
    for side, sx in (("l", 1), ("r", -1)):
        fl = m.bone(f"leg_f{side}", "body", pivot=(sx * 2.5, 10, -6.5))
        fl.box((sx * 2.5, 7.6, -6.5), (2.6, 6, 2.8), fur)
        fl.box((sx * 2.5, 2.6, -6.8), (2.1, 4.4, 2.1), dark)
        fl.box((sx * 2.5, 0.6, -7.5), (2.8, 1.2, 3.0), dark)
        bl = m.bone(f"leg_b{side}", "body", pivot=(sx * 2.5, 10, 6.5))
        bl.box((sx * 2.5, 7.8, 7.2), (2.9, 5.6, 4.2), fur)
        bl.box((sx * 2.5, 3.0, 8.6), (2.1, 4.8, 2.1), dark, rotation=(-14, 0, 0), pivot=(sx * 2.5, 5.2, 8.6))
        bl.box((sx * 2.5, 0.6, 8.0), (2.8, 1.2, 3.0), dark)
    tail = m.bone("tail", "body", pivot=(0, 11.5, 9), rotation=(-48, 0, 0))
    tail.box((0, 11.5, 12), (1.8, 1.8, 6.2), fur)
    tail2 = m.bone("tail2", "tail", pivot=(0, 11.5, 15), rotation=(18, 0, 0))
    tail2.box((0, 11.5, 18), (1.6, 1.6, 6.2), fur)
    tail3 = m.bone("tail3", "tail2", pivot=(0, 11.5, 21), rotation=(30, 0, 0))
    tail3.box((0, 11.5, 23.5), (1.4, 1.4, 5.2), P("fur", VOID, VIOLET, flow="z"))
    tail3.box((0, 11.5, 26.4), (1.0, 1.0, 1.0), P("glow", VIOLET, VIOLET_HI))

    k = "nyx"
    A = dict(phase_anims(k))
    A["look"] = look(k, yaw_clamp=70)
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {
        "body": bone(scale=[1, osc(0.012, 100, base=1.0), 1]),
        "tail": bone(rot=[osc(5, 60), osc(18, 70), 0]),
        "tail2": bone(rot=[osc(8, 60, 50), osc(20, 70, 50), 0]),
        "tail3": bone(rot=[osc(12, 60, 90), osc(25, 70, 100), 0]),
    })
    A["walk"] = anim(f"animation.eclipse.{k}.walk", {
        "leg_fl": bone(rot=[walk(32), 0, 0]),
        "leg_fr": bone(rot=[walk(32, phase=180), 0, 0]),
        "leg_bl": bone(rot=[walk(30, phase=90), 0, 0]),
        "leg_br": bone(rot=[walk(30, phase=270), 0, 0]),
        "body": bone(pos=[0, -1.0, 0], rot=[0, walk(3, phase=90), walk(3)]),
        "neck": bone(rot=[6, walk(-3, phase=90), 0]),
        "tail": bone(rot=[0, walk(12), 0]),
    })
    A["run"] = anim(f"animation.eclipse.{k}.run", {
        "leg_fl": bone(rot=[walk(70, freq=28), 0, 0]),
        "leg_fr": bone(rot=[walk(70, freq=28, phase=30), 0, 0]),
        "leg_bl": bone(rot=[walk(66, freq=28, phase=180), 0, 0]),
        "leg_br": bone(rot=[walk(66, freq=28, phase=210), 0, 0]),
        "body": bone(rot=[walk(10, freq=28, phase=90), 0, 0], scale=[1, 1, walk(0.06, freq=28, base=1.0)]),
        "tail": bone(rot=[-10, walk(6, freq=28), 0]),
    })
    A["sit"] = anim(f"animation.eclipse.{k}.rest", {
        "body": bone(pos=[0, -5.2, 0]),
        "leg_fl": bone(rot=[-80, 0, 0], pos=[0, 1.5, -1]),
        "leg_fr": bone(rot=[-80, -10, 0], pos=[0, 1.5, -1]),
        "leg_bl": bone(rot=[78, 0, 0], pos=[0, 1.2, 1]),
        "leg_br": bone(rot=[78, 0, 0], pos=[0, 1.2, 1]),
        "neck": bone(rot=[10, osc(6, 30), 0]),
        "tail": bone(rot=[-30, 55, 0]),
        "tail2": bone(rot=[0, 35, 0]),
        "tail3": bone(rot=[0, 30, 0]),
    })
    A["stretch"] = anim(f"animation.eclipse.{k}.stretch", {
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [16, 0, 0]), (1.6, [16, 0, 0]), (2.2, [0, 0, 0])]),
                     pos=smooth_keys([(0, [0, 0, 0]), (0.6, [0, -1.5, 1.5]), (1.6, [0, -1.5, 1.5]), (2.2, [0, 0, 0])])),
        "leg_fl": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-55, 0, 0]), (1.6, [-55, 0, 0]), (2.2, [0, 0, 0])])),
        "leg_fr": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-55, 0, 0]), (1.6, [-55, 0, 0]), (2.2, [0, 0, 0])])),
        "jaw": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.9, [28, 0, 0]), (1.3, [28, 0, 0]), (1.7, [0, 0, 0])])),
        "tail": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.8, [-40, 0, 0]), (1.8, [-40, 0, 0]), (2.2, [0, 0, 0])])),
    }, loop=False, length=2.2)
    A["special"] = anim(f"animation.eclipse.{k}.stalk", {
        "body": bone(pos=[0, -2.6, 0], rot=[3, 0, 0]),
        "leg_fl": bone(rot=[osc(18, 220), 0, 0]),
        "leg_fr": bone(rot=[osc(18, 220, 180), 0, 0]),
        "neck": bone(rot=[16, osc(10, 60), 0]),
        "tail": bone(rot=[-6, osc(30, 400), 0]),
        "tail3": bone(rot=[0, osc(40, 400, 90), 0]),
    }, loop=False, length=2.4)
    A["interact"] = anim(f"animation.eclipse.{k}.purr", {
        "head": bone(rot=[0, 0, osc(16, 180)]),
        "neck": bone(rot=keys([(0, [0, 0, 0]), (0.3, [-10, 0, 0]), (1.2, [-10, 0, 0]), (1.6, [0, 0, 0])])),
        "tail": bone(rot=[-35, osc(8, 200), 0]),
    }, loop=False, length=1.6)
    return Creature("nyx", "Nyx", "Pantera do Eclipse",
                    "Felina silenciosa com runas que pulsam no ritmo da respiração. Espreita no escuro e ataca primeiro.",
                    "Espreita: agacha e prepara um bote mortal.",
                    False, (0.8, 1.0), 34, 8, 0.36, m, A, fidgets=["stretch"],
                    sounds={"ambient": "mob.cat.purr", "hurt": "mob.cat.hit", "death": "mob.cat.hit", "step": "mob.wolf.step"},
                    family=["feline"], emoji="🐆")


# =========================================================================
# 3. AEGIS — Guardião Blindado
# =========================================================================
def aegis():
    m = Model("geometry.eclipse.aegis", 128, 128, density=3, bounds=(3, 3.4, (0, 1.4, 0)))
    plate = P("metal", (70, 72, 90), (150, 154, 172), rivets=True)
    plate_dark = P("metal", (44, 44, 58), (118, 120, 140))
    cloth = P("cloth", INDIGO, (110, 70, 190))
    chain = P("matte", (38, 36, 48))
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0)}
    body = m.bone("body", "root", pivot=(0, 22, 0))
    body.box((0, 28.5, 0), (11, 10, 6.6), P("metal", (70, 72, 90), (150, 154, 172), rivets=True,
                                            decals=[("north", "gem", {"t": 4.0, "r": 1.3, "color": (160, 80, 255)}),
                                                    ("north", "line", {"axis": "t", "pos": 5.5, "w": 0.18, "color": (150, 90, 255)})]))
    body.box((0, 22.2, 0), (9, 3.4, 5.4), chain)
    body.box((0, 20.4, 0), (10, 1.6, 6.0), P("leather", LEATHER, decals=[("north", "gem", {"r": 0.6, "color": (150, 80, 250)})]))
    body.box((0, 17.5, -2.9), (8, 4.5, 0.6), cloth)
    body.box((0, 17.5, 2.9), (8, 4.5, 0.6), cloth)
    head = m.bone("head", "body", pivot=(0, 33.5, 0))
    head.box((0, 37.6, 0), (7.4, 8.2, 7.4), P("metal", (70, 72, 90), (150, 154, 172),
                                              decals=[("north", "line", {"axis": "s", "pos": 3.4, "w": 0.32, "color": (200, 130, 255)})]))
    head.box((0, 42.6, 0.4), (1.2, 2.6, 7.8), P("crystal", VIOLET_DEEP, VIOLET_HI))
    for sx in (-1, 1):
        head.box((sx * 4.1, 38.4, 0.2), (0.8, 4.8, 5.6), plate_dark)
    cape = m.bone("cape", "body", pivot=(0, 33, 3.6))
    cape.box((0, 23.5, 3.9), (10.5, 19, 0.7), P("cloth", (36, 22, 74), (96, 60, 170),
                                                 decals=[("south", "runes", {"cell": 2.0, "seed": 4, "margin": 2})]))
    for side, sx in (("l", 1), ("r", -1)):
        arm = m.bone(f"arm_{side}", "body", pivot=(sx * 6.6, 32, 0))
        arm.box((sx * 7.6, 32.4, 0), (5.2, 4.2, 6.6), plate)
        arm.box((sx * 7.4, 27.0, 0), (3.8, 7.0, 3.8), chain)
        fore = m.bone(f"fore_{side}", f"arm_{side}", pivot=(sx * 7.4, 24, 0))
        fore.box((sx * 7.4, 20.6, 0), (4.4, 7.0, 4.4), plate_dark)
        fore.box((sx * 7.4, 16.4, -0.2), (3.8, 2.4, 4.0), plate)
        lg = m.bone(f"leg_{side}", "body", pivot=(sx * 2.5, 18, 0))
        lg.box((sx * 2.5, 14.2, 0), (4.2, 7.6, 4.6), plate_dark)
        lg.box((sx * 2.5, 9.6, -0.4), (4.6, 1.8, 5.0), plate)
        shin = m.bone(f"shin_{side}", f"leg_{side}", pivot=(sx * 2.5, 9.5, 0))
        shin.box((sx * 2.5, 5.2, 0), (4.0, 7.4, 4.4), plate_dark)
        shin.box((sx * 2.5, 1.0, -0.7), (4.6, 2.0, 5.8), plate)
    shield = m.bone("shield", "fore_l", pivot=(10.2, 20, 0))
    shield.box((10.4, 19.5, 0), (1.4, 17, 11), P("metal", (52, 52, 68), (140, 144, 162), rivets=True,
                                                 decals=[("east", "gem", {"r": 2.0, "color": (160, 80, 255)}),
                                                         ("east", "line", {"axis": "t", "w": 0.25, "color": (150, 90, 255)}),
                                                         ("east", "line", {"axis": "s", "w": 0.25, "color": (150, 90, 255)})]))
    weapon = m.bone("weapon", "fore_r", pivot=(-7.4, 16.5, 0))
    weapon.box((-7.4, 16.4, -4.0), (1.2, 1.2, 14), P("wood", WOOD, axis="z"))
    weapon.box((-7.4, 16.4, -12.5), (3.6, 3.6, 4.2), P("metal", (70, 72, 90), (150, 154, 172), rivets=True))
    weapon.box((-7.4, 16.4, -12.5), (1.4, 5.6, 1.4), P("crystal", VIOLET_DEEP, VIOLET_HI))

    k = "aegis"
    A = dict(phase_anims(k, rise=1.6))
    A["look"] = look(k, yaw_clamp=45, pitch_clamp=25)
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {
        "body": bone(pos=[0, osc(0.25, 70), 0], rot=[0, osc(2, 25), 0]),
        "cape": bone(rot=[osc(3, 80, base=4), 0, osc(1.5, 60)]),
        "arm_l": bone(rot=[osc(2, 70), 0, 0]),
        "arm_r": bone(rot=[osc(2, 70, 180), 0, 0]),
    })
    A["walk"] = anim(f"animation.eclipse.{k}.walk", {
        "leg_l": bone(rot=[walk(28, freq=30), 0, 0]),
        "leg_r": bone(rot=[walk(28, freq=30, phase=180), 0, 0]),
        "shin_l": bone(rot=[f"math.max(0, {walk(30, freq=30, phase=90)})", 0, 0]),
        "shin_r": bone(rot=[f"math.max(0, {walk(30, freq=30, phase=270)})", 0, 0]),
        "arm_l": bone(rot=[walk(-14, freq=30), 0, 0]),
        "arm_r": bone(rot=[walk(14, freq=30), 0, 0]),
        "body": bone(pos=[0, f"-math.abs({walk(0.7, freq=30)})", 0], rot=[0, walk(4, freq=30), 0]),
        "cape": bone(rot=[f"10 + math.abs({walk(8, freq=30)})", 0, 0]),
    })
    A["run"] = anim(f"animation.eclipse.{k}.run", {
        "leg_l": bone(rot=[walk(45, freq=26), 0, 0]),
        "leg_r": bone(rot=[walk(45, freq=26, phase=180), 0, 0]),
        "shin_l": bone(rot=[f"math.max(0, {walk(45, freq=26, phase=90)})", 0, 0]),
        "shin_r": bone(rot=[f"math.max(0, {walk(45, freq=26, phase=270)})", 0, 0]),
        "arm_r": bone(rot=[walk(30, freq=26), 0, 0]),
        "body": bone(rot=[8, walk(6, freq=26), 0]),
        "cape": bone(rot=[28, 0, 0]),
    })
    kneel = {
        "body": bone(pos=[0, -6.5, 0], rot=[6, 0, 0]),
        "leg_l": bone(rot=[-88, 0, 0]),
        "shin_l": bone(rot=[88, 0, 0]),
        "leg_r": bone(rot=[0, 0, 0], pos=[0, 0, 4]),
        "shin_r": bone(rot=[90, 0, 0], pos=[0, 0, 0]),
        "arm_l": bone(rot=[-30, 0, 0]),
        "fore_l": bone(rot=[-20, 0, 0]),
        "arm_r": bone(rot=[-60, 0, 0]),
        "fore_r": bone(rot=[-30, 0, 0]),
        "cape": bone(rot=[18, 0, 0]),
        "head": bone(rot=[12, 0, 0]),
    }
    A["sit"] = anim(f"animation.eclipse.{k}.vigil", kneel)
    A["special"] = anim(f"animation.eclipse.{k}.shield_slam", {
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.35, [-110, 0, -10]), (0.6, [-110, 0, -10]), (0.8, [-40, 0, 0]), (1.6, [0, 0, 0])])),
        "fore_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.35, [-30, 0, 0]), (0.8, [0, 0, 0])])),
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.35, [-8, 0, 0]), (0.8, [14, 0, 0]), (1.6, [0, 0, 0])]),
                     pos=smooth_keys([(0, [0, 0, 0]), (0.8, [0, -1.5, 0]), (1.6, [0, 0, 0])])),
    }, loop=False, length=1.6, particles=[{"effect": "impact", "locator": "ground"}], sounds=[{"effect": "special"}])
    A["interact"] = anim(f"animation.eclipse.{k}.salute", {
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [-70, 0, 35]), (1.4, [-70, 0, 35]), (1.8, [0, 0, 0])])),
        "fore_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [-80, 0, 0]), (1.4, [-80, 0, 0]), (1.8, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [14, 0, 0]), (1.3, [14, 0, 0]), (1.8, [0, 0, 0])])),
    }, loop=False, length=1.8)
    A["scan"] = anim(f"animation.eclipse.{k}.scan", {
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.8, [0, 50, 0]), (1.8, [0, -50, 0]), (2.5, [0, 0, 0])])),
        "fore_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.2, [-40, 0, 0]), (2.5, [0, 0, 0])])),
    }, loop=False, length=2.5)
    return Creature("aegis", "Aegis", "Guardião Blindado",
                    "Cavaleiro de aço escurecido que nunca dorme. Ergue a égide e segura a linha enquanto você trabalha.",
                    "Golpe da Égide: atordoa e empurra inimigos à frente.",
                    False, (0.9, 2.6), 80, 10, 0.24, m, A, fidgets=["scan"],
                    sounds={"ambient": "mob.irongolem.walk", "hurt": "mob.irongolem.hit", "death": "mob.irongolem.death", "step": "mob.irongolem.walk"},
                    knockback_resist=0.8, family=["guardian"], emoji="🛡")


# =========================================================================
# 4. NOX — Dragão Negro
# =========================================================================
def nox():
    m = Model("geometry.eclipse.nox", 128, 128, density=3, bounds=(5, 3, (0, 1.2, 0)))
    sc = P("scales", (30, 24, 44), (82, 60, 130), size=1.6)
    sc_dark = P("scales", VOID, (60, 44, 100), size=1.2)
    belly = P("bone", (70, 58, 90))
    horn = P("bone", (190, 180, 205))
    crystal = P("crystal", VIOLET_DEEP, VIOLET_HI)
    mem = P("membrane", (40, 22, 70), (130, 70, 220))
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0)}
    body = m.bone("body", "root", pivot=(0, 15, 0))
    body.box((0, 15.5, 1), (11, 10, 15), sc)
    body.box((0, 14.8, -8.5), (10, 9, 6), sc)
    body.box((0, 10.4, 0), (8, 1.4, 18), belly)
    for i, z in enumerate((-9, -5, -1, 3, 7)):
        body.box((0, 21.2, z), (1.2, 2.6 - abs(i - 2) * 0.3, 2.2), crystal, rotation=(-30, 0, 0), pivot=(0, 20.5, z))
    neck1 = m.bone("neck1", "body", pivot=(0, 17.5, -10.5), rotation=(-28, 0, 0))
    neck1.box((0, 18, -13.5), (6.2, 6.2, 6.5), sc_dark)
    neck1.box((0, 21.4, -13.5), (1, 1.6, 2), crystal)
    neck2 = m.bone("neck2", "neck1", pivot=(0, 18, -16.5), rotation=(16, 0, 0))
    neck2.box((0, 18.2, -19.5), (5.4, 5.4, 6.4), sc_dark)
    head = m.bone("head", "neck2", pivot=(0, 18.5, -22.5), rotation=(14, 0, 0))
    head.locators = {"mouth": (0, 17.5, -32)}
    head.box((0, 19.2, -25.5), (7, 6, 6.6), P("scales", (30, 24, 44), (82, 60, 130), size=1.4,
                                              decals=[("north", "eyes", {"t": 1.9, "sep": 2.1, "r": 0.9, "ry": 0.4})]))
    head.box((0, 18.0, -30.5), (4.8, 3.6, 5.2), sc)
    head.box((0, 19.9, -32.6), (1.2, 0.8, 0.6), P("glow", VIOLET, VIOLET_HI))
    for sx in (-1, 1):
        head.box((sx * 2.4, 23.4, -23.5), (1.4, 1.4, 6.5), horn, rotation=(28, sx * 10, 0), pivot=(sx * 2.4, 22.5, -24.5))
        head.box((sx * 3.8, 20.6, -25.0), (0.8, 0.8, 3.0), horn, rotation=(10, sx * 25, 0), pivot=(sx * 3.8, 20.6, -25.0))
    jaw = m.bone("jaw", "head", pivot=(0, 16.6, -27))
    jaw.box((0, 15.9, -30.2), (4.4, 1.4, 5.0), P("scales", VOID, (60, 44, 100), size=1.0, decals=[("up", "teeth", {"t": 0.6})]))
    for side, sx in (("l", 1), ("r", -1)):
        w = m.bone(f"wing_{side}", "body", pivot=(sx * 5, 20, -6))
        w.box((sx * 13, 20.2, -6.2), (16, 1.6, 1.8), sc_dark)
        w.cube((min(sx * 5, sx * 21), 19.7, -5.5), (16, 0.45, 14), mem)
        wt = m.bone(f"wingtip_{side}", f"wing_{side}", pivot=(sx * 21, 20.2, -6))
        wt.box((sx * 28, 20.2, -5.6), (14, 1.2, 1.4), sc_dark)
        wt.cube((min(sx * 21, sx * 35), 19.8, -5.0), (14, 0.4, 12), mem)
        wt.box((sx * 35.5, 20.2, -6.4), (1.2, 1.2, 2.4), horn)
        fl = m.bone(f"leg_f{side}", "body", pivot=(sx * 4.4, 13, -8))
        fl.box((sx * 4.6, 9.8, -8), (3.2, 7, 3.6), sc)
        fl.box((sx * 4.6, 3.6, -8.4), (2.6, 6, 2.8), sc_dark)
        fl.box((sx * 4.6, 0.7, -9.6), (3.4, 1.4, 4.2), sc_dark)
        bl = m.bone(f"leg_b{side}", "body", pivot=(sx * 4.6, 14, 6))
        bl.box((sx * 4.8, 10.6, 6.8), (3.8, 7.5, 5.0), sc)
        bl.box((sx * 4.8, 4.0, 8.4), (2.8, 6.4, 2.8), sc_dark, rotation=(-14, 0, 0), pivot=(sx * 4.8, 6.6, 8.4))
        bl.box((sx * 4.8, 0.7, 7.4), (3.6, 1.4, 4.4), sc_dark)
    t1 = m.bone("tail1", "body", pivot=(0, 15.5, 8.5), rotation=(-12, 0, 0))
    t1.box((0, 15.5, 12.5), (6.4, 6.4, 8), sc)
    t1.box((0, 19.2, 12.5), (1, 1.6, 2), crystal)
    t2 = m.bone("tail2", "tail1", pivot=(0, 15.5, 16.5), rotation=(-6, 0, 0))
    t2.box((0, 15.5, 20.5), (4.8, 4.8, 8), sc_dark)
    t3 = m.bone("tail3", "tail2", pivot=(0, 15.5, 24.5), rotation=(4, 0, 0))
    t3.box((0, 15.5, 28.5), (3.4, 3.4, 8), sc_dark)
    t4 = m.bone("tail4", "tail3", pivot=(0, 15.5, 32.5))
    t4.box((0, 15.5, 36), (2.2, 2.2, 7), sc_dark)
    t4.box((0, 15.5, 40.4), (5.0, 0.8, 3.4), crystal, rotation=(0, 45, 0), pivot=(0, 15.5, 40.4))

    k = "nox"
    A = dict(phase_anims(k, rise=1.6))
    A["look"] = look(k, yaw_clamp=40, pitch_clamp=30)
    tail_sway = {
        "tail1": bone(rot=[0, osc(6, 50), 0]),
        "tail2": bone(rot=[0, osc(8, 50, 40), 0]),
        "tail3": bone(rot=[0, osc(10, 50, 80), 0]),
        "tail4": bone(rot=[0, osc(14, 50, 120), 0]),
    }
    folded = {
        "wing_l": bone(rot=[0, 55, -55]), "wingtip_l": bone(rot=[0, 120, 0]),
        "wing_r": bone(rot=[0, -55, 55]), "wingtip_r": bone(rot=[0, -120, 0]),
    }
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {
        **folded,
        "body": bone(scale=[osc(0.02, 70, base=1.0), osc(0.02, 70, base=1.0), 1]),
        "neck1": bone(rot=[osc(3, 40), 0, 0]),
        **tail_sway,
    })
    A["walk"] = anim(f"animation.eclipse.{k}.walk", {
        **folded,
        "leg_fl": bone(rot=[walk(30, freq=30), 0, 0]),
        "leg_fr": bone(rot=[walk(30, freq=30, phase=180), 0, 0]),
        "leg_bl": bone(rot=[walk(28, freq=30, phase=180), 0, 0]),
        "leg_br": bone(rot=[walk(28, freq=30), 0, 0]),
        "body": bone(rot=[0, walk(4, freq=30), walk(2.5, freq=30)]),
        "neck1": bone(rot=[0, walk(-5, freq=30), 0]),
        "tail1": bone(rot=[0, walk(-8, freq=30), 0]),
        "tail3": bone(rot=[0, walk(10, freq=30, phase=60), 0]),
    })
    A["run"] = A["walk"]
    A["sit"] = anim(f"animation.eclipse.{k}.rest", {
        **folded,
        "body": bone(pos=[0, -7.5, 0]),
        "leg_fl": bone(rot=[-80, 0, 0], pos=[0, 3, -2]), "leg_fr": bone(rot=[-80, 0, 0], pos=[0, 3, -2]),
        "leg_bl": bone(rot=[80, 0, 0], pos=[0, 3, 2]), "leg_br": bone(rot=[80, 0, 0], pos=[0, 3, 2]),
        "neck1": bone(rot=[30, 25, 0]), "neck2": bone(rot=[-10, 20, 0]), "head": bone(rot=[-12, 10, 0]),
        "tail1": bone(rot=[-10, 30, 0]), "tail2": bone(rot=[-8, 35, 0]), "tail3": bone(rot=[0, 35, 0]), "tail4": bone(rot=[0, osc(10, 30), 0]),
    })
    flap = lambda speed, amp, base=0: {
        "wing_l": bone(rot=[0, 0, osc(amp, speed, base=base)]),
        "wingtip_l": bone(rot=[0, 0, osc(amp * 0.6, speed, -50, base=base * 0.3)]),
        "wing_r": bone(rot=[0, 0, osc(-amp, speed, base=-base)]),
        "wingtip_r": bone(rot=[0, 0, osc(-amp * 0.6, speed, -50, base=-base * 0.3)]),
    }
    airborne_legs = {
        "leg_fl": bone(rot=[45, 0, 0]), "leg_fr": bone(rot=[45, 0, 0]),
        "leg_bl": bone(rot=[60, 0, 0]), "leg_br": bone(rot=[60, 0, 0]),
    }
    A["fly"] = anim(f"animation.eclipse.{k}.fly", {
        **flap(300, 38, 5), **airborne_legs,
        "body": bone(pos=[0, osc(1.2, 300, 90), 0], rot=["math.clamp(-q.vertical_speed * 2, -20, 20)", 0, "math.clamp(q.yaw_speed * -0.08, -25, 25)"]),
        "neck1": bone(rot=[osc(3, 300, 120), 0, 0]),
        "tail1": bone(rot=[osc(4, 300, 200), 0, 0]),
        "tail2": bone(rot=[osc(5, 300, 240), 0, 0]),
        "tail3": bone(rot=[osc(6, 300, 280), 0, 0]),
    })
    A["glide"] = anim(f"animation.eclipse.{k}.glide", {
        **flap(60, 4, 4), **airborne_legs,
        "body": bone(rot=[6, 0, "math.clamp(q.yaw_speed * -0.1, -30, 30)"]),
        **tail_sway,
    })
    A["hover"] = anim(f"animation.eclipse.{k}.hover", {
        **flap(420, 44, 10),
        "leg_fl": bone(rot=[20, 0, 0]), "leg_fr": bone(rot=[20, 0, 0]),
        "leg_bl": bone(rot=[25, 0, 0]), "leg_br": bone(rot=[25, 0, 0]),
        "body": bone(pos=[0, osc(1.5, 420, 90), 0], rot=[-10, 0, 0]),
        **tail_sway,
    })
    A["takeoff"] = anim(f"animation.eclipse.{k}.takeoff", {
        "wing_l": bone(rot=smooth_keys([(0, [0, 55, -55]), (0.3, [0, 0, 50]), (0.55, [0, 0, -30]), (0.8, [0, 0, 40])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, -55, 55]), (0.3, [0, 0, -50]), (0.55, [0, 0, 30]), (0.8, [0, 0, -40])])),
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-25, 0, 0]), (0.8, [-5, 0, 0])])),
    }, loop=False, length=0.8)
    A["land"] = anim(f"animation.eclipse.{k}.land", {
        "wing_l": bone(rot=smooth_keys([(0, [0, 0, 40]), (0.4, [0, 0, 60]), (0.9, [0, 55, -55])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, 0, -40]), (0.4, [0, 0, -60]), (0.9, [0, -55, 55])])),
        "body": bone(rot=smooth_keys([(0, [-20, 0, 0]), (0.4, [8, 0, 0]), (0.9, [0, 0, 0])]),
                     pos=smooth_keys([(0.2, [0, 0, 0]), (0.4, [0, -1.5, 0]), (0.9, [0, 0, 0])])),
    }, loop=False, length=0.9)
    A["special"] = anim(f"animation.eclipse.{k}.roar", {
        "neck1": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-30, 0, 0]), (2.0, [-30, 0, 0]), (2.5, [0, 0, 0])])),
        "neck2": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-20, 0, 0]), (2.0, [-20, 0, 0]), (2.5, [0, 0, 0])])),
        "jaw": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [35, 0, 0]), (2.0, [35, 0, 0]), (2.5, [0, 0, 0])])),
        "head": bone(rot=[osc(3, 1200), 0, 0]),
        "wing_l": bone(rot=smooth_keys([(0, [0, 55, -55]), (0.5, [0, 0, 25]), (2.0, [0, 0, 25]), (2.5, [0, 55, -55])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, -55, 55]), (0.5, [0, 0, -25]), (2.0, [0, 0, -25]), (2.5, [0, -55, 55])])),
    }, loop=False, length=2.5, particles=[{"effect": "breath", "locator": "mouth"}],
        sounds=[{"effect": "special"}])
    A["interact"] = anim(f"animation.eclipse.{k}.bow", {
        "neck1": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [40, 0, 0]), (1.6, [40, 0, 0]), (2.2, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [10, 0, 0]), (1.6, [10, 0, 0]), (2.2, [0, 0, 0])])),
        "body": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.6, [0, -2, 0]), (1.6, [0, -2, 0]), (2.2, [0, 0, 0])])),
    }, loop=False, length=2.2)
    A["wing_stretch"] = anim(f"animation.eclipse.{k}.wing_stretch", {
        "wing_l": bone(rot=smooth_keys([(0, [0, 55, -55]), (0.8, [0, 0, 30]), (1.8, [0, 0, 30]), (2.6, [0, 55, -55])])),
        "wingtip_l": bone(rot=smooth_keys([(0, [0, 120, 0]), (0.8, [0, 0, 10]), (1.8, [0, 0, 10]), (2.6, [0, 120, 0])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, -55, 55]), (0.8, [0, 0, -30]), (1.8, [0, 0, -30]), (2.6, [0, -55, 55])])),
        "wingtip_r": bone(rot=smooth_keys([(0, [0, -120, 0]), (0.8, [0, 0, -10]), (1.8, [0, 0, -10]), (2.6, [0, -120, 0])])),
    }, loop=False, length=2.6)
    return Creature("nox", "Nox", "Dragão Negro",
                    "Dragão de escamas de obsidiana viva e asas de membrana violeta. Voa ao seu redor e ruge para dispersar inimigos.",
                    "Rugido do Eclipse: empurra e assusta todos os monstros ao redor.",
                    True, (1.4, 1.7), 90, 12, 0.3, m, A, fidgets=["wing_stretch"], fly_speed=0.18,
                    sounds={"ambient": "mob.enderdragon.growl", "hurt": "mob.enderdragon.hit", "death": "mob.enderdragon.growl", "step": "mob.irongolem.walk"},
                    scale=1.0, knockback_resist=0.6, family=["dragon"], emoji="🐉")


# =========================================================================
# 5. VESPER — Fênix Sombria
# =========================================================================
def vesper():
    m = Model("geometry.eclipse.vesper", 64, 64, density=4, bounds=(4, 2.5, (0, 1, 0)))
    fe = P("feather", (34, 20, 50), (200, 90, 255), width=1.5, length=7)
    fe2 = P("feather", (24, 14, 36), (255, 130, 210), width=1.2, length=9)
    flame = P("glow", (170, 70, 255), (255, 200, 250))
    beak = P("bone", (200, 190, 210))
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0), "trail": (0, 10, 6)}
    body = m.bone("body", "root", pivot=(0, 9, 0))
    body.box((0, 9.5, 0), (6, 6.4, 9.5), fe)
    body.box((0, 10.6, -4.6), (5.4, 5.2, 3), fe)
    neck = m.bone("neck", "body", pivot=(0, 12, -5.5), rotation=(-30, 0, 0))
    neck.box((0, 13.6, -6.2), (3.8, 4.6, 3.6), fe)
    head = m.bone("head", "neck", pivot=(0, 16, -6.5), rotation=(28, 0, 0))
    head.box((0, 17.4, -7.4), (4.2, 3.8, 4.4), P("feather", (34, 20, 50), (200, 90, 255), width=1.0, length=3,
                                                decals=[("east", "eye_single", {"s": 3.0, "t": 1.4, "r": 0.5}), ("west", "eye_single", {"s": 1.4, "t": 1.4, "r": 0.5})]))
    head.box((0, 17.0, -10.2), (1.4, 1.4, 1.8), beak)
    head.box((0, 16.5, -11.2), (1.0, 0.8, 0.8), beak)
    for i, (y, z, rx) in enumerate(((19.6, -7.0, -20), (20.2, -5.4, -40), (19.8, -3.8, -60))):
        head.box((0, y, z), (0.6, 0.6, 4 - i * 0.5), flame, rotation=(rx, 0, 0), pivot=(0, 19, -6.8))
    for side, sx in (("l", 1), ("r", -1)):
        w = m.bone(f"wing_{side}", "body", pivot=(sx * 3, 11.5, -2.5))
        w.cube((min(sx * 3, sx * 13), 11.0, -3.4), (10, 0.9, 7.5), fe)
        w.cube((min(sx * 3, sx * 13), 11.2, 4.1), (10, 0.5, 2.5), fe2)
        wt = m.bone(f"wingtip_{side}", f"wing_{side}", pivot=(sx * 13, 11.5, -2.5))
        wt.cube((min(sx * 13, sx * 23), 11.1, -3.2), (10, 0.7, 6.5), fe2)
        wt.cube((min(sx * 21, sx * 25), 11.15, -2.6), (4, 0.5, 4.5), flame)
        lg = m.bone(f"leg_{side}", "body", pivot=(sx * 1.6, 6.5, 1))
        lg.box((sx * 1.6, 4.5, 1.2), (0.9, 4, 0.9), beak)
        lg.box((sx * 1.6, 2.3, 0.3), (1.6, 0.5, 2.5), beak)
    tail = m.bone("tail", "body", pivot=(0, 9.5, 4.5), rotation=(-12, 0, 0))
    for i, yaw in enumerate((-22, 0, 22)):
        tb = tail
        tb.box((0, 9.5, 11.5), (1.6, 0.5, 14), fe2 if i != 1 else fe, rotation=(0, yaw, 0), pivot=(0, 9.5, 4.5))
    tail.box((0, 9.5, 19.5), (1.2, 0.6, 3), flame)
    tail2 = m.bone("tail_plume", "tail", pivot=(0, 9.5, 18))
    tail2.box((0, 9.5, 22.2), (2.4, 0.5, 5.5), flame)

    k = "vesper"
    A = dict(phase_anims(k))
    A["look"] = look(k, yaw_clamp=80)
    folded = {"wing_l": bone(rot=[0, 70, -10]), "wingtip_l": bone(rot=[0, 150, 0]),
              "wing_r": bone(rot=[0, -70, 10]), "wingtip_r": bone(rot=[0, -150, 0])}
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {
        **folded,
        "body": bone(scale=[1, osc(0.02, 140, base=1.0), 1]),
        "tail": bone(rot=[osc(4, 80), osc(6, 60), 0]),
        "head": bone(rot=[0, 0, osc(8, 50)]),
    })
    A["walk"] = anim(f"animation.eclipse.{k}.hop", {
        **folded,
        "body": bone(pos=[0, f"math.abs({walk(2.0, freq=40)})", 0]),
        "leg_l": bone(rot=[walk(30, freq=40), 0, 0]),
        "leg_r": bone(rot=[walk(30, freq=40, phase=180), 0, 0]),
    })
    A["run"] = A["walk"]
    A["sit"] = anim(f"animation.eclipse.{k}.perch", {**folded, "body": bone(pos=[0, -2.5, 0]), "neck": bone(rot=[20, 0, 0]),
                                                      "tail": bone(rot=[osc(3, 40), 0, 0])})
    flap = lambda speed, amp, base=0: {
        "wing_l": bone(rot=[0, 0, osc(amp, speed, base=base)]),
        "wingtip_l": bone(rot=[0, 0, osc(amp * 0.7, speed, -60)]),
        "wing_r": bone(rot=[0, 0, osc(-amp, speed, base=-base)]),
        "wingtip_r": bone(rot=[0, 0, osc(-amp * 0.7, speed, -60)]),
    }
    tuck = {"leg_l": bone(rot=[70, 0, 0]), "leg_r": bone(rot=[70, 0, 0])}
    A["fly"] = anim(f"animation.eclipse.{k}.fly", {**flap(520, 42, 6), **tuck,
                                                   "body": bone(pos=[0, osc(0.8, 520, 90), 0], rot=["math.clamp(-q.vertical_speed * 3, -25, 25)", 0, "math.clamp(q.yaw_speed * -0.1, -30, 30)"]),
                                                   "tail": bone(rot=[osc(5, 520, 180), 0, 0])})
    A["glide"] = anim(f"animation.eclipse.{k}.glide", {**flap(80, 5, 6), **tuck, "body": bone(rot=[4, 0, "math.clamp(q.yaw_speed * -0.12, -35, 35)"]),
                                                       "tail": bone(rot=[osc(4, 60), osc(5, 50), 0])})
    A["hover"] = anim(f"animation.eclipse.{k}.hover", {**flap(700, 50, 10), "body": bone(rot=[-25, 0, 0], pos=[0, osc(1, 700, 90), 0]),
                                                       "leg_l": bone(rot=[20, 0, 0]), "leg_r": bone(rot=[20, 0, 0])})
    A["takeoff"] = anim(f"animation.eclipse.{k}.takeoff", {
        "wing_l": bone(rot=smooth_keys([(0, [0, 70, -10]), (0.25, [0, 0, 55]), (0.5, [0, 0, -35])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, -70, 10]), (0.25, [0, 0, -55]), (0.5, [0, 0, 35])])),
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.25, [-30, 0, 0]), (0.5, [0, 0, 0])])),
    }, loop=False, length=0.5)
    A["land"] = anim(f"animation.eclipse.{k}.land", {
        "wing_l": bone(rot=smooth_keys([(0, [0, 0, 50]), (0.35, [0, 0, 60]), (0.7, [0, 70, -10])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, 0, -50]), (0.35, [0, 0, -60]), (0.7, [0, -70, 10])])),
        "body": bone(rot=smooth_keys([(0, [-35, 0, 0]), (0.7, [0, 0, 0])])),
    }, loop=False, length=0.7)
    A["special"] = anim(f"animation.eclipse.{k}.rebirth", {
        "root": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.2, [0, 720, 0])]),
                     scale=smooth_keys([(0, [1, 1, 1]), (0.6, [1.35, 1.35, 1.35]), (1.2, [1, 1, 1])]),
                     pos=smooth_keys([(0, [0, 0, 0]), (0.6, [0, 6, 0]), (1.2, [0, 0, 0])])),
        "wing_l": bone(rot=[0, 0, 40]), "wing_r": bone(rot=[0, 0, -40]),
    }, loop=False, length=1.2, particles=[{"effect": "burst", "locator": "trail"}], sounds=[{"effect": "special"}])
    A["interact"] = anim(f"animation.eclipse.{k}.bow", {
        "neck": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [40, 0, 0]), (1.0, [40, 0, 0]), (1.4, [0, 0, 0])])),
        "wing_l": bone(rot=smooth_keys([(0, [0, 70, -10]), (0.4, [0, 20, 15]), (1.0, [0, 20, 15]), (1.4, [0, 70, -10])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, -70, 10]), (0.4, [0, -20, -15]), (1.0, [0, -20, -15]), (1.4, [0, -70, 10])])),
    }, loop=False, length=1.4)
    A["preen"] = anim(f"animation.eclipse.{k}.preen", {
        "neck": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [10, 80, 0]), (1.4, [10, 80, 0]), (1.8, [0, 0, 0])])),
        "head": bone(rot=[osc(10, 900), 0, 0]),
    }, loop=False, length=1.8)
    return Creature("vesper", "Vesper", "Fênix Sombria",
                    "Ave de chamas violetas frias. Ilumina a noite, cura aliados com suas cinzas e renasce do próprio brilho.",
                    "Renascer: explosão de chamas violetas que cura você e seus aliados.",
                    True, (0.7, 0.9), 30, 5, 0.3, m, A, fidgets=["preen"], fly_speed=0.2,
                    sounds={"ambient": "mob.parrot.idle", "hurt": "mob.parrot.hurt", "death": "mob.parrot.death", "step": "mob.chicken.step"},
                    family=["bird"], emoji="🔥")


# =========================================================================
# 6. CORVUS — Corvos de Exploração
# =========================================================================
def corvus():
    m = Model("geometry.eclipse.corvus", 32, 32, density=6, bounds=(2, 1, (0, 0.4, 0)))
    fe = P("feather", (18, 16, 26), (90, 80, 130), width=0.8, length=4)
    beak = P("metal", (110, 112, 128), SILVER)
    root = m.bone("root")
    root.locators = {"ground": (0, 0.1, 0)}
    body = m.bone("body", "root", pivot=(0, 4, 0))
    body.box((0, 4.4, 0), (3.2, 3.2, 5.2), fe)
    head = m.bone("head", "body", pivot=(0, 6, -2.4))
    head.box((0, 6.9, -3.3), (2.7, 2.6, 2.8), P("feather", (18, 16, 26), (90, 80, 130), width=0.6, length=2,
                                               decals=[("east", "eye_single", {"s": 2.0, "t": 0.9, "r": 0.35}), ("west", "eye_single", {"s": 0.8, "t": 0.9, "r": 0.35})]))
    head.box((0, 6.6, -5.3), (0.9, 0.9, 1.6), beak)
    beak_low = m.bone("beak", "head", pivot=(0, 6.2, -4.6))
    beak_low.box((0, 6.0, -5.1), (0.7, 0.4, 1.2), beak)
    for side, sx in (("l", 1), ("r", -1)):
        w = m.bone(f"wing_{side}", "body", pivot=(sx * 1.6, 5.4, -1.6))
        w.cube((min(sx * 1.6, sx * 7.6), 5.1, -2.0), (6, 0.5, 4.4), fe)
        lg = m.bone(f"leg_{side}", "body", pivot=(sx * 0.8, 2.9, 0.5))
        lg.box((sx * 0.8, 1.9, 0.5), (0.4, 2.0, 0.4), beak)
        lg.box((sx * 0.8, 0.8, 0.1), (0.9, 0.3, 1.4), beak)
    tail = m.bone("tail", "body", pivot=(0, 4.6, 2.6), rotation=(-10, 0, 0))
    tail.box((0, 4.6, 4.6), (2.6, 0.5, 4), fe)

    k = "corvus"
    A = dict(phase_anims(k, rise=0.8))
    A["look"] = look(k, yaw_clamp=90)
    folded = {"wing_l": bone(rot=[0, 75, -8]), "wing_r": bone(rot=[0, -75, 8])}
    A["idle"] = anim(f"animation.eclipse.{k}.idle", {**folded,
                                                    "head": bone(rot=[0, 0, "math.sin(q.anim_time * 90) > 0.6 ? 25 : 0"]),
                                                    "tail": bone(rot=[osc(6, 200), 0, 0])})
    A["walk"] = anim(f"animation.eclipse.{k}.hop", {**folded, "body": bone(pos=[0, f"math.abs({walk(1.2, freq=60)})", 0])})
    A["run"] = A["walk"]
    A["sit"] = anim(f"animation.eclipse.{k}.perch", {**folded, "body": bone(pos=[0, -1, 0])})
    A["fly"] = anim(f"animation.eclipse.{k}.fly", {
        "wing_l": bone(rot=[0, 0, osc(55, 900)]), "wing_r": bone(rot=[0, 0, osc(-55, 900)]),
        "leg_l": bone(rot=[70, 0, 0]), "leg_r": bone(rot=[70, 0, 0]),
        "body": bone(rot=["math.clamp(-q.vertical_speed * 4, -30, 30)", 0, "math.clamp(q.yaw_speed * -0.15, -40, 40)"])})
    A["glide"] = anim(f"animation.eclipse.{k}.glide", {
        "wing_l": bone(rot=[0, 0, osc(4, 120, base=8)]), "wing_r": bone(rot=[0, 0, osc(-4, 120, base=-8)]),
        "leg_l": bone(rot=[70, 0, 0]), "leg_r": bone(rot=[70, 0, 0]),
        "body": bone(rot=[6, 0, "math.clamp(q.yaw_speed * -0.15, -40, 40)"])})
    A["hover"] = anim(f"animation.eclipse.{k}.hover", {
        "wing_l": bone(rot=[0, 0, osc(60, 1100, base=10)]), "wing_r": bone(rot=[0, 0, osc(-60, 1100, base=-10)]),
        "body": bone(rot=[-30, 0, 0])})
    A["takeoff"] = anim(f"animation.eclipse.{k}.takeoff", {
        "wing_l": bone(rot=smooth_keys([(0, [0, 75, -8]), (0.15, [0, 0, 60]), (0.3, [0, 0, -40])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, -75, 8]), (0.15, [0, 0, -60]), (0.3, [0, 0, 40])]))}, loop=False, length=0.3)
    A["land"] = anim(f"animation.eclipse.{k}.land", {
        "wing_l": bone(rot=smooth_keys([(0, [0, 0, 60]), (0.4, [0, 75, -8])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, 0, -60]), (0.4, [0, -75, 8])]))}, loop=False, length=0.4)
    A["special"] = anim(f"animation.eclipse.{k}.caw", {
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.2, [-35, 0, 0]), (0.6, [-35, 0, 0]), (0.8, [0, 0, 0])])),
        "beak": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.2, [30, 0, 0]), (0.6, [30, 0, 0]), (0.8, [0, 0, 0])])),
        "wing_l": bone(rot=smooth_keys([(0, [0, 75, -8]), (0.2, [0, 20, 30]), (0.6, [0, 20, 30]), (0.8, [0, 75, -8])])),
        "wing_r": bone(rot=smooth_keys([(0, [0, -75, 8]), (0.2, [0, -20, -30]), (0.6, [0, -20, -30]), (0.8, [0, -75, 8])])),
    }, loop=False, length=0.8, sounds=[{"effect": "special"}])
    A["interact"] = anim(f"animation.eclipse.{k}.hop_happy", {
        "body": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.15, [0, 2, 0]), (0.3, [0, 0, 0]), (0.45, [0, 2, 0]), (0.6, [0, 0, 0])])),
        "head": bone(rot=[0, 0, osc(20, 600)]),
    }, loop=False, length=0.6)
    return Creature("corvus", "Corvus", "Corvos de Exploração",
                    "Bando de três corvos de bico prateado. Exploram a região e voltam contando o que viram.",
                    "Batedores: exploram ao redor e reportam biomas, vilas e perigos.",
                    True, (0.45, 0.5), 12, 3, 0.3, m, A, fly_speed=0.26,
                    sounds={"ambient": "mob.parrot.idle", "hurt": "mob.parrot.hurt", "death": "mob.parrot.death", "step": "mob.chicken.step"},
                    family=["bird", "scout"], emoji="🐦", group=3)
