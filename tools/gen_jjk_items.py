#!/usr/bin/env python3
"""Generates the Jujutsu Kaisen items (BP), armor attachables (RP), the item atlas and item names (lang).
Run with `npm run art`. Item ids must match scripts/jujutsu/arsenal.ts (the validator checks icons/lang/attachables)."""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BP, RP = os.path.join(ROOT, "behavior_pack"), os.path.join(ROOT, "resource_pack")

# id: (pt name, en name, kind, extra)
ITEMS = {
    "shadow_summoner": ("Grimório Jujutsu", "Jujutsu Grimoire", "hub", {}),
    "playful_cloud": ("Nuvem Brincalhona", "Playful Cloud", "tool", {"damage": 9}),
    "inverted_spear": ("Lança Invertida do Céu", "Inverted Spear of Heaven", "tool", {"damage": 8}),
    "split_soul_katana": ("Katana Alma Dividida", "Split Soul Katana", "tool", {"damage": 8}),
    "dragon_bone": ("Osso de Dragão", "Dragon-Bone", "tool", {"damage": 8}),
    "slaughter_demon": ("Demônio Matador", "Slaughter Demon", "tool", {"damage": 6}),
    "uniform_tokyo_chest": ("Jaqueta da Escola de Tóquio", "Tokyo Jujutsu High Jacket", "wear", {"slot": "chest", "protection": 4, "tex": "jjk_tokyo_1"}),
    "uniform_tokyo_legs": ("Calça da Escola de Tóquio", "Tokyo Jujutsu High Pants", "wear", {"slot": "legs", "protection": 3, "tex": "jjk_tokyo_2"}),
    "uniform_kyoto_chest": ("Jaqueta da Escola de Kyoto", "Kyoto Jujutsu High Jacket", "wear", {"slot": "chest", "protection": 4, "tex": "jjk_kyoto_1"}),
    "gojo_blindfold": ("Venda Preta", "Black Blindfold", "wear", {"slot": "head", "protection": 1, "tex": "jjk_blindfold_1"}),
    "sukuna_finger": ("Dedo de Sukuna", "Sukuna's Finger", "food", {"anim": "eat", "stack": 20, "glint": True}),
    "throat_syrup": ("Xarope para Garganta", "Throat Syrup", "food", {"anim": "drink", "stack": 16}),
    "cursed_fragment": ("Fragmento Amaldiçoado", "Cursed Fragment", "material", {"stack": 64}),
}
OVERLAYS = {  # worn by the scripts in the helmet slot (Sukuna's markings, Six Eyes)
    "sukuna_marks": ("Marcas de Sukuna", "Sukuna's Markings", "wear", {"slot": "head", "protection": 0, "tex": "jjk_marks_1", "hidden": True}),
    "six_eyes": ("Seis Olhos", "Six Eyes", "wear", {"slot": "head", "protection": 0, "tex": "jjk_sixeyes_1", "hidden": True}),
}
ITEMS.update(OVERLAYS)


def skill_items() -> dict:
    """One power button per castable ability, read from scripts/jujutsu/clans.ts (single source of truth)."""
    import re
    src = open(os.path.join(ROOT, "scripts", "jujutsu", "clans.ts"), encoding="utf-8").read()
    out = {}
    for m in re.finditer(r'A\(\{ id: "(\w+)", name: "((?:[^"\\]|\\.)*)", kind: "(\w+)", cost: [\d.]+, drain: [\d.]+, cooldown: ([\d.]+), .*?icon: "(\w+)"', src, re.S):
        aid, name, kind, cd, icon = m.group(1), m.group(2).replace('\\"', '"'), m.group(3), float(m.group(4)), m.group(5)
        if kind == "passiva" or aid == "guardar":
            continue
        out[f"skill_{aid}"] = (f"Poder: {name}", f"Power: {aid}", "skill", {"icon": f"a_{icon}", "cooldown": max(0.5, cd)})
    out["skill_caes_divinos"] = ("Poder: Invocar Cães Divinos", "Power: Divine Dogs", "skill", {"icon": "dogs", "cooldown": 1.0})
    out["skill_shikigamis"] = ("Poder: Shikigamis", "Power: Shikigami", "skill", {"icon": "summon", "cooldown": 0.5})
    return out


ITEMS.update(skill_items())

SLOT = {"chest": ("slot.armor.chest", "armor_torso", "geometry.player.armor.chestplate", "variable.chest_layer_visible = 0.0;"),
        "legs": ("slot.armor.legs", "armor_legs", "geometry.player.armor.leggings", "variable.leg_layer_visible = 0.0;"),
        "head": ("slot.armor.head", "armor_head", "geometry.player.armor.helmet", "variable.helmet_layer_visible = 0.0;")}


def icon_name(key: str) -> str:
    return "shadowbound_summoner" if key == "shadow_summoner" else f"sb_{key}"


def item_json(key: str, kind: str, x: dict) -> dict:
    ident = f"shadowbound:{key}"
    c = {"minecraft:icon": icon_name(key), "minecraft:display_name": {"value": f"item.{ident}.name"}}
    cat = "items"
    if kind == "hub":
        c.update({"minecraft:max_stack_size": 1, "minecraft:glint": True, "minecraft:hand_equipped": False})
        cat = "equipment"
    elif kind == "tool":
        c.update({"minecraft:max_stack_size": 1, "minecraft:hand_equipped": True, "minecraft:damage": {"value": x["damage"]},
                  "minecraft:durability": {"max_durability": 1500}, "minecraft:enchantable": {"slot": "sword", "value": 14},
                  "minecraft:can_destroy_in_creative": False})
        cat = "equipment"
    elif kind == "skill":
        c.update({"minecraft:max_stack_size": 1, "minecraft:hand_equipped": False,
                  "minecraft:cooldown": {"category": f"sb_{key}", "duration": x["cooldown"]}})
        cat = "none"
    elif kind == "wear":
        slot, ench, _, _ = SLOT[x["slot"]]
        c.update({"minecraft:max_stack_size": 1, "minecraft:wearable": {"slot": slot, "protection": x["protection"]},
                  "minecraft:durability": {"max_durability": 400}, "minecraft:enchantable": {"slot": ench, "value": 10}})
        cat = "none" if x.get("hidden") else "equipment"
    elif kind == "food":
        c.update({"minecraft:max_stack_size": x["stack"], "minecraft:food": {"nutrition": 0, "saturation_modifier": 0, "can_always_eat": True},
                  "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35}, "minecraft:use_animation": x["anim"]})
        if x.get("glint"):
            c["minecraft:glint"] = True
    else:
        c.update({"minecraft:max_stack_size": x["stack"]})
    return {"format_version": "1.21.40", "minecraft:item": {"description": {"identifier": ident, "menu_category": {"category": cat}}, "components": c}}


def attachable(key: str, x: dict) -> dict:
    _, _, geo, setup = SLOT[x["slot"]]
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": f"shadowbound:{key}",
        "materials": {"default": "armor", "enchanted": "armor_enchanted"},
        "textures": {"default": f"textures/models/armor/{x['tex']}", "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": geo},
        "scripts": {"parent_setup": setup},
        "render_controllers": ["controller.render.armor"],
    }}}


def main() -> None:
    os.makedirs(os.path.join(BP, "items"), exist_ok=True)
    os.makedirs(os.path.join(RP, "attachables"), exist_ok=True)
    atlas = {"resource_pack_name": "shadowbound", "texture_name": "atlas.items", "texture_data": {}}
    lang_pt = ["entity.shadowbound:beast.name=Shikigami", "pack.name=Jujutsu Kaisen: Legado", "pack.description=Mod de fã inspirado em Jujutsu Kaisen"]
    lang_en = ["entity.shadowbound:beast.name=Shikigami", "pack.name=Jujutsu Kaisen: Legacy", "pack.description=Fan add-on inspired by Jujutsu Kaisen"]
    for key, (pt, en, kind, x) in ITEMS.items():
        fname = "shadow_summoner.json" if key == "shadow_summoner" else f"{key}.json"
        with open(os.path.join(BP, "items", fname), "w") as f:
            json.dump(item_json(key, kind, x), f, indent=2)
        tex = "textures/items/shadow_summoner" if key == "shadow_summoner" else f"textures/items/sb_{key}"
        if kind == "skill":
            tex = f"textures/ui/shadowbound/{x['icon']}"
        atlas["texture_data"][icon_name(key)] = {"textures": tex}
        if kind == "wear":
            with open(os.path.join(RP, "attachables", f"{key}.json"), "w") as f:
                json.dump(attachable(key, x), f, indent=2)
        lang_pt += [f"item.shadowbound:{key}.name={pt}", f"item.shadowbound:{key}={pt}"]
        lang_en += [f"item.shadowbound:{key}.name={en}", f"item.shadowbound:{key}={en}"]
    with open(os.path.join(RP, "textures", "item_texture.json"), "w") as f:
        json.dump(atlas, f, indent=2)
    for pack in (BP, RP):
        with open(os.path.join(pack, "texts", "pt_BR.lang"), "w", encoding="utf-8") as f:
            f.write("\n".join(lang_pt) + "\n")
        with open(os.path.join(pack, "texts", "en_US.lang"), "w", encoding="utf-8") as f:
            f.write("\n".join(lang_en) + "\n")
    print("jjk items generated:", len(ITEMS))


if __name__ == "__main__":
    main()
