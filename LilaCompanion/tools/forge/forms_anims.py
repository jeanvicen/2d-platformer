"""Animações das formas do DR-0N e do robô-soldado (Molang contínuo = suave em qualquer FPS).

Variáveis calculadas em pre_animation (cliente, a cada quadro):
  v.form  forma atual (0 drone … 15 caça furtivo)  v.ride capota recolhida (alguém dentro)      v.tf   segundos desde a última transformação
  v.wheel ângulo acumulado das rodas              v.lean inclinação suavizada pela curva
  v.aim   mira (graus) da torre/cabine            v.gspin giro da metralhadora rotativa
"""
from __future__ import annotations

from .anim import anim, bone, controller, keys, osc, r, smooth_keys, walk


def cwalk(amp, freq, phase=0.0, base=0.0):
    """Passada do colosso pela distância andada (script move por impulso, então calculamos v.cwd)."""
    ph = f" + {r(phase)}" if phase else ""
    b = f"{r(base)} + " if base else ""
    return f"{b}math.cos(v.cwd * {r(freq)}{ph}) * {r(amp)} * v.cws"

P = "animation.lila.form"
ACT = "q.property('lila:action')"
FORM_IDS = {"drone": 0, "heli": 1, "car": 2, "excavator": 3, "tank": 4, "jet": 5, "moto": 6, "colossus": 7, "turret": 8,
            "swarm": 9, "ship": 10, "ufo": 11, "sub": 12, "boat": 13, "truck": 14, "stealth": 15}
# capota (vidro/teto) recolhe quando alguém está dentro: quem pilota vê tudo
CANOPY = "1 - v.ride * 0.98"

INITIALIZE = ["v.svf = 0; v.svl = 0; v.svu = 0; v.pvf = 0; v.pvl = 0; v.pvu = 0; v.afw = 0; v.alf = 0; v.aup = 0; v.pipn = 0; v.pish = 0; v.chp = 0; v.chpw = 0; v.chr = 0; v.chrw = 0; v.tz = 0; v.tzw = 0; v.tx = 0; v.txw = 0; v.ty = 0; v.tyw = 0; v.hz = 0; v.hzw = 0; v.hx = 0; v.hxw = 0; v.hy = 0; v.hyw = 0; v.rz = 0; v.rzw = 0; v.rx = 0; v.rxw = 0; v.ry = 0; v.ryw = 0; v.lz = 0; v.lzw = 0; v.lx = 0; v.lxw = 0; v.ly = 0; v.lyw = 0; v.hlx = 0; v.hly = 0; v.po = q.property('lila:off') ? 1 : 0; v.ot = 9; v.bt = 9; v.dsp = 0; v.ride = 0; v.dtilt = 0; v.htilt = 0; v.jpitch = 0; v.aims = 0; v.pits = 0; v.cwd = 0; v.cws = 0; v.wheel = 0; v.pby = q.body_y_rotation; v.lean = 0; v.tf = 9; v.pf = q.property('lila:form'); v.gspin = 0; v.gear = 1;"]
PRE_ANIMATION = [
    "v.form = q.property('lila:form');",
    "v.ride = math.lerp(v.ride, q.has_rider ? 1 : 0, 0.15);",
    # robô desligado/ligado: tempo desde que desligou (v.ot) / ligou (v.bt) e quanto cada parte está "no chão"
    "v.offp = q.property('lila:off') ? 1 : 0;",
    "v.ot = (v.offp > 0.5) ? ((v.po > 0.5) ? v.ot + q.delta_time : 0) : v.ot;",
    "v.bt = (v.offp < 0.5) ? ((v.po < 0.5) ? v.bt + q.delta_time : 0) : v.bt;",
    "v.po = v.offp;",
    "v.kh = (v.offp > 0.5) ? math.clamp(v.ot * 2.6, 0, 1) : 1 - math.clamp((v.bt - 0.95) * 1.7, 0, 1);",
    "v.kr = (v.offp > 0.5) ? math.clamp((v.ot - 0.15) * 2.6, 0, 1) : 1 - math.clamp((v.bt - 0.45) * 1.8, 0, 1);",
    "v.kl = (v.offp > 0.5) ? math.clamp((v.ot - 0.25) * 2.6, 0, 1) : 1 - math.clamp((v.bt - 0.65) * 1.8, 0, 1);",
    "v.kt = (v.offp > 0.5) ? math.clamp((v.ot - 0.35) * 2.6, 0, 1) : 1 - math.clamp((v.bt - 0.05) * 1.6, 0, 1);",
    "v.kd = (v.offp > 0.5) ? math.clamp((v.ot - 0.1) * 2.0, 0, 1) : 1 - math.clamp((v.bt - 0.2) * 1.1, 0, 1);",
    "v.kg = (v.offp > 0.5) ? math.clamp(v.ot * 6, 0, 1) : 1 - math.clamp((v.bt - 1.45) * 3, 0, 1);",
    "v.dsp = v.dsp + math.min(q.delta_time, 0.1) * 45 * (1 - v.kd);",
    "v.hlx = v.hlx + (math.clamp(q.target_x_rotation, -25, 25) - v.hlx) * math.min(1, q.delta_time * 6);",
    "v.hly = v.hly + (math.clamp(q.target_y_rotation, -35, 35) - v.hly) * math.min(1, q.delta_time * 6);",
    # física (2.2): velocidade/aceleração no referencial do corpo + molas com amortecimento (peças com inércia)
    "v.pdt = math.clamp(q.delta_time, 0.001, 0.05);",
    "v.byr = q.body_y_rotation;",
    "v.vfw = math.clamp((math.cos(v.byr) * q.position_delta(2) - math.sin(v.byr) * q.position_delta(0)) / v.pdt, -40, 40);",
    "v.vlf = math.clamp((math.cos(v.byr) * q.position_delta(0) + math.sin(v.byr) * q.position_delta(2)) / v.pdt, -40, 40);",
    "v.vup = math.clamp(q.position_delta(1) / v.pdt, -40, 40);",
    "v.sk = math.min(1, v.pdt * 15);",
    "v.svf = v.svf + (v.vfw - v.svf) * v.sk; v.svl = v.svl + (v.vlf - v.svl) * v.sk; v.svu = v.svu + (v.vup - v.svu) * v.sk;",
    "v.ak = math.min(1, v.pdt * 12);",
    "v.afw = math.clamp(v.afw + ((v.svf - v.pvf) / v.pdt - v.afw) * v.ak, -60, 60); v.pvf = v.svf;",
    "v.alf = math.clamp(v.alf + ((v.svl - v.pvl) / v.pdt - v.alf) * v.ak, -60, 60); v.pvl = v.svl;",
    "v.aup = math.clamp(v.aup + ((v.svu - v.pvu) / v.pdt - v.aup) * v.ak, -60, 60); v.pvu = v.svu;",
    "v.yr = math.clamp(v.dy / v.pdt, -360, 360);",
    "v.acs = math.clamp(v.alf - v.svf * v.yr * 0.01745, -60, 60);",
    "v.ipn = (q.property('lila:action') == 'punch') ? 1 : 0; v.tzw = v.tzw + ((v.ipn > v.pipn) ? -70 : 0); v.hzw = v.hzw + ((v.ipn > v.pipn) ? -45 : 0); v.pipn = v.ipn;",
    "v.ish = (q.property('lila:action') == 'shoot') ? 1 : 0; v.tzw = v.tzw + ((v.ish > v.pish) ? 40 : 0); v.pish = v.ish;",
    "v.tzw = v.tzw + (90 * ((0.06 * v.afw) - v.tz) - 13 * v.tzw) * v.pdt;",
    "v.tz = math.clamp(v.tz + v.tzw * v.pdt, -3, 3);",
    "v.txw = v.txw + (90 * ((-0.06 * v.acs) - v.tx) - 13 * v.txw) * v.pdt;",
    "v.tx = math.clamp(v.tx + v.txw * v.pdt, -3, 3);",
    "v.tyw = v.tyw + (90 * ((-0.04 * v.aup) - v.ty) - 13 * v.tyw) * v.pdt;",
    "v.ty = math.clamp(v.ty + v.tyw * v.pdt, -3, 3);",
    "v.hzw = v.hzw + (70 * ((0.12 * v.afw) - v.hz) - 8 * v.hzw) * v.pdt;",
    "v.hz = math.clamp(v.hz + v.hzw * v.pdt, -5, 5);",
    "v.hxw = v.hxw + (70 * ((-0.12 * v.acs) - v.hx) - 8 * v.hxw) * v.pdt;",
    "v.hx = math.clamp(v.hx + v.hxw * v.pdt, -5, 5);",
    "v.hyw = v.hyw + (70 * ((-0.08 * v.aup) - v.hy) - 8 * v.hyw) * v.pdt;",
    "v.hy = math.clamp(v.hy + v.hyw * v.pdt, -5, 5);",
    "v.rzw = v.rzw + (52 * ((0.2 * v.afw) - v.rz) - 6 * v.rzw) * v.pdt;",
    "v.rz = math.clamp(v.rz + v.rzw * v.pdt, -7, 7);",
    "v.rxw = v.rxw + (52 * ((-0.2 * v.acs) - v.rx) - 6 * v.rxw) * v.pdt;",
    "v.rx = math.clamp(v.rx + v.rxw * v.pdt, -7, 7);",
    "v.ryw = v.ryw + (52 * ((-0.1 * v.aup) - v.ry) - 6 * v.ryw) * v.pdt;",
    "v.ry = math.clamp(v.ry + v.ryw * v.pdt, -7, 7);",
    "v.lzw = v.lzw + (48 * ((0.2 * v.afw) - v.lz) - 6 * v.lzw) * v.pdt;",
    "v.lz = math.clamp(v.lz + v.lzw * v.pdt, -7, 7);",
    "v.lxw = v.lxw + (48 * ((-0.2 * v.acs) - v.lx) - 6 * v.lxw) * v.pdt;",
    "v.lx = math.clamp(v.lx + v.lxw * v.pdt, -7, 7);",
    "v.lyw = v.lyw + (48 * ((-0.1 * v.aup) - v.ly) - 6 * v.lyw) * v.pdt;",
    "v.ly = math.clamp(v.ly + v.lyw * v.pdt, -7, 7);",
    "v.chpw = v.chpw + (45 * ((-v.afw * 0.35) - v.chp) - 7 * v.chpw) * v.pdt;",
    "v.chp = math.clamp(v.chp + v.chpw * v.pdt, -10, 10);",
    "v.chrw = v.chrw + (40 * ((v.acs * 0.3) - v.chr) - 6 * v.chrw) * v.pdt;",
    "v.chr = math.clamp(v.chr + v.chrw * v.pdt, -10, 10);",
    "v.tf = (v.form != v.pf) ? 0 : v.tf + q.delta_time; v.pf = v.form;",
    "v.dir = (q.property('lila:move') == 'sneak') ? -1 : 1;",
    "v.wheel = v.wheel + q.ground_speed * math.min(q.delta_time, 0.1) * 160 * v.dir;",
    "v.dy = math.mod(q.body_y_rotation - v.pby + 540, 360) - 180; v.pby = q.body_y_rotation;",
    "v.lean = math.lerp(v.lean, math.clamp(v.dy / math.max(q.delta_time, 0.016) * 0.12, -30, 30), 0.08);",
    "v.aim = q.property('lila:aim');",
    f"v.gspin = v.gspin + math.min(q.delta_time, 0.1) * (({ACT} == 'shoot') ? 2400 : 90);",
    "v.gear = math.lerp(v.gear, q.is_on_ground ? 1 : 0, 0.06);",
    "v.cwd = v.cwd + q.ground_speed * math.min(q.delta_time, 0.1) / 3.4; v.cws = math.lerp(v.cws, math.min(1, q.ground_speed / 2.5), 0.12);",
    # suavizações: inclinação do drone/heli/jato e mira das torres giram macio (sem estalar)
    "v.dtilt = math.lerp(v.dtilt, math.clamp(q.ground_speed * 2.4, 0, 24), 0.08);",
    "v.htilt = math.lerp(v.htilt, math.clamp(q.ground_speed * 1.6, 0, 18), 0.08);",
    "v.jpitch = math.lerp(v.jpitch, math.clamp(-q.vertical_speed * 2.2, -28, 28), 0.1);",
    "v.aims = v.aims + (math.mod(v.aim - v.aims + 540, 360) - 180) * 0.2;",
    "v.pits = math.lerp(v.pits, q.property('lila:pitch'), 0.2);",
]


def form_anims():
    A = {}

    def add(name, bones, **kw):
        n, a = anim(f"{P}.{name}", bones, **kw)
        A[name] = (n, a)

    # ---------------- transformação: a forma nova "monta" girando e crescendo
    add("intro", {"root": bone(
        scale="v.tf < 1.0 ? (math.min(1, 0.15 + v.tf * 1.9) + math.sin(math.min(v.tf, 1) * 540) * 0.07 * (1 - v.tf)) : 1",
        rot=[0, "v.tf < 0.7 ? (1 - v.tf / 0.7) * 540 : 0", 0])})
    add("intro_colossus", {"root": bone(
        scale="v.tf < 2.2 ? math.min(1, 0.3 + v.tf * 0.4) : 1",
        pos=[0, "v.tf < 2.2 ? -(1 - v.tf / 2.2) * 40 : 0", 0])})

    # ---------------- helicóptero
    add("heli", {
        "rotor_main": bone(rot=[0, "q.anim_time * 1620", 0]),
        "rotor_tail": bone(rot=["q.anim_time * 2200", 0, 0]),
        "body": bone(rot=["v.htilt - v.chp * 1.4", 0, "-v.lean * 0.6 + v.chr * 0.6"]),
        "root": bone(pos=[0, "q.is_on_ground ? 0 : math.sin(q.anim_time * 100) * 0.5", 0]),
        "canopy": bone(scale=CANOPY),
    })
    add("heli_fire", {"body": bone(pos=[0, 0, osc(0.4, 2400)])}, loop=True)

    # ---------------- carro
    spin = "v.wheel"
    add("car", {
        "wheel_fl": bone(rot=[spin, "math.clamp(-v.lean * 1.4, -28, 28)", 0]),
        "wheel_fr": bone(rot=[spin, "math.clamp(-v.lean * 1.4, -28, 28)", 0]),
        "wheel_rl": bone(rot=[spin, 0, 0]),
        "wheel_rr": bone(rot=[spin, 0, 0]),
        "body": bone(rot=["math.sin(q.anim_time * 900) * 0.25 * math.min(1, q.ground_speed / 4) + v.chp", 0, "v.lean * 0.18 + v.chr * 0.5"],
                     pos=[0, "math.sin(q.anim_time * 1100) * 0.08", 0]),
        "canopy": bone(scale=CANOPY),
    })

    # ---------------- escavadeira
    add("excavator", {
        "cab": bone(rot=[0, "v.aims", 0]),
        "boom": bone(rot=[osc(1.2, 60), 0, 0]),
        "tracks": bone(pos=[0, "math.sin(q.anim_time * 1400) * 0.12 * math.min(1, q.ground_speed)", 0]),
        "canopy": bone(scale=CANOPY),
    })
    add("exc_dig", {
        "boom": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [22, 0, 0]), (0.6, [10, 0, 0]), (0.9, [-8, 0, 0]), (1.2, [0, 0, 0])])),
        "stick": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-30, 0, 0]), (0.6, [20, 0, 0]), (0.9, [10, 0, 0]), (1.2, [0, 0, 0])])),
        "bucket": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-40, 0, 0]), (0.6, [35, 0, 0]), (0.9, [45, 0, 0]), (1.2, [0, 0, 0])])),
    }, loop=True, length=1.2)

    # ---------------- tanque
    add("tank", {
        "turret": bone(rot=[0, "v.aims", 0]),
        "hull": bone(rot=["math.sin(q.anim_time * 700) * 0.3 * math.min(1, q.ground_speed / 3) + v.chp * 0.5", 0, "v.lean * 0.08 + v.chr * 0.25"]),
    })
    add("tank_fire", {
        "barrel": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.05, [0, 0, 6]), (0.6, [0, 0, 0])])),
        "turret": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.05, [-3, 0, 0]), (0.5, [0, 0, 0])])),
        "hull": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.06, [-2, 0, 0]), (0.5, [0, 0, 0])])),
    }, loop="hold", length=0.7)

    # ---------------- jato
    add("jet", {
        "flame": bone(scale=["0.5 + math.min(1, q.ground_speed / 18) * 0.9 + math.sin(q.anim_time * 2600) * 0.06"] * 3),
        "gear": bone(scale="v.gear", pos=[0, "(1 - v.gear) * 4", 0]),
        "body": bone(rot=["v.jpitch", 0, "v.lean * 1.4"]),
        "canopy": bone(scale=CANOPY),
    })
    add("jet_missile", {"body": bone(pos=[0, 0, osc(0.6, 1800)])}, loop=True)

    # ---------------- moto
    add("moto", {
        "wheel_f": bone(rot=["v.wheel * 1.4", 0, 0]),
        "wheel_r": bone(rot=["v.wheel * 1.4", 0, 0]),
        "fork": bone(rot=[0, "math.clamp(-v.lean * 0.9, -22, 22)", 0]),
        "root": bone(rot=[0, 0, "v.lean * 1.1"]),
        "body": bone(rot=["-math.clamp(q.ground_speed * 0.25, 0, 4) + v.chp * 0.6", 0, 0]),
    })

    # ---------------- torreta gigante
    add("turret_g", {
        "yaw": bone(rot=[0, "v.aims", 0]),
        "pitch": bone(rot=["-v.pits", 0, 0]),
        "gatling": bone(rot=[0, 0, "v.gspin"]),
        "radar": bone(rot=[0, "q.anim_time * 140", 0]),
        "root": bone(scale="1 + (v.tf < 0.6 ? math.sin(v.tf * 300) * 0.04 : 0)"),
    })
    add("turret_fire", {"gatling": bone(pos=[0, 0, osc(0.7, 3000, base=0.7)]),
                        "yaw": bone(pos=[osc(0.15, 2600), 0, 0])}, loop=True)
    add("turret_missile", {
        "pod_l": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.05, [0, 0, 3]), (0.5, [0, 0, 0])])),
        "pod_r": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.15, [0, 0, 3]), (0.6, [0, 0, 0])])),
    }, loop="hold", length=0.7)

    # ---------------- colosso (robô humanoide; a cabeça fica firme: o piloto vai em cima dela)
    F = 60.0
    knee = lambda ph: f"math.max(0, math.sin(v.cwd * {F} + {ph})) * 38 * v.cws + 3"
    add("col_idle", {
        "torso": bone(rot=[osc(0.8, 45, base=2), 0, 0]),
        "core": bone(scale=["1", "1 + math.sin(q.anim_time * 160) * 0.08", "1"]),
        "visor": bone(scale=["1 + math.sin(q.anim_time * 90) * 0.03", "1", "1"]),
        "arm_l": bone(rot=[osc(2, 45, base=-4), 0, osc(1, 45, base=-6)]),
        "arm_r": bone(rot=[osc(2, 45, phase=40, base=-4), 0, osc(1, 45, phase=40, base=6)]),
        "forearm_l": bone(rot=[-14, 0, 0]), "forearm_r": bone(rot=[-14, 0, 0]),
        "jets": bone(scale=["1", "q.is_on_ground ? 0.25 : 1.5 + math.sin(q.anim_time * 2600) * 0.2", "1"]),
        "thigh_l": bone(rot=["q.is_on_ground ? 0 : -18", 0, 0]), "shin_l": bone(rot=["q.is_on_ground ? 0 : 30", 0, 0]),
        "thigh_r": bone(rot=["q.is_on_ground ? 0 : -6", 0, 0]), "shin_r": bone(rot=["q.is_on_ground ? 0 : 14", 0, 0]),
    })
    add("col_walk", {
        "thigh_l": bone(rot=[cwalk(24, F), 0, 0]),
        "thigh_r": bone(rot=[cwalk(24, F, phase=180), 0, 0]),
        "shin_l": bone(rot=[knee(0), 0, 0]),
        "shin_r": bone(rot=[knee(3.14159), 0, 0]),
        "foot_l": bone(rot=[cwalk(-8, F, phase=60), 0, 0]),
        "foot_r": bone(rot=[cwalk(-8, F, phase=240), 0, 0]),
        "hips": bone(pos=[0, f"math.abs(math.cos(v.cwd * {F})) * 0.8 * v.cws", 0], rot=[0, cwalk(3, F), 0]),
        "torso": bone(rot=[0, cwalk(-3, F), cwalk(-1.5, F)]),
        "arm_l": bone(rot=[cwalk(-20, F), 0, 0]),
        "arm_r": bone(rot=[cwalk(-20, F, phase=180), 0, 0]),
    })
    add("col_punch", {
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.22, [30, 0, 12]), (0.42, [-95, 0, -6]), (0.9, [0, 0, 0])])),
        "forearm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.22, [-85, 0, 0]), (0.42, [-4, 0, 0]), (0.9, [0, 0, 0])])),
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.42, [-35, 0, -10]), (0.9, [0, 0, 0])])),
        "forearm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.42, [-70, 0, 0]), (0.9, [0, 0, 0])])),
        "torso": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.22, [0, 14, 0]), (0.42, [5, -16, 0]), (0.9, [0, 0, 0])])),
    }, loop="hold", length=0.9)
    add("col_stomp", {   # agacha, salta com os propulsores e cai com tudo
        "hips": bone(pos=smooth_keys([(0, [0, 0, 0]), (0.3, [0, -8, 0]), (0.55, [0, 2, 0]), (0.9, [0, -6, 0]), (1.2, [0, 0, 0])])),
        "thigh_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-40, 0, 0]), (0.55, [-10, 0, 0]), (0.9, [-35, 0, 0]), (1.2, [0, 0, 0])])),
        "thigh_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-40, 0, 0]), (0.55, [-10, 0, 0]), (0.9, [-35, 0, 0]), (1.2, [0, 0, 0])])),
        "shin_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [62, 0, 0]), (0.55, [12, 0, 0]), (0.9, [55, 0, 0]), (1.2, [0, 0, 0])])),
        "shin_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [62, 0, 0]), (0.55, [12, 0, 0]), (0.9, [55, 0, 0]), (1.2, [0, 0, 0])])),
        "foot_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-22, 0, 0]), (0.9, [-20, 0, 0]), (1.2, [0, 0, 0])])),
        "foot_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.3, [-22, 0, 0]), (0.9, [-20, 0, 0]), (1.2, [0, 0, 0])])),
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-50, 0, -30]), (0.9, [20, 0, -20]), (1.2, [0, 0, 0])])),
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-50, 0, 30]), (0.9, [20, 0, 20]), (1.2, [0, 0, 0])])),
        "jets": bone(scale=smooth_keys([(0, [1, 0.3, 1]), (0.35, [1.2, 2.2, 1.2]), (0.8, [1, 1.2, 1]), (1.2, [1, 0.3, 1])])),
    }, loop="hold", length=1.2)
    add("col_beam", {   # raio pelo visor: postura firme, braços em guarda, reator no máximo
        "visor": bone(scale=["1 + math.min(1, q.anim_time * 2) * 0.35", "1 + math.min(1, q.anim_time * 2) * 0.6 + math.sin(q.anim_time * 2200) * 0.1", "1"]),
        "core": bone(scale="1 + math.min(1, q.anim_time) * 0.3"),
        "torso": bone(rot=["math.min(1, q.anim_time * 2) * 4 + math.sin(q.anim_time * 2400) * 0.4", 0, 0]),
        "arm_l": bone(rot=[-45, 0, -20]), "arm_r": bone(rot=[-45, 0, 20]),
        "forearm_l": bone(rot=[-70, 0, 0]), "forearm_r": bone(rot=[-70, 0, 0]),
        "thigh_l": bone(rot=[-12, 0, -4]), "thigh_r": bone(rot=[8, 0, 4]), "shin_l": bone(rot=[16, 0, 0]),
    }, loop=True)
    add("col_roar", {   # pose de poder: braços pra cima, propulsores e reator acesos
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-160, 0, -25]), (1.6, [-155, 0, -30]), (2.2, [0, 0, 0])])),
        "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-160, 0, 25]), (1.6, [-155, 0, 30]), (2.2, [0, 0, 0])])),
        "forearm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-30, 0, 0]), (2.2, [0, 0, 0])])),
        "forearm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.5, [-30, 0, 0]), (2.2, [0, 0, 0])])),
        "torso": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.4, [-8, 0, 0]), (1.6, [-6, 0, 0]), (2.2, [0, 0, 0])])),
        "core": bone(scale=smooth_keys([(0, [1, 1, 1]), (0.5, [1.4, 1.4, 1.4]), (1.6, [1.4, 1.4, 1.4]), (2.2, [1, 1, 1])])),
        "jets": bone(scale=smooth_keys([(0, [1, 0.3, 1]), (0.5, [1.3, 2.4, 1.3]), (1.6, [1.3, 2.2, 1.3]), (2.2, [1, 0.3, 1])])),
    }, loop="hold", length=2.2)
    add("col_wave", {"arm_l": bone(rot=[-160, 0, osc(20, 360, base=-15)]), "forearm_l": bone(rot=[osc(20, 360, base=-25), 0, 0])}, loop=True)
    add("col_defeat", {   # cai de joelhos
        "hips": bone(pos=smooth_keys([(0, [0, 0, 0]), (1.4, [0, -22, 0])])),
        "thigh_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.4, [-80, 0, 0])])), "shin_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.4, [90, 0, 0])])),
        "thigh_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.4, [-10, 0, 0])])), "shin_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.4, [90, 0, 0])])),
        "torso": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.4, [20, 0, 0])])),
        "arm_l": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.4, [-20, 0, -10])])), "arm_r": bone(rot=smooth_keys([(0, [0, 0, 0]), (1.4, [-20, 0, 10])])),
    }, loop="hold", length=1.5)

    # ---------------- formas novas (2.2)
    add("ship", {
        "thrust": bone(scale=["1", "1", "0.6 + math.min(1, q.ground_speed / 14) * 1.2 + math.sin(q.anim_time * 2600) * 0.08"]),
        "gear": bone(scale="v.gear", pos=[0, "(1 - v.gear) * 4", 0]),
        "body": bone(rot=["v.jpitch * 0.8 - v.chp * 0.6", 0, "v.lean * 1.2 + v.chr * 0.5"], pos=[0, "q.is_on_ground ? 0 : math.sin(q.anim_time * 80) * 0.4", 0]),
        "canopy": bone(scale=CANOPY),
    })
    add("ship_fire", {"body": bone(pos=[0, 0, osc(0.5, 2000)])}, loop=True)
    add("ufo", {
        "ring": bone(rot=[0, "q.anim_time * 220", 0]),
        "body": bone(rot=["v.htilt * 0.5 - v.chp * 0.8", 0, "-v.lean * 0.4 + v.chr * 0.8"], pos=[0, "q.is_on_ground ? 0 : math.sin(q.anim_time * 70) * 0.8", 0]),
        "gear": bone(scale="v.gear", pos=[0, "(1 - v.gear) * 3", 0]),
        "canopy": bone(scale=CANOPY),
    })
    add("ufo_fire", {"ring": bone(rot=[0, "q.anim_time * 1400", 0])}, loop=True)
    add("sub", {
        "prop": bone(rot=[0, 0, "v.wheel * 3"]),
        "body": bone(rot=["v.jpitch * 0.6", 0, "v.lean * 0.3"], pos=[0, "math.sin(q.anim_time * 50) * 0.3", 0]),
        "canopy": bone(scale=CANOPY),
    })
    add("sub_fire", {"body": bone(pos=[0, 0, osc(0.6, 1600)])}, loop=True)
    add("boat", {
        "prop": bone(rot=[0, 0, "v.wheel * 4"]),
        "motor": bone(rot=[0, "math.clamp(v.lean * 1.2, -25, 25)", 0]),
        "body": bone(rot=["-math.clamp(q.ground_speed * 0.5, 0, 8) + math.sin(q.anim_time * 160) * 0.8 + v.chp * 1.2", 0, "v.lean * 0.5 + math.sin(q.anim_time * 110) * 1.2 + v.chr * 0.6"]),
    })
    add("truck", {
        "wheel_fl": bone(rot=["v.wheel * 0.7", "math.clamp(-v.lean * 1.4, -28, 28)", 0]),
        "wheel_fr": bone(rot=["v.wheel * 0.7", "math.clamp(-v.lean * 1.4, -28, 28)", 0]),
        "wheel_rl": bone(rot=["v.wheel * 0.7", 0, 0]),
        "wheel_rr": bone(rot=["v.wheel * 0.7", 0, 0]),
        "body": bone(rot=["math.sin(q.anim_time * 500) * 0.6 * math.min(1, q.ground_speed / 4) + v.chp * 1.2", 0, "v.lean * 0.3 + v.chr"],
                     pos=[0, "math.sin(q.anim_time * 700) * 0.4 * math.min(1, q.ground_speed / 4)", 0]),
        "canopy": bone(scale=CANOPY),
    })
    add("stealth", {
        "flame": bone(scale=["0.5 + math.min(1, q.ground_speed / 24) * 1.1 + math.sin(q.anim_time * 2600) * 0.06"] * 3),
        "gear": bone(scale="v.gear", pos=[0, "(1 - v.gear) * 4", 0]),
        "body": bone(rot=["v.jpitch", 0, "v.lean * 1.6"]),
        "canopy": bone(scale=CANOPY),
    })
    add("swarm", {
        "orbit0": bone(rot=["q.anim_time * 300", "q.anim_time * 140", 0]),
        "orbit1": bone(rot=[0, "q.anim_time * -260", "q.anim_time * 120"]),
        "orbit2": bone(rot=["q.anim_time * 90", "q.anim_time * 200", "q.anim_time * -60"]),
        "core": bone(pos=[0, osc(1.2, 120), 0], scale="1 + math.sin(q.anim_time * 400) * 0.12"),
    })
    add("swarm_fire", {"orbit0": bone(scale=osc(0.4, 900, base=1.3)), "orbit1": bone(scale=osc(0.4, 900, phase=90, base=1.3)),
                       "orbit2": bone(scale=osc(0.4, 900, phase=180, base=1.3))}, loop=True)
    return A


def form_controllers():
    """Ações das formas (soco, pisão, raio, rugido, tiro de canhão, mísseis…)."""
    by_action = {
        "work": [("col_punch", 7), ("exc_dig", 3)],
        "place": [("col_stomp", 7)],
        "shoot": [("tank_fire", 4), ("turret_fire", 8), ("heli_fire", 1), ("ship_fire", 10), ("ufo_fire", 11), ("sub_fire", 12),
                  ("swarm_fire", 9)],
        "charge": [("col_beam", 7), ("turret_missile", 8), ("jet_missile", "5 || v.form == 15"), ("ufo_fire", 11), ("swarm_fire", 9)],
        "celebrate": [("col_roar", 7)],
        "wave": [("col_wave", 7)],
        "defeat": [("col_defeat", 7)],
    }
    states = {"default": {"blend_transition": 0.15, "transitions": []}}
    for act, lst in by_action.items():
        states["default"]["transitions"].append({act: f"{ACT} == '{act}' && v.form != 0"})
        states[act] = {"animations": [{n: f"v.form == {f}"} for n, f in lst], "blend_transition": 0.2,
                       "transitions": [{"default": f"{ACT} != '{act}' || v.form == 0"}]}
    return [controller("controller.animation.lila.form.action", states)]


# ================================================================= robô-soldado
R = "animation.lila.robot"


def robot_anims():
    A = {}

    def add(name, bones, **kw):
        n, a = anim(f"{R}.{name}", bones, **kw)
        A[name] = (n, a)

    f = 38.17
    add("look", {"head": bone(rot=["q.target_x_rotation", "q.target_y_rotation", 0])})
    add("idle", {"body": bone(rot=[osc(1, 60), 0, 0], pos=[0, osc(0.15, 60), 0]), "rightArm": bone(rot=[osc(2, 60, base=-4), 0, 4]),
                 "leftArm": bone(rot=[osc(2, 60, phase=90, base=-4), 0, -4]), "jet": bone(scale=0.4),
                 "head": bone(rot=[0, osc(8, 25), 0])})
    add("walk", {
        "rightLeg": bone(rot=[walk(40, f), 0, 0]), "leftLeg": bone(rot=[walk(40, f, phase=180), 0, 0]),
        "rightArm": bone(rot=[walk(30, f, phase=180), 0, 0]), "leftArm": bone(rot=[walk(30, f), 0, 0]),
        "waist": bone(pos=[0, f"math.abs(math.cos(q.modified_distance_moved * {f})) * 0.6 * math.min(1, q.modified_move_speed)", 0]),
    })
    add("fly", {
        "rightLeg": bone(rot=[18, 0, 3]), "leftLeg": bone(rot=[12, 0, -3]),
        "rightArm": bone(rot=[25, 0, 10]), "leftArm": bone(rot=[25, 0, -10]),
        "body": bone(rot=[12, 0, 0]),
        "jet": bone(scale=["1", "1.4 + math.sin(q.anim_time * 2400) * 0.25", "1"]),
    })
    add("shoot", {"rightArm": bone(rot=[-90, 0, 0], pos=[0, 0, osc(0.6, 2200)]), "body": bone(rot=[0, -15, 0])}, loop=True)
    add("punch", {"leftArm": bone(rot=smooth_keys([(0, [0, 0, 0]), (0.15, [-110, 10, 0]), (0.4, [0, 0, 0])]))}, loop=True, length=0.4)
    add("give", {"leftArm": bone(rot=[-75, -10, 0]), "head": bone(rot=[10, 0, 0])}, loop=True)
    add("spawn", {"root": bone(scale=smooth_keys([(0, [0.1, 0.1, 0.1]), (0.4, [1.1, 1.1, 1.1]), (0.6, [1, 1, 1])]),
                                rot=smooth_keys([(0, [0, -720, 0]), (0.6, [0, 0, 0])]))}, loop="hold", length=0.7)
    return A


ROBOT_ACTIONS = ["idle", "shoot", "punch", "give", "fly", "spawn"]


def robot_controllers():
    act = "q.property('lila:action')"
    states = {"default": {"animations": [{"walk": "q.is_on_ground"}, {"fly": "!q.is_on_ground"}], "blend_transition": 0.2, "transitions": []}}
    for a in ("shoot", "punch", "give", "spawn"):
        states["default"]["transitions"].append({a: f"{act} == '{a}'"})
        states[a] = {"animations": [a, {"fly": "!q.is_on_ground"}], "blend_transition": 0.12, "transitions": [{"default": f"{act} != '{a}'"}]}
    return [controller("controller.animation.lila.robot.action", states)]
