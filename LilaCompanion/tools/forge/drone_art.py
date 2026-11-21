"""DR-0N — robô de peças flutuantes (2.2; antes era um drone de hélices): cabeça, tronco com
núcleo, duas mãos e detritos orbitando. Também o controle (tablet com antena) e as tintas
compartilhadas pelas outras formas (WHITE, GRAPH, CYAN...)."""
from __future__ import annotations

from .geom import Model, Paint

WHITE = Paint(mat="metal", color=(206, 212, 222), color2=(250, 252, 255), seed=21)
GRAPH = Paint(mat="metal", color=(48, 52, 62), color2=(110, 118, 136), seed=23)
DARK = Paint(mat="matte", color=(26, 28, 34), seed=25)
CYAN = Paint(mat="glow", color=(40, 200, 255), color2=(210, 250, 255), seed=27)
ORANGE = Paint(mat="glow", color=(255, 150, 40), color2=(255, 230, 170), seed=29)
STRIPE = Paint(mat="metal", color=(210, 214, 222), color2=(255, 255, 255), seed=31,
               decals=[("sides", "stripe_band", {"from": 0.2, "to": 0.7, "color": (250, 170, 40)})])
GLASS = Paint(mat="crystal", color=(20, 120, 170), color2=(190, 240, 255), seed=33)
RED = Paint(mat="glow", color=(255, 40, 40), color2=(255, 190, 170), seed=35)


ROCK = Paint(mat="stone", color=(112, 116, 124), color2=(168, 172, 180), seed=37)       # casco de pedra-metal
PLATE = Paint(mat="metal", color=(92, 98, 108), color2=(150, 158, 170), seed=39)       # placas e dedos
STEEL = Paint(mat="metal", color=(150, 156, 166), color2=(220, 226, 236), seed=41)     # parafusos, dentes
SOCKET = Paint(mat="matte", color=(18, 22, 28), seed=43)                               # cavidades (aparecem quando desliga)
CORE = Paint(mat="glow", color=(40, 215, 235), color2=(200, 255, 255), seed=45)        # brilho ciano
CORE_DIM = Paint(mat="glow", color=(20, 150, 170), color2=(120, 230, 240), seed=47)

DEBRIS = []  # (2.2) sem detritos orbitando: só as partes principais flutuando por magnetismo


def drone_model():
    """DR-0N (2.2): robô de peças flutuantes, original — cabeça arredondada de pedra-metal com dois
    olhos ciano e boca brilhando, tronco cúbico com núcleo de energia e duas mãos soltas com dedos,
    tudo preso por magnetismo (flutua, sem nada ligando as partes). Nada é ligado: cada parte flutua no seu lugar (dá pra desmontar
    no chão quando desligado e remontar voando ao ligar). As partes que brilham ficam em ossos
    próprios (eyes, mouth, core, glow_hr, glow_hl) para apagar quando ele desliga."""
    m = Model("geometry.lila.drone", 256, 256, density=4, bounds=(4, 4, (0, 1.4, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"ground": (0, 0, 0), "muzzle": (0, 14, -7), "seat": (0, 38, 0), "eye_l": (3.5, 29, -8), "eye_r": (-3.5, 29, -8)}
    fl = m.bone("float", "root", pivot=(0, 14, 0))
    # ---------------- tronco
    t = m.bone("torso", "float", pivot=(0, 14, 0))
    t.cube((-6, 8, -5.5), (12, 12, 11), ROCK)
    t.cube((-5, 20, -4.5), (10, 1, 9), PLATE)                 # tampa
    t.cube((-5, 7, -4.5), (10, 1, 9), SOCKET)                 # base
    for sx in (-1, 1):
        t.cube((sx * 6.3 - 0.5, 9.5, -4), (1, 9, 8), PLATE)  # placas laterais
        t.cube((sx * 4.5 - 0.5, 18.4, -6), (1, 1, 0.6), STEEL)  # rebites
        t.cube((sx * 4.5 - 0.5, 9.2, -6), (1, 1, 0.6), STEEL)
    t.cube((-3.6, 10.4, -6.1), (7.2, 7.2, 0.7), SOCKET)       # moldura do núcleo
    t.cube((-7.1, 11, -2.5), (0.8, 5, 5), PLATE)              # escotilha redonda
    t.cube((-7.5, 12.5, -1), (0.5, 2, 2), SOCKET)
    t.cube((-2, 20.6, 4.6), (4, 1.6, 1), PLATE)               # lascas e degraus do casco
    t.cube((5.2, 15, 5.3), (1.4, 3, 0.6), PLATE)
    t.cube((-6.4, 7.6, 3), (2, 1.4, 2.6), PLATE)
    core = m.bone("core", "torso", pivot=(0, 14, -6.5))
    core.cube((-2.6, 11.4, -6.5), (5.2, 5.2, 0.6), CORE)
    core.cube((-1, 13, -6.8), (2, 2, 0.4), Paint(mat="glow", color=(190, 255, 255), color2=(255, 255, 255), seed=49))
    # ---------------- cabeça (abóbada em degraus = arredondada)
    h = m.bone("head", "float", pivot=(0, 28, 0))
    def disc(y0, hgt, w, d, paint, cut=1.5):
        """camada com cantos chanfrados (duas caixas em cruz) = parece redonda"""
        h.cube((-w / 2, y0, -d / 2 + cut), (w, hgt, d - 2 * cut), paint)
        h.cube((-w / 2 + cut, y0, -d / 2), (w - 2 * cut, hgt, d), paint)
    h.cube((-6, 23.4, -5.5), (12, 0.6, 11), ROCK)
    disc(24, 8, 14, 13, ROCK, 1.6)
    disc(32, 2, 13, 12, ROCK, 2)
    disc(34, 1.5, 11, 10, ROCK, 2.2)
    disc(35.5, 1, 8, 7, PLATE, 1.6)
    for sx in (-1, 1):
        h.cube((sx * 7.3 - 0.3, 25, -5), (0.6, 7, 10), PLATE)          # bochechas
        h.cube((sx * 8 - 0.6, 27, -1.5), (1.2, 4, 4), PLATE)           # "orelhas" de disco
        h.cube((sx * 8.5 - 0.3, 28, -0.5), (0.6, 2, 2), SOCKET)
        h.cube((sx * 3.5 - 2.5, 27.3, -7), (5, 3, 0.5), SOCKET)         # órbitas redondas dos olhos
        h.cube((sx * 3.5 - 1.5, 26.3, -7), (3, 5, 0.5), SOCKET)
    h.cube((-1, 33.6, -6.4), (2, 1, 0.6), STEEL)                       # rebites da testa
    h.cube((-6, 31.2, -6.8), (3, 1, 0.5), PLATE)
    h.cube((3, 31.2, -6.8), (3, 1, 0.5), PLATE)
    h.cube((-5, 24.4, -6.9), (10, 2.2, 0.5), SOCKET)                   # boca
    for x in (-4, -2, 0, 2):
        h.cube((x + 0.3, 25.6, -7.2), (1.2, 1, 0.4), STEEL)            # dentes
    eyes = m.bone("eyes", "head", pivot=(0, 28.8, -7.2))
    for sx in (-1, 1):
        eyes.cube((sx * 3.5 - 2, 27.8, -7.4), (4, 2, 0.5), CORE)         # olho redondo (cruz)
        eyes.cube((sx * 3.5 - 1, 26.8, -7.4), (2, 4, 0.5), CORE)
        eyes.cube((sx * 3.5 - 0.5, 28.3, -7.6), (1, 1, 0.3), Paint(mat="glow", color=(200, 255, 255), color2=(255, 255, 255), seed=51))
    mouth = m.bone("mouth", "head", pivot=(0, 25, -7))
    mouth.cube((-4, 24.5, -6.95), (8, 1.1, 0.4), CORE_DIM)
    # ---------------- mãos soltas (direita = -x)
    for side, sx in (("hand_r", -1), ("hand_l", 1)):
        x = sx * 14
        hd = m.bone(side, "float", pivot=(x, 18, -1))
        hd.cube((x - 3.5, 15, -4.5), (7, 6, 7), ROCK)                  # palma/dorso
        hd.cube((x - 3.5, 20.6, -4.5), (7, 1.4, 7), PLATE)             # placa das juntas
        hd.cube((x - 3.8, 16, 0.5), (7.6, 4, 2), PLATE)                # punho
        for k, fx in enumerate((-2.6, -0.6, 1.4)):
            hd.cube((x + fx - 0.8 + 0.8, 12.6, -4.6), (1.6, 2.6, 1.6), PLATE)   # dedo (falange 1)
            hd.cube((x + fx - 0.7 + 0.8, 10.2, -5.2), (1.4, 2.6, 1.4), ROCK)    # falange 2 (curvada pra frente)
            hd.cube((x + fx - 0.6 + 0.8, 9.2, -5.8), (1.2, 1.2, 1.2), STEEL)    # ponta
        tx = x - sx * 3.6
        hd.cube((tx - 0.8, 13.6, -1.8), (1.6, 3, 1.6), PLATE)          # polegar
        hd.cube((tx - 0.7, 11.8, -2.6), (1.4, 2, 1.4), ROCK)
        g = m.bone("glow_hr" if sx < 0 else "glow_hl", side, pivot=(x, 18, 2.6))
        g.cube((x - 2, 17, 2.5), (4, 2, 0.5), CORE)                     # anel de energia no punho
    return m


def remote_shape(b):
    c = lambda o, s, p: b.cube(o, s, p)
    c((-5, -3.5, -0.8), (10, 7, 1.6), GRAPH)
    c((-4.2, -2.6, -1.05), (8.4, 5.2, 0.4), GLASS)          # tela
    c((-1, -1, -1.2), (2, 2, 0.3), CYAN)                     # ícone do drone
    for bx in (-6.2, 4.6):
        c((bx, -2.5, -0.9), (1.6, 5, 1.8), WHITE)            # pegadores
    c((-4, 3.5, -0.6), (8, 0.8, 1.2), STRIPE)
    c((3.4, 4.3, -0.2), (0.5, 4, 0.5), GRAPH)                # antena
    c((3.15, 8.2, -0.45), (1, 1, 1), ORANGE)
    c((-5.4, 1.2, -1.2), (0.8, 0.8, 0.4), ORANGE)
    c((4.6, 1.2, -1.2), (0.8, 0.8, 0.4), CYAN)


GRIP = (-6.0, 12.5, -0.5)


def remote_icon():
    m = Model("geometry.lila.drone_remote_icon", 64, 64, density=6)
    remote_shape(m.bone("root", pivot=(0, 0, 0)))
    return m


def remote_held():
    m = Model("geometry.lila.drone_remote_held", 64, 64, density=6, bounds=(3, 3, (0, 1, 0)))
    m.bone("lila_item", pivot=GRIP, binding="q.item_slot_to_bone_name(context.item_slot)")
    pad = m.bone("pad", "lila_item", pivot=GRIP, rotation=(108, 0, 0))
    tmp = Model("tmp", 64, 64).bone("t")
    remote_shape(tmp)
    k = 0.7
    gx, gy, gz = GRIP
    for cb in tmp.cubes:
        o = cb.origin
        pad.cube((gx + (o[0] - 5) * k + 1.2, gy + (o[1] + 1) * k, gz + o[2] * k), tuple(v * k for v in cb.size), cb.paint)
    return m
