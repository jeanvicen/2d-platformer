// 3.4 — A LIGAÇÃO da Maldição com o dono (inspirada em espíritos protetores do anime, sem copiar):
// - você quase morrendo → ela vem pelas suas costas, te ABRAÇA e te regenera, enquanto fica furiosa com
//   tudo em volta (gritos, tremores, monstros arremessados, plantas arrancadas). Quando você se recupera,
//   ela se acalma;
// - ela com pouca vida → FÚRIA: cresce, dá um rugido enorme e bate mais forte por um tempo;
// - frases especiais, raras (não toda hora);
// - poderes novos: ordens amaldiçoadas ("NÃO SE MEXAM", "CAIAM"), grito devastador, esmagar, abraço, fúria;
// - poderes que funcionam SEM invocar a Maldição (pelo item): katana, cura e ordem.
import { EntityDamageCause, ItemStack, system } from "@minecraft/server";
import { BASE_SCALE, areaFoes, cact, cactOf, curseScale, faceTo, fx, isCurseForm, nearestFoe, shakeNear, snd } from "./curse.js";
import { say } from "./talk.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

const LINES_PROTECT = ["§4§lNÃO TOCA EM QUEM É MEU!!", "§4§lSAI DE PERTO!!!", "§4§lNINGUÉM MACHUCA O QUE É MEU!", "§4§lEU VOU TE DESTRUIR!!"];
const LINES_CALM = ["§5...tá tudo bem agora.", "§5...fica comigo.", "§5...ninguém vai te tirar de mim."];
const LINES_RAGE = ["§4§lVOCÊS VÃO PAGAR!!!", "§4§lAAAAAAAH!!!", "§4§lEU NÃO VOU SUMIR!!"];
const LINE_GAP = 20 * 120; // frases especiais: no máximo uma a cada 2 minutos

function hpRatio(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return h ? h.currentValue / Math.max(1, h.effectiveMax) : 1;
  } catch {
    return 1;
  }
}
function heal(e, n) {
  try {
    const h = e.getComponent("minecraft:health");
    if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + n));
  } catch {
    /* ignore */
  }
}
function effect(e, id, ticks, amp = 0) {
  try {
    e.addEffect(id, ticks, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
}
function special(c, list) {
  const t = system.currentTick;
  if (t < (c.flags.lineNext ?? 0)) return;
  c.flags.lineNext = t + LINE_GAP;
  say(c, list[Math.floor(Math.random() * list.length)], { force: true });
}

/** Explosão de raiva em volta de um ponto: dano, arremesso, tremor e plantas arrancadas. */
function ragePulse(c, at, r, dmg) {
  const dim = c.dim();
  shakeNear(dim, at, 0.5, 0.7, 24);
  fx(dim, "lila:curse_quake", at);
  fx(dim, "lila:curse_roar", { x: at.x, y: at.y + 3, z: at.z });
  for (const t of areaFoes(c, at, r)) {
    try {
      const dx = t.location.x - at.x, dz = t.location.z - at.z, l = Math.hypot(dx, dz) || 1;
      t.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity });
      t.applyKnockback({ x: (dx / l) * 2.4, z: (dz / l) * 2.4 }, 0.6);
      fx(dim, "lila:curse_hit", t.location);
    } catch {
      /* ignore */
    }
  }
  // arranca só natureza (folhas, mato, flores) — nunca construção sua
  try {
    const R = 5;
    for (let x = -R; x <= R; x += 2) for (let z = -R; z <= R; z += 2) for (let y = -1; y <= 4; y++) {
      const b = dim.getBlock({ x: Math.floor(at.x) + x, y: Math.floor(at.y) + y, z: Math.floor(at.z) + z });
      if (b && /leaves|short_grass|tall_grass|fern|flower|poppy|dandelion|bush|vine|azalea$/.test(b.typeId) && Math.random() < 0.5) {
        dim.runCommand(`setblock ${b.location.x} ${b.location.y} ${b.location.z} air destroy`);
      }
    }
  } catch {
    /* ignore */
  }
}

// ============================================================================ abraço protetor
function startHug(c, o, secs = 30) {
  const e = c.entity;
  if (!e?.isValid) return;
  c.flags.hug = { until: system.currentTick + secs * 20, next: 0 };
  cact(e, "hug", 0);
  snd(e.dimension, "mob.warden.roar", e.location, 1.3, 0.6);
  shakeNear(e.dimension, o.location, 0.6, 0.8, 24);
  special(c, LINES_PROTECT);
}
function endHug(c) {
  c.flags.hug = undefined;
  const e = c.entity;
  if (!e?.isValid) return;
  cact(e, "calm");
  if (Math.random() < 0.5) special(c, LINES_CALM);
}
function hugTick(c, o, tick) {
  const e = c.entity;
  const H = c.flags.hug;
  if (!e?.isValid || !H) return;
  const k = curseScale(c);
  // atrás de você, mais baixa para os braços envolverem o seu peito
  const yaw = (o.getRotation().y * Math.PI) / 180;
  const back = { x: -Math.sin(yaw), z: Math.cos(yaw) };
  const at = { x: o.location.x - back.x * 0.9 * k, y: o.location.y - 2.35 * k, z: o.location.z - back.z * 0.9 * k };
  try {
    e.teleport(at, { rotation: { x: 0, y: o.getRotation().y }, keepVelocity: false });
  } catch {
    /* ignore */
  }
  if (cactOf(e) !== "hug") cact(e, "hug", 0);
  if (tick % 10 === 0) {
    heal(o, 2);
    effect(o, "regeneration", 60, 2);
    effect(o, "resistance", 60, 2);
    fx(o.dimension, "lila:curse_inhale", { x: o.location.x, y: o.location.y + 1, z: o.location.z });
  }
  // furiosa com tudo em volta enquanto te segura
  if (tick >= H.next) {
    H.next = tick + 34;
    ragePulse(c, o.location, 12, 12);
    snd(o.dimension, Math.random() < 0.5 ? "mob.warden.roar" : "mob.ravager.roar", o.location, 1.4, 0.55 + Math.random() * 0.2);
  }
  if (hpRatio(o) >= 0.85 || tick > H.until) endHug(c);
}

// ============================================================================ fúria (ela com pouca vida)
export function startRage(c, secs = 20, grow = true) {
  const e = c.entity;
  if (!e?.isValid || !isCurseForm(c)) return false;
  const tick = system.currentTick;
  c.flags.rageUntil = tick + secs * 20;
  c.flags.rageNext = 0;
  if (grow && c.rec.form !== "colossus") {
    try {
      e.triggerEvent("lila:enrage"); // cresce
      c.flags.enlarged = true;
    } catch (err) {
      logError("devotion.enrage", err);
    }
  }
  heal(e, 120);
  cact(e, "rage");
  const at = e.location, dim = e.dimension;
  snd(dim, "mob.enderdragon.growl", at, 2, 0.6);
  snd(dim, "mob.warden.roar", at, 2, 0.5);
  shakeNear(dim, at, 1.2, 1.4, 40);
  for (let i = 0; i < 4; i++) system.runTimeout(() => c.alive() && fx(dim, "lila:curse_roar", { x: at.x, y: at.y + 5 + i, z: at.z }), i * 5);
  special(c, LINES_RAGE);
  return true;
}
function endRage(c) {
  c.flags.rageUntil = 0;
  const e = c.entity;
  if (!e?.isValid) return;
  if (c.flags.enlarged) {
    c.flags.enlarged = false;
    try {
      e.triggerEvent("lila:enrage_end");
      system.runTimeout(() => {
        try {
          if (e.isValid && (c.rec.form ?? "drone") === "drone") e.triggerEvent("lila:enrage_reset");
        } catch {
          /* ignore */
        }
      }, 2);
    } catch {
      /* ignore */
    }
  }
  cact(e, "calm");
}
function rageTick(c, tick) {
  const e = c.entity;
  if (!e?.isValid) return;
  if (tick > (c.flags.rageUntil ?? 0)) return endRage(c);
  if (tick >= (c.flags.rageNext ?? 0)) {
    c.flags.rageNext = tick + 50;
    cact(e, "rage");
    ragePulse(c, e.location, 10 * (curseScale(c) / BASE_SCALE), 14);
    snd(e.dimension, "mob.warden.roar", e.location, 1.6, 0.5 + Math.random() * 0.2);
  }
}

/** Chamado a cada 2 ticks para cada maldição invocada. */
export function devotionTick(c, tick) {
  const e = c.entity, o = c.owner();
  if (!e?.isValid || !o?.isValid || c.rec.off || !isCurseForm(c)) {
    if (c.flags.hug) c.flags.hug = undefined;
    return;
  }
  try {
    if (c.flags.hug) hugTick(c, o, tick);
    else if (hpRatio(o) <= 0.3 && tick > (c.flags.hugCd ?? 0) && o.dimension.id === e.dimension.id) {
      c.flags.hugCd = tick + 20 * 20;
      startHug(c, o);
    }
    if ((c.flags.rageUntil ?? 0) > 0) rageTick(c, tick);
    else if (hpRatio(e) <= 0.3 && tick > (c.flags.rageCd ?? 0)) {
      c.flags.rageCd = tick + 20 * 60;
      startRage(c);
    }
  } catch (err) {
    logError("devotion.tick", err);
  }
}
export const hugging = (c) => !!c.flags.hug;

// ============================================================================ poderes novos
function foesAround(c, at, r) {
  return areaFoes(c, at, r);
}
/** Sem a maldição invocada: monstros em volta do jogador. */
function soloFoes(p, r) {
  try {
    return p.dimension.getEntities({ location: p.location, maxDistance: r, families: ["monster"] });
  } catch {
    return [];
  }
}
function title(o, text, sub = "") {
  try {
    o.onScreenDisplay.setTitle(text, { subtitle: sub, fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 10 });
  } catch {
    /* ignore */
  }
}

/** Ordem amaldiçoada: "NÃO SE MEXAM" — tudo em volta congela. */
export function orderFreeze(c, from) {
  const src = c?.entity?.isValid ? c.entity : from;
  if (!src) return 0;
  if (c?.entity?.isValid) cact(c.entity, "command");
  const at = src.location;
  const list = c?.entity?.isValid ? foesAround(c, at, 20) : soloFoes(src, 16);
  for (const t of list) {
    effect(t, "slowness", 120, 255);
    effect(t, "weakness", 120, 4);
    effect(t, "mining_fatigue", 120, 3);
    fx(t.dimension, "lila:curse_form", t.location);
  }
  snd(src.dimension, "mob.warden.sonic_charge", at, 1.5, 0.6);
  shakeNear(src.dimension, at, 0.4, 0.6, 24);
  const o = c?.owner?.() ?? from;
  if (o) title(o, "§5§l«NÃO SE MEXAM»", `§7${list.length} congelado(s)`);
  return list.length;
}
/** Ordem amaldiçoada: "CAIAM" — tudo em volta é esmagado contra o chão. */
export function orderFall(c, from) {
  const src = c?.entity?.isValid ? c.entity : from;
  if (!src) return 0;
  if (c?.entity?.isValid) cact(c.entity, "command");
  const at = src.location;
  const list = c?.entity?.isValid ? foesAround(c, at, 18) : soloFoes(src, 14);
  system.runTimeout(() => {
    for (const t of list) {
      try {
        if (!t.isValid) continue;
        t.applyKnockback({ x: 0, z: 0 }, -2.5);
        t.applyDamage(12, c?.entity?.isValid ? { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity } : { cause: EntityDamageCause.magic });
        effect(t, "slowness", 80, 3);
        fx(t.dimension, "lila:curse_quake", t.location);
      } catch {
        /* ignore */
      }
    }
    shakeNear(src.dimension, at, 0.8, 0.8, 24);
    snd(src.dimension, "random.explode", at, 1.2, 0.6);
  }, 10);
  const o = c?.owner?.() ?? from;
  if (o) title(o, "§5§l«CAIAM»", `§7${list.length} no chão`);
  return list.length;
}
/** Grito devastador: um cone de energia amaldiçoada sai da boca dela e arrasa o que estiver na frente. */
export function devastatingScream(c) {
  const e = c.entity;
  if (!e?.isValid) return 0;
  const o = c.owner();
  const k = curseScale(c);
  let dir;
  try {
    dir = o ? o.getViewDirection() : e.getViewDirection();
  } catch {
    dir = { x: 0, y: 0, z: 1 };
  }
  const hl = Math.hypot(dir.x, dir.z) || 1;
  const f = { x: dir.x / hl, z: dir.z / hl };
  faceTo(e, { x: e.location.x + f.x * 5, y: e.location.y, z: e.location.z + f.z * 5 });
  cact(e, "command");
  const mouth = { x: e.location.x + f.x * 1.2 * k, y: e.location.y + 4.6 * k, z: e.location.z + f.z * 1.2 * k };
  let hit = 0;
  system.runTimeout(() => {
    if (!c.alive()) return;
    const dim = e.dimension;
    snd(dim, "mob.warden.sonic_boom", mouth, 2, 0.6);
    snd(dim, "mob.warden.roar", mouth, 2, 0.5);
    shakeNear(dim, mouth, 0.9, 1, 32);
    for (let d = 2; d <= 28; d += 2) {
      fx(dim, "lila:curse_roar", { x: mouth.x + f.x * d, y: mouth.y - d * 0.12, z: mouth.z + f.z * d });
    }
    for (const t of areaFoes(c, e.location, 30)) {
      const vx = t.location.x - e.location.x, vz = t.location.z - e.location.z, l = Math.hypot(vx, vz) || 1;
      if ((vx * f.x + vz * f.z) / l < 0.72) continue; // fora do cone
      try {
        t.applyDamage(24 * (k >= 3 ? 2 : 1), { cause: EntityDamageCause.entityAttack, damagingEntity: e });
        t.applyKnockback({ x: f.x * 3, z: f.z * 3 }, 0.8);
        hit++;
      } catch {
        /* ignore */
      }
    }
  }, 8);
  return hit;
}
/** Esmagar: agarra o inimigo mais perto, ergue acima da cabeça, esmaga e joga no chão. */
export function crushFoe(c) {
  const e = c.entity;
  if (!e?.isValid) return false;
  const t = nearestFoe(c, 7);
  if (!t) {
    cact(e, "crush");
    return false;
  }
  const k = curseScale(c);
  faceTo(e, t.location);
  cact(e, "crush");
  const hold = () => {
    const yaw = (e.getRotation().y * Math.PI) / 180;
    return { x: e.location.x - Math.sin(yaw) * 1.2 * k, y: e.location.y + 5.6 * k, z: e.location.z + Math.cos(yaw) * 1.2 * k };
  };
  for (let i = 6; i <= 26; i += 2) {
    system.runTimeout(() => {
      try {
        if (t.isValid && e.isValid) t.teleport(hold(), { keepVelocity: false });
      } catch {
        /* ignore */
      }
    }, i);
  }
  system.runTimeout(() => {
    try {
      if (!t.isValid) return;
      t.applyDamage(18, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
      snd(e.dimension, "mob.irongolem.hit", t.location, 1.4, 0.6);
    } catch {
      /* ignore */
    }
  }, 20);
  system.runTimeout(() => {
    try {
      if (!t.isValid) return;
      const yaw = (e.getRotation().y * Math.PI) / 180;
      t.applyKnockback({ x: -Math.sin(yaw) * 2, z: Math.cos(yaw) * 2 }, -2);
      t.applyDamage(14, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
      fx(e.dimension, "lila:curse_quake", t.location);
      shakeNear(e.dimension, t.location, 0.6, 0.6, 20);
    } catch {
      /* ignore */
    }
  }, 29);
  return true;
}
/** Abraço manual (cura) por alguns segundos. */
export function hugNow(c, secs = 10) {
  const o = c.owner();
  if (!o || !c.entity?.isValid) return false;
  startHug(c, o, secs);
  return true;
}

// ============================================================================ sem invocar (pelo item)
const KATANA = "lila:curse_katana";
/** A katana sai da "boca" da maldição, mesmo sem ela aqui (só a cabeça dela, no item). */
export function summonKatana(player) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;
    for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === KATANA) {
      player.onScreenDisplay.setActionBar("§5Você já tem a Katana da Maldição.");
      return false;
    }
    const st = new ItemStack(KATANA, 1);
    st.nameTag = "§5§lKatana da Maldição";
    st.setLore(["§8Saiu da boca da sua maldição.", "§7Corte amaldiçoado: dano alto."]);
    const left = inv.addItem(st);
    if (left) player.dimension.spawnItem(left, player.location);
    const at = { x: player.location.x, y: player.location.y + 1.4, z: player.location.z };
    fx(player.dimension, "lila:curse_burst", at);
    fx(player.dimension, "lila:curse_slash", at);
    snd(player.dimension, "mob.warden.emerge", at, 0.6, 1.4);
    snd(player.dimension, "item.trident.return", at, 1, 0.7);
    return true;
  } catch (err) {
    logError("devotion.katana", err);
    return false;
  }
}
/** Cura da maldição, sem invocar (recarga de 60 s). */
export function curseHealSolo(player) {
  const t = system.currentTick;
  const k = `${player.id}`;
  if ((SOLO_CD.get(k) ?? 0) > t) {
    player.onScreenDisplay.setActionBar(`§7A cura volta em §f${Math.ceil((SOLO_CD.get(k) - t) / 20)} s`);
    return false;
  }
  SOLO_CD.set(k, t + 20 * 60);
  heal(player, 10);
  effect(player, "regeneration", 200, 2);
  effect(player, "absorption", 600, 2);
  fx(player.dimension, "lila:curse_inhale", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
  snd(player.dimension, "mob.warden.heartbeat", player.location, 1, 1);
  return true;
}
const SOLO_CD = new Map();
