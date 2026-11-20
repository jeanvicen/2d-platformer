"""Lila — original character model and hand-designed pixel-art texture.

Broad cues only (emerald hair, pale skin, black long-sleeved outfit); the face,
hair shape, dress and accessories are an original design for this add-on.

Geometry uses player proportions (slim arms) and the vanilla humanoid bone
names (head, body, rightArm, leftArm, rightLeg, leftLeg, rightItem, leftItem)
so held items and vanilla armour attach to her like they do to players.
Texture density: 2 px per model unit (twice a vanilla skin), drawn as clean
pixel art with fixed palette ramps — no noisy gradients, no fake "4K".
"""
from __future__ import annotations

import numpy as np
from PIL import Image

from .geom import FACES, Model, Paint

D = 2  # pixels per unit

# ---------------------------------------------------------------- palettes
HAIR = [(6, 40, 30), (10, 62, 44), (16, 90, 62), (26, 120, 82), (44, 152, 104), (92, 196, 142), (160, 232, 190)]
SKIN = [(188, 140, 128), (218, 176, 160), (240, 206, 190), (252, 228, 214)]
DRESS = [(8, 8, 12), (16, 16, 22), (26, 26, 36), (40, 40, 54), (60, 62, 80)]
TIGHTS = [(14, 13, 18), (24, 22, 30), (36, 34, 44)]
TRIM = [(18, 96, 62), (32, 138, 88), (72, 188, 124)]
GOLD = [(122, 82, 26), (186, 136, 48), (238, 194, 96), (255, 236, 168)]
BOOT = [(22, 16, 16), (36, 26, 24), (54, 40, 36), (82, 62, 54)]
EYE = {"w": (238, 244, 240), "a": (150, 236, 200), "b": (36, 164, 118), "c": (14, 90, 64), "p": (8, 34, 26),
       "L": (22, 16, 24), "B": (16, 70, 46), "x": (255, 255, 255)}
BLUSH = (238, 162, 160)
MOUTH = (176, 92, 96)
CLEAR = (0, 0, 0, 0)

# ---------------------------------------------------------------- face (16x16, viewed from the front)
FACE = [
    "hhhhhhhhhhhhhhhh",
    "hHHhHHHhhHHHhHHh",
    "SSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSS",
    "SSSBBBSSSSBBBSSS",
    "SSSSSSSSSSSSSSSS",
    "SSLLLLLSSLLLLLSS",
    "SLxabpwSSxabpwLS",
    "SSabbcwSSabbcwSS",
    "SSkccckSSkccckSS",
    "SrrSSSSSnSSSSrrS",
    "SSSSSSSSSSSSSSSS",
    "SSSSSSSmmSSSSSSS",
    "kSSSSSSSSSSSSSSk",
    "kkSSSSSSSSSSSSkk",
]
# hair layer over the face: bangs with a jagged edge and two face-framing locks (".": transparent)
BANGS = [
    "HHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHH",
    "HHH.HHHHHHHH.HHH",
    "HH...HHH.HH...HH",
    "HH....H....H..HH",
    "HH............HH",
    "HH............HH",
    "HH............HH",
    "H..............H",
    "H..............H",
    "H..............H",
    "................",
    "................",
    "................",
]


def ramp(pal, v):
    v = float(np.clip(v, 0, 0.999))
    return pal[int(v * len(pal))]


def hash01(*a):
    h = 2166136261
    for x in a:
        h = (h ^ (int(x) & 0xFFFFFFFF)) * 16777619 & 0xFFFFFFFF
    h ^= h >> 13
    return (h & 0xFFFF) / 65535.0


# ---------------------------------------------------------------- painters per material
def paint_hair(w, h, face, seed, under=False, jagged=False):
    """Anime-style strands: 2 px strands with a lit core, dark parting lines,
    a soft top-to-bottom falloff and a glossy "halo" band. No random speckle."""
    img = np.zeros((h, w, 4), dtype=np.uint8)
    band = max(1, int(h * 0.22))
    for x in range(w):
        sid = (x + seed) // 2
        inner = (x + seed) % 2
        sshade = (hash01(seed, sid) - 0.5) * 0.16
        cut = h if not jagged else h - int(hash01(seed, sid, 5) * 3) - (1 if inner else 0)
        for y in range(h):
            t = y / max(1, h - 1)
            if face == "up":
                v = 0.62 + sshade - (0.10 if inner else 0)
            elif face == "down" or under:
                v = 0.16 + sshade * 0.5
            else:
                v = 0.60 - 0.30 * t + sshade - (0.09 if inner else 0)
                if abs(y - band) <= 0 and sid % 2 == 0:
                    v += 0.26
                elif abs(y - band) <= 1 and sid % 3 == 0:
                    v += 0.14
            if y >= cut:
                img[y, x] = CLEAR
                continue
            if jagged and y == cut - 1:
                v += 0.10
            img[y, x, :3] = ramp(HAIR, v)
            img[y, x, 3] = 255
    return img


def paint_skin(w, h, face, seed):
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            v = 0.62
            if face == "down":
                v = 0.32
            if x == 0 or x == w - 1:
                v -= 0.18
            img[y, x, :3] = ramp(SKIN, v)
            img[y, x, 3] = 255
    return img


def paint_cloth(w, h, face, seed, pal=DRESS, folds=True):
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            v = 0.45
            if folds and hash01(seed, x) > 0.7:
                v += 0.18 * (1 - abs((y % 7) - 3) / 3)
            if x == 0 or x == w - 1:
                v -= 0.2
            if face == "up":
                v += 0.15
            if face == "down":
                v -= 0.25
            img[y, x, :3] = ramp(pal, v)
            img[y, x, 3] = 255
    return img


def put(img, x, y, c):
    if 0 <= y < img.shape[0] and 0 <= x < img.shape[1]:
        img[y, x, :3] = c[:3]
        img[y, x, 3] = 255 if len(c) == 3 else c[3]


def paint_face():
    img = np.zeros((16, 16, 4), dtype=np.uint8)
    for y, row in enumerate(FACE):
        for x, ch in enumerate(row):
            if ch == "h":
                c = HAIR[1]
            elif ch == "H":
                c = HAIR[3]
            elif ch == "S":
                c = SKIN[2]
            elif ch == "k":
                c = SKIN[1]
            elif ch == "r":
                c = BLUSH
            elif ch == "m":
                c = MOUTH
            elif ch == "n":
                c = SKIN[1]
            else:
                c = EYE[ch]
            put(img, x, y, c)
    return img


def paint_bangs():
    img = np.zeros((16, 16, 4), dtype=np.uint8)
    hair = paint_hair(16, 16, "north", 3)
    for y, row in enumerate(BANGS):
        for x, ch in enumerate(row):
            if ch == "H":
                img[y, x] = hair[y, x]
                # strand tips are lighter, roots darker
                if y >= 4 and (y + 1 >= 16 or BANGS[y + 1][x] == "."):
                    img[y, x, :3] = HAIR[4]
            else:
                img[y, x] = CLEAR
    return img


def paint_dress_front(w, h):
    img = paint_cloth(w, h, "north", 5)
    # high collar with emerald trim + brooch
    for x in range(w):
        put(img, x, 0, TRIM[1])
        put(img, x, 1, DRESS[3] if 3 <= x < w - 3 else DRESS[2])
    for x in range(5, w - 5):
        put(img, x, 2, TRIM[0])
    cx = w // 2
    put(img, cx - 1, 3, GOLD[2]); put(img, cx, 3, GOLD[2])
    put(img, cx - 1, 4, TRIM[2]); put(img, cx, 4, TRIM[1])
    # princess seams
    for y in range(6, h - 4):
        put(img, 4, y, DRESS[3]); put(img, w - 5, y, DRESS[3])
    # belt at the waist (bottom of the torso)
    for x in range(w):
        put(img, x, h - 4, TRIM[0]); put(img, x, h - 3, TRIM[1])
    for dx in (-1, 0):
        put(img, cx + dx, h - 4, GOLD[3]); put(img, cx + dx, h - 3, GOLD[1])
    return img


def paint_sleeve(w, h, face):
    img = paint_cloth(w, h, face, 17)
    if face in ("up",):
        return img
    cuff = int(h * 0.74)
    for x in range(w):
        put(img, x, cuff, TRIM[1]); put(img, x, cuff + 1, TRIM[0])
        for y in range(cuff + 2, h):
            put(img, x, y, SKIN[2] if face != "down" else SKIN[1])
    return img


def paint_leg(w, h, face):
    img = paint_cloth(w, h, face, 23, pal=TIGHTS, folds=False)
    boot_top = int(h * 0.62)
    for y in range(boot_top, h):
        for x in range(w):
            v = 0.55 - (y - boot_top) * 0.02
            if y == boot_top:
                v = 0.85
            if y == h - 1:
                v = 0.1
            put(img, x, y, ramp(BOOT, v))
    if face == "north":
        for y in range(boot_top + 2, h - 2, 2):
            put(img, w // 2 - 1, y, TRIM[2]); put(img, w // 2, y, TRIM[2])
    return img


def paint_skirt(w, h, face, tier):
    img = paint_cloth(w, h, face, 31 + tier)
    if face in ("up", "down"):
        return img
    for x in range(0, w, 3):
        for y in range(h):
            put(img, x, y, DRESS[3])
    if tier == 2:
        for x in range(w):
            put(img, x, h - 1, TRIM[1]); put(img, x, h - 2, TRIM[0])
    return img


def paint_gold(w, h, face):
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            img[y, x, :3] = GOLD[2] if (x + y) % 3 else GOLD[3]
            img[y, x, 3] = 255
    return img


def paint_leaf(w, h, face):
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            img[y, x, :3] = TRIM[2] if x == w // 2 else TRIM[1]
            img[y, x, 3] = 255
    return img


def paint_eyelid(w, h, face):
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        for x in range(w):
            img[y, x, :3] = SKIN[2]
            img[y, x, 3] = 255
    for x in range(w):
        put(img, x, h - 1, EYE["L"])
    return img


# ---------------------------------------------------------------- model
def lila_model():
    m = Model("geometry.lila.lila", 64, 64, density=D, bounds=(2, 2.6, (0, 1.2, 0)))
    P = lambda key, **kw: Paint(mat="lila", params={"part": key, **kw})
    root = m.bone("root")
    root.locators = {"ground": (0, 0.1, 0), "hand": (-5.5, 11, -2), "head_top": (0, 34, 0)}
    waist = m.bone("waist", "root", pivot=(0, 12, 0))
    body = m.bone("body", "waist", pivot=(0, 24, 0))
    body.cube((-4, 12, -2), (8, 12, 4), P("dress_body"))
    skirt = m.bone("skirt", "body", pivot=(0, 12, 0))
    skirt.cube((-4.5, 8.5, -2.5), (9, 3.5, 5), P("skirt1"))
    skirt.cube((-5, 5.5, -3), (10, 3, 6), P("skirt2"))
    head = m.bone("head", "body", pivot=(0, 24, 0))
    head.locators = {"mouth": (0, 25.5, -4.5)}
    head.cube((-4, 24, -4), (8, 8, 8), P("head"))
    hat = m.bone("hat", "head", pivot=(0, 24, 0))
    hat.cube((-4, 24, -4), (8, 8, 8), P("hair_shell"), inflate=0.5)
    hat.cube((-4.2, 32.0, -4.0), (8.4, 1.3, 8.6), P("hair_crown"))
    hat.cube((-3.0, 33.0, -2.6), (6.0, 0.8, 6.2), P("hair_crown2"))
    for sx in (-1, 1):
        # face-framing locks that fall to the collar
        hat.cube((min(sx * 4.3, sx * 5.5), 21.5, -4.4), (1.2, 7.0, 2.6), P("hair_lock"))
        # wavy side volume
        hat.cube((min(sx * 4.4, sx * 5.6), 25.0, -1.6), (1.2, 6.5, 5.6), P("hair_side"))
    # leaf hairpin (her signature accessory)
    pin = m.bone("hairpin", "hat", pivot=(3.3, 30.2, -4.6), rotation=(0, 0, -30))
    pin.cube((2.6, 29.8, -5.1), (1.6, 0.9, 0.5), P("leaf"))
    pin.cube((3.6, 30.3, -5.1), (1.0, 0.9, 0.5), P("leaf"))
    pin.cube((2.2, 29.9, -5.0), (0.6, 0.6, 0.4), P("gold"))
    hair_back = m.bone("hair_back", "head", pivot=(0, 30, 4))
    hair_back.cube((-4.6, 17.0, 3.4), (9.2, 14.0, 1.6), P("hair_back"))
    hair_back.cube((-4.1, 14.5, 3.6), (8.2, 3.0, 1.4), P("hair_tips"))
    hair_back.cube((-2.8, 13.0, 3.8), (5.6, 2.0, 1.2), P("hair_tips2"))
    lids = m.bone("eyelids", "head", pivot=(0, 28.6, -4.0))
    for x0 in (-2.5, 0.5):
        # escondida dentro da cabeça; a animação de piscar traz para frente por instantes
        lids.cube((x0, 26.5, -3.9), (2.0, 2.0, 0.05), P("eyelid"))
    for side, sx in (("right", -1), ("left", 1)):
        arm = m.bone(f"{side}Arm", "body", pivot=(sx * 5, 22, 0))
        arm.cube((4 if sx > 0 else -7, 12, -2), (3, 12, 4), P("sleeve"))
        leg = m.bone(f"{side}Leg", "waist", pivot=(sx * 1.9, 12, 0))
        leg.cube((-0.1 if sx > 0 else -3.9, 0, -2), (4, 12, 4), P("leg"))
    # tamanhos múltiplos de 0,5 = pixels inteiros na textura 2× (sem sangrar cor de outra peça)
    for c in m.cubes():
        if c.paint.params.get("part") == "eyelid":
            continue
        c.size = tuple(max(0.5, round(v * 2) / 2) for v in c.size)
    m.bone("rightItem", "rightArm", pivot=(-6, 15, 1))
    m.bone("leftItem", "leftArm", pivot=(6, 15, 1))
    return m


def paint_part(part, face, w, h):
    if part == "head":
        if face == "north":
            return paint_face()
        if face in ("up", "south", "east", "west"):
            return paint_hair(w, h, face, 1)
        return paint_skin(w, h, face, 1)
    if part == "hair_shell":
        if face == "north":
            return paint_bangs()
        if face == "down":
            return np.zeros((h, w, 4), dtype=np.uint8)
        return paint_hair(w, h, face, 2)
    if part.startswith("hair"):
        seed = sum(map(ord, part)) % 7
        jag = part in ("hair_tips", "hair_tips2", "hair_lock") and face in ("north", "south", "east", "west")
        return paint_hair(w, h, face, seed, under=(face == "down"), jagged=jag)
    if part == "dress_body":
        if face == "north":
            return paint_dress_front(w, h)
        img = paint_cloth(w, h, face, 9)
        if face in ("east", "west", "south"):
            for x in range(w):
                put(img, x, h - 4, TRIM[0]); put(img, x, h - 3, TRIM[1])
        return img
    if part == "sleeve":
        return paint_sleeve(w, h, face)
    if part == "leg":
        return paint_leg(w, h, face)
    if part == "skirt1":
        return paint_skirt(w, h, face, 1)
    if part == "skirt2":
        return paint_skirt(w, h, face, 2)
    if part == "gold":
        return paint_gold(w, h, face)
    if part == "leaf":
        return paint_leaf(w, h, face)
    if part == "eyelid":
        return paint_eyelid(w, h, face)
    return paint_cloth(w, h, face, 3)


def bake_lila(model):
    """Pixel-exact bake: every face gets a w×h image (w,h = face size × density)."""
    if any(not c.uv for c in model.cubes()):
        model.pack()
    W, H = model.tex_w * D, model.tex_h * D
    img = np.zeros((H, W, 4), dtype=np.uint8)
    for c in model.cubes():
        part = c.paint.params["part"]
        for f in FACES:
            u, v, _, _ = c.uv[f]
            fw, fh = c.face_dims(f)
            pw, ph = max(1, int(round(fw * D))), max(1, int(round(fh * D)))
            tile = paint_part(part, f, pw, ph)
            if tile.shape[:2] != (ph, pw):
                tile = np.array(Image.fromarray(tile).resize((pw, ph), Image.NEAREST))
            img[v * D: v * D + ph, u * D: u * D + pw] = tile
    return Image.fromarray(img, "RGBA")
