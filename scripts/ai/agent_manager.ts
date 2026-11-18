/**
 * Squad lifecycle: summon (companions and beasts), dismiss, death + resurrection, join/leave,
 * and the anti-duplication sweep (stale bodies from older generations are removed).
 *
 * One owner has one squad of many members. Every member has its own persisted record
 * (sb:agent:<owner>:<id>) and at most one live body tagged with owner + member id + generation.
 */
import { Dimension, Entity, Player, system, world } from "@minecraft/server";
import {
  AnimState, BEAST_ID, BODY_TYPES, DEFAULT_NAMES, DP_AGENT_ID, DP_GEN, DP_OWNER, ENTITY_ID, Mood, PERSONAS, PROP_PERSONA,
  PROP_SPECIES, TUNING, isPersona, type Persona,
} from "../core/constants";
import { BEASTS, BEAST_INFO, beastFromText, type BeastSpecies } from "../core/species";
import { dist, getBlock, isPassableBlock, isSolidGround, isValid, log, particle, safe, sound } from "../core/mc";
import type { Vec3 } from "../core/types";
import { defaultRecord, loadRecord, loadSquadIndex, pushHistory, saveSquadIndex, type SquadIndex } from "../memory/memory_manager";
import { refreshVisual } from "../inventory/equipment";
import { sayKey, setMood } from "../communication/comms";
import { normalize } from "../nlu/normalize";
import { Agent } from "./agent";
import { Executor } from "../executor/executor";

export const agents = new Map<string, Agent>(); // key: ownerId:memberId
const squads = new Map<string, SquadIndex>(); // key: ownerId
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

export function squadIndex(ownerId: string): SquadIndex {
  let idx = squads.get(ownerId);
  if (!idx) {
    idx = loadSquadIndex(ownerId);
    squads.set(ownerId, idx);
  }
  return idx;
}

/** Loads (once) and returns every member of an owner's squad. */
export function squadOf(ownerId: string, activeOnly = true): Agent[] {
  const idx = squadIndex(ownerId);
  const out: Agent[] = [];
  for (const id of idx.ids) {
    const key = `${ownerId}:${id}`;
    let a = agents.get(key);
    if (!a) {
      const rec = loadRecord(ownerId, id);
      if (!rec) continue;
      a = new Agent(rec);
      agents.set(key, a);
    }
    if (!activeOnly || a.record.active) out.push(a);
  }
  return out;
}

export function agentByBody(e: Entity): Agent | undefined {
  for (const a of agents.values()) if (a.bodyId === e.id) return a;
  const owner = safe(() => e.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
  const id = safe(() => e.getDynamicProperty(DP_AGENT_ID) as string | undefined, undefined);
  if (!owner || !id) return undefined;
  squadOf(owner, false);
  return agents.get(`${owner}:${id}`);
}

/** A safe standable spot near a position (never inside blocks). `ring` spreads squads out. */
function spotNear(dim: Dimension, p: Vec3, ring = 0): Vec3 {
  const bx = Math.floor(p.x);
  const by = Math.floor(p.y);
  const bz = Math.floor(p.z);
  const offsets = [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2], [3, 0], [-3, 0], [0, 3], [0, -3], [0, 0]];
  const start = ring % (offsets.length - 1);
  for (let k = 0; k < offsets.length; k++) {
    const [dx, dz] = offsets[(start + k) % offsets.length];
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

/** The summoning ritual: a shadow pool opens and the body rises out of it. */
export function summonFx(dim: Dimension, loc: Vec3, color: { red: number; green: number; blue: number }, big: boolean): void {
  const r = big ? 2.2 : 1.2;
  for (let step = 0; step < 6; step++) {
    system.runTimeout(() => {
      const rr = r * (0.4 + step * 0.12);
      const n = big ? 14 : 9;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + step * 0.4;
        particle(dim, "shadowbound:wisp", { x: loc.x + Math.cos(ang) * rr, y: loc.y + 0.05, z: loc.z + Math.sin(ang) * rr });
      }
      if (step % 2 === 0) particle(dim, "shadowbound:sparkle", { x: loc.x, y: loc.y + 0.4 + step * 0.3, z: loc.z }, color);
    }, step * 3);
  }
  sound(dim, big ? "mob.wither.spawn" : "mob.evocation_illager.cast_spell", loc, big ? 0.35 : 0.7, big ? 1.6 : 1.3);
}

function spawnBody(a: Agent, owner: Player, announceKey: "summon" | "return_alive", ring = 0): Entity | undefined {
  const dim = owner.dimension;
  const loc = spotNear(dim, owner.location, ring);
  let e: Entity;
  try {
    e = dim.spawnEntity(a.isBeast ? BEAST_ID : ENTITY_ID, loc);
  } catch (err) {
    log("spawn failed", String(err));
    return undefined;
  }
  legitBodies.add(e.id);
  safe(() => e.setDynamicProperty(DP_OWNER, a.record.ownerId), undefined);
  safe(() => e.setDynamicProperty(DP_AGENT_ID, a.record.id), undefined);
  safe(() => e.setDynamicProperty(DP_GEN, a.record.gen), undefined);
  if (a.isBeast) {
    safe(() => e.setProperty(PROP_SPECIES, BEASTS.indexOf(a.persona as BeastSpecies)), undefined);
    safe(() => e.triggerEvent(`shadowbound:species_${a.persona}`), undefined, "species event");
  } else {
    safe(() => e.setProperty(PROP_PERSONA, PERSONAS.indexOf(a.persona as Persona)), undefined);
  }
  safe(() => (e.nameTag = `${a.color().tag}${a.name}`), undefined);
  const tamed = safe(() => e.getComponent("minecraft:tameable")?.tame(owner) ?? false, false);
  if (!tamed) log("tame() returned false; native follow may not work");
  safe(() => e.triggerEvent("shadowbound:on_tame"), undefined);
  a.attach(e);
  const h = safe(() => e.getComponent("minecraft:health"), undefined);
  if (h && a.record.health > 0) safe(() => h.setCurrentValue(Math.max(h.effectiveMax * 0.3, Math.min(h.effectiveMax, a.record.health))), false);
  applyMode(a);
  a.setAnim(AnimState.Summon, 1600);
  a.rt.summonedAt = Date.now();
  if (!a.isBeast) setMood(e, Mood.Happy, 2500);
  const big = a.isBeast && BEAST_INFO[a.persona as BeastSpecies]?.big;
  summonFx(dim, loc, a.color().particle, !!big);
  if (!a.isBeast) system.runTimeout(() => refreshVisual(a), 5);
  sayKey(a, announceKey, undefined, { force: true });
  a.markDirty();
  a.save();
  return e;
}

export function applyMode(a: Agent): void {
  const m = a.record.mode;
  a.setNativeMode(m === "guard" ? "guard" : m === "stay" ? "scripted" : "follow");
}

export type SummonResult = "spawned" | "already" | "full" | "failed";

export interface SummonOpts {
  kind: "companion" | "beast";
  species: string; // persona or beast species
  name?: string;
}

export function summon(owner: Player, opts: SummonOpts): SummonResult {
  const idx = squadIndex(owner.id);
  const all = squadOf(owner.id, false);
  const active = all.filter((x) => x.record.active);
  // companions are unique per persona; beasts can repeat (a pack of wolves)
  if (opts.kind === "companion") {
    const same = active.find((x) => !x.isBeast && x.persona === opts.species);
    if (same) {
      const b = same.body();
      if (b && (dist(b.location, owner.location) > 10 || b.dimension.id !== owner.dimension.id)) {
        safe(() => b.teleport(spotNear(owner.dimension, owner.location), { dimension: owner.dimension }), undefined);
      }
      sayKey(same, "greet", undefined, { force: true });
      return "already";
    }
  }
  if (active.length >= Math.min(idx.settings.maxMembers, TUNING.hardMaxMembers)) return "full";
  // reuse a dismissed record of the same species (keeps its inventory and stats)
  let a = all.find((x) => !x.record.active && x.record.kind === opts.kind && x.persona === opts.species);
  if (!a) {
    const id = `a${idx.next++}`;
    const defaultName = opts.kind === "companion" && isPersona(opts.species) ? DEFAULT_NAMES[opts.species] : BEAST_INFO[opts.species as BeastSpecies]?.pt ?? "Sombra";
    const sameKind = all.filter((x) => x.persona === opts.species).length;
    const rec = defaultRecord(owner.id, owner.name, id, opts.kind, opts.species, opts.name || (sameKind ? `${defaultName} ${sameKind + 1}` : defaultName));
    a = new Agent(rec);
    agents.set(a.key, a);
    idx.ids.push(id);
    saveSquadIndex(owner.id, idx);
  } else if (opts.name) a.record.shadowName = opts.name;
  a.record.ownerName = owner.name; // display only
  a.record.gen++;
  a.record.active = true;
  a.record.dead = false;
  removeStaleBodies(a);
  return spawnBody(a, owner, "summon", active.length) ? "spawned" : "failed";
}

function removeStaleBodies(a: Agent): void {
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    for (const type of BODY_TYPES) {
      const list = safe(() => world.getDimension(dimId).getEntities({ type }), [] as Entity[]);
      for (const e of list) {
        const owner = safe(() => e.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
        const id = safe(() => e.getDynamicProperty(DP_AGENT_ID) as string | undefined, undefined);
        if (owner === a.record.ownerId && id === a.record.id && e.id !== a.bodyId) safe(() => e.remove(), undefined);
      }
    }
  }
}

export function dismiss(a: Agent, quiet = false): void {
  executorOf(a).interrupt();
  if (!quiet) sayKey(a, "dismiss", undefined, { force: true });
  const e = a.body();
  a.record.active = false;
  a.save();
  if (e) {
    a.setAnim(AnimState.Despawn);
    summonFx(e.dimension, e.location, a.color().particle, false);
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
  a.record.health = a.isBeast ? 0 : 20;
  pushHistory(a.record, "☠ derrotada");
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
  if (owner) safe(() => owner.sendMessage(`§7(${a.name} volta em ${a.record.settings.respawnSeconds}s. ${a.isBeast ? "" : "Inventário e tarefa estão salvos."})`), undefined);
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
  if (BODY_TYPES.includes(id)) {
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
  const members = squadOf(player.id, true);
  if (!members.length) return;
  system.runTimeout(() => {
    const p = safe(() => (player.isValid ? player : undefined), undefined);
    if (!p) return;
    const bodies: Entity[] = [];
    for (const type of BODY_TYPES) bodies.push(...safe(() => p.dimension.getEntities({ type, location: p.location, maxDistance: 96 }), [] as Entity[]));
    let ring = 0;
    members.forEach((a, i) => {
      if (a.body() || a.record.dead) return;
      // re-link an existing body of the current generation nearby
      const found = bodies.find(
        (e) =>
          safe(() => e.getDynamicProperty(DP_OWNER), undefined) === p.id &&
          safe(() => e.getDynamicProperty(DP_AGENT_ID), undefined) === a.record.id &&
          safe(() => e.getDynamicProperty(DP_GEN), undefined) === a.record.gen,
      );
      if (found) {
        legitBodies.add(found.id);
        a.attach(found);
        applyMode(a);
        if (!a.isBeast) refreshVisual(a);
        return;
      }
      const r = ring++;
      system.runTimeout(() => {
        a.record.gen++;
        removeStaleBodies(a);
        spawnBody(a, p, "summon", r);
      }, i * 8);
    });
  }, 60);
}

export function onLeave(playerId: string): void {
  for (const a of squadOf(playerId, false)) {
    executorOf(a).interrupt();
    const e = a.body();
    a.save();
    if (e) safe(() => e.remove(), undefined); // bodies go back to the shadows; data stays
    a.detach();
    agents.delete(a.key);
  }
  squads.delete(playerId);
}

/** Removes bodies that are stale (older generation), ownerless, or whose owner is offline. */
export function dedupeSweep(): void {
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    for (const type of BODY_TYPES) {
      const list = safe(() => world.getDimension(dimId).getEntities({ type }), [] as Entity[]);
      for (const e of list) {
        const owner = safe(() => e.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
        const id = safe(() => e.getDynamicProperty(DP_AGENT_ID) as string | undefined, undefined);
        const gen = safe(() => e.getDynamicProperty(DP_GEN) as number | undefined, undefined);
        if (!owner) {
          if (!legitBodies.has(e.id)) safe(() => e.remove(), undefined);
          continue;
        }
        const a = id ? agents.get(`${owner}:${id}`) : undefined;
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
}

export function personaFromText(s: string): Persona | undefined {
  const n = normalize(s);
  for (const p of PERSONAS) if (new RegExp(`\\b${p}\\b`).test(n)) return p;
  return undefined;
}

export { beastFromText };

/**
 * Who an order is addressed to: "luna, pegue madeira" / "lobos, ataquem" / "todos, me sigam".
 * Returns the addressed members (or the whole active squad) and the text without the names.
 */
export function addressees(ownerId: string, text: string): { members: Agent[]; rest: string; named: boolean } {
  const squad = squadOf(ownerId, true);
  const n = normalize(text);
  const words = n.split(/[ ,:]+/);
  const picked = new Set<Agent>();
  let consumed = 0;
  for (let i = 0; i < Math.min(words.length, 6); i++) {
    const w = words[i];
    if (w === "e") {
      consumed = i + 1;
      continue;
    }
    if (/^(todos|todas|galera|pessoal|esquadrao|time)$/.test(w)) {
      squad.forEach((x) => picked.add(x));
      consumed = i + 1;
      continue;
    }
    if (/^(criaturas|bichos|feras|monstros)$/.test(w) && i === 0) {
      squad.filter((x) => x.isBeast).forEach((x) => picked.add(x));
      consumed = i + 1;
      continue;
    }
    const byName = squad.filter((x) => normalize(x.name).split(" ")[0] === w || (!x.isBeast && x.persona === w));
    const beast = beastFromText(w);
    const byBeast = beast ? squad.filter((x) => x.isBeast && x.persona === beast) : [];
    if (byName.length || byBeast.length) {
      [...byName, ...byBeast].forEach((x) => picked.add(x));
      consumed = i + 1;
      continue;
    }
    break;
  }
  if (!picked.size) return { members: squad, rest: text, named: false };
  return { members: [...picked], rest: words.slice(consumed).join(" "), named: true };
}
