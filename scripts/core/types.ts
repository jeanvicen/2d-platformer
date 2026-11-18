/**
 * Shared data types between modules. Everything here is plain JSON-serialisable data,
 * because tasks, inventory and needs are persisted in dynamic properties.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** One stack in the shadow's logical inventory. */
export interface StoredItem {
  id: string; // e.g. "minecraft:oak_log"
  n: number; // amount
  dmg?: number; // durability damage (tools/armor)
  name?: string; // custom name tag
  ench?: { id: string; lvl: number }[];
}

export type EquipSlot = "mainhand" | "offhand" | "head" | "chest" | "legs" | "feet";

export type ResourceKind =
  | "wood"
  | "food"
  | "stone"
  | "coal"
  | "iron"
  | "gold"
  | "copper"
  | "diamond"
  | "redstone"
  | "lapis"
  | "emerald"
  | "ore"
  | "sand"
  | "dirt"
  | "gravel"
  | "wheat"
  | "carrot"
  | "potato"
  | "beetroot"
  | "berries"
  | "meat";

export type StructureKind = "hut" | "wall" | "platform" | "bridge" | "pillar" | "tower" | "house" | "mansion";
export type MaterialKind = "planks" | "cobblestone" | "log" | "stone" | "dirt" | "any";

export type IntentKind =
  | "follow"
  | "protect"
  | "guard"
  | "stay"
  | "return"
  | "cancel"
  | "pause"
  | "resume"
  | "dismiss"
  | "gather"
  | "mine"
  | "hunt"
  | "farm"
  | "craft"
  | "build"
  | "destroy"
  | "deliver"
  | "cook"
  | "eat"
  | "attack"
  | "equip"
  | "status"
  | "inventory"
  | "why"
  | "progress"
  | "help"
  | "greet"
  | "thanks"
  | "compliment"
  | "unknown";

export type TargetRef =
  | { kind: "view" } // what the owner is looking at
  | { kind: "mob"; mob: string } // a mob type, e.g. "minecraft:zombie"
  | { kind: "hostiles" }
  | { kind: "tree" }
  | { kind: "area"; w: number; d: number; h: number };

export interface Intent {
  kind: IntentKind;
  resource?: ResourceKind;
  quantity?: number;
  item?: string; // catalog key for craft/equip/deliver (e.g. "planks", "stone_pickaxe")
  tier?: string; // wooden | stone | iron | golden | diamond | netherite
  structure?: StructureKind;
  material?: MaterialKind;
  size?: number;
  target?: TargetRef;
  priority: "normal" | "high";
  deliver?: boolean;
  allowHunting?: boolean;
  all?: boolean;
  raw: string;
}

export interface Clarification {
  question: string;
  options: { label: string; text: string }[];
  /** partial text to prepend to the answer when re-parsing */
  context: string;
}

export interface ParseResult {
  intents: Intent[];
  clarification?: Clarification;
  append: boolean; // "depois..." -> add to the queue instead of replacing it
  understood: boolean;
}

export type TaskKind =
  | "gather_wood"
  | "gather_food"
  | "mine"
  | "hunt"
  | "farm"
  | "craft"
  | "build"
  | "destroy"
  | "deliver"
  | "cook"
  | "eat"
  | "attack"
  | "equip"
  | "return";

export type TaskState = "pending" | "running" | "paused" | "done" | "failed" | "cancelled";

export interface Task {
  id: string;
  kind: TaskKind;
  label: string; // human readable, PT-BR
  priority: number; // 1 (low) .. 5 (critical)
  goal: {
    resource?: ResourceKind;
    item?: string;
    tier?: string;
    count?: number;
    structure?: StructureKind;
    material?: MaterialKind;
    size?: number;
    target?: TargetRef;
    all?: boolean;
    allowHunting?: boolean;
  };
  steps: string[];
  stepIndex: number;
  state: TaskState;
  progress: { done: number; total: number };
  attempts: number;
  maxAttempts: number;
  strategy: number; // index of the alternative strategy in use
  deliver: boolean;
  resumable: boolean;
  data: Record<string, unknown>; // persisted scratch (anchors, counters, positions)
  failReason?: string;
  createdAt: number;
}

export type BehaviorMode = "follow" | "protect" | "guard" | "stay";

export interface Needs {
  hunger: number; // 0..20
  saturation: number; // 0..20
  exhaustion: number; // accumulates, every 4 -> -1 saturation/hunger
}

export interface AgentSettings {
  allowHunting: boolean;
  autoEat: boolean;
  chatMessages: boolean; // key events in chat (progress always in the action bar)
  externalAI: boolean; // optional LLM bridge (BDS only)
  respawnSeconds: number;
  foodReserve: number;
}

/** Everything persisted per owner. */
export interface AgentRecord {
  v: number;
  ownerId: string;
  ownerName: string; // display only, never used for authorisation
  id: string; // squad member id, unique per owner ("a1", "a2"...)
  kind: "companion" | "beast";
  persona: string; // companion persona (luna, raven...) or beast species (wolf, dragon...)
  shadowName: string;
  gen: number; // incremented on every (re)summon; stale bodies are removed
  active: boolean; // false = dismissed
  dead: boolean;
  respawnAt: number; // epoch ms
  mode: BehaviorMode;
  guardPos?: Vec3 & { dim: string };
  inventory: StoredItem[];
  equipment: Partial<Record<EquipSlot, StoredItem>>;
  needs: Needs;
  health: number;
  queue: Task[];
  pausedByOwner: boolean;
  settings: AgentSettings;
  lastPos?: Vec3 & { dim: string };
  knownStations: { type: string; x: number; y: number; z: number; dim: string }[];
  stats: { logs: number; food: number; mined: number; built: number; kills: number; deaths: number };
  lastFailure?: string;
  history: string[]; // short log of finished/failed tasks (most recent first)
}
