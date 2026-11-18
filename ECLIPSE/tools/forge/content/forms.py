"""Metamorphosis forms.

Bedrock does not let an add-on swap the player's own skeleton through stable
APIs, so a form is a *worn* attachable (chest slot, locked by script) that
renders a full creature rig around the player while the script hides the
player's skin with an invisibility effect. Movement queries of the wearer
(distance moved, speed, ground state) drive the creature's gait.
"""
from __future__ import annotations

from ..anim import anim, bone, keys, osc, smooth_keys, walk
from ..geom import Model, clone
from ..palette import *  # noqa: F401,F403
from .creatures import P
from .creatures import umbra
from .creatures2 import aegis, nyx
from .creatures3 import golem, serpent

FORMS = {
    "wolf": ("Forma: Lobo", "Velocidade e faro aguçado. Uivo enfraquece monstros."),
    "panther": ("Forma: Pantera", "Furtiva e veloz. Bote: avança e golpeia."),
    "eagle": ("Forma: Águia", "Voo planado. Ascensão: dispara para o alto."),
    "serpent": ("Forma: Serpente", "Respira na água. Veneno: envenena ao redor."),
    "titan": ("Forma: Titã Sombrio", "Força e resistência colossais. Impacto Sísmico."),
    "guardian": ("Forma: Guardião", "Defesa máxima. Muralha: resistência e repulsão."),
}


def eagle_model():
    m = Model("geometry.eclipse.eagle_src", 64, 64, density=4)
    fe = P("feather", (34, 28, 40), (150, 130, 170), width=1.6, length=8)
    fe_w = P("feather", (220, 220, 232), (255, 255, 255), width=1.2, length=4)
    gold = P("metal", (170, 128, 50), (255, 230, 150))
    root = m.bone("root")
    root.locators = {"ground": (0, 0.2, 0)}
    body = m.bone("body", "root", pivot=(0, 14, 0))
    body.box((0, 14.5, 0), (8, 8, 13), fe)
    neck = m.bone("neck", "body", pivot=(0, 18, -6), rotation=(-20, 0, 0))
    neck.box((0, 19.5, -7.0), (5.5, 6, 5), fe_w)
    head = m.bone("head", "neck", pivot=(0, 22, -8), rotation=(20, 0, 0))
    head.box((0, 23.5, -9.5), (5.6, 5, 6), P("feather", (220, 220, 232), (255, 255, 255), width=1.0, length=3,
                                             decals=[("east", "eye_single", {"s": 4.2, "t": 1.6, "r": 0.55, "color": (255, 200, 80)}),
                                                     ("west", "eye_single", {"s": 1.8, "t": 1.6, "r": 0.55, "color": (255, 200, 80)})]))
    head.box((0, 22.8, -13.4), (2.2, 2.4, 2.6), gold)
    head.box((0, 21.6, -14.2), (1.4, 1.4, 1.2), gold)
    for side, sx in (("l", 1), ("r", -1)):
        w = m.bone(f"wing_{side}", "body", pivot=(sx * 4, 17.5, -3))
        w.cube((min(sx * 4, sx * 18), 16.8, -5.5), (14, 1.2, 10), fe)
        wt = m.bone(f"wingtip_{side}", f"wing_{side}", pivot=(sx * 18, 17.5, -3))
        wt.cube((min(sx * 18, sx * 30), 17.0, -5.0), (12, 0.8, 9), P("feather", (24, 20, 30), (120, 100, 150), width=1.6, length=9))
        lg = m.bone(f"leg_{side}", "body", pivot=(sx * 2.2, 10.5, 2))
        lg.box((sx * 2.2, 7.5, 2.0), (2.0, 6, 2.0), P("feather", (34, 28, 40), (150, 130, 170)))
        lg.box((sx * 2.2, 2.6, 1.6), (1.2, 4.2, 1.2), gold)
        lg.box((sx * 2.2, 0.6, 0.8), (2.6, 1.2, 3.2), gold)
    tail = m.bone("tail", "body", pivot=(0, 14, 6.5), rotation=(-15, 0, 0))
    tail.box((0, 14, 11.5), (7, 1.0, 10), fe)
    return m


def form_model(key):
    src = {"wolf": (umbra, 1.3), "panther": (nyx, 1.35), "serpent": (serpent, 1.4), "titan": (golem, 0.82), "guardian": (aegis, 0.86)}
    if key == "eagle":
        base, sc = eagle_model(), 1.0
        anims_src = {}
    else:
        fn, sc = src[key]
        c = fn()
        base = c.model
        anims_src = c.anims
    m = clone(base, f"geometry.eclipse.form_{key}", prefix="f_", scale=sc, density=4 if key not in ("titan", "guardian") else 3)
    return m, anims_src, sc


def _rename(bones, prefix="f_"):
    return {prefix + b: v for b, v in bones.items()}


def form_anims(key, anims_src, sc):
    k = f"form_{key}"
    A = {}
    if key == "eagle":
        flap = {"f_wing_l": bone(rot=[0, 0, osc(34, 380)]), "f_wing_r": bone(rot=[0, 0, osc(-34, 380)]),
                "f_wingtip_l": bone(rot=[0, 0, osc(20, 380, -50)]), "f_wingtip_r": bone(rot=[0, 0, osc(-20, 380, -50)]),
                "f_leg_l": bone(rot=[60, 0, 0]), "f_leg_r": bone(rot=[60, 0, 0])}
        A["idle"] = (f"animation.eclipse.{k}.idle", {"loop": True, "bones": {
            "f_wing_l": bone(rot=[0, 60, -10]), "f_wing_r": bone(rot=[0, -60, 10]),
            "f_wingtip_l": bone(rot=[0, 120, 0]), "f_wingtip_r": bone(rot=[0, -120, 0]),
            "f_head": bone(rot=[0, osc(15, 40), 0])}})
        A["walk"] = (f"animation.eclipse.{k}.walk", {"loop": True, "bones": {
            "f_leg_l": bone(rot=[walk(30), 0, 0]), "f_leg_r": bone(rot=[walk(30, phase=180), 0, 0]),
            "f_body": bone(rot=[0, 0, walk(5)])}})
        A["run"] = A["walk"]
        A["air"] = (f"animation.eclipse.{k}.air", {"loop": True, "bones": {
            **flap, "f_body": bone(rot=["math.clamp(-q.vertical_speed * 3, -25, 25)", 0, 0])}})
    else:
        def ren(name):
            n, d = anims_src[name]
            bones = {}
            for b, v in d.get("bones", {}).items():
                if b == "root":
                    continue
                bones["f_" + b] = v
            out = {"loop": d.get("loop", True), "bones": bones}
            if "animation_length" in d:
                out["animation_length"] = d["animation_length"]
            return (n.replace(f"animation.eclipse.", f"animation.eclipse.{k}."), out)
        A["idle"] = ren("idle")
        A["walk"] = ren("walk")
        A["run"] = ren("run")
        jump_bones = {("f_body" if key != "serpent" else "f_seg0"): bone(rot=[-12, 0, 0])}
        A["air"] = (f"animation.eclipse.{k}.air", {"loop": True, "bones": jump_bones})
    A["hide_fp"] = (f"animation.eclipse.{k}.hide_fp", {"loop": True, "bones": {"f_root": {"scale": 0.0}}})
    A["shift"] = (f"animation.eclipse.{k}.shift", {"loop": "hold_on_last_frame", "animation_length": 0.9, "bones": {
        "f_root": {"scale": smooth_keys([(0, [0.1, 0.1, 0.1]), (0.5, [1.12, 0.9, 1.12]), (0.9, [1, 1, 1])]),
                   "rotation": smooth_keys([(0, [0, 180, 0]), (0.9, [0, 0, 0])])}},
        "particle_effects": [{"effect": "shift", "locator": "ground"}]})
    ctrl = (f"controller.animation.eclipse.{k}.move", {"initial_state": "default", "states": {
        "default": {"animations": ["idle"], "transitions": [{"air": "!q.is_on_ground"}, {"run": "q.modified_move_speed > 0.8 && q.is_sprinting"}, {"walk": "q.modified_move_speed > 0.1"}], "blend_transition": 0.25},
        "walk": {"animations": ["walk"], "transitions": [{"air": "!q.is_on_ground"}, {"run": "q.is_sprinting"}, {"default": "q.modified_move_speed < 0.05"}], "blend_transition": 0.2},
        "run": {"animations": ["run"], "transitions": [{"air": "!q.is_on_ground"}, {"walk": "!q.is_sprinting"}], "blend_transition": 0.2},
        "air": {"animations": ["air"], "transitions": [{"default": "q.is_on_ground"}], "blend_transition": 0.25},
    }})
    return A, ctrl
