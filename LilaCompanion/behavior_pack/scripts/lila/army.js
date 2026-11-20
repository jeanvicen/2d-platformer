// Modo exército: o DR-0N sobe, explode num clarão e vira N robôs-soldado (padrão 10).
// Eles te seguem com a IA do próprio jogo (pulam, nadam, abrem portas), caçam monstros antes de
// chegarem em você, revidam em quem te atacar (jogadores inclusive), atiram laser, e ficam de
// olho nas suas necessidades: vida baixa, fome, sem armadura, escuro, debaixo d'água, fogo, queda.
// "Cancelar" (ou "volta ao normal") junta todos de novo no drone.
import { EntityDamageCause, system } from "@minecraft/server";
import { OWNER_PROP } from "./companion.js";
import { particle, sound } from "./anim.js";
import { aggroTargets, canAttack, isHostile } from "./combat.js";
import { restoreBody, storeBody } from "./lifecycle.js";
import { flyTo } from "./drone.js";
import { buff, equipArmor, giveStacks, strengthKit } from "./creative.js";
import { say } from "./talk.js";
import { logError } from "../core/log.js";
import { ItemStack } from "@minecraft/server";

/** @typedef {import("./companion.js").Companion} Companion */

export const ROBOT = "lila:robot";
const MAX = 24;

/** Robôs vivos do dono (procura no mundo, então sobrevive a recarregar). */
export function robotsOf(c) {
  const out = [];
  try {
    const dim = c.dim();
    const o = c.owner();
    const at = o && o.dimension.id === dim.id ? o.location : c.rec.army?.at ?? c.pos();
    for (const e of dim.getEntities({ type: ROBOT, location: at, maxDistance: 256 })) {
      if (e.getDynamicProperty(OWNER_PROP) === c.rec.ownerId) out.push(e);
    }
  } catch {
    /* ignore */
  }
  return out;
}

export const armyActive = (c) => c.rec.form === "army";

function setRobotAction(r, a, ticks = 0) {
  try {
    if (r.getProperty("lila:action") !== a) r.setProperty("lila:action", a);
    if (ticks) system.runTimeout(() => r.isValid && r.getProperty("lila:action") === a && r.setProperty("lila:action", "idle"), ticks);
  } catch {
    /* ignore */
  }
}

/**
 * Explode em robôs.
 * @param {Companion} c
 */
export function* deploy(c, n = 10) {
  const owner = c.owner();
  if (!c.alive() || !owner) return false;
  n = Math.max(1, Math.min(MAX, Math.round(n)));
  if (c.rec.form && c.rec.form !== "drone") {
    try {
      c.entity?.triggerEvent("lila:form_drone");
    } catch {
      /* ignore */
    }
    c.rec.form = "drone";
  }
  say(c, `Modo exército! Separando em ${n} robôs...`, { force: true });
  const up = { x: owner.location.x, y: owner.location.y + 9, z: owner.location.z };
  yield* flyTo(c, up, { reach: 1.5, yTol: 1.5, timeout: 60 });
  sound(c.entity, "lila.transform", 1.2, 1.2);
  yield 14;
  const dim = c.dim();
  const at = { ...c.pos() };
  // clarão e estrondo (sem dano e sem quebrar nada)
  sound(c.entity, "lila.split", 2, 1);
  sound(c.entity, "random.explode", 1.2, 1.4);
  for (const k of ["lila:shock", "lila:sparkle", "lila:smoke", "lila:muzzle"]) particle(dim, k, at);
  try {
    dim.runCommand(`camerashake add @a[x=${Math.floor(at.x)},y=${Math.floor(at.y)},z=${Math.floor(at.z)},r=30] 0.3 0.5 positional`);
  } catch {
    /* ignore */
  }
  const sid = `lila:army_${c.rec.ownerId.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`;
  if (!storeBody(c, sid)) {
    say(c, "Não consegui me dividir aqui. Tenta num lugar aberto!", { force: true });
    return false;
  }
  c.rec.form = "army";
  c.rec.army = { sid, n, mode: "guard", at, dim: dim.id };
  c.save();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    try {
      const r = dim.spawnEntity(ROBOT, { x: at.x + Math.cos(a) * 0.6, y: at.y, z: at.z + Math.sin(a) * 0.6 });
      r.setDynamicProperty(OWNER_PROP, c.rec.ownerId);
      r.nameTag = `§bDR-0N §7#${i + 1}`;
      try {
        r.getComponent("minecraft:tameable")?.tame(owner);
      } catch {
        /* ignore */
      }
      r.applyImpulse({ x: Math.cos(a) * 0.9, y: 0.35, z: Math.sin(a) * 0.9 });
      setRobotAction(r, "spawn", 16);
    } catch (e) {
      logError("army.spawn", e);
    }
  }
  say(c, "Soldados prontos! A gente te protege, traz o que você precisar e te deixa mais forte.", { force: true });
  return true;
}

/**
 * Junta os robôs de volta no drone (eles sobem num facho de luz).
 * @param {Companion} c
 */
export function merge(c) {
  const rs = robotsOf(c);
  const o = c.owner();
  const dim = o?.dimension ?? c.dim();
  const center = o ? { x: o.location.x + 1.5, y: o.location.y + 1, z: o.location.z + 1.5 } : c.rec.army?.at ?? c.pos();
  for (const r of rs) {
    try {
      const p = r.location;
      for (let k = 0; k < 4; k++) particle(dim, "lila:scan", { x: p.x, y: p.y + k * 0.8, z: p.z });
      r.triggerEvent("lila:despawn");
    } catch {
      /* ignore */
    }
  }
  sound(o, "lila.transform", 1.2, 1.3);
  particle(dim, "lila:sparkle", center);
  const sid = c.rec.army?.sid;
  let e;
  if (sid) e = restoreBody(c, sid, dim, center);
  if (!e) {
    try {
      e = dim.spawnEntity(c.def.entity, center);
      e.setDynamicProperty(OWNER_PROP, c.rec.ownerId);
      e.nameTag = c.def.name;
    } catch (err) {
      logError("army.merge", err);
    }
  }
  if (e) c.entity = e;
  c.rec.form = "drone";
  c.rec.army = null;
  c.save();
  if (c.alive()) say(c, "Todo mundo de volta! Sou um drone de novo.", { force: true });
  return !!e;
}

/** Ordens para o exército. */
export function command(c, mode, player) {
  const rs = robotsOf(c);
  c.rec.army && (c.rec.army.mode = mode);
  c.save();
  if (mode === "follow" || mode === "guard" || mode === "stay") {
    for (const r of rs) {
      try {
        r.triggerEvent(`lila:mode_${mode}`);
      } catch {
        /* ignore */
      }
    }
    say(c, { follow: "Exército: te seguindo!", guard: "Exército: protegendo e atacando primeiro!", stay: "Exército: posição mantida aqui." }[mode], { force: true });
    return;
  }
  if (!player) return;
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  if (mode === "attack") {
    let target;
    try {
      target = player.dimension.getEntitiesFromRay(head, dir, { maxDistance: 80 }).map((h) => h.entity)
        .find((t) => t.id !== player.id && t.typeId !== ROBOT && t.typeId !== c.def.entity);
    } catch {
      /* ignore */
    }
    if (!target) {
      say(c, "Olhe para o alvo e mande atacar.", { force: true });
      return;
    }
    (c.flags.aggro ??= new Map()).set(target.id, system.currentTick + 1200);
    say(c, "Exército: ATACAR!", { force: true });
    return;
  }
  if (mode === "goto") {
    let at;
    try {
      const hit = player.dimension.getBlockFromRay(head, dir, { maxDistance: 96 });
      if (hit) at = { x: hit.block.location.x + 0.5, y: hit.block.location.y + 1, z: hit.block.location.z + 0.5 };
    } catch {
      /* ignore */
    }
    if (!at) return;
    c.flags.armyGoto = { at, until: system.currentTick + 400 };
    for (const r of rs) r.triggerEvent("lila:mode_stay");
    say(c, "Exército: indo para lá!", { force: true });
    return;
  }
  if (mode === "circle") {
    const o = player.location;
    rs.forEach((r, i) => {
      const a = (i / rs.length) * Math.PI * 2;
      flash(r);
      r.teleport({ x: o.x + Math.cos(a) * 4, y: o.y, z: o.z + Math.sin(a) * 4 }, { facingLocation: o });
    });
    say(c, "Formação em círculo!", { force: true });
  }
}

function flash(r) {
  try {
    particle(r.dimension, "lila:scan", r.location);
  } catch {
    /* ignore */
  }
}

/** Kit completo + efeitos, entregue por um robô. */
export function empower(c, player) {
  const rs = robotsOf(c);
  const r = rs[0];
  if (r) {
    setRobotAction(r, "give", 30);
    try {
      r.teleport({ x: player.location.x + 1, y: player.location.y, z: player.location.z }, { facingLocation: player.location });
    } catch {
      /* ignore */
    }
  }
  const rest = equipArmor(player, strengthKit());
  giveStacks(player, rest);
  buff(player, "battle");
  say(c, "Armadura de netherita encantada vestida, armas, totem e maçãs no seu inventário. Bora!", { force: true });
}

/**
 * A cada 5 ticks: tiros de laser, deslocamento para "vai lá", e as necessidades do dono.
 * @param {Companion} c
 */
export function armyTick(c) {
  const now = system.currentTick;
  if (now % 5 !== 0) return;
  const rs = robotsOf(c);
  const o = c.owner();
  if (!rs.length) {
    // todos caíram: o drone se remonta
    if (now % 100 === 0 && o) {
      say(c, "Meus soldados caíram... me remontando!", { force: true });
      merge(c);
    }
    return;
  }
  const dim = rs[0].dimension;
  const marked = o ? aggroTargets(c, o.location, 48) : [];
  const go = c.flags.armyGoto;
  for (const r of rs) {
    if (!r.isValid) continue;
    // longe demais do dono (teleporte, outra dimensão): reaparece perto
    if (o && (r.dimension.id !== o.dimension.id || Math.hypot(r.location.x - o.location.x, r.location.z - o.location.z) > 64) && !go) {
      try {
        r.teleport({ x: o.location.x + (Math.random() - 0.5) * 6, y: o.location.y, z: o.location.z + (Math.random() - 0.5) * 6 }, { dimension: o.dimension });
      } catch {
        /* ignore */
      }
      continue;
    }
    // "vai lá": voa com o propulsor até o ponto
    if (go && now < go.until) {
      const dx = go.at.x - r.location.x, dz = go.at.z - r.location.z, dy = go.at.y - r.location.y;
      const d = Math.hypot(dx, dz);
      if (d > 2) {
        try {
          const v = r.getVelocity();
          r.applyImpulse({ x: (dx / d) * 0.55 - v.x, y: dy > 0.5 || !r.isOnGround ? 0.12 : 0, z: (dz / d) * 0.55 - v.z });
          setRobotAction(r, "fly");
        } catch {
          /* ignore */
        }
      } else setRobotAction(r, "idle");
    }
    // laser no inimigo mais perto (marcados primeiro)
    const t = pickTarget(c, r, marked);
    if (t && (now + hash(r.id)) % 10 === 0) laser(c, r, t);
  }
  if (go && now >= go.until) {
    c.flags.armyGoto = null;
    for (const r of rs) r.triggerEvent(`lila:mode_${c.rec.army?.mode === "stay" ? "stay" : "guard"}`);
  }
  if (o && now % 40 === 0) needs(c, o, rs);
}

function hash(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function pickTarget(c, r, marked) {
  let best, bd = 18 * 18;
  const p = r.location;
  for (const t of marked) {
    const d = (t.location.x - p.x) ** 2 + (t.location.z - p.z) ** 2;
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  if (best) return best;
  try {
    for (const t of r.dimension.getEntities({ location: p, maxDistance: 16, families: ["monster"] })) {
      if (!isHostile(t) || !canAttack(c, t)) continue;
      const d = (t.location.x - p.x) ** 2 + (t.location.z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
  } catch {
    /* ignore */
  }
  return best;
}

function laser(c, r, t) {
  const from = { x: r.location.x, y: r.location.y + 1.3, z: r.location.z };
  const to = { x: t.location.x, y: t.location.y + 0.9, z: t.location.z };
  const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  try {
    const hit = r.dimension.getBlockFromRay(from, { x: (to.x - from.x) / d, y: (to.y - from.y) / d, z: (to.z - from.z) / d }, { maxDistance: d });
    if (hit && Math.hypot(hit.block.location.x - from.x, hit.block.location.z - from.z) < d - 1.5) return;
  } catch {
    /* ignore */
  }
  try {
    r.setRotation({ x: 0, y: (-Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI });
  } catch {
    /* ignore */
  }
  setRobotAction(r, "shoot", 8);
  const n = Math.min(10, Math.ceil(d / 1.5));
  for (let i = 1; i <= n; i++) {
    const k = i / (n + 1);
    particle(r.dimension, "lila:scan", { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k });
  }
  try {
    r.dimension.playSound("lila.laser", from, { volume: 0.5, pitch: 0.9 + Math.random() * 0.3 });
    t.applyDamage(7, { cause: EntityDamageCause.entityAttack, damagingEntity: r });
  } catch {
    /* ignore */
  }
}

/** Vê o que o dono está precisando e um robô leva. */
function needs(c, o, rs) {
  const cd = (c.flags.armyCd ??= {});
  const now = system.currentTick;
  const ready = (k, t) => {
    if (now < (cd[k] ?? 0)) return false;
    cd[k] = now + t;
    return true;
  };
  const courier = rs.reduce((a, b) => (dist(a, o) < dist(b, o) ? a : b));
  const deliver = (msg, fn) => {
    setRobotAction(courier, "give", 30);
    try {
      courier.teleport({ x: o.location.x + 1.2, y: o.location.y, z: o.location.z + 0.6 }, { facingLocation: o.location });
    } catch {
      /* ignore */
    }
    fn();
    sound(o, "random.pop", 0.8, 1.2);
    say(c, msg, { chatter: false, force: true });
  };
  let hp = 20, food = 20;
  try {
    hp = o.getComponent("minecraft:health")?.currentValue ?? 20;
    food = o.getComponent("minecraft:player.hunger")?.currentValue ?? 20;
  } catch {
    /* ignore */
  }
  if (hp <= 10 && ready("heal", 300)) {
    deliver("Você tá ferido! Maçã dourada e regeneração!", () => {
      buff(o, "heal");
      giveStacks(o, [new ItemStack("minecraft:golden_apple", 4)]);
    });
    return;
  }
  if (food <= 12 && ready("food", 600)) {
    deliver("Trouxe comida pra você.", () => giveStacks(o, [new ItemStack("minecraft:cooked_beef", 16), new ItemStack("minecraft:golden_carrot", 8)]));
    return;
  }
  try {
    const eq = o.getComponent("minecraft:equippable");
    const chest = eq?.getEquipment(/** @type {any} */ ("Chest"));
    if ((!chest || !/netherite|diamond/.test(chest.typeId)) && ready("armor", 2400)) {
      deliver("Você tá sem armadura boa. Toma netherita encantada!", () => giveStacks(o, equipArmor(o, strengthKit({ armorOnly: true }))));
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    if (o.isInWater && ready("water", 1200)) {
      deliver("Respiração aquática e visão noturna!", () => buff(o, "water"));
      return;
    }
    if (o.isOnFire?.() !== undefined) {
      /* algumas versões expõem isOnFire como função */
    }
    if (o.getComponent("minecraft:onfire") && ready("fire", 600)) {
      deliver("Resistência ao fogo!", () => buff(o, "fire"));
      return;
    }
    if (o.isFalling && o.getVelocity().y < -0.9 && ready("fall", 200)) {
      deliver("Queda livre? Toma queda lenta!", () => buff(o, "fall"));
      return;
    }
    const blk = o.dimension.getBlock({ x: Math.floor(o.location.x), y: Math.floor(o.location.y), z: Math.floor(o.location.z) });
    if (blk && blk.getLightLevel() < 5 && ready("night", 2400)) {
      deliver("Tá escuro. Visão noturna ativada!", () => buff(o, "night"));
      return;
    }
  } catch {
    /* ignore */
  }
  // em combate: força e resistência
  try {
    const near = o.dimension.getEntities({ location: o.location, maxDistance: 10, families: ["monster"] }).length;
    if (near >= 3 && ready("battle", 1800)) deliver("Muitos monstros! Força e resistência pra você!", () => buff(o, "battle"));
  } catch {
    /* ignore */
  }
}

const dist = (r, o) => Math.hypot(r.location.x - o.location.x, r.location.z - o.location.z);
