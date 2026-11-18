#!/usr/bin/env python3
"""
SHADOWBOUND art generator.

Builds, from one source of truth, for each companion persona:
  * resource_pack/models/entity/shadowbound_<persona>.geo.json  (Bedrock geometry, per-face UV)
  * resource_pack/textures/entity/shadowbound/<persona>.png     (4x density texture)
plus the item icon, particle sprite, pack icons and README preview images.

Geometry and texture are generated together, so UVs can never drift from the art.
Run:  python3 tools/art/generate_art.py
"""
from __future__ import annotations

import json
import math
import os
import random
from dataclasses import dataclass, field
from typing import Callable, Optional

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RP = os.path.join(ROOT, "resource_pack")
BP = os.path.join(ROOT, "behavior_pack")
DOCS = os.path.join(ROOT, "documentation", "img")

TEX_W = 128          # UV units declared in the geometry
TEX_H = 128
SCALE = 4            # PNG pixels per UV unit -> 512x512 PNG

Color = tuple  # (r, g, b, a)


def hexc(h: str, a: int = 255) -> Color:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def mix(c1: Color, c2: Color, t: float) -> Color:
    return tuple(int(round(c1[i] * (1 - t) + c2[i] * t)) for i in range(4))


def shade(c: Color, f: float) -> Color:
    """f < 1 darkens, f > 1 lightens (towards white)."""
    if f <= 1:
        return (int(c[0] * f), int(c[1] * f), int(c[2] * f), c[3])
    t = min(1.0, f - 1)
    return mix(c, (255, 255, 255, c[3]), t)


# --------------------------------------------------------------------------------------
# Painter: a face is painted into a PIL image region of w x h pixels.
# --------------------------------------------------------------------------------------
Painter = Callable[[Image.Image, str], None]  # (region image RGBA, face name)


def flat(c: Color, top_light: float = 1.08, bottom_dark: float = 0.82, outline: Optional[Color] = None) -> Painter:
    """Cel-shaded flat fabric: light rim on top, darker band at the bottom."""
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face == "up":
            d.rectangle([0, 0, w, h], fill=shade(c, top_light))
            return
        if face == "down":
            d.rectangle([0, 0, w, h], fill=shade(c, bottom_dark - 0.08))
            return
        d.rectangle([0, 0, w, h], fill=c)
        # soft vertical folds (fabric volume)
        rnd = random.Random(w * 131 + h * 17 + len(face))
        x = rnd.randint(1, 4)
        while x < w - 1:
            fw_ = rnd.randint(2, 4)
            k = rnd.choice((0.9, 0.94, 1.06))
            for i in range(fw_):
                t = 1 - abs(i - fw_ / 2) / (fw_ / 2 + 0.5)
                d.line([x + i, int(h * 0.15), x + i, h], fill=shade(c, 1 + (k - 1) * t))
            x += fw_ + rnd.randint(3, 7)
        band = max(1, h // 6)
        for i in range(band):
            d.line([0, h - band + i, w, h - band + i], fill=mix(c, shade(c, bottom_dark), (i + 1) / band))
        d.rectangle([0, 0, w, max(0, band // 2)], fill=shade(c, top_light))
        if outline is not None:
            d.rectangle([0, 0, w - 1, h - 1], outline=outline)
    return p


def noise_fabric(c: Color, amount: int = 6, seed: int = 1) -> Painter:
    base = flat(c)

    def p(img: Image.Image, face: str) -> None:
        base(img, face)
        rnd = random.Random(seed + hash(face) % 997)
        px = img.load()
        w, h = img.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                n = rnd.randint(-amount, amount)
                px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)), a)
    return p


def hair(c: Color, ring: bool = True, seed: int = 3, vertical: bool = True) -> Painter:
    """Anime hair: base, darker strand lines, soft highlight 'angel ring'."""
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=c)
        rnd = random.Random(seed + len(face))
        dark = shade(c, 0.72)
        darker = shade(c, 0.58)
        if face in ("up", "down"):
            for i in range(0, w, 3):
                d.line([i, 0, i + rnd.randint(-2, 2), h], fill=shade(c, 0.85))
            return
        # strands
        step = 3
        for x in range(0, w, step):
            col = dark if (x // step) % 2 == 0 else shade(c, 0.86)
            x2 = x + rnd.randint(-1, 1)
            d.line([x, 0, x2, h], fill=col)
        # deeper shadow at the top (under hat / scalp) and at the tips
        d.rectangle([0, 0, w, max(1, h // 14)], fill=darker)
        if ring and h > 12:
            y0 = int(h * 0.22)
            for x in range(w):
                yy = y0 + int(2 * math.sin(x / max(1, w) * math.pi * 2))
                d.line([x, yy, x, yy + 2], fill=shade(c, 1.35))
        # tips get a gradient
        for y in range(int(h * 0.8), h):
            t = (y - h * 0.8) / max(1, h * 0.2)
            d.line([0, y, w, y], fill=mix(c, dark, t * 0.6))
        # glossy streaks: a few lighter strands catching the light
        for _ in range(max(2, w // 7)):
            x = rnd.randrange(w)
            y0 = rnd.randint(int(h * 0.15), int(h * 0.4))
            d.line([x, y0, x + rnd.randint(-1, 1), y0 + rnd.randint(h // 5, h // 2)], fill=shade(c, 1.18))
    p.hires = True  # type: ignore[attr-defined]
    p.light = True  # type: ignore[attr-defined]
    return p


def jagged_bangs(c: Color, seed: int, sweep: float = 0.0) -> Painter:
    """Front bangs: strands with a jagged, transparent bottom edge (alpha-tested)."""
    base = hair(c, ring=False, seed=seed)

    def p(img: Image.Image, face: str) -> None:
        base(img, face)
        if face not in ("north",):
            return
        w, h = img.size
        px = img.load()
        rnd = random.Random(seed)
        # spiky bottom: strands of different lengths
        x = 0
        while x < w:
            sw = rnd.randint(5, 8)
            length = rnd.randint(int(h * 0.55), h)
            tip = x + sw // 2 + int(sweep * sw)
            for xx in range(x, min(w, x + sw)):
                # triangle-ish strand end
                frac = 1 - abs(xx - tip) / max(1, sw / 2 + 1)
                cut = int(length - (1 - frac) * h * 0.35)
                for yy in range(max(0, cut), h):
                    px[xx, yy] = (0, 0, 0, 0)
            x += sw
        # dark inner line along the strand tips for depth (skipped for the hi-res pass handled below)
        for xx in range(w):
            for yy in range(h - 1, -1, -1):
                if px[xx, yy][3] != 0:
                    r, g, b, a = shade(c, 0.6)
                    px[xx, yy] = (r, g, b, a)
                    if yy - 1 >= 0 and px[xx, yy - 1][3] != 0:
                        px[xx, yy - 1] = shade(c, 0.78)
                    break
    p.hires = True  # type: ignore[attr-defined]
    p.light = True  # type: ignore[attr-defined]
    return p


def skin(c: Color) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=c)
        if face not in ("up", "down"):
            d.rectangle([0, 0, w, max(1, h // 10)], fill=shade(c, 0.92))
    return p


def transparent() -> Painter:
    def p(img: Image.Image, face: str) -> None:
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, img.size[0], img.size[1]], fill=(0, 0, 0, 0))
    return p


def compose(*ps: Painter) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        for q in ps:
            q(img, face)
    return p


def only(faces: tuple, painter: Painter, other: Optional[Painter] = None) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        if face in faces:
            painter(img, face)
        elif other is not None:
            other(img, face)
    if getattr(painter, "hires", False):
        p.hires_faces = faces  # type: ignore[attr-defined]
    return p


# Shared painting helper
def _radial(d: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, inner: Color, outer: Color, steps: int = 14) -> None:
    for i in range(steps, 0, -1):
        t = i / steps
        d.ellipse([cx - rx * t, cy - ry * t, cx + rx * t, cy + ry * t], fill=mix(inner, outer, t))

# --------------------------------------------------------------------------------------
# Clothing details
# --------------------------------------------------------------------------------------
def stripes(c1: Color, c2: Color, period: int = 6) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        for y in range(0, h):
            d.line([0, y, w, y], fill=c1 if (y // (period // 2)) % 2 == 0 else c2)
    return p


def boots(c: Color, sole: Color, laces: Optional[Color] = None) -> Painter:
    base = flat(c, 1.15, 0.75)

    def p(img: Image.Image, face: str) -> None:
        base(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face == "down":
            d.rectangle([0, 0, w, h], fill=sole)
            return
        if face == "up":
            return
        d.rectangle([0, h - 3, w, h], fill=sole)
        d.rectangle([0, 0, w, 2], fill=shade(c, 1.25))  # cuff
        if laces is not None and face == "north":
            for y in range(4, h - 4, 4):
                d.line([w // 2 - 3, y, w // 2 + 3, y + 2], fill=laces)
                d.line([w // 2 + 3, y, w // 2 - 3, y + 2], fill=laces)
    return p


def star(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, col: Color) -> None:
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
    d.polygon(pts, fill=col)


def moon(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, col: Color, bg: Color) -> None:
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    d.ellipse([cx - r + r * 0.55, cy - r - r * 0.15, cx + r + r * 0.55, cy + r - r * 0.15], fill=bg)


# --------------------------------------------------------------------------------------
# Geometry model
# --------------------------------------------------------------------------------------
FACES = ("north", "south", "east", "west", "up", "down")


@dataclass
class Cube:
    origin: tuple
    size: tuple
    paint: Painter
    faces: tuple = FACES
    inflate: float = 0.0
    rotation: Optional[tuple] = None
    pivot: Optional[tuple] = None
    uv: dict = field(default_factory=dict)


@dataclass
class Bone:
    name: str
    pivot: tuple
    parent: Optional[str] = None
    rotation: Optional[tuple] = None
    cubes: list = field(default_factory=list)


def face_dims(c: Cube, face: str) -> tuple:
    sx, sy, sz = c.size
    if face in ("north", "south"):
        return sx, sy
    if face in ("east", "west"):
        return sz, sy
    return sx, sz


class Atlas:
    """Simple shelf packer in pixel space with 1px gutters."""

    def __init__(self, w_px: int, h_px: int):
        self.w, self.h = w_px, h_px
        self.x = 0
        self.y = 0
        self.row_h = 0
        self.img = Image.new("RGBA", (w_px, h_px), (0, 0, 0, 0))

    def alloc(self, w: int, h: int) -> tuple:
        gw, gh = w + 2, h + 2
        if self.x + gw > self.w:
            self.x = 0
            self.y += self.row_h
            self.row_h = 0
        if self.y + gh > self.h:
            raise RuntimeError("texture atlas overflow")
        pos = (self.x + 1, self.y + 1)
        self.x += gw
        self.row_h = max(self.row_h, gh)
        return pos


def light_pass(region: Image.Image, face: str) -> None:
    """Bake soft lighting: key light from above, darker underside, ambient occlusion at the edges."""
    w, h = region.size
    px = region.load()
    base = {"up": 1.08, "down": 0.72, "north": 1.0, "south": 0.9, "east": 0.95, "west": 0.95}.get(face, 1.0)
    for y in range(h):
        vy = 1.0 if face in ("up", "down") else 1.06 - 0.2 * (y / max(1, h - 1))
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            edge = min(x, y, w - 1 - x, h - 1 - y) if (w >= 12 and h >= 12) else 9
            ao = 0.9 if edge == 0 else 0.96 if edge == 1 else 1.0
            f = base * vy * ao
            px[x, y] = (min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f)), a)


def build_model(persona: str, bones: list, tex: int = TEX_W, scale: int = SCALE, bounds: tuple = (3, 3.5), upscale: int = 1, light: bool = False) -> tuple:
    SCALE = scale  # noqa: N806 (local override for this model)
    atlas = Atlas(tex * scale, tex * scale)
    big = Image.new("RGBA", (tex * scale * upscale, tex * scale * upscale), (0, 0, 0, 0)) if upscale > 1 else None
    # collect faces, pack tallest first for density
    jobs = []
    for b in bones:
        for c in b.cubes:
            for f in c.faces:
                fw, fh = face_dims(c, f)
                if fw <= 0 or fh <= 0:
                    continue
                pw = max(1, int(math.ceil(fw * SCALE)))
                ph = max(1, int(math.ceil(fh * SCALE)))
                jobs.append((ph, pw, b, c, f, fw, fh))
    jobs.sort(key=lambda j: (-j[0], -j[1]))
    for ph, pw, b, c, f, fw, fh in jobs:
        x, y = atlas.alloc(pw, ph)
        if big is not None:
            if getattr(c.paint, "hires", False) or f in getattr(c.paint, "hires_faces", ()):
                region = Image.new("RGBA", (pw * upscale, ph * upscale), (0, 0, 0, 0))
                c.paint(region, f)      # painted natively at the high resolution
                if getattr(c.paint, "light", False):
                    light_pass(region, f)
            else:
                region = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
                c.paint(region, f)
                light_pass(region, f)
                # smooth premultiplied upscale: painterly shading instead of hard pixels
                region = region.convert("RGBa").resize((pw * upscale, ph * upscale), Image.BICUBIC).convert("RGBA")
            big.paste(region, (x * upscale, y * upscale))
        else:
            region = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
            c.paint(region, f)
            if light and not getattr(c.paint, "nolight", False):
                light_pass(region, f)
            atlas.img.alpha_composite(region, (x, y))
        # extend 1px gutter to avoid seams when sampling
        u = x / SCALE
        v = y / SCALE
        c.uv[f] = {"uv": [round(u, 4), round(v, 4)], "uv_size": [round(fw, 4), round(fh, 4)]}
        if f == "down":
            # Bedrock samples 'down' with flipped V; flip so it reads the same as painted.
            c.uv[f] = {"uv": [round(u, 4), round(v + fh, 4)], "uv_size": [round(fw, 4), round(-fh, 4)]}

    if big is not None:
        atlas.img = big

    geo_bones = []
    for b in bones:
        jb = {"name": b.name, "pivot": list(b.pivot)}
        if b.parent:
            jb["parent"] = b.parent
        if b.rotation:
            jb["rotation"] = list(b.rotation)
        if b.cubes:
            jc = []
            for c in b.cubes:
                cj = {"origin": [round(v, 4) for v in c.origin], "size": [round(v, 4) for v in c.size], "uv": c.uv}
                if c.inflate:
                    cj["inflate"] = c.inflate
                if c.rotation:
                    cj["rotation"] = list(c.rotation)
                    cj["pivot"] = list(c.pivot or c.origin)
                jc.append(cj)
            jb["cubes"] = jc
        geo_bones.append(jb)

    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": f"geometry.shadowbound.{persona}",
                "texture_width": tex,
                "texture_height": tex,
                "visible_bounds_width": bounds[0],
                "visible_bounds_height": bounds[1],
                "visible_bounds_offset": [0, bounds[1] / 2, 0],
            },
            "bones": geo_bones,
        }],
    }
    return geo, atlas.img


# --------------------------------------------------------------------------------------
# Shadow beasts — each species has its own colours and pelt (fur, feathers, scales, skin or stone).
# The "shadow" theme stays in the glowing eyes and a thin rune line along the flanks.
# --------------------------------------------------------------------------------------
RUNE = hexc("#8a5cff")
SIDES = ("north", "south", "east", "west")
PAINT_SCALE = [2]   # px per model unit of the model being built (set by build_beast)


@dataclass
class Pal:
    base: Color
    belly: Color
    eye: Color
    kind: str = "fur"                 # fur | feather | scale | skin | stone
    pattern: Optional[str] = None     # stripes | spots | diamonds | bars | warts | wrinkles | cracks | plates
    pat: Color = hexc("#000000")
    detail: Optional[Color] = None    # muzzle / inner ear
    rune: Color = RUNE
    pupil: str = "round"              # round | slit | bar

    def det(self) -> Color:
        return self.detail or mix(self.base, self.belly, 0.6)


PALS = {
    "wolf": Pal(hexc("#24252c"), hexc("#4a4c58"), hexc("#ffd23f"), detail=hexc("#3a3c47"), rune=hexc("#8a5cff")),        # Cão Divino Preto
    "dog_white": Pal(hexc("#eceef3"), hexc("#ffffff"), hexc("#6fc8ff"), detail=hexc("#c9cdd6"), rune=hexc("#8fd0ff")),     # Cão Divino Branco
    "totality": Pal(hexc("#1b1b22"), hexc("#e9e9ef"), hexc("#ff4a5a"), pattern="stripes", pat=hexc("#d8d8e0"),
                    detail=hexc("#30303a"), rune=hexc("#ff4a5a")),                                                       # Totalidade: preto com marcas brancas
    "owl": Pal(hexc("#7a5434"), hexc("#ecd9ae"), hexc("#ffc640"), kind="feather", pattern="bars", pat=hexc("#4a301c"),
               detail=hexc("#dcc394"), rune=hexc("#ffb347")),
    "serpent": Pal(hexc("#23744f"), hexc("#e3cf7a"), hexc("#d4ff4a"), kind="scale", pattern="diamonds", pat=hexc("#0f3b28"),
                   detail=hexc("#2f8f61"), rune=hexc("#5cff9d"), pupil="slit"),
    "toad": Pal(hexc("#62712f"), hexc("#e8dea8"), hexc("#ffb02e"), kind="skin", pattern="warts", pat=hexc("#3c471a"),
                detail=hexc("#8a9a46"), rune=hexc("#ffd84d"), pupil="bar"),
    "elephant": Pal(hexc("#8d8e98"), hexc("#74757f"), hexc("#9fd8ff"), kind="skin", pattern="wrinkles", pat=hexc("#6a6b74"),
                    detail=hexc("#c99c9c"), rune=hexc("#7fd0ff")),
    "rabbit": Pal(hexc("#f1efec"), hexc("#ffffff"), hexc("#ff5c7a"), detail=hexc("#f7b3c4"), rune=hexc("#ff9cc0")),
    "deer": Pal(hexc("#a26c3b"), hexc("#f2e4c9"), hexc("#7dffc8"), pattern="spots", pat=hexc("#f6ecd8"), detail=hexc("#5a3a1e"),
                rune=hexc("#7dffc8")),
    "bull": Pal(hexc("#3d2b22"), hexc("#5a4433"), hexc("#ff5a4a"), detail=hexc("#7c604d"), rune=hexc("#ff7a5a")),
    "tiger": Pal(hexc("#e3792a"), hexc("#f8f1e4"), hexc("#ffe066"), pattern="stripes", pat=hexc("#1d1410"), detail=hexc("#f8f1e4"),
                 rune=hexc("#ffb347"), pupil="slit"),
    "lion": Pal(hexc("#d7a64f"), hexc("#f2dda8"), hexc("#ffcf3a"), detail=hexc("#f0dbab"), rune=hexc("#ffcf5a"), pupil="slit"),
    "dragon": Pal(hexc("#4b2572"), hexc("#c28c40"), hexc("#ff4d6d"), kind="scale", pattern="plates", pat=hexc("#2b1245"),
                  detail=hexc("#6d3b9e"), rune=hexc("#ff6b9c"), pupil="slit"),
    "colossus": Pal(hexc("#d8d2c4"), hexc("#bdb6a6"), hexc("#ffe08a"), kind="skin", pattern="wrinkles", pat=hexc("#b1a996"),
                    detail=hexc("#3b3644"), rune=hexc("#ffd36b")),                                                       # Mahoraga: pálido, musculoso
}
LION_MANE = hexc("#7a4520")
IVORY = hexc("#ebe3cf")
MOUTH = hexc("#6a2430")


def _blend_px(img: Image.Image, x: int, y: int, c: Color, t: float) -> None:
    px = img.load()
    r, g, b, a = px[x, y]
    if a == 0:
        return
    px[x, y] = (int(r + (c[0] - r) * t), int(g + (c[1] - g) * t), int(b + (c[2] - b) * t), a)


def _texture(d: ImageDraw.ImageDraw, rnd: random.Random, w: int, h: int, col: Color, kind: str) -> None:
    if kind == "fur":
        for _ in range(w * h // 5):
            x, y = rnd.randrange(w), rnd.randrange(h)
            d.line([x, y, x + rnd.choice((-1, 0, 0, 1)), min(h - 1, y + rnd.randint(1, 3))],
                   fill=shade(col, rnd.choice((0.84, 0.9, 1.1, 1.16))))
    elif kind == "feather":
        for yy in range(-2, h, 3):
            off = (yy // 3 % 2) * 2
            for xx in range(-4 + off, w, 4):
                d.arc([xx, yy, xx + 4, yy + 4], 20, 160, fill=shade(col, 0.78))
                d.point([xx + 2, yy + 1], fill=shade(col, 1.14))
    elif kind == "scale":
        for yy in range(-1, h, 3):
            off = (yy // 3 % 2) * 2
            for xx in range(-4 + off, w, 4):
                d.arc([xx, yy - 1, xx + 4, yy + 3], 0, 180, fill=shade(col, 0.72))
                d.point([xx + 2, yy], fill=shade(col, 1.22))
    elif kind == "skin":
        for _ in range(w * h // 24):
            x, y = rnd.randrange(w), rnd.randrange(h)
            r = rnd.choice((1, 1, 2))
            d.ellipse([x - r, y - r, x + r, y + r], fill=shade(col, rnd.choice((0.92, 1.07))))
    elif kind == "stone":
        for _ in range(w * h // 18):
            x, y = rnd.randrange(w), rnd.randrange(h)
            d.rectangle([x, y, x + rnd.randint(1, 3), y + rnd.randint(1, 2)], fill=shade(col, rnd.choice((0.84, 0.92, 1.1, 1.18))))


def _pattern(img: Image.Image, d: ImageDraw.ImageDraw, rnd: random.Random, w: int, h: int, face: str, pal: Pal, col: Color) -> None:
    p = pal.pattern
    if p == "stripes":
        if face == "up":
            for y in range(2, h, 5):
                pts = [(x, y + rnd.choice((-1, 0, 1))) for x in range(0, w + 2, 2)]
                d.line(pts, fill=pal.pat, width=rnd.choice((1, 2)))
        elif face in ("east", "west"):
            for x in range(2, w, 5):
                length = rnd.randint(int(h * 0.4), int(h * 0.72))
                d.line([(x, 0), (x + rnd.choice((-1, 0, 1)), length // 2), (x + rnd.choice((-1, 1)), length)], fill=pal.pat, width=rnd.choice((1, 2)))
        else:
            for y in range(2, int(h * 0.8), 4):
                x0 = rnd.randint(0, max(0, w // 4))
                d.line([(x0, y), (w - rnd.randint(0, max(0, w // 4)), y + rnd.choice((-1, 0, 1)))], fill=pal.pat, width=1)
    elif p == "spots" and face in ("up", "east", "west"):
        lim = h if face == "up" else int(h * 0.6)
        for _ in range(max(2, w * lim // 30)):
            x, y = rnd.randrange(w), rnd.randrange(max(1, lim))
            d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=pal.pat)
    elif p == "diamonds":
        if face == "up":
            for y in range(0, h, 7):
                cx = w / 2
                d.polygon([(cx, y), (cx + w * 0.32, y + 3.5), (cx, y + 7), (cx - w * 0.32, y + 3.5)], fill=pal.pat)
                d.polygon([(cx, y + 2), (cx + w * 0.14, y + 3.5), (cx, y + 5), (cx - w * 0.14, y + 3.5)], fill=shade(col, 1.15))
        elif face in ("east", "west"):
            for x in range(0, w, 7):
                d.polygon([(x, 0), (x + 3.5, h * 0.35), (x + 7, 0)], fill=pal.pat)
    elif p == "bars":
        for y in range(3, h, 5):
            d.line([(0, y), (w, y + rnd.choice((-1, 0, 1)))], fill=pal.pat, width=1)
    elif p == "warts":
        for _ in range(max(2, w * h // 16)):
            x, y = rnd.randrange(w), rnd.randrange(h)
            d.ellipse([x - 1, y - 1, x + 1, y + 1], fill=pal.pat)
            d.point([x - 1, y - 1], fill=shade(col, 1.25))
    elif p == "wrinkles" and face != "up":
        ph = rnd.random() * 6
        for y in range(2, h, 3):
            pts = [(x, y + math.sin(x * 0.7 + ph + y) * 0.8) for x in range(0, w + 1)]
            d.line(pts, fill=pal.pat, width=1)
    elif p == "cracks":
        for _ in range(max(2, (w + h) // 12)):
            x, y = rnd.randrange(w), rnd.randrange(h)
            pts = [(x, y)]
            for _ in range(rnd.randint(3, 6)):
                x += rnd.randint(-3, 3)
                y += rnd.randint(1, 3)
                pts.append((x, y))
            d.line(pts, fill=shade(col, 0.45), width=2)
            d.line(pts, fill=pal.pat, width=1)     # glowing seam
    elif p == "plates" and face == "up":
        for y in range(2, h, 4):
            d.line([(0, y), (w, y)], fill=pal.pat, width=1)


def pelt(pal: Pal, seed: int = 1, base: Optional[Color] = None, belly: bool = True, pattern: bool = True,
         rune: bool = False, paw: bool = False, kind: Optional[str] = None) -> Painter:
    col0 = base or pal.base
    knd = kind or pal.kind

    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        rnd = random.Random(seed * 131 + len(face) * 17 + w * 7 + h)
        col = pal.belly if (face == "down" and belly) else col0
        d.rectangle([0, 0, w, h], fill=col)
        _texture(d, rnd, w, h, col, knd)
        if face == "down":
            if belly and pal.pattern == "plates":
                for y in range(1, h, 4):
                    d.line([(0, y), (w, y)], fill=shade(pal.belly, 0.72), width=1)
            return
        if belly and face in SIDES and h >= 6:
            band = max(2, int(h * 0.34))
            for i in range(band):
                t = (1 - i / band) * 0.9
                for x in range(w):
                    _blend_px(img, x, h - 1 - i, pal.belly, t)
        if pattern and pal.pattern:
            _pattern(img, d, rnd, w, h, face, pal, col)
        if paw and face in SIDES and h >= 6:
            band = max(1, int(h * 0.14))
            for i in range(band):
                for x in range(w):
                    _blend_px(img, x, h - 1 - i, shade(col, 0.62), 0.7)
        if rune and face in ("east", "west") and w > 10 and h > 6:
            y = int(h * 0.42)
            pts = [(int(w * 0.18), y)]
            for i in range(1, 6):
                pts.append((int(w * (0.18 + 0.13 * i)), y + (-2 if i % 2 else 2)))
            d.line(pts, fill=pal.rune, width=1)
    return p


def plain(c: Color, kind: str = "skin", seed: int = 3) -> Painter:
    """Single-colour part (horns, beaks, claws) with light texture."""
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=c)
        _texture(d, random.Random(seed + w + h + len(face)), w, h, c, kind)
        if face in SIDES and h >= 4:   # darker tip/base gradient
            for i in range(max(1, h // 4)):
                for x in range(w):
                    _blend_px(img, x, i, shade(c, 1.12), 0.5)
    return p


def horn() -> Painter:
    return plain(IVORY, "skin", 5)


def beast_face(pal: Pal, eye_w: float = 0.2, y: float = 0.38, gap: float = 0.24, belly: bool = True, disc: Optional[Color] = None) -> Painter:
    """Head front: pelt + detailed eyes (socket, iris, pupil, glint, brow)."""
    base = pelt(pal, seed=7, belly=belly, pattern=pal.pattern in ("stripes", "warts", "wrinkles", "cracks"))

    def p(img: Image.Image, face: str) -> None:
        base(img, face)
        if face != "north":
            return
        w, h = img.size
        d = ImageDraw.Draw(img)
        ew = max(3, int(round(w * eye_w)))
        eh = max(3, int(round(ew * 0.72)))
        cy = int(h * y)
        for cx in (int(w * (0.5 - gap)), int(w * (0.5 + gap))):
            if disc is not None:   # owl facial disc
                r = int(ew * 1.25)
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=disc)
            d.line([cx - ew // 2 - 1, cy - eh // 2 - 2, cx + ew // 2 + 1, cy - eh // 2 - 2], fill=shade(pal.base, 0.6))   # brow
            d.ellipse([cx - ew // 2 - 1, cy - eh // 2 - 1, cx + ew // 2 + 1, cy + eh // 2 + 1], fill=shade(pal.base, 0.35))
            d.ellipse([cx - ew // 2, cy - eh // 2, cx + ew // 2, cy + eh // 2], fill=pal.eye)
            d.chord([cx - ew // 2, cy - eh // 2, cx + ew // 2, cy + eh // 2], 0, 180, fill=mix(pal.eye, hexc("#ffffff"), 0.3))
            dark = hexc("#120c10")
            if pal.pupil == "slit":
                d.rectangle([cx - max(0, ew // 10), cy - eh // 2 + 1, cx + max(0, ew // 10), cy + eh // 2 - 1], fill=dark)
            elif pal.pupil == "bar":
                d.rectangle([cx - ew // 2 + 1, cy - max(0, eh // 8), cx + ew // 2 - 1, cy + max(0, eh // 8)], fill=dark)
            else:
                r = max(1, ew // 4)
                d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dark)
            d.rectangle([cx - ew // 2 + 1, cy - eh // 2 + 1, cx - ew // 2 + 1 + max(0, ew // 6), cy - eh // 2 + 1 + max(0, ew // 6)], fill=hexc("#ffffff"))
    return p


def snout_paint(pal: Pal, nose: Color = hexc("#2a1f22")) -> Painter:
    base = pelt(pal, seed=8, base=pal.det(), belly=False, pattern=pal.pattern in ("stripes",))

    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face == "down":
            d.rectangle([0, 0, w, h], fill=MOUTH)
            return
        base(img, face)
        if face == "north":
            nw = max(2, int(w * 0.42))
            d.rounded_rectangle([w // 2 - nw // 2, 0, w // 2 + nw // 2, max(2, int(h * 0.45))], radius=max(1, nw // 3), fill=nose)
            d.point([w // 2 - nw // 4, 1], fill=shade(nose, 2.2))
            d.line([w // 2, int(h * 0.45), w // 2, h], fill=shade(pal.det(), 0.6))
    return p


def jaw_paint(pal: Pal, teeth: bool) -> Painter:
    base = pelt(pal, seed=9, base=pal.det(), belly=False, pattern=False)

    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face == "up":
            d.rectangle([0, 0, w, h], fill=MOUTH)
            d.ellipse([w * 0.25, h * 0.2, w * 0.75, h * 0.95], fill=hexc("#d9667a"))      # tongue
            if teeth:
                for x in range(0, w, 2):
                    d.point([x, 0], fill=hexc("#f4efe6"))
            return
        if face == "down":
            d.rectangle([0, 0, w, h], fill=pal.belly)
            return
        base(img, face)
        if teeth and face == "north":
            for x in range(1, w - 1, 2):
                d.point([x, 0], fill=hexc("#f4efe6"))
    return p


def inner_ear(pal: Pal, seed: int = 10) -> Painter:
    base = pelt(pal, seed=seed, belly=False, pattern=False)

    def p(img: Image.Image, face: str) -> None:
        base(img, face)
        if face == "north":
            w, h = img.size
            ImageDraw.Draw(img).rectangle([w * 0.22, h * 0.2, w * 0.78, h], fill=pal.det())
    return p


def glow_crop(cube: Cube, pal: Pal, y_from_top: float, height: float) -> Cube:
    """Emissive eye band: an exact crop of the head front (opaque), iris pixels get lower alpha so only they glow."""
    ox, oy, oz = cube.origin
    sx, sy, _ = cube.size
    q = 0.25
    top_off = round(y_from_top / q) * q
    hh = max(q, round(height / q) * q)

    def p(img: Image.Image, face: str) -> None:
        s = PAINT_SCALE[0]
        fw, fh = int(math.ceil(sx * s)), int(math.ceil(sy * s))
        full = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        cube.paint(full, "north")
        light_pass(full, "north")        # same lighting as the head face it covers
        top = int(round(top_off * s))
        crop = full.crop((0, top, img.size[0], top + img.size[1]))
        px = crop.load()
        for yy in range(crop.size[1]):
            for xx in range(crop.size[0]):
                r, g, b, a = px[xx, yy]
                dist = abs(r - pal.eye[0]) + abs(g - pal.eye[1]) + abs(b - pal.eye[2])
                lit = mix(pal.eye, hexc("#ffffff"), 0.3)
                dist2 = abs(r - lit[0]) + abs(g - lit[1]) + abs(b - lit[2])
                px[xx, yy] = (r, g, b, 110 if min(dist, dist2) < 70 else 255)
        img.paste(crop, (0, 0))
    p.is_glow = True  # type: ignore[attr-defined]
    p.nolight = True  # type: ignore[attr-defined]
    return Cube((ox, oy + sy - top_off - hh, oz - 0.04), (sx, hh, 0), p, faces=("north",))


def split_glow(bones: list) -> list:
    """Move glowing planes into their own 'glow_eyes' bones (emissive material in the render controller)."""
    out = list(bones)
    n = 0
    for b in bones:
        glow = [c for c in b.cubes if getattr(c.paint, "is_glow", False)]
        if not glow:
            continue
        b.cubes = [c for c in b.cubes if not getattr(c.paint, "is_glow", False)]
        g = Bone("glow_eyes" if n == 0 else f"glow_eyes{n}", b.pivot, b.name)
        g.cubes = glow
        out.append(g)
        n += 1
    return out


def quad(bones: list, pal: Pal, L: float, W: float, H: float, legH: float, legW: float, head: float,
         snout: tuple = (0, 0, 0), tail: float = 0, tail_w: float = 2, neck: float = 0, teeth: bool = False,
         eye: tuple = (0.2, 0.38, 0.24), tail_tip: Optional[Color] = None) -> dict:
    """Generic four-legged animal facing north (-z). Returns bones by name."""
    by = {}

    def add(b: Bone) -> Bone:
        bones.append(b)
        by[b.name] = b
        return b
    add(Bone("root", (0, 0, 0)))
    body = add(Bone("body", (0, legH + H / 2, 0), "root"))
    body.cubes.append(Cube((-W / 2, legH, -L / 2), (W, H, L), pelt(pal, seed=2, rune=True)))
    hy = legH + H * 0.45 + neck
    hz = -L / 2 - head * 0.6
    hd = add(Bone("head", (0, legH + H * 0.7, -L / 2 + 1), "body"))
    if neck:
        hd.cubes.append(Cube((-W * 0.22, legH + H * 0.5, -L / 2 - 2), (W * 0.44, neck + 2, 4), pelt(pal, seed=3)))
    if head > 0.1:
        hc = Cube((-head / 2, hy, hz - head / 2), (head, head * 0.85, head), only(("north",), beast_face(pal, *eye), pelt(pal, seed=4)))
        hd.cubes.append(hc)
        fh = head * 0.85
        hd.cubes.append(glow_crop(hc, pal, eye[1] * fh - fh * 0.2, fh * 0.4))
    if snout[0]:
        sw, sh, sl = snout
        z0 = hz - head / 2 - sl
        up_h = sh * 0.62
        hd.cubes.append(Cube((-sw / 2, hy + sh - up_h, z0), (sw, up_h, sl), snout_paint(pal)))
        jaw = add(Bone("jaw", (0, hy + sh - up_h, hz - head / 2), "head"))
        jaw.cubes.append(Cube((-sw * 0.45, hy, z0 + 0.2), (sw * 0.9, sh - up_h, sl - 0.2), jaw_paint(pal, teeth)))
    lx = W / 2 - legW / 2 - 0.2
    lz = L / 2 - legW / 2 - 0.4
    for name, x, z in (("leg_fl", -lx, -lz), ("leg_fr", lx, -lz), ("leg_bl", -lx, lz), ("leg_br", lx, lz)):
        lg = add(Bone(name, (x, legH, z), "root"))
        lg.cubes.append(Cube((x - legW / 2, 0, z - legW / 2), (legW, legH + 0.5, legW), pelt(pal, seed=6, belly=False, paw=True)))
    if tail:
        tl = add(Bone("tail", (0, legH + H * 0.8, L / 2), "body", rotation=(-35, 0, 0)))
        tl.cubes.append(Cube((-tail_w / 2, legH + H * 0.8 - tail_w / 2, L / 2), (tail_w, tail_w, tail), pelt(pal, seed=8, belly=False)))
        if tail_tip is not None:
            tl.cubes.append(Cube((-tail_w / 2 - 0.2, legH + H * 0.8 - tail_w / 2 - 0.2, L / 2 + tail - 2.5), (tail_w + 0.4, tail_w + 0.4, 2.7),
                                 pelt(pal, seed=12, base=tail_tip, belly=False, pattern=False)))
    return by


def beast_wolf() -> list:
    b: list = []
    P = PALS["wolf"]
    by = quad(b, P, 14, 7, 7, 8, 2.6, 7, snout=(3.4, 3, 3.6), tail=9, tail_w=2.4, teeth=True, tail_tip=P.belly)
    for sx in (-1, 1):
        by["head"].cubes.append(Cube((sx * 2.2 - 1, 8 + 7 * 0.45 + 7 * 0.85, -7 - 4.2 - 0.6), (2, 3, 1.2), inner_ear(P)))
    by["body"].cubes.append(Cube((-4.2, 9.5, -7.6), (8.4, 6.5, 4.0), pelt(P, seed=10, base=mix(P.base, P.belly, 0.35))))   # neck ruff
    return b


def beast_tiger() -> list:
    b: list = []
    P = PALS["tiger"]
    by = quad(b, P, 24, 10, 10, 10, 3.6, 9, snout=(5, 4, 3), tail=16, tail_w=2.4, teeth=True, tail_tip=P.pat)
    for sx in (-1, 1):
        by["head"].cubes.append(Cube((sx * 3 - 1, 10 + 4.5 + 7.65, -12 - 5.4 - 0.5), (2, 2, 1), inner_ear(P, 11)))
    return b


def beast_lion() -> list:
    b: list = []
    P = PALS["lion"]
    by = quad(b, P, 24, 10, 11, 10, 3.6, 9, snout=(5, 4, 3), tail=15, tail_w=2, teeth=True)
    hy = 10 + 11 * 0.45
    by["head"].cubes.append(Cube((-8, hy - 3, -12 - 2), (16, 14, 6), pelt(P, seed=12, base=LION_MANE, belly=False, pattern=False)))   # mane
    by["tail"].cubes.append(Cube((-2, 10 + 11 * 0.8 - 2, 12 + 13), (4, 4, 4), pelt(P, seed=13, base=LION_MANE, belly=False, pattern=False)))
    return b


def beast_bull() -> list:
    b: list = []
    P = PALS["bull"]
    by = quad(b, P, 20, 12, 12, 9, 4, 9, snout=(6, 5, 3), tail=10, tail_w=1.5, tail_tip=hexc("#1c1410"))
    hy = 9 + 12 * 0.45 + 9 * 0.85 - 2
    for sx in (-1, 1):
        by["head"].cubes.append(Cube((sx * 4.5 - (2.5 if sx < 0 else 0), hy, -10 - 5.4 - 1), (2.5, 2, 2), horn()))
        by["head"].cubes.append(Cube((sx * 6 - (1.5 if sx < 0 else 0) + (0 if sx < 0 else 0.5), hy + 1.5, -10 - 5.4 - 1), (1.5, 4, 1.5), horn()))
    by["body"].cubes.append(Cube((-6.5, 9 + 6, -10 - 1), (13, 8, 8), pelt(P, seed=14, base=shade(P.base, 1.12))))     # hump
    return b


def beast_deer() -> list:
    b: list = []
    P = PALS["deer"]
    by = quad(b, P, 16, 7, 8, 14, 2.2, 6, snout=(3, 3, 3), tail=3, tail_w=2, neck=8, tail_tip=P.belly)
    hy = 14 + 8 * 0.45 + 8 + 6 * 0.85
    ant = plain(hexc("#e2d1a8"), "skin", 7)
    for sx in (-1, 1):
        x = sx * 1.6 - 0.5
        by["head"].cubes.append(Cube((x, hy, -8 - 3.6), (1, 6, 1), ant))
        by["head"].cubes.append(Cube((x + sx * 1.5 - (0 if sx > 0 else 0.5), hy + 4, -8 - 3.6), (2, 1, 1), ant))
        by["head"].cubes.append(Cube((x, hy + 3, -8 - 5), (1, 1, 2), ant))
    return b


def beast_rabbit() -> list:
    b: list = []
    P = PALS["rabbit"]
    by = quad(b, P, 7, 5, 5, 3, 1.6, 4.5, snout=(2, 1.6, 1), tail=0, eye=(0.2, 0.4, 0.26))
    hy = 3 + 5 * 0.45 + 4.5 * 0.85
    for sx in (-1, 1):
        ear = Bone("ear_l" if sx > 0 else "ear_r", (sx * 1.2, hy, -3.5 - 2.7), "head", rotation=(-10, 0, sx * 10))
        b.append(ear)
        ear.cubes.append(Cube((sx * 1.2 - 0.6, hy, -3.5 - 3.2), (1.2, 6, 1.6), inner_ear(P, 15)))
    by["body"].cubes.append(Cube((-1.2, 5.5, 3.5), (2.4, 2.4, 2), pelt(P, seed=16, base=hexc("#ffffff"), belly=False)))   # cotton tail
    return b


def beast_elephant() -> list:
    b: list = []
    P = PALS["elephant"]
    by = quad(b, P, 30, 20, 18, 16, 6.5, 14, tail=8, tail_w=1.6, tail_tip=hexc("#4a4a52"), eye=(0.12, 0.4, 0.3))
    hy = 16 + 18 * 0.45
    hz = -15 - 14 * 0.6
    for sx in (-1, 1):
        ear = Bone("ear_l" if sx > 0 else "ear_r", (sx * 7, hy + 8, hz), "head")
        b.append(ear)
        ear.cubes.append(Cube((sx * 7 - (13 if sx < 0 else 0), hy, hz - 1), (13, 13, 1.5), inner_ear(P, 16)))
        by["head"].cubes.append(Cube((sx * 4 - (1.5 if sx < 0 else 0), hy - 3, hz - 7 - 4), (1.5, 1.5, 6), horn()))     # tusks
    prev = "head"
    y = hy + 2
    for i, (w, h) in enumerate(((5, 5), (4, 5), (3.4, 5), (3, 4))):
        seg = Bone(f"trunk{i}", (0, y, hz - 7), prev)
        b.append(seg)
        seg.cubes.append(Cube((-w / 2, y - h, hz - 7 - w / 2), (w, h, w), pelt(P, seed=17 + i, belly=False)))
        prev = seg.name
        y -= h
    return b


def beast_toad() -> list:
    b: list = []
    P = PALS["toad"]
    b.append(Bone("root", (0, 0, 0)))
    body = Bone("body", (0, 6, 0), "root")
    b.append(body)
    body.cubes.append(Cube((-8, 2, -7), (16, 9, 14), pelt(P, seed=18, rune=True)))
    head = Bone("head", (0, 8, -7), "body")
    b.append(head)

    def toad_face(img: Image.Image, face: str) -> None:
        pelt(P, seed=19)(img, face)
        if face == "north":
            w, h = img.size
            d = ImageDraw.Draw(img)
            d.line([(1, int(h * 0.42)), (w // 2, int(h * 0.5)), (w - 2, int(h * 0.42))], fill=MOUTH, width=2)   # wide smile
            for cx in (int(w * 0.44), int(w * 0.56)):
                d.point([cx, int(h * 0.15)], fill=shade(P.base, 0.4))                                          # nostrils
    head.cubes.append(Cube((-7.5, 4, -12), (15, 7, 6), only(("north",), toad_face, pelt(P, seed=19))))
    tongue = Bone("tongue", (0, 6.5, -10.8), "head")     # hidden inside the mouth; the attack animation stretches it
    b.append(tongue)
    tongue.cubes.append(Cube((-1, 6, -11.8), (2, 1, 1), plain(hexc("#e8607e"), "skin", 9)))
    for sx in (-1, 1):
        bump = Cube((sx * 4.5 - 1.5, 11, -10), (3, 2.5, 3), only(("north",), beast_face(P, eye_w=0.62, y=0.5, gap=0.0, belly=False), pelt(P, seed=20, belly=False)))
        head.cubes.append(bump)
        head.cubes.append(glow_crop(bump, P, 0.0, 2.5))
    for name, x, z, w, h in (("leg_fl", -6, -6, 3, 4), ("leg_fr", 6, -6, 3, 4), ("leg_bl", -8, 4, 5, 6), ("leg_br", 8, 4, 5, 6)):
        lg = Bone(name, (x, 4, z), "root")
        b.append(lg)
        lg.cubes.append(Cube((x - w / 2, 0, z - w / 2), (w, h, w + 2), pelt(P, seed=21, belly=False, paw=True)))
    return b


def beast_owl() -> list:
    b: list = []
    P = PALS["owl"]
    b.append(Bone("levitate", (0, 0, 0)))
    b.append(Bone("root", (0, 0, 0), "levitate"))
    body = Bone("body", (0, 12, 0), "root")
    b.append(body)
    body.cubes.append(Cube((-6, 5, -5), (12, 14, 10), pelt(P, seed=22, rune=True)))

    def chest(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=P.belly)
        for y in range(2, h, 4):
            for x in range(1, w, 4):
                d.line([(x, y), (x + 1, y + 1), (x + 2, y)], fill=P.pat)     # chevrons
    body.cubes.append(Cube((-4.5, 6, -5.05), (9, 10, 0), chest, faces=("north",)))
    head = Bone("head", (0, 19, 0), "body")
    b.append(head)
    hc = Cube((-6.5, 19, -6), (13, 10, 11), only(("north",), beast_face(P, eye_w=0.22, y=0.45, gap=0.22, belly=False, disc=P.det()), pelt(P, seed=23, belly=False)))
    head.cubes.append(hc)
    head.cubes.append(glow_crop(hc, P, 10 * 0.45 - 2.5, 5.0))
    head.cubes.append(Cube((-1, 21, -7.5), (2, 3, 1.5), plain(hexc("#c9a24a"), "skin", 4)))                       # beak
    for sx in (-1, 1):
        head.cubes.append(Cube((sx * 4.5 - 1, 29, -3), (2, 3, 2), pelt(P, seed=24, belly=False)))                  # ear tufts
        wing = Bone("wing_l" if sx > 0 else "wing_r", (sx * 6, 18, 0), "body")
        b.append(wing)
        wing.cubes.append(Cube((sx * 6 - (1.5 if sx < 0 else 0), 6, -4), (1.5, 13, 9), pelt(P, seed=25, base=shade(P.base, 0.88), belly=False)))
        leg = Bone("leg_fl" if sx < 0 else "leg_fr", (sx * 2.5, 5, 0), "root")
        b.append(leg)
        leg.cubes.append(Cube((sx * 2.5 - 1, 2, -1), (2, 3.5, 2), plain(hexc("#c9a24a"), "skin", 6)))
    tail = Bone("tail", (0, 7, 5), "body", rotation=(30, 0, 0))
    b.append(tail)
    tail.cubes.append(Cube((-3, 2, 4), (6, 6, 1.5), pelt(P, seed=26, belly=False)))
    return b


def beast_serpent() -> list:
    b: list = []
    P = PALS["serpent"]
    b.append(Bone("root", (0, 0, 0)))
    head = Bone("head", (0, 6, -6), "root", rotation=(-10, 0, 0))
    b.append(head)
    hc = Cube((-5, 3, -16), (10, 6, 10), only(("north",), beast_face(P, eye_w=0.18, y=0.3, gap=0.28), pelt(P, seed=27)))
    head.cubes.append(hc)
    head.cubes.append(glow_crop(hc, P, 6 * 0.3 - 1.25, 2.5))
    jaw = Bone("jaw", (0, 3, -7), "head")
    b.append(jaw)
    jaw.cubes.append(Cube((-4, 1, -15), (8, 2, 8), jaw_paint(P, teeth=False)))
    for sx in (-1, 1):
        head.cubes.append(Cube((sx * 2.5 - 0.4, 1.6, -15.6), (0.8, 1.6, 0.8), horn()))                                # fangs
    prev = "root"
    z = -6
    for i in range(7):
        w = 7 - i * 0.6
        seg = Bone(f"seg{i}", (0, 3, z), prev)
        b.append(seg)
        seg.cubes.append(Cube((-w / 2, 0, z), (w, w * 0.85, 7), pelt(P, seed=29 + i, rune=(i % 2 == 0))))
        prev = seg.name
        z += 7
    b.append(Bone("body", (0, 3, 0), "root"))
    return b


def beast_dragon() -> list:
    b: list = []
    P = PALS["dragon"]
    by = quad(b, P, 26, 14, 12, 12, 4, 0.01, tail=0)
    neck = Bone("neck", (0, 20, -13), "body", rotation=(30, 0, 0))
    b.append(neck)
    neck.cubes.append(Cube((-3, 18, -21), (6, 6, 9), pelt(P, seed=31)))
    dh = Bone("dhead", (0, 21, -21), "neck", rotation=(-25, 0, 0))
    b.append(dh)
    hc = Cube((-4.5, 18, -32), (9, 7, 11), only(("north",), beast_face(P, eye_w=0.16, y=0.3, gap=0.3), pelt(P, seed=32)))
    dh.cubes.append(hc)
    dh.cubes.append(glow_crop(hc, P, 7 * 0.3 - 1.5, 3.0))
    jaw = Bone("jaw", (0, 18, -22), "dhead")
    b.append(jaw)
    jaw.cubes.append(Cube((-3.5, 15.5, -31), (7, 2.5, 9), jaw_paint(P, teeth=True)))
    membrane = hexc("#7a3aa8")

    def wing_skin(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=membrane)
        for i in range(1, 5):                                  # finger bones / veins
            x = int(w * i / 5)
            d.line([(x, 0), (x + (3 if face == "up" else -3), h)], fill=shade(membrane, 0.62), width=1)
        d.line([(0, 0), (w, 0)], fill=shade(membrane, 0.5), width=2)
    for sx in (-1, 1):
        dh.cubes.append(Cube((sx * 3 - 0.75, 25, -25), (1.5, 5, 1.5), horn()))                                   # horns
        wing = Bone("wing_l" if sx > 0 else "wing_r", (sx * 7, 23, -6), "body")
        b.append(wing)
        x0 = sx * 7 - (26 if sx < 0 else 0)
        wing.cubes.append(Cube((x0, 23, -8), (26, 1, 3), pelt(P, seed=34, belly=False)))                         # arm bone
        wing.cubes.append(Cube((x0 + (0 if sx > 0 else 1), 22.6, -5), (25, 0.6, 16), wing_skin))                   # membrane
    prev = "body"
    z = 13
    for i in range(4):
        w = 6 - i * 1.2
        seg = Bone(f"tail{i}" if i else "tail", (0, 16, z), prev)
        b.append(seg)
        seg.cubes.append(Cube((-w / 2, 16 - w / 2, z), (w, w, 8), pelt(P, seed=35 + i)))
        prev = seg.name
        z += 8
    for i in range(5):
        by["body"].cubes.append(Cube((-0.75, 24, -10 + i * 5), (1.5, 2.5, 2), horn()))                             # spines
    return b


def beast_colossus() -> list:
    b: list = []
    P = PALS["colossus"]
    b.append(Bone("root", (0, 0, 0)))
    body = Bone("body", (0, 34, 0), "root")
    b.append(body)
    body.cubes.append(Cube((-10, 22, -6), (20, 20, 12), pelt(P, seed=41)))

    def core(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        d.ellipse([0, 0, w - 1, h - 1], fill=(111, 240, 255, 150))
        d.ellipse([w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill=(230, 255, 255, 220))
    body.cubes.append(Cube((-2.5, 32, -6.1), (5, 5, 0), core, faces=("north",)))
    for i in range(4):
        body.cubes.append(Cube((-1, 42 - i * 4, 6), (2, 2.5, 4), plain(P.det(), "stone", 40 + i)))                   # back spikes
    head = Bone("head", (0, 42, 0), "body")
    b.append(head)
    hc = Cube((-5, 42, -5), (10, 10, 10), only(("north",), beast_face(P, eye_w=0.18, y=0.45, gap=0.22, belly=False), pelt(P, seed=42, belly=False)))
    head.cubes.append(hc)
    head.cubes.append(glow_crop(hc, P, 10 * 0.45 - 1.5, 3.0))
    for sx in (-1, 1):
        head.cubes.append(Cube((sx * 4 - 1, 52, -1), (2, 4, 2), plain(P.det(), "stone", 46)))                           # crown spikes
        arm = Bone("arm_l" if sx > 0 else "arm_r", (sx * 12, 40, 0), "body")
        b.append(arm)
        arm.cubes.append(Cube((sx * 12 - 4, 16, -4), (8, 24, 8), pelt(P, seed=43, belly=False)))
        arm.cubes.append(Cube((sx * 12 - 4.5, 13, -4.5), (9, 4, 9), pelt(P, seed=44, base=P.det(), belly=False)))       # fists
        leg = Bone("leg_l" if sx > 0 else "leg_r", (sx * 5, 22, 0), "root")
        b.append(leg)
        leg.cubes.append(Cube((sx * 5 - 4, 0, -4), (8, 22, 8), pelt(P, seed=45, belly=False, paw=True)))
    mahoraga_extras(b)
    return b


def beast_dog_white() -> list:
    b: list = []
    P = PALS["dog_white"]
    by = quad(b, P, 14, 7, 7, 8, 2.6, 7, snout=(3.4, 3, 3.6), tail=9, tail_w=2.4, teeth=True, tail_tip=hexc("#ffffff"))
    for sx in (-1, 1):
        by["head"].cubes.append(Cube((sx * 2.2 - 1, 8 + 7 * 0.45 + 7 * 0.85, -7 - 4.2 - 0.6), (2, 3, 1.2), inner_ear(P)))
    by["body"].cubes.append(Cube((-4.2, 9.5, -7.6), (8.4, 6.5, 4.0), pelt(P, seed=10, base=hexc("#ffffff"))))
    return b


def beast_totality() -> list:
    """Divine Dog: Totality — bigger, heavier, black with white markings and a white mane-like ruff."""
    b: list = []
    P = PALS["totality"]
    by = quad(b, P, 22, 10, 10, 12, 3.6, 9, snout=(4.6, 4, 4.4), tail=13, tail_w=3, teeth=True, tail_tip=hexc("#e9e9ef"))
    hy = 12 + 10 * 0.45
    for sx in (-1, 1):
        by["head"].cubes.append(Cube((sx * 3 - 1.25, hy + 9 * 0.85, -11 - 5.4 - 0.4), (2.5, 4, 1.4), inner_ear(P)))
    by["body"].cubes.append(Cube((-6, 13, -12), (12, 10, 6), pelt(P, seed=10, base=hexc("#e9e9ef"), pattern=False)))   # white ruff
    return b


def mahoraga_extras(b: list) -> None:
    """The eight-handled wheel over the head (turns 45° per adaptation step) and the sword of extermination."""
    P = PALS["colossus"]
    gold = hexc("#e2c26a")
    wheel = Bone("wheel", (0, 57, 0), "head")
    b.append(wheel)
    wheel.cubes.append(Cube((-1, 56.5, -1), (2, 1, 2), plain(gold, "stone", 50)))                                     # hub
    for k in range(8):
        ang = k * 45
        wheel.cubes.append(Cube((-0.4, 56.6, 0), (0.8, 0.8, 6), plain(gold, "stone", 51 + k), rotation=(0, ang, 0), pivot=(0, 57, 0)))   # spokes
        wheel.cubes.append(Cube((-1.6, 56.3, 5.6), (3.2, 1.4, 1.2), plain(shade(gold, 0.85), "stone", 60 + k), rotation=(0, ang, 0), pivot=(0, 57, 0)))  # rim
        wheel.cubes.append(Cube((-0.5, 56.5, 6.8), (1, 1, 1.6), plain(gold, "stone", 70 + k), rotation=(0, ang, 0), pivot=(0, 57, 0)))  # handle
    for bone in b:
        if bone.name == "arm_r":
            blade = hexc("#e8ecf2")
            bone.cubes.append(Cube((-12.6, 14.2, -4.5 - 18), (1.2, 2.6, 18), plain(blade, "stone", 80)))                    # sword of extermination
            bone.cubes.append(Cube((-13.5, 13.6, -5.2), (3, 3.8, 1.2), plain(P.det(), "stone", 81)))                      # guard


BEAST_BUILDERS = [
    ("wolf", beast_wolf), ("owl", beast_owl), ("serpent", beast_serpent), ("toad", beast_toad),
    ("elephant", beast_elephant), ("rabbit", beast_rabbit), ("deer", beast_deer), ("bull", beast_bull),
    ("tiger", beast_tiger), ("lion", beast_lion), ("dragon", beast_dragon), ("colossus", beast_colossus),
    ("dog_white", beast_dog_white), ("totality", beast_totality),
]


def build_beast(sp: str, builder) -> tuple:
    """Smallest atlas that fits, painted at up to 512 px (64 units x 8 px or 128 units x 4 px)."""
    for tex in (64, 128, 256):
        scale = max(2, 512 // tex)
        PAINT_SCALE[0] = scale
        try:
            geo, img = build_model(f"beast_{sp}", split_glow(builder()), tex=tex, scale=scale, bounds=(5, 5), light=True)
            return geo, img, scale
        except RuntimeError:
            continue
    raise RuntimeError(f"beast {sp} does not fit")


# --------------------------------------------------------------------------------------
# Small 2D assets
# --------------------------------------------------------------------------------------
def item_icon(path: str) -> None:
    """Selo das Dez Sombras: a dark seal with the shadow of a Divine Dog (hand-sign silhouette) and a violet ring."""
    s = 32
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([2, 2, 29, 29], fill=hexc("#120c1c"))
    d.ellipse([3, 3, 28, 28], outline=hexc("#8e5cff"), width=2)
    for k in range(10):                                   # ten marks for the ten shadows
        ang = k / 10 * math.tau - math.pi / 2
        x, y = 15.5 + math.cos(ang) * 11.5, 15.5 + math.sin(ang) * 11.5
        d.point([round(x), round(y)], fill=hexc("#d7a8ff"))
    white = hexc("#f2f0ff")
    d.polygon([(10, 9), (12, 15), (14, 11)], fill=white)     # left ear
    d.polygon([(21, 9), (19, 15), (17, 11)], fill=white)     # right ear
    d.ellipse([10, 11, 21, 21], fill=white)                  # head
    d.polygon([(13, 18), (18, 18), (15.5, 24)], fill=white)  # snout
    d.point([13, 15], fill=hexc("#120c1c"))
    d.point([18, 15], fill=hexc("#120c1c"))
    d.point([15, 22], fill=hexc("#120c1c"))
    img.save(path)


def particle_sprite(path: str) -> None:
    s = 16
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    star(d, 8, 8, 7, hexc("#ffffff"))
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    img.save(path)


def wisp_sprite(path: str) -> None:
    s = 16
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r, a in ((7, 60), (5, 120), (3, 220)):
        d.ellipse([8 - r, 8 - r, 8 + r, 8 + r], fill=(255, 255, 255, a))
    img.save(path)


# --------------------------------------------------------------------------------------
# Orthographic preview (front view, ignores bone rotations except none) for docs/QA
# --------------------------------------------------------------------------------------
def render_front(geo: dict, tex: Image.Image, px_per_unit: int = 10, hidden: tuple = (), scale: int = SCALE, canvas: tuple = (30, 44)) -> Image.Image:
    SCALE = scale  # noqa: N806
    bones = geo["minecraft:geometry"][0]["bones"]
    quads = []
    for b in bones:
        if b["name"] in hidden:
            continue
        for c in b.get("cubes", []):
            if "north" not in c["uv"]:
                continue
            ox, oy, oz = c["origin"]
            sx, sy, sz = c["size"]
            inf = c.get("inflate", 0)
            u, v = c["uv"]["north"]["uv"]
            uw, vh = c["uv"]["north"]["uv_size"]
            quads.append((oz - inf, ox - inf, oy - inf, sx + 2 * inf, sy + 2 * inf, u, v, uw, vh))
    quads.sort(key=lambda q: -q[0])  # far first
    W, H = canvas[0] * px_per_unit, canvas[1] * px_per_unit
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for _, ox, oy, sx, sy, u, v, uw, vh in quads:
        if uw <= 0 or vh <= 0:
            continue
        crop = tex.crop((int(u * SCALE), int(v * SCALE), int(round((u + uw) * SCALE)), int(round((v + vh) * SCALE))))
        tw = max(1, int(round(sx * px_per_unit)))
        th = max(1, int(round(sy * px_per_unit)))
        crop = crop.resize((tw, th), Image.NEAREST)
        sxp = int(round((canvas[0] / 2 - (ox + sx)) * px_per_unit))
        syp = int(round((canvas[1] - 2 - (oy + sy)) * px_per_unit))
        img.alpha_composite(crop, (sxp, syp))
    return img


def render_side(geo: dict, tex: Image.Image, px_per_unit: int = 4, scale: int = 2, canvas: tuple = (90, 64)) -> Image.Image:
    """Side view (from +x) using east faces; far cubes first. Rotations ignored."""
    bones = geo["minecraft:geometry"][0]["bones"]
    quads = []
    for b in bones:
        for c in b.get("cubes", []):
            if "east" not in c["uv"]:
                continue
            ox, oy, oz = c["origin"]
            sx, sy, sz = c["size"]
            u, v = c["uv"]["east"]["uv"]
            uw, vh = c["uv"]["east"]["uv_size"]
            quads.append((ox + sx, oz, oy, sz, sy, u, v, uw, vh))
    quads.sort(key=lambda q: q[0])
    W, H = canvas[0] * px_per_unit, canvas[1] * px_per_unit
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for _, oz, oy, sz, sy, u, v, uw, vh in quads:
        if uw <= 0 or vh <= 0 or sz <= 0:
            continue
        crop = tex.crop((int(u * scale), int(v * scale), int(round((u + uw) * scale)), int(round((v + vh) * scale))))
        crop = crop.resize((max(1, int(round(sz * px_per_unit))), max(1, int(round(sy * px_per_unit)))), Image.NEAREST)
        img.alpha_composite(crop, (int(round((canvas[0] / 2 + oz) * px_per_unit)), int(round((canvas[1] - 2 - (oy + sy)) * px_per_unit))))
    return img


def pack_icon(path: str, portraits: list) -> None:
    """Pack icon: night sky, red moon and three shikigami portraits."""
    sz = 256
    img = Image.new("RGBA", (sz, sz), hexc("#140f1f"))
    d = ImageDraw.Draw(img)
    for y in range(sz):
        d.line([0, y, sz, y], fill=mix(hexc("#3a0f2a"), hexc("#0c0814"), y / sz))
    d.ellipse([168, 18, 232, 82], fill=hexc("#e2453c"))
    rnd = random.Random(7)
    for _ in range(40):
        x, y = rnd.randint(0, sz), rnd.randint(0, sz // 2)
        d.point([x, y], fill=(255, 255, 255, rnd.randint(80, 220)))
    for i, pv in enumerate(portraits[:3]):
        bb = pv.getbbox()
        c = pv.crop(bb) if bb else pv
        k = 100 / max(c.size)
        c = c.resize((max(1, int(c.size[0] * k)), max(1, int(c.size[1] * k))), Image.NEAREST)
        img.alpha_composite(c, (10 + i * 82, sz - c.size[1] - 8))
    img.save(path)




# --------------------------------------------------------------------------------------
# UI icons (Selo das Dez Sombras menus): shikigami portraits, companion faces and drawn glyphs.
# Saved to resource_pack/textures/ui/shadowbound/<name>.png and referenced by scripts/ui/icons.ts.
# --------------------------------------------------------------------------------------
UI_DIR = os.path.join(RP, "textures", "ui", "shadowbound")
ICON_PX = 64
_IS = 256  # supersampled canvas


def _icon_base(ring: Color) -> tuple:
    img = Image.new("RGBA", (_IS, _IS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([8, 8, _IS - 8, _IS - 8], fill=hexc("#16101f"))
    _radial(d, _IS / 2, _IS * 0.42, _IS * 0.42, _IS * 0.42, hexc("#2b2140"), hexc("#16101f"), steps=12)
    d.ellipse([8, 8, _IS - 8, _IS - 8], outline=ring, width=14)
    return img, d


def _save_icon(img: Image.Image, name: str) -> None:
    os.makedirs(UI_DIR, exist_ok=True)
    img.convert("RGBa").resize((ICON_PX, ICON_PX), Image.LANCZOS).convert("RGBA").save(os.path.join(UI_DIR, f"{name}.png"))


def portrait_icon(src: Image.Image, name: str, ring: Color) -> None:
    """Fits a rendered model (transparent background) inside the round icon."""
    bb = src.getbbox()
    if not bb:
        return
    crop = src.crop(bb)
    k = min(170 / crop.size[0], 170 / crop.size[1])
    crop = crop.resize((max(1, int(crop.size[0] * k)), max(1, int(crop.size[1] * k))), Image.NEAREST)
    img, d = _icon_base(ring)
    mask = Image.new("L", (_IS, _IS), 0)
    ImageDraw.Draw(mask).ellipse([22, 22, _IS - 22, _IS - 22], fill=255)
    layer = Image.new("RGBA", (_IS, _IS), (0, 0, 0, 0))
    layer.alpha_composite(crop, ((_IS - crop.size[0]) // 2, (_IS - crop.size[1]) // 2 + 6))
    img.paste(layer, (0, 0), ImageChops.multiply(layer.getchannel("A"), mask))
    d.ellipse([8, 8, _IS - 8, _IS - 8], outline=ring, width=14)
    _save_icon(img, name)


def _g_dog(d, c):
    d.polygon([(70, 60), (100, 130), (122, 84)], fill=c)
    d.polygon([(186, 60), (156, 130), (134, 84)], fill=c)
    d.ellipse([72, 84, 184, 182], fill=c)
    d.polygon([(100, 150), (156, 150), (128, 206)], fill=c)
    for x in (104, 152):
        d.ellipse([x - 8, 118, x + 8, 134], fill=hexc("#16101f"))


def _g_hand(d, c):
    d.rounded_rectangle([82, 118, 174, 200], radius=26, fill=c)
    for i, x in enumerate((84, 108, 132, 156)):
        top = (70, 54, 58, 76)[i]
        d.rounded_rectangle([x, top, x + 20, 140], radius=10, fill=c)
    d.rounded_rectangle([52, 128, 96, 150], radius=11, fill=c)


def _g_sword(d, c):
    d.polygon([(178, 52), (200, 58), (112, 152), (100, 140)], fill=c)
    d.rounded_rectangle([70, 140, 132, 156], radius=6, fill=hexc("#e2c26a"))
    d.line([(96, 156), (66, 196)], fill=hexc("#8a5a35"), width=18)


def _g_squad(d, c):
    for cx, cy, r in ((128, 92, 30), (78, 118, 24), (178, 118, 24)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)
        d.pieslice([cx - r * 1.8, cy + r * 0.9, cx + r * 1.8, cy + r * 4.2], 180, 360, fill=c)


def _g_shadow(d, c):
    d.ellipse([52, 150, 204, 200], fill=hexc("#05030a"))
    d.ellipse([70, 158, 186, 190], fill=hexc("#2a1747"))
    for i, x in enumerate((92, 128, 164)):
        d.arc([x - 22, 70 + i * 6, x + 22, 170], 200, 340, fill=c, width=12)


def _g_book(d, c):
    d.polygon([(48, 78), (126, 96), (126, 196), (48, 178)], fill=c)
    d.polygon([(208, 78), (130, 96), (130, 196), (208, 178)], fill=shade(c, 0.85))
    for y in (112, 134, 156):
        d.line([(64, y), (112, y + 8)], fill=hexc("#16101f"), width=5)
        d.line([(192, y), (144, y + 8)], fill=hexc("#16101f"), width=5)


def _g_torii(d, c):
    red = hexc("#e2453c")
    d.polygon([(40, 70), (216, 70), (206, 92), (50, 92)], fill=red)
    d.rectangle([60, 112, 196, 128], fill=red)
    d.rectangle([76, 92, 96, 206], fill=red)
    d.rectangle([160, 92, 180, 206], fill=red)
    d.rectangle([120, 92, 136, 112], fill=red)


def _g_gear(d, c):
    for k in range(8):
        a = k / 8 * math.tau
        x, y = 128 + math.cos(a) * 66, 128 + math.sin(a) * 66
        d.ellipse([x - 20, y - 20, x + 20, y + 20], fill=c)
    d.ellipse([66, 66, 190, 190], fill=c)
    d.ellipse([104, 104, 152, 152], fill=hexc("#16101f"))


def _g_recall(d, c):
    d.ellipse([60, 168, 196, 206], fill=hexc("#05030a"))
    d.rectangle([114, 52, 142, 140], fill=c)
    d.polygon([(82, 130), (174, 130), (128, 182)], fill=c)


def _g_ritual(d, c):
    red = hexc("#ff4a5a")
    d.ellipse([56, 56, 200, 200], outline=red, width=14)
    for k in range(5):
        a1 = -math.pi / 2 + k * 4 * math.pi / 5
        a2 = -math.pi / 2 + (k + 1) * 4 * math.pi / 5
        d.line([(128 + math.cos(a1) * 66, 128 + math.sin(a1) * 66), (128 + math.cos(a2) * 66, 128 + math.sin(a2) * 66)], fill=red, width=10)


def _g_bolt(d, c):
    d.polygon([(146, 40), (82, 140), (124, 140), (104, 216), (176, 108), (132, 108)], fill=hexc("#ffd84d"))


def _g_blackflash(d, c):
    d.polygon([(146, 40), (82, 140), (124, 140), (104, 216), (176, 108), (132, 108)], fill=hexc("#ff2a3a"))
    d.polygon([(140, 62), (100, 132), (130, 132), (116, 184), (160, 116), (130, 116)], fill=hexc("#05030a"))


def _g_paw(d, c):
    d.ellipse([86, 120, 170, 196], fill=c)
    for x, y in ((72, 92), (104, 68), (152, 68), (184, 92)):
        d.ellipse([x - 18, y - 22, x + 18, y + 22], fill=c)


def _g_shield(d, c):
    d.polygon([(128, 46), (200, 72), (192, 150), (128, 210), (64, 150), (56, 72)], fill=c)
    d.polygon([(128, 70), (176, 88), (170, 146), (128, 186)], fill=shade(c, 0.8))


def _g_pin(d, c):
    d.ellipse([80, 46, 176, 142], fill=c)
    d.polygon([(88, 116), (168, 116), (128, 208)], fill=c)
    d.ellipse([108, 74, 148, 114], fill=hexc("#16101f"))


def _g_target(d, c):
    d.ellipse([56, 56, 200, 200], outline=c, width=14)
    d.ellipse([96, 96, 160, 160], outline=c, width=12)
    for a, b in (((128, 36), (128, 84)), ((128, 172), (128, 220)), ((36, 128), (84, 128)), ((172, 128), (220, 128))):
        d.line([a, b], fill=c, width=12)


def _g_back(d, c):
    d.polygon([(64, 128), (128, 72), (128, 108), (196, 108), (196, 148), (128, 148), (128, 184)], fill=c)


def _g_lock(d, c):
    d.arc([86, 52, 170, 150], 180, 360, fill=c, width=18)
    d.rounded_rectangle([70, 108, 186, 206], radius=16, fill=c)
    d.ellipse([116, 136, 140, 160], fill=hexc("#16101f"))


def _g_skull(d, c):
    d.ellipse([70, 56, 186, 166], fill=c)
    d.rounded_rectangle([96, 150, 160, 196], radius=10, fill=c)
    for x in (100, 156):
        d.ellipse([x - 18, 98, x + 18, 132], fill=hexc("#16101f"))


def _g_flame(d, c):
    d.polygon([(128, 36), (176, 112), (186, 160), (128, 214), (70, 160), (82, 112)], fill=c)
    d.polygon([(128, 98), (154, 146), (128, 196), (102, 146)], fill=hexc("#ffe8ff"))


def _g_heart(d, c):
    d.ellipse([58, 70, 132, 144], fill=c)
    d.ellipse([124, 70, 198, 144], fill=c)
    d.polygon([(62, 120), (194, 120), (128, 206)], fill=c)


def _g_eye(d, c):
    d.chord([40, 70, 216, 230], 200, 340, fill=c)
    d.chord([40, 26, 216, 186], 20, 160, fill=c)
    d.ellipse([96, 96, 160, 160], fill=hexc("#16101f"))
    d.ellipse([112, 112, 144, 144], fill=hexc("#ff4a5a"))


def _g_chest(d, c):
    d.ellipse([52, 160, 204, 206], fill=hexc("#05030a"))
    d.rounded_rectangle([72, 82, 184, 170], radius=10, fill=hexc("#a8743c"))
    d.rectangle([72, 112, 184, 122], fill=hexc("#5a3a1e"))
    d.rectangle([118, 104, 138, 130], fill=hexc("#e2c26a"))


def _g_dive(d, c):
    d.ellipse([52, 166, 204, 206], fill=hexc("#05030a"))
    d.arc([60, 40, 200, 220], 200, 300, fill=c, width=18)
    d.polygon([(150, 150), (196, 150), (172, 196)], fill=c)


def _g_star(d, c):
    pts = []
    for k in range(10):
        r = 86 if k % 2 == 0 else 38
        a = -math.pi / 2 + k * math.pi / 5
        pts.append((128 + math.cos(a) * r, 128 + math.sin(a) * r))
    d.polygon(pts, fill=c)


def _g_toggle_on(d, c):
    d.rounded_rectangle([44, 92, 212, 164], radius=36, fill=hexc("#3fbf6a"))
    d.ellipse([144, 96, 208, 160], fill=hexc("#ffffff"))


def _g_toggle_off(d, c):
    d.rounded_rectangle([44, 92, 212, 164], radius=36, fill=hexc("#5a5566"))
    d.ellipse([48, 96, 112, 160], fill=hexc("#d8d4e0"))


def _g_text(d, c):
    d.rounded_rectangle([46, 64, 210, 170], radius=22, fill=c)
    d.polygon([(80, 160), (120, 160), (78, 204)], fill=c)
    for y in (94, 118, 142):
        d.line([(72, y), (184, y)], fill=hexc("#16101f"), width=8)


GLYPHS = {
    "dogs": (_g_dog, "#f2f0ff", "#8e5cff"), "hand": (_g_hand, "#f2f0ff", "#8e5cff"), "sword": (_g_sword, "#dfe3f0", "#8e5cff"),
    "squad": (_g_squad, "#ffd1e8", "#ff7ab8"), "shadow": (_g_shadow, "#b48cff", "#8e5cff"), "book": (_g_book, "#f4ead6", "#c49a3e"),
    "clan": (_g_torii, "#e2453c", "#e2453c"), "gear": (_g_gear, "#c9c4d6", "#7a7090"), "recall": (_g_recall, "#b48cff", "#5a4a7a"),
    "ritual": (_g_ritual, "#ff4a5a", "#ff4a5a"), "summon": (_g_hand, "#ffe08a", "#ffd36b"), "ability": (_g_bolt, "#ffd84d", "#ffd84d"),
    "follow": (_g_paw, "#f2f0ff", "#6fc8ff"), "protect": (_g_shield, "#8fd0ff", "#6fc8ff"), "guard": (_g_pin, "#ff8a99", "#ff8a99"),
    "hunt": (_g_target, "#ff4a5a", "#ff4a5a"), "back": (_g_back, "#c9c4d6", "#5a5566"), "lock": (_g_lock, "#8a8496", "#5a5566"),
    "destroyed": (_g_skull, "#8a8496", "#3a3444"), "energy": (_g_flame, "#c77dff", "#8e5cff"), "t_reforco": (_g_flame, "#ff6a5a", "#ff6a5a"),
    "t_kokusen": (_g_blackflash, "#ff2a3a", "#ff2a3a"), "t_guardar": (_g_chest, "#e2c26a", "#8e5cff"), "t_mergulho": (_g_dive, "#b48cff", "#8e5cff"),
    "t_dominio_simples": (_g_shield, "#8fe0ff", "#4fb6ff"), "t_rct": (_g_heart, "#fff2c2", "#ffd36b"), "t_dominio": (_g_eye, "#c77dff", "#8e5cff"),
    "info": (_g_book, "#dfe3f0", "#6fc8ff"), "canon": (_g_star, "#ffd36b", "#ffd36b"), "on": (_g_toggle_on, "#3fbf6a", "#3fbf6a"),
    "off": (_g_toggle_off, "#5a5566", "#5a5566"), "text": (_g_text, "#f2f0ff", "#ff7ab8"), "build": (_g_hand, "#ffb36b", "#ff8c2b"),
}


PORTRAIT_OFFSET = {"rabbit": 0.42, "deer": 0.22, "dog_white": 0.08, "wolf": 0.08, "totality": 0.08}


def beast_portrait(geo: dict, tex: Image.Image, scale: int, sp: str = "") -> Image.Image:
    """Front view, cropped to the head and shoulders (square from the top), central part for winged ones."""
    full = render_front(geo, tex, px_per_unit=8, scale=scale, canvas=(80, 70))
    bb = full.getbbox()
    if not bb:
        return full
    c = full.crop(bb)
    w, h = c.size
    if w > 2 * h:                         # wings/ears spread wide: keep the middle
        keep = int(h * 1.4)
        c = c.crop(((w - keep) // 2, 0, (w + keep) // 2, h))
        w, h = c.size
    if h > w:
        top = min(h - w, int(h * PORTRAIT_OFFSET.get(sp, 0)))
        c = c.crop((0, top, w, top + w))
    return c


def glyph_icons() -> None:
    for name, (fn, col, ring) in GLYPHS.items():
        img, d = _icon_base(hexc(ring))
        fn(d, hexc(col))
        _save_icon(img, name)


# --------------------------------------------------------------------------------------
# Jujutsu Kaisen content art: ability / clan / technique icons, item textures, armor layers.
# --------------------------------------------------------------------------------------
def _font(size: int):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf", "/Library/Fonts/Arial Bold.ttf"):
        if os.path.exists(path):
            from PIL import ImageFont
            return ImageFont.truetype(path, size)
    from PIL import ImageFont
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def _g_orb(d, c):
    _radial(d, 128, 128, 74, 74, mix(c, hexc("#ffffff"), 0.55), shade(c, 0.6), steps=16)
    d.ellipse([96, 92, 124, 116], fill=(255, 255, 255, 200))


def _g_multi_orb(d, c):
    for i in range(6):
        a = i / 6 * math.tau
        x, y = 128 + math.cos(a) * 62, 128 + math.sin(a) * 62
        _radial(d, x, y, 24, 24, mix(c, hexc("#ffffff"), 0.4), shade(c, 0.6), steps=8)
    _radial(d, 128, 128, 30, 30, mix(c, hexc("#ffffff"), 0.4), shade(c, 0.6), steps=8)


def _g_beam(d, c):
    d.line([(44, 212), (212, 44)], fill=shade(c, 0.6), width=46)
    d.line([(44, 212), (212, 44)], fill=c, width=28)
    d.line([(44, 212), (212, 44)], fill=mix(c, hexc("#ffffff"), 0.7), width=10)


def _g_infinity(d, c):
    d.ellipse([40, 84, 132, 172], outline=c, width=22)
    d.ellipse([124, 84, 216, 172], outline=c, width=22)


def _g_drop(d, c):
    d.polygon([(128, 36), (182, 130), (74, 130)], fill=c)
    d.ellipse([72, 96, 184, 208], fill=c)
    d.ellipse([100, 130, 124, 166], fill=mix(c, hexc("#ffffff"), 0.5))


def _g_lips(d, c):
    d.chord([48, 92, 208, 196], 0, 180, fill=c)
    d.chord([48, 70, 128, 150], 180, 360, fill=c)
    d.chord([128, 70, 208, 150], 180, 360, fill=c)
    d.line([(52, 128), (204, 128)], fill=hexc("#16101f"), width=8)
    for x in (88, 168):   # the snake-eye marks of the Inumaki
        d.ellipse([x - 9, 160, x + 9, 178], fill=hexc("#16101f"))


def _g_frame(d, c):
    d.rectangle([60, 56, 196, 200], outline=c, width=14)
    for y in range(70, 200, 26):
        d.rectangle([38, y, 54, y + 12], fill=c)
        d.rectangle([202, y, 218, y + 12], fill=c)
    d.line([(82, 176), (174, 80)], fill=c, width=10)


def _g_snow_frame(d, c):
    _g_frame(d, c)
    for a in range(0, 180, 45):
        r = math.radians(a)
        d.line([(128 - math.cos(r) * 34, 128 - math.sin(r) * 34), (128 + math.cos(r) * 34, 128 + math.sin(r) * 34)], fill=hexc("#ffffff"), width=8)


def _g_dash(d, c):
    for i, y in enumerate((88, 128, 168)):
        d.line([(40 + i * 10, y), (150, y)], fill=shade(c, 0.7 + i * 0.1), width=12)
    d.polygon([(150, 70), (220, 128), (150, 186)], fill=c)


def _g_up(d, c):
    d.rectangle([114, 110, 142, 206], fill=c)
    d.polygon([(70, 120), (186, 120), (128, 46)], fill=c)


def _g_fist(d, c):
    d.rounded_rectangle([70, 92, 186, 196], radius=28, fill=c)
    for x in (78, 106, 134, 162):
        d.rounded_rectangle([x, 70, x + 26, 118], radius=12, fill=c)
    d.line([(78, 140), (186, 140)], fill=shade(c, 0.7), width=6)


def _g_zz(d, c):
    f = _font(96)
    d.text((54, 54), "Zz", font=f, fill=c)


def _g_down(d, c):
    d.rectangle([114, 46, 142, 140], fill=c)
    d.polygon([(70, 130), (186, 130), (128, 210)], fill=c)
    d.line([(52, 214), (204, 214)], fill=c, width=10)


def _g_nail(d, c):
    d.polygon([(118, 60), (138, 60), (132, 200), (124, 200)], fill=hexc("#c9ccd6"))
    d.rounded_rectangle([90, 48, 166, 68], radius=6, fill=hexc("#dfe3f0"))
    for k in range(6):
        a = k / 6 * math.tau
        d.line([(128, 206), (128 + math.cos(a) * 34, 206 + math.sin(a) * 20)], fill=c, width=6)


def _g_hammer(d, c):
    d.line([(80, 200), (160, 104)], fill=hexc("#8a5a35"), width=20)
    d.rounded_rectangle([118, 52, 214, 104], radius=10, fill=hexc("#c9ccd6"))
    d.ellipse([46, 150, 100, 204], outline=c, width=10)


def _g_star_burst(d, c):
    pts = []
    for k in range(16):
        r = 92 if k % 2 == 0 else 40
        a = k * math.pi / 8
        pts.append((128 + math.cos(a) * r, 128 + math.sin(a) * r))
    d.polygon(pts, fill=c)


def _g_clap(d, c):
    d.rounded_rectangle([70, 64, 122, 200], radius=24, fill=c)
    d.rounded_rectangle([134, 64, 186, 200], radius=24, fill=shade(c, 0.85))
    for x, y in ((128, 46), (96, 40), (160, 40)):
        d.line([(x, y), (x + (x - 128) * 0.2, y - 20)], fill=hexc("#ffffff"), width=6)


def _g_swap(d, c):
    d.line([(52, 98), (188, 98)], fill=c, width=16)
    d.polygon([(188, 70), (226, 98), (188, 126)], fill=c)
    d.line([(68, 162), (204, 162)], fill=c, width=16)
    d.polygon([(68, 134), (30, 162), (68, 190)], fill=c)


def _g_ratio(d, c):
    f = _font(92)
    d.text((40, 70), "7:3", font=f, fill=c)


def _g_crumble(d, c):
    for i, (x, y, s) in enumerate(((60, 150, 50), (118, 120, 60), (176, 160, 40), (90, 80, 34), (150, 70, 30))):
        d.rectangle([x - s / 2, y - s / 2, x + s / 2, y + s / 2], fill=shade(c, 0.7 + i * 0.07))


def _g_arrows(d, c):
    for i in range(3):
        y = 80 + i * 44
        d.line([(50, y + 30), (190, y - 20)], fill=hexc("#8a5a35"), width=8)
        d.polygon([(190, y - 36), (214, y - 28), (196, y - 6)], fill=hexc("#c9ccd6"))


def _g_x_slash(d, c):
    d.line([(60, 60), (196, 196)], fill=c, width=16)
    d.line([(196, 60), (60, 196)], fill=c, width=16)


def _g_cube(d, c):
    d.polygon([(128, 50), (200, 88), (128, 126), (56, 88)], fill=mix(c, hexc("#ffffff"), 0.3))
    d.polygon([(56, 88), (128, 126), (128, 208), (56, 170)], fill=c)
    d.polygon([(200, 88), (128, 126), (128, 208), (200, 170)], fill=shade(c, 0.7))


ABILITY_ICONS = {
    "reforco": (_g_flame, "#c77dff", "#8e5cff"), "kokusen": (_g_blackflash, "#ff2a3a", "#ff2a3a"), "dominio_simples": (_g_shield, "#8fe0ff", "#4fb6ff"),
    "rct": (_g_heart, "#fff2c2", "#ffd36b"), "infinito": (_g_infinity, "#8fd8ff", "#4fb6ff"), "azul": (_g_orb, "#4fa6ff", "#4fa6ff"),
    "vermelho": (_g_orb, "#ff3a3a", "#ff3a3a"), "roxo": (_g_orb, "#a64dff", "#a64dff"), "vazio": (_g_eye, "#e8f4ff", "#8fd8ff"),
    "mergulho": (_g_dive, "#b48cff", "#8e5cff"), "guardar": (_g_chest, "#e2c26a", "#8e5cff"), "jardim": (_g_eye, "#c77dff", "#8e5cff"),
    "quadros": (_g_frame, "#6fffc0", "#3fd69a"), "aceleracao": (_g_dash, "#6fffc0", "#3fd69a"), "quadro_congelado": (_g_snow_frame, "#6fffc0", "#3fd69a"),
    "investida": (_g_dash, "#ffd36b", "#ffb347"), "salto": (_g_up, "#ffd36b", "#ffb347"), "sangue_perfurante": (_g_beam, "#e01a2a", "#b0101a"),
    "amarracao": (_g_target, "#e01a2a", "#b0101a"), "supernova": (_g_multi_orb, "#e01a2a", "#b0101a"), "escamas": (_g_flame, "#e01a2a", "#b0101a"),
    "fala": (_g_lips, "#c77dff", "#8e5cff"), "exploda": (_g_star_burst, "#c77dff", "#8e5cff"), "durma": (_g_zz, "#c77dff", "#8e5cff"),
    "esmague": (_g_down, "#c77dff", "#8e5cff"), "pregos": (_g_nail, "#ff9a3a", "#ff8c2b"), "ressonancia": (_g_hammer, "#ff9a3a", "#ff8c2b"),
    "grampo": (_g_star_burst, "#ff9a3a", "#ff8c2b"), "palmas": (_g_clap, "#ffd84d", "#ffb347"), "troca": (_g_swap, "#ffd84d", "#ffb347"),
    "golpe_73": (_g_ratio, "#fff2c2", "#d8c88a"), "hora_extra": (_g_flame, "#fff2c2", "#d8c88a"), "colapso": (_g_crumble, "#c9b89a", "#d8c88a"),
    "municao": (_g_arrows, "#9fd8ff", "#6fa8e0"), "lamina": (_g_sword, "#dfe3f0", "#6fa8e0"), "escudo": (_g_shield, "#c9ccd6", "#6fa8e0"),
    "desmantelar": (_g_beam, "#ffffff", "#e2453c"), "clivar": (_g_x_slash, "#ffffff", "#e2453c"), "fuga": (_g_flame, "#ff7a2a", "#e2453c"),
    "santuario": (_g_eye, "#ff4a5a", "#e2453c"),
}
CLAN_ICONS = {"gojo": (_g_infinity, "#8fd8ff", "#4fb6ff"), "zenin": (_g_dog, "#e8f4e8", "#2f8f4a"), "kamo": (_g_drop, "#e01a2a", "#b0101a"),
              "inumaki": (_g_lips, "#c77dff", "#8e5cff"), "none": (_g_star, "#f2f0ff", "#9a94aa")}
TECH_ICONS = {"limitless": (_g_infinity, "#8fd8ff", "#4fb6ff"), "ten_shadows": (_g_dog, "#f2f0ff", "#8e5cff"), "projection": (_g_frame, "#6fffc0", "#3fd69a"),
              "heavenly": (_g_fist, "#ffd36b", "#ffb347"), "blood": (_g_drop, "#e01a2a", "#b0101a"), "speech": (_g_lips, "#c77dff", "#8e5cff"),
              "straw_doll": (_g_nail, "#ff9a3a", "#ff8c2b"), "boogie": (_g_clap, "#ffd84d", "#ffb347"), "ratio": (_g_ratio, "#fff2c2", "#d8c88a"),
              "construction": (_g_cube, "#9fd8ff", "#6fa8e0")}


def jjk_icons() -> None:
    for group, prefix in ((ABILITY_ICONS, "a_"), (CLAN_ICONS, "clan_"), (TECH_ICONS, "tech_")):
        for name, (fn, col, ring_c) in group.items():
            img, d = _icon_base(hexc(ring_c))
            fn(d, hexc(col))
            _save_icon(img, prefix + name)


# Item textures (32 px, drawn at 128 and reduced) ---------------------------------------------
ITEMS_DIR = os.path.join(RP, "textures", "items")


def _item(name: str, draw) -> None:
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw(ImageDraw.Draw(img))
    img.convert("RGBa").resize((32, 32), Image.LANCZOS).convert("RGBA").save(os.path.join(ITEMS_DIR, f"{name}.png"))


def _outline_line(d, pts, col, w):
    d.line(pts, fill=hexc("#120c1c"), width=w + 8)
    d.line(pts, fill=col, width=w)


def jjk_items() -> None:
    os.makedirs(ITEMS_DIR, exist_ok=True)

    def grimoire(d):
        d.rounded_rectangle([18, 12, 108, 116], radius=8, fill=hexc("#1a1424"), outline=hexc("#05030a"), width=4)
        d.rectangle([24, 14, 34, 114], fill=hexc("#7a1020"))
        d.rectangle([100, 18, 106, 110], fill=hexc("#efe6d2"))
        d.ellipse([46, 36, 92, 82], outline=hexc("#e2453c"), width=6)
        d.line([(69, 40), (69, 78)], fill=hexc("#e2453c"), width=5)
        d.line([(50, 59), (88, 59)], fill=hexc("#e2453c"), width=5)
        d.rectangle([56, 88, 82, 108], fill=hexc("#efe6d2"))
        for y in (92, 98, 104):
            d.line([(59, y), (79, y)], fill=hexc("#7a1020"), width=2)

    def playful_cloud(d):
        for i, (a, b) in enumerate((((14, 108), (44, 78)), ((50, 72), (80, 42)), ((86, 36), (116, 8)))):
            _outline_line(d, [a, b], hexc("#c4122f"), 14)
            d.line([(a[0] + 4, a[1] - 4), (b[0] + 2, b[1] + 2)], fill=hexc("#ff5a6a"), width=3)
        for (x, y) in ((47, 75), (83, 39)):
            d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=hexc("#c9ccd6"), outline=hexc("#120c1c"), width=2)

    def inverted_spear(d):
        _outline_line(d, [(18, 110), (66, 62)], hexc("#3a2a20"), 10)
        d.polygon([(62, 52), (76, 66), (110, 18), (118, 10), (108, 22)], fill=hexc("#dfe3f0"), outline=hexc("#120c1c"))
        d.polygon([(62, 52), (50, 40), (40, 30), (54, 44)], fill=hexc("#dfe3f0"), outline=hexc("#120c1c"))
        d.ellipse([12, 104, 26, 118], outline=hexc("#c9ccd6"), width=3)

    def katana(d):
        _outline_line(d, [(16, 112), (40, 88)], hexc("#1a1424"), 12)
        d.rounded_rectangle([34, 80, 50, 96], radius=4, fill=hexc("#e2c26a"), outline=hexc("#120c1c"), width=2)
        d.line([(46, 82), (100, 30), (116, 10)], fill=hexc("#120c1c"), width=14)
        d.line([(46, 82), (100, 30), (116, 10)], fill=hexc("#e8ecf2"), width=8)
        d.line([(50, 76), (102, 26)], fill=hexc("#ffffff"), width=2)

    def dragon_bone(d):
        d.polygon([(30, 100), (44, 112), (114, 30), (104, 14), (92, 26)], fill=hexc("#ebe3cf"), outline=hexc("#120c1c"))
        d.line([(44, 106), (108, 30)], fill=hexc("#6fa8e0"), width=4)
        _outline_line(d, [(14, 118), (34, 98)], hexc("#3a2a20"), 10)

    def slaughter_demon(d):
        _outline_line(d, [(30, 104), (54, 80)], hexc("#7a1020"), 12)
        d.polygon([(52, 78), (62, 88), (104, 40), (96, 32)], fill=hexc("#dfe3f0"), outline=hexc("#120c1c"))

    def jacket(col, trim):
        def f(d):
            d.polygon([(30, 30), (54, 20), (74, 20), (98, 30), (110, 70), (94, 74), (92, 112), (36, 112), (34, 74), (18, 70)], fill=col, outline=hexc("#05030a"))
            d.rectangle([58, 20, 70, 34], fill=shade(col, 1.25))
            for y in (46, 64, 82, 100):
                d.ellipse([60, y - 5, 68, y + 3], fill=trim)
        return f

    def pants(d):
        col = hexc("#1c2233")
        d.polygon([(34, 14), (94, 14), (100, 116), (72, 116), (64, 52), (56, 116), (28, 116)], fill=col, outline=hexc("#05030a"))
        d.rectangle([34, 14, 94, 24], fill=shade(col, 1.3))

    def blindfold(d):
        d.rounded_rectangle([10, 48, 118, 76], radius=12, fill=hexc("#111018"), outline=hexc("#2a2836"), width=3)
        d.line([(20, 58), (108, 58)], fill=hexc("#2a2836"), width=3)

    def syrup(d):
        d.rounded_rectangle([40, 40, 88, 116], radius=12, fill=hexc("#c77dff"), outline=hexc("#120c1c"), width=4)
        d.rectangle([50, 22, 78, 42], fill=hexc("#efe6d2"), outline=hexc("#120c1c"), width=3)
        d.rectangle([46, 66, 82, 92], fill=hexc("#ffffff"))
        d.line([(52, 79), (76, 79)], fill=hexc("#ff4a7a"), width=4)

    def finger(d):
        d.rectangle([20, 16, 108, 112], fill=hexc("#efe6d2"))
        for y in range(26, 106, 14):
            d.line([(30, y), (98, y)], fill=hexc("#c4122f"), width=3)
        d.rounded_rectangle([46, 22, 82, 106], radius=16, fill=hexc("#5a2a2a"), outline=hexc("#120c1c"), width=4)
        d.rounded_rectangle([52, 22, 76, 40], radius=8, fill=hexc("#120c1c"))
        for y in (58, 78):
            d.line([(48, y), (80, y)], fill=hexc("#3a1818"), width=3)

    def fragment(d):
        d.polygon([(64, 10), (96, 48), (80, 118), (44, 104), (34, 46)], fill=hexc("#6b2fa0"), outline=hexc("#120c1c"))
        d.polygon([(64, 10), (74, 50), (58, 96), (44, 46)], fill=hexc("#b48cff"))

    for name, fn in (("shadow_summoner", grimoire), ("sb_playful_cloud", playful_cloud), ("sb_inverted_spear", inverted_spear),
                     ("sb_split_soul_katana", katana), ("sb_dragon_bone", dragon_bone), ("sb_slaughter_demon", slaughter_demon),
                     ("sb_uniform_tokyo_chest", jacket(hexc("#1c2233"), hexc("#e2c26a"))), ("sb_uniform_tokyo_legs", pants),
                     ("sb_uniform_kyoto_chest", jacket(hexc("#4a5068"), hexc("#d8d8e0"))), ("sb_gojo_blindfold", blindfold),
                     ("sb_throat_syrup", syrup), ("sb_sukuna_finger", finger), ("sb_cursed_fragment", fragment)):
        _item(name, fn)


# Armor layers (64x32 armor UV layout, painted at 2x = 128x64) -------------------------------
ARMOR_DIR = os.path.join(RP, "textures", "models", "armor")


def _armor_canvas() -> tuple:
    img = Image.new("RGBA", (128, 64), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def _R(d, x0, y0, x1, y1, col):
    d.rectangle([x0 * 2, y0 * 2, x1 * 2 - 1, y1 * 2 - 1], fill=col)


def _fabric(img: Image.Image, seed: int) -> None:
    rnd = random.Random(seed)
    px = img.load()
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            r, g, b, a = px[x, y]
            if a:
                k = rnd.choice((0.94, 1.0, 1.0, 1.05))
                px[x, y] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a)


def armor_jacket(path: str, col: Color, trim: Color) -> None:
    img, d = _armor_canvas()
    # body: top (20,16)-(28,20), bottom (28,16)-(36,20), sides/front/back at y 20..32
    _R(d, 20, 16, 36, 20, shade(col, 1.1))
    _R(d, 16, 20, 40, 32, col)
    _R(d, 20, 20, 28, 22, shade(col, 1.25))                     # high collar
    for y in (23, 26, 29):                                     # swirl buttons down the front
        d.ellipse([47, y * 2, 50, y * 2 + 3], fill=trim)
    _R(d, 20, 31, 28, 32, shade(col, 0.8))
    # arms (right arm region; the left arm mirrors it)
    _R(d, 44, 16, 52, 20, shade(col, 1.1))
    _R(d, 40, 20, 56, 32, col)
    _R(d, 40, 30, 56, 32, shade(col, 0.75))                     # cuffs
    _fabric(img, 11)
    img.save(path)


def armor_pants(path: str, col: Color) -> None:
    img, d = _armor_canvas()
    _R(d, 16, 20, 40, 32, col)                                 # waist (leggings use the body box)
    _R(d, 16, 20, 40, 22, shade(col, 1.3))                     # belt
    _R(d, 4, 16, 12, 20, shade(col, 1.1))
    _R(d, 0, 20, 16, 32, col)                                  # legs
    _R(d, 0, 30, 16, 32, shade(col, 0.8))
    _fabric(img, 12)
    img.save(path)


def armor_blindfold(path: str) -> None:
    img, d = _armor_canvas()
    band = hexc("#111018")
    _R(d, 0, 11, 32, 14, band)                                 # around the head at eye height
    d.line([(16, 24), (31, 24)], fill=hexc("#2a2836"), width=1)
    img.save(path)


def jjk_armor() -> None:
    os.makedirs(ARMOR_DIR, exist_ok=True)
    armor_jacket(os.path.join(ARMOR_DIR, "jjk_tokyo_1.png"), hexc("#1c2233"), hexc("#e2c26a"))
    armor_pants(os.path.join(ARMOR_DIR, "jjk_tokyo_2.png"), hexc("#1c2233"))
    armor_jacket(os.path.join(ARMOR_DIR, "jjk_kyoto_1.png"), hexc("#4a5068"), hexc("#d8d8e0"))
    armor_blindfold(os.path.join(ARMOR_DIR, "jjk_blindfold_1.png"))


def jjk_art_all() -> None:
    jjk_icons()
    jjk_items()
    jjk_armor()


def jjk_assets() -> None:
    """Items, armor textures and icons of the Jujutsu Kaisen content (filled in jjk_art section)."""
    jjk_art_all()


def main() -> None:
    os.makedirs(os.path.join(RP, "models", "entity"), exist_ok=True)
    os.makedirs(os.path.join(RP, "textures", "entity", "shadowbound"), exist_ok=True)
    os.makedirs(os.path.join(RP, "textures", "items"), exist_ok=True)
    os.makedirs(os.path.join(RP, "textures", "particle"), exist_ok=True)
    os.makedirs(DOCS, exist_ok=True)

    beast_previews = []
    portraits = {}
    for sp, builder in BEAST_BUILDERS:
        geo, tex, bscale = build_beast(sp, builder)
        with open(os.path.join(RP, "models", "entity", f"shadowbound_beast_{sp}.geo.json"), "w") as f:
            json.dump(geo, f, indent=1)
        tex.save(os.path.join(RP, "textures", "entity", "shadowbound", f"beast_{sp}.png"))
        pv = render_side(geo, tex, px_per_unit=4, scale=bscale, canvas=(80, 64))
        portraits[sp] = beast_portrait(geo, tex, bscale, sp)
        portrait_icon(portraits[sp], f"sk_{sp}", PALS[sp].rune)
        pv.save(os.path.join(DOCS, f"beast_{sp}.png"))
        beast_previews.append(pv)
    sheet = Image.new("RGBA", (4 * 320, 4 * 256), hexc("#1a1426"))
    for i, pv in enumerate(beast_previews):
        sheet.alpha_composite(pv, ((i % 4) * 320, (i // 4) * 256))
    sheet.save(os.path.join(DOCS, "beasts_sheet.png"))

    glyph_icons()
    jjk_assets()
    particle_sprite(os.path.join(RP, "textures", "particle", "shadowbound_sparkle.png"))
    wisp_sprite(os.path.join(RP, "textures", "particle", "shadowbound_wisp.png"))
    key = [portraits[k] for k in ("dog_white", "colossus", "wolf") if k in portraits]
    pack_icon(os.path.join(RP, "pack_icon.png"), key)
    pack_icon(os.path.join(BP, "pack_icon.png"), key)
    print("art generated")


if __name__ == "__main__":
    main()
