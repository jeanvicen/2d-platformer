// Livro de receitas da Lila (puro). Custos reais do Minecraft: ela só fabrica se tiver os
// ingredientes, usa bancada para receitas 3×3 e fornalha (com combustível) para fundir.
import { WOODS, isLog, isPlanks, woodOf } from "./items.js";

/**
 * @typedef {{id?:string, group?:string, n:number}} Need
 * @typedef {{out:string, n:number, needs:Need[], table?:boolean, smelt?:boolean, keep?:string[]}} Recipe
 */

/** @type {Recipe[]} */
export const RECIPES = [];
const R = (out, n, needs, table = true) => RECIPES.push({ out, n, needs, table });
const S = (out, input) => RECIPES.push({ out, n: 1, needs: [typeof input === "string" && input.startsWith("#") ? { group: input.slice(1), n: 1 } : { id: input, n: 1 }], smelt: true });

for (const w of WOODS) {
  R(`minecraft:${w}_planks`, 4, [{ group: `log:${w}`, n: 1 }], false);
  R(`minecraft:${w}_slab`, 6, [{ id: `minecraft:${w}_planks`, n: 3 }]);
  R(`minecraft:${w}_stairs`, 4, [{ id: `minecraft:${w}_planks`, n: 6 }]);
  R(`minecraft:${w}_fence`, 3, [{ id: `minecraft:${w}_planks`, n: 4 }, { id: "minecraft:stick", n: 2 }]);
  R(w === "oak" ? "minecraft:wooden_door" : `minecraft:${w}_door`, 3, [{ id: `minecraft:${w}_planks`, n: 6 }]);
}
R("minecraft:crimson_planks", 4, [{ group: "log:crimson", n: 1 }], false);
R("minecraft:warped_planks", 4, [{ group: "log:warped", n: 1 }], false);
R("minecraft:stick", 4, [{ group: "planks", n: 2 }], false);
R("minecraft:crafting_table", 1, [{ group: "planks", n: 4 }], false);
R("minecraft:chest", 1, [{ group: "planks", n: 8 }]);
R("minecraft:barrel", 1, [{ group: "planks", n: 6 }, { group: "slab", n: 2 }]);
R("minecraft:ladder", 3, [{ id: "minecraft:stick", n: 7 }]);
R("minecraft:bowl", 4, [{ group: "planks", n: 3 }]);
R("minecraft:furnace", 1, [{ group: "stone_material", n: 8 }]);
R("minecraft:torch", 4, [{ group: "coal", n: 1 }, { id: "minecraft:stick", n: 1 }], false);
R("minecraft:bread", 1, [{ id: "minecraft:wheat", n: 3 }]);
R("minecraft:bucket", 1, [{ id: "minecraft:iron_ingot", n: 3 }]);
R("minecraft:shears", 1, [{ id: "minecraft:iron_ingot", n: 2 }], false);
R("minecraft:shield", 1, [{ group: "planks", n: 6 }, { id: "minecraft:iron_ingot", n: 1 }]);
R("minecraft:iron_nugget", 9, [{ id: "minecraft:iron_ingot", n: 1 }], false);
R("minecraft:lantern", 1, [{ id: "minecraft:iron_nugget", n: 8 }, { id: "minecraft:torch", n: 1 }]);
R("minecraft:stone_bricks", 4, [{ id: "minecraft:stone", n: 4 }], false);
R("minecraft:cobblestone_wall", 6, [{ id: "minecraft:cobblestone", n: 6 }]);
R("minecraft:normal_stone_slab", 6, [{ id: "minecraft:stone", n: 3 }]);
R("minecraft:bed", 1, [{ group: "wool", n: 3 }, { group: "planks", n: 3 }]);
R("minecraft:bow", 1, [{ id: "minecraft:stick", n: 3 }, { id: "minecraft:string", n: 3 }]);
R("minecraft:arrow", 4, [{ id: "minecraft:flint", n: 1 }, { id: "minecraft:stick", n: 1 }, { id: "minecraft:feather", n: 1 }]);
R("minecraft:glass_pane", 16, [{ id: "minecraft:glass", n: 6 }]);
R("minecraft:iron_bars", 16, [{ id: "minecraft:iron_ingot", n: 6 }]);
R("minecraft:rail", 16, [{ id: "minecraft:iron_ingot", n: 6 }, { id: "minecraft:stick", n: 1 }]);
R("minecraft:boat", 1, [{ group: "planks", n: 5 }]);
R("minecraft:composter", 1, [{ group: "wood_slab", n: 7 }]);
R("minecraft:hay_block", 1, [{ id: "minecraft:wheat", n: 9 }]);
R("minecraft:pumpkin_pie", 1, [{ id: "minecraft:pumpkin", n: 1 }, { id: "minecraft:sugar", n: 1 }, { id: "minecraft:egg", n: 1 }], false);
R("minecraft:sugar", 1, [{ id: "minecraft:sugar_cane", n: 1 }], false);
R("minecraft:paper", 3, [{ id: "minecraft:sugar_cane", n: 3 }]);
R("minecraft:mushroom_stew", 1, [{ id: "minecraft:brown_mushroom", n: 1 }, { id: "minecraft:red_mushroom", n: 1 }, { id: "minecraft:bowl", n: 1 }], false);
R("minecraft:white_wool", 1, [{ id: "minecraft:string", n: 4 }], false);

const TOOL_SHAPES = { pickaxe: [3, 2], axe: [3, 2], shovel: [1, 2], hoe: [2, 2], sword: [2, 1] };
const TOOL_MAT = { wooden: { group: "planks" }, stone: { group: "stone_material" }, iron: { id: "minecraft:iron_ingot" },
  golden: { id: "minecraft:gold_ingot" }, diamond: { id: "minecraft:diamond" } };
for (const [tier, mat] of Object.entries(TOOL_MAT)) {
  for (const [kind, [m, s]] of Object.entries(TOOL_SHAPES)) {
    R(`minecraft:${tier}_${kind}`, 1, [{ ...mat, n: m }, { id: "minecraft:stick", n: s }]);
  }
}
const ARMOR = { helmet: 5, chestplate: 8, leggings: 7, boots: 4 };
for (const [piece, n] of Object.entries(ARMOR)) {
  R(`minecraft:iron_${piece}`, 1, [{ id: "minecraft:iron_ingot", n }]);
  R(`minecraft:diamond_${piece}`, 1, [{ id: "minecraft:diamond", n }]);
  R(`minecraft:golden_${piece}`, 1, [{ id: "minecraft:gold_ingot", n }]);
}

// fundição (fornalha)
S("minecraft:iron_ingot", "minecraft:raw_iron");
S("minecraft:gold_ingot", "minecraft:raw_gold");
S("minecraft:copper_ingot", "minecraft:raw_copper");
S("minecraft:glass", "#sand");
S("minecraft:stone", "minecraft:cobblestone");
S("minecraft:smooth_stone", "minecraft:stone");
S("minecraft:charcoal", "#log");
S("minecraft:brick", "minecraft:clay_ball");
S("minecraft:cooked_beef", "minecraft:beef");
S("minecraft:cooked_porkchop", "minecraft:porkchop");
S("minecraft:cooked_mutton", "minecraft:mutton");
S("minecraft:cooked_chicken", "minecraft:chicken");
S("minecraft:cooked_rabbit", "minecraft:rabbit");
S("minecraft:cooked_cod", "minecraft:cod");
S("minecraft:cooked_salmon", "minecraft:salmon");
S("minecraft:baked_potato", "minecraft:potato");
S("minecraft:dried_kelp", "minecraft:kelp");

/** Itens pertencem a um grupo de ingrediente? */
export function matchesNeed(need, id) {
  if (need.id) return need.id === id;
  const g = need.group ?? "";
  if (g === "planks") return isPlanks(id);
  if (g === "log") return isLog(id);
  if (g.startsWith("log:")) return isLog(id) && woodOf(id) === g.slice(4);
  if (g === "stone_material") return ["minecraft:cobblestone", "minecraft:cobbled_deepslate", "minecraft:blackstone"].includes(id);
  if (g === "coal") return id === "minecraft:coal" || id === "minecraft:charcoal";
  if (g === "wool") return /_wool$/.test(id);
  if (g === "sand") return id === "minecraft:sand" || id === "minecraft:red_sand";
  if (g === "slab" || g === "wood_slab") return /_slab$/.test(id) && WOODS.some((w) => id === `minecraft:${w}_slab`);
  return false;
}

/** Receitas que produzem o item. */
export function recipesFor(id) {
  return RECIPES.filter((r) => r.out === id);
}

/** Item "representante" para obter um ingrediente de grupo (o que a Lila vai buscar/fabricar). */
export function representative(need, pref = "oak") {
  if (need.id) return need.id;
  const g = need.group ?? "";
  if (g === "planks") return `minecraft:${pref}_planks`;
  if (g === "log") return `minecraft:${pref}_log`;
  if (g.startsWith("log:")) return `minecraft:${g.slice(4)}_log`;
  if (g === "stone_material") return "minecraft:cobblestone";
  if (g === "coal") return "minecraft:coal";
  if (g === "wool") return "minecraft:white_wool";
  if (g === "sand") return "minecraft:sand";
  if (g === "slab" || g === "wood_slab") return `minecraft:${pref}_slab`;
  return "minecraft:air";
}

/**
 * Expande a árvore de materiais brutos necessários (para relatórios/estimativas).
 * Retorna mapa id->quantidade de itens "base" (que não têm receita ou são coletados).
 */
export function rawCost(id, count, depth = 0, out = {}) {
  const rs = recipesFor(id);
  if (!rs.length || depth > 6) {
    out[id] = (out[id] ?? 0) + count;
    return out;
  }
  const r = rs[0];
  const crafts = Math.ceil(count / r.n);
  for (const need of r.needs) rawCost(representative(need), need.n * crafts, depth + 1, out);
  return out;
}

/** Material lógico de planta de construção -> item necessário (por bloco). */
export function blueprintItem(m, wood = "oak") {
  switch (m) {
    case "planks": return `minecraft:${wood}_planks`;
    case "log": return `minecraft:${wood}_log`;
    case "slab": return `minecraft:${wood}_slab`;
    case "fence": return `minecraft:${wood}_fence`;
    case "door_lower": return wood === "oak" ? "minecraft:wooden_door" : `minecraft:${wood}_door`;
    case "table": return "minecraft:crafting_table";
    case "chest": return "minecraft:chest";
    case "lantern":
    case "lantern_post": return "minecraft:torch";
    case "cobble": return "minecraft:cobblestone";
    case "stone_bricks": return "minecraft:stone_bricks";
    case "glass": return "minecraft:glass";
    case "water": return "minecraft:water_bucket";
    case "crop": return "minecraft:wheat_seeds";
    default: return undefined; // farmland, door_upper, air
  }
}

/** Bloco a colocar no mundo para um material lógico. */
export function blueprintBlock(m, wood = "oak") {
  switch (m) {
    case "planks": return `minecraft:${wood}_planks`;
    case "log": return `minecraft:${wood}_log`;
    case "slab": return `minecraft:${wood}_slab`;
    case "fence": return `minecraft:${wood}_fence`;
    case "door_lower":
    case "door_upper": return wood === "oak" ? "minecraft:wooden_door" : `minecraft:${wood}_door`;
    case "table": return "minecraft:crafting_table";
    case "chest": return "minecraft:chest";
    case "lantern":
    case "lantern_post": return "minecraft:torch";
    case "cobble": return "minecraft:cobblestone";
    case "stone_bricks": return "minecraft:stone_bricks";
    case "glass": return "minecraft:glass";
    case "farmland": return "minecraft:farmland";
    case "water": return "minecraft:water";
    case "crop": return "minecraft:wheat";
    case "air": return "minecraft:air";
    default: return `minecraft:${wood}_planks`;
  }
}

/** Lista de compras de uma planta: {itemId: quantidade}. */
export function shoppingList(blocks, wood = "oak") {
  const need = {};
  for (const b of blocks) {
    const it = blueprintItem(b.m, wood);
    if (!it) continue;
    need[it] = (need[it] ?? 0) + 1;
  }
  if (need["minecraft:water_bucket"]) need["minecraft:water_bucket"] = 1; // reaproveita o balde
  return need;
}
