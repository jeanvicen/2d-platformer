"""Modelos 3D do Sistema de Raças (Roleta das Essências): roda da roleta, roleta na mão, Lâmina
Divina (DEUS), Foice do Vazio (TREVAS), asas (anjo, demônio, deus, trevas), auréolas/coroas,
detalhes do vampiro e do gigante e o morcego.

As peças que vão no jogador usam ossos raiz com o MESMO nome e pivô dos ossos do jogador
(`body`, `head`, `rightArm`...): assim as animações do próprio jogo (andar, olhar, bater) movem as
asas, a auréola e as armaduras junto com o corpo, sem script."""
from __future__ import annotations

import math

from .geom import Model, Paint

# pivôs do humanoide do Bedrock (geometry.humanoid.custom)
PIV = {"body": (0, 24, 0), "head": (0, 24, 0), "rightArm": (-5, 22, 0), "leftArm": (5, 22, 0), "rightLeg": (-1.9, 12, 0), "leftLeg": (1.9, 12, 0)}

G = lambda c, c2, s: Paint(mat="glow", color=c, color2=c2, seed=s)  # noqa: E731
M = lambda c, c2, s, **kw: Paint(mat="metal", color=c, color2=c2, seed=s, **kw)  # noqa: E731
C = lambda c, c2, s: Paint(mat="crystal", color=c, color2=c2, seed=s)  # noqa: E731
F = lambda c, c2, s: Paint(mat="feather", color=c, color2=c2, seed=s)  # noqa: E731
MB = lambda c, c2, s: Paint(mat="membrane", color=c, color2=c2, seed=s)  # noqa: E731
ST = lambda c, c2, s: Paint(mat="stone", color=c, color2=c2, seed=s)  # noqa: E731
LE = lambda c, c2, s: Paint(mat="leather", color=c, color2=c2, seed=s)  # noqa: E731

RACE_COLORS = {  # cor principal, brilho (usadas também nos ícones e na roleta)
    "vampire": ((150, 16, 34), (255, 70, 90)),
    "giant": ((120, 92, 60), (230, 170, 90)),
    "angel": ((236, 228, 206), (255, 236, 160)),
    "demon": ((170, 30, 18), (255, 120, 40)),
    "god": ((255, 246, 220), (255, 214, 90)),
    "dark": ((18, 14, 24), (150, 80, 255)),
}
RACE_ORDER = ["vampire", "giant", "angel", "demon", "god", "dark"]


def _ring(bone, center, radius, n, size, paint, axis="y", phase=0.0):
    cx, cy, cz = center
    for i in range(n):
        a = math.tau * i / n + phase
        if axis == "y":
            p = (cx + math.cos(a) * radius, cy, cz + math.sin(a) * radius)
            rot = (0, -math.degrees(a), 0)
        else:  # anel de frente (eixo z)
            p = (cx + math.cos(a) * radius, cy + math.sin(a) * radius, cz)
            rot = (0, 0, math.degrees(a))
        bone.box(p, size, paint, rotation=rot, pivot=p)


# ------------------------------------------------------------------ roleta
def _wheel(m, parent, cy, R, scale=1.0, glow_seed=0):
    wheel = m.bone("wheel", parent, pivot=(0, cy, 0))
    gold = M((190, 140, 40), (255, 226, 130), 301 + glow_seed)
    dark = M((30, 26, 34), (80, 70, 90), 302 + glow_seed)
    wheel.box((0, cy, 0.6 * scale), (2 * R * 0.18, 2 * R * 0.18, 1.6 * scale), gold)          # cubo central
    for k, race in enumerate(RACE_ORDER):
        base, hi = RACE_COLORS[race]
        a = 90 - k * 60  # setor 0 em cima
        rad = math.radians(a)
        mid = (math.cos(rad) * R * 0.55, cy + math.sin(rad) * R * 0.55, 0)
        sect = Paint(mat="metal", color=base, color2=hi, seed=310 + k)
        wheel.box(mid, (R * 0.62, R * 0.8, 0.9 * scale), sect, rotation=(0, 0, a - 90), pivot=mid)
        # divisória dourada entre setores
        ad = math.radians(a + 30)
        md = (math.cos(ad) * R * 0.55, cy + math.sin(ad) * R * 0.55, -0.1 * scale)
        wheel.box(md, (0.5 * scale, R * 0.92, 1.2 * scale), gold, rotation=(0, 0, a + 30 - 90), pivot=md)
        # símbolo da raça (joia que brilha)
        gp = (math.cos(rad) * R * 0.72, cy + math.sin(rad) * R * 0.72, -0.7 * scale)
        gem = G(hi, (255, 255, 255), 320 + k)
        if race == "vampire":
            for s in (-1, 1):
                wheel.box((gp[0] + s * 0.8 * scale, gp[1], gp[2]), (0.7 * scale, 1.8 * scale, 0.5 * scale), gem)
        elif race == "giant":
            wheel.box(gp, (2.0 * scale, 2.0 * scale, 0.6 * scale), gem)
        elif race in ("angel", "demon"):
            _ring(wheel, gp, 1.2 * scale, 8, (0.6 * scale, 0.6 * scale, 0.5 * scale), gem, axis="z")
            if race == "demon":
                for s in (-1, 1):
                    q = (gp[0] + s * 1.2 * scale, gp[1] + 1.4 * scale, gp[2])
                    wheel.box(q, (0.5 * scale, 1.6 * scale, 0.5 * scale), gem, rotation=(0, 0, -s * 25), pivot=q)
        elif race == "god":
            for s in (-1, 0, 1):
                wheel.box((gp[0] + s * 1.0 * scale, gp[1] + (0.5 if s == 0 else 0) * scale, gp[2]), (0.6 * scale, (2.4 if s == 0 else 1.6) * scale, 0.5 * scale), gem)
        else:
            q = (gp[0], gp[1], gp[2])
            wheel.box(q, (0.5 * scale, 2.6 * scale, 0.5 * scale), gem, rotation=(0, 0, 20), pivot=q)
            q2 = (gp[0] + 0.9 * scale, gp[1] + 1.1 * scale, gp[2])
            wheel.box(q2, (1.8 * scale, 0.5 * scale, 0.5 * scale), gem, rotation=(0, 0, -15), pivot=q2)
    _ring(wheel, (0, cy, 0), R * 1.0, 30, (R * 0.22, 1.0 * scale, 1.5 * scale), gold, axis="z")
    _ring(wheel, (0, cy, -0.8 * scale), R * 1.0, 12, (0.7 * scale, 0.7 * scale, 0.5 * scale), G((255, 220, 120), (255, 255, 230), 330), axis="z", phase=0.13)
    return wheel, gold, dark


def roulette_model():
    """Roda de ~2,4 blocos que aparece na frente do jogador e gira (animação no cliente)."""
    m = Model("geometry.lila.roulette", 128, 128, density=2, bounds=(3, 3, (0, 1.5, 0)))
    root = m.bone("root", pivot=(0, 0, 0))
    cy, R = 24, 18
    stand = m.bone("stand", "root", pivot=(0, 0, 0))
    _, gold, dark = _wheel(m, "root", cy, R)
    stand.box((0, 3, 2.5), (10, 2, 6), dark)
    stand.box((0, 12, 2.5), (2.5, 18, 2.5), gold)
    pointer = m.bone("pointer", "root", pivot=(0, cy + R + 2, -1.5))
    pointer.box((0, cy + R + 3.2, -1.6), (3.4, 3.4, 1.6), G((255, 240, 200), (255, 255, 255), 340), rotation=(0, 0, 45), pivot=(0, cy + R + 3.2, -1.6))
    pointer.box((0, cy + R + 5.5, -1.6), (5, 1.4, 2), gold)
    return m


def roulette_held():
    m = Model("geometry.lila.roulette_held", 64, 64, density=4, bounds=(1, 1, (0, 0.5, 0)))
    root = m.bone("roulette", None, pivot=(0, 0, 0))
    root.binding = "q.item_slot_to_bone_name(c.item_slot)"
    _wheel(m, "roulette", 6, 4.6, scale=0.3, glow_seed=7)
    return m


# ------------------------------------------------------------------ armas
def divine_sword():
    """Lâmina Divina: lâmina de luz cristalina com guarda em asas e gema solar. Ao longo de +Y."""
    m = Model("geometry.lila.divine_sword", 64, 64, density=4, bounds=(1.2, 2.5, (0, 1, 0)))
    root = m.bone("sword", None, pivot=(0, 0, 0))
    root.binding = "q.item_slot_to_bone_name(c.item_slot)"
    gold = M((214, 162, 48), (255, 236, 150), 401)
    grip = LE((90, 60, 30), (170, 120, 60), 402)
    blade = C((240, 236, 214), (255, 255, 255), 403)
    edge = G((255, 230, 140), (255, 255, 240), 404)
    root.box((0, -1.5, 0), (1.6, 6, 1.6), grip)
    root.box((0, -5, 0), (2.4, 2.2, 2.4), gold)
    root.box((0, -5, -1.25), (1.2, 1.2, 0.4), G((255, 200, 60), (255, 255, 200), 405))
    guard = m.bone("guard", "sword", pivot=(0, 2, 0))
    guard.box((0, 2.2, 0), (4, 1.6, 2), gold)
    for s in (-1, 1):  # asas da guarda
        for k in range(3):
            q = (s * (3 + k * 1.6), 2.8 + k * 0.9, 0)
            guard.box(q, (2.2, 0.9, 1.2), gold, rotation=(0, 0, s * (18 + k * 12)), pivot=q)
    b = m.bone("blade", "sword", pivot=(0, 3, 0))
    b.box((0, 12, 0), (2.6, 18, 0.9), blade)
    b.box((0, 12, 0), (0.6, 17, 1.05), edge)
    b.box((0, 22, 0), (1.6, 2, 0.8), blade)
    b.box((0, 23.4, 0), (0.8, 1.2, 0.7), edge)
    for k in range(4):  # runas de luz
        b.box((0, 6 + k * 4, -0.5), (1.0, 1.0, 0.2), edge)
    return m


def void_scythe():
    """Foice do Vazio: cabo negro com espinhos, lâmina curva preta com fio violeta e olho do vazio."""
    m = Model("geometry.lila.void_scythe", 64, 64, density=4, bounds=(1.6, 3, (0, 1.2, 0)))
    root = m.bone("scythe", None, pivot=(0, 0, 0))
    root.binding = "q.item_slot_to_bone_name(c.item_slot)"
    shaft = M((22, 18, 28), (70, 60, 86), 501)
    blade = M((12, 10, 16), (60, 50, 70), 502)
    edge = G((150, 70, 255), (230, 200, 255), 503)
    eye = G((200, 40, 255), (255, 220, 255), 504)
    root.box((0, 6, 0), (1.4, 30, 1.4), shaft)
    root.box((0, -9.5, 0), (2.2, 2.2, 2.2), blade)
    for k in range(5):
        y = -4 + k * 5.5
        root.box((0, y, 0), (2.0, 0.8, 2.0), blade)
    head = m.bone("head", "scythe", pivot=(0, 21, 0))
    head.box((0, 21.5, 0), (3, 3, 3), blade)
    head.box((0, 21.5, -1.6), (1.4, 1.4, 0.4), eye)
    # lâmina curva: segmentos inclinados cada vez mais (arco)
    x, y, ang = 1.5, 22, 8
    for k in range(9):
        L = 3.2 - k * 0.15
        rad = math.radians(ang)
        cx, cy = x + math.cos(rad) * L / 2, y - math.sin(rad) * L / 2
        w = 3.2 - k * 0.3
        head.box((cx, cy, 0), (L + 0.2, max(0.8, w), 0.7), blade, rotation=(0, 0, -ang), pivot=(cx, cy, 0))
        head.box((cx + math.sin(rad) * 0.2, cy - max(0.8, w) / 2 + 0.2, 0), (L + 0.2, 0.45, 0.8), edge, rotation=(0, 0, -ang), pivot=(cx, cy, 0))
        x, y = x + math.cos(rad) * L, y - math.sin(rad) * L
        ang += 14
    for s in (-1, 1):  # espinhos atrás
        q = (-1.6, 22 + s * 1.2, 0)
        head.box(q, (2.4, 0.6, 0.6), blade, rotation=(0, 0, s * 30), pivot=q)
    return m


# ------------------------------------------------------------------ asas
def _wing_pair(m, segs, paints, span, droop=0.0, tiers=3, membrane=False, shards=None, lift=(26, -8, -16)):
    """Asa em 3 segmentos (ombro, meio, ponta): osso de cima, penas de cobertura curtas cobrindo a
    base e penas primárias largas e sobrepostas que crescem para a ponta (ou membrana com garras).
    `lift` = ângulo de repouso de cada segmento (o ombro sobe, a ponta cai): silhueta curva."""
    m.bone("body", None, pivot=PIV["body"])
    for side, suf in ((-1, "_r"), (1, "_l")):
        sx = side  # Bedrock: frente = -Z (asas em +Z); lado direito do jogador = -X
        piv = [(sx * 1.5, 21.5, 2.2)]
        piv.append((sx * (1.5 + segs[0]), 21.5, 2.4))
        piv.append((sx * (1.5 + segs[0] + segs[1]), 21.5, 2.6))
        names = ["wing" + suf, "wing" + suf + "_mid", "wing" + suf + "_tip"]
        parents = ["body", names[0], names[1]]
        x0 = 1.5
        for bi in range(3):
            bone = m.bone(names[bi], parents[bi], pivot=piv[bi])
            bone.rotation = (0, sx * -10 * bi, sx * lift[bi])
            L = segs[bi]
            ytop = 21.5
            z0 = 2.4 + bi * 0.2
            cx = sx * (x0 + L / 2)
            bone.box((cx, ytop + 0.2, z0), (L + 0.4, 1.3, 1.3), paints["bone"])
            if membrane:
                n = max(2, int(L / 2.2))
                for k in range(n):
                    fx = sx * (x0 + (k + 0.5) * L / n)
                    length = span * (0.9 - 0.12 * k / n) * (1.0 + 0.15 * bi)
                    paint = paints["tier"][k % len(paints["tier"])]
                    bone.box((fx, ytop - length / 2 - droop * bi * 0.5, z0 + 0.25), (L / n + 0.25, length, 0.35), paint)
                    # nervura da membrana
                    bone.box((fx - sx * L / n / 2, ytop - length / 2, z0 + 0.05), (0.45, length, 0.5), paints["bone"])
                bone.box((sx * (x0 + L), ytop + 0.6, z0), (0.8, 2.0, 0.8), paints["claw"], rotation=(0, 0, -sx * 25), pivot=(sx * (x0 + L), ytop, z0))
            else:
                # cobertura: penas curtas e largas cobrindo a base da asa
                nc = max(3, int(L / 1.1))
                for k in range(nc):
                    fx = sx * (x0 + (k + 0.5) * L / nc)
                    ln = span * 0.32
                    bone.box((fx, ytop - 0.4 - ln / 2, z0 + 0.45), (L / nc * 1.45, ln, 0.5), paints["tier"][0], rotation=(0, 0, sx * 4), pivot=(fx, ytop, z0))
                # primárias/secundárias: sobrepostas, mais longas para a ponta
                for t in range(tiers):
                    n = max(3, int(L / 1.3))
                    for k in range(n):
                        f = (k + 0.5) / n
                        fx = sx * (x0 + f * L)
                        length = span * (0.5 + 0.22 * t) * (0.85 + 0.35 * (bi + f) / 3) * (1.0 - 0.2 * t * (bi == 0))
                        paint = paints["tier"][min(t + 1, len(paints["tier"]) - 1)] if t > 0 else paints["tier"][min(1, len(paints["tier"]) - 1)]
                        tilt = sx * (4 + 10 * (bi + f) / 3 + t * 3)
                        bone.box((fx, ytop - 0.6 - length / 2 - droop * bi * 0.3, z0 + 0.7 + t * 0.22), (L / n * 1.4, length, 0.42), paint,
                                 rotation=(0, 0, tilt), pivot=(fx, ytop - 0.6, z0))
            if shards:
                for k in range(2):
                    q = (sx * (x0 + L * (0.3 + 0.4 * k)), ytop + 1.8 + k * 0.6, z0 + 0.4)
                    bone.box(q, (0.6, 2.4, 0.6), shards, rotation=(0, 0, sx * 15), pivot=q)
            x0 += L
    return m


def wings(kind):
    if kind == "angel":
        m = Model("geometry.lila.wings_angel", 128, 128, density=2, bounds=(3, 3, (0, 1.4, 0)))
        p = {"bone": F((246, 240, 226), (255, 255, 255), 601),
             "tier": [F((250, 246, 236), (255, 255, 255), 602), F((236, 228, 208), (255, 250, 230), 603), F((222, 210, 184), (255, 236, 190), 604)]}
        return _wing_pair(m, (6, 6, 6), p, 9)
    if kind == "demon":
        m = Model("geometry.lila.wings_demon", 128, 128, density=2, bounds=(3, 3, (0, 1.4, 0)))
        p = {"bone": M((40, 22, 22), (110, 60, 50), 611), "claw": M((20, 10, 10), (90, 40, 30), 612),
             "tier": [MB((150, 20, 14), (255, 90, 40), 613), MB((120, 14, 12), (220, 60, 30), 614)]}
        return _wing_pair(m, (6, 7, 6), p, 10, droop=1.2, tiers=2, membrane=True)
    if kind == "god":
        m = Model("geometry.lila.wings_god", 128, 128, density=2, bounds=(4, 4, (0, 1.6, 0)))
        p = {"bone": M((230, 186, 70), (255, 240, 170), 621),
             "tier": [F((255, 252, 240), (255, 255, 255), 622), F((255, 240, 200), (255, 255, 240), 623), F((250, 220, 140), (255, 246, 200), 624),
                      G((255, 230, 150), (255, 255, 235), 625)]}
        return _wing_pair(m, (9, 9, 9), p, 14, tiers=4, shards=G((255, 236, 160), (255, 255, 255), 626))
    m = Model("geometry.lila.wings_dark", 128, 128, density=2, bounds=(4, 4, (0, 1.6, 0)))
    p = {"bone": M((16, 12, 20), (60, 50, 76), 631),
         "tier": [F((14, 12, 18), (52, 36, 76), 632), F((22, 16, 30), (70, 44, 110), 633), F((10, 8, 14), (44, 30, 70), 634)]}
    return _wing_pair(m, (8, 9, 8), p, 13, droop=0.8, tiers=3, shards=G((120, 50, 230), (220, 190, 255), 635))


def crown(kind):
    """Auréola/coroa sobre a cabeça (osso `head` com o pivô do jogador)."""
    ident = {"angel": "halo_angel", "demon": "halo_demon", "god": "crown_god", "dark": "crown_dark"}[kind]
    m = Model(f"geometry.lila.{ident}", 64, 64, density=4, bounds=(1.5, 1.5, (0, 2.2, 0)))
    m.bone("head", None, pivot=PIV["head"])
    h = m.bone("halo", "head", pivot=(0, 35, 0))
    if kind == "angel":
        _ring(h, (0, 35, 0), 4.2, 18, (1.6, 0.7, 0.7), G((255, 220, 110), (255, 255, 220), 701))
    elif kind == "demon":
        red = G((220, 30, 20), (255, 140, 80), 711)
        _ring(h, (0, 35, 0), 4.0, 14, (1.8, 0.8, 0.8), red)
        for i in range(7):
            a = math.tau * i / 7
            q = (math.cos(a) * 4.0, 36.2, math.sin(a) * 4.0)
            h.box(q, (0.6, 2.0, 0.6), red, rotation=(math.degrees(math.sin(a)) * 0.3, 0, -math.degrees(math.cos(a)) * 0.3), pivot=(q[0], 35, q[2]))
    elif kind == "god":
        gold = G((255, 214, 90), (255, 255, 230), 721)
        light = G((255, 250, 220), (255, 255, 255), 722)
        _ring(h, (0, 35, 0), 5.0, 22, (1.6, 0.8, 0.8), gold)
        for i in range(9):  # raios da coroa
            a = math.tau * i / 9
            q = (math.cos(a) * 5.0, 37.0 + (i % 2) * 0.8, math.sin(a) * 5.0)
            h.box(q, (0.8, 3.2 + (i % 2) * 1.6, 0.8), light, pivot=(q[0], 35, q[2]))
        _ring(h, (0, 39.8, 0), 2.2, 8, (0.9, 0.9, 0.9), gold, phase=0.2)
    else:
        black = M((14, 10, 18), (60, 46, 80), 731)
        void = G((130, 50, 240), (230, 200, 255), 732)
        _ring(h, (0, 35, 0), 4.8, 20, (1.7, 0.9, 0.9), black)
        for i in range(8):
            a = math.tau * i / 8
            q = (math.cos(a) * 4.8, 37.0, math.sin(a) * 4.8)
            h.box(q, (0.9, 3.5 + (i % 3) * 0.9, 0.9), black, rotation=((i % 2) * 12 - 6, 0, (i % 3) * 8 - 8), pivot=(q[0], 35, q[2]))
        h.box((0, 35, 0), (1.6, 1.6, 1.6), void)
    return m


def vampire_overlay():
    m = Model("geometry.lila.vampire", 64, 64, density=4, bounds=(1.5, 2.2, (0, 1, 0)))
    head = m.bone("head", None, pivot=PIV["head"])
    eye = G((255, 30, 50), (255, 190, 190), 801)
    for s in (-1, 1):
        head.box((s * 2.0, 28.0, -4.08), (1.2, 0.8, 0.2), eye)
        head.box((s * 0.9, 25.5, -4.06), (0.45, 0.9, 0.15), M((240, 236, 230), (255, 255, 255), 802))
    body = m.bone("body", None, pivot=PIV["body"])
    collar = LE((60, 6, 14), (150, 20, 40), 803)
    body.box((0, 24.8, 2.4), (9, 4.2, 0.8), collar, rotation=(-14, 0, 0), pivot=(0, 24, 2.4))
    for s in (-1, 1):
        body.box((s * 4.6, 24.8, 0), (0.8, 4.2, 5.4), collar, rotation=(0, 0, s * 14), pivot=(s * 4.2, 24, 0))
    body.box((0, 23.4, -2.2), (2.2, 1.4, 0.4), G((190, 10, 30), (255, 110, 120), 804))
    cape = m.bone("cape_v", "body", pivot=(0, 24, 2.6))
    cape.box((0, 14.5, 2.9), (9, 19, 0.5), LE((40, 4, 10), (120, 14, 30), 805))
    cape.box((0, 14.5, 2.62), (8, 18, 0.1), LE((110, 8, 22), (190, 30, 50), 806))
    return m


def giant_overlay():
    m = Model("geometry.lila.giant", 64, 64, density=4, bounds=(1.5, 2.2, (0, 1, 0)))
    bronze = M((150, 96, 40), (240, 180, 90), 901, params={"rivets": True})
    stone = ST((96, 90, 84), (150, 142, 132), 902)
    head = m.bone("head", None, pivot=PIV["head"])
    head.box((0, 30.6, -4.1), (8.6, 1.6, 0.6), bronze)
    head.box((0, 32.4, 0), (8.6, 0.8, 8.6), stone)
    body = m.bone("body", None, pivot=PIV["body"])
    body.box((0, 13.2, 0), (8.8, 1.8, 4.8), bronze)
    body.box((0, 19, -2.25), (5, 6, 0.5), stone)
    for name, x in (("rightArm", -5), ("leftArm", 5)):
        a = m.bone(name, None, pivot=PIV[name])
        a.box((x + (-1 if x < 0 else 1), 23, 0), (5.2, 2.6, 5.2), bronze)
        a.box((x + (-1 if x < 0 else 1), 14, 0), (4.6, 3.4, 4.6), bronze)
    for name, x in (("rightLeg", -1.9), ("leftLeg", 1.9)):
        lg = m.bone(name, None, pivot=PIV[name])
        lg.box((x, 4, -0.2), (4.6, 4, 4.6), stone)
        lg.box((x, 7, -2.4), (2.6, 2.2, 0.4), bronze)
    return m


def bat_model():
    """Morcego do vampiro (modelado grande: o jogador fica em escala 0,3 na forma de morcego)."""
    m = Model("geometry.lila.vbat", 128, 128, density=2, bounds=(3, 2, (0, 1, 0)))
    fur = Paint(mat="fur", color=(40, 22, 26), color2=(90, 50, 56), seed=951)
    wingp = MB((50, 16, 22), (140, 40, 60), 952)
    root = m.bone("bat", None, pivot=(0, 20, 0))
    root.box((0, 20, 0), (8, 10, 12), fur)
    hd = m.bone("bat_head", "bat", pivot=(0, 24, -6))
    hd.box((0, 25, -9), (7, 6, 6), fur)
    for s in (-1, 1):
        hd.box((s * 2.4, 29.5, -8.5), (1.6, 3.5, 1), fur)
        hd.box((s * 1.6, 25.8, -12.05), (1, 0.8, 0.2), G((255, 40, 60), (255, 200, 200), 953))
    for side, suf in ((-1, "_r"), (1, "_l")):
        w = m.bone("bwing" + suf, "bat", pivot=(side * 4, 22, 0))
        w.box((side * 11, 21, 0), (14, 0.6, 12), wingp)
        t = m.bone("bwing" + suf + "_tip", "bwing" + suf, pivot=(side * 18, 22, 0))
        t.box((side * 25, 21.5, 1), (14, 0.5, 9), wingp)
    return m


def preview_parts():
    return {"roulette": roulette_model(), "divine_sword": divine_sword(), "void_scythe": void_scythe(), "wings_angel": wings("angel"),
            "wings_demon": wings("demon"), "wings_god": wings("god"), "wings_dark": wings("dark"), "halo_angel": crown("angel"),
            "halo_demon": crown("demon"), "crown_god": crown("god"), "crown_dark": crown("dark"), "vampire": vampire_overlay(),
            "giant": giant_overlay(), "vbat": bat_model(), "roulette_held": roulette_held()}
