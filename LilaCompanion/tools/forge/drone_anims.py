"""Animações do DR-0N (Molang contínuo = suave em qualquer FPS)."""
from __future__ import annotations

from .anim import anim, bone, controller, keys, osc, smooth_keys

P = "animation.lila.drone"
ACT = "q.property('lila:action')"
MOVE = "q.property('lila:move')"

DRONE_ACTIONS = ["idle", "work", "place", "shoot", "charge", "turret", "craft", "wave", "sleep", "defeat",
                 "summon", "celebrate", "scan"]
LANDED = f"({ACT} == 'sleep' || {ACT} == 'defeat' || {ACT} == 'turret')"
T = "v.turret_t"  # 0 = voando, 1 = torreta montada (rampa suave calculada em pre_animation)
PRE_ANIMATION = [
    f"v.turret_t = math.clamp(v.turret_t + (({ACT} == 'turret') ? 1 : -1) * math.min(q.delta_time, 0.1) * 2.2, 0, 1);",
]


def drone_anims():
    A = {}

    def add(name, bones, **kw):
        n, a = anim(f"{P}.{name}", bones, **kw)
        A[name] = (n, a)

    spin = f"q.anim_time * ({LANDED} ? 180 : ({ACT} == 'charge' ? 700 : 2400))"
    add("base", {
        **{f"rotor{i}": bone(rot=[0, spin if i % 2 == 0 else f"-({spin})", 0]) for i in range(4)},
        "root": bone(pos=[0, f"{LANDED} ? 0 : 5 + math.sin(q.anim_time * 120) * 0.7", 0]),
        "eye": bone(scale=f"1 + math.sin(q.anim_time * 200) * 0.03"),
        "antenna": bone(rot=[osc(3, 160), 0, osc(2, 110)]),
    })
    # transformação: tripé desce do corpo e crava no chão, braços/hélices dobram, escudo e canhão abrem
    add("parts", {
        "tripod": bone(scale=f"{T}", pos=[0, f"(1 - {T}) * 7", 0]),
        "shield": bone(scale=f"{T}", rot=[f"(1 - {T}) * 80", 0, 0]),
        "cannon": bone(scale=f"{T}", rot=[f"(1 - {T}) * -90", f"{T} * math.sin(q.anim_time * 40) * 25", 0]),
        "red_eye": bone(scale=f"{T}"),
        "legs": bone(scale=f"1 - {T} * 0.999"),
        **{f"arm{i}": bone(scale=f"1 - {T} * 0.62") for i in range(4)},
        **{f"rotor{i}": bone(scale=f"1 - {T} * 0.7") for i in range(4)},
        "gun_r": bone(pos=[f"{T} * 1.5", 0, f"{T} * -2"]), "gun_l": bone(pos=[f"{T} * -1.5", 0, f"{T} * -2"]),
    })
    add("look", {"eye": bone(rot=["math.clamp(q.target_x_rotation, -30, 30)", "math.clamp(q.target_y_rotation, -25, 25)", 0])})
    # voo: inclina para frente conforme a velocidade
    add("fly", {"body": bone(rot=["10 + math.sin(q.anim_time * 300) * 1.5", 0, osc(2, 90)])})
    add("dash", {"body": bone(rot=["20 + math.sin(q.anim_time * 500) * 2", 0, osc(3, 140)])})
    add("still", {"body": bone(rot=[osc(1.5, 70), 0, osc(1.5, 50)])})
    # ações
    add("work", {"body": bone(rot=["22 + math.sin(q.anim_time * 1400) * 2", 0, 0]),
                 "gun_r": bone(rot=[osc(10, 900, base=-20), 0, 0]), "gun_l": bone(rot=[osc(-10, 900, base=-20), 0, 0])}, loop=True)
    add("place", {"body": bone(rot=keys([(0, [0, 0, 0]), (0.15, [14, 0, 0]), (0.4, [0, 0, 0])]))}, loop=True, length=0.4)
    recoil = smooth_keys([(0, [0, 0, 0]), (0.05, [0, 0, 1.4]), (0.15, [0, 0, 0])])
    add("shoot", {"gun_r": bone(pos=recoil), "gun_l": bone(pos=smooth_keys([(0, [0, 0, 1.4]), (0.075, [0, 0, 0]), (0.15, [0, 0, 1.4])])),
                  "eye": bone(scale=1.15)}, loop=True, length=0.15)
    add("charge", {"antenna": bone(scale=f"1 + math.abs(math.sin(q.anim_time * 300)) * 0.3")}, loop=True)
    add("turret", {
        "body": bone(rot=[osc(1.5, 60), 0, 0]),
        "gun_r": bone(rot=[-6, 0, 0], pos=[0, 0, -1.5]), "gun_l": bone(rot=[-6, 0, 0], pos=[0, 0, -1.5]),
        "antenna": bone(rot=[0, "q.anim_time * 120", 0]),
    }, loop=True)
    add("craft", {"body": bone(pos=[0, osc(0.6, 400), 0], rot=[12, osc(8, 200), 0])}, loop=True)
    add("wave", {"body": bone(rot=[0, 0, osc(16, 420)])}, loop=True)
    add("scan", {"body": bone(rot=[6, osc(35, 70), 0]), "eye": bone(scale=f"1.1 + math.abs(math.sin(q.anim_time * 400)) * 0.25")}, loop=True)
    add("celebrate", {"root": bone(rot=[0, "q.anim_time * 360", 0], pos=[0, 7, 0])}, loop=True)
    add("sleep", {"body": bone(pos=[0, -1, 0]), "eye": bone(scale=0.6)}, loop=True)
    add("defeat", {"body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.8, [18, 0, 35])]), pos=smooth_keys([(0, [0, 0, 0]), (0.8, [0, -2, 0])]))},
        loop="hold", length=1.0)
    add("summon", {"root": bone(scale=smooth_keys([(0, [0.05, 0.05, 0.05]), (0.5, [1.08, 1.08, 1.08]), (0.8, [1, 1, 1])]),
                                rot=smooth_keys([(0, [0, -720, 0]), (0.8, [0, 0, 0])]))},
        loop="hold", length=1.0, particles=[{"effect": "sparkle", "locator": "ground"}])
    return A


def drone_controllers():
    m = MOVE
    move_states = {"default": {"animations": ["still"], "blend_transition": 0.3, "transitions": [
        {"dash": f"{m} == 'run' || q.ground_speed > 6"}, {"fly": f"{m} != 'none' || q.ground_speed > 0.5"}]},
        "fly": {"animations": ["fly"], "blend_transition": 0.3, "transitions": [
            {"dash": f"{m} == 'run' || q.ground_speed > 6"}, {"default": f"{m} == 'none' && q.ground_speed < 0.3"}]},
        "dash": {"animations": ["dash"], "blend_transition": 0.3, "transitions": [
            {"fly": f"{m} != 'run' && q.ground_speed < 5"}]}}
    act_states = {"default": {"blend_transition": 0.2, "transitions": []}}
    for a in DRONE_ACTIONS:
        if a == "idle":
            continue
        act_states["default"]["transitions"].append({a: f"{ACT} == '{a}'"})
        act_states[a] = {"animations": [a], "blend_transition": 0.15, "transitions": [{"default": f"{ACT} != '{a}'"}]}
    return [controller("controller.animation.lila.drone.move", move_states),
            controller("controller.animation.lila.drone.action", act_states)]
