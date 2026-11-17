/**
 * Lifecycle: summon, one shadow per owner, dismiss, death + resurrection, join/leave,
 * and the anti-duplication sweep (stale bodies from older generations are removed).
 */
import { Dimension, Entity, Player, system, world } from "@minecraft/server";
import { AnimState, COLORS, DP_GEN, DP_OWNER, ENTITY_ID, Mood, PROP_PERSONA, PERSONAS, type Persona } from "../core/constants";
import { dist, getBlock, isPassableBlock, isSolidGround, isValid, log, particle, safe, sound } from "../core/mc";
import type { Vec3 } from "../core/types";
import { defaultRecord, loadRecord, pushHistory } from "../memory/memory_manager";
import { refreshVisual } from "../inventory/equipment";
import { sayKey, setMood } from "../communication/comms";
import { Agent } from "./agent";
import { Executor } from "../executor/executor";

export const agents = new Map<string, Agent>();
export const executors = new WeakMap<Agent, Executor>();
const legitBodies = new Set<string>();

export function executorOf(a: Agent): Executor {
  let ex = executors.get(a);
  if (!ex) {
    ex = new Executor(a);
    executors.set(a, ex);
  }
  return ex;
}

export function agentFor(ownerId: string): Agent | undefined {
  let a = agents.get(ownerId);
  if (a) return a;
  const rec = loadRecord(ownerId);
  if (!rec) return undefined;
  a = new Agent(rec);
  agents.set(ownerId, a);
  return a;
}

export function agentByBody(e: Entity): Agent | undefined {
  for (const a of agents.values()) if (a.bodyId === e.id) return a;
  const owner = safe(() => e.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
  return owner ? agents.get(owner) : undefined;
}

/** A safe standable spot near a position (never inside blocks). */
function spotNear(dim: Dimension, p: Vec3): Vec3 {
  const bx = Math.floor(p.x);
  const by = Math.floor(p.y);
  const bz = Math.floor(p.z);
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [0, 0]]) {
    for (const dy of [0, 1, -1, 2]) {
      const x = bx + dx;
      const y = by + dy;
      const z = bz + dz;
      if (isPassableBlock(getBlock(dim, { x, y, z })) && isPassableBlock(getBlock(dim, { x, y: y + 1, z })) && isSolidGround(getBlock(dim, { x, y: y - 1, z }))) {
        return { x: x + 0.5, y, z: z + 0.5 };
      }
    }
  }
  return { x: p.x, y: p.y, z: p.z };
}

function spawnBody(a: Agent, owner: Player, announceKey: "summon" | "return_alive"): Entity | undefined {
  const dim = owner.dimension;
  const loc = spotNear(dim, owner.location);
  let e: Entity;
  try {
    e = dim.spawnEntity(ENTITY_ID, loc);
  } catch (err) {
    log("spawn failed", String(err));
    return undefined;
  }
  legitBodies.add(e.id);
  safe(() => e.setDynamicProperty(DP_OWNER, a.record.ownerId), undefined);
  safe(() => e.setDynamicProperty(DP_GEN, a.record.gen), undefined);
  safe(() => e.setProperty(PROP_PERSONA, PERSONAS.indexOf(a.persona)), undefined);
  safe(() => (e.nameTag = `${COLORS[a.persona].tag}${a.name}`), undefined);
  const tamed = safe(() => e.getComponent("minecraft:tameable")?.tame(owner) ?? false, false);
  if (!tamed) log("tame() returned false; native follow may not work");
  safe(() => e.triggerEvent("shadowbound:on_tame"), undefined);
  a.attach(e);
  const h = safe(() => e.getComponent("minecraft:health"), undefined);
  if (h) safe(() => h.setCurrentValue(Math.max(12, Math.min(h.effectiveMax, a.record.health || h.effectiveMax))), false);
  applyMode(a);
  a.setAnim(AnimState.Summon, 1500);
  a.rt.summonedAt = Date.now();
  setMood(e, Mood.Happy, 2500);
  particle(dim, "shadowbound:wisp", loc);
  particle(dim, "shadowbound:sparkle", { x: loc.x, y: loc.y + 1, z: loc.z }, a.color().particle);
  sound(dim, "mob.evocation_illager.cast_spell", loc, 0.7, 1.3);
  system.runTimeout(() => refreshVisual(a), 5);
  sayKey(a, announceKey, undefined, { force: true });
  a.markDirty();
  a.save();
  return e;
}

export function applyMode(a: Agent): void {
  const m = a.record.mode;
  a.setNativeMode(m === "guard" ? "guard" : m === "stay" ? "scripted" : "follow");
}

export type SummonResult = "spawned" | "already" | "failed";

export function summon(owner: Player, persona?: Persona, name?: string): SummonResult {
  let a = agentFor(owner.id);
  if (a && a.record.active && !a.record.dead && a.body()) {
    const b = a.body()!;
    if (dist(b.location, owner.location) > 10 || b.dimension.id !== owner.dimension.id) {
      safe(() => b.teleport(spotNear(owner.dimension, owner.location), { dimension: owner.dimension }), undefined);
    }
    sayKey(a, "greet", undefined, { force: true });
    return "already"; // one shadow per player
  }
  if (!a) {
    const p = persona ?? "luna";
    const rec = defaultRecord(owner.id, owner.name, p, name || (p === "luna" ? "Luna" : "Raven"));
    a = new Agent(rec);
    agents.set(owner.id, a);
  } else if (persona) {
    a.record.persona = persona;
    if (name) a.record.shadowName = name;
    else if (!a.record.shadowName || PERSONAS.some((x) => (x === "luna" ? "Luna" : "Raven") === a!.record.shadowName)) {
      a.record.shadowName = persona === "luna" ? "Luna" : "Raven";
    }
  }
  a.record.ownerName = owner.name; // display only
  a.record.gen++;
  a.record.active = true;
  a.record.dead = false;
  removeStaleBodies(a);
  return spawnBody(a, owner, "summon") ? "spawned" : "failed";
}

function removeStaleBodies(a: Agent): void {
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    const list = safe(() => world.getDimension(dimId).getEntities({ type: ENTITY_ID }), [] as Entity[]);
    for (const e of list) {
      const owner = safe(() => e.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
      if (owner === a.record.ownerId && e.id !== a.bodyId) safe(() => e.remove(), undefined);
    }
  }
}

export function dismiss(a: Agent): void {
  const ex = executorOf(a);
  ex.interrupt();
  sayKey(a, "dismiss", undefined, { force: true });
  const e = a.body();
  a.record.active = false;
  a.save();
  if (e) {
    a.setAnim(AnimState.Despawn);
    particle(e.dimension, "shadowbound:wisp", e.location);
    sound(e.dimension, "mob.allay.death", e.location, 0.5, 1.3);
    const id = e.id;
    system.runTimeout(() => {
      const b = safe(() => world.getEntity(id), undefined);
      if (isValid(b)) safe(() => b.remove(), undefined);
    }, 22);
  }
  a.detach();
}

let deathSweep: { dim: string; loc: Vec3; ids: Set<string>; until: number } | undefined;

export function onDeath(e: Entity): void {
  const a = agentByBody(e);
  if (!a) return;
  const loc = safe(() => ({ ...e.location }), undefined);
  const dimId = safe(() => e.dimension.id, "minecraft:overworld");
  executorOf(a).interrupt();
  // tasks that make no sense after death are dropped; resumable ones stay in the queue
  a.record.queue = a.record.queue.filter((t) => t.resumable);
  a.record.dead = true;
  a.record.stats.deaths++;
  a.record.respawnAt = Date.now() + a.record.settings.respawnSeconds * 1000;
  a.record.health = 20;
  pushHistory(a.record, "☠ fui derrotada");
  a.detach();
  a.save();
  sayKey(a, "died", undefined, { force: true });
  if (loc) {
    const dim = world.getDimension(dimId);
    particle(dim, "shadowbound:wisp", loc);
    // safety net: remove copies of equipped items if the engine dropped any (drop chance is 0)
    const ids = new Set(Object.values(a.record.equipment).filter((s) => !!s).map((s) => s!.id));
    deathSweep = { dim: dimId, loc, ids, until: system.currentTick + 4 };
  }
  const owner = a.owner();
  if (owner) safe(() => owner.sendMessage(`§7(${a.name} volta em ${a.record.settings.respawnSeconds}s. Inventário e tarefa estão salvos.)`), undefined);
}

/** entitySpawn hook for the death sweep and for unowned bodies created by /summon. */
export function onEntitySpawn(e: Entity): void {
  const id = safe(() => e.typeId, "");
  if (id === "minecraft:item" && deathSweep && system.currentTick <= deathSweep.until) {
    const st = safe(() => e.getComponent("minecraft:item")?.itemStack, undefined);
    if (st && deathSweep.ids.has(st.typeId) && e.dimension.id === deathSweep.dim && dist(e.location, deathSweep.loc) < 3) {
      safe(() => e.remove(), undefined);
    }
    return;
  }
  if (id === ENTITY_ID) {
    const eid = e.id;
    system.runTimeout(() => {
      if (legitBodies.has(eid)) return;
      const b = safe(() => world.getEntity(eid), undefined);
      if (!isValid(b)) return;
      const owner = safe(() => b.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
      if (!owner) safe(() => b.remove(), undefined); // nobody may create an ownerless shadow
    }, 3);
  }
}

export function respawnTick(): void {
  const now = Date.now();
  for (const a of agents.values()) {
    if (!a.record.active || !a.record.dead || now < a.record.respawnAt) continue;
    const owner = a.owner();
    if (!owner) continue;
    a.record.dead = false;
    a.record.gen++;
    removeStaleBodies(a);
    spawnBody(a, owner, "return_alive");
  }
}

export function onJoin(player: Player): void {
  const a = agentFor(player.id);
  if (!a || !a.record.active) return;
  system.runTimeout(() => {
    const p = safe(() => (player.isValid ? player : undefined), undefined);
    if (!p) return;
    // try to re-link an existing body of the current generation nearby
    const list = safe(() => p.dimension.getEntities({ type: ENTITY_ID, location: p.location, maxDistance: 96 }), [] as Entity[]);
    for (const e of list) {
      const owner = safe(() => e.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
      const gen = safe(() => e.getDynamicProperty(DP_GEN) as number | undefined, undefined);
      if (owner === p.id && gen === a.record.gen && !a.record.dead) {
        legitBodies.add(e.id);
        a.attach(e);
        applyMode(a);
        refreshVisual(a);
        sayKey(a, "greet", undefined, { force: true });
        return;
      }
    }
    if (a.record.dead) return; // respawnTick handles it
    a.record.gen++;
    removeStaleBodies(a);
    spawnBody(a, p, "summon");
  }, 60);
}

export function onLeave(playerId: string): void {
  const a = agents.get(playerId);
  if (!a) return;
  executorOf(a).interrupt();
  const e = a.body();
  a.save();
  if (e) safe(() => e.remove(), undefined); // body goes back to the shadows; data stays
  a.detach();
  agents.delete(playerId);
}

/** Removes bodies that are stale (older generation), ownerless, or whose owner is offline. */
export function dedupeSweep(): void {
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    const list = safe(() => world.getDimension(dimId).getEntities({ type: ENTITY_ID }), [] as Entity[]);
    for (const e of list) {
      const owner = safe(() => e.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
      const gen = safe(() => e.getDynamicProperty(DP_GEN) as number | undefined, undefined);
      if (!owner) {
        if (!legitBodies.has(e.id)) safe(() => e.remove(), undefined);
        continue;
      }
      const a = agents.get(owner);
      if (!a || !a.owner()) {
        safe(() => e.remove(), undefined);
        continue;
      }
      if (a.bodyId === e.id) continue;
      if (a.record.active && !a.record.dead && !a.body() && gen === a.record.gen) {
        legitBodies.add(e.id);
        a.attach(e);
        applyMode(a);
        continue;
      }
      safe(() => e.remove(), undefined);
    }
  }
}

export function personaFromText(s: string): Persona | undefined {
  if (/raven/i.test(s)) return "raven";
  if (/luna/i.test(s)) return "luna";
  return undefined;
}
