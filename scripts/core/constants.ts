/**
 * Shared identifiers and tunables. Pure module (no @minecraft imports) so tests can use it.
 */

export const NS = "shadowbound";
export const ENTITY_ID = "shadowbound:companion";
export const SUMMONER_ITEM = "shadowbound:shadow_summoner";
export const PROP_ANIM = "shadowbound:anim";
export const PROP_PERSONA = "shadowbound:persona";
export const PROP_MOOD = "shadowbound:mood";

/** Dynamic property keys */
export const DP_OWNER = "sb:owner"; // on the entity: owner's persistent player.id
export const DP_GEN = "sb:gen"; // on the entity: summon generation (anti-duplication)
export const DP_AGENT_PREFIX = "sb:agent:"; // on the world: one record per owner id
export const DP_GOT_ITEM = "sb:got_summoner"; // on the player: received the starter item

/** Must match tools/art/generate_anims.py STATES */
export enum AnimState {
  Idle = 0,
  Walk = 1,
  Run = 2,
  Attack = 3,
  Chop = 4,
  Mine = 5,
  Build = 6,
  Eat = 7,
  Guard = 8,
  Summon = 9,
  Despawn = 10,
  Cast = 11,
  Wave = 12,
  Dig = 13,
}

export enum Mood {
  Neutral = 0,
  Happy = 1,
  Focused = 2,
  Talking = 3,
}

export const PERSONAS = ["luna", "raven", "sora", "yuki"] as const;
export type Persona = (typeof PERSONAS)[number];

export const TUNING = {
  brainIntervalTicks: 4, // decision loop: 5 times per second
  perceptionIntervalTicks: 10,
  saveIntervalTicks: 100,
  needsIntervalTicks: 20,
  walkSpeed: 0.22, // blocks per tick (~4.4 b/s, like a walking player)
  runSpeed: 0.32,
  reach: 4.5, // like a survival player
  maxPathNodes: 2600,
  maxSearchRadius: 28,
  maxTaskDistanceFromOwner: 64,
  protectRadius: 14, // threats closer than this to the owner are handled
  leashCombatDistance: 16, // never chase farther than this from the owner
  inventorySlots: 27,
  defaultRespawnSeconds: 20,
  foodReserve: 2, // keep at least this many food items unless starving
  maxHunger: 20,
  hungerEatThreshold: 12,
  hungerStarving: 4,
  healthRecoverRatio: 0.35,
  healthResumeRatio: 0.7,
  stepTimeoutTicks: 20 * 60,
  maxTaskAttempts: 3,
} as const;

export const COLORS: Record<Persona, { tag: string; name: string; particle: { red: number; green: number; blue: number } }> = {
  luna: { tag: "§d", name: "Luna", particle: { red: 0.85, green: 0.65, blue: 1.0 } },
  raven: { tag: "§c", name: "Raven", particle: { red: 1.0, green: 0.3, blue: 0.4 } },
  sora: { tag: "§a", name: "Sora", particle: { red: 0.3, green: 1.0, blue: 0.55 } },
  yuki: { tag: "§2", name: "Yuki", particle: { red: 0.55, green: 0.9, blue: 0.7 } },
};

export const DEFAULT_NAMES: Record<Persona, string> = { luna: "Luna", raven: "Raven", sora: "Sora", yuki: "Yuki" };
/** personas with the ranged magic attack */
export const CASTERS: Persona[] = ["luna", "sora"];
