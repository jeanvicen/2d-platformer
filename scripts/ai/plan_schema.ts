/**
 * Validation of plans coming from the OPTIONAL external language model.
 * The model can only propose structured intents from a closed list; it never sends code,
 * never changes ownership and every action still passes through the local executor checks.
 * Pure module.
 */
import type { Intent, IntentKind, MaterialKind, ResourceKind, StructureKind } from "../core/types";

const ALLOWED_KINDS: IntentKind[] = [
  "follow", "protect", "guard", "stay", "return", "cancel", "pause", "resume", "gather", "mine", "hunt", "farm",
  "craft", "build", "destroy", "deliver", "cook", "eat", "attack", "equip", "status", "inventory", "help",
];
const RESOURCES: ResourceKind[] = [
  "wood", "food", "stone", "coal", "iron", "gold", "copper", "diamond", "redstone", "lapis", "emerald", "ore", "sand",
  "dirt", "gravel", "wheat", "carrot", "potato", "beetroot", "berries", "meat",
];
const STRUCTURES: StructureKind[] = ["hut", "wall", "platform", "bridge", "pillar", "tower"];
const MATERIALS: MaterialKind[] = ["planks", "cobblestone", "log", "stone", "dirt", "any"];
const ITEMS = ["planks", "stick", "crafting_table", "torch", "chest", "furnace", "bread", "ladder", "pickaxe", "axe", "shovel", "sword", "hoe", "armor"];
const TIERS = ["wooden", "stone", "iron", "golden", "diamond", "netherite"];

export interface ExternalPlan {
  reply: string;
  clarify?: string;
  intents: Intent[];
}

const MAX_JSON = 4000;

export function validateExternalPlan(raw: string): { ok: true; plan: ExternalPlan } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.length > MAX_JSON) return { ok: false, error: "resposta grande demais" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON inválido" };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "formato inválido" };
  const d = data as Record<string, unknown>;
  const reply = typeof d.reply === "string" ? sanitizeText(d.reply, 200) : "";
  const clarify = typeof d.clarify === "string" ? sanitizeText(d.clarify, 160) : undefined;
  const list = Array.isArray(d.intents) ? d.intents.slice(0, 6) : [];
  const intents: Intent[] = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    if (typeof o.kind !== "string" || !ALLOWED_KINDS.includes(o.kind as IntentKind)) continue;
    const out: Intent = { kind: o.kind as IntentKind, priority: o.priority === "high" ? "high" : "normal", raw: "ia" };
    if (typeof o.resource === "string" && RESOURCES.includes(o.resource as ResourceKind)) out.resource = o.resource as ResourceKind;
    if (typeof o.quantity === "number" && Number.isFinite(o.quantity)) out.quantity = Math.max(1, Math.min(256, Math.floor(o.quantity)));
    if (typeof o.structure === "string" && STRUCTURES.includes(o.structure as StructureKind)) out.structure = o.structure as StructureKind;
    if (typeof o.material === "string" && MATERIALS.includes(o.material as MaterialKind)) out.material = o.material as MaterialKind;
    if (typeof o.item === "string" && ITEMS.includes(o.item)) out.item = o.item;
    if (typeof o.tier === "string" && TIERS.includes(o.tier)) out.tier = o.tier;
    if (o.target === "view") out.target = { kind: "view" };
    if (o.target === "hostiles") out.target = { kind: "hostiles" };
    if (typeof o.target === "string" && /^minecraft:[a-z_]+$/.test(o.target)) out.target = { kind: "mob", mob: o.target };
    if (o.deliver === false) out.deliver = false;
    if (o.all === true) out.all = true;
    if (o.allowHunting === true) out.allowHunting = true;
    intents.push(out);
  }
  return { ok: true, plan: { reply, clarify, intents } };
}

function sanitizeText(s: string, max: number): string {
  // no formatting codes, no control characters, bounded length
  return s.replace(/§./g, "").replace(/[\u0000-\u001f]/g, " ").slice(0, max).trim();
}
