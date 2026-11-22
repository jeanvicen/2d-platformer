// PODERES ASSINATURA (3.2) — 10 por raça, cada um com mecânica e visual próprios (textos em
// sigtext.js). Rodam no servidor pelo mesmo motor (validação, recarga, custo e anti-spam do cast);
// o que dura no tempo vira uma ação "sig" na lista curta do motor (com limpeza garantida).
import { EntityDamageCause, system, world } from "@minecraft/server";
import { BAL } from "./data.js";
import { stateOf } from "./state.js";
import { KIT, MARKS, SPECIAL_RUN, STEP_EXT, STUN, heal, raceOfEntity, setPose } from "./engine.js";
import * as V from "./vfx.js";

const { foesNear, aimEntity, eff, knock, pushActive, placeTemp, snd, isUndead, BOSSES, flatDir, add, d3, v3 } = KIT;
const T = () => system.currentTick;
const mid = (e) => v3(e.location.x, e.location.y + 1, e.location.z);
const P = (ctx, k, def) => ctx.a.p[k] ?? def;
const rnd = (a, b) => a + Math.random() * (b - a);

/** Estados dos poderes assinatura (por id de entidade). */
export const THRALL = new Map(); // id da criatura → {owner, until, kind}
export const FROZEN = new Map(); // id → {e, at, until}
export const WARD = new Map();   // id do jogador → {until, kind: "coffin"|"guardian"}
export const INVULN = new Map(); // id do jogador → tick (névoa, asas protetoras)
export const LEECH = new Map();  // id do jogador → tick (lua de sangue: golpes roubam vida)
const HISTORY = new Map();       // id do jogador (deus) → [{at, dim, hp}] a cada 10 ticks

STEP_EXT.sig = (o, tick) => o.step(o, tick);
/** Ação que dura: step(o, tick) → true quando acabar. */
function run(ctx, step, extra = {}) {
  pushActive({ k: "sig", ctx, step, t0: T(), ...extra });
  ctx.touched = (ctx.touched ?? 0) + 1;
}

/** Dano de poder assinatura (sagrado dobra contra trevas e +50% contra demônio/morto-vivo). */
function strike(ctx, t, dmg, o = {}) {
  if (!t?.isValid) return 0;
  let d = dmg;
  if (o.holy) {
    const tr = raceOfEntity(t);
    if (tr === "dark") d *= 1 + BAL.holyVsDark;
    else if (tr === "demon" || isUndead(t)) d *= 1 + BAL.holyBonus;
  }
  if ((MARKS.get(t.id) ?? 0) > T()) d *= 1.25;
  try {
    t.applyDamage(d, { cause: o.magic ? EntityDamageCause.magic : EntityDamageCause.entityAttack, damagingEntity: ctx.player });
  } catch {
    return 0;
  }
  ctx.hits = (ctx.hits ?? 0) + 1;
  if (o.fx !== false) V.impact(t.dimension, mid(t), ctx.race, o.power ?? 1);
  if (o.ignite) try {
    t.setOnFire(o.ignite, true);
  } catch {
    /* ignore */
  }
  return d;
}
const isMob = (e) => e?.isValid && e.typeId !== "minecraft:player" && !BOSSES.has(e.typeId);
function tp(e, at, face) {
  try {
    e.teleport(at, face ? { facingLocation: face, keepVelocity: false } : { keepVelocity: false });
    return true;
  } catch {
    return false;
  }
}
function safeAhead(player, dist) {
  const head = player.getHeadLocation(), dir = player.getViewDirection();
  let d = dist;
  try {
    const hb = player.dimension.getBlockFromRay(head, dir, { maxDistance: dist });
    if (hb) d = Math.max(0, d3(head, hb.block.location) - 1.4);
  } catch {
    /* ignore */
  }
  return add(player.location, dir, d);
}
function sound(ctx, id, vol = 1, pitch = 1, at) {
  snd(ctx.player.dimension, id, at ?? ctx.player.location, vol, pitch);
}
function cmd(dim, c) {
  try {
    dim.runCommand(c);
    return true;
  } catch {
    return false;
  }
}

/** Criatura vira serva (hipnose/possessão): ataca outros monstros, eles revidam nela. */
function enthrall(ctx, t, ticks, kind) {
  THRALL.set(t.id, { owner: ctx.player.id, until: T() + ticks, kind });
  eff(t, "weakness", ticks, 255); // não machuca o dono
  run(ctx, (o, tick) => {
    const th = THRALL.get(t.id);
    if (!t.isValid || !th || tick > th.until) {
      if (t.isValid && kind === "possess") {
        V.impact(t.dimension, mid(t), "demon", 2);
        V.ring(t.dimension, t.location, "demon", 4, 0.5);
        for (const f of foesNear(ctx.player, t.location, 3.5)) if (f.id !== t.id) strike(ctx, f, 12, { fx: false, ignite: 4 });
        strike(ctx, t, 20, { fx: false, magic: true });
        snd(t.dimension, "random.explode", t.location, 1, 0.8);
      }
      try {
        t.removeEffect("weakness");
      } catch {
        /* ignore */
      }
      THRALL.delete(t.id);
      return true;
    }
    if (tick % 6 === 0) {
      const eye = v3(t.location.x, t.location.y + 1.4, t.location.z);
      V.emit(t.dimension, "lila:vfx_dot", eye, { c: kind === "possess" ? [1, 0.4, 0.05] : [1, 0.1, 0.2], size: 0.35, life: 0.3 });
      if (kind === "possess") V.accent(t.dimension, eye, "demon", 2, 0.5);
    }
    if (tick % 16 === 0) {
      const prey = foesNear(ctx.player, t.location, 10).filter((e) => e.id !== t.id && !THRALL.has(e.id))
        .sort((a, b) => d3(a.location, t.location) - d3(b.location, t.location))[0];
      if (prey) {
        const dir = flatDir(v3(prey.location.x - t.location.x, 0, prey.location.z - t.location.z));
        tp(t, v3(prey.location.x - dir.x * 1.2, prey.location.y, prey.location.z - dir.z * 1.2), prey.location);
        try {
          prey.applyDamage(kind === "possess" ? 7 : 5, { cause: EntityDamageCause.entityAttack, damagingEntity: t }); // a vítima passa a caçar a serva
        } catch {
          /* ignore */
        }
        V.slash(t.dimension, mid(prey), ctx.race, 1.4);
      }
    }
    return false;
  }, { cleanup() {
    THRALL.delete(t.id);
  } });
}

/** Proteção contra golpe fatal (Sono do Caixão / Anjo da Guarda). */
function ward(ctx, ticks, kind) {
  WARD.set(ctx.player.id, { until: T() + ticks, kind });
  ctx.touched = 1;
}

// ====================================================================== VAMPIRO
SPECIAL_RUN.v_mist = (ctx) => {
  const p = ctx.player, dur = P(ctx, "dur", 120);
  INVULN.set(p.id, T() + dur);
  eff(p, "invisibility", dur, 0);
  eff(p, "speed", dur, 2);
  eff(p, "slow_falling", dur, 0);
  ctx.s.tog.mistUntil = T() + dur;
  V.emit(p.dimension, "lila:vfx_smoke", mid(p), { c: [0.55, 0.04, 0.08], n: 14, size: 1.2 });
  sound(ctx, "mob.phantom.flap", 1, 0.6);
  run(ctx, (o, tick) => {
    if (!p.isValid) return true;
    if (tick - o.t0 >= dur) {
      V.impact(p.dimension, mid(p), "vampire", 1.4);
      V.emit(p.dimension, "lila:vfx_drops", mid(p), { c: [0.7, 0.02, 0.06], n: 14, size: 1 });
      return true;
    }
    if (tick % 2 === 0) V.emit(p.dimension, "lila:vfx_smoke", v3(p.location.x, p.location.y + 0.8, p.location.z), { c: [0.5, 0.03, 0.07], n: 2, size: 0.9 });
    return false;
  });
  ctx.pose = "transform";
};

SPECIAL_RUN.v_hypno = (ctx) => {
  const t = aimEntity(ctx.player, P(ctx, "r", 16));
  if (!t || !isMob(t)) return "Mire numa criatura (não funciona em jogadores nem chefes).";
  V.trail(ctx.player.dimension, ctx.head, v3(t.location.x, t.location.y + 1.4, t.location.z), "vampire", 0.4, 40);
  V.swirl(t.dimension, mid(t), "vampire", 1.4, true);
  sound(ctx, "mob.evocation_illager.prepare_attack", 0.8, 1.4);
  enthrall(ctx, t, P(ctx, "dur", 300), "hypno");
  ctx.hits = 1;
};

SPECIAL_RUN.v_bats = (ctx) => {
  const p = ctx.player, n = P(ctx, "n", 6), until = T() + P(ctx, "dur", 160);
  for (let i = 0; i < n; i++) {
    const bat = { pos: v3(p.location.x, p.location.y + 1.6, p.location.z), ang: (i / n) * Math.PI * 2, cd: 0 };
    run(ctx, (o, tick) => {
      if (tick > until || !p.isValid) return true;
      const tgt = foesNear(p, p.location, 16).sort((a, b) => d3(a.location, bat.pos) - d3(b.location, bat.pos))[0];
      const goal = tgt ? mid(tgt) : v3(p.location.x + Math.cos(bat.ang + tick * 0.12) * 2, p.location.y + 2.2, p.location.z + Math.sin(bat.ang + tick * 0.12) * 2);
      const d = d3(bat.pos, goal) || 1, sp = Math.min(d, 1.1);
      bat.pos = add(bat.pos, v3((goal.x - bat.pos.x) / d + rnd(-0.3, 0.3), (goal.y - bat.pos.y) / d + rnd(-0.2, 0.3), (goal.z - bat.pos.z) / d + rnd(-0.3, 0.3)), sp);
      if (tick % 3 === 0) V.emit(p.dimension, "lila:vfx_orb_d", bat.pos, { c: [0.6, 0.02, 0.08], d: [0.08, 0.02, 0.04], size: 0.35 });
      if (tick % 9 === 0) KIT.snd(p.dimension, "mob.bat.idle", bat.pos, 0.3, 1.4);
      if (tgt && d < 1.5 && tick >= bat.cd) {
        bat.cd = tick + 14;
        const dealt = strike(ctx, tgt, 3, { power: 0.6 });
        heal(p, dealt * 0.5);
        V.emit(p.dimension, "lila:vfx_drops", mid(tgt), { c: [0.7, 0.02, 0.06], n: 5, size: 0.5 });
      }
      return false;
    });
  }
  V.emit(p.dimension, "lila:rc_bats", mid(p), {});
  sound(ctx, "mob.bat.takeoff", 1, 0.8);
};

SPECIAL_RUN.v_feast = (ctx) => {
  const p = ctx.player, r = P(ctx, "r", 8), dur = P(ctx, "dur", 60);
  if (!foesNear(p, p.location, r).length) return "Nenhuma presa por perto.";
  ctx.pose = "drain";
  setPose(p, "drain", dur);
  V.sigil(p.dimension, p.location, "vampire", r, dur / 20);
  run(ctx, (o, tick) => {
    if (!p.isValid || tick - o.t0 > dur) return true;
    if ((tick - o.t0) % 10 !== 0) return false;
    const head = p.getHeadLocation();
    for (const t of foesNear(p, p.location, r)) {
      const got = strike(ctx, t, 2, { fx: false, magic: true });
      heal(p, got * 0.6);
      V.trail(p.dimension, mid(t), v3(head.x, head.y - 0.3, head.z), "vampire", 0.5, 20);
      V.emit(p.dimension, "lila:vfx_drops", mid(t), { c: [0.7, 0.02, 0.06], n: 3, size: 0.5 });
    }
    ctx.s.res = Math.min(BAL.resourceMax, ctx.s.res + 2);
    return false;
  });
  sound(ctx, "mob.vex.charge", 1, 0.5);
};

SPECIAL_RUN.v_bloodmoon = (ctx) => {
  const p = ctx.player, dur = P(ctx, "dur", 400);
  try {
    const t = world.getTimeOfDay();
    if (p.dimension.id === "minecraft:overworld" && (t < 12500 || t > 23400)) world.setTimeOfDay(18000);
  } catch {
    /* ignore */
  }
  eff(p, "strength", dur, 1);
  eff(p, "regeneration", dur, 1);
  eff(p, "night_vision", dur + 200, 0);
  LEECH.set(p.id, T() + dur);
  try {
    p.camera.fade({ fadeColor: { red: 0.55, green: 0, blue: 0.04 }, fadeTime: { fadeInTime: 0.3, holdTime: 0.3, fadeOutTime: 1.2 } });
  } catch {
    /* ignore */
  }
  V.sigil(p.dimension, p.location, "vampire", 9, 2.5);
  V.pillar(p.dimension, p.location, "vampire", 20, 2.5, 1.4);
  V.emit(p.dimension, "lila:rc_bats", mid(p), {});
  sound(ctx, "mob.wither.spawn", 0.5, 1.6);
  run(ctx, (o, tick) => {
    if (!p.isValid || tick - o.t0 > dur) return true;
    if (tick % 10 === 0) V.emit(p.dimension, "lila:vfx_drops", v3(p.location.x, p.location.y + 2.2, p.location.z), { c: [0.75, 0.02, 0.07], n: 3, size: 0.6 });
    return false;
  });
  ctx.pose = "roar";
};

SPECIAL_RUN.v_wolves = (ctx) => {
  const p = ctx.player, n = P(ctx, "n", 3), dur = P(ctx, "dur", 600);
  const wolves = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const at = v3(p.location.x + Math.cos(a) * 1.8, p.location.y, p.location.z + Math.sin(a) * 1.8);
    try {
      const w = p.dimension.spawnEntity("minecraft:wolf", at);
      try {
        /** @type {any} */ (w.getComponent("minecraft:tameable"))?.tame(p);
      } catch {
        /* ignore */
      }
      w.nameTag = "§cLobo da Noite";
      eff(w, "strength", dur, 1);
      eff(w, "speed", dur, 1);
      eff(w, "resistance", dur, 1);
      wolves.push(w);
      V.emit(p.dimension, "lila:vfx_smoke", v3(at.x, at.y + 0.6, at.z), { c: [0.12, 0.05, 0.08], n: 10, size: 1 });
    } catch {
      /* lugar sem espaço */
    }
  }
  if (!wolves.length) return "Sem espaço para a matilha.";
  sound(ctx, "mob.wolf.bark", 1, 0.7);
  const gone = () => {
    for (const w of wolves) {
      try {
        if (w.isValid) {
          V.emit(w.dimension, "lila:vfx_smoke", mid(w), { c: [0.12, 0.05, 0.08], n: 10, size: 1 });
          w.remove();
        }
      } catch {
        /* ignore */
      }
    }
  };
  run(ctx, (o, tick) => tick - o.t0 > dur || !p.isValid, { cleanup: gone });
  ctx.touched = wolves.length;
};

SPECIAL_RUN.v_claws = (ctx) => {
  const p = ctx.player, r = P(ctx, "r", 10), n = P(ctx, "n", 5);
  const list = foesNear(p, p.location, r).sort((a, b) => d3(a.location, p.location) - d3(b.location, p.location)).slice(0, n);
  if (!list.length) return "Ninguém perto para rasgar.";
  let i = 0, last = { ...p.location };
  run(ctx, (o, tick) => {
    if ((tick - o.t0) % 3 !== 0) return false;
    const t = list[i++];
    if (!t || !p.isValid) return true;
    if (!t.isValid) return i >= list.length;
    const back = flatDir(v3(t.location.x - last.x, 0, t.location.z - last.z));
    const to = v3(t.location.x + back.x * 1.1, t.location.y, t.location.z + back.z * 1.1);
    V.trail(p.dimension, v3(last.x, last.y + 1, last.z), v3(to.x, to.y + 1, to.z), "vampire", 0.5, 24);
    tp(p, to, t.location);
    last = to;
    strike(ctx, t, 7);
    ctx.hits++;
    V.slash(p.dimension, mid(t), "vampire", 2, Math.random() * 360);
    if (t.isValid) {
      MARKS.set(t.id, Math.max(MARKS.get(t.id) ?? 0, T() + 40));
      eff(t, "slowness", 30, 1);
    }
    snd(p.dimension, "mob.vex.hurt", to, 0.6, 0.6);
    return i >= list.length;
  });
  ctx.pose = "dash";
};

SPECIAL_RUN.v_shadowstep = (ctx) => {
  const p = ctx.player;
  const t = aimEntity(p, P(ctx, "r", 20));
  if (!t) return "Mire num alvo para surgir nas costas dele.";
  let f;
  try {
    f = t.getViewDirection();
  } catch {
    f = flatDir(v3(t.location.x - p.location.x, 0, t.location.z - p.location.z));
  }
  const fd = flatDir(f);
  const from = mid(p);
  V.swirl(p.dimension, from, "vampire", 1.4, true);
  if (!tp(p, v3(t.location.x - fd.x * 1.4, t.location.y, t.location.z - fd.z * 1.4), t.location)) return "Sem espaço atrás do alvo.";
  V.trail(p.dimension, from, mid(t), "vampire", 0.6, 30);
  strike(ctx, t, P(ctx, "d", 14), { power: 1.4 });
  eff(t, "blindness", 50, 0);
  V.slash(p.dimension, mid(t), "vampire", 2.4, 30);
  sound(ctx, "mob.endermen.portal", 0.8, 1.6);
  ctx.pose = "slash";
};

SPECIAL_RUN.v_coffin = (ctx) => {
  ward(ctx, P(ctx, "dur", 600), "coffin");
  V.sigil(ctx.player.dimension, ctx.player.location, "vampire", 2, 1.2);
  V.dome(ctx.player.dimension, ctx.player.location, "vampire", 1.6);
  sound(ctx, "block.chest.close", 1, 0.5);
  ctx.msg = "o próximo golpe fatal vira névoa (30 s)";
  ctx.pose = "pray";
};

SPECIAL_RUN.v_lance = (ctx) => {
  const p = ctx.player, dir = ctx.dir, spd = 1.8, max = P(ctx, "r", 28);
  let pos = add(ctx.head, dir, 0.8), dist = 0, pierced = 0;
  const hit = new Set();
  run(ctx, () => {
    for (let k = 0; k < 3; k++) {
      pos = add(pos, dir, spd / 3);
      dist += spd / 3;
      let solid = false;
      try {
        const b = p.dimension.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
        solid = !b || (b.isSolid && !b.isAir);
      } catch {
        solid = true;
      }
      for (const t of foesNear(p, pos, 1.4, 4)) {
        if (hit.has(t.id)) continue;
        hit.add(t.id);
        strike(ctx, t, 12, { power: 1.3 });
        if (t.isValid) {
          eff(t, "slowness", 40, 7);
          eff(t, "jump_boost", 40, 128);
        }
        pierced++;
      }
      if (solid || dist >= max || pierced >= 3) {
        V.emit(p.dimension, "lila:vfx_shards", pos, { c: [0.75, 0.04, 0.1], n: 16, size: 1 });
        V.impact(p.dimension, pos, "vampire", 1.4);
        snd(p.dimension, "random.glass", pos, 0.8, 0.6);
        return true;
      }
    }
    V.emit(p.dimension, "lila:vfx_orb_d", pos, { c: [0.8, 0.03, 0.1], d: [0.3, 0, 0.04], size: 0.7 });
    V.emit(p.dimension, "lila:vfx_dot", add(pos, dir, -0.6), { c: [1, 0.25, 0.3], size: 0.25, life: 0.3 });
    return false;
  });
  sound(ctx, "mob.drowned.shoot", 1, 0.6);
};

// ====================================================================== GIGANTE
const ROCK = [0.55, 0.47, 0.38];
SPECIAL_RUN.g_quake = (ctx) => {
  const p = ctx.player, o0 = { ...p.location }, dim = p.dimension;
  const done = new Set();
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (k > 22) return true;
    if (k % 10 !== 0) return false;
    const R = 4 + (k / 10) * 4;
    V.ring(dim, o0, "giant", R, 0.5);
    V.crack(dim, o0, R * 0.7, 2.5);
    for (let a = 0; a < 8; a++) V.emit(dim, "lila:vfx_shards", v3(o0.x + Math.cos(a * 0.785) * R, o0.y + 0.2, o0.z + Math.sin(a * 0.785) * R), { c: ROCK, n: 4, size: 0.9 });
    V.shake(dim, o0, 0.5, 0.4, R + 10);
    snd(dim, "random.explode", o0, 0.7, 0.5);
    for (const t of foesNear(p, o0, R + 0.5)) {
      if (d3(t.location, o0) < R - 4.5 || done.has(`${t.id}:${k}`)) continue;
      done.add(`${t.id}:${k}`);
      strike(ctx, t, 6, { fx: false });
      knock(t, flatDir(v3(t.location.x - o0.x, 0, t.location.z - o0.z)), 0.4, 0.75);
      eff(t, "slowness", 40, 2);
    }
    return false;
  });
  ctx.pose = "slam";
};

SPECIAL_RUN.g_boulder = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  V.emit(dim, "lila:vfx_shards", p.location, { c: ROCK, n: 20, size: 1.3 });
  V.crack(dim, p.location, 2);
  let pos = v3(p.location.x, p.location.y + 4.5, p.location.z);
  const d = ctx.dir;
  let vel = v3(d.x * 1.2, Math.max(0.25, d.y * 1.2 + 0.45), d.z * 1.2);
  let life = 0;
  run(ctx, () => {
    for (let k = 0; k < 2; k++) {
      vel.y -= 0.035;
      pos = add(pos, vel, 0.5);
      let solid = false;
      try {
        const b = dim.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
        solid = !b || (b.isSolid && !b.isAir);
      } catch {
        solid = true;
      }
      const near = foesNear(p, pos, 1.8, 2).length > 0;
      if (solid || near || ++life > 120) {
        for (const t of foesNear(p, pos, 3.5)) {
          strike(ctx, t, 16, { fx: false });
          knock(t, flatDir(v3(t.location.x - pos.x, 0, t.location.z - pos.z)), 1.2, 0.6);
        }
        V.emit(dim, "lila:vfx_shards", pos, { c: ROCK, n: 28, size: 1.6 });
        V.emit(dim, "lila:vfx_smoke", pos, { c: [0.45, 0.4, 0.34], n: 10, size: 1.6 });
        V.crack(dim, v3(pos.x, Math.floor(pos.y) + 1, pos.z), 3.2);
        V.ring(dim, pos, "giant", 4, 0.4);
        V.shake(dim, pos, 0.45, 0.4, 14);
        snd(dim, "random.explode", pos, 1, 0.6);
        return true;
      }
    }
    V.emit(dim, "lila:vfx_orb_d", pos, { c: [0.5, 0.42, 0.33], d: [0.25, 0.2, 0.15], size: 1.2 });
    if (life % 2 === 0) V.emit(dim, "lila:vfx_smoke", pos, { c: [0.5, 0.45, 0.38], n: 1, size: 0.8 });
    return false;
  });
  sound(ctx, "mob.irongolem.throw", 1, 0.5);
  ctx.pose = "slam";
};

SPECIAL_RUN.g_stomp = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 7), o0 = p.location;
  for (const t of foesNear(p, o0, r)) {
    strike(ctx, t, 8, { fx: false });
    STUN.set(t.id, T() + 40);
    eff(t, "slowness", 40, 6);
    knock(t, flatDir(v3(t.location.x - o0.x, 0, t.location.z - o0.z)), 0.3, 0.9);
  }
  V.crack(dim, o0, r * 0.8, 3);
  V.ring(dim, o0, "giant", r, 0.5);
  V.emit(dim, "lila:vfx_shards", o0, { c: ROCK, n: 24, size: 1.5 });
  V.emit(dim, "lila:vfx_smoke", o0, { c: [0.5, 0.45, 0.38], n: 12, size: 2 });
  V.shake(dim, o0, 0.7, 0.5, 18);
  snd(dim, "random.explode", o0, 1, 0.4);
  ctx.touched = 1;
  ctx.pose = "slam";
};

SPECIAL_RUN.g_hurl = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const t = aimEntity(p, P(ctx, "r", 10));
  if (!t || BOSSES.has(t.typeId)) return "Mire numa criatura para agarrar (chefes são grandes demais).";
  V.chain(dim, ctx.head, mid(t), "giant", 0.4);
  let phase = 0, flying = 0, vel = v3(0, 0, 0);
  run(ctx, (o, tick) => {
    if (!t.isValid || !p.isValid) return true;
    const k = tick - o.t0;
    if (phase === 0) {
      const h = p.getHeadLocation();
      tp(t, v3(h.x, h.y + 1.8, h.z));
      if (k % 4 === 0) V.emit(dim, "lila:vfx_shards", mid(t), { c: ROCK, n: 2, size: 0.6 });
      if (k >= 16) {
        phase = 1;
        const d = p.getViewDirection();
        vel = v3(d.x * 2.4, Math.max(0.5, d.y * 2 + 0.6), d.z * 2.4);
        try {
          t.applyImpulse(vel);
        } catch {
          knock(t, flatDir(d), 3, 0.9);
        }
        snd(dim, "mob.irongolem.throw", p.location, 1, 0.6);
      }
      return false;
    }
    flying++;
    V.orb(dim, mid(t), "giant", 0.5);
    if ((flying > 6 && t.isOnGround) || flying > 60) {
      strike(ctx, t, 8, { fx: false });
      for (const f of foesNear(p, t.location, 3.2)) if (f.id !== t.id) strike(ctx, f, 10, { fx: false });
      V.crack(dim, t.location, 3);
      V.emit(dim, "lila:vfx_shards", t.location, { c: ROCK, n: 20, size: 1.3 });
      V.ring(dim, t.location, "giant", 3.5, 0.4);
      V.shake(dim, t.location, 0.4, 0.3, 12);
      snd(dim, "random.explode", t.location, 0.8, 0.7);
      return true;
    }
    return false;
  });
  ctx.hits = 1;
  ctx.pose = "roar";
};

SPECIAL_RUN.g_wall = (ctx) => {
  const p = ctx.player, dim = p.dimension, f = flatDir(ctx.dir), s = v3(-f.z, 0, f.x), o0 = { ...p.location };
  const half = P(ctx, "r", 4), H = 4, dur = P(ctx, "dur", 200);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (k % 3 !== 0) return false;
    const y = k / 3;
    if (y >= H) return true;
    for (let i = -half; i <= half; i++) {
      const x = Math.floor(o0.x + f.x * 3.5 + s.x * i), z = Math.floor(o0.z + f.z * 3.5 + s.z * i);
      if (placeTemp(dim, x, Math.floor(o0.y) + y, z, y === H - 1 ? "minecraft:mossy_stone_bricks" : "minecraft:stone_bricks", dur - k)) {
        if (i % 2 === 0) V.emit(dim, "lila:vfx_smoke", v3(x + 0.5, Math.floor(o0.y) + y + 0.5, z + 0.5), { c: [0.5, 0.46, 0.4], n: 1, size: 0.8 });
      }
    }
    V.shake(dim, o0, 0.15, 0.15, 8);
    snd(dim, "dig.stone", add(o0, f, 3.5), 1, 0.5);
    for (const t of foesNear(p, add(o0, f, 3.5), half)) knock(t, f, 0.8, 0.4);
    return false;
  });
  ctx.pose = "slam";
};

SPECIAL_RUN.g_frost = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 9), f = flatDir(ctx.dir), o0 = p.location;
  for (const t of foesNear(p, o0, r)) {
    const to = flatDir(v3(t.location.x - o0.x, 0, t.location.z - o0.z));
    if (to.x * f.x + to.z * f.z < 0.55) continue;
    strike(ctx, t, 6, { fx: false });
    eff(t, "slowness", 120, 3);
    V.emit(dim, "lila:vfx_shards", mid(t), { c: [0.75, 0.9, 1], n: 6, size: 0.7 });
  }
  for (let i = 1; i <= r; i++) {
    for (const ang of [-28, -10, 10, 28]) {
      const c = Math.cos((ang * Math.PI) / 180), sn = Math.sin((ang * Math.PI) / 180);
      const at = v3(o0.x + (f.x * c - f.z * sn) * i, o0.y + 1.2, o0.z + (f.x * sn + f.z * c) * i);
      V.emit(dim, "lila:vfx_dot", at, { c: [0.7, 0.9, 1], size: 0.45, life: 0.5 });
      if (i % 2 === 0) V.emit(dim, "lila:vfx_stars", at, { c: [0.85, 0.95, 1], n: 1, size: 0.4 });
      // congela a água (temporário)
      for (let dy = -2; dy <= 0; dy++) {
        try {
          const b = dim.getBlock({ x: Math.floor(at.x), y: Math.floor(o0.y) + dy, z: Math.floor(at.z) });
          if (b && (b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water") && b.above()?.isAir) placeTemp(dim, b.location.x, b.location.y, b.location.z, "minecraft:ice", 300);
        } catch {
          /* ignore */
        }
      }
    }
  }
  sound(ctx, "random.glass", 1, 0.5);
  ctx.touched = 1;
  ctx.pose = "roar";
};

SPECIAL_RUN.g_muspel = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 6);
  const FIRE = [1, 0.45, 0.08];
  let n = 0;
  run(ctx, (o, tick) => {
    if ((tick - o.t0) % 4 !== 0) return false;
    const yaw = Math.atan2(ctx.dir.z, ctx.dir.x) + (n - 1) * 2.1;
    for (let a = -0.9; a <= 0.9; a += 0.3) {
      const at = v3(p.location.x + Math.cos(yaw + a) * r * 0.7, p.location.y + 1.2, p.location.z + Math.sin(yaw + a) * r * 0.7);
      V.emit(dim, "lila:vfx_slash", at, { c: FIRE, size: 2.4, rot: Math.random() * 360 });
      V.emit(dim, "lila:vfx_embers", at, { c: [1, 0.6, 0.2], n: 3, size: 0.8 });
    }
    for (const t of foesNear(p, p.location, r)) {
      const ang = Math.atan2(t.location.z - p.location.z, t.location.x - p.location.x);
      let da = Math.abs(((ang - yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da < 1.1) strike(ctx, t, 10, { fx: false, ignite: 5 });
    }
    snd(dim, "mob.blaze.shoot", p.location, 0.8, 0.6);
    return ++n >= 3;
  });
  ctx.pose = "slash";
};

SPECIAL_RUN.g_roar = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 14), o0 = p.location;
  let n = 0;
  for (const t of foesNear(p, o0, r)) {
    knock(t, flatDir(v3(t.location.x - o0.x, 0, t.location.z - o0.z)), 2.6, 0.4);
    eff(t, "weakness", 140, 2);
    eff(t, "slowness", 80, 1);
    n++;
  }
  V.ring(dim, o0, "giant", r, 0.7);
  V.ring(dim, o0, "giant", r * 0.6, 0.5);
  V.emit(dim, "lila:vfx_smoke", o0, { c: [0.5, 0.45, 0.38], n: 14, size: 2.5 });
  V.shake(dim, o0, 0.5, 0.6, r + 6);
  sound(ctx, "mob.ravager.roar", 1.2, 0.6);
  ctx.touched = 1;
  ctx.msg = `${n} fugiram`;
  ctx.pose = "roar";
};

/** Fúria Titânica: escala 6,3 por 15 s (evento do jogador) e câmera mais alta. */
export const MEGA = new Map(); // id → tick do fim
SPECIAL_RUN.g_titan = (ctx) => {
  const p = ctx.player, dur = P(ctx, "dur", 300);
  try {
    p.runCommand("event entity @s lila:mega_on");
  } catch {
    try {
      p.triggerEvent("lila:mega_on");
    } catch {
      /* ignore */
    }
  }
  MEGA.set(p.id, T() + dur);
  ctx.s.tog.mega = true;
  eff(p, "strength", dur, 3);
  eff(p, "resistance", dur, 1);
  V.pillar(p.dimension, p.location, "giant", 18, 3, 1.2);
  V.crack(p.dimension, p.location, 6, 3);
  V.shake(p.dimension, p.location, 0.8, 0.8, 24);
  sound(ctx, "mob.ravager.roar", 1.4, 0.4);
  SIG_HOOK.cam?.(p);
  run(ctx, (o, tick) => {
    if (!p.isValid) return true;
    if (tick - o.t0 >= dur) {
      endMega(p);
      return true;
    }
    if (tick % 8 === 0 && p.isOnGround) V.emit(p.dimension, "lila:vfx_smoke", p.location, { c: [0.5, 0.45, 0.38], n: 2, size: 1.4 });
    return false;
  }, { cleanup() {
    endMega(p);
  } });
  ctx.pose = "roar";
};
export function endMega(p) {
  if (!MEGA.has(p.id)) return;
  MEGA.delete(p.id);
  try {
    stateOf(p).tog.mega = false;
    p.runCommand("event entity @s lila:mega_off");
  } catch {
    try {
      p.triggerEvent("lila:mega_off");
    } catch {
      /* ignore */
    }
  }
  SIG_HOOK.cam?.(p);
}

SPECIAL_RUN.g_spikes = (ctx) => {
  const p = ctx.player, dim = p.dimension, f = flatDir(ctx.dir), o0 = { ...p.location }, len = P(ctx, "r", 14);
  let i = 1;
  const hit = new Set();
  run(ctx, () => {
    if (i > len) return true;
    const at = v3(o0.x + f.x * i * 1.2, o0.y, o0.z + f.z * i * 1.2);
    let y = Math.floor(at.y);
    try {
      for (let dy = 2; dy >= -3; dy--) {
        const b = dim.getBlock({ x: Math.floor(at.x), y: Math.floor(at.y) + dy, z: Math.floor(at.z) });
        if (b && b.isSolid && b.above()?.isAir) {
          y = b.location.y + 1;
          break;
        }
      }
    } catch {
      /* ignore */
    }
    placeTemp(dim, Math.floor(at.x), y, Math.floor(at.z), "minecraft:pointed_dripstone", 50);
    V.emit(dim, "lila:vfx_shards", v3(at.x, y, at.z), { c: ROCK, n: 5, size: 0.9 });
    for (const t of foesNear(p, v3(at.x, y, at.z), 1.8)) {
      if (hit.has(t.id)) continue;
      hit.add(t.id);
      strike(ctx, t, 8, { fx: false });
      knock(t, f, 0.2, 1.0);
    }
    if (i % 3 === 0) snd(dim, "dig.stone", v3(at.x, y, at.z), 1, 0.6);
    i++;
    return false;
  });
  ctx.pose = "slam";
};

export const SIG_HOOK = { cam: null };

/** Antes do dano: invulnerável (névoa/asas), congelados não ferem, serva não fere o dono. 0 = cancela. */
export function sigDamage(target, src) {
  const tick = T();
  if (target && (INVULN.get(target.id) ?? 0) > tick) {
    if (src?.isValid && src.id !== target.id) system.run(() => {
      try {
        if (src.isValid) knock(src, flatDir(v3(src.location.x - target.location.x, 0, src.location.z - target.location.z)), 1.2, 0.3);
      } catch {
        /* ignore */
      }
    });
    return 0;
  }
  if (src && FROZEN.has(src.id)) return 0;
  const th = src ? THRALL.get(src.id) : null;
  if (th && target && th.owner === target.id) return 0;
  return 1;
}
/** Golpe que mataria quem tem proteção (Sono do Caixão / Anjo da Guarda): anula e salva. */
export function sigLethal(target, dmg) {
  const w = WARD.get(target.id);
  if (!w || w.until < T()) return false;
  let h;
  try {
    h = target.getComponent("minecraft:health");
  } catch {
    return false;
  }
  if (!h || dmg < h.currentValue) return false;
  WARD.delete(target.id);
  system.run(() => {
    if (!target.isValid) return;
    try {
      if (w.kind === "guardian") {
        h.setCurrentValue(h.effectiveMax);
        target.addEffect("absorption", 400, { amplifier: 1, showParticles: false });
        V.pillar(target.dimension, target.location, "angel", 14, 1.6, 1);
        V.emit(target.dimension, "lila:vfx_feather", mid(target), { c: [1, 1, 1], n: 18, size: 1.4 });
        target.dimension.playSound("random.totem", target.location, { volume: 1, pitch: 1.2 });
      } else {
        h.setCurrentValue(Math.max(1, h.effectiveMax * 0.5));
        INVULN.set(target.id, T() + 60);
        target.addEffect("invisibility", 60, { amplifier: 0, showParticles: false });
        V.emit(target.dimension, "lila:vfx_smoke", mid(target), { c: [0.55, 0.04, 0.08], n: 18, size: 1.5 });
        target.dimension.playSound("mob.phantom.flap", target.location, { volume: 1, pitch: 0.6 });
      }
      target.onScreenDisplay.setActionBar(w.kind === "guardian" ? "§e✦ O Anjo da Guarda te salvou!" : "§c✦ Você virou névoa e escapou da morte!");
    } catch {
      /* ignore */
    }
  });
  return true;
}
/** Depois do golpe: Lua de Sangue rouba 30% do dano. */
export function sigAfterHit(src, dmg) {
  if ((LEECH.get(src.id) ?? 0) > T()) heal(src, dmg * 0.3);
}
export function sigForget(id) {
  for (const m of [INVULN, WARD, LEECH, HISTORY, MEGA]) m.delete(id);
}
export { run, strike, tp, safeAhead, sound, cmd, enthrall, ward, mid, P, rnd, isMob, T, HISTORY };
