#!/usr/bin/env python3
"""Empacota dist/Hacknd.mcaddon (BP + RP) e dist/Hacknd_source.zip.

O .mcaddon é um zip com as duas pastas de pacote na raiz; no celular basta tocar no arquivo
para o Minecraft importar os dois pacotes.
"""
import hashlib
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
SKIP_DIRS = {"node_modules", "__pycache__", ".git", "dist"}


def add_dir(z, src, arc_root):
    for d, dirs, files in os.walk(src):
        dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
        for f in sorted(files):
            if f.endswith((".pyc", ".log")):
                continue
            p = os.path.join(d, f)
            arc = os.path.join(arc_root, os.path.relpath(p, src)).replace(os.sep, "/")
            info = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(p, "rb") as fh:
                z.writestr(info, fh.read())


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def main():
    os.makedirs(DIST, exist_ok=True)
    ver = ".".join(map(str, json.load(open(os.path.join(ROOT, "behavior_pack", "manifest.json")))["header"]["version"]))
    addon = os.path.join(DIST, "Hacknd.mcaddon")
    with zipfile.ZipFile(addon, "w") as z:
        add_dir(z, os.path.join(ROOT, "behavior_pack"), "Hacknd_BP")
        add_dir(z, os.path.join(ROOT, "resource_pack"), "Hacknd_RP")
    src = os.path.join(DIST, "Hacknd_source.zip")
    with zipfile.ZipFile(src, "w") as z:
        for item in ("behavior_pack", "resource_pack", "tools", "tests", "research", "docs", "source"):
            p = os.path.join(ROOT, item)
            if os.path.isdir(p):
                add_dir(z, p, f"LilaCompanion/{item}")
        for f in ("README.md", "LICENSES_AND_ASSETS.md", "CHANGELOG.md"):
            p = os.path.join(ROOT, f)
            if os.path.exists(p):
                info = zipfile.ZipInfo(f"LilaCompanion/{f}", date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                z.writestr(info, open(p, "rb").read())
    for p in (addon, src):
        print(f"{os.path.relpath(p, ROOT)}  {os.path.getsize(p) / 1024:.1f} KB  sha256={sha(p)[:16]}…  v{ver}")


if __name__ == "__main__":
    main()
