"""Animações das formas do DR-0N e do robô-soldado (Molang contínuo = suave em qualquer FPS).

Variáveis calculadas em pre_animation (cliente, a cada quadro):
  v.form  forma atual (0 drone … 8 torreta)      v.tf   segundos desde a última transformação
  v.wheel ângulo acumulado das rodas              v.lean inclinação suavizada pela curva
  v.aim   mira (graus) da torre/cabine            v.gspin giro da metralhadora rotativa
"""
from __future__ import annotations

from .anim import anim, bone, controller, keys, osc, r, smooth_keys, walk


def cwalk(amp, freq, phase=0.0, base=0.0):
    """Passada do colosso pela distância andada (script move por impulso, então calculamos v.cwd)."""
    ph = f" + {r(phase)}" if phase else ""
    b = f"{r(base)} + " if base else ""
    return f"{b}math.cos(v.cwd * {r(freq)}{ph}) * {r(amp)} * v.cws"

P = "animation.lila.form"
ACT = "q.property('lila:action')"
FORM_IDS = {"drone": 0, "heli": 1, "car": 2, "excavator": 3, "tank": 4, "jet": 5, "moto": 6, "colossus": 7, "turret": 8}

INITIALIZE = ["v.dtilt = 0; v.htilt = 0; v.jpitch = 0; v.aims = 0; v.pits = 0; v.cwd = 0; v.cws = 0; v.wheel = 0; v.pby = q.body_y_rotation; v.lean = 0; v.tf = 9; v.pf = q.property('lila:form'); v.gspin = 0; v.gear = 1;"]
PRE_ANIMATION = [
    "v.form = q.property('lila:form');",
    "v.tf = (v.form != v.pf) ? 0 : v.tf + q.delta_time; v.pf = v.form;",
    "v.dir = (q.property('lila:move') == 'sneak') ? -1 : 1;",
    "v.wheel = v.wheel + q.ground_speed * math.min(q.delta_time, 0.1) * 160 * v.dir;",
    "v.dy = math.mod(q.body_y_rotation - v.pby + 540, 360) - 180; v.pby = q.body_y_rotation;",
    "v.lean = math.lerp(v.lean, math.clamp(v.dy / math.max(q.delta_time, 0.016) * 0.12, -30, 30), 0.08);",
    "v.aim = q.property('lila:aim');",
    f"v.gspin = v.gspin + math.min(q.delta_time, 0.1) * (({ACT} == 'shoot') ? 2400 : 90);",
    "v.gear = math.lerp(v.gear, q.is_on_ground ? 1 : 0, 0.06);",
    "v.cwd = v.cwd + q.ground_speed * math.min(q.delta_time, 0.1) / 3.4; v.cws = math.lerp(v.cws, math.min(1, q.ground_speed / 2.5), 0.12);",
    # suavizações: inclinação do drone/heli/jato e mira das torres giram macio (sem estalar)
    "v.dtilt = math.lerp(v.dtilt, math.clamp(q.ground_speed * 2.4, 0, 24), 0.08);",
    "v.htilt = math.lerp(v.htilt, math.clamp(q.ground_speed * 1.6, 0, 18), 0.08);",
    "v.jpitch = math.lerp(v.jpitch, math.clamp(-q.vertical_speed * 2.2, -28, 28), 0.1);",
    "v.aims = v.aims + (math.mod(v.aim - v.aims + 540, 360) - 180) * 0.2;",
    "v.pits = math.lerp(v.pits, q.property('lila:pitch'), 0.2);",
]


def form_anims():
    A = {}

    def add(name, bones, **kw):
        n, a = anim(f"{P}.{name}", bones, **kw)
        A[name] = (n, a)

    # ---------------- transformação: a forma nova "monta" girando e crescendo
    add("intro", {"root": bone(
        scale="v.tf < 1.0 ? (math.min(1, 0.15 + v.tf * 1.9) + math.sin(math.min(v.tf, 1) * 540) * 0.07 * (1 - v.tf)) : 1",
        rot=[0, "v.tf < 0.7 ? (1 - v.tf / 0.7) * 540 : 0", 0])})
    add("intro_colossus", {"root": bone(
        scale="v.tf < 2.2 ? math.min(1, 0.3 + v.tf * 0.4) : 1",
        pos=[0, "v.tf < 2.2 ? -(1 - v.tf / 2.2) * 40 : 0", 0])})

    # ---------------- helicóptero
    add("heli", {
        "rotor_main": bone(rot=[0, "q.anim_time * 1620", 0]),
        "rotor_tail": bone(rot=["q.anim_time * 2200", 0, 0]),
        "body": bone(rot=["v.htilt", 0, "-v.lean * 0.6"]),
        "root": bone(pos=[0, "q.is_on_ground ? 0 : math.sin(q.anim_time * 100) * 0.5", 0]),
    })
    add("heli_fire", {"body": bone(pos=[0, 0, osc(0.4, 2400)])}, loop=True)

    # ---------------- carro
    spin = "v.wheel"
    add("car", {
        "wheel_fl": bone(rot=[spin, "math.clamp(-v.lean * 1.4, -28, 28)", 0]),
        "wheel_fr": bone(rot=[spin, "math.clamp(-v.lean * 1.4, -28, 28)", 0]),
        "wheel_rl": bone(rot=[spin, 0, 0]),
        "wheel_rr": bone(rot=[spin, 0, 0]),
        "body": bone(rot=["math.sin(q.anim_time * 900) * 0.25 * math.min(1, q.ground_speed / 4)", 0, "v.lean * 0.18"],
                     pos=[0, "math.sin(q.anim_time * 1100) * 0.08", 0]),
    })

    # ---------------- escavadeira
    add("excavator", {
        "cab": bone(rot=[0, "v.aims", 0]),
        "boom": bone(rot=[osc(1.2, 60), 0, 0]),
        "tracks": bone(pos=[0, "math.sin(q.anim_time * 1400) * 0.12 * math.min(1, q.ground_speed)", 0]),
    })
    add("exc_dig", {
        "boom": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [22, 0, 0]), (0.6, [10, 0, 0]), (0.9, [-8, 0, 0]), (1.2, [0, 0, 0])])),
        "stick": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-30, 0, 0]), (0.6, [20, 0, 0]), (0.9, [10, 0, 0]), (1.2, [0, 0, 0])])),
        "bucket": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-40, 0, 0]), (0.6, [35, 0, 0]), (0.9, [45, 0, 0]), (1.2, [0, 0, 0])])),
    }, loop=True, length=1.2)

    # ---------------- tanque
    add("tank", {
        "turret": bone(rot=[0, "v.aims", 0]),
        "hull": bone(rot=["math.sin(q.anim_time * 700) * 0.3 * math.min(1, q.ground_speed / 3)", 0, "v.lean * 0.08"]),
    })
    add("tank_fire", {
        "barrel": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.05, [0, 0, 6]), (0.6, [0, 0, 0])])),
        "turret": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.05, [-3, 0, 0]), (0.5, [0, 0, 0])])),
        "hull": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.06, [-2, 0, 0]), (0.5, [0, 0, 0])])),
    }, loop="hold", length=0.7)

    # ---------------- jato
    add("jet", {
        "flame": bone(scale=["0.5 + math.min(1, q.ground_speed / 18) * 0.9 + math.sin(q.anim_time * 2600) * 0.06"] * 3),
        "gear": bone(scale="v.gear", pos=[0, "(1 - v.gear) * 4", 0]),
        "body": bone(rot=["v.jpitch", 0, "v.lean * 1.4"]),
    })
    add("jet_missile", {"body": bone(pos=[0, 0, osc(0.6, 1800)])}, loop=True)

    # ---------------- moto
    add("moto", {
        "wheel_f": bone(rot=["v.wheel * 1.4", 0, 0]),
        "wheel_r": bone(rot=["v.wheel * 1.4", 0, 0]),
        "fork": bone(rot=[0, "math.clamp(-v.lean * 0.9, -22, 22)", 0]),
        "root": bone(rot=[0, 0, "v.lean * 1.1"]),
        "body": bone(rot=["-math.clamp(q.ground_speed * 0.25, 0, 4)", 0, 0]),
    })

    # ---------------- torreta gigante
    add("turret_g", {
        "yaw": bone(rot=[0, "v.aims", 0]),
        "pitch": bone(rot=["-v.pits", 0, 0]),
        "gatling": bone(rot=[0, 0, "v.gspin"]),
        "radar": bone(rot=[0, "q.anim_time * 140", 0]),
        "root": bone(scale="1 + (v.tf < 0.6 ? math.sin(v.tf * 300) * 0.04 : 0)"),
    })
    add("turret_fire", {"gatling": bone(pos=[0, 0, osc(0.7, 3000, base=0.7)]),
                        "yaw": bone(pos=[osc(0.15, 2600), 0, 0])}, loop=True)
    add("turret_missile", {
        "pod_l": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.05, [0, 0, 3]), (0.5, [0, 0, 0])])),
        "pod_r": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.15, [0, 0, 3]), (0.6, [0, 0, 0])])),
    }, loop="hold", length=0.7)

    # ---------------- colosso
    # passada pesada pela distância andada (os pés não escorregam), corpo balança e a cauda ondula
    F = 60.0
    add("col_idle", {
        "torso": bone(rot=[osc(1.2, 50, base=6), 0, 0], pos=[0, osc(0.5, 50), 0]),
        "head": bone(rot=[osc(2, 40, base=-4), osc(6, 23), 0]),
        "jaw": bone(rot=[osc(1.5, 47, base=2), 0, 0]),
        **{f"tail{i}": bone(rot=[osc(1.5, 38, phase=i * 40, base=-4 if i == 1 else 3), osc(6 + i * 2, 34, phase=i * 55), 0]) for i in range(1, 5)},
        "dorsal_glow": bone(scale=[1, "1 + math.sin(q.anim_time * 120) * 0.04", 1]),
        "arm_l": bone(rot=[osc(2, 50, base=-6), 0, osc(1.5, 50, base=-8)]),
        "arm_r": bone(rot=[osc(2, 50, phase=40, base=-6), 0, osc(1.5, 50, phase=40, base=8)]),
        "forearm_l": bone(rot=[-18, 0, 0]), "forearm_r": bone(rot=[-18, 0, 0]),
    })
    add("col_walk", {
        "thigh_l": bone(rot=[cwalk(26, F), 0, 0]),
        "thigh_r": bone(rot=[cwalk(26, F, phase=180), 0, 0]),
        "shin_l": bone(rot=[cwalk(-18, F, phase=70, base=6), 0, 0]),
        "shin_r": bone(rot=[cwalk(-18, F, phase=250, base=6), 0, 0]),
        "foot_l": bone(rot=[cwalk(14, F, phase=140), 0, 0]),
        "foot_r": bone(rot=[cwalk(14, F, phase=320), 0, 0]),
        "hips": bone(pos=[0, f"math.abs(math.cos(v.cwd * {F})) * 2.2 * v.cws", 0],
                     rot=[0, cwalk(5, F), cwalk(3, F)]),
        "torso": bone(rot=[0, cwalk(-6, F), cwalk(-3, F)]),
        "arm_l": bone(rot=[cwalk(-22, F), 0, 0]),
        "arm_r": bone(rot=[cwalk(-22, F, phase=180), 0, 0]),
        **{f"tail{i}": bone(rot=[0, cwalk(8 + i * 3, F, phase=60 + i * 45), 0]) for i in range(1, 5)},
    })
    add("col_punch", {
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.25, [-150, -20, 30]), (0.42, [-70, 10, 0]), (0.9, [0, 0, 0])])),
        "forearm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.25, [-60, 0, 0]), (0.42, [0, 0, 0]), (0.9, [0, 0, 0])])),
        "torso": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.25, [-8, 18, 0]), (0.42, [14, -22, 0]), (0.9, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.25, [-10, 0, 0]), (0.42, [8, 0, 0]), (0.9, [0, 0, 0])])),
        "jaw": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [25, 0, 0]), (0.9, [0, 0, 0])])),
    }, loop="hold", length=0.9)
    add("col_stomp", {
        "hips": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.3, [0, -6, 0]), (0.55, [0, 12, 0]), (0.8, [0, -7, 0]), (1.2, [0, 0, 0])])),
        "thigh_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-30, 0, 0]), (0.55, [-45, 0, 0]), (0.8, [10, 0, 0]), (1.2, [0, 0, 0])])),
        "thigh_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-30, 0, 0]), (0.55, [-45, 0, 0]), (0.8, [10, 0, 0]), (1.2, [0, 0, 0])])),
        "shin_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [40, 0, 0]), (0.55, [50, 0, 0]), (0.8, [-10, 0, 0]), (1.2, [0, 0, 0])])),
        "shin_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [40, 0, 0]), (0.55, [50, 0, 0]), (0.8, [-10, 0, 0]), (1.2, [0, 0, 0])])),
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-60, 0, -40]), (0.8, [20, 0, -10]), (1.2, [0, 0, 0])])),
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-60, 0, 40]), (0.8, [20, 0, 10]), (1.2, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-25, 0, 0]), (0.8, [15, 0, 0]), (1.2, [0, 0, 0])])),
        "jaw": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [40, 0, 0]), (1.2, [0, 0, 0])])),
    }, loop="hold", length=1.2)
    add("col_beam", {
        "jaw": bone(rot=["math.min(1, q.anim_time * 2) * 42", 0, 0]),
        "head": bone(rot=["math.min(1, q.anim_time * 2) * 12 + math.sin(q.anim_time * 2400) * 0.8", osc(1, 1900), 0]),
        "neck": bone(rot=["math.min(1, q.anim_time * 2) * 10", 0, 0]),
        "torso": bone(rot=["math.min(1, q.anim_time * 2) * -6", 0, 0]),
        "dorsal_glow": bone(scale=["1 + math.min(1, q.anim_time) * 0.25", "1 + math.min(1, q.anim_time) * 0.35 + math.sin(q.anim_time * 1500) * 0.08", "1 + math.min(1, q.anim_time) * 0.25"]),
        "arm_l": bone(rot=[-30, 0, -25]), "arm_r": bone(rot=[-30, 0, 25]),
        **{f"tail{i}": bone(rot=[-4 - i * 2, osc(2, 1200, phase=i * 60), 0]) for i in range(1, 5)},
    }, loop=True)
    add("col_roar", {
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [-38, 0, 0]), (1.6, [-34, 8, 0]), (2.2, [0, 0, 0])])),
        "neck": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [-20, 0, 0]), (1.6, [-18, 0, 0]), (2.2, [0, 0, 0])])),
        "jaw": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [48, 0, 0]), (1.7, [44, 0, 0]), (2.2, [0, 0, 0])])),
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-70, 0, -50]), (1.6, [-60, 0, -45]), (2.2, [0, 0, 0])])),
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-70, 0, 50]), (1.6, [-60, 0, 45]), (2.2, [0, 0, 0])])),
        "torso": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [-12, 0, 0]), (1.6, [-10, 0, 0]), (2.2, [0, 0, 0])])),
        "dorsal_glow": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.5, [1.2, 1.4, 1.2]), (1.6, [1.2, 1.4, 1.2]), (2.2, [1, 1, 1])])),
        **{f"tail{i}": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-10, 0, 0]), (1.6, [-8, 0, 0]), (2.2, [0, 0, 0])])) for i in range(1, 5)},
    }, loop="hold", length=2.2)
    add("col_wave", {"arm_l": bone(rot=[-150, 0, osc(25, 360, base=-20)]), "forearm_l": bone(rot=[osc(20, 360, base=-20), 0, 0])}, loop=True)
    add("col_defeat", {"hips": bone(pos=smooth_keys([(0, [0, 0, 0]), (1.4, [0, -30, 0])]), rot=smooth_keys([(0, [0, 0, 0]), (1.4, [30, 0, 0])]))},
        loop="hold", length=1.5)
    return A


def form_controllers():
    """Ações das formas (soco, pisão, raio, rugido, tiro de canhão, mísseis…)."""
    by_action = {
        "work": [("col_punch", 7), ("exc_dig", 3)],
        "place": [("col_stomp", 7)],
        "shoot": [("tank_fire", 4), ("turret_fire", 8), ("heli_fire", 1)],
        "charge": [("col_beam", 7), ("turret_missile", 8), ("jet_missile", 5)],
        "celebrate": [("col_roar", 7)],
        "wave": [("col_wave", 7)],
        "defeat": [("col_defeat", 7)],
    }
    states = {"default": {"blend_transition": 0.15, "transitions": []}}
    for act, lst in by_action.items():
        states["default"]["transitions"].append({act: f"{ACT} == '{act}' && v.form != 0"})
        states[act] = {"animations": [{n: f"v.form == {f}"} for n, f in lst], "blend_transition": 0.2,
                       "transitions": [{"default": f"{ACT} != '{act}' || v.form == 0"}]}
    return [controller("controller.animation.lila.form.action", states)]


# ================================================================= robô-soldado
R = "animation.lila.robot"


def robot_anims():
    A = {}

    def add(name, bones, **kw):
        n, a = anim(f"{R}.{name}", bones, **kw)
        A[name] = (n, a)

    f = 38.17
    add("look", {"head": bone(rot=["q.target_x_rotation", "q.target_y_rotation", 0])})
    add("idle", {"body": bone(rot=[osc(1, 60), 0, 0], pos=[0, osc(0.15, 60), 0]), "rightArm": bone(rot=[osc(2, 60, base=-4), 0, 4]),
                 "leftArm": bone(rot=[osc(2, 60, phase=90, base=-4), 0, -4]), "jet": bone(scale=0.4),
                 "head": bone(rot=[0, osc(8, 25), 0])})
    add("walk", {
        "rightLeg": bone(rot=[walk(40, f), 0, 0]), "leftLeg": bone(rot=[walk(40, f, phase=180), 0, 0]),
        "rightArm": bone(rot=[walk(30, f, phase=180), 0, 0]), "leftArm": bone(rot=[walk(30, f), 0, 0]),
        "waist": bone(pos=[0, f"math.abs(math.cos(q.modified_distance_moved * {f})) * 0.6 * math.min(1, q.modified_move_speed)", 0]),
    })
    add("fly", {
        "rightLeg": bone(rot=[18, 0, 3]), "leftLeg": bone(rot=[12, 0, -3]),
        "rightArm": bone(rot=[25, 0, 10]), "leftArm": bone(rot=[25, 0, -10]),
        "body": bone(rot=[12, 0, 0]),
        "jet": bone(scale=["1", "1.4 + math.sin(q.anim_time * 2400) * 0.25", "1"]),
    })
    add("shoot", {"rightArm": bone(rot=[-90, 0, 0], pos=[0, 0, osc(0.6, 2200)]), "body": bone(rot=[0, -15, 0])}, loop=True)
    add("punch", {"leftArm": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.15, [-110, 10, 0]), (0.4, [0, 0, 0])]))}, loop=True, length=0.4)
    add("give", {"leftArm": bone(rot=[-75, -10, 0]), "head": bone(rot=[10, 0, 0])}, loop=True)
    add("spawn", {"root": bone(scale=smooth_keys([(0, [0.1, 0.1, 0.1]), (0.4, [1.1, 1.1, 1.1]), (0.6, [1, 1, 1])]),
                                rot=smooth_keys([(0, [0, -720, 0]), (0.6, [0, 0, 0])]))}, loop="hold", length=0.7)
    return A


ROBOT_ACTIONS = ["idle", "shoot", "punch", "give", "fly", "spawn"]


def robot_controllers():
    act = "q.property('lila:action')"
    states = {"default": {"animations": [{"walk": "q.is_on_ground"}, {"fly": "!q.is_on_ground"}], "blend_transition": 0.2, "transitions": []}}
    for a in ("shoot", "punch", "give", "spawn"):
        states["default"]["transitions"].append({a: f"{act} == '{a}'"})
        states[a] = {"animations": [a, {"fly": "!q.is_on_ground"}], "blend_transition": 0.12, "transitions": [{"default": f"{act} != '{a}'"}]}
    return [controller("controller.animation.lila.robot.action", states)]
