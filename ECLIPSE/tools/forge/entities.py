"""Behavior + client entity generation for creatures, Lyra and utility entities."""
from __future__ import annotations

from .anim import controller, controllers_file, file as anim_file

STATES = ["follow", "stay", "guard", "explore", "rest", "recover"]
PHASES = ["idle", "manifest", "recall", "special", "interact"]
BP_FORMAT = "1.21.0"

COMPANION_PROPS = {
    "eclipse:state": {"type": "enum", "values": STATES, "default": "follow", "client_sync": True},
    "eclipse:phase": {"type": "enum", "values": PHASES, "default": "manifest", "client_sync": True},
}

FRIENDLY_FIRE = [
    {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "player"}}, "deals_damage": "no"},
    {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "eclipse_companion"}}, "deals_damage": "no"},
    {"cause": "fall", "deals_damage": "no"},
    {"cause": "suffocation", "deals_damage": "no"},
]


def _hostile_targets(dist=16):
    return [{"filters": {"all_of": [
        {"test": "is_family", "subject": "other", "value": "monster"},
        {"test": "is_family", "subject": "other", "operator": "!=", "value": "creeper"},
    ]}, "max_dist": dist}]


def _physics(gravity):
    return {"minecraft:physics": {"has_gravity": gravity, "has_collision": True}}


def companion_groups(c):
    fly = c.flying
    melee = {"minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True, "reach_multiplier": 1.6}}
    defend = {
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
    }
    look = {
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 8, "probability": 0.04},
        "minecraft:behavior.random_look_around": {"priority": 9},
    }
    if fly:
        stroll = {"minecraft:behavior.random_hover": {"priority": 7, "xz_dist": 5, "y_dist": 3, "y_offset": -1, "interval": 1, "hover_height": [1, 4]}}
        explore = {"minecraft:behavior.random_hover": {"priority": 4, "xz_dist": 16, "y_dist": 6, "y_offset": 0, "interval": 1, "hover_height": [2, 8]}}
    else:
        stroll = {"minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8, "xz_dist": 4, "y_dist": 2}}
        explore = {"minecraft:behavior.random_stroll": {"priority": 4, "speed_multiplier": 1.0, "xz_dist": 16, "y_dist": 6, "interval": 20}}
    follow = {"minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.25, "start_distance": 7, "stop_distance": 3}}
    phys_air = _physics(False) if fly else _physics(True)
    groups = {
        "eclipse:follow": {**follow, **stroll, **defend, **melee, **look, **phys_air},
        "eclipse:guard": {
            "minecraft:behavior.follow_owner": {"priority": 5, "speed_multiplier": 1.3, "start_distance": 6, "stop_distance": 2.5},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": True, "reselect_targets": True,
                                                             "within_radius": 16, "entity_types": _hostile_targets(16)},
            **defend, **melee, **look, **phys_air,
        },
        "eclipse:stay": {**look, **_physics(True)},
        "eclipse:explore": {**explore, **defend, **melee, **look, **phys_air},
    }
    return groups


def state_events(groups):
    names = list(groups)
    ev = {}
    for st in ("follow", "stay", "guard", "explore"):
        g = f"eclipse:{st}"
        ev[f"eclipse:state_{st}"] = {"sequence": [
            {"remove": {"component_groups": [n for n in names if n != g]}},
            {"add": {"component_groups": [g]}},
            {"set_property": {"eclipse:state": st}},
        ]}
    for st in ("rest", "recover"):
        ev[f"eclipse:state_{st}"] = {"set_property": {"eclipse:state": st}}
    for ph in PHASES:
        ev[f"eclipse:phase_{ph}"] = {"set_property": {"eclipse:phase": ph}}
    ev["eclipse:interacted"] = {}
    ev["eclipse:on_tamed"] = {}
    return ev


def companion_bp(c):
    groups = companion_groups(c)
    w, h = c.collision
    comps = {
        "minecraft:type_family": {"family": ["eclipse", "eclipse_companion", f"eclipse_{c.key}", *c.family, "mob"]},
        "minecraft:health": {"value": c.health, "max": c.health},
        "minecraft:attack": {"damage": c.damage},
        "minecraft:movement": {"value": c.speed},
        "minecraft:collision_box": {"width": w, "height": h},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
        "minecraft:nameable": {"always_show": False, "allow_name_tag_renaming": True},
        "minecraft:persistent": {},
        "minecraft:follow_range": {"value": 32, "max": 32},
        "minecraft:breathable": {"total_supply": 30, "suffocate_time": 0, "breathes_water": c.aquatic},
        "minecraft:damage_sensor": {"triggers": FRIENDLY_FIRE},
        "minecraft:tameable": {"probability": 0.0, "tame_event": {"event": "eclipse:on_tamed", "target": "self"}},
        "minecraft:interact": {"interactions": [{
            "on_interact": {"filters": {"test": "is_family", "subject": "other", "value": "player"}, "event": "eclipse:interacted", "target": "self"},
            "interact_text": "action.interact.eclipse.orders",
            "swing": True,
        }]},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:knockback_resistance": {"value": c.knockback_resist},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:experience_reward": {"on_death": "0"},
    }
    if c.flying:
        comps.update({
            "minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_pass_doors": True,
                                           "can_path_from_air": True, "avoid_water": True, "avoid_damage_blocks": True, "avoid_sun": False},
            "minecraft:movement.hover": {},
            "minecraft:flying_speed": {"value": c.fly_speed},
            "minecraft:can_fly": {},
        })
    else:
        comps.update({
            "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True,
                                          "can_pass_doors": True, "can_open_doors": False},
            "minecraft:movement.basic": {},
        })
    if c.key in ("nox", "vesper", "golem"):
        comps["minecraft:fire_immune"] = {}
    return {
        "format_version": BP_FORMAT,
        "minecraft:entity": {
            "description": {"identifier": f"eclipse:{c.key}", "is_spawnable": False, "is_summonable": True,
                            "properties": COMPANION_PROPS},
            "component_groups": groups,
            "components": comps,
            "events": {
                "minecraft:entity_spawned": {"add": {"component_groups": ["eclipse:follow"]}},
                **state_events(groups),
            },
        },
    }


# --------------------------------------------------------------- client side
PARTICLES = {
    "manifest": "eclipse:shadow_manifest",
    "recall": "eclipse:shadow_recall",
    "burst": "eclipse:violet_burst",
    "impact": "eclipse:ground_impact",
    "breath": "eclipse:shadow_breath",
    "cast": "eclipse:cast_sparks",
}

SPECIAL_SOUNDS = {
    "umbra": "eclipse.howl", "nyx": "mob.cat.hiss", "aegis": "random.anvil_land", "nox": "mob.enderdragon.growl",
    "vesper": "eclipse.divine_pulse", "corvus": "mob.parrot.idle", "serpent": "mob.cat.hiss", "stag": "eclipse.materialize",
    "golem": "random.explode", "manta": "eclipse.wings_open", "lyra": "eclipse.shadow_cast",
}


def move_controller(key, flying, has_sit=True):
    stay = "q.property('eclipse:state') == 'stay'"
    if not flying:
        states = {
            "default": {"animations": ["idle"], "transitions": [{"sit": stay}, {"run": "q.ground_speed > 3.6"}, {"walk": "q.ground_speed > 0.35"}], "blend_transition": 0.3},
            "walk": {"animations": ["walk"], "transitions": [{"sit": stay}, {"run": "q.ground_speed > 3.6"}, {"default": "q.ground_speed < 0.2"}], "blend_transition": 0.25},
            "run": {"animations": ["run"], "transitions": [{"walk": "q.ground_speed < 3.0"}], "blend_transition": 0.25},
            "sit": {"animations": ["sit"], "transitions": [{"default": "q.property('eclipse:state') != 'stay'"}], "blend_transition": 0.5},
        }
    else:
        states = {
            "default": {"animations": ["idle"], "transitions": [{"takeoff": "!q.is_on_ground"}, {"sit": stay}, {"walk": "q.ground_speed > 0.35"}], "blend_transition": 0.3},
            "walk": {"animations": ["walk"], "transitions": [{"takeoff": "!q.is_on_ground"}, {"default": "q.ground_speed < 0.2"}], "blend_transition": 0.25},
            "sit": {"animations": ["sit"], "transitions": [{"takeoff": "!q.is_on_ground"}, {"default": "q.property('eclipse:state') != 'stay'"}], "blend_transition": 0.5},
            "takeoff": {"animations": ["takeoff"], "transitions": [{"air": "q.all_animations_finished"}], "blend_transition": 0.2},
            "air": {"animations": ["hover"], "transitions": [{"land": "q.is_on_ground"}, {"glide": "q.vertical_speed < -1.6"}, {"fly": "q.ground_speed > 1.6"}], "blend_transition": 0.35},
            "fly": {"animations": ["fly"], "transitions": [{"land": "q.is_on_ground"}, {"glide": "q.vertical_speed < -1.6"}, {"air": "q.ground_speed < 1.0"}], "blend_transition": 0.35},
            "glide": {"animations": ["glide"], "transitions": [{"land": "q.is_on_ground"}, {"fly": "q.vertical_speed > -0.6 && q.ground_speed > 1.6"}, {"air": "q.vertical_speed > -0.6"}], "blend_transition": 0.5},
            "land": {"animations": ["land"], "transitions": [{"default": "q.all_animations_finished"}, {"air": "!q.is_on_ground && q.anim_time > 0.3"}], "blend_transition": 0.2},
        }
    return controller(f"controller.animation.eclipse.{key}.move", states)


def phase_controller(key):
    p = "q.property('eclipse:phase')"
    states = {
        "default": {"transitions": [{"manifest": f"{p} == 'manifest'"}, {"recall": f"{p} == 'recall'"},
                                    {"special": f"{p} == 'special'"}, {"interact": f"{p} == 'interact'"}]},
        "manifest": {"animations": ["manifest"], "transitions": [{"recall": f"{p} == 'recall'"}, {"default": f"{p} != 'manifest'"}], "blend_transition": 0.1},
        "recall": {"animations": ["recall"], "transitions": [{"default": f"{p} != 'recall'"}]},
        "special": {"animations": ["special"], "transitions": [{"recall": f"{p} == 'recall'"}, {"default": f"q.all_animations_finished || {p} != 'special'"}], "blend_transition": 0.25},
        "interact": {"animations": ["interact"], "transitions": [{"recall": f"{p} == 'recall'"}, {"default": f"q.all_animations_finished || {p} != 'interact'"}], "blend_transition": 0.25},
    }
    return controller(f"controller.animation.eclipse.{key}.phase", states)


def fidget_controller(key, fidgets):
    states = {"default": {"transitions": []}}
    n = max(1, len(fidgets))
    for f in fidgets:
        states["default"]["transitions"].append({f: f"q.ground_speed < 0.1 && q.property('eclipse:phase') == 'idle' && q.property('eclipse:state') != 'stay' && math.random(0, 1) < {0.0016 / n:.5f}"})
        states[f] = {"animations": [f], "transitions": [{"default": "q.all_animations_finished || q.ground_speed > 0.4 || q.property('eclipse:phase') != 'idle'"}], "blend_transition": 0.35}
    return controller(f"controller.animation.eclipse.{key}.fidget", states)


def client_entity(key, anims, ctrl_names, flying, scale=1.0, material="entity_emissive_alpha", extra_scripts=None, attachables=False):
    amap = {k: v[0] for k, v in anims.items()}
    amap.update(ctrl_names)
    animate = ["look"] + list(ctrl_names.keys())
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": f"eclipse:{key}",
                "materials": {"default": material},
                "textures": {"default": f"textures/entity/eclipse/{key}"},
                "geometry": {"default": f"geometry.eclipse.{key}"},
                "animations": amap,
                "particle_effects": PARTICLES,
                "sound_effects": {"manifest": "eclipse.manifest", "recall": "eclipse.recall", "special": SPECIAL_SOUNDS.get(key, "eclipse.shadow_cast")},
                "scripts": {"scale": str(scale), "animate": animate, **(extra_scripts or {})},
                "render_controllers": ["controller.render.eclipse.creature"],
                "enable_attachables": attachables,
            }
        },
    }


def creature_files(c):
    anims = dict(c.anims)
    ctrls = dict([move_controller(c.key, c.flying), phase_controller(c.key)])
    ctrl_names = {"ctrl_move": f"controller.animation.eclipse.{c.key}.move",
                  "ctrl_phase": f"controller.animation.eclipse.{c.key}.phase"}
    if c.fidgets:
        k, v = fidget_controller(c.key, c.fidgets)
        ctrls[k] = v
        ctrl_names["ctrl_fidget"] = k
    # de-duplicate animation definitions that are aliases (same name)
    defs = {}
    for k, (name, data) in anims.items():
        defs[name] = data
    return {
        "bp": companion_bp(c),
        "client": client_entity(c.key, anims, ctrl_names, c.flying, c.scale),
        "anim": {"format_version": "1.10.0", "animations": defs},
        "ctrl": controllers_file(ctrls),
    }


RENDER_CONTROLLERS = {
    "format_version": "1.8.0",
    "render_controllers": {
        "controller.render.eclipse.creature": {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"],
            "is_hurt_color": {"r": "0.55", "g": "0.15", "b": "1.0", "a": "0.45"},
            "on_fire_color": {"r": "0.6", "g": "0.3", "b": "1.0", "a": "0.5"},
        },
        "controller.render.eclipse.item": {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"],
        },
        "controller.render.eclipse.thrown": {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"],
        },
    },
}


# =================================================================== LYRA
def lyra_files(model_key, anims, actions):
    groups = {
        "eclipse:follow": {
            "minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.15, "start_distance": 6, "stop_distance": 2.5},
            "minecraft:behavior.random_stroll": {"priority": 8, "speed_multiplier": 0.7, "xz_dist": 3},
            "minecraft:behavior.hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.25, "track_target": True},
            "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8, "probability": 0.05},
            "minecraft:behavior.random_look_around": {"priority": 9},
            **_physics(True),
        },
        "eclipse:guard": {
            "minecraft:behavior.follow_owner": {"priority": 5, "speed_multiplier": 1.25, "start_distance": 5, "stop_distance": 2},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.hurt_by_target": {"priority": 1},
            "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": True, "reselect_targets": True,
                                                             "within_radius": 14, "entity_types": _hostile_targets(14)},
            "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True},
            "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
            **_physics(True),
        },
        "eclipse:stay": {
            "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
            "minecraft:behavior.random_look_around": {"priority": 9},
            **_physics(True),
        },
        "eclipse:explore": {
            "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.9, "xz_dist": 12},
            "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
            **_physics(True),
        },
        # Script-driven mode: Lyra's own planner moves her (pathfinding + steps), no vanilla goals interfere.
        "eclipse:scripted": {"minecraft:physics": {"has_gravity": False, "has_collision": False}},
    }
    events = state_events({k: v for k, v in groups.items() if k != "eclipse:scripted"})
    # state events must also drop the scripted group
    for st in ("follow", "stay", "guard", "explore"):
        events[f"eclipse:state_{st}"]["sequence"][0]["remove"]["component_groups"].append("eclipse:scripted")
    events["eclipse:script_on"] = {"sequence": [
        {"remove": {"component_groups": ["eclipse:follow", "eclipse:guard", "eclipse:stay", "eclipse:explore"]}},
        {"add": {"component_groups": ["eclipse:scripted"]}},
    ]}
    for a in actions:
        events[f"eclipse:act_{a}"] = {"set_property": {"eclipse:action": a}}
    comps = {
        "minecraft:type_family": {"family": ["eclipse", "eclipse_companion", "eclipse_lyra", "npc", "mob"]},
        "minecraft:health": {"value": 60, "max": 60},
        "minecraft:attack": {"damage": 7},
        "minecraft:movement": {"value": 0.3},
        "minecraft:collision_box": {"width": 0.6, "height": 1.8},
        "minecraft:jump.static": {},
        "minecraft:can_climb": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True,
                                      "can_pass_doors": True, "can_open_doors": True},
        "minecraft:movement.basic": {},
        "minecraft:annotation.open_door": {},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
        "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": True},
        "minecraft:persistent": {},
        "minecraft:follow_range": {"value": 48, "max": 48},
        "minecraft:breathable": {"total_supply": 30, "suffocate_time": 0},
        "minecraft:damage_sensor": {"triggers": FRIENDLY_FIRE},
        "minecraft:tameable": {"probability": 0.0, "tame_event": {"event": "eclipse:on_tamed", "target": "self"}},
        "minecraft:inventory": {"inventory_size": 36, "container_type": "inventory"},
        "minecraft:interact": {"interactions": [{
            "on_interact": {"filters": {"test": "is_family", "subject": "other", "value": "player"}, "event": "eclipse:interacted", "target": "self"},
            "interact_text": "action.interact.eclipse.talk",
            "swing": True,
        }]},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:conditional_bandwidth_optimization": {},
        "minecraft:experience_reward": {"on_death": "0"},
        "minecraft:fire_immune": {},
    }
    props = dict(COMPANION_PROPS)
    props["eclipse:action"] = {"type": "enum", "values": actions, "default": "idle", "client_sync": True}
    bp = {
        "format_version": BP_FORMAT,
        "minecraft:entity": {
            "description": {"identifier": "eclipse:lyra", "is_spawnable": False, "is_summonable": True, "properties": props},
            "component_groups": groups,
            "components": comps,
            "events": {"minecraft:entity_spawned": {"add": {"component_groups": ["eclipse:follow"]}}, **events},
        },
    }
    act = "q.property('eclipse:action')"
    anim_for = {"walk": "walk_scripted", "run": "run", "wave": "wave"}
    states = {"default": {"animations": ["idle"], "transitions": [], "blend_transition": 0.25}}
    for a in actions:
        if a == "idle":
            continue
        states["default"]["transitions"].append({a: f"{act} == '{a}'"})
        states[a] = {"animations": [anim_for.get(a, a)], "transitions": [{"default": f"{act} != '{a}'"}], "blend_transition": 0.2}
    states["default"]["transitions"].append({"native_walk": "q.ground_speed > 0.35"})
    states["default"]["transitions"].insert(0, {"sit_native": f"q.property('eclipse:state') == 'stay' && {act} == 'idle'"})
    states["native_walk"] = {"animations": ["walk"], "transitions": [{"default": f"q.ground_speed < 0.2 || {act} != 'idle'"}], "blend_transition": 0.25}
    states["sit_native"] = {"animations": ["sit"], "transitions": [{"default": f"q.property('eclipse:state') != 'stay' || {act} != 'idle'"}], "blend_transition": 0.4}
    ctrls = dict([controller("controller.animation.eclipse.lyra.move", states), phase_controller("lyra")])
    ctrl_names = {"ctrl_move": "controller.animation.eclipse.lyra.move", "ctrl_phase": "controller.animation.eclipse.lyra.phase"}
    defs = {name: data for _, (name, data) in anims.items()}
    client = client_entity("lyra", anims, ctrl_names, False, 0.95, attachables=True)
    return {"bp": bp, "client": client, "anim": {"format_version": "1.10.0", "animations": defs}, "ctrl": controllers_file(ctrls)}


# =================================================================== THROWN RELICS / BOLTS
def thrown_relic_files(key, geo, texture):
    bp = {
        "format_version": BP_FORMAT,
        "minecraft:entity": {
            "description": {"identifier": f"eclipse:{key}", "is_spawnable": False, "is_summonable": True,
                            "properties": {"eclipse:spin": {"type": "bool", "default": True, "client_sync": True}}},
            "components": {
                "minecraft:type_family": {"family": ["eclipse", "eclipse_thrown", "inanimate"]},
                "minecraft:collision_box": {"width": 0.6, "height": 0.6},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
                "minecraft:health": {"value": 1000, "max": 1000},
                "minecraft:knockback_resistance": {"value": 1.0},
                "minecraft:fire_immune": {},
                "minecraft:conditional_bandwidth_optimization": {},
            },
            "events": {
                "eclipse:spin_on": {"set_property": {"eclipse:spin": True}},
                "eclipse:spin_off": {"set_property": {"eclipse:spin": False}},
            },
        },
    }
    anims = {
        "spin": (f"animation.eclipse.{key}.spin", {"loop": True, "bones": {"root": {"rotation": ["q.anim_time * -1440", 0, 0], "position": [0, 4, 0]}}}),
        "rest": (f"animation.eclipse.{key}.rest", {"loop": True, "bones": {"root": {"rotation": [-25, "q.anim_time * 30", 0],
                                                                                        "position": [0, "3 + math.sin(q.anim_time * 120) * 0.6", 0]}}}),
    }
    ctrl = controller(f"controller.animation.eclipse.{key}.state", {
        "default": {"animations": ["spin"], "transitions": [{"rest": "!q.property('eclipse:spin')"}], "blend_transition": 0.2},
        "rest": {"animations": ["rest"], "transitions": [{"default": "q.property('eclipse:spin')"}], "blend_transition": 0.3},
    })
    client = {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": f"eclipse:{key}",
            "materials": {"default": "entity_alphatest"},
            "textures": {"default": texture},
            "geometry": {"default": geo},
            "animations": {"spin": anims["spin"][0], "rest": anims["rest"][0], "ctrl": ctrl[0]},
            "scripts": {"animate": ["ctrl"], "scale": "1.15"},
            "render_controllers": ["controller.render.eclipse.thrown"],
        }},
    }
    return {"bp": bp, "client": client, "anim": {"format_version": "1.10.0", "animations": {n: d for n, d in anims.values()}},
            "ctrl": controllers_file([ctrl])}


ELEMENTS = ["shadow", "light", "fire", "water", "earth", "air", "lightning", "ice", "nature"]


def bolt_files():
    bp = {
        "format_version": BP_FORMAT,
        "minecraft:entity": {
            "description": {"identifier": "eclipse:spell_bolt", "is_spawnable": False, "is_summonable": True,
                            "properties": {"eclipse:element_id": {"type": "int", "range": [0, len(ELEMENTS) - 1], "default": 0, "client_sync": True}}},
            "components": {
                "minecraft:type_family": {"family": ["eclipse", "eclipse_bolt", "projectile"]},
                "minecraft:collision_box": {"width": 0.3, "height": 0.3},
                "minecraft:projectile": {
                    "on_hit": {"impact_damage": {"damage": 5, "knockback": True, "destroy_on_hit": True},
                               "remove_on_hit": {}},
                    "power": 2.0, "gravity": 0.0, "inertia": 1.0, "liquid_inertia": 1.0,
                    "uncertainty_base": 0, "uncertainty_multiplier": 0, "anchor": 1, "offset": [0, -0.1, 0],
                    "should_bounce": False, "hit_sound": "bow.hit",
                },
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": True},
                "minecraft:conditional_bandwidth_optimization": {"default_values": {"max_optimized_distance": 80.0, "max_dropped_ticks": 7, "use_motion_prediction_hints": True}},
            },
            "events": {f"eclipse:element_{e}": {"set_property": {"eclipse:element_id": i}} for i, e in enumerate(ELEMENTS)},
        },
    }
    client = {
        "format_version": "1.10.0",
        "minecraft:client_entity": {"description": {
            "identifier": "eclipse:spell_bolt",
            "materials": {"default": "entity_emissive_alpha"},
            "textures": {e: f"textures/entity/eclipse/bolt_{e}" for e in ELEMENTS},
            "geometry": {"default": "geometry.eclipse.spell_bolt"},
            "animations": {"spin": "animation.eclipse.spell_bolt.spin"},
            "scripts": {"animate": ["spin"]},
            "render_controllers": ["controller.render.eclipse.bolt"],
        }},
    }
    anim = {"format_version": "1.10.0", "animations": {"animation.eclipse.spell_bolt.spin": {
        "loop": True, "bones": {"core": {"rotation": [0, 0, "q.anim_time * 720"], "scale": "1 + math.sin(q.anim_time * 1400) * 0.15"}}}}}
    rc = {"controller.render.eclipse.bolt": {
        "arrays": {"textures": {"Array.elements": [f"Texture.{e}" for e in ELEMENTS]}},
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": ["Array.elements[q.property('eclipse:element_id')]"],
    }}
    return {"bp": bp, "client": client, "anim": anim, "rc": rc}
