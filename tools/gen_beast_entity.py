#!/usr/bin/env python3
"""Generates behavior_pack/entities/shadowbound_beast.json. Stats must match scripts/core/species.ts
(the pack validator cross-checks species names, health and attack)."""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SPECIES = {  # name: (health, attack, speed, width, height)
    "wolf": (30, 5, 0.38, 0.7, 0.9),
    "owl": (28, 4, 0.36, 0.8, 1.1),
    "serpent": (55, 6, 0.28, 1.2, 0.9),
    "toad": (36, 4, 0.26, 1.0, 1.0),
    "elephant": (100, 8, 0.24, 1.8, 2.3),
    "rabbit": (16, 1, 0.42, 0.5, 0.6),
    "deer": (45, 3, 0.32, 0.9, 1.7),
    "bull": (70, 9, 0.3, 1.4, 1.6),
    "tiger": (60, 9, 0.36, 1.1, 1.2),
    "lion": (70, 8, 0.33, 1.2, 1.4),
    "dragon": (140, 12, 0.3, 2.4, 2.6),
    "colossus": (220, 15, 0.27, 1.6, 3.4),
    "dog_white": (30, 5, 0.38, 0.7, 0.9),
    "totality": (80, 11, 0.37, 1.2, 1.5),
}
HOSTILES = [
    {"test": "is_family", "subject": "other", "value": "monster"},
    {"test": "is_family", "subject": "other", "operator": "!=", "value": "enderman"},
    {"test": "is_family", "subject": "other", "operator": "!=", "value": "zombie_pigman"},
    {"test": "is_family", "subject": "other", "operator": "!=", "value": "piglin"},
]
not_player = {"filters": {"all_of": [
    {"test": "is_family", "subject": "other", "operator": "!=", "value": "player"},
    {"test": "is_family", "subject": "other", "operator": "!=", "value": "shadowbound"},
]}}


def combat(radius, follow):
    g = {
        "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
        "minecraft:behavior.hurt_by_target": {"priority": 2, "entity_types": not_player},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 3, "must_see": True, "reselect_targets": True, "within_radius": float(radius),
            "entity_types": [{"filters": {"all_of": HOSTILES}, "max_dist": radius}],
        },
        "minecraft:behavior.melee_attack": {"priority": 4, "speed_multiplier": 1.35, "track_target": True, "reach_multiplier": 1.8},
    }
    if follow:
        g["minecraft:behavior.owner_hurt_target"] = {"priority": 2}
        g["minecraft:behavior.follow_owner"] = {"priority": 6, "speed_multiplier": 1.2, "start_distance": 8, "stop_distance": 3}
    return g


groups = {
    "shadowbound:tamed": {"minecraft:is_tamed": {}},
    "shadowbound:mode_follow": combat(14, True),
    "shadowbound:mode_guard": combat(12, False),
    "shadowbound:mode_scripted": {"minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 6, "probability": 0.02}},
    # exorcism ritual: the untamed shikigami fights the summoner (and can be hurt by players)
    "shadowbound:mode_wild": {
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 2, "must_see": False, "reselect_targets": True, "within_radius": 24.0,
            "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 24}],
        },
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True, "reach_multiplier": 1.8},
        "minecraft:damage_sensor": {"triggers": [
            {"cause": "fall", "deals_damage": "no"},
            {"cause": "suffocation", "deals_damage": "no"},
        ]},
    },
}
events = {
    "minecraft:entity_spawned": {"add": {"component_groups": ["shadowbound:mode_follow"]}},
    "shadowbound:on_tame": {"add": {"component_groups": ["shadowbound:tamed"]}},
    "shadowbound:mode_follow": {"remove": {"component_groups": ["shadowbound:mode_guard", "shadowbound:mode_scripted"]}, "add": {"component_groups": ["shadowbound:mode_follow"]}},
    "shadowbound:mode_guard": {"remove": {"component_groups": ["shadowbound:mode_follow", "shadowbound:mode_scripted"]}, "add": {"component_groups": ["shadowbound:mode_guard"]}},
    "shadowbound:mode_scripted": {"remove": {"component_groups": ["shadowbound:mode_follow", "shadowbound:mode_guard"]}, "add": {"component_groups": ["shadowbound:mode_scripted"]}},
    "shadowbound:mode_wild": {"remove": {"component_groups": ["shadowbound:mode_follow", "shadowbound:mode_guard", "shadowbound:mode_scripted"]}, "add": {"component_groups": ["shadowbound:mode_wild"]}},
}
for name, (hp, atk, spd, w, h) in SPECIES.items():
    groups[f"shadowbound:species_{name}"] = {
        "minecraft:health": {"value": hp, "max": hp},
        "minecraft:attack": {"damage": atk},
        "minecraft:movement": {"value": spd},
        "minecraft:collision_box": {"width": w, "height": h},
    }
    events[f"shadowbound:species_{name}"] = {"add": {"component_groups": [f"shadowbound:species_{name}"]}}

entity = {
    "format_version": "1.21.40",
    "minecraft:entity": {
        "description": {
            "identifier": "shadowbound:beast",
            "is_spawnable": False,
            "is_summonable": True,
            "properties": {
                "shadowbound:anim": {"type": "int", "range": [0, 15], "default": 0, "client_sync": True},
                "shadowbound:species": {"type": "int", "range": [0, len(SPECIES) - 1], "default": 0, "client_sync": True},
                "shadowbound:adapt": {"type": "int", "range": [0, 7], "default": 0, "client_sync": True},   # Mahoraga's wheel position
            },
        },
        "component_groups": groups,
        "components": {
            "minecraft:type_family": {"family": ["shadowbound", "beast", "mob"]},
            "minecraft:health": {"value": 30, "max": 30},
            "minecraft:attack": {"damage": 5},
            "minecraft:movement": {"value": 0.32},
            "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True, "can_swim": True, "can_walk": True, "can_pass_doors": True},
            "minecraft:movement.basic": {},
            "minecraft:jump.static": {},
            "minecraft:can_climb": {},
            "minecraft:physics": {},
            "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
            "minecraft:collision_box": {"width": 0.8, "height": 1.0},
            "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
            "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
            "minecraft:persistent": {},
            "minecraft:knockback_resistance": {"value": 0.6},
            "minecraft:conditional_bandwidth_optimization": {},
            "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:structure_void", "tame_event": {"event": "shadowbound:on_tame", "target": "self"}},
            "minecraft:damage_sensor": {"triggers": [
                {"cause": "fall", "deals_damage": "no"},
                {"cause": "suffocation", "deals_damage": "no"},
                {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "player"}}, "deals_damage": "no"},
                {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "shadowbound"}}, "deals_damage": "no"},
            ]},
            "minecraft:behavior.float": {"priority": 0},
            "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 8, "probability": 0.04},
            "minecraft:behavior.random_look_around": {"priority": 9},
        },
        "events": events,
    },
}
with open(os.path.join(ROOT, "behavior_pack", "entities", "shadowbound_beast.json"), "w") as f:
    json.dump(entity, f, indent=2)
print("beast entity generated:", len(SPECIES), "species")
