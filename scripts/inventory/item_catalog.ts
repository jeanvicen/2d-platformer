/**
 * Item catalog: categories and per-category handlers' data (tools, armor, weapons, food,
 * materials). Pure module. Only items listed here are "supported": the shadow will not
 * claim it can use anything else.
 */
import type { EquipSlot, ResourceKind } from "../core/types";

export type ToolKind = "axe" | "pickaxe" | "shovel" | "hoe" | "sword" | "shears" | "fishing_rod";
export type Tier = "wooden" | "stone" | "iron" | "golden" | "diamond" | "netherite";

export const TIER_ORDER: Tier[] = ["wooden", "golden", "stone", "iron", "diamond", "netherite"];
/** mining level used for harvest checks (golden mines like wooden) */
export const TIER_LEVEL: Record<Tier, number> = { wooden: 1, golden: 1, stone: 2, iron: 3, diamond: 4, netherite: 5 };
/** break speed multiplier (vanilla-like) */
export const TIER_SPEED: Record<Tier, number> = { wooden: 2, stone: 4, iron: 6, diamond: 8, netherite: 9, golden: 12 };
const SWORD_DAMAGE: Record<Tier, number> = { wooden: 4, golden: 4, stone: 5, iron: 6, diamond: 7, netherite: 8 };

export interface ToolInfo {
  kind: ToolKind;
  tier?: Tier;
}

export function toolInfo(id: string): ToolInfo | undefined {
  const m = /^minecraft:(wooden|stone|iron|golden|diamond|netherite)_(axe|pickaxe|shovel|hoe|sword)$/.exec(id);
  if (m) return { kind: m[2] as ToolKind, tier: m[1] as Tier };
  if (id === "minecraft:shears") return { kind: "shears" };
  if (id === "minecraft:fishing_rod") return { kind: "fishing_rod" };
  return undefined;
}

export function weaponDamage(id: string | undefined): number {
  if (!id) return 1;
  const t = toolInfo(id);
  if (!t || !t.tier) return 1;
  if (t.kind === "sword") return SWORD_DAMAGE[t.tier];
  if (t.kind === "axe") return SWORD_DAMAGE[t.tier] + 1;
  if (t.kind === "pickaxe") return SWORD_DAMAGE[t.tier] - 2;
  return SWORD_DAMAGE[t.tier] - 3;
}

export interface ArmorInfo {
  slot: EquipSlot;
  points: number;
}

const ARMOR_POINTS: Record<string, [number, number, number, number]> = {
  // head, chest, legs, feet
  leather: [1, 3, 2, 1],
  chainmail: [2, 5, 4, 1],
  iron: [2, 6, 5, 2],
  golden: [2, 5, 3, 1],
  diamond: [3, 8, 6, 3],
  netherite: [3, 8, 6, 3],
};

export function armorInfo(id: string): ArmorInfo | undefined {
  if (id === "minecraft:turtle_helmet") return { slot: "head", points: 2 };
  if (id === "minecraft:shield") return { slot: "offhand", points: 0 };
  const m = /^minecraft:(leather|chainmail|iron|golden|diamond|netherite)_(helmet|chestplate|leggings|boots)$/.exec(id);
  if (!m) return undefined;
  const idx = { helmet: 0, chestplate: 1, leggings: 2, boots: 3 }[m[2] as "helmet"];
  const slot: EquipSlot = (["head", "chest", "legs", "feet"] as EquipSlot[])[idx];
  return { slot, points: ARMOR_POINTS[m[1]][idx] };
}

/** food points / saturation, vanilla values. `risky` foods are only eaten when starving. */
export interface FoodInfo {
  food: number;
  sat: number;
  risky?: boolean;
  raw?: boolean;
}

export const FOODS: Record<string, FoodInfo> = {
  "minecraft:bread": { food: 5, sat: 6 },
  "minecraft:apple": { food: 4, sat: 2.4 },
  "minecraft:golden_apple": { food: 4, sat: 9.6 },
  "minecraft:carrot": { food: 3, sat: 3.6 },
  "minecraft:golden_carrot": { food: 6, sat: 14.4 },
  "minecraft:potato": { food: 1, sat: 0.6, raw: true },
  "minecraft:baked_potato": { food: 5, sat: 6 },
  "minecraft:beetroot": { food: 1, sat: 1.2 },
  "minecraft:beetroot_soup": { food: 6, sat: 7.2 },
  "minecraft:sweet_berries": { food: 2, sat: 0.4 },
  "minecraft:glow_berries": { food: 2, sat: 0.4 },
  "minecraft:melon_slice": { food: 2, sat: 1.2 },
  "minecraft:cookie": { food: 2, sat: 0.4 },
  "minecraft:pumpkin_pie": { food: 8, sat: 4.8 },
  "minecraft:mushroom_stew": { food: 6, sat: 7.2 },
  "minecraft:beef": { food: 3, sat: 1.8, raw: true },
  "minecraft:cooked_beef": { food: 8, sat: 12.8 },
  "minecraft:porkchop": { food: 3, sat: 1.8, raw: true },
  "minecraft:cooked_porkchop": { food: 8, sat: 12.8 },
  "minecraft:chicken": { food: 2, sat: 1.2, raw: true, risky: true },
  "minecraft:cooked_chicken": { food: 6, sat: 7.2 },
  "minecraft:mutton": { food: 2, sat: 1.2, raw: true },
  "minecraft:cooked_mutton": { food: 6, sat: 9.6 },
  "minecraft:rabbit": { food: 3, sat: 1.8, raw: true },
  "minecraft:cooked_rabbit": { food: 5, sat: 6 },
  "minecraft:cod": { food: 2, sat: 0.4, raw: true },
  "minecraft:cooked_cod": { food: 5, sat: 6 },
  "minecraft:salmon": { food: 2, sat: 0.4, raw: true },
  "minecraft:cooked_salmon": { food: 6, sat: 9.6 },
  "minecraft:dried_kelp": { food: 1, sat: 0.6 },
  "minecraft:rotten_flesh": { food: 4, sat: 0.8, risky: true },
  "minecraft:spider_eye": { food: 2, sat: 3.2, risky: true },
  "minecraft:poisonous_potato": { food: 2, sat: 1.2, risky: true },
};

export const isFood = (id: string): boolean => id in FOODS;

/** Rare items the shadow never consumes or uses up on her own. */
export const RARE_ITEMS = new Set<string>([
  "minecraft:golden_apple",
  "minecraft:enchanted_golden_apple",
  "minecraft:golden_carrot",
  "minecraft:diamond",
  "minecraft:emerald",
  "minecraft:netherite_ingot",
  "minecraft:totem_of_undying",
]);

export const COOK_RESULT: Record<string, string> = {
  "minecraft:beef": "minecraft:cooked_beef",
  "minecraft:porkchop": "minecraft:cooked_porkchop",
  "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:mutton": "minecraft:cooked_mutton",
  "minecraft:rabbit": "minecraft:cooked_rabbit",
  "minecraft:cod": "minecraft:cooked_cod",
  "minecraft:salmon": "minecraft:cooked_salmon",
  "minecraft:potato": "minecraft:baked_potato",
  "minecraft:raw_iron": "minecraft:iron_ingot",
  "minecraft:raw_gold": "minecraft:gold_ingot",
  "minecraft:raw_copper": "minecraft:copper_ingot",
  "minecraft:sand": "minecraft:glass",
  "minecraft:cobblestone": "minecraft:stone",
};

export const isFoodCookable = (id: string): boolean => id in COOK_RESULT && isFood(COOK_RESULT[id]);

/** furnace fuel: how many items one unit smelts */
export const FUEL: Record<string, number> = {
  "minecraft:coal": 8,
  "minecraft:charcoal": 8,
  "minecraft:coal_block": 80,
  "minecraft:blaze_rod": 12,
  "minecraft:stick": 0.5,
};
export function fuelValue(id: string): number {
  if (id in FUEL) return FUEL[id];
  if (/_planks$/.test(id) || /_log$/.test(id) || /_stem$/.test(id) || /_wood$/.test(id)) return 1.5;
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------
export const LOG_BLOCKS = [
  "oak_log", "spruce_log", "birch_log", "jungle_log", "acacia_log", "dark_oak_log",
  "mangrove_log", "cherry_log", "pale_oak_log",
].map((s) => "minecraft:" + s);

export const isLogBlock = (id: string): boolean => LOG_BLOCKS.includes(id) || id === "minecraft:log" || id === "minecraft:log2";
export const isLeafBlock = (id: string): boolean => /_leaves$/.test(id) || id === "minecraft:leaves" || id === "minecraft:leaves2" || id === "minecraft:azalea_leaves" || id === "minecraft:flowering_azalea_leaves";
export const isLogItem = (id: string): boolean => /^minecraft:[a-z_]+_(log|stem)$/.test(id) && !id.includes("stripped");
export const isPlanksItem = (id: string): boolean => /^minecraft:[a-z_]+_planks$/.test(id);
export const plankOf = (logId: string): string => {
  const m = /^minecraft:([a-z_]+)_(log|stem)$/.exec(logId);
  return m ? `minecraft:${m[1]}_planks` : "minecraft:oak_planks";
};

export interface OreInfo {
  resource: ResourceKind;
  needLevel: number; // TIER_LEVEL required (1 wooden, 2 stone, 3 iron)
  hardness: number;
}

const ORE_TABLE: Record<string, OreInfo> = {
  coal_ore: { resource: "coal", needLevel: 1, hardness: 3 },
  copper_ore: { resource: "copper", needLevel: 2, hardness: 3 },
  iron_ore: { resource: "iron", needLevel: 2, hardness: 3 },
  gold_ore: { resource: "gold", needLevel: 3, hardness: 3 },
  redstone_ore: { resource: "redstone", needLevel: 3, hardness: 3 },
  lit_redstone_ore: { resource: "redstone", needLevel: 3, hardness: 3 },
  lapis_ore: { resource: "lapis", needLevel: 2, hardness: 3 },
  diamond_ore: { resource: "diamond", needLevel: 3, hardness: 3 },
  emerald_ore: { resource: "emerald", needLevel: 3, hardness: 3 },
};

export function oreInfo(blockId: string): OreInfo | undefined {
  const short = blockId.replace("minecraft:", "").replace(/^deepslate_/, "").replace(/^lit_deepslate_/, "lit_");
  const info = ORE_TABLE[short];
  if (!info) return undefined;
  return blockId.includes("deepslate") ? { ...info, hardness: 4.5 } : info;
}

export const STONE_BLOCKS = new Set([
  "minecraft:stone", "minecraft:cobblestone", "minecraft:deepslate", "minecraft:cobbled_deepslate",
  "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff", "minecraft:blackstone",
]);

export const SOFT_BLOCKS: Record<string, ResourceKind> = {
  "minecraft:dirt": "dirt",
  "minecraft:grass_block": "dirt",
  "minecraft:coarse_dirt": "dirt",
  "minecraft:podzol": "dirt",
  "minecraft:sand": "sand",
  "minecraft:red_sand": "sand",
  "minecraft:gravel": "gravel",
};

/** Blocks the shadow refuses to break (unbreakable, technical or griefing-prone). */
export const PROTECTED_BLOCKS = new Set([
  "minecraft:bedrock", "minecraft:barrier", "minecraft:command_block", "minecraft:chain_command_block",
  "minecraft:repeating_command_block", "minecraft:structure_block", "minecraft:jigsaw", "minecraft:end_portal_frame",
  "minecraft:end_portal", "minecraft:portal", "minecraft:end_gateway", "minecraft:reinforced_deepslate",
  "minecraft:light_block", "minecraft:allow", "minecraft:deny", "minecraft:border_block", "minecraft:spawner",
  "minecraft:trial_spawner", "minecraft:vault",
]);

/** Natural blocks: the only ones the shadow digs in area/hole tasks (no griefing of builds). */
export const NATURAL_DIG = new Set([
  "minecraft:dirt", "minecraft:grass_block", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:mycelium",
  "minecraft:sand", "minecraft:red_sand", "minecraft:gravel", "minecraft:clay", "minecraft:stone",
  "minecraft:deepslate", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff",
  "minecraft:netherrack", "minecraft:snow", "minecraft:snow_layer", "minecraft:short_grass", "minecraft:tall_grass",
  "minecraft:fern", "minecraft:large_fern", "minecraft:mud", "minecraft:moss_block", "minecraft:dirt_with_roots",
]);

/** Approximate block hardness for timing (seconds = hardness * 1.5 / speed, like vanilla). */
export function blockHardness(id: string): number {
  if (isLogBlock(id) || /_wood$/.test(id) || isPlanksItem(id)) return 2;
  if (isLeafBlock(id)) return 0.2;
  const ore = oreInfo(id);
  if (ore) return ore.hardness;
  if (id === "minecraft:deepslate" || id === "minecraft:cobbled_deepslate") return 3;
  if (STONE_BLOCKS.has(id)) return 1.5;
  if (id in SOFT_BLOCKS || id === "minecraft:clay" || id === "minecraft:mud") return 0.6;
  if (id.includes("glass")) return 0.3;
  if (/(short_grass|tall_grass|fern|flower|sapling|bush|dandelion|poppy|tulip|wheat|carrots|potatoes|beetroot)/.test(id)) return 0;
  if (id.includes("wool")) return 0.8;
  if (id.includes("obsidian")) return 50;
  return 1.5;
}

/** Which tool is effective on a block, and the minimum tier level needed to get drops. */
export function effectiveTool(id: string): { tool: ToolKind | "none"; needLevel: number } {
  if (isLogBlock(id) || /_wood$/.test(id) || isPlanksItem(id) || /(chest|crafting_table|fence|door|ladder|bookshelf)/.test(id)) {
    return { tool: "axe", needLevel: 0 };
  }
  const ore = oreInfo(id);
  if (ore) return { tool: "pickaxe", needLevel: ore.needLevel };
  if (STONE_BLOCKS.has(id) || /(brick|furnace|stone|cobble|deepslate|andesite|diorite|granite|tuff|terracotta|concrete$)/.test(id)) {
    return { tool: "pickaxe", needLevel: 1 };
  }
  if (id.includes("obsidian")) return { tool: "pickaxe", needLevel: 4 };
  if (id in SOFT_BLOCKS || /(clay|mud|snow|soul_s|farmland|mycelium|concrete_powder)/.test(id)) return { tool: "shovel", needLevel: 0 };
  if (isLeafBlock(id)) return { tool: "hoe", needLevel: 0 };
  return { tool: "none", needLevel: 0 };
}

/** Break time in ticks for a block with a given tool (vanilla-like formula, simplified). */
export function breakTicks(blockId: string, toolId: string | undefined): number {
  const hardness = blockHardness(blockId);
  if (hardness <= 0) return 2;
  const eff = effectiveTool(blockId);
  const t = toolId ? toolInfo(toolId) : undefined;
  let speed = 1;
  let canHarvest = eff.needLevel === 0;
  if (t && t.tier && t.kind === eff.tool) {
    speed = TIER_SPEED[t.tier];
    canHarvest = TIER_LEVEL[t.tier] >= eff.needLevel;
  }
  const seconds = (hardness * (canHarvest ? 1.5 : 5)) / speed;
  return Math.max(2, Math.round(seconds * 20));
}

/** Mature crop definitions (block state "growth"). */
export const CROPS: Record<string, { mature: number; seed: string; product: string }> = {
  "minecraft:wheat": { mature: 7, seed: "minecraft:wheat_seeds", product: "minecraft:wheat" },
  "minecraft:carrots": { mature: 7, seed: "minecraft:carrot", product: "minecraft:carrot" },
  "minecraft:potatoes": { mature: 7, seed: "minecraft:potato", product: "minecraft:potato" },
  "minecraft:beetroot": { mature: 7, seed: "minecraft:beetroot_seeds", product: "minecraft:beetroot" },
};

export const FOOD_ANIMALS: Record<string, string> = {
  "minecraft:cow": "minecraft:beef",
  "minecraft:pig": "minecraft:porkchop",
  "minecraft:chicken": "minecraft:chicken",
  "minecraft:sheep": "minecraft:mutton",
  "minecraft:rabbit": "minecraft:rabbit",
};

/** Map resource kinds to the inventory items that satisfy them (used for counting progress). */
export function itemMatchesResource(id: string, r: ResourceKind): boolean {
  switch (r) {
    case "wood":
      return isLogItem(id);
    case "food":
      return isFood(id);
    case "meat":
      return id in FOODS && (FOODS[id].raw === true || /cooked_/.test(id)) && !/potato|cod|salmon/.test(id);
    case "stone":
      return id === "minecraft:cobblestone" || id === "minecraft:cobbled_deepslate" || id === "minecraft:stone" || id === "minecraft:blackstone";
    case "coal":
      return id === "minecraft:coal";
    case "iron":
      return id === "minecraft:raw_iron" || id === "minecraft:iron_ingot";
    case "gold":
      return id === "minecraft:raw_gold" || id === "minecraft:gold_ingot";
    case "copper":
      return id === "minecraft:raw_copper" || id === "minecraft:copper_ingot";
    case "diamond":
      return id === "minecraft:diamond";
    case "redstone":
      return id === "minecraft:redstone";
    case "lapis":
      return id === "minecraft:lapis_lazuli";
    case "emerald":
      return id === "minecraft:emerald";
    case "ore":
      return ["coal", "iron", "gold", "copper", "diamond", "redstone", "lapis", "emerald"].some((k) =>
        itemMatchesResource(id, k as ResourceKind),
      );
    case "sand":
      return id === "minecraft:sand" || id === "minecraft:red_sand";
    case "dirt":
      return id === "minecraft:dirt";
    case "gravel":
      return id === "minecraft:gravel" || id === "minecraft:flint";
    case "wheat":
      return id === "minecraft:wheat";
    case "carrot":
      return id === "minecraft:carrot";
    case "potato":
      return id === "minecraft:potato" || id === "minecraft:baked_potato";
    case "beetroot":
      return id === "minecraft:beetroot";
    case "berries":
      return id === "minecraft:sweet_berries";
  }
}

export function resourceOfOre(r: ResourceKind): (blockId: string) => boolean {
  return (blockId: string) => {
    const o = oreInfo(blockId);
    if (!o) return false;
    return r === "ore" || o.resource === r;
  };
}

/** Readable PT-BR names for messages. */
export const RESOURCE_PT: Record<ResourceKind, string> = {
  wood: "troncos",
  food: "comida",
  meat: "carne",
  stone: "pedra",
  coal: "carvão",
  iron: "ferro",
  gold: "ouro",
  copper: "cobre",
  diamond: "diamante",
  redstone: "redstone",
  lapis: "lápis-lazúli",
  emerald: "esmeralda",
  ore: "minérios",
  sand: "areia",
  dirt: "terra",
  gravel: "cascalho",
  wheat: "trigo",
  carrot: "cenouras",
  potato: "batatas",
  beetroot: "beterrabas",
  berries: "frutinhas",
};

export function prettyItem(id: string): string {
  const known: Record<string, string> = {
    "minecraft:bread": "pão",
    "minecraft:oak_log": "tronco de carvalho",
    "minecraft:cobblestone": "pedregulho",
    "minecraft:stick": "graveto",
    "minecraft:crafting_table": "bancada",
    "minecraft:torch": "tocha",
    "minecraft:wheat": "trigo",
    "minecraft:coal": "carvão",
    "minecraft:raw_iron": "ferro bruto",
    "minecraft:iron_ingot": "barra de ferro",
  };
  if (known[id]) return known[id];
  const t = toolInfo(id);
  if (t && t.tier) {
    const tool = { axe: "machado", pickaxe: "picareta", shovel: "pá", hoe: "enxada", sword: "espada" }[t.kind as "axe"];
    const tier = { wooden: "madeira", stone: "pedra", iron: "ferro", golden: "ouro", diamond: "diamante", netherite: "netherite" }[t.tier];
    if (tool) return `${tool} de ${tier}`;
  }
  return id.replace("minecraft:", "").replace(/_/g, " ");
}
