"""Formas novas do DR-0N (2.2), todas originais no estilo do drone: nave espacial, disco voador,
submarino, lancha, caminhão-monstro, caça supersônico furtivo e o núcleo do enxame de
nanorrobôs. Quem pilota senta onde enxerga tudo: cabines de vidro ficam no osso "canopy", que
recolhe quando alguém entra (animação pelo q.has_rider).

Convenções: 16 unidades = 1 bloco, +Y para cima, a frente olha para -Z."""
from __future__ import annotations

import math

from .geom import Model, Paint
from .drone_art import CYAN, DARK, GLASS, GRAPH, ORANGE, RED, WHITE
from .forms_art import CHROME, TIRE, _sym

NAVY = Paint(mat="metal", color=(30, 46, 78), color2=(70, 100, 150), seed=61)
LIME = Paint(mat="metal", color=(120, 196, 40), color2=(200, 255, 120), seed=63,
             decals=[("sides", "stripe_band", {"from": 0.55, "to": 0.8, "color": (24, 24, 28)})])
STEALTH = Paint(mat="matte", color=(44, 46, 54), color2=(70, 74, 86), seed=65)
TEAK = Paint(mat="matte", color=(150, 96, 52), color2=(196, 140, 86), seed=67)
GOLDGLASS = Paint(mat="crystal", color=(170, 120, 20), color2=(255, 220, 120), seed=69)
VIOLET = Paint(mat="glow", color=(170, 70, 255), color2=(230, 190, 255), seed=71)


def _seat(b, x, y, z, w=7):
    b.box((x, y, z), (w, 1.2, w), DARK)
    b.box((x, y + 3.4, z + w / 2 + 0.6), (w, 6, 1.2), DARK)


# ----------------------------------------------------------------- nave espacial
def ship_model():
    m = Model("geometry.lila.ship", 256, 256, density=2, bounds=(10, 4, (0, 1, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"muzzle": (0, 13, -48)}
    b = m.bone("body", "root", pivot=(0, 13, 0))
    b.box((0, 13, 2), (18, 10, 58), WHITE)                 # fuselagem
    b.box((0, 12, -33), (13, 8, 14), WHITE)                # nariz
    b.box((0, 11, -43), (7, 5, 7), GRAPH)
    b.box((0, 7.4, 0), (14, 2, 50), GRAPH)                 # quilha
    _sym(b, (9.2, 13, -10), (0.6, 2, 34), ORANGE)          # faixa
    _seat(b, 0, 18.6, -14)
    _seat(b, 0, 18.6, 4)
    b.box((0, 20, -24), (10, 3, 3), GRAPH)                 # painel
    b.box((0, 21.6, -24), (7, 0.4, 2), CYAN)
    cp = m.bone("canopy", "body", pivot=(0, 18, -8))
    cp.box((0, 22, -6), (14, 7, 32), GLASS)                # bolha do cockpit
    _sym(b, (19, 12, 12), (22, 2, 26), GRAPH)              # asas
    _sym(b, (31, 11, 18), (12, 2, 16), WHITE)
    _sym(b, (37.5, 11, 6), (2, 2, 22), DARK)               # canhões laser na ponta das asas
    _sym(b, (37.5, 11, -5.3), (1.4, 1.4, 1), RED)
    _sym(b, (14, 13, 22), (8, 8, 26), GRAPH)               # motores laterais
    _sym(b, (14, 13, 8.7), (6, 6, 0.6), CYAN)              # entradas de ar
    _sym(b, (8, 22, 26), (2, 12, 12), WHITE)               # derivas
    th = m.bone("thrust", "body", pivot=(0, 13, 36))
    _sym(th, (14, 13, 38), (6, 6, 6), CYAN)
    _sym(th, (14, 13, 41), (3, 3, 6), ORANGE)
    th.box((0, 13, 34), (8, 6, 4), CYAN)
    gear = m.bone("gear", "body", pivot=(0, 6, 0))
    gear.box((0, 3.5, -28), (2, 7, 2), GRAPH)
    gear.box((0, 1, -28), (4, 2, 4), DARK)
    _sym(gear, (12, 3.5, 18), (2, 7, 2), GRAPH)
    _sym(gear, (12, 1, 18), (4, 2, 5), DARK)
    return m


# ----------------------------------------------------------------- disco voador
def ufo_model():
    m = Model("geometry.lila.ufo", 256, 256, density=2, bounds=(10, 4, (0, 1.2, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"beam": (0, 2, 0)}
    b = m.bone("body", "root", pivot=(0, 12, 0))
    def disc(y, h, r, paint, n=9):
        """Disco em fatias (círculo "pixelado" como no jogo)."""
        for k in range(n):
            z0 = -r + 2 * r * k / n
            z1 = z0 + 2 * r / n
            zc = (z0 + z1) / 2
            w = 2 * math.sqrt(max(0.0, r * r - zc * zc))
            b.box((0, y, zc), (w, h, z1 - z0), paint)
    disc(12, 4, 37, WHITE, 11)
    disc(16, 3, 30, GRAPH)
    disc(8, 4, 29, GRAPH)
    disc(5, 2, 19, WHITE, 7)
    b.box((0, 17.6, 0), (30, 1, 30), DARK)                 # piso da cabine
    _seat(b, 0, 18.6, -6, 6)
    _seat(b, -9, 18.6, 7, 6)
    _seat(b, 9, 18.6, 7, 6)
    b.box((0, 19.5, -12), (10, 3, 2), GRAPH)               # painel
    b.box((0, 21.1, -12), (7, 0.4, 1.4), VIOLET)
    b.box((0, 3.6, 0), (12, 1, 12), CYAN)                  # emissor do raio trator
    ring = m.bone("ring", "body", pivot=(0, 12, 0))
    for k in range(12):
        a = k * math.pi / 6
        ring.box((math.cos(a) * 36.5, 12, math.sin(a) * 36.5), (3, 2, 3), CYAN if k % 2 else VIOLET)
    cp = m.bone("canopy", "body", pivot=(0, 18, 0))
    for y, r, h in ((22, 14, 8), (28, 9, 4)):
        for k in range(5):
            z0 = -r + 2 * r * k / 5
            zc = z0 + r / 5
            w = 2 * math.sqrt(max(0.0, r * r - zc * zc))
            cp.box((0, y, zc), (w, h, 2 * r / 5), GLASS)
    gear = m.bone("gear", "body", pivot=(0, 4, 0))
    for k in range(3):
        a = k * 2 * math.pi / 3 + math.pi / 2
        x, z = math.cos(a) * 20, math.sin(a) * 20
        gear.box((x, 2.5, z), (2, 6, 2), GRAPH)
        gear.box((x, 0.5, z), (5, 1, 5), DARK)
    return m


# ----------------------------------------------------------------- submarino
def sub_model():
    m = Model("geometry.lila.sub", 256, 256, density=2, bounds=(10, 4, (0, 1.2, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"muzzle": (0, 12, -50)}
    b = m.bone("body", "root", pivot=(0, 12, 0))
    b.box((0, 12, 0), (20, 18, 72), NAVY)                  # casco
    b.box((0, 12, -40), (16, 14, 8), NAVY)                 # proa
    b.box((0, 12, -45.5), (10, 10, 3), GRAPH)
    b.box((0, 12, 40), (14, 12, 8), NAVY)                  # popa
    b.box((0, 12, 46), (8, 8, 4), GRAPH)
    _sym(b, (10.2, 9, 0), (0.6, 1.2, 70), ORANGE)          # faixa
    for z in (-26, -14, 2, 16, 28):
        _sym(b, (10.3, 14, z), (0.6, 4, 4), GLASS)         # escotilhas
    b.box((0, 12, -47.3), (6, 3, 0.6), CYAN)               # holofote
    _sym(b, (14, 13, -26), (8, 1.5, 8), GRAPH)             # lemes de profundidade
    _sym(b, (10, 12, 43), (8, 1.5, 6), GRAPH)
    b.box((0, 20, 44), (1.5, 8, 6), GRAPH)                 # leme
    b.box((0, 22.5, -10), (11, 5, 22), NAVY)               # torre (vela), aberta em cima
    b.box((0, 25.3, -10), (11.4, 0.6, 22.4), ORANGE)
    _seat(b, 0, 21.4, -12, 6)
    _seat(b, -5, 21.6, 14, 6)
    _seat(b, 5, 21.6, 24, 6)
    b.box((3, 31, -2), (1.5, 10, 1.5), GRAPH)              # periscópio
    b.box((3, 35.5, -3), (1.5, 1.5, 3), GLASS)
    cp = m.bone("canopy", "body", pivot=(0, 25, -10))
    cp.box((0, 29, -12), (10, 7, 12), GLASS)               # domo da escotilha
    prop = m.bone("prop", "body", pivot=(0, 12, 49))
    prop.box((0, 12, 49), (2, 2, 3), DARK)
    prop.box((0, 12, 49), (1.2, 14, 1.2), CHROME)
    prop.box((0, 12, 49), (14, 1.2, 1.2), CHROME)
    return m


# ----------------------------------------------------------------- lancha
def boat_model():
    m = Model("geometry.lila.boat", 256, 256, density=2, bounds=(8, 3, (0, 0.8, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    b = m.bone("body", "root", pivot=(0, 6, 0))
    b.box((0, 6, 6), (26, 8, 52), WHITE)                   # casco
    b.box((0, 2.5, 6), (18, 2, 48), RED)                   # fundo em V (linha d'água)
    b.box((0, 7, -26), (20, 6, 12), WHITE)                 # proa
    b.box((0, 8, -34), (12, 4, 6), WHITE)
    b.box((0, 10.4, 6), (24, 0.8, 48), TEAK)               # deque
    _sym(b, (13.2, 8, 4), (0.6, 1.4, 50), CYAN)            # faixa
    b.box((0, 13, -14), (22, 4, 1), GLASS, rotation=(-25, 0, 0), pivot=(0, 11, -14))  # para-brisa baixo
    _seat(b, -6, 11.4, -6)
    _seat(b, 6, 11.4, -6)
    b.box((0, 11.4, 16), (22, 1.2, 7), DARK)               # banco traseiro
    b.box((0, 14.8, 20), (22, 6, 1.2), DARK)
    b.box((-6, 13, -11), (6, 4, 2), GRAPH)                 # painel + volante
    b.box((-6, 15.5, -10), (4, 4, 0.8), DARK)
    mo = m.bone("motor", "body", pivot=(0, 10, 32))
    mo.box((0, 12, 33), (8, 8, 6), GRAPH)
    mo.box((0, 5, 34), (3, 8, 3), DARK)
    pr = m.bone("prop", "motor", pivot=(0, 1.5, 35))
    pr.box((0, 1.5, 35), (1, 6, 1), CHROME)
    pr.box((0, 1.5, 35), (6, 1, 1), CHROME)
    return m


# ----------------------------------------------------------------- caminhão-monstro
def truck_model():
    m = Model("geometry.lila.truck", 256, 256, density=2, bounds=(8, 5, (0, 1.6, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    b = m.bone("body", "root", pivot=(0, 24, 0))
    b.box((0, 21, 0), (28, 4, 54), GRAPH)                  # chassi alto
    for x in (-12, 12):
        for z in (-22, 22):
            b.box((x, 17, z), (3, 8, 3), CHROME)           # molas
    b.box((0, 28, 2), (36, 8, 62), LIME)                   # carroceria
    b.box((0, 33, -18), (34, 2, 24), LIME)                 # capô
    b.box((0, 35, -22), (10, 3, 8), GRAPH)                 # entrada do motor
    _sym(b, (11, 30, -31.3), (8, 3, 0.6), CYAN)            # faróis
    _sym(b, (13, 30, 33.3), (6, 2, 0.6), RED)
    _sym(b, (19, 38, 18), (2, 12, 2), CHROME)              # escapamentos
    for x, z in ((-7.5, -2), (7.5, -2)):
        _seat(b, x, 32.6, z, 8)
    b.box((-7.5, 36, -8), (6, 6, 1), GRAPH)                # volante
    for x, z in ((-16, -9), (16, -9), (-16, 12), (16, 12)):
        b.box((x, 39, z), (1.4, 14, 1.4), GRAPH)           # santantônio (barras finas)
    b.box((0, 46, 1.5), (33.4, 1.4, 22.4), GRAPH)
    cp = m.bone("canopy", "body", pivot=(0, 33, -9))
    cp.box((0, 39, -9.3), (31, 12, 0.6), GLASS)            # para-brisa
    for name, x, z in (("wheel_fl", -22, -22), ("wheel_fr", 22, -22), ("wheel_rl", -22, 22), ("wheel_rr", 22, 22)):
        w = m.bone(name, "root", pivot=(x, 12, z))
        w.box((x, 12, z), (11, 24, 24), TIRE)
        s = 1 if x > 0 else -1
        w.box((x + s * 5.8, 12, z), (0.8, 12, 12), CHROME)
        w.box((x + s * 6.0, 12, z), (0.6, 20, 3), GRAPH)
        w.box((x, 12, z), (11.4, 3, 25), DARK)             # gomos do pneu
    return m


# ----------------------------------------------------------------- caça supersônico furtivo
def stealth_model():
    m = Model("geometry.lila.stealth", 256, 256, density=2, bounds=(12, 3, (0, 1, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"muzzle": (0, 11, -62)}
    b = m.bone("body", "root", pivot=(0, 12, 0))
    b.box((0, 12, 0), (20, 8, 84), STEALTH)                # corpo
    b.box((0, 11, -48), (12, 6, 14), STEALTH)              # nariz em cunha
    b.box((0, 10.5, -57), (6, 4, 6), STEALTH)
    for side in (-1, 1):                                   # asa delta enflechada (caixas giradas)
        b.box((side * 22, 11, 8), (30, 2, 40), STEALTH, rotation=(0, -side * 35, 0), pivot=(side * 10, 11, 0))
        b.box((side * 34, 11, 26), (14, 2, 16), STEALTH, rotation=(0, -side * 35, 0), pivot=(side * 30, 11, 26))
        b.box((side * 9, 21, 34), (2, 14, 14), STEALTH, rotation=(0, 0, side * 25), pivot=(side * 9, 15, 34))
    _sym(b, (10.2, 12, -6), (0.6, 0.8, 50), ORANGE)        # linhas de luz
    b.box((0, 20.6, -30), (7, 1.2, 7), DARK)               # assento
    b.box((0, 24, -26.6), (7, 6, 1.2), DARK)
    cp = m.bone("canopy", "body", pivot=(0, 18, -30))
    cp.box((0, 21.5, -30), (10, 6, 24), GOLDGLASS)
    fl = m.bone("flame", "body", pivot=(0, 12, 42))
    _sym(fl, (5, 12, 47), (6, 4, 10), ORANGE)
    _sym(fl, (5, 12, 51), (3, 2, 12), CYAN)
    gear = m.bone("gear", "body", pivot=(0, 7, 0))
    gear.box((0, 4, -38), (2, 10, 2), GRAPH)
    gear.box((0, 1.5, -38), (2.5, 4, 4), TIRE)
    _sym(gear, (10, 4, 10), (2, 10, 2), GRAPH)
    _sym(gear, (10, 1.5, 10), (3, 4, 5), TIRE)
    return m


# ----------------------------------------------------------------- núcleo do enxame
def swarm_model():
    """Núcleo pequeno + anéis de nanorrobôs (os milhares de verdade são partículas do jogo)."""
    m = Model("geometry.lila.swarm", 64, 64, density=4, bounds=(4, 3, (0, 1, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    core = m.bone("core", "root", pivot=(0, 14, 0))
    core.box((0, 14, 0), (3, 3, 3), CYAN)
    core.box((0, 14, 0), (4, 1, 4), GRAPH)
    for i, (r, n, y) in enumerate(((6, 10, 14), (9, 14, 14), (12, 18, 14))):
        o = m.bone(f"orbit{i}", "core", pivot=(0, 14, 0))
        for k in range(n):
            a = k * 2 * math.pi / n
            o.box((math.cos(a) * r, y + math.sin(a * 3) * 1.5, math.sin(a) * r), (1, 1, 1), DARK if k % 3 else CYAN)
    return m


FORMS2 = {"ship": ship_model, "ufo": ufo_model, "sub": sub_model, "boat": boat_model, "truck": truck_model,
          "stealth": stealth_model, "swarm": swarm_model}
