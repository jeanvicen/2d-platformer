"""Lila's player-like animation set.

Layering (client entity `animate` order):
  1. look      — head follows her look direction (vanilla humanoid look)
  2. ctrl_move — legs/torso locomotion chosen from the `lila:move` property
                 (driven by the script motor) or native ground speed (knockback)
  3. ctrl_act  — upper-body actions chosen from the `lila:action` property
  4. life      — always on: breathing, blinking, hair/skirt secondary motion,
                 "holding an item" arm pose

Every looping gait is time based (`q.anim_time`) because the script motor
moves her with per-tick teleports, which keeps the cycle stable at any speed.
"""
from __future__ import annotations

from .anim import anim, bone, controller, keys, osc, smooth_keys

P = "animation.lila"
ACT = "q.property('lila:action')"
MOVE = "q.property('lila:move')"

# property values (keep in sync with behavior_pack/scripts/lila/anim.js)
ACTIONS = ["idle", "mine", "chop", "dig", "place", "attack", "eat", "sleep", "craft",
           "farm", "wave", "sit", "defeat", "summon", "celebrate", "think"]
MOVES = ["none", "walk", "run", "swim", "climb", "fall", "sneak"]


def _gait(speed, leg, arm, bob, lean=0.0):
    return {
        "rightLeg": bone(rot=[osc(leg, speed), 0, 0]),
        "leftLeg": bone(rot=[osc(-leg, speed), 0, 0]),
        "rightArm": bone(rot=[osc(-arm, speed), 0, osc(2, speed, base=2)]),
        "leftArm": bone(rot=[osc(arm, speed), 0, osc(2, speed, base=-2)]),
        "body": bone(rot=[lean, osc(3, speed), 0]),
        "waist": bone(pos=[0, f"math.abs(math.sin(q.anim_time * {speed})) * {bob}", 0]),
        "hair_back": bone(rot=[f"{8 + lean * 2} + math.sin(q.anim_time * {speed * 2}) * 3", 0, 0]),
        "skirt": bone(rot=[osc(3, speed * 2, base=2), 0, 0]),
    }


def lila_anims():
    A = {}

    def add(name, bones, **kw):
        n, a = anim(f"{P}.{name}", bones, **kw)
        A[name] = (n, a)

    # ------------------------------------------------------------ always-on layers
    add("look", {"head": bone(rot=["q.target_x_rotation", "q.target_y_rotation", 0])})
    add("life", {
        "body": bone(scale=[1, "1 + math.sin(q.life_time * 140) * 0.006", 1]),
        "rightArm": bone(rot=["q.is_item_equipped(0) ? -16 : 0", 0, "math.sin(q.life_time * 70) * 1.5 + 2"]),
        "leftArm": bone(rot=[0, 0, "-math.sin(q.life_time * 70) * 1.5 - 2"]),
        "eyelids": bone(scale=[1, f"(math.mod(q.life_time, 4.3) < 0.13 || {ACT} == 'sleep' || {ACT} == 'defeat') ? 1 : 0", 1]),
        "hair_back": bone(rot=["math.sin(q.life_time * 50) * 1.5", 0, "math.sin(q.life_time * 37) * 1.2"]),
        "hairpin": bone(rot=[0, 0, "math.sin(q.life_time * 90) * 2"]),
    })

    # ------------------------------------------------------------ locomotion
    add("idle", {
        "rightLeg": bone(rot=[0, 4, 1]), "leftLeg": bone(rot=[0, -4, -1]),
        "body": bone(rot=["math.sin(q.anim_time * 40) * 0.8", 0, 0]),
    })
    add("walk", _gait(420, 34, 30, 0.45))
    add("run", _gait(620, 52, 48, 0.9, lean=8))
    add("sneak", {
        **_gait(300, 22, 12, 0.2, lean=24),
        "waist": bone(pos=[0, -2.4, 0]),
        "head": bone(rot=[-12, 0, 0]),
        "rightLeg": bone(rot=[osc(22, 300, base=-12), 0, 0]), "leftLeg": bone(rot=[osc(-22, 300, base=-12), 0, 0]),
    })
    add("swim", {
        "root": bone(rot=[-72, 0, 0], pos=[0, 3, 4]),
        "head": bone(rot=[-40, 0, 0]),
        "rightArm": bone(rot=[osc(80, 260, base=-110), 0, osc(30, 260, base=40)]),
        "leftArm": bone(rot=[osc(80, 260, base=-110), 0, osc(-30, 260, base=-40)]),
        "rightLeg": bone(rot=[osc(22, 520), 0, 0]), "leftLeg": bone(rot=[osc(-22, 520), 0, 0]),
        "hair_back": bone(rot=[30, 0, 0]),
    })
    add("climb", {
        "rightArm": bone(rot=[osc(30, 360, base=-150), 0, 0]),
        "leftArm": bone(rot=[osc(-30, 360, base=-150), 0, 0]),
        "rightLeg": bone(rot=[osc(30, 360, base=-30), 0, 0]),
        "leftLeg": bone(rot=[osc(-30, 360, base=-30), 0, 0]),
        "head": bone(rot=[-25, 0, 0]),
    })
    add("fall", {
        "rightArm": bone(rot=[-20, 0, osc(8, 300, base=40)]),
        "leftArm": bone(rot=[-20, 0, osc(-8, 300, base=-40)]),
        "rightLeg": bone(rot=[-18, 0, 4]), "leftLeg": bone(rot=[10, 0, -4]),
        "hair_back": bone(rot=[-20, 0, 0]), "skirt": bone(rot=[-6, 0, 0]),
    })

    # ------------------------------------------------------------ actions (upper body)
    def swing(name, period, top, bottom, twist, extra=None):
        half = period * 0.42
        b = {
            "rightArm": bone(rot=smooth_keys([(0, [top, 8, 0]), (half, [bottom, -14, 0]), (period, [top, 8, 0])])),
            "body": bone(rot=keys([(0, [0, -twist, 0]), (half, [6, twist, 0]), (period, [0, -twist, 0])])),
            "head": bone(rot=keys([(0, [4, 0, 0]), (half, [14, 0, 0]), (period, [4, 0, 0])])),
            "leftArm": bone(rot=[-18, 0, -6]),
        }
        if extra:
            b.update(extra)
        add(name, b, loop=True, length=period, override=False)

    swing("mine", 0.36, -150, -40, 9)
    swing("chop", 0.48, -160, -50, 14, {"leftArm": bone(rot=keys([(0, [-150, -10, 0]), (0.2, [-60, 10, 0]), (0.48, [-150, -10, 0])]))})
    swing("dig", 0.4, -95, -25, 6, {"head": bone(rot=[28, 0, 0])})
    swing("attack", 0.3, -130, 10, 22, {"rightLeg": bone(rot=[-14, 0, 0]), "leftLeg": bone(rot=[12, 0, 0])})
    add("place", {
        "rightArm": bone(rot=smooth_keys([(0, [-30, 0, 0]), (0.12, [-75, -8, 0]), (0.3, [-30, 0, 0]), (0.5, [-30, 0, 0])])),
        "head": bone(rot=[16, 0, 0]),
    }, loop=True, length=0.5)
    add("eat", {
        "rightArm": bone(rot=["-78 + math.sin(q.anim_time * 1400) * 4", -26, 0]),
        "head": bone(rot=["math.sin(q.anim_time * 1400) * 4 + 6", 0, 0]),
        "leftArm": bone(rot=[-6, 0, -4]),
    }, loop=True)
    add("craft", {
        "rightArm": bone(rot=[osc(14, 520, base=-58), -10, 0]),
        "leftArm": bone(rot=[osc(-14, 520, base=-58), 10, 0]),
        "head": bone(rot=[28, osc(6, 90), 0]),
        "body": bone(rot=[6, 0, 0]),
    }, loop=True)
    add("farm", {
        "waist": bone(pos=[0, -1.2, 0]),
        "body": bone(rot=[22, 0, 0]),
        "head": bone(rot=[18, 0, 0]),
        "rightArm": bone(rot=[osc(22, 420, base=-48), osc(14, 210), 0]),
        "leftArm": bone(rot=[-26, 0, -8]),
        "rightLeg": bone(rot=[-16, 0, 0]), "leftLeg": bone(rot=[12, 0, 0]),
    }, loop=True)
    add("wave", {
        "rightArm": bone(rot=[-168, 0, osc(16, 560, base=-12)]),
        "head": bone(rot=[-4, 0, osc(4, 280)]),
    }, loop=True)
    add("think", {
        "rightArm": bone(rot=[-112, -36, 0]),
        "leftArm": bone(rot=[-52, 34, 0]),
        "head": bone(rot=[8, osc(10, 60), osc(6, 45, base=6)]),
    }, loop=True)
    add("celebrate", {
        "waist": bone(pos=[0, "math.abs(math.sin(q.anim_time * 320)) * 3", 0]),
        "rightArm": bone(rot=[-170, 0, osc(10, 640, base=-20)]),
        "leftArm": bone(rot=[-170, 0, osc(-10, 640, base=20)]),
        "head": bone(rot=[-12, 0, 0]),
    }, loop=True)
    add("sit", {
        "waist": bone(pos=[0, -10, 0]),
        "rightLeg": bone(rot=[-88, 12, 0]), "leftLeg": bone(rot=[-88, -12, 0]),
        "rightArm": bone(rot=[-34, 0, 6]), "leftArm": bone(rot=[-34, 0, -6]),
        "skirt": bone(rot=[-30, 0, 0]),
        "hair_back": bone(rot=[4, 0, 0]),
    }, loop=True, override=True)
    add("sleep", {
        "root": bone(rot=[-90, 0, 0], pos=[0, 2, 12]),
        "head": bone(rot=[0, osc(3, 30), 0]),
        "rightArm": bone(rot=[0, 0, 8]), "leftArm": bone(rot=[0, 0, -8]),
        "rightLeg": bone(rot=[0, 0, 2]), "leftLeg": bone(rot=[0, 0, -2]),
        "body": bone(scale=[1, "1 + math.sin(q.anim_time * 70) * 0.012", 1]),
        "hair_back": bone(rot=[-20, 0, 0]),
    }, loop=True, override=True)
    add("defeat", {
        "waist": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.5, [0, -6, 0]), (1.0, [0, -9, 0])])),
        "rightLeg": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-80, 10, 0]), (1.0, [-90, 10, 0])])),
        "leftLeg": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-80, -10, 0]), (1.0, [-90, -10, 0])])),
        "body": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [24, 0, 0]), (1.6, [38, 0, 6])])),
        "head": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.8, [26, 0, 0]), (1.6, [40, 0, 10])])),
        "rightArm": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-30, 0, 10]), (1.6, [-12, 0, 18])])),
        "leftArm": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.6, [-30, 0, -10]), (1.6, [-12, 0, -18])])),
    }, loop="hold", length=1.6, override=True)
    add("summon", {
        "root": bone(scale=smooth_keys([(0, [0.05, 0.05, 0.05]), (0.45, [1.08, 1.08, 1.08]), (0.7, [1, 1, 1])]),
                     rot=smooth_keys([(0, [0, -540, 0]), (0.7, [0, 0, 0])])),
        "rightArm": bone(rot=smooth_keys([(0, [0, 0, 60]), (0.5, [-20, 0, 70]), (1.0, [0, 0, 0])])),
        "leftArm": bone(rot=smooth_keys([(0, [0, 0, -60]), (0.5, [-20, 0, -70]), (1.0, [0, 0, 0])])),
        "hair_back": bone(rot=smooth_keys([(0, [-50, 0, 0]), (0.7, [10, 0, 0]), (1.0, [0, 0, 0])])),
    }, loop="hold", length=1.0, particles=[{"effect": "sparkle", "locator": "ground"}])
    return A


def move_controller():
    m = MOVE
    native = "q.ground_speed > 0.4"
    states = {"default": {"animations": ["idle"], "blend_transition": 0.25, "transitions": []}}
    for mv in ("walk", "run", "swim", "climb", "fall", "sneak"):
        states["default"]["transitions"].append({mv: f"{m} == '{mv}'"})
        states[mv] = {"animations": [mv], "blend_transition": 0.2,
                      "transitions": [{"default": f"{m} != '{mv}'"}]}
    # corpo andando de verdade (física) mesmo se a propriedade ainda não sincronizou
    states["default"]["transitions"].append({"native": f"{m} == 'none' && {native}"})
    states["native"] = {"animations": ["walk"], "blend_transition": 0.25,
                        "transitions": [{"default": f"{m} != 'none' || q.ground_speed < 0.25"}]}
    return controller("controller.animation.lila.move", states)


def action_controller():
    a = ACT
    states = {"default": {"blend_transition": 0.2, "transitions": []}}
    for act in ACTIONS:
        if act == "idle":
            continue
        states["default"]["transitions"].append({act: f"{a} == '{act}'"})
        blend = 0.12 if act in ("mine", "chop", "dig", "attack", "place") else 0.3
        states[act] = {"animations": [act], "blend_transition": blend,
                       "transitions": [{"default": f"{a} != '{act}'"}]}
    return controller("controller.animation.lila.action", states)
