// PODERES ASSINATURA (3.2) — parte 2: Anjo, Demônio, Deus e Trevas. Ver signature.js e sigtext.js.
import { EntityDamageCause } from "@minecraft/server";
import { KIT, MARKS, REVEAL, SILENCE, SPECIAL_RUN, STUN, ashEntity, heal } from "./engine.js";
import * as V from "./vfx.js";
import { FROZEN, HISTORY, INVULN, P, T, enthrall, isMob, mid, rnd, run, safeAhead, sound, strike, tp, ward } from "./signature.js";

const { foesNear, alliesNear, aimEntity, aimPoint, eff, knock, placeTemp, snd, hp, isUndead, BOSSES, flatDir, add, d3, v3 } = KIT;
const NEG = ["slowness", "mining_fatigue", "nausea", "blindness", "hunger", "weakness", "poison", "wither", "levitation", "darkness"];
const POS = ["speed", "haste", "strength", "jump_boost", "regeneration", "resistance", "fire_resistance", "invisibility", "absorption", "health_boost"];
const clean = (e, list) => {
  for (const n of list) try {
    e.removeEffect(n);
  } catch {
    /* ignore */
  }
};
const full = (e) => {
  const h = hp(e);
  try {
    if (h) h.setCurrentValue(h.effectiveMax);
  } catch {
    /* ignore */
  }
};
const monster = (e) => {
  try {
    return e.matches({ families: ["monster"] });
  } catch {
    return false;
  }
};

// ====================================================================== ANJO
SPECIAL_RUN.a_judgment = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const t = aimEntity(p, P(ctx, "r", 24));
  const at = t ? { ...t.location } : aimPoint(p, P(ctx, "r", 24));
  V.sigil(dim, at, "angel", 3, 1.3);
  snd(dim, "beacon.activate", at, 1, 1.6);
  run(ctx, (o, tick) => {
    if (tick - o.t0 < 20) {
      if ((tick - o.t0) % 5 === 0) V.emit(dim, "lila:vfx_feather", v3(at.x, at.y + 6, at.z), { c: [1, 1, 1], n: 2, size: 1 });
      return false;
    }
    V.pillar(dim, at, "angel", 24, 2.2, 0.9);
    V.ring(dim, at, "angel", 5, 0.5);
    V.impact(dim, v3(at.x, at.y + 1, at.z), "angel", 2);
    V.shake(dim, at, 0.35, 0.35, 14);
    snd(dim, "random.explode", at, 0.6, 1.6);
    for (const f of foesNear(p, at, 3.2)) {
      strike(ctx, f, P(ctx, "d", 18), { holy: true, fx: false });
      eff(f, "blindness", 60, 0);
    }
    return true;
  });
  ctx.pose = "pray";
};

SPECIAL_RUN.a_flamesword = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 5);
  const HOLYFIRE = [1, 0.7, 0.25];
  let n = 0;
  run(ctx, (o, tick) => {
    if ((tick - o.t0) % 3 !== 0) return false;
    const f = flatDir(p.getViewDirection());
    const at = v3(p.location.x + f.x * 2.2, p.location.y + 1.2, p.location.z + f.z * 2.2);
    V.emit(dim, "lila:vfx_slash", at, { c: HOLYFIRE, size: 3, rot: [200, 340, 270][n], out: n % 2 });
    V.emit(dim, "lila:vfx_slash", at, { c: [1, 1, 0.85], size: 2.4, rot: [205, 345, 275][n], out: n % 2 });
    V.emit(dim, "lila:vfx_embers", at, { c: [1, 0.75, 0.3], n: 8, size: 1.2 });
    for (const t of foesNear(p, p.location, r)) {
      const to = flatDir(v3(t.location.x - p.location.x, 0, t.location.z - p.location.z));
      if (to.x * f.x + to.z * f.z > 0.4) strike(ctx, t, 8, { holy: true, ignite: 4, power: 0.8 });
    }
    snd(dim, "item.trident.riptide_1", p.location, 0.8, 1.4);
    return ++n >= 3;
  });
  ctx.pose = "slash";
};

SPECIAL_RUN.a_trumpet = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 10), o0 = { ...p.location };
  sound(ctx, "raid.horn", 1.2, 1.4);
  let n = 0;
  run(ctx, (o, tick) => {
    if ((tick - o.t0) % 6 !== 0) return false;
    V.ring(dim, o0, "angel", r * (0.5 + n * 0.25), 0.5);
    V.emit(dim, "lila:vfx_stars", v3(o0.x, o0.y + 1.5, o0.z), { c: [1, 0.95, 0.7], n: 8, size: 2 });
    if (n === 0) {
      for (const t of foesNear(p, o0, r)) {
        strike(ctx, t, 5, { holy: true, power: 0.7 });
        STUN.set(t.id, T() + 40);
        eff(t, "slowness", 40, 6);
      }
      for (const a of alliesNear(p, r)) heal(a, 6);
    }
    return ++n >= 3;
  });
  ctx.pose = "roar";
};

SPECIAL_RUN.a_wings = (ctx) => {
  const p = ctx.player, dur = P(ctx, "dur", 60);
  INVULN.set(p.id, T() + dur);
  eff(p, "slowness", dur, 1);
  V.emit(p.dimension, "lila:vfx_feather", mid(p), { c: [1, 1, 1], n: 16, size: 1.2 });
  sound(ctx, "item.armor.equip_elytra", 1, 1.2);
  run(ctx, (o, tick) => {
    if (!p.isValid || tick - o.t0 > dur) return true;
    if (tick % 5 === 0) V.dome(p.dimension, p.location, "angel", 1.5);
    return false;
  });
  ctx.pose = "pray";
};

SPECIAL_RUN.a_guardian = (ctx) => {
  ward(ctx, P(ctx, "dur", 1200), "guardian");
  V.pillar(ctx.player.dimension, ctx.player.location, "angel", 10, 1.2, 1);
  V.emit(ctx.player.dimension, "lila:vfx_feather", mid(ctx.player), { c: [1, 1, 1], n: 12, size: 1 });
  sound(ctx, "beacon.power", 1, 1.4);
  ctx.msg = "um anjo te guarda (60 s)";
  ctx.pose = "pray";
};

SPECIAL_RUN.a_sanctuary = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 7), dur = P(ctx, "dur", 200), o0 = { ...p.location };
  sound(ctx, "beacon.activate", 1, 1.2);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (k > dur) return true;
    if (k % 20 === 0) {
      V.dome(dim, o0, "angel", r);
      V.sigil(dim, o0, "angel", r, 1.1);
    }
    if (k % 10 === 0) {
      for (const t of foesNear(p, o0, r)) {
        if (t.typeId === "minecraft:player" || !monster(t)) continue;
        knock(t, flatDir(v3(t.location.x - o0.x, 0, t.location.z - o0.z)), 1.2, 0.25);
        strike(ctx, t, 3, { holy: true, power: 0.5 });
      }
      for (const a of alliesNear(p, 64)) if (d3(a.location, o0) <= r) eff(a, "regeneration", 30, 1);
    }
    return false;
  });
  ctx.pose = "pray";
};

SPECIAL_RUN.a_feathers = (ctx) => {
  const p = ctx.player, dim = p.dimension, n = P(ctx, "n", 12);
  for (let i = 0; i < n; i++) {
    const ang = ((i / (n - 1)) - 0.5) * 1.6;
    const d = ctx.dir, c = Math.cos(ang), sn = Math.sin(ang);
    let vel = v3((d.x * c - d.z * sn) * 1.1, d.y * 1.1 + rnd(0, 0.3), (d.x * sn + d.z * c) * 1.1);
    let pos = add(ctx.head, vel, 0.6), life = 0;
    run(ctx, () => {
      if (++life > 50) return true;
      const tgt = foesNear(p, pos, 10).sort((a, b) => d3(a.location, pos) - d3(b.location, pos))[0];
      if (tgt && life > 4) {
        const g = mid(tgt), dd = d3(g, pos) || 1;
        vel = v3(vel.x * 0.75 + ((g.x - pos.x) / dd) * 0.45, vel.y * 0.75 + ((g.y - pos.y) / dd) * 0.45, vel.z * 0.75 + ((g.z - pos.z) / dd) * 0.45);
      }
      pos = add(pos, vel, 1);
      V.emit(dim, "lila:vfx_feather", pos, { c: [1, 1, 1], n: 1, size: 0.1 });
      V.emit(dim, "lila:vfx_dot", pos, { c: [1, 0.9, 0.55], size: 0.22, life: 0.25 });
      const hit = foesNear(p, pos, 1.1, 1)[0];
      if (hit) {
        strike(ctx, hit, 4, { holy: true, power: 0.5 });
        return true;
      }
      try {
        const b = dim.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
        if (!b || (b.isSolid && !b.isAir)) return true;
      } catch {
        return true;
      }
      return false;
    });
  }
  sound(ctx, "mob.phantom.swoop", 0.8, 1.6);
};

SPECIAL_RUN.a_ascend = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  knock(p, flatDir(ctx.dir), 0.2, 2.6);
  eff(p, "slow_falling", 200, 0);
  ctx.s.tog.safeFallUntil = T() + 300;
  V.pillar(dim, p.location, "angel", 14, 1.4, 0.7);
  V.ring(dim, p.location, "angel", 3, 0.4);
  sound(ctx, "item.trident.riptide_3", 1, 1.4);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!p.isValid || k > 300) return true;
    if (k % 3 === 0) V.emit(dim, "lila:vfx_feather", p.location, { c: [1, 1, 1], n: 1, size: 0.5 });
    if (k > 12 && p.isOnGround) {
      V.ring(dim, p.location, "angel", 5, 0.5);
      V.impact(dim, mid(p), "angel", 1.6);
      for (const t of foesNear(p, p.location, 5)) {
        strike(ctx, t, 8, { holy: true, fx: false });
        knock(t, flatDir(v3(t.location.x - p.location.x, 0, t.location.z - p.location.z)), 1.2, 0.5);
      }
      V.shake(dim, p.location, 0.25, 0.3, 10);
      return true;
    }
    return false;
  });
  ctx.pose = "dash";
};

SPECIAL_RUN.a_choir = (ctx) => {
  const p = ctx.player, dim = p.dimension, dur = P(ctx, "dur", 240), n = 6;
  sound(ctx, "beacon.power", 1.2, 0.8);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!p.isValid || k > dur) return true;
    const lights = [];
    for (let i = 0; i < n; i++) {
      const a = k * 0.08 + (i / n) * Math.PI * 2;
      const at = v3(p.location.x + Math.cos(a) * 2.6, p.location.y + 2.8 + Math.sin(k * 0.1 + i) * 0.3, p.location.z + Math.sin(a) * 2.6);
      lights.push(at);
      V.emit(dim, "lila:vfx_orb", at, { c: [1, 0.95, 0.7], size: 0.5 });
    }
    if (k % 15 === 0) {
      const foes = foesNear(p, p.location, 16);
      for (let i = 0; i < Math.min(n, foes.length); i++) {
        const t = foes[i % foes.length];
        V.beam(dim, lights[i], mid(t), "angel", 0.3);
        strike(ctx, t, 5, { holy: true, fx: false });
      }
      for (const a of alliesNear(p, 10)) eff(a, "regeneration", 30, 1);
    }
    return false;
  });
  ctx.pose = "pray";
};

SPECIAL_RUN.a_breath = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  for (const a of alliesNear(p, P(ctx, "r", 12))) {
    full(a);
    clean(a, NEG);
    eff(a, "absorption", 600, 1);
    V.pillar(dim, a.location, "angel", 6, 0.9, 0.6);
    V.emit(dim, "lila:vfx_feather", mid(a), { c: [1, 1, 1], n: 6, size: 0.8 });
  }
  sound(ctx, "random.levelup", 1, 1.4);
  ctx.touched = 1;
  ctx.pose = "pray";
};

// ====================================================================== DEMÔNIO
const HELL = [1, 0.4, 0.06];
SPECIAL_RUN.d_pact = (ctx) => {
  const p = ctx.player, dur = P(ctx, "dur", 400);
  const h = hp(p);
  if (h) {
    const pay = Math.min(h.currentValue - 2, h.currentValue * 0.4);
    if (pay < 1) return "Vida baixa demais para o pacto.";
    try {
      h.setCurrentValue(h.currentValue - pay);
    } catch {
      /* ignore */
    }
  }
  eff(p, "strength", dur, 2);
  eff(p, "speed", dur, 1);
  eff(p, "fire_resistance", dur, 0);
  V.sigil(p.dimension, p.location, "demon", 3, 1.5);
  V.pillar(p.dimension, p.location, "demon", 10, 1.3, 0.8);
  sound(ctx, "mob.wither.ambient", 0.8, 0.6);
  run(ctx, (o, tick) => {
    if (!p.isValid || tick - o.t0 > dur) return true;
    if (tick % 4 === 0) V.emit(p.dimension, "lila:vfx_embers", p.location, { c: [1, 0.5, 0.1], n: 2, size: 0.8 });
    if (tick % 20 === 0) for (const t of foesNear(p, p.location, 2.5)) strike(ctx, t, 2, { fx: false, ignite: 3 });
    return false;
  });
  ctx.pose = "roar";
};

SPECIAL_RUN.d_possess = (ctx) => {
  const t = aimEntity(ctx.player, P(ctx, "r", 14));
  if (!t || !isMob(t)) return "Mire numa criatura (não funciona em jogadores nem chefes).";
  V.chain(ctx.player.dimension, ctx.head, mid(t), "demon", 0.6);
  V.sigil(t.dimension, t.location, "demon", 1.6, 1);
  sound(ctx, "mob.evocation_illager.cast_spell", 1, 0.6);
  enthrall(ctx, t, P(ctx, "dur", 300), "possess");
  ctx.hits = 1;
};

SPECIAL_RUN.d_chains = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const list = foesNear(p, p.location, P(ctx, "r", 14)).slice(0, P(ctx, "n", 4));
  if (!list.length) return "Ninguém para acorrentar.";
  for (const t of list) {
    eff(t, "slowness", 40, 7);
    eff(t, "jump_boost", 40, 128);
  }
  sound(ctx, "random.anvil_land", 0.6, 0.6);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!p.isValid) return true;
    if (k % 4 === 0) for (const t of list) if (t.isValid) V.chain(dim, p.getHeadLocation(), mid(t), "demon", 0.25);
    if (k === 30) {
      for (const t of list) {
        if (!t.isValid) continue;
        const to = flatDir(v3(p.location.x - t.location.x, 0, p.location.z - t.location.z));
        knock(t, to, Math.min(3, d3(t.location, p.location) * 0.32), 0.35);
        strike(ctx, t, 6, { power: 0.8 });
      }
      snd(dim, "random.anvil_use", p.location, 0.6, 0.5);
      return true;
    }
    return false;
  });
  ctx.hits = list.length;
  ctx.pose = "cast";
};

SPECIAL_RUN.d_hellgate = (ctx) => {
  const p = ctx.player, dim = p.dimension, at = aimPoint(p, P(ctx, "r", 12)), R = P(ctx, "a", 4), dur = P(ctx, "dur", 140);
  sound(ctx, "mob.ghast.scream", 0.6, 0.5);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (k > dur) return true;
    if (k % 20 === 0) V.sigil(dim, at, "demon", R, 1.1);
    if (k % 8 === 0 && k > 10) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R;
      const g = v3(at.x + Math.cos(a) * d, at.y, at.z + Math.sin(a) * d);
      V.pillar(dim, g, "demon", 5, 0.8, 0.5);
      V.emit(dim, "lila:vfx_embers", g, { c: [1, 0.55, 0.15], n: 8, size: 0.8 });
      for (const t of foesNear(p, g, 1.8)) {
        strike(ctx, t, 5, { fx: false, ignite: 4 });
        knock(t, flatDir(v3(t.location.x - g.x, 0, t.location.z - g.z)), 0.2, 0.7);
      }
      snd(dim, "mob.blaze.shoot", g, 0.6, 0.7);
    }
    return false;
  });
  ctx.pose = "slam";
};

SPECIAL_RUN.d_brimstone = (ctx) => {
  const p = ctx.player, dim = p.dimension, c = aimPoint(p, P(ctx, "r", 20)), n = P(ctx, "n", 10), R = 6;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R;
    const goal = v3(c.x + Math.cos(a) * d, c.y, c.z + Math.sin(a) * d);
    let pos = v3(goal.x + rnd(-4, 4), goal.y + 22, goal.z + rnd(-4, 4));
    const delay = i * 4;
    run(ctx, (o, tick) => {
      if (tick - o.t0 < delay) return false;
      const dd = d3(pos, goal) || 1, sp = Math.min(dd, 1.6);
      pos = add(pos, v3((goal.x - pos.x) / dd, (goal.y - pos.y) / dd, (goal.z - pos.z) / dd), sp);
      V.emit(dim, "lila:vfx_orb", pos, { c: HELL, size: 0.8 });
      V.emit(dim, "lila:vfx_smoke", pos, { c: [0.15, 0.08, 0.05], n: 1, size: 0.7 });
      if (dd > 1.7) return false;
      V.impact(dim, goal, "demon", 1.5);
      V.crack(dim, goal, 1.8, 2);
      for (const t of foesNear(p, goal, 2.4)) strike(ctx, t, 7, { fx: false, ignite: 4 });
      snd(dim, "random.explode", goal, 0.5, 1.2);
      return true;
    });
  }
  ctx.pose = "roar";
};

SPECIAL_RUN.d_hellfire = (ctx) => {
  const p = ctx.player, dim = p.dimension, f = flatDir(ctx.dir), max = P(ctx, "r", 16);
  let pos = v3(p.location.x, p.location.y + 0.3, p.location.z), dist = 0;
  const hit = new Set();
  run(ctx, () => {
    pos = add(pos, f, 1.3);
    dist += 1.3;
    V.emit(dim, "lila:vfx_smoke", pos, { c: [0.08, 0.02, 0.02], n: 3, size: 1 });
    V.emit(dim, "lila:vfx_embers", pos, { c: [1, 0.25, 0.05], n: 5, size: 1 });
    V.emit(dim, "lila:vfx_ring_d", pos, { c: [0.1, 0.02, 0.02], d: [0.6, 0.1, 0], size: 1.4, life: 0.4 });
    for (const t of foesNear(p, pos, 1.9)) {
      if (hit.has(t.id)) continue;
      hit.add(t.id);
      strike(ctx, t, 7, { fx: false, ignite: 4 });
      eff(t, "wither", 60, 0);
    }
    return dist >= max;
  });
  sound(ctx, "mob.blaze.breathe", 1, 0.5);
  ctx.pose = "slam";
};

SPECIAL_RUN.d_damnation = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const t = aimEntity(p, P(ctx, "r", 18));
  if (!t) return "Mire num alvo para marcar.";
  MARKS.set(t.id, T() + 110);
  REVEAL.set(t.id, T() + 110);
  V.chain(dim, ctx.head, mid(t), "demon", 0.4);
  sound(ctx, "mob.evocation_illager.prepare_summon", 0.8, 0.6);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!t.isValid) return true;
    if (k % 20 === 0) V.sigil(dim, v3(t.location.x, t.location.y + 2.6, t.location.z), "demon", 0.9, 1);
    if (k < 100) return false;
    V.impact(dim, mid(t), "demon", 2.2);
    V.ring(dim, t.location, "demon", 4, 0.5);
    strike(ctx, t, P(ctx, "d", 18), { fx: false, ignite: 5 });
    for (const f of foesNear(p, t.location, 3)) if (f.id !== t.id) strike(ctx, f, 8, { fx: false, ignite: 3 });
    V.shake(dim, t.location, 0.3, 0.3, 10);
    snd(dim, "random.explode", t.location, 0.8, 0.8);
    return true;
  });
  ctx.hits = 1;
};

SPECIAL_RUN.d_legion = (ctx) => {
  const p = ctx.player, dim = p.dimension, n = P(ctx, "n", 4), dur = P(ctx, "dur", 240);
  for (let i = 0; i < n; i++) {
    let cd = i * 5;
    run(ctx, (o, tick) => {
      const k = tick - o.t0;
      if (!p.isValid || k > dur) return true;
      const a = k * 0.1 + (i / n) * Math.PI * 2;
      const at = v3(p.location.x + Math.cos(a) * 2, p.location.y + 2.3 + Math.sin(k * 0.2 + i) * 0.4, p.location.z + Math.sin(a) * 2);
      V.emit(dim, "lila:vfx_orb", at, { c: HELL, size: 0.35 });
      if (k % 4 === 0) V.emit(dim, "lila:vfx_embers", at, { c: [1, 0.5, 0.1], n: 1, size: 0.4 });
      if (k >= cd) {
        const t = foesNear(p, p.location, 12).sort((x, y) => d3(x.location, at) - d3(y.location, at))[0];
        if (t) {
          cd = k + 20;
          V.trail(dim, at, mid(t), "demon", 0.5, 30);
          strike(ctx, t, 4, { ignite: 3, power: 0.6 });
          snd(dim, "mob.blaze.shoot", at, 0.4, 1.4);
        }
      }
      return false;
    });
  }
  sound(ctx, "mob.evocation_illager.prepare_summon", 1, 1.2);
  ctx.pose = "pray";
};

SPECIAL_RUN.d_wingdash = (ctx) => {
  const p = ctx.player, dim = p.dimension, d = ctx.dir;
  try {
    p.applyKnockback({ x: d.x * 3.2, z: d.z * 3.2 }, Math.max(0.3, d.y * 1.5 + 0.4));
  } catch {
    knock(p, flatDir(d), 3, 0.5);
  }
  ctx.s.tog.safeFallUntil = T() + 80;
  const hit = new Set();
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!p.isValid || k > 16) return true;
    V.emit(dim, "lila:vfx_embers", mid(p), { c: [1, 0.45, 0.08], n: 4, size: 0.8 });
    V.emit(dim, "lila:vfx_orb", mid(p), { c: HELL, size: 0.6 });
    for (const t of foesNear(p, p.location, 2.6)) {
      if (hit.has(t.id)) continue;
      hit.add(t.id);
      strike(ctx, t, 6, { ignite: 4, power: 0.8 });
    }
    return false;
  });
  sound(ctx, "mob.ghast.fireball", 1, 0.8);
  ctx.pose = "dash";
};

SPECIAL_RUN.d_archdemon = (ctx) => {
  const p = ctx.player, dim = p.dimension, dur = P(ctx, "dur", 300), R = 4;
  eff(p, "strength", dur, 1);
  eff(p, "resistance", dur, 0);
  eff(p, "fire_resistance", dur, 0);
  V.pillar(dim, p.location, "demon", 16, 2.4, 1.1);
  V.sigil(dim, p.location, "demon", 7, 2);
  sound(ctx, "mob.wither.spawn", 0.6, 0.7);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!p.isValid || k > dur) return true;
    if (k % 5 === 0) {
      for (let a = 0; a < 6; a++) {
        const ang = k * 0.05 + (a / 6) * Math.PI * 2;
        V.emit(dim, "lila:vfx_embers", v3(p.location.x + Math.cos(ang) * R, p.location.y + 0.3, p.location.z + Math.sin(ang) * R), { c: [1, 0.45, 0.08], n: 2, size: 0.6 });
      }
    }
    if (k % 20 === 0) V.ring(dim, p.location, "demon", R, 0.6);
    if (k % 10 === 0) {
      for (const t of foesNear(p, p.location, R + 0.5)) {
        strike(ctx, t, 4, { fx: false, ignite: 3 });
        knock(t, flatDir(v3(t.location.x - p.location.x, 0, t.location.z - p.location.z)), 1, 0.2);
        eff(t, "weakness", 40, 1);
      }
    }
    return false;
  });
  ctx.pose = "roar";
};

// ====================================================================== DEUS
SPECIAL_RUN.o_timestop = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 24), dur = P(ctx, "dur", 120);
  const until = T() + dur;
  const list = foesNear(p, p.location, r, 40);
  for (const e of list) FROZEN.set(e.id, { e, at: { ...e.location }, until });
  const shots = [];
  try {
    for (const e of dim.getEntities({ location: p.location, maxDistance: r })) {
      if (/arrow|snowball|fireball|trident|potion|egg|wind_charge|shulker_bullet/.test(e.typeId)) {
        shots.push(e);
        FROZEN.set(e.id, { e, at: { ...e.location }, until });
      }
    }
  } catch {
    /* ignore */
  }
  for (const e of list) {
    eff(e, "slowness", dur, 255);
    eff(e, "weakness", dur, 255);
    eff(e, "mining_fatigue", dur, 4);
  }
  try {
    p.camera.fade({ fadeColor: { red: 0.75, green: 0.72, blue: 0.6 }, fadeTime: { fadeInTime: 0.08, holdTime: 0.05, fadeOutTime: 0.5 } });
  } catch {
    /* ignore */
  }
  V.sigil(dim, p.location, "god", 10, dur / 20);
  V.ring(dim, p.location, "god", r, 0.8);
  sound(ctx, "block.bell.hit", 1.2, 0.5);
  run(ctx, (o, tick) => {
    if (tick > until) {
      for (const e of [...list, ...shots]) FROZEN.delete(e.id);
      snd(dim, "block.bell.hit", p.location, 1, 1.2);
      return true;
    }
    for (const e of [...list, ...shots]) {
      const f = FROZEN.get(e.id);
      if (!f || !e.isValid) continue;
      try {
        e.teleport(f.at, { keepVelocity: false });
        if (e.typeId !== "minecraft:player") e.clearVelocity?.();
      } catch {
        /* ignore */
      }
      if (tick % 20 === 0) V.emit(dim, "lila:vfx_dot", v3(f.at.x, f.at.y + 1, f.at.z), { c: [0.85, 0.82, 0.7], size: 1.2, life: 1 });
    }
    return false;
  }, { cleanup() {
    for (const e of [...list, ...shots]) FROZEN.delete(e.id);
  } });
  ctx.hits = list.length;
  ctx.msg = `${list.length} congelados`;
  ctx.pose = "pray";
};

SPECIAL_RUN.o_genesis = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 10), o0 = p.location;
  let n = 0;
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) for (let y = -2; y <= 2; y++) {
    if (x * x + z * z > r * r) continue;
    try {
      const b = dim.getBlock({ x: Math.floor(o0.x) + x, y: Math.floor(o0.y) + y, z: Math.floor(o0.z) + z });
      if (!b) continue;
      if (/wheat|carrots|potatoes|beetroot/.test(b.typeId)) {
        b.setPermutation(b.permutation.withState(/** @type {any} */ ("growth"), b.typeId.includes("beetroot") ? 3 : 7));
        n++;
      } else if (b.typeId === "minecraft:dirt" && b.above()?.isAir && Math.random() < 0.6) {
        b.setType("minecraft:grass_block");
        n++;
      } else if (b.typeId === "minecraft:grass_block" && b.above()?.isAir && Math.random() < 0.12) {
        b.above()?.setType(["minecraft:poppy", "minecraft:dandelion", "minecraft:cornflower", "minecraft:oxeye_daisy", "minecraft:allium", "minecraft:short_grass"][Math.floor(Math.random() * 6)]);
        n++;
      }
    } catch {
      /* ignore */
    }
  }
  for (const a of alliesNear(p, r)) {
    heal(a, 8);
    eff(a, "regeneration", 200, 1);
  }
  V.ring(dim, o0, "god", r, 0.8);
  V.emit(dim, "lila:vfx_stars", v3(o0.x, o0.y + 1, o0.z), { c: [0.7, 1, 0.6], n: 16, size: r * 0.6 });
  V.emit(dim, "lila:vfx_feather", v3(o0.x, o0.y + 2, o0.z), { c: [0.75, 1, 0.7], n: 10, size: 2 });
  sound(ctx, "item.bone_meal.use", 1, 1);
  ctx.touched = 1;
  ctx.msg = `${n} brotos de vida`;
  ctx.pose = "pray";
};

SPECIAL_RUN.o_smite = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const list = foesNear(p, p.location, P(ctx, "r", 20)).filter((t) => d3(t.location, p.location) > 3).slice(0, P(ctx, "n", 5));
  if (!list.length) return "Nenhum inimigo longe o bastante para o raio.";
  for (const t of list) {
    try {
      dim.spawnEntity("minecraft:lightning_bolt", { ...t.location });
    } catch {
      /* ignore */
    }
    V.bolt(dim, v3(t.location.x + rnd(-2, 2), t.location.y + 18, t.location.z + rnd(-2, 2)), mid(t), "god", 1.2);
    strike(ctx, t, P(ctx, "d", 10), { holy: true, power: 1.4 });
  }
  ctx.pose = "roar";
};

SPECIAL_RUN.o_word = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const list = foesNear(p, p.location, P(ctx, "r", 16), 40);
  if (!list.length) return "Ninguém para ouvir a Palavra.";
  for (const t of list) {
    const h = hp(t);
    const dmg = BOSSES.has(t.typeId) || !h ? 15 : Math.min(60, h.effectiveMax * 0.35);
    strike(ctx, t, dmg, { holy: true, fx: false });
    V.emit(dim, "lila:vfx_runes", t.location, { c: [1, 0.9, 0.5], n: 4, size: 0.8 });
    V.flash(dim, mid(t), "god", 1.2);
  }
  V.ring(dim, p.location, "god", 16, 0.7);
  sound(ctx, "block.bell.hit", 1, 0.6);
  ctx.pose = "roar";
};

SPECIAL_RUN.o_sun = (ctx) => {
  const p = ctx.player, dim = p.dimension, base = aimPoint(p, P(ctx, "r", 14)), dur = P(ctx, "dur", 200);
  const sun = v3(base.x, base.y + 6, base.z);
  let lit = null;
  try {
    const b = dim.getBlock({ x: Math.floor(sun.x), y: Math.floor(sun.y), z: Math.floor(sun.z) });
    if (b?.isAir) {
      b.setType("minecraft:light_block_15");
      lit = { ...b.location };
    }
  } catch {
    /* ignore */
  }
  const unlight = () => {
    if (!lit) return;
    try {
      const b = dim.getBlock(lit);
      if (b?.typeId === "minecraft:light_block_15") b.setType("minecraft:air");
    } catch {
      /* ignore */
    }
    lit = null;
  };
  sound(ctx, "beacon.activate", 1, 0.8);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (k > dur) {
      unlight();
      return true;
    }
    if (k % 2 === 0) {
      V.emit(dim, "lila:vfx_flash", sun, { c: [1, 0.85, 0.4], size: 1.6 });
      V.emit(dim, "lila:vfx_orb", sun, { c: [1, 0.95, 0.6], size: 1.4 });
    }
    if (k % 10 === 0) {
      V.emit(dim, "lila:vfx_stars", sun, { c: [1, 0.9, 0.5], n: 4, size: 2 });
      for (const t of foesNear(p, base, 6)) {
        const und = isUndead(t);
        strike(ctx, t, und ? 6 : 3, { holy: true, fx: false, ignite: und ? 4 : 0 });
        V.trail(dim, sun, mid(t), "god", 0.6, 20);
      }
      for (const a of alliesNear(p, 64)) if (d3(a.location, base) < 7) eff(a, "regeneration", 30, 1);
    }
    return false;
  }, { cleanup: unlight });
  ctx.pose = "pray";
};

SPECIAL_RUN.o_creation = (ctx) => {
  const p = ctx.player, dim = p.dimension, o0 = { x: Math.floor(p.location.x), y: Math.floor(p.location.y), z: Math.floor(p.location.z) }, dur = P(ctx, "dur", 400);
  let n = 0;
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) for (let y = 0; y < 4; y++) if (placeTemp(dim, o0.x + dx, o0.y + y, o0.z + dz, "minecraft:white_stained_glass", dur)) n++;
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
    if (Math.abs(x) === 3 || Math.abs(z) === 3 || (x === 0 && z === 0)) if (placeTemp(dim, o0.x + x, o0.y + 4, o0.z + z, "minecraft:yellow_stained_glass", dur)) n++;
  }
  placeTemp(dim, o0.x, o0.y + 3, o0.z, "minecraft:light_block_15", dur);
  V.sigil(dim, p.location, "god", 4, 2);
  V.emit(dim, "lila:vfx_stars", v3(p.location.x, p.location.y + 2, p.location.z), { c: [1, 0.95, 0.7], n: 16, size: 3 });
  sound(ctx, "block.amethyst_block.chime", 1.2, 0.8);
  run(ctx, (o, tick) => {
    if (tick - o.t0 > dur) return true;
    if (tick % 20 === 0) for (const a of alliesNear(p, 64)) if (d3(a.location, o0) < 4) eff(a, "regeneration", 30, 1);
    return false;
  });
  ctx.msg = n ? "templo erguido" : "sem espaço para o templo";
  ctx.pose = "pray";
};

SPECIAL_RUN.o_stars = (ctx) => {
  const p = ctx.player, dim = p.dimension, dur = P(ctx, "dur", 200), n = 8;
  sound(ctx, "block.amethyst_block.chime", 1, 1.6);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!p.isValid || k > dur) return true;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = -k * 0.12 + (i / n) * Math.PI * 2;
      const at = v3(p.location.x + Math.cos(a) * 1.6, p.location.y + 2.4, p.location.z + Math.sin(a) * 1.6);
      pts.push(at);
      if (k % 2 === 0) V.emit(dim, "lila:vfx_stars", at, { c: [1, 0.95, 0.6], n: 1, size: 0.1 });
      V.emit(dim, "lila:vfx_dot", at, { c: [1, 0.9, 0.5], size: 0.3, life: 0.15 });
    }
    if (k % 20 === 0) {
      const foes = foesNear(p, p.location, 14);
      foes.slice(0, n).forEach((t, i) => {
        V.bolt(dim, pts[i], mid(t), "god", 0.3);
        strike(ctx, t, 4, { holy: true, fx: false });
      });
    }
    return false;
  });
  ctx.pose = "pray";
};

/** Histórico para Rebobinar (só jogadores DEUS, a cada 10 ticks, 8 s). */
export function godHistory(player) {
  let h = HISTORY.get(player.id);
  if (!h) HISTORY.set(player.id, (h = []));
  const c = hp(player);
  h.push({ at: { ...player.location }, dim: player.dimension, hp: c ? c.currentValue : 20 });
  if (h.length > 16) h.shift();
}
SPECIAL_RUN.o_rewind = (ctx) => {
  const p = ctx.player, h = HISTORY.get(p.id);
  if (!h || h.length < 2) {
    godHistory(p);
    return "Ainda sem passado para voltar (espere 1 s).";
  }
  const back = h[Math.max(0, h.length - 11)];
  const dim = p.dimension;
  V.swirl(dim, mid(p), "god", 1.8, true);
  V.ring(dim, p.location, "god", 2.5, 0.5);
  try {
    p.teleport(back.at, { dimension: back.dim, keepVelocity: false });
  } catch {
    return "Não deu para voltar no tempo.";
  }
  const c = hp(p);
  try {
    if (c && back.hp > c.currentValue) c.setCurrentValue(Math.min(c.effectiveMax, back.hp));
  } catch {
    /* ignore */
  }
  V.swirl(back.dim, v3(back.at.x, back.at.y + 1, back.at.z), "god", 1.8, false);
  V.sigil(back.dim, back.at, "god", 2, 0.9, 0);
  snd(back.dim, "block.bell.hit", back.at, 0.8, 1.6);
  h.splice(0, h.length);
  ctx.touched = 1;
  ctx.pose = "transform";
};

SPECIAL_RUN.o_doom = (ctx) => {
  const p = ctx.player, dim = p.dimension, o0 = { ...p.location }, R = 14, n = 12;
  V.sigil(dim, o0, "god", 16, 4.2);
  V.shake(dim, o0, 0.3, 1.5, 24);
  sound(ctx, "block.bell.hit", 1.4, 0.4);
  const spots = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 2 + Math.sqrt(Math.random()) * (R - 2);
    spots.push(v3(o0.x + Math.cos(a) * d, o0.y, o0.z + Math.sin(a) * d));
  }
  for (const f of foesNear(p, o0, R + 2).slice(0, 6)) spots[Math.floor(Math.random() * n)] = { ...f.location };
  let i = 0;
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (k < 40 || (k - 40) % 3 !== 0) return false;
    const at = spots[i++];
    if (!at) return true;
    V.pillar(dim, at, "god", 28, 2, 0.8);
    V.ring(dim, at, "god", 3, 0.4);
    for (const t of foesNear(p, at, 2.8)) strike(ctx, t, 14, { holy: true, fx: false });
    snd(dim, "random.explode", at, 0.6, 1.4);
    if (i % 3 === 0) V.shake(dim, o0, 0.25, 0.2, R + 6);
    return i >= spots.length;
  });
  ctx.pose = "roar";
};

SPECIAL_RUN.o_breath = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  for (const a of alliesNear(p, P(ctx, "r", 16))) {
    full(a);
    clean(a, NEG);
    eff(a, "absorption", 600, 3);
    eff(a, "resistance", 200, 0);
    V.pillar(dim, a.location, "god", 8, 1, 0.7);
    V.emit(dim, "lila:vfx_stars", mid(a), { c: [1, 0.95, 0.6], n: 8, size: 1 });
  }
  sound(ctx, "random.levelup", 1, 0.8);
  ctx.touched = 1;
  ctx.pose = "pray";
};

// ====================================================================== TREVAS
const VOID = [0.55, 0.2, 0.95];
SPECIAL_RUN.k_blackhole = (ctx) => {
  const p = ctx.player, dim = p.dimension, base = aimPoint(p, P(ctx, "r", 14)), dur = P(ctx, "dur", 100), R = 10;
  const c = v3(base.x, base.y + 1.5, base.z);
  sound(ctx, "mob.warden.sonic_charge", 1, 0.5);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (k > dur) {
      V.impact(dim, c, "dark", 2.4);
      V.swirl(dim, c, "dark", 5, false);
      V.ring(dim, base, "dark", 6, 0.6);
      V.shake(dim, c, 0.5, 0.4, 16);
      for (const t of foesNear(p, c, 5)) {
        if (!ashEntity(p, t)) strike(ctx, t, 14, { fx: false });
      }
      snd(dim, "random.explode", c, 1, 0.5);
      return true;
    }
    if (k % 2 === 0) {
      V.emit(dim, "lila:vfx_orb_d", c, { c: VOID, d: [0, 0, 0], size: 1.3 + Math.sin(k * 0.3) * 0.15 });
      for (const t of foesNear(p, c, R)) {
        const d = v3(c.x - t.location.x, c.y - t.location.y, c.z - t.location.z);
        const l = Math.hypot(d.x, d.y, d.z) || 1;
        knock(t, flatDir(d), Math.min(1.1, 0.25 + (R - l) * 0.08), Math.max(-0.1, Math.min(0.35, d.y * 0.08)));
      }
      try {
        for (const it of dim.getEntities({ location: c, maxDistance: R, type: "minecraft:item" })) it.teleport(add(it.location, v3(c.x - it.location.x, c.y - it.location.y, c.z - it.location.z), 0.2));
      } catch {
        /* ignore */
      }
    }
    if (k % 4 === 0) V.swirl(dim, c, "dark", R * 0.6, true);
    if (k % 10 === 0) for (const t of foesNear(p, c, 2.6)) strike(ctx, t, 3, { fx: false, magic: true });
    return false;
  });
  ctx.pose = "cast";
};

SPECIAL_RUN.k_eclipse = (ctx) => {
  const p = ctx.player, dim = p.dimension, dur = P(ctx, "dur", 300), r = P(ctx, "r", 14);
  eff(p, "invisibility", dur, 0);
  eff(p, "strength", dur, 1);
  eff(p, "night_vision", dur, 0);
  try {
    p.camera.fade({ fadeColor: { red: 0.02, green: 0, blue: 0.05 }, fadeTime: { fadeInTime: 0.2, holdTime: 0.4, fadeOutTime: 1 } });
  } catch {
    /* ignore */
  }
  V.dome(dim, p.location, "dark", r * 0.6);
  sound(ctx, "mob.warden.nearby_closer", 1, 0.6);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!p.isValid || k > dur) return true;
    if (k % 20 === 0) {
      for (const t of foesNear(p, p.location, r)) {
        eff(t, "blindness", 50, 0);
        eff(t, "darkness", 50, 0);
      }
      V.emit(dim, "lila:vfx_smoke", p.location, { c: [0.05, 0.02, 0.08], n: 4, size: 1.5 });
    }
    return false;
  });
  ctx.pose = "transform";
};

SPECIAL_RUN.k_harvest = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 5);
  let souls = 0;
  for (const t of foesNear(p, p.location, r)) {
    const before = hp(t)?.currentValue ?? 0;
    strike(ctx, t, 10, { fx: false });
    souls++;
    if (before <= 10) souls++;
  }
  for (let a = 0; a < 8; a++) V.slash(dim, v3(p.location.x + Math.cos(a * 0.785) * 2.2, p.location.y + 1.1, p.location.z + Math.sin(a * 0.785) * 2.2), "dark", 2.4, a * 45);
  V.ring(dim, p.location, "dark", r, 0.4);
  if (!souls) {
    ctx.touched = 1;
    return;
  }
  heal(p, souls * 2);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!p.isValid || k > 100) return true;
    for (let i = 0; i < Math.min(8, souls); i++) {
      const a = k * 0.15 + (i / Math.min(8, souls)) * Math.PI * 2;
      V.emit(dim, "lila:vfx_dot", v3(p.location.x + Math.cos(a) * 1.3, p.location.y + 1.3 + Math.sin(k * 0.2 + i) * 0.3, p.location.z + Math.sin(a) * 1.3), { c: [0.6, 0.9, 1], size: 0.3, life: 0.2 });
    }
    return false;
  });
  sound(ctx, "mob.wither.shoot", 0.6, 0.6);
  ctx.msg = `${souls} alma${souls === 1 ? "" : "s"}`;
  ctx.pose = "slash";
};

SPECIAL_RUN.k_voidstep = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const from = { ...p.location };
  const to = safeAhead(p, P(ctx, "r", 30));
  if (d3(from, to) < 2) return "Sem espaço à frente.";
  V.swirl(dim, mid(p), "dark", 1.6, true);
  if (!tp(p, to)) return "Sem espaço à frente.";
  V.trail(dim, v3(from.x, from.y + 1, from.z), v3(to.x, to.y + 1, to.z), "dark", 0.5, 60);
  V.swirl(dim, v3(to.x, to.y + 1, to.z), "dark", 1.6, false);
  const len = d3(from, to), dir = v3((to.x - from.x) / len, (to.y - from.y) / len, (to.z - from.z) / len);
  const hit = new Set();
  for (let k = 0; k <= len; k += 1.5) {
    for (const t of foesNear(p, add(from, dir, k), 1.8)) {
      if (hit.has(t.id)) continue;
      hit.add(t.id);
      strike(ctx, t, 8, { power: 0.8 });
      eff(t, "wither", 80, 1);
    }
  }
  snd(dim, "mob.endermen.portal", to, 1, 0.5);
  ctx.touched = 1;
  ctx.pose = "dash";
};

SPECIAL_RUN.k_clones = (ctx) => {
  const p = ctx.player, dim = p.dimension, n = P(ctx, "n", 3), dur = P(ctx, "dur", 200);
  for (let i = 0; i < n; i++) {
    let pos = v3(p.location.x + Math.cos(i * 2.1) * 1.5, p.location.y, p.location.z + Math.sin(i * 2.1) * 1.5), cd = 0;
    run(ctx, (o, tick) => {
      const k = tick - o.t0;
      if (!p.isValid || k > dur) {
        V.emit(dim, "lila:vfx_smoke", v3(pos.x, pos.y + 1, pos.z), { c: [0.05, 0.02, 0.08], n: 8, size: 1 });
        return true;
      }
      const t = foesNear(p, p.location, 16).sort((a, b) => d3(a.location, pos) - d3(b.location, pos))[0];
      const goal = t ? { ...t.location } : v3(p.location.x + Math.cos(i * 2.1 + k * 0.05) * 2, p.location.y, p.location.z + Math.sin(i * 2.1 + k * 0.05) * 2);
      const d = d3(pos, goal) || 1;
      pos = add(pos, v3((goal.x - pos.x) / d, (goal.y - pos.y) / d, (goal.z - pos.z) / d), Math.min(d, 0.8));
      if (k % 2 === 0) {
        for (let y = 0.3; y < 1.9; y += 0.5) V.emit(dim, "lila:vfx_smoke", v3(pos.x, pos.y + y, pos.z), { c: [0.04, 0.01, 0.07], n: 1, size: 0.6 });
        V.emit(dim, "lila:vfx_dot", v3(pos.x, pos.y + 1.6, pos.z), { c: [0.8, 0.5, 1], size: 0.2, life: 0.2 });
      }
      if (t && d < 1.8 && k >= cd) {
        cd = k + 20;
        strike(ctx, t, 5, { power: 0.6 });
        V.slash(dim, mid(t), "dark", 1.6);
      }
      return false;
    });
  }
  sound(ctx, "mob.evocation_illager.prepare_summon", 0.8, 0.5);
  ctx.pose = "pray";
};

SPECIAL_RUN.k_entropy = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const t = aimEntity(p, P(ctx, "r", 16));
  if (!t) return "Mire num alvo.";
  eff(t, "wither", 120, 2);
  eff(t, "slowness", 120, 1);
  V.trail(dim, ctx.head, mid(t), "dark", 0.5, 30);
  strike(ctx, t, 4, { power: 0.7 });
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!t.isValid || k > 120) return true;
    if (k % 10 === 0) {
      V.swirl(dim, mid(t), "dark", 1, true);
      V.emit(dim, "lila:vfx_smoke", mid(t), { c: [0.08, 0.03, 0.1], n: 2, size: 0.7 });
      try {
        t.applyDamage(1.5, { cause: EntityDamageCause.magic, damagingEntity: p });
      } catch {
        /* ignore */
      }
    }
    if (k >= 40 && (hp(t)?.currentValue ?? 99) <= 20 && ashEntity(p, t)) return true;
    return false;
  });
  ctx.pose = "cast";
};

SPECIAL_RUN.k_rift = (ctx) => {
  const p = ctx.player, dim = p.dimension, f = flatDir(ctx.dir), len = P(ctx, "r", 12), o0 = { ...p.location };
  const hit = new Set();
  let ash = 0;
  for (let k = 1; k <= len; k += 1) {
    const at = v3(o0.x + f.x * k, o0.y, o0.z + f.z * k);
    if (k % 2 === 0) V.emit(dim, "lila:vfx_crack", v3(at.x, at.y + 0.03, at.z), { c: [0.15, 0.02, 0.25], size: 1.4, life: 2 });
    V.emit(dim, "lila:vfx_dot_d", v3(at.x, at.y + 0.4, at.z), { c: VOID, d: [0, 0, 0], size: 0.6, life: 0.8 });
    for (const t of foesNear(p, at, 1.7)) {
      if (hit.has(t.id)) continue;
      hit.add(t.id);
      if (ashEntity(p, t)) ash++;
      else {
        strike(ctx, t, 10, { power: 0.9 });
        eff(t, "darkness", 80, 0);
      }
    }
  }
  V.swirl(dim, add(o0, f, len / 2), "dark", 3, true);
  snd(dim, "mob.warden.sonic_boom", o0, 0.6, 0.8);
  ctx.touched = 1;
  ctx.msg = ash ? `${ash} viraram cinza` : "";
  ctx.pose = "slash";
};

SPECIAL_RUN.k_nightmare = (ctx) => {
  const p = ctx.player, dim = p.dimension;
  const t = aimEntity(p, P(ctx, "r", 16));
  if (!t) return "Mire num alvo.";
  STUN.set(t.id, T() + 80);
  eff(t, "slowness", 80, 255);
  eff(t, "weakness", 80, 4);
  eff(t, "darkness", 80, 0);
  for (const f of foesNear(p, t.location, 8)) {
    if (f.id === t.id) continue;
    knock(f, flatDir(v3(f.location.x - t.location.x, 0, f.location.z - t.location.z)), 1.6, 0.3);
    eff(f, "weakness", 80, 1);
  }
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (!t.isValid || k > 80) return true;
    if (k % 20 === 0) V.sigil(dim, v3(t.location.x, t.location.y + 2.6, t.location.z), "dark", 0.9, 1);
    return false;
  });
  V.trail(dim, ctx.head, mid(t), "dark", 0.5, 30);
  sound(ctx, "mob.warden.roar", 0.6, 1.4);
  ctx.hits = 1;
  ctx.pose = "cast";
};

SPECIAL_RUN.k_nullify = (ctx) => {
  const p = ctx.player, dim = p.dimension, r = P(ctx, "r", 12);
  let n = 0;
  for (const t of foesNear(p, p.location, r)) {
    clean(t, POS);
    SILENCE.set(t.id, T() + 100);
    REVEAL.set(t.id, T() + 100);
    V.emit(dim, "lila:vfx_spark_d", mid(t), { c: VOID, d: [0, 0, 0], n: 8, size: 0.8 });
    n++;
  }
  clean(p, NEG);
  V.ring(dim, p.location, "dark", r, 0.6);
  V.swirl(dim, mid(p), "dark", 2, false);
  sound(ctx, "beacon.deactivate", 1, 0.5);
  ctx.touched = 1;
  ctx.msg = `${n} anulados`;
  ctx.pose = "cast";
};

SPECIAL_RUN.k_endless = (ctx) => {
  const p = ctx.player, dim = p.dimension, o0 = { ...p.location }, R = P(ctx, "r", 10), dur = P(ctx, "dur", 240);
  try {
    p.camera.fade({ fadeColor: { red: 0.03, green: 0, blue: 0.07 }, fadeTime: { fadeInTime: 0.3, holdTime: 0.3, fadeOutTime: 1 } });
  } catch {
    /* ignore */
  }
  sound(ctx, "mob.wither.spawn", 0.6, 0.5);
  run(ctx, (o, tick) => {
    const k = tick - o.t0;
    if (k > dur) {
      const c = v3(o0.x, o0.y + 1.5, o0.z);
      V.impact(dim, c, "dark", 2.6);
      V.swirl(dim, c, "dark", 7, false);
      V.ring(dim, o0, "dark", R, 0.7);
      V.shake(dim, c, 0.6, 0.6, R + 10);
      for (const t of foesNear(p, o0, 6)) if (!ashEntity(p, t)) strike(ctx, t, 20, { fx: false });
      snd(dim, "random.explode", c, 1, 0.4);
      return true;
    }
    if (k % 20 === 0) {
      V.dome(dim, o0, "dark", R);
      V.sigil(dim, o0, "dark", R, 1.1, 0);
      let drained = 0;
      for (const t of foesNear(p, o0, R)) {
        eff(t, "slowness", 30, 2);
        drained += strike(ctx, t, 4, { fx: false, magic: true });
        V.trail(dim, mid(t), mid(p), "dark", 0.7, 20);
      }
      if (p.isValid && d3(p.location, o0) <= R + 2) heal(p, drained * 0.5);
    }
    if (k % 10 === 5) V.swirl(dim, v3(o0.x, o0.y + 1.5, o0.z), "dark", R * 0.5, true);
    return false;
  });
  ctx.pose = "roar";
};

