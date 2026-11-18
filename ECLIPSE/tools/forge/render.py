"""Tiny software renderer for Bedrock geometry.

Used to produce item icons and preview images straight from the shipped 3D
models (so icons always match the real geometry), and as a visual sanity check
of geometry + baked UVs during development.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageFilter

from .geom import FACES
from .paint import face_points


def _rot(rx, ry, rz):
    # Bedrock rotations -> right-handed (X and Y negated)
    ax, ay, az = math.radians(-rx), math.radians(-ry), math.radians(rz)
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rx @ Ry @ Rz


def _affine(R, pivot):
    M = np.eye(4)
    M[:3, :3] = R
    p = np.array(pivot, dtype=float)
    M[:3, 3] = p - R @ p
    return M


def bone_matrices(model, pose=None):
    pose = pose or {}
    mats = {}
    for b in model.bones:
        rot = list(b.rotation or (0, 0, 0))
        off = (0, 0, 0)
        if b.name in pose:
            pr = pose[b.name]
            if "rot" in pr:
                rot = [rot[i] + pr["rot"][i] for i in range(3)]
            off = pr.get("pos", (0, 0, 0))
        sc = pose.get(b.name, {}).get("scale", 1.0)
        R = _rot(*rot) * sc
        M = _affine(R, b.pivot)
        T = np.eye(4)
        T[:3, 3] = off
        M = T @ M
        if b.parent:
            M = mats[b.parent] @ M
        mats[b.name] = M
    return mats


def collect_faces(model, pose=None):
    mats = bone_matrices(model, pose)
    out = []
    for b in model.bones:
        M = mats[b.name]
        hidden = pose and pose.get(b.name, {}).get("hide")
        if hidden:
            continue
        for c in b.cubes:
            CM = np.eye(4)
            if c.rotation:
                CM = _affine(_rot(*c.rotation), c.pivot or c.origin)
            full = M @ CM
            for f in FACES:
                fw, fh = c.face_dims(f)
                if fw <= 0 or fh <= 0:
                    continue
                s = np.array([0, fw, fw, 0], dtype=float)
                t = np.array([0, 0, fh, fh], dtype=float)
                x, y, z, n = face_points(c, f, s, t)
                infl = c.inflate
                pts = np.stack([x, y, z], axis=1).astype(float)
                if infl:
                    center = np.array(c.origin) + np.array(c.size) / 2
                    pts = center + (pts - center) * (1 + 2 * infl / np.maximum(np.array(c.size), 1e-3))
                hp = np.concatenate([pts, np.ones((4, 1))], axis=1) @ full.T
                nn = full[:3, :3] @ np.array(n, dtype=float)
                nn = nn / (np.linalg.norm(nn) + 1e-9)
                u, v, _, _ = c.uv[f]
                uv = np.stack([u + s, v + t], axis=1)
                out.append((hp[:, :3], uv, nn))
    return out


def render(model, texture, size=256, yaw=35, pitch=22, pose=None, ssaa=3, light=(0.4, 0.8, -0.45),
           alphatest=False, outline=True, background=None, zoom=1.0):
    faces = collect_faces(model, pose)
    tex = np.asarray(texture.convert("RGBA"), dtype=np.float64)
    TH, TW = tex.shape[:2]
    k = TW / model.tex_w
    S = size * ssaa
    # camera: rotate world so we look along +Z after yaw/pitch (front of model is -Z)
    cy_, sy_ = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(-pitch)), math.sin(math.radians(-pitch))
    Ry = np.array([[cy_, 0, sy_], [0, 1, 0], [-sy_, 0, cy_]])
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
    V = Rx @ Ry
    allp = np.concatenate([f[0] for f in faces]) @ V.T
    mn, mx = allp.min(axis=0), allp.max(axis=0)
    span = max(mx[0] - mn[0], mx[1] - mn[1]) * 1.12 / zoom
    cx, cyc = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2
    scale = S / span
    color = np.zeros((S, S, 4))
    depth = np.full((S, S), np.inf)
    L = np.array(light, dtype=float)
    L /= np.linalg.norm(L)
    for pts, uv, n in faces:
        vp = pts @ V.T
        vn = V @ n
        if vn[2] > 0.02:  # facing away (camera looks toward +Z)
            continue
        sx = (vp[:, 0] - cx) * scale + S / 2
        sy = S / 2 - (vp[:, 1] - cyc) * scale
        sz = vp[:, 2]
        shade = 0.62 + 0.38 * max(0.0, float(np.dot(n, L)))
        if n[1] > 0.7:
            shade = min(1.0, shade + 0.08)
        for tri in ((0, 1, 2), (0, 2, 3)):
            X = sx[list(tri)]; Y = sy[list(tri)]; Z = sz[list(tri)]; T = uv[list(tri)]
            x0, x1 = int(max(0, math.floor(X.min()))), int(min(S - 1, math.ceil(X.max())))
            y0, y1 = int(max(0, math.floor(Y.min()))), int(min(S - 1, math.ceil(Y.max())))
            if x1 < x0 or y1 < y0:
                continue
            px, py = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2])
            if abs(d) < 1e-9:
                continue
            w0 = ((Y[1] - Y[2]) * (px - X[2]) + (X[2] - X[1]) * (py - Y[2])) / d
            w1 = ((Y[2] - Y[0]) * (px - X[2]) + (X[0] - X[2]) * (py - Y[2])) / d
            w2 = 1 - w0 - w1
            inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
            if not inside.any():
                continue
            zz = w0 * Z[0] + w1 * Z[1] + w2 * Z[2]
            tu = (w0 * T[0, 0] + w1 * T[1, 0] + w2 * T[2, 0]) * k
            tv = (w0 * T[0, 1] + w1 * T[1, 1] + w2 * T[2, 1]) * k
            iu = np.clip(tu.astype(int), 0, TW - 1)
            iv = np.clip(tv.astype(int), 0, TH - 1)
            texel = tex[iv, iu]
            a = texel[..., 3]
            if alphatest:
                vis = inside & (a > 127)
                lit = np.full(a.shape, shade)
            else:
                vis = inside
                lit = np.where(a < 128, 1.18, shade)  # emissive texels are full bright
            sub = depth[y0:y1 + 1, x0:x1 + 1]
            win = vis & (zz < sub)
            if not win.any():
                continue
            sub[win] = zz[win]
            cs = color[y0:y1 + 1, x0:x1 + 1]
            rgb = np.clip(texel[..., :3] * lit[..., None], 0, 255)
            cs[win, :3] = rgb[win]
            cs[win, 3] = 255
    img = Image.fromarray(color.astype(np.uint8), "RGBA")
    if outline:
        a = img.split()[3]
        grown = a.filter(ImageFilter.MaxFilter(ssaa * 2 + 1))
        ol = Image.new("RGBA", img.size, (14, 8, 22, 255))
        ol.putalpha(grown)
        ol.alpha_composite(img)
        img = ol
    img = img.resize((size, size), Image.LANCZOS)
    if background is not None:
        bg = background.resize((size, size)).convert("RGBA")
        bg.alpha_composite(img)
        img = bg
    return img
