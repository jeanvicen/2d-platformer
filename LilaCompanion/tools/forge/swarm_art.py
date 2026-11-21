"""Imagens do enxame Hacknd (ícone, página): a mesma matemática das partículas do jogo — cada
robozinho tem um "lar" num elipsoide, gira em volta do centro e faz zigue-zague (soma de senoides
≈ ruído de curl, como insetos) — desenhada em 2D com névoa, brilhos ciano e profundidade."""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def _bg(size, top=(12, 26, 44), bottom=(3, 6, 12)):
    y = np.linspace(0, 1, size)[:, None]
    x = np.linspace(-1, 1, size)[None, :]
    t = np.clip(y * 0.9 + (x ** 2) * 0.12, 0, 1)
    rgb = np.array(top)[None, None, :] * (1 - t[..., None]) + np.array(bottom)[None, None, :] * t[..., None]
    return Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")


def _cloud_points(n, rnd, t=0.0, scale=1.0):
    pts = []
    for _ in range(n):
        r1, r2, r3, r4 = rnd.random(), rnd.random(), rnd.random(), rnd.random()
        rad = (0.25 + math.sqrt(r3) * 1.35) * (1 + 0.14 * math.sin(math.radians(t * 95 + r1 * 360)))
        ang = math.radians(r1 * 360 + t * (35 + r4 * 70) * (1 if r2 > 0.5 else -1))
        yh = (r2 - 0.5) * 1.5 * (1 - r3 * 0.3)
        bx = math.sin(math.radians(t * 420 + r2 * 613)) * 0.16 + rnd.gauss(0, 0.05)
        by = math.sin(math.radians(t * 360 + r3 * 503)) * 0.12 + rnd.gauss(0, 0.04)
        bz = math.cos(math.radians(t * 470 + r1 * 421)) * 0.16 + rnd.gauss(0, 0.05)
        cx = math.sin(math.radians(yh * 140 + t * 80)) * 0.22
        cz = math.cos(math.radians(rad * 120 + t * 95)) * 0.22
        pts.append(((math.cos(ang) * rad + bx + cx) * scale, (yh * rad * 0.75 + by) * scale, (math.sin(ang) * rad + bz + cz) * scale, r4))
    return pts


def _draw(img, pts, center, unit, glint_glow=True):
    """Desenha pontos 3D (x, y, z, r4) com perspectiva leve; os de trás mais apagados."""
    size = img.size[0]
    dots = Image.new("RGBA", img.size, (0, 0, 0, 0))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    dg = ImageDraw.Draw(glow)
    for x, y, z, r4 in sorted(pts, key=lambda p: p[2]):
        k = 1.0 / (1.0 + z * 0.08)
        px = center[0] + x * unit * k
        py = center[1] - y * unit * k
        depth = max(0.35, min(1.0, 0.75 - z * 0.12))
        if r4 > 0.86:
            rr = max(1.0, size / 300)
            dd.ellipse((px - rr, py - rr, px + rr, py + rr), fill=(150, 238, 255, 255))
            if glint_glow:
                g = rr * 3.2
                dg.ellipse((px - g, py - g, px + g, py + g), fill=(60, 200, 255, 90))
        else:
            rr = max(0.6, size / 520) * (0.8 + r4 * 0.5)
            c = int(26 + 30 * depth)
            dd.ellipse((px - rr, py - rr, px + rr, py + rr), fill=(c, c + 6, c + 14, int(235 * depth)))
    haze = dots.filter(ImageFilter.GaussianBlur(size / 55))
    haze.putalpha(haze.split()[3].point(lambda v: int(v * 0.5)))
    img.alpha_composite(haze)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size / 140)))
    img.alpha_composite(dots)
    return img


def swarm_image(size=512, mode="cloud", seed=7):
    """mode: cloud (a nuvem), portrait (ícone), arrive (descendo do céu), pile (desligado)."""
    rnd = random.Random(seed)
    img = _bg(size)
    if mode in ("cloud", "portrait"):
        n = 9000 if size >= 400 else 4200
        pts = _cloud_points(n, rnd, t=rnd.random() * 10)
        if mode == "portrait":
            ring = ImageDraw.Draw(img)
            c = size / 2
            for r, a in ((size * 0.44, 22), (size * 0.34, 30)):
                ring.ellipse((c - r, c - r, c + r, c + r), outline=(70, 200, 255, a), width=max(1, size // 128))
        return _draw(img, pts, (size * 0.5, size * 0.52), size * 0.26)
    if mode == "pile":
        pts = []
        for _ in range(2600):
            r = math.sqrt(rnd.random()) * 1.2
            a = rnd.random() * math.tau
            h = (1 - r / 1.2) * 0.45 * rnd.random()
            pts.append((math.cos(a) * r, h - 0.9, math.sin(a) * r * 0.6, rnd.random() * 0.93))
        d = ImageDraw.Draw(img)
        d.ellipse((size * 0.18, size * 0.66, size * 0.82, size * 0.80), fill=(0, 0, 0, 70))
        return _draw(img, pts, (size * 0.5, size * 0.42), size * 0.3)
    # arrive: correntes descendo do céu de vários lugares até a nuvem
    pts = _cloud_points(3500, rnd, scale=0.75)
    for k in range(9):
        A = math.radians(k * 40 + rnd.random() * 16)
        D = 4.5 + rnd.random() * 2
        H = 3.8 + rnd.random() * 1.5
        for _ in range(520):
            u = rnd.random()
            e = 1 - (1 - u) ** 3
            sw = math.sin(u * math.pi) * (0.5 + rnd.random() * 0.4)
            sa = A + u * math.radians(420)
            x = math.cos(A) * D * (1 - e) + math.cos(sa) * sw + rnd.gauss(0, 0.12) * (1 - e)
            y = H * (1 - e) + rnd.gauss(0, 0.08)
            z = math.sin(A) * D * (1 - e) + math.sin(sa) * sw + rnd.gauss(0, 0.12) * (1 - e)
            pts.append((x, y, z * 0.5, rnd.random()))
    return _draw(img, pts, (size * 0.5, size * 0.72), size * 0.11)
