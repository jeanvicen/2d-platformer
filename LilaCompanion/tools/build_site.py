#!/usr/bin/env python3
"""Gera site/index.html: página de download com imagens renderizadas do modelo real,
resultados do autoteste no servidor oficial e o pacote embutido (cópia .zip)."""
import base64
import hashlib
import io
import json
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "docs", "img")
RAW = "https://github.com/jeanvicen/2d-platformer/raw/ccr-4f2624e6-c75bcj/LilaCompanion/dist/Hacknd.mcaddon"


def img(name, size, pixel=False):
    im = Image.open(os.path.join(IMG, name + ".png")).convert("RGBA")
    im.thumbnail((size, size), Image.NEAREST if pixel else Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, "WEBP", quality=90)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()


def tests_rows():
    rows = []
    for log in (os.path.join(ROOT, "tests", "last_bds_run.log"), os.path.join(ROOT, "tests", "last_bds_owner_run.log"),
                os.path.join(ROOT, "tests", "last_bds_race_run.log")):
        if not os.path.exists(log):
            continue
        for line in open(log, encoding="utf-8"):
            if "arena chunks" in line:
                continue
            m = re.search(r"LILA-TEST (PASS|FAIL) (.+?)( :: (.*))?$", line.strip())
            if m:
                cls = "pass" if m.group(1) == "PASS" else "todo"
                info = f' <span class="note">({m.group(4).strip()})</span>' if m.group(4) and m.group(4).strip() else ""
                rows.append(f'<tr><td><span class="pill {cls}">{m.group(1)}</span></td><td>{m.group(2)}{info}</td></tr>')
    return "".join(rows)


def main():
    addon = open(os.path.join(ROOT, "dist", "Hacknd.mcaddon"), "rb").read()
    ver = ".".join(map(str, json.load(open(os.path.join(ROOT, "behavior_pack", "manifest.json")))["header"]["version"]))
    rep = {
        "%%PORTRAIT%%": img("portrait", 440), "%%CURSE_FRONT%%": img("curse_front", 440), "%%CURSE_SIDE%%": img("curse_side", 440),
        "%%CURSE_POSES%%": img("curse_poses", 900),
        "%%DRONE0%%": img("drone_view_0", 300), "%%DRONECTL%%": img("drone_controller", 220),
        **{f"%%F_{k.upper()}%%": img(f"form_{k}", 420 if k == "colossus" else 300) for k in ("heli", "car", "excavator", "tank", "jet", "moto", "colossus",
                                                                                                 "ship", "ufo", "sub", "boat", "truck", "stealth", "swarm")},
        **{f"%%A_{k.upper()}%%": img(f"arch_{k}", 300) for k in ("casa", "padaria", "escola", "igreja", "mansao", "moinho", "farolzinho", "castelinho",
                                                                  "torre_mago", "hospital", "cafeteria", "fonte", "casa_in", "escola_in", "hospital_in", "padaria_in")},
        "%%F_TURRET%%": img("form_turret_g", 300), "%%R_OFF%%": img("robot_off", 300), "%%R_BOOT%%": img("robot_boot", 300), "%%ROBOT%%": img("robot", 260),
        **{f"%%RK_{k.upper()}%%": img(f"robot_{k}", 220) for k in ("soldado", "construtor", "artilheiro", "medico", "ninja")},
        "%%NANO_ITEMS%%": img("nano_items", 560, pixel=True),
        "%%TESTS%%": tests_rows(), "%%B64%%": base64.b64encode(addon).decode(),
        "%%SIZE%%": f"{len(addon) / 1024:.0f}", "%%SHA%%": hashlib.sha256(addon).hexdigest()[:16],
        "%%RAW%%": RAW, "%%VERSION%%": ver,
    }
    html = open(os.path.join(ROOT, "tools", "site_template.html"), encoding="utf-8").read()
    for k, v in rep.items():
        html = html.replace(k, v)
    os.makedirs(os.path.join(ROOT, "site"), exist_ok=True)
    out = os.path.join(ROOT, "site", "index.html")
    open(out, "w", encoding="utf-8").write(html)
    print(out, f"{len(html) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
