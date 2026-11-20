"""TITÃ — o modo colossal do DR-0N: um mecha-kaiju metálico original (bípede de pernas
digitígradas, cauda longa em 4 segmentos, nadadeiras dorsais que brilham ao carregar o raio,
mandíbula articulada, reator no peito e cabine de vidro no alto da cabeça).
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
    m = Model("geometry.lila.colossus", 256, 256, density=2, bounds=(12, 10, (0, 4, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"mouth": (0, 86, -60), "fist_r": (26, 34, -18), "fist_l": (-26, 34, -18), "core": (0, 70, -18)}
    hips = m.bone("hips", "root", pivot=(0, 48, 6))
    hips.box((0, 50, 6), (30, 14, 22), GUN)
    hips.box((0, 44, 0), (22, 4, 14), PLATE)
    # pernas digitígradas: coxa → canela (inclinada pra trás) → pé com garras
    def thigh(b, s):
        b.box((s * 14, 40, 4), (13, 22, 15), GUN)
        b.box((s * 20.6, 42, 4), (1, 12, 8), PLATE)
        b.box((s * 20.9, 42, 4), (0.4, 8, 1), SEAM)
    _pair(m, "thigh", "hips", (14, 50, 6), thigh)

    def shin(b, s):
        b.box((s * 14, 20, 8), (10, 22, 10), PLATE)
        b.box((s * 14, 20, 2.6), (6, 16, 1), SEAM)
        b.box((s * 14, 30, 9), (12, 6, 12), STEEL)          # joelho
    _pair(m, "shin", ("thigh_l", "thigh_r"), (14, 30, 6), shin)

    def foot(b, s):
        b.box((s * 14, 4, 0), (15, 8, 22), DARK)
        for dx in (-5, 0, 5):
            b.box((s * 14 + dx, 2.5, -13), (3, 5, 6), STEEL)    # garras
        b.box((s * 14, 3, 12), (4, 4, 6), STEEL)                # esporão traseiro
        b.box((s * 14, 8.4, -6), (10, 0.6, 1), SEAM)
    _pair(m, "foot", ("shin_l", "shin_r"), (14, 9, 8), foot)

    torso = m.bone("torso", "hips", pivot=(0, 56, 4))
    torso.box((0, 70, 0), (40, 30, 32), GUN)
    torso.box((0, 58, -4), (30, 10, 24), PLATE)               # abdômen
    for y in (54, 58, 62):
        torso.box((0, y, -16.4), (24, 2.5, 1), PLATE)         # placas da barriga
    torso.box((0, 72, -16.6), (14, 14, 1.4), DARK)            # moldura do reator
    torso.box((0, 72, -17.4), (10, 10, 1), SEAM)              # reator
    torso.box((0, 72, -17.9), (4, 4, 0.6), STEEL)
    for s in (-1, 1):
        torso.box((s * 22, 80, -2), (10, 8, 26), STEEL)       # ombreiras
        torso.box((s * 22, 84.5, -2), (8, 1, 22), SEAM)
        torso.box((s * 20.6, 66, -8), (0.6, 14, 1), SEAM)     # costuras de luz
    torso.box((0, 86, 8), (30, 2, 16), PLATE)
    torso.box((-6, 79, 16.6), (6, 8, 1), HOT)                 # exaustores nas costas
    torso.box((6, 79, 16.6), (6, 8, 1), HOT)
    # nadadeiras dorsais (brilham ao carregar o raio)
    dorsal = m.bone("dorsal", "torso", pivot=(0, 86, 4))
    glow = m.bone("dorsal_glow", "torso", pivot=(0, 86, 4))
    for k, (z, h) in enumerate(((-6, 16), (2, 20), (10, 18), (18, 14), (26, 10))):
        dorsal.box((0, 86 + h / 2, z), (3, h, 6), PLATE)
        glow.box((0, 86 + h / 2 + 1, z), (3.6, h - 4, 3), SEAM)
    neck = m.bone("neck", "torso", pivot=(0, 80, -14))
    neck.box((0, 84, -22), (16, 14, 18), PLATE)
    neck.box((0, 91.4, -22), (4, 1, 14), SEAM)
    head = m.bone("head", "neck", pivot=(0, 86, -30))
    head.box((0, 91, -42), (22, 16, 26), GUN)                 # crânio
    head.box((0, 97.5, -47), (24, 4, 14), PLATE)              # sobrancelha
    head.box((0, 93, -55.4), (18, 3, 1), SEAM)                # visor dos olhos
    head.box((-5, 93, -55.9), (3, 1.5, 0.6), STEEL)
    head.box((5, 93, -55.9), (3, 1.5, 0.6), STEEL)
    head.box((0, 87, -58), (15, 8, 10), GUN)                  # focinho
    head.box((0, 102, -36), (4, 8, 18), PLATE)                # crista
    head.box((0, 106.5, -34), (2, 1, 12), SEAM)
    head.box((0, 99.6, -40), (12, 1, 12), GLASS)              # cabine do piloto
    for s in (-1, 1):
        head.box((s * 11.4, 92, -38), (1, 4, 10), SEAM)
        head.box((s * 9, 101, -30), (3, 5, 4), PLATE)         # chifres
    jaw = m.bone("jaw", "head", pivot=(0, 85, -34))
    jaw.box((0, 81.5, -48), (16, 5, 26), PLATE)
    jaw.box((0, 84.5, -48), (12, 1, 20), SEAM)                # garganta acesa (raio)
    for x in (-5, -1.5, 1.5, 5):
        jaw.box((x, 85, -59.5), (2, 3, 2), STEEL)             # dentes de baixo
    for x in (-5, -1.5, 1.5, 5):
        head.box((x, 82.5, -60.5), (2, 3, 2), STEEL)          # dentes de cima

    def upper(b, s):
        b.box((s * 26, 68, -6), (11, 22, 11), GUN)
        b.box((s * 31.8, 68, -6), (0.6, 14, 2), SEAM)
    _pair(m, "arm", "torso", (24, 78, -4), upper)

    def fore(b, s):
        b.box((s * 26, 50, -10), (10, 18, 10), PLATE)
        b.box((s * 26, 52, -15.4), (6, 10, 1), SEAM)
        b.box((s * 26, 59, -9), (12, 4, 12), STEEL)           # cotovelo
    _pair(m, "forearm", ("arm_l", "arm_r"), (26, 59, -8), fore)

    def hand(b, s):
        b.box((s * 26, 37, -13), (11, 9, 11), DARK)
        for dx in (-3.5, 0, 3.5):
            b.box((s * 26 + dx, 30, -17), (2.4, 9, 2.4), STEEL)   # garras
        b.box((s * 26, 37, -18.7), (6, 2, 0.6), HOT)
    _pair(m, "hand", ("forearm_l", "forearm_r"), (26, 42, -11), hand)
    # cauda em 4 segmentos (ondula ao andar)
    prev = "hips"
    segs = ((52, 18, 16, 14, 24), (50, 42, 12, 11, 22), (47, 63, 9, 8, 22), (44, 84, 6, 5, 22))
    for i, (y, z0, w, h, ln) in enumerate(segs):
        t = m.bone(f"tail{i + 1}", prev, pivot=(0, y, z0))
        t.box((0, y, z0 + ln / 2), (w, h, ln), GUN if i % 2 == 0 else PLATE)
        t.box((0, y + h / 2 + 1.5, z0 + ln / 2), (2, 3, ln * 0.6), SEAM)
        prev = f"tail{i + 1}"
    m.get("tail4").box((0, 44, 108), (3, 3, 5), HOT)
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
