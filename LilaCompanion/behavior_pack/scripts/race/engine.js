// Motor dos 600 poderes. Tudo no servidor: validação (raça, dono, recarga, custo, estado, alvo,
// alcance, linha de visão, PvP), execução das formas, efeitos, recargas em tempo absoluto do mundo e
// recurso da raça. O cliente só vê partículas/sons/animação.
import { BlockPermutation, EntityDamageCause, GameMode, ItemStack, MolangVariableMap, system, world } from "@minecraft/server";
import { BY_ID } from "./catalog.js";
import { BAL, RACES } from "./data.js";
import { now, saveState, stateOf } from "./state.js";
import * as V from "./vfx.js";

const ACTIVE = [];          // projéteis, zonas, órbitas, avanços, quedas... (lista curta, limitada)
const MAX_ACTIVE = 160;
export const DOTS = new Map();     // id → {bleed/burn/decay}
export const MARKS = new Map();    // id → tick até quando leva +25% de dano
export const SILENCE = new Map();  // id → tick
export const STUN = new Map();     // id → tick
export const THORNS = new Map();   // id do jogador → {dmg, until}
export const REVEAL = new Map();   // id → tick (revelado: partícula em cima)
export const TEMP_BLOCKS = [];     // blocos temporários (pontes, muros, domos) para desfazer
export const LAST = { outcome: null };
const lastCast = new Map();

/** Partículas por raça: rastro, impacto, área. Sons de lançamento e de impacto. */
export const FX = {
  vampire: { trail: "lila:rc_vampire_trail", burst: "lila:rc_vampire_burst", zone: "lila:rc_vampire_zone", cast: "mob.bat.takeoff", hit: "mob.vex.hurt" },
  giant: { trail: "lila:rc_giant_trail", burst: "lila:rc_giant_burst", zone: "lila:rc_giant_zone", cast: "mob.irongolem.throw", hit: "dig.stone" },
  angel: { trail: "lila:rc_angel_trail", burst: "lila:rc_angel_burst", zone: "lila:rc_angel_zone", cast: "random.orb", hit: "beacon.power" },
  demon: { trail: "lila:rc_demon_trail", burst: "lila:rc_demon_burst", zone: "lila:rc_demon_zone", cast: "mob.blaze.shoot", hit: "mob.ghast.fireball" },
  god: { trail: "lila:rc_god_trail", burst: "lila:rc_god_burst", zone: "lila:rc_god_zone", cast: "beacon.activate", hit: "random.levelup" },
  dark: { trail: "lila:rc_dark_trail", burst: "lila:rc_dark_burst", zone: "lila:rc_dark_zone", cast: "mob.wither.shoot", hit: "mob.endermen.portal" },
};

const BOSSES = new Set(["minecraft:ender_dragon", "minecraft:wither", "minecraft:warden", "minecraft:elder_guardian"]);
const NEGATIVE = ["slowness", "mining_fatigue", "nausea", "blindness", "hunger", "weakness", "poison", "wither", "levitation", "darkness", "bad_omen", "fatal_poison"];
const POSITIVE = ["speed", "haste", "strength", "jump_boost", "regeneration", "resistance", "fire_resistance", "water_breathing", "invisibility", "night_vision",
  "health_boost", "absorption", "saturation", "slow_falling"];
const EFF = { slow: "slowness", weak: "weakness", poison: "poison", wither: "wither", haste: "haste", strength: "strength", speed: "speed", jump: "jump_boost",
  res: "resistance", regen: "regeneration", slowfall: "slow_falling", blind: "blindness", dark: "darkness", invis: "invisibility", fireres: "fire_resistance",
  nv: "night_vision", wb: "water_breathing", lev: "levitation" };
const UNBREAKABLE = /bedrock|barrier|command_block|structure_block|structure_void|jigsaw|end_portal|portal|end_gateway|reinforced_deepslate|light_block|allow|deny|border_block|chest|barrel|shulker|furnace|smoker|hopper|dispenser|dropper|beacon|spawner|vault|lectern|brewing_stand|enchanting_table|ender_chest|bed$|_bed$|respawn_anchor|lodestone|conduit/;
const REPLACEABLE = new Set(["minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava", "minecraft:short_grass",
  "minecraft:tall_grass", "minecraft:fern", "minecraft:snow_layer", "minecraft:fire", "minecraft:deadbush", "minecraft:vine"]);
const RACE_BLOCK = { vampire: "minecraft:red_stained_glass", giant: "minecraft:polished_tuff", angel: "minecraft:white_stained_glass", demon: "minecraft:magma",
  god: "minecraft:yellow_stained_glass", dark: "minecraft:black_stained_glass" };

// ------------------------------------------------------------------ utilidades
const v3 = (x, y, z) => ({ x, y, z });
const add = (a, b, k = 1) => v3(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flatDir = (d) => {
  const l = Math.hypot(d.x, d.z) || 1;
  return v3(d.x / l, 0, d.z / l);
};

let LOWFX = false; // "efeitos reduzidos" de quem está lançando: 1 de cada 3 partículas
export function fx(dim, id, at, vars) {
  if (LOWFX && Math.random() < 0.67) return;
  try {
    if (vars) {
      const m = new MolangVariableMap();
      for (const [k, v] of Object.entries(vars)) m.setFloat(`variable.${k}`, v);
      dim.spawnParticle(id, at, m);
    } else dim.spawnParticle(id, at);
  } catch {
    /* fora da área carregada */
  }
}
function line(dim, a, b, id, step = 1.2, max = 24) {
  const d = d3(a, b);
  const n = Math.min(max, Math.max(1, Math.ceil(d / step)));
  for (let i = 1; i <= n; i++) fx(dim, id, add(a, v3(b.x - a.x, b.y - a.y, b.z - a.z), i / (n + 1)));
}
function snd(dim, id, at, vol = 0.8, pitch = 1) {
  try {
    dim.playSound(id, at, { volume: vol, pitch });
  } catch {
    /* ignore */
  }
}
const hp = (e) => {
  try {
    return e.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
};
export const raceOfEntity = (e) => (e?.typeId === "minecraft:player" ? stateOf(e).race : null);
const isUndead = (e) => {
  try {
    return e.matches({ families: ["undead"] });
  } catch {
    return false;
  }
};

/** Quem pode ser atingido: criaturas vivas, nunca você, itens, nem os seus companheiros; jogadores só com PvP ligado. */
export function canHit(player, t) {
  if (!t?.isValid || t.id === player.id) return false;
  const id = t.typeId;
  if (id === "minecraft:item" || id === "minecraft:xp_orb" || id === "minecraft:arrow" || id.startsWith("lila:roulette")) return false;
  if ((id === "lila:drone" || id === "lila:robot") && t.getDynamicProperty?.("lila:owner") === player.id) return false;
  if (!hp(t)) return false;
  if (id === "minecraft:player") {
    try {
      if (!world.gameRules.pvp) return false;
      const gm = /** @type {any} */ (t).getGameMode?.();
      if (gm === GameMode.Creative || gm === GameMode.Spectator) return false;
    } catch {
      /* ignore */
    }
  }
  return true;
}
function foesNear(player, at, r, max = 24) {
  const out = [];
  try {
    for (const e of player.dimension.getEntities({ location: at, maxDistance: r })) {
      if (canHit(player, e)) out.push(e);
      if (out.length >= max) break;
    }
  } catch {
    /* ignore */
  }
  return out;
}
function alliesNear(player, r) {
  const out = [player];
  try {
    for (const p of player.dimension.getPlayers({ location: player.location, maxDistance: r })) if (p.id !== player.id) out.push(p);
  } catch {
    /* ignore */
  }
  return out;
}
function aimEntity(player, r, allies = false) {
  try {
    for (const h of player.dimension.getEntitiesFromRay(player.getHeadLocation(), player.getViewDirection(), { maxDistance: r })) {
      if (h.entity.id === player.id) continue;
      if (canHit(player, h.entity) || (allies && h.entity.typeId === "minecraft:player")) return h.entity;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}
function aimPoint(player, r) {
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  try {
    const hit = player.dimension.getBlockFromRay(head, dir, { maxDistance: r, includeLiquidBlocks: false, includePassableBlocks: false });
    if (hit) return v3(hit.block.location.x + 0.5, hit.block.location.y + 1, hit.block.location.z + 0.5);
  } catch {
    /* ignore */
  }
  return add(head, dir, r);
}
function eff(e, name, ticks, amp = 0) {
  try {
    e.addEffect(name, Math.max(1, Math.round(ticks)), { amplifier: Math.max(0, Math.min(255, Math.round(amp))), showParticles: false });
  } catch {
    /* efeito inexistente / entidade não aceita */
  }
}
function knock(e, dir, h, v) {
  try {
    e.applyKnockback({ x: dir.x * h, z: dir.z * h }, v);
  } catch {
    try {
      e.applyImpulse({ x: dir.x * h * 0.5, y: v * 0.5, z: dir.z * h * 0.5 });
    } catch {
      /* ignore */
    }
  }
}
export const silenced = (e) => (SILENCE.get(e.id) ?? 0) > system.currentTick || (STUN.get(e.id) ?? 0) > system.currentTick;

function placeTemp(dim, x, y, z, id, ticks) {
  try {
    const b = dim.getBlock({ x, y, z });
    if (!b || !REPLACEABLE.has(b.typeId)) return false;
    b.setType(id);
    TEMP_BLOCKS.push({ d: dim.id, x, y, z, id, until: system.currentTick + ticks });
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ efeitos
/**
 * Aplica os efeitos "no alvo" de um poder. Retorna o dano causado (para roubo de vida).
 * @param {any} ctx  {player, a, race, fx}
 */
export function hitTarget(ctx, t, mult = 1) {
  const { player, a, race } = ctx;
  if (!t?.isValid) return 0;
  const away = flatDir(v3(t.location.x - player.location.x, 0, t.location.z - player.location.z));
  const holy = a.foe.some((e) => e.k === "holy");
  let dealt = 0;
  const h = hp(t);
  for (const e of a.foe) {
    switch (e.k) {
      case "dmg": {
        let dmg = e.a * mult;
        if (holy) {
          const tr = raceOfEntity(t);
          if (tr === "dark") dmg *= 1 + BAL.holyVsDark;
          else if (tr === "demon" || isUndead(t)) dmg *= 1 + BAL.holyBonus;
        }
        if ((MARKS.get(t.id) ?? 0) > system.currentTick) dmg *= 1.25;
        try {
          t.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
          dealt += dmg;
        } catch {
          /* ignore */
        }
        break;
      }
      case "heal":
        try {
          if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + e.a));
        } catch {
          /* ignore */
        }
        break;
      case "bleed": case "burn": case "decay": {
        if (e.k === "burn") {
          try {
            t.setOnFire(e.a, true);
          } catch {
            /* ignore */
          }
        }
        if (e.k !== "burn") DOTS.set(t.id, { e: t, owner: player, kind: e.k, until: system.currentTick + e.a * 20, dmg: e.k === "decay" ? 1.5 : 1 });
        break;
      }
      case "kb": knock(t, away, e.a, 0.3); break;
      case "up": knock(t, away, 0.15, e.a); break;
      case "pull": knock(t, v3(-away.x, 0, -away.z), e.a, 0.2); break;
      case "stun": STUN.set(t.id, system.currentTick + e.a); eff(t, "slowness", e.a, 6); eff(t, "weakness", e.a, 4); eff(t, "mining_fatigue", e.a, 3); break;
      case "root": eff(t, "slowness", e.a, 7); eff(t, "jump_boost", e.a, 128); break;
      case "silence": SILENCE.set(t.id, system.currentTick + e.a); eff(t, "weakness", e.a, 1); break;
      case "glow": REVEAL.set(t.id, system.currentTick + (e.a || 100)); try {
        t.removeEffect("invisibility");
      } catch {
        /* ignore */
      } break;
      case "mark": MARKS.set(t.id, system.currentTick + (e.a > 1 ? e.a : 200)); REVEAL.set(t.id, system.currentTick + (e.a > 1 ? e.a : 200)); break;
      case "fear": knock(t, away, 1.6, 0.3); eff(t, "weakness", 80, 1); eff(t, "slowness", 60, 0); break;
      case "cleansefoe": for (const n of POSITIVE) try {
        t.removeEffect(n);
      } catch {
        /* ignore */
      } break;
      case "cleanse": for (const n of NEGATIVE) try {
        t.removeEffect(n);
      } catch {
        /* ignore */
      } break;
      case "execute":
        try {
          if (h && !BOSSES.has(t.typeId) && h.currentValue / h.effectiveMax <= e.a / 100) {
            t.applyDamage(h.currentValue + 50, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
            V.impact(t.dimension, v3(t.location.x, t.location.y + 1, t.location.z), race, 1.6);
          }
        } catch {
          /* ignore */
        }
        break;
      case "ignite": try {
        t.setOnFire(5, true);
      } catch {
        /* ignore */
      } break;
      case "ash": ashEntity(player, t); break;
      case "shield": eff(t, "absorption", e.t || 200, e.a - 1); break;
      case "absorb": eff(t, "absorption", 600, e.a - 1); break;
      case "thorns": break;
      case "sat": eff(t, "saturation", 1, e.a); break;
      case "silencez": SILENCE.set(t.id, system.currentTick + 30); break;
      case "holy": case "blast": case "steal": case "hurtself": case "weakself": case "glowself": break;
      default:
        if (EFF[e.k]) eff(t, EFF[e.k], e.t || (e.k === "lev" ? e.a : 100), e.k === "lev" || ["blind", "dark", "invis", "fireres", "nv", "wb"].includes(e.k) ? 0 : e.a - 1);
    }
  }
  if (dealt > 0) {
    const steal = a.foe.find((e) => e.k === "steal") ?? a.self.find((e) => e.k === "steal");
    if (steal) heal(player, (dealt * steal.a) / 100);
    ctx.hits = (ctx.hits ?? 0) + 1;
    V.impact(t.dimension, v3(t.location.x, t.location.y + 1, t.location.z), race, 0.8);
  } else ctx.touched = (ctx.touched ?? 0) + 1;
  return dealt;
}

export function heal(p, n) {
  const h = hp(p);
  try {
    if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + n));
  } catch {
    /* ignore */
  }
}

/** Efeitos "em você". */
function selfEffects(ctx) {
  const { player, a } = ctx;
  for (const e of a.self) {
    switch (e.k) {
      case "heal": heal(player, e.a); break;
      case "shield": eff(player, "absorption", e.t || 200, e.a - 1); break;
      case "absorb": eff(player, "absorption", 600, e.a - 1); break;
      case "thorns": THORNS.set(player.id, { dmg: e.a, until: system.currentTick + (e.t || 160) }); break;
      case "cleanse": for (const n of NEGATIVE) try {
        player.removeEffect(n);
      } catch {
        /* ignore */
      } break;
      case "sat": eff(player, "saturation", 1, e.a); break;
      case "hurtself": try {
        player.applyDamage(e.a, { cause: EntityDamageCause.magic });
      } catch {
        /* ignore */
      } break;
      case "weakself": eff(player, "weakness", e.t || 100, e.a - 1); break;
      case "glowself": REVEAL.set(player.id, system.currentTick + (e.t || 160)); break;
      case "steal": break;
      default:
        if (EFF[e.k]) eff(player, EFF[e.k], e.t || 100, ["invis", "fireres", "nv", "wb", "blind", "dark"].includes(e.k) ? 0 : e.k === "lev" ? 0 : e.a - 1);
        if (e.k === "lev") eff(player, "levitation", e.a || 20, 1);
    }
  }
  ctx.selfDone = a.self.length > 0;
}

function impact(ctx, at, r) {
  const list = foesNear(ctx.player, at, r);
  for (const t of list) hitTarget(ctx, t);
  V.impact(ctx.player.dimension, at, ctx.race, Math.min(2.2, 0.8 + r * 0.3));
  if (r >= 2) V.ring(ctx.player.dimension, at, ctx.race, r, 0.4);
  return list.length;
}
function blastOf(a) {
  return a.foe.find((e) => e.k === "blast")?.a ?? 0;
}

/** Cinzas (TREVAS): criaturas comuns fracas viram pó; chefes e jogadores nunca. */
export function ashEntity(player, t) {
  if (!t?.isValid || t.typeId === "minecraft:player" || BOSSES.has(t.typeId)) return false;
  const h = hp(t);
  if (!h || h.currentValue > 20) return false;
  const at = v3(t.location.x, t.location.y + 0.8, t.location.z);
  fx(t.dimension, "lila:rc_ash", at);
  snd(t.dimension, "dig.sand", at, 0.8, 0.6);
  try {
    t.applyDamage(h.currentValue + 20, { cause: EntityDamageCause.entityAttack, damagingEntity: player });
  } catch {
    /* ignore */
  }
  return true;
}

// ------------------------------------------------------------------ formas
function pushActive(o) {
  if (ACTIVE.length >= MAX_ACTIVE) {
    const old = ACTIVE.shift();
    try {
      old?.cleanup?.();
    } catch {
      /* ignore */
    }
  }
  ACTIVE.push(o);
}

const SHAPE = {
  target(ctx) {
    const healing = ctx.a.foe.some((e) => e.k === "heal") && !ctx.a.foe.some((e) => e.k === "dmg");
    const t = aimEntity(ctx.player, ctx.a.p.r ?? 6, healing) ?? (healing ? ctx.player : undefined);
    if (!t) return "Mire numa criatura ao alcance.";
    V.trail(ctx.player.dimension, ctx.head, v3(t.location.x, t.location.y + 1, t.location.z), ctx.race);
    hitTarget(ctx, t);
  },
  mark(ctx) {
    return SHAPE.target(ctx);
  },
  proj(ctx, angle = 0, extra = {}) {
    const d = ctx.dir;
    const c = Math.cos((angle * Math.PI) / 180), s = Math.sin((angle * Math.PI) / 180);
    const dir = v3(d.x * c - d.z * s, d.y, d.x * s + d.z * c);
    const spd = (ctx.a.p.spd ?? 1.6) * (extra.spd ?? 1);
    pushActive({ k: "proj", ctx, pos: add(ctx.head, dir, 0.8), vel: v3(dir.x * spd, dir.y * spd, dir.z * spd), dist: 0, max: ctx.a.p.r ?? 24, grav: extra.grav ?? 0, hit: new Set(),
      ret: extra.ret ?? false, back: false });
  },
  volley(ctx) {
    const n = ctx.a.p.n ?? 5;
    for (let i = 0; i < n; i++) SHAPE.proj(ctx, n === 1 ? 0 : -24 + (48 * i) / (n - 1));
  },
  lob(ctx) {
    SHAPE.proj(ctx, 0, { grav: 0.05, spd: 0.8 });
  },
  boomerang(ctx) {
    SHAPE.proj(ctx, 0, { ret: true });
  },
  beam(ctx) {
    const r = ctx.a.p.r ?? 20;
    const dim = ctx.player.dimension;
    let end = add(ctx.head, ctx.dir, r);
    try {
      const hb = dim.getBlockFromRay(ctx.head, ctx.dir, { maxDistance: r });
      if (hb) end = v3(hb.block.location.x + 0.5, hb.block.location.y + 0.5, hb.block.location.z + 0.5);
    } catch {
      /* ignore */
    }
    V.beam(dim, add(ctx.head, ctx.dir, 0.6), end, ctx.race, 0.45);
    const len = d3(ctx.head, end);
    const seen = new Set();
    for (let k = 1; k <= len; k += 1.5) {
      for (const t of foesNear(ctx.player, add(ctx.head, ctx.dir, k), 1.6)) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        hitTarget(ctx, t);
      }
    }
  },
  cone(ctx) {
    const r = ctx.a.p.r ?? 6;
    const f = flatDir(ctx.dir);
    for (const t of foesNear(ctx.player, ctx.player.location, r)) {
      const to = flatDir(v3(t.location.x - ctx.player.location.x, 0, t.location.z - ctx.player.location.z));
      if (to.x * f.x + to.z * f.z > 0.6) hitTarget(ctx, t);
    }
    const dim = ctx.player.dimension, o = ctx.player.location;
    for (const [k, sz] of [[0.35, 1.4], [0.6, 2.0], [0.85, 2.6]]) V.slash(dim, v3(o.x + f.x * r * k, o.y + 1.1, o.z + f.z * r * k), ctx.race, sz * Math.max(1, r / 6), 200 + Math.random() * 40);
    V.emit(dim, "lila:vfx_spark", v3(o.x + f.x * r * 0.5, o.y + 1, o.z + f.z * r * 0.5), { c: V.STYLE[ctx.race].g, n: 14, size: 1.2, grav: 2 });
  },
  pull(ctx) {
    return SHAPE.cone(ctx);
  },
  nova(ctx) {
    const r = ctx.a.p.r ?? 5;
    for (const t of foesNear(ctx.player, ctx.player.location, r)) hitTarget(ctx, t);
    const dim = ctx.player.dimension, o = ctx.player.location;
    V.ring(dim, o, ctx.race, r, 0.5);
    V.sigil(dim, o, ctx.race, r * 0.75, 0.7);
    V.impact(dim, v3(o.x, o.y + 1, o.z), ctx.race, 1.5);
    V.shake(dim, o, 0.15, 0.25, r + 6);
  },
  wave(ctx, dirOverride) {
    const f = dirOverride ?? flatDir(ctx.dir);
    pushActive({ k: "wave", ctx, pos: v3(ctx.player.location.x, ctx.player.location.y + 0.3, ctx.player.location.z), dir: f, dist: 0, max: ctx.a.p.r ?? 14, hit: new Set() });
  },
  cross(ctx) {
    const f = flatDir(ctx.dir);
    for (const d of [f, v3(-f.z, 0, f.x), v3(-f.x, 0, -f.z), v3(f.z, 0, -f.x)]) SHAPE.wave(ctx, d);
  },
  pillar(ctx) {
    const t = aimEntity(ctx.player, ctx.a.p.r ?? 16);
    const at = t ? v3(t.location.x, t.location.y, t.location.z) : aimPoint(ctx.player, ctx.a.p.r ?? 16);
    V.sigil(ctx.player.dimension, at, ctx.race, 1.8, 0.7);
    pushActive({ k: "delay", ctx, at, t: 10, r: 1.8, col: true });
  },
  rain(ctx) {
    const c = aimPoint(ctx.player, ctx.a.p.r ? Math.max(12, ctx.a.p.r * 2) : 16);
    const n = ctx.a.p.n ?? 8, R = ctx.a.p.r ?? 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R * 0.6;
      pushActive({ k: "delay", ctx, at: v3(c.x + Math.cos(a) * d, c.y, c.z + Math.sin(a) * d), t: 6 + i * 3, r: 1.8, col: true });
    }
  },
  chain(ctx) {
    let cur = aimEntity(ctx.player, ctx.a.p.r ?? 12) ?? foesNear(ctx.player, ctx.player.location, ctx.a.p.r ?? 12)[0];
    if (!cur) return "Nenhum alvo para a corrente.";
    const hit = new Set();
    let from = ctx.head;
    for (let i = 0; i < (ctx.a.p.n ?? 4) && cur; i++) {
      hit.add(cur.id);
      const to = v3(cur.location.x, cur.location.y + 1, cur.location.z);
      if (ctx.race === "demon") V.chain(ctx.player.dimension, from, to, ctx.race, 0.5);
      else if (ctx.race === "vampire" || ctx.race === "giant" || ctx.race === "dark") V.trail(ctx.player.dimension, from, to, ctx.race, 0.5, 30);
      else V.bolt(ctx.player.dimension, from, to, ctx.race);
      hitTarget(ctx, cur, 1 - i * 0.08);
      from = to;
      cur = foesNear(ctx.player, cur.location, 7).find((e) => !hit.has(e.id));
    }
  },
  grab(ctx) {
    const t = aimEntity(ctx.player, ctx.a.p.r ?? 8);
    if (!t) return "Mire numa criatura para agarrar.";
    const p = ctx.player.location, f = flatDir(ctx.dir);
    V.chain(ctx.player.dimension, ctx.head, v3(t.location.x, t.location.y + 1, t.location.z), ctx.race, 0.35);
    try {
      t.teleport(v3(p.x + f.x * 1.6, p.y, p.z + f.z * 1.6));
    } catch {
      /* ignore */
    }
    hitTarget(ctx, t);
  },
  throw(ctx) {
    const t = aimEntity(ctx.player, ctx.a.p.r ?? 5) ?? foesNear(ctx.player, ctx.player.location, ctx.a.p.r ?? 5)[0];
    if (!t) return "Ninguém perto para arremessar.";
    hitTarget(ctx, t);
    knock(t, flatDir(ctx.dir), 2.2, 1.0);
    V.slash(ctx.player.dimension, v3(t.location.x, t.location.y + 1, t.location.z), ctx.race, 2.2, 300);
  },
  slam(ctx, big = false) {
    const f = flatDir(ctx.dir);
    knock(ctx.player, f, big ? 1.6 : 1.1, big ? 1.4 : 0.9);
    pushActive({ k: "slam", ctx, t0: system.currentTick, r: big ? 5.5 : 4 });
  },
  leapslam(ctx) {
    SHAPE.slam(ctx, true);
  },
  leap(ctx) {
    knock(ctx.player, flatDir(ctx.dir), 1.7, 0.7);
    pushActive({ k: "slam", ctx, t0: system.currentTick, r: 3 });
  },
  dash(ctx) {
    knock(ctx.player, flatDir(ctx.dir), Math.min(3.5, (ctx.a.p.r ?? 10) / 4), 0.15);
    pushActive({ k: "dash", ctx, t: 8, hit: new Set() });
  },
  blink(ctx) {
    const r = ctx.a.p.r ?? 10;
    const dim = ctx.player.dimension;
    let dist = r;
    try {
      const hb = dim.getBlockFromRay(ctx.head, ctx.dir, { maxDistance: r });
      if (hb) dist = Math.max(0, d3(ctx.head, hb.block.location) - 1.5);
    } catch {
      /* ignore */
    }
    const to = add(ctx.player.location, ctx.dir, dist);
    const from = v3(ctx.player.location.x, ctx.player.location.y + 1, ctx.player.location.z);
    V.swirl(dim, from, ctx.race, 1.6, true);
    V.flash(dim, from, ctx.race, 1);
    try {
      ctx.player.teleport(to, { keepVelocity: false });
    } catch {
      return "Sem espaço para teleportar.";
    }
    V.trail(dim, from, v3(to.x, to.y + 1, to.z), ctx.race, 0.6, 30);
    V.impact(dim, v3(to.x, to.y + 1, to.z), ctx.race, 1.1);
    for (const t of foesNear(ctx.player, to, 2.5)) hitTarget(ctx, t);
  },
  swap(ctx) {
    const t = aimEntity(ctx.player, ctx.a.p.r ?? 16);
    if (!t) return "Mire em alguém para trocar de lugar.";
    const a = { ...ctx.player.location }, b = { ...t.location };
    try {
      ctx.player.teleport(b);
      t.teleport(a);
    } catch {
      /* ignore */
    }
    V.bolt(ctx.player.dimension, v3(a.x, a.y + 1, a.z), v3(b.x, b.y + 1, b.z), ctx.race, 0.4);
    hitTarget(ctx, t);
  },
  tether(ctx) {
    const at = aimPoint(ctx.player, ctx.a.p.r ?? 20);
    V.chain(ctx.player.dimension, ctx.head, at, ctx.race, 0.8);
    const t = aimEntity(ctx.player, ctx.a.p.r ?? 20);
    if (t && ctx.a.foe.length) hitTarget(ctx, t);
    pushActive({ k: "tether", ctx, at, t: 30 });
  },
  orbit(ctx) {
    pushActive({ k: "orbit", ctx, until: system.currentTick + (ctx.a.p.dur ?? 100), r: ctx.a.p.r ?? 3, last: new Map() });
  },
  zone(ctx) {
    const at = ctx.a.foe.length ? aimPoint(ctx.player, 10) : { ...ctx.player.location };
    pushActive({ k: "zone", ctx, at, until: system.currentTick + (ctx.a.p.dur ?? 100), r: ctx.a.p.r ?? 5, pullK: 0 });
  },
  vortex(ctx) {
    const at = aimPoint(ctx.player, 12);
    const pull = ctx.a.foe.find((e) => e.k === "pull")?.a ?? 0.6;
    pushActive({ k: "zone", ctx, at, until: system.currentTick + (ctx.a.p.dur ?? 80), r: ctx.a.p.r ?? 6, pullK: pull });
  },
  trap(ctx) {
    const at = aimPoint(ctx.player, ctx.a.p.r ?? 12);
    pushActive({ k: "trap", ctx, at, until: system.currentTick + (ctx.a.p.dur ?? 200) });
    V.sigil(ctx.player.dimension, at, ctx.race, 1.3, 1);
  },
  dome(ctx) {
    const r = ctx.a.p.r ?? 3, dur = ctx.a.p.dur ?? 140;
    const dim = ctx.player.dimension, o = ctx.player.location;
    const fxo = Math.floor(o.x), fyo = Math.floor(o.y), fzo = Math.floor(o.z);
    for (let x = -r; x <= r; x++) for (let y = 0; y <= r; y++) for (let z = -r; z <= r; z++) {
      const d = Math.hypot(x, y, z);
      if (d > r + 0.5 || d < r - 0.5) continue;
      placeTemp(dim, fxo + x, fyo + y, fzo + z, RACE_BLOCK[ctx.race], dur);
    }
    V.dome(dim, o, ctx.race, r + 0.3);
    V.ring(dim, o, ctx.race, r + 1, 0.5);
    for (const t of foesNear(ctx.player, o, r + 1)) hitTarget(ctx, t);
  },
  wall(ctx) {
    const r = ctx.a.p.r ?? 4, dur = ctx.a.p.dur ?? 140;
    const f = flatDir(ctx.dir), s = v3(-f.z, 0, f.x), o = ctx.player.location;
    for (let k = -r; k <= r; k++) for (let y = 0; y < 3; y++) {
      placeTemp(ctx.player.dimension, Math.floor(o.x + f.x * 3 + s.x * k), Math.floor(o.y) + y, Math.floor(o.z + f.z * 3 + s.z * k), RACE_BLOCK[ctx.race], dur);
    }
    V.accent(ctx.player.dimension, add(o, f, 3), ctx.race, 14, 1.6);
    V.ring(ctx.player.dimension, add(o, f, 3), ctx.race, r, 0.4);
    for (const t of foesNear(ctx.player, add(o, f, 3), r)) hitTarget(ctx, t);
  },
  aura(ctx) {
    const s = ctx.s;
    s.tog[ctx.a.id] = !s.tog[ctx.a.id];
    ctx.msg = s.tog[ctx.a.id] ? `${ctx.a.name}: LIGADA` : `${ctx.a.name}: desligada`;
    ctx.touched = 1;
  },
  summon(ctx) {
    const n = ctx.a.p.n ?? 4;
    for (let i = 0; i < n; i++) pushActive({ k: "spirit", ctx, ang: (i / n) * Math.PI * 2, until: system.currentTick + (ctx.a.p.dur ?? 160), pos: { ...ctx.player.location }, cd: 0 });
    ctx.touched = n;
  },
  self(ctx) {
    V.sigil(ctx.player.dimension, ctx.player.location, ctx.race, 1.6, 0.9);
    V.runes(ctx.player.dimension, ctx.player.location, ctx.race, 0.9);
  },
  ally(ctx) {
    for (const p of alliesNear(ctx.player, ctx.a.p.r ?? 8)) hitTarget({ ...ctx, a: { ...ctx.a, foe: ctx.a.foe.filter((e) => e.k !== "dmg") } }, p);
    V.ring(ctx.player.dimension, ctx.player.location, ctx.race, ctx.a.p.r ?? 8, 0.6);
    V.runes(ctx.player.dimension, ctx.player.location, ctx.race, 1.4);
    ctx.touched = (ctx.touched ?? 0) + 1;
  },
  firetrail(ctx) {
    pushActive({ k: "trail", ctx, until: system.currentTick + (ctx.a.p.dur ?? 100), pts: [] });
  },
  scan(ctx) {
    const list = foesNear(ctx.player, ctx.player.location, ctx.a.p.r ?? 32, 40);
    for (const t of list) hitTarget(ctx, t);
    ctx.msg = `${list.length} criatura${list.length === 1 ? "" : "s"} revelada${list.length === 1 ? "" : "s"}`;
    ctx.touched = 1;
  },
  orescan(ctx) {
    const r = Math.min(16, ctx.a.p.r ?? 12), o = ctx.player.location, dim = ctx.player.dimension;
    let n = 0;
    for (let i = 0; i < 2500 && n < 24; i++) {
      const p = v3(Math.floor(o.x + (Math.random() * 2 - 1) * r), Math.floor(o.y + (Math.random() * 2 - 1) * r * 0.6), Math.floor(o.z + (Math.random() * 2 - 1) * r));
      try {
        const b = dim.getBlock(p);
        if (b && /_ore$|ancient_debris/.test(b.typeId)) {
          n++;
          REVEAL.set(`b${p.x},${p.y},${p.z}`, system.currentTick + 200);
          pushActive({ k: "beacon", ctx, at: v3(p.x + 0.5, p.y + 0.5, p.z + 0.5), until: system.currentTick + 200 });
        }
      } catch {
        /* ignore */
      }
    }
    ctx.msg = `${n} minério${n === 1 ? "" : "s"} encontrado${n === 1 ? "" : "s"}`;
    ctx.touched = 1;
  },
  vacuum(ctx) {
    let n = 0;
    try {
      for (const e of ctx.player.dimension.getEntities({ location: ctx.player.location, maxDistance: ctx.a.p.r ?? 12 })) {
        if (e.typeId !== "minecraft:item" && e.typeId !== "minecraft:xp_orb") continue;
        e.teleport(ctx.player.location);
        n++;
      }
    } catch {
      /* ignore */
    }
    ctx.msg = `${n} itens recolhidos`;
    ctx.touched = 1;
  },
  bridge(ctx) {
    const f = flatDir(ctx.dir), o = ctx.player.location, dim = ctx.player.dimension;
    let n = 0;
    for (let i = 1; i <= (ctx.a.p.r ?? 12); i++) for (let k = -1; k <= 1; k++) {
      if (placeTemp(dim, Math.floor(o.x + f.x * i - f.z * k), Math.floor(o.y) - 1, Math.floor(o.z + f.z * i + f.x * k), RACE_BLOCK[ctx.race], ctx.a.p.dur ?? 300)) n++;
    }
    ctx.touched = 1;
    ctx.msg = n ? `Ponte de ${ctx.a.p.r ?? 12} blocos` : "Já tem chão aí na frente.";
  },
  platform(ctx) {
    const r = ctx.a.p.r ?? 3, o = ctx.player.location;
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) placeTemp(ctx.player.dimension, Math.floor(o.x) + x, Math.floor(o.y) - 1, Math.floor(o.z) + z, RACE_BLOCK[ctx.race], ctx.a.p.dur ?? 400);
    ctx.touched = 1;
  },
  light(ctx) {
    pushActive({ k: "light", ctx, until: system.currentTick + (ctx.a.p.dur ?? 600), at: null });
    eff(ctx.player, "night_vision", ctx.a.p.dur ?? 600, 0);
    ctx.touched = 1;
  },
  dig(ctx) {
    return breakArea(ctx, (i, k, y) => [i, k, y], ctx.a.p.r ?? 6, () => true);
  },
  clear(ctx) {
    return breakArea(ctx, null, ctx.a.p.r ?? 4, (id) => /leaves|log|grass|fern|flower|vine|snow|bush|sapling|mushroom|cactus|kelp|seagrass|bamboo/.test(id));
  },
  ashclear(ctx) {
    return breakArea(ctx, null, ctx.a.p.r ?? 3, () => true, true);
  },
  recall(ctx) {
    let sp;
    try {
      sp = ctx.player.getSpawnPoint();
    } catch {
      /* ignore */
    }
    const dimension = sp ? sp.dimension : world.getDimension("overworld");
    const at = sp ? v3(sp.x + 0.5, sp.y, sp.z + 0.5) : world.getDefaultSpawnLocation();
    V.pillar(ctx.player.dimension, ctx.player.location, ctx.race, 12, 1.4, 0.8);
    try {
      ctx.player.teleport(at.y > 300 ? v3(at.x, 100, at.z) : at, { dimension });
    } catch {
      return "Não deu para voltar agora.";
    }
    ctx.touched = 1;
  },
  calm(ctx) {
    let n = 0;
    for (const t of foesNear(ctx.player, ctx.player.location, ctx.a.p.r ?? 16)) {
      if (t.typeId === "minecraft:player") continue;
      eff(t, "weakness", 300, 4);
      eff(t, "slowness", 200, 1);
      n++;
    }
    ctx.msg = `${n} criaturas acalmadas`;
    ctx.touched = 1;
  },
  smelt(ctx) {
    const ct = ctx.player.getComponent("minecraft:inventory")?.container;
    const MAP = { "minecraft:raw_iron": "minecraft:iron_ingot", "minecraft:raw_gold": "minecraft:gold_ingot", "minecraft:raw_copper": "minecraft:copper_ingot",
      "minecraft:sand": "minecraft:glass", "minecraft:cobblestone": "minecraft:stone", "minecraft:clay_ball": "minecraft:brick", "minecraft:beef": "minecraft:cooked_beef",
      "minecraft:porkchop": "minecraft:cooked_porkchop", "minecraft:chicken": "minecraft:cooked_chicken", "minecraft:potato": "minecraft:baked_potato" };
    let n = 0;
    for (let i = 0; ct && i < ct.size; i++) {
      const it = ct.getItem(i);
      if (it && MAP[it.typeId]) {
        ct.setItem(i, new ItemStack(MAP[it.typeId], it.amount));
        n += it.amount;
      }
    }
    ctx.msg = n ? `${n} itens fundidos na forja` : "Nada para fundir no inventário.";
    ctx.touched = 1;
  },
  trade(ctx) {
    try {
      ctx.player.applyDamage(4, { cause: EntityDamageCause.magic });
    } catch {
      /* ignore */
    }
    ctx.s.res = Math.min(BAL.resourceMax, ctx.s.res + 40);
    ctx.msg = "4 de vida → +40 de energia";
    ctx.touched = 1;
  },
  bloom(ctx) {
    const r = ctx.a.p.r ?? 6, o = ctx.player.location, dim = ctx.player.dimension;
    let n = 0;
    for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) for (let y = -1; y <= 1; y++) {
      try {
        const b = dim.getBlock({ x: Math.floor(o.x) + x, y: Math.floor(o.y) + y, z: Math.floor(o.z) + z });
        if (!b) continue;
        if (/wheat|carrots|potatoes|beetroot/.test(b.typeId)) {
          const max = b.typeId.includes("beetroot") ? 3 : 7;
          b.setPermutation(b.permutation.withState(/** @type {any} */ ("growth"), max));
          n++;
        } else if (b.typeId === "minecraft:grass_block" && Math.random() < 0.08) {
          const up = b.above();
          if (up?.isAir) {
            up.setType(["minecraft:poppy", "minecraft:dandelion", "minecraft:cornflower", "minecraft:allium"][Math.floor(Math.random() * 4)]);
            n++;
          }
        }
      } catch {
        /* ignore */
      }
    }
    ctx.msg = `${n} plantas floresceram`;
    ctx.touched = 1;
  },
};

/** Quebra blocos (túnel/limpeza/cinzas). Nunca blocos protegidos/contêineres; nunca no modo aventura. */
function breakArea(ctx, _f, r, ok, ash = false) {
  try {
    const gm = /** @type {any} */ (ctx.player).getGameMode?.();
    if (gm === GameMode.Adventure || gm === GameMode.Spectator) return "No modo aventura não dá para quebrar blocos.";
  } catch {
    /* ignore */
  }
  const dim = ctx.player.dimension, o = ctx.player.location, f = flatDir(ctx.dir);
  let n = 0;
  const cells = [];
  if (_f) {
    for (let i = 1; i <= r; i++) for (let k = -1; k <= 1; k++) for (let y = 0; y <= 2; y++) cells.push(v3(Math.floor(o.x + f.x * i - f.z * k), Math.floor(o.y) + y, Math.floor(o.z + f.z * i + f.x * k)));
  } else {
    for (let x = -r; x <= r; x++) for (let y = 0; y <= r; y++) for (let z = -r; z <= r; z++) if (Math.hypot(x, y, z) <= r) cells.push(v3(Math.floor(o.x) + x, Math.floor(o.y) + y, Math.floor(o.z) + z));
  }
  for (const c of cells) {
    if (n >= 200) break;
    try {
      const b = dim.getBlock(c);
      if (!b || b.isAir || b.isLiquid || UNBREAKABLE.test(b.typeId) || !ok(b.typeId)) continue;
      if (ash) {
        b.setType("minecraft:air");
        if (n % 3 === 0) fx(dim, "lila:rc_ash", v3(c.x + 0.5, c.y + 0.5, c.z + 0.5));
      } else dim.runCommand(`setblock ${c.x} ${c.y} ${c.z} air destroy`);
      n++;
    } catch {
      /* ignore */
    }
  }
  ctx.touched = 1;
  ctx.msg = `${n} blocos`;
}

// ------------------------------------------------------------------ lançar um poder
/** Poses de animação do jogador (propriedade lila:pose) por forma. */
function poseOf(a) {
  if (a.cat === "ult") return "roar";
  if (["slam", "leapslam", "nova", "pillar", "rain", "wave", "cross"].includes(a.shape)) return "slam";
  if (["dash", "leap", "blink", "tether", "swap"].includes(a.shape)) return "dash";
  if (["cone", "grab", "throw", "boomerang"].includes(a.shape)) return "slash";
  if (["self", "ally", "dome", "aura", "zone", "summon", "scan", "orescan", "light", "bloom", "calm", "recall"].includes(a.shape)) return "pray";
  if (a.special === "drain") return "drain";
  return "cast";
}
export function setPose(player, pose, ticks = 12) {
  try {
    player.setProperty("lila:pose", pose);
    system.runTimeout(() => {
      try {
        if (player.isValid && player.getProperty("lila:pose") === pose) player.setProperty("lila:pose", "none");
      } catch {
        /* ignore */
      }
    }, ticks);
  } catch {
    /* sem o pacote do jogador: só não anima */
  }
}

export const SPECIAL_RUN = {}; // preenchido por passives.js/weapons.js (morcego, voo, dreno, arma...)

const BAT_OK = new Set(["blink", "self", "dash", "scan", "light", "recall", "tether"]);

/**
 * Usa um poder. Validação completa no servidor. Retorna {ok, msg}.
 * @param {any} player
 * @param {string} id
 */
export function cast(player, id, o = {}) {
  const a = BY_ID.get(id);
  const s = stateOf(player);
  const fail = (msg) => {
    if (!o.quiet) try {
      player.onScreenDisplay.setActionBar(`§c✖ ${msg}`);
    } catch {
      /* ignore */
    }
    return { ok: false, msg };
  };
  if (!a) return fail("Poder desconhecido.");
  if (!s.race || a.race !== s.race) return fail("Esse poder não é da sua raça.");
  if (a.passive) return fail("É uma passiva: já está sempre ativa.");
  const tick = system.currentTick;
  if (!o.force && tick - (lastCast.get(player.id) ?? -99) < 4) return fail("Calma! (anti-spam)");
  if (silenced(player)) return fail("Você está silenciado/atordoado.");
  if (s.tog.bat && a.special !== "bat" && !BAT_OK.has(a.shape) && !(a.special === "superjump")) return fail("Na forma de morcego só dá para fugir e explorar.");
  const t = now();
  const left = (s.cd[id] ?? 0) - t;
  if (left > 0 && !o.force) return fail(`${a.name}: recarga ${(left / 20).toFixed(1)}s`);
  if (s.res < a.cost && !o.force) return fail(`Falta ${RACES[s.race].resource} (${Math.floor(s.res)}/${a.cost})`);
  lastCast.set(player.id, tick);
  const dim = player.dimension;
  LOWFX = !!s.tog.lowfx;
  V.setLow(LOWFX);
  const ctx = { player, a, s, race: s.race, head: player.getHeadLocation(), dir: player.getViewDirection(), hits: 0, touched: 0, msg: "" };
  let err;
  try {
    if (a.special) err = SPECIAL_RUN[a.special]?.(ctx) ?? (SPECIAL_RUN[a.special] ? undefined : "Indisponível");
    else err = SHAPE[a.shape]?.(ctx);
  } catch (e) {
    err = `Falhou: ${e}`;
  }
  if (typeof err === "string") return fail(err);
  if (!a.special && a.self.length) selfEffects(ctx);
  s.res = Math.max(0, s.res - (o.force ? 0 : a.cost));
  s.cd[id] = t + Math.round(a.cd * 20 * BAL.cooldownScale);
  saveState(player);
  setPose(player, ctx.pose ?? poseOf(a), a.cat === "ult" ? 30 : 14);
  snd(dim, FX[s.race].cast, player.location, a.cat === "ult" ? 1.2 : 0.7, a.cat === "ult" ? 0.7 : 1 + Math.random() * 0.2);
  V.castFx(player, s.race, a.cat === "ult");
  if (a.cat === "ult") {
    try {
      player.camera.fade({ fadeColor: ULT_COLOR[s.race], fadeTime: { fadeInTime: 0.1, holdTime: 0.05, fadeOutTime: 0.4 } });
    } catch {
      /* ignore */
    }
  }
  LAST.outcome = { id, hits: ctx.hits, touched: ctx.touched, self: !!ctx.selfDone, queued: ACTIVE.filter((x) => x.ctx?.a?.id === id).length };
  if (!o.quiet) {
    try {
      player.onScreenDisplay.setActionBar(`${RACES[s.race].color}◆ ${a.name}§r${ctx.msg ? ` §7— ${ctx.msg}` : ""}`);
    } catch {
      /* ignore */
    }
  }
  return { ok: true, msg: ctx.msg };
}
const ULT_COLOR = { vampire: { red: 0.5, green: 0, blue: 0.05 }, giant: { red: 0.35, green: 0.25, blue: 0.1 }, angel: { red: 1, green: 0.95, blue: 0.8 },
  demon: { red: 0.6, green: 0.1, blue: 0 }, god: { red: 1, green: 0.92, blue: 0.6 }, dark: { red: 0.05, green: 0, blue: 0.1 } };

// ------------------------------------------------------------------ tick do motor (1 por tick, lista curta)
export function engineTick() {
  const tick = system.currentTick;
  for (let i = ACTIVE.length - 1; i >= 0; i--) {
    const o = ACTIVE[i];
    const p = o.ctx.player;
    if (!p?.isValid) {
      ACTIVE.splice(i, 1);
      continue;
    }
    let done = false;
    LOWFX = !!o.ctx.s?.tog?.lowfx;
    V.setLow(LOWFX);
    try {
      done = (STEP[o.k] ?? STEP_EXT[o.k])(o, tick);
    } catch {
      done = true;
    }
    if (done) {
      try {
        o.cleanup?.();
      } catch {
        /* ignore */
      }
      ACTIVE.splice(i, 1);
    }
  }
  LOWFX = false;
  V.setLow(false);
  if (tick % 20 === 0) dotTick(tick);
  if (tick % 10 === 0) revealTick(tick);
  if (tick % 20 === 5) tempTick(tick);
}

const STEP = {
  proj(o) {
    const dim = o.ctx.player.dimension;
    for (let k = 0; k < 3; k++) {
      o.vel.y -= o.grav / 3;
      o.pos = add(o.pos, o.vel, 1 / 3);
      o.dist += Math.hypot(o.vel.x, o.vel.y, o.vel.z) / 3;
      let blockHit = false;
      try {
        const b = dim.getBlock({ x: Math.floor(o.pos.x), y: Math.floor(o.pos.y), z: Math.floor(o.pos.z) });
        blockHit = !b || (!b.isAir && !b.isLiquid && b.isSolid);
      } catch {
        blockHit = true;
      }
      const hits = foesNear(o.ctx.player, o.pos, 1.3, 4).filter((e) => !o.hit.has(e.id));
      if (hits.length || blockHit || (!o.ret && o.dist >= o.max) || (o.ret && o.back && d3(o.pos, o.ctx.player.location) < 2)) {
        for (const t of hits) {
          o.hit.add(t.id);
          hitTarget(o.ctx, t);
        }
        const blast = blastOf(o.ctx.a) || (o.grav ? 2.5 : 0);
        if (blast) impact(o.ctx, o.pos, blast);
        else V.impact(dim, o.pos, o.ctx.race, 1);
        snd(dim, FX[o.ctx.race].hit, o.pos, 0.6, 1.2);
        if (o.ret && !o.back && !blockHit && hits.length && o.dist < o.max) continue; // bumerangue atravessa
        if (o.ret && !o.back) {
          o.back = true;
          o.hit.clear();
          continue;
        }
        return true;
      }
      if (o.ret && !o.back && o.dist >= o.max) {
        o.back = true;
        o.hit.clear();
      }
      if (o.ret && o.back) {
        const to = v3(o.ctx.player.location.x, o.ctx.player.location.y + 1.2, o.ctx.player.location.z);
        const d = d3(o.pos, to) || 1, sp = Math.hypot(o.vel.x, o.vel.y, o.vel.z);
        o.vel = v3(((to.x - o.pos.x) / d) * sp, ((to.y - o.pos.y) / d) * sp, ((to.z - o.pos.z) / d) * sp);
      }
    }
    V.orb(dim, o.pos, o.ctx.race, o.grav ? 0.6 : 0.42);
    return o.dist > o.max * 2.5;
  },
  wave(o) {
    o.pos = add(o.pos, o.dir, 1.5);
    o.dist += 1.5;
    V.ring(o.ctx.player.dimension, o.pos, o.ctx.race, 1.3, 0.3);
    V.accent(o.ctx.player.dimension, o.pos, o.ctx.race, 3, 0.7);
    for (const t of foesNear(o.ctx.player, o.pos, 1.8)) {
      if (o.hit.has(t.id)) continue;
      o.hit.add(t.id);
      hitTarget(o.ctx, t);
    }
    return o.dist >= o.max;
  },
  delay(o) {
    if (!o.warned) {
      o.warned = true;
      V.sigil(o.ctx.player.dimension, o.at, o.ctx.race, o.r, o.t / 20 + 0.25);
    }
    if (--o.t > 0) return false;
    if (o.col) V.pillar(o.ctx.player.dimension, o.at, o.ctx.race, 7, 1.1, 0.45);
    else V.orb(o.ctx.player.dimension, v3(o.at.x, o.at.y + 0.5, o.at.z), o.ctx.race, 0.7);
    impact(o.ctx, o.at, o.r);
    snd(o.ctx.player.dimension, FX[o.ctx.race].hit, o.at, 0.7, 0.9);
    return true;
  },
  slam(o, tick) {
    const p = o.ctx.player;
    if (tick - o.t0 > 6 && (p.isOnGround || tick - o.t0 > 60)) {
      const at = { ...p.location };
      impact(o.ctx, at, o.r);
      V.crack(p.dimension, at, o.r * 0.9);
      V.emit(p.dimension, "lila:vfx_shards", at, { c: V.STYLE[o.ctx.race].c, n: 16, size: 1.2 });
      snd(p.dimension, "random.explode", at, 0.6, 1.3);
      try {
        p.dimension.runCommand(`camerashake add @a[x=${Math.floor(at.x)},y=${Math.floor(at.y)},z=${Math.floor(at.z)},r=12] 0.25 0.3 positional`);
      } catch {
        /* ignore */
      }
      return true;
    }
    return false;
  },
  dash(o) {
    const p = o.ctx.player;
    V.orb(p.dimension, v3(p.location.x, p.location.y + 1, p.location.z), o.ctx.race, 0.7);
    if (o.t % 3 === 0) V.slash(p.dimension, v3(p.location.x, p.location.y + 1, p.location.z), o.ctx.race, 1.4);
    for (const t of foesNear(p, p.location, 2.2)) {
      if (o.hit.has(t.id)) continue;
      o.hit.add(t.id);
      hitTarget(o.ctx, t);
    }
    return --o.t <= 0;
  },
  tether(o) {
    const p = o.ctx.player;
    const d = v3(o.at.x - p.location.x, o.at.y - p.location.y, o.at.z - p.location.z);
    const l = Math.hypot(d.x, d.y, d.z);
    if (l < 2 || --o.t <= 0) return true;
    knock(p, flatDir(d), Math.min(1.8, l * 0.3), Math.max(0.1, Math.min(0.9, d.y * 0.15 + 0.2)));
    return false;
  },
  orbit(o, tick) {
    const p = o.ctx.player;
    if (tick > o.until) return true;
    const ang = tick * 0.35;
    for (let k = 0; k < 3; k++) {
      const a = ang + (k * Math.PI * 2) / 3;
      V.orb(p.dimension, v3(p.location.x + Math.cos(a) * o.r, p.location.y + 1, p.location.z + Math.sin(a) * o.r), o.ctx.race, 0.36);
    }
    if (tick % 4 === 0) {
      for (const t of foesNear(p, p.location, o.r + 0.8)) {
        if ((o.last.get(t.id) ?? 0) > tick) continue;
        o.last.set(t.id, tick + 20);
        hitTarget(o.ctx, t);
      }
    }
    return false;
  },
  zone(o, tick) {
    if (tick > o.until) return true;
    const p = o.ctx.player;
    if (tick % 20 === 0) V.sigil(p.dimension, o.at, o.ctx.race, o.r, 1.15, o.pullK ? 0 : 1);
    if (tick % 10 === 5) {
      if (o.pullK) V.swirl(p.dimension, v3(o.at.x, o.at.y + 0.8, o.at.z), o.ctx.race, o.r, true);
      else V.accent(p.dimension, v3(o.at.x, o.at.y + 0.4, o.at.z), o.ctx.race, 4, o.r * 0.6);
    }
    if (o.pullK && tick % 5 === 0) {
      for (const t of foesNear(p, o.at, o.r)) {
        const d = flatDir(v3(o.at.x - t.location.x, 0, o.at.z - t.location.z));
        knock(t, d, o.pullK * 0.6, 0.05);
      }
    }
    if (tick % 20 === 0) {
      const ctx = o.ctx;
      for (const t of foesNear(p, o.at, o.r)) hitTarget({ ...ctx, a: { ...ctx.a, foe: ctx.a.foe.filter((e) => e.k !== "pull") } }, t);
      if (ctx.a.self.length && d3(p.location, o.at) <= o.r + 1) selfEffects({ ...ctx, a: { ...ctx.a, self: ctx.a.self.map((e) => ({ ...e, t: Math.max(e.t, 30) })) } });
    }
    return false;
  },
  trap(o, tick) {
    if (tick > o.until) return true;
    if (tick % 20 === 0) V.sigil(o.ctx.player.dimension, o.at, o.ctx.race, 1.1, 1.05);
    const t = foesNear(o.ctx.player, o.at, 1.6)[0];
    if (!t) return false;
    hitTarget(o.ctx, t);
    V.impact(o.ctx.player.dimension, v3(o.at.x, o.at.y + 0.5, o.at.z), o.ctx.race, 1.4);
    snd(o.ctx.player.dimension, "random.click", o.at, 0.8, 0.6);
    return true;
  },
  spirit(o, tick) {
    if (tick > o.until) return true;
    const p = o.ctx.player;
    const tgt = foesNear(p, p.location, 14).sort((a, b) => d3(a.location, o.pos) - d3(b.location, o.pos))[0];
    const goal = tgt ? v3(tgt.location.x, tgt.location.y + 1, tgt.location.z)
      : v3(p.location.x + Math.cos(o.ang + tick * 0.05) * 2.2, p.location.y + 2, p.location.z + Math.sin(o.ang + tick * 0.05) * 2.2);
    const d = d3(o.pos, goal) || 1;
    const sp = Math.min(d, 0.9);
    o.pos = add(o.pos, v3((goal.x - o.pos.x) / d, (goal.y - o.pos.y) / d, (goal.z - o.pos.z) / d), sp);
    V.orb(p.dimension, o.pos, o.ctx.race, 0.5);
    if (tgt && d < 1.6 && tick >= o.cd) {
      o.cd = tick + 20;
      hitTarget(o.ctx, tgt);
    }
    return false;
  },
  trail(o, tick) {
    if (tick > o.until) return true;
    const p = o.ctx.player;
    if (tick % 4 === 0) {
      o.pts.push({ ...p.location });
      if (o.pts.length > 12) o.pts.shift();
    }
    if (tick % 10 === 0) {
      for (const pt of o.pts) {
        V.accent(p.dimension, v3(pt.x, pt.y + 0.3, pt.z), o.ctx.race, 3, 0.5);
        for (const t of foesNear(p, pt, 1.6)) hitTarget(o.ctx, t);
      }
    }
    return false;
  },
  beacon(o, tick) {
    if (tick > o.until) return true;
    if (tick % 10 === 0) fx(o.ctx.player.dimension, "lila:rc_reveal", o.at);
    return false;
  },
  light(o, tick) {
    if (tick > o.until) {
      clearLight(o);
      return true;
    }
    if (tick % 10 !== 0) return false;
    const p = o.ctx.player, h = p.getHeadLocation();
    const at = v3(Math.floor(h.x), Math.floor(h.y), Math.floor(h.z));
    if (o.at && o.at.x === at.x && o.at.y === at.y && o.at.z === at.z) return false;
    clearLight(o);
    try {
      const b = p.dimension.getBlock(at);
      if (b?.isAir) {
        b.setType("minecraft:light_block_14");
        o.at = at;
        o.dim = p.dimension;
      }
    } catch {
      /* ignore */
    }
    return false;
  },
};
function clearLight(o) {
  if (!o.at) return;
  try {
    const b = o.dim.getBlock(o.at);
    if (b?.typeId === "minecraft:light_block_14") b.setType("minecraft:air");
  } catch {
    /* ignore */
  }
  o.at = null;
}

function dotTick(tick) {
  for (const [id, d] of DOTS) {
    if (!d.e?.isValid || tick > d.until) {
      DOTS.delete(id);
      continue;
    }
    try {
      d.e.applyDamage(d.dmg, { cause: EntityDamageCause.magic, damagingEntity: d.owner?.isValid ? d.owner : undefined });
      const at = v3(d.e.location.x, d.e.location.y + 1, d.e.location.z);
      if (d.kind === "bleed") V.emit(d.e.dimension, "lila:vfx_drops", at, { c: [0.7, 0.02, 0.06], n: 5, size: 0.6 });
      else V.emit(d.e.dimension, "lila:vfx_smoke", at, { c: [0.12, 0.05, 0.16], n: 3, size: 0.6 });
    } catch {
      DOTS.delete(id);
    }
  }
  for (const m of [MARKS, SILENCE, STUN]) for (const [id, until] of m) if (until < tick) m.delete(id);
  for (const [id, t] of THORNS) if (t.until < tick) THORNS.delete(id);
}

function revealTick(tick) {
  if (!REVEAL.size) return;
  for (const [id, until] of REVEAL) {
    if (until < tick) {
      REVEAL.delete(id);
      continue;
    }
    if (typeof id !== "string" || id.startsWith("b")) continue;
    const e = world.getEntity(id);
    if (!e?.isValid) {
      REVEAL.delete(id);
      continue;
    }
    fx(e.dimension, "lila:rc_reveal", v3(e.location.x, e.location.y + 2.3, e.location.z));
  }
}

function tempTick(tick) {
  for (let i = TEMP_BLOCKS.length - 1; i >= 0; i--) {
    const t = TEMP_BLOCKS[i];
    if (t.until > tick) continue;
    TEMP_BLOCKS.splice(i, 1);
    try {
      const b = world.getDimension(t.d).getBlock(t);
      if (b?.typeId === t.id) b.setType("minecraft:air");
    } catch {
      /* ignore */
    }
  }
}

/** Para o autoteste: quantas ações em andamento de um poder. */
export const activeOf = (id) => ACTIVE.filter((x) => x.ctx?.a?.id === id).length;
export const clearActive = () => {
  for (const o of ACTIVE) {
    try {
      o.cleanup?.();
    } catch {
      /* ignore */
    }
  }
  ACTIVE.splice(0, ACTIVE.length);
};
/** Passos extras (poderes assinatura registram aqui). */
export const STEP_EXT = {};
/** Ferramentas do motor para os poderes assinatura. */
export const KIT = { foesNear, alliesNear, aimEntity, aimPoint, eff, knock, pushActive, placeTemp, snd, hp, isUndead, BOSSES, flatDir, add, d3, v3, selfEffects };
export const BLOCK_OK = (id) => !UNBREAKABLE.test(id);
export { BlockPermutation };
