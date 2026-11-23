"""Animações da MALDIÇÃO (cliente). Tudo gerado por "poses-chave" com curvas de aceleração
(antecipação → golpe rápido → recuo suave, com passada do ponto e volta) e amostrado a cada 0,04 s,
para o movimento sair liso e com peso — nada de interpolação reta.

Camadas (somam no jogo):
  vida (sempre)  — respiração, boca que abre e fecha devagar, tentáculos ondulando como cobra
                   (onda que corre da base até a ponta), braços balançando, dedos tremendo,
                   cauda de fumaça ondulando, poça girando, cubinhos subindo e sumindo;
  deslizar       — inclina para a frente, braços e fumaça ficam para trás (pela velocidade);
  olhar          — a cabeça segue o alvo;
  ações          — socos, garra, pancada dupla, agarrar, mordida, rugido, guarda, surgir do chão,
                   afundar na terra, desmanchar em fumaça, remontar, gancho, arremesso, devorar,
                   sequência de socos.
"""
from __future__ import annotations

import math

from .curse_art import TENTACLES

DT = 0.05
T = "q.life_time"
TENTS = range(len(TENTACLES))
SEGS = range(5)
FINGERS = range(4)


def _sm(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def _mirror_unused(pose):
    """Pose do lado direito → esquerdo (troca r/l, inverte y e z da rotação e x da posição)."""
    out = {}
    for b, ch in pose.items():
        nb = b.replace("_r", "\0").replace("_l", "_r").replace("\0", "_l")
        if nb.startswith("fing_r"):
            pass
        nch = {}
        if "r" in ch:
            x, y, z = ch["r"]
            nch["r"] = (x, -y, -z)
        if "p" in ch:
            x, y, z = ch["p"]
            nch["p"] = (-x, y, z)
        if "s" in ch:
            nch["s"] = ch["s"]
        out[nb] = nch
    return out


def _fingers(side, curl, spread=0.0, thumb=None):
    """Dedos: curl > 0 fecha a mão (garra), < 0 abre; spread abre em leque."""
    sg = -1 if side == "r" else 1
    p = {}
    for k in FINGERS:
        fan = (k - 1.5) * spread
        p[f"fing_{side}{k}_0"] = {"r": (-curl * 0.55, 0, fan * sg)}
        p[f"fing_{side}{k}_1"] = {"r": (-curl * 0.8, 0, 0)}
    tc = curl if thumb is None else thumb
    p[f"thumb_{side}_0"] = {"r": (-tc * 0.4, 0, sg * tc * 0.3)}
    p[f"thumb_{side}_1"] = {"r": (-tc * 0.6, 0, 0)}
    return p


def _tent_flare(k, back=0.0):
    """Tentáculos abrindo (k > 0) ou fechando (k < 0) — para rugido, susto, guarda."""
    p = {}
    for i, (base, rot, curl, th, lens) in enumerate(TENTACLES):
        side = -1 if base[0] < -0.5 else 1 if base[0] > 0.5 else 0
        p[f"tent{i}_0"] = {"r": (-back * 20 - k * 6, 0, -side * k * 18)}
        p[f"tent{i}_2"] = {"r": (k * 8, 0, side * k * 18)}
    return p


def _merge(*poses):
    out = {}
    for pz in poses:
        for b, ch in pz.items():
            cur = out.setdefault(b, {})
            for c, v in ch.items():
                if c == "s":
                    cur["s"] = v
                elif c in cur:
                    cur[c] = tuple(a + bb for a, bb in zip(cur[c], v))
                else:
                    cur[c] = tuple(v)
    return out


def _build(keys, length, loop=False, extra=None):
    """keys = [(tempo, pose, curva)] → animação Bedrock amostrada. curva: 'sm' (suave), 'out', 'in', 'snap'."""
    bones = set()
    for _, pz, _ in keys:
        bones |= set(pz)
    anim = {"animation_length": round(length, 3), "bones": {}}
    if loop:
        anim["loop"] = True
    # tempos amostrados: cada pose-chave + 3 pontos no meio de cada trecho (a curva de aceleração fica
    # fiel com interpolação linear) — poucos quadros, como uma animação feita à mão no Blockbench
    times = []
    for j in range(len(keys) - 1):
        t0, t1 = keys[j][0], keys[j + 1][0]
        for f in (0, 0.25, 0.5, 0.75):
            times.append(round(t0 + (t1 - t0) * f, 2))
    times.append(round(keys[-1][0], 2))
    if keys[-1][0] < length - 1e-6:
        times.append(round(length, 2))
    times = sorted(set(min(t, length) for t in times))
    for b in sorted(bones):
        chans = {}
        for c in ("r", "p", "s"):
            if not any(c in pz.get(b, {}) for _, pz, _ in keys):
                continue
            frames = {}
            for t in times:
                # segmento atual
                for j in range(len(keys) - 1):
                    t0, p0, _ = keys[j]
                    t1, p1, curve = keys[j + 1]
                    if t0 <= t <= t1 + 1e-9:
                        u = (t - t0) / max(1e-6, t1 - t0)
                        if curve == "out":
                            u = 1 - (1 - u) ** 3
                        elif curve == "in":
                            u = u ** 3
                        elif curve == "snap":
                            u = 1 - (1 - u) ** 5
                        elif curve == "back":
                            c1 = 1.9
                            u = 1 + (c1 + 1) * (u - 1) ** 3 + c1 * (u - 1) ** 2
                        else:
                            u = _sm(u)
                        default = 1.0 if c == "s" else (0, 0, 0)
                        a = p0.get(b, {}).get(c, default)
                        bb = p1.get(b, {}).get(c, default)
                        if c == "s":
                            v = a + (bb - a) * u
                            frames[f"{t:.2f}"] = round(v, 3)
                        else:
                            frames[f"{t:.2f}"] = [round(a[i] + (bb[i] - a[i]) * u, 1) for i in range(3)]
                        break
            # tira quadros repetidos (arquivo menor)
            keep, last = {}, None
            items = list(frames.items())
            for idx, (k, v) in enumerate(items):
                nxt = items[idx + 1][1] if idx + 1 < len(items) else None
                if v != last or v != nxt or idx == len(items) - 1:
                    keep[k] = v
                last = v
            chans[{"r": "rotation", "p": "position", "s": "scale"}[c]] = keep
        anim["bones"][b] = chans
    if extra:
        anim.update(extra)
    return anim


def _fx(times, effect, locator=None):
    effects = effect if isinstance(effect, (tuple, list)) else (effect,)
    evs = []
    for e in effects:
        ev = {"effect": e}
        if locator:
            ev["locator"] = locator
        evs.append(ev)
    return {"particle_effects": {f"{t:.2f}": (evs if len(evs) > 1 else evs[0]) for t in times}}


def _snd(times, sound):
    return {"sound_effects": {f"{t:.2f}": {"effect": sound} for t in times}}


def _combine(*dicts):
    out = {}
    for d in dicts:
        for k, v in d.items():
            if k in out and isinstance(v, dict):
                out[k] = {**out[k], **v}
            else:
                out[k] = v
    return out


# ================================================================== camadas contínuas
def life_anims():
    A = {}
    # espasmo: um tranco curto de vez em quando (pico estreito de um seno lento) — dá o ar de criatura viva
    tw = lambda sp, ph=0: f"math.pow(math.max(0, math.sin({T} * {sp} + {ph})), 24)"  # noqa: E731
    bones = {
        # flutua respirando: sobe/desce, balança e torce o tronco
        "body": {"position": [f"math.sin({T} * 48) * 0.8", f"math.sin({T} * 110) * 1.8", 0],
                 "rotation": [f"math.sin({T} * 110 + 40) * 4", f"math.sin({T} * 42) * 15", f"math.sin({T} * 55) * 3.5"]},
        "chest": {"rotation": [f"math.sin({T} * 110) * 6 + {tw(31)} * 10", f"math.sin({T} * 47 + 20) * 7", f"math.sin({T} * 61) * 4"],
                  "scale": f"1 + math.sin({T} * 110) * 0.035"},
        "neck": {"rotation": [f"math.sin({T} * 73 + 70) * 6", f"math.sin({T} * 34) * 12", f"math.sin({T} * 39) * 5"]},
        # cabeça: olha em volta devagar, inclina de lado (sinistro) e dá trancos
        "head": {"rotation": [f"math.sin({T} * 83) * 7 - {tw(29, 50)} * 14", f"math.sin({T} * 27 + 60) * 24 + {tw(23, 120)} * 30",
                              f"math.sin({T} * 35) * 16 + {tw(19, 200)} * 24"]},
        # boca: respira abrindo e fechando + estalo de dentes
        "jaw": {"rotation": [f"10 + math.sin({T} * 110) * 10 + {tw(37)} * 38 + {tw(71, 90)} * 18", 0, 0]},
        # fumaça de baixo: ondula como cauda, cada gomo atrasado em relação ao de cima, torce e pulsa
        "smoke_hi": {"rotation": [f"math.sin({T} * 90) * 7", f"math.sin({T} * 38) * 14", f"math.cos({T} * 90) * 8"],
                     "scale": f"1 + math.sin({T} * 150) * 0.05"},
        "smoke_mid": {"rotation": [f"math.sin({T} * 90 - 70) * 16", f"math.sin({T} * 38 - 60) * 18", f"math.cos({T} * 90 - 70) * 13"],
                      "scale": f"1 + math.sin({T} * 150 - 70) * 0.08"},
        "smoke_lo": {"rotation": [f"math.sin({T} * 90 - 140) * 24", f"math.sin({T} * 38 - 120) * 34", f"math.cos({T} * 90 - 140) * 26"],
                     "scale": f"1 + math.sin({T} * 150 - 140) * 0.12"},
        "smoke_pool": {"rotation": [0, f"{T} * 40", 0], "scale": f"1 + math.sin({T} * 120) * 0.16"},
    }
    for side, sg in (("r", -1), ("l", 1)):
        ph = 0 if side == "r" else 110
        # braços pendurados balançando, abrindo um pouco para fora; mãos girando e dedos que coçam o ar
        bones[f"arm_{side}"] = {"rotation": [f"math.sin({T} * 70 + {ph}) * 18 - 6", f"{sg} * math.sin({T} * 41 + {ph}) * 6",
                                             f"{sg} * (7 + math.sin({T} * 55 + {ph}) * 10)"]}
        bones[f"fore_{side}"] = {"rotation": [f"-10 + math.sin({T} * 70 + {ph} - 50) * 18", 0, 0]}
        bones[f"hand_{side}"] = {"rotation": [f"math.sin({T} * 70 + {ph} - 100) * 14", f"{sg} * math.sin({T} * 43) * 12",
                                              f"{sg} * math.sin({T} * 47) * 10"]}
        for k in FINGERS:
            bones[f"fing_{side}{k}_0"] = {"rotation": [f"math.sin({T} * 150 + {k * 47 + ph}) * 16 - 10", 0, 0]}
            bones[f"fing_{side}{k}_1"] = {"rotation": [f"math.sin({T} * 150 + {k * 47 + ph} - 60) * 20 - 14", 0, 0]}
    for i in TENTS:
        sp = 150 + (i * 23) % 70
        for k in SEGS:
            amp = 10 + k * 7.0          # a ponta mexe bem mais que a base (chicote)
            ph = i * 47 + k * 55
            bones[f"tent{i}_{k}"] = {"rotation": [f"math.sin({T} * {sp} - {ph}) * {amp:.1f}", f"math.sin({T} * {sp * 0.6:.0f} - {ph}) * {amp * 0.5:.1f}",
                                                  f"math.cos({T} * {sp * 0.8:.0f} - {ph}) * {amp * 0.9:.1f}"]}
    A["life"] = ("animation.lila.curse.life", {"loop": True, "bones": bones})

    # cubinhos soltos: sobem, giram, se afastam e encolhem até sumir (fumaça que se desfaz)
    bits = {}
    for k in range(12):
        sp = 0.22 + (k % 5) * 0.035
        ph = (k * 0.37) % 1
        u = f"math.mod({T} * {sp:.3f} + {ph:.2f}, 1)"
        ang = k * 30
        bits[f"bit{k}"] = {
            "position": [f"math.sin({ang}) * {u} * 3", f"{u} * 13", f"math.cos({ang}) * {u} * 3"],
            "rotation": [f"{T} * {60 + k * 9}", f"{T} * {80 + k * 7}", 0],
            "scale": f"math.clamp(1.2 - {u} * 1.25, 0, 1.2) * math.clamp({u} * 8, 0, 1)",
        }
    A["bits"] = ("animation.lila.curse.bits", {"loop": True, "bones": bits})

    # voar/deslizar: peso da velocidade (v.cmove vai de 0 a 1) — deita para frente como quem voa,
    # braços e tentáculos arrastam para trás e a fumaça vira um rastro
    mv = "v.cmove"
    glide = {
        "body": {"rotation": [f"{mv} * 32", 0, f"{mv} * math.sin({T} * 120) * 6"], "position": [0, f"{mv} * math.sin({T} * 240) * 1.2", 0]},
        "chest": {"rotation": [f"{mv} * 12", 0, 0]},
        "neck": {"rotation": [f"-{mv} * 16", 0, 0]},
        "head": {"rotation": [f"-{mv} * 22", 0, 0]},
        "jaw": {"rotation": [f"{mv} * 14", 0, 0]},
        "smoke_hi": {"rotation": [f"-{mv} * 26", 0, 0]},
        "smoke_mid": {"rotation": [f"-{mv} * 30", 0, f"{mv} * math.sin({T} * 200) * 10"]},
        "smoke_lo": {"rotation": [f"-{mv} * 34", 0, f"{mv} * math.sin({T} * 200 - 60) * 14"]},
    }
    for side, ph in (("r", 0), ("l", 180)):
        glide[f"arm_{side}"] = {"rotation": [f"{mv} * (42 + math.sin({T} * 200 + {ph}) * 14)", 0, f"{mv} * {(-14 if side == 'r' else 14)}"]}
        glide[f"fore_{side}"] = {"rotation": [f"{mv} * 18", 0, 0]}
    for i in TENTS:
        glide[f"tent{i}_0"] = {"rotation": [f"-{mv} * 30", 0, 0]}
        glide[f"tent{i}_1"] = {"rotation": [f"-{mv} * 12", 0, 0]}
        glide[f"tent{i}_2"] = {"rotation": [f"-{mv} * 14", 0, 0]}
    A["glide"] = ("animation.lila.curse.glide", {"loop": True, "bones": glide})
    # olhar o alvo (a cabeça vira, o pescoço ajuda)
    A["look"] = ("animation.lila.curse.look", {"loop": True, "bones": {
        "head": {"rotation": ["math.clamp(q.target_x_rotation, -35, 35) * 0.6", "math.clamp(q.target_y_rotation, -60, 60) * 0.6", 0]},
        "neck": {"rotation": [0, "math.clamp(q.target_y_rotation, -60, 60) * 0.3", 0]}}})
    return A


# ================================================================== ações
def _punch(side):
    s = side
    sg = -1 if s == "r" else 1
    wind = _merge({f"arm_{s}": {"r": (34, 0, sg * 18)}, f"fore_{s}": {"r": (-62, 0, 0)}, "chest": {"r": (-6, sg * 26, 0)},
                   "body": {"r": (0, sg * 10, 0)}, "head": {"r": (6, -sg * 10, 0)}, "jaw": {"r": (10, 0, 0)}},
                  _fingers(s, 95, 0), {f"arm_{'l' if s == 'r' else 'r'}": {"r": (-12, 0, -sg * 8)}})
    hit = _merge({f"arm_{s}": {"r": (-98, -sg * 8, -sg * 14)}, f"fore_{s}": {"r": (-6, 0, 0)}, f"hand_{s}": {"r": (-8, 0, 0)},
                  "chest": {"r": (14, -sg * 30, 0)}, "body": {"r": (8, -sg * 14, 0), "p": (0, 0, -2.5)}, "head": {"r": (-8, sg * 12, 0)},
                  "jaw": {"r": (30, 0, 0)}, "smoke_hi": {"r": (-10, 0, 0)}, "smoke_mid": {"r": (-8, 0, 0)}},
                 _fingers(s, 105, 0), _tent_flare(0.6), {f"arm_{'l' if s == 'r' else 'r'}": {"r": (20, 0, -sg * 6)}})
    keys = [(0.0, {}, "sm"), (0.16, wind, "out"), (0.26, hit, "snap"), (0.36, hit, "sm"), (0.62, {}, "sm")]
    fx = _combine(_fx([0.26], ("curse_hit", "curse_spark"), f"fist_{s}"), _snd([0.04], "mob.ravager.attack"), _snd([0.25], "mob.irongolem.hit"))
    return _build(keys, 0.62, extra=fx)


def _claw():
    up = _merge({"arm_r": {"r": (-165, 0, -38)}, "fore_r": {"r": (-28, 0, 0)}, "hand_r": {"r": (-20, 0, 0)},
                 "chest": {"r": (-12, 22, 0)}, "head": {"r": (-10, -10, 0)}, "jaw": {"r": (24, 0, 0)}},
                _fingers("r", -40, 14, 10), _tent_flare(0.8, 0.3))
    slash = _merge({"arm_r": {"r": (-38, -30, 40)}, "fore_r": {"r": (-12, 0, 0)}, "hand_r": {"r": (10, 0, 0)},
                    "chest": {"r": (18, -30, 0)}, "body": {"p": (0, -1.5, -2)}, "head": {"r": (4, 14, 0)}, "jaw": {"r": (34, 0, 0)}},
                   _fingers("r", -30, 16, 0), _tent_flare(1.0))
    keys = [(0.0, {}, "sm"), (0.22, up, "out"), (0.32, slash, "snap"), (0.42, slash, "sm"), (0.72, {}, "sm")]
    return _build(keys, 0.72, extra=_combine(_fx([0.32], ("curse_slash", "curse_spark"), "fist_r"), _snd([0.3], "mob.warden.attack_impact")))


def _slam():
    lift = _merge({"arm_r": {"r": (-172, 0, -10)}, "arm_l": {"r": (-172, 0, 10)}, "fore_r": {"r": (-20, 0, 0)}, "fore_l": {"r": (-20, 0, 0)},
                   "chest": {"r": (-18, 0, 0)}, "body": {"p": (0, 2.0, 0), "r": (-6, 0, 0)}, "head": {"r": (-22, 0, 0)}, "jaw": {"r": (40, 0, 0)}},
                  _fingers("r", 100), _fingers("l", 100), _tent_flare(1.2, 0.4))
    smash = _merge({"arm_r": {"r": (-40, 0, 6)}, "arm_l": {"r": (-40, 0, -6)}, "fore_r": {"r": (-10, 0, 0)}, "fore_l": {"r": (-10, 0, 0)},
                    "chest": {"r": (38, 0, 0)}, "body": {"p": (0, -3.5, -2.0), "r": (10, 0, 0)}, "head": {"r": (10, 0, 0)}, "jaw": {"r": (8, 0, 0)},
                    "smoke_pool": {"s": 1.5}, "smoke_lo": {"s": 1.25}},
                   _fingers("r", 110), _fingers("l", 110), _tent_flare(-0.6))
    keys = [(0.0, {}, "sm"), (0.34, lift, "out"), (0.46, smash, "snap"), (0.62, smash, "sm"), (0.95, {}, "sm")]
    fx = _combine(_fx([0.46], ("curse_quake", "curse_ground", "curse_spark")), _snd([0.05], "mob.ravager.roar"), _snd([0.45], "random.explode"))
    return _build(keys, 0.95, extra=fx)


def _grab():
    reach = _merge({"arm_r": {"r": (-92, 8, 6)}, "fore_r": {"r": (-4, 0, 0)}, "chest": {"r": (12, -18, 0)}, "body": {"p": (0, 0, -3)},
                    "head": {"r": (-6, 12, 0)}, "jaw": {"r": (22, 0, 0)}}, _fingers("r", -45, 18, -30))
    clutch = _merge({"arm_r": {"r": (-88, 8, 6)}, "fore_r": {"r": (-8, 0, 0)}, "chest": {"r": (10, -18, 0)}, "body": {"p": (0, 0, -3)}},
                    _fingers("r", 115, 0, 90))
    pull = _merge({"arm_r": {"r": (-118, 0, 24)}, "fore_r": {"r": (-76, 0, 0)}, "chest": {"r": (-4, 10, 0)}, "head": {"r": (-12, 0, 0)},
                   "jaw": {"r": (46, 0, 0)}}, _fingers("r", 115, 0, 90), _tent_flare(0.8))
    keys = [(0.0, {}, "sm"), (0.28, reach, "out"), (0.38, clutch, "snap"), (0.7, pull, "sm"), (1.0, pull, "sm"), (1.3, {}, "sm")]
    return _build(keys, 1.3, extra=_snd([0.36], "mob.irongolem.throw"))


def _bite():
    open_ = _merge({"neck": {"r": (-18, 0, 0)}, "head": {"r": (-20, 0, 0), "p": (0, 1, 1)}, "jaw": {"r": (62, 0, 0)}, "chest": {"r": (-8, 0, 0)}},
                   _tent_flare(1.1, 0.4), _fingers("r", -20, 10), _fingers("l", -20, 10))
    lunge = _merge({"neck": {"r": (36, 0, 0)}, "head": {"r": (12, 0, 0), "p": (0, -2, -5)}, "jaw": {"r": (-6, 0, 0)}, "chest": {"r": (22, 0, 0)},
                    "body": {"p": (0, 0, -3)}}, _tent_flare(-0.4))
    keys = [(0.0, {}, "sm"), (0.22, open_, "out"), (0.32, lunge, "snap"), (0.44, lunge, "sm"), (0.7, {}, "sm")]
    return _build(keys, 0.7, extra=_combine(_fx([0.32], ("curse_hit", "curse_spark"), "mouth"), _snd([0.3], "mob.evocation_fangs.attack")))


def _roar():
    big = _merge({"neck": {"r": (-24, 0, 0)}, "head": {"r": (-30, 0, 0)}, "jaw": {"r": (70, 0, 0)}, "chest": {"r": (-20, 0, 0), "s": 1.06},
                  "arm_r": {"r": (-40, 0, -70)}, "arm_l": {"r": (-40, 0, 70)}, "fore_r": {"r": (-30, 0, 0)}, "fore_l": {"r": (-30, 0, 0)},
                  "body": {"p": (0, 1.5, 1)}}, _fingers("r", -45, 22, -20), _fingers("l", -45, 22, -20), _tent_flare(1.8, 0.5))
    keys = [(0.0, {}, "sm"), (0.3, big, "back"), (1.3, big, "sm"), (1.7, {}, "sm")]
    anim = _build(keys, 1.7, extra=_combine(_fx([0.3, 0.7, 1.1], "curse_roar", "mouth"), _snd([0.25], "mob.warden.roar")))
    # tremedeira do rugido (soma por cima)
    for b in ("head", "chest", "jaw"):
        anim["bones"].setdefault(b, {})
    anim["bones"]["head"]["position"] = ["math.sin(q.anim_time * 2400) * 0.4 * (q.anim_time > 0.3 && q.anim_time < 1.3)", 0, 0]
    return anim


def _guard():
    pose = _merge({"arm_r": {"r": (-72, -10, 46)}, "arm_l": {"r": (-72, 10, -46)}, "fore_r": {"r": (-64, 0, 0)}, "fore_l": {"r": (-64, 0, 0)},
                   "head": {"r": (14, 0, 0)}, "neck": {"r": (10, 0, 0)}, "chest": {"r": (8, 0, 0)}, "jaw": {"r": (-4, 0, 0)}},
                  _fingers("r", 80), _fingers("l", 80), _tent_flare(-1.0, -0.6))
    return _build([(0.0, {}, "sm"), (0.3, pose, "out"), (1.0, pose, "sm")], 1.0, extra={"loop": "hold_on_last_frame"})


def _emerge():
    """Sai do chão devagar e assustador: tentáculos e mãos primeiro, garras cravando no chão, o corpo
    se arrastando para cima com trancos, e um rugido no fim."""
    deep = {"root": {"p": (0, -80, 0)}, "smoke_pool": {"s": 2.2}}
    hands = _merge({"root": {"p": (0, -54, 0)}, "arm_r": {"r": (-176, 0, -18)}, "arm_l": {"r": (-176, 0, 18)}, "fore_r": {"r": (-10, 0, 0)},
                    "fore_l": {"r": (-10, 0, 0)}, "head": {"r": (-30, 0, 0)}, "smoke_pool": {"s": 2.0}},
                   _fingers("r", -40, 20), _fingers("l", -40, 20), _tent_flare(1.4, 0.2))
    grip = _merge({"root": {"p": (0, -40, 0)}, "arm_r": {"r": (-120, 0, -50)}, "arm_l": {"r": (-120, 0, 50)}, "fore_r": {"r": (-60, 0, 0)},
                   "fore_l": {"r": (-60, 0, 0)}, "head": {"r": (-10, 0, 0)}, "jaw": {"r": (20, 0, 0)}, "smoke_pool": {"s": 1.8}},
                  _fingers("r", 100), _fingers("l", 100), _tent_flare(0.8))
    pull1 = _merge({"root": {"p": (0, -26, 0)}, "arm_r": {"r": (-60, 0, -56)}, "arm_l": {"r": (-60, 0, 56)}, "fore_r": {"r": (-70, 0, 0)},
                    "fore_l": {"r": (-70, 0, 0)}, "chest": {"r": (26, 0, 0)}, "head": {"r": (20, 0, 0)}, "smoke_pool": {"s": 1.6}},
                   _fingers("r", 110), _fingers("l", 110))
    pull2 = _merge({"root": {"p": (0, -9, 0)}, "arm_r": {"r": (-20, 0, -40)}, "arm_l": {"r": (-20, 0, 40)}, "fore_r": {"r": (-40, 0, 0)},
                    "fore_l": {"r": (-40, 0, 0)}, "chest": {"r": (30, 0, 0)}, "head": {"r": (24, 0, 0)}, "smoke_pool": {"s": 1.3}},
                   _fingers("r", 90), _fingers("l", 90))
    roar = _merge({"root": {"p": (0, 0, 0)}, "neck": {"r": (-20, 0, 0)}, "head": {"r": (-28, 0, 0)}, "jaw": {"r": (66, 0, 0)},
                   "chest": {"r": (-14, 0, 0), "s": 1.05}, "arm_r": {"r": (-30, 0, -60)}, "arm_l": {"r": (-30, 0, 60)}},
                  _fingers("r", -40, 20), _fingers("l", -40, 20), _tent_flare(1.8, 0.5))
    keys = [(0.0, deep, "sm"), (1.1, hands, "out"), (1.7, grip, "snap"), (2.4, pull1, "out"), (3.1, pull2, "out"), (3.6, roar, "back"),
            (4.4, roar, "sm"), (4.9, {}, "sm")]
    anim = _build(keys, 4.9, extra=_combine(
        {"particle_effects": {"0.00": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}], "0.60": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}], "1.20": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}],
                              "1.70": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}], "2.40": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}], "3.10": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}],
                              "3.60": {"effect": "curse_roar", "locator": "mouth"}, "4.00": {"effect": "curse_roar", "locator": "mouth"}}},
        _snd([0.0], "mob.warden.emerge"), _snd([1.7, 2.4, 3.1], "dig.gravel"), _snd([3.55], "mob.warden.roar")))
    anim["bones"].setdefault("root", {})["rotation"] = ["math.sin(q.anim_time * 1500) * 1.6 * (q.anim_time < 3.4)", 0,
                                                        "math.cos(q.anim_time * 1300) * 1.6 * (q.anim_time < 3.4)"]
    return anim


def _sink():
    """Afunda na terra: abaixa, crava as garras, desce aos trancos e as mãos somem por último."""
    crouch = _merge({"root": {"p": (0, -6, 0)}, "chest": {"r": (30, 0, 0)}, "head": {"r": (16, 0, 0)}, "arm_r": {"r": (-60, 0, -50)},
                     "arm_l": {"r": (-60, 0, 50)}, "fore_r": {"r": (-50, 0, 0)}, "fore_l": {"r": (-50, 0, 0)}, "smoke_pool": {"s": 1.5}},
                    _fingers("r", 100), _fingers("l", 100), _tent_flare(-0.6))
    mid = _merge({"root": {"p": (0, -36, 0)}, "chest": {"r": (10, 0, 0)}, "head": {"r": (-26, 0, 0)}, "jaw": {"r": (50, 0, 0)},
                  "arm_r": {"r": (-150, 0, -30)}, "arm_l": {"r": (-150, 0, 30)}, "smoke_pool": {"s": 1.9}},
                 _fingers("r", -30, 16), _fingers("l", -30, 16), _tent_flare(1.2, 0.3))
    gone = _merge({"root": {"p": (0, -82, 0)}, "arm_r": {"r": (-178, 0, -10)}, "arm_l": {"r": (-178, 0, 10)}, "smoke_pool": {"s": 0.2}},
                  _fingers("r", 110), _fingers("l", 110), _tent_flare(-1.0))
    keys = [(0.0, {}, "sm"), (0.5, crouch, "out"), (1.5, mid, "in"), (2.6, gone, "in"), (2.8, gone, "sm")]
    anim = _build(keys, 2.8, extra=_combine({"particle_effects": {"0.50": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}], "1.10": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}],
                                                                    "1.70": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}], "2.30": [{"effect": "curse_ground"}, {"effect": "curse_ground_smoke"}]}},
                                            _snd([0.4], "mob.warden.dig"), _snd([1.4], "mob.wither.ambient")))
    anim["loop"] = "hold_on_last_frame"
    return anim


def _dissolve():
    spin = _merge({"root": {"p": (0, -4, 0), "s": 0.05}, "chest": {"r": (20, 180, 0)}}, _tent_flare(2.0, 0.5))
    keys = [(0.0, {}, "sm"), (0.3, _merge({"root": {"s": 1.1}}, _tent_flare(1.6)), "out"), (1.2, spin, "in"), (1.3, spin, "sm")]
    anim = _build(keys, 1.3, extra=_combine(_fx([0.1, 0.6, 1.1], "curse_burst", "heart"), _snd([0.1], "mob.wither.break_block")))
    anim["loop"] = "hold_on_last_frame"
    return anim


def _reform():
    small = _merge({"root": {"s": 0.05, "p": (0, -4, 0)}, "chest": {"r": (0, -180, 0)}}, _tent_flare(2.0))
    keys = [(0.0, small, "sm"), (0.9, {"root": {"s": 1.08}}, "back"), (1.3, {}, "sm")]
    return _build(keys, 1.3, extra=_combine(_fx([0.0, 0.5], "curse_burst", "heart"), _snd([0.0], "mob.warden.emerge")))


def _uppercut():
    low = _merge({"arm_l": {"r": (36, 0, 20)}, "fore_l": {"r": (-80, 0, 0)}, "chest": {"r": (24, 18, 0)}, "body": {"p": (0, -2.5, 0)}},
                 _fingers("l", 105))
    high = _merge({"arm_l": {"r": (-168, 0, -12)}, "fore_l": {"r": (-20, 0, 0)}, "chest": {"r": (-20, -16, 0)}, "body": {"p": (0, 3, 0)},
                   "head": {"r": (-18, 0, 0)}, "jaw": {"r": (40, 0, 0)}}, _fingers("l", 105), _tent_flare(1.0, 0.3))
    keys = [(0.0, {}, "sm"), (0.2, low, "out"), (0.3, high, "snap"), (0.42, high, "sm"), (0.75, {}, "sm")]
    return _build(keys, 0.75, extra=_combine(_fx([0.3], ("curse_hit", "curse_spark"), "fist_l"), _snd([0.28], "mob.irongolem.hit")))


def _throw():
    hold = _merge({"arm_r": {"r": (-170, 0, 10)}, "fore_r": {"r": (-60, 0, 0)}, "chest": {"r": (-20, 30, 0)}, "head": {"r": (-10, 0, 0)}},
                  _fingers("r", 110, 0, 90))
    fling = _merge({"arm_r": {"r": (-50, -20, 20)}, "fore_r": {"r": (-5, 0, 0)}, "chest": {"r": (30, -30, 0)}, "body": {"p": (0, 0, -3)},
                    "jaw": {"r": (50, 0, 0)}}, _fingers("r", -40, 20), _tent_flare(1.2))
    keys = [(0.0, {}, "sm"), (0.35, hold, "out"), (0.47, fling, "snap"), (0.6, fling, "sm"), (0.95, {}, "sm")]
    return _build(keys, 0.95, extra=_combine(_snd([0.45], "mob.irongolem.throw")))


def _devour():
    wide = _merge({"neck": {"r": (24, 0, 0)}, "head": {"r": (-8, 0, 0), "p": (0, -1, -3)}, "jaw": {"r": (78, 0, 0)}, "chest": {"r": (16, 0, 0)},
                   "arm_r": {"r": (-70, 0, -40)}, "arm_l": {"r": (-70, 0, 40)}}, _fingers("r", -40, 20), _fingers("l", -40, 20), _tent_flare(1.6, -0.2))
    keys = [(0.0, {}, "sm"), (0.3, wide, "out"), (1.1, wide, "sm"), (1.25, _merge(wide, {"jaw": {"r": (-78, 0, 0)}}), "snap"), (1.6, {}, "sm")]
    anim = _build(keys, 1.6, extra=_combine(_fx([0.3, 0.6, 0.9], "curse_inhale", "mouth"), _snd([0.2], "mob.warden.sonic_charge"),
                                            _snd([1.22], "mob.evocation_fangs.attack")))
    anim["bones"].setdefault("head", {})["scale"] = "1 + math.sin(q.anim_time * 900) * 0.02 * (q.anim_time > 0.3 && q.anim_time < 1.1)"
    return anim


def _flurry():
    keys = [(0.0, {}, "sm")]
    t = 0.0
    for n in range(5):
        side = "r" if n % 2 == 0 else "l"
        sg = -1 if side == "r" else 1
        hit = _merge({f"arm_{side}": {"r": (-96, -sg * 6, -sg * 10)}, f"fore_{side}": {"r": (-6, 0, 0)}, "chest": {"r": (12, -sg * 26, 0)},
                      "body": {"p": (0, 0, -2)}, "jaw": {"r": (26, 0, 0)}}, _fingers(side, 105), _tent_flare(0.5))
        keys.append((t + 0.08, hit, "snap"))
        t += 0.17
        keys.append((t, {"chest": {"r": (6, sg * 10, 0)}}, "sm"))
    keys.append((t + 0.25, {}, "sm"))
    fx = {"particle_effects": {f"{0.08 + n * 0.17:.2f}": [{"effect": "curse_hit", "locator": "fist_r" if n % 2 == 0 else "fist_l"}, {"effect": "curse_spark", "locator": "fist_r" if n % 2 == 0 else "fist_l"}] for n in range(5)},
          "sound_effects": {f"{0.07 + n * 0.17:.2f}": {"effect": "mob.irongolem.hit"} for n in range(5)}}
    return _build(keys, t + 0.25, extra=fx)


# ids de ação (propriedade lila:cact) — o script usa os mesmos números
ACTIONS = ["none", "punch_r", "punch_l", "claw", "slam", "grab", "bite", "roar", "guard", "emerge", "sink", "dissolve", "reform",
           "uppercut", "throw", "devour", "flurry"]


def action_anims():
    fns = {"punch_r": lambda: _punch("r"), "punch_l": lambda: _punch("l"), "claw": _claw, "slam": _slam, "grab": _grab, "bite": _bite,
           "roar": _roar, "guard": _guard, "emerge": _emerge, "sink": _sink, "dissolve": _dissolve, "reform": _reform,
           "uppercut": _uppercut, "throw": _throw, "devour": _devour, "flurry": _flurry}
    return {f"ca_{k}": (f"animation.lila.curse.{k}", fns[k]()) for k in ACTIONS[1:]}


def action_controller(prop="q.property('lila:cact')"):
    states = {"default": {"transitions": [{f"s_{k}": f"{prop} == {i}"} for i, k in enumerate(ACTIONS) if i]}}
    for i, k in enumerate(ACTIONS):
        if not i:
            continue
        states[f"s_{k}"] = {"animations": [f"ca_{k}"], "blend_transition": 0.12,
                            "transitions": [{"default": f"{prop} != {i}"}]}
    return {"initial_state": "default", "states": states}


def sample_pose(anim, t):
    """Pose (para o renderizador de prévias) de uma animação gerada, no tempo t (só valores fixos)."""
    pose = {}
    for b, ch in anim["bones"].items():
        d = {}
        for c, key in (("rotation", "rot"), ("position", "pos"), ("scale", "scale")):
            fr = ch.get(c)
            if not isinstance(fr, dict):
                continue
            ks = sorted(fr, key=float)
            best = ks[0]
            for k in ks:
                if float(k) <= t + 1e-6:
                    best = k
            v = fr[best]
            if isinstance(v, list):
                v = [x if isinstance(x, (int, float)) else 0 for x in v]
            elif not isinstance(v, (int, float)):
                continue
            d[key] = v
        pose[b] = d
    return pose
