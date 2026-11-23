"""A MALDIÇÃO — modelo em voxel feito a partir das imagens de referência do dono do mod
(folha de personagem preta: cabeça alongada com sulcos, tentáculos curvos, boca enorme com dentes
longos, ombros curvados, braços compridos com garras e a parte de baixo virando fumaça em cubinhos).

Escala: 1 unidade = 1/16 de bloco. Altura total ≈ 72 unidades (4,5 blocos, um pouco maior que um
wither). Frente = -Z. Esquerda da criatura = +X (como no jogador do jogo).

Ossos pensados para animar tudo: corpo, peito, pescoço, cabeça, MANDÍBULA (boca abre/fecha),
9 tentáculos com 4 segmentos cada (ondulam como cobra), braços em 3 partes, 4 dedos com 2
segmentos + polegar em cada mão (garras que abrem e fecham), 3 gomos da coluna de fumaça
(balançam como cauda), poça de fumaça no chão e 10 grupos de cubinhos soltos (sobem e somem).
"""
from __future__ import annotations

import math
import random

from .geom import Model, Paint

# paleta (fundo da folha de referência: preto e cinza-escuro levemente arroxeado)
SKIN = (19, 18, 25)
SKIN_HI = (74, 70, 92)
RIDGE = (30, 28, 39)
RIDGE_HI = (92, 86, 114)
SMOKE = (13, 12, 17)
SMOKE_HI = (54, 51, 66)
TOOTH = (214, 206, 214)
TOOTH_BASE = (150, 128, 140)
MOUTH = (24, 7, 12)
MOUTH_HI = (70, 16, 28)
CLAW = (44, 41, 54)
CLAW_HI = (96, 90, 112)


def P(color=SKIN, hi=SKIN_HI, seed=0, **params):
    params.setdefault("no_nano", True)
    return Paint("voxel", color, hi, seed=seed, params=params)


def tooth_paint(seed):
    return Paint("bone", TOOTH, TOOTH_BASE, seed=seed, params={"no_nano": True})


def mouth_paint():
    return Paint("voxel", MOUTH, MOUTH_HI, seed=5, params={"no_nano": True})


# ---------------------------------------------------------------- dados das partes
# tentáculos: (base x, y, z), rotação de base (x, y, z), curva por segmento (x, z), espessura, comprimentos
TENTACLES = [
    # (base), rotação de base, curva por segmento (x, z), espessura, comprimentos (5 gomos)
    ((-1.7, 65.6, -4.2), (-8, 0, 12), (-3, 20), 2.7, (5.2, 5.0, 4.6, 4.0, 3.4)),     # centrais: chifres que abrem
    ((1.7, 65.6, -4.2), (-8, 0, -12), (-3, -20), 2.7, (5.2, 5.0, 4.6, 4.0, 3.4)),
    ((-4.2, 64.6, -2.6), (-6, 0, 40), (-2, 24), 2.6, (5.0, 4.8, 4.4, 3.8, 3.2)),     # abrem para os lados e caem
    ((4.2, 64.6, -2.6), (-6, 0, -40), (-2, -24), 2.6, (5.0, 4.8, 4.4, 3.8, 3.2)),
    ((-5.8, 62.2, -0.6), (-10, 0, 70), (0, 22), 2.5, (4.8, 4.6, 4.2, 3.6, 3.0)),     # baixos: por cima dos ombros
    ((5.8, 62.2, -0.6), (-10, 0, -70), (0, -22), 2.5, (4.8, 4.6, 4.2, 3.6, 3.0)),
    ((-3.4, 63.4, 2.0), (-50, 0, 30), (-10, 16), 2.4, (4.8, 4.6, 4.2, 3.6, 3.0)),    # de trás: varrem para trás
    ((3.4, 63.4, 2.0), (-50, 0, -30), (-10, -16), 2.4, (4.8, 4.6, 4.2, 3.6, 3.0)),
    ((0.0, 64.0, 1.2), (-34, 0, 0), (-18, 0), 2.5, (5.0, 4.6, 4.2, 3.6, 3.0)),       # nuca
]
SHOULDER = 12.4     # distância do centro até o ombro
SHOULDER_Y = 50.0
UPPER = 14.5        # braço
FORE = 12.5         # antebraço


def _tentacle(m, i, base, rot, curl, th, lens, parent="head"):
    x, y, z = base
    name = f"tent{i}_0"
    b = m.bone(name, parent, (x, y, z), rotation=rot)
    py = y
    seed = 40 + i * 7
    for k, L in enumerate(lens):
        if k:
            b = m.bone(f"tent{i}_{k}", f"tent{i}_{k - 1}", (x, py, z), rotation=(curl[0], 0, curl[1] * (0.8 + k * 0.2)))
        t = th * (1 - k * 0.12)
        b.cube((x - t / 2, py, z - t / 2), (t, L + 0.3, t), P(seed=seed + k))
        # gomo / anel (o desenho segmentado dos tentáculos)
        b.cube((x - t / 2 - 0.25, py + L * 0.45, z - t / 2 - 0.25), (t + 0.5, 0.9, t + 0.5), P(RIDGE, RIDGE_HI, seed=seed + 20 + k))
        py += L
    # ponta afiada
    tip = th * 0.45
    b.cube((x - tip / 2, py, z - tip / 2), (tip, 1.6, tip), P(CLAW, CLAW_HI, seed=seed + 30))
    if i in (6, 7, 8):  # os de trás: pontinha mais longa
        b.cube((x - tip / 3, py + 1.5, z - tip / 3), (tip * 0.66, 1.0, tip * 0.66), P(CLAW, CLAW_HI, seed=seed + 31))


def _arm(m, side):
    """side = -1 (direita, -X) ou +1 (esquerda, +X)."""
    s = "r" if side < 0 else "l"
    sx = side * SHOULDER
    up = m.bone(f"arm_{s}", "chest", (sx, SHOULDER_Y, -1.5), rotation=(-22, 0, side * 24))
    # deltoide enorme (ombro curvado alto) + braço grosso
    up.cube((sx - 4.4, SHOULDER_Y - 3.8, -5.9), (8.8, 8.2, 8.8), P(seed=60 + side), inflate=0.2)
    up.cube((sx - 3.6, SHOULDER_Y + 3.6, -5.0), (7.2, 1.6, 7.0), P(RIDGE, RIDGE_HI, seed=64 + side))
    up.cube((sx - 2.6, SHOULDER_Y - UPPER, -4.1), (5.2, UPPER - 2.0, 5.2), P(seed=62 + side))
    up.cube((sx - 2.9, SHOULDER_Y - UPPER * 0.6, -4.4), (5.8, 2.0, 5.8), P(RIDGE, RIDGE_HI, seed=63 + side))  # tendão
    elbow_y = SHOULDER_Y - UPPER
    fo = m.bone(f"fore_{s}", f"arm_{s}", (sx, elbow_y, -1.5), rotation=(-10, 0, -side * 16))
    fo.cube((sx - 3.0, elbow_y - FORE, -4.6), (6.0, FORE + 0.6, 6.2), P(seed=66 + side))
    fo.cube((sx - 3.2, elbow_y - 2.8, -4.8), (6.4, 2.6, 6.6), P(RIDGE, RIDGE_HI, seed=67 + side))          # cotovelo
    fo.cube((sx - side * 3.1 - 0.6, elbow_y - FORE * 0.8, -3.6), (1.2, FORE * 0.65, 4.0), P(RIDGE, RIDGE_HI, seed=68 + side))  # crista
    fo.cube((sx - 3.3, elbow_y - FORE + 0.2, -4.9), (6.6, 1.8, 6.8), P(RIDGE, RIDGE_HI, seed=69 + side))   # punho
    wy = elbow_y - FORE
    hd = m.bone(f"hand_{s}", f"fore_{s}", (sx, wy, -1.5), rotation=(-8, 0, side * 6))
    hd.cube((sx - 3.6, wy - 5.4, -4.6), (7.2, 5.7, 6.0), P(seed=70 + side))
    hd.cube((sx - 3.8, wy - 1.6, -4.8), (7.6, 1.6, 6.4), P(RIDGE, RIDGE_HI, seed=71 + side))
    # 4 dedos longos (2 gomos + garra), em leque, curvando para dentro
    for k, fx in enumerate((-2.7, -0.9, 0.9, 2.7)):
        x = sx + fx
        ky = wy - 5.2
        spread = (fx / 2.7) * 10
        f0 = m.bone(f"fing_{s}{k}_0", f"hand_{s}", (x, ky, -2.2), rotation=(-14, 0, spread - side * 4))
        L0 = 5.2 - abs(fx) * 0.3
        f0.cube((x - 0.85, ky - L0, -3.05), (1.7, L0 + 0.2, 1.7), P(seed=80 + k))
        f0.cube((x - 0.95, ky - 1.0, -3.15), (1.9, 1.0, 1.9), P(RIDGE, RIDGE_HI, seed=84 + k))  # nó do dedo
        f1 = m.bone(f"fing_{s}{k}_1", f"fing_{s}{k}_0", (x, ky - L0, -2.2), rotation=(-24, 0, -side * 12))
        L1 = 4.2 - abs(fx) * 0.25
        f1.cube((x - 0.7, ky - L0 - L1, -2.9), (1.4, L1 + 0.2, 1.4), P(seed=88 + k))
        f1.cube((x - 0.5, ky - L0 - L1 - 2.6, -2.7), (1.0, 2.7, 1.0), P(CLAW, CLAW_HI, seed=92 + k))   # garra
        f1.cube((x - 0.3, ky - L0 - L1 - 3.7, -2.5), (0.6, 1.2, 0.6), P(CLAW, CLAW_HI, seed=96 + k))     # ponta
    # polegar (lado de dentro)
    tx = sx - side * 3.6
    t0 = m.bone(f"thumb_{s}_0", f"hand_{s}", (tx, wy - 2.2, -2.6), rotation=(-30, 0, -side * 38))
    t0.cube((tx - 0.8, wy - 6.0, -3.4), (1.6, 4.0, 1.6), P(seed=100))
    t1 = m.bone(f"thumb_{s}_1", f"thumb_{s}_0", (tx, wy - 6.0, -2.6), rotation=(-20, 0, -side * 16))
    t1.cube((tx - 0.6, wy - 8.9, -3.2), (1.2, 3.0, 1.2), P(seed=101))
    t1.cube((tx - 0.4, wy - 10.6, -3.0), (0.8, 1.8, 0.8), P(CLAW, CLAW_HI, seed=102))


def _head(m):
    """Cabeça: crânio grande em domo feito de colunas (os sulcos verticais), boca enorme que ocupa
    quase todo o rosto, duas fileiras de dentes longos em arco, mandíbula móvel."""
    hd = m.bone("head", "neck", (0, 51.0, -4.0), rotation=(-20, 0, 0))
    cols, w = 9, 1.5
    half = cols * w / 2
    for k in range(cols):
        x0 = -half + k * w
        xc = x0 + w / 2
        r = abs(xc) / half
        top = 67.5 - (r ** 2.0) * 6.0
        bottom = 55.2 - (r ** 2) * 1.0
        front = -13.4 + (0.0 if k % 2 else -0.6) + (r ** 2) * 2.6
        back = 2.2 - (r ** 2) * 2.0
        ridge = k % 2 == 0
        col_p = P(RIDGE if ridge else SKIN, RIDGE_HI if ridge else SKIN_HI, seed=10 + k)
        depth = back - front
        # perfil de ovo visto de lado: frente um pouco mais baixa, meio mais alto, nuca caindo
        for j, (z0, z1, dh) in enumerate(((0.0, 0.22, -1.6), (0.22, 0.62, 0.0), (0.62, 0.82, -1.8), (0.82, 1.0, -4.2))):
            hd.cube((x0, bottom, front + depth * z0), (w, top + dh - bottom, depth * (z1 - z0)), col_p)
        hd.cube((x0 + 0.12, top - 0.4, front + depth * 0.3), (w - 0.24, 1.0, depth * 0.26), P(SKIN, SKIN_HI, seed=30 + k))
        # testa: faixa saliente que desce até a boca
        if ridge:
            hd.cube((x0 + 0.2, bottom + 1.0, front - 0.35), (w - 0.4, (top - bottom) * 0.55, 0.4), P(RIDGE, RIDGE_HI, seed=50 + k))
    # lábio de cima (borda do crânio sobre a boca)
    hd.cube((-6.7, 54.2, -13.2), (13.4, 1.4, 6.6), P(RIDGE, RIDGE_HI, seed=3))
    # bochechas finas: a boca ocupa quase toda a largura
    for side in (-1, 1):
        hd.cube((side * 6.4 - (1.1 if side > 0 else 0), 46.2, -11.8), (1.1, 9.0, 10.0), P(seed=7 + side))
    # interior da boca (escuro avermelhado)
    hd.cube((-6.2, 47.4, -11.2), (12.4, 7.2, 7.2), mouth_paint())
    # DENTES DE CIMA: 11 em arco, longos e afiados (os do meio maiores)
    n_up = 11
    for k in range(n_up):
        x = -5.9 + k * (11.8 / (n_up - 1))
        z = -12.6 + 0.1 * x * x
        L = 5.6 - abs(x) * 0.28
        hd.cube((x - 0.52, 54.4 - L * 0.5, z - 0.5), (1.04, L * 0.5, 1.0), tooth_paint(200 + k))
        hd.cube((x - 0.34, 54.4 - L * 0.88, z - 0.36), (0.68, L * 0.4, 0.72), tooth_paint(220 + k))
        hd.cube((x - 0.16, 54.4 - L - 0.2, z - 0.22), (0.32, L * 0.16 + 0.2, 0.44), tooth_paint(240 + k))
    # mandíbula: base, queixo, gengiva e DENTES DE BAIXO
    jaw = m.bone("jaw", "head", (0, 50.0, -1.0), rotation=(16, 0, 0))
    jaw.cube((-6.6, 44.0, -12.6), (13.2, 2.6, 12.0), P(SKIN, SKIN_HI, seed=4))
    jaw.cube((-5.4, 43.0, -12.2), (10.8, 1.2, 8.0), P(RIDGE, RIDGE_HI, seed=6))  # queixo
    jaw.cube((-5.9, 46.4, -11.6), (11.8, 0.7, 9.6), mouth_paint())                # gengiva
    n_dn = 10
    for k in range(n_dn):
        x = -5.4 + k * (10.8 / (n_dn - 1))
        z = -12.2 + 0.1 * x * x
        L = 5.0 - abs(x) * 0.26
        jaw.cube((x - 0.5, 46.6, z - 0.48), (1.0, L * 0.5, 0.96), tooth_paint(260 + k))
        jaw.cube((x - 0.32, 46.6 + L * 0.5, z - 0.34), (0.64, L * 0.38, 0.68), tooth_paint(280 + k))
        jaw.cube((x - 0.15, 46.6 + L * 0.88, z - 0.2), (0.3, L * 0.16 + 0.2, 0.4), tooth_paint(300 + k))
    for side in (-1, 1):  # cantos da mandíbula
        jaw.cube((side * 6.5 - (1.3 if side > 0 else 0), 44.2, -11.6), (1.3, 4.0, 10.0), P(seed=9 + side))
    hd.locators["mouth"] = (0, 51.0, -13.0)
    hd.locators["crown"] = (0, 67.0, -2.0)
    return hd


def _torso(m):
    body = m.bone("body", "root", (0, 34.0, 0))
    body.cube((-6.2, 28.0, -4.8), (12.4, 10.0, 9.6), P(seed=1))
    body.cube((-5.6, 30.5, -5.3), (11.2, 1.0, 10.6), P(RIDGE, RIDGE_HI, seed=2))   # cintura marcada
    # corcunda: o peito inclina para a frente, a cabeça vai adiante (como na vista de lado)
    chest = m.bone("chest", "body", (0, 37.0, 0), rotation=(22, 0, 0))
    for k, (y, wd, dp) in enumerate(((36.5, 13.0, 9.8), (39.5, 16.0, 10.8), (42.5, 19.0, 11.4), (45.5, 21.0, 11.6), (48.5, 19.5, 10.6))):
        chest.cube((-wd / 2, y, -dp / 2 - 0.6), (wd, 3.2, dp), P(seed=20 + k))
    for k, y in enumerate((37.8, 40.4, 43.0, 45.6)):  # costelas (cristas na frente)
        wd = 9.0 + k * 2.4
        chest.cube((-wd / 2, y, -6.6 - k * 0.3), (wd, 1.0, 1.6), P(RIDGE, RIDGE_HI, seed=24 + k))
    chest.cube((-1.0, 37.0, -7.4), (2.0, 11.0, 1.4), P(RIDGE, RIDGE_HI, seed=27))  # esterno
    # trapézio alto (corcunda) que sobe por trás da cabeça
    chest.cube((-9.6, 50.5, -3.4), (19.2, 4.6, 8.4), P(seed=28), inflate=0.1)
    chest.cube((-6.0, 54.0, -0.6), (12.0, 3.2, 6.4), P(RIDGE, RIDGE_HI, seed=29))
    # espinha nas costas
    for k in range(7):
        chest.cube((-1.0, 36.0 + k * 2.7, 5.0 + (k % 2) * 0.4), (2.0, 1.8, 1.8), P(RIDGE, RIDGE_HI, seed=34 + k))
    neck = m.bone("neck", "chest", (0, 51.0, -2.0), rotation=(0, 0, 0))
    neck.cube((-3.6, 47.5, -7.0), (7.2, 6.5, 7.0), P(seed=40))
    neck.cube((-2.4, 48.5, -7.8), (4.8, 4.4, 1.2), P(RIDGE, RIDGE_HI, seed=41))
    return body, chest


def _smoke(m):
    """Parte de baixo: coluna de fumaça em cubos que afina e depois abre no chão, em 3 gomos que
    balançam como cauda, uma poça no chão e 10 grupos de cubinhos soltos (sobem e somem)."""
    rnd = random.Random(7)
    # gomos pendurados no corpo (pivô em cima de cada um)
    segs = [("smoke_hi", "body", 29.0, 20.0, (11.6, 9.4), (9.8, 8.2)),
            ("smoke_mid", "smoke_hi", 20.0, 10.0, (9.8, 8.2), (9.0, 7.6)),
            ("smoke_lo", "smoke_mid", 10.0, 1.0, (9.0, 7.6), (14.0, 11.0))]
    for name, parent, y1, y0, (w1, d1), (w0, d0) in segs:
        b = m.bone(name, parent, (0, y1, 0))
        n = int(round(y1 - y0))
        for j in range(n):
            t = j / max(1, n - 1)
            w = w1 + (w0 - w1) * t
            d = d1 + (d0 - d1) * t
            y = y1 - (j + 1)
            ox = math.sin(y * 0.35) * 0.6 + rnd.uniform(-0.25, 0.25)
            oz = math.cos(y * 0.3) * 0.4 + rnd.uniform(-0.2, 0.2) + 0.6
            b.cube((ox - w / 2, y, oz - d / 2), (w, 1.02, d), P(SMOKE, SMOKE_HI, seed=500 + j + y1 * 3))
            # bordas desfiando (cubinhos colados na lateral)
            for _ in range(2 if y < 14 else 1):
                if rnd.random() > (0.75 if y < 14 else 0.5):
                    continue
                sx = rnd.choice((-1, 1))
                cs = rnd.uniform(0.8, 1.8)
                b.cube((ox + sx * (w / 2 + cs * rnd.uniform(0.2, 1.2)) - cs / 2, y + rnd.uniform(-0.2, 0.4), oz + rnd.uniform(-d / 2.5, d / 2.5)), (cs, cs, cs), P(SMOKE, SMOKE_HI, seed=700 + j))
    # poça no chão (fumaça espalhada)
    pool = m.bone("smoke_pool", "root", (0, 0, 0.6))
    for k in range(16):
        a = k / 16 * math.tau + rnd.uniform(-0.2, 0.2)
        r = rnd.uniform(4.5, 9.5)
        cs = rnd.uniform(1.2, 2.6)
        pool.cube((math.cos(a) * r - cs / 2, 0, math.sin(a) * r * 0.8 + 0.6 - cs / 2), (cs, cs * rnd.uniform(0.4, 0.9), cs), P(SMOKE, SMOKE_HI, seed=800 + k))
    pool.cube((-7.5, 0, -5.4), (15.0, 1.2, 12.0), P(SMOKE, SMOKE_HI, seed=820))
    # cubinhos soltos (cada grupo é um osso: a animação faz subir, girar e sumir)
    for k in range(12):
        a = k / 12 * math.tau + 0.3
        r = rnd.uniform(6.5, 11.5)
        y = rnd.uniform(2.0, 24.0)
        x, z = math.cos(a) * r, math.sin(a) * r * 0.8 + 0.6
        bit = m.bone(f"bit{k}", "root", (x, y, z))
        for j in range(rnd.choice((1, 2, 2, 3))):
            cs = rnd.uniform(0.7, 1.5)
            bit.cube((x - cs / 2 + rnd.uniform(-0.8, 0.8), y - cs / 2 + j * 1.3, z - cs / 2 + rnd.uniform(-0.8, 0.8)), (cs, cs, cs), P(SMOKE, SMOKE_HI, seed=900 + k * 3 + j))
    m.get("smoke_hi").locators["smoke_top"] = (0, 26.0, 0.6)
    m.get("smoke_lo").locators["smoke_base"] = (0, 4.0, 0.6)


def curse_model(identifier="geometry.lila.curse"):
    m = Model(identifier, 128, 128, density=4, bounds=(11, 9, (0, 3.5, 0)))
    m.bone("root", None, (0, 0, 0))
    body, chest = _torso(m)
    _head(m)
    for i, (base, rot, curl, th, lens) in enumerate(TENTACLES):
        _tentacle(m, i, base, rot, curl, th, lens)
    _arm(m, -1)
    _arm(m, 1)
    _smoke(m)
    chest.locators["heart"] = (0, 42.0, 0)
    m.get("hand_r").locators["fist_r"] = (-SHOULDER, 16.0, -2.0)
    m.get("hand_l").locators["fist_l"] = (SHOULDER, 16.0, -2.0)
    return m


def curse_icon():
    """Ícone do item Maldição: a cabeça com a boca de dentes e os tentáculos (só a cabeça)."""
    m = curse_model("geometry.lila.curse_icon")
    return m
