#!/usr/bin/env python3
"""Packages ECLIPSE into dist/: ECLIPSE_Shadow_Sovereign.mcaddon (+ .mcpack of each pack),
then re-opens every archive to verify structure and CRCs."""
import hashlib
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
PACKS = ["ECLIPSE_BP", "ECLIPSE_RP"]
FIXED_TIME = (2026, 11, 18, 12, 0, 0)  # zip reproduzível


def files_of(pack):
    base = os.path.join(ROOT, pack)
    out = []
    for d, _, fs in os.walk(base):
        for f in sorted(fs):
            if f.startswith(".") or f.endswith((".wav", ".pyc")):
                continue
            out.append(os.path.join(d, f))
    return sorted(out)


def add(z, path, arc):
    info = zipfile.ZipInfo(arc, FIXED_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    with open(path, "rb") as f:
        z.writestr(info, f.read())


def build():
    os.makedirs(DIST, exist_ok=True)
    addon = os.path.join(DIST, "ECLIPSE_Shadow_Sovereign.mcaddon")
    with zipfile.ZipFile(addon, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for pack in PACKS:
            for p in files_of(pack):
                add(z, p, f"{pack}/" + os.path.relpath(p, os.path.join(ROOT, pack)).replace(os.sep, "/"))
    for pack in PACKS:
        with zipfile.ZipFile(os.path.join(DIST, f"{pack}.mcpack"), "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for p in files_of(pack):
                add(z, p, os.path.relpath(p, os.path.join(ROOT, pack)).replace(os.sep, "/"))
    return addon


def verify(addon):
    ok = True
    with zipfile.ZipFile(addon) as z:
        bad = z.testzip()
        names = z.namelist()
        for pack in PACKS:
            if f"{pack}/manifest.json" not in names:
                print(f"ERRO: {pack}/manifest.json ausente no .mcaddon")
                ok = False
            else:
                m = json.loads(z.read(f"{pack}/manifest.json"))
                print(f"  {pack}: {m['header']['name']} v{'.'.join(map(str, m['header']['version']))} uuid={m['header']['uuid']}")
        if bad:
            print("ERRO: CRC inválido em", bad)
            ok = False
        print(f"  .mcaddon: {len(names)} arquivos")
    for pack in PACKS:
        with zipfile.ZipFile(os.path.join(DIST, f"{pack}.mcpack")) as z:
            if "manifest.json" not in z.namelist() or z.testzip():
                print(f"ERRO: {pack}.mcpack inválido")
                ok = False
    sha = hashlib.sha256(open(addon, "rb").read()).hexdigest()
    size = os.path.getsize(addon)
    print(f"  tamanho: {size / 1024 / 1024:.2f} MB · sha256: {sha}")
    with open(os.path.join(DIST, "SHA256SUMS.txt"), "w") as f:
        for name in sorted(os.listdir(DIST)):
            if name.endswith((".mcaddon", ".mcpack")):
                f.write(f"{hashlib.sha256(open(os.path.join(DIST, name), 'rb').read()).hexdigest()}  {name}\n")
    return ok


if __name__ == "__main__":
    a = build()
    print("Pacote:", os.path.relpath(a, ROOT))
    sys.exit(0 if verify(a) else 1)
