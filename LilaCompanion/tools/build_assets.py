#!/usr/bin/env python3
"""Lila Companion — asset build.

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

from forge import controller_art  # noqa: E402
from forge.anim import controllers_file  # noqa: E402
from forge.lila_anims import ACTIONS, MOVES, action_controller, lila_anims, move_controller  # noqa: E402
from forge.lila_art import bake_lila, lila_model  # noqa: E402
from forge.paint import bake  # noqa: E402
from forge.render import render  # noqa: E402

VERSION = [1, 0, 0]
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
                "particles", "textures", "texts"]

LANGS = {
    "en_US": {
        "entity.lila:lila.name": "Lila",
        "item.lila.controller.name": "Lila's Controller",
        "action.interact.lila.talk": "Talk",
    },
    "pt_BR": {
        "entity.lila:lila.name": "Lila",
        "item.lila.controller.name": "Controle da Lila",
        "action.interact.lila.talk": "Conversar",
    },
}
LANGS["pt_PT"] = dict(LANGS["pt_BR"])
LANGS["es_ES"] = {"entity.lila:lila.name": "Lila", "item.lila.controller.name": "Mando de Lila",
                  "action.interact.lila.talk": "Hablar"}


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
        "header": {"name": "Lila Companion (BP)",
                   "description": "§aLila§r — companheira autônoma\n§7Criado por 0neajx",
                   "uuid": UUID["bp_header"], "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [
            {"type": "data", "uuid": UUID["bp_data"], "version": VERSION, "description": "Lila behaviors"},
            {"type": "script", "language": "javascript", "uuid": UUID["bp_script"], "version": VERSION,
             "entry": "scripts/main.js", "description": "Lila brain"},
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
        "header": {"name": "Lila Companion (RP)",
                   "description": "§aLila§r — modelo, animações e controle\n§7Criado por 0neajx",
                   "uuid": UUID["rp_header"], "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [{"type": "resources", "uuid": UUID["rp_res"], "version": VERSION, "description": "Lila resources"}],
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
    hide = {b: {"hide": True} for b in ("rightLeg", "leftLeg", "skirt", "eyelids")}
    img = render(model, tex, size=size, yaw=18, pitch=6, pose=hide, alphatest=True, outline=True, zoom=1.0)
    # recentre on the head: crop the upper part and scale back
    w = size
    crop = img.crop((int(w * 0.17), int(w * 0.02), int(w * 0.83), int(w * 0.68))).resize((size, size), Image.LANCZOS)
    bg = backdrop(size)
    glow = crop.split()[3].filter(ImageFilter.GaussianBlur(size / 40))
    halo = Image.new("RGBA", (size, size), (70, 230, 160, 0))
    halo.putalpha(glow.point(lambda v: int(v * 0.55)))
    bg.alpha_composite(halo)
    bg.alpha_composite(crop)
    return bg


# ============================================================ Lila (entity)
def build_lila(previews):
    m = lila_model()
    geo = m.to_json()
    wjson(os.path.join(RP, "models", "entity", "lila", "lila.geo.json"), geo)
    tex = bake_lila(m)
    wpng(os.path.join(RP, "textures", "entity", "lila", "lila.png"), tex)

    A = lila_anims()
    wjson(os.path.join(RP, "animations", "lila", "lila.animation.json"),
          {"format_version": "1.10.0", "animations": {name: data for _, (name, data) in A.items()}})
    ctrls = [move_controller(), action_controller()]
    wjson(os.path.join(RP, "animation_controllers", "lila", "lila.ac.json"), controllers_file(ctrls))
    amap = {k: name for k, (name, _) in A.items()}
    amap["ctrl_move"] = "controller.animation.lila.move"
    amap["ctrl_act"] = "controller.animation.lila.action"
    wjson(os.path.join(RP, "entity", "lila", "lila.entity.json"), {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": "lila:lila",
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": "textures/entity/lila/lila"},
                "geometry": {"default": "geometry.lila.lila"},
                "animations": amap,
                "particle_effects": {"sparkle": "lila:sparkle"},
                "scripts": {"scale": "0.9375", "animate": ["look", "ctrl_move", "ctrl_act", "life"]},
                "render_controllers": ["controller.render.lila.lila"],
                "enable_attachables": True,
            }
        },
    })

    wjson(os.path.join(BP, "entities", "lila.json"), lila_bp_entity())
    if previews:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        bg = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
        views = [(-30, 12), (0, 6), (150, 10), (35, 18)]
        for i, (y, p) in enumerate(views):
            img = render(m, tex, size=520, yaw=y, pitch=p, pose={"eyelids": {"hide": True}}, alphatest=True, outline=True)
            wpng(os.path.join(PREVIEW_DIR, f"lila_view_{i}.png"), img)
        poses = {
            "mine": {"rightArm": {"rot": (-120, 8, 0)}, "body": {"rot": (4, 10, 0)}, "head": {"rot": (12, 0, 0)}, "eyelids": {"hide": True}},
            "wave": {"rightArm": {"rot": (-168, 0, -16)}, "eyelids": {"hide": True}},
            "sit": {"waist": {"pos": (0, -10, 0)}, "rightLeg": {"rot": (-88, 12, 0)}, "leftLeg": {"rot": (-88, -12, 0)},
                    "rightArm": {"rot": (-34, 0, 6)}, "leftArm": {"rot": (-34, 0, -6)}, "skirt": {"rot": (-30, 0, 0)}, "eyelids": {"hide": True}},
            "sleep": {"root": {"rot": (-90, 0, 0), "pos": (0, 2, 12)}},
        }
        for k, pose in poses.items():
            img = render(m, tex, size=420, yaw=-28 if k != "sleep" else 60, pitch=12 if k != "sleep" else 40, pose=pose, alphatest=True, outline=True)
            wpng(os.path.join(PREVIEW_DIR, f"lila_pose_{k}.png"), img)
    return m, tex


FRIENDLY = [
    {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "player"}}, "deals_damage": "no"},
    {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "lila"}}, "deals_damage": "no"},
    {"cause": "fall", "deals_damage": "no"},
    {"cause": "suffocation", "deals_damage": "no"},
    {"cause": "drowning", "deals_damage": "no"},
    {"cause": "fly_into_wall", "deals_damage": "no"},
]


def lila_bp_entity():
    return {
        "format_version": ENTITY_FORMAT,
        "minecraft:entity": {
            "description": {
                "identifier": "lila:lila",
                "is_spawnable": False,
                "is_summonable": True,
                "properties": {
                    "lila:action": {"type": "enum", "values": ACTIONS, "default": "idle", "client_sync": True},
                    "lila:move": {"type": "enum", "values": MOVES, "default": "none", "client_sync": True},
                },
            },
            "component_groups": {
                "lila:despawn": {"minecraft:instant_despawn": {"remove_child_entities": False}},
            },
            "components": {
                "minecraft:type_family": {"family": ["lila", "lila_companion", "npc", "mob"]},
                "minecraft:health": {"value": 100, "max": 100},
                "minecraft:attack": {"damage": 4},
                "minecraft:movement": {"value": 0.3},
                "minecraft:collision_box": {"width": 0.6, "height": 1.8},
                "minecraft:physics": {"has_gravity": True, "has_collision": True},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
                "minecraft:knockback_resistance": {"value": 0.6},
                "minecraft:jump.static": {},
                "minecraft:can_climb": {},
                "minecraft:movement.basic": {},
                "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True,
                                              "can_pass_doors": True, "can_open_doors": True},
                "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": False},
                "minecraft:persistent": {},
                "minecraft:breathable": {"total_supply": 60, "suffocate_time": 0, "breathes_water": True},
                "minecraft:damage_sensor": {"triggers": FRIENDLY},
                "minecraft:inventory": {"inventory_size": 36, "container_type": "inventory", "private": True},
                "minecraft:interact": {"interactions": [{
                    "on_interact": {"filters": {"test": "is_family", "subject": "other", "value": "player"},
                                    "event": "lila:interacted", "target": "self"},
                    "interact_text": "action.interact.lila.talk",
                    "swing": True,
                }]},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 10, "probability": 0.03},
                "minecraft:behavior.random_look_around": {"priority": 9},
                "minecraft:conditional_bandwidth_optimization": {},
                "minecraft:experience_reward": {"on_death": "0"},
            },
            "events": {
                "lila:despawn": {"add": {"component_groups": ["lila:despawn"]}},
                "lila:interacted": {"remove": {"component_groups": []}},
            },
        },
    }


# ============================================================ controller item
def build_controller(previews):
    im = controller_art.icon_model()
    itex = bake(im)
    im.to_json()
    icon = render(im, itex, size=64, yaw=-22, pitch=24, ssaa=4, outline=True)
    wpng(os.path.join(RP, "textures", "items", "lila", "controller.png"), icon)
    wjson(os.path.join(RP, "textures", "item_texture.json"), {
        "resource_pack_name": "lila", "texture_name": "atlas.items",
        "texture_data": {"lila_controller": {"textures": "textures/items/lila/controller"}}})

    hm = controller_art.held_model()
    wjson(os.path.join(RP, "models", "entity", "lila", "controller_held.geo.json"), hm.to_json())
    htex = bake(hm)
    wpng(os.path.join(RP, "textures", "entity", "lila", "controller_held.png"), htex)
    anims = {
        "animation.lila.controller.first": {"loop": True, "bones": {"pad": {"rotation": [0, 0, 0]}}},
        "animation.lila.controller.third": {"loop": True, "bones": {"pad": {"rotation": [0, 0, 0]}}},
        "animation.lila.controller.idle": {"loop": True, "bones": {"pad": {"position": [0, "math.sin(q.life_time * 120) * 0.08", 0]}}},
    }
    wjson(os.path.join(RP, "animations", "lila", "controller.animation.json"), {"format_version": "1.10.0", "animations": anims})
    wjson(os.path.join(RP, "attachables", "lila", "controller.json"), {
        "format_version": "1.10.0",
        "minecraft:attachable": {"description": {
            "identifier": "lila:controller",
            "materials": {"default": "entity_emissive_alpha", "enchanted": "entity_emissive_alpha"},
            "textures": {"default": "textures/entity/lila/controller_held", "enchanted": "textures/misc/enchanted_item_glint"},
            "geometry": {"default": "geometry.lila.controller_held"},
            "animations": {"first": "animation.lila.controller.first", "third": "animation.lila.controller.third",
                           "idle": "animation.lila.controller.idle"},
            "scripts": {"animate": [{"first": "c.is_first_person"}, {"third": "!c.is_first_person"}, "idle"]},
            "render_controllers": ["controller.render.lila.item"],
        }}})

    wjson(os.path.join(BP, "items", "controller.json"), {
        "format_version": ITEM_FORMAT,
        "minecraft:item": {
            "description": {"identifier": "lila:controller", "menu_category": {"category": "equipment"}},
            "components": {
                "minecraft:icon": "lila_controller",
                "minecraft:display_name": {"value": "item.lila.controller.name"},
                "minecraft:max_stack_size": 1,
                "minecraft:hand_equipped": False,
                "minecraft:allow_off_hand": True,
                "minecraft:rarity": "rare",
                "minecraft:tags": {"tags": ["lila:controller"]},
            },
        }})
    for ident, ingot in (("lila:controller_iron", "minecraft:iron_ingot"), ("lila:controller_copper", "minecraft:copper_ingot")):
        wjson(os.path.join(BP, "recipes", ident.split(":")[1] + ".json"), {
            "format_version": "1.20.10",
            "minecraft:recipe_shaped": {
                "description": {"identifier": ident},
                "tags": ["crafting_table"],
                "pattern": [" R ", "IBI", "I I"],
                "key": {"R": {"item": "minecraft:redstone"}, "I": {"item": ingot}, "B": {"item": "minecraft:stone_button"}},
                "unlock": [{"item": ingot}],
                "result": {"item": "lila:controller"},
            }})
    if previews:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        wpng(os.path.join(PREVIEW_DIR, "controller.png"), render(im, itex, size=360, yaw=-22, pitch=24, ssaa=3))


def build_render_controllers():
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


def build_particles():
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
                    f.write("pack.name=Lila Companion\npack.description=Lila\n")


def main():
    previews = "--previews" in sys.argv
    clean()
    m, tex = build_lila(previews)
    build_controller(previews)
    build_render_controllers()
    build_particles()
    build_texts()
    manifests(portrait(m, tex))
    if previews:
        wpng(os.path.join(PREVIEW_DIR, "portrait.png"), portrait(m, tex, 512))
    print("assets ok", m.stats())


if __name__ == "__main__":
    main()
