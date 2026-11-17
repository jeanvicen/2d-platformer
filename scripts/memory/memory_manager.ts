/**
 * Memory Manager: persistent per-owner records in world dynamic properties.
 *
 * Why the world (and not the entity body): the shadow's inventory, task and needs must
 * survive death, despawn and world reloads WITHOUT ever being dropped as item entities.
 * One JSON string per owner, written atomically -> no partial saves, no duplication.
 */
import { world } from "@minecraft/server";
import { DP_AGENT_PREFIX, PERSONAS, TUNING, type Persona } from "../core/constants";
import type { AgentRecord } from "../core/types";
import { log, safe } from "../core/mc";
import { freshNeeds } from "../survival/needs";

const VERSION = 1;
const MAX_LEN = 30000; // dynamic string properties are limited to 32767 chars

export function defaultRecord(ownerId: string, ownerName: string, persona: Persona, shadowName: string): AgentRecord {
  return {
    v: VERSION,
    ownerId,
    ownerName,
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
    health: 40,
    queue: [],
    pausedByOwner: false,
    settings: {
      allowHunting: false,
      autoEat: true,
      chatMessages: true,
      externalAI: false,
      respawnSeconds: TUNING.defaultRespawnSeconds,
      foodReserve: TUNING.foodReserve,
    },
    knownStations: [],
    stats: { logs: 0, food: 0, mined: 0, built: 0, kills: 0, deaths: 0 },
    history: [],
  };
}

export function loadRecord(ownerId: string): AgentRecord | undefined {
  const raw = safe(() => world.getDynamicProperty(DP_AGENT_PREFIX + ownerId), undefined);
  if (typeof raw !== "string") return undefined;
  try {
    const r = JSON.parse(raw) as AgentRecord;
    return migrate(r, ownerId);
  } catch (e) {
    log("corrupted record for", ownerId, String(e));
    return undefined;
  }
}

function migrate(r: AgentRecord, ownerId: string): AgentRecord | undefined {
  if (!r || r.ownerId !== ownerId) return undefined; // never accept a record for someone else
  const d = defaultRecord(ownerId, r.ownerName ?? "", PERSONAS.includes(r.persona) ? r.persona : "luna", r.shadowName ?? "Sombra");
  const merged: AgentRecord = { ...d, ...r, settings: { ...d.settings, ...(r.settings ?? {}) }, stats: { ...d.stats, ...(r.stats ?? {}) } };
  merged.inventory = Array.isArray(r.inventory) ? r.inventory.filter((s) => s && typeof s.id === "string" && s.n > 0) : [];
  merged.queue = Array.isArray(r.queue) ? r.queue.slice(0, 12) : [];
  merged.history = Array.isArray(r.history) ? r.history.slice(0, 10) : [];
  merged.v = VERSION;
  return merged;
}

export function saveRecord(r: AgentRecord): boolean {
  let json = JSON.stringify(r);
  if (json.length > MAX_LEN) {
    // shrink non-essential data first, never the inventory
    r.history = r.history.slice(0, 3);
    for (const t of r.queue) t.data = {};
    json = JSON.stringify(r);
  }
  if (json.length > MAX_LEN) {
    log("record too large, not saved", r.ownerId, json.length);
    return false;
  }
  return safe(
    () => {
      world.setDynamicProperty(DP_AGENT_PREFIX + r.ownerId, json);
      return true;
    },
    false,
    "save failed",
  );
}

export function pushHistory(r: AgentRecord, line: string): void {
  r.history.unshift(line);
  if (r.history.length > 10) r.history.length = 10;
}
