/**
 * Memory Manager: persistent records in world dynamic properties.
 *
 *   sb:squad:<ownerId>          squad index {ids, next, settings}
 *   sb:agent:<ownerId>:<id>     one record per squad member
 *
 * Why the world (and not the entity body): inventory, tasks and needs must survive death,
 * despawn and reloads WITHOUT ever being dropped as item entities. One JSON string per member,
 * written atomically -> no partial saves, no duplication. Old single-shadow saves
 * (sb:agent:<ownerId>) are migrated automatically to member "a1".
 */
import { world } from "@minecraft/server";
import { DP_AGENT_PREFIX, DP_SQUAD_PREFIX, TUNING } from "../core/constants";
import type { AgentRecord } from "../core/types";
import { log, safe } from "../core/mc";
import { freshNeeds } from "../survival/needs";

const VERSION = 2;
const MAX_LEN = 30000; // dynamic string properties are limited to 32767 chars

export interface SquadIndex {
  v: number;
  ids: string[];
  next: number;
  settings: { maxMembers: number; chatter: boolean };
}

export function defaultRecord(ownerId: string, ownerName: string, id: string, kind: "companion" | "beast", persona: string, shadowName: string): AgentRecord {
  return {
    v: VERSION,
    ownerId,
    ownerName,
    id,
    kind,
    persona,
    shadowName,
    gen: 0,
    active: false,
    dead: false,
    respawnAt: 0,
    mode: "follow",
    inventory: [],
    equipment: {},
    needs: freshNeeds(),
    health: kind === "beast" ? 0 : 40,
    queue: [],
    pausedByOwner: false,
    settings: {
      allowHunting: true, // a food order is permission to hunt animals (never pets, never babies)
      autoEat: true,
      chatMessages: true,
      externalAI: false,
      respawnSeconds: kind === "beast" ? TUNING.defaultRespawnSeconds * 2 : TUNING.defaultRespawnSeconds,
      foodReserve: TUNING.foodReserve,
    },
    knownStations: [],
    stats: { logs: 0, food: 0, mined: 0, built: 0, kills: 0, deaths: 0 },
    history: [],
  };
}

const agentKey = (ownerId: string, id: string) => `${DP_AGENT_PREFIX}${ownerId}:${id}`;

function readJson(key: string): unknown {
  const raw = safe(() => world.getDynamicProperty(key), undefined);
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch (e) {
    log("corrupted", key, String(e));
    return undefined;
  }
}

function write(key: string, value: unknown): boolean {
  const json = value === undefined ? undefined : JSON.stringify(value);
  if (json && json.length > MAX_LEN) {
    log("record too large, not saved", key, json.length);
    return false;
  }
  return safe(
    () => {
      world.setDynamicProperty(key, json);
      return true;
    },
    false,
    "save failed",
  );
}

export function loadSquadIndex(ownerId: string): SquadIndex {
  const d = readJson(DP_SQUAD_PREFIX + ownerId) as Partial<SquadIndex> | undefined;
  const idx: SquadIndex = {
    v: 1,
    ids: Array.isArray(d?.ids) ? d!.ids.filter((x) => typeof x === "string").slice(0, 64) : [],
    next: typeof d?.next === "number" ? d.next : 1,
    settings: { maxMembers: TUNING.defaultMaxMembers, chatter: true, ...(d?.settings ?? {}) },
  };
  // migrate the v1 single-shadow save
  const legacy = readJson(DP_AGENT_PREFIX + ownerId) as AgentRecord | undefined;
  if (legacy && legacy.ownerId === ownerId) {
    const id = `a${idx.next++}`;
    const rec = migrate({ ...legacy, id, kind: "companion" }, ownerId, id);
    if (rec && saveRecord(rec)) {
      idx.ids.push(id);
      write(DP_AGENT_PREFIX + ownerId, undefined);
      saveSquadIndex(ownerId, idx);
    }
  }
  return idx;
}

export function saveSquadIndex(ownerId: string, idx: SquadIndex): boolean {
  return write(DP_SQUAD_PREFIX + ownerId, idx);
}

export function loadRecord(ownerId: string, id: string): AgentRecord | undefined {
  const r = readJson(agentKey(ownerId, id)) as AgentRecord | undefined;
  return r ? migrate(r, ownerId, id) : undefined;
}

function migrate(r: AgentRecord, ownerId: string, id: string): AgentRecord | undefined {
  if (!r || r.ownerId !== ownerId) return undefined; // never accept a record for someone else
  const kind = r.kind === "beast" ? "beast" : "companion";
  const d = defaultRecord(ownerId, r.ownerName ?? "", id, kind, typeof r.persona === "string" ? r.persona : "luna", r.shadowName ?? "Sombra");
  const merged: AgentRecord = { ...d, ...r, id, kind, settings: { ...d.settings, ...(r.settings ?? {}) }, stats: { ...d.stats, ...(r.stats ?? {}) } };
  merged.inventory = Array.isArray(r.inventory) ? r.inventory.filter((s) => s && typeof s.id === "string" && s.n > 0) : [];
  merged.queue = Array.isArray(r.queue) ? r.queue.slice(0, 12) : [];
  merged.history = Array.isArray(r.history) ? r.history.slice(0, 10) : [];
  merged.v = VERSION;
  return merged;
}

export function saveRecord(r: AgentRecord): boolean {
  if (JSON.stringify(r).length > MAX_LEN) {
    // shrink non-essential data first, never the inventory
    r.history = r.history.slice(0, 3);
    for (const t of r.queue) t.data = {};
  }
  return write(agentKey(r.ownerId, r.id), r);
}

export function deleteRecord(ownerId: string, id: string): void {
  write(agentKey(ownerId, id), undefined);
}

export function pushHistory(r: AgentRecord, line: string): void {
  r.history.unshift(line);
  if (r.history.length > 10) r.history.length = 10;
}
