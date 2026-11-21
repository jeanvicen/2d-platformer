"""Animações do DR-0N, robô de peças presas por magnetismo (Molang contínuo = suave em qualquer FPS).

Física (variáveis do pre_animation em forms_anims.py):
  v.svf/v.svl/v.svu  velocidade suavizada (frente / esquerda / cima) no referencial do corpo
  v.afw/v.acs/v.aup  aceleração (frente / lateral + centrípeta da curva / vertical)
  v.tz v.tx v.ty     mola do tronco · v.hz.. cabeça · v.rz.. mão direita · v.lz.. mão esquerda
Cada peça é uma massa presa por uma "mola magnética" com amortecimento: acelerou, ela fica para
trás; freou, ela passa do ponto e volta quicando; curva, ela pende para fora e o corpo inclina para
dentro. Golpes dão tranco no tronco e na cabeça (impulso nas molas).

Liga/desliga ("power"): v.kt/v.kh/v.kr/v.kl/v.kg (0 = montado, 1 = no chão). Desligando, cada
peça cai com aceleração e QUICA ao bater no chão; ligando, sobe em arco girando e encaixa com um
"estalo" magnético (passa um pouco do lugar e volta)."""
from __future__ import annotations

from .anim import anim, bone, controller, smooth_keys

P = "animation.lila.drone"
ACT = "q.property('lila:action')"
MOVE = "q.property('lila:move')"

DRONE_ACTIONS = ["idle", "work", "place", "shoot", "charge", "turret", "craft", "wave", "sleep", "defeat",
                 "summon", "celebrate", "scan", "punch"]


def E(k):
    """Desligando: queda acelerada que quica no chão (k=0,72 encosta). Ligando: encaixe com estalo
    magnético (back-ease: passa ~9% do lugar e volta)."""
    return (f"((v.offp > 0.5) ? (({k} < 0.72) ? ({k} / 0.72) * ({k} / 0.72) : 1 - math.sin(({k} - 0.72) * 642.86) * 0.1)"
            f" : {k} * {k} * (2.6 * {k} - 1.6))")


def ARC(k, amp):
    """Arco durante a montagem (sobe acima do lugar e assenta)."""
    return f"((v.offp > 0.5) ? 0 : math.sin({k} * 180) * {amp})"


def SHIVER(k, amp):
    """Tremidinha magnética enquanto a peça está no ar sendo puxada."""
    return f"((v.offp > 0.5) ? 0 : math.sin(q.anim_time * 2300) * {amp} * {k} * (1 - {k}) * 4)"


def live(k):
    return f"(1 - {k})"


def drone_anims():
    A = {}

    def add(name, bones, **kw):
        n, a = anim(f"{P}.{name}", bones, **kw)
        A[name] = (n, a)

    # ---------------- levitação magnética em repouso (duas frequências + zumbido fino = orgânico)
    add("base", {
        "root": bone(pos=[0, f"(5 + math.sin(q.anim_time * 110) * 0.6 + math.sin(q.anim_time * 47 + 30) * 0.3 + math.sin(q.anim_time * 1700) * 0.03) * {live('v.kt')}", 0]),
        "torso": bone(rot=[f"math.sin(q.anim_time * 60 + 30) * 1.2 * {live('v.kt')}", f"math.sin(q.anim_time * 35) * 3 * {live('v.kt')}",
                           f"math.sin(q.anim_time * 52) * 0.8 * {live('v.kt')}"]),
        "head": bone(pos=[0, f"(math.sin(q.anim_time * 100 + 70) * 0.5 + math.sin(q.anim_time * 41) * 0.2) * {live('v.kh')}", 0],
                     rot=[f"math.sin(q.anim_time * 70) * 1.8 * {live('v.kh')}", f"math.sin(q.anim_time * 31 + 40) * 2.5 * {live('v.kh')}",
                          f"math.sin(q.anim_time * 55) * 2 * {live('v.kh')}"]),
        # as mãos fazem pequenas voltas (figura de 8) com fases diferentes
        "hand_r": bone(pos=[f"math.sin(q.anim_time * 70) * 0.5 * {live('v.kr')}", f"math.sin(q.anim_time * 125 + 120) * 0.8 * {live('v.kr')}",
                            f"math.sin(q.anim_time * 140) * 0.4 * {live('v.kr')}"],
                       rot=[f"math.sin(q.anim_time * 90) * 4 * {live('v.kr')}", f"math.sin(q.anim_time * 47) * 5 * {live('v.kr')}",
                            f"(-4 + math.sin(q.anim_time * 70) * 3) * {live('v.kr')}"]),
        "hand_l": bone(pos=[f"math.sin(q.anim_time * 70 + 100) * 0.5 * {live('v.kl')}", f"math.sin(q.anim_time * 125 + 230) * 0.8 * {live('v.kl')}",
                            f"math.sin(q.anim_time * 140 + 100) * 0.4 * {live('v.kl')}"],
                       rot=[f"math.sin(q.anim_time * 90 + 150) * 4 * {live('v.kl')}", f"math.sin(q.anim_time * 47 + 90) * 5 * {live('v.kl')}",
                            f"(4 + math.sin(q.anim_time * 70 + 110) * 3) * {live('v.kl')}"]),
        "core": bone(scale="1 + math.sin(q.anim_time * 110) * 0.05"),
        "eyes": bone(scale="1 + math.sin(q.anim_time * 110 + 60) * 0.02"),
    })

    # ---------------- movimento com inércia (molas) + postura pela velocidade
    spd_pitch = "math.clamp(v.svf * 1.4, -10, 20)"
    add("motion", {
        # corpo inteiro inclina pra frente com a velocidade, balança com a mola do tronco e "deita" na curva
        "float": bone(rot=[f"({spd_pitch} + v.tz * 1.5) * {live('v.kt')}", 0, f"math.clamp(-v.acs * 0.45, -16, 16) * {live('v.kt')}"],
                      pos=[0, f"v.ty * 0.6 * {live('v.kt')}", 0]),
        "torso": bone(pos=[f"v.tx * {live('v.kt')}", f"v.ty * {live('v.kt')}", f"v.tz * {live('v.kt')}"],
                      rot=[f"v.tz * 2.5 * {live('v.kt')}", 0, f"-v.tx * 2 * {live('v.kt')}"]),
        # cabeça: puxa a frente em velocidade, quica na freada, olha macio para quem está perto
        "head": bone(pos=[f"v.hx * {live('v.kh')}", f"v.hy * {live('v.kh')}", f"(v.hz - math.clamp(v.svf * 0.1, 0, 1.5)) * {live('v.kh')}"],
                     rot=[f"(v.hz * 3 + v.hlx) * {live('v.kh')}", f"v.hly * {live('v.kh')}", f"-v.hx * 3 * {live('v.kh')}"]),
        # mãos: arrasto aerodinâmico (ficam pra trás em velocidade) + pêndulo da mola
        "hand_r": bone(pos=[f"v.rx * {live('v.kr')}", f"(v.ry + math.clamp(v.svf * 0.06, 0, 1)) * {live('v.kr')}",
                            f"(v.rz + math.clamp(v.svf * 0.25, -2, 4)) * {live('v.kr')}"],
                       rot=[f"(v.rz * 6 + math.clamp(v.svf * 2.2, -10, 35)) * {live('v.kr')}", f"v.rx * 3 * {live('v.kr')}", f"-v.rx * 5 * {live('v.kr')}"]),
        "hand_l": bone(pos=[f"v.lx * {live('v.kl')}", f"(v.ly + math.clamp(v.svf * 0.06, 0, 1)) * {live('v.kl')}",
                            f"(v.lz + math.clamp(v.svf * 0.25, -2, 4)) * {live('v.kl')}"],
                       rot=[f"(v.lz * 6 + math.clamp(v.svf * 2.2, -10, 35)) * {live('v.kl')}", f"v.lx * 3 * {live('v.kl')}", f"-v.lx * 5 * {live('v.kl')}"]),
    })

    # ---------------- desligar / ligar (cai e quica; monta com estalo magnético)
    add("power", {
        "torso": bone(pos=[SHIVER("v.kt", 0.3), f"-8 * {E('v.kt')} + {ARC('v.kt', 3)}", 0],
                      rot=[f"-4 * {E('v.kt')}", f"24 * {E('v.kt')} + {ARC('v.kt', 120)}", f"-5 * {E('v.kt')}"]),
        "head": bone(pos=[f"11 * {E('v.kh')} + {SHIVER('v.kh', 0.4)}", f"-23.5 * {E('v.kh')} + {ARC('v.kh', 6)}", f"-5 * {E('v.kh')}"],
                     rot=[f"-14 * {E('v.kh')}", f"-38 * {E('v.kh')} + {ARC('v.kh', 360)}", f"26 * {E('v.kh')}"]),
        "hand_r": bone(pos=[f"-3 * {E('v.kr')} + {SHIVER('v.kr', 0.4)}", f"-13 * {E('v.kr')} + {ARC('v.kr', 5)}", f"7 * {E('v.kr')}"],
                       rot=[f"82 * {E('v.kr')}", f"25 * {E('v.kr')} + {ARC('v.kr', 270)}", f"10 * {E('v.kr')}"]),
        "hand_l": bone(pos=[f"4 * {E('v.kl')} + {SHIVER('v.kl', 0.4)}", f"-13 * {E('v.kl')} + {ARC('v.kl', 5)}", f"-11 * {E('v.kl')}"],
                       rot=[f"-72 * {E('v.kl')}", f"-20 * {E('v.kl')} - {ARC('v.kl', 270)}", f"32 * {E('v.kl')}"]),
        # brilhos: ao desligar falham e apagam; ao ligar acendem por último, piscando
        **{g: bone(scale="(1 - v.kg) * ((v.offp > 0.5) ? ((math.sin(v.ot * 3200) > 0) ? 1 : 0.35) : ((v.bt < 2.2) ? ((math.sin(v.bt * 2600) > -0.4) ? 1 : 0.15) : 1))")
           for g in ("eyes", "mouth", "core", "glow_hr", "glow_hl")},
    })

    # ---------------- ações (preparação → golpe → passa do ponto → recupera)
    add("punch", {
        "hand_r": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.12, [2.5, 1.5, 5]), (0.19, [3.5, -0.5, -17]), (0.23, [3.5, -0.4, -15.5]),
                                        (0.32, [3, 0, -12]), (0.55, [0, 0, 0])]),
                       rot=smooth_keys([(0, [0, 0, 0]), (0.12, [25, -20, 10]), (0.19, [-80, 15, -35]), (0.23, [-72, 15, -30]), (0.55, [0, 0, 0])])),
        "hand_l": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.12, [-1, 2, -3]), (0.4, [-1, 2, -3]), (0.55, [0, 0, 0])]),
                       rot=smooth_keys([(0, [0, 0, 0]), (0.12, [-40, 0, 15]), (0.4, [-40, 0, 15]), (0.55, [0, 0, 0])])),
        "torso": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.12, [0, 22, 0]), (0.19, [5, -26, 0]), (0.26, [3, -20, 0]), (0.55, [0, 0, 0])]),
                      pos=smooth_keys([(0, [0, 0, 0]), (0.19, [0, 0, -1.5]), (0.55, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.15, [4, 10, 0]), (0.24, [10, -14, 0]), (0.55, [0, 0, 0])])),
        "eyes": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.18, [1, 1, 1]), (0.21, [1.35, 1.35, 1.35]), (0.4, [1, 1, 1])])),
    }, loop=True, length=0.55)
    # tiro do núcleo: o peito dá coice e volta com um quique; olhos acendem; mãos se firmam
    add("shoot", {
        "core": bone(scale=smooth_keys([(0, [1.35, 1.35, 1.35]), (0.05, [1.0, 1.0, 1.0]), (0.15, [1.35, 1.35, 1.35])])),
        "torso": bone(pos=smooth_keys([(0, [0, 0, 1.3]), (0.06, [0, 0, -0.25]), (0.1, [0, 0, 0.1]), (0.15, [0, 0, 1.3])]),
                      rot=smooth_keys([(0, [-2, 0, 0]), (0.07, [0.5, 0, 0]), (0.15, [-2, 0, 0])])),
        "eyes": bone(scale=1.2),
        "hand_r": bone(pos=[1.5, 0, -2], rot=[-25, 0, 10]), "hand_l": bone(pos=[-1.5, 0, -2], rot=[-25, 0, -10]),
        "head": bone(rot=[-3, 0, 0]),
    }, loop=True, length=0.15)
    # quebrando: as mãos martelam alternadas com impacto seco (param no ponto mais baixo)
    add("work", {
        "hand_r": bone(pos=smooth_keys([(0, [0, 2, -2]), (0.14, [0, -3, -5]), (0.18, [0, -2.6, -4.8]), (0.5, [0, 2, -2])]),
                       rot=smooth_keys([(0, [10, 0, 0]), (0.14, [-60, 0, 0]), (0.18, [-55, 0, 0]), (0.5, [10, 0, 0])])),
        "hand_l": bone(pos=smooth_keys([(0, [0, -2.6, -4.8]), (0.07, [0, -2, -4]), (0.25, [0, 2, -2]), (0.39, [0, -3, -5]), (0.5, [0, -2.6, -4.8])]),
                       rot=smooth_keys([(0, [-55, 0, 0]), (0.25, [10, 0, 0]), (0.39, [-60, 0, 0]), (0.5, [-55, 0, 0])])),
        "head": bone(rot=[14, 0, 0]),
        "float": bone(rot=smooth_keys([(0, [10, 0, 0]), (0.15, [12, 0, 0]), (0.39, [12, 0, 0]), (0.5, [10, 0, 0])])),
    }, loop=True, length=0.5)
    # construindo: alcança o bloco com uma mão de cada vez (passa um tiquinho e volta)
    add("place", {
        "hand_r": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.11, [1, -3.3, -6.5]), (0.15, [1, -3, -6]), (0.3, [0, -1, -2]), (0.5, [0, 0, 0])]),
                       rot=smooth_keys([(0, [0, 0, 0]), (0.11, [-60, 0, 0]), (0.15, [-55, 0, 0]), (0.5, [0, 0, 0])])),
        "hand_l": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.24, [-1, -3.3, -6.5]), (0.28, [-1, -3, -6]), (0.42, [0, -1, -2]), (0.5, [0, 0, 0])]),
                       rot=smooth_keys([(0, [0, 0, 0]), (0.24, [-60, 0, 0]), (0.28, [-55, 0, 0]), (0.5, [0, 0, 0])])),
        "head": bone(rot=smooth_keys([(0, [14, 0, 0]), (0.13, [18, 4, 0]), (0.27, [18, -4, 0]), (0.5, [14, 0, 0])])),
        "eyes": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.12, [1.25, 1.25, 1.25]), (0.5, [1, 1, 1])])),
    }, loop=True, length=0.5)
    # carregando energia: núcleo cresce, mãos abrem e tremem com o campo, cabeça recua
    add("charge", {
        "core": bone(scale="1.1 + math.abs(math.sin(q.anim_time * 300)) * 0.35"),
        "hand_r": bone(pos=["-3 + math.sin(q.anim_time * 2100) * 0.25", "2 + math.sin(q.anim_time * 1900) * 0.2", 0], rot=[0, 0, -30]),
        "hand_l": bone(pos=["3 + math.sin(q.anim_time * 2000) * 0.25", "2 + math.sin(q.anim_time * 2200) * 0.2", 0], rot=[0, 0, 30]),
        "head": bone(rot=[-6, 0, 0]),
        "eyes": bone(scale="1.1 + math.abs(math.sin(q.anim_time * 300)) * 0.15"),
    }, loop=True)
    # guarda (torreta / proteger): punhos erguidos na frente do rosto, respirando
    add("turret", {
        "hand_r": bone(pos=[3, "6 + math.sin(q.anim_time * 120) * 0.4", -6], rot=[-80, 20, 0]),
        "hand_l": bone(pos=[-3, "6 + math.sin(q.anim_time * 120 + 60) * 0.4", -6], rot=[-80, -20, 0]),
        "head": bone(rot=[4, 0, 0]),
    }, loop=True)
    add("craft", {
        "hand_r": bone(pos=["3 + math.cos(q.anim_time * 400) * 2", "2 + math.sin(q.anim_time * 400) * 2", -5], rot=[-40, "math.sin(q.anim_time * 400) * 15", 0]),
        "hand_l": bone(pos=["-3 - math.cos(q.anim_time * 400) * 2", "2 - math.sin(q.anim_time * 400) * 2", -5], rot=[-40, "-math.sin(q.anim_time * 400) * 15", 0]),
        "head": bone(rot=[18, "math.sin(q.anim_time * 200) * 6", 0]),
    }, loop=True)
    # tchau: a mão sobe e acena; o "pulso" atrasa um pouco (movimento secundário)
    add("wave", {
        "hand_l": bone(pos=[0, 9, -1], rot=[0, "math.sin(q.anim_time * 420 - 50) * 10", "20 + math.sin(q.anim_time * 420) * 25"]),
        "head": bone(rot=[0, 8, "math.sin(q.anim_time * 210) * 5"]),
        "torso": bone(rot=[0, 6, "math.sin(q.anim_time * 420 + 90) * 1.5"]),
    }, loop=True)
    add("scan", {"head": bone(rot=[6, "math.sin(q.anim_time * 70) * 40", 0]), "eyes": bone(scale="1.1 + math.abs(math.sin(q.anim_time * 400)) * 0.25"),
                 "hand_r": bone(rot=[0, 0, "math.sin(q.anim_time * 70) * 4"]), "hand_l": bone(rot=[0, 0, "math.sin(q.anim_time * 70) * 4"])}, loop=True)
    add("celebrate", {
        "float": bone(rot=[0, "q.anim_time * 360", "math.sin(q.anim_time * 360) * 6"], pos=[0, "4 + math.abs(math.sin(q.anim_time * 360)) * 2", 0]),
        "hand_r": bone(pos=[0, "8 + math.abs(math.sin(q.anim_time * 500)) * 2", 0], rot=[0, 0, "-30 + math.sin(q.anim_time * 500) * 20"]),
        "hand_l": bone(pos=[0, "8 + math.abs(math.sin(q.anim_time * 500 + 90)) * 2", 0], rot=[0, 0, "30 + math.sin(q.anim_time * 500 + 90) * 20"]),
    }, loop=True)
    add("sleep", {"head": bone(pos=[0, "-2 + math.sin(q.anim_time * 40) * 0.3", 0], rot=[18, 0, 0]), "eyes": bone(scale="0.3 + math.sin(q.anim_time * 40) * 0.05"),
                  "hand_r": bone(pos=[0, -3, 0], rot=[10, 0, -6]), "hand_l": bone(pos=[0, -3, 0], rot=[10, 0, 6]), "torso": bone(pos=[0, -1, 0])}, loop=True)

    # derrotado: as peças caem e quicam, os brilhos falham
    def bounce(end, t0):
        return smooth_keys([(0, [0, 0, 0]), (t0, end), (t0 + 0.1, [end[0], end[1] + 1.5, end[2]]), (t0 + 0.2, end), (1.0, end)])
    add("defeat", {
        "head": bone(pos=bounce([7, -20, -4], 0.45), rot=smooth_keys([(0, [0, 0, 0]), (0.45, [-14, -30, 30]), (1.0, [-14, -30, 30])])),
        "hand_r": bone(pos=bounce([-2, -12, 6], 0.4), rot=smooth_keys([(0, [0, 0, 0]), (0.4, [80, 20, 0]), (1.0, [80, 20, 0])])),
        "hand_l": bone(pos=bounce([3, -12, -8], 0.5), rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-70, 0, 30]), (1.0, [-70, 0, 30])])),
        "torso": bone(pos=bounce([0, -6, 0], 0.6), rot=smooth_keys([(0, [0, 0, 0]), (0.6, [0, 20, -8]), (1.0, [0, 20, -8])])),
        "eyes": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.2, [0.2, 0.2, 0.2]), (0.3, [0.8, 0.8, 0.8]), (0.5, [0.1, 0.1, 0.1]), (0.7, [0, 0, 0])])),
        "core": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.8, [0, 0, 0])])),
    }, loop="hold", length=1.0)
    # invocar: as peças vêm de longe e encaixam com estalo (passam do lugar e voltam)
    add("summon", {
        "head": bone(pos=smooth_keys([(0, [0, 22, 0]), (0.6, [0, -1.2, 0]), (0.75, [0, 0.4, 0]), (0.9, [0, 0, 0])]),
                     rot=smooth_keys([(0, [0, -540, 0]), (0.6, [0, 8, 0]), (0.9, [0, 0, 0])])),
        "hand_r": bone(pos=smooth_keys([(0, [-18, 6, 4]), (0.45, [1, 0, 0]), (0.6, [-0.3, 0, 0]), (0.75, [0, 0, 0])]),
                       rot=smooth_keys([(0, [360, 0, 0]), (0.45, [-10, 0, 0]), (0.75, [0, 0, 0])])),
        "hand_l": bone(pos=smooth_keys([(0, [18, 6, 4]), (0.5, [-1, 0, 0]), (0.65, [0.3, 0, 0]), (0.8, [0, 0, 0])]),
                       rot=smooth_keys([(0, [-360, 0, 0]), (0.5, [10, 0, 0]), (0.8, [0, 0, 0])])),
        "torso": bone(scale=smooth_keys([(0, [0.1, 0.1, 0.1]), (0.35, [1.12, 1.12, 1.12]), (0.5, [0.96, 0.96, 0.96]), (0.65, [1, 1, 1])])),
    }, loop="hold", length=1.0, particles=[{"effect": "sparkle", "locator": "ground"}])
    return A


def drone_controllers():
    # o movimento é contínuo (física); só as ações trocam de estado
    move_states = {"default": {"animations": ["motion"], "blend_transition": 0.3, "transitions": []}}
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
    if off:
        e = (k / 0.72) ** 2 if k < 0.72 else 1 - math.sin(math.radians((k - 0.72) * 642.86)) * 0.1
    else:
        e = k * k * (2.6 * k - 1.6)

    def arc(a):
        return 0 if off else math.sin(math.radians(k * 180)) * a
    P = {"root": {"pos": (0, 5 * (1 - k), 0)},
         "torso": {"pos": (0, -8 * e + arc(3), 0), "rot": (-4 * e, 24 * e + arc(120), -5 * e)},
         "head": {"pos": (11 * e, -23.5 * e + arc(6), -5 * e), "rot": (-14 * e, -38 * e + arc(360), 26 * e)},
         "hand_r": {"pos": (-3 * e, -13 * e + arc(5), 7 * e), "rot": (82 * e, 25 * e + arc(270), 10 * e)},
         "hand_l": {"pos": (4 * e, -13 * e + arc(5), -11 * e), "rot": (-72 * e, -20 * e - arc(270), 32 * e)}}
    if k > 0.5:
        for g in ("eyes", "mouth", "core", "glow_hr", "glow_hl"):
            P[g] = {"scale": 0.001}
    return P
