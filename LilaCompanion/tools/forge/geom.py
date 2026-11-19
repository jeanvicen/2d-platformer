"""Geometry DSL for Minecraft Bedrock models (format 1.12.0, per-face UV).

Every cube carries a *paint spec* (material + colours + decals). The atlas is
packed automatically, then `paint.py` bakes a texture by evaluating material
shaders at the real 3D position of every texel, so patterns flow seamlessly
across faces and cubes instead of being flat stickers.

Conventions (Bedrock): 16 units = 1 block, +Y up, the entity front faces -Z.
Positive X rotation pitches the front downward.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

FACES = ("north", "south", "east", "west", "up", "down")


@dataclass
class Paint:
    mat: str = "matte"            # shader name in paint.MATERIALS
    color: tuple = (40, 36, 52)   # base RGB
    color2: tuple | None = None   # secondary / accent RGB
    glow: bool = False            # whole cube emissive
    seed: int = 0
    params: dict = field(default_factory=dict)
    decals: list = field(default_factory=list)  # [(face, kind, dict)]


@dataclass
class Cube:
    origin: tuple
    size: tuple
    paint: Paint
    inflate: float = 0.0
    rotation: tuple | None = None
    pivot: tuple | None = None
    uv: dict = field(default_factory=dict)  # face -> (u, v, w, h) in declared units
    bone: "Bone" = None

    def face_dims(self, face):
        w, h, d = self.size
        if face in ("north", "south"):
            return w, h
        if face in ("east", "west"):
            return d, h
        return w, d


@dataclass
class Bone:
    name: str
    parent: str | None
    pivot: tuple
    rotation: tuple | None = None
    cubes: list = field(default_factory=list)
    locators: dict = field(default_factory=dict)
    binding: str | None = None
    model: "Model" = None

    def cube(self, origin, size, paint=None, *, inflate=0.0, rotation=None, pivot=None, **kw):
        if paint is None:
            paint = Paint(**kw)
        c = Cube(tuple(float(v) for v in origin), tuple(float(v) for v in size), paint,
                 inflate=inflate, rotation=rotation, pivot=pivot, bone=self)
        self.cubes.append(c)
        return c

    def box(self, center, size, paint=None, **kw):
        """Cube defined by its centre instead of its min corner."""
        cx, cy, cz = center
        w, h, d = size
        return self.cube((cx - w / 2, cy - h / 2, cz - d / 2), size, paint, **kw)


class Model:
    def __init__(self, identifier, tex_w=64, tex_h=64, density=4, bounds=(3, 3, (0, 1.5, 0))):
        self.identifier = identifier
        self.tex_w = tex_w
        self.tex_h = tex_h
        self.density = density          # PNG pixels per declared texture unit
        self.bounds = bounds            # (width, height, offset)
        self.bones: list[Bone] = []
        self._by_name = {}

    def bone(self, name, parent=None, pivot=(0, 0, 0), rotation=None, binding=None):
        if name in self._by_name:
            raise ValueError(f"duplicate bone {name} in {self.identifier}")
        if parent is not None and parent not in self._by_name:
            raise ValueError(f"bone {name}: parent {parent} must be declared first ({self.identifier})")
        b = Bone(name, parent, tuple(float(v) for v in pivot), rotation, binding=binding, model=self)
        self.bones.append(b)
        self._by_name[name] = b
        return b

    def get(self, name):
        return self._by_name[name]

    def cubes(self):
        for b in self.bones:
            for c in b.cubes:
                yield c

    # ------------------------------------------------------------------ packing
    def pack(self):
        rects = []
        for c in self.cubes():
            for f in FACES:
                fw, fh = c.face_dims(f)
                rects.append((max(1, math.ceil(fw - 1e-6)), max(1, math.ceil(fh - 1e-6)), c, f))
        rects.sort(key=lambda r: (-r[1], -r[0]))
        x = y = shelf_h = 0
        W = self.tex_w
        for rw, rh, c, f in rects:
            if rw > W:
                raise ValueError(f"face wider than atlas in {self.identifier}")
            if x + rw > W:
                x = 0
                y += shelf_h
                shelf_h = 0
            c.uv[f] = (x, y, rw, rh)
            x += rw
            shelf_h = max(shelf_h, rh)
        needed = y + shelf_h
        h = 16
        while h < needed:
            h *= 2
        if h > self.tex_h:
            self.tex_h = h
        return needed

    # ------------------------------------------------------------------ export
    def to_json(self):
        self.pack()
        bones = []
        for b in self.bones:
            jb = {"name": b.name, "pivot": [round(v, 4) for v in b.pivot]}
            if b.parent:
                jb["parent"] = b.parent
            if b.rotation:
                jb["rotation"] = [round(v, 4) for v in b.rotation]
            if b.binding:
                jb["binding"] = b.binding
            if b.locators:
                jb["locators"] = {k: [round(v, 4) for v in p] for k, p in b.locators.items()}
            if b.cubes:
                jc = []
                for c in b.cubes:
                    cd = {
                        "origin": [round(v, 4) for v in c.origin],
                        "size": [round(v, 4) for v in c.size],
                        "uv": {},
                    }
                    for f in FACES:
                        u, v, w, h = c.uv[f]
                        fw, fh = c.face_dims(f)
                        # Use the real (possibly fractional) face size so texels are not stretched.
                        cd["uv"][f] = {"uv": [u, v], "uv_size": [round(max(fw, 0.01), 4), round(max(fh, 0.01), 4)]}
                    if c.inflate:
                        cd["inflate"] = c.inflate
                    if c.rotation:
                        cd["rotation"] = [round(v, 4) for v in c.rotation]
                        cd["pivot"] = [round(v, 4) for v in (c.pivot or c.origin)]
                    jc.append(cd)
                jb["cubes"] = jc
            bones.append(jb)
        bw, bh, boff = self.bounds
        return {
            "format_version": "1.12.0",
            "minecraft:geometry": [
                {
                    "description": {
                        "identifier": self.identifier,
                        "texture_width": self.tex_w,
                        "texture_height": self.tex_h,
                        "visible_bounds_width": bw,
                        "visible_bounds_height": bh,
                        "visible_bounds_offset": list(boff),
                    },
                    "bones": bones,
                }
            ],
        }

    def stats(self):
        return {"bones": len(self.bones), "cubes": sum(len(b.cubes) for b in self.bones)}


# ---------------------------------------------------------------------- helpers
def mirror_x(origin, size):
    """Mirror a cube across the YZ plane."""
    x, y, z = origin
    w, _, _ = size
    return (-x - w, y, z)


def sym(bone_l, bone_r, origin, size, paint, **kw):
    """Add a cube to a left bone and its mirror to a right bone."""
    a = bone_l.cube(origin, size, paint, **kw)
    rot = kw.pop("rotation", None)
    piv = kw.pop("pivot", None)
    if rot:
        rot = (rot[0], -rot[1], -rot[2])
    if piv:
        piv = (-piv[0], piv[1], piv[2])
    b = bone_r.cube(mirror_x(origin, size), size, paint, rotation=rot, pivot=piv, **kw)
    return a, b


def clone(src: Model, identifier: str, prefix: str = "f_", scale: float = 1.0, offset=(0, 0, 0), density=None):
    """Copy a model renaming bones (prefix) and scaling about the origin.

    Used for metamorphosis forms: the creature rigs are reused as attachables
    whose bone names must not collide with the player's skeleton.
    """
    m = Model(identifier, src.tex_w, src.tex_h, density=density or src.density,
              bounds=(src.bounds[0] * scale + 1, src.bounds[1] * scale + 1, src.bounds[2]))
    ox, oy, oz = offset

    def tp(p):
        return (p[0] * scale + ox, p[1] * scale + oy, p[2] * scale + oz)

    for b in src.bones:
        nb = m.bone(prefix + b.name, (prefix + b.parent) if b.parent else None, pivot=tp(b.pivot), rotation=b.rotation)
        nb.locators = {k: tp(v) for k, v in b.locators.items()}
        for c in b.cubes:
            nb.cube(tp(c.origin), tuple(v * scale for v in c.size), c.paint, inflate=c.inflate * scale,
                    rotation=c.rotation, pivot=tp(c.pivot) if c.pivot else None)
    return m
