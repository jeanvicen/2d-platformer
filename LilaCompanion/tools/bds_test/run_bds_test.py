#!/usr/bin/env python3
"""Carrega os pacotes da Lila num Bedrock Dedicated Server oficial, captura o content log
(erros de JSON/esquema/script) e roda o autoteste dentro do mundo (/scriptevent lila:selftest).

Uso: python3 tools/bds_test/run_bds_test.py /caminho/do/bedrock-server [quick] [--keep-world]
Variável opcional LILA_BDS_PRELOAD: biblioteca LD_PRELOAD (ex.: shim IPv6->IPv4 em containers sem IPv6).
"""
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BP = os.path.join(ROOT, "behavior_pack")
RP = os.path.join(ROOT, "resource_pack")
WORLD = "lila_test"


def manifest(path):
    with open(os.path.join(path, "manifest.json"), encoding="utf-8") as f:
        m = json.load(f)
    return m["header"]["uuid"], m["header"]["version"]


def setup(server):
    for sub, src, name in (("behavior_packs", BP, "LilaCompanion_BP"), ("resource_packs", RP, "LilaCompanion_RP")):
        dst = os.path.join(server, sub, name)
        shutil.rmtree(dst, ignore_errors=True)
        shutil.copytree(src, dst)
    wdir = os.path.join(server, "worlds", WORLD)
    if "--keep-world" not in sys.argv:
        shutil.rmtree(wdir, ignore_errors=True)
    os.makedirs(wdir, exist_ok=True)
    bu, bv = manifest(BP)
    ru, rv = manifest(RP)
    with open(os.path.join(wdir, "world_behavior_packs.json"), "w") as f:
        json.dump([{"pack_id": bu, "version": bv}], f)
    with open(os.path.join(wdir, "world_resource_packs.json"), "w") as f:
        json.dump([{"pack_id": ru, "version": rv}], f)
    props = os.path.join(server, "server.properties")
    text = open(props, encoding="utf-8").read()
    rep = {
        "level-name": WORLD, "online-mode": "false", "enable-lan-visibility": "false",
        "content-log-console-output-enabled": "true", "content-log-file-enabled": "true",
        "content-log-level": "info", "allow-cheats": "true", "allow-list": "false",
        "server-port": "41234", "server-portv6": "41235", "transport": "nethernet",
    }
    for k, v in rep.items():
        if re.search(rf"^{k}=", text, re.M):
            text = re.sub(rf"^{k}=.*$", f"{k}={v}", text, flags=re.M)
        else:
            text += f"\n{k}={v}\n"
    open(props, "w", encoding="utf-8").write(text)


HARNESS = os.path.join(ROOT, "tests", "harness_bp")


def enable_experiments(server):
    """Liga 'Beta APIs' (GameTest) só no mundo de teste, para o jogador simulado."""
    import io
    import struct
    import nbtlib
    path = os.path.join(server, "worlds", WORLD, "level.dat")
    raw = open(path, "rb").read()
    ver = struct.unpack("<i", raw[:4])[0]
    nbt = nbtlib.File.parse(io.BytesIO(raw[8:]), byteorder="little")
    exp = nbt.get("experiments") or nbtlib.Compound()
    for k in ("gametest", "experiments_ever_used", "saved_with_toggled_experiments"):
        exp[k] = nbtlib.Byte(1)
    nbt["experiments"] = exp
    buf = io.BytesIO()
    nbt.write(buf, byteorder="little")
    body = buf.getvalue()
    open(path, "wb").write(struct.pack("<ii", ver, len(body)) + body)


def boot_and_stop(server, env):
    p = subprocess.Popen(["./bedrock_server"], cwd=server, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.STDOUT, text=True, bufsize=1, env=env)
    for line in p.stdout:
        if "Server started" in line:
            p.stdin.write("stop\n")
            p.stdin.flush()
    p.wait(timeout=120)


def main():
    server = sys.argv[1]
    mode = "quick" if "quick" in sys.argv else ""
    if "owner" in sys.argv:
        mode = "owner"
    setup(server)
    env = dict(os.environ, LD_LIBRARY_PATH=".")
    if os.environ.get("LILA_BDS_PRELOAD"):
        env["LD_PRELOAD"] = os.environ["LILA_BDS_PRELOAD"]
    if mode == "owner":
        dst = os.path.join(server, "behavior_packs", "LilaTestHarness")
        shutil.rmtree(dst, ignore_errors=True)
        shutil.copytree(HARNESS, dst)
        boot_and_stop(server, env)
        enable_experiments(server)
        hu, hv = manifest(HARNESS)
        wbp = os.path.join(server, "worlds", WORLD, "world_behavior_packs.json")
        packs = json.load(open(wbp))
        packs.append({"pack_id": hu, "version": hv})
        json.dump(packs, open(wbp, "w"))
    proc = subprocess.Popen(["./bedrock_server"], cwd=server, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, bufsize=1, env=env)
    q = queue.Queue()
    log = []

    def reader():
        for line in proc.stdout:
            log.append(line.rstrip("\n"))
            q.put(line)
            if "LILA-TEST" in line or "LILA-HARNESS" in line or "[Lila:" in line:
                print(line.rstrip("\n"), flush=True)

    threading.Thread(target=reader, daemon=True).start()

    def wait_for(pattern, timeout):
        end = time.time() + timeout
        while time.time() < end:
            try:
                line = q.get(timeout=1)
            except queue.Empty:
                if proc.poll() is not None:
                    return None
                continue
            if re.search(pattern, line):
                return line
        return None

    def send(cmd):
        if proc.poll() is not None:
            return False
        try:
            proc.stdin.write(cmd + "\n")
            proc.stdin.flush()
            return True
        except BrokenPipeError:
            return False

    started = wait_for(r"Server started", 300)
    print("server started:", bool(started), flush=True)
    if not started:
        print("\n".join(log[-40:]))
    time.sleep(5)
    send(f"scriptevent lila:selftest {mode}".strip())
    done = wait_for(r"LILA-TEST DONE", 3300)
    print("selftest finished:", bool(done), flush=True)
    time.sleep(2)
    send("stop")
    try:
        proc.wait(timeout=60)
    except subprocess.TimeoutExpired:
        proc.kill()
    out = os.path.join(ROOT, "tests", "last_bds_run.log")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(log))
    errors = [l for l in log if re.search(r"\b(ERROR|WARN)\b|\[Lila:", l) and "Content logging to console" not in l]
    print(f"log lines: {len(log)} · error/warn/lila lines: {len(errors)}")
    for l in errors[:120]:
        print("  ", l)
    sys.exit(0 if done and "fail=0" in done else 1)


if __name__ == "__main__":
    main()
