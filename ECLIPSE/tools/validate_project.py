#!/usr/bin/env python3
"""Static validation of the ECLIPSE packs.

Checks JSON syntax, manifests, cross-references between every file
(entities ↔ client entities ↔ geometry ↔ animations ↔ bones ↔ textures,
attachables, particles, sounds, item icons, block textures, loot tables,
recipes, lang keys), Molang query names, script imports and texture sizes.
Exit code 0 = no errors (warnings are printed but do not fail).
"""
from __future__ import annotations

import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "ECLIPSE_BP")
RP = os.path.join(ROOT, "ECLIPSE_RP")
errors: list[str] = []
warnings: list[str] = []

VANILLA_SOUNDS = {
    "mob.wolf.growl", "mob.wolf.hurt", "mob.wolf.death", "mob.wolf.step", "mob.cat.purr", "mob.cat.hit", "mob.cat.hiss",
    "mob.irongolem.walk", "mob.irongolem.hit", "mob.irongolem.death", "mob.enderdragon.growl", "mob.enderdragon.hit",
    "mob.parrot.idle", "mob.parrot.hurt", "mob.parrot.death", "mob.chicken.step", "mob.silverfish.say", "mob.silverfish.hit",
    "mob.silverfish.kill", "mob.silverfish.step", "mob.goat.ambient", "mob.goat.hurt", "mob.goat.death", "mob.goat.step",
    "mob.dolphin.idle", "mob.dolphin.hurt", "mob.dolphin.death", "random.anvil_land", "random.explode", "game.player.hurt",
    "step.cloth", "dig.wood", "dig.stone", "dig.grass", "use.wood", "use.stone", "random.eat", "item.trident.hit_ground",
    "item.book.page_turn", "bow.hit",
}
KNOWN_QUERIES = {
    "anim_time", "modified_distance_moved", "modified_move_speed", "ground_speed", "is_on_ground", "vertical_speed",
    "yaw_speed", "target_x_rotation", "target_y_rotation", "property", "all_animations_finished", "life_time",
    "delta_time", "is_sprinting", "main_hand_item_use_duration", "main_hand_item_max_duration", "frame_alpha",
}
KNOWN_CONTEXT = {"is_first_person", "item_slot"}
KNOWN_VANILLA_RC = {"controller.render.item_default", "controller.render.armor"}


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        errors.append(f"JSON inválido: {os.path.relpath(path, ROOT)}: {e}")
        return None


def walk(base, ext):
    for d, _, files in os.walk(base):
        for f in files:
            if f.endswith(ext):
                yield os.path.join(d, f)


def rel(p):
    return os.path.relpath(p, ROOT)


def main():
    # ---------------------------------------------------------------- JSON
    jsons = {p: load(p) for p in list(walk(BP, ".json")) + list(walk(RP, ".json"))}
    # ---------------------------------------------------------------- manifests
    bpm, rpm = jsons.get(os.path.join(BP, "manifest.json")), jsons.get(os.path.join(RP, "manifest.json"))
    uuids = []
    for m in (bpm, rpm):
        uuids.append(m["header"]["uuid"])
        uuids += [x["uuid"] for x in m["modules"]]
    if len(set(uuids)) != len(uuids):
        errors.append("UUIDs repetidos nos manifests")
    if not any(d.get("uuid") == rpm["header"]["uuid"] for d in bpm["dependencies"]):
        errors.append("BP não depende do RP")
    if not any(d.get("uuid") == bpm["header"]["uuid"] for d in rpm["dependencies"]):
        errors.append("RP não depende do BP")
    script_mod = [x for x in bpm["modules"] if x["type"] == "script"][0]
    if not os.path.exists(os.path.join(BP, script_mod["entry"])):
        errors.append("entry do script não existe")
    deps = {d.get("module_name"): d.get("version") for d in bpm["dependencies"] if "module_name" in d}
    for mod, ver in deps.items():
        if not re.fullmatch(r"\d+\.\d+\.\d+", ver):
            errors.append(f"versão não fixa/estável para {mod}: {ver}")
    # ---------------------------------------------------------------- RP indexes
    geos = {}
    for p in walk(os.path.join(RP, "models"), ".json"):
        for g in (jsons[p] or {}).get("minecraft:geometry", []):
            ident = g["description"]["identifier"]
            if ident in geos:
                errors.append(f"geometria duplicada {ident}")
            bones = {b["name"] for b in g.get("bones", [])}
            for b in g.get("bones", []):
                if b.get("parent") and b["parent"] not in bones:
                    errors.append(f"{ident}: osso {b['name']} com pai inexistente {b['parent']}")
            geos[ident] = {"bones": bones, "tw": g["description"]["texture_width"], "th": g["description"]["texture_height"], "file": p}
    anims = {}
    for p in walk(os.path.join(RP, "animations"), ".json"):
        for k, v in (jsons[p] or {}).get("animations", {}).items():
            anims[k] = v
    ctrls = {}
    for p in walk(os.path.join(RP, "animation_controllers"), ".json"):
        for k, v in (jsons[p] or {}).get("animation_controllers", {}).items():
            ctrls[k] = v
    rcs = set((jsons.get(os.path.join(RP, "render_controllers", "eclipse.render_controllers.json")) or {}).get("render_controllers", {}).keys())
    particles = {}
    for p in walk(os.path.join(RP, "particles"), ".json"):
        d = jsons[p]["particle_effect"]["description"]
        particles[d["identifier"]] = d
        tex = os.path.join(RP, d["basic_render_parameters"]["texture"] + ".png")
        if not os.path.exists(tex):
            errors.append(f"partícula {d['identifier']}: textura inexistente")
    sdefs = set(jsons[os.path.join(RP, "sounds", "sound_definitions.json")]["sound_definitions"].keys())
    for k, v in jsons[os.path.join(RP, "sounds", "sound_definitions.json")]["sound_definitions"].items():
        for s in v["sounds"]:
            if not os.path.exists(os.path.join(RP, s["name"] + ".ogg")):
                errors.append(f"som {k}: arquivo {s['name']}.ogg inexistente")
    item_tex = jsons[os.path.join(RP, "textures", "item_texture.json")]["texture_data"]
    for k, v in item_tex.items():
        if not os.path.exists(os.path.join(RP, v["textures"] + ".png")):
            errors.append(f"ícone {k}: png inexistente")
    terrain = jsons[os.path.join(RP, "textures", "terrain_texture.json")]["texture_data"]
    lang = {}
    with open(os.path.join(RP, "texts", "pt_BR.lang"), encoding="utf-8") as f:
        for line in f:
            if "=" in line:
                k, v = line.rstrip("\n").split("=", 1)
                lang[k] = v

    def check_molang(where, value):
        if isinstance(value, dict):
            for v in value.values():
                check_molang(where, v)
        elif isinstance(value, list):
            for v in value:
                check_molang(where, v)
        elif isinstance(value, str):
            for q in re.findall(r"\b(?:q|query)\.([a-z_]+)", value):
                if q not in KNOWN_QUERIES:
                    errors.append(f"{where}: query desconhecida q.{q}")
            for c in re.findall(r"\b(?:c|context)\.([a-z_]+)", value):
                if c not in KNOWN_CONTEXT:
                    errors.append(f"{where}: contexto desconhecido c.{c}")
            if value.count("(") != value.count(")"):
                errors.append(f"{where}: parênteses desbalanceados em '{value[:60]}'")

    def check_anim_bones(owner, anim_id, bones):
        a = anims.get(anim_id)
        if a is None:
            errors.append(f"{owner}: animação inexistente {anim_id}")
            return
        for b in a.get("bones", {}):
            if b not in bones:
                errors.append(f"{owner}: {anim_id} anima osso inexistente '{b}'")
        check_molang(f"{owner}:{anim_id}", a.get("bones", {}))
        for pe in a.get("particle_effects", []) if isinstance(a.get("particle_effects"), list) else []:
            pass

    def check_render_desc(owner, desc, kind):
        for gk, gid in desc.get("geometry", {}).items():
            if gid not in geos:
                errors.append(f"{owner}: geometria inexistente {gid}")
        bones = set()
        for gid in desc.get("geometry", {}).values():
            bones |= geos.get(gid, {}).get("bones", set())
        for tk, tp in desc.get("textures", {}).items():
            if tp.startswith("textures/misc/"):
                continue
            path = os.path.join(RP, tp + ".png")
            if not os.path.exists(path):
                errors.append(f"{owner}: textura inexistente {tp}")
            else:
                for gid in desc.get("geometry", {}).values():
                    g = geos.get(gid)
                    if g:
                        w, h = Image.open(path).size
                        if abs(w / h - g["tw"] / g["th"]) > 1e-6:
                            errors.append(f"{owner}: proporção da textura {w}x{h} ≠ geometria {g['tw']}x{g['th']}")
        amap = desc.get("animations", {})
        for short, aid in amap.items():
            if aid.startswith("controller."):
                c = ctrls.get(aid)
                if c is None:
                    errors.append(f"{owner}: controller inexistente {aid}")
                    continue
                for st, sd in c["states"].items():
                    for an in sd.get("animations", []):
                        name = an if isinstance(an, str) else list(an.keys())[0]
                        if name not in amap:
                            errors.append(f"{owner}: controller {aid} estado {st} usa '{name}' não mapeada")
                    for tr in sd.get("transitions", []):
                        for target, expr in tr.items():
                            if target not in c["states"]:
                                errors.append(f"{owner}: {aid} transição para estado inexistente {target}")
                            check_molang(f"{owner}:{aid}", expr)
            else:
                check_anim_bones(owner, aid, bones)
                a = anims.get(aid, {})
                for pe in a.get("particle_effects", []):
                    if pe["effect"] not in desc.get("particle_effects", {}):
                        errors.append(f"{owner}: {aid} usa efeito '{pe['effect']}' não declarado")
                    loc = pe.get("locator")
                    if loc:
                        found = any(loc in (b.get("locators") or {}) for gid in desc.get("geometry", {}).values()
                                    for g in jsons[geos[gid]["file"]]["minecraft:geometry"] for b in g["bones"]) if desc.get("geometry") else False
                        if not found:
                            warnings.append(f"{owner}: {aid} locator '{loc}' não existe na geometria (efeito sai na origem)")
                for se in a.get("sound_effects", []):
                    if se["effect"] not in desc.get("sound_effects", {}):
                        errors.append(f"{owner}: {aid} usa som '{se['effect']}' não declarado")
        for scr in desc.get("scripts", {}).get("animate", []):
            name = scr if isinstance(scr, str) else list(scr.keys())[0]
            if name not in amap:
                errors.append(f"{owner}: scripts.animate usa '{name}' não mapeada")
            if isinstance(scr, dict):
                check_molang(owner, list(scr.values())[0])
        for rc in desc.get("render_controllers", []):
            name = rc if isinstance(rc, str) else list(rc.keys())[0]
            if name not in rcs and name not in KNOWN_VANILLA_RC:
                errors.append(f"{owner}: render controller inexistente {name}")
        for k, pid in desc.get("particle_effects", {}).items():
            if pid not in particles:
                errors.append(f"{owner}: partícula inexistente {pid}")
        for k, sid in desc.get("sound_effects", {}).items():
            if sid not in sdefs and sid not in VANILLA_SOUNDS:
                errors.append(f"{owner}: som inexistente {sid}")

    # ---------------------------------------------------------------- client entities
    client_ids = set()
    for p in walk(os.path.join(RP, "entity"), ".json"):
        d = jsons[p]["minecraft:client_entity"]["description"]
        client_ids.add(d["identifier"])
        check_render_desc(rel(p), d, "entity")
    # ---------------------------------------------------------------- attachables
    for p in walk(os.path.join(RP, "attachables"), ".json"):
        d = jsons[p]["minecraft:attachable"]["description"]
        check_render_desc(rel(p), d, "attachable")
        if not os.path.exists(os.path.join(BP, "items", d["identifier"].split(":")[1] + ".json")):
            errors.append(f"{rel(p)}: attachable sem item correspondente {d['identifier']}")
    # ---------------------------------------------------------------- BP entities
    bp_ids = set()
    for p in walk(os.path.join(BP, "entities"), ".json"):
        e = jsons[p]["minecraft:entity"]
        ident = e["description"]["identifier"]
        bp_ids.add(ident)
        if ident not in client_ids:
            errors.append(f"{rel(p)}: sem client entity no RP")
        groups = set(e.get("component_groups", {}).keys())
        for ev_name, ev in e.get("events", {}).items():
            txt = json.dumps(ev)
            for g in re.findall(r'"component_groups": \[([^\]]*)\]', txt):
                for name in re.findall(r'"([^"]+)"', g):
                    if name not in groups:
                        errors.append(f"{ident}: evento {ev_name} usa grupo inexistente {name}")
            for prop in re.findall(r'"set_property": \{"([^"]+)"', txt):
                if prop not in e["description"].get("properties", {}):
                    errors.append(f"{ident}: evento {ev_name} altera propriedade inexistente {prop}")
        if f"entity.{ident}.name" not in lang:
            warnings.append(f"{ident}: sem nome no .lang")
    for cid in client_ids - bp_ids:
        errors.append(f"client entity sem comportamento: {cid}")
    # ---------------------------------------------------------------- items
    item_ids = set()
    scripts_src = "\n".join(open(p, encoding="utf-8").read() for p in walk(os.path.join(BP, "scripts"), ".js"))
    for p in walk(os.path.join(BP, "items"), ".json"):
        it = jsons[p]["minecraft:item"]
        ident = it["description"]["identifier"]
        item_ids.add(ident)
        icon = it["components"].get("minecraft:icon")
        if isinstance(icon, dict):
            icon = icon.get("textures", {}).get("default")
        if icon not in item_tex:
            errors.append(f"{ident}: ícone '{icon}' não existe em item_texture.json")
        for comp in it["components"]:
            if comp.startswith("eclipse:") and f'registerCustomComponent("{comp}"' not in scripts_src:
                errors.append(f"{ident}: componente customizado {comp} não registrado nos scripts")
    # ---------------------------------------------------------------- blocks
    for p in walk(os.path.join(BP, "blocks"), ".json"):
        b = jsons[p]["minecraft:block"]
        ident = b["description"]["identifier"]
        for k, mi in b["components"]["minecraft:material_instances"].items():
            if mi["texture"] not in terrain:
                errors.append(f"{ident}: textura de bloco '{mi['texture']}' fora do terrain_texture.json")
        loot = b["components"].get("minecraft:loot")
        if loot and not os.path.exists(os.path.join(BP, loot)):
            errors.append(f"{ident}: loot table inexistente {loot}")
        for comp in b["components"]:
            if comp.startswith("eclipse:") and f'registerCustomComponent("{comp}"' not in scripts_src:
                errors.append(f"{ident}: componente customizado {comp} não registrado")
    for k, v in terrain.items():
        if not os.path.exists(os.path.join(RP, v["textures"] + ".png")):
            errors.append(f"terrain {k}: png inexistente")
    # ---------------------------------------------------------------- recipes
    for p in walk(os.path.join(BP, "recipes"), ".json"):
        txt = json.dumps(jsons[p])
        for ident in re.findall(r'"item": "(eclipse:[a-z_]+)"', txt):
            if ident not in item_ids:
                errors.append(f"{rel(p)}: item inexistente {ident}")
    # ---------------------------------------------------------------- scripts
    for p in walk(os.path.join(BP, "scripts"), ".js"):
        src = open(p, encoding="utf-8").read()
        for imp in re.findall(r'from\s+"([^"]+)"', src):
            if imp.startswith("."):
                target = os.path.normpath(os.path.join(os.path.dirname(p), imp))
                if not os.path.exists(target):
                    errors.append(f"{rel(p)}: import inexistente {imp}")
            elif imp not in deps:
                errors.append(f"{rel(p)}: módulo externo não declarado no manifest {imp}")
        for ident in set(re.findall(r'"(eclipse:[a-z_]+)"', src)):
            known = item_ids | bp_ids | set(particles) | {f"eclipse:{os.path.basename(x)[:-5]}" for x in walk(os.path.join(BP, "blocks"), ".json")}
            if ident in known:
                continue
            # chaves de dynamic property, eventos de entidade, componentes e comandos também usam o prefixo
            if re.search(rf'(DynamicProperty|getProperty|setProperty|triggerEvent|registerCustomComponent|name:|id ===|\bid:)\s*\(?\s*"?{re.escape(ident)}', src) or ident.startswith(("eclipse:state", "eclipse:phase", "eclipse:element", "eclipse:spin", "eclipse:act", "eclipse:script")):
                continue
            warnings.append(f"{rel(p)}: identificador {ident} não corresponde a item/entidade/partícula (ok se for chave interna)")
        for snd in set(re.findall(r'(?:playerSound|sound)\([^,]*?,\s*"([a-z0-9_.]+)"', src)):
            if snd not in sdefs and snd not in VANILLA_SOUNDS:
                errors.append(f"{rel(p)}: som desconhecido {snd}")
        for pid in set(re.findall(r'"(eclipse:[a-z_]+)"', src)):
            pass
    # partículas usadas pelos scripts
    for pid in set(re.findall(r'(?:particle|playerParticle|groundRune)\([^,]*?,\s*"(eclipse:[a-z_]+)"', scripts_src)):
        if pid not in particles:
            errors.append(f"scripts: partícula inexistente {pid}")
    # ---------------------------------------------------------------- report
    for w in warnings:
        print("AVISO:", w)
    for e in errors:
        print("ERRO:", e)
    print(f"\nArquivos JSON: {len(jsons)} · geometrias: {len(geos)} · animações: {len(anims)} · controllers: {len(ctrls)} · "
          f"partículas: {len(particles)} · sons: {len(sdefs)} · itens: {len(item_ids)} · entidades: {len(bp_ids)}")
    print(f"Resultado: {len(errors)} erro(s), {len(warnings)} aviso(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
