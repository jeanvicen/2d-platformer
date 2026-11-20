"""TITÃ — o modo colossal do DR-0N: um robô gigante humanoide original (visor em T, reator no
peito, ombreiras, propulsores nas costas). O piloto vai em cima da cabeça.
Também o robô-soldado do modo exército (humanoide original com visor, propulsor e blaster).

16 unidades = 1 bloco; a entidade aplica escala grande (minecraft:scale) no colosso."""
from __future__ import annotations

from .geom import Model, Paint
from .drone_art import CYAN, DARK, GLASS, GRAPH, ORANGE, RED, WHITE

GUN = Paint(mat="metal", color=(84, 92, 108), color2=(166, 176, 194), seed=61)
PLATE = Paint(mat="metal", color=(58, 64, 78), color2=(120, 130, 150), seed=63)
STEEL = Paint(mat="metal", color=(150, 158, 172), color2=(236, 240, 248), seed=65)
SEAM = Paint(mat="glow", color=(40, 210, 255), color2=(220, 252, 255), seed=67)
HOT = Paint(mat="glow", color=(255, 120, 30), color2=(255, 230, 160), seed=69)
ARMOR = Paint(mat="metal", color=(196, 202, 214), color2=(248, 250, 255), seed=71)
TRIM = Paint(mat="metal", color=(200, 60, 40), color2=(255, 140, 110), seed=73)


def _pair(m, name, parent, pivot, build):
    """Cria osso esquerdo e direito (o direito é o espelho em X)."""
    out = []
    for side, suf in ((-1, "_l"), (1, "_r")):
        px, py, pz = pivot
        b = m.bone(name + suf, parent if isinstance(parent, str) else parent[0 if side < 0 else 1], pivot=(px * side, py, pz))
        build(b, side)
        out.append(b)
    return out


def colossus_model():
    """Robô gigante humanoide original (TITÃ): pés blindados, joelheiras, reator no peito,
    ombreiras enormes, mochila com 2 propulsores e cabeça com visor em T. O piloto vai EM CIMA
    da cabeça (plataforma com corrimão baixo = visão 360°); passageiros nas ombreiras e na mochila.
    Altura sem escala: 7,6 blocos (×3,4 no jogo ≈ 26 blocos)."""
    m = Model("geometry.lila.colossus", 256, 256, density=2, bounds=(12, 10, (0, 4, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"visor": (0, 116, -11), "fist_r": (31, 52, -6), "fist_l": (-31, 52, -6), "core": (0, 95, -15)}
    hips = m.bone("hips", "root", pivot=(0, 66, 0))
    hips.box((0, 66, 0), (34, 12, 20), GUN)
    hips.box((0, 62, -10.6), (14, 8, 1.4), TRIM)             # placa frontal
    hips.box((0, 64, -11.5), (8, 2, 0.6), SEAM)
    for s_ in (-1, 1):
        hips.box((s_ * 17.6, 64, 0), (2, 10, 14), PLATE)       # saias laterais

    def thigh(b, s):
        b.box((s * 12, 53, 0), (14, 26, 14), ARMOR)
        b.box((s * 12, 53, -7.4), (8, 18, 1), PLATE)
        b.box((s * 19.2, 53, 0), (0.6, 16, 2), SEAM)
    _pair(m, "thigh", "hips", (12, 64, 0), thigh)

    def shin(b, s):
        b.box((s * 12, 24, 1), (13, 32, 13), ARMOR)
        b.box((s * 12, 40, -6), (15, 10, 5), TRIM)              # joelheira
        b.box((s * 12, 40, -8.8), (6, 2, 0.6), SEAM)
        b.box((s * 12, 22, -5.8), (5, 18, 1), SEAM)
        b.box((s * 12, 26, 8), (9, 20, 3), GUN)                  # panturrilha (pistões)
    _pair(m, "shin", ("thigh_l", "thigh_r"), (12, 40, 0), shin)

    def foot(b, s):
        b.box((s * 12, 4, -2), (17, 8, 28), DARK)
        b.box((s * 12, 9, -2), (13, 3, 18), ARMOR)
        b.box((s * 12, 4, -16.3), (12, 4, 0.6), HOT)
        b.box((s * 12, 2, 12), (10, 4, 4), STEEL)                # calcanhar
    _pair(m, "foot", ("shin_l", "shin_r"), (12, 8, 0), foot)

    torso = m.bone("torso", "hips", pivot=(0, 72, 0))
    torso.box((0, 77, 0), (24, 10, 16), PLATE)                  # abdômen
    for y in (74, 78):
        torso.box((0, y, -8.4), (16, 2.5, 1), GUN)
    torso.box((0, 95, 0), (46, 26, 28), ARMOR)                  # peito
    torso.box((0, 99, -14.4), (36, 10, 1), TRIM)
    torso.box((0, 90, -14.6), (18, 14, 1.4), DARK)              # moldura do reator
    core = m.bone("core", "torso", pivot=(0, 90, -15.5))
    core.box((0, 90, -15.4), (12, 10, 1), SEAM)                 # reator
    core.box((0, 90, -16), (5, 5, 0.6), STEEL)
    for s_ in (-1, 1):
        torso.box((s_ * 18, 86, -14.6), (8, 3, 1), HOT)         # entradas de ar
        torso.box((s_ * 23.4, 95, 0), (0.6, 18, 2), SEAM)
    torso.box((0, 108.5, 0), (20, 2, 14), PLATE)                 # gola
    # mochila com 2 propulsores (acendem no pulo)
    torso.box((0, 97, 18), (30, 20, 8), PLATE)
    torso.box((0, 107.5, 18), (30, 1, 8), STEEL)                 # topo da mochila (assentos)
    for s_ in (-1, 1):
        torso.box((s_ * 9, 90, 24), (8, 18, 6), GUN)
        torso.box((s_ * 9, 80, 24), (6, 3, 6), DARK)
    jets = m.bone("jets", "torso", pivot=(0, 79, 24))
    for s_ in (-1, 1):
        jets.box((s_ * 9, 74, 24), (5, 8, 5), HOT)
        jets.box((s_ * 9, 69, 24), (3, 6, 3), SEAM)
    neck = m.bone("neck", "torso", pivot=(0, 108, -1))
    neck.box((0, 110.5, -1), (10, 4, 10), DARK)
    head = m.bone("head", "neck", pivot=(0, 112, -1))
    head.box((0, 116, -1), (18, 9, 18), ARMOR)                  # capacete
    head.box((0, 120.6, -1), (18, 0.6, 18), PLATE)               # plataforma do piloto (topo da cabeça)
    for x, z, w, d in ((0, -9.8, 18, 0.6), (0, 7.8, 18, 0.6), (-8.8, -1, 0.6, 18), (8.8, -1, 0.6, 18)):
        head.box((x, 121.8, z), (w, 1.8, d), STEEL)              # corrimão baixo (não tapa a visão)
    head.box((0, 121.2, -1), (6, 0.4, 6), SEAM)                  # marca do assento
    visor = m.bone("visor", "head", pivot=(0, 116, -10.5))
    visor.box((0, 117, -10.4), (14, 2.4, 1), SEAM)               # visor em T
    visor.box((0, 114, -10.4), (3, 4, 1), SEAM)
    head.box((0, 112.6, -10.3), (10, 2, 1), TRIM)               # queixo
    for s_ in (-1, 1):
        head.box((s_ * 9.6, 117, -1), (1.4, 6, 8), PLATE)        # orelhas/antenas laterais
        head.box((s_ * 10.6, 121, 2), (0.8, 6, 0.8), STEEL)
        head.box((s_ * 10.6, 124.4, 2), (1.2, 1.2, 1.2), HOT)

    def upper(b, s):
        b.box((s * 30, 106, 0), (18, 12, 22), ARMOR)             # ombreira enorme (assento)
        b.box((s * 30, 112.4, 0), (16, 0.8, 20), TRIM)
        b.box((s * 39.3, 106, 0), (0.6, 6, 16), SEAM)
        b.box((s * 31, 91, 0), (11, 20, 11), GUN)                # braço
    _pair(m, "arm", "torso", (28, 104, 0), upper)

    def fore(b, s):
        b.box((s * 31, 71, -1), (12, 20, 12), ARMOR)
        b.box((s * 31, 80, -1), (13, 4, 13), STEEL)              # cotovelo
        b.box((s * 31, 72, -7.4), (6, 12, 1), SEAM)
        b.box((s * 37.5, 70, -1), (1, 14, 8), GUN)               # lâmina do antebraço
    _pair(m, "forearm", ("arm_l", "arm_r"), (31, 81, -1), fore)

    def hand(b, s):
        b.box((s * 31, 55, -2), (12, 11, 12), DARK)              # punho
        b.box((s * 31, 57, -8.4), (10, 3, 1), STEEL)             # dedos
        b.box((s * 31, 53, -8.4), (10, 3, 1), STEEL)
        b.box((s * 31, 60.8, -2), (8, 0.6, 8), HOT)
    _pair(m, "hand", ("forearm_l", "forearm_r"), (31, 61, -1), hand)
    return m


def robot_model():
    m = Model("geometry.lila.robot", 128, 128, density=4, bounds=(2, 3, (0, 1, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"muzzle": (-7, 13, -6)}
    waist = m.bone("waist", "root", pivot=(0, 12, 0))
    body = m.bone("body", "waist", pivot=(0, 24, 0))
    body.box((0, 19, 0), (10, 12, 6), WHITE)
    body.box((0, 21, -3.3), (3, 3, 0.6), CYAN)
    body.box((0, 14, 0), (8, 4, 5), GRAPH)
    body.box((0, 20, 3.8), (6, 8, 2), GRAPH)                  # mochila-propulsor
    body.box((-5.3, 19, 0), (0.6, 8, 1), CYAN)
    body.box((5.3, 19, 0), (0.6, 8, 1), CYAN)
    jet = m.bone("jet", "body", pivot=(0, 15, 4.5))
    jet.box((-1.8, 13, 4.8), (2, 5, 2), ORANGE)
    jet.box((1.8, 13, 4.8), (2, 5, 2), ORANGE)
    head = m.bone("head", "body", pivot=(0, 25, 0))
    head.box((0, 29, 0), (8, 8, 8), WHITE)
    head.box((0, 29.5, -4.2), (6.4, 2, 0.6), CYAN)
    head.box((-4.3, 31, 1), (0.6, 4, 3), GRAPH)
    head.box((4.3, 31, 1), (0.6, 4, 3), GRAPH)
    head.box((0, 33.3, 0), (2, 0.6, 6), ORANGE)
    ra = m.bone("rightArm", "body", pivot=(-6, 24, 0))
    ra.box((-7.5, 24, 0), (5, 3, 6), GRAPH)
    ra.box((-7.5, 18.5, 0), (4, 10, 4), WHITE)
    ra.box((-7.5, 13, -1), (5, 4, 7), GRAPH)                  # blaster
    ra.box((-7.5, 13, -4.8), (2, 2, 0.6), CYAN)
    la = m.bone("leftArm", "body", pivot=(6, 24, 0))
    la.box((7.5, 24, 0), (5, 3, 6), GRAPH)
    la.box((7.5, 18.5, 0), (4, 10, 4), WHITE)
    la.box((7.5, 13, 0), (4.4, 3, 4.4), GRAPH)
    for name, x in (("rightLeg", -2.5), ("leftLeg", 2.5)):
        lg = m.bone(name, "waist", pivot=(x, 12, 0))
        lg.box((x, 7, 0), (4, 10, 4), WHITE)
        lg.box((x, 1.5, -0.5), (5, 3, 6), GRAPH)
        lg.box((x, 0.2, 1.4), (3, 0.5, 3), ORANGE)
        lg.box((x, 8, -2.2), (2, 2, 0.6), CYAN)
    return m
