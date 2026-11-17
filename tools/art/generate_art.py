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


def build_model(persona: str, bones: list) -> tuple:
    atlas = Atlas(TEX_W * SCALE, TEX_H * SCALE)
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
                "texture_width": TEX_W,
                "texture_height": TEX_H,
                "visible_bounds_width": 3,
                "visible_bounds_height": 3.5,
                "visible_bounds_offset": [0, 1.5, 0],
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
def render_front(geo: dict, tex: Image.Image, px_per_unit: int = 10, hidden: tuple = ()) -> Image.Image:
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
    W, H = 30 * px_per_unit, 44 * px_per_unit
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for _, ox, oy, sx, sy, u, v, uw, vh in quads:
        if uw <= 0 or vh <= 0:
            continue
        crop = tex.crop((int(u * SCALE), int(v * SCALE), int(round((u + uw) * SCALE)), int(round((v + vh) * SCALE))))
        tw = max(1, int(round(sx * px_per_unit)))
        th = max(1, int(round(sy * px_per_unit)))
        crop = crop.resize((tw, th), Image.NEAREST)
        sxp = int(round((15 - (ox + sx)) * px_per_unit))
        syp = int(round((42 - (oy + sy)) * px_per_unit))
        img.alpha_composite(crop, (sxp, syp))
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
        crop = crop.resize((int(crop.size[0] * 0.62), int(crop.size[1] * 0.62)), Image.LANCZOS)
        x = 8 + i * 118
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
    for persona, builder in (("luna", persona_luna), ("raven", persona_raven)):
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
