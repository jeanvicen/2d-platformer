"""Relics and power items as real 3D geometry.

Every shape is authored once in a local frame (grip at the origin, the item
points forward along -Z, +Y is up) and instanced three ways:
  * held attachable geometry (bound to the hand bone),
  * thrown-entity geometry (hammer/axe/spear spin in flight),
  * icon/preview renders.
"""
from __future__ import annotations

from ..geom import Model
from ..palette import *  # noqa: F401,F403
from .creatures import P

HAND_PIVOT = (-6.0, 15.0, 1.0)     # vanilla rightItem pivot
GRIP = (-6.0, 12.5, -0.5)          # fist position in player model space


class Frame:
    """Adds boxes to a bone relative to an origin (local item frame)."""

    def __init__(self, bone, origin):
        self.b = bone
        self.o = origin

    def box(self, center, size, paint, rotation=None, pivot=None):
        cx, cy, cz = center
        ox, oy, oz = self.o
        piv = None
        if pivot is not None:
            piv = (pivot[0] + ox, pivot[1] + oy, pivot[2] + oz)
        elif rotation is not None:
            piv = (cx + ox, cy + oy, cz + oz)
        return self.b.box((cx + ox, cy + oy, cz + oz), size, paint, rotation=rotation, pivot=piv)


# ------------------------------------------------------------------ materials
def M():
    return {
        "steel": P("metal", (58, 60, 76), (150, 154, 175), rivets=False),
        "steel_r": P("metal", (58, 60, 76), (150, 154, 175), rivets=True),
        "dark": P("metal", (30, 28, 40), (96, 90, 120)),
        "silver": P("metal", (130, 134, 152), (225, 228, 240)),
        "gold": P("metal", (150, 112, 40), (255, 226, 140)),
        "grip": P("leather", (40, 26, 38)),
        "wood": P("wood", (48, 32, 40), axis="z"),
        "crystal": P("crystal", VIOLET_DEEP, VIOLET_HI),
        "glow": P("glow", VIOLET, VIOLET_HI),
        "gold_glow": P("glow", (230, 180, 70), (255, 245, 200)),
        "cyan": P("crystal", (60, 120, 220), (220, 245, 255)),
        "white": P("glow", (220, 225, 255), (255, 255, 255)),
    }


# ------------------------------------------------------------------ shapes
def shape_hammer(f):
    m = M()
    f.box((0, 0, -3.5), (1.5, 1.5, 15), m["grip"])
    f.box((0, 0, 4.4), (2.4, 2.4, 1.6), m["steel_r"])
    f.box((0, 0, 3.0), (1.9, 1.9, 1.0), m["crystal"])
    for z in (-1.0, -6.0):
        f.box((0, 0, z), (1.8, 1.8, 0.7), m["silver"])
    head = P("metal", (40, 40, 54), (160, 160, 185), rivets=True,
             decals=[("north", "runes", {"cell": 1.2, "seed": 3, "margin": 0.6}), ("south", "runes", {"cell": 1.2, "seed": 4, "margin": 0.6})])
    f.box((0, 0, -13.2), (9, 5.4, 5.4), head)
    for sx in (-1, 1):
        f.box((sx * 4.9, 0, -13.2), (1.0, 6.2, 6.2), m["steel"])
        f.box((sx * 5.6, 0, -13.2), (0.5, 3.2, 3.2), m["glow"])
    f.box((0, 2.9, -13.2), (6, 0.5, 4), m["silver"])
    f.box((0, -2.9, -13.2), (6, 0.5, 4), m["silver"])
    f.box((0, 0, -10.3), (2.2, 2.2, 0.5), m["crystal"])


def shape_axe(f):
    m = M()
    f.box((0, 0, -3.5), (1.4, 1.4, 16), m["wood"])
    f.box((0, 0, 4.6), (2.0, 2.0, 1.4), m["steel_r"])
    for z in (0.5, 2.0):
        f.box((0, 0, z), (1.7, 1.7, 0.7), m["grip"])
    f.box((0, 0, -11.2), (2.0, 2.6, 4.0), m["dark"])
    blade = P("metal", (46, 44, 60), (180, 178, 205), decals=[("east", "runes", {"cell": 1.0, "seed": 7, "margin": 0.6})])
    f.box((0, 3.2, -11.6), (0.9, 4.2, 5.4), blade)
    f.box((0, 5.6, -12.6), (0.8, 3.0, 5.4), blade)
    f.box((0, 7.0, -14.0), (0.7, 2.2, 3.6), blade)
    f.box((0, 4.8, -15.2), (0.5, 7.2, 0.8), m["glow"])
    f.box((0, 1.6, -14.6), (0.6, 2.2, 1.6), blade)
    f.box((0, -2.4, -11.0), (0.9, 2.6, 2.2), m["dark"])
    f.box((0, -3.9, -11.4), (0.6, 1.4, 1.2), m["crystal"])
    f.box((0, 0, -14.0), (1.6, 1.6, 1.6), m["crystal"])


def shape_sword(f):
    m = M()
    f.box((0, 0, 0), (1.4, 1.4, 5), m["grip"])
    f.box((0, 0, 3.0), (2.0, 2.0, 1.2), m["crystal"])
    f.box((0, 0, -3.0), (1.6, 7.5, 1.4), m["dark"])
    f.box((0, 3.6, -3.0), (1.0, 1.0, 1.0), m["glow"])
    f.box((0, -3.6, -3.0), (1.0, 1.0, 1.0), m["glow"])
    blade = P("metal", (32, 30, 44), (150, 140, 190))
    f.box((0, 0, -11.5), (0.8, 2.6, 15.5), blade)
    f.box((0, 0, -11.0), (0.9, 0.5, 14.0), m["glow"])
    f.box((0, 0, -20.2), (0.7, 1.8, 2.2), blade)
    f.box((0, 0, -21.8), (0.6, 0.9, 1.4), blade)


def shape_spear(f):
    m = M()
    f.box((0, 0, -5.0), (1.2, 1.2, 28), P("wood", (40, 34, 60), axis="z"))
    for z in (2.0, -3.0, -12.0):
        f.box((0, 0, z), (1.6, 1.6, 0.7), m["silver"])
    f.box((0, 0, 9.4), (1.8, 1.8, 1.4), m["cyan"])
    f.box((0, 0, -19.6), (2.2, 2.2, 1.4), m["silver"])
    f.box((0, 0, -23.0), (0.8, 3.0, 5.6), m["cyan"])
    f.box((0, 0, -26.4), (0.6, 1.8, 2.2), m["cyan"])
    f.box((0, 0, -28.0), (0.5, 0.8, 1.2), m["white"])
    for sy in (-1, 1):
        f.box((0, sy * 2.2, -20.6), (0.6, 1.6, 1.8), m["silver"], rotation=(sy * 30, 0, 0))


def shape_scythe(f):
    m = M()
    f.box((0, 0, -3.0), (1.3, 1.3, 26), P("wood", (30, 26, 40), axis="z"))
    f.box((0, 0, 10.4), (1.8, 1.8, 1.2), m["crystal"])
    f.box((0, 0, -16.6), (2.0, 2.0, 2.4), m["dark"])
    blade = P("metal", (34, 30, 48), (170, 160, 210))
    f.box((-3.0, 0.3, -16.8), (5.0, 0.7, 2.2), blade)
    f.box((-7.0, 0.3, -15.6), (4.0, 0.7, 2.0), blade)
    f.box((-10.4, 0.3, -13.6), (3.6, 0.6, 1.6), blade)
    f.box((-12.6, 0.3, -11.2), (2.0, 0.5, 2.0), blade)
    f.box((-6.0, 0.3, -18.1), (9.0, 0.75, 0.5), m["glow"])
    f.box((-11.6, 0.3, -12.6), (0.6, 0.6, 3.4), m["glow"])


def shape_bow(f):
    m = M()
    limb = P("metal", (150, 120, 60), (255, 236, 170))
    f.box((0, 0, 0), (1.4, 3.2, 1.4), m["grip"])
    for sy in (-1, 1):
        f.box((0, sy * 3.6, -0.4), (1.2, 3.0, 1.2), limb)
        f.box((0, sy * 6.4, -1.0), (1.0, 3.0, 1.0), limb)
        f.box((0, sy * 9.0, -1.9), (0.9, 2.6, 0.9), limb)
        f.box((0, sy * 10.8, -2.8), (0.8, 1.4, 0.8), m["gold_glow"])
        f.box((0, sy * 7.5, -1.8), (0.4, 2.0, 1.2), m["white"])
    f.box((0, 0, 1.6), (0.25, 21.0, 0.25), m["white"])
    f.box((0, 0, -1.0), (1.0, 1.0, 1.0), m["cyan"])


def shape_shield(f):
    m = M()
    f.box((0, 0, 0), (1.2, 1.2, 3.0), m["grip"])
    face = P("metal", (46, 46, 62), (150, 154, 175), rivets=True,
             decals=[("west", "gem", {"r": 1.6, "color": (160, 80, 255)}),
                     ("west", "line", {"axis": "t", "w": 0.22}), ("west", "line", {"axis": "s", "w": 0.22})])
    f.box((-1.6, 1.0, -0.4), (1.0, 15.0, 10.0), face)
    f.box((-2.2, 1.0, -0.4), (0.4, 15.8, 0.8), m["silver"])
    f.box((-2.2, 8.6, -0.4), (0.4, 0.8, 10.6), m["silver"])
    f.box((-2.2, -6.6, -0.4), (0.4, 0.8, 10.6), m["silver"])


def shape_gauntlet(f):
    m = M()
    f.box((0, 0.6, 1.0), (4.6, 4.6, 6.0), P("metal", (44, 44, 60), (150, 154, 175), rivets=True))
    f.box((0, 0.6, -2.6), (4.8, 3.6, 1.8), m["steel"])
    for i, x in enumerate((-1.6, -0.5, 0.6, 1.7)):
        f.box((x, 1.4, -3.9), (0.9, 1.2, 1.2), m["silver"])
        f.box((x, 1.6, -4.8), (0.5, 0.6, 0.8), m["crystal"])
    f.box((0, 3.3, 1.0), (3.0, 0.8, 4.0), m["silver"])
    f.box((0, 3.9, 1.0), (1.6, 0.6, 1.6), m["glow"])
    f.box((2.6, 0.8, 1.6), (0.8, 3.0, 3.0), m["steel"])


def shape_chains(f):
    m = M()
    link = P("metal", (40, 38, 54), (150, 140, 190))
    f.box((0, 0, 0), (1.6, 1.6, 2.0), m["grip"])
    z = -1.6
    for i in range(7):
        if i % 2 == 0:
            f.box((0, 0, z), (0.5, 1.6, 2.2), link)
        else:
            f.box((0, 0, z), (1.6, 0.5, 2.2), link)
        z -= 1.8
    f.box((0, 0, z - 0.6), (1.2, 1.2, 1.2), m["glow"])
    f.box((0, -1.6, z - 1.8), (0.6, 3.6, 0.8), m["dark"])
    f.box((0, -3.4, z - 0.8), (0.6, 0.8, 2.6), m["dark"])
    f.box((0, -2.6, z + 0.2), (0.4, 0.6, 0.6), m["crystal"])


def shape_core(f):
    m = M()
    f.box((0, 4.0, 0), (3.6, 3.6, 3.6), P("crystal", (70, 30, 140), (240, 210, 255)), rotation=(45, 45, 0))
    f.box((0, 4.0, 0), (6.4, 0.5, 6.4), m["silver"], rotation=(0, 45, 20))
    f.box((0, 4.0, 0), (0.5, 6.4, 6.4), m["dark"], rotation=(25, 0, 0))
    f.box((0, 4.0, 0), (1.5, 1.5, 1.5), m["white"])


def shape_codex(f):
    m = M()
    cover = P("leather", (40, 22, 60), decals=[("up", "runes", {"cell": 1.0, "seed": 9, "margin": 0.6}), ("up", "gem", {"r": 0.9})])
    f.box((0, 0.5, -2.0), (5.6, 1.6, 7.0), cover)
    f.box((0, 0.5, -2.0), (5.2, 1.2, 6.8), P("matte", (220, 214, 200)))
    f.box((-2.9, 0.5, -2.0), (0.5, 1.8, 7.2), m["silver"])
    f.box((0, 1.4, -5.6), (1.0, 0.4, 0.6), m["glow"])


def shape_sigil(f, color=(146, 64, 250), hi=VIOLET_HI, accent=None):
    disc = P("metal", (36, 32, 50), (150, 140, 190), decals=[("north", "runes", {"cell": 0.9, "seed": 13, "margin": 0.5, "color": color}),
                                                             ("south", "runes", {"cell": 0.9, "seed": 14, "margin": 0.5, "color": color})])
    f.box((0, 3.5, -1.0), (5.4, 5.4, 0.8), disc)
    f.box((0, 3.5, -1.0), (2.0, 2.0, 1.2), P("glow", color, hi))
    f.box((0, 0.6, -1.0), (1.0, 2.4, 1.0), P("metal", (60, 60, 76), (170, 170, 190)))
    if accent:
        for sx in (-1, 1):
            f.box((sx * 3.2, 3.5, -1.0), (0.8, 0.8, 1.0), P("glow", accent, (255, 255, 255)))


def shape_essence(f):
    m = M()
    f.box((0, 2.5, 0), (2.6, 4.0, 2.6), P("crystal", (60, 30, 110), (220, 180, 255)))
    f.box((0, 5.0, 0), (1.4, 1.2, 1.4), m["silver"])
    f.box((0, 5.9, 0), (1.8, 0.6, 1.8), m["dark"])
    f.box((0, 2.0, 0), (1.4, 2.0, 1.4), m["white"])


def shape_hand(f):
    m = M()
    claw = P("metal", (26, 22, 36), (110, 90, 160))
    f.box((0, 0.5, 0.5), (3.4, 3.4, 4.0), P("cloth", (30, 20, 50), (100, 70, 170)))
    for i, x in enumerate((-1.2, 0.0, 1.2)):
        f.box((x, 0.8, -2.4), (0.8, 0.9, 2.6), claw)
        f.box((x, 0.6, -4.2), (0.6, 0.6, 1.4), m["glow"])
    f.box((1.9, 0.3, -1.2), (0.7, 0.8, 2.0), claw)
    f.box((0, 2.4, 0.5), (1.2, 0.6, 1.2), m["crystal"])


def shape_prism(f):
    f.box((0, 3.5, 0), (2.4, 5.4, 2.4), P("crystal", (150, 200, 255), (255, 255, 255)), rotation=(0, 45, 0))
    f.box((0, 3.5, 0), (3.6, 0.6, 3.6), P("glow", (255, 160, 80), (255, 230, 160)), rotation=(0, 0, 0))
    f.box((0, 1.5, 0), (3.0, 0.6, 3.0), P("glow", (120, 220, 255), (230, 250, 255)), rotation=(0, 45, 0))
    f.box((0, 5.6, 0), (2.4, 0.6, 2.4), P("glow", (120, 220, 120), (230, 255, 220)), rotation=(0, 20, 0))


def shape_bond(f):
    f.box((0, 2.5, 0), (2.8, 3.2, 0.9), P("metal", (150, 112, 40), (255, 226, 140)))
    f.box((0, 2.5, -0.3), (1.8, 2.2, 0.6), P("glow", (190, 110, 255), (255, 230, 255)))
    f.box((0, 4.8, 0), (0.5, 1.6, 0.5), P("metal", (150, 112, 40), (255, 226, 140)))
    f.box((0, 0.2, 0), (1.0, 1.6, 0.3), P("cloth", (110, 40, 170), (200, 120, 255)))


def shape_recall(f):
    f.box((0, 3.5, 0), (5.0, 5.0, 0.8), P("glow", (110, 50, 230), (230, 200, 255)), rotation=(0, 0, 45))
    f.box((0, 3.5, 0), (3.4, 3.4, 1.2), P("metal", (30, 26, 44), (140, 120, 200)), rotation=(0, 0, 45))
    f.box((0, 3.5, 0), (1.4, 1.4, 1.6), P("glow", (255, 255, 255)))


def shape_tool(f, kind):
    m = M()
    f.box((0, 0, -3.0), (1.1, 1.1, 13), P("matte", (26, 22, 36)))
    edge = P("crystal", (80, 40, 150), (230, 200, 255))
    if kind == "pickaxe":
        f.box((0, 0, -10.2), (9.0, 1.4, 1.6), edge)
        for sx in (-1, 1):
            f.box((sx * 5.2, -0.8, -10.2), (1.4, 1.4, 1.2), edge)
    elif kind == "axe":
        f.box((0, 2.4, -9.8), (0.8, 4.4, 3.6), edge)
    elif kind == "shovel":
        f.box((0, 0, -11.5), (3.6, 0.8, 4.2), edge)
    f.box((0, 0, -9.0), (1.4, 1.4, 1.4), m["glow"])


SHAPES = {
    "eclipse_hammer": shape_hammer, "eclipse_axe": shape_axe, "shadow_sword": shape_sword,
    "astral_spear": shape_spear, "eclipse_scythe": shape_scythe, "celestial_bow": shape_bow,
    "guardian_shield": shape_shield, "titan_gauntlets": shape_gauntlet, "shadow_chains": shape_chains,
    "eclipse_core": shape_core, "codex": shape_codex,
    "legion_sigil": lambda f: shape_sigil(f, (146, 64, 250), VIOLET_HI, (190, 120, 255)),
    "power_sigil": lambda f: shape_sigil(f, (230, 180, 70), (255, 240, 200), (146, 64, 250)),
    "form_essence": shape_essence, "shadow_hand": shape_hand, "element_prism": shape_prism,
    "lyra_bond": shape_bond, "relic_recall": shape_recall,
    "shadow_pickaxe": lambda f: shape_tool(f, "pickaxe"), "shadow_axe_tool": lambda f: shape_tool(f, "axe"),
    "shadow_shovel": lambda f: shape_tool(f, "shovel"),
}

# Orientação na mão, seguindo a convenção do exemplo oficial (Microsoft Learn, "Using Attachables"):
# osso raiz com binding q.item_slot_to_bone_name(context.item_slot) e pivô no ponto de empunhadura;
# itens modelados na vertical (+Y) usam 125° em X (como a chave inglesa do exemplo);
# itens modelados para a frente (-Z) usam 35°, que resulta na mesma direção; luvas apontam ao longo do braço (90°).
UPRIGHT = {"eclipse_core", "codex", "legion_sigil", "power_sigil", "form_essence", "element_prism", "lyra_bond", "relic_recall"}
ALONG_ARM = {"shadow_hand", "titan_gauntlets"}
VERTICAL = {"celestial_bow", "guardian_shield"}


def hold_tilt(key):
    if key in UPRIGHT:
        return 108  # 125° do exemplo oficial + ajuste de -17.5° da animação de 3ª pessoa do mesmo exemplo
    if key in ALONG_ARM:
        return 90
    if key in VERTICAL:
        return 0
    return 18


def held_model(key, density=6):
    m = Model(f"geometry.eclipse.held.{key}", 64, 64, density=density, bounds=(3, 3, (0, 1, 0)))
    m.bone("eclipse_item", pivot=GRIP, binding="q.item_slot_to_bone_name(context.item_slot)")
    relic = m.bone("relic", "eclipse_item", pivot=GRIP, rotation=(hold_tilt(key), 0, 0))
    relic.locators = {"tip": (GRIP[0], GRIP[1], GRIP[2] - 12), "grip": GRIP}
    SHAPES[key](Frame(relic, GRIP))
    return m


def icon_model(key, density=6):
    m = Model(f"geometry.eclipse.icon.{key}", 64, 64, density=density)
    r = m.bone("root", pivot=(0, 0, 0))
    SHAPES[key](Frame(r, (0, 0, 0)))
    return m


def thrown_model(key, density=6):
    m = Model(f"geometry.eclipse.thrown.{key}", 64, 64, density=density, bounds=(3, 3, (0, 0.5, 0)))
    root = m.bone("root", pivot=(0, 4, 0))
    off = {"eclipse_hammer": (0, 4, 6), "eclipse_axe": (0, 4, 5), "astral_spear": (0, 4, 9)}[key]
    SHAPES[key](Frame(root, off))
    return m


RELICS = ["eclipse_hammer", "eclipse_axe", "shadow_sword", "astral_spear", "eclipse_scythe",
          "celestial_bow", "guardian_shield", "titan_gauntlets", "shadow_chains"]
POWER_ITEMS = ["eclipse_core", "codex", "legion_sigil", "power_sigil", "form_essence", "shadow_hand",
               "element_prism", "lyra_bond", "relic_recall"]
TOOLS = ["shadow_pickaxe", "shadow_axe_tool", "shadow_shovel"]
THROWABLE = ["eclipse_hammer", "eclipse_axe", "astral_spear"]
