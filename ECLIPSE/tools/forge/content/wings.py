"""Four 3D wing sets worn in the chest slot (attachables)."""
from __future__ import annotations

from ..anim import anim, bone, keys, osc, smooth_keys
from ..geom import Model
from ..palette import *  # noqa: F401,F403
from .creatures import P

WINGS = {
    "wings_shadow": ("Asas Negras", "Penas negras como a noite sem lua, com pontas violetas."),
    "wings_celestial": ("Asas Celestiais", "Penas de prata e ouro que brilham como o amanhecer."),
    "wings_void": ("Asas do Vazio", "Lâminas de energia violeta presas a cristais flutuantes."),
    "wings_dragon": ("Asas de Dragão", "Membranas couraçadas com garras de osso."),
}


def _feather_wing(m, side, sx, feather, feather2, arm, accent, n_inner=5, n_outer=6):
    w = m.bone(f"wing_{side}", "wings", pivot=(sx * 1.5, 22.5, 3.0))
    # arm (leading edge)
    w.cube((min(sx * 1.5, sx * 11.5), 22.0, 2.6), (10, 1.6, 1.4), arm)
    for i in range(n_inner):
        x0 = 2.0 + i * 1.9
        length = 8.5 - i * 0.4
        w.cube((min(sx * x0, sx * (x0 + 1.9)), 22.0 - length, 2.9), (1.9, length, 0.45), feather if i % 2 == 0 else feather2)
    tip = m.bone(f"wingtip_{side}", f"wing_{side}", pivot=(sx * 11.5, 22.6, 3.0))
    tip.cube((min(sx * 11.5, sx * 20.5), 22.1, 2.7), (9, 1.3, 1.2), arm)
    for i in range(n_outer):
        x0 = 11.6 + i * 1.6
        length = 11.0 - abs(i - 1.5) * 0.9
        tip.cube((min(sx * x0, sx * (x0 + 1.6)), 22.3 - length, 3.0), (1.6, length, 0.4), feather2 if i % 2 else feather,
                 rotation=(0, 0, sx * (8 + i * 4)), pivot=(sx * (x0 + 0.8), 22.3, 3.2))
    tip.cube((min(sx * 20.2, sx * 21.6), 21.6, 2.6), (1.4, 1.6, 1.4), accent)


def _membrane_wing(m, side, sx, spar, mem, claw, glow_edge):
    w = m.bone(f"wing_{side}", "wings", pivot=(sx * 1.5, 22.5, 3.0))
    w.cube((min(sx * 1.5, sx * 11.5), 22.0, 2.6), (10, 1.4, 1.4), spar)
    w.cube((min(sx * 2.0, sx * 11.5), 14.0, 3.1), (9.5, 8.0, 0.35), mem)
    tip = m.bone(f"wingtip_{side}", f"wing_{side}", pivot=(sx * 11.5, 22.6, 3.0))
    for i, (ang, ln) in enumerate(((10, 10), (35, 11), (60, 10))):
        tip.cube((min(sx * 11.5, sx * (11.5 + ln)), 22.0, 2.7), (ln, 0.9, 0.9), spar,
                 rotation=(0, 0, sx * -ang), pivot=(sx * 11.5, 22.4, 3.1))
    tip.cube((min(sx * 11.5, sx * 20.5), 12.5, 3.15), (9, 9.5, 0.3), mem)
    tip.cube((min(sx * 11.5, sx * 12.9), 23.0, 2.6), (1.4, 2.2, 1.4), claw)
    if glow_edge:
        tip.cube((min(sx * 12.0, sx * 20.5), 12.3, 3.0), (8.5, 0.4, 0.5), glow_edge)


def wing_model(key):
    m = Model(f"geometry.eclipse.{key}", 64, 64, density=5, bounds=(4, 3, (0, 1.5, 0)))
    m.bone("waist", pivot=(0, 12, 0))
    m.bone("body", "waist", pivot=(0, 24, 0))
    wings = m.bone("wings", "body", pivot=(0, 22.5, 2.5))
    wings.locators = {"back": (0, 21, 3.5)}
    harness = P("metal", (40, 36, 54), (140, 130, 170))
    wings.cube((-2.0, 20.5, 2.0), (4, 3, 1.2), harness)
    if key == "wings_shadow":
        f1 = P("feather", (20, 16, 30), (150, 80, 240), width=1.9, length=10)
        f2 = P("feather", (14, 12, 22), (120, 60, 210), width=1.6, length=11)
        arm = P("feather", (24, 20, 36), (90, 70, 130), width=1.0, length=2)
        acc = P("glow", VIOLET, VIOLET_HI)
        for side, sx in (("l", 1), ("r", -1)):
            _feather_wing(m, side, sx, f1, f2, arm, acc)
        wings.cube((-0.8, 21.0, 2.0), (1.6, 1.6, 1.4), acc)
    elif key == "wings_celestial":
        f1 = P("feather", (200, 204, 222), (255, 250, 235), width=1.9, length=10)
        f2 = P("feather", (176, 180, 200), (255, 236, 170), width=1.6, length=11)
        arm = P("metal", (170, 128, 50), (255, 230, 150))
        acc = P("glow", (255, 220, 120), (255, 250, 220))
        for side, sx in (("l", 1), ("r", -1)):
            _feather_wing(m, side, sx, f1, f2, arm, acc)
        wings.cube((-0.8, 21.0, 2.0), (1.6, 1.6, 1.4), acc)
    elif key == "wings_void":
        spar = P("crystal", (70, 30, 140), (230, 200, 255))
        mem = P("glow", (110, 40, 220), (220, 170, 255))
        for side, sx in (("l", 1), ("r", -1)):
            w = m.bone(f"wing_{side}", "wings", pivot=(sx * 1.5, 22.5, 3.0))
            w.cube((min(sx * 1.5, sx * 11.5), 22.0, 2.6), (10, 1.2, 1.2), spar)
            for i in range(4):
                x0 = 2.5 + i * 2.3
                ln = 7.5 - i * 0.6
                w.cube((min(sx * x0, sx * (x0 + 1.6)), 21.4 - ln, 3.0), (1.6, ln, 0.3), mem)
            tip = m.bone(f"wingtip_{side}", f"wing_{side}", pivot=(sx * 11.5, 22.6, 3.0))
            tip.cube((min(sx * 11.5, sx * 20.5), 22.0, 2.7), (9, 1.0, 1.0), spar)
            for i in range(5):
                x0 = 12.0 + i * 1.8
                ln = 10.5 - abs(i - 1) * 1.1
                tip.cube((min(sx * x0, sx * (x0 + 1.3)), 21.8 - ln, 3.0), (1.3, ln, 0.3), mem,
                         rotation=(0, 0, sx * (6 + i * 5)), pivot=(sx * (x0 + 0.6), 21.8, 3.1))
            tip.cube((min(sx * 21.0, sx * 23.0), 21.4, 2.4), (2.0, 2.0, 2.0), spar, rotation=(45, 0, 45), pivot=(sx * 22, 22.4, 3.4))
        wings.cube((-1.0, 20.8, 2.0), (2, 2, 1.6), spar)
    else:  # dragon
        spar = P("bone", (60, 48, 70))
        mem = P("membrane", (34, 18, 50), (130, 60, 200))
        claw = P("bone", (210, 200, 220))
        glow = P("glow", VIOLET, VIOLET_HI)
        for side, sx in (("l", 1), ("r", -1)):
            _membrane_wing(m, side, sx, spar, mem, claw, glow)
    return m


def wing_anims(key):
    k = key
    closed = {"wing_l": bone(rot=[osc(1.5, 60, base=8), 72, -18]), "wing_r": bone(rot=[osc(1.5, 60, base=8), -72, 18]),
              "wingtip_l": bone(rot=[0, 95, 0]), "wingtip_r": bone(rot=[0, -95, 0]),
              "wings": bone(scale=0.9)}
    spread = lambda zl=4, zt=0: {"wing_l": bone(rot=[0, 18, zl]), "wing_r": bone(rot=[0, -18, -zl]),
                                 "wingtip_l": bone(rot=[0, 12, zt]), "wingtip_r": bone(rot=[0, -12, -zt])}
    A = {
        "closed": (f"animation.eclipse.{k}.closed", {"loop": True, "bones": closed}),
        "opening": (f"animation.eclipse.{k}.opening", {"loop": "hold_on_last_frame", "animation_length": 0.4, "bones": {
            "wing_l": {"rotation": smooth_keys([(0, [8, 72, -18]), (0.25, [0, 10, 30]), (0.4, [0, 18, 4])])},
            "wing_r": {"rotation": smooth_keys([(0, [8, -72, 18]), (0.25, [0, -10, -30]), (0.4, [0, -18, -4])])},
            "wingtip_l": {"rotation": smooth_keys([(0, [0, 95, 0]), (0.3, [0, 0, 20]), (0.4, [0, 12, 0])])},
            "wingtip_r": {"rotation": smooth_keys([(0, [0, -95, 0]), (0.3, [0, 0, -20]), (0.4, [0, -12, 0])])},
            "wings": {"scale": smooth_keys([(0, 0.9), (0.4, 1.0)])}}}),
        "flap": (f"animation.eclipse.{k}.flap", {"loop": True, "bones": {
            "wing_l": {"rotation": [0, osc(10, 420, 90, base=12), osc(38, 420, base=6)]},
            "wing_r": {"rotation": [0, osc(-10, 420, 90, base=-12), osc(-38, 420, base=-6)]},
            "wingtip_l": {"rotation": [0, 10, osc(26, 420, -55)]},
            "wingtip_r": {"rotation": [0, -10, osc(-26, 420, -55)]}}}),
        "glide": (f"animation.eclipse.{k}.glide", {"loop": True, "bones": {
            **{b: {"rotation": v["rotation"]} for b, v in spread(6, 4).items()},
            "wing_l": {"rotation": [osc(2, 90), 16, osc(3, 70, base=8)]},
            "wing_r": {"rotation": [osc(2, 90), -16, osc(-3, 70, base=-8)]}}}),
        "closing": (f"animation.eclipse.{k}.land", {"loop": "hold_on_last_frame", "animation_length": 0.6, "bones": {
            "wing_l": {"rotation": smooth_keys([(0, [0, 18, 4]), (0.2, [-15, -10, 40]), (0.6, [8, 72, -18])])},
            "wing_r": {"rotation": smooth_keys([(0, [0, -18, -4]), (0.2, [-15, 10, -40]), (0.6, [8, -72, 18])])},
            "wingtip_l": {"rotation": smooth_keys([(0, [0, 12, 0]), (0.25, [0, -10, 25]), (0.6, [0, 95, 0])])},
            "wingtip_r": {"rotation": smooth_keys([(0, [0, -12, 0]), (0.25, [0, 10, -25]), (0.6, [0, -95, 0])])},
            "wings": {"scale": smooth_keys([(0, 1.0), (0.6, 0.9)])}}}),
    }
    air = "v.eclipse_air > 0.7"
    ctrl = (f"controller.animation.eclipse.{k}", {"initial_state": "closed", "states": {
        "closed": {"animations": ["closed"], "transitions": [{"opening": air}], "blend_transition": 0.2},
        "opening": {"animations": ["opening"], "transitions": [{"closing": "q.is_on_ground"}, {"flap": "q.all_animations_finished && q.vertical_speed > 0.6"}, {"glide": "q.all_animations_finished"}]},
        "flap": {"animations": ["flap"], "transitions": [{"closing": "q.is_on_ground"}, {"glide": "q.vertical_speed < 0.2"}], "blend_transition": 0.3},
        "glide": {"animations": ["glide"], "transitions": [{"closing": "q.is_on_ground"}, {"flap": "q.vertical_speed > 0.8"}], "blend_transition": 0.35},
        "closing": {"animations": ["closing"], "transitions": [{"opening": f"!q.is_on_ground && {air}"}, {"closed": "q.all_animations_finished"}]},
    }})
    return A, ctrl
