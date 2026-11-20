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

from forge.anim import controllers_file  # noqa: E402
from forge.paint import bake  # noqa: E402
from forge import drone_art  # noqa: E402
from forge.drone_anims import DRONE_ACTIONS, drone_anims, drone_controllers, power_pose  # noqa: E402
from forge.forms_art import FORMS as FORM_MODELS  # noqa: E402
from forge.forms_art2 import FORMS2  # noqa: E402
from forge.colossus_art import colossus_model, robot_model  # noqa: E402
from forge.forms_anims import (FORM_IDS, INITIALIZE, PRE_ANIMATION, ROBOT_ACTIONS, form_anims, form_controllers,  # noqa: E402
                               robot_anims, robot_controllers)
from forge.audio import build_sounds  # noqa: E402
from forge.render import render  # noqa: E402

MOVES = ["none", "walk", "run", "swim", "climb", "fall", "sneak"]

VERSION = [2, 2, 0]
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

GENERATED_BP = ["entities", "items", "recipes", "texts"]
GENERATED_RP = ["entity", "models", "animations", "animation_controllers", "render_controllers", "attachables",
                "particles", "textures", "texts", "sounds"]

LANGS = {
    "en_US": {"entity.lila:drone.name": "DR-0N", "entity.lila:robot.name": "DR-0N Soldier", "item.lila.drone_controller.name": "DR-0N Remote",
              "action.interact.lila.ride": "Get in", "action.interact.lila.talk": "Talk"},
    "pt_BR": {"entity.lila:drone.name": "DR-0N", "entity.lila:robot.name": "Soldado DR-0N", "item.lila.drone_controller.name": "Controle do DR-0N",
              "action.interact.lila.ride": "Entrar", "action.interact.lila.talk": "Conversar"},
}
LANGS["pt_PT"] = dict(LANGS["pt_BR"])
LANGS["es_ES"] = {"entity.lila:drone.name": "DR-0N", "entity.lila:robot.name": "Soldado DR-0N", "item.lila.drone_controller.name": "Mando del DR-0N",
                  "action.interact.lila.ride": "Subir", "action.interact.lila.talk": "Hablar"}


def wjson(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
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
        "header": {"name": "DR-0N Mega Drone (BP)",
                   "description": "§bDR-0N§r — drone que vira veículos, torreta, colosso e exército\n§7Criado por 0neajx",
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
        "header": {"name": "DR-0N Mega Drone (RP)",
                   "description": "§bDR-0N§r — modelos, animações e sons\n§7Criado por 0neajx",
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
    img = render(model, tex, size=size, yaw=-32, pitch=16, alphatest=True, outline=True, zoom=1.0)
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
    "drone": [[0, 2.35, 0]],
    "heli": [[-0.4, 0.98, -1.06], [0.4, 0.98, -1.06], [-0.4, 0.98, 0.25], [0.4, 0.98, 0.25]],
    "car": [[-0.45, 0.72, -0.06], [0.45, 0.72, -0.06], [-0.45, 0.72, 0.94], [0.45, 0.72, 0.94]],
    "excavator": [[-0.5, 1.05, -0.25], [0.5, 1.6, 0.6]],
    "tank": [[0.5, 1.55, 0.6], [-0.5, 1.55, 0.6], [0, 1.05, 1.9]],
    "jet": [[0, 1.1, -1.94], [0, 1.05, -1.2]],
    "moto": [[0, 0.82, 0.35], [0, 0.88, 0.95]],
    # piloto EM CIMA da cabeça (visão 360°), ombreiras e topo da mochila (em blocos sem escala)
    "colossus": [[0, 7.58, -0.06], [-1.85, 7.06, 0], [1.85, 7.06, 0], [-0.5, 6.76, 1.12], [0.5, 6.76, 1.12]],
    "ship": [[0, 0.92, -0.875], [0, 0.92, 0.25]],
    "ufo": [[0, 0.92, -0.375], [-0.56, 0.92, 0.44], [0.56, 0.92, 0.44]],
    "sub": [[0, 1.07, -0.75], [-0.31, 1.08, 0.875], [0.31, 1.08, 1.5]],
    "boat": [[-0.375, 0.45, -0.375], [0.375, 0.45, -0.375], [-0.4, 0.45, 1.0], [0.4, 0.45, 1.0]],
    "truck": [[-0.47, 1.77, -0.125], [0.47, 1.77, -0.125], [-0.6, 1.7, 1.4], [0.6, 1.7, 1.4]],
    "stealth": [[0, 1.0, -1.875]],
}
FORM_PHYS = {
    # (largura, altura, gravidade, escala, vida). Submarino e lancha: gravidade feita pelo script (boiam).
    "drone": (1.4, 2.2, False, 1.0, 300),
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
                "lila:off": {"type": "bool", "default": False, "client_sync": True}}},
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


def build_drone(previews):
    m = drone_art.drone_model()
    wjson(os.path.join(RP, "models", "entity", "lila", "drone.geo.json"), m.to_json())
    tex = bake(m)
    wpng(os.path.join(RP, "textures", "entity", "lila", "drone.png"), tex)
    geos = {"default": "geometry.lila.drone"}
    texs = {"default": "textures/entity/lila/drone"}
    models = {"drone": (m, tex)}
    builders = dict(FORM_MODELS)
    builders["colossus"] = colossus_model
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
    A = drone_anims()
    F = form_anims()
    wjson(os.path.join(RP, "animations", "lila", "drone.animation.json"),
          {"format_version": "1.10.0", "animations": {name: data for _, (name, data) in A.items()}})
    wjson(os.path.join(RP, "animations", "lila", "forms.animation.json"),
          {"format_version": "1.10.0", "animations": {name: data for _, (name, data) in F.items()}})
    wjson(os.path.join(RP, "animation_controllers", "lila", "drone.ac.json"), controllers_file(drone_controllers() + form_controllers()))
    amap = {k: name for k, (name, _) in A.items()}
    amap.update({k: name for k, (name, _) in F.items()})
    amap["ctrl_move"] = "controller.animation.lila.drone.move"
    amap["ctrl_act"] = "controller.animation.lila.drone.action"
    amap["ctrl_form"] = "controller.animation.lila.form.action"
    animate = [{"base": "v.form == 0"}, {"power": "v.form == 0"}, {"look": "v.form == 0"},
               {"ctrl_move": "v.form == 0 && v.offp < 0.5"}, {"ctrl_act": "v.form == 0 && v.offp < 0.5"},
               {"intro": "v.form != 7"}, {"intro_colossus": "v.form == 7"},
               {"heli": "v.form == 1"}, {"car": "v.form == 2"}, {"excavator": "v.form == 3"}, {"tank": "v.form == 4"},
               {"jet": "v.form == 5"}, {"moto": "v.form == 6"}, {"col_idle": "v.form == 7"}, {"col_walk": "v.form == 7"},
               {"turret_g": "v.form == 8"}, {"swarm": "v.form == 9"}, {"ship": "v.form == 10"}, {"ufo": "v.form == 11"},
               {"sub": "v.form == 12"}, {"boat": "v.form == 13"}, {"truck": "v.form == 14"}, {"stealth": "v.form == 15"}, "ctrl_form"]
    wjson(os.path.join(RP, "entity", "lila", "drone.entity.json"), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": "lila:drone",
            "materials": {"default": "entity_emissive_alpha"},
            "textures": {GEO_KEY.get(k, k): v for k, v in ((("drone" if k == "default" else k), v) for k, v in texs.items())},
            "geometry": {GEO_KEY.get(k, k): v for k, v in ((("drone" if k == "default" else k), v) for k, v in geos.items())},
            "animations": amap,
            "particle_effects": {"sparkle": "lila:sparkle"},
            "scripts": {"initialize": INITIALIZE, "pre_animation": PRE_ANIMATION, "animate": animate},
            "render_controllers": ["controller.render.lila.forms"],
        }}})
    wjson(os.path.join(BP, "entities", "drone.json"), drone_bp_entity())
    # controle do drone
    im = drone_art.remote_icon()
    itex = bake(im)
    im.to_json()
    wpng(os.path.join(RP, "textures", "items", "lila", "drone_controller.png"), render(im, itex, size=64, yaw=-20, pitch=20, ssaa=4))
    wjson(os.path.join(RP, "textures", "item_texture.json"), {
        "resource_pack_name": "lila", "texture_name": "atlas.items",
        "texture_data": {"lila_drone_controller": {"textures": "textures/items/lila/drone_controller"}}})
    hm = drone_art.remote_held()
    wjson(os.path.join(RP, "models", "entity", "lila", "drone_remote_held.geo.json"), hm.to_json())
    wpng(os.path.join(RP, "textures", "entity", "lila", "drone_remote_held.png"), bake(hm))
    wjson(os.path.join(RP, "animations", "lila", "controller.animation.json"), {"format_version": "1.10.0", "animations": {
        "animation.lila.controller.first": {"loop": True, "bones": {"pad": {"rotation": [0, 0, 0]}}},
        "animation.lila.controller.third": {"loop": True, "bones": {"pad": {"rotation": [0, 0, 0]}}},
        "animation.lila.controller.idle": {"loop": True, "bones": {"pad": {"position": [0, "math.sin(q.life_time * 120) * 0.08", 0]}}},
    }})
    wjson(os.path.join(RP, "attachables", "lila", "drone_controller.json"), {
        "format_version": "1.10.0",
        "minecraft:attachable": {"description": {
            "identifier": "lila:drone_controller",
            "materials": {"default": "entity_emissive_alpha", "enchanted": "entity_emissive_alpha"},
            "textures": {"default": "textures/entity/lila/drone_remote_held", "enchanted": "textures/misc/enchanted_item_glint"},
            "geometry": {"default": "geometry.lila.drone_remote_held"},
            "animations": {"first": "animation.lila.controller.first", "third": "animation.lila.controller.third",
                           "idle": "animation.lila.controller.idle"},
            "scripts": {"animate": [{"first": "c.is_first_person"}, {"third": "!c.is_first_person"}, "idle"]},
            "render_controllers": ["controller.render.lila.item"],
        }}})
    wjson(os.path.join(BP, "items", "drone_controller.json"), {
        "format_version": ITEM_FORMAT,
        "minecraft:item": {
            "description": {"identifier": "lila:drone_controller", "menu_category": {"category": "equipment"}},
            "components": {"minecraft:icon": "lila_drone_controller", "minecraft:display_name": {"value": "item.lila.drone_controller.name"},
                           "minecraft:max_stack_size": 1, "minecraft:hand_equipped": False, "minecraft:allow_off_hand": True,
                           "minecraft:rarity": "epic", "minecraft:tags": {"tags": ["lila:controller"]}}}})
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
        wpng(os.path.join(PREVIEW_DIR, "robot_off.png"), render(m, tex, size=520, yaw=-30, pitch=24, outline=True, pose=power_pose(1)))
        wpng(os.path.join(PREVIEW_DIR, "robot_boot.png"), render(m, tex, size=520, yaw=-30, pitch=18, outline=True, pose=power_pose(0.45, off=False)))
        for key, (fm, ftex) in models.items():
            if key == "drone":
                continue
            wpng(os.path.join(PREVIEW_DIR, f"form_{key}.png"), render(fm, ftex, size=520, yaw=-35 if key != "colossus" else -30,
                                                                      pitch=18 if key != "colossus" else 10, outline=True))
        wpng(os.path.join(PREVIEW_DIR, "drone_controller.png"), render(im, itex, size=360, yaw=-20, pitch=20, ssaa=3))
    return m, tex


# ============================================================ robô-soldado (modo exército)
def build_robot(previews):
    m = robot_model()
    wjson(os.path.join(RP, "models", "entity", "lila", "robot.geo.json"), m.to_json())
    tex = bake(m)
    wpng(os.path.join(RP, "textures", "entity", "lila", "robot.png"), tex)
    A = robot_anims()
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
            "textures": {"default": "textures/entity/lila/robot"},
            "geometry": {"default": "geometry.lila.robot"},
            "animations": amap,
            "scripts": {"animate": ["look", {"idle": "q.ground_speed < 0.6"}, "ctrl"]},
            "render_controllers": ["controller.render.lila.lila"],
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
                "lila:action": {"type": "enum", "values": ROBOT_ACTIONS, "default": "idle", "client_sync": True}}},
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
    return m


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
                "is_hurt_color": {"r": "0.85", "g": "0.25", "b": "0.25", "a": "0.25"},
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
    """Nanorrobô: quadradinho com borda clara (de longe vira um pontinho cintilante)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for y in range(1, size - 1):
        for x in range(1, size - 1):
            edge = x in (1, size - 2) or y in (1, size - 2)
            px[x, y] = (255, 255, 255, 255) if edge else (200, 200, 200, 255)
    return img


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
    for name, n, R, ry, spd in (("nano_cloud", 70, 1.5, 0.8, 300), ("nano_shield", 160, 2.5, 1.0, 220), ("nano_big", 220, 4.5, 1.0, 160)):
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
    for fname, data in fx.items():
        wjson(os.path.join(RP, "particles", fname), data)
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
    clean()
    m, tex = build_drone(previews)
    build_robot(previews)
    build_render_controllers()
    build_particles()
    wjson(os.path.join(RP, "sounds", "sound_definitions.json"), build_sounds(RP))
    build_texts()
    manifests(portrait(m, tex))
    if previews:
        wpng(os.path.join(PREVIEW_DIR, "portrait.png"), portrait(m, tex, 512))
    print("assets ok", m.stats())


if __name__ == "__main__":
    main()
