"""DR-0N — drone-robô original: casco branco/grafite com luzes ciano, olho-sensor,
quatro braços com hélices, duas metralhadoras sob o corpo, pernas de pouso e antena.
Também o controle do drone (tablet com antena)."""
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


def drone_model():
    m = Model("geometry.lila.drone", 128, 128, density=4, bounds=(4, 3, (0, 1.2, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    root.locators = {"ground": (0, 0, 0), "muzzle": (0, 6, -14), "seat": (0, 20, 0)}
    body = m.bone("body", "root", pivot=(0, 14, 0))
    # casco
    body.cube((-8, 10, -8), (16, 7, 16), WHITE)
    body.cube((-9, 12, -6), (18, 3, 12), GRAPH)        # cinta lateral
    body.cube((-6, 9, -6), (12, 1, 12), DARK)          # base
    body.cube((-6, 17, -6), (12, 2, 12), STRIPE)       # tampa com faixa de aviso
    body.cube((-4, 19, -4), (8, 1, 8), GRAPH)          # assento/topo
    for sx in (-1, 1):                                  # luzes laterais
        body.cube((sx * 9 - (1 if sx > 0 else 0) + (0 if sx > 0 else -0.01), 13, -4), (1, 1, 8), CYAN)
    body.cube((-7, 10.5, 7.5), (14, 1, 1), ORANGE)    # luz traseira
    # olho-sensor
    eye = m.bone("eye", "body", pivot=(0, 13.5, -8.5))
    eye.cube((-4, 11.5, -9), (8, 4, 1), DARK)
    eye.cube((-3, 12, -9.6), (6, 3, 1), GLASS)
    eye.cube((-1, 12.5, -10), (2, 2, 1), CYAN)
    # antena
    ant = m.bone("antenna", "body", pivot=(4, 19, 3))
    ant.cube((3.5, 19, 2.5), (1, 6, 1), GRAPH)
    ant.cube((3, 25, 2), (2, 2, 2), ORANGE)
    # braços com hélices
    for i, (ax, az) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        arm = m.bone(f"arm{i}", "body", pivot=(ax * 7, 15, az * 7))
        ox, oz = ax * 7, az * 7
        ex, ez = ax * 15, az * 15
        # braço diagonal em degraus (blocos alinhados = sem rotação de cubo)
        for k in range(4):
            t = (k + 0.5) / 4
            cx, cz = ox + (ex - ox) * t, oz + (ez - oz) * t
            arm.cube((cx - 1.5, 14, cz - 1.5), (3, 2, 3), GRAPH)
        arm.cube((ex - 2.5, 13, ez - 2.5), (5, 3, 5), WHITE)   # motor
        arm.cube((ex - 1, 16, ez - 1), (2, 1, 2), CYAN)
        rot = m.bone(f"rotor{i}", f"arm{i}", pivot=(ex, 17.2, ez))
        rot.cube((ex - 8, 17, ez - 0.75), (16, 0.5, 1.5), DARK)
        rot.cube((ex - 0.75, 17, ez - 8), (1.5, 0.5, 16), DARK)
        rot.cube((ex - 1, 16.8, ez - 1), (2, 1, 2), GRAPH)
    # metralhadoras
    for side, sx in (("gun_r", -1), ("gun_l", 1)):
        g = m.bone(side, "body", pivot=(sx * 5, 9, -2))
        g.cube((sx * 5 - 1.5, 6, -6), (3, 3, 8), GRAPH)
        g.cube((sx * 5 - 0.75, 6.75, -13), (1.5, 1.5, 7), DARK)
        g.cube((sx * 5 - 1, 6.5, -13.5), (2, 2, 1), ORANGE)
        g.cube((sx * 5 - 0.5, 9, -5), (1, 1, 6), CYAN)
    # pernas de pouso
    legs = m.bone("legs", "body", pivot=(0, 9, 0))
    for sx in (-1, 1):
        legs.cube((sx * 5 - 0.75, 3, -4), (1.5, 6, 1.5), GRAPH)
        legs.cube((sx * 5 - 0.75, 3, 2.5), (1.5, 6, 1.5), GRAPH)
        legs.cube((sx * 5 - 1.25, 2, -6), (2.5, 1, 11), WHITE)
    # ---- peças do modo torreta (escondidas em voo; aparecem desdobrando quando ele pousa) ----
    # tripé: fica preso ao chão (filho da raiz, não do corpo)
    tri = m.bone("tripod", "root", pivot=(0, 9, 0))
    tri.cube((-2.5, 0, -2.5), (5, 9, 5), GRAPH)                  # coluna central
    tri.cube((-3.5, 7, -3.5), (7, 2, 7), DARK)                    # anel do giro
    for fx, fz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        for k in range(3):                                         # perna em degraus abrindo pra fora
            t = (k + 1) / 3
            tri.cube((fx * (2 + 5 * t) - 1, 4 - k * 1.5, fz * (2 + 5 * t) - 1), (2, 2, 2), GRAPH)
        tri.cube((fx * 8 - 1.5, 0, fz * 8 - 1.5), (3, 1, 3), WHITE)   # sapata
        tri.cube((fx * 8 - 0.5, 1, fz * 8 - 0.5), (1, 0.5, 1), ORANGE)
    # escudo frontal com visor
    sh = m.bone("shield", "body", pivot=(0, 12, -9))
    sh.cube((-10, 8, -12), (20, 3, 1.5), GRAPH)
    sh.cube((-10, 14, -12), (20, 4, 1.5), GRAPH)
    sh.cube((-10, 11, -12), (6, 3, 1.5), GRAPH)
    sh.cube((4, 11, -12), (6, 3, 1.5), GRAPH)
    sh.cube((-10, 17.5, -12.2), (20, 0.5, 1), ORANGE)
    for sx in (-1, 1):
        sh.cube((sx * 10 - (1.5 if sx > 0 else 0), 8, -11), (1.5, 9, 6), WHITE)   # abas laterais
    # canhão duplo pesado em cima do corpo
    cg = m.bone("cannon", "body", pivot=(0, 20, 0))
    cg.cube((-4.5, 19, -4.5), (9, 3, 9), DARK)
    cg.cube((-3.5, 22, -3), (7, 3, 6), GRAPH)
    for bx in (-2.5, 1):
        cg.cube((bx, 22.75, -19), (1.5, 1.5, 16), GRAPH)
        cg.cube((bx - 0.25, 22.5, -20), (2, 2, 1.5), ORANGE)
    cg.cube((-4.6, 22.5, -1), (0.6, 1, 3), CYAN)
    cg.cube((4, 22.5, -1), (0.6, 1, 3), CYAN)
    # olho vermelho de alvo
    red = m.bone("red_eye", "eye", pivot=(0, 13.5, -10))
    red.cube((-2.5, 12, -10.3), (5, 3, 0.6), RED)
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
