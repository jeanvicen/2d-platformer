#!/usr/bin/env python3
"""Renderiza amostras do catálogo de construções (lib/archgen.js) em vista isométrica para a
página de download: docs/img/arch_<tipo>_<estilo>.png (fachada) e ..._in.png (corte, mostra o
interior mobiliado). Usa o próprio gerador do add-on via Node, então a imagem é a planta real."""
import hashlib
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "img")
GEN = os.path.join(ROOT, "behavior_pack", "scripts", "lib", "archgen.js")

DUMP = r"""
const A = await import(process.argv[1]);
const [kind, style, size] = process.argv.slice(2);
const p = A.archPlan(kind, style, size, 2); // frente virada para quem olha a imagem
const vox = {};
for (const op of p.ops) {
  if (op[0] === "f") { for (let x = op[1]; x <= op[4]; x++) for (let y = op[2]; y <= op[5]; y++) for (let z = op[3]; z <= op[6]; z++) vox[`${x},${y},${z}`] = op[7]; }
  else if (op[0] === "s") { vox[`${op[1]},${op[2]},${op[3]}`] = op[4]; if (op[6]) vox[`${op[1] + op[6][0]},${op[2] + op[6][1]},${op[3] + op[6][2]}`] = op[4]; }
}
console.log(JSON.stringify({ name: p.name, vox }));
"""

COLORS = [
    ("glass", (168, 214, 236)), ("water", (52, 96, 214)), ("lantern", (255, 206, 96)), ("sea_lantern", (210, 240, 235)), ("bed", (196, 44, 44)),
    ("leaves", (64, 138, 54)), ("grass_block", (96, 162, 64)), ("moss", (92, 140, 60)), ("chest", (166, 114, 44)), ("barrel", (128, 90, 52)),
    ("bookshelf", (122, 82, 52)), ("ladder", (170, 132, 72)), ("door", (112, 74, 42)), ("furnace", (112, 112, 112)), ("smoker", (98, 88, 78)),
    ("cauldron", (62, 62, 72)), ("hay", (214, 180, 60)), ("gold", (240, 200, 60)), ("diamond", (90, 220, 220)), ("emerald", (60, 200, 100)),
    ("iron", (210, 210, 214)), ("snow", (246, 250, 252)), ("ice", (150, 190, 240)), ("sand", (222, 208, 156)), ("gravel", (140, 134, 130)),
    ("copper", (196, 110, 76)), ("prismarine", (90, 170, 150)), ("deepslate", (70, 70, 78)), ("blackstone", (44, 40, 46)), ("nether_brick", (74, 34, 40)),
    ("stone_brick", (128, 128, 130)), ("brick", (156, 82, 64)), ("quartz", (238, 234, 226)), ("crimson", (150, 50, 70)), ("warped", (50, 140, 140)), ("mangrove", (120, 50, 46)),
    ("cherry", (226, 172, 178)), ("bamboo", (196, 186, 92)), ("acacia", (176, 96, 52)), ("dark_oak", (72, 48, 26)), ("spruce", (114, 84, 50)),
    ("birch", (214, 202, 150)), ("jungle", (162, 116, 76)), ("oak", (182, 146, 92)), ("andesite", (136, 138, 136)), ("cobble", (122, 122, 122)),
    ("stone", (142, 142, 142)), ("white", (234, 234, 234)), ("red", (186, 52, 48)), ("orange", (226, 128, 44)), ("yellow", (230, 200, 60)),
    ("lime", (120, 196, 40)), ("green", (64, 140, 60)), ("cyan", (40, 150, 160)), ("light_blue", (110, 170, 220)), ("blue", (60, 84, 190)),
    ("purple", (126, 60, 170)), ("magenta", (186, 70, 170)), ("pink", (226, 140, 170)), ("black", (32, 32, 36)), ("gray", (110, 110, 116)),
    ("terracotta", (160, 100, 76)), ("clay", (160, 100, 76)), ("planks", (176, 140, 90)), ("log", (110, 84, 52)),
]


def col(b):
    n = b.replace("minecraft:", "")
    for k, v in COLORS:
        if k in n:
            return v
    h = hashlib.md5(n.encode()).digest()
    return (90 + h[0] % 120, 90 + h[1] % 120, 90 + h[2] % 120)


def render(vox, name, path, cut=None, S=10):
    vox = {tuple(map(int, k.split(","))): b for k, b in vox.items() if b != "minecraft:air"}
    if cut is not None:
        solid = [k for k in vox if k[1] >= 1 and "fence" not in vox[k] and "lantern" not in vox[k]]
        bx = max(k[0] for k in solid)
        bz = max(k[2] for k in solid)
        vox = {k: b for k, b in vox.items() if k[1] <= cut and not ((k[0] >= bx or k[2] >= bz) and k[1] >= 1)}
    xs = [k[0] for k in vox]
    ys = [k[1] for k in vox]
    zs = [k[2] for k in vox]
    W = int((max(xs) - min(xs) + max(zs) - min(zs) + 4) * S) + 40
    H = int((max(ys) - min(ys) + 3) * S * 1.15 + (max(xs) - min(xs) + max(zs) - min(zs) + 2) * S * 0.5) + 50
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    ox = W // 2 - (max(xs) + min(xs) - max(zs) - min(zs)) * S // 2
    oy = H - 20 - (max(ys) - 0) * 0 + (min(ys)) * S * 1.15

    def P(x, y, z):
        return (ox + (x - z) * S, oy - y * S * 1.15 + (x + z - max(xs) - max(zs)) * S * 0.5)

    for (x, y, z) in sorted(vox, key=lambda k: (k[0] + k[2], k[1])):
        b = vox[(x, y, z)]
        c = col(b)
        h = 0.15 if ("carpet" in b or "pressure" in b) else 0.5 if ("slab" in b and "double" not in b) else 1
        q = lambda a, bb, cc: P(x + a, y + bb, z + cc)  # noqa: E731
        top = [q(0, h, 0), q(1, h, 0), q(1, h, 1), q(0, h, 1)]
        south = [q(0, 0, 1), q(1, 0, 1), q(1, h, 1), q(0, h, 1)]
        east = [q(1, 0, 0), q(1, 0, 1), q(1, h, 1), q(1, h, 0)]
        dr.polygon(south, fill=tuple(int(v * 0.68) for v in c) + (255,))
        dr.polygon(east, fill=tuple(int(v * 0.84) for v in c) + (255,))
        dr.polygon(top, fill=c + (255,))
    bbox = img.getbbox()
    if bbox:
        img = img.crop((max(0, bbox[0] - 6), max(0, bbox[1] - 6), min(W, bbox[2] + 6), min(H, bbox[3] + 6)))
    img.save(path)


SAMPLES = [("casa", "medieval", "medio", 3), ("padaria", "japones", "medio", 3), ("escola", "moderno", "medio", 3), ("igreja", "gotico", "medio", None),
           ("mansao", "mansao", "medio", None), ("moinho", "rural", "medio", None), ("farolzinho", "praiano", "medio", None),
           ("hospital", "futurista", "medio", 3), ("castelinho", "castelo", "medio", None), ("torre_mago", "elfico", "medio", None),
           ("cafeteria", "colorido", "pequeno", 3), ("fonte", "colonial", "medio", None)]


def main():
    os.makedirs(OUT, exist_ok=True)
    for kind, style, size, cut in SAMPLES:
        r = subprocess.run(["node", "--input-type=module", "-e", DUMP, GEN, kind, style, size], capture_output=True, text=True)
        if r.returncode:
            print(r.stderr, file=sys.stderr)
            sys.exit(1)
        d = json.loads(r.stdout)
        render(d["vox"], d["name"], os.path.join(OUT, f"arch_{kind}.png"))
        if cut is not None:
            render(d["vox"], d["name"], os.path.join(OUT, f"arch_{kind}_in.png"), cut=cut)
        print("ok", d["name"])


if __name__ == "__main__":
    main()
