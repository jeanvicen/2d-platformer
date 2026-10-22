#!/usr/bin/env python3
"""Build a pinned Godot 4.6 Web export for Vercel without downloading all export templates."""
from __future__ import annotations
import hashlib
import shutil
import stat
import struct
import subprocess
import tempfile
import urllib.request
import zipfile
import zlib
from pathlib import Path

VERSION = "4.6-stable"
RELEASE = f"https://github.com/godotengine/godot/releases/download/{VERSION}"
LINUX_NAME = f"Godot_v{VERSION}_linux.x86_64.zip"
LINUX_URL = f"{RELEASE}/{LINUX_NAME}"
LINUX_SHA512 = "0c1bc5e8dca8f892a9a5fd0628b742f399fbd520e5f0051ecac021c0aa4ea5a8f0d237c8ed6b767b2afda7f7a4b32001118f1b04a82e335a5e35b947a1217940"
TEMPLATE_URL = f"{RELEASE}/Godot_v{VERSION}_export_templates.tpz"
TEMPLATE_SIZE = 1_251_639_300
ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "dist"


def open_url(url, byte_range=None):
    headers = {"User-Agent": "Godot-Vercel-Web-Exporter/1.0"}
    if byte_range is not None:
        headers["Range"] = f"bytes={byte_range[0]}-{byte_range[1]}"
    return urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=180)


def read_range(url, start, end):
    if start < 0 or end < start or end >= TEMPLATE_SIZE:
        raise RuntimeError("Invalid range in the official Godot template archive")
    with open_url(url, (start, end)) as response:
        expected = f"bytes {start}-{end}/{TEMPLATE_SIZE}"
        if response.status != 206 or response.headers.get("Content-Range") != expected:
            raise RuntimeError("The official Godot release server did not return the expected byte range")
        data = response.read()
        if len(data) != end - start + 1:
            raise RuntimeError("Short response while downloading the Godot Web template")
        return data, response.geturl()


def install_web_template(path):
    # Fetch the ZIP directory and the web template bytes only; skip ~1.24 GB of other platforms.
    tail, final_url = read_range(TEMPLATE_URL, TEMPLATE_SIZE - 65536, TEMPLATE_SIZE - 1)
    pos = tail.rfind(b"PK\x05\x06")
    if pos < 0:
        raise RuntimeError("Godot template archive has no ZIP end record")
    record = struct.unpack_from("<4s4H2LH", tail, pos)
    _, disk, cd_disk, disk_entries, total_entries, cd_size, cd_offset, comment_size = record
    if disk or cd_disk or disk_entries != total_entries or total_entries == 0xFFFF:
        raise RuntimeError("Unsupported format in Godot template archive")
    if pos + 22 + comment_size != len(tail):
        raise RuntimeError("Malformed end record in Godot template archive")
    central, final_url = read_range(final_url, cd_offset, cd_offset + cd_size - 1)
    cursor = 0
    entry = None
    for _ in range(total_entries):
        if central[cursor:cursor + 4] != b"PK\x01\x02":
            raise RuntimeError("Malformed Godot template central directory")
        fields = struct.unpack_from("<4s6H3L5H2L", central, cursor)
        method, crc, compressed, uncompressed = fields[4], fields[7], fields[8], fields[9]
        name_size, extra_size, comment_len, local_offset = fields[10], fields[11], fields[12], fields[16]
        name = central[cursor + 46:cursor + 46 + name_size]
        if name.decode("utf-8") == "templates/web_release.zip":
            entry = method, crc, compressed, uncompressed, local_offset, name
        cursor += 46 + name_size + extra_size + comment_len
    if cursor != len(central) or entry is None:
        raise RuntimeError("Could not locate the official web_release.zip template")
    method, crc, compressed, uncompressed, local_offset, name = entry
    header, final_url = read_range(final_url, local_offset, local_offset + 255)
    local = struct.unpack_from("<4s5H3L2H", header, 0)
    name_len, extra_len = local[9], local[10]
    if local[0] != b"PK\x03\x04" or header[30:30 + name_len] != name:
        raise RuntimeError("Godot template local ZIP header failed validation")
    data_start = local_offset + 30 + name_len + extra_len
    payload, _ = read_range(final_url, data_start, data_start + compressed - 1)
    if method == 8:
        template = zlib.decompress(payload, -15)
    elif method == 0:
        template = payload
    else:
        raise RuntimeError(f"Unsupported ZIP compression method: {method}")
    if len(template) != uncompressed or zlib.crc32(template) & 0xFFFFFFFF != crc:
        raise RuntimeError("Godot Web template failed CRC or size validation")
    import io
    with zipfile.ZipFile(io.BytesIO(template)) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("The Godot Web template ZIP failed integrity validation")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(template)
    print(f"Installed official web_release.zip ({len(template):,} bytes)", flush=True)


def main():
    if not (ROOT / "project.godot").is_file() or not (ROOT / "export_presets.cfg").is_file():
        raise RuntimeError("The Godot project or Web export preset is missing")
    if 'name="Web"' not in (ROOT / "export_presets.cfg").read_text(encoding="utf-8"):
        raise RuntimeError("The export preset named Web is missing")
    with tempfile.TemporaryDirectory(prefix="godot-vercel-") as tmp:
        temp = Path(tmp)
        linux_zip = temp / LINUX_NAME
        print("Downloading the official Godot 4.6 Linux editor…", flush=True)
        with open_url(LINUX_URL) as response, linux_zip.open("wb") as out:
            shutil.copyfileobj(response, out, length=1024 * 1024)
        digest = hashlib.sha512()
        with linux_zip.open("rb") as archive_file:
            for chunk in iter(lambda: archive_file.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != LINUX_SHA512:
            raise RuntimeError("Godot Linux editor archive failed SHA-512 validation")
        godot = temp / f"Godot_v{VERSION}_linux.x86_64"
        with zipfile.ZipFile(linux_zip) as archive:
            member = f"Godot_v{VERSION}_linux.x86_64"
            with archive.open(member) as src, godot.open("wb") as out:
                shutil.copyfileobj(src, out, length=1024 * 1024)
        godot.chmod(godot.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        template = Path.home() / ".local/share/godot/export_templates/4.6.stable/web_release.zip"
        install_web_template(template)
        shutil.rmtree(OUTPUT, ignore_errors=True)
        OUTPUT.mkdir(parents=True)
        subprocess.run([str(godot), "--headless", "--path", str(ROOT), "--export-release", "Web", str(OUTPUT / "index.html")], cwd=ROOT, check=True)
        html = OUTPUT / "index.html"
        files = [p for p in OUTPUT.iterdir() if p.is_file()]
        if not html.is_file() or html.stat().st_size < 1000:
            raise RuntimeError("Godot did not generate a valid game index.html")
        if not any(p.suffix == ".wasm" for p in files) or not any(p.suffix == ".pck" for p in files):
            raise RuntimeError("The Web export is missing its WASM engine or game resources")
        for path in sorted(files):
            print(f"{path.name}: {path.stat().st_size:,} bytes", flush=True)
        print(f"Total export: {sum(p.stat().st_size for p in files):,} bytes", flush=True)


if __name__ == "__main__":
    main()
