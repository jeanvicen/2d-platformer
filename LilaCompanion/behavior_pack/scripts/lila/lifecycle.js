// Ciclo de vida: invocar, dispensar (salva tudo), derrota → volta em 20 s exatos (400 ticks,
// persistidos mesmo se o mundo fechar) e retoma o plano. Uma Lila por dono, sem duplicatas.
// O "corpo" dela é guardado como estrutura do mundo (StructureManager), o que preserva o
// inventário inteiro sem perdas (durabilidade, encantamentos, nomes).
import { ItemStack, StructureSaveMode, system, world } from "@minecraft/server";
import { ENTITY_ID, OWNER_PROP, findEntityFor, adopt } from "./companion.js";
import { setAction, setMove, hold, sound, particle } from "./anim.js";
import { standSpot } from "./world.js";
import { LINES, pick, say } from "./talk.js";
import { release } from "./areas.js";
import { LILA } from "./registry.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

export const RESPAWN_TICKS = LILA.respawnTicks;

const sid = (c, kind) => `lila:${kind}_${c.rec.ownerId.replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`;

/** Ponto seguro na frente do jogador. */
function spotNear(player) {
  const dim = player.dimension;
  const l = player.location;
  const r = player.getRotation().y * (Math.PI / 180);
  const ahead = { x: l.x - Math.sin(r) * 2, y: l.y, z: l.z + Math.cos(r) * 2 };
  const s = standSpot(dim, ahead, 3) ?? standSpot(dim, l, 3);
  return s ? { x: s.x + 0.5, y: s.y, z: s.z + 0.5 } : { x: l.x, y: l.y, z: l.z };
}

/** Restaura o corpo salvo (estrutura) num ponto. Retorna a entidade. */
function restoreBody(c, structureId, dim, loc) {
  const sm = world.structureManager;
  try {
    if (!sm.get(structureId)) return undefined;
    const before = new Set(dim.getEntities({ type: ENTITY_ID, location: loc, maxDistance: 4 }).map((e) => e.id));
    sm.place(structureId, dim, { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) }, { includeEntities: true, includeBlocks: false });
    const found = dim.getEntities({ type: ENTITY_ID, location: loc, maxDistance: 4 }).find((e) => !before.has(e.id) && e.getDynamicProperty(OWNER_PROP) === c.rec.ownerId);
    sm.delete(structureId);
    if (found) {
      found.teleport(loc, { keepVelocity: false });
      return found;
    }
  } catch (e) {
    logError("life.restore", e);
  }
  return undefined;
}

/** Guarda o corpo (com inventário) como estrutura e remove a entidade do mundo. */
function storeBody(c, structureId) {
  const e = c.entity;
  if (!e?.isValid) return false;
  const sm = world.structureManager;
  const dim = e.dimension;
  try {
    // isola no alto da mesma coluna para não capturar outras criaturas
    const l = e.location;
    const y = Math.min(dim.heightRange.max - 4, Math.max(l.y + 40, 200));
    const safe = { x: Math.floor(l.x) + 0.5, y, z: Math.floor(l.z) + 0.5 };
    e.teleport(safe, { keepVelocity: false });
    if (sm.get(structureId)) sm.delete(structureId);
    const from = { x: Math.floor(safe.x), y: Math.floor(safe.y), z: Math.floor(safe.z) };
    sm.createFromWorld(structureId, dim, from, { x: from.x, y: from.y + 1, z: from.z }, { includeEntities: true, includeBlocks: false, saveMode: StructureSaveMode.World });
    e.remove();
    c.entity = undefined;
    return true;
  } catch (err) {
    logError("life.store", err);
    return false;
  }
}

/**
 * Invoca a Lila na frente do jogador (restaura o corpo salvo se ela já existiu).
 * @param {Companion} c
 * @param {import("@minecraft/server").Player} player
 */
export function summon(c, player) {
  if (c.rec.defeat) {
    say(c, `Ainda estou me recuperando... volto em ${Math.ceil(c.rec.defeat.left / 20)}s.`, { force: true });
    return false;
  }
  const existing = c.entity?.isValid ? c.entity : findEntityFor(c);
  const loc = spotNear(player);
  if (existing) {
    // já existe: o controle "chama" ela até você
    c.entity = existing;
    try {
      existing.teleport(loc, { dimension: player.dimension, keepVelocity: false });
    } catch (e) {
      logError("life.recall", e);
    }
    arrive(c, player.dimension, loc, false);
    say(c, "Tô aqui! Vim correndo.", { force: true });
    return true;
  }
  let e;
  if (c.rec.saved?.sid) e = restoreBody(c, c.rec.saved.sid, player.dimension, loc);
  if (!e) {
    try {
      e = player.dimension.spawnEntity(ENTITY_ID, loc);
      e.setDynamicProperty(OWNER_PROP, c.rec.ownerId);
    } catch (err) {
      logError("life.spawn", err);
      say(c, "Não consegui aparecer aqui. Tenta num lugar mais aberto.", { force: true });
      return false;
    }
  }
  c.rec.saved = null;
  adopt(e);
  c.entity = e;
  try {
    e.nameTag = "Lila";
  } catch {
    /* ignore */
  }
  c.rec.summoned = true;
  c.rec.paused = false;
  arrive(c, player.dimension, loc, true);
  say(c, pick(LINES.summon), { force: true });
  c.save();
  return true;
}

function arrive(c, dim, loc, anim) {
  particle(dim, "lila:sparkle", loc);
  particle(dim, "lila:leaves", { x: loc.x, y: loc.y + 1.6, z: loc.z });
  sound(c.entity, "beacon.activate", 0.6, 1.6);
  sound(c.entity, "random.levelup", 0.3, 1.8);
  if (anim) {
    setAction(c.entity, "summon");
    system.runTimeout(() => setAction(c.entity, "idle"), 22);
  }
}

/** Só para o autoteste: restaura o corpo salvo pelo "dispensar" sem um jogador. */
export function restoreBodyForTest(c, dim, loc) {
  if (!c.rec.saved?.sid) return undefined;
  const e = restoreBody(c, c.rec.saved.sid, dim, loc);
  if (e) {
    c.entity = e;
    adopt(e);
    c.rec.saved = null;
  }
  return e;
}

/** Dispensa: guarda o corpo com tudo e some (pode ser invocada de novo depois). */
export function dismiss(c) {
  if (!c.alive()) {
    c.rec.summoned = false;
    c.save();
    return;
  }
  const dim = c.dim();
  const loc = c.pos();
  say(c, "Tá bom, vou descansar. É só me chamar no controle!", { force: true });
  particle(dim, "lila:leaves", { x: loc.x, y: loc.y + 1, z: loc.z });
  sound(c.entity, "beacon.deactivate", 0.6, 1.6);
  abortAll(c);
  removeWaypoint(c);
  release(c);
  const id = sid(c, "rest");
  if (storeBody(c, id)) c.rec.saved = { sid: id };
  c.rec.summoned = false;
  c.save();
  c.flush();
}

/** Derrota: animação, corpo guardado e contagem de 20 s. O plano atual fica salvo. */
export function defeat(c) {
  if (!c.alive() || c.rec.defeat) return;
  const e = c.entity;
  if (!e) return;
  c.rec.stats.defeats++;
  say(c, pick(LINES.defeat), { force: true });
  abortAll(c, true);
  setMove(e, "none");
  hold(e, undefined);
  setAction(e, "defeat");
  sound(e, "mob.player.hurt", 1, 1.3);
  const id = sid(c, "defeat");
  c.rec.defeat = { left: RESPAWN_TICKS, sid: id, goals: c.rec.goals.slice() };
  c.save();
  system.runTimeout(() => {
    if (!c.entity?.isValid) return;
    try {
      const hp = c.entity.getComponent("minecraft:health");
      hp?.resetToMaxValue();
    } catch {
      /* ignore */
    }
    particle(c.dim(), "lila:leaves", c.pos());
    removeWaypoint(c);
    release(c);
    storeBody(c, id);
    c.save();
    c.flush();
  }, 40);
}

/** Contagem regressiva (chamada todo tick; persistida a cada segundo pelo salvamento periódico). */
export function tickDefeat(c) {
  const d = c.rec.defeat;
  if (!d) return;
  // os 40 ticks da animação contam dentro dos 400
  if (d.left > 0) d.left -= 1;
  if (d.left % 20 === 0) c.save();
  if (d.left > 0) return;
  const owner = c.owner();
  if (!owner && !c.flags.test) return; // volta quando o dono entrar
  const dim = owner ? owner.dimension : world.getDimension(c.rec.dim);
  const loc = owner ? spotNear(owner) : { ...(c.rec.anchor ?? c.rec.pos) };
  let e = d.sid ? restoreBody(c, d.sid, dim, loc) : undefined;
  let fromBackup = false;
  if (!e) {
    try {
      e = dim.spawnEntity(ENTITY_ID, loc);
      e.setDynamicProperty(OWNER_PROP, c.rec.ownerId);
      e.nameTag = "Lila";
      fromBackup = true;
    } catch (err) {
      logError("life.respawn", err);
      d.left = 20;
      return;
    }
  }
  c.entity = e;
  adopt(e);
  if (fromBackup) restoreBackup(c);
  try {
    e.getComponent("minecraft:health")?.resetToMaxValue();
  } catch {
    /* ignore */
  }
  c.rec.goals = d.goals ?? c.rec.goals;
  c.rec.defeat = null;
  c.rec.hunger = Math.max(c.rec.hunger, 14);
  particle(dim, "lila:respawn", loc);
  arrive(c, dim, loc, true);
  say(c, c.rec.goals.length ? pick(LINES.back) : "Voltei! Bora continuar.", { force: true });
  c.save();
}

/** Cópia de segurança do inventário (para o caso raro de morte por comando, sem estrutura). */
export function backupInventory(c) {
  try {
    const inv = c.entity?.getComponent("minecraft:inventory")?.container;
    if (!inv) return;
    const out = [];
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (!it) continue;
      let dmg = 0;
      try {
        dmg = it.getComponent("minecraft:durability")?.damage ?? 0;
      } catch {
        /* ignore */
      }
      out.push({ id: it.typeId, n: it.amount, d: dmg });
    }
    c.rec.backup = out;
  } catch (e) {
    logError("life.backup", e);
  }
}

function restoreBackup(c) {
  const inv = c.entity?.getComponent("minecraft:inventory")?.container;
  if (!inv || !c.rec.backup) return;
  for (const b of c.rec.backup) {
    try {
      const it = new ItemStack(b.id, b.n);
      if (b.d) {
        const dur = it.getComponent("minecraft:durability");
        if (dur) dur.damage = b.d;
      }
      inv.addItem(it);
    } catch {
      /* item removido do jogo: ignora */
    }
  }
}

/** Cancela tudo que ela está fazendo (sem apagar a fila, a menos que clear=true). */
export function abortAll(c, keepQueue = false) {
  for (const k of ["urgent", "job"]) {
    const j = c[k];
    if (j) {
      try {
        j.gen.return(undefined);
      } catch {
        /* ignore */
      }
      c[k] = null;
    }
  }
  c.abortMove = true;
  if (!keepQueue) c.rec.goals = [];
  if (c.entity?.isValid) {
    setMove(c.entity, "none");
    if (!c.rec.defeat) setAction(c.entity, "idle");
  }
}

export function removeWaypoint(c) {
  const o = c.owner();
  if (!o || !c.waypoint) return;
  try {
    o.locatorBar.removeWaypoint(c.waypoint);
  } catch {
    /* ignore */
  }
  c.waypoint = null;
}
