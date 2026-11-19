#!/usr/bin/env python3
"""Validação estática cruzada dos pacotes (sem o jogo):
- JSON válido em todos os arquivos
- manifests: UUIDs únicos, dependências BP<->RP, módulos de script
- client entity: geometria, textura, animações e controladores existem
- animações só animam ossos que existem na geometria
- controladores só usam animações declaradas na entidade
- item: ícone registrado em item_texture.json e PNG presente; anexo (attachable) válido
- partículas: textura existe
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BP = os.path.join(ROOT, "behavior_pack")
RP = os.path.join(ROOT, "resource_pack")
errors = []


def load(p):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        errors.append(f"JSON inválido: {os.path.relpath(p, ROOT)}: {e}")
        return None


def walk(base, ext=".json"):
    for d, _, fs in os.walk(base):
        for f in fs:
            if f.endswith(ext):
                yield os.path.join(d, f)


jsons = {p: load(p) for base in (BP, RP) for p in walk(base) if "/scripts/" not in p}
jsons = {p: (j if isinstance(j, dict) else None) for p, j in jsons.items()}

# manifests
mb, mr = jsons[os.path.join(BP, "manifest.json")], jsons[os.path.join(RP, "manifest.json")]
uuids = [mb["header"]["uuid"], mr["header"]["uuid"]] + [m["uuid"] for m in mb["modules"] + mr["modules"]]
if len(set(uuids)) != len(uuids):
    errors.append("UUIDs repetidos nos manifests")
if not any(d.get("uuid") == mr["header"]["uuid"] for d in mb["dependencies"]):
    errors.append("BP não depende do RP")
if not any(d.get("uuid") == mb["header"]["uuid"] for d in mr["dependencies"]):
    errors.append("RP não depende do BP")
script = [m for m in mb["modules"] if m["type"] == "script"]
if not script or not os.path.exists(os.path.join(BP, script[0]["entry"])):
    errors.append("módulo de script sem entry")

# geometrias
geos = {}
for p, j in jsons.items():
    if j and "minecraft:geometry" in j:
        for g in j["minecraft:geometry"]:
            geos[g["description"]["identifier"]] = {b["name"] for b in g.get("bones", [])}
            names = [b["name"] for b in g.get("bones", [])]
            for b in g.get("bones", []):
                if b.get("parent") and b["parent"] not in names:
                    errors.append(f"{g['description']['identifier']}: osso {b['name']} com pai inexistente {b['parent']}")

anims = {}
for p, j in jsons.items():
    if j and "animations" in j and "format_version" in j and isinstance(j["animations"], dict) and "minecraft:client_entity" not in j:
        anims.update(j["animations"])
ctrls = {}
for p, j in jsons.items():
    if j and "animation_controllers" in j:
        ctrls.update(j["animation_controllers"])


def tex_exists(rel):
    return any(os.path.exists(os.path.join(RP, rel + e)) for e in (".png", ".tga")) or rel.startswith("textures/misc/")


def check_actor(desc, kind):
    ident = desc["identifier"]
    for g in desc.get("geometry", {}).values():
        if g not in geos:
            errors.append(f"{kind} {ident}: geometria {g} não existe")
    for t in desc.get("textures", {}).values():
        if not tex_exists(t):
            errors.append(f"{kind} {ident}: textura {t} não existe")
    amap = desc.get("animations", {})
    bones = set().union(*[geos.get(g, set()) for g in desc.get("geometry", {}).values()]) if desc.get("geometry") else set()
    for short, full in amap.items():
        if full.startswith("controller."):
            if full not in ctrls:
                errors.append(f"{kind} {ident}: controlador {full} não existe")
                continue
            for st in ctrls[full]["states"].values():
                for a in st.get("animations", []):
                    a = a if isinstance(a, str) else list(a.keys())[0]
                    if a not in amap:
                        errors.append(f"{full}: usa animação '{a}' não declarada em {ident}")
                for tr in st.get("transitions", []):
                    for dst in tr:
                        if dst not in ctrls[full]["states"]:
                            errors.append(f"{full}: transição para estado inexistente {dst}")
        else:
            if full not in anims:
                errors.append(f"{kind} {ident}: animação {full} não existe")
                continue
            for b in anims[full].get("bones", {}):
                if bones and b not in bones:
                    errors.append(f"animação {full}: osso '{b}' não existe na geometria de {ident}")
    for a in desc.get("scripts", {}).get("animate", []):
        a = a if isinstance(a, str) else list(a.keys())[0]
        if a not in amap:
            errors.append(f"{kind} {ident}: animate '{a}' não declarado")
    for pe in desc.get("particle_effects", {}).values():
        if not any(j and j.get("particle_effect", {}).get("description", {}).get("identifier") == pe for j in jsons.values()):
            errors.append(f"{kind} {ident}: partícula {pe} não existe")


for p, j in jsons.items():
    if not j:
        continue
    if "minecraft:client_entity" in j:
        check_actor(j["minecraft:client_entity"]["description"], "entidade")
    if "minecraft:attachable" in j:
        check_actor(j["minecraft:attachable"]["description"], "anexo")
    if "particle_effect" in j:
        t = j["particle_effect"]["description"]["basic_render_parameters"]["texture"]
        if not tex_exists(t):
            errors.append(f"partícula: textura {t} não existe")

# BP entity <-> RP client entity
bp_ents = {j["minecraft:entity"]["description"]["identifier"]: j for j in jsons.values() if j and "minecraft:entity" in j}
rp_ents = {j["minecraft:client_entity"]["description"]["identifier"] for j in jsons.values() if j and "minecraft:client_entity" in j}
for e in bp_ents:
    if e not in rp_ents:
        errors.append(f"entidade {e} sem client entity")
# propriedades usadas nas animações existem
for e, j in bp_ents.items():
    props = j["minecraft:entity"]["description"].get("properties", {})
    for p, jj in jsons.items():
        if not jj:
            continue
        for m in re.finditer(r"q\.property\('([^']+)'\) [=!]= '([^']+)'", json.dumps(jj)):
            name, val = m.group(1), m.group(2)
            if name not in props:
                errors.append(f"{os.path.basename(p)}: propriedade {name} não existe em {e}")
            elif val not in props[name]["values"]:
                errors.append(f"{os.path.basename(p)}: valor '{val}' não existe em {name}")

# itens e ícones
itex = jsons.get(os.path.join(RP, "textures", "item_texture.json")) or {}
for j in jsons.values():
    if j and "minecraft:item" in j:
        icon = j["minecraft:item"]["components"].get("minecraft:icon")
        if isinstance(icon, str) and icon not in itex.get("texture_data", {}):
            errors.append(f"item: ícone {icon} não registrado")
for k, v in itex.get("texture_data", {}).items():
    if not tex_exists(v["textures"]):
        errors.append(f"item_texture {k}: PNG ausente")

# ações do script == enum da entidade
anim_js = open(os.path.join(BP, "scripts", "lila", "anim.js"), encoding="utf-8").read()
for name, pat in (("lila:action", r"export const ACTIONS = \[([^\]]+)\]"), ("lila:move", r"export const MOVES = \[([^\]]+)\]")):
    vals = re.findall(r'"([a-z_]+)"', re.search(pat, anim_js).group(1))
    ent = bp_ents["lila:lila"]["minecraft:entity"]["description"]["properties"][name]["values"]
    if vals != ent:
        errors.append(f"{name}: valores do script {vals} != entidade {ent}")

print(f"arquivos JSON: {len(jsons)} · geometrias: {len(geos)} · animações: {len(anims)} · controladores: {len(ctrls)}")
for e in errors:
    print("ERRO", e)
print("OK" if not errors else f"{len(errors)} erro(s)")
sys.exit(1 if errors else 0)
