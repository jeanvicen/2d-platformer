#!/usr/bin/env python3
"""Loads the ECLIPSE packs into an official Bedrock Dedicated Server, captures the
content log (JSON/schema/script errors) and runs the in-world self-test.

Usage: python3 tools/bds_test/run_bds_test.py /path/to/bedrock-server-dir [--keep-world]
Requires the BDS for Linux (https://www.minecraft.net/download/server/bedrock).
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
BP = os.path.join(ROOT, "ECLIPSE_BP")
RP = os.path.join(ROOT, "ECLIPSE_RP")
WORLD = "eclipse_test"


def manifest(path):
    with open(os.path.join(path, "manifest.json"), encoding="utf-8") as f:
        m = json.load(f)
    return m["header"]["uuid"], m["header"]["version"]


def setup(server):
    for sub, src in (("behavior_packs", BP), ("resource_packs", RP)):
        dst = os.path.join(server, sub, os.path.basename(src))
        shutil.rmtree(dst, ignore_errors=True)
        shutil.copytree(src, dst)
    if "--control" in sys.argv:
        # controle: item propositalmente inválido (só na cópia do servidor) para provar que o log detecta erros
        ctl = os.path.join(server, "behavior_packs", "ECLIPSE_BP", "items", "zz_control_broken.json")
        with open(ctl, "w") as f:
            json.dump({"format_version": "1.21.90", "minecraft:item": {"description": {"identifier": "eclipse:zz_control_broken"},
                       "components": {"minecraft:this_component_does_not_exist": {"x": 1}, "minecraft:max_stack_size": "muitos"}}}, f)
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
        "server-port": "41234", "server-portv6": "41235",
    }
    for k, v in rep.items():
        if re.search(rf"^{k}=", text, re.M):
            text = re.sub(rf"^{k}=.*$", f"{k}={v}", text, flags=re.M)
        else:
            text += f"\n{k}={v}\n"
    open(props, "w", encoding="utf-8").write(text)


def main():
    server = sys.argv[1]
    setup(server)
    env = dict(os.environ, LD_LIBRARY_PATH=".")
    proc = subprocess.Popen(["./bedrock_server"], cwd=server, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, bufsize=1, env=env)
    q = queue.Queue()
    log = []

    def reader():
        for line in proc.stdout:
            log.append(line.rstrip("\n"))
            q.put(line)

    threading.Thread(target=reader, daemon=True).start()

    def wait_for(pattern, timeout):
        end = time.time() + timeout
        while time.time() < end:
            try:
                line = q.get(timeout=1)
            except queue.Empty:
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

    started = wait_for(r"Server started", 240)
    print("server started:", bool(started))
    if not started:
        time.sleep(1)
        print("\n".join(log[-30:]))
    time.sleep(5)
    send("scriptevent eclipse:diag")
    time.sleep(2)
    send("scriptevent eclipse:selftest")
    done = wait_for(r"ECLIPSE SELFTEST: \d+/\d+ PASS", 420)
    print("selftest finished:", bool(done))
    time.sleep(2)
    send("scriptevent eclipse:diag")
    time.sleep(3)
    send("stop")
    try:
        proc.wait(timeout=60)
    except subprocess.TimeoutExpired:
        proc.kill()
    out = os.path.join(ROOT, "tools", "bds_test", "last_run.log")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(log))
    errors = [l for l in log if re.search(r"\b(ERROR|WARN)\b", l) and "Content logging to console" not in l]
    print(f"log lines: {len(log)} · error/warn lines: {len(errors)}")
    for l in errors[:80]:
        print("  ", l)
    res = [l for l in log if "selftest" in l]
    for l in res:
        print(l)


if __name__ == "__main__":
    main()
