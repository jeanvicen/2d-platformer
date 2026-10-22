#!/usr/bin/env python3
"""Build the Godot 4.6 single-threaded Web preset for Vercel."""
from __future__ import annotations
import hashlib
import io
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
            raise RuntimeError("Godot release server did not return the expected byte range")
        data = response.read()
        if len(data) != end - start + 1:
            raise RuntimeError("Short response while fetching the Godot template")
        return data, response.geturl()


def install_web_templates(directory):
    # Extract only the single-threaded web templates from the 1.25 GB all-platform archive.
    names = ("web_nothreads_debug.zip", "web_nothreads_release.zip")
    tail, final_url = read_range(TEMPLATE_URL, TEMPLATE_SIZE - 65536, TEMPLATE_SIZE - 1)
    pos = tail.rfind(b"PK\x05\x06")
    if pos < 0:
        raise RuntimeError("Godot template archive has no ZIP end record")
    record = struct.unpack_from("<4s4H2LH", tail, pos)
    _, disk, cd_disk, disk_entries, total_entries, cd_size, cd_offset, comment_size = record
    if disk or cd_disk or disk_entries != total_entries or total_entries == 0xFFFF:
        raise RuntimeError("Unsupported Godot template archive format")
    if pos + 22 + comment_size != len(tail):
        raise RuntimeError("Malformed Godot template archive end record")
    central, final_url = read_range(final_url, cd_offset, cd_offset + cd_size - 1)
    entries = {}
    cursor = 0
    for _ in range(total_entries):
        if central[cursor:cursor + 4] != b"PK\x01\x02":
            raise RuntimeError("Malformed Godot template central directory")
        fields = struct.unpack_from("<4s6H3L5H2L", central, cursor)
        method, crc, compressed, uncompressed = fields[4], fields[7], fields[8], fields[9]
        name_size, extra_size, comment_len, local_offset = fields[10], fields[11], fields[12], fields[16]
        raw_name = central[cursor + 46:cursor + 46 + name_size]
        name = raw_name.decode("utf-8")
        if name in {f"templates/{n}" for n in names}:
            entries[name] = (method, crc, compressed, uncompressed, local_offset, raw_name)
        cursor += 46 + name_size + extra_size + comment_len
    if cursor != len(central) or len(entries) != len(names):
        raise RuntimeError("Official Godot single-threaded web templates are missing")
    directory.mkdir(parents=True, exist_ok=True)
    for filename in names:
        method, crc, compressed, uncompressed, local_offset, raw_name = entries[f"templates/{filename}"]
        header, final_url = read_range(final_url, local_offset, local_offset + 255)
        local = struct.unpack_from("<4s5H3L2H", header, 0)
        name_len, extra_len = local[9], local[10]
        if local[0] != b"PK\x03\x04" or header[30:30 + name_len] != raw_name:
            raise RuntimeError("Godot template local ZIP header failed validation")
        data_start = local_offset + 30 + name_len + extra_len
        payload, final_url = read_range(final_url, data_start, data_start + compressed - 1)
        if method == 8:
            template = zlib.decompress(payload, -15)
        elif method == 0:
            template = payload
        else:
            raise RuntimeError(f"Unsupported Godot template compression method: {method}")
        if len(template) != uncompressed or (zlib.crc32(template) & 0xFFFFFFFF) != crc:
            raise RuntimeError(f"Godot template failed size/CRC validation: {filename}")
        with zipfile.ZipFile(io.BytesIO(template)) as archive:
            if archive.testzip() is not None:
                raise RuntimeError(f"Godot template ZIP integrity check failed: {filename}")
        (directory / filename).write_bytes(template)
        print(f"Installed {filename}: {len(template):,} bytes", flush=True)


def main():
    preset_path = ROOT / "export_presets.cfg"
    if not (ROOT / "project.godot").is_file() or not preset_path.is_file():
        raise RuntimeError("Godot project files or Web export preset are missing")
    preset = preset_path.read_text(encoding="utf-8")
    if 'name="Web"' not in preset or "variant/thread_support=false" not in preset:
        raise RuntimeError("Expected the Web preset with thread support disabled")
    with tempfile.TemporaryDirectory(prefix="godot-vercel-") as tmp:
        temp = Path(tmp)
        linux_zip = temp / LINUX_NAME
        print("Downloading official Godot 4.6 Linux editor…", flush=True)
        with open_url(LINUX_URL) as response, linux_zip.open("wb") as output:
            shutil.copyfileobj(response, output, length=1024 * 1024)
        digest = hashlib.sha512()
        with linux_zip.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != LINUX_SHA512:
            raise RuntimeError("Godot Linux editor failed official SHA-512 validation")
        godot = temp / f"Godot_v{VERSION}_linux.x86_64"
        with zipfile.ZipFile(linux_zip) as archive:
            with archive.open(f"Godot_v{VERSION}_linux.x86_64") as source, godot.open("wb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)
        godot.chmod(godot.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        template_dir = Path.home() / ".local/share/godot/export_templates/4.6.stable"
        install_web_templates(template_dir)
        shutil.rmtree(OUTPUT, ignore_errors=True)
        OUTPUT.mkdir(parents=True)
        subprocess.run([str(godot), "--headless", "--path", str(ROOT), "--export-release", "Web", str(OUTPUT / "index.html")], cwd=ROOT, check=True)
        files = [path for path in OUTPUT.iterdir() if path.is_file()]
        if not (OUTPUT / "index.html").is_file() or (OUTPUT / "index.html").stat().st_size < 1000:
            raise RuntimeError("Godot did not generate a valid game index.html")
        if not any(path.suffix == ".wasm" for path in files) or not any(path.suffix == ".pck" for path in files):
            raise RuntimeError("Web export is missing the WASM engine or game PCK resources")
        for path in sorted(files):
            print(f"{path.name}: {path.stat().st_size:,} bytes", flush=True)
        print(f"Total Web export: {sum(path.stat().st_size for path in files):,} bytes", flush=True)


if __name__ == "__main__":
    main()
