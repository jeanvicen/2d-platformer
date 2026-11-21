#!/usr/bin/env python3
"""Checagem estática do Molang do pacote de recursos (sem o jogo): parênteses balanceados,
funções math.* e consultas q.* conhecidas, ternário/strings ok, e TODA variável lida (v.x) tem que
ser escrita em algum lugar (initialize / pre_animation / na própria expressão). Pega erro de
digitação em nome de variável, que no jogo vira 0 silenciosamente."""
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "resource_pack")
MATH = {"sin", "cos", "abs", "clamp", "lerp", "min", "max", "mod", "sqrt", "pow", "floor", "ceil", "round", "random", "exp", "atan2",
        "asin", "acos", "atan", "trunc", "hermite_blend", "lerprotate", "die_roll", "die_roll_integer", "random_integer", "pi", "ln", "sign",
        "min_angle", "copy_sign", "inverse_lerp", "ease_in_out_quad"}
QUERY = {"anim_time", "life_time", "delta_time", "ground_speed", "vertical_speed", "modified_distance_moved", "modified_move_speed", "property",
         "body_y_rotation", "target_x_rotation", "target_y_rotation", "is_on_ground", "has_rider", "position_delta", "item_slot_to_bone_name",
         "is_first_person", "time_of_day", "is_moving", "is_sneaking", "is_riding", "head_y_rotation", "head_x_rotation"}


def strings(obj, out, path=""):
    if isinstance(obj, str):
        out.append((path, obj))
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("format_version", "identifier", "textures", "geometry", "materials", "render_controllers", "particle_effects", "sound_effects"):
                continue
            # chaves de estado/animação também podem ser expressões ({"anim": "condição"}): só os valores interessam
            strings(v, out, f"{path}/{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            strings(v, out, f"{path}[{i}]")


def is_molang(path, s):
    if s.startswith(("animation.", "controller.", "geometry.", "textures/", "Geometry.", "Texture.", "Material.", "Array.", "lila:", "minecraft:")):
        return False
    if path.endswith("/effect") or path.endswith("/locator") or "/particle_effects" in path or "/sound_effects" in path:
        return False
    return bool(re.search(r"[a-z]\.|[\d)][^\w]|^\-?\d", s)) or "math." in s


def main():
    exprs = []
    for d, _, fs in os.walk(ROOT):
        for f in fs:
            if not f.endswith(".json") or "/particles" in d or "/sounds" in d or "/textures" in d or "/models" in d or "/texts" in d:
                continue
            p = os.path.join(d, f)
            try:
                data = json.load(open(p, encoding="utf-8"))
            except Exception as e:
                print(f"JSON inválido {p}: {e}")
                return 1
            out = []
            strings(data, out)
            for path, s in out:
                if is_molang(path, s):
                    exprs.append((os.path.relpath(p, ROOT) + path, s))
    written, read = set(), {}
    errors = []
    for where, s in exprs:
        body = re.sub(r"'[^']*'", "''", s)
        depth = 0
        for ch in body:
            depth += ch == "("
            depth -= ch == ")"
            if depth < 0:
                break
        if depth != 0:
            errors.append(f"parênteses: {where}: {s[:90]}")
        for m in re.finditer(r"\b(math|q|query)\.(\w+)", body):
            ns, name = m.group(1), m.group(2)
            if ns == "math" and name not in MATH:
                errors.append(f"math.{name} desconhecido: {where}")
            if ns in ("q", "query") and name not in QUERY:
                errors.append(f"q.{name} desconhecido: {where}")
        for m in re.finditer(r"\b(?:v|variable)\.(\w+)\s*=(?!=)", body):
            written.add(m.group(1))
        for m in re.finditer(r"\b(?:v|variable)\.(\w+)", body):
            read.setdefault(m.group(1), where)
        if re.search(r"\?\s*:|\?\s*$|::", body):
            errors.append(f"ternário quebrado: {where}")
    builtin = {"particle_age", "particle_lifetime", "particle_random_1", "particle_random_2", "particle_random_3", "particle_random_4"}
    for name, where in sorted(read.items()):
        if name not in written and name not in builtin:
            errors.append(f"variável lida e nunca escrita: v.{name} ({where})")
    for e in errors:
        print(e)
    print(f"molang: {len(exprs)} expressões, {len(written)} variáveis, {len(errors)} problemas")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
