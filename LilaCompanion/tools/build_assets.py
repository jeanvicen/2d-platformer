#!/usr/bin/env python3
"""DR-0N Mega Drone — asset build.

Generates every data-driven file of the behavior pack and resource pack from
code in tools/forge (geometry, textures, animations, item, recipes, entity,
particles, texts, icons). Gameplay scripts in behavior_pack/scripts are
hand-written and never touched by this script.

Usage:  python3 tools/build_assets.py [--previews]
"""
from __future__ import annotations

import json
import math
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from forge.anim import controller, controllers_file  # noqa: E402
from forge.paint import NANO, bake  # noqa: E402
from forge.swarm_art import swarm_image  # noqa: E402
from forge.race_build import build_race  # noqa: E402
from forge import drone_art  # noqa: E402
from forge.drone_anims import DRONE_ACTIONS, drone_anims, drone_controllers, power_pose  # noqa: E402
from forge.forms_art import FORMS as FORM_MODELS  # noqa: E402
from forge.forms_art2 import FORMS2  # noqa: E402
from forge.colossus_art import ROBOT_KINDS, colossus_model  # noqa: E402
from forge.forms_anims import (FORM_IDS, INITIALIZE, PRE_ANIMATION, ROBOT_ACTIONS, form_anims, form_controllers,  # noqa: E402
                               robot_anims, robot_controllers)
from forge.audio import build_sounds  # noqa: E402
from forge.curse_art import curse_model, shadow_soldier_model  # noqa: E402
from forge.curse_anims import ACTIONS as CURSE_ACTIONS, action_anims, action_controller, life_anims, sample_pose  # noqa: E402
from forge.curse_fx import curse_particles  # noqa: E402
from forge.render import render  # noqa: E402

MOVES = ["none", "walk", "run", "swim", "climb", "fall", "sneak"]

VERSION = [3, 3, 1]
MIN_ENGINE = [1, 26, 30]
SERVER_VERSION = "2.8.0"
SERVER_UI_VERSION = "2.1.0"
UUID = {
    "bp_header": "b461d112-57c7-4e8f-b4dc-395753b1764f",
    "bp_data": "0eb44987-9e9c-463b-910a-8fa1028bf56b",
    "bp_script": "9cfa397e-a894-4a0e-90bb-14e27ca0c535",
    "rp_header": "d7bcc89a-2727-4727-aa37-344181885cac",
    "rp_res": "65cf8480-3b98-4618-baea-f184211cc525",
}
BP = os.path.join(ROOT, "behavior_pack")
RP = os.path.join(ROOT, "resource_pack")
PREVIEW_DIR = os.path.join(ROOT, "docs", "img")
ITEM_FORMAT = "1.21.90"
ENTITY_FORMAT = "1.21.0"

GENERATED_BP = ["entities", "items", "recipes", "texts", "cameras"]
GENERATED_RP = ["entity", "models", "animations", "animation_controllers", "render_controllers", "attachables",
                "particles", "textures", "texts", "sounds", "fogs", "ui"]

LANGS = {
    "en_US": {"entity.lila:drone.name": "Curse", "entity.lila:robot.name": "Shadow Soldier", "item.lila.drone_controller.name": "Curse (summon / command)",
              "action.interact.lila.ride": "Climb on", "action.interact.lila.talk": "Talk"},
    "pt_BR": {"entity.lila:drone.name": "Maldição", "entity.lila:robot.name": "Soldado de Sombra", "item.lila.drone_controller.name": "Maldição (invocar / comandar)",
              "action.interact.lila.ride": "Subir", "action.interact.lila.talk": "Conversar"},
}
NANO_NAMES = {
    "en_US": {"sword": "Shadow Sword", "pickaxe": "Shadow Pickaxe", "axe": "Shadow Axe", "shovel": "Shadow Shovel", "hoe": "Shadow Hoe",
              "hammer": "Shadow Hammer (use to throw)", "core": "Curse Smoke (use to switch power)"},
    "pt_BR": {"sword": "Espada de Sombra", "pickaxe": "Picareta de Sombra", "axe": "Machado de Sombra", "shovel": "Pá de Sombra",
              "hoe": "Enxada de Sombra", "hammer": "Martelo de Sombra (use para arremessar)", "core": "Fumaça da Maldição (use para trocar o poder)"},
    "es_ES": {"sword": "Espada de Sombra", "pickaxe": "Pico de Sombra", "axe": "Hacha de Sombra", "shovel": "Pala de Sombra",
              "hoe": "Azada de Sombra", "hammer": "Martillo de Sombra (úsalo para lanzar)", "core": "Humo de la Maldición (úsalo para cambiar el poder)"},
}
for _lg, _names in NANO_NAMES.items():
    LANGS.setdefault(_lg, {}).update({f"item.lila.nano_{k}.name": v for k, v in _names.items()})
LANGS["pt_PT"] = dict(LANGS["pt_BR"])
LANGS["es_ES"] = {"entity.lila:drone.name": "Hacknd", "entity.lila:robot.name": "Soldado de nanobots Hacknd", "item.lila.drone_controller.name": "Mando del Hacknd",
                  "action.interact.lila.ride": "Subir", "action.interact.lila.talk": "Hablar",
                  **{f"item.lila.nano_{k}.name": v for k, v in NANO_NAMES["es_ES"].items()}}


def wjson(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if path.endswith("curse.animation.json"):  # animação amostrada: compacta (arquivo 4× menor)
            json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
        else:
            json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def wpng(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


def clean():
    for d in GENERATED_BP:
        shutil.rmtree(os.path.join(BP, d), ignore_errors=True)
    for d in GENERATED_RP:
        shutil.rmtree(os.path.join(RP, d), ignore_errors=True)


# ============================================================ manifests + icons
def manifests(icon):
    meta = {"authors": ["0neajx"], "url": "https://github.com/jeanvicen/2d-platformer"}
    wjson(os.path.join(BP, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "Hacknd (BP)",
                   "description": "§bHacknd§r — um enxame de nanorrobôs que vira veículos, torreta, titã, exército e constrói tudo\n§7Criado por 0neajx",
                   "uuid": UUID["bp_header"], "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [
            {"type": "data", "uuid": UUID["bp_data"], "version": VERSION, "description": "DR-0N behaviors"},
            {"type": "script", "language": "javascript", "uuid": UUID["bp_script"], "version": VERSION,
             "entry": "scripts/main.js", "description": "DR-0N brain"},
        ],
        "dependencies": [
            {"uuid": UUID["rp_header"], "version": VERSION},
            {"module_name": "@minecraft/server", "version": SERVER_VERSION},
            {"module_name": "@minecraft/server-ui", "version": SERVER_UI_VERSION},
        ],
        "metadata": meta,
    })
    wjson(os.path.join(RP, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "Hacknd (RP)",
                   "description": "§bHacknd§r — enxame de nanorrobôs: partículas, modelos e sons\n§7Criado por 0neajx",
                   "uuid": UUID["rp_header"], "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [{"type": "resources", "uuid": UUID["rp_res"], "version": VERSION, "description": "DR-0N resources"}],
        "dependencies": [{"uuid": UUID["bp_header"], "version": VERSION}],
        "metadata": meta,
    })
    wpng(os.path.join(BP, "pack_icon.png"), icon)
    wpng(os.path.join(RP, "pack_icon.png"), icon)


def backdrop(size, top=(18, 64, 48), bottom=(6, 14, 16)):
    y = np.linspace(0, 1, size)[:, None]
    x = np.linspace(-1, 1, size)[None, :]
    t = np.clip(y * 0.85 + (x ** 2) * 0.15, 0, 1)
    rgb = np.array(top)[None, None, :] * (1 - t[..., None]) + np.array(bottom)[None, None, :] * t[..., None]
    img = Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")
    d = ImageDraw.Draw(img)
    cx, cy = size * 0.5, size * 0.42
    for r, a in ((size * 0.42, 26), (size * 0.32, 34), (size * 0.22, 40)):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(80, 220, 160, a), width=max(1, size // 128))
    return img


def portrait(model, tex, size=256):
    img = render(model, tex, size=size, yaw=-32, pitch=16, alphatest=False, outline=True, zoom=1.0, pose=power_pose(0))
    bg = backdrop(size, top=(14, 40, 66), bottom=(4, 10, 18))
    glow = img.split()[3].filter(ImageFilter.GaussianBlur(size / 40))
    halo = Image.new("RGBA", (size, size), (60, 200, 255, 0))
    halo.putalpha(glow.point(lambda v: int(v * 0.55)))
    bg.alpha_composite(halo)
    bg.alpha_composite(img)
    return bg


# Dano que nunca conta: família própria, queda, sufocar, afogar, bater em parede.
# (Jogadores PODEM machucar — quem bate vira alvo; o dono é filtrado no script.)
FRIENDLY = [
    {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "lila_companion"}}, "deals_damage": "no"},
    {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "lila_robot"}}, "deals_damage": "no"},
    {"cause": "fall", "deals_damage": "no"},
    {"cause": "suffocation", "deals_damage": "no"},
    {"cause": "drowning", "deals_damage": "no"},
    {"cause": "fly_into_wall", "deals_damage": "no"},
    {"cause": "lava", "deals_damage": "no"},
    {"cause": "fire", "deals_damage": "no"},
    {"cause": "fire_tick", "deals_damage": "no"},
    {"cause": "block_explosion", "deals_damage": "no"},
]


# ============================================================ DR-0N (drone + formas)
FORM_ORDER = ["drone", "heli", "car", "excavator", "tank", "jet", "moto", "colossus", "turret",
              "swarm", "ship", "ufo", "sub", "boat", "truck", "stealth"]
GEO_KEY = {"drone": "default", "turret": "turret_g"}
assert [FORM_IDS[k] for k in FORM_ORDER] == list(range(len(FORM_ORDER)))

# assentos (blocos, espaço da entidade). O colosso tem escala 3.4: os assentos são em blocos reais.
COL_SCALE = 3.4
SEATS = {
    "drone": [[0, 4.2, 0.55]],
    "heli": [[-0.4, 0.98, -1.06], [0.4, 0.98, -1.06], [-0.4, 0.98, 0.25], [0.4, 0.98, 0.25]],
    "car": [[-0.45, 0.72, -0.06], [0.45, 0.72, -0.06], [-0.45, 0.72, 0.94], [0.45, 0.72, 0.94]],
    "excavator": [[-0.5, 1.05, -0.25], [0.5, 1.6, 0.6]],
    "tank": [[0.5, 1.55, 0.6], [-0.5, 1.55, 0.6], [0, 1.05, 1.9]],
    "jet": [[0, 1.1, -1.94], [0, 1.05, -1.2]],
    "moto": [[0, 0.82, 0.35], [0, 0.88, 0.95]],
    # Maldição gigante: piloto EM CIMA da cabeça, os outros nos ombros e na corcunda (em blocos sem escala)
    "colossus": [[0, 4.15, 0.6], [-0.75, 3.62, 0.35], [0.75, 3.62, 0.35], [-0.3, 3.45, -0.25], [0.3, 3.45, -0.25]],
    "ship": [[0, 0.92, -0.875], [0, 0.92, 0.25]],
    "ufo": [[0, 0.92, -0.375], [-0.56, 0.92, 0.44], [0.56, 0.92, 0.44]],
    "sub": [[0, 1.07, -0.75], [-0.31, 1.08, 0.875], [0.31, 1.08, 1.5]],
    "boat": [[-0.375, 0.45, -0.375], [0.375, 0.45, -0.375], [-0.4, 0.45, 1.0], [0.4, 0.45, 1.0]],
    "truck": [[-0.47, 1.77, -0.125], [0.47, 1.77, -0.125], [-0.6, 1.7, 1.4], [0.6, 1.7, 1.4]],
    "stealth": [[0, 1.0, -1.875]],
}
FORM_PHYS = {
    # (largura, altura, gravidade, escala, vida). Submarino e lancha: gravidade feita pelo script (boiam).
    "drone": (1.6, 4.2, False, 1.0, 300),   # Maldição (~4,5 blocos, do tamanho de um wither)
    "heli": (2.6, 2.4, False, 1.0, 400),
    "car": (2.2, 1.4, True, 1.0, 400),
    "excavator": (2.6, 3.0, True, 1.0, 500),
    "tank": (3.2, 2.2, True, 1.0, 900),
    "jet": (3.0, 1.6, False, 1.0, 400),
    "moto": (0.9, 1.3, True, 1.0, 300),
    "colossus": (2.6, 7.6, True, COL_SCALE, 4000),
    "turret": (2.2, 3.4, True, 1.7, 1500),
    "swarm": (0.8, 0.8, False, 1.0, 300),
    "ship": (3.0, 1.6, False, 1.0, 600),
    "ufo": (3.6, 1.8, False, 1.0, 700),
    "sub": (2.4, 2.0, False, 1.0, 700),
    "boat": (2.2, 1.0, False, 1.0, 400),
    "truck": (3.0, 2.8, True, 1.0, 800),
    "stealth": (3.2, 1.4, False, 1.0, 500),
}


def form_group(name):
    w, h, grav, scale, hp = FORM_PHYS[name]
    g = {
        "minecraft:collision_box": {"width": w, "height": h},
        "minecraft:physics": {"has_gravity": grav, "has_collision": True},
        "minecraft:scale": {"value": scale},
        "minecraft:health": {"value": hp, "max": hp},
    }
    if name in SEATS:
        seats = [{"position": p} for p in SEATS[name]]
        g["minecraft:rideable"] = {"seat_count": len(seats), "family_types": ["player"], "interact_text": "action.interact.lila.ride",
                                   "crouching_skip_interact": True, "pull_in_entities": False, "rider_can_interact": False, "seats": seats}
    return g


def drone_bp_entity():
    groups = {"lila:despawn": {"minecraft:instant_despawn": {"remove_child_entities": False}}}
    events = {"lila:despawn": {"add": {"component_groups": ["lila:despawn"]}},
              "lila:interacted": {"remove": {"component_groups": []}},
              "minecraft:entity_spawned": {"add": {"component_groups": ["lila:f_drone"]}}}
    for name in FORM_ORDER:
        groups[f"lila:f_{name}"] = form_group(name)
    for name in FORM_ORDER:
        events[f"lila:form_{name}"] = {
            "add": {"component_groups": [f"lila:f_{name}"]},
            "remove": {"component_groups": [f"lila:f_{o}" for o in FORM_ORDER if o != name]},
            "set_property": {"lila:form": FORM_IDS[name]},
        }
    return {
        "format_version": ENTITY_FORMAT,
        "minecraft:entity": {
            "description": {"identifier": "lila:drone", "is_spawnable": False, "is_summonable": True, "properties": {
                "lila:action": {"type": "enum", "values": DRONE_ACTIONS, "default": "idle", "client_sync": True},
                "lila:move": {"type": "enum", "values": MOVES, "default": "none", "client_sync": True},
                "lila:form": {"type": "int", "range": [0, len(FORM_ORDER) - 1], "default": 0, "client_sync": True},
                "lila:aim": {"type": "int", "range": [-180, 180], "default": 0, "client_sync": True},
                "lila:pitch": {"type": "int", "range": [-60, 60], "default": 0, "client_sync": True},
                "lila:off": {"type": "bool", "default": False, "client_sync": True},
                "lila:cact": {"type": "int", "range": [0, len(CURSE_ACTIONS) - 1], "default": 9, "client_sync": True}}},
            "component_groups": groups,
            "components": {
                "minecraft:type_family": {"family": ["lila_drone", "lila_companion", "npc", "mob"]},
                "minecraft:attack": {"damage": 8},
                "minecraft:movement": {"value": 0.3},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": False},
                "minecraft:persistent": {},
                "minecraft:fire_immune": {},
                "minecraft:breathable": {"total_supply": 60, "suffocate_time": 0, "breathes_water": True},
                "minecraft:damage_sensor": {"triggers": FRIENDLY},
                "minecraft:inventory": {"inventory_size": 54, "container_type": "inventory", "private": True},
                "minecraft:interact": {"interactions": [{
                    "on_interact": {"filters": {"all_of": [{"test": "is_family", "subject": "other", "value": "player"},
                                                           {"test": "has_equipment", "subject": "other", "domain": "hand", "value": "lila:drone_controller"}]},
                                    "event": "lila:interacted", "target": "self"},
                    "interact_text": "action.interact.lila.talk", "swing": True}]},
                "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 10, "probability": 0.2},
                "minecraft:conditional_bandwidth_optimization": {},
                "minecraft:experience_reward": {"on_death": "0"},
            },
            "events": events,
        }}


CURSE_FX = ["smoke", "cubes", "wisps", "embers", "hit", "spark", "slash", "quake", "roar", "ground", "ground_smoke", "burst", "inhale"]


def build_drone(previews):
    m = drone_art.drone_model()
    m.to_json()
    tex = bake(m)
    # MALDIÇÃO: a forma normal E a forma gigante (no lugar do robô TITÃ) usam o mesmo modelo
    cm = curse_model()
    wjson(os.path.join(RP, "models", "entity", "lila", "curse.geo.json"), cm.to_json())
    ctex = bake(cm)
    wpng(os.path.join(RP, "textures", "entity", "lila", "curse.png"), ctex)
    geos = {"default": "geometry.lila.curse", "colossus": "geometry.lila.curse"}
    texs = {"default": "textures/entity/lila/curse", "colossus": "textures/entity/lila/curse"}
    models = {"drone": (cm, ctex), "colossus": (cm, ctex)}
    builders = dict(FORM_MODELS)
    builders.update(FORMS2)
    for key, fn in builders.items():
        fm = fn()
        geo = fm.to_json()
        ftex = bake(fm)
        wjson(os.path.join(RP, "models", "entity", "lila", f"{key}.geo.json"), geo)
        wpng(os.path.join(RP, "textures", "entity", "lila", f"{key}.png"), ftex)
        geos[key] = fm.identifier
        texs[key] = f"textures/entity/lila/{key}"
        models[key] = (fm, ftex)
    A = {}  # o drone-robô antigo não existe mais (a forma normal é a Maldição)
    F = {k: v for k, v in form_anims().items() if not k.startswith("col_") and k != "intro_colossus"}
    CA = {**{f"c_{k}": v for k, v in life_anims().items()}, **action_anims()}
    curse_sounds = {}
    for _, (_, data) in CA.items():  # sons das animações: nome curto → som do jogo
        for t, ev in data.get("sound_effects", {}).items():
            key = "cs_" + ev["effect"].replace(".", "_")
            curse_sounds[key] = ev["effect"]
            ev["effect"] = key
    wjson(os.path.join(RP, "animations", "lila", "curse.animation.json"),
          {"format_version": "1.10.0", "animations": {name: data for _, (name, data) in CA.items()}})
    wjson(os.path.join(RP, "animations", "lila", "forms.animation.json"),
          {"format_version": "1.10.0", "animations": {name: data for _, (name, data) in F.items()}})
    # Hacknd: efeitos do enxame no cliente (nuvem, montinho desligado, robozinhos nas formas)
    AURA = {1: (1.8, 0.9), 2: (1.4, 0.6), 3: (1.5, 1.0), 4: (1.7, 0.8), 5: (2.2, 0.7), 6: (0.9, 0.6), 8: (1.5, 1.6),
            10: (2.1, 0.8), 11: (2.2, 0.6), 12: (1.8, 1.0), 13: (1.5, 0.6), 14: (1.7, 1.1), 15: (2.5, 0.5)}
    FXA = {"fx_swarm": {"loop": True, "animation_length": 2.0,
                        "particle_effects": {"0.0": [{"effect": "swarm"}, {"effect": "haze"}, {"effect": "trail"}]}},
           "fx_pile": {"loop": True, "animation_length": 2.0, "particle_effects": {"0.0": {"effect": "pile"}}}}
    for fid, (hx, hy) in AURA.items():
        FXA[f"fx_aura_{fid}"] = {"loop": True, "animation_length": 2.0, "particle_effects": {
            "0.0": {"effect": "aura", "pre_effect_script": f"v.sx = {hx}; v.sy = {hy}; v.sz = {hx};"}}}
    # Maldição: fumaça saindo da base, cubinhos, fiapos pela coluna e brasas no ar (só nas formas 0 e 7)
    FXA["fx_curse"] = {"loop": True, "animation_length": 2.0, "particle_effects": {"0.0": [
        {"effect": "c_smoke", "locator": "smoke_base"}, {"effect": "c_cubes", "locator": "smoke_base"},
        {"effect": "c_wisps", "locator": "smoke_top"}, {"effect": "c_embers"}]}}
    wjson(os.path.join(RP, "animations", "lila", "swarmfx.animation.json"),
          {"format_version": "1.10.0", "animations": {f"animation.lila.{k}": v for k, v in FXA.items()}})
    off = "q.property('lila:off')"
    conds = {"curse": f"(v.form == 0 || v.form == 7) && !{off}", "cloud": f"v.form == 9 && !{off}", "pile": off}
    for fid in AURA:
        conds[f"aura_{fid}"] = f"v.form == {fid} && !{off}"
    fx_states = {"default": {"transitions": [{k: c} for k, c in conds.items()]}}
    for st, cnd in conds.items():
        anim = "fx_curse" if st == "curse" else "fx_swarm" if st == "cloud" else "fx_pile" if st == "pile" else f"fx_aura_{st[5:]}"
        fx_states[st] = {"animations": [anim], "transitions": [{k: c} for k, c in conds.items() if k != st] + [{"default": f"!({cnd})"}]}
    wjson(os.path.join(RP, "animation_controllers", "lila", "drone.ac.json"),
          controllers_file(form_controllers() + [controller("controller.animation.lila.swarmfx", fx_states),
                                                 controller("controller.animation.lila.curse.action", action_controller()["states"])]))
    amap = {k: name for k, (name, _) in A.items()}
    amap.update({k: name for k, (name, _) in F.items()})
    amap.update({k: f"animation.lila.{k}" for k in FXA})
    amap.update({k: name for k, (name, _) in CA.items()})
    amap["ctrl_swarmfx"] = "controller.animation.lila.swarmfx"
    amap["ctrl_form"] = "controller.animation.lila.form.action"
    amap["ctrl_curse"] = "controller.animation.lila.curse.action"
    cur = "(v.form == 0 || v.form == 7)"
    animate = [{"c_life": cur}, {"c_bits": cur}, {"c_glide": cur}, {"c_look": cur}, {"ctrl_curse": cur},
               {"intro": "v.form != 7 && v.form != 0"},
               {"heli": "v.form == 1"}, {"car": "v.form == 2"}, {"excavator": "v.form == 3"}, {"tank": "v.form == 4"},
               {"jet": "v.form == 5"}, {"moto": "v.form == 6"},
               {"turret_g": "v.form == 8"}, {"swarm": "v.form == 9"}, {"ship": "v.form == 10"}, {"ufo": "v.form == 11"},
               {"sub": "v.form == 12"}, {"boat": "v.form == 13"}, {"truck": "v.form == 14"}, {"stealth": "v.form == 15"}, "ctrl_form", "ctrl_swarmfx"]
    wjson(os.path.join(RP, "entity", "lila", "drone.entity.json"), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": "lila:drone",
            "materials": {"default": "entity_emissive_alpha"},
            "textures": {GEO_KEY.get(k, k): v for k, v in ((("drone" if k == "default" else k), v) for k, v in texs.items())},
            "geometry": {GEO_KEY.get(k, k): v for k, v in ((("drone" if k == "default" else k), v) for k, v in geos.items())},
            "animations": amap,
            "particle_effects": {"sparkle": "lila:sparkle", "swarm": "lila:nano_swarm", "haze": "lila:nano_haze", "trail": "lila:nano_trail",
                                 "pile": "lila:nano_pile", "aura": "lila:nano_aura", **{f"c_{k}": f"lila:curse_{k}" for k in CURSE_FX},
                                 **{f"curse_{k}": f"lila:curse_{k}" for k in CURSE_FX}},
            "sound_effects": curse_sounds,
            "scripts": {"initialize": [INITIALIZE[0] + " v.cmove = 0;"], "pre_animation": PRE_ANIMATION + [
                "v.cmove = math.lerp(v.cmove, math.clamp(q.ground_speed / 5, 0, 1), 0.12);"], "animate": animate},
            "render_controllers": ["controller.render.lila.forms"],
        }}})
    wjson(os.path.join(BP, "entities", "drone.json"), drone_bp_entity())
    # controle do drone
    # MALDIÇÃO: o ícone do item é a cabeça dela (boca de dentes e tentáculos); na mão aparece o ícone
    big = render(cm, ctex, size=384, yaw=-18, pitch=6, outline=True, ssaa=3)
    icon = big.crop((96, 0, 288, 192)).resize((64, 64), Image.LANCZOS)
    wpng(os.path.join(RP, "textures", "items", "lila", "drone_controller.png"), icon)
    wjson(os.path.join(RP, "textures", "item_texture.json"), {
        "resource_pack_name": "lila", "texture_name": "atlas.items",
        "texture_data": {"lila_drone_controller": {"textures": "textures/items/lila/drone_controller"}}})
    wjson(os.path.join(BP, "items", "drone_controller.json"), {
        "format_version": ITEM_FORMAT,
        "minecraft:item": {
            "description": {"identifier": "lila:drone_controller", "menu_category": {"category": "equipment"}},
            "components": {"minecraft:icon": "lila_drone_controller", "minecraft:display_name": {"value": "item.lila.drone_controller.name"},
                           "minecraft:max_stack_size": 1, "minecraft:hand_equipped": False, "minecraft:allow_off_hand": True,
                           "minecraft:rarity": "epic", "minecraft:tags": {"tags": ["lila:controller"]}, "minecraft:glint": True}}})
    wjson(os.path.join(BP, "recipes", "drone_controller.json"), {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {
            "description": {"identifier": "lila:drone_controller"}, "tags": ["crafting_table"],
            "pattern": ["IGI", "RDR", "I I"],
            "key": {"I": {"item": "minecraft:iron_ingot"}, "G": {"item": "minecraft:glass"}, "R": {"item": "minecraft:redstone"},
                    "D": {"item": "minecraft:diamond"}},
            "unlock": [{"item": "minecraft:iron_ingot"}],
            "result": {"item": "lila:drone_controller"}}})
    if previews:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        for i, (y, p) in enumerate(((-30, 18), (150, 22))):
            wpng(os.path.join(PREVIEW_DIR, f"drone_view_{i}.png"), render(m, tex, size=520, yaw=y, pitch=p, outline=True, pose=power_pose(0)))
        # Hacknd: não existe mais corpo de robô — as imagens são do enxame
        wpng(os.path.join(PREVIEW_DIR, "drone_view_0.png"), swarm_image(520, "cloud", 11))
        wpng(os.path.join(PREVIEW_DIR, "robot_off.png"), swarm_image(520, "pile", 12))
        wpng(os.path.join(PREVIEW_DIR, "robot_boot.png"), swarm_image(520, "arrive", 13))
        for key, (fm, ftex) in models.items():
            if key == "drone":
                continue
            wpng(os.path.join(PREVIEW_DIR, f"form_{key}.png"), render(fm, ftex, size=520, yaw=-35 if key != "colossus" else -30,
                                                                      pitch=18 if key != "colossus" else 10, outline=True))
        wpng(os.path.join(PREVIEW_DIR, "drone_controller.png"), icon.resize((360, 360), Image.LANCZOS))
        wpng(os.path.join(PREVIEW_DIR, "curse_front.png"), render(cm, ctex, size=620, yaw=-14, pitch=6, outline=True))
        wpng(os.path.join(PREVIEW_DIR, "curse_side.png"), render(cm, ctex, size=620, yaw=-80, pitch=6, outline=True))
        acts = action_anims()
        shots = [("punch_r", 0.27, -35, "soco"), ("claw", 0.22, -35, "garra"), ("slam", 0.5, -60, "pancada"), ("roar", 0.6, -25, "rugido"),
                 ("bite", 0.22, -80, "mordida"), ("emerge", 1.8, -30, "saindo do chão"), ("guard", 0.5, -30, "guarda"), ("devour", 0.6, -60, "devorar")]
        sheet = Image.new("RGBA", (260 * 4, 290 * 2), (0, 0, 0, 0))
        dr = ImageDraw.Draw(sheet)
        for i, (a, t, yaw, label) in enumerate(shots):
            im = render(cm, ctex, size=260, yaw=yaw, pitch=8, outline=True, pose=sample_pose(acts["ca_" + a][1], t))
            sheet.alpha_composite(im, (260 * (i % 4), 290 * (i // 4)))
            dr.text((260 * (i % 4) + 10, 290 * (i // 4) + 266), label, fill=(225, 220, 235, 255))
        wpng(os.path.join(PREVIEW_DIR, "curse_poses.png"), sheet)
    return m, tex


# ============================================================ robô-soldado (modo exército)
def build_robot(previews):
    # 3.3.1: o exército é de SOMBRAS — mesmo esqueleto do antigo robô, corpo de fumaça (curse_art)
    m = shadow_soldier_model()
    wjson(os.path.join(RP, "models", "entity", "lila", "robot.geo.json"), m.to_json())
    tex = bake(m)
    wpng(os.path.join(RP, "textures", "entity", "lila", "robot.png"), tex)
    kind_tex = {"soldado": tex}
    NANO["chroma"] = 0.42  # os 5 tipos continuam com a cor de cada um (feitos de nanorrobôs)
    for kind in ROBOT_KINDS[1:]:
        mk = shadow_soldier_model(kind)
        assert [(c.origin, c.size) for b in mk.bones for c in b.cubes] == [(c.origin, c.size) for b in m.bones for c in b.cubes]
        kind_tex[kind] = bake(mk)
        wpng(os.path.join(RP, "textures", "entity", "lila", f"robot_{kind}.png"), kind_tex[kind])
    NANO["chroma"] = 0.2
    A = robot_anims()
    A["shadowfx"] = ("animation.lila.robot.shadowfx", {"loop": True, "animation_length": 2.0, "particle_effects": {"0.0": [
        {"effect": "c_smoke"}, {"effect": "c_wisps"}]}})
    wjson(os.path.join(RP, "animations", "lila", "robot.animation.json"),
          {"format_version": "1.10.0", "animations": {name: data for _, (name, data) in A.items()}})
    wjson(os.path.join(RP, "animation_controllers", "lila", "robot.ac.json"), controllers_file(robot_controllers()))
    amap = {k: name for k, (name, _) in A.items()}
    amap["ctrl"] = "controller.animation.lila.robot.action"
    wjson(os.path.join(RP, "entity", "lila", "robot.entity.json"), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": "lila:robot",
            "materials": {"default": "entity_emissive_alpha"},
            "textures": {"default": "textures/entity/lila/robot", **{k: f"textures/entity/lila/robot_{k}" for k in ROBOT_KINDS[1:]}},
            "geometry": {"default": "geometry.lila.robot"},
            "animations": amap,
            # soldado de SOMBRA: fumaça escorrendo do corpo, cubinhos e brasas (feito da fumaça da maldição)
            "particle_effects": {"c_smoke": "lila:curse_smoke", "c_wisps": "lila:curse_wisps"},
            "scripts": {"animate": ["look", {"idle": "q.ground_speed < 0.6"}, "ctrl", "shadowfx"]},
            "render_controllers": ["controller.render.lila.robot"],
        }}})
    follow = {"minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.4, "start_distance": 7, "stop_distance": 3,
                                                  "can_teleport": True, "ignore_vibration": True}}
    hunt = {"minecraft:behavior.nearest_attackable_target": {
        "priority": 2, "must_see": False, "reselect_targets": True, "within_radius": 28, "scan_interval": 10,
        "entity_types": [{"filters": {"all_of": [{"test": "is_family", "subject": "other", "value": "monster"},
                                                 {"test": "is_family", "subject": "other", "operator": "!=", "value": "lila_robot"}]},
                          "max_dist": 28}]}}
    wjson(os.path.join(BP, "entities", "robot.json"), {
        "format_version": ENTITY_FORMAT,
        "minecraft:entity": {
            "description": {"identifier": "lila:robot", "is_spawnable": False, "is_summonable": True, "properties": {
                "lila:action": {"type": "enum", "values": ROBOT_ACTIONS, "default": "idle", "client_sync": True},
                "lila:kind": {"type": "int", "range": [0, len(ROBOT_KINDS) - 1], "default": 0, "client_sync": True}}},
            "component_groups": {
                "lila:despawn": {"minecraft:instant_despawn": {"remove_child_entities": False}},
                "lila:follow": dict(follow),
                "lila:guard": {**follow, **hunt},
            },
            "components": {
                "minecraft:type_family": {"family": ["lila_robot", "lila_companion_army", "mob"]},
                "minecraft:health": {"value": 80, "max": 80},
                "minecraft:attack": {"damage": 9},
                "minecraft:movement": {"value": 0.34},
                "minecraft:collision_box": {"width": 0.7, "height": 2.0},
                "minecraft:physics": {"has_gravity": True, "has_collision": True},
                "minecraft:jump.static": {},
                "minecraft:movement.basic": {},
                "minecraft:can_climb": {},
                "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True, "can_jump": True, "can_swim": True,
                                              "can_pass_doors": True, "can_open_doors": True},
                "minecraft:tameable": {"probability": 0.0},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
                "minecraft:knockback_resistance": {"value": 0.8},
                "minecraft:fire_immune": {},
                "minecraft:persistent": {},
                "minecraft:breathable": {"total_supply": 60, "suffocate_time": 0, "breathes_water": True},
                "minecraft:damage_sensor": {"triggers": FRIENDLY},
                "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": False},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
                "minecraft:behavior.owner_hurt_target": {"priority": 1},
                "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": [{"filters": {"test": "is_family", "subject": "other",
                                                                                                    "operator": "!=", "value": "lila_robot"}}]},
                "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.5, "track_target": True},
                "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 10, "probability": 0.2},
                "minecraft:behavior.random_look_around": {"priority": 9},
                "minecraft:conditional_bandwidth_optimization": {},
                "minecraft:experience_reward": {"on_death": "0"},
            },
            "events": {
                "lila:despawn": {"add": {"component_groups": ["lila:despawn"]}},
                "lila:mode_follow": {"add": {"component_groups": ["lila:follow"]}, "remove": {"component_groups": ["lila:guard"]}},
                "lila:mode_guard": {"add": {"component_groups": ["lila:guard"]}, "remove": {"component_groups": ["lila:follow"]}},
                "lila:mode_stay": {"remove": {"component_groups": ["lila:guard", "lila:follow"]}},
                "minecraft:entity_spawned": {"add": {"component_groups": ["lila:guard"]}},
            },
        }})
    if previews:
        wpng(os.path.join(PREVIEW_DIR, "robot.png"), render(m, tex, size=420, yaw=-30, pitch=8, outline=True))
        acc = {"construtor": "hat", "artilheiro": "cannon", "medico": "medkit", "ninja": "katana"}
        for kind in ROBOT_KINDS:
            mk = shadow_soldier_model(kind)
            bake(mk)  # atribui as UVs (mesmo layout da textura do tipo)
            hide = [b for b in ("hat", "cannon", "medkit", "katana") if b != acc.get(kind)]
            for b in mk.bones:
                if b.name in hide:
                    b.cubes = []
            wpng(os.path.join(PREVIEW_DIR, f"robot_{kind}.png"), render(mk, kind_tex[kind], size=300, yaw=-30, pitch=8, outline=True))
    return m


# ============================================================ itens de nanorrobô (enxame 2.3)
NANO_ICONS = {
    "sword": [
        "..............o+",
        ".............o#+",
        "............o#+.",
        "...........o#+..",
        "..........o#+...",
        ".........o#+....",
        "........o#+.....",
        ".......o#+......",
        "..+...o#+.......",
        "..+#.o#+........",
        "...+##+.........",
        "....##..........",
        "...#+#+.........",
        "..#+..+.........",
        ".#+.............",
        "#+..............",
    ],
    "pickaxe": [
        "....oooooooo....",
        "..oo##++++##oo..",
        ".o#+#......#+#o.",
        "o#+..#....#..+#o",
        "o+...o#..#o...+o",
        "......o##o......",
        "......o##o......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......++.......",
        "................",
    ],
    "axe": [
        "........oooo....",
        ".......o####o...",
        "......o##++##o..",
        "......o#+..+#o..",
        ".....o##+..+#o..",
        ".....o#####+o...",
        "......o###oo....",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......++.......",
        "................",
    ],
    "shovel": [
        "......oooo......",
        ".....o####o.....",
        ".....o#++#o.....",
        ".....o#++#o.....",
        ".....o####o.....",
        "......o##o......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......#+.......",
        "......o##o......",
        "......#++#......",
        "......o##o......",
        "................",
    ],
    "hoe": [
        "....ooooooo.....",
        "...o###++##o....",
        "...o#+oooo#o....",
        "...o+o..o##o....",
        "........o##o....",
        ".........##.....",
        ".........#+.....",
        ".........##.....",
        ".........#+.....",
        ".........##.....",
        ".........#+.....",
        ".........##.....",
        ".........#+.....",
        ".........##.....",
        ".........++.....",
        "................",
    ],
    "hammer": [
        "..oooooooooooo..",
        ".o############o.",
        ".o#+##++++##+#o.",
        ".o#+########+#o.",
        ".o############o.",
        "..oooo####oooo..",
        "......o##o......",
        ".......#+.......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        ".......#+.......",
        ".......##.......",
        "......o##o......",
        "......#++#......",
        "......oooo......",
    ],
    "core": [
        "................",
        "......oooo......",
        "....oo####oo....",
        "...o###++###o...",
        "..o##+####+##o..",
        "..o#+##++##+#o..",
        ".o##+#++++#+##o.",
        ".o#+#++oo++#+#o.",
        ".o#+#++oo++#+#o.",
        ".o##+#++++#+##o.",
        "..o#+##++##+#o..",
        "..o##+####+##o..",
        "...o###++###o...",
        "....oo####oo....",
        "......oooo......",
        "................",
    ],
}


def nano_icon(rows, seed):
    """Pixel art 16×16: corpo de nanorrobôs (grafite com granulado) + brilhos ciano."""
    import random
    rnd = random.Random(seed)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                g = rnd.randint(82, 118)
                px[x, y] = (g, g + 8, g + 22, 255) if rnd.random() > 0.14 else (120, 230, 255, 255)
            elif ch == "+":
                px[x, y] = (70 + rnd.randint(0, 40), 220 + rnd.randint(0, 35), 255, 255)
            elif ch == "o":
                g = rnd.randint(30, 48)
                px[x, y] = (g, g + 4, g + 10, 255)
    return img


def build_nano(previews):
    tex = {"lila_drone_controller": {"textures": "textures/items/lila/drone_controller"}}
    digs = {
        "pickaxe": "query.any_tag('stone', 'metal', 'minecraft:is_pickaxe_item_destructible')",
        "axe": "query.any_tag('wood', 'log', 'minecraft:is_axe_item_destructible')",
        "shovel": "query.any_tag('dirt', 'sand', 'gravel', 'grass', 'snow', 'minecraft:is_shovel_item_destructible')",
        "hoe": "query.any_tag('plant', 'minecraft:is_hoe_item_destructible')",
    }
    sheet = Image.new("RGBA", (16 * len(NANO_ICONS) + 4 * (len(NANO_ICONS) - 1), 16), (0, 0, 0, 0))
    for i, (key, rows) in enumerate(NANO_ICONS.items()):
        icon = nano_icon(rows, 500 + i)
        wpng(os.path.join(RP, "textures", "items", "lila", f"nano_{key}.png"), icon)
        sheet.paste(icon, (i * 20, 0))
        tex[f"lila_nano_{key}"] = {"textures": f"textures/items/lila/nano_{key}"}
        comps = {
            "minecraft:icon": f"lila_nano_{key}",
            "minecraft:display_name": {"value": f"item.lila.nano_{key}.name"},
            "minecraft:max_stack_size": 1,
            "minecraft:hand_equipped": key != "core",
            "minecraft:glint": True,
            "minecraft:rarity": "epic",
            "minecraft:tags": {"tags": ["lila:nano"] + ({"sword": ["minecraft:is_sword"], "pickaxe": ["minecraft:is_pickaxe", "minecraft:is_tool"],
                                                         "axe": ["minecraft:is_axe", "minecraft:is_tool"], "shovel": ["minecraft:is_shovel", "minecraft:is_tool"],
                                                         "hoe": ["minecraft:is_hoe", "minecraft:is_tool"]}.get(key, []))
                               + (["minecraft:netherite_tier"] if key in digs or key == "sword" else [])},
        }
        if key in digs:
            comps["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": {"tags": digs[key]}, "speed": 60}]}
            comps["minecraft:damage"] = {"value": 9}
        if key == "sword":
            comps["minecraft:damage"] = {"value": 16}
            comps["minecraft:can_destroy_in_creative"] = False
        if key == "hammer":
            comps["minecraft:damage"] = {"value": 12}
            comps["minecraft:can_destroy_in_creative"] = False
        wjson(os.path.join(BP, "items", f"nano_{key}.json"), {
            "format_version": ITEM_FORMAT,
            "minecraft:item": {"description": {"identifier": f"lila:nano_{key}", "menu_category": {"category": "none"}}, "components": comps}})
    wjson(os.path.join(RP, "textures", "item_texture.json"), {"resource_pack_name": "lila", "texture_name": "atlas.items", "texture_data": tex})
    # névoa levíssima do enxame (só um tom ciano no horizonte: não atrapalha a visão)
    wjson(os.path.join(RP, "fogs", "nano_fog.json"), {
        "format_version": "1.16.100",
        "minecraft:fog_settings": {
            "description": {"identifier": "lila:nano_fog"},
            "distance": {
                "air": {"fog_start": 0.72, "fog_end": 1.0, "fog_color": "#16131C", "render_distance_type": "render"},
                "water": {"fog_start": 0.0, "fog_end": 40.0, "fog_color": "#120E18", "render_distance_type": "fixed"},
            },
        }})
    if previews:
        wpng(os.path.join(PREVIEW_DIR, "nano_items.png"), sheet.resize((sheet.width * 8, 128), Image.NEAREST))


def build_render_controllers():
    geo = ["Geometry.default"] + [f"Geometry.{GEO_KEY.get(k, k)}" for k in FORM_ORDER[1:]]
    tex = ["Texture.default"] + [f"Texture.{GEO_KEY.get(k, k)}" for k in FORM_ORDER[1:]]
    wjson(os.path.join(RP, "render_controllers", "lila.render_controllers.json"), {
        "format_version": "1.8.0",
        "render_controllers": {
            "controller.render.lila.lila": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
                "is_hurt_color": {"r": "0.85", "g": "0.25", "b": "0.25", "a": "0.35"},
                "on_fire_color": {"r": "1.0", "g": "0.5", "b": "0.2", "a": "0.4"},
            },
            # uma entidade, dezesseis formas: a propriedade lila:form escolhe geometria e textura
            "controller.render.lila.forms": {
                "arrays": {"geometries": {"Array.geo": geo}, "textures": {"Array.tex": tex}},
                "geometry": "Array.geo[q.property('lila:form')]",
                "materials": [{"*": "Material.default"}],
                "textures": ["Array.tex[q.property('lila:form')]"],
                # 3.3: a forma 0 É a Maldição (corpo inteiro). Só some no enxame (9, nuvem de fumaça) e quando está
                # desligada/adormecida, depois de afundar na terra (v.ot = segundos desde que desligou)
                "part_visibility": [{"*": "q.property('lila:form') != 9 && !(q.property('lila:off') && v.ot > 2.9)"}],
                "is_hurt_color": {"r": "0.85", "g": "0.25", "b": "0.25", "a": "0.25"},
            },
            # soldados do exército: 5 tipos (textura + acessório visível por lila:kind)
            "controller.render.lila.robot": {
                "arrays": {"textures": {"Array.kind": ["Texture.default"] + [f"Texture.{k}" for k in ROBOT_KINDS[1:]]}},
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Array.kind[q.property('lila:kind')]"],
                "part_visibility": [{"hat": "q.property('lila:kind') == 1"}, {"cannon": "q.property('lila:kind') == 2"},
                                    {"medkit": "q.property('lila:kind') == 3"}, {"katana": "q.property('lila:kind') == 4"}],
                "is_hurt_color": {"r": "0.85", "g": "0.25", "b": "0.25", "a": "0.35"},
            },
            "controller.render.lila.item": {
                "geometry": "Geometry.default",
                "materials": [{"*": "Material.default"}],
                "textures": ["Texture.default"],
            },
        },
    })


# ============================================================ particles
def star_texture(size=16):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dx, dy = abs(x - c), abs(y - c)
            v = max(0.0, 1 - (dx * dy) ** 0.5 / 1.6 - math.hypot(dx, dy) / (size * 0.55))
            if v > 0:
                a = int(min(1.0, v * 1.6) * 255)
                px[x, y] = (255, 255, 255, a)
    return img


def leaf_texture(size=16):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((3, 5, 13, 11), fill=(255, 255, 255, 255))
    d.line((2, 12, 13, 4), fill=(200, 200, 200, 255), width=1)
    return img


def particle(ident, texture, rate, life, speed, size, gradient, accel=(0, 0.8, 0), shape=None, drag=2.0, duration=0.12):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": ident, "basic_render_parameters": {"material": "particles_blend", "texture": texture}},
        "components": {
            "minecraft:emitter_rate_instant": {"num_particles": rate},
            "minecraft:emitter_lifetime_once": {"active_time": duration},
            **(shape or {"minecraft:emitter_shape_sphere": {"offset": [0, 0.9, 0], "radius": 0.7, "direction": "outwards"}}),
            "minecraft:particle_lifetime_expression": {"max_lifetime": f"math.random({life[0]}, {life[1]})"},
            "minecraft:particle_initial_speed": f"math.random({speed[0]}, {speed[1]})",
            "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-180, 180)"},
            "minecraft:particle_motion_dynamic": {"linear_acceleration": list(accel), "linear_drag_coefficient": drag},
            "minecraft:particle_appearance_billboard": {
                "size": [f"{size} * (1 - v.particle_age / v.particle_lifetime * 0.7)", f"{size} * (1 - v.particle_age / v.particle_lifetime * 0.7)"],
                "facing_camera_mode": "rotate_xyz",
                "uv": {"texture_width": 16, "texture_height": 16, "uv": [0, 0], "uv_size": [16, 16]}},
            "minecraft:particle_appearance_tinting": {"color": {
                "interpolant": "v.particle_age / v.particle_lifetime", "gradient": gradient}},
        }}}


def soft_texture(size=16):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c) / (size / 2)
            if d < 1:
                px[x, y] = (255, 255, 255, int((1 - d) ** 1.4 * 255))
    return img


def nano_texture(size=8):
    """Maldição: floco de cinza/fumaça em bloquinho (quadrado com cantos comidos, miolo mais claro)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(size):
        for x in range(size):
            corner = (x in (0, size - 1)) and (y in (0, size - 1))
            if corner:
                continue
            core = 2 <= x <= size - 3 and 2 <= y <= size - 3
            px[x, y] = (255, 255, 255, 255) if core else (190, 190, 190, 220)
    return img


def _shape_fx(ident, n, life, pos, size, grad, texture="textures/particle/lila/nano"):
    """Partícula que desenha uma forma: n pontinhos de vida curta, posição relativa por expressão
    Molang (usa v.particle_random_1..4 e as variáveis passadas pelo script: v.yaw, v.flap, v.size)."""
    d = particle(ident, texture, n, (life * 0.85, life), (0.0, 0.0), size, grad, accel=(0, 0, 0),
                 shape={"minecraft:emitter_shape_point": {"offset": [0, 0, 0]}}, duration=0.05)
    comps = d["particle_effect"]["components"]
    comps.pop("minecraft:particle_motion_dynamic", None)
    comps.pop("minecraft:particle_initial_speed", None)
    comps["minecraft:particle_motion_parametric"] = {"relative_position": pos}
    comps["minecraft:particle_appearance_billboard"]["size"] = [str(size), str(size)]
    comps["minecraft:emitter_initialization"] = {"creation_expression": "v.yaw = v.yaw ?? 0; v.flap = v.flap ?? 0; v.size = v.size ?? 1;"}
    return d


def _yaw_rot(lat, up, back):
    """(lateral à direita, cima, trás) do jogador → x, y, z do mundo (yaw em graus, Molang usa graus)."""
    return [f"(({lat}) * -math.cos(v.yaw) + ({back}) * math.sin(v.yaw))", f"({up})",
            f"(({lat}) * -math.sin(v.yaw) - ({back}) * math.cos(v.yaw))"]


def nano_fx(fx, nano_grad):
    glow = {"0.0": "#FFC8F8FF", "0.5": "#FF4C6878", "1.0": "#C0283038"}
    # fumaça do núcleo: poucas baforadas que crescem e duram (leve)
    sm = particle("lila:nano_smoke", "textures/particle/lila/soft", 5, (1.0, 1.8), (0.1, 0.5), 0.7,
                  {"0.0": "#00262C34", "0.15": "#60283038", "0.6": "#40222830", "1.0": "#00202630"}, accel=(0, 0.12, 0), drag=1.6,
                  shape={"minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.6, "direction": "outwards"}})
    sm["particle_effect"]["components"]["minecraft:particle_appearance_billboard"]["size"] = [
        "0.45 + v.particle_age / v.particle_lifetime * 0.6", "0.45 + v.particle_age / v.particle_lifetime * 0.6"]
    fx["lila_nano_smoke.json"] = sm
    # atmosfera: pontinhos minúsculos espalhados no ar, vagando devagar e cintilando (não orbitam)
    air = particle("lila:nano_air", "textures/particle/lila/nano", 34, (3.0, 5.0), (0.0, 0.08), 0.04,
                   {"0.0": "#00A8E8F8", "0.2": "#B0506470", "0.5": "#E0A8F0FF", "0.8": "#B04A5864", "1.0": "#004A5864"},
                   accel=(0, 0, 0), drag=0.6,
                   shape={"minecraft:emitter_shape_box": {"offset": [0, 2.5, 0], "half_dimensions": [12, 4, 12], "direction": "outwards"}})
    ac = air["particle_effect"]["components"]
    ac["minecraft:particle_motion_dynamic"] = {"linear_acceleration": [
        "math.sin(v.particle_age * 90 + v.particle_random_1 * 360) * 0.09",
        "math.cos(v.particle_age * 70 + v.particle_random_2 * 360) * 0.05",
        "math.cos(v.particle_age * 80 + v.particle_random_3 * 360) * 0.09"], "linear_drag_coefficient": 0.6}
    ac["minecraft:particle_appearance_billboard"]["size"] = ["0.035 + v.particle_random_4 * 0.02", "0.035 + v.particle_random_4 * 0.02"]
    fx["lila_nano_air.json"] = air
    # asas: envergadura ~3 blocos de cada lado, batendo (v.flap) e viradas para onde você olha (v.yaw)
    S = "v.particle_random_1"
    side = "(v.particle_random_2 > 0.5 ? 1 : -1)"
    L = f"(0.25 + {S} * 2.9)"
    fl = f"(math.sin(v.flap + {S} * 50) * (12 + 30 * {S}))"
    ch = f"(v.particle_random_3 * (1.1 - {S} * 0.8))"
    lat = f"{side} * {L} * math.cos({fl})"
    up = f"0.15 + {L} * math.sin({fl}) + {S} * 0.55 - {ch} * 0.9"
    back = f"0.3 + {ch} * 0.35 + {S} * 0.25"
    fx["lila_nano_wings.json"] = _shape_fx("lila:nano_wings", 80, 0.14, _yaw_rot(lat, up, back), 0.07, glow)
    # mão gigante: palma (cubo arredondado) + nó dos dedos na frente, escala v.size
    a, b, cc = "(v.particle_random_1 - 0.5)", "(v.particle_random_2 - 0.5)", "(v.particle_random_3 - 0.5)"
    m = f"math.max(math.abs({a}), math.max(math.abs({b}), math.abs({cc})))"
    knuck = "(v.particle_random_4 > 0.75 ? 1 : 0)"
    hx = f"(({a}) / {m} * 0.5 * 0.9)"
    hy = f"(({b}) / {m} * 0.5 * (1 - {knuck} * 0.6) + {knuck} * 0.32)"
    hz = f"(({cc}) / {m} * 0.5 * 0.75 * (1 - {knuck}) + {knuck} * -0.48)"
    fx["lila_nano_hand.json"] = _shape_fx("lila:nano_hand", 70, 0.14, _yaw_rot(f"{hx} * v.size", f"{hy} * v.size", f"{hz} * v.size"), 0.09, glow)
    # prancha: retângulo 1,9 × 0,75 com propulsores atrás (v.size aumenta: almofada de queda)
    u = "(v.particle_random_1 - 0.5) * 1.9"
    w = "(v.particle_random_2 - 0.5) * 0.75"
    jet = "(v.particle_random_4 > 0.85 ? 1 : 0)"
    fx["lila_nano_board.json"] = _shape_fx("lila:nano_board", 48, 0.14,
                                           _yaw_rot(f"({w}) * v.size", f"(v.particle_random_3 * 0.08 - {jet} * v.particle_random_3 * 0.3)",
                                                    f"(-({u}) * (1 - {jet}) + {jet} * 1.05) * v.size"), 0.07, glow)
    # formação de ferramenta: nanorrobôs convergindo para um ponto
    th, ph = "(v.particle_random_1 * 360)", "(v.particle_random_2 * 180 - 90)"
    k = "math.pow(1 - v.particle_age / v.particle_lifetime, 2) * 1.3"
    fx["lila_nano_form.json"] = _shape_fx("lila:nano_form", 28, 0.38, [f"math.cos({th}) * math.cos({ph}) * {k}", f"math.sin({ph}) * {k}",
                                                                       f"math.sin({th}) * math.cos({ph}) * {k}"], 0.07, nano_grad)
    # corte da espada: arco horizontal que abre
    arc = "(v.particle_random_1 * 160 - 80 + v.particle_age * 600)"
    rr = "(1.2 + v.particle_random_2 * 0.5)"
    fx["lila_nano_slash.json"] = _shape_fx("lila:nano_slash", 30, 0.2, [f"math.cos({arc}) * {rr}", "(v.particle_random_3 - 0.5) * 0.3",
                                                                        f"math.sin({arc}) * {rr}"], 0.08, glow)


def _base_fx(ident, texture, comps):
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": ident, "basic_render_parameters": {"material": "particles_blend", "texture": texture}},
        "components": comps}}


# cor dos nanorrobôs: grafite quase preto; ~1 em 6 pisca ciano; entra e sai suave (sem "estalo")
NANO_TINT = {"color": [  # Maldição: cinzas pretas com uma brasa laranja de vez em quando
    "v.particle_random_4 > 0.9 ? 1.0 : 0.06 + v.particle_random_2 * 0.05",
    "v.particle_random_4 > 0.9 ? 0.42 + 0.3 * math.sin(v.particle_age * 900 + v.particle_random_1 * 360) : 0.055 + v.particle_random_2 * 0.045",
    "v.particle_random_4 > 0.9 ? 0.1 : 0.075 + v.particle_random_2 * 0.06",
    "math.clamp(math.min(v.particle_age * 5, (v.particle_lifetime - v.particle_age) * 4), 0, 1) * 0.95"]}
NANO_BB = {"size": ["0.035 + v.particle_random_3 * 0.04", "0.035 + v.particle_random_3 * 0.04"], "facing_camera_mode": "rotate_xyz",
           "uv": {"texture_width": 8, "texture_height": 8, "uv": [0, 0], "uv_size": [8, 8]}}


def swarm_fx():
    """O enxame do Hacknd roda no CLIENTE (o servidor não manda nada): emissores presos na entidade
    (espaço local), então a nuvem segue o enxame de graça. Movimento de inseto: cada robozinho tem um
    "lar" num elipsoide, gira devagar em volta do centro, respira junto com a nuvem e faz zigue-zague
    rápido (soma de senoides em frequências diferentes ≈ ruído de curl, como abelhas e mosquitos)."""
    fx = {}
    R1, R2, R3, R4 = "v.particle_random_1", "v.particle_random_2", "v.particle_random_3", "v.particle_random_4"
    t = "v.particle_age"
    rad = f"((0.25 + math.sqrt({R3}) * 1.35) * (1 + 0.14 * math.sin({t} * 95 + {R1} * 360)))"
    ang = f"({R1} * 360 + {t} * (35 + {R4} * 70) * ({R2} > 0.5 ? 1 : -1))"
    yh = f"(({R2} - 0.5) * 1.5 * (1 - {R3} * 0.3))"
    buzz_x = f"(math.sin({t} * 2100 + {R1} * 977) * 0.05 + math.sin({t} * 420 + {R2} * 613) * 0.16)"
    buzz_y = f"(math.cos({t} * 1900 + {R2} * 811) * 0.04 + math.sin({t} * 360 + {R3} * 503) * 0.12)"
    buzz_z = f"(math.cos({t} * 2300 + {R3} * 733) * 0.05 + math.cos({t} * 470 + {R1} * 421) * 0.16)"
    curl_x = f"(math.sin({yh} * 140 + {t} * 80) * 0.22)"
    curl_z = f"(math.cos({rad} * 120 + {t} * 95) * 0.22)"
    local = {"minecraft:emitter_local_space": {"position": True, "rotation": False}}
    fx["lila_nano_swarm.json"] = _base_fx("lila:nano_swarm", "textures/particle/lila/nano", {
        **local,
        "minecraft:emitter_rate_steady": {"spawn_rate": 240, "max_particles": 560},
        "minecraft:emitter_lifetime_once": {"active_time": 2.1},
        "minecraft:emitter_shape_point": {"offset": [0, 1.05, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.3, 2.2)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.cos({ang}) * {rad} + {buzz_x} + {curl_x}",
            f"{yh} * {rad} * 0.75 + {buzz_y}",
            f"math.sin({ang}) * {rad} + {buzz_z} + {curl_z}"]},
        "minecraft:particle_appearance_billboard": NANO_BB,
        "minecraft:particle_appearance_tinting": NANO_TINT,
    })
    # névoa: poucas manchas grandes e quase transparentes — dá a sensação de "bilhões" no miolo
    fx["lila_nano_haze.json"] = _base_fx("lila:nano_haze", "textures/particle/lila/soft", {
        **local,
        "minecraft:emitter_rate_steady": {"spawn_rate": 8, "max_particles": 22},
        "minecraft:emitter_lifetime_once": {"active_time": 2.1},
        "minecraft:emitter_shape_sphere": {"offset": [0, 1.05, 0], "radius": 0.55},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.6, 2.4)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.sin({t} * 60 + {R1} * 360) * 0.25", f"math.cos({t} * 50 + {R2} * 360) * 0.12", f"math.cos({t} * 70 + {R3} * 360) * 0.25"]},
        "minecraft:particle_appearance_billboard": {"size": [f"0.7 + {R3} * 0.5", f"0.7 + {R3} * 0.5"], "facing_camera_mode": "rotate_xyz",
                                                     "uv": {"texture_width": 16, "texture_height": 16, "uv": [0, 0], "uv_size": [16, 16]}},
        "minecraft:particle_appearance_tinting": {"color": ["0.1", "0.13", "0.17",
                                                             f"math.clamp(math.min({t} * 2, (v.particle_lifetime - {t}) * 2), 0, 1) * 0.11"]},
    })
    # rastro: poeira que fica no ar por onde o enxame passou e vai assentando (espaço do mundo)
    fx["lila_nano_trail.json"] = _base_fx("lila:nano_trail", "textures/particle/lila/nano", {
        "minecraft:emitter_rate_steady": {"spawn_rate": 40, "max_particles": 120},
        "minecraft:emitter_lifetime_once": {"active_time": 2.1},
        "minecraft:emitter_shape_sphere": {"offset": [0, 1.0, 0], "radius": 1.2, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.02, 0.25)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.8, 3.0)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [
            f"math.sin({t} * 300 + {R1} * 720) * 0.35", f"math.cos({t} * 260 + {R2} * 720) * 0.2 - 0.04", f"math.cos({t} * 330 + {R3} * 720) * 0.35"],
            "linear_drag_coefficient": 1.8},
        "minecraft:particle_appearance_billboard": NANO_BB,
        "minecraft:particle_appearance_tinting": NANO_TINT,
    })
    # desligado: um montinho de poeira no chão, com brilhos fracos
    pr = f"(math.sqrt({R1}) * 0.75)"
    pa = f"({R2} * 360)"
    fx["lila_nano_pile.json"] = _base_fx("lila:nano_pile", "textures/particle/lila/nano", {
        **local,
        "minecraft:emitter_rate_steady": {"spawn_rate": 45, "max_particles": 80},
        "minecraft:emitter_lifetime_once": {"active_time": 2.1},
        "minecraft:emitter_shape_point": {"offset": [0, 0.05, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.0, 1.7)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.cos({pa}) * {pr}", f"(1 - {pr} / 0.75) * 0.3 * {R3} + math.sin({t} * 500 + {R4} * 360) * 0.012", f"math.sin({pa}) * {pr}"]},
        "minecraft:particle_appearance_billboard": NANO_BB,
        "minecraft:particle_appearance_tinting": {"color": [NANO_TINT["color"][0].replace("0.55 + 0.45", "0.25 + 0.2"), NANO_TINT["color"][1].replace("0.92", "0.45"),
                                                             NANO_TINT["color"][2].replace("1.0 :", "0.55 :"), NANO_TINT["color"][3]]},
    })
    # nas formas (veículos, TITÃ, torreta): robozinhos soltos deslizando pela superfície
    fx["lila_nano_aura.json"] = _base_fx("lila:nano_aura", "textures/particle/lila/nano", {
        **local,
        "minecraft:emitter_initialization": {"creation_expression": "v.sx = v.sx ?? 1.2; v.sy = v.sy ?? 0.8; v.sz = v.sz ?? 1.6;"},
        "minecraft:emitter_rate_steady": {"spawn_rate": 38, "max_particles": 90},
        "minecraft:emitter_lifetime_once": {"active_time": 2.1},
        "minecraft:emitter_shape_box": {"offset": [0, "v.sy", 0], "half_dimensions": ["v.sx", "v.sy", "v.sz"], "surface_only": True, "direction": "outwards"},
        "minecraft:particle_initial_speed": "math.random(0.05, 0.25)",
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.7, 1.3)"},
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [f"math.sin({t} * 700 + {R1} * 720) * 0.8", "0.1", f"math.cos({t} * 650 + {R2} * 720) * 0.8"],
                                              "linear_drag_coefficient": 3.0},
        "minecraft:particle_appearance_billboard": NANO_BB,
        "minecraft:particle_appearance_tinting": NANO_TINT,
    })
    # INVOCAR: milhares de robozinhos descem do céu em ~9 correntes, de lugares diferentes, fazendo
    # curva e espiral até formar a nuvem
    k = f"math.floor({R1} * 9)"
    A = f"({k} * 40 + {R2} * 16)"
    D = f"(24 + {R3} * 20)"
    H = f"(20 + {R4} * 22 + {k} * 1.5)"
    u = f"({t} / v.particle_lifetime)"
    e = f"(1 - math.pow(1 - {u}, 3))"
    sw = f"(math.sin({u} * 180) * (2.5 + {R3} * 3))"
    sa = f"({A} + {u} * 420)"
    fx["lila_nano_arrive.json"] = _base_fx("lila:nano_arrive", "textures/particle/lila/nano", {
        "minecraft:emitter_rate_steady": {"spawn_rate": 450, "max_particles": 1000},
        "minecraft:emitter_lifetime_once": {"active_time": 1.7},
        "minecraft:emitter_shape_point": {"offset": [0, 1.0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.3, 2.1)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.cos({A}) * {D} * (1 - {e}) + math.cos({sa}) * {sw} + ({R2} - 0.5) * 1.4 * (1 - {e})",
            f"{H} * (1 - {e}) + math.sin({u} * 720 + {R1} * 360) * 0.4 * (1 - {e})",
            f"math.sin({A}) * {D} * (1 - {e}) + math.sin({sa}) * {sw} + ({R3} - 0.5) * 1.4 * (1 - {e})"]},
        "minecraft:particle_appearance_billboard": {"size": [f"0.035 + (1 - {e}) * 0.09", f"0.035 + (1 - {e}) * 0.09"], "facing_camera_mode": "rotate_xyz",
                                                     "uv": {"texture_width": 8, "texture_height": 8, "uv": [0, 0], "uv_size": [8, 8]}},
        "minecraft:particle_appearance_tinting": NANO_TINT,
    })
    # DESLIGAR: a nuvem perde o campo e a poeira cai num montinho
    th, ph = f"({R1} * 360)", f"({R2} * 180 - 90)"
    rr = f"(0.3 + {R3} * 1.1)"
    ee = f"math.pow({u}, 2)"
    fx["lila_nano_collapse.json"] = _base_fx("lila:nano_collapse", "textures/particle/lila/nano", {
        "minecraft:emitter_rate_instant": {"num_particles": 320},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.4)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.cos({th}) * math.cos({ph}) * {rr} * (1 - {ee} * 0.45)",
            f"(1.05 + math.sin({ph}) * {rr} * 0.7) * (1 - {ee}) + 0.05",
            f"math.sin({th}) * math.cos({ph}) * {rr} * (1 - {ee} * 0.45)"]},
        "minecraft:particle_appearance_billboard": NANO_BB,
        "minecraft:particle_appearance_tinting": NANO_TINT,
    })
    # TRANSFORMAR: o enxame converge e "compacta" na forma (v.size = tamanho da forma)
    ea = f"(1 - math.pow(1 - {u}, 3))"
    fx["lila_nano_assemble.json"] = _base_fx("lila:nano_assemble", "textures/particle/lila/nano", {
        "minecraft:emitter_initialization": {"creation_expression": "v.size = v.size ?? 1;"},
        "minecraft:emitter_rate_instant": {"num_particles": 420},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.55, 0.9)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"(math.cos({th} + {u} * 200) * math.cos({ph}) * (3.5 * (1 - {ea}) + 0.9 * {ea} * {R3})) * v.size",
            f"((math.sin({ph}) * (3.5 * (1 - {ea}) + 0.6 * {ea} * {R3})) + 0.7) * v.size",
            f"(math.sin({th} + {u} * 200) * math.cos({ph}) * (3.5 * (1 - {ea}) + 0.9 * {ea} * {R3})) * v.size"]},
        "minecraft:particle_appearance_billboard": NANO_BB,
        "minecraft:particle_appearance_tinting": NANO_TINT,
    })
    # DESMANCHAR: a forma se desfaz numa explosão macia de poeira
    fx["lila_nano_burst.json"] = _base_fx("lila:nano_burst", "textures/particle/lila/nano", {
        "minecraft:emitter_initialization": {"creation_expression": "v.size = v.size ?? 1;"},
        "minecraft:emitter_rate_instant": {"num_particles": 360},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {"offset": [0, 0, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.1)"},
        "minecraft:particle_motion_parametric": {"relative_position": [
            f"math.cos({th} + {u} * 120) * math.cos({ph}) * (0.6 + {ea} * 2.6 * {R3}) * v.size",
            f"(math.sin({ph}) * (0.5 + {ea} * 1.8 * {R3}) + 0.7) * v.size",
            f"math.sin({th} + {u} * 120) * math.cos({ph}) * (0.6 + {ea} * 2.6 * {R3}) * v.size"]},
        "minecraft:particle_appearance_billboard": NANO_BB,
        "minecraft:particle_appearance_tinting": NANO_TINT,
    })
    for fname, data in fx.items():
        wjson(os.path.join(RP, "particles", fname), smokify(data))


def smokify(data):
    """Maldição: as cores das partículas do antigo enxame de nanorrobôs viram fumaça/cinza escura;
    os pontos muito claros viram brasa laranja."""
    def conv(hx):
        a, r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16), int(hx[7:9], 16)
        L = 0.3 * r + 0.59 * g + 0.11 * b
        if L > 205:
            r, g, b = 255, int(110 + (L - 205) * 0.9), 40
        else:
            v = 10 + L * 0.3
            r, g, b = int(v), int(v * 0.94), int(min(255, v * 1.18))
        return f"#{a:02X}{r:02X}{g:02X}{b:02X}"

    def walk(o):
        if isinstance(o, dict):
            return {k: walk(v) for k, v in o.items()}
        if isinstance(o, list):
            return [walk(v) for v in o]
        if isinstance(o, str) and len(o) == 9 and o.startswith("#"):
            return conv(o)
        return o
    return walk(data)


def build_particles():
    wpng(os.path.join(RP, "textures", "particle", "lila", "soft.png"), soft_texture())
    point = {"minecraft:emitter_shape_point": {"offset": [0, 0, 0]}}
    fx = {
        # clarão do cano
        "lila_muzzle.json": particle("lila:muzzle", "textures/particle/lila/soft", 6, (0.06, 0.12), (0.2, 1.2), 0.5,
                                     {"0.0": "#FFFFF8D0", "0.5": "#FFFFB040", "1.0": "#00FF5010"}, accel=(0, 0, 0), shape=point, duration=0.05),
        # fumaça subindo
        "lila_smoke.json": particle("lila:smoke", "textures/particle/lila/soft", 14, (1.2, 2.6), (0.3, 1.4), 0.9,
                                    {"0.0": "#C0A0A0A8", "0.6": "#80606068", "1.0": "#00404048"}, accel=(0, 0.9, 0), drag=1.2,
                                    shape={"minecraft:emitter_shape_sphere": {"offset": [0, 0.3, 0], "radius": 0.8, "direction": "outwards"}}),
        # anel de choque do pisão / impacto
        "lila_shock.json": particle("lila:shock", "textures/particle/lila/soft", 90, (0.5, 0.9), (9.0, 14.0), 1.1,
                                    {"0.0": "#E0FFFFFF", "0.4": "#A0C8E8FF", "1.0": "#00708CA0"}, accel=(0, 0.2, 0), drag=3.0,
                                    shape={"minecraft:emitter_shape_disc": {"offset": [0, 0.3, 0], "radius": 1.0, "direction": "outwards", "plane_normal": "y"}}),
        # bolhas de plasma do raio
        "lila_beam.json": particle("lila:beam", "textures/particle/lila/soft", 3, (0.15, 0.3), (0.0, 0.3), 1.3,
                                   {"0.0": "#FFF0FFFF", "0.3": "#FF40D8FF", "1.0": "#002080FF"}, accel=(0, 0, 0), shape=point, duration=0.05),
        # faíscas de construção (cubinhos ciano)
        "lila_build.json": particle("lila:build", "textures/particle/lila/sparkle", 8, (0.3, 0.7), (0.5, 2.0), 0.18,
                                    {"0.0": "#FFE0FFFF", "1.0": "#0030C0FF"}, accel=(0, -2.0, 0), shape=point, duration=0.05),
        # fogo / labareda
        "lila_fire.json": particle("lila:fire", "textures/particle/lila/soft", 12, (0.3, 0.7), (0.6, 2.4), 0.7,
                                   {"0.0": "#FFFFF0A0", "0.4": "#FFFF8020", "1.0": "#00601000"}, accel=(0, 1.4, 0), drag=2.2),
        # poeira e cascalho
        "lila_dust.json": particle("lila:dust", "textures/particle/lila/soft", 26, (0.8, 1.8), (2.0, 6.0), 0.8,
                                   {"0.0": "#E0B8A080", "1.0": "#00705840"}, accel=(0, -1.0, 0), drag=2.5,
                                   shape={"minecraft:emitter_shape_sphere": {"offset": [0, 0.5, 0], "radius": 1.5, "direction": "outwards"}}),
    }
    # laser vermelho (nave) e violeta (disco voador), bolhas (torpedo)
    fx["lila_laser.json"] = particle("lila:laser", "textures/particle/lila/soft", 2, (0.1, 0.18), (0.0, 0.05), 0.32,
                                     {"0.0": "#FFFFE0E0", "0.4": "#FFFF3030", "1.0": "#00A00000"}, accel=(0, 0, 0), shape=point, duration=0.05)
    fx["lila_vlaser.json"] = particle("lila:vlaser", "textures/particle/lila/soft", 2, (0.12, 0.2), (0.0, 0.05), 0.42,
                                      {"0.0": "#FFFFF0FF", "0.4": "#FFB040FF", "1.0": "#004000A0"}, accel=(0, 0, 0), shape=point, duration=0.05)
    fx["lila_bubbles.json"] = particle("lila:bubbles", "textures/particle/lila/nano", 6, (0.5, 1.2), (0.2, 0.8), 0.14,
                                       {"0.0": "#E0E8FFFF", "1.0": "#0080C0FF"}, accel=(0, 2.0, 0), drag=1.5,
                                       shape={"minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.4, "direction": "outwards"}})
    # nanorrobôs: pontinhos escuros com brilho ciano. "cloud"/"shield" orbitam o centro (movimento paramétrico)
    nano_grad = {"0.0": "#FFB8F4FF", "0.25": "#FF30404C", "0.8": "#FF20262E", "1.0": "#0020262E"}
    fx["lila_nano_point.json"] = particle("lila:nano_point", "textures/particle/lila/nano", 10, (0.35, 0.7), (0.2, 0.9), 0.08, nano_grad,
                                          accel=(0, 0, 0), drag=3.0,
                                          shape={"minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.4, "direction": "outwards"}})
    # 2.3: menos partículas por emissão (o enxame travava): cloud 70→24, shield 160→56, big 220→90, point 10→5
    fx["lila_nano_point.json"]["particle_effect"]["components"]["minecraft:emitter_rate_instant"]["num_particles"] = 5
    for name, n, R, ry, spd in (("nano_cloud", 24, 1.5, 0.8, 300), ("nano_shield", 56, 2.5, 1.0, 220), ("nano_big", 90, 4.5, 1.0, 160),
                                ("nano_ring", 36, 2.8, 0.55, 150), ("nano_ball", 16, 0.45, 1.0, 900)):
        d = particle(f"lila:{name}", "textures/particle/lila/nano", n, (0.45, 0.8), (0.0, 0.0), 0.08, nano_grad, accel=(0, 0, 0), shape=point,
                     duration=0.05)
        comps = d["particle_effect"]["components"]
        comps.pop("minecraft:particle_motion_dynamic", None)
        comps.pop("minecraft:particle_initial_speed", None)
        ang = f"(v.particle_random_1 * 360 + v.particle_age * {spd} * (v.particle_random_4 > 0.5 ? 1 : -1))"
        phi = "(v.particle_random_2 * 180 - 90)"
        rr = f"({R} * (0.75 + v.particle_random_3 * 0.25))"
        comps["minecraft:particle_motion_parametric"] = {"relative_position": [
            f"math.cos({ang}) * math.cos({phi}) * {rr}",
            f"math.sin({phi}) * {rr} * {ry} + math.sin(v.particle_age * 600 + v.particle_random_3 * 360) * 0.12",
            f"math.sin({ang}) * math.cos({phi}) * {rr}"]}
        fx[f"lila_{name}.json"] = d
    fx["lila_nano_ring.json"]["particle_effect"]["components"]["minecraft:particle_lifetime_expression"]["max_lifetime"] = "math.random(0.7, 1.0)"
    fx["lila_nano_ball.json"]["particle_effect"]["components"]["minecraft:particle_lifetime_expression"]["max_lifetime"] = "math.random(0.08, 0.12)"
    nano_fx(fx, nano_grad)
    curse_particles(RP, wjson)
    for fname, data in fx.items():
        wjson(os.path.join(RP, "particles", fname), smokify(data) if "nano" in fname or "swarm" in fname else data)
    wpng(os.path.join(RP, "textures", "particle", "lila", "nano.png"), nano_texture())
    wpng(os.path.join(RP, "textures", "particle", "lila", "sparkle.png"), star_texture())
    wpng(os.path.join(RP, "textures", "particle", "lila", "leaf.png"), leaf_texture())
    emerald = {"0.0": "#FFE6FFF0", "0.35": "#FF5BE0A0", "1.0": "#0018804F"}
    gold = {"0.0": "#FFFFF3C4", "0.5": "#FFF0C060", "1.0": "#00A06020"}
    wjson(os.path.join(RP, "particles", "lila_sparkle.json"),
          particle("lila:sparkle", "textures/particle/lila/sparkle", 42, (0.5, 1.3), (1.0, 3.2), 0.16, emerald))
    wjson(os.path.join(RP, "particles", "lila_leaves.json"),
          particle("lila:leaves", "textures/particle/lila/leaf", 18, (1.0, 2.0), (0.5, 1.6), 0.13,
                   {"0.0": "#FF6FE3A4", "1.0": "#0021925F"}, accel=(0, -1.6, 0), drag=1.4))
    wjson(os.path.join(RP, "particles", "lila_ping.json"),
          particle("lila:ping", "textures/particle/lila/sparkle", 10, (0.4, 0.8), (0.4, 1.0), 0.12, gold,
                   shape={"minecraft:emitter_shape_sphere": {"offset": [0, 0.2, 0], "radius": 0.3, "direction": "outwards"}}))
    wjson(os.path.join(RP, "particles", "lila_tracer.json"),
          particle("lila:tracer", "textures/particle/lila/sparkle", 1, (0.08, 0.14), (0.0, 0.05), 0.09,
                   {"0.0": "#FFFFF4B0", "1.0": "#00FF8A20"}, accel=(0, 0, 0), duration=0.05,
                   shape={"minecraft:emitter_shape_point": {"offset": [0, 0, 0]}}))
    wjson(os.path.join(RP, "particles", "lila_scan.json"),
          particle("lila:scan", "textures/particle/lila/sparkle", 3, (0.5, 0.9), (0.2, 0.5), 0.12,
                   {"0.0": "#FFB0F4FF", "1.0": "#0020A0FF"}, accel=(0, 1.2, 0), duration=0.05,
                   shape={"minecraft:emitter_shape_point": {"offset": [0, 0, 0]}}))
    wjson(os.path.join(RP, "particles", "lila_heart.json"),
          particle("lila:respawn", "textures/particle/lila/sparkle", 64, (0.8, 1.8), (0.6, 2.2), 0.2, emerald,
                   accel=(0, 1.6, 0), duration=0.6,
                   shape={"minecraft:emitter_shape_disc": {"offset": [0, 0.1, 0], "radius": 1.2, "direction": "outwards",
                                                           "plane_normal": "y"}}))


# ============================================================ texts
def build_texts():
    for lang, entries in LANGS.items():
        body = "\n".join(f"{k}={v}" for k, v in entries.items()) + "\n"
        for pack in (RP,):
            p = os.path.join(pack, "texts", f"{lang}.lang")
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(body)
    for pack in (RP, BP):
        wjson(os.path.join(pack, "texts", "languages.json"), list(LANGS.keys()))
        for lang in LANGS:
            p = os.path.join(pack, "texts", f"{lang}.lang")
            if pack is BP:
                with open(p, "w", encoding="utf-8") as f:
                    f.write("pack.name=DR-0N Mega Drone\npack.description=DR-0N\n")


def main():
    previews = "--previews" in sys.argv
    NANO["on"] = True  # Hacknd: tudo feito de nanorrobôs
    clean()
    m, tex = build_drone(previews)
    build_robot(previews)
    build_nano(previews)
    # Sistema de Raças (Roleta das Essências): material próprio (sem a pele de nanorrobô)
    NANO["on"] = False
    race_tex = {}
    n_icons = build_race(BP, RP, wjson, wpng, bake, render, PREVIEW_DIR, previews, race_tex, LANGS)
    NANO["on"] = True
    itp = os.path.join(RP, "textures", "item_texture.json")
    it = json.load(open(itp, encoding="utf-8"))
    it["texture_data"].update(race_tex)
    wjson(itp, it)
    print("race icons", n_icons)
    build_render_controllers()
    build_particles()
    swarm_fx()
    wjson(os.path.join(RP, "sounds", "sound_definitions.json"), build_sounds(RP))
    build_texts()
    manifests(swarm_image(256, "portrait", 5))
    if previews:
        wpng(os.path.join(PREVIEW_DIR, "portrait.png"), swarm_image(512, "portrait", 5))
    print("assets ok", m.stats())


if __name__ == "__main__":
    main()
