"""Lila's remote controller: a compact gamepad in obsidian black with an
emerald trim, emerald face buttons, a gold leaf emblem and a short antenna.

The same shape is used for the inventory icon (rendered from the model) and
for the 3D attachable shown in the player's hand.
"""
from __future__ import annotations

from .geom import Model, Paint

GRIP = (-6.0, 12.5, -0.5)  # fist position in player model space

BLACK = Paint(mat="matte", color=(30, 30, 40), seed=3)
SHELL = Paint(mat="metal", color=(44, 46, 58), color2=(92, 98, 120), seed=5)
TRIM = Paint(mat="metal", color=(24, 120, 80), color2=(90, 210, 150), seed=7)
GOLD = Paint(mat="metal", color=(186, 136, 48), color2=(255, 230, 150), seed=9)
STICK = Paint(mat="matte", color=(16, 16, 22), seed=11)
GEM = Paint(mat="crystal", color=(30, 170, 110), color2=(190, 255, 220), seed=13)
LEAF = Paint(mat="glow", color=(40, 190, 120), color2=(200, 255, 220), seed=15)


def shape(b, ox=0.0, oy=0.0, oz=0.0):
    def c(o, s, p, **kw):
        return b.cube((o[0] + ox, o[1] + oy, o[2] + oz), s, p, **kw)

    # body and grips
    c((-4.6, -1.8, -1.0), (9.2, 3.8, 2.0), Paint(mat="matte", color=(30, 30, 40), seed=3,
                                                 decals=[("north", "line", {"axis": "s", "pos": 0.35, "w": 0.18, "color": (40, 180, 120)})]))
    c((-6.4, -4.4, -1.15), (3.2, 5.4, 2.3), BLACK, rotation=(0, 0, -10), pivot=(-4.8 + ox, 0 + oy, 0 + oz))
    c((3.2, -4.4, -1.15), (3.2, 5.4, 2.3), BLACK, rotation=(0, 0, 10), pivot=(4.8 + ox, 0 + oy, 0 + oz))
    c((-4.2, 2.0, -0.8), (8.4, 0.7, 1.6), SHELL)
    c((-5.6, 1.6, -0.9), (2.0, 0.8, 1.8), TRIM)       # shoulder buttons
    c((3.6, 1.6, -0.9), (2.0, 0.8, 1.8), TRIM)
    # d-pad
    c((-4.9, -0.35, -1.35), (2.2, 0.7, 0.4), SHELL)
    c((-4.15, -1.1, -1.35), (0.7, 2.2, 0.4), SHELL)
    # face buttons (diamond)
    for (bx, by) in ((3.6, 0.75), (3.6, -0.95), (2.75, -0.1), (4.45, -0.1)):
        c((bx - 0.4, by - 0.4, -1.4), (0.8, 0.8, 0.45), GEM)
    # analog sticks
    c((-2.4, -1.75, -1.45), (1.2, 1.2, 0.5), STICK)
    c((1.2, -1.75, -1.45), (1.2, 1.2, 0.5), STICK)
    # emblem: gold frame + glowing leaf
    c((-0.75, 0.05, -1.25), (1.5, 1.5, 0.3), GOLD)
    c((-0.45, 0.35, -1.4), (0.9, 0.9, 0.2), LEAF)
    # antenna
    c((4.0, 2.6, -0.2), (0.4, 2.6, 0.4), SHELL)
    c((3.8, 5.1, -0.4), (0.8, 0.8, 0.8), GEM)


def icon_model():
    m = Model("geometry.lila.controller_icon", 64, 64, density=6)
    root = m.bone("root", pivot=(0, 0, 0))
    shape(root)
    return m


def held_model():
    m = Model("geometry.lila.controller_held", 64, 64, density=6, bounds=(3, 3, (0, 1, 0)))
    m.bone("lila_item", pivot=GRIP, binding="q.item_slot_to_bone_name(context.item_slot)")
    pad = m.bone("pad", "lila_item", pivot=GRIP, rotation=(108, 0, 0))
    pad.locators = {"tip": (GRIP[0] + 4.2, GRIP[1] + 5.5, GRIP[2])}
    # the right grip sits in the fist; the pad is scaled to 75 % of the icon
    sub = m.bone("pad_scaled", "pad", pivot=GRIP)
    sub_shape = Model("tmp", 64, 64)
    tmp = sub_shape.bone("t")
    shape(tmp)
    k = 0.72
    gx, gy, gz = GRIP
    for c in tmp.cubes:
        o = c.origin
        s = c.size
        org = (gx + (o[0] - 4.8) * k + 1.0, gy + (o[1] + 1.5) * k, gz + o[2] * k)
        piv = None
        if c.pivot:
            piv = (gx + (c.pivot[0] - 4.8) * k + 1.0, gy + (c.pivot[1] + 1.5) * k, gz + c.pivot[2] * k)
        sub.cube(org, tuple(v * k for v in s), c.paint, rotation=c.rotation, pivot=piv)
    return m
