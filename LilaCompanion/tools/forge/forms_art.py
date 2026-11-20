"""Formas do DR-0N (todas originais, no estilo do drone: casco branco/grafite, luzes ciano e
laranja): helicóptero, carro esportivo, escavadeira, tanque, caça a jato, moto e a torreta
gigante. Cada forma é uma geometria separada; a entidade troca de geometria pela propriedade
lila:form (controlador de renderização com lista de geometrias).

Convenções: 16 unidades = 1 bloco, +Y para cima, a frente olha para -Z."""
from __future__ import annotations

from .geom import Model, Paint
from .drone_art import CYAN, DARK, GLASS, GRAPH, ORANGE, RED, STRIPE, WHITE

YELLOW = Paint(mat="metal", color=(226, 168, 24), color2=(255, 214, 86), seed=41)
HAZARD = Paint(mat="metal", color=(230, 172, 30), color2=(255, 220, 90), seed=43,
               decals=[("sides", "stripe_band", {"from": 0.15, "to": 0.85, "color": (30, 30, 34)})])
OLIVE = Paint(mat="metal", color=(66, 78, 56), color2=(118, 132, 96), seed=45)
GUN = Paint(mat="metal", color=(82, 90, 104), color2=(158, 168, 186), seed=47)
TIRE = Paint(mat="matte", color=(22, 22, 26), seed=49)
CHROME = Paint(mat="metal", color=(170, 176, 188), color2=(245, 248, 255), seed=51)


def _sym(b, center, size, paint):
    """Par espelhado em X (lado esquerdo/direito)."""
    x, y, z = center
    b.box((x, y, z), size, paint)
    b.box((-x, y, z), size, paint)


# ----------------------------------------------------------------- helicóptero
def heli_model():
    m = Model("geometry.lila.heli", 256, 256, density=2, bounds=(10, 5, (0, 1.6, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"muzzle": (0, 12, -40), "rotor": (0, 44, 2)}
    b = m.bone("body", "root", pivot=(0, 20, 0))
    b.box((0, 22, -4), (26, 22, 44), WHITE)            # cabine
    b.box((0, 11.5, -2), (24, 3, 40), GRAPH)           # barriga
    b.box((0, 19, -30), (22, 14, 10), WHITE)           # nariz
    b.box((0, 16, -37), (16, 9, 6), GRAPH)
    b.box((0, 26, -29.5), (22.4, 9, 9), GLASS)         # para-brisa
    _sym(b, (13.3, 25, -6), (0.6, 8, 22), GLASS)       # janelas laterais
    _sym(b, (13.4, 17, -4), (0.4, 1.4, 42), CYAN)      # faixa de luz
    b.box((0, 35, 2), (18, 6, 26), GRAPH)              # turbina
    _sym(b, (9.4, 35, -4), (0.6, 3, 6), ORANGE)        # entradas de ar
    b.box((0, 26, 38), (9, 9, 38), WHITE)              # cauda
    b.box((0, 27, 62), (6, 6, 14), WHITE)
    b.box((0, 36, 70), (2, 18, 10), GRAPH)             # deriva
    b.box((0, 27, 60), (22, 2, 6), GRAPH)              # estabilizador
    _sym(b, (13.6, 20, -22), (0.8, 2, 2), ORANGE)      # luzes de navegação
    b.box((0, 9, -26), (6, 3, 6), DARK)                # metralhadora frontal
    b.box((0, 9, -33), (2, 2, 10), DARK)
    rot = m.bone("rotor_main", "body", pivot=(0, 40, 2))
    rot.box((0, 40, 2), (3, 6, 3), DARK)
    rot.box((0, 43.5, 2), (7, 2, 7), GRAPH)
    rot.cube((3.5, 43, -2.5), (64, 1, 5), DARK)
    rot.cube((-67.5, 43, -2.5), (64, 1, 5), DARK)
    rot.cube((-2.5, 43, 5.5), (5, 1, 64), DARK)
    rot.cube((-2.5, 43, -67.5), (5, 1, 64), DARK)
    tail = m.bone("rotor_tail", "body", pivot=(2, 36, 72))
    tail.cube((1.5, 28, 71), (1, 16, 2), DARK)
    tail.cube((1.5, 35, 64), (1, 2, 16), DARK)
    sk = m.bone("skids", "body", pivot=(0, 6, 0))
    for z in (-14, 14):
        _sym(sk, (10, 6.5, z), (2, 9, 2), GRAPH)
    _sym(sk, (11, 1.5, 0), (3, 2, 52), DARK)
    return m


# ----------------------------------------------------------------- carro esportivo
def car_model():
    m = Model("geometry.lila.car", 256, 256, density=2, bounds=(6, 3, (0, 0.8, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    b = m.bone("body", "root", pivot=(0, 8, 0))
    b.box((0, 7, 0), (32, 7, 70), GRAPH)               # chassi
    b.box((0, 12.5, 2), (31, 5, 66), STRIPE)           # carroceria com faixa
    b.box((0, 15.6, -22), (29, 1.4, 22), WHITE)        # capô
    b.box((0, 19, 4), (27, 8, 28), GLASS)              # cabine
    b.box((0, 23.6, 5), (26, 1.4, 24), WHITE)          # teto
    b.box((0, 16, 26), (30, 2, 18), WHITE)             # traseira
    _sym(b, (10, 19, 33), (2, 4, 2), DARK)             # aerofólio
    b.box((0, 21.6, 33), (31, 1, 6), GRAPH)
    _sym(b, (10, 12, -35.6), (8, 2.5, 1), CYAN)        # faróis
    b.box((0, 9, -35.6), (14, 3, 1), DARK)             # grade
    _sym(b, (10, 13, 35.6), (8, 2, 1), RED)            # lanternas
    _sym(b, (16.2, 4.5, 0), (0.6, 1, 56), CYAN)        # neon por baixo
    _sym(b, (15.2, 19, -9), (3, 2, 2), WHITE)          # retrovisores
    _sym(b, (5, 5, 36), (3, 3, 2), CHROME)             # escapamentos
    for name, x, z in (("wheel_fl", -15, -22), ("wheel_fr", 15, -22), ("wheel_rl", -15, 22), ("wheel_rr", 15, 22)):
        w = m.bone(name, "root", pivot=(x, 6, z))
        w.box((x, 6, z), (6, 12, 12), TIRE)
        s = 1 if x > 0 else -1
        w.box((x + s * 3.2, 6, z), (0.8, 7, 7), CHROME)
        w.box((x + s * 3.6, 6, z), (0.4, 2, 2), CYAN)
        w.box((x + s * 3.25, 6, z), (0.6, 10, 2), GRAPH)   # raios (mostram o giro)
    return m


# ----------------------------------------------------------------- escavadeira
def excavator_model():
    m = Model("geometry.lila.excavator", 256, 256, density=2, bounds=(9, 6, (0, 2, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    tr = m.bone("tracks", "root", pivot=(0, 0, 0))
    _sym(tr, (15, 5, 0), (10, 10, 56), TIRE)
    for z in (-20, -7, 7, 20):
        _sym(tr, (20.3, 5, z), (0.6, 6, 6), GRAPH)
    _sym(tr, (15, 10.4, 0), (10.4, 0.8, 50), DARK)
    tr.box((0, 12, 0), (22, 4, 28), GRAPH)
    cab = m.bone("cab", "root", pivot=(0, 14, 0))
    cab.box((0, 16, 0), (34, 4, 34), YELLOW)
    cab.box((0, 24, 9), (32, 12, 16), YELLOW)              # motor
    cab.box((0, 21, 18.5), (32, 10, 3), HAZARD)            # contrapeso
    cab.box((-8, 29, -6), (14, 22, 18), YELLOW)            # cabine
    cab.box((-8, 31, -15.3), (12, 14, 0.6), GLASS)
    cab.box((-15.3, 31, -6), (0.6, 12, 14), GLASS)
    cab.box((-0.7, 31, -6), (0.6, 12, 14), GLASS)
    cab.box((8, 33, 12), (2, 10, 2), DARK)                 # escape
    cab.box((-8, 41, -6), (3, 2, 3), ORANGE)               # giroflex
    cab.box((10, 21, -16.3), (8, 2, 0.6), CYAN)
    boom = m.bone("boom", "cab", pivot=(6, 20, -14), rotation=(-32, 0, 0))
    boom.cube((3, 17, -52), (6, 6, 40), YELLOW)
    boom.cube((3.5, 23, -40), (5, 2, 22), GRAPH)           # cilindro
    stick = m.bone("stick", "boom", pivot=(6, 20, -50), rotation=(78, 0, 0))
    stick.cube((3.5, 17.5, -80), (5, 5, 32), YELLOW)
    stick.cube((4, 22.5, -66), (4, 1.5, 16), GRAPH)
    bucket = m.bone("bucket", "stick", pivot=(6, 20, -78), rotation=(30, 0, 0))
    bucket.cube((-1, 11, -86), (14, 11, 8), DARK)
    bucket.cube((-1, 9.5, -87), (14, 2, 3), CHROME)        # dentes
    return m


# ----------------------------------------------------------------- tanque
def tank_model():
    m = Model("geometry.lila.tank", 256, 256, density=2, bounds=(10, 4, (0, 1.2, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"muzzle": (0, 21, -82)}
    h = m.bone("hull", "root", pivot=(0, 10, 0))
    h.box((0, 9.5, 0), (40, 9, 80), OLIVE)
    h.box((0, 15, -34), (38, 3, 12), OLIVE)
    h.box((0, 15.5, 10), (40, 3, 56), OLIVE)
    _sym(h, (23, 6, 0), (10, 12, 86), TIRE)                 # esteiras
    for z in (-32, -16, 0, 16, 32):
        _sym(h, (28.3, 6, z), (0.6, 8, 8), GRAPH)
    _sym(h, (23, 12.6, 0), (12, 1, 86), OLIVE)              # para-lamas
    _sym(h, (20.4, 17.2, -40), (3, 2, 1), CYAN)             # faróis
    h.box((0, 17.2, 38), (30, 2, 2), DARK)
    t = m.bone("turret", "root", pivot=(0, 17, 4))
    t.box((0, 21.5, 6), (30, 9, 34), OLIVE)
    t.box((0, 21, -12.5), (18, 8, 4), GRAPH)                # mantelete
    t.box((8, 27, 10), (8, 2, 8), DARK)                     # escotilha
    t.box((-8, 28.5, 4), (3, 3, 4), DARK)                   # metralhadora
    t.box((-8, 28.5, -4), (1.5, 1.5, 12), DARK)
    t.box((12, 33, 18), (1, 14, 1), GRAPH)                  # antena
    _sym(t, (15.2, 22, 6), (0.4, 1, 26), CYAN)
    _sym(t, (13, 25, -6), (4, 3, 4), GRAPH)                 # lança-fumaça
    t.box((0, 26.2, 22), (24, 1, 8), ORANGE)                # cesto traseiro
    br = m.bone("barrel", "turret", pivot=(0, 21, -12))
    br.cube((-2, 19, -76), (4, 4, 64), GRAPH)
    br.cube((-3, 18, -81), (6, 6, 5), DARK)
    br.cube((-2.5, 18.5, -50), (5, 5, 6), OLIVE)
    return m


# ----------------------------------------------------------------- caça a jato
def jet_model():
    m = Model("geometry.lila.jet", 256, 256, density=2, bounds=(12, 4, (0, 1, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"muzzle": (0, 12, -70)}
    b = m.bone("body", "root", pivot=(0, 14, 0))
    b.box((0, 14, 0), (16, 14, 96), GRAPH)                  # fuselagem
    b.box((0, 13, -56), (12, 10, 16), GRAPH)                # nariz
    b.box((0, 12.5, -66.5), (6, 5, 5), DARK)
    b.box((0, 22.5, -30), (10, 7, 24), GLASS)               # cockpit
    _sym(b, (9.5, 12, -14), (4, 8, 20), DARK)               # entradas de ar
    _sym(b, (24, 12, 6), (32, 2, 30), WHITE)                # asas (em degraus = enflechadas)
    _sym(b, (40, 12, 14), (16, 2, 20), WHITE)
    _sym(b, (50, 12, 20), (8, 2, 12), WHITE)
    _sym(b, (54.5, 12.5, 20), (1, 1, 8), CYAN)              # luz na ponta da asa
    _sym(b, (6.5, 26, 40), (2, 18, 16), GRAPH)              # derivas
    _sym(b, (16, 14, 46), (20, 2, 14), WHITE)               # profundores
    _sym(b, (4.2, 14, 49.5), (7, 7, 3), DARK)               # bocais
    _sym(b, (26, 8.5, 8), (3, 3, 22), WHITE)                # mísseis
    _sym(b, (26, 8.5, -3.5), (3, 3, 1), ORANGE)
    b.box((0, 18, -42), (10, 1, 4), CYAN)
    fl = m.bone("flame", "body", pivot=(0, 14, 51))
    _sym(fl, (4.2, 14, 57), (5, 5, 10), ORANGE)
    _sym(fl, (4.2, 14, 60), (2.5, 2.5, 12), CYAN)
    gear = m.bone("gear", "body", pivot=(0, 7, 0))
    gear.box((0, 4, -36), (2, 10, 2), GRAPH)
    gear.box((0, 1.5, -36), (2.5, 4, 4), TIRE)
    for z in (8,):
        _sym(gear, (10, 4, z), (2, 10, 2), GRAPH)
        _sym(gear, (10, 1.5, z), (3, 4, 5), TIRE)
    return m


# ----------------------------------------------------------------- moto
def moto_model():
    m = Model("geometry.lila.moto", 128, 128, density=3, bounds=(4, 3, (0, 1, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    b = m.bone("body", "root", pivot=(0, 10, 0))
    b.box((0, 12, 0), (6, 8, 22), GRAPH)                    # quadro
    b.box((0, 17, -2), (8, 5, 12), STRIPE)                  # tanque
    b.box((0, 18.5, 9), (7, 2, 14), DARK)                   # banco
    b.box((0, 17, -13), (9, 9, 6), WHITE)                   # carenagem
    b.box((0, 23, -14.5), (7, 4, 1), GLASS)
    b.box((0, 16, -16.3), (4, 3, 1), CYAN)                  # farol
    b.box((0, 17, 16), (6, 3, 6), WHITE)
    b.box((0, 17, 19.3), (4, 1.5, 0.6), RED)
    b.box((4, 9, 10), (2, 2, 12), CHROME)                   # escapamento
    _sym(b, (3.2, 8, 0), (0.4, 1, 18), CYAN)                # neon
    fork = m.bone("fork", "body", pivot=(0, 22, -14))
    _sym(fork, (2.6, 15, -17), (1.5, 14, 1.5), CHROME)
    fork.box((0, 22.5, -12), (16, 1.5, 1.5), DARK)          # guidão
    wf = m.bone("wheel_f", "fork", pivot=(0, 7, -18))
    wf.box((0, 7, -18), (4, 14, 14), TIRE)
    _sym(wf, (2.2, 7, -18), (0.6, 8, 8), CHROME)
    wf.box((2.6, 7, -18), (0.4, 12, 1.5), GRAPH)
    wr = m.bone("wheel_r", "root", pivot=(0, 7, 15))
    wr.box((0, 7, 15), (5, 14, 14), TIRE)
    _sym(wr, (2.7, 7, 15), (0.6, 8, 8), CHROME)
    wr.box((3.1, 7, 15), (0.4, 12, 1.5), GRAPH)
    return m


# ----------------------------------------------------------------- torreta gigante ("armona")
def turret_model():
    m = Model("geometry.lila.turret_g", 256, 256, density=2, bounds=(8, 8, (0, 3, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"muzzle": (0, 32, -62)}
    base = m.bone("base", "root", pivot=(0, 0, 0))
    base.box((0, 10, 0), (14, 20, 14), GRAPH)
    for fx, fz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        for k in range(4):
            t = (k + 1) / 4
            base.box((fx * (6 + 12 * t), 16 - k * 4, fz * (6 + 12 * t)), (5, 5, 5), GRAPH)
        base.box((fx * 19, 1, fz * 19), (9, 2, 9), WHITE)
        base.box((fx * 19, 2.3, fz * 19), (3, 0.6, 3), ORANGE)
    base.box((0, 21, 0), (28, 4, 28), DARK)
    _sym(base, (14.2, 21, 0), (0.4, 1, 20), ORANGE)
    yaw = m.bone("yaw", "root", pivot=(0, 23, 0))
    yaw.box((0, 31, 3), (24, 14, 26), WHITE)
    _sym(yaw, (13.5, 31, 1), (3, 16, 22), GRAPH)
    yaw.box((0, 37.5, -10.3), (8, 2, 1), RED)
    yaw.box((0, 39, 6), (18, 2, 16), STRIPE)
    yaw.box((8, 44, 12), (2, 8, 2), GRAPH)
    radar = m.bone("radar", "yaw", pivot=(8, 50, 12))
    radar.box((8, 51, 12), (12, 7, 1.5), WHITE)
    radar.box((8, 51, 11), (2, 2, 1), CYAN)
    pitch = m.bone("pitch", "yaw", pivot=(0, 32, -8))
    pitch.box((0, 32, -12), (14, 14, 10), DARK)
    gat = m.bone("gatling", "pitch", pivot=(0, 32, -16))
    gat.box((0, 32, -19), (13, 13, 5), GRAPH)
    import math
    for k in range(6):
        a = k * math.pi / 3
        x, y = math.cos(a) * 3.6, 32 + math.sin(a) * 3.6
        gat.cube((x - 1.1, y - 1.1, -64), (2.2, 2.2, 44), GRAPH)
    gat.box((0, 32, -60), (11, 11, 2), DARK)
    gat.box((0, 32, -40), (10, 10, 2), DARK)
    for side in (-1, 1):
        pod = m.bone("pod_l" if side < 0 else "pod_r", "pitch", pivot=(side * 15, 33, -8))
        pod.box((side * 15, 34, -10), (8, 11, 16), WHITE)
        for dx in (-2, 2):
            for dy in (-2.5, 2.5):
                pod.box((side * 15 + dx, 34 + dy, -18.3), (2, 2, 1), ORANGE)
        pod.box((side * 19.2, 34, -10), (0.4, 1, 12), CYAN)
    return m


FORMS = {
    "heli": heli_model, "car": car_model, "excavator": excavator_model, "tank": tank_model,
    "jet": jet_model, "moto": moto_model, "turret_g": turret_model,
}
