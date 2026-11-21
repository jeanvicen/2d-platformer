// Modo exército: o Hacknd sobe, explode num clarão e vira N robôs-soldado (padrão 10).
// Eles te seguem com a IA do próprio jogo (pulam, nadam, abrem portas), caçam monstros antes de
// chegarem em você, revidam em quem te atacar (jogadores inclusive) e ficam de olho nas suas
// necessidades: vida baixa, fome, sem armadura, escuro, debaixo d'água, fogo, queda.
// 2.3: cinco tipos de robô (soldado, construtor, artilheiro, médico, ninja), formações, e o
// exército inteiro constrói junto (castelos, megaconstruções e o catálogo: cada robô voa até um
// pedaço da obra e solda os blocos). Menos lag: a lista de robôs fica em cache e a busca de
// inimigos é uma só por rodada (antes era uma por robô).
// "Cancelar" (ou "volta ao normal") junta todos de novo no drone.
import { EntityDamageCause, ItemStack, system, world } from "@minecraft/server";
import { OWNER_PROP } from "./companion.js";
import { particle, sound } from "./anim.js";
import { aggroTargets, canAttack, isHostile } from "./combat.js";
import { restoreBody, storeBody } from "./lifecycle.js";
import { flyTo } from "./drone.js";
import { buff, equipArmor, giveStacks, strengthKit } from "./creative.js";
import { pickSite, planExtras, planStream, planVolume, unloadArea, verifyPlan } from "./mega.js";
import { perm, UNBREAKABLE } from "./handwork.js";
import { say } from "./talk.js";
import { nanoAssemble, nanoBurst } from "./nanofx.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

export const ROBOT = "lila:robot";
const MAX = 24;

/** Os tipos de soldado (o índice é a propriedade lila:kind do robô). */
export const KINDS = ["soldado", "construtor", "artilheiro", "medico", "ninja"];
export const KIND_NAMES = ["soldado", "construtor", "artilheiro", "médico", "ninja"];
const KIND_COLOR = ["§b", "§e", "§c", "§a", "§d"];
/** Estilos de exército: misto (de tudo um pouco) ou só um tipo. */
export const ARMY_STYLES = {
  misto: { name: "Misto (de tudo um pouco)", mix: [0, 2, 4, 0, 3, 1, 0, 4, 2, 1, 0, 3] },
  soldados: { name: "Só soldados (laser)", mix: [0] },
  ninjas: { name: "Ninjas (teleporte + espada)", mix: [4] },
  artilheiros: { name: "Artilharia (canhão de longe)", mix: [2] },
  construtores: { name: "Construtores (obra rápida)", mix: [1] },
  medicos: { name: "Médicos (curam você)", mix: [3, 3, 0] },
};

/**
 * Robôs vivos do dono. Guarda os ids e só varre o mundo de novo a cada 10 s (antes varria 256
 * blocos a cada 5 ticks: era o principal lag do modo exército).
 */
export function robotsOf(c, fresh = false) {
  const now = system.currentTick;
  const cache = c.flags.armyCache;
  if (!fresh && cache && now - cache.t < 200) {
    const out = [];
    for (const id of cache.ids) {
      try {
        const e = world.getEntity(id);
        if (e?.isValid) out.push(e);
      } catch {
        /* ignore */
      }
    }
    if (out.length || now - cache.t < 40) return out;
  }
  const out = [];
  try {
    const dim = c.dim();
    const o = c.owner();
    const at = o && o.dimension.id === dim.id ? o.location : c.rec.army?.at ?? c.pos();
    for (const e of (o?.dimension ?? dim).getEntities({ type: ROBOT, location: at, maxDistance: 256 })) {
      if (e.getDynamicProperty(OWNER_PROP) === c.rec.ownerId) out.push(e);
    }
  } catch {
    /* ignore */
  }
  c.flags.armyCache = { t: now, ids: out.map((e) => e.id) };
  return out;
}

export const armyActive = (c) => c.rec.form === "army";

function kindOf(r) {
  try {
    return /** @type {number} */ (r.getProperty("lila:kind")) ?? 0;
  } catch {
    return 0;
  }
}

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
export function* deploy(c, n = 10, style = "misto") {
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
  say(c, `Modo exército! O enxame vai se dividir em ${n} soldados de nanorrobôs...`, { force: true });
  const up = { x: owner.location.x, y: owner.location.y + 9, z: owner.location.z };
  yield* flyTo(c, up, { reach: 1.5, yTol: 1.5, timeout: 60 });
  sound(c.entity, "lila.transform", 1.2, 1.2);
  yield 14;
  const dim = c.dim();
  const at = { ...c.pos() };
  // o enxame se abre numa explosão macia de poeira (sem dano e sem quebrar nada)
  sound(c.entity, "lila.split", 2, 1);
  sound(c.entity, "mob.bee.loop", 1.2, 0.6);
  nanoBurst(dim, at, 2.6);
  particle(dim, "lila:shock", at);
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
  const st = ARMY_STYLES[style] ?? ARMY_STYLES.misto;
  c.rec.form = "army";
  c.rec.army = { sid, n, mode: "guard", at, dim: dim.id, style };
  c.save();
  const ids = [];
  const count = [0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const kind = st.mix[i % st.mix.length];
    try {
      const r = dim.spawnEntity(ROBOT, { x: at.x + Math.cos(a) * 0.6, y: at.y, z: at.z + Math.sin(a) * 0.6 });
      r.setDynamicProperty(OWNER_PROP, c.rec.ownerId);
      r.setProperty("lila:kind", kind);
      r.nameTag = `${KIND_COLOR[kind]}Hacknd §7#${i + 1} ${KIND_NAMES[kind]}`;
      try {
        r.getComponent("minecraft:tameable")?.tame(owner);
        // ninja é rápido; artilheiro é pesado
        if (kind === 4) r.getComponent("minecraft:movement")?.setCurrentValue(0.46);
        if (kind === 2) r.getComponent("minecraft:movement")?.setCurrentValue(0.28);
      } catch {
        /* ignore */
      }
      r.applyImpulse({ x: Math.cos(a) * 0.9, y: 0.35, z: Math.sin(a) * 0.9 });
      setRobotAction(r, "spawn", 16);
      nanoAssemble(dim, r.location, 0.75); // cada soldado compacta a partir da nuvem
      ids.push(r.id);
      count[kind]++;
    } catch (e) {
      logError("army.spawn", e);
    }
  }
  c.flags.armyCache = { t: system.currentTick, ids };
  const parts = count.map((k, i) => (k ? `${k} ${KIND_NAMES[i]}${k > 1 ? (i === 3 ? "s" : "s") : ""}` : "")).filter(Boolean).join(", ");
  say(c, `Soldados prontos! (${parts}) A gente te protege, traz o que você precisar e até constrói castelos.`, { force: true });
  return true;
}

/**
 * Junta os robôs de volta no drone (eles sobem num facho de luz).
 * @param {Companion} c
 */
export function merge(c) {
  stopBuild(c, true);
  const rs = robotsOf(c, true);
  const o = c.owner();
  const dim = o?.dimension ?? c.dim();
  const center = o ? { x: o.location.x + 1.5, y: o.location.y + 1, z: o.location.z + 1.5 } : c.rec.army?.at ?? c.pos();
  for (const r of rs) {
    try {
      const p = r.location;
      nanoBurst(r.dimension, p, 0.75); // o soldado vira poeira e volta para a nuvem
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
  c.flags.armyCache = null;
  c.save();
  if (c.alive()) say(c, "Todo mundo de volta! Somos um enxame de novo.", { force: true });
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
  if (mode === "circle" || mode === "line" || mode === "wedge") {
    const o = player.location;
    const v = player.getViewDirection();
    const l = Math.hypot(v.x, v.z) || 1;
    const f = { x: v.x / l, z: v.z / l }, sd = { x: -f.z, z: f.x };
    const look = { x: o.x + f.x * 20, y: o.y, z: o.z + f.z * 20 };
    rs.forEach((r, i) => {
      let p;
      if (mode === "circle") {
        const a = (i / rs.length) * Math.PI * 2;
        p = { x: o.x + Math.cos(a) * 4, y: o.y, z: o.z + Math.sin(a) * 4 };
      } else if (mode === "line") {
        // linha de frente, 3 blocos à sua frente
        const k = i - (rs.length - 1) / 2;
        p = { x: o.x + f.x * 3 + sd.x * k * 1.6, y: o.y, z: o.z + f.z * 3 + sd.z * k * 1.6 };
      } else {
        // cunha em V apontando para onde você olha
        const row = Math.floor((i + 1) / 2), side = i % 2 ? 1 : -1;
        p = { x: o.x + f.x * (5 - row * 1.4) + sd.x * side * row * 1.5, y: o.y, z: o.z + f.z * (5 - row * 1.4) + sd.z * side * row * 1.5 };
      }
      flash(r);
      try {
        const top = r.dimension.getTopmostBlock({ x: p.x, z: p.z }, Math.floor(o.y) + 4);
        if (top && Math.abs(top.y + 1 - o.y) < 5) p.y = top.y + 1;
        r.teleport(p, { facingLocation: mode === "circle" ? o : look });
      } catch {
        /* ignore */
      }
    });
    say(c, { circle: "Formação em círculo!", line: "Linha de frente!", wedge: "Formação em V!" }[mode], { force: true });
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
 * Todo tick: a obra do exército (se tiver). A cada 5 ticks: combate de cada tipo, "vai lá", e as
 * necessidades do dono.
 * @param {Companion} c
 */
export function armyTick(c) {
  const now = system.currentTick;
  const job = c.flags.armyJob;
  if (job) {
    try {
      jobTick(c, robotsOf(c));
    } catch (e) {
      logError("army.job", e);
      stopBuild(c, true);
    }
  }
  if (now % 5 !== 0) return;
  const rs = robotsOf(c);
  const o = c.owner();
  if (!rs.length) {
    // todos caíram: o drone se remonta
    if (now % 100 === 0 && o && !robotsOf(c, true).length) {
      say(c, "Meus soldados caíram... me remontando!", { force: true });
      merge(c);
    }
    return;
  }
  // inimigos: UMA busca por rodada para o exército todo (antes era uma por robô)
  const foes = [];
  if (o) {
    for (const t of aggroTargets(c, o.location, 48)) foes.push(t);
    try {
      for (const t of o.dimension.getEntities({ location: o.location, maxDistance: 36, families: ["monster"] })) {
        if (isHostile(t) && canAttack(c, t) && !foes.includes(t)) foes.push(t);
      }
    } catch {
      /* ignore */
    }
  }
  const marked = new Set(aggroTargets(c, o?.location ?? c.pos(), 48).map((t) => t.id));
  const go = c.flags.armyGoto;
  const building = !!c.flags.armyJob;
  for (const r of rs) {
    if (!r.isValid) continue;
    // longe demais do dono (teleporte, outra dimensão): reaparece perto
    if (o && !building && (r.dimension.id !== o.dimension.id || Math.hypot(r.location.x - o.location.x, r.location.z - o.location.z) > 64) && !go) {
      try {
        r.teleport({ x: o.location.x + (Math.random() - 0.5) * 6, y: o.location.y, z: o.location.z + (Math.random() - 0.5) * 6 }, { dimension: o.dimension });
      } catch {
        /* ignore */
      }
      continue;
    }
    // "vai lá": voa com o propulsor até o ponto
    if (go && now < go.until && !building) {
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
    const kind = kindOf(r);
    // fase em "rodadas" de 5 ticks, desencontrada por robô (antes, com o tick cru, só os robôs
    // cujo id caía múltiplo de 5 chegavam a atirar)
    const ph = (now / 5 + hash(r.id)) % 24;
    if (kind === 3) {
      // médico: cura você e os robôs feridos
      if (ph % 8 === 0) medic(c, r, o, rs);
      if (building) continue;
    }
    if (building && kind !== 2) continue; // construindo: só a artilharia continua de guarda
    const t = nearest(r, foes, marked, kind === 2 ? 34 : kind === 4 ? 24 : kind === 3 ? 6 : 18);
    if (!t) continue;
    if (kind === 2) {
      if (ph % 6 === 0) cannon(c, r, t);
    } else if (kind === 4) {
      if (ph % 4 === 0) blink(c, r, t);
    } else if (ph % (kind === 1 ? 3 : 2) === 0) laser(c, r, t, kind === 1 ? 5 : 7);
  }
  if (go && now >= go.until) {
    c.flags.armyGoto = null;
    for (const r of rs) r.triggerEvent(`lila:mode_${c.rec.army?.mode === "stay" ? "stay" : "guard"}`);
  }
  if (o && now % 40 === 0 && !building) needs(c, o, rs);
}

function hash(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Inimigo mais perto do robô (os marcados — quem te bateu, "atacar" — vêm primeiro). */
function nearest(r, foes, marked, range) {
  let best, bd = range * range, bm = false;
  const p = r.location;
  for (const t of foes) {
    if (!t.isValid) continue;
    const d = (t.location.x - p.x) ** 2 + (t.location.z - p.z) ** 2;
    const m = marked.has(t.id);
    if (d < (m ? 48 * 48 : range * range) && (m && !bm || (m === bm && d < bd))) {
      bd = d;
      best = t;
      bm = m;
    }
  }
  return best;
}

function beamLine(dim, from, to, n, id = "lila:scan") {
  for (let i = 1; i <= n; i++) {
    const k = i / (n + 1);
    particle(dim, id, { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k });
  }
}

function face(r, to) {
  try {
    r.setRotation({ x: 0, y: (-Math.atan2(to.x - r.location.x, to.z - r.location.z) * 180) / Math.PI });
  } catch {
    /* ignore */
  }
}

function clearShot(r, from, to) {
  const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  try {
    const hit = r.dimension.getBlockFromRay(from, { x: (to.x - from.x) / d, y: (to.y - from.y) / d, z: (to.z - from.z) / d }, { maxDistance: d });
    if (hit && Math.hypot(hit.block.location.x - from.x, hit.block.location.z - from.z) < d - 1.5) return false;
  } catch {
    /* ignore */
  }
  return true;
}

/** Soldado / construtor: tiro de laser. */
function laser(c, r, t, dmg = 7) {
  const from = { x: r.location.x, y: r.location.y + 1.3, z: r.location.z };
  const to = { x: t.location.x, y: t.location.y + 0.9, z: t.location.z };
  if (!clearShot(r, from, to)) return;
  face(r, to);
  setRobotAction(r, "shoot", 8);
  beamLine(r.dimension, from, to, Math.min(6, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 2.5)));
  try {
    r.dimension.playSound("lila.laser", from, { volume: 0.45, pitch: 0.9 + Math.random() * 0.3 });
    t.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: r });
  } catch {
    /* ignore */
  }
}

/** Artilheiro: canhão de ombro, de longe, com estouro em área (não quebra blocos). */
function cannon(c, r, t) {
  const from = { x: r.location.x + 0.3, y: r.location.y + 1.8, z: r.location.z };
  const to = { x: t.location.x, y: t.location.y + 0.6, z: t.location.z };
  if (!clearShot(r, from, to)) return;
  face(r, to);
  setRobotAction(r, "shoot", 10);
  const dim = r.dimension;
  beamLine(dim, from, to, 4, "lila:tracer");
  particle(dim, "lila:muzzle", from);
  particle(dim, "lila:shock", to);
  particle(dim, "lila:smoke", to);
  try {
    dim.playSound("random.explode", to, { volume: 0.5, pitch: 1.5 });
    t.applyDamage(16, { cause: EntityDamageCause.entityExplosion, damagingEntity: r });
    for (const e of dim.getEntities({ location: to, maxDistance: 3.5, families: ["monster"] })) {
      if (e.id === t.id || !canAttack(c, e)) continue;
      e.applyDamage(7, { cause: EntityDamageCause.entityExplosion, damagingEntity: r });
      const dx = e.location.x - to.x, dz = e.location.z - to.z, d = Math.hypot(dx, dz) || 1;
      e.applyKnockback({ x: (dx / d) * 1.2, z: (dz / d) * 1.2 }, 0.4);
    }
  } catch {
    /* ignore */
  }
}

/** Ninja: some numa fumaça, aparece nas costas do inimigo e corta. */
function blink(c, r, t) {
  const dim = r.dimension;
  const p = r.location, q = t.location;
  const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
  const behind = { x: q.x + (dx / d) * 1.3, y: q.y, z: q.z + (dz / d) * 1.3 };
  try {
    const b = dim.getBlock({ x: Math.floor(behind.x), y: Math.floor(behind.y), z: Math.floor(behind.z) });
    const h = dim.getBlock({ x: Math.floor(behind.x), y: Math.floor(behind.y) + 1, z: Math.floor(behind.z) });
    if (d > 2.5 && b && h && (b.isAir || !b.isSolid) && (h.isAir || !h.isSolid)) {
      particle(dim, "lila:smoke", { x: p.x, y: p.y + 1, z: p.z });
      r.teleport(behind, { facingLocation: q });
      dim.playSound("mob.endermen.portal", behind, { volume: 0.4, pitch: 1.6 });
    } else face(r, q);
    setRobotAction(r, "slash", 6);
    particle(dim, "lila:sparkle", { x: q.x, y: q.y + 1, z: q.z });
    t.applyDamage(11, { cause: EntityDamageCause.entityAttack, damagingEntity: r });
    dim.playSound("item.trident.throw", q, { volume: 0.5, pitch: 1.4 });
  } catch {
    /* ignore */
  }
}

/** Médico: feixe verde de cura no dono (se ferido) e nos robôs com pouca vida. */
function medic(c, r, o, rs) {
  const dim = r.dimension;
  const from = { x: r.location.x, y: r.location.y + 1.4, z: r.location.z };
  let healed = false;
  try {
    const h = o?.getComponent("minecraft:health");
    if (o && h && h.currentValue < h.effectiveMax - 2 && Math.hypot(o.location.x - r.location.x, o.location.z - r.location.z) < 16) {
      // regeneração (cura aos poucos); cura instantânea só no aperto — com a vida baixa quem chega
      // primeiro é o robô de entrega com as maçãs douradas
      o.addEffect("regeneration", 100, { amplifier: 1, showParticles: false });
      if (h.currentValue <= 4) o.addEffect("instant_health", 1, { amplifier: 0, showParticles: false });
      beamLine(dim, from, { x: o.location.x, y: o.location.y + 1, z: o.location.z }, 4, "lila:heart");
      face(r, o.location);
      healed = true;
    }
  } catch {
    /* ignore */
  }
  for (const x of rs) {
    if (x.id === r.id || !x.isValid) continue;
    try {
      const h = x.getComponent("minecraft:health");
      if (h && h.currentValue < h.effectiveMax * 0.6 && Math.hypot(x.location.x - r.location.x, x.location.z - r.location.z) < 12) {
        h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 25));
        beamLine(dim, from, { x: x.location.x, y: x.location.y + 1, z: x.location.z }, 3, "lila:heart");
        healed = true;
        break;
      }
    } catch {
      /* ignore */
    }
  }
  if (healed) setRobotAction(r, "heal", 20);
}

// ------------------------------------------------------------------ o exército constrói

/**
 * O exército inteiro ergue uma obra (megaconstrução ou do catálogo): a mesma planta mobiliada,
 * mas cada robô voa até um pedaço e solda os blocos com o laser; construtores valem por dois.
 * No fim confere tudo e corrige o que faltou. "Cancelar" para a obra (e o exército continua).
 * @param {Companion} c
 * @param {{plan: any, label: string, here?: boolean}} job
 */
export function armyBuild(c, job) {
  if (c.flags.armyJob) {
    say(c, `O exército ainda está construindo ${c.flags.armyJob.label}. Diga "cancelar" para parar a obra.`, { force: true });
    return false;
  }
  const rs = robotsOf(c, true);
  if (!rs.length) return false;
  c.flags.armyJob = { gen: buildJob(c, job.plan, job.label, job.here), label: job.label, wait: 0, n: 0, rr: 0, target: new Map() };
  for (const r of rs) {
    try {
      r.triggerEvent("lila:mode_stay");
    } catch {
      /* ignore */
    }
  }
  const crew = rs.filter((r) => kindOf(r) === 1).length;
  say(c, `Exército, obra nova: ${job.label} (~${Math.round(planVolume(job.plan) / 1000)} mil blocos)! ${rs.length} robôs trabalhando${crew ? `, ${crew} construtor${crew > 1 ? "es" : ""} na frente` : ""}.`, { force: true });
  return true;
}

/** Para a obra do exército. */
export function stopBuild(c, quiet = false) {
  const J = c.flags.armyJob;
  if (!J) return false;
  c.flags.armyJob = null;
  try {
    J.gen.return?.(undefined); // roda o finally (descarrega a área)
  } catch {
    /* ignore */
  }
  for (const r of robotsOf(c)) {
    try {
      r.triggerEvent(`lila:mode_${c.rec.army?.mode === "stay" ? "stay" : c.rec.army?.mode === "follow" ? "follow" : "guard"}`);
      setRobotAction(r, "idle");
    } catch {
      /* ignore */
    }
  }
  if (!quiet) say(c, `Obra parada (${J.label}). O exército voltou a te proteger.`, { force: true });
  return true;
}

function* buildJob(c, plan, label, here) {
  const o = c.owner();
  const site = yield* pickSite(c, plan, { dim: o?.dimension ?? c.dim(), here });
  const { dim, cx, cz, y0, area } = site;
  try {
    yield* planStream(c, dim, plan, cx, cz, y0, label);
    planExtras(dim, plan, cx, cz, y0);
    const J = c.flags.armyJob;
    const fixed = yield* verifyPlan(c, dim, plan, cx, cz, y0, { alive: () => armyActive(c) && c.flags.armyJob === J, fx: (at) => jobFx(c, at) });
    if (fixed > 0) say(c, `Conferimos a obra e corrigimos ${fixed} bloco${fixed > 1 ? "s" : ""} que tinha${fixed > 1 ? "m" : ""} faltado.`, { force: true });
    c.rec.stats.built++;
    c.save();
    const ref = c.owner()?.location;
    say(c, `${label} pronto, feito pelo exército!${ref ? ` Fica a ${Math.round(Math.hypot(cx - ref.x, cz - ref.z))} blocos daqui.` : ""}`, { force: true });
    sound(c.owner(), "random.levelup", 1, 1.1);
  } finally {
    unloadArea(dim, area);
  }
}

function jobFx(c, at) {
  const rs = robotsOf(c);
  const r = rs[Math.floor(Math.random() * rs.length)];
  if (r) beamLine(r.dimension, { x: r.location.x, y: r.location.y + 1.3, z: r.location.z }, at, 3);
}

/** Um tick da obra: tira blocos do gerador (orçamento por robô) e distribui entre os robôs. */
function jobTick(c, rs) {
  const J = c.flags.armyJob;
  const crew = rs.filter((r) => r.isValid);
  if (!crew.length) return;
  for (const r of crew) steer(r, J.target.get(r.id));
  if (J.wait > 0) {
    J.wait--;
    return;
  }
  let budget = crew.reduce((n, r) => n + (kindOf(r) === 1 ? 5 : 2), 0);
  const dim = crew[0].dimension;
  const t0 = Date.now();
  for (let it = 0; budget > 0 && it < 600 && Date.now() - t0 < 6; it++) {
    let step;
    try {
      step = J.gen.next();
    } catch (e) {
      say(c, `Exército: não deu pra construir (${e?.message ?? e}).`, { force: true });
      stopBuild(c, true);
      return;
    }
    if (step.done) {
      stopBuild(c, true);
      for (const r of crew) setRobotAction(r, "spawn", 14);
      return;
    }
    const v = step.value;
    if (typeof v === "number") {
      if (v > 0) {
        J.wait = v - 1;
        break;
      }
      continue;
    }
    if (!v || typeof v !== "object" || v.x === undefined) continue;
    if (!place(dim, v)) continue;
    budget--;
    const r = crew[J.rr++ % crew.length];
    J.target.set(r.id, v);
    if (J.n++ % 4 === 0) {
      beamLine(dim, { x: r.location.x, y: r.location.y + 1.2, z: r.location.z }, { x: v.x + 0.5, y: v.y + 0.5, z: v.z + 0.5 }, 2);
      if (J.n % 24 === 1) particle(dim, "lila:build", { x: v.x + 0.5, y: v.y + 0.5, z: v.z + 0.5 });
      if (J.n % 40 === 1) dim.playSound("random.pop", v, { volume: 0.35, pitch: 1.5 + Math.random() * 0.4 });
    }
  }
}

function place(dim, v) {
  let b;
  try {
    b = dim.getBlock({ x: v.x, y: v.y, z: v.z });
  } catch {
    return false;
  }
  if (!b || UNBREAKABLE.has(b.typeId)) return false;
  const pm = perm(v.id, v.st);
  if (!pm) return false;
  try {
    if (b.typeId === v.id && !v.st && !v.pair) return false;
    b.setPermutation(pm);
    if (v.pair) {
      const q = perm(v.id, v.pair[3]);
      if (q) dim.getBlock({ x: v.x + v.pair[0], y: v.y + v.pair[1], z: v.z + v.pair[2] })?.setPermutation(q);
    }
    return true;
  } catch {
    return false;
  }
}

/** O robô voa (propulsor) até ficar pairando do lado do bloco que está soldando. */
function steer(r, cell) {
  if (!cell) return;
  const a = (hash(r.id) % 628) / 100;
  const goal = { x: cell.x + 0.5 + Math.cos(a) * 1.8, y: cell.y + 2.2, z: cell.z + 0.5 + Math.sin(a) * 1.8 };
  try {
    const p = r.location;
    const dx = goal.x - p.x, dy = goal.y - p.y, dz = goal.z - p.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 48) {
      r.teleport(goal, { facingLocation: { x: cell.x + 0.5, y: cell.y, z: cell.z + 0.5 } });
      return;
    }
    const s = Math.min(0.85, d * 0.22);
    const v = r.getVelocity();
    r.applyImpulse({ x: (dx / (d || 1)) * s - v.x, y: (dy / (d || 1)) * s - v.y + 0.08, z: (dz / (d || 1)) * s - v.z });
    if (system.currentTick % 4 === 0) face(r, cell);
    setRobotAction(r, "build");
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
