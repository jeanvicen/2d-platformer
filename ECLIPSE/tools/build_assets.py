#!/usr/bin/env python3
"""ECLIPSE — SHADOW SOVEREIGN asset build.

Generates every data-driven file of the Behavior Pack and Resource Pack from a
single source of truth (tools/forge/content/*). Hand-written gameplay code
lives in ECLIPSE_BP/scripts and is never touched by this script except for
scripts/data/generated.js (registry shared with the generator).

Usage:  python3 tools/build_assets.py [--previews]
"""
from __future__ import annotations

import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from forge import entities as E  # noqa: E402
from forge import fx  # noqa: E402
from forge.anim import controllers_file  # noqa: E402
from forge.content.creatures import umbra  # noqa: E402
from forge.content.creatures2 import aegis, corvus, nox, nyx, vesper  # noqa: E402
from forge.content.creatures3 import golem, manta, serpent, stag  # noqa: E402
from forge.content.forms import FORMS, form_anims, form_model  # noqa: E402
from forge.content.lyra import ACTIONS, lyra_anims, lyra_model  # noqa: E402
from forge.content.relics import POWER_ITEMS, RELICS, THROWABLE, TOOLS, held_model, icon_model, thrown_model  # noqa: E402
from forge.content.wings import WINGS, wing_anims, wing_model  # noqa: E402
from forge.geom import Model  # noqa: E402
from forge.paint import bake  # noqa: E402
from forge.render import render  # noqa: E402

VERSION = [1, 0, 0]
VERSION_STR = ".".join(map(str, VERSION))
MIN_ENGINE = [1, 26, 30]
SERVER_VERSION = "2.8.0"
SERVER_UI_VERSION = "2.1.0"
UUID = {
    "bp_header": "9c712459-49a5-4ae0-97dd-2537704fbff8",
    "bp_data": "12c3bddd-d4a5-44e7-a19b-4c1bf2c0c53e",
    "bp_script": "5f099323-d48b-441e-afd6-f8c9a31bbdc3",
    "rp_header": "661fcfd9-8849-4137-8a0c-0d3cb93c7fc5",
    "rp_res": "9a8aa4a0-f181-4649-9d1c-eff8f103168b",
}
BP = os.path.join(ROOT, "ECLIPSE_BP")
RP = os.path.join(ROOT, "ECLIPSE_RP")
ITEM_FORMAT = "1.21.90"
BLOCK_FORMAT = "1.21.90"

GENERATED_DIRS_BP = ["entities", "items", "blocks", "recipes", "loot_tables", "texts"]
GENERATED_DIRS_RP = ["entity", "models", "animations", "animation_controllers", "render_controllers", "attachables",
                     "particles", "textures", "sounds", "texts"]


def wjson(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def wpng(path, img):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


def clean():
    for d in GENERATED_DIRS_BP:
        shutil.rmtree(os.path.join(BP, d), ignore_errors=True)
    for d in GENERATED_DIRS_RP:
        shutil.rmtree(os.path.join(RP, d), ignore_errors=True)


# ============================================================ manifests
def manifests():
    desc_bp = "§5ECLIPSE — Shadow Sovereign§r §7(Behavior)§r\n§fCriado por §d0neajx§r"
    desc_rp = "§5ECLIPSE — Shadow Sovereign§r §7(Recursos)§r\n§fCriado por §d0neajx§r"
    meta = {"authors": ["0neajx"], "url": "https://github.com/jeanvicen/2d-platformer"}
    wjson(os.path.join(BP, "manifest.json"), {
        "format_version": 2,
        "header": {"name": "ECLIPSE — Shadow Sovereign (BP)", "description": desc_bp, "uuid": UUID["bp_header"],
                   "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [
            {"type": "data", "uuid": UUID["bp_data"], "version": VERSION, "description": "ECLIPSE behaviors"},
            {"type": "script", "language": "javascript", "uuid": UUID["bp_script"], "version": VERSION,
             "entry": "scripts/main.js", "description": "ECLIPSE gameplay systems"},
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
        "header": {"name": "ECLIPSE — Shadow Sovereign (RP)", "description": desc_rp, "uuid": UUID["rp_header"],
                   "version": VERSION, "min_engine_version": MIN_ENGINE},
        "modules": [{"type": "resources", "uuid": UUID["rp_res"], "version": VERSION, "description": "ECLIPSE resources"}],
        "dependencies": [{"uuid": UUID["bp_header"], "version": VERSION}],
        "metadata": meta,
    })
    wpng(os.path.join(BP, "pack_icon.png"), fx.pack_icon(256, "bp"))
    wpng(os.path.join(RP, "pack_icon.png"), fx.pack_icon(256, "rp"))


# ============================================================ helpers
def write_model(model, folder="eclipse"):
    data = model.to_json()
    name = model.identifier.replace("geometry.", "")
    wjson(os.path.join(RP, "models", "entity", folder, f"{name}.geo.json"), data)
    return model


def write_texture(model, rel):
    tex = bake(model)
    wpng(os.path.join(RP, rel + ".png"), tex)
    return tex


ITEM_TEXTURES = {}
LANG = {}
PREVIEWS = {}


def icon_from_model(key, model, tex, yaw=-48, pitch=26, pose=None):
    img = render(model, tex, size=64, yaw=yaw, pitch=pitch, pose=pose, ssaa=4)
    wpng(os.path.join(RP, "textures", "items", "eclipse", f"{key}.png"), img)
    ITEM_TEXTURES[f"eclipse_{key}"] = {"textures": f"textures/items/eclipse/{key}"}
    return img


# ============================================================ creatures
CREATURE_FNS = [umbra, nyx, aegis, nox, vesper, corvus, serpent, stag, golem, manta]
CREATURES = []


def build_creatures(previews):
    sounds = {}
    for fn in CREATURE_FNS:
        c = fn()
        files = E.creature_files(c)
        bp = files["bp"]
        bp["minecraft:entity"]["components"]["minecraft:ambient_sound_interval"] = {"value": 14, "range": 18, "event_name": "ambient"}
        wjson(os.path.join(BP, "entities", f"{c.key}.json"), bp)
        wjson(os.path.join(RP, "entity", f"{c.key}.entity.json"), files["client"])
        wjson(os.path.join(RP, "animations", "eclipse", f"{c.key}.animation.json"), files["anim"])
        wjson(os.path.join(RP, "animation_controllers", "eclipse", f"{c.key}.ac.json"), files["ctrl"])
        write_model(c.model)
        tex = write_texture(c.model, f"textures/entity/eclipse/{c.key}")
        LANG[f"entity.eclipse:{c.key}.name"] = f"{c.name}, {c.title}"
        sounds[f"eclipse:{c.key}"] = {"volume": 1.0, "pitch": [0.85, 1.0], "events": {
            "ambient": c.sounds.get("ambient"), "hurt": c.sounds.get("hurt"), "death": c.sounds.get("death"),
            "step": {"sound": c.sounds.get("step"), "volume": 0.25}}}
        CREATURES.append(c)
        if previews:
            PREVIEWS[c.key] = render(c.model, tex, size=420, yaw=34, pitch=16, ssaa=3)
    return sounds


def build_lyra(previews):
    m = lyra_model()
    A = lyra_anims()
    files = E.lyra_files("lyra", A, ACTIONS)
    files["bp"]["minecraft:entity"]["components"]["minecraft:ambient_sound_interval"] = {"value": 30, "range": 30, "event_name": "ambient"}
    wjson(os.path.join(BP, "entities", "lyra.json"), files["bp"])
    wjson(os.path.join(RP, "entity", "lyra.entity.json"), files["client"])
    wjson(os.path.join(RP, "animations", "eclipse", "lyra.animation.json"), files["anim"])
    wjson(os.path.join(RP, "animation_controllers", "eclipse", "lyra.ac.json"), files["ctrl"])
    write_model(m)
    tex = write_texture(m, "textures/entity/eclipse/lyra")
    LANG["entity.eclipse:lyra.name"] = "Lyra, a Sombra Viva"
    if previews:
        PREVIEWS["lyra"] = render(m, tex, size=420, yaw=28, pitch=10, ssaa=3)
    return {"eclipse:lyra": {"volume": 1.0, "pitch": [1.0, 1.1], "events": {
        "ambient": "eclipse.lyra_hum", "hurt": "game.player.hurt", "death": "eclipse.recall", "step": {"sound": "step.cloth", "volume": 0.2}}}}


# ============================================================ items
ITEM_INFO = {
    # key: (display name, color, lore, category, extra components)
    "eclipse_core": ("Núcleo do Eclipse", "§5", ["§7Toque: §fdespertar / abrir o Grimório", "§7Agachado + toque: §ftrocar de Modo"], "equipment"),
    "codex": ("Códice do Eclipse", "§d", ["§7Toque para ler o manual completo"], "items"),
    "legion_sigil": ("Selo da Legião", "§5", ["§7Toque: §finvocar / recolher a criatura ativa", "§7Agachado + toque: §fescolher criatura"], "equipment"),
    "power_sigil": ("Selo do Poder", "§6", ["§7Toque: §fusar a técnica do Modo", "§7Agachado + toque: §ftrocar técnica"], "equipment"),
    "form_essence": ("Essência da Forma", "§5", ["§7Toque: §ftransformar / habilidade da forma", "§7Agachado + toque: §fescolher forma / voltar"], "equipment"),
    "shadow_hand": ("Mão da Sombra", "§8", ["§7Toque: §fcriar / manipular", "§7Agachado + toque: §ftrocar construção"], "equipment"),
    "element_prism": ("Prisma dos Elementos", "§b", ["§7Toque: §fpróximo elemento", "§7Agachado + toque: §felemento anterior"], "equipment"),
    "lyra_bond": ("Laço de Lyra", "§d", ["§7Toque: §fchamar Lyra / falar com ela", "§7Agachado + toque: §fordens rápidas"], "equipment"),
    "relic_recall": ("Chamado da Relíquia", "§5", ["§7Toque: §fa relíquia lançada volta à sua mão"], "equipment"),
    "eclipse_hammer": ("Martelo do Eclipse", "§5", ["§7Toque: §flançar (raio no impacto)", "§7Toque de novo: §fo martelo volta"], "equipment"),
    "eclipse_axe": ("Machado do Eclipse", "§5", ["§7Toque: §flançar em espiral", "§7Toque de novo: §fo machado volta"], "equipment"),
    "shadow_sword": ("Espada Sombria", "§8", ["§7Toque: §fInvestida Sombria (avanço cortante)"], "equipment"),
    "astral_spear": ("Lança Astral", "§b", ["§7Toque: §flançar — volta sozinha", "§7Perfura inimigos em linha"], "equipment"),
    "eclipse_scythe": ("Foice do Eclipse", "§5", ["§7Toque: §fCeifa Giratória (rouba vida)"], "equipment"),
    "celestial_bow": ("Arco Celestial", "§6", ["§7Toque: §fdispara flechas de luz (sem munição)"], "equipment"),
    "guardian_shield": ("Escudo do Guardião", "§7", ["§7Toque: §fÉgide — resistência e repulsão"], "equipment"),
    "titan_gauntlets": ("Manoplas do Titã", "§8", ["§7Toque: §fImpacto Sísmico ao redor"], "equipment"),
    "shadow_chains": ("Correntes de Sombra", "§8", ["§7Toque: §fpuxa criatura ou te lança até o bloco (gancho)"], "equipment"),
    "shadow_pickaxe": ("Picareta de Sombra", "§8", ["§7Ferramenta temporária da Forja"], "equipment"),
    "shadow_axe_tool": ("Machado de Sombra", "§8", ["§7Ferramenta temporária da Forja"], "equipment"),
    "shadow_shovel": ("Pá de Sombra", "§8", ["§7Ferramenta temporária da Forja"], "equipment"),
}
RELIC_DAMAGE = {"eclipse_hammer": 10, "eclipse_axe": 11, "shadow_sword": 9, "astral_spear": 8, "eclipse_scythe": 10,
                "celestial_bow": 4, "guardian_shield": 5, "titan_gauntlets": 9, "shadow_chains": 6}


def item_json(key, name, color, category, comps):
    base = {
        "minecraft:icon": f"eclipse_{key}",
        "minecraft:display_name": {"value": f"{color}{name}"},
        "minecraft:max_stack_size": 1,
    }
    base.update(comps)
    return {"format_version": ITEM_FORMAT, "minecraft:item": {
        "description": {"identifier": f"eclipse:{key}", "menu_category": {"category": category}},
        "components": base}}


def attachable(key, geo, texture, anims, animate, ctrl=None, particles=None, material="entity_emissive_alpha", item_filter=None):
    desc = {
        "identifier": f"eclipse:{key}",
        "materials": {"default": material, "enchanted": material},
        "textures": {"default": texture, "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": geo},
        "animations": anims,
        "scripts": {"animate": animate},
        "render_controllers": ["controller.render.eclipse.item"],
    }
    if particles:
        desc["particle_effects"] = particles
    if item_filter:
        desc["item"] = item_filter
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": desc}}


def build_held_items(previews):
    anims_all = {}
    for key in RELICS + POWER_ITEMS + TOOLS:
        name, color, lore, cat = ITEM_INFO[key]
        comps = {"minecraft:hand_equipped": True, "minecraft:tags": {"tags": ["eclipse:item", "eclipse:relic" if key in RELICS else "eclipse:power"]}}
        if key not in TOOLS:
            comps["eclipse:power"] = {}
        if key in RELIC_DAMAGE:
            comps["minecraft:damage"] = RELIC_DAMAGE[key]
        if key == "eclipse_core":
            comps["minecraft:glint"] = True
        if key in ("legion_sigil", "power_sigil", "form_essence", "element_prism", "lyra_bond", "codex", "shadow_hand"):
            comps["minecraft:allow_off_hand"] = True
        if key in TOOLS:
            kind = {"shadow_pickaxe": "pickaxe", "shadow_axe_tool": "axe", "shadow_shovel": "shovel"}[key]
            tagq = {"pickaxe": "q.any_tag('stone', 'metal', 'rock', 'diamond_pick_diggable', 'iron_pick_diggable', 'stone_pick_diggable', 'gold_pick_diggable', 'wood_pick_diggable')",
                    "axe": "q.any_tag('wood', 'log', 'pumpkin', 'plant')",
                    "shovel": "q.any_tag('dirt', 'sand', 'gravel', 'grass', 'snow')"}[kind]
            comps["minecraft:digger"] = {"use_efficiency": True, "destroy_speeds": [{"block": {"tags": tagq}, "speed": 14}]}
            comps["minecraft:tags"] = {"tags": ["eclipse:item", "eclipse:temp_tool", f"minecraft:is_{kind}", "minecraft:diamond_tier"]}
            comps["minecraft:durability"] = {"max_durability": 1500}
            comps["minecraft:damage"] = 5
        wjson(os.path.join(BP, "items", f"{key}.json"), item_json(key, name, color, cat, comps))
        LANG[f"item.eclipse:{key}"] = name
        # icon
        im = icon_model(key)
        tex_icon = bake(im)
        im.to_json()
        pose = {"root": {"rot": (-62 if key not in ("celestial_bow", "guardian_shield", "codex") else 0, 0, 0)}}
        icon_from_model(key, im, tex_icon, pose=pose)
        if previews:
            PREVIEWS[f"item_{key}"] = render(im, tex_icon, size=220, yaw=-48, pitch=26, pose=pose, ssaa=3)
        # held attachable
        hm = held_model(key)
        write_model(hm, "eclipse/held")
        texrel = f"textures/entity/eclipse/held/{key}"
        write_texture(hm, texrel)
        a = {
            f"animation.eclipse.held.{key}.third": {"loop": True, "bones": {"relic": {"rotation": [0, 0, 0]}}},
            f"animation.eclipse.held.{key}.first": {"loop": True, "bones": {"relic": {"rotation": [0, 0, 0]}}},
            f"animation.eclipse.held.{key}.materialize": {"loop": "hold_on_last_frame", "animation_length": 0.5, "bones": {"relic": {
                "scale": {"0.0": [0.05, 0.05, 0.05], "0.3": [1.12, 1.12, 1.12], "0.5": [1, 1, 1]},
                "rotation": {"0.0": [0, 0, -200], "0.5": [0, 0, 0]}}},
                "particle_effects": [{"effect": "mat", "locator": "grip"}]},
            f"animation.eclipse.held.{key}.idle_glow": {"loop": True, "bones": {"relic": {"position": [0, "math.sin(q.anim_time * 120) * 0.15", 0]}}},
        }
        anims_all.update(a)
        ctrl_name = f"controller.animation.eclipse.held.{key}"
        ctrl = {ctrl_name: {"initial_state": "materialize", "states": {
            "materialize": {"animations": ["materialize"], "transitions": [{"hold": "q.all_animations_finished"}]},
            "hold": {"animations": ["idle_glow"]}}}}
        wjson(os.path.join(RP, "animation_controllers", "eclipse", "held", f"{key}.ac.json"), controllers_file(list(ctrl.items())))
        att = attachable(key, hm.identifier, texrel, {
            "third": f"animation.eclipse.held.{key}.third", "first": f"animation.eclipse.held.{key}.first",
            "materialize": f"animation.eclipse.held.{key}.materialize", "idle_glow": f"animation.eclipse.held.{key}.idle_glow",
            "ctrl": ctrl_name}, [{"first": "c.is_first_person"}, {"third": "!c.is_first_person"}, "ctrl"],
            particles={"mat": "eclipse:materialize_hand"})
        wjson(os.path.join(RP, "attachables", "eclipse", f"{key}.json"), att)
    wjson(os.path.join(RP, "animations", "eclipse", "held_items.animation.json"), {"format_version": "1.10.0", "animations": anims_all})


def build_thrown():
    for key in THROWABLE:
        tm = thrown_model(key)
        write_model(tm, "eclipse/thrown")
        texrel = f"textures/entity/eclipse/thrown/{key}"
        write_texture(tm, texrel)
        ek = f"thrown_{key}"
        files = E.thrown_relic_files(ek, tm.identifier, texrel)
        files["client"]["minecraft:client_entity"]["description"]["materials"]["default"] = "entity_emissive_alpha"
        wjson(os.path.join(BP, "entities", f"{ek}.json"), files["bp"])
        wjson(os.path.join(RP, "entity", f"{ek}.entity.json"), files["client"])
        wjson(os.path.join(RP, "animations", "eclipse", f"{ek}.animation.json"), files["anim"])
        wjson(os.path.join(RP, "animation_controllers", "eclipse", f"{ek}.ac.json"), files["ctrl"])
        LANG[f"entity.eclipse:{ek}.name"] = ITEM_INFO[key][0]
    # spell bolt
    b = E.bolt_files()
    m = Model("geometry.eclipse.spell_bolt", 16, 16, density=4, bounds=(1, 1, (0, 0.2, 0)))
    root = m.bone("root", pivot=(0, 2, 0))
    core = m.bone("core", "root", pivot=(0, 2, 0))
    from forge.content.creatures import P
    for e in E.ELEMENTS:
        pass
    core.box((0, 2, 0), (2.6, 2.6, 5.0), P("glow", (180, 120, 255), (255, 255, 255)), rotation=(0, 0, 45), pivot=(0, 2, 0))
    core.box((0, 2, 0), (1.4, 1.4, 7.0), P("glow", (255, 255, 255)))
    write_model(m)
    colors = {"shadow": ((60, 20, 120), (210, 160, 255)), "light": ((230, 190, 90), (255, 250, 220)),
              "fire": ((220, 70, 20), (255, 220, 120)), "water": ((30, 100, 220), (170, 230, 255)),
              "earth": ((100, 76, 40), (190, 160, 110)), "air": ((180, 210, 220), (255, 255, 255)),
              "lightning": ((90, 140, 255), (255, 255, 200)), "ice": ((120, 190, 255), (240, 250, 255)),
              "nature": ((40, 130, 40), (180, 255, 140))}
    for e, (c1, c2) in colors.items():
        for cube in m.cubes():
            cube.paint.color = c1
            cube.paint.color2 = c2
        wpng(os.path.join(RP, "textures", "entity", "eclipse", f"bolt_{e}.png"), bake(m))
    wjson(os.path.join(BP, "entities", "spell_bolt.json"), b["bp"])
    wjson(os.path.join(RP, "entity", "spell_bolt.entity.json"), b["client"])
    wjson(os.path.join(RP, "animations", "eclipse", "spell_bolt.animation.json"), b["anim"])
    LANG["entity.eclipse:spell_bolt.name"] = "Projétil Arcano"
    return b["rc"]


def build_wings(previews):
    anims_all = {}
    for key, (name, desc) in WINGS.items():
        m = wing_model(key)
        write_model(m, "eclipse/wings")
        texrel = f"textures/entity/eclipse/wings/{key}"
        tex = write_texture(m, texrel)
        A, (cname, cdata) = wing_anims(key)
        for _, (n, d) in A.items():
            anims_all[n] = d
        wjson(os.path.join(RP, "animation_controllers", "eclipse", "wings", f"{key}.ac.json"), controllers_file([(cname, cdata)]))
        att = attachable(key, m.identifier, texrel, {**{k: n for k, (n, _) in A.items()}, "ctrl": cname}, ["ctrl"])
        att["minecraft:attachable"]["description"]["scripts"]["pre_animation"] = [
            "v.eclipse_air = q.is_on_ground ? 0.0 : ((v.eclipse_air ?? 0.0) + q.delta_time);"]
        wjson(os.path.join(RP, "attachables", "eclipse", f"{key}.json"), att)
        comps = {"minecraft:wearable": {"slot": "slot.armor.chest", "protection": 5},
                 "minecraft:tags": {"tags": ["eclipse:item", "eclipse:wings"]},
                 "minecraft:durability": {"max_durability": 4000}}
        wjson(os.path.join(BP, "items", f"{key}.json"), item_json(key, name, "§5", "equipment", comps))
        LANG[f"item.eclipse:{key}"] = name
        # icon: render spread wings
        icon_from_model(key, m, tex, yaw=180, pitch=8, pose={})
        if previews:
            PREVIEWS[f"wings_{key}"] = render(m, tex, size=300, yaw=180, pitch=8, ssaa=3)
    wjson(os.path.join(RP, "animations", "eclipse", "wings.animation.json"), {"format_version": "1.10.0", "animations": anims_all})


def build_forms(previews):
    anims_all = {}
    for key, (name, desc) in FORMS.items():
        m, src, sc = form_model(key)
        write_model(m, "eclipse/forms")
        texrel = f"textures/entity/eclipse/forms/{key}"
        tex = write_texture(m, texrel)
        A, (cname, cdata) = form_anims(key, src, sc)
        for _, (n, d) in A.items():
            anims_all[n] = d
        wjson(os.path.join(RP, "animation_controllers", "eclipse", "forms", f"{key}.ac.json"), controllers_file([(cname, cdata)]))
        amap = {k: n for k, (n, _) in A.items()}
        amap["ctrl"] = cname
        att = attachable(f"form_{key}", m.identifier, texrel, amap, ["ctrl", "shift", {"hide_fp": "c.is_first_person"}],
                         particles={"shift": "eclipse:form_shift"})
        wjson(os.path.join(RP, "attachables", "eclipse", f"form_{key}.json"), att)
        comps = {"minecraft:wearable": {"slot": "slot.armor.chest", "protection": 6},
                 "minecraft:tags": {"tags": ["eclipse:item", "eclipse:form"]}}
        wjson(os.path.join(BP, "items", f"form_{key}.json"), item_json(f"form_{key}", name, "§5", "none", comps))
        LANG[f"item.eclipse:form_{key}"] = name
        icon_from_model(f"form_{key}", m, tex, yaw=35, pitch=16, pose={})
        if previews:
            PREVIEWS[f"form_{key}"] = render(m, tex, size=300, yaw=35, pitch=16, ssaa=3)
    wjson(os.path.join(RP, "animations", "eclipse", "forms.animation.json"), {"format_version": "1.10.0", "animations": anims_all})


def build_blocks():
    terrain = {}
    for key, (name, light, render_m, base, hi, style) in fx.BLOCKS.items():
        wpng(os.path.join(RP, "textures", "blocks", "eclipse", f"{key}.png"), fx.block_texture(key))
        terrain[f"eclipse_{key}"] = {"textures": f"textures/blocks/eclipse/{key}"}
        blk = {
            "format_version": BLOCK_FORMAT,
            "minecraft:block": {
                "description": {"identifier": f"eclipse:{key}", "menu_category": {"category": "none"},
                                "states": {"eclipse:age": list(range(16))}},
                "components": {
                    "minecraft:geometry": "minecraft:geometry.full_block",
                    "minecraft:material_instances": {"*": {"texture": f"eclipse_{key}", "render_method": render_m}},
                    "minecraft:light_emission": light,
                    "minecraft:light_dampening": 0 if render_m == "blend" else 15,
                    "minecraft:destructible_by_mining": {"seconds_to_destroy": 0.35},
                    "minecraft:destructible_by_explosion": {"explosion_resistance": 2},
                    "minecraft:loot": "loot_tables/eclipse/empty.json",
                    "minecraft:map_color": "#%02x%02x%02x" % base,
                    "minecraft:tick": {"interval_range": [100, 100], "looping": True},
                    "eclipse:temporary": {},
                },
            },
        }
        wjson(os.path.join(BP, "blocks", f"{key}.json"), blk)
        LANG[f"tile.eclipse:{key}.name"] = name
    wjson(os.path.join(BP, "loot_tables", "eclipse", "empty.json"), {"pools": []})
    wjson(os.path.join(RP, "textures", "terrain_texture.json"), {
        "resource_pack_name": "eclipse", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4, "texture_data": terrain})
    wjson(os.path.join(RP, "blocks.json"), {"format_version": "1.21.40", **{f"eclipse:{k}": {"sound": "amethyst_block" if k != "root_block" else "grass"} for k in fx.BLOCKS}})


def build_recipes():
    wjson(os.path.join(BP, "recipes", "eclipse_core.json"), {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "eclipse:core_recipe"}, "tags": ["crafting_table"],
        "pattern": ["OAO", "AEA", "OAO"],
        "key": {"O": "minecraft:obsidian", "A": "minecraft:amethyst_shard", "E": "minecraft:ender_pearl"},
        "unlock": [{"item": "minecraft:amethyst_shard"}],
        "result": {"item": "eclipse:eclipse_core"}}})
    wjson(os.path.join(BP, "recipes", "codex.json"), {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
        "description": {"identifier": "eclipse:codex_recipe"}, "tags": ["crafting_table"],
        "ingredients": [{"item": "minecraft:book"}, {"item": "minecraft:amethyst_shard"}],
        "unlock": [{"item": "minecraft:book"}],
        "result": {"item": "eclipse:codex"}}})


def build_particles_and_sounds(entity_sounds):
    for k, data in fx.particles().items():
        wjson(os.path.join(RP, "particles", "eclipse", f"{k}.particle.json"), data)
    # hand materialize particle (attachables)
    mh = fx.particles()["materialize"]
    mh["particle_effect"]["description"]["identifier"] = "eclipse:materialize_hand"
    mh["particle_effect"]["components"]["minecraft:emitter_shape_sphere"]["radius"] = 0.45
    mh["particle_effect"]["components"]["minecraft:particle_appearance_tinting"] = {"color": [0.8, 0.55, 1.0, 1.0]}
    wjson(os.path.join(RP, "particles", "eclipse", "materialize_hand.particle.json"), mh)
    for name, fn in fx.PARTICLE_TEXTURES.items():
        wpng(os.path.join(RP, "textures", "eclipse", "particles", f"{name}.png"), fn())
    defs = {}
    os.makedirs(os.path.join(RP, "sounds", "eclipse"), exist_ok=True)
    for name, dur in fx.SOUNDS.items():
        fx.write_ogg(os.path.join(RP, "sounds", "eclipse", name), fx.synth(name, dur))
        cat = "ui" if name in ("ui_click",) else "player" if name in ("levelup",) else "neutral"
        defs[f"eclipse.{name}"] = {"category": cat, "min_distance": 1.0, "max_distance": 32.0,
                                   "sounds": [{"name": f"sounds/eclipse/{name}", "volume": 1.0, "load_on_low_memory": name in ("ui_click",)}]}
    defs["eclipse.lyra_hum"] = {"category": "neutral", "max_distance": 16.0, "sounds": [{"name": "sounds/eclipse/materialize", "volume": 0.25, "pitch": 1.4}]}
    wjson(os.path.join(RP, "sounds", "sound_definitions.json"), {"format_version": "1.20.20", "sound_definitions": defs})
    wjson(os.path.join(RP, "sounds.json"), {"entity_sounds": {"entities": entity_sounds}})


def build_texts():
    LANG.update({
        "pack.name": "ECLIPSE — Shadow Sovereign",
        "pack.description": "Criado por 0neajx",
        "action.interact.eclipse.orders": "Ordens",
        "action.interact.eclipse.talk": "Falar",
    })
    lines = [f"{k}={v}" for k, v in sorted(LANG.items())]
    for folder in (os.path.join(RP, "texts"), os.path.join(BP, "texts")):
        os.makedirs(folder, exist_ok=True)
        for lang in ("pt_BR", "en_US", "pt_PT", "es_ES"):
            with open(os.path.join(folder, f"{lang}.lang"), "w", encoding="utf-8") as f:
                f.write("\n".join(lines if folder.startswith(RP) else [l for l in lines if l.startswith("pack.")]) + "\n")
        wjson(os.path.join(folder, "languages.json"), ["pt_BR", "en_US", "pt_PT", "es_ES"])


def build_registry_js():
    data = {
        "version": VERSION_STR,
        "creatures": [{"key": c.key, "id": f"eclipse:{c.key}", "name": c.name, "title": c.title, "desc": c.desc,
                       "special": c.special, "flying": c.flying, "group": c.group, "emoji": c.emoji,
                       "health": c.health, "damage": c.damage} for c in CREATURES],
        "relics": [{"key": k, "id": f"eclipse:{k}", "name": ITEM_INFO[k][0], "lore": ITEM_INFO[k][2], "damage": RELIC_DAMAGE.get(k, 0),
                    "throwable": k in THROWABLE} for k in RELICS],
        "powerItems": [{"key": k, "id": f"eclipse:{k}", "name": ITEM_INFO[k][0], "lore": ITEM_INFO[k][2]} for k in POWER_ITEMS],
        "tools": [{"key": k, "id": f"eclipse:{k}", "name": ITEM_INFO[k][0]} for k in TOOLS],
        "wings": [{"key": k, "id": f"eclipse:{k}", "name": n, "desc": d} for k, (n, d) in WINGS.items()],
        "forms": [{"key": k, "id": f"eclipse:form_{k}", "name": n, "desc": d} for k, (n, d) in FORMS.items()],
        "blocks": [{"key": k, "id": f"eclipse:{k}", "name": v[0], "light": v[1]} for k, v in fx.BLOCKS.items()],
        "elements": E.ELEMENTS,
        "lyraActions": ACTIONS,
    }
    path = os.path.join(BP, "scripts", "data", "generated.js")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("// AUTO-GENERATED by tools/build_assets.py — do not edit by hand.\n")
        f.write("// Single source of truth shared by the asset generator and the gameplay scripts.\n")
        f.write("export const GENERATED = Object.freeze(")
        f.write(json.dumps(data, ensure_ascii=False, indent=2))
        f.write(");\n")


def build_previews():
    out = os.path.join(ROOT, "site", "img")
    os.makedirs(out, exist_ok=True)
    for k, img in PREVIEWS.items():
        img.save(os.path.join(out, f"{k}.png"), optimize=True)


def main():
    previews = "--previews" in sys.argv
    clean()
    manifests()
    ent_sounds = build_creatures(previews)
    ent_sounds.update(build_lyra(previews))
    build_held_items(previews)
    bolt_rc = build_thrown()
    build_wings(previews)
    build_forms(previews)
    build_blocks()
    build_recipes()
    build_particles_and_sounds(ent_sounds)
    rc = dict(E.RENDER_CONTROLLERS)
    rc["render_controllers"] = {**rc["render_controllers"], **bolt_rc}
    wjson(os.path.join(RP, "render_controllers", "eclipse.render_controllers.json"), rc)
    wjson(os.path.join(RP, "textures", "item_texture.json"), {"resource_pack_name": "eclipse", "texture_name": "atlas.items", "texture_data": ITEM_TEXTURES})
    build_texts()
    build_registry_js()
    if previews:
        build_previews()
    print(f"ECLIPSE assets built: {len(CREATURES)} creatures + Lyra, {len(RELICS)} relics, {len(POWER_ITEMS)} power items, "
          f"{len(WINGS)} wings, {len(FORMS)} forms, {len(fx.BLOCKS)} blocks, {len(ITEM_TEXTURES)} icons")


if __name__ == "__main__":
    main()
