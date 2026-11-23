// MALDIÇÃO — o que o antigo drone de nanorrobôs virou: um espírito amaldiçoado de fumaça preta,
// do tamanho de um wither, que sai do chão quando é invocado e afunda na terra quando vai embora.
//
// Aqui ficam:
//   • as AÇÕES animadas (propriedade lila:cact → animações do pacote de recursos);
//   • o COMBATE corpo a corpo (socos, garra, pancada, gancho, mordida, agarrar e arremessar) — ela
//     não atira mais nada;
//   • surgir do chão / afundar na terra;
//   • a ATMOSFERA (faíscas ao invocar, cinzas no ar, névoa gigante só quando você liga);
//   • os poderes do jogador: VIRAR FUMAÇA (voa e atravessa tudo, como espectador) e NÉVOA.
import { EntityDamageCause, GameMode, MolangVariableMap, system, world } from "@minecraft/server";
import { logError } from "../core/log.js";

export const CACT = ["none", "punch_r", "punch_l", "claw", "slam", "grab", "bite", "roar", "guard", "emerge", "sink", "dissolve", "reform",
  "uppercut", "throw", "devour", "flurry"];
/** Duração de cada ação em ticks (igual às animações). */
export const CACT_LEN = { punch_r: 13, punch_l: 13, claw: 15, slam: 20, grab: 27, bite: 15, roar: 35, guard: 0, emerge: 98, sink: 56, dissolve: 26,
  reform: 26, uppercut: 15, throw: 19, devour: 32, flurry: 24 };
export const SCALE = 3.4; // maldição gigante (mesma escala da forma colossus no pacote)

const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const hd = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** A forma atual é a Maldição (normal ou gigante)? */
export const isCurseForm = (c) => !c.rec.form || c.rec.form === "drone" || c.rec.form === "colossus";
export const curseScale = (c) => (c.rec.form === "colossus" ? SCALE : 1);

/** Toca uma ação animada. Volta para "nenhuma" sozinha no fim (guarda fica até mandar parar). */
export function cact(e, name, ticks = CACT_LEN[name]) {
  if (!e?.isValid) return;
  const idx = CACT.indexOf(name);
  if (idx < 0) return;
  try {
    const cur = e.getProperty("lila:cact");
    if (cur === idx && idx !== 8) {
      // a mesma ação de novo (dois socos seguidos): solta e reaplica no tick seguinte
      e.setProperty("lila:cact", 0);
      system.run(() => {
        try {
          if (e.isValid) e.setProperty("lila:cact", idx);
        } catch {
          /* ignore */
        }
      });
    } else e.setProperty("lila:cact", idx);
  } catch (err) {
    logError("curse.cact", err);
    return;
  }
  if (ticks > 0) {
    system.runTimeout(() => {
      try {
        if (e.isValid && e.getProperty("lila:cact") === idx) e.setProperty("lila:cact", 0);
      } catch {
        /* ignore */
      }
    }, ticks + 1);
  }
}
export function cactOf(e) {
  try {
    return CACT[/** @type {number} */ (e?.getProperty("lila:cact") ?? 0)] ?? "none";
  } catch {
    return "none";
  }
}

/** Ações antigas do cérebro/formas → ações animadas da Maldição. */
const MAP = { work: "punch", punch: "punch", place: "claw", charge: "devour", celebrate: "roar", wave: "claw", defeat: "dissolve", attack: "claw",
  shoot: "claw", summon: "roar", scan: "roar" };
const LR = new Map();
export function mapAction(e, action) {
  const k = MAP[action];
  if (!k || !e?.isValid) return;
  let form = 0;
  try {
    form = /** @type {number} */ (e.getProperty("lila:form") ?? 0);
  } catch {
    /* ignore */
  }
  if (form !== 0 && form !== 7) return;
  if (k === "punch") {
    const f = !LR.get(e.id);
    LR.set(e.id, f);
    cact(e, f ? "punch_r" : "punch_l");
  } else cact(e, k);
}

export function fx(dim, id, at, vars) {
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
function snd(dim, id, at, volume = 1, pitch = 1) {
  try {
    dim.playSound(id, at, { volume, pitch });
  } catch {
    /* ignore */
  }
}
export function shakeNear(dim, at, power = 0.3, secs = 0.4, r = 16) {
  try {
    dim.runCommand(`camerashake add @a[x=${Math.floor(at.x)},y=${Math.floor(at.y)},z=${Math.floor(at.z)},r=${r}] ${power.toFixed(2)} ${secs.toFixed(2)} positional`);
  } catch {
    /* ignore */
  }
}

// ======================================================================== combate corpo a corpo
const MOVES = {
  punch_r: { hit: 5, dmg: 19, kb: 1.6, up: 0.4 },
  punch_l: { hit: 5, dmg: 19, kb: 1.6, up: 0.4 },
  claw: { hit: 7, dmg: 14, kb: 1.0, up: 0.3, bleed: true },
  slam: { hit: 9, dmg: 12, kb: 1.4, up: 0.8, area: 4.5 },
  uppercut: { hit: 6, dmg: 20, kb: 0.4, up: 1.3 },
  bite: { hit: 7, dmg: 22, kb: 0.6, up: 0.2, heal: 6 },
  throw: { hit: 9, dmg: 14, kb: 3.0, up: 1.1 },
  flurry: { hit: 2, dmg: 7, kb: 0.5, up: 0.15, hits: 5, every: 3 },
};
/** Alcance do braço (a partir do centro do corpo). */
export const reachOf = (c) => 4.2 * curseScale(c);

/**
 * Golpe da Maldição no alvo (escolhe o golpe pela situação: combos de soco, garra, pancada no chão
 * quando tem bando, gancho, mordida em alvo pequeno, sequência). Retorna true se golpeou.
 */
export function curseStrike(c, target, prefer) {
  const e = c.entity;
  if (!e?.isValid || !target?.isValid) return false;
  const k = curseScale(c);
  const tl = target.location;
  if (hd(e.location, tl) > reachOf(c) || Math.abs(tl.y - e.location.y) > 4.5 * k) return false;
  faceTo(e, tl);
  const dim = c.dim();
  const n = (c.flags.combo = (c.flags.combo ?? 0) + 1);
  let crowd = 0;
  try {
    crowd = dim.getEntities({ location: tl, maxDistance: 4.5 * k, families: ["monster"] }).length;
  } catch {
    /* ignore */
  }
  let hp = 20;
  try {
    hp = target.getComponent("minecraft:health")?.currentValue ?? 20;
  } catch {
    /* ignore */
  }
  let move = prefer;
  if (!move) {
    if (crowd >= 3 && n % 3 === 0) move = "slam";
    else if (n % 6 === 0) move = "flurry";
    else if (n % 5 === 0) move = "uppercut";
    else if (n % 4 === 0 && hp <= 30) move = "bite";
    else if (n % 3 === 0) move = "claw";
    else move = n % 2 ? "punch_r" : "punch_l";
  }
  const M = MOVES[move];
  cact(e, move);
  const strike = (dmgMul = 1) => {
    if (!c.alive()) return;
    const at = target.isValid ? target.location : tl;
    const victims = M.area ? areaFoes(c, at, M.area * k) : target.isValid ? [target] : [];
    for (const v of victims) {
      try {
        const p = e.location, dx = v.location.x - p.x, dz = v.location.z - p.z, l = Math.hypot(dx, dz) || 1;
        v.applyDamage(M.dmg * dmgMul * (c.def?.strength ? c.def.strength / 8 : 1) * (k > 1 ? 3.2 : 1),
          { cause: EntityDamageCause.entityAttack, damagingEntity: e });
        v.applyKnockback({ x: (dx / l) * M.kb * Math.sqrt(k), z: (dz / l) * M.kb * Math.sqrt(k) }, M.up);
        if (M.bleed) v.addEffect("wither", 40, { amplifier: 0 });
      } catch (err) {
        logError("curse.strike", err);
      }
    }
    const hit = { x: at.x, y: at.y + 1, z: at.z };
    fx(dim, "lila:curse_hit", hit);
    fx(dim, "lila:curse_spark", hit);
    if (M.area) {
      fx(dim, "lila:curse_quake", { x: at.x, y: e.location.y, z: at.z });
      fx(dim, "lila:curse_ground", { x: at.x, y: e.location.y, z: at.z });
      fx(dim, "lila:vfx_crack", { x: at.x, y: Math.floor(e.location.y) + 0.05, z: at.z }, { cr: 0.1, cg: 0.08, cb: 0.07, size: 3 * k, life: 2.5 });
      shakeNear(dim, at, 0.35 * Math.sqrt(k), 0.4, 20 * k);
      snd(dim, "random.explode", at, 0.8, 0.7);
    } else snd(dim, move === "bite" ? "mob.evocation_fangs.attack" : "mob.irongolem.hit", at, 0.9, move === "uppercut" ? 0.7 : 0.9);
    if (M.heal) {
      try {
        const h = e.getComponent("minecraft:health");
        if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + M.heal));
      } catch {
        /* ignore */
      }
    }
  };
  if (M.hits) for (let i = 0; i < M.hits; i++) system.runTimeout(strike, M.hit + i * M.every);
  else system.runTimeout(strike, M.hit);
  return true;
}

function areaFoes(c, at, r) {
  const out = [];
  try {
    for (const t of c.dim().getEntities({ location: at, maxDistance: r })) {
      if (t.id === c.entity?.id || t.id === c.rec.ownerId) continue;
      if (t.typeId === "lila:robot" || t.typeId === "lila:drone" || t.typeId === "minecraft:item" || t.typeId === "minecraft:xp_orb") continue;
      if (t.typeId === "minecraft:player" && !c.flags.aggro?.has(t.id)) continue;
      let fam = false;
      try {
        fam = t.matches({ families: ["monster"] }) || !!c.flags.aggro?.has(t.id);
      } catch {
        /* ignore */
      }
      if (fam) out.push(t);
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function faceTo(e, to) {
  try {
    const p = e.location;
    e.setRotation({ x: 0, y: (-Math.atan2(to.x - p.x, to.z - p.z) * 180) / Math.PI });
  } catch {
    /* ignore */
  }
}

// ======================================================================== surgir / afundar
/** Saída do chão (a animação já começa sozinha ao nascer: lila:cact = 9). Efeitos de terra e tremor. */
export function emergeFx(c, dim, loc) {
  const e = c.entity;
  if (e?.isValid) cact(e, "emerge");
  c.flags.emergeUntil = system.currentTick + 92;
  const ground = { x: loc.x, y: Math.floor(loc.y) + 0.05, z: loc.z };
  for (let k = 0; k < 6; k++) {
    system.runTimeout(() => {
      fx(dim, "lila:curse_ground", ground);
      fx(dim, "lila:curse_ground_smoke", ground);
      if (k % 2 === 0) fx(dim, "lila:vfx_crack", ground, { cr: 0.09, cg: 0.07, cb: 0.06, size: 2.2 + k * 0.5, life: 4 });
      shakeNear(dim, ground, 0.12 + k * 0.03, 0.5, 18);
    }, k * 14);
  }
  snd(dim, "mob.warden.emerge", ground, 1.2, 0.8);
  snd(dim, "ambient.cave", ground, 1, 0.6);
  system.runTimeout(() => snd(dim, "mob.warden.roar", ground, 1.2, 0.7), 72);
  const o = c.owner();
  if (o) c.flags.embersUntil = system.currentTick + 260; // atmosfera cheia de faíscas logo ao invocar
}

/** Afunda na terra e chama `then` quando sumiu de vez. */
export function sinkThen(c, then) {
  const e = c.entity;
  if (!e?.isValid || c.flags.sinking) {
    then();
    return;
  }
  c.flags.sinking = true;
  cact(e, "sink", 0);
  const dim = c.dim(), at = { ...e.location };
  try {
    e.clearVelocity();
  } catch {
    /* ignore */
  }
  for (let k = 0; k < 4; k++) {
    system.runTimeout(() => {
      fx(dim, "lila:curse_ground", at);
      fx(dim, "lila:curse_ground_smoke", at);
      shakeNear(dim, at, 0.12, 0.4, 14);
    }, 10 + k * 12);
  }
  snd(dim, "mob.warden.dig", at, 1.2, 0.8);
  system.runTimeout(() => {
    c.flags.sinking = false;
    then();
  }, CACT_LEN.sink);
}

// ======================================================================== atmosfera e poderes do jogador
const FOG_ID = "lila_curse";
const SMOKE_FORM = new Map(); // id do jogador → {prev, hold}

/** Liga/desliga a névoa gigante (preta) que acompanha você. */
export function setFog(c, on) {
  const o = c.owner();
  c.rec.curseFog = !!on;
  c.save?.();
  if (!o) return;
  try {
    if (on) o.runCommand(`fog @s push lila:curse_fog ${FOG_ID}`);
    else o.runCommand(`fog @s remove ${FOG_ID}`);
  } catch (err) {
    logError("curse.fog", err);
  }
  if (on) {
    fx(o.dimension, "lila:curse_fog_cloud", o.location);
    snd(o.dimension, "mob.warden.nearby_closer", o.location, 1, 0.6);
  }
}

/** Vira fumaça (voa e atravessa tudo, sem levar dano — modo espectador) ou volta ao corpo. */
export function setSmokeForm(player, on) {
  try {
    if (on) {
      if (SMOKE_FORM.has(player.id)) return true;
      const prev = player.getGameMode();
      if (prev === GameMode.Spectator) return false;
      player.setDynamicProperty("lila:prevgm", String(prev));
      SMOKE_FORM.set(player.id, { prev, hold: 0 });
      player.setGameMode(GameMode.Spectator);
      fx(player.dimension, "lila:curse_burst", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
      snd(player.dimension, "mob.phantom.flap", player.location, 1, 0.5);
      player.onScreenDisplay.setActionBar("§5§lVOCÊ É FUMAÇA§r §7— voe e atravesse tudo · §fsegure AGACHAR 2 s§7 para voltar ao corpo");
      return true;
    }
    const st = SMOKE_FORM.get(player.id);
    const saved = player.getDynamicProperty("lila:prevgm");
    const prev = st?.prev ?? (typeof saved === "string" ? saved : GameMode.Survival);
    SMOKE_FORM.delete(player.id);
    player.setDynamicProperty("lila:prevgm", undefined);
    player.setGameMode(/** @type {any} */ (prev));
    fx(player.dimension, "lila:curse_burst", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
    snd(player.dimension, "mob.warden.emerge", player.location, 0.6, 1.4);
    player.onScreenDisplay.setActionBar("§7De volta ao corpo.");
    return true;
  } catch (err) {
    logError("curse.smoke", err);
    return false;
  }
}
export const inSmokeForm = (player) => SMOKE_FORM.has(player.id);

/** Ao entrar no mundo: se ficou preso na forma de fumaça (servidor fechou), volta ao corpo. */
world.afterEvents.playerSpawn.subscribe((ev) => {
  const p = ev.player;
  system.runTimeout(() => {
    try {
      if (p.isValid && typeof p.getDynamicProperty("lila:prevgm") === "string" && !SMOKE_FORM.has(p.id)) setSmokeForm(p, false);
    } catch {
      /* ignore */
    }
  }, 20);
});

/** Forma de fumaça: roda sozinha (não depende da maldição estar invocada — ninguém fica preso). */
system.runInterval(() => {
  if (!SMOKE_FORM.size) return;
  const tick = system.currentTick;
  for (const [id, sf] of SMOKE_FORM) {
    const p = world.getEntity(id);
    if (!p?.isValid) {
      SMOKE_FORM.delete(id);
      continue;
    }
    try {
      fx(p.dimension, "lila:curse_form", p.location);
      if (tick % 6 === 0) fx(p.dimension, "lila:curse_embers", p.location);
      sf.hold = /** @type {any} */ (p).isSneaking ? sf.hold + 2 : 0;
      if (sf.hold >= 40) setSmokeForm(p, false);
    } catch {
      /* ignore */
    }
  }
}, 2);

/** Tique da atmosfera (chamado a cada 2 ticks para cada maldição invocada). */
export function curseAtmosphereTick(c, tick) {
  const o = c.owner();
  if (!o?.isValid) return;
  const dim = o.dimension, at = o.location;
  if (tick % 20 !== 0) return;
  if (c.rec.curseFog) {
    fx(dim, "lila:curse_fog_cloud", at);
    if (tick % 40 === 0) fx(dim, "lila:curse_embers", at);
    if (tick % 200 === 0) {
      try {
        o.runCommand(`fog @s push lila:curse_fog ${FOG_ID}`); // reforça (ex.: depois de morrer/relogar)
        o.runCommand(`fog @s remove ${FOG_ID}`);
        o.runCommand(`fog @s push lila:curse_fog ${FOG_ID}`);
      } catch {
        /* ignore */
      }
    }
  } else fx(dim, "lila:curse_ash", at); // sem a névoa: só cinzas no ar
  if ((c.flags.embersUntil ?? 0) > tick && tick % 40 === 0) fx(dim, "lila:curse_embers", at);
}

/** Rugido: medo em volta (monstros fracos e lentos) + tremor. */
export function curseRoar(c) {
  const e = c.entity;
  if (!e?.isValid) return;
  cact(e, "roar");
  const k = curseScale(c);
  shakeNear(e.dimension, e.location, 0.45, 1.2, 28 * k);
  try {
    for (const t of e.dimension.getEntities({ location: e.location, maxDistance: 16 * k, families: ["monster"] })) {
      t.addEffect("slowness", 160, { amplifier: 2 });
      t.addEffect("weakness", 160, { amplifier: 1 });
      const dx = t.location.x - e.location.x, dz = t.location.z - e.location.z, l = Math.hypot(dx, dz) || 1;
      t.applyKnockback({ x: (dx / l) * 1.4, z: (dz / l) * 1.4 }, 0.3);
    }
  } catch {
    /* ignore */
  }
}

/** Devorar: suga o que estiver na frente da boca (itens e monstros fracos) e engole. */
export function curseDevour(c) {
  const e = c.entity;
  if (!e?.isValid) return 0;
  cact(e, "devour");
  const k = curseScale(c);
  const rot = e.getRotation().y * Math.PI / 180;
  const front = { x: e.location.x - Math.sin(rot) * 3 * k, y: e.location.y + 1, z: e.location.z + Math.cos(rot) * 3 * k };
  let n = 0;
  for (let i = 0; i < 4; i++) {
    system.runTimeout(() => {
      if (!e.isValid) return;
      const mouth = { x: e.location.x - Math.sin(rot) * 1.2 * k, y: e.location.y + 3.2 * k, z: e.location.z + Math.cos(rot) * 1.2 * k };
      try {
        for (const t of e.dimension.getEntities({ location: front, maxDistance: 7 * k })) {
          if (t.id === e.id || t.id === c.rec.ownerId || t.typeId === "minecraft:player" || t.typeId === "lila:robot") continue;
          const dx = mouth.x - t.location.x, dz = mouth.z - t.location.z, l = Math.hypot(dx, dz) || 1;
          if (t.typeId === "minecraft:item" || t.typeId === "minecraft:xp_orb") {
            t.teleport(c.owner()?.location ?? mouth);
            n++;
            continue;
          }
          if (!t.matches({ families: ["monster"] })) continue;
          t.applyKnockback({ x: (dx / l) * 0.9, z: (dz / l) * 0.9 }, 0.25);
          if (i === 3) {
            t.applyDamage(26 * (k > 1 ? 3 : 1), { cause: EntityDamageCause.entityAttack, damagingEntity: e });
            n++;
          }
        }
      } catch {
        /* ignore */
      }
    }, 6 + i * 6);
  }
  return n;
}

/** Guarda: cruza os braços na frente do dono por alguns segundos (o dono não leva dano perto dela). */
export const GUARD = new Map(); // id do dono → tick até quando está protegido
export function curseGuard(c, ticks = 80) {
  const e = c.entity, o = c.owner();
  if (!e?.isValid || !o) return;
  cact(e, "guard", ticks);
  GUARD.set(o.id, system.currentTick + ticks);
  try {
    const f = o.getViewDirection();
    e.teleport({ x: o.location.x + f.x * 1.6, y: o.location.y, z: o.location.z + f.z * 1.6 }, { keepVelocity: false });
    faceTo(e, { x: o.location.x + f.x * 6, y: o.location.y, z: o.location.z + f.z * 6 });
  } catch {
    /* ignore */
  }
}
world.beforeEvents.entityHurt.subscribe((ev) => {
  const t = ev.hurtEntity;
  if (t?.typeId !== "minecraft:player") return;
  const until = GUARD.get(t.id);
  if (until && until > system.currentTick && ev.damageSource.cause !== "void") ev.cancel = true; // a maldição apara o golpe
});

/** Distância horizontal (exportada para o autoteste). */
export { hd as hdist, d3 as dist3 };

/** Inimigo mais perto (monstros ou marcados). */
export function nearestFoe(c, r = 14) {
  const e = c.entity;
  if (!e?.isValid) return undefined;
  const list = areaFoes(c, e.location, r * curseScale(c));
  list.sort((a, b) => d3(a.location, e.location) - d3(b.location, e.location));
  return list[0];
}

/** Pancada no chão em volta (com ou sem inimigo): tremor, rachaduras, arremessa tudo. */
export function curseSlamAround(c) {
  const e = c.entity;
  if (!e?.isValid) return;
  const k = curseScale(c);
  cact(e, "slam");
  system.runTimeout(() => {
    if (!e.isValid) return;
    const at = e.location;
    for (const t of areaFoes(c, at, 6 * k)) {
      try {
        const dx = t.location.x - at.x, dz = t.location.z - at.z, l = Math.hypot(dx, dz) || 1;
        t.applyDamage(14 * (k > 1 ? 3 : 1), { cause: EntityDamageCause.entityAttack, damagingEntity: e });
        t.applyKnockback({ x: (dx / l) * 1.6, z: (dz / l) * 1.6 }, 0.8);
      } catch {
        /* ignore */
      }
    }
    const dim = e.dimension;
    fx(dim, "lila:curse_quake", { x: at.x, y: at.y + 0.2, z: at.z });
    fx(dim, "lila:curse_ground", at);
    fx(dim, "lila:curse_ground_smoke", at);
    fx(dim, "lila:vfx_crack", { x: at.x, y: Math.floor(at.y) + 0.05, z: at.z }, { cr: 0.09, cg: 0.07, cb: 0.06, size: 4 * k, life: 3 });
    shakeNear(dim, at, 0.5, 0.6, 24 * k);
    snd(dim, "random.explode", at, 1, 0.6);
  }, 9);
}

/** Atacar o que o dono está mirando (marca como inimigo; ela vai até lá e luta). */
export function aimedTarget(player, max = 48) {
  try {
    for (const h of player.dimension.getEntitiesFromRay(player.getHeadLocation(), player.getViewDirection(), { maxDistance: max })) {
      const t = h.entity;
      if (t.id === player.id || t.typeId === "lila:drone" || t.typeId === "lila:robot" || t.typeId === "minecraft:item") continue;
      return t;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}
