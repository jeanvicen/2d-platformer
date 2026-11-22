"""Efeitos visuais dos poderes (3.2): partículas GENÉRICAS coloridas por variável (o script passa a cor
da raça), com texturas desenhadas aqui — brilho, núcleo, anel, onda de choque, corte em meia-lua,
feixe, estrela, gota, elo de corrente, rachadura, runas, fumaça e os 6 SELOS (círculos mágicos) de
cada raça. Assim cada forma de poder (projétil, raio, cone, explosão, coluna, corrente...) ganha um
visual próprio e cada raça tem o seu jeito (sangue, rocha, penas, fogo do inferno, luz, vazio).

Variáveis que o script manda (MolangVariableMap):
  v.cr v.cg v.cb  cor principal (0..1)     v.dr v.dg v.db  cor escura/do miolo
  v.size          tamanho/raio              v.life          duração (s)
  v.n             quantidade                v.rot           giro (graus)
  v.h             altura (colunas)          v.race          0..5 (qual selo)
  v.grav          gravidade                 v.out           1 = para fora, 0 = para dentro
"""
from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

TEX = "textures/particle/lila/vfx"
RACE_SIGIL_ORDER = ["vampire", "giant", "angel", "demon", "god", "dark"]


# ------------------------------------------------------------------ texturas
def _radial(size, fn):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            r = math.hypot(x - c, y - c) / (size / 2)
            a = max(0.0, min(1.0, fn(r).real if r <= 1 else 0.0)) if r <= 1 else 0.0
            px[x, y] = (255, 255, 255, int(a * 255))
    return img


def _ring(size, r0, w, soft):
    return _radial(size, lambda r: math.exp(-((r - r0) / w) ** 2) * (1 if r < 1 else 0) ** soft)


def _star(size=16):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    for ang, ln, wd in ((0, c - 0.5, 1.6), (90, c - 0.5, 1.6), (45, c * 0.55, 1.0), (135, c * 0.55, 1.0)):
        a = math.radians(ang)
        dx, dy = math.cos(a) * ln, math.sin(a) * ln
        px, py = -math.sin(a) * wd, math.cos(a) * wd
        d.polygon([(c - dx, c - dy), (c + px, c + py), (c + dx, c + dy), (c - px, c - py)], fill=(255, 255, 255, 255))
    glow = _radial(size, lambda r: (1 - r) ** 2 * 0.8)
    return Image.alpha_composite(glow, img)


def _slash(size=64):
    img = Image.new("L", (size * 2, size * 2), 0)
    d = ImageDraw.Draw(img)
    S = size * 2
    d.ellipse((S * 0.06, S * 0.06, S * 0.94, S * 0.94), fill=255)
    d.ellipse((S * 0.2, S * 0.02, S * 1.02, S * 0.86), fill=0)  # tira o miolo deslocado → meia-lua afinando nas pontas
    img = img.filter(ImageFilter.GaussianBlur(2.2)).resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    out.putalpha(img)
    return out


def _beam(w=16, h=64):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y in range(h):
        fy = min(1.0, min(y, h - 1 - y) / (h * 0.15))
        for x in range(w):
            fx = math.exp(-((x - (w - 1) / 2) / (w * 0.22)) ** 2)
            px[x, y] = (255, 255, 255, int(255 * fx * fy))
    return img


def _drop(size=16):
    img = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = size * 4
    d.ellipse((S * 0.25, S * 0.42, S * 0.75, S * 0.92), fill=(255, 255, 255, 255))
    d.polygon([(S * 0.5, S * 0.06), (S * 0.27, S * 0.6), (S * 0.73, S * 0.6)], fill=(255, 255, 255, 255))
    d.ellipse((S * 0.36, S * 0.55, S * 0.46, S * 0.68), fill=(255, 255, 255, 120))
    return img.resize((size, size), Image.LANCZOS)


def _chain(size=16):
    img = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = size * 4
    d.rounded_rectangle((S * 0.28, S * 0.06, S * 0.72, S * 0.94), radius=S * 0.2, outline=(255, 255, 255, 255), width=int(S * 0.12))
    d.line([(S * 0.38, S * 0.2), (S * 0.38, S * 0.5)], fill=(255, 255, 255, 140), width=int(S * 0.05))
    return img.resize((size, size), Image.LANCZOS)


def _crack(size=64, seed=7):
    rnd = random.Random(seed)
    img = Image.new("RGBA", (size * 2, size * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size

    def branch(x, y, ang, ln, w, depth):
        if depth <= 0 or ln < 4:
            return
        steps = 4
        for _ in range(steps):
            ang += rnd.uniform(-0.25, 0.25)
            nx, ny = x + math.cos(ang) * ln / steps, y + math.sin(ang) * ln / steps
            d.line([(x, y), (nx, ny)], fill=(255, 255, 255, 255), width=max(1, int(w)))
            x, y = nx, ny
            if rnd.random() < 0.35:
                branch(x, y, ang + rnd.choice((-1, 1)) * rnd.uniform(0.5, 1.1), ln * 0.45, w * 0.6, depth - 1)
        branch(x, y, ang, ln * 0.6, w * 0.7, depth - 1)

    for k in range(7):
        branch(c, c, k * math.tau / 7 + rnd.uniform(-0.2, 0.2), size * 0.55, 5, 3)
    d.ellipse((c - 7, c - 7, c + 7, c + 7), fill=(255, 255, 255, 255))
    return img.filter(ImageFilter.GaussianBlur(0.6)).resize((size, size), Image.LANCZOS)


def _smoke(size=32, seed=3):
    rnd = random.Random(seed)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(14):
        r = rnd.uniform(size * 0.12, size * 0.28)
        x, y = rnd.gauss(size / 2, size * 0.12), rnd.gauss(size / 2, size * 0.12)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 70))
    img = img.filter(ImageFilter.GaussianBlur(2.5))
    mask = _radial(size, lambda r: 1 - r ** 2)
    a = Image.composite(img, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask.split()[3])
    return a


def _feather(size=16):
    img = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = size * 4
    d.ellipse((S * 0.32, S * 0.04, S * 0.68, S * 0.9), fill=(255, 255, 255, 235))
    d.line([(S * 0.5, S * 0.08), (S * 0.5, S * 0.98)], fill=(200, 200, 200, 255), width=int(S * 0.04))
    for k in range(6):
        y = S * (0.2 + k * 0.11)
        d.line([(S * 0.5, y), (S * 0.34, y + S * 0.08)], fill=(215, 215, 215, 255), width=2)
        d.line([(S * 0.5, y), (S * 0.66, y + S * 0.08)], fill=(215, 215, 215, 255), width=2)
    return img.rotate(-30, resample=Image.BICUBIC).resize((size, size), Image.LANCZOS)


def _shard(size=16):
    img = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = size * 4
    d.polygon([(S * 0.2, S * 0.3), (S * 0.62, S * 0.06), (S * 0.92, S * 0.5), (S * 0.55, S * 0.94), (S * 0.12, S * 0.7)], fill=(255, 255, 255, 255))
    d.polygon([(S * 0.62, S * 0.06), (S * 0.92, S * 0.5), (S * 0.55, S * 0.5)], fill=(205, 205, 205, 255))
    d.polygon([(S * 0.12, S * 0.7), (S * 0.55, S * 0.94), (S * 0.5, S * 0.6)], fill=(160, 160, 160, 255))
    return img.resize((size, size), Image.LANCZOS)


def _runes(cell=16):
    img = Image.new("RGBA", (cell * 4 * 4, cell * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = cell * 4
    W = (255, 255, 255, 255)
    lw = int(S * 0.09)
    shapes = [
        [((0.5, 0.1), (0.5, 0.9)), ((0.5, 0.3), (0.8, 0.12)), ((0.5, 0.5), (0.8, 0.32))],
        [((0.3, 0.1), (0.3, 0.9)), ((0.3, 0.1), (0.72, 0.5)), ((0.72, 0.5), (0.3, 0.9))],
        [((0.2, 0.9), (0.5, 0.1)), ((0.5, 0.1), (0.8, 0.9)), ((0.32, 0.55), (0.68, 0.55))],
        [((0.5, 0.1), (0.5, 0.9)), ((0.2, 0.35), (0.8, 0.65)), ((0.8, 0.35), (0.2, 0.65))],
    ]
    for i, sh in enumerate(shapes):
        for (a, b) in sh:
            d.line([(i * S + a[0] * S, a[1] * S), (i * S + b[0] * S, b[1] * S)], fill=W, width=lw)
    return img.filter(ImageFilter.GaussianBlur(1)).resize((cell * 4, cell), Image.LANCZOS)


def _sigil(kind, size=64):
    """Círculos mágicos (desenhados grandes e reduzidos para ficarem lisos)."""
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    W = (255, 255, 255, 255)
    c = S / 2
    lw = max(2, int(S * 0.018))

    def circ(r, w=lw, fill=None):
        d.ellipse((c - r, c - r, c + r, c + r), outline=W if fill is None else None, width=w, fill=fill)

    def poly(n, r, rot=0.0, step=1, w=lw):
        pts = [(c + math.cos(rot + math.tau * k * step / n) * r, c + math.sin(rot + math.tau * k * step / n) * r) for k in range(n + 1)]
        d.line(pts, fill=W, width=w, joint="curve")

    def ticks(n, r0, r1, w=lw, rot=0.0):
        for k in range(n):
            a = rot + math.tau * k / n
            d.line([(c + math.cos(a) * r0, c + math.sin(a) * r0), (c + math.cos(a) * r1, c + math.sin(a) * r1)], fill=W, width=w)

    R = S * 0.47
    circ(R)
    circ(R * 0.9, max(1, lw // 2))
    if kind == "vampire":  # rosa de sangue: 8 pétalas + presas
        for k in range(8):
            a = math.tau * k / 8
            x, y = c + math.cos(a) * R * 0.45, c + math.sin(a) * R * 0.45
            d.ellipse((x - R * 0.22, y - R * 0.22, x + R * 0.22, y + R * 0.22), outline=W, width=lw)
        circ(R * 0.2)
        ticks(16, R * 0.9, R * 0.78)
    elif kind == "giant":  # runas de pedra: anel quebrado + blocos
        for k in range(12):
            a0 = math.tau * k / 12 + 0.05
            d.arc((c - R * 0.72, c - R * 0.72, c + R * 0.72, c + R * 0.72), math.degrees(a0), math.degrees(a0 + math.tau / 12 - 0.12), fill=W, width=lw * 3)
        poly(4, R * 0.5, math.pi / 4)
        poly(4, R * 0.5, 0)
        circ(R * 0.16, fill=W)
    elif kind == "angel":  # auréola com penas/raios suaves
        circ(R * 0.55, lw * 2)
        for k in range(12):
            a = math.tau * k / 12
            x, y = c + math.cos(a) * R * 0.74, c + math.sin(a) * R * 0.74
            d.ellipse((x - R * 0.07, y - R * 0.13, x + R * 0.07, y + R * 0.13), outline=W, width=lw)
        poly(3, R * 0.4, -math.pi / 2)
        poly(3, R * 0.4, math.pi / 2)
        circ(R * 0.1, fill=W)
    elif kind == "demon":  # círculo infernal: espinhos + estrela de 7
        ticks(24, R * 0.9, R * 0.74, lw * 2)
        poly(7, R * 0.68, -math.pi / 2, 3)
        circ(R * 0.32)
        for k in range(7):
            a = -math.pi / 2 + math.tau * k / 7
            d.polygon([(c + math.cos(a) * R * 0.32, c + math.sin(a) * R * 0.32), (c + math.cos(a + 0.12) * R * 0.18, c + math.sin(a + 0.12) * R * 0.18),
                       (c + math.cos(a - 0.12) * R * 0.18, c + math.sin(a - 0.12) * R * 0.18)], fill=W)
    elif kind == "god":  # disco solar: raios + 3 anéis + estrela de 12
        circ(R * 0.62)
        circ(R * 0.35, lw * 2)
        ticks(36, R * 0.62, R * 0.86, max(1, lw // 2 + 1))
        ticks(12, R * 0.35, R * 0.62, lw)
        poly(12, R * 0.3, 0, 5)
        circ(R * 0.12, fill=W)
    else:  # dark: espiral do vazio + olho
        pts = []
        for k in range(220):
            t = k / 219
            a = t * math.tau * 3
            r = R * 0.85 * (1 - t)
            pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
        d.line(pts, fill=W, width=lw)
        d.ellipse((c - R * 0.3, c - R * 0.14, c + R * 0.3, c + R * 0.14), outline=W, width=lw * 2)
        circ(R * 0.08, fill=W)
        ticks(8, R * 0.9, R * 0.8, lw * 2, math.pi / 8)
    img = img.filter(ImageFilter.GaussianBlur(S * 0.004))
    glow = img.filter(ImageFilter.GaussianBlur(S * 0.02))
    out = Image.alpha_composite(glow, img)
    return out.resize((size, size), Image.LANCZOS)


def vfx_textures(RP, wpng):
    base = os.path.join(RP, "textures", "particle", "lila", "vfx")
    wpng(os.path.join(base, "glow.png"), _radial(32, lambda r: (1 - r) ** 2.2))
    wpng(os.path.join(base, "core.png"), _radial(32, lambda r: max(max(0.0, 1 - r * 2.4) ** 1.5, (1 - r) ** 3 * 0.55)))
    wpng(os.path.join(base, "ring.png"), _ring(64, 0.86, 0.07, 1))
    wpng(os.path.join(base, "shock.png"), _radial(64, lambda r: (r ** 3) * math.exp(-((r - 0.85) / 0.12) ** 2 * 0.5) * 1.6 if r < 1 else 0))
    wpng(os.path.join(base, "slash.png"), _slash(64))
    wpng(os.path.join(base, "beam.png"), _beam())
    wpng(os.path.join(base, "star.png"), _star())
    wpng(os.path.join(base, "drop.png"), _drop())
    wpng(os.path.join(base, "chain.png"), _chain())
    wpng(os.path.join(base, "crack.png"), _crack())
    wpng(os.path.join(base, "smoke.png"), _smoke())
    wpng(os.path.join(base, "feather.png"), _feather())
    wpng(os.path.join(base, "shard.png"), _shard())
    wpng(os.path.join(base, "runes.png"), _runes())
    atlas = Image.new("RGBA", (64 * 6, 64), (0, 0, 0, 0))
    for i, k in enumerate(RACE_SIGIL_ORDER):
        atlas.paste(_sigil(k), (64 * i, 0))
    wpng(os.path.join(base, "sigils.png"), atlas)
    return atlas


# ------------------------------------------------------------------ partículas
INIT = ("v.cr = v.cr ?? 1; v.cg = v.cg ?? 1; v.cb = v.cb ?? 1; v.dr = v.dr ?? 0; v.dg = v.dg ?? 0; v.db = v.db ?? 0; "
        "v.size = v.size ?? 1; v.life = v.life ?? 0.5; v.n = v.n ?? 12; v.rot = v.rot ?? 0; v.h = v.h ?? 6; v.race = v.race ?? 0; "
        "v.grav = v.grav ?? 4; v.out = v.out ?? 1;")
T = "(v.particle_age / v.particle_lifetime)"


def _eff(ident, tex, comps, add=True):
    return {"format_version": "1.10.0", "particle_effect": {"description": {"identifier": ident, "basic_render_parameters": {
        "material": "particles_add" if add else "particles_blend", "texture": f"{TEX}/{tex}"}},
        "components": {"minecraft:emitter_initialization": {"creation_expression": INIT}, **comps}}}


def _col(alpha, white="0", dark=None):
    """Cor da raça misturada com branco (brilho no começo) ou com a cor escura."""
    if dark:
        return {"color": [f"math.lerp(v.cr, v.dr, {dark})", f"math.lerp(v.cg, v.dg, {dark})", f"math.lerp(v.cb, v.db, {dark})", alpha]}
    return {"color": [f"math.lerp(v.cr, 1, {white})", f"math.lerp(v.cg, 1, {white})", f"math.lerp(v.cb, 1, {white})", alpha]}


def _bb(size_x, size_y=None, mode="rotate_xyz", tw=16, th=None, uv=(0, 0), uvs=None):
    th = th or tw
    return {"size": [size_x, size_y if size_y is not None else size_x], "facing_camera_mode": mode,
            "uv": {"texture_width": tw, "texture_height": th, "uv": list(uv), "uv_size": list(uvs or (tw, th))}}


ONCE = lambda n, dur=0.05: {"minecraft:emitter_rate_instant": {"num_particles": n}, "minecraft:emitter_lifetime_once": {"active_time": dur}}  # noqa: E731
PT = {"minecraft:emitter_shape_point": {"offset": [0, 0, 0]}}
LIFE = lambda a, b=None: {"minecraft:particle_lifetime_expression": {"max_lifetime": a if b is None else f"math.random({a}, {b})"}}  # noqa: E731


def vfx_particles(RP, wjson):
    out = {}
    for add, suf in ((True, ""), (False, "_d")):
        # orbe: núcleo + halo + fagulha (cada partícula sorteia o papel)
        role = "v.particle_random_1"
        out[f"orb{suf}"] = _eff(f"lila:vfx_orb{suf}", "glow", {
            **ONCE(3), **PT, **LIFE(0.14, 0.22), "minecraft:particle_initial_speed": "math.random(0, 0.6)",
            "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.05, "direction": "outwards"},
            "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3},
            "minecraft:particle_appearance_billboard": _bb(f"v.size * ({role} < 0.34 ? 0.42 : 1.0) * (1 - {T} * 0.5)", tw=32),
            "minecraft:particle_appearance_tinting": _col(f"(1 - {T}) * 0.95", white=f"({role} < 0.34 ? 0.8 : 0)") if add else
            _col(f"(1 - {T}) * 0.95", dark=f"({role} < 0.34 ? 1 : 0)"),
        }, add)
        # faíscas (estouro)
        out[f"spark{suf}"] = _eff(f"lila:vfx_spark{suf}", "star" if add else "glow", {
            **ONCE("v.n"), "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": "0.2 * v.size", "direction": "outwards"}, **LIFE(0.35, 0.8),
            "minecraft:particle_initial_speed": "math.random(2, 7) * math.sqrt(v.size)",
            "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, "-v.grav", 0], "linear_drag_coefficient": 3},
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-400, 400)"},
            "minecraft:particle_appearance_billboard": _bb(f"math.random(0.07, 0.15) * math.sqrt(v.size) * (1 - {T} * 0.7)", tw=16 if add else 32),
            "minecraft:particle_appearance_tinting": _col(f"1 - {T}", white=f"math.max(0, 1 - {T} * 3)") if add else _col(f"1 - {T}", dark=f"{T}"),
        }, add)
        # anel / onda de choque deitada no chão
        out[f"ring{suf}"] = _eff(f"lila:vfx_ring{suf}", "ring" if add else "shock", {
            **ONCE(1), **PT, **LIFE("v.life"),
            "minecraft:particle_appearance_billboard": _bb(f"0.3 + v.size * (1 - math.pow(1 - {T}, 3))", mode="emitter_transform_xz", tw=64),
            "minecraft:particle_appearance_tinting": _col(f"(1 - {T}) * 0.9", white=f"math.max(0, 0.6 - {T} * 2)") if add else _col(f"(1 - {T}) * 0.85", dark=f"{T} * 0.5"),
        }, add)
        # selo (círculo mágico da raça) girando no chão
        out[f"sigil{suf}"] = _eff(f"lila:vfx_sigil{suf}", "sigils", {
            **ONCE(1), **PT, **LIFE("v.life"),
            "minecraft:particle_initial_spin": {"rotation": "v.rot", "rotation_rate": "v.out > 0 ? 50 : -50"},
            "minecraft:particle_appearance_billboard": _bb(f"v.size * math.min(1, {T} * 7) * (1 + math.max(0, {T} - 0.85) * 2)", mode="emitter_transform_xz",
                                                           tw=384, th=64, uv=("v.race * 64", 0), uvs=(64, 64)),
            "minecraft:particle_appearance_tinting": _col(f"math.min(1, (1 - {T}) * 5) * 0.95", white=f"math.max(0, 0.7 - {T} * 4)") if add else
            _col(f"math.min(1, (1 - {T}) * 5) * 0.9"),
        }, add)
        # coluna de luz / de trevas
        out[f"pillar{suf}"] = _eff(f"lila:vfx_pillar{suf}", "beam", {
            **ONCE(1), "minecraft:emitter_shape_point": {"offset": [0, "v.h * 0.5", 0]}, **LIFE("v.life"),
            "minecraft:particle_appearance_billboard": _bb(f"v.size * (1 - {T} * {T})", "v.h * 0.5", mode="lookat_y", tw=16, th=64),
            "minecraft:particle_appearance_tinting": _col(f"1 - {T} * {T}", white=f"math.max(0, 0.7 - {T} * 2)") if add else _col(f"1 - {T} * {T}", dark=f"{T}"),
        }, add)
        # corte em meia-lua
        out[f"slash{suf}"] = _eff(f"lila:vfx_slash{suf}", "slash", {
            **ONCE(1), **PT, **LIFE(0.24),
            "minecraft:particle_initial_spin": {"rotation": "v.rot", "rotation_rate": "v.out > 0 ? 260 : -260"},
            "minecraft:particle_appearance_billboard": _bb(f"v.size * (0.55 + 0.45 * (1 - math.pow(1 - {T}, 2)))", tw=64),
            "minecraft:particle_appearance_tinting": _col(f"1 - {T}", white=f"math.max(0, 1 - {T} * 3)") if add else _col(f"1 - {T}", dark=f"{T} * 0.6"),
        }, add)
        # ponto (linhas, raios, feixes)
        out[f"dot{suf}"] = _eff(f"lila:vfx_dot{suf}", "glow", {
            **ONCE(1), **PT, **LIFE("v.life"),
            "minecraft:particle_appearance_billboard": _bb(f"v.size * (1 - {T} * 0.6)", tw=32),
            "minecraft:particle_appearance_tinting": _col(f"1 - {T}", white=f"math.max(0, 0.5 - {T})") if add else _col(f"1 - {T}"),
        }, add)
        # redemoinho (para dentro ou para fora)
        r = f"v.size * (v.out > 0 ? {T} : 1 - {T})"
        ang = "(v.particle_random_1 * 360 + v.particle_age * 600)"
        out[f"swirl{suf}"] = _eff(f"lila:vfx_swirl{suf}", "glow", {
            **ONCE("v.n"), **PT, **LIFE(0.55, 0.9),
            "minecraft:particle_motion_parametric": {"relative_position": [f"math.cos({ang}) * {r}", f"(v.particle_random_2 - 0.5) * v.size * 0.7 * (1 - {T})", f"math.sin({ang}) * {r}"]},
            "minecraft:particle_appearance_billboard": _bb(f"0.13 * (1 - {T} * 0.5)", tw=32),
            "minecraft:particle_appearance_tinting": _col(f"math.min(1, {T} * 6) * (1 - {T})", white=f"{T} * 0.4") if add else _col(f"math.min(1, {T} * 6) * (1 - {T})", dark=f"{T}"),
        }, add)
        # domo / escudo (pontos numa meia esfera)
        th, ph = "(v.particle_random_1 * 360)", "(v.particle_random_2 * 90)"
        out[f"dome{suf}"] = _eff(f"lila:vfx_dome{suf}", "glow", {
            **ONCE("v.n"), **PT, **LIFE(0.5, 0.9),
            "minecraft:particle_motion_parametric": {"relative_position": [f"math.cos({th}) * math.cos({ph}) * v.size", f"math.sin({ph}) * v.size", f"math.sin({th}) * math.cos({ph}) * v.size"]},
            "minecraft:particle_appearance_billboard": _bb(f"0.16 * math.sin({T} * 180)", tw=32),
            "minecraft:particle_appearance_tinting": _col("0.9", white="0.3") if add else _col("0.9"),
        }, add)
    # clarão (só aditivo)
    out["flash"] = _eff("lila:vfx_flash", "glow", {
        **ONCE(1), **PT, **LIFE(0.13), "minecraft:particle_appearance_billboard": _bb(f"v.size * (1 + {T} * 0.8)", tw=32),
        "minecraft:particle_appearance_tinting": _col(f"(1 - {T}) * 0.95", white="0.55")})
    # estilhaços que quicam no chão
    out["shards"] = _eff("lila:vfx_shards", "shard", {
        **ONCE("v.n"), "minecraft:emitter_shape_sphere": {"offset": [0, 0.2, 0], "radius": "0.3 * v.size", "direction": [
            "math.random(-1, 1)", "math.random(0.4, 1.4)", "math.random(-1, 1)"]}, **LIFE(0.8, 1.6),
        "minecraft:particle_initial_speed": "math.random(3, 8) * math.sqrt(v.size)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0], "linear_drag_coefficient": 0.6},
        "minecraft:particle_motion_collision": {"collision_drag": 4, "coefficient_of_restitution": 0.35, "collision_radius": 0.1},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-500, 500)"},
        "minecraft:particle_appearance_billboard": _bb("(0.1 + v.particle_random_3 * 0.2) * math.sqrt(v.size)"),
        "minecraft:particle_appearance_tinting": {"color": ["v.cr * (0.65 + v.particle_random_2 * 0.35)", "v.cg * (0.65 + v.particle_random_2 * 0.35)",
                                                            "v.cb * (0.65 + v.particle_random_2 * 0.35)", f"math.min(1, (1 - {T}) * 4)"]}}, add=False)
    # fumaça
    out["smoke"] = _eff("lila:vfx_smoke", "smoke", {
        **ONCE("v.n"), "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": "0.5 * v.size", "direction": "outwards"}, **LIFE(1.0, 1.8),
        "minecraft:particle_initial_speed": "math.random(0.4, 1.4)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1.1, 0], "linear_drag_coefficient": 1.6},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-40, 40)"},
        "minecraft:particle_appearance_billboard": _bb(f"(0.3 + {T} * 0.6) * v.size", tw=32),
        "minecraft:particle_appearance_tinting": _col(f"(1 - {T}) * 0.75")}, add=False)
    # elo de corrente
    out["chain"] = _eff("lila:vfx_chain", "chain", {
        **ONCE(1), **PT, **LIFE("v.life"), "minecraft:particle_initial_spin": {"rotation": "v.rot", "rotation_rate": 0},
        "minecraft:particle_appearance_billboard": _bb("0.2", mode="lookat_xyz"),
        "minecraft:particle_appearance_tinting": _col(f"math.min(1, (1 - {T}) * 4)")}, add=False)
    # rachadura no chão
    out["crack"] = _eff("lila:vfx_crack", "crack", {
        **ONCE(1), "minecraft:emitter_shape_point": {"offset": [0, 0.04, 0]}, **LIFE("v.life"),
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 0},
        "minecraft:particle_appearance_billboard": _bb("v.size", mode="emitter_transform_xz", tw=64),
        "minecraft:particle_appearance_tinting": _col(f"math.min(1, (1 - {T}) * 3) * 0.9")}, add=False)
    # penas caindo e balançando
    out["feather"] = _eff("lila:vfx_feather", "feather", {
        **ONCE("v.n"), "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": "0.4 * v.size", "direction": "outwards"}, **LIFE(1.4, 2.4),
        "minecraft:particle_initial_speed": "math.random(1, 3)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 260 + v.particle_random_1 * 360) * 2", -0.9, "math.cos(v.particle_age * 200) * 1.2"],
                                              "linear_drag_coefficient": 2.4},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-120, 120)"},
        "minecraft:particle_appearance_billboard": _bb("0.15"),
        "minecraft:particle_appearance_tinting": _col(f"math.min(1, (1 - {T}) * 3)")}, add=False)
    # gotas (sangue) com gravidade
    out["drops"] = _eff("lila:vfx_drops", "drop", {
        **ONCE("v.n"), "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": "0.25 * v.size", "direction": "outwards"}, **LIFE(0.6, 1.2),
        "minecraft:particle_initial_speed": "math.random(2, 5)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -14, 0], "linear_drag_coefficient": 0.8},
        "minecraft:particle_motion_collision": {"collision_drag": 10, "coefficient_of_restitution": 0, "collision_radius": 0.05, "expire_on_contact": False},
        "minecraft:particle_appearance_billboard": _bb("math.random(0.06, 0.12)", mode="direction_y") | {"direction": {"mode": "derive_from_velocity"}},
        "minecraft:particle_appearance_tinting": _col(f"math.min(1, (1 - {T}) * 3)", dark="v.particle_random_3 * 0.5")}, add=False)
    # brasas subindo
    out["embers"] = _eff("lila:vfx_embers", "glow", {
        **ONCE("v.n"), "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": "0.6 * v.size", "direction": "outwards"}, **LIFE(0.8, 1.6),
        "minecraft:particle_initial_speed": "math.random(0.4, 1.6)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 500 + v.particle_random_1 * 360) * 2", 2.6, 0], "linear_drag_coefficient": 1.4},
        "minecraft:particle_appearance_billboard": _bb("math.random(0.05, 0.1)", tw=32),
        "minecraft:particle_appearance_tinting": _col(f"(1 - {T}) * (0.6 + 0.4 * math.sin(v.particle_age * 2200 + v.particle_random_2 * 360))", white=f"math.max(0, 0.5 - {T})")})
    # estrelinhas cintilando
    out["stars"] = _eff("lila:vfx_stars", "star", {
        **ONCE("v.n"), "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": "v.size", "direction": "outwards"}, **LIFE(0.6, 1.2),
        "minecraft:particle_initial_speed": "0.25", "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 90)", "rotation_rate": "math.random(-90, 90)"},
        "minecraft:particle_appearance_billboard": _bb(f"0.16 * math.sin({T} * 180)"),
        "minecraft:particle_appearance_tinting": _col("1", white="0.4")})
    # runas subindo
    out["runes"] = _eff("lila:vfx_runes", "runes", {
        **ONCE("v.n"), "minecraft:emitter_shape_disc": {"offset": [0, 0.3, 0], "radius": "v.size", "plane_normal": "y", "direction": [0, 1, 0]}, **LIFE(1.0, 1.6),
        "minecraft:particle_initial_speed": "math.random(0.4, 1.0)", "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8},
        "minecraft:particle_appearance_billboard": _bb(f"0.18 * math.min(1, {T} * 6)", mode="lookat_y", tw=64, th=16, uv=("math.floor(v.particle_random_3 * 4) * 16", 0), uvs=(16, 16)),
        "minecraft:particle_appearance_tinting": _col(f"math.min(1, (1 - {T}) * 3)", white="0.2")})
    for k, data in out.items():
        wjson(os.path.join(RP, "particles", f"lila_vfx_{k}.json"), data)
    return sorted(d["particle_effect"]["description"]["identifier"] for d in out.values())


def build_vfx(RP, wjson, wpng):
    atlas = vfx_textures(RP, wpng)
    ids = vfx_particles(RP, wjson)
    return atlas, ids
