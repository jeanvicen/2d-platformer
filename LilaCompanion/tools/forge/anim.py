"""Helpers to author Bedrock animations as Molang expressions.

Continuous Molang expressions (sin/cos of time or distance) give perfectly
smooth motion at any frame rate, which is cheaper and more fluid on mobile
than dense keyframe tracks.
"""
from __future__ import annotations


def r(v):
    if isinstance(v, (int, float)):
        return round(float(v), 3)
    return v


def osc(amp, speed=90.0, phase=0.0, base=0.0, t="q.anim_time"):
    """base + sin(t*speed + phase) * amp   (speed in degrees per second)."""
    if amp == 0:
        return r(base)
    b = f"{r(base)} + " if base else ""
    ph = f" + {r(phase)}" if phase else ""
    return f"{b}math.sin({t} * {r(speed)}{ph}) * {r(amp)}"


def walk(amp, freq=38.17, phase=0.0, base=0.0):
    """Vanilla-style gait driven by distance moved (feet never slide)."""
    ph = f" + {r(phase)}" if phase else ""
    b = f"{r(base)} + " if base else ""
    return f"{b}math.cos(q.modified_distance_moved * {r(freq)}{ph}) * {r(amp)} * math.min(1.0, q.modified_move_speed)"


def anim(name, bones, loop=True, length=None, blend=None, override=False, particles=None, sounds=None, anim_time_update=None):
    a = {"bones": bones}
    if loop is True:
        a["loop"] = True
    elif loop == "hold":
        a["loop"] = "hold_on_last_frame"
    if length:
        a["animation_length"] = length
    if override:
        a["override_previous_animation"] = True
    if particles:
        a["particle_effects"] = particles
    if sounds:
        a["sound_effects"] = sounds
    if anim_time_update:
        a["anim_time_update"] = anim_time_update
    return name, a


def keys(pairs):
    """{time: value} keyframes with linear interpolation."""
    return {str(round(t, 3)): (list(map(r, v)) if isinstance(v, (list, tuple)) else r(v)) for t, v in pairs}


def smooth_keys(pairs):
    """Keyframes using catmull-rom smoothing for organic motion."""
    out = {}
    for t, v in pairs:
        out[str(round(t, 3))] = {"post": list(map(r, v)) if isinstance(v, (list, tuple)) else r(v), "lerp_mode": "catmullrom"}
    return out


def bone(rot=None, pos=None, scale=None, relative=False):
    b = {}
    if rot is not None:
        b["rotation"] = [r(x) for x in rot] if isinstance(rot, (list, tuple)) else rot
    if pos is not None:
        b["position"] = [r(x) for x in pos] if isinstance(pos, (list, tuple)) else pos
    if scale is not None:
        b["scale"] = [r(x) for x in scale] if isinstance(scale, (list, tuple)) else r(scale)
    if relative:
        b["relative_to"] = {"rotation": "entity"}
    return b


def file(prefix_anims):
    return {"format_version": "1.10.0", "animations": dict(prefix_anims)}


def controller(name, states, initial="default"):
    return name, {"initial_state": initial, "states": states}


def controllers_file(ctrls):
    return {"format_version": "1.10.0", "animation_controllers": dict(ctrls)}
