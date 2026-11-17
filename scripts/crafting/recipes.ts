/**
 * Supported crafting recipes (logical crafting performed next to a real crafting table
 * when the recipe needs one). Pure module.
 */
import { isLogItem, isPlanksItem, plankOf } from "../inventory/item_catalog";
import type { LogicalInventory } from "../inventory/logical_inventory";

export type Station = "none" | "crafting_table";

export interface Ingredient {
  label: string;
  match: (id: string) => boolean;
  n: number;
}

export interface Recipe {
  key: string;
  label: string; // PT-BR
  output: string; // item id; "planks" is resolved dynamically
  count: number;
  station: Station;
  inputs: Ingredient[];
}

const any = (ids: string[]) => (id: string) => ids.includes(id);
const PLANKS: Ingredient["match"] = isPlanksItem;
const STICK = any(["minecraft:stick"]);
const STONE_MAT = any(["minecraft:cobblestone", "minecraft:cobbled_deepslate", "minecraft:blackstone"]);

function toolRecipes(): Recipe[] {
  const mats: [string, string, Ingredient["match"]][] = [
    ["wooden", "madeira", PLANKS],
    ["stone", "pedra", STONE_MAT],
    ["iron", "ferro", any(["minecraft:iron_ingot"])],
    ["golden", "ouro", any(["minecraft:gold_ingot"])],
    ["diamond", "diamante", any(["minecraft:diamond"])],
  ];
  const shapes: [string, string, number, number][] = [
    ["pickaxe", "picareta", 3, 2],
    ["axe", "machado", 3, 2],
    ["shovel", "pá", 1, 2],
    ["sword", "espada", 2, 1],
    ["hoe", "enxada", 2, 2],
  ];
  const out: Recipe[] = [];
  for (const [tier, tierPt, match] of mats) {
    for (const [tool, toolPt, nMat, nStick] of shapes) {
      out.push({
        key: `${tier}_${tool}`,
        label: `${toolPt} de ${tierPt}`,
        output: `minecraft:${tier}_${tool}`,
        count: 1,
        station: "crafting_table",
        inputs: [
          { label: tierPt, match, n: nMat },
          { label: "graveto", match: STICK, n: nStick },
        ],
      });
    }
  }
  return out;
}

export const RECIPES: Recipe[] = [
  { key: "planks", label: "tábuas", output: "planks", count: 4, station: "none", inputs: [{ label: "tronco", match: isLogItem, n: 1 }] },
  { key: "stick", label: "gravetos", output: "minecraft:stick", count: 4, station: "none", inputs: [{ label: "tábua", match: PLANKS, n: 2 }] },
  { key: "crafting_table", label: "bancada", output: "minecraft:crafting_table", count: 1, station: "none", inputs: [{ label: "tábua", match: PLANKS, n: 4 }] },
  {
    key: "torch", label: "tochas", output: "minecraft:torch", count: 4, station: "none",
    inputs: [
      { label: "carvão", match: any(["minecraft:coal", "minecraft:charcoal"]), n: 1 },
      { label: "graveto", match: STICK, n: 1 },
    ],
  },
  { key: "chest", label: "baú", output: "minecraft:chest", count: 1, station: "crafting_table", inputs: [{ label: "tábua", match: PLANKS, n: 8 }] },
  { key: "furnace", label: "fornalha", output: "minecraft:furnace", count: 1, station: "crafting_table", inputs: [{ label: "pedregulho", match: STONE_MAT, n: 8 }] },
  { key: "bread", label: "pão", output: "minecraft:bread", count: 1, station: "crafting_table", inputs: [{ label: "trigo", match: any(["minecraft:wheat"]), n: 3 }] },
  {
    key: "ladder", label: "escadas de mão", output: "minecraft:ladder", count: 3, station: "crafting_table",
    inputs: [{ label: "graveto", match: STICK, n: 7 }],
  },
  ...toolRecipes(),
];

export function findRecipe(key: string): Recipe | undefined {
  return RECIPES.find((r) => r.key === key);
}

/** Output id of a recipe, resolving dynamic "planks" from the log that would be consumed. */
export function resolveOutput(r: Recipe, inv: LogicalInventory): string {
  if (r.output !== "planks") return r.output;
  const log = inv.slots.find((s) => isLogItem(s.id));
  return log ? plankOf(log.id) : "minecraft:oak_planks";
}

/** Which ingredients are missing (empty array = craftable `times` times). */
export function missingFor(r: Recipe, inv: LogicalInventory, times = 1): { label: string; need: number; have: number }[] {
  const out: { label: string; need: number; have: number }[] = [];
  for (const ing of r.inputs) {
    const have = inv.count(ing.match);
    if (have < ing.n * times) out.push({ label: ing.label, need: ing.n * times, have });
  }
  return out;
}

/**
 * Crafts `times` times. Atomic: consumes inputs and adds outputs only if everything fits.
 * Returns the produced item count or an error message.
 */
export function craft(r: Recipe, inv: LogicalInventory, times = 1): { ok: true; id: string; n: number } | { ok: false; reason: string } {
  const missing = missingFor(r, inv, times);
  if (missing.length) {
    return { ok: false, reason: "faltam " + missing.map((m) => `${m.need - m.have} ${m.label}`).join(", ") };
  }
  const outId = resolveOutput(r, inv);
  const snapshot = inv.slots.map((s) => ({ ...s }));
  const consumed = inv.consumeAll(r.inputs.map((i) => ({ match: i.match, n: i.n * times })));
  if (!consumed) return { ok: false, reason: "materiais insuficientes" };
  const n = r.count * times;
  const left = inv.add({ id: outId, n });
  if (left > 0) {
    inv.slots = snapshot; // roll back: never lose items
    return { ok: false, reason: "mochila cheia" };
  }
  return { ok: true, id: outId, n };
}

/** How many planks the inventory can provide (planks + 4 per log). */
export function plankPotential(inv: LogicalInventory): number {
  return inv.count(isPlanksItem) + 4 * inv.count(isLogItem);
}
