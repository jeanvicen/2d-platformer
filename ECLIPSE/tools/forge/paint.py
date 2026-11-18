"""Procedural texture baking.

For every face of every cube we build a grid of texel centres, map them to the
cube's 3D surface and evaluate a material shader there. Because shaders use 3D
positions, fur streaks, scales, cracks and gradients continue across faces and
neighbouring cubes, which is what makes these models read as painted volumes
instead of flat stickers.

Emissive texels are written with alpha = 1/255; the entity materials used by
ECLIPSE (`entity_emissive_alpha`) render low-alpha texels fully bright.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from .geom import FACES

GLOW_ALPHA = 1  # 1/255 -> fully emissive under entity_emissive_alpha


# ---------------------------------------------------------------- noise utils
def _hash3(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 144269504) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFF) / 65535.0


def vnoise(x, y, z, seed=0):
    """Trilinear value noise in [0,1] (vectorised)."""
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    z0 = np.floor(z).astype(np.int64)
    fx, fy, fz = x - x0, y - y0, z - z0
    sx = fx * fx * (3 - 2 * fx)
    sy = fy * fy * (3 - 2 * fy)
    sz = fz * fz * (3 - 2 * fz)

    def h(dx, dy, dz):
        return _hash3(x0 + dx, y0 + dy, z0 + dz, seed)

    c000, c100, c010, c110 = h(0, 0, 0), h(1, 0, 0), h(0, 1, 0), h(1, 1, 0)
    c001, c101, c011, c111 = h(0, 0, 1), h(1, 0, 1), h(0, 1, 1), h(1, 1, 1)
    x00 = c000 + (c100 - c000) * sx
    x10 = c010 + (c110 - c010) * sx
    x01 = c001 + (c101 - c001) * sx
    x11 = c011 + (c111 - c011) * sx
    y0_ = x00 + (x10 - x00) * sy
    y1_ = x01 + (x11 - x01) * sy
    return y0_ + (y1_ - y0_) * sz


def fbm(x, y, z, seed=0, octaves=4):
    total = np.zeros_like(x, dtype=np.float64)
    amp, freq, norm = 1.0, 1.0, 0.0
    for o in range(octaves):
        total += amp * vnoise(x * freq, y * freq, z * freq, seed + o * 31)
        norm += amp
        amp *= 0.5
        freq *= 2.03
    return total / norm


def mix(a, b, t):
    t = np.asarray(t)[..., None] if np.ndim(t) else t
    return a * (1 - t) + b * t


def col(c):
    return np.array(c[:3], dtype=np.float64)


# ---------------------------------------------------------------- face mapping
def face_points(cube, face, s, t):
    """Map face-local (s right, t down) coordinates to 3D points + normal."""
    x0, y0, z0 = cube.origin
    w, h, d = cube.size
    x1, y1, z1 = x0 + w, y0 + h, z0 + d
    if face == "north":
        return x1 - s, y1 - t, np.full_like(s, z0), (0, 0, -1)
    if face == "south":
        return x0 + s, y1 - t, np.full_like(s, z1), (0, 0, 1)
    if face == "east":
        return np.full_like(s, x1), y1 - t, z1 - s, (1, 0, 0)
    if face == "west":
        return np.full_like(s, x0), y1 - t, z0 + s, (-1, 0, 0)
    if face == "up":
        return x0 + s, np.full_like(s, y1), z0 + t, (0, 1, 0)
    return x0 + s, np.full_like(s, y0), z1 - t, (0, -1, 0)


# ---------------------------------------------------------------- materials
def m_matte(P, N, st, p):
    x, y, z = P
    n = fbm(x * 0.35, y * 0.35, z * 0.35, p.seed)
    base = col(p.color)
    rgb = base[None, None, :] * (0.86 + 0.28 * n)[..., None]
    return rgb, None


def m_fur(P, N, st, p):
    x, y, z = P
    flow = p.params.get("flow", "z")
    k = p.params.get("grain", 1.0)
    if flow == "z":
        a, b, c = x * 1.6 * k, y * 1.6 * k, z * 0.25 * k
    elif flow == "y":
        a, b, c = x * 1.6 * k, y * 0.25 * k, z * 1.6 * k
    else:
        a, b, c = x * 0.25 * k, y * 1.6 * k, z * 1.6 * k
    streak = fbm(a, b, c, p.seed, 3)
    clump = fbm(x * 0.3, y * 0.3, z * 0.3, p.seed + 7, 3)
    base = col(p.color)
    tip = col(p.color2 or tuple(min(255, v * 1.6 + 18) for v in p.color))
    t = np.clip((streak - 0.35) * 1.8, 0, 1) * (0.55 + 0.45 * clump)
    rgb = mix(base[None, None, :] * 0.95, tip[None, None, :], t * 0.7)
    return rgb, None


def m_scales(P, N, st, p):
    s, t = st[0], st[1]
    size = p.params.get("size", 1.5)
    row = np.floor(t / (size * 0.75))
    off = (row % 2) * size * 0.5
    cu = (s + off) / size
    fu = cu - np.floor(cu)
    fv = t / (size * 0.75) - row
    d = np.sqrt((fu - 0.5) ** 2 * 1.4 + (fv - 0.15) ** 2)
    edge = np.clip((d - 0.45) * 6, 0, 1)
    cell_rand = _hash3(np.floor(cu).astype(np.int64), row.astype(np.int64), np.int64(p.seed), 3)
    base = col(p.color)
    hi = col(p.color2 or tuple(min(255, v * 1.5 + 20) for v in p.color))
    shade = 0.8 + 0.25 * cell_rand
    rgb = mix(hi[None, None, :] * 0.85, base[None, None, :] * 0.7, np.clip(fv * 1.2, 0, 1)) * shade[..., None]
    rgb = rgb * (1 - 0.45 * edge[..., None])
    return rgb, None


def m_feather(P, N, st, p):
    s, t = st[0], st[1]
    x, y, z = P
    width = p.params.get("width", 2.0)
    lane = s / width
    fl = lane - np.floor(lane)
    shaft = np.exp(-((fl - 0.5) ** 2) / 0.004)
    barb = 0.5 + 0.5 * np.sin((np.abs(fl - 0.5) * 6 + t * 1.8) * math.pi)
    base = col(p.color)
    hi = col(p.color2 or tuple(min(255, v * 1.7 + 25) for v in p.color))
    tipt = np.clip(t / max(1e-3, p.params.get("length", 8.0)), 0, 1)
    rgb = mix(base[None, None, :], hi[None, None, :], (0.25 * barb + 0.45 * tipt))
    rgb = rgb * (1 - 0.25 * (np.abs(fl - 0.5) > 0.47)[..., None])
    rgb = mix(rgb, hi[None, None, :] * 1.1, shaft * 0.6)
    n = fbm(x * 0.6, y * 0.6, z * 0.6, p.seed, 2)
    return rgb * (0.9 + 0.2 * n)[..., None], None


def m_metal(P, N, st, p):
    s, t = st[0], st[1]
    x, y, z = P
    brushed = fbm(x * 0.15 + s * 0.05, y * 2.2, z * 0.15 + t * 0.05, p.seed, 3)
    base = col(p.color)
    hi = col(p.color2 or tuple(min(255, v * 1.8 + 30) for v in p.color))
    fw, fh = st[2], st[3]
    edge_d = np.minimum(np.minimum(s, fw - s), np.minimum(t, fh - t))
    bevel = np.clip(1 - edge_d / 0.7, 0, 1)
    rim = np.clip(1 - edge_d / 0.22, 0, 1)
    rgb = base[None, None, :] * (0.8 + 0.35 * brushed)[..., None]
    rgb = mix(rgb, hi[None, None, :], bevel * 0.55)
    rgb = rgb * (1 - 0.35 * rim)[..., None]
    if p.params.get("rivets"):
        for (rs, rt) in ((0.8, 0.8), (fw - 0.8, 0.8), (0.8, fh - 0.8), (fw - 0.8, fh - 0.8)):
            dd = np.sqrt((s - rs) ** 2 + (t - rt) ** 2)
            m = np.clip(1 - dd / 0.45, 0, 1)
            rgb = mix(rgb, hi[None, None, :] * 1.05, m)
    return rgb, None


def m_cloth(P, N, st, p):
    s, t = st[0], st[1]
    x, y, z = P
    weave = 0.5 + 0.5 * np.sin(s * math.pi * 3.2) * np.sin(t * math.pi * 3.2)
    folds = fbm(x * 0.25, y * 0.08, z * 0.25, p.seed, 3)
    base = col(p.color)
    hi = col(p.color2 or tuple(min(255, v * 1.4 + 12) for v in p.color))
    rgb = mix(base[None, None, :] * 0.75, hi[None, None, :], folds * 0.8)
    rgb = rgb * (0.94 + 0.08 * weave)[..., None]
    return rgb, None


def m_skin(P, N, st, p):
    x, y, z = P
    n = fbm(x * 0.5, y * 0.5, z * 0.5, p.seed, 2)
    base = col(p.color)
    rgb = base[None, None, :] * (0.95 + 0.08 * n)[..., None]
    return rgb, None


def m_hair(P, N, st, p):
    x, y, z = P
    strands = fbm(x * 2.4, y * 0.18, z * 2.4, p.seed, 3)
    base = col(p.color)
    hi = col(p.color2 or tuple(min(255, v * 2.0 + 30) for v in p.color))
    band = np.exp(-((y - p.params.get("shine_y", 28.0)) ** 2) / 3.0)
    rgb = mix(base[None, None, :] * 0.8, hi[None, None, :], np.clip(strands * 0.6 + band * 0.5, 0, 1))
    return rgb, None


def m_stone(P, N, st, p):
    x, y, z = P
    n = fbm(x * 0.3, y * 0.3, z * 0.3, p.seed, 4)
    crack_n = fbm(x * 0.22, y * 0.22, z * 0.22, p.seed + 99, 3)
    crack = np.clip(1 - np.abs(crack_n - 0.5) / 0.03, 0, 1)
    base = col(p.color)
    rgb = base[None, None, :] * (0.72 + 0.45 * n)[..., None]
    glow_mask = None
    if p.params.get("glow_cracks"):
        gc = col(p.color2 or (170, 90, 255))
        rgb = mix(rgb, gc[None, None, :], crack)
        glow_mask = crack > 0.45
    else:
        rgb = rgb * (1 - 0.6 * crack)[..., None]
    return rgb, glow_mask


def m_glow(P, N, st, p):
    x, y, z = P
    n = fbm(x * 0.5, y * 0.5, z * 0.5, p.seed, 3)
    base = col(p.color)
    hi = col(p.color2 or (235, 215, 255))
    rgb = mix(base[None, None, :], hi[None, None, :], np.clip(n * 1.3 - 0.2, 0, 1))
    return rgb, np.ones(rgb.shape[:2], dtype=bool)


def m_membrane(P, N, st, p):
    s, t = st[0], st[1]
    x, y, z = P
    veins = np.abs(np.sin((s * 0.9 + fbm(x * 0.2, y * 0.2, z * 0.2, p.seed, 2) * 3) * math.pi))
    vein = np.clip(1 - veins / 0.12, 0, 1)
    base = col(p.color)
    hi = col(p.color2 or tuple(min(255, v * 1.5 + 30) for v in p.color))
    grad = np.clip(t / max(1e-3, st[3]), 0, 1)
    rgb = mix(hi[None, None, :] * 0.8, base[None, None, :], grad)
    rgb = rgb * (1 - 0.35 * vein)[..., None]
    return rgb, None


def m_bone(P, N, st, p):
    x, y, z = P
    ridges = 0.5 + 0.5 * np.sin(y * 3.0 + fbm(x, y, z, p.seed, 2) * 2)
    base = col(p.color)
    rgb = base[None, None, :] * (0.82 + 0.18 * ridges)[..., None]
    return rgb, None


def m_wood(P, N, st, p):
    x, y, z = P
    axis = p.params.get("axis", "y")
    if axis == "y":
        g = fbm(x * 2.5, y * 0.12, z * 2.5, p.seed, 3)
    elif axis == "x":
        g = fbm(x * 0.12, y * 2.5, z * 2.5, p.seed, 3)
    else:
        g = fbm(x * 2.5, y * 2.5, z * 0.12, p.seed, 3)
    rings = 0.5 + 0.5 * np.sin(g * 18)
    base = col(p.color)
    rgb = base[None, None, :] * (0.75 + 0.3 * rings)[..., None]
    return rgb, None


def m_leather(P, N, st, p):
    s, t = st[0], st[1]
    x, y, z = P
    n = fbm(x * 1.2, y * 1.2, z * 1.2, p.seed, 3)
    base = col(p.color)
    rgb = base[None, None, :] * (0.8 + 0.3 * n)[..., None]
    fw, fh = st[2], st[3]
    edge_d = np.minimum(np.minimum(s, fw - s), np.minimum(t, fh - t))
    stitch = ((edge_d > 0.35) & (edge_d < 0.55) & (np.sin((s + t) * 6) > 0.3))
    rgb = np.where(stitch[..., None], rgb * 1.5 + 20, rgb)
    return rgb, None


def m_crystal(P, N, st, p):
    s, t = st[0], st[1]
    x, y, z = P
    fw, fh = st[2], st[3]
    diag = (s / max(fw, 1e-3) * 0.6 + (1 - t / max(fh, 1e-3)) * 0.4)
    n = fbm(x * 0.7 + y * 0.3, y * 0.7, z * 0.7 - y * 0.3, p.seed, 3)
    streak = np.clip(1 - np.abs(((s + t * 0.8) % 2.4) - 1.2) / 0.12, 0, 1) * (n > 0.5)
    base = col(p.color)
    hi = col(p.color2 or (240, 225, 255))
    rgb = mix(base[None, None, :], hi[None, None, :], np.clip(diag * 0.75 + n * 0.35 - 0.1, 0, 1))
    rgb = mix(rgb, hi[None, None, :] * 1.05, streak * 0.8)
    ed = np.minimum(np.minimum(s, fw - s), np.minimum(t, fh - t))
    rgb = mix(rgb, hi[None, None, :], np.clip(1 - ed / 0.18, 0, 1) * 0.5)
    return rgb, np.ones(rgb.shape[:2], dtype=bool)


MATERIALS = {
    "matte": m_matte, "fur": m_fur, "scales": m_scales, "feather": m_feather,
    "metal": m_metal, "cloth": m_cloth, "skin": m_skin, "hair": m_hair,
    "stone": m_stone, "glow": m_glow, "membrane": m_membrane, "bone": m_bone,
    "wood": m_wood, "leather": m_leather, "crystal": m_crystal,
}


# ---------------------------------------------------------------- decals
def apply_decal(rgb, glow, s, t, fw, fh, kind, opt):
    """Decals are positioned in face-local units (s from left, t from top)."""
    if kind == "eyes":
        # pair of glowing eyes, symmetric about the face centre
        cy = opt.get("t", fh * 0.4)
        sep = opt.get("sep", fw * 0.25)
        r = opt.get("r", 0.6)
        ry = opt.get("ry", r * 0.7)
        c = col(opt.get("color", (205, 120, 255)))
        core = col(opt.get("core", (255, 240, 255)))
        for cx in (fw / 2 - sep, fw / 2 + sep):
            d = np.sqrt(((s - cx) / r) ** 2 + ((t - cy) / ry) ** 2)
            m = d < 1.0
            rgb[m] = c * 0.75 + core * 0.25 * (1 - d[m])[..., None]
            glow |= m
            halo = (d >= 1.0) & (d < 1.6)
            rgb[halo] = rgb[halo] * 0.55 + c * 0.25
    elif kind == "eye_single":
        cx, cy = opt.get("s", fw / 2), opt.get("t", fh / 2)
        r = opt.get("r", 0.6)
        c = col(opt.get("color", (205, 120, 255)))
        d = np.sqrt((s - cx) ** 2 + (t - cy) ** 2) / r
        m = d < 1
        rgb[m] = c
        glow |= m
    elif kind == "line":
        # horizontal or vertical glowing line
        axis = opt.get("axis", "s")
        pos = opt.get("pos", fh / 2 if axis == "s" else fw / 2)
        width = opt.get("w", 0.25)
        c = col(opt.get("color", (190, 110, 255)))
        dist = np.abs((t if axis == "s" else s) - pos)
        m = dist < width
        rgb[m] = c
        if opt.get("glow", True):
            glow |= m
    elif kind == "runes":
        c = col(opt.get("color", (200, 130, 255)))
        cell = opt.get("cell", 1.5)
        cs = np.floor(s / cell)
        ct = np.floor(t / cell)
        r = _hash3(cs.astype(np.int64), ct.astype(np.int64), np.int64(opt.get("seed", 5)), 9)
        fs = s / cell - cs
        ft = t / cell - ct
        bar = ((np.abs(fs - 0.5) < 0.1) & (r > 0.4)) | ((np.abs(ft - 0.5) < 0.1) & (r > 0.7)) | ((np.abs(fs - ft) < 0.1) & (r < 0.25))
        margin = opt.get("margin", 0.5)
        inside = (s > margin) & (s < fw - margin) & (t > margin) & (t < fh - margin)
        m = bar & inside & (_hash3(cs.astype(np.int64), ct.astype(np.int64), np.int64(3), 1) > 0.35)
        rgb[m] = c
        glow |= m
    elif kind == "gem":
        cx, cy = opt.get("s", fw / 2), opt.get("t", fh / 2)
        r = opt.get("r", 1.0)
        c = col(opt.get("color", (180, 90, 255)))
        hi = col((255, 235, 255))
        d = np.sqrt((s - cx) ** 2 + (t - cy) ** 2) / r
        m = d < 1
        rgb[m] = c * (0.7 + 0.3 * (1 - d[m]))[..., None] + hi * (np.clip(0.5 - d[m], 0, 1) * 0.8)[..., None]
        glow |= m
    elif kind == "mouth":
        cy = opt.get("t", fh * 0.8)
        width = opt.get("w", fw * 0.3)
        m = (np.abs(t - cy) < opt.get("h", 0.18)) & (np.abs(s - fw / 2) < width / 2)
        rgb[m] = rgb[m] * 0.45
    elif kind == "blush":
        for cx in (fw * 0.22, fw * 0.78):
            d = np.sqrt((s - cx) ** 2 + (t - opt.get("t", fh * 0.65)) ** 2)
            m = np.clip(1 - d / opt.get("r", 0.7), 0, 1) * 0.35
            rgb[:] = rgb * (1 - m[..., None]) + col((230, 140, 170)) * m[..., None]
    elif kind == "teeth":
        cy = opt.get("t", fh * 0.85)
        m = (np.abs(t - cy) < 0.3) & (np.sin(s * math.pi * 2.5) > 0.2)
        rgb[m] = col((225, 220, 230))
    elif kind == "stripe_band":
        # broad band of secondary colour (e.g. belt, collar)
        a, b = opt.get("from", 0), opt.get("to", 1)
        m = (t >= a) & (t <= b)
        rgb[m] = col(opt.get("color", (90, 60, 130)))
        if opt.get("glow"):
            glow |= m
    return rgb, glow


# ---------------------------------------------------------------- baking
def bake(model, ao=True, edge=True):
    """Return a PIL RGBA image for the model's atlas."""
    if any(not c.uv for c in model.cubes()):
        model.pack()
    k = model.density
    W, H = model.tex_w * k, model.tex_h * k
    img = np.zeros((H, W, 4), dtype=np.float64)
    for cube in model.cubes():
        p = cube.paint
        shader = MATERIALS[p.mat]
        for face in FACES:
            u, v, rw, rh = cube.uv[face]
            fw, fh = cube.face_dims(face)
            fw = max(fw, 0.01)
            fh = max(fh, 0.01)
            pw = max(1, int(round(fw * k)))
            ph = max(1, int(round(fh * k)))
            ss = (np.arange(pw) + 0.5) / k
            tt = (np.arange(ph) + 0.5) / k
            s, t = np.meshgrid(ss, tt)
            x, y, z, n = face_points(cube, face, s, t)
            rgb, gmask = shader((x, y, z), n, (s, t, fw, fh), p)
            rgb = np.array(rgb, dtype=np.float64)
            if rgb.shape[:2] != s.shape:
                rgb = np.broadcast_to(rgb, s.shape + (3,)).copy()
            glow = np.zeros(s.shape, dtype=bool) if gmask is None else gmask.copy()
            if p.glow:
                glow[:] = True
            for dface, kind, opt in p.decals:
                if dface == face or dface == "*" or (dface == "sides" and face in ("north", "south", "east", "west")):
                    rgb, glow = apply_decal(rgb, glow, s, t, fw, fh, kind, opt)
            if ao and not p.glow:
                if face in ("north", "south", "east", "west"):
                    grad = 0.86 + 0.14 * (1 - t / fh)
                    rgb = rgb * grad[..., None]
                elif face == "down":
                    rgb = rgb * 0.82
            if edge and not p.glow and p.params.get("edge", True):
                ed = np.minimum(np.minimum(s, fw - s), np.minimum(t, fh - t))
                rim = np.clip(1 - ed * k / 1.2, 0, 1) * 0.22
                rgb = rgb * (1 - rim[..., None])
            rgb = np.clip(rgb, 0, 255)
            alpha = np.where(glow, GLOW_ALPHA, 255).astype(np.float64)
            if p.params.get("cutout") is not None:
                alpha = np.where(p.params["cutout"](s, t, fw, fh), 0, alpha)
            px, py = int(round(u * k)), int(round(v * k))
            img[py:py + ph, px:px + pw, :3] = rgb
            img[py:py + ph, px:px + pw, 3] = alpha
    return Image.fromarray(img.astype(np.uint8), "RGBA")
