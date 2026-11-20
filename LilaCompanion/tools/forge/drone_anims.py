"""Animações do DR-0N, robô de peças flutuantes (Molang contínuo = suave em qualquer FPS).

Cada parte (cabeça, tronco, mãos, detritos) flutua com fase própria. "power" desmonta o robô no
chão quando ele é desligado (cabeça cai primeiro, depois mãos e tronco; brilhos apagam) e, ao
ligar, as peças sobem girando em arco e se encaixam: tronco → mãos → cabeça → olhos acendem
piscando. As variáveis v.kt/v.kh/v.kr/v.kl/v.kd/v.kg (0 = montado, 1 = no chão) vêm do
pre_animation em forms_anims.py."""
from __future__ import annotations

from .anim import anim, bone, controller, osc, smooth_keys
from .drone_art import DEBRIS

P = "animation.lila.drone"
ACT = "q.property('lila:action')"
MOVE = "q.property('lila:move')"

DRONE_ACTIONS = ["idle", "work", "place", "shoot", "charge", "turret", "craft", "wave", "sleep", "defeat",
                 "summon", "celebrate", "scan", "punch"]


def E(k):
    """Curva: caindo acelera (k²); subindo desacelera e encaixa (smoothstep)."""
    return f"({k} * {k} * (v.offp > 0.5 ? 1 : (3 - 2 * {k})))"


def ARC(k, amp):
    """Arco durante a montagem (sobe acima do lugar e assenta)."""
    return f"(v.offp > 0.5 ? 0 : math.sin({k} * 180) * {amp})"


def drone_anims():
    A = {}

    def add(name, bones, **kw):
        n, a = anim(f"{P}.{name}", bones, **kw)
        A[name] = (n, a)

    # ---------------- flutuação de cada parte (some quando a parte está no chão)
    live = lambda k: f"(1 - {k})"  # noqa: E731
    add("base", {
        "root": bone(pos=[0, f"(5 + math.sin(q.anim_time * 120) * 0.7) * {live('v.kt')}", 0]),
        "head": bone(pos=[0, f"math.sin(q.anim_time * 110 + 60) * 0.6 * {live('v.kh')}", 0],
                     rot=[f"math.sin(q.anim_time * 70) * 2 * {live('v.kh')}", 0, f"math.sin(q.anim_time * 55) * 2.5 * {live('v.kh')}"]),
        "torso": bone(rot=[f"math.sin(q.anim_time * 60 + 30) * 1.5 * {live('v.kt')}", f"math.sin(q.anim_time * 35) * 3 * {live('v.kt')}", 0]),
        "hand_r": bone(pos=[f"math.sin(q.anim_time * 80) * 0.5 * {live('v.kr')}", f"math.sin(q.anim_time * 130 + 120) * 0.9 * {live('v.kr')}", 0],
                       rot=[f"math.sin(q.anim_time * 90) * 5 * {live('v.kr')}", 0, f"(-4 + math.sin(q.anim_time * 70) * 4) * {live('v.kr')}"]),
        "hand_l": bone(pos=[f"math.sin(q.anim_time * 80 + 90) * 0.5 * {live('v.kl')}", f"math.sin(q.anim_time * 130 + 220) * 0.9 * {live('v.kl')}", 0],
                       rot=[f"math.sin(q.anim_time * 90 + 140) * 5 * {live('v.kl')}", 0, f"(4 + math.sin(q.anim_time * 70 + 100) * 4) * {live('v.kl')}"]),
        "core": bone(scale=f"1 + math.sin(q.anim_time * 220) * 0.05"),
        "debris": bone(rot=[0, "v.dsp", 0]),
        **{name: bone(rot=["v.dsp * 2.6", f"v.dsp * {1.7 + i * 0.3}", "v.dsp * 1.3"],
                      pos=[0, f"math.sin(q.anim_time * 140 + {i * 47}) * 0.8 * {live('v.kd')}", 0]) for i, (name, _, _) in enumerate(DEBRIS)},
    })
    # ---------------- desligar / ligar (desmonta no chão; monta voando)
    pw = {
        "torso": bone(pos=[0, f"-8 * {E('v.kt')} + {ARC('v.kt', 3)}", 0],
                      rot=[f"-4 * {E('v.kt')}", f"24 * {E('v.kt')} + {ARC('v.kt', 120)}", f"-5 * {E('v.kt')}"]),
        "head": bone(pos=[f"11 * {E('v.kh')}", f"-23.5 * {E('v.kh')} + {ARC('v.kh', 6)}", f"-5 * {E('v.kh')}"],
                     rot=[f"-14 * {E('v.kh')}", f"-38 * {E('v.kh')} + {ARC('v.kh', 360)}", f"26 * {E('v.kh')}"]),
        "hand_r": bone(pos=[f"-3 * {E('v.kr')}", f"-13 * {E('v.kr')} + {ARC('v.kr', 5)}", f"7 * {E('v.kr')}"],
                       rot=[f"82 * {E('v.kr')}", f"25 * {E('v.kr')} + {ARC('v.kr', 270)}", f"10 * {E('v.kr')}"]),
        "hand_l": bone(pos=[f"4 * {E('v.kl')}", f"-13 * {E('v.kl')} + {ARC('v.kl', 5)}", f"-11 * {E('v.kl')}"],
                       rot=[f"-72 * {E('v.kl')}", f"-20 * {E('v.kl')} - {ARC('v.kl', 270)}", f"32 * {E('v.kl')}"]),
        # brilhos: apagam de uma vez ao desligar; ao ligar acendem por último, piscando
        **{g: bone(scale=f"(1 - v.kg) * ((v.offp < 0.5 && v.bt < 2.2) ? (math.sin(v.bt * 2600) > -0.4 ? 1 : 0.15) : 1)")
           for g in ("eyes", "mouth", "core", "glow_hr", "glow_hl")},
    }
    for i, (name, (x, y, z), _) in enumerate(DEBRIS):
        # cada peça cai até o chão (y≈1) e espalha um pouco
        dx = (2 if x > 0 else -2) + (i % 3) - 1
        pw[name] = bone(pos=[f"{dx} * {E('v.kd')}", f"{-(y - 1)} * {E('v.kd')} + {ARC('v.kd', 4)}", f"{(i % 2) * 2 - 1} * {E('v.kd')}"])
    add("power", pw)
    add("look", {"head": bone(rot=["math.clamp(q.target_x_rotation, -25, 25) * (1 - v.kh)", "math.clamp(q.target_y_rotation, -35, 35) * (1 - v.kh)", 0])})
    # ---------------- movimento: inclina pra frente, mãos ficam pra trás, cabeça puxa a frente
    add("still", {"float": bone(rot=[osc(1.2, 70), osc(2, 23), osc(1.2, 50)])})
    add("fly", {
        "float": bone(rot=["v.dtilt * 0.8 + math.sin(q.anim_time * 300) * 0.8", 0, "-v.lean * 0.7 + math.sin(q.anim_time * 90) * 1.2"]),
        "hand_r": bone(pos=[0, 1, "1.5 + v.dtilt * 0.08"], rot=["14 + v.dtilt * 0.6", 0, 0]),
        "hand_l": bone(pos=[0, 1, "1.5 + v.dtilt * 0.08"], rot=["14 + v.dtilt * 0.6", 0, 0]),
        "head": bone(pos=[0, 0, "-v.dtilt * 0.06"]),
    })
    add("dash", {
        "float": bone(rot=["v.dtilt + 8 + math.sin(q.anim_time * 500) * 1.2", 0, "-v.lean * 1.0 + math.sin(q.anim_time * 140) * 2"]),
        "hand_r": bone(pos=[1, 2, 4], rot=[40, 0, -10]), "hand_l": bone(pos=[-1, 2, 4], rot=[40, 0, 10]),
        "head": bone(pos=[0, -0.5, -1.2]), "debris": bone(scale=0.85),
    })
    # ---------------- ações
    # soco forte: a mão direita recua, dispara pra frente girando e volta; tronco torce junto
    add("punch", {
        "hand_r": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.1, [2, 1, 4]), (0.2, [4, -1, -17]), (0.3, [3, -1, -15]), (0.5, [0, 0, 0])]),
                       rot=smooth_keys([(0, [0, 0, 0]), (0.1, [20, -15, 0]), (0.2, [-70, 20, -40]), (0.5, [0, 0, 0])])),
        "hand_l": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.2, [-1, 1, 3]), (0.5, [0, 0, 0])]), rot=smooth_keys([(0, [0, 0, 0]), (0.2, [-20, 0, 10]), (0.5, [0, 0, 0])])),
        "torso": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.1, [0, 18, 0]), (0.22, [6, -22, 0]), (0.5, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.22, [8, -10, 0]), (0.5, [0, 0, 0])])),
        "eyes": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.2, [1.3, 1.3, 1.3]), (0.5, [1, 1, 1])])),
    }, loop=True, length=0.5)
    # tiro: o núcleo do peito dispara (pulsa e recua), olhos acendem, mãos se firmam
    add("shoot", {
        "core": bone(scale=smooth_keys([(0, [1.3, 1.3, 1.3]), (0.06, [1.05, 1.05, 1.05]), (0.15, [1.3, 1.3, 1.3])])),
        "torso": bone(pos=smooth_keys([(0, [0, 0, 0.9]), (0.075, [0, 0, 0]), (0.15, [0, 0, 0.9])])),
        "eyes": bone(scale=1.2),
        "hand_r": bone(pos=[1.5, 0, -2], rot=[-25, 0, 10]), "hand_l": bone(pos=[-1.5, 0, -2], rot=[-25, 0, -10]),
    }, loop=True, length=0.15)
    # quebrando/cavando: as duas mãos martelam alternadas
    add("work", {
        "hand_r": bone(pos=[0, f"math.sin(q.anim_time * 1100) * 2", f"-3 + math.cos(q.anim_time * 1100) * 2"], rot=[f"-30 + math.sin(q.anim_time * 1100) * 25", 0, 0]),
        "hand_l": bone(pos=[0, f"-math.sin(q.anim_time * 1100) * 2", f"-3 - math.cos(q.anim_time * 1100) * 2"], rot=[f"-30 - math.sin(q.anim_time * 1100) * 25", 0, 0]),
        "head": bone(rot=[14, 0, 0]), "float": bone(rot=["10 + math.sin(q.anim_time * 1400) * 1.5", 0, 0]),
    }, loop=True)
    # construindo: as mãos alcançam o bloco pra frente/baixo, uma de cada vez; olhos piscam a cada bloco
    add("place", {
        "hand_r": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.12, [1, -3, -6]), (0.3, [0, -1, -2]), (0.5, [0, 0, 0])]),
                       rot=smooth_keys([(0, [0, 0, 0]), (0.12, [-55, 0, 0]), (0.5, [0, 0, 0])])),
        "hand_l": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.25, [-1, -3, -6]), (0.42, [0, -1, -2]), (0.5, [0, 0, 0])]),
                       rot=smooth_keys([(0, [0, 0, 0]), (0.25, [-55, 0, 0]), (0.5, [0, 0, 0])])),
        "head": bone(rot=[16, 0, 0]),
        "eyes": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.12, [1.25, 1.25, 1.25]), (0.5, [1, 1, 1])])),
    }, loop=True, length=0.5)
    add("charge", {
        "core": bone(scale="1.1 + math.abs(math.sin(q.anim_time * 300)) * 0.35"),
        "hand_r": bone(pos=[-3, 2, 0], rot=[0, 0, -30]), "hand_l": bone(pos=[3, 2, 0], rot=[0, 0, 30]),
        "eyes": bone(scale="1.1 + math.abs(math.sin(q.anim_time * 300)) * 0.15"),
    }, loop=True)
    # guarda (torreta / proteger): punhos erguidos na frente do rosto
    add("turret", {
        "hand_r": bone(pos=[3, 6, -6], rot=[-80, 20, 0]), "hand_l": bone(pos=[-3, 6, -6], rot=[-80, -20, 0]),
        "float": bone(rot=[osc(1.5, 60), 0, 0]),
    }, loop=True)
    add("craft", {
        "hand_r": bone(pos=[f"3 + math.cos(q.anim_time * 400) * 2", f"2 + math.sin(q.anim_time * 400) * 2", -5], rot=[-40, 0, 0]),
        "hand_l": bone(pos=[f"-3 - math.cos(q.anim_time * 400) * 2", f"2 - math.sin(q.anim_time * 400) * 2", -5], rot=[-40, 0, 0]),
        "head": bone(rot=[18, 0, 0]),
    }, loop=True)
    add("wave", {"hand_l": bone(pos=[0, 9, 0], rot=[0, 0, osc(25, 420, base=20)]), "head": bone(rot=[0, 0, osc(6, 210)])}, loop=True)
    add("scan", {"head": bone(rot=[6, osc(40, 70), 0]), "eyes": bone(scale="1.1 + math.abs(math.sin(q.anim_time * 400)) * 0.25")}, loop=True)
    add("celebrate", {"float": bone(rot=[0, "q.anim_time * 360", 0], pos=[0, 4, 0]),
                      "hand_r": bone(pos=[0, 8, 0], rot=[0, 0, osc(20, 500, base=-30)]), "hand_l": bone(pos=[0, 8, 0], rot=[0, 0, osc(20, 500, base=30)])}, loop=True)
    add("sleep", {"head": bone(pos=[0, -2, 0], rot=[18, 0, 0]), "eyes": bone(scale=0.35), "hand_r": bone(pos=[0, -3, 0]), "hand_l": bone(pos=[0, -3, 0])}, loop=True)
    add("defeat", {
        "head": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.8, [7, -20, -4])]), rot=smooth_keys([(0, [0, 0, 0]), (0.8, [-14, -30, 30])])),
        "hand_r": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.6, [-2, -12, 6])]), rot=smooth_keys([(0, [0, 0, 0]), (0.6, [80, 20, 0])])),
        "hand_l": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.7, [3, -12, -8])]), rot=smooth_keys([(0, [0, 0, 0]), (0.7, [-70, 0, 30])])),
        "torso": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.9, [0, -6, 0])]), rot=smooth_keys([(0, [0, 0, 0]), (0.9, [0, 20, -8])])),
        "eyes": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.3, [0.2, 0.2, 0.2]), (0.5, [0.8, 0.8, 0.8]), (1.0, [0, 0, 0])])),
        "core": bone(scale=smooth_keys([(0, [1, 1, 1]), (1.0, [0, 0, 0])])),
    }, loop="hold", length=1.0)
    # invocar: as peças vêm de longe e se juntam girando
    add("summon", {
        "head": bone(pos=smooth_keys([(0, [0, 22, 0]), (0.7, [0, 0, 0])]), rot=smooth_keys([(0, [0, -540, 0]), (0.7, [0, 0, 0])])),
        "hand_r": bone(pos=smooth_keys([(0, [-18, 6, 4]), (0.5, [0, 0, 0])]), rot=smooth_keys([(0, [360, 0, 0]), (0.5, [0, 0, 0])])),
        "hand_l": bone(pos=smooth_keys([(0, [18, 6, 4]), (0.6, [0, 0, 0])]), rot=smooth_keys([(0, [-360, 0, 0]), (0.6, [0, 0, 0])])),
        "torso": bone(scale=smooth_keys([(0, [0.1, 0.1, 0.1]), (0.4, [1.1, 1.1, 1.1]), (0.6, [1, 1, 1])])),
        "debris": bone(scale=smooth_keys([(0, [2.5, 2.5, 2.5]), (0.8, [1, 1, 1])])),
    }, loop="hold", length=1.0, particles=[{"effect": "sparkle", "locator": "ground"}])
    return A


def drone_controllers():
    m = MOVE
    move_states = {"default": {"animations": ["still"], "blend_transition": 0.3, "transitions": [
        {"dash": f"{m} == 'run' || q.ground_speed > 6"}, {"fly": f"{m} != 'none' || q.ground_speed > 0.5"}]},
        "fly": {"animations": ["fly"], "blend_transition": 0.3, "transitions": [
            {"dash": f"{m} == 'run' || q.ground_speed > 6"}, {"default": f"{m} == 'none' && q.ground_speed < 0.3"}]},
        "dash": {"animations": ["dash"], "blend_transition": 0.3, "transitions": [
            {"fly": f"{m} != 'run' && q.ground_speed < 5"}]}}
    act_states = {"default": {"blend_transition": 0.2, "transitions": []}}
    for a in DRONE_ACTIONS:
        if a == "idle":
            continue
        act_states["default"]["transitions"].append({a: f"{ACT} == '{a}'"})
        act_states[a] = {"animations": [a], "blend_transition": 0.12, "transitions": [{"default": f"{ACT} != '{a}'"}]}
    return [controller("controller.animation.lila.drone.move", move_states),
            controller("controller.animation.lila.drone.action", act_states)]


def power_pose(k, off=True):
    """Mesma pose da animação "power" para renderizar prévias (k: 0 montado → 1 no chão)."""
    import math
    e = k * k * (1 if off else (3 - 2 * k))

    def arc(a):
        return 0 if off else math.sin(math.radians(k * 180)) * a
    P = {"root": {"pos": (0, 5 * (1 - k), 0)},
         "torso": {"pos": (0, -8 * e + arc(3), 0), "rot": (-4 * e, 24 * e + arc(120), -5 * e)},
         "head": {"pos": (11 * e, -23.5 * e + arc(6), -5 * e), "rot": (-14 * e, -38 * e + arc(360), 26 * e)},
         "hand_r": {"pos": (-3 * e, -13 * e + arc(5), 7 * e), "rot": (82 * e, 25 * e + arc(270), 10 * e)},
         "hand_l": {"pos": (4 * e, -13 * e + arc(5), -11 * e), "rot": (-72 * e, -20 * e - arc(270), 32 * e)}}
    for i, (name, (x, y, z), _) in enumerate(DEBRIS):
        dx = (2 if x > 0 else -2) + (i % 3) - 1
        P[name] = {"pos": (dx * e, -(y - 1) * e + arc(4), ((i % 2) * 2 - 1) * e)}
    if k > 0.5:
        for g in ("eyes", "mouth", "core", "glow_hr", "glow_hl"):
            P[g] = {"scale": 0.001}
    return P
