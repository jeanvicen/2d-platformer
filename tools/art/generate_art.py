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

from PIL import Image, ImageDraw, ImageFilter

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
        band = max(1, h // 6)
        d.rectangle([0, h - band, w, h], fill=shade(c, bottom_dark))
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
        # dark inner line along the strand tips for depth
        for xx in range(w):
            for yy in range(h - 1, -1, -1):
                if px[xx, yy][3] != 0:
                    r, g, b, a = shade(c, 0.6)
                    px[xx, yy] = (r, g, b, a)
                    if yy - 1 >= 0 and px[xx, yy - 1][3] != 0:
                        px[xx, yy - 1] = shade(c, 0.78)
                    break
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
    return p


# --------------------------------------------------------------------------------------
# Anime face pieces
# --------------------------------------------------------------------------------------
@dataclass
class FaceStyle:
    skin: Color
    iris_dark: Color
    iris_light: Color
    lash: Color = hexc("#1b1020")
    blush: Color = hexc("#ff8fa8", 170)
    mouth: Color = hexc("#7a2a3a")
    tongue: Color = hexc("#ff7f8f")
    sharp: bool = False   # sharper, cooler eye shape (Raven)


def draw_eye(d: ImageDraw.ImageDraw, x0: int, y0: int, w: int, h: int, st: FaceStyle, right: bool,
             iris_alpha: int = 255) -> None:
    """One big anime eye in the box (x0,y0,w,h)."""
    # sclera
    d.rounded_rectangle([x0 + 1, y0 + 2, x0 + w - 2, y0 + h - 1], radius=3, fill=hexc("#ffffff"))
    # iris (gradient, dark top -> light bottom)
    ix0, ix1 = x0 + 2, x0 + w - 3
    iy0, iy1 = y0 + 2, y0 + h - 1
    for yy in range(iy0, iy1 + 1):
        t = (yy - iy0) / max(1, iy1 - iy0)
        col = mix(st.iris_dark, st.iris_light, t ** 1.2)
        col = (col[0], col[1], col[2], iris_alpha)
        # ellipse row extent
        cy = (iy0 + iy1) / 2
        ry = (iy1 - iy0) / 2 + 0.5
        rx = (ix1 - ix0) / 2 + 0.5
        dy = (yy - cy) / ry
        if abs(dy) > 1:
            continue
        half = rx * math.sqrt(max(0.0, 1 - dy * dy))
        cx = (ix0 + ix1) / 2
        d.line([int(round(cx - half)), yy, int(round(cx + half)), yy], fill=col)
    # pupil
    cx = (ix0 + ix1) / 2
    cy = (iy0 + iy1) / 2 + 1
    pd = shade(st.iris_dark, 0.45)
    d.ellipse([cx - 1.6, cy - 2.6, cx + 1.6, cy + 2.6], fill=(pd[0], pd[1], pd[2], iris_alpha))
    # iris ring sparkle (lower arc)
    d.arc([ix0, iy0 + 2, ix1, iy1], start=30, end=150, fill=shade(st.iris_light, 1.3), width=1)
    # highlights
    hx = ix0 + (1 if not right else 2)
    d.rectangle([hx, iy0 + 1, hx + 2, iy0 + 3], fill=hexc("#ffffff"))
    d.rectangle([ix1 - 2, iy1 - 3, ix1 - 1, iy1 - 2], fill=hexc("#ffffff"))
    # upper lash
    if st.sharp:
        d.line([x0, y0 + 2, x0 + w - 1, y0 + 1], fill=st.lash, width=2)
        d.line([x0 + 1, y0 + 1, x0 + w - 2, y0], fill=st.lash, width=1)
        if right:
            d.line([x0 + w - 2, y0 + 1, x0 + w + 1, y0 - 2], fill=st.lash, width=2)
        else:
            d.line([x0 + 1, y0 + 1, x0 - 2, y0 - 2], fill=st.lash, width=2)
    else:
        # soft, rounded lash arc (cute) with a tiny outer lash
        d.arc([x0 - 1, y0, x0 + w, y0 + h + 4], start=195, end=345, fill=st.lash, width=2)
        if right:
            d.line([x0 + w - 1, y0 + 3, x0 + w + 1, y0 + 2], fill=st.lash, width=1)
        else:
            d.line([x0, y0 + 3, x0 - 2, y0 + 2], fill=st.lash, width=1)
    # lower lash hint
    d.line([x0 + 2, y0 + h, x0 + w - 3, y0 + h], fill=shade(st.lash, 1.6), width=1)


def eyes_region(st: FaceStyle, w: int, h: int, iris_alpha: int = 255) -> Image.Image:
    """Both eyes on a skin background, sized w x h px (opaque)."""
    img = Image.new("RGBA", (w, h), st.skin)
    d = ImageDraw.Draw(img)
    ew = int(w * 0.36)
    eh = h - 4
    gap = w - 2 * ew
    left_x = int(gap * 0.28)
    right_x = w - left_x - ew
    draw_eye(d, left_x, 2, ew, eh, st, right=False, iris_alpha=iris_alpha)
    draw_eye(d, right_x, 2, ew, eh, st, right=True, iris_alpha=iris_alpha)
    return img


def head_front(st: FaceStyle) -> Painter:
    """Head north face: skin, cheeks shading, eyes painted in (overlays may cover them)."""
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=st.skin)
        # eyes band mirrors the 'eyes' overlay layout
        ex0, ey0, ew, eh = EYES_BOX_PX
        img.alpha_composite(eyes_region(st, ew, eh), (ex0, ey0))
        # tiny nose shadow
        d.point([w // 2, int(h * 0.80)], fill=shade(st.skin, 0.85))
        # chin shade
        d.line([int(w * 0.3), h - 1, int(w * 0.7), h - 1], fill=shade(st.skin, 0.9))
    return p


# Eye box inside the 36x36 px head front face (head is 9 units, SCALE 4).
EYES_BOX_PX = (4, 15, 28, 14)  # x, y, w, h


def eyes_overlay(st: FaceStyle) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        img.alpha_composite(eyes_region(st, w, h, iris_alpha=110), (0, 0))
    return p


def lids_overlay(st: FaceStyle) -> Painter:
    """Closed eyes (blink): skin + soft curved lash lines."""
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        ew = int(w * 0.36)
        gap = w - 2 * ew
        lx = int(gap * 0.28)
        rx = w - lx - ew
        for x0 in (lx, rx):
            d.rectangle([x0, 0, x0 + ew, h - 1], fill=st.skin)
            d.arc([x0, h // 2 - 3, x0 + ew - 1, h // 2 + 5], start=200, end=340, fill=st.lash, width=2)
    return p


def happy_eyes_overlay(st: FaceStyle) -> Painter:
    """^ ^ eyes."""
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        ew = int(w * 0.36)
        gap = w - 2 * ew
        lx = int(gap * 0.28)
        rx = w - lx - ew
        for x0 in (lx, rx):
            d.rectangle([x0, 0, x0 + ew, h - 1], fill=st.skin)
            mid = x0 + ew // 2
            d.line([x0 + 1, h // 2 + 3, mid, h // 2 - 3], fill=st.lash, width=2)
            d.line([mid, h // 2 - 3, x0 + ew - 2, h // 2 + 3], fill=st.lash, width=2)
    return p


def brows_overlay(st: FaceStyle) -> Painter:
    """Determined / combat brows."""
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        ew = int(w * 0.36)
        gap = w - 2 * ew
        lx = int(gap * 0.28)
        rx = w - lx - ew
        d.line([lx, 1, lx + ew - 1, h - 2], fill=st.lash, width=2)
        d.line([rx, h - 2, rx + ew - 1, 1], fill=st.lash, width=2)
    return p


def mouth_overlay(st: FaceStyle, kind: str) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        cx = w // 2
        if kind == "smile":     # soft cat-like smile  'w'
            d.line([cx - 4, h // 2 - 1, cx - 2, h // 2 + 1], fill=st.mouth, width=1)
            d.line([cx - 2, h // 2 + 1, cx, h // 2], fill=st.mouth, width=1)
            d.line([cx, h // 2, cx + 2, h // 2 + 1], fill=st.mouth, width=1)
            d.line([cx + 2, h // 2 + 1, cx + 4, h // 2 - 1], fill=st.mouth, width=1)
        elif kind == "open":    # happy open mouth
            d.chord([cx - 3, 0, cx + 3, h - 1], start=0, end=180, fill=st.mouth)
            d.chord([cx - 2, h // 2, cx + 2, h - 1], start=0, end=180, fill=st.tongue)
        elif kind == "flat":    # focused
            d.line([cx - 3, h // 2, cx + 3, h // 2], fill=st.mouth, width=1)
    return p


def blush_overlay(st: FaceStyle) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        for x0 in (1, w - 8):
            d.ellipse([x0, 0, x0 + 6, h - 1], fill=st.blush)
            for i in range(3):
                d.line([x0 + 1 + i * 2, h - 2, x0 + 2 + i * 2, 1], fill=shade(st.blush, 0.85))
    return p


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


def build_model(persona: str, bones: list, tex: int = TEX_W, scale: int = SCALE, bounds: tuple = (3, 3.5)) -> tuple:
    SCALE = scale  # noqa: N806 (local override for this model)
    atlas = Atlas(tex * scale, tex * scale)
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
        region = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
        c.paint(region, f)
        atlas.img.alpha_composite(region, (x, y))
        # extend 1px gutter to avoid seams when sampling
        u = x / SCALE
        v = y / SCALE
        c.uv[f] = {"uv": [round(u, 4), round(v, 4)], "uv_size": [round(fw, 4), round(fh, 4)]}
        if f == "down":
            # Bedrock samples 'down' with flipped V; flip so it reads the same as painted.
            c.uv[f] = {"uv": [round(u, 4), round(v + fh, 4)], "uv_size": [round(fw, 4), round(-fh, 4)]}

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
# Personas
# --------------------------------------------------------------------------------------
def common_body(bones: list, st: FaceStyle, hair_c: Color, top: Painter, arm: Painter, hand: Painter,
                leg: Painter, boot: Painter) -> dict:
    """Shared humanoid skeleton with anime proportions. Returns bones by name."""
    by = {}

    def add(b: Bone) -> Bone:
        bones.append(b)
        by[b.name] = b
        return b

    add(Bone("root", (0, 0, 0)))
    add(Bone("waist", (0, 11, 0), "root"))
    body = add(Bone("body", (0, 15.5, 0), "waist"))
    body.cubes.append(Cube((-3.5, 11, -2), (7, 9, 4), top))

    head = add(Bone("head", (0, 20, 0), "body"))
    head.cubes.append(Cube((-4.5, 20, -4.5), (9, 9, 9), only(("north",), head_front(st), skin(st.skin))))

    # Face overlays (planes slightly in front of the face).
    ex, ey, ew, eh = EYES_BOX_PX
    # convert px box inside the 36x36 face into model units
    fx0 = 4.5 - (ex + ew) / SCALE      # model x of the box's right edge (screen left)
    fy1 = 29 - ey / SCALE              # top of box
    fw = ew / SCALE
    fh = eh / SCALE
    eye_origin = (fx0, fy1 - fh, -4.52)
    add(Bone("glow_eyes", (0, fy1, -4.5), "head")).cubes.append(
        Cube(eye_origin, (fw, fh, 0), eyes_overlay(st), faces=("north",)))
    add(Bone("lids", (0, fy1, -4.5), "head")).cubes.append(
        Cube((fx0, fy1 - fh, -4.55), (fw, fh, 0), lids_overlay(st), faces=("north",)))
    add(Bone("eyes_happy", (0, fy1, -4.5), "head")).cubes.append(
        Cube((fx0, fy1 - fh, -4.56), (fw, fh, 0), happy_eyes_overlay(st), faces=("north",)))
    add(Bone("brows", (0, fy1 + 0.6, -4.5), "head")).cubes.append(
        Cube((fx0, fy1 - 0.2, -4.57), (fw, 0.9, 0), brows_overlay(st), faces=("north",)))
    add(Bone("blush", (0, 21.9, -4.5), "head")).cubes.append(
        Cube((-3.6, 21.2, -4.53), (7.2, 1.0, 0), blush_overlay(st), faces=("north",)))
    for kind in ("smile", "open", "flat"):
        add(Bone(f"mouth_{kind}", (0, 20.9, -4.5), "head")).cubes.append(
            Cube((-1.25, 20.5, -4.54), (2.5, 1.0, 0), mouth_overlay(st, kind), faces=("north",)))

    # hair shell around the head (no front, no bottom)
    head.cubes.append(Cube((-4.5, 19.6, -4.5), (9, 9.6, 9), hair(hair_c, seed=11),
                           faces=("up", "east", "west", "south"), inflate=0.3))

    ra = add(Bone("rightArm", (-4.75, 19.5, 0), "body"))
    ra.cubes.append(Cube((-6, 12, -1.25), (2.5, 8, 2.5), arm))
    ra.cubes.append(Cube((-6, 10, -1.25), (2.5, 2, 2.5), hand))
    add(Bone("rightItem", (-4.75, 11, 0.5), "rightArm"))
    la = add(Bone("leftArm", (4.75, 19.5, 0), "body"))
    la.cubes.append(Cube((3.5, 12, -1.25), (2.5, 8, 2.5), arm))
    la.cubes.append(Cube((3.5, 10, -1.25), (2.5, 2, 2.5), hand))
    add(Bone("leftItem", (4.75, 11, 0.5), "leftArm"))

    rl = add(Bone("rightLeg", (-1.75, 11, 0), "root"))
    rl.cubes.append(Cube((-3.3, 4, -1.5), (3.1, 7, 3), leg))
    rl.cubes.append(Cube((-3.3, 0, -1.5), (3.1, 4, 3), boot, inflate=0.2))
    ll = add(Bone("leftLeg", (1.75, 11, 0), "root"))
    ll.cubes.append(Cube((0.2, 4, -1.5), (3.1, 7, 3), leg))
    ll.cubes.append(Cube((0.2, 0, -1.5), (3.1, 4, 3), boot, inflate=0.2))
    return by


def persona_luna() -> list:
    """Luna: cute little witch. Lilac hair, violet eyes, black witch dress, striped stockings, broom."""
    st = FaceStyle(skin=hexc("#ffe6d8"), iris_dark=hexc("#5a2bb0"), iris_light=hexc("#d7a8ff"))
    hair_c = hexc("#c6a4ff")
    dress = hexc("#2a1f3d")
    trim = hexc("#8e5cff")
    gold = hexc("#ffd36b")

    def top(img: Image.Image, face: str) -> None:
        flat(dress)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face == "north":
            # white sailor-ish collar + purple bow + buttons
            d.polygon([(0, 0), (w, 0), (w // 2, 9)], fill=hexc("#f4efff"))
            d.line([(0, 0), (w // 2, 9), (w, 0)], fill=trim, width=1)
            d.polygon([(w // 2 - 6, 7), (w // 2, 10), (w // 2 - 6, 13)], fill=trim)
            d.polygon([(w // 2 + 6, 7), (w // 2, 10), (w // 2 + 6, 13)], fill=trim)
            d.rectangle([w // 2 - 1, 9, w // 2 + 1, 11], fill=shade(trim, 0.7))
            for y in range(16, h - 4, 5):
                d.ellipse([w // 2 - 1, y, w // 2 + 1, y + 2], fill=gold)
            d.rectangle([0, h - 5, w, h - 3], fill=trim)  # waist ribbon
        elif face == "south":
            d.polygon([(0, 0), (w, 0), (w, 7), (0, 7)], fill=hexc("#f4efff"))
            d.line([(0, 7), (w, 7)], fill=trim)
            d.rectangle([0, h - 5, w, h - 3], fill=trim)
            # big bow at the back
            d.polygon([(w // 2, h - 4), (w // 2 - 7, h - 9), (w // 2 - 7, h + 1)], fill=trim)
            d.polygon([(w // 2, h - 4), (w // 2 + 7, h - 9), (w // 2 + 7, h + 1)], fill=trim)
        elif face in ("east", "west"):
            d.rectangle([0, 0, w, 3], fill=hexc("#f4efff"))
            d.rectangle([0, h - 5, w, h - 3], fill=trim)

    arm = compose(flat(dress), lambda img, f: ImageDraw.Draw(img).rectangle([0, 0, img.size[0], 3], fill=shade(dress, 1.15)) if f not in ("up", "down") else None)
    hand = skin(st.skin)
    leg = stripes(hexc("#1c1428"), hexc("#a67cff"), 6)
    boot = boots(hexc("#5b3a2a"), hexc("#2b1a12"), laces=gold)

    bones: list = []
    by = common_body(bones, st, hair_c, top, arm, hand, leg, boot)

    # Wide witch sleeves at the wrists
    sleeve = compose(flat(dress), lambda img, f: ImageDraw.Draw(img).rectangle([0, img.size[1] - 3, img.size[0], img.size[1]], fill=trim) if f not in ("up", "down") else None)
    by["rightArm"].cubes.append(Cube((-6.5, 11.5, -1.75), (3.5, 3, 3.5), sleeve))
    by["leftArm"].cubes.append(Cube((3, 11.5, -1.75), (3.5, 3, 3.5), sleeve))

    # Skirt (two tiers + frill)
    skirt = Bone("skirt", (0, 12, 0), "waist")
    bones.append(skirt)

    def skirt_paint(img: Image.Image, face: str) -> None:
        flat(dress, 1.1, 0.7)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face not in ("up", "down"):
            for x in range(3, w, 6):
                d.line([x, 2, x - 1, h], fill=shade(dress, 0.78))   # pleats
            d.rectangle([0, h - 3, w, h], fill=trim)
            for x in range(0, w, 6):
                star(d, x + 3, h - 7, 1.6, gold) if (x // 6) % 3 == 1 else None
    skirt.cubes.append(Cube((-4.0, 9.0, -2.5), (8.0, 3.0, 5.0), skirt_paint))
    skirt.cubes.append(Cube((-4.6, 7.2, -3.1), (9.2, 2.3, 6.2), skirt_paint))

    def frill(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=hexc("#f4efff"))
        for x in range(0, w, 4):
            d.pieslice([x - 1, h - 4, x + 4, h + 2], 180, 360, fill=hexc("#d9ccff"))
    skirt.cubes.append(Cube((-4.8, 6.6, -3.3), (9.6, 0.7, 6.6), frill, faces=("north", "south", "east", "west")))

    # Hair: bangs, side locks, long fluffy back hair, ahoge
    head_n = "head"
    bangs = Bone("bangs", (0, 28, -4.5), head_n)
    bones.append(bangs)
    bangs.cubes.append(Cube((-4.8, 24.6, -4.95), (9.6, 4.6, 0.45), jagged_bangs(hair_c, seed=21),
                            faces=("north", "up", "east", "west")))
    for sx in (-1, 1):
        side = Bone("lock_r" if sx < 0 else "lock_l", (sx * 4.6, 27, -2.5), head_n)
        bones.append(side)
        x0 = -5.4 if sx < 0 else 4.4
        side.cubes.append(Cube((x0, 14.5, -4.2), (1.0, 13, 3.0), hair(hair_c, seed=31 + sx)))
    back = Bone("hair_back", (0, 28.5, 4.6), head_n)
    bones.append(back)
    back.cubes.append(Cube((-4.9, 11.5, 4.4), (9.8, 17.5, 1.4), hair(hair_c, seed=41)))
    back.cubes.append(Cube((-4.2, 10.0, 4.6), (8.4, 2.0, 1.0), hair(shade(hair_c, 0.9), seed=42)))
    ahoge = Bone("ahoge", (0.5, 29, -1), head_n, rotation=(-20, 0, 15))
    bones.append(ahoge)
    ahoge.cubes.append(Cube((0.5, 29, -1), (0, 3, 2), hair(hair_c, seed=5), faces=("east", "west")))

    # Witch hat with floppy tip
    hat_c = hexc("#1f1630")
    hat = Bone("hat", (0, 29, 0), head_n, rotation=(-6, 0, 4))
    bones.append(hat)

    def brim(img: Image.Image, face: str) -> None:
        flat(hat_c, 1.25, 0.8)(img, face)
        if face == "up":
            w, h = img.size
            ImageDraw.Draw(img).ellipse([4, 4, w - 5, h - 5], outline=shade(hat_c, 1.3))
    hat.cubes.append(Cube((-7.5, 28.6, -7.5), (15, 0.7, 15), brim))

    def hat_cone(img: Image.Image, face: str) -> None:
        flat(hat_c, 1.25, 0.85)(img, face)
    hat.cubes.append(Cube((-4.3, 29.3, -4.3), (8.6, 2.8, 8.6), hat_cone))

    def band(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=trim)
        d.line([0, 0, w, 0], fill=shade(trim, 1.3))
        if face == "north":
            # golden crescent buckle + star
            moon(d, w // 2 - 2, h // 2, 2.6, gold, trim)
            star(d, w // 2 + 4, h // 2, 2.0, gold)
    hat.cubes.append(Cube((-4.45, 29.3, -4.45), (8.9, 1.2, 8.9), band, faces=("north", "south", "east", "west")))
    hat.cubes.append(Cube((-3.2, 32.0, -2.8), (6.4, 2.6, 6.4), hat_cone))
    tip = Bone("hat_tip", (0, 34.4, 0.4), "hat", rotation=(-28, 0, 12))
    bones.append(tip)
    tip.cubes.append(Cube((-2.1, 34.4, -1.4), (4.2, 2.6, 4.2), hat_cone))
    tip.cubes.append(Cube((-1.1, 36.8, -0.4), (2.2, 2.2, 2.2), hat_cone))

    def tip_star(img: Image.Image, face: str) -> None:
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, img.size[0], img.size[1]], fill=(0, 0, 0, 0))
        star(d, img.size[0] / 2, img.size[1] / 2, img.size[0] / 2 - 0.5, gold)
    tip.cubes.append(Cube((-0.9, 38.9, 0.6), (1.8, 1.8, 0), tip_star, faces=("north", "south")))

    # Broom on the back
    broom = Bone("broom", (0, 15.5, 2.6), "body", rotation=(0, 0, 38))
    bones.append(broom)
    wood = hexc("#8a5a35")
    broom.cubes.append(Cube((-0.5, 8.5, 2.3), (1, 17, 1), flat(wood, 1.2, 0.7)))

    def bristles(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=hexc("#e8c46a"))
        for x in range(0, w, 2):
            d.line([x, 0, x + (1 if x % 4 else -1), h], fill=hexc("#c49a3e"))
        d.rectangle([0, 0, w, 3], fill=trim)
    broom.cubes.append(Cube((-1.7, 4.5, 1.8), (3.4, 4.6, 2.0), bristles))
    return bones


def persona_raven() -> list:
    """Raven: confident shadow blade-dancer. Silver hair ponytail, crimson eyes, black/red outfit, scarf."""
    st = FaceStyle(skin=hexc("#f6dccb"), iris_dark=hexc("#7d0a1e"), iris_light=hexc("#ff6a7c"),
                   lash=hexc("#140c14"), sharp=True, blush=hexc("#ff8f9c", 140))
    hair_c = hexc("#e9e7f3")
    suit = hexc("#16131c")
    red = hexc("#c4122f")
    metal = hexc("#4a4656")

    def top(img: Image.Image, face: str) -> None:
        flat(suit, 1.15, 0.75)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face == "north":
            # high collar jacket, red cross straps, silver clasp
            d.line([(2, 2), (w - 3, h - 6)], fill=red, width=2)
            d.line([(w - 3, 2), (2, h - 6)], fill=red, width=2)
            d.ellipse([w // 2 - 2, h // 2 - 4, w // 2 + 2, h // 2], fill=hexc("#d8d8e8"))
            d.rectangle([0, h - 5, w, h - 2], fill=hexc("#2a2430"))  # belt
            d.rectangle([w // 2 - 2, h - 5, w // 2 + 2, h - 2], fill=hexc("#c9c9d9"))
        elif face == "south":
            d.line([(2, 2), (w - 3, h - 6)], fill=red, width=2)
            d.line([(w - 3, 2), (2, h - 6)], fill=red, width=2)
            d.rectangle([0, h - 5, w, h - 2], fill=hexc("#2a2430"))
        elif face in ("east", "west"):
            d.rectangle([0, h - 5, w, h - 2], fill=hexc("#2a2430"))

    def arm(img: Image.Image, face: str) -> None:
        flat(suit, 1.15, 0.75)(img, face)
        if face not in ("up", "down"):
            w, h = img.size
            ImageDraw.Draw(img).rectangle([0, h - 3, w, h - 1], fill=red)

    def hand(img: Image.Image, face: str) -> None:   # fingerless gloves
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=hexc("#221d28"))
        if face not in ("up", "down"):
            d.rectangle([0, h - 3, w, h], fill=st.skin)

    leg = flat(hexc("#2b2533"), 1.1, 0.8)
    boot = boots(hexc("#0f0d12"), hexc("#000000"), laces=red)

    bones: list = []
    by = common_body(bones, st, hair_c, top, arm, hand, leg, boot)
    # thigh-high boots: taller boot cube over the leg
    for name, x0 in (("rightLeg", -3.3), ("leftLeg", 0.2)):
        by[name].cubes.append(Cube((x0, 4, -1.5), (3.1, 3.5, 3), boots(hexc("#0f0d12"), hexc("#0f0d12"), None), inflate=0.15,
                                   faces=("north", "south", "east", "west")))

    # Coat tails (back) + belt pouch
    tails = Bone("coat_tail", (0, 11.5, 2.0), "waist")
    bones.append(tails)

    def tail_paint(img: Image.Image, face: str) -> None:
        flat(suit, 1.1, 0.7)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face in ("north", "south"):
            d.polygon([(w // 2 - 2, h), (w // 2 + 2, h), (w // 2, h - 8)], fill=(0, 0, 0, 0))  # split
            d.rectangle([0, h - 2, w, h], fill=red)
    tails.cubes.append(Cube((-3.8, 4.0, 2.0), (7.6, 7.5, 0.5), tail_paint))
    shorts = Bone("skirt", (0, 12, 0), "waist")
    bones.append(shorts)
    shorts.cubes.append(Cube((-3.6, 9.0, -1.8), (7.2, 2.4, 3.6), flat(hexc("#1e1a24"), 1.1, 0.8)))

    # Shoulder guard (left)
    pauld = Bone("pauldron", (4.75, 19.5, 0), "leftArm")
    bones.append(pauld)

    def plate(img: Image.Image, face: str) -> None:
        flat(metal, 1.3, 0.7)(img, face)
        w, h = img.size
        if face not in ("down",):
            ImageDraw.Draw(img).rectangle([0, h - 2, w, h], fill=red)
    pauld.cubes.append(Cube((3.2, 18.2, -1.75), (3.6, 2.2, 3.5), plate))

    # Scarf + flowing tail
    scarf_c = red

    def scarf_paint(img: Image.Image, face: str) -> None:
        flat(scarf_c, 1.2, 0.7)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        for y in range(2, h, 4):
            d.line([0, y, w, y], fill=shade(scarf_c, 0.8))
    scarf = Bone("scarf", (0, 19.5, 0), "body")
    bones.append(scarf)
    scarf.cubes.append(Cube((-3.9, 18.4, -2.4), (7.8, 1.8, 4.8), scarf_paint))
    st_tail = Bone("scarf_tail", (1.8, 19.2, 2.4), "scarf")
    bones.append(st_tail)
    st_tail.cubes.append(Cube((0.8, 9.5, 2.4), (2.0, 9.7, 0.4), scarf_paint))

    # Hair: side-swept bangs, short sides, high ponytail with red ribbon
    bangs = Bone("bangs", (0, 28, -4.5), "head")
    bones.append(bangs)
    bangs.cubes.append(Cube((-4.8, 24.9, -4.95), (9.6, 4.3, 0.45), jagged_bangs(hair_c, seed=77, sweep=0.6),
                            faces=("north", "up", "east", "west")))
    for sx in (-1, 1):
        side = Bone("lock_r" if sx < 0 else "lock_l", (sx * 4.6, 27, -2.5), "head")
        bones.append(side)
        x0 = -5.3 if sx < 0 else 4.4
        side.cubes.append(Cube((x0, 18.0, -4.3), (0.9, 9.5, 2.6), hair(hair_c, seed=81 + sx)))
    pony = Bone("ponytail", (0, 27.6, 4.8), "head", rotation=(18, 0, 0))
    bones.append(pony)

    def ribbon(img: Image.Image, face: str) -> None:
        flat(red, 1.3, 0.7)(img, face)
    pony.cubes.append(Cube((-1.1, 26.6, 4.6), (2.2, 2.0, 1.4), ribbon))
    pony.cubes.append(Cube((-1.9, 19.0, 5.0), (3.8, 8.0, 2.4), hair(hair_c, seed=91)))
    pony.cubes.append(Cube((-1.3, 14.0, 5.4), (2.6, 5.2, 1.8), hair(hair_c, seed=92)))
    # Crescent hairpin
    pin = Bone("hairpin", (3.5, 27, -3), "head")
    bones.append(pin)

    def pin_paint(img: Image.Image, face: str) -> None:
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, img.size[0], img.size[1]], fill=(0, 0, 0, 0))
        moon(d, img.size[0] / 2, img.size[1] / 2, img.size[0] / 2 - 0.5, hexc("#ffd36b"), (0, 0, 0, 0))
    pin.cubes.append(Cube((2.4, 26.3, -5.0), (2.0, 2.0, 0), pin_paint, faces=("north",)))

    # Twin daggers crossed on the lower back
    for i, rz in enumerate((35, -35)):
        dg = Bone(f"dagger_{i}", (0, 11.5, 2.6), "waist", rotation=(0, 0, rz))
        bones.append(dg)
        dg.cubes.append(Cube((-0.4, 8.0, 2.55), (0.8, 2.2, 0.6), flat(hexc("#3a2a20"), 1.2, 0.7)))   # grip
        dg.cubes.append(Cube((-0.8, 10.1, 2.5), (1.6, 0.5, 0.7), flat(hexc("#c9c9d9"), 1.2, 0.7)))   # guard
        dg.cubes.append(Cube((-0.35, 10.6, 2.6), (0.7, 4.2, 0.4), flat(hexc("#dfe3f0"), 1.3, 0.8)))  # blade
    return bones


def long_skirt(base: Color, accent: Color, slit: bool) -> Painter:
    """Ankle-length dress skirt with pleats; optional discreet side slit (shows black tights, not skin)."""
    def p(img: Image.Image, face: str) -> None:
        flat(base, 1.1, 0.7)(img, face)
        if face in ("up", "down"):
            return
        w, h = img.size
        d = ImageDraw.Draw(img)
        for x in range(4, w, 7):
            d.line([x, 1, x - 1, h], fill=shade(base, 0.8))
        d.rectangle([0, h - 2, w, h], fill=accent)
        if slit and face == "north":
            x0 = int(w * 0.68)
            top = int(h * 0.45)
            d.polygon([(x0, top), (x0 + 3, h), (x0 - 3, h)], fill=hexc("#1a1a1a"))
            d.line([(x0, top), (x0 + 3, h)], fill=accent)
            d.line([(x0, top), (x0 - 3, h)], fill=accent)
    return p


def persona_sora() -> list:
    """Sora: confident esper. Fluffy curly green hair, green eyes, long black dress, floats a little."""
    st = FaceStyle(skin=hexc("#ffe9dd"), iris_dark=hexc("#11734a"), iris_light=hexc("#8dffbf"), sharp=True,
                   blush=hexc("#ff97a8", 150))
    hair_c = hexc("#33c47a")
    dress = hexc("#151515")
    trim = hexc("#1f7a4c")

    def top(img: Image.Image, face: str) -> None:
        flat(dress, 1.15, 0.75)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face in ("north", "south", "east", "west"):
            d.rectangle([0, 0, w, 3], fill=trim)          # high collar
        if face == "north":
            d.polygon([(w // 2 - 3, 3), (w // 2 + 3, 3), (w // 2, 8)], fill=trim)
            for y in range(11, h - 3, 6):
                d.line([w // 2, y, w // 2, y + 3], fill=shade(dress, 1.6))
            d.rectangle([0, h - 4, w, h - 3], fill=trim)  # waist line

    def cuff(img: Image.Image, face: str) -> None:
        flat(dress, 1.15, 0.75)(img, face)
        if face not in ("up", "down"):
            w, h = img.size
            ImageDraw.Draw(img).rectangle([0, h - 2, w, h], fill=trim)

    bones: list = [Bone("levitate", (0, 0, 0))]
    by = common_body(bones, st, hair_c, top, flat(dress, 1.15, 0.75), skin(st.skin), flat(hexc("#1a1a1a"), 1.1, 0.8),
                     boots(hexc("#0b0b0b"), hexc("#000000"), None))
    by["root"].parent = "levitate"
    by["rightArm"].cubes.append(Cube((-6.6, 10, -1.85), (3.7, 3.2, 3.7), cuff))
    by["leftArm"].cubes.append(Cube((2.9, 10, -1.85), (3.7, 3.2, 3.7), cuff))
    sk = Bone("skirt", (0, 12, 0), "waist")
    bones.append(sk)
    sk.cubes.append(Cube((-3.9, 7.0, -2.4), (7.8, 5.0, 4.8), long_skirt(dress, trim, False)))
    sk.cubes.append(Cube((-4.4, 1.6, -2.9), (8.8, 5.6, 5.8), long_skirt(dress, trim, True)))
    # hair: big curly volume
    bangs = Bone("bangs", (0, 28, -4.5), "head")
    bones.append(bangs)
    bangs.cubes.append(Cube((-4.9, 24.6, -4.95), (9.8, 4.7, 0.45), jagged_bangs(hair_c, seed=55, sweep=-0.3),
                            faces=("north", "up", "east", "west")))
    puff = Bone("hair_top", (0, 28, 0), "head")
    bones.append(puff)
    puff.cubes.append(Cube((-5.3, 27.6, -4.7), (10.6, 2.8, 9.8), hair(hair_c, seed=56)))
    for sx in (-1, 1):
        lk = Bone("lock_r" if sx < 0 else "lock_l", (sx * 4.8, 27, -2.0), "head")
        bones.append(lk)
        x0 = -6.2 if sx < 0 else 4.6
        lk.cubes.append(Cube((x0, 18.6, -4.0), (1.6, 8.6, 5.0), hair(hair_c, seed=60 + sx)))
        cx = -7.3 if sx < 0 else 5.8
        lk.cubes.append(Cube((cx, 18.0, -3.2), (1.5, 1.8, 3.6), hair(shade(hair_c, 0.9), seed=62 + sx)))  # outward curl
    back = Bone("hair_back", (0, 28.5, 4.6), "head")
    bones.append(back)
    back.cubes.append(Cube((-5.4, 16.0, 3.8), (10.8, 13.0, 2.2), hair(hair_c, seed=64)))
    back.cubes.append(Cube((-6.0, 16.6, 3.4), (12.0, 1.8, 2.8), hair(shade(hair_c, 0.88), seed=65)))  # curled ends
    return bones


def persona_yuki() -> list:
    """Yuki: elegant older-sister type. Dark bob hair, green eyes, long green dress, white fur stole."""
    st = FaceStyle(skin=hexc("#fde3d6"), iris_dark=hexc("#1d6b45"), iris_light=hexc("#a6efc6"))
    hair_c = hexc("#25332c")
    dress = hexc("#1f5a3c")
    fur = hexc("#f2f2ef")

    def top(img: Image.Image, face: str) -> None:
        flat(dress, 1.15, 0.75)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face == "north":
            for x in range(3, w - 2, 3):
                d.ellipse([x, 4, x + 1, 5], fill=hexc("#ffffff"))  # pearl necklace
            d.rectangle([0, h - 4, w, h - 3], fill=shade(dress, 0.7))

    def fur_paint(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=fur)
        rnd = random.Random(len(face) * 7 + w)
        for _ in range(w * h // 6):
            x, y = rnd.randrange(w), rnd.randrange(h)
            d.point([x, y], fill=shade(fur, rnd.choice((0.85, 0.9, 1.0))))
        if face not in ("up", "down"):
            d.line([0, h - 1, w, h - 1], fill=shade(fur, 0.8))

    bones: list = []
    by = common_body(bones, st, hair_c, top, flat(dress, 1.15, 0.75), skin(st.skin), flat(hexc("#1a1a1a"), 1.1, 0.8),
                     boots(hexc("#101010"), hexc("#000000"), None))
    sk = Bone("skirt", (0, 12, 0), "waist")
    bones.append(sk)
    sk.cubes.append(Cube((-3.9, 7.0, -2.4), (7.8, 5.0, 4.8), long_skirt(dress, shade(dress, 0.7), False)))
    sk.cubes.append(Cube((-4.4, 1.6, -2.9), (8.8, 5.6, 5.8), long_skirt(dress, shade(dress, 0.7), False)))
    coat = Bone("coat", (0, 19.5, 0), "body")
    bones.append(coat)
    coat.cubes.append(Cube((-5.4, 17.4, -2.9), (10.8, 2.8, 5.8), fur_paint))           # fur stole
    coat.cubes.append(Cube((-4.8, 9.0, 2.2), (9.6, 8.6, 0.8), fur_paint))              # back of the coat
    cape = Bone("coat_tail", (0, 11.5, 2.0), "waist")
    bones.append(cape)
    cape.cubes.append(Cube((-4.6, 5.0, 2.6), (9.2, 4.2, 0.6), fur_paint))
    # hair: straight bob with outward flare
    bangs = Bone("bangs", (0, 28, -4.5), "head")
    bones.append(bangs)
    bangs.cubes.append(Cube((-4.8, 25.2, -4.95), (9.6, 4.0, 0.45), jagged_bangs(hair_c, seed=88),
                            faces=("north", "up", "east", "west")))
    for sx in (-1, 1):
        lk = Bone("lock_r" if sx < 0 else "lock_l", (sx * 4.6, 27, -2.5), "head")
        bones.append(lk)
        x0 = -5.6 if sx < 0 else 4.4
        lk.cubes.append(Cube((x0, 19.4, -4.3), (1.2, 8.0, 4.2), hair(hair_c, seed=90 + sx)))
        fx = -6.7 if sx < 0 else 5.2
        lk.cubes.append(Cube((fx, 19.0, -3.6), (1.5, 1.4, 3.4), hair(hair_c, seed=93 + sx)))
    back = Bone("hair_back", (0, 28.5, 4.6), "head")
    bones.append(back)
    back.cubes.append(Cube((-5.0, 19.0, 3.8), (10.0, 9.6, 1.4), hair(hair_c, seed=95)))
    return bones



# --------------------------------------------------------------------------------------
# New companions: Hana (farmer) and Aiko (builder)
# --------------------------------------------------------------------------------------
def persona_hana() -> list:
    """Hana: cheerful farmer. Brown twin braids, amber eyes, straw hat, green overall dress, basket."""
    st = FaceStyle(skin=hexc("#fbe0cf"), iris_dark=hexc("#8a4b12"), iris_light=hexc("#ffc46b"))
    hair_c = hexc("#7a4a2a")
    green = hexc("#3f7d4a")
    blouse = hexc("#f6f1e6")
    straw = hexc("#e8c46a")

    def top(img: Image.Image, face: str) -> None:
        flat(blouse, 1.05, 0.85)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face in ("north", "south"):
            d.rectangle([4, int(h * 0.35), w - 5, h], fill=green)          # overall bib
            d.rectangle([4, 0, 7, int(h * 0.35)], fill=green)               # straps
            d.rectangle([w - 8, 0, w - 5, int(h * 0.35)], fill=green)
            if face == "north":
                d.rectangle([w // 2 - 4, int(h * 0.5), w // 2 + 4, int(h * 0.7)], fill=shade(green, 0.8))  # pocket
                for x in (5, w - 7):
                    d.ellipse([x, int(h * 0.33), x + 2, int(h * 0.33) + 2], fill=hexc("#ffd36b"))
        elif face in ("east", "west"):
            d.rectangle([0, int(h * 0.35), w, h], fill=green)

    def arm(img: Image.Image, face: str) -> None:
        flat(blouse, 1.05, 0.85)(img, face)
        if face not in ("up", "down"):
            w, h = img.size
            ImageDraw.Draw(img).rectangle([0, h - 3, w, h - 1], fill=hexc("#e2d6c2"))   # rolled sleeves

    bones: list = []
    by = common_body(bones, st, hair_c, top, arm, skin(st.skin), skin(st.skin), boots(hexc("#6b4428"), hexc("#3b2416"), None))
    sk = Bone("skirt", (0, 12, 0), "waist")
    bones.append(sk)
    sk.cubes.append(Cube((-4.0, 7.0, -2.5), (8.0, 5.0, 5.0), long_skirt(green, shade(green, 0.7), False)))
    bangs = Bone("bangs", (0, 28, -4.5), "head")
    bones.append(bangs)
    bangs.cubes.append(Cube((-4.8, 25.0, -4.95), (9.6, 4.2, 0.45), jagged_bangs(hair_c, seed=101), faces=("north", "up", "east", "west")))
    for sx in (-1, 1):
        br = Bone("lock_r" if sx < 0 else "lock_l", (sx * 4.2, 24, 0), "head")
        bones.append(br)
        x0 = -5.6 if sx < 0 else 3.6
        br.cubes.append(Cube((x0, 13.0, -1.0), (2.0, 11.0, 2.0), hair(hair_c, seed=110 + sx)))        # braid
        br.cubes.append(Cube((x0 + 0.2, 12.2, -0.8), (1.6, 1.0, 1.6), flat(hexc("#d94b4b"), 1.2, 0.8)))  # ribbon
    back = Bone("hair_back", (0, 28.5, 4.6), "head")
    bones.append(back)
    back.cubes.append(Cube((-4.8, 19.5, 3.9), (9.6, 9.0, 1.2), hair(hair_c, seed=112)))
    hat = Bone("hat", (0, 29, 0), "head", rotation=(-4, 0, -3))
    bones.append(hat)

    def straw_paint(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=straw)
        for x in range(0, w, 3):
            d.line([x, 0, x, h], fill=shade(straw, 0.85))
        for y in range(0, h, 3):
            d.line([0, y, w, y], fill=shade(straw, 0.9))
    hat.cubes.append(Cube((-8.0, 28.6, -8.0), (16, 0.6, 16), straw_paint))
    hat.cubes.append(Cube((-4.4, 29.2, -4.4), (8.8, 3.0, 8.8), straw_paint))
    hat.cubes.append(Cube((-4.5, 29.2, -4.5), (9.0, 1.0, 9.0), flat(hexc("#d94b4b"), 1.2, 0.8), faces=("north", "south", "east", "west")))
    basket = Bone("broom", (0, 15.5, 2.6), "body")
    bones.append(basket)

    def wicker(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=hexc("#a8743c"))
        for y in range(0, h, 3):
            d.line([0, y, w, y], fill=hexc("#7d5226"))
        for x in range(0, w, 4):
            d.line([x, 0, x, h], fill=hexc("#c99256"))
    basket.cubes.append(Cube((-3.0, 12.0, 2.1), (6.0, 6.0, 3.0), wicker))
    basket.cubes.append(Cube((-2.6, 17.6, 2.6), (1.0, 1.4, 2.0), flat(hexc("#ff6b6b"), 1.2, 0.8)))   # apples
    basket.cubes.append(Cube((1.0, 17.6, 2.6), (1.2, 1.2, 1.8), flat(hexc("#ffb347"), 1.2, 0.8)))
    return bones


def persona_aiko() -> list:
    """Aiko: energetic builder. Short orange hair, goggles, navy-orange work jacket, tool belt, hammer."""
    st = FaceStyle(skin=hexc("#fde1d0"), iris_dark=hexc("#1d4f8a"), iris_light=hexc("#8cc8ff"))
    hair_c = hexc("#f08a3c")
    navy = hexc("#243453")
    orange = hexc("#ff8c2b")
    yellow = hexc("#ffd84d")

    def top(img: Image.Image, face: str) -> None:
        flat(navy, 1.15, 0.8)(img, face)
        w, h = img.size
        d = ImageDraw.Draw(img)
        if face in ("north", "south", "east", "west"):
            d.rectangle([0, int(h * 0.45), w, int(h * 0.45) + 2], fill=yellow)   # reflective stripe
        if face == "north":
            d.line([w // 2, 0, w // 2, h], fill=shade(navy, 0.7))
            d.rectangle([0, 0, w, 2], fill=orange)
            d.rectangle([0, h - 5, w, h - 2], fill=hexc("#6b4a2a"))                # tool belt
            d.rectangle([3, h - 6, 6, h - 1], fill=hexc("#9e9e9e"))                # wrench
        elif face == "south":
            d.rectangle([0, h - 5, w, h - 2], fill=hexc("#6b4a2a"))

    def arm(img: Image.Image, face: str) -> None:
        flat(orange, 1.1, 0.8)(img, face)
        if face not in ("up", "down"):
            w, h = img.size
            ImageDraw.Draw(img).rectangle([0, int(h * 0.5), w, int(h * 0.5) + 1], fill=yellow)

    def gloves(img: Image.Image, face: str) -> None:
        flat(hexc("#c79b52"), 1.1, 0.8)(img, face)

    bones: list = []
    by = common_body(bones, st, hair_c, top, arm, gloves, flat(navy, 1.1, 0.8), boots(hexc("#4a3524"), hexc("#20160e"), yellow))
    shorts = Bone("skirt", (0, 12, 0), "waist")
    bones.append(shorts)
    shorts.cubes.append(Cube((-3.7, 8.6, -1.9), (7.4, 2.8, 3.8), flat(hexc("#1b2740"), 1.1, 0.8)))
    bangs = Bone("bangs", (0, 28, -4.5), "head")
    bones.append(bangs)
    bangs.cubes.append(Cube((-4.8, 25.2, -4.95), (9.6, 4.0, 0.45), jagged_bangs(hair_c, seed=121, sweep=0.4), faces=("north", "up", "east", "west")))
    for sx in (-1, 1):
        lk = Bone("lock_r" if sx < 0 else "lock_l", (sx * 4.6, 27, -2.5), "head")
        bones.append(lk)
        x0 = -5.4 if sx < 0 else 4.4
        lk.cubes.append(Cube((x0, 20.5, -4.0), (1.0, 7.0, 3.0), hair(hair_c, seed=123 + sx)))
    back = Bone("hair_back", (0, 28.5, 4.6), "head")
    bones.append(back)
    back.cubes.append(Cube((-4.9, 21.0, 3.9), (9.8, 8.0, 1.2), hair(hair_c, seed=126)))
    gog = Bone("hairpin", (0, 28, 0), "head")
    bones.append(gog)
    gog.cubes.append(Cube((-4.9, 27.2, -4.9), (9.8, 1.0, 9.8), flat(hexc("#3a3a3a"), 1.2, 0.8), faces=("north", "south", "east", "west")))

    def lens(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=hexc("#7a5a2a"))
        d.ellipse([1, 1, w - 2, h - 2], fill=hexc("#7fd6ff"))
        d.point([2, 2], fill=hexc("#ffffff"))
    gog.cubes.append(Cube((-3.6, 27.0, -5.3), (3.0, 1.6, 0.5), lens, faces=("north",)))
    gog.cubes.append(Cube((0.6, 27.0, -5.3), (3.0, 1.6, 0.5), lens, faces=("north",)))
    ham = Bone("broom", (0, 15.5, 2.6), "body", rotation=(0, 0, -30))
    bones.append(ham)
    ham.cubes.append(Cube((-0.5, 7.0, 2.3), (1.0, 11.0, 1.0), flat(hexc("#8a5a35"), 1.2, 0.7)))
    ham.cubes.append(Cube((-2.2, 17.0, 1.8), (4.4, 2.4, 2.0), flat(hexc("#9aa0a8"), 1.3, 0.7)))
    return bones


# --------------------------------------------------------------------------------------
# Shadow beasts
# --------------------------------------------------------------------------------------
SHADOW = hexc("#211a30")
SHADOW_LIGHT = hexc("#352a52")
RUNE = hexc("#8a5cff")


def shadow_fur(base: Color = SHADOW, rune: Color = RUNE, seed: int = 1, stripes: Optional[Color] = None) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=base)
        rnd = random.Random(seed * 31 + len(face) * 7 + w)
        # soft fur strokes instead of noise
        for _ in range(w * h // 14):
            x, y = rnd.randrange(w), rnd.randrange(h)
            d.line([x, y, x, min(h - 1, y + 2)], fill=shade(base, rnd.choice((0.82, 1.12, 1.18))))
        d.line([0, 0, w, 0], fill=shade(base, 1.2))
        if face == "up":
            d.rectangle([0, 0, w, h], outline=SHADOW_LIGHT)
        if face == "down":
            d.rectangle([0, 0, w, h], fill=shade(base, 0.7))
            return
        if stripes is not None and face in ("east", "west", "up"):
            for x in range(2, w, 6):
                d.line([x, 0, x + rnd.randint(-2, 2), int(h * 0.7)], fill=stripes, width=2)
        if face in ("east", "west") and w > 8 and h > 6:
            y = int(h * 0.55)
            pts = [(int(w * 0.15), y)]
            for i in range(1, 5):
                pts.append((int(w * (0.15 + 0.17 * i)), y + rnd.choice((-2, 0, 2))))
            d.line(pts, fill=rune, width=1)
    return p


def beast_eyes(color: Color, eye_w: float = 0.2, y: float = 0.38, gap: float = 0.24) -> Painter:
    """Head front: shadow fur + two glowing eyes."""
    base = shadow_fur(seed=7)

    def p(img: Image.Image, face: str) -> None:
        base(img, face)
        if face != "north":
            return
        w, h = img.size
        d = ImageDraw.Draw(img)
        ew = max(2, int(w * eye_w))
        eh = max(2, int(ew * 0.6))
        cy = int(h * y)
        for cx in (int(w * (0.5 - gap)), int(w * (0.5 + gap))):
            d.ellipse([cx - ew // 2 - 1, cy - eh // 2 - 1, cx + ew // 2 + 1, cy + eh // 2 + 1], fill=shade(color, 0.5))
            d.ellipse([cx - ew // 2, cy - eh // 2, cx + ew // 2, cy + eh // 2], fill=color)
            d.point([cx - 1, cy - 1], fill=hexc("#ffffff"))
    return p


def glow_plane(color: Color) -> Painter:
    def p(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=(color[0], color[1], color[2], 120))
    p.is_glow = True  # type: ignore[attr-defined]
    return p


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


def ivory() -> Painter:
    return flat(hexc("#e9e2d0"), 1.15, 0.8)


def quad(bones: list, L: float, W: float, H: float, legH: float, legW: float, head: float, eye: Color,
         snout: tuple = (0, 0, 0), tail: float = 0, tail_w: float = 2, stripes: Optional[Color] = None, neck: float = 0) -> dict:
    """Generic four-legged shadow animal facing north (-z). Returns bones by name."""
    by = {}

    def add(b: Bone) -> Bone:
        bones.append(b)
        by[b.name] = b
        return b
    add(Bone("root", (0, 0, 0)))
    body = add(Bone("body", (0, legH + H / 2, 0), "root"))
    body.cubes.append(Cube((-W / 2, legH, -L / 2), (W, H, L), shadow_fur(seed=2, stripes=stripes)))
    hy = legH + H * 0.45 + neck
    hz = -L / 2 - head * 0.6
    hd = add(Bone("head", (0, legH + H * 0.7, -L / 2 + 1), "body"))
    if neck:
        hd.cubes.append(Cube((-W * 0.22, legH + H * 0.5, -L / 2 - 2), (W * 0.44, neck + 2, 4), shadow_fur(seed=3, stripes=stripes)))
    hd.cubes.append(Cube((-head / 2, hy, hz - head / 2), (head, head * 0.85, head), only(("north",), beast_eyes(eye), shadow_fur(seed=4))))
    if snout[0]:
        sw, sh, sl = snout
        hd.cubes.append(Cube((-sw / 2, hy, hz - head / 2 - sl), (sw, sh, sl), shadow_fur(seed=5)))
    # glowing eye overlay (emissive material in the render controller)
    hd.cubes.append(Cube((-head * 0.35, hy + head * 0.85 * 0.5, hz - head / 2 - 0.05), (head * 0.7, head * 0.2, 0), glow_plane(eye), faces=("north",)))
    by["head"].name = "head"
    lx = W / 2 - legW / 2 - 0.2
    lz = L / 2 - legW / 2 - 0.4
    for name, x, z in (("leg_fl", -lx, -lz), ("leg_fr", lx, -lz), ("leg_bl", -lx, lz), ("leg_br", lx, lz)):
        lg = add(Bone(name, (x, legH, z), "root"))
        lg.cubes.append(Cube((x - legW / 2, 0, z - legW / 2), (legW, legH + 0.5, legW), shadow_fur(seed=6, stripes=stripes)))
    if tail:
        tl = add(Bone("tail", (0, legH + H * 0.8, L / 2), "body", rotation=(-35, 0, 0)))
        tl.cubes.append(Cube((-tail_w / 2, legH + H * 0.8 - tail_w / 2, L / 2), (tail_w, tail_w, tail), shadow_fur(seed=8, stripes=stripes)))
    return by


def beast_wolf() -> list:
    b: list = []
    by = quad(b, 14, 7, 7, 8, 2.6, 7, hexc("#e8dcff"), snout=(3.4, 3, 3.6), tail=9, tail_w=2.4)
    for sx in (-1, 1):
        by["head"].cubes.append(Cube((sx * 2.2 - 1, 8 + 7 * 0.45 + 7 * 0.85, -7 - 4.2 - 0.6), (2, 3, 1.2), shadow_fur(seed=9)))
    # neck ruff
    by["body"].cubes.append(Cube((-4.2, 9.5, -7.6), (8.4, 6.5, 4.0), shadow_fur(base=SHADOW_LIGHT, seed=10)))
    return b


def beast_tiger() -> list:
    b: list = []
    by = quad(b, 24, 10, 10, 10, 3.6, 9, hexc("#ffd36b"), snout=(5, 4, 3), tail=16, tail_w=2.4, stripes=hexc("#6b46c9"))
    for sx in (-1, 1):
        by["head"].cubes.append(Cube((sx * 3 - 1, 10 + 4.5 + 7.65, -12 - 5.4 - 0.5), (2, 2, 1), shadow_fur(seed=11)))
    return b


def beast_lion() -> list:
    b: list = []
    by = quad(b, 24, 10, 11, 10, 3.6, 9, hexc("#ffcf5a"), snout=(5, 4, 3), tail=15, tail_w=2)
    hy = 10 + 11 * 0.45
    by["head"].cubes.append(Cube((-8, hy - 3, -12 - 2), (16, 14, 6), shadow_fur(base=hexc("#2a1846"), seed=12)))     # mane
    by["tail"].cubes.append(Cube((-2, 10 + 11 * 0.8 - 2, 12 + 13), (4, 4, 4), shadow_fur(base=hexc("#2a1846"), seed=13)))
    return b


def beast_bull() -> list:
    b: list = []
    by = quad(b, 20, 12, 12, 9, 4, 9, hexc("#ff6b6b"), snout=(6, 5, 3), tail=10, tail_w=1.5)
    hy = 9 + 12 * 0.45 + 9 * 0.85 - 2
    for sx in (-1, 1):
        by["head"].cubes.append(Cube((sx * 4.5 - (2.5 if sx < 0 else 0), hy, -10 - 5.4 - 1), (2.5, 2, 2), ivory()))
        by["head"].cubes.append(Cube((sx * 6 - (1.5 if sx < 0 else 0) + (0 if sx < 0 else 0.5), hy + 1.5, -10 - 5.4 - 1), (1.5, 4, 1.5), ivory()))
    by["body"].cubes.append(Cube((-6.5, 9 + 6, -10 - 1), (13, 8, 8), shadow_fur(base=SHADOW_LIGHT, seed=14)))     # hump
    return b


def beast_deer() -> list:
    b: list = []
    by = quad(b, 16, 7, 8, 14, 2.2, 6, hexc("#9dffcf"), snout=(3, 3, 3), tail=3, tail_w=2, neck=8)
    hy = 14 + 8 * 0.45 + 8 + 6 * 0.85
    for sx in (-1, 1):
        x = sx * 1.6 - 0.5
        by["head"].cubes.append(Cube((x, hy, -8 - 3.6), (1, 6, 1), flat(hexc("#c8b8ff"), 1.3, 0.8)))
        by["head"].cubes.append(Cube((x + sx * 1.5 - (0 if sx > 0 else 0.5), hy + 4, -8 - 3.6), (2, 1, 1), flat(hexc("#c8b8ff"), 1.3, 0.8)))
        by["head"].cubes.append(Cube((x, hy + 3, -8 - 5), (1, 1, 2), flat(hexc("#c8b8ff"), 1.3, 0.8)))
    return b


def beast_rabbit() -> list:
    b: list = []
    by = quad(b, 7, 5, 5, 3, 1.6, 4.5, hexc("#ffe3f1"), snout=(2, 1.6, 1), tail=0)
    hy = 3 + 5 * 0.45 + 4.5 * 0.85
    for sx in (-1, 1):
        ear = Bone("ear_l" if sx > 0 else "ear_r", (sx * 1.2, hy, -3.5 - 2.7), "head", rotation=(-10, 0, sx * 10))
        b.append(ear)
        ear.cubes.append(Cube((sx * 1.2 - 0.6, hy, -3.5 - 3.2), (1.2, 6, 1.6), shadow_fur(seed=15)))
    by["body"].cubes.append(Cube((-1.2, 5.5, 3.5), (2.4, 2.4, 2), flat(hexc("#e8e0ff"), 1.2, 0.8)))
    return b


def beast_elephant() -> list:
    b: list = []
    by = quad(b, 30, 20, 18, 16, 6.5, 14, hexc("#bfe3ff"), tail=8, tail_w=1.6)
    hy = 16 + 18 * 0.45
    hz = -15 - 14 * 0.6
    for sx in (-1, 1):
        ear = Bone("ear_l" if sx > 0 else "ear_r", (sx * 7, hy + 8, hz), "head")
        b.append(ear)
        ear.cubes.append(Cube((sx * 7 - (13 if sx < 0 else 0), hy, hz - 1), (13, 13, 1.5), shadow_fur(base=SHADOW_LIGHT, seed=16)))
        by["head"].cubes.append(Cube((sx * 4 - (1.5 if sx < 0 else 0), hy - 3, hz - 7 - 4), (1.5, 1.5, 6), ivory()))     # tusks
    prev = "head"
    y = hy + 2
    for i, (w, h) in enumerate(((5, 5), (4, 5), (3.4, 5), (3, 4))):
        seg = Bone(f"trunk{i}", (0, y, hz - 7), prev)
        b.append(seg)
        seg.cubes.append(Cube((-w / 2, y - h, hz - 7 - w / 2), (w, h, w), shadow_fur(seed=17 + i)))
        prev = seg.name
        y -= h
    return b


def beast_toad() -> list:
    b: list = []
    b.append(Bone("root", (0, 0, 0)))
    body = Bone("body", (0, 6, 0), "root")
    b.append(body)
    body.cubes.append(Cube((-8, 2, -7), (16, 9, 14), shadow_fur(base=hexc("#1c1f24"), seed=18)))
    head = Bone("head", (0, 8, -7), "body")
    b.append(head)
    head.cubes.append(Cube((-7.5, 4, -12), (15, 7, 6), only(("north",), beast_eyes(hexc("#ffe066"), eye_w=0.12, y=0.25, gap=0.3), shadow_fur(seed=19))))
    head.cubes.append(Cube((-7, 3.6, -12.05), (14, 0.8, 0), flat(hexc("#ff7a9c"), 1.2, 0.8), faces=("north",)))    # mouth line
    for sx in (-1, 1):
        head.cubes.append(Cube((sx * 4.5 - 1.5, 11, -10), (3, 2.5, 3), only(("north",), beast_eyes(hexc("#ffe066"), eye_w=0.6, y=0.5, gap=0.0), shadow_fur(seed=20))))
    head.cubes.append(Cube((-3, 11.4, -9.6), (6, 0.6, 0), glow_plane(hexc("#ffe066")), faces=("north",)))
    for name, x, z, w, h in (("leg_fl", -6, -6, 3, 4), ("leg_fr", 6, -6, 3, 4), ("leg_bl", -8, 4, 5, 6), ("leg_br", 8, 4, 5, 6)):
        lg = Bone(name, (x, 4, z), "root")
        b.append(lg)
        lg.cubes.append(Cube((x - w / 2, 0, z - w / 2), (w, h, w + 2), shadow_fur(seed=21)))
    return b


def beast_owl() -> list:
    b: list = []
    b.append(Bone("levitate", (0, 0, 0)))
    b.append(Bone("root", (0, 0, 0), "levitate"))
    body = Bone("body", (0, 12, 0), "root")
    b.append(body)
    body.cubes.append(Cube((-6, 5, -5), (12, 14, 10), shadow_fur(base=hexc("#1d1730"), seed=22)))
    body.cubes.append(Cube((-4.5, 6, -5.05), (9, 10, 0), flat(hexc("#3a2d63"), 1.2, 0.8), faces=("north",)))        # chest
    head = Bone("head", (0, 19, 0), "body")
    b.append(head)
    head.cubes.append(Cube((-6.5, 19, -6), (13, 10, 11), only(("north",), beast_eyes(hexc("#ffd36b"), eye_w=0.24, y=0.45, gap=0.22), shadow_fur(seed=23))))
    head.cubes.append(Cube((-1, 21, -7.5), (2, 3, 1.5), flat(hexc("#c9a24a"), 1.2, 0.8)))                        # beak
    head.cubes.append(Cube((-4.2, 23.5, -6.05), (8.4, 1.6, 0), glow_plane(hexc("#ffd36b")), faces=("north",)))
    for sx in (-1, 1):
        head.cubes.append(Cube((sx * 4.5 - 1, 29, -3), (2, 3, 2), shadow_fur(seed=24)))                            # ear tufts
        wing = Bone("wing_l" if sx > 0 else "wing_r", (sx * 6, 18, 0), "body")
        b.append(wing)
        wing.cubes.append(Cube((sx * 6 - (1.5 if sx < 0 else 0), 6, -4), (1.5, 13, 9), shadow_fur(base=hexc("#251c3d"), seed=25)))
        leg = Bone("leg_fl" if sx < 0 else "leg_fr", (sx * 2.5, 5, 0), "root")
        b.append(leg)
        leg.cubes.append(Cube((sx * 2.5 - 1, 2, -1), (2, 3.5, 2), flat(hexc("#c9a24a"), 1.2, 0.8)))
    tail = Bone("tail", (0, 7, 5), "body", rotation=(30, 0, 0))
    b.append(tail)
    tail.cubes.append(Cube((-3, 2, 4), (6, 6, 1.5), shadow_fur(seed=26)))
    return b


def beast_serpent() -> list:
    b: list = []
    b.append(Bone("root", (0, 0, 0)))
    head = Bone("head", (0, 6, -6), "root", rotation=(-10, 0, 0))
    b.append(head)
    head.cubes.append(Cube((-5, 3, -16), (10, 6, 10), only(("north",), beast_eyes(hexc("#9dff7a"), eye_w=0.18, y=0.3, gap=0.28), shadow_fur(base=hexc("#14201a"), seed=27))))
    head.cubes.append(Cube((-4, 1, -15), (8, 2, 8), shadow_fur(base=hexc("#14201a"), seed=28)))                    # jaw
    for sx in (-1, 1):
        head.cubes.append(Cube((sx * 2.5 - 0.4, 0.2, -15.6), (0.8, 2, 0.8), ivory()))                              # fangs
    head.cubes.append(Cube((-3.5, 6.8, -16.05), (7, 1.2, 0), glow_plane(hexc("#9dff7a")), faces=("north",)))
    prev = "root"
    z = -6
    for i in range(7):
        w = 7 - i * 0.6
        seg = Bone(f"seg{i}", (0, 3, z), prev)
        b.append(seg)
        seg.cubes.append(Cube((-w / 2, 0, z), (w, w * 0.85, 7), shadow_fur(base=hexc("#14201a"), seed=29 + i, rune=hexc("#5cff9d"))))
        prev = seg.name
        z += 7
    b.append(Bone("body", (0, 3, 0), "root"))
    return b


def beast_dragon() -> list:
    b: list = []
    eye = hexc("#ff4d6d")
    by = quad(b, 26, 14, 12, 12, 4, 0.01, eye, tail=0)
    # replace the tiny head with neck + head chain
    by["head"].cubes.clear()
    neck = Bone("neck", (0, 20, -13), "body", rotation=(30, 0, 0))
    b.append(neck)
    neck.cubes.append(Cube((-3, 18, -21), (6, 6, 9), shadow_fur(base=hexc("#1a1022"), seed=31)))
    dh = Bone("dhead", (0, 21, -21), "neck", rotation=(-25, 0, 0))
    b.append(dh)
    dh.cubes.append(Cube((-4.5, 18, -32), (9, 7, 11), only(("north",), beast_eyes(eye, eye_w=0.16, y=0.3, gap=0.3), shadow_fur(base=hexc("#1a1022"), seed=32))))
    dh.cubes.append(Cube((-3.5, 15.5, -31), (7, 2.5, 9), shadow_fur(base=hexc("#1a1022"), seed=33)))                 # jaw
    dh.cubes.append(Cube((-3.2, 23.2, -32.05), (6.4, 1.2, 0), glow_plane(eye), faces=("north",)))
    for sx in (-1, 1):
        dh.cubes.append(Cube((sx * 3 - 0.75, 25, -25), (1.5, 5, 1.5), ivory()))                                    # horns
        wing = Bone("wing_l" if sx > 0 else "wing_r", (sx * 7, 23, -6), "body")
        b.append(wing)
        x0 = sx * 7 - (26 if sx < 0 else 0)
        wing.cubes.append(Cube((x0, 23, -8), (26, 1, 3), shadow_fur(base=hexc("#251536"), seed=34)))             # arm bone
        wing.cubes.append(Cube((x0 + (0 if sx > 0 else 1), 22.6, -5), (25, 0.6, 16), flat(hexc("#3a1f5c"), 1.2, 0.8)))  # membrane
    prev = "body"
    z = 13
    for i in range(4):
        w = 6 - i * 1.2
        seg = Bone(f"tail{i}" if i else "tail", (0, 16, z), prev)
        b.append(seg)
        seg.cubes.append(Cube((-w / 2, 16 - w / 2, z), (w, w, 8), shadow_fur(base=hexc("#1a1022"), seed=35 + i, rune=hexc("#ff6b9c"))))
        prev = seg.name
        z += 8
    for i in range(5):
        by["body"].cubes.append(Cube((-0.75, 24, -10 + i * 5), (1.5, 2.5, 2), ivory()))                             # spines
    return b


def beast_colossus() -> list:
    b: list = []
    b.append(Bone("root", (0, 0, 0)))
    body = Bone("body", (0, 34, 0), "root")
    b.append(body)
    body.cubes.append(Cube((-10, 22, -6), (20, 20, 12), shadow_fur(base=hexc("#120e1a"), seed=41)))

    def core(img: Image.Image, face: str) -> None:
        w, h = img.size
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, h], fill=(0, 0, 0, 0))
        d.ellipse([0, 0, w - 1, h - 1], fill=(111, 240, 255, 150))
        d.ellipse([w // 4, h // 4, 3 * w // 4, 3 * h // 4], fill=(230, 255, 255, 220))
    body.cubes.append(Cube((-2.5, 32, -6.1), (5, 5, 0), core, faces=("north",)))
    for i in range(4):
        body.cubes.append(Cube((-1, 42 - i * 4, 6), (2, 2.5, 4), ivory()))                                          # back spikes
    head = Bone("head", (0, 42, 0), "body")
    b.append(head)
    head.cubes.append(Cube((-5, 42, -5), (10, 10, 10), only(("north",), beast_eyes(hexc("#6ff0ff"), eye_w=0.18, y=0.45, gap=0.22), shadow_fur(seed=42))))
    head.cubes.append(Cube((-3.6, 46.4, -5.05), (7.2, 1.2, 0), glow_plane(hexc("#6ff0ff")), faces=("north",)))
    for sx in (-1, 1):
        head.cubes.append(Cube((sx * 4 - 1, 52, -1), (2, 4, 2), ivory()))                                          # crown spikes
        arm = Bone("arm_l" if sx > 0 else "arm_r", (sx * 12, 40, 0), "body")
        b.append(arm)
        arm.cubes.append(Cube((sx * 12 - 4, 16, -4), (8, 24, 8), shadow_fur(base=hexc("#120e1a"), seed=43)))
        arm.cubes.append(Cube((sx * 12 - 4.5, 13, -4.5), (9, 4, 9), shadow_fur(base=SHADOW_LIGHT, seed=44)))       # fists
        leg = Bone("leg_l" if sx > 0 else "leg_r", (sx * 5, 22, 0), "root")
        b.append(leg)
        leg.cubes.append(Cube((sx * 5 - 4, 0, -4), (8, 22, 8), shadow_fur(base=hexc("#120e1a"), seed=45)))
    return b


BEAST_BUILDERS = [
    ("wolf", beast_wolf), ("owl", beast_owl), ("serpent", beast_serpent), ("toad", beast_toad),
    ("elephant", beast_elephant), ("rabbit", beast_rabbit), ("deer", beast_deer), ("bull", beast_bull),
    ("tiger", beast_tiger), ("lion", beast_lion), ("dragon", beast_dragon), ("colossus", beast_colossus),
]

# --------------------------------------------------------------------------------------
# Small 2D assets
# --------------------------------------------------------------------------------------
def item_icon(path: str) -> None:
    """Shadow Summoner: a dark grimoire with a glowing crescent and star."""
    s = 32
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([5, 4, 26, 28], radius=3, fill=hexc("#2a1f3d"), outline=hexc("#120c1c"))
    d.rectangle([7, 5, 9, 27], fill=hexc("#8e5cff"))           # spine
    d.rectangle([24, 6, 26, 26], fill=hexc("#f4efff"))         # pages
    moon(d, 17, 14, 5, hexc("#ffd36b"), hexc("#2a1f3d"))
    star(d, 20, 22, 3, hexc("#d7a8ff"))
    for (x, y) in ((12, 8), (23, 10), (13, 24)):
        d.point([x, y], fill=hexc("#ffffff"))
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


def pack_icon(path: str, previews: list) -> None:
    s = 256
    img = Image.new("RGBA", (s, s), hexc("#140f1f"))
    d = ImageDraw.Draw(img)
    for y in range(s):
        d.line([0, y, s, y], fill=mix(hexc("#2a1747"), hexc("#0c0814"), y / s))
    moon(d, 200, 52, 30, hexc("#ffd36b"), mix(hexc("#2a1747"), hexc("#0c0814"), 52 / s))
    rnd = random.Random(7)
    for _ in range(40):
        x, y = rnd.randint(0, s), rnd.randint(0, s // 2)
        d.point([x, y], fill=(255, 255, 255, rnd.randint(80, 220)))
    for i, pv in enumerate(previews):
        crop = pv.crop((0, 0, pv.size[0], int(pv.size[1] * 0.62)))
        k = 0.62 if len(previews) <= 2 else 0.4
        crop = crop.resize((int(crop.size[0] * k), int(crop.size[1] * k)), Image.LANCZOS)
        x = 4 + i * (118 if len(previews) <= 2 else 62)
        img.alpha_composite(crop, (x, s - crop.size[1]))
    img.save(path)


def main() -> None:
    os.makedirs(os.path.join(RP, "models", "entity"), exist_ok=True)
    os.makedirs(os.path.join(RP, "textures", "entity", "shadowbound"), exist_ok=True)
    os.makedirs(os.path.join(RP, "textures", "items"), exist_ok=True)
    os.makedirs(os.path.join(RP, "textures", "particle"), exist_ok=True)
    os.makedirs(DOCS, exist_ok=True)

    previews = []
    hidden_faces = ("lids", "eyes_happy", "brows", "mouth_open", "mouth_flat", "blush")
    for persona, builder in (("luna", persona_luna), ("raven", persona_raven), ("sora", persona_sora), ("yuki", persona_yuki), ("hana", persona_hana), ("aiko", persona_aiko)):
        bones = builder()
        geo, tex = build_model(persona, bones)
        with open(os.path.join(RP, "models", "entity", f"shadowbound_{persona}.geo.json"), "w") as f:
            json.dump(geo, f, indent=1)
        tex.save(os.path.join(RP, "textures", "entity", "shadowbound", f"{persona}.png"))
        pv = render_front(geo, tex, hidden=hidden_faces)
        pv.save(os.path.join(DOCS, f"preview_{persona}.png"))
        previews.append(pv)
        # expression sheet: normal / happy / focused face close-ups
        sheet = Image.new("RGBA", (3 * 180, 180), hexc("#1a1426"))
        variants = [
            hidden_faces,
            ("lids", "brows", "mouth_smile", "mouth_flat", "glow_eyes"),
            ("lids", "eyes_happy", "mouth_smile", "mouth_open", "blush"),
        ]
        for i, hid in enumerate(variants):
            full = render_front(geo, tex, px_per_unit=20, hidden=hid)
            # head region crop
            box = (int((15 - 8) * 20), int((42 - 32) * 20), int((15 + 8) * 20), int((42 - 19) * 20))
            face = full.crop(box).resize((180, int(180 * (box[3] - box[1]) / (box[2] - box[0]))), Image.LANCZOS)
            sheet.alpha_composite(face, (i * 180, 0))
        sheet.save(os.path.join(DOCS, f"faces_{persona}.png"))

    beast_previews = []
    for sp, builder in BEAST_BUILDERS:
        bones = split_glow(builder())
        geo, tex = build_model(f"beast_{sp}", bones, tex=256, scale=2, bounds=(5, 5))
        with open(os.path.join(RP, "models", "entity", f"shadowbound_beast_{sp}.geo.json"), "w") as f:
            json.dump(geo, f, indent=1)
        tex.save(os.path.join(RP, "textures", "entity", "shadowbound", f"beast_{sp}.png"))
        pv = render_side(geo, tex, px_per_unit=4, scale=2, canvas=(80, 64))
        pv.save(os.path.join(DOCS, f"beast_{sp}.png"))
        beast_previews.append(pv)
    sheet = Image.new("RGBA", (4 * 320, 3 * 256), hexc("#1a1426"))
    for i, pv in enumerate(beast_previews):
        sheet.alpha_composite(pv, ((i % 4) * 320, (i // 4) * 256))
    sheet.save(os.path.join(DOCS, "beasts_sheet.png"))

    item_icon(os.path.join(RP, "textures", "items", "shadow_summoner.png"))
    particle_sprite(os.path.join(RP, "textures", "particle", "shadowbound_sparkle.png"))
    wisp_sprite(os.path.join(RP, "textures", "particle", "shadowbound_wisp.png"))
    pack_icon(os.path.join(RP, "pack_icon.png"), previews)
    pack_icon(os.path.join(BP, "pack_icon.png"), previews)

    # side-by-side preview for the README
    W = sum(p.size[0] for p in previews) + 40
    H = max(p.size[1] for p in previews) + 20
    card = Image.new("RGBA", (W, H), hexc("#1a1426"))
    x = 20
    for p in previews:
        card.alpha_composite(p, (x, 10))
        x += p.size[0]
    card.save(os.path.join(DOCS, "preview_duo.png"))
    print("art generated")


if __name__ == "__main__":
    main()
