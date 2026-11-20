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

# formato estrito das animações/controladores (o celular rejeita o ARQUIVO inteiro se um campo estiver errado)
ANIM_KEYS = {"loop", "animation_length", "bones", "particle_effects", "sound_effects", "timeline", "override_previous_animation",
             "anim_time_update", "blend_weight", "start_delay", "loop_delay"}
BONE_KEYS = {"rotation", "position", "scale", "relative_to"}


def check_value(where, v, vec=True):
    if isinstance(v, (int, float, str)):
        return
    if isinstance(v, list):
        if vec and len(v) != 3:
            errors.append(f"{where}: vetor com {len(v)} valores")
        for x in v:
            if not isinstance(x, (int, float, str)):
                errors.append(f"{where}: valor inválido {x!r}")
        return
    if isinstance(v, dict):
        for t, kf in v.items():
            try:
                float(t)
            except ValueError:
                errors.append(f"{where}: chave de tempo inválida {t!r}")
            if isinstance(kf, dict):
                for kk in kf:
                    if kk not in ("pre", "post", "lerp_mode"):
                        errors.append(f"{where}@{t}: campo {kk!r} inválido")
                for kk in ("pre", "post"):
                    if kk in kf:
                        check_value(f"{where}@{t}.{kk}", kf[kk])
            else:
                check_value(f"{where}@{t}", kf)
        return
    errors.append(f"{where}: tipo inválido {type(v).__name__}")


for name, a in anims.items():
    for k in a:
        if k not in ANIM_KEYS:
            errors.append(f"animação {name}: campo desconhecido {k!r}")
    if a.get("loop") not in (None, True, False, "hold_on_last_frame"):
        errors.append(f"animação {name}: loop inválido")
    for k in ("particle_effects", "sound_effects", "timeline"):
        if k in a:
            if not isinstance(a[k], dict):
                errors.append(f"animação {name}: {k} precisa ser linha do tempo {{tempo: efeito}}")
            else:
                for t in a[k]:
                    try:
                        float(t)
                    except ValueError:
                        errors.append(f"animação {name}: {k} com tempo inválido {t!r}")
    for b, tr in a.get("bones", {}).items():
        for k, v in tr.items():
            if k not in BONE_KEYS:
                errors.append(f"animação {name}/{b}: campo {k!r} inválido")
            elif k != "relative_to":
                check_value(f"{name}/{b}.{k}", v, vec=not (k == "scale" and isinstance(v, (int, float, str))))
STATE_KEYS = {"animations", "transitions", "blend_transition", "blend_via_shortest_path", "on_entry", "on_exit", "particle_effects", "sound_effects"}
for cname, cdef in ctrls.items():
    if cdef.get("initial_state", "default") not in cdef["states"]:
        errors.append(f"{cname}: initial_state inexistente")
    for sn, st in cdef["states"].items():
        for k in st:
            if k not in STATE_KEYS:
                errors.append(f"{cname}/{sn}: campo {k!r} inválido")
        for tr in st.get("transitions", []):
            if not isinstance(tr, dict) or len(tr) != 1:
                errors.append(f"{cname}/{sn}: transição mal formada")

# BP entity <-> RP client entity
bp_ents = {j["minecraft:entity"]["description"]["identifier"]: j for j in jsons.values() if j and "minecraft:entity" in j}
rp_ents = {j["minecraft:client_entity"]["description"]["identifier"] for j in jsons.values() if j and "minecraft:client_entity" in j}
for e in bp_ents:
    if e not in rp_ents:
        errors.append(f"entidade {e} sem client entity")
# propriedades usadas nas animações existem (cada arquivo confere com a entidade dele)
for e, j in bp_ents.items():
    props = j["minecraft:entity"]["description"].get("properties", {})
    for p, jj in jsons.items():
        if not jj or "/resource_pack/" not in p:
            continue
        base = os.path.basename(p)
        owner = "lila:robot" if "robot" in base else "lila:drone" if ("drone" in base or "forms" in base) else None
        if owner != e:
            continue
        txt = json.dumps(jj)
        for m in re.finditer(r"q\.property\('([^']+)'\) [=!]= '([^']+)'", txt):
            name, val = m.group(1), m.group(2)
            if name not in props:
                errors.append(f"{base}: propriedade {name} não existe em {e}")
            elif val not in props[name].get("values", []):
                errors.append(f"{base}: valor '{val}' não existe em {name}")
        for m in re.finditer(r"q\.property\('([^']+)'\)", txt):
            if m.group(1) not in props:
                errors.append(f"{base}: propriedade {m.group(1)} não existe em {e}")

# controlador de formas: cada geometria/textura da lista existe na entidade do cliente
for j in jsons.values():
    if not j or "minecraft:client_entity" not in j:
        continue
    d = j["minecraft:client_entity"]["description"]
    for rcname in d.get("render_controllers", []):
        rc = next((jj["render_controllers"][rcname] for jj in jsons.values() if jj and rcname in jj.get("render_controllers", {})), None)
        if rc is None:
            errors.append(f"{d['identifier']}: render controller {rcname} inexistente")
            continue
        for arr in rc.get("arrays", {}).get("geometries", {}).values():
            for g in arr:
                if g.split(".", 1)[1] not in d.get("geometry", {}):
                    errors.append(f"{d['identifier']}: {g} não declarado")
        for arr in rc.get("arrays", {}).get("textures", {}).values():
            for t in arr:
                if t.split(".", 1)[1] not in d.get("textures", {}):
                    errors.append(f"{d['identifier']}: {t} não declarado")
    for k, g in d.get("geometry", {}).items():
        if g not in geos:
            errors.append(f"{d['identifier']}: geometria {g} inexistente")

# sons
sd = jsons.get(os.path.join(RP, "sounds", "sound_definitions.json")) or {}
for k, v in sd.get("sound_definitions", {}).items():
    for snd in v.get("sounds", []):
        if not os.path.exists(os.path.join(RP, snd["name"] + ".ogg")):
            errors.append(f"som {k}: arquivo {snd['name']}.ogg ausente")

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
for name, pat in (("lila:move", r"export const MOVES = \[([^\]]+)\]"),):
    vals = re.findall(r'"([a-z_]+)"', re.search(pat, anim_js).group(1))
    ent = bp_ents["lila:drone"]["minecraft:entity"]["description"]["properties"][name]["values"]
    if vals != ent:
        errors.append(f"{name}: valores do script {vals} != entidade {ent}")
# ações do drone (actionMap do registro) existem no enum da entidade
reg_js = open(os.path.join(BP, "scripts", "lila", "registry.js"), encoding="utf-8").read()
amap = re.search(r"actionMap: \{([^}]+)\}", reg_js)
dvals = bp_ents["lila:drone"]["minecraft:entity"]["description"]["properties"]["lila:action"]["values"]
for v in re.findall(r': "([a-z_]+)"', amap.group(1) if amap else ""):
    if v not in dvals:
        errors.append(f"actionMap usa '{v}' que não existe no enum do drone")

print(f"arquivos JSON: {len(jsons)} · geometrias: {len(geos)} · animações: {len(anims)} · controladores: {len(ctrls)}")
for e in errors:
    print("ERRO", e)
print("OK" if not errors else f"{len(errors)} erro(s)")
sys.exit(1 if errors else 0)
