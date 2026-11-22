"""Gera tudo do Sistema de Raças (Roleta das Essências) para os pacotes:
- override do jogador (BP: propriedades lila:race/wing/bat/pose/fly + escala do gigante e do
  morcego; RP: asas, auréolas, coroas, vampiro, gigante e morcego desenhados no corpo, com animações)
  a partir dos arquivos OFICIAIS 1.26 guardados em tools/vanilla/;
- a roda da roleta (entidade que gira no cliente e para no setor sorteado);
- itens: Roleta das Essências, Núcleo da Raça, Lâmina Divina e Foice do Vazio (3D na mão);
- partículas únicas de cada raça; 600 ícones de poder + emblemas."""
from __future__ import annotations

import copy
import json
import math
import os
import random
import subprocess

from PIL import Image, ImageDraw, ImageFilter

from .geom import Model, Paint
from .race_art import RACE_COLORS, RACE_ORDER, bat_model, crown, divine_sword, giant_overlay, roulette_held, roulette_model, vampire_overlay, void_scythe, wings

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VANILLA = os.path.join(ROOT, "tools", "vanilla")
POSES = ["none", "cast", "slam", "drain", "slash", "roar", "pray", "dash", "transform"]
RACE_N = {r: i + 1 for i, r in enumerate(RACE_ORDER)}
ATTACH = {  # chave → (modelo, condição de raça)
    "lila_wings_angel": (lambda: wings("angel"), "q.property('lila:race') == 3"),
    "lila_wings_demon": (lambda: wings("demon"), "q.property('lila:race') == 4"),
    "lila_wings_god": (lambda: wings("god"), "q.property('lila:race') == 5"),
    "lila_wings_dark": (lambda: wings("dark"), "q.property('lila:race') == 6"),
    "lila_halo_angel": (lambda: crown("angel"), "q.property('lila:race') == 3"),
    "lila_halo_demon": (lambda: crown("demon"), "q.property('lila:race') == 4"),
    "lila_crown_god": (lambda: crown("god"), "q.property('lila:race') == 5"),
    "lila_crown_dark": (lambda: crown("dark"), "q.property('lila:race') == 6"),
    "lila_vampire": (vampire_overlay, "q.property('lila:race') == 1"),
    "lila_giant": (giant_overlay, "q.property('lila:race') == 2"),
}
TP = "!variable.is_first_person && !variable.map_face_icon && !query.is_spectator"


def _anim(name, bones, loop=True, length=None):
    a = {"loop": loop, "bones": bones}
    if length:
        a["animation_length"] = length
    return name, a


def player_animations():
    """Animações extras do jogador (asas, auréola, capa, morcego, poses dos poderes)."""
    A = {}
    t = "q.life_time"
    grow = "(0.3 + 0.7 * math.min(1, q.property('lila:wing') / 20))"
    for side, sx in (("r", -1), ("l", 1)):
        pass
    A["lila_wing_rest"] = _anim("animation.lila.race.wing_rest", {
        "wing_r": {"rotation": [0, f"-28 + math.sin({t} * 70) * 2", f"math.sin({t} * 90) * 3"]},
        "wing_l": {"rotation": [0, f"28 - math.sin({t} * 70) * 2", f"-math.sin({t} * 90) * 3"]},
        "wing_r_tip": {"rotation": [0, "-14", 0]}, "wing_l_tip": {"rotation": [0, "14", 0]},
    })
    A["lila_wing_flap"] = _anim("animation.lila.race.wing_flap", {
        "wing_r": {"rotation": [0, f"math.sin({t} * 820 + 90) * 10", f"-math.sin({t} * 820) * 34"]},
        "wing_l": {"rotation": [0, f"-math.sin({t} * 820 + 90) * 10", f"math.sin({t} * 820) * 34"]},
        "wing_r_mid": {"rotation": [0, 0, f"-math.sin({t} * 820 - 40) * 16"]},
        "wing_l_mid": {"rotation": [0, 0, f"math.sin({t} * 820 - 40) * 16"]},
        "wing_r_tip": {"rotation": [0, 0, f"-math.sin({t} * 820 - 80) * 20"]},
        "wing_l_tip": {"rotation": [0, 0, f"math.sin({t} * 820 - 80) * 20"]},
    })
    A["lila_wing_glide"] = _anim("animation.lila.race.wing_glide", {
        "wing_r": {"rotation": [0, 0, f"-6 + math.sin({t} * 160) * 4"]}, "wing_l": {"rotation": [0, 0, f"6 - math.sin({t} * 160) * 4"]},
    })
    A["lila_wing_grow"] = _anim("animation.lila.race.wing_grow", {"wing_r": {"scale": grow}, "wing_l": {"scale": grow}})
    A["lila_halo"] = _anim("animation.lila.race.halo", {"halo": {"position": [0, f"math.sin({t} * 120) * 0.35", 0], "rotation": [0, f"{t} * 40", 0]}})
    A["lila_cape"] = _anim("animation.lila.race.cape", {"cape_v": {"rotation": [f"6 + math.sin({t} * 100) * 3 + q.modified_move_speed * 40", 0, 0]}})
    A["lila_bat"] = _anim("animation.lila.race.bat", {
        "bwing_r": {"rotation": [0, 0, f"math.sin({t} * 1700) * 50"]}, "bwing_l": {"rotation": [0, 0, f"-math.sin({t} * 1700) * 50"]},
        "bwing_r_tip": {"rotation": [0, 0, f"math.sin({t} * 1700 - 60) * 30"]}, "bwing_l_tip": {"rotation": [0, 0, f"-math.sin({t} * 1700 - 60) * 30"]},
        "bat": {"position": [0, f"math.sin({t} * 400) * 1.2", 0]},
    })
    k = lambda pts: {str(tt): v for tt, v in pts}  # noqa: E731
    A["lila_pose_cast"] = _anim("animation.lila.race.pose_cast", {"rightArm": {"rotation": k([(0, [-20, 0, 0]), (0.1, [-115, 8, 0]), (0.5, [-100, 4, 0])])},
                                                                   "leftArm": {"rotation": [-20, 0, -10]}}, loop="hold_on_last_frame", length=0.5)
    A["lila_pose_slam"] = _anim("animation.lila.race.pose_slam", {"rightArm": {"rotation": k([(0, [-170, 0, 10]), (0.25, [-175, 0, 12]), (0.4, [-30, 0, 5])])},
                                                                   "leftArm": {"rotation": k([(0, [-170, 0, -10]), (0.25, [-175, 0, -12]), (0.4, [-30, 0, -5])])},
                                                                   "body": {"rotation": k([(0, [-8, 0, 0]), (0.25, [-10, 0, 0]), (0.4, [14, 0, 0])])}}, loop="hold_on_last_frame", length=0.5)
    A["lila_pose_drain"] = _anim("animation.lila.race.pose_drain", {"rightArm": {"rotation": [-80, -18, 0]}, "leftArm": {"rotation": [-80, 18, 0]},
                                                                     "head": {"rotation": [f"14 + math.sin({t} * 300) * 3", 0, 0]}})
    A["lila_pose_slash"] = _anim("animation.lila.race.pose_slash", {"rightArm": {"rotation": k([(0, [-150, 0, 40]), (0.14, [-40, -20, -30]), (0.3, [-20, 0, 0])])},
                                                                     "body": {"rotation": k([(0, [0, 25, 0]), (0.14, [0, -30, 0]), (0.3, [0, 0, 0])])}}, loop="hold_on_last_frame", length=0.3)
    A["lila_pose_roar"] = _anim("animation.lila.race.pose_roar", {"rightArm": {"rotation": [f"-150 + math.sin({t} * 900) * 4", 0, 20]},
                                                                   "leftArm": {"rotation": [f"-150 - math.sin({t} * 900) * 4", 0, -20]},
                                                                   "head": {"rotation": [-25, 0, 0]}, "body": {"rotation": [-8, 0, 0]}})
    A["lila_pose_pray"] = _anim("animation.lila.race.pose_pray", {"rightArm": {"rotation": [-65, 28, 0]}, "leftArm": {"rotation": [-65, -28, 0]},
                                                                   "head": {"rotation": [12, 0, 0]}})
    A["lila_pose_dash"] = _anim("animation.lila.race.pose_dash", {"rightArm": {"rotation": [40, 0, 12]}, "leftArm": {"rotation": [40, 0, -12]},
                                                                   "body": {"rotation": [18, 0, 0]}})
    elastic = "math.min(1, q.anim_time * 1.6) + math.sin(math.min(1, q.anim_time * 1.6) * 540) * 0.12 * (1 - math.min(1, q.anim_time * 1.6))"
    A["lila_pose_transform"] = _anim("animation.lila.race.pose_transform", {
        "rightArm": {"rotation": k([(0, [0, 0, 0]), (0.5, [-160, 0, 25]), (1.8, [-150, 0, 30]), (2.3, [0, 0, 0])])},
        "leftArm": {"rotation": k([(0, [0, 0, 0]), (0.5, [-160, 0, -25]), (1.8, [-150, 0, -30]), (2.3, [0, 0, 0])])},
        "head": {"rotation": k([(0, [0, 0, 0]), (0.5, [-30, 0, 0]), (1.8, [-25, 0, 0]), (2.3, [0, 0, 0])])},
        "wing_r": {"scale": elastic}, "wing_l": {"scale": elastic}, "halo": {"scale": elastic},
    }, loop="hold_on_last_frame", length=2.3)
    return A


def player_overrides(BP, RP, wjson):
    """player.json (BP) e player.entity.json (RP) oficiais + o que o sistema de raças precisa."""
    bp = json.load(open(os.path.join(VANILLA, "player.json"), encoding="utf-8"))
    e = bp["minecraft:entity"]
    e["description"]["properties"] = {
        "lila:race": {"type": "int", "range": [0, 6], "default": 0, "client_sync": True},
        "lila:wing": {"type": "int", "range": [0, 20], "default": 0, "client_sync": True},
        "lila:bat": {"type": "bool", "default": False, "client_sync": True},
        "lila:fly": {"type": "bool", "default": False, "client_sync": True},
        "lila:pose": {"type": "enum", "values": POSES, "default": "none", "client_sync": True},
    }
    e["component_groups"]["lila:giant"] = {"minecraft:scale": {"value": 4.5}, "minecraft:collision_box": {"width": 2.6, "height": 8.1}}
    e["component_groups"]["lila:bat"] = {"minecraft:scale": {"value": 0.32}}
    e["events"]["lila:giant_on"] = {"add": {"component_groups": ["lila:giant"]}, "remove": {"component_groups": ["lila:bat"]}}
    e["events"]["lila:giant_off"] = {"remove": {"component_groups": ["lila:giant"]}}
    e["events"]["lila:bat_on"] = {"add": {"component_groups": ["lila:bat"]}, "remove": {"component_groups": ["lila:giant"]}}
    e["events"]["lila:bat_off"] = {"remove": {"component_groups": ["lila:bat"]}}
    wjson(os.path.join(BP, "entities", "player.json"), bp)

    rp = json.load(open(os.path.join(VANILLA, "player.entity.json"), encoding="utf-8"))
    d = rp["minecraft:client_entity"]["description"]
    d["materials"]["lila_glow"] = "entity_emissive_alpha"
    for key in list(ATTACH) + ["lila_vbat"]:
        name = key.replace("lila_", "")
        d["geometry"][key] = f"geometry.lila.{name}"
        d["textures"][key] = f"textures/entity/lila/race/{name}"
    A = player_animations()
    for k, (name, _) in A.items():
        d["animations"][k] = name
    anim = d["scripts"]["animate"]
    wings = "q.property('lila:race') >= 3"
    anim += [{"lila_wing_rest": f"{wings} && q.is_on_ground && !q.property('lila:fly')"},
             {"lila_wing_flap": f"{wings} && (q.property('lila:fly') || (!q.is_on_ground && q.vertical_speed > -0.2))"},
             {"lila_wing_glide": f"{wings} && !q.is_on_ground && !q.property('lila:fly') && q.vertical_speed <= -0.2"},
             {"lila_wing_grow": "q.property('lila:race') == 3 || q.property('lila:race') == 4"},
             {"lila_halo": wings}, {"lila_cape": "q.property('lila:race') == 1"}, {"lila_bat": "q.property('lila:bat')"}]
    for pose in POSES[1:]:
        anim.append({f"lila_pose_{pose}": f"q.property('lila:pose') == '{pose}'"})
    # some com o jogador na forma de morcego e mostra o morcego
    for rc in d["render_controllers"]:
        for k in list(rc):
            if k in ("controller.render.player.first_person", "controller.render.player.third_person"):
                rc[k] = f"({rc[k]}) && !q.property('lila:bat')"
    for key, (_, cond) in ATTACH.items():
        d["render_controllers"].append({f"controller.render.{key}": f"{cond} && !q.property('lila:bat') && {TP}"})
    d["render_controllers"].append({"controller.render.lila_vbat": f"q.property('lila:bat') && {TP}"})
    wjson(os.path.join(RP, "entity", "player.entity.json"), rp)
    wjson(os.path.join(RP, "animations", "lila", "race_player.animation.json"), {"format_version": "1.10.0", "animations": {n: a for _, (n, a) in A.items()}})
    rcs = {}
    for key in list(ATTACH) + ["lila_vbat"]:
        rcs[f"controller.render.{key}"] = {"geometry": f"Geometry.{key}", "materials": [{"*": "Material.lila_glow"}], "textures": [f"Texture.{key}"]}
    wjson(os.path.join(RP, "render_controllers", "lila_race.render_controllers.json"), {"format_version": "1.8.0", "render_controllers": rcs})


def build_models(RP, wjson, wpng, bake, render, preview_dir, previews):
    out = {}
    parts = {k.replace("lila_", ""): fn for k, (fn, _) in ATTACH.items()}
    parts["vbat"] = bat_model
    for name, fn in parts.items():
        m = fn()
        tex = bake(m)
        wjson(os.path.join(RP, "models", "entity", "lila", "race", f"{name}.geo.json"), m.to_json())
        wpng(os.path.join(RP, "textures", "entity", "lila", "race", f"{name}.png"), tex)
        out[name] = (m, tex)
    if previews:
        sheet = Image.new("RGBA", (5 * 240, 3 * 240), (0, 0, 0, 0))
        for i, (name, (m, tex)) in enumerate(out.items()):
            im = render(m, tex, size=240, yaw=150 if "wings" in name else -30, pitch=12, outline=True)
            sheet.alpha_composite(im, ((i % 5) * 240, (i // 5) * 240))
        wpng(os.path.join(preview_dir, "race_parts.png"), sheet)
    return out


def build_roulette(BP, RP, wjson, wpng, bake, render, preview_dir, previews):
    m = roulette_model()
    tex = bake(m)
    wjson(os.path.join(RP, "models", "entity", "lila", "race", "roulette.geo.json"), m.to_json())
    wpng(os.path.join(RP, "textures", "entity", "lila", "race", "roulette.png"), tex)
    spin = "math.min(1, q.life_time / 4.6)"
    final = "(1800 + 60 * q.property('lila:result'))"
    anims = {
        "animation.lila.roulette.spin": {"loop": True, "bones": {
            "wheel": {"rotation": [0, 0, f"{final} * (1 - math.pow(1 - {spin}, 3))"]},
            "pointer": {"rotation": [0, 0, f"math.sin(q.life_time * 2400) * 14 * (1 - {spin})"]},
            "root": {"scale": "math.min(1, q.life_time * 3) + math.sin(math.min(1, q.life_time * 3) * 360) * 0.1 * (1 - math.min(1, q.life_time * 3))",
                     "position": [0, "math.sin(q.life_time * 90) * 0.6", 0]}}},
    }
    wjson(os.path.join(RP, "animations", "lila", "roulette.animation.json"), {"format_version": "1.10.0", "animations": anims})
    wjson(os.path.join(RP, "entity", "lila", "roulette.entity.json"), {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "lila:roulette", "materials": {"default": "entity_emissive_alpha"},
        "textures": {"default": "textures/entity/lila/race/roulette"}, "geometry": {"default": "geometry.lila.roulette"},
        "animations": {"spin": "animation.lila.roulette.spin"}, "scripts": {"animate": ["spin"]},
        "particle_effects": {"spark": "lila:rc_roulette"}, "render_controllers": ["controller.render.lila.item"]}}})
    wjson(os.path.join(BP, "entities", "roulette.json"), {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": "lila:roulette", "is_spawnable": False, "is_summonable": True, "properties": {
            "lila:result": {"type": "int", "range": [0, 5], "default": 0, "client_sync": True}}},
        "component_groups": {"lila:despawn": {"minecraft:instant_despawn": {}}},
        "components": {"minecraft:collision_box": {"width": 0.1, "height": 0.1}, "minecraft:physics": {"has_gravity": False, "has_collision": False},
                       "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False}, "minecraft:health": {"value": 1, "max": 1},
                       "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]}, "minecraft:knockback_resistance": {"value": 1},
                       "minecraft:type_family": {"family": ["lila_roulette", "inanimate"]}, "minecraft:conditional_bandwidth_optimization": {}},
        "events": {"lila:despawn": {"add": {"component_groups": ["lila:despawn"]}}}}})
    return m, tex


def core_model():
    m = Model("geometry.lila.race_core", 32, 32, density=4, bounds=(1, 1, (0, 0.5, 0)))
    r = m.bone("core", None, pivot=(0, 0, 0))
    r.binding = "q.item_slot_to_bone_name(c.item_slot)"
    r.box((0, 4, 0), (3.2, 3.2, 3.2), Paint(mat="crystal", color=(120, 40, 200), color2=(255, 220, 255), seed=1001), rotation=(45, 0, 45), pivot=(0, 4, 0))
    for a in range(8):
        ang = math.tau * a / 8
        p = (math.cos(ang) * 3, 4, math.sin(ang) * 3)
        r.box(p, (1.2, 0.6, 0.6), Paint(mat="metal", color=(200, 150, 50), color2=(255, 230, 140), seed=1002), rotation=(0, -math.degrees(ang), 0), pivot=p)
    return m


def build_items(BP, RP, wjson, wpng, bake, render, item_textures, langs):
    W = [("race_roulette", roulette_held(), "geometry.lila.roulette_held", (-20, 20)), ("divine_sword", divine_sword(), "geometry.lila.divine_sword", (-35, 18)),
         ("void_scythe", void_scythe(), "geometry.lila.void_scythe", (-35, 18)), ("race_core", core_model(), "geometry.lila.race_core", (-20, 20))]
    for key, m, geo, (yaw, pitch) in W:
        tex = bake(m)
        wjson(os.path.join(RP, "models", "entity", "lila", "race", f"{key}_held.geo.json"), m.to_json())
        wpng(os.path.join(RP, "textures", "entity", "lila", "race", f"{key}_held.png"), tex)
        wpng(os.path.join(RP, "textures", "items", "lila", f"{key}.png"), render(m, tex, size=64, yaw=yaw, pitch=pitch, ssaa=4, zoom=1.1))
        item_textures[f"lila_{key}"] = {"textures": f"textures/items/lila/{key}"}
        bone = m.bones[0].name
        big = key == "void_scythe"
        weap = key in ("divine_sword", "void_scythe")
        anims = {
            f"animation.lila.{key}.first": {"loop": True, "bones": {bone: {"rotation": [62 if weap else 20, -8, 12] if weap else [10, 0, 0],
                                                                           "position": [0, 1 if weap else 2, -2 if weap else 0], "scale": 0.75 if big else 0.9}}},
            f"animation.lila.{key}.third": {"loop": True, "bones": {bone: {"rotation": [76 if weap else 0, 0, 0], "position": [0, 0, -1 if weap else 0],
                                                                           "scale": 0.85 if big else 1.0}}},
            f"animation.lila.{key}.idle": {"loop": True, "bones": {bone: {"position": [0, "math.sin(q.life_time * 120) * 0.25", 0]} if not weap else {}}},
        }
        wjson(os.path.join(RP, "animations", "lila", f"{key}_held.animation.json"), {"format_version": "1.10.0", "animations": anims})
        wjson(os.path.join(RP, "attachables", "lila", f"{key}.json"), {"format_version": "1.10.0", "minecraft:attachable": {"description": {
            "identifier": f"lila:{key}", "materials": {"default": "entity_emissive_alpha", "enchanted": "entity_emissive_alpha"},
            "textures": {"default": f"textures/entity/lila/race/{key}_held", "enchanted": "textures/misc/enchanted_item_glint"},
            "geometry": {"default": geo},
            "animations": {"first": f"animation.lila.{key}.first", "third": f"animation.lila.{key}.third", "idle": f"animation.lila.{key}.idle"},
            "scripts": {"animate": [{"first": "c.is_first_person"}, {"third": "!c.is_first_person"}, "idle"]},
            "render_controllers": ["controller.render.lila.item"]}}})
        comps = {"minecraft:icon": f"lila_{key}", "minecraft:display_name": {"value": f"item.lila.{key}.name"}, "minecraft:max_stack_size": 1,
                 "minecraft:hand_equipped": weap, "minecraft:rarity": "epic" if key != "race_core" else "rare", "minecraft:glint": key == "race_roulette",
                 "minecraft:tags": {"tags": ["lila:race"]}}
        if key == "race_roulette":
            comps["minecraft:max_stack_size"] = 16
        if key == "race_core":
            comps["minecraft:use_modifiers"] = {"use_duration": 60, "movement_modifier": 1.0}
            comps["minecraft:allow_off_hand"] = True
        if weap:
            comps["minecraft:damage"] = {"value": 7}  # dano de item comum; o script dá 30/35 ao dono certo
            comps["minecraft:can_destroy_in_creative"] = False
            comps["minecraft:tags"] = {"tags": ["lila:race", "minecraft:is_sword" if key == "divine_sword" else "minecraft:is_tool", "minecraft:netherite_tier"]}
            if key == "void_scythe":
                comps["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": {"tags": "query.any_tag('stone', 'metal', 'wood', 'log', 'dirt', 'sand', 'gravel', 'grass', 'plant', 'minecraft:is_pickaxe_item_destructible', 'minecraft:is_axe_item_destructible', 'minecraft:is_shovel_item_destructible')"}, "speed": 40}]}
        wjson(os.path.join(BP, "items", f"{key}.json"), {"format_version": "1.21.90", "minecraft:item": {
            "description": {"identifier": f"lila:{key}", "menu_category": {"category": "equipment" if key == "race_roulette" else "none"}}, "components": comps}})
    wjson(os.path.join(BP, "recipes", "race_roulette.json"), {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "lila:race_roulette"}, "tags": ["crafting_table"], "pattern": ["AGA", "EDE", "AGA"],
        "key": {"A": {"item": "minecraft:amethyst_shard"}, "G": {"item": "minecraft:gold_ingot"}, "E": {"item": "minecraft:ender_eye"}, "D": {"item": "minecraft:diamond"}},
        "unlock": [{"item": "minecraft:amethyst_shard"}], "result": {"item": "lila:race_roulette"}}})
    names = {
        "pt_BR": {"race_roulette": "Roleta das Essências", "race_core": "Núcleo da Raça", "divine_sword": "Lâmina Divina", "void_scythe": "Foice do Vazio"},
        "en_US": {"race_roulette": "Essence Roulette", "race_core": "Race Core", "divine_sword": "Divine Blade", "void_scythe": "Void Scythe"},
        "es_ES": {"race_roulette": "Ruleta de las Esencias", "race_core": "Núcleo de la Raza", "divine_sword": "Hoja Divina", "void_scythe": "Guadaña del Vacío"},
    }
    for lg, n in names.items():
        for k, v in n.items():
            langs.setdefault(lg, {})[f"item.lila.{k}.name"] = v
        langs[lg]["entity.lila:roulette.name"] = n["race_roulette"]
    if "pt_BR" in langs:
        langs["pt_PT"] = dict(langs["pt_BR"])


# ------------------------------------------------------------------ partículas
def _p(ident, tex, comps):
    return {"format_version": "1.10.0", "particle_effect": {"description": {"identifier": ident, "basic_render_parameters": {"material": "particles_blend", "texture": tex}},
                                                             "components": comps}}


def _bb(size, grow=None, tw=16):
    s = f"{size} * (1 - v.particle_age / v.particle_lifetime * 0.6)" if grow is None else grow
    return {"size": [s, s], "facing_camera_mode": "rotate_xyz", "uv": {"texture_width": tw, "texture_height": tw, "uv": [0, 0], "uv_size": [tw, tw]}}


def _tint(grad):
    return {"color": {"interpolant": "v.particle_age / v.particle_lifetime", "gradient": grad}}


def race_particles(RP, wjson, wpng):
    soft, spark, chunk, feather = "textures/particle/lila/soft", "textures/particle/lila/sparkle", "textures/particle/lila/chunk", "textures/particle/lila/feather"
    # texturas novas
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.polygon([(3, 5), (12, 2), (14, 11), (6, 14), (2, 10)], fill=(255, 255, 255, 255))
    dr.line([(4, 6), (12, 4)], fill=(200, 200, 200, 255))
    wpng(os.path.join(RP, "textures", "particle", "lila", "chunk.png"), img)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.ellipse((5, 1, 11, 15), fill=(255, 255, 255, 255))
    dr.line([(8, 1), (8, 15)], fill=(190, 190, 190, 255))
    wpng(os.path.join(RP, "textures", "particle", "lila", "feather.png"), img)
    pt = {"minecraft:emitter_shape_point": {"offset": [0, 0, 0]}}
    once = lambda n, dur=0.05: {"minecraft:emitter_rate_instant": {"num_particles": n}, "minecraft:emitter_lifetime_once": {"active_time": dur}}  # noqa: E731
    life = lambda a, b: {"minecraft:particle_lifetime_expression": {"max_lifetime": f"math.random({a}, {b})"}}  # noqa: E731
    fx = {}
    PAL = {
        "vampire": ({"0.0": "#FFFF3040", "0.5": "#FF8A0818", "1.0": "#00400008"}, soft, (0, -6, 0), 0.16),
        "giant": ({"0.0": "#FFB89A70", "0.6": "#FF7A6650", "1.0": "#005A4C3C"}, chunk, (0, -9, 0), 0.22),
        "angel": ({"0.0": "#FFFFFFFF", "0.5": "#FFFFF0B0", "1.0": "#00FFE080"}, feather, (0, -0.6, 0), 0.18),
        "demon": ({"0.0": "#FFFFE080", "0.4": "#FFFF6010", "1.0": "#00601000"}, soft, (0, 2.5, 0), 0.3),
        "god": ({"0.0": "#FFFFFFFF", "0.4": "#FFFFE070", "1.0": "#00FFC030"}, spark, (0, 0.6, 0), 0.22),
        "dark": ({"0.0": "#FF7A30FF", "0.3": "#FF14081E", "1.0": "#00000000"}, soft, (0, 0.4, 0), 0.32),
    }
    for race, (grad, tex, acc, size) in PAL.items():
        # rastro
        fx[f"lila_rc_{race}_trail.json"] = _p(f"lila:rc_{race}_trail", tex, {**once(4 if race != "dark" else 5), **pt, **life(0.35, 0.8),
                                                                             "minecraft:particle_initial_speed": "math.random(0.2, 0.9)",
                                                                             "minecraft:particle_motion_dynamic": {"linear_acceleration": list(acc), "linear_drag_coefficient": 2.5},
                                                                             "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-200, 200)"},
                                                                             "minecraft:particle_appearance_billboard": _bb(size),
                                                                             "minecraft:particle_appearance_tinting": _tint(grad)})
        # impacto: estouro (trevas implode: começa fora e entra)
        if race == "dark":
            th, ph = "(v.particle_random_1 * 360)", "(v.particle_random_2 * 180 - 90)"
            k = "(1.8 * (1 - math.pow(v.particle_age / v.particle_lifetime, 0.6)))"
            burst = {**once(36), **pt, **life(0.4, 0.6), "minecraft:particle_motion_parametric": {"relative_position": [
                f"math.cos({th}) * math.cos({ph}) * {k}", f"math.sin({ph}) * {k}", f"math.sin({th}) * math.cos({ph}) * {k}"]}}
        else:
            burst = {**once(26 if race != "giant" else 18), "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.4, "direction": "outwards"}, **life(0.5, 1.1),
                     "minecraft:particle_initial_speed": "math.random(2, 6)",
                     "minecraft:particle_motion_dynamic": {"linear_acceleration": list(acc), "linear_drag_coefficient": 2.2}}
        burst.update({"minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-300, 300)"},
                      "minecraft:particle_appearance_billboard": _bb(size * 1.5), "minecraft:particle_appearance_tinting": _tint(grad)})
        fx[f"lila_rc_{race}_burst.json"] = _p(f"lila:rc_{race}_burst", tex, burst)
        # área: anel no chão do tamanho v.size (deus gira como um selo; demônio é labareda; gigante é poeira)
        ang = "(v.particle_random_1 * 360 + v.particle_age * (v.particle_random_2 > 0.5 ? 90 : -90))"
        rise = {"vampire": "0.1 + v.particle_age * 0.4", "giant": "0.05 + v.particle_age * 0.6", "angel": "v.particle_age * 1.6", "demon": "v.particle_age * 2.2",
                "god": "0.05 + math.sin(v.particle_age * 360) * 0.1", "dark": "0.1 + v.particle_age * 0.3"}[race]
        rr = "v.size * (0.85 + v.particle_random_3 * 0.2)" if race != "giant" else "v.size * math.min(1, v.particle_age * 3)"
        fx[f"lila_rc_{race}_zone.json"] = _p(f"lila:rc_{race}_zone", tex, {
            "minecraft:emitter_initialization": {"creation_expression": "v.size = v.size ?? 3;"}, **once(40), **pt, **life(0.6, 1.0),
            "minecraft:particle_motion_parametric": {"relative_position": [f"math.cos({ang}) * {rr}", rise, f"math.sin({ang}) * {rr}"]},
            "minecraft:particle_appearance_billboard": _bb(size * 1.3), "minecraft:particle_appearance_tinting": _tint(grad)})
    # especiais
    fx["lila_rc_ash.json"] = _p("lila:rc_ash", soft, {**once(30), "minecraft:emitter_shape_sphere": {"offset": [0, 0, 0], "radius": 0.6, "direction": "outwards"},
                                                      **life(1.5, 2.6), "minecraft:particle_initial_speed": "math.random(0.3, 1.2)",
                                                      "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 200) * 0.6", -0.7, 0], "linear_drag_coefficient": 2.0},
                                                      "minecraft:particle_appearance_billboard": _bb(0.14), "minecraft:particle_appearance_tinting": _tint({"0.0": "#FF9A9590", "0.7": "#FF55524E", "1.0": "#00302E2C"})})
    fx["lila_rc_debris.json"] = _p("lila:rc_debris", chunk, {**once(16), "minecraft:emitter_shape_disc": {"offset": [0, 0.2, 0], "radius": 0.8, "direction": "outwards", "plane_normal": "y"},
                                                              **life(0.7, 1.3), "minecraft:particle_initial_speed": "math.random(3, 7)",
                                                              "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0], "linear_drag_coefficient": 0.8},
                                                              "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-400, 400)"},
                                                              "minecraft:particle_appearance_billboard": _bb("0.5", grow="0.35 + v.particle_random_3 * 0.35"),
                                                              "minecraft:particle_appearance_tinting": _tint({"0.0": "#FF8A7C6C", "1.0": "#FF5A5046"})})
    a = "(v.particle_random_1 * 360 + v.particle_age * 500)"
    fx["lila_rc_bats.json"] = _p("lila:rc_bats", soft, {**once(18), **pt, **life(0.9, 1.4), "minecraft:particle_motion_parametric": {"relative_position": [
        f"math.cos({a}) * (0.4 + v.particle_age * 3)", "v.particle_age * 2 + math.sin(v.particle_age * 1600) * 0.2", f"math.sin({a}) * (0.4 + v.particle_age * 3)"]},
        "minecraft:particle_appearance_billboard": {"size": ["0.22 + math.abs(math.sin(v.particle_age * 1800)) * 0.1", "0.1"], "facing_camera_mode": "rotate_xyz",
                                                    "uv": {"texture_width": 16, "texture_height": 16, "uv": [0, 0], "uv_size": [16, 16]}},
        "minecraft:particle_appearance_tinting": _tint({"0.0": "#FF181014", "1.0": "#00181014"})})
    fx["lila_rc_reveal.json"] = _p("lila:rc_reveal", spark, {**once(3), **pt, **life(0.5, 0.6), "minecraft:particle_initial_speed": "0.2",
                                                             "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 1, 0]},
                                                             "minecraft:particle_appearance_billboard": _bb(0.25), "minecraft:particle_appearance_tinting": _tint({"0.0": "#FFFFE070", "1.0": "#00FF9020"})})
    for name, grad in (("light", {"0.0": "#FFFFFFFF", "0.5": "#FFFFE890", "1.0": "#00FFD040"}), ("void", {"0.0": "#FF8040FF", "0.4": "#FF10061A", "1.0": "#00000000"})):
        y = "v.particle_random_1 * 14" if name == "light" else "(1 - v.particle_age / v.particle_lifetime) * v.particle_random_1 * 14"
        fx[f"lila_rc_pillar_{name}.json"] = _p(f"lila:rc_pillar_{name}", soft if name == "void" else spark, {**once(90), **pt, **life(0.8, 1.6),
            "minecraft:particle_motion_parametric": {"relative_position": [f"math.cos(v.particle_random_2 * 360 + v.particle_age * 200) * (0.6 + v.particle_random_3 * 0.6)", y,
                                                                           f"math.sin(v.particle_random_2 * 360 + v.particle_age * 200) * (0.6 + v.particle_random_3 * 0.6)"]},
            "minecraft:particle_appearance_billboard": _bb(0.35), "minecraft:particle_appearance_tinting": _tint(grad)})
    fx["lila_rc_roulette.json"] = _p("lila:rc_roulette", spark, {**once(12), "minecraft:emitter_shape_disc": {"offset": [0, 1.5, 0], "radius": 1.2, "direction": "outwards", "plane_normal": "z"},
                                                                 **life(0.4, 0.8), "minecraft:particle_initial_speed": "1.2",
                                                                 "minecraft:particle_appearance_billboard": _bb(0.15), "minecraft:particle_appearance_tinting": _tint({"0.0": "#FFFFF0B0", "1.0": "#00FFB020"})})
    for f, data in fx.items():
        wjson(os.path.join(RP, "particles", f), data)


# ------------------------------------------------------------------ ícones dos 600 poderes
def catalog_dump():
    code = "const C = await import(process.argv[1]); console.log(JSON.stringify(C.ABILITIES.map((a) => ({id: a.id, race: a.race, index: a.index, shape: a.shape, cat: a.cat, name: a.name, fx: [...a.foe, ...a.self].map((e) => e.k)}))));"
    r = subprocess.run(["node", "--input-type=module", "-e", code, os.path.join(ROOT, "behavior_pack", "scripts", "race", "catalog.js")], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return json.loads(r.stdout)


CAT_COL = {"pas": (150, 150, 160), "mov": (90, 200, 255), "off": (255, 90, 70), "def": (120, 220, 120), "uti": (230, 200, 90), "sup": (255, 150, 220), "ctl": (180, 120, 255),
           "tra": (255, 170, 60), "ult": (255, 230, 120)}


def _glyph(d, shape, c, S, rnd):
    """Desenha o símbolo da forma (coordenadas em 0..S)."""
    m, h = S * 0.5, S * 0.5
    w = max(2, S // 16)
    def ln(p, q, ww=w):
        d.line([p, q], fill=c, width=ww)
    if shape in ("proj", "lob", "boomerang"):
        d.ellipse((m - S * 0.12, h - S * 0.12, m + S * 0.12, h + S * 0.12), fill=c)
        for k in range(3):
            ln((m - S * 0.18 - k * S * 0.08, h + S * 0.05 * (k - 1)), (m - S * 0.36 - k * S * 0.06, h + S * 0.08 * (k - 1)), max(1, w - k))
        if shape == "boomerang":
            d.arc((S * 0.2, S * 0.2, S * 0.8, S * 0.8), 200, 340, fill=c, width=w)
        if shape == "lob":
            d.arc((S * 0.15, S * 0.35, S * 0.85, S * 1.0), 200, 340, fill=c, width=w)
    elif shape in ("volley",):
        for a in (-30, 0, 30):
            r = math.radians(a - 90)
            ln((m, S * 0.82), (m + math.cos(r) * S * 0.4, S * 0.82 + math.sin(r) * S * 0.6))
    elif shape in ("beam",):
        ln((S * 0.15, S * 0.85), (S * 0.85, S * 0.15), w * 2)
        ln((S * 0.15, S * 0.85), (S * 0.85, S * 0.15), max(1, w // 2))
    elif shape in ("cone", "pull"):
        d.polygon([(S * 0.2, h), (S * 0.85, S * 0.2), (S * 0.85, S * 0.8)], outline=c, width=w)
        if shape == "pull":
            ln((S * 0.75, h), (S * 0.35, h))
    elif shape in ("nova", "zone", "aura", "dome", "vortex"):
        for k in range(3 if shape != "dome" else 1):
            rr = S * (0.14 + 0.12 * k)
            d.ellipse((m - rr, h - rr, m + rr, h + rr), outline=c, width=w)
        if shape == "vortex":
            d.arc((S * 0.2, S * 0.2, S * 0.8, S * 0.8), 0, 270, fill=c, width=w)
        if shape == "dome":
            d.chord((S * 0.15, S * 0.25, S * 0.85, S * 0.95), 180, 360, outline=c, width=w)
    elif shape in ("wave", "cross"):
        for k in range(3):
            y = S * (0.35 + 0.15 * k)
            d.arc((S * 0.1, y - S * 0.1, S * 0.9, y + S * 0.1), 200, 340, fill=c, width=w)
        if shape == "cross":
            ln((m, S * 0.15), (m, S * 0.85))
    elif shape in ("pillar", "rain"):
        for k in range(3 if shape == "rain" else 1):
            x = m + (k - 1) * S * 0.22
            ln((x, S * 0.15), (x, S * 0.8), w * (1 if shape == "rain" else 2))
        ln((S * 0.2, S * 0.85), (S * 0.8, S * 0.85))
    elif shape in ("chain",):
        for k in range(3):
            x = S * (0.25 + 0.25 * k)
            d.ellipse((x - S * 0.1, h - S * 0.08, x + S * 0.1, h + S * 0.08), outline=c, width=w)
    elif shape in ("grab", "throw", "tether"):
        d.arc((S * 0.25, S * 0.25, S * 0.75, S * 0.75), 30, 330, fill=c, width=w)
        ln((m, h), (S * 0.9, S * 0.1 if shape != "throw" else S * 0.2))
    elif shape in ("slam", "leapslam", "leap"):
        d.polygon([(m, S * 0.15), (S * 0.7, S * 0.45), (S * 0.3, S * 0.45)], fill=c)
        ln((m, S * 0.45), (m, S * 0.75))
        ln((S * 0.15, S * 0.85), (S * 0.85, S * 0.85))
    elif shape in ("dash", "blink", "swap"):
        for k in range(3):
            ln((S * (0.15 + 0.1 * k), S * (0.3 + 0.2 * k)), (S * (0.65 + 0.1 * k), S * (0.3 + 0.2 * k)))
        d.polygon([(S * 0.8, S * 0.2), (S * 0.95, S * 0.5), (S * 0.8, S * 0.8)], fill=c)
    elif shape in ("orbit", "summon"):
        d.ellipse((m - S * 0.32, h - S * 0.32, m + S * 0.32, h + S * 0.32), outline=c, width=max(1, w // 2))
        for k in range(3 if shape == "orbit" else 5):
            a = math.tau * k / (3 if shape == "orbit" else 5)
            x, y = m + math.cos(a) * S * 0.32, h + math.sin(a) * S * 0.32
            d.ellipse((x - S * 0.07, y - S * 0.07, x + S * 0.07, y + S * 0.07), fill=c)
    elif shape in ("self", "ally"):
        d.ellipse((m - S * 0.1, S * 0.2, m + S * 0.1, S * 0.4), fill=c)
        d.polygon([(m, S * 0.42), (S * 0.68, S * 0.82), (S * 0.32, S * 0.82)], fill=c)
        if shape == "ally":
            d.ellipse((S * 0.15, S * 0.3, S * 0.29, S * 0.44), outline=c, width=max(1, w // 2))
            d.ellipse((S * 0.71, S * 0.3, S * 0.85, S * 0.44), outline=c, width=max(1, w // 2))
    elif shape in ("trap", "wall", "mark", "target"):
        if shape == "wall":
            for k in range(3):
                d.rectangle((S * (0.15 + 0.24 * k), S * 0.3, S * (0.33 + 0.24 * k), S * 0.8), outline=c, width=w)
        else:
            d.ellipse((S * 0.2, S * 0.2, S * 0.8, S * 0.8), outline=c, width=w)
            ln((m, S * 0.1), (m, S * 0.9), max(1, w // 2))
            ln((S * 0.1, h), (S * 0.9, h), max(1, w // 2))
            if shape == "trap":
                d.rectangle((S * 0.35, S * 0.35, S * 0.65, S * 0.65), outline=c, width=w)
    elif shape.startswith("special") or shape.startswith("passive"):
        star = [(m + math.cos(math.radians(a * 36 - 90)) * S * (0.38 if a % 2 == 0 else 0.16), h + math.sin(math.radians(a * 36 - 90)) * S * (0.38 if a % 2 == 0 else 0.16)) for a in range(10)]
        d.polygon(star, fill=c if shape.startswith("special") else None, outline=c, width=w)
    else:  # utilidades
        d.rectangle((S * 0.25, S * 0.25, S * 0.75, S * 0.75), outline=c, width=w)
        d.line([(S * 0.35, S * 0.5), (S * 0.65, S * 0.5)], fill=c, width=w)


BADGE_ORDER = ["heal", "regen", "burn", "ignite", "slow", "root", "stun", "steal", "bleed", "shield", "absorb", "res", "speed", "haste", "jump", "blind", "dark",
               "invis", "poison", "wither", "decay", "pull", "up", "kb", "holy", "ash", "mark", "glow", "silence", "silencez", "fear", "cleanse", "lev", "strength", "execute"]


def _badge(d, k, c, x, y, r):
    """Selo do efeito principal (canto de cima à direita)."""
    w = max(2, int(r / 4))
    if k in ("heal", "regen"):
        d.rectangle((x - r * 0.25, y - r, x + r * 0.25, y + r), fill=c)
        d.rectangle((x - r, y - r * 0.25, x + r, y + r * 0.25), fill=c)
    elif k in ("burn", "ignite"):
        d.polygon([(x, y - r), (x + r * 0.8, y + r * 0.6), (x, y + r), (x - r * 0.8, y + r * 0.6)], fill=c)
        d.polygon([(x, y - r * 0.1), (x + r * 0.35, y + r * 0.6), (x - r * 0.35, y + r * 0.6)], fill=(255, 255, 220, 255))
    elif k in ("slow", "root"):
        for a in range(3):
            ang = math.radians(a * 60)
            d.line([(x - math.cos(ang) * r, y - math.sin(ang) * r), (x + math.cos(ang) * r, y + math.sin(ang) * r)], fill=c, width=w)
    elif k == "stun":
        d.line([(x - r, y - r * 0.6), (x, y - r * 0.1), (x - r * 0.3, y + r * 0.2), (x + r, y + r)], fill=c, width=w)
    elif k in ("steal", "bleed"):
        d.polygon([(x, y - r), (x + r * 0.7, y + r * 0.2), (x, y + r), (x - r * 0.7, y + r * 0.2)], fill=c)
    elif k in ("shield", "absorb", "res"):
        d.polygon([(x - r, y - r * 0.8), (x + r, y - r * 0.8), (x + r * 0.8, y + r * 0.2), (x, y + r), (x - r * 0.8, y + r * 0.2)], fill=c)
    elif k in ("speed", "haste", "jump", "lev"):
        for o in (-0.5, 0.3):
            d.line([(x - r, y + (o + 0.4) * r), (x, y + o * r - r * 0.4), (x + r, y + (o + 0.4) * r)], fill=c, width=w)
    elif k in ("blind", "dark", "invis"):
        d.ellipse((x - r, y - r * 0.55, x + r, y + r * 0.55), outline=c, width=w)
        d.ellipse((x - r * 0.3, y - r * 0.3, x + r * 0.3, y + r * 0.3), fill=c)
    elif k in ("poison", "wither", "decay"):
        d.ellipse((x - r * 0.8, y - r, x + r * 0.8, y + r * 0.5), fill=c)
        d.rectangle((x - r * 0.45, y + r * 0.3, x + r * 0.45, y + r), fill=c)
        d.ellipse((x - r * 0.5, y - r * 0.4, x - r * 0.1, y), fill=(0, 0, 0, 255))
        d.ellipse((x + r * 0.1, y - r * 0.4, x + r * 0.5, y), fill=(0, 0, 0, 255))
    elif k in ("pull", "up", "kb"):
        ang = {"pull": math.pi, "up": -math.pi / 2, "kb": 0}[k]
        tip = (x + math.cos(ang) * r, y + math.sin(ang) * r)
        d.line([(x - math.cos(ang) * r, y - math.sin(ang) * r), tip], fill=c, width=w)
        d.polygon([tip, (tip[0] - math.cos(ang - 0.6) * r * 0.7, tip[1] - math.sin(ang - 0.6) * r * 0.7), (tip[0] - math.cos(ang + 0.6) * r * 0.7, tip[1] - math.sin(ang + 0.6) * r * 0.7)], fill=c)
    elif k == "holy":
        d.ellipse((x - r, y - r * 0.45, x + r, y + r * 0.45), outline=c, width=w)
    elif k == "ash":
        for a in range(5):
            d.ellipse((x - r + a * r * 0.45, y - r + (a % 2) * r, x - r + a * r * 0.45 + r * 0.3, y - r + (a % 2) * r + r * 0.3), fill=c)
    elif k in ("mark", "glow"):
        d.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], outline=c, width=w)
    elif k in ("silence", "silencez"):
        d.line([(x - r, y - r), (x + r, y + r)], fill=c, width=w)
        d.line([(x + r, y - r), (x - r, y + r)], fill=c, width=w)
    elif k == "fear":
        d.rectangle((x - r * 0.18, y - r, x + r * 0.18, y + r * 0.3), fill=c)
        d.ellipse((x - r * 0.2, y + r * 0.55, x + r * 0.2, y + r * 0.95), fill=c)
    elif k == "execute":
        d.line([(x - r, y + r), (x + r, y - r)], fill=c, width=w + 1)
        d.line([(x - r * 0.4, y - r * 0.2), (x + r * 0.2, y + r * 0.4)], fill=c, width=w)
    else:
        d.polygon([(x, y - r), (x + r * 0.3, y - r * 0.3), (x + r, y), (x + r * 0.3, y + r * 0.3), (x, y + r), (x - r * 0.3, y + r * 0.3), (x - r, y), (x - r * 0.3, y - r * 0.3)], fill=c)


def build_icons(RP, wpng, preview_dir, previews):
    data = catalog_dump()
    S = 128
    sheet = Image.new("RGBA", (20 * 34, 30 * 34), (0, 0, 0, 0))
    for i, a in enumerate(data):
        base, hi = RACE_COLORS[a["race"]]
        rnd = random.Random(hash(a["id"]) & 0xFFFF)
        img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        dark = tuple(int(v * 0.35) for v in base)
        for y in range(S):  # fundo em gradiente da raça
            t = y / S
            col = tuple(int(dark[k] * (1 - t) + base[k] * 0.6 * t) for k in range(3))
            d.line([(6, y), (S - 7, y)], fill=col + (255,))
        cc = CAT_COL[a["cat"]]
        d.rounded_rectangle((3, 3, S - 4, S - 4), radius=18, outline=cc + (255,), width=6)
        glyph = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glyph)
        _glyph(gd, a["shape"], hi + (255,), S, rnd)
        glow = glyph.filter(ImageFilter.GaussianBlur(5))
        img.alpha_composite(glow)
        img.alpha_composite(glyph)
        badge = next((k for k in BADGE_ORDER if k in a.get("fx", [])), None)
        if badge:
            bx, by, br = S - 30, 30, 15
            d.ellipse((bx - br - 5, by - br - 5, bx + br + 5, by + br + 5), fill=(12, 10, 16, 235), outline=cc + (255,), width=3)
            _badge(d, badge, (255, 255, 255, 255) if a["cat"] != "ult" else (255, 230, 120, 255), bx, by, br * 0.75)
        # marca única do poder: runa de 3 traços no canto (do índice) — dois poderes nunca têm o mesmo ícone
        n = a["index"]
        for k in range(3):
            if (n >> k) & 1:
                d.rectangle((S - 30 + k * 8, S - 22, S - 25 + k * 8, S - 12), fill=cc + (255,))
        for k in range(4):
            if (n >> (k + 3)) & 1:
                d.rectangle((12 + k * 8, S - 22, 17 + k * 8, S - 12), fill=hi + (230,))
        icon = img.resize((32, 32), Image.LANCZOS)
        wpng(os.path.join(RP, "textures", "ui", "race", a["race"], f"{n + 1:03d}.png"), icon)
        if previews and i < 600:
            sheet.paste(icon, ((i % 20) * 34, (i // 20) * 34))
    for race in RACE_ORDER:
        base, hi = RACE_COLORS[race]
        img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.ellipse((6, 6, 122, 122), fill=tuple(int(v * 0.4) for v in base) + (255,), outline=hi + (255,), width=6)
        _glyph(d, "special:x", hi + (255,), 128, random.Random(1))
        wpng(os.path.join(RP, "textures", "ui", "race", f"emblem_{race}.png"), img.resize((64, 64), Image.LANCZOS))
    if previews:
        wpng(os.path.join(preview_dir, "race_icons.png"), sheet)
    return len(data)


def build_race(BP, RP, wjson, wpng, bake, render, preview_dir, previews, item_textures, langs):
    player_overrides(BP, RP, wjson)
    build_models(RP, wjson, wpng, bake, render, preview_dir, previews)
    rm, rtex = build_roulette(BP, RP, wjson, wpng, bake, render, preview_dir, previews)
    if previews:
        wpng(os.path.join(preview_dir, "race_roulette.png"), render(rm, rtex, size=420, yaw=-18, pitch=6, outline=True))
        sw, sc = divine_sword(), void_scythe()
        a = render(sw, bake(sw), size=360, yaw=-30, pitch=10, outline=True)
        b = render(sc, bake(sc), size=360, yaw=-30, pitch=10, outline=True)
        w = Image.new("RGBA", (720, 360), (0, 0, 0, 0))
        w.alpha_composite(a, (0, 0))
        w.alpha_composite(b, (360, 0))
        wpng(os.path.join(preview_dir, "race_weapons.png"), w)
    build_items(BP, RP, wjson, wpng, bake, render, item_textures, langs)
    race_particles(RP, wjson, wpng)
    return build_icons(RP, wpng, preview_dir, previews)
