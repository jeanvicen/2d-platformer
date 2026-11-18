// Economia de construção da Lyra (pura): converte materiais lógicos em blocos reais e
// calcula as matérias-primas necessárias (troncos, pedregulho, areia) — como um jogador faria
// ao fabricar tábuas, lajes, cercas, portas, tochas etc. A fundição usa o "fogo sombrio" da Lyra
// (sem combustível) para manter o ritmo de jogo.

export const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"];

export const LOG_IDS = WOODS.map((w) => `minecraft:${w}_log`);

/** Custo de cada material lógico em matérias-primas. */
const COST = {
  planks: { log: 0.25 },
  log: { log: 1 },
  slab: { log: 0.125 },
  fence: { log: 5 / 12 },
  door_lower: { log: 0.5 },
  door_upper: {},
  table: { log: 1 },
  chest: { log: 2 },
  lantern: { log: 0.35 },
  lantern_post: { log: 0.35 },
  cobble: { cobblestone: 1 },
  stone_bricks: { cobblestone: 1 },
  glass: { sand: 1 },
  farmland: {},
  water: {},
  crop: {},
  air: {},
};

export function requirements(blocks) {
  const need = { log: 0, cobblestone: 0, sand: 0 };
  for (const b of blocks) {
    const c = COST[b.m] ?? {};
    for (const [k, v] of Object.entries(c)) need[k] += v;
  }
  return { log: Math.ceil(need.log), cobblestone: Math.ceil(need.cobblestone), sand: Math.ceil(need.sand) };
}

/** Bloco real para um material lógico. */
export function resolveBlock(m, wood = "oak") {
  const w = WOODS.includes(wood) ? wood : "oak";
  switch (m) {
    case "planks": return `minecraft:${w}_planks`;
    case "log": return `minecraft:${w}_log`;
    case "slab": return `minecraft:${w}_slab`;
    case "fence": return `minecraft:${w}_fence`;
    case "door_lower":
    case "door_upper": return w === "oak" ? "minecraft:wooden_door" : `minecraft:${w}_door`;
    case "table": return "minecraft:crafting_table";
    case "chest": return "minecraft:chest";
    case "lantern":
    case "lantern_post": return "minecraft:lantern";
    case "cobble": return "minecraft:cobblestone";
    case "stone_bricks": return "minecraft:stone_bricks";
    case "glass": return "minecraft:glass";
    case "farmland": return "minecraft:farmland";
    case "water": return "minecraft:water";
    case "crop": return "minecraft:wheat";
    case "air": return "minecraft:air";
    default: return `minecraft:${w}_planks`;
  }
}

/** Substituições quando falta matéria-prima (ex.: sem areia → janelas viram grades de madeira). */
export function substitute(blocks, missing) {
  return blocks.map((b) => {
    if (missing.sand && b.m === "glass") return { ...b, m: "fence" };
    if (missing.cobblestone && (b.m === "cobble" || b.m === "stone_bricks")) return { ...b, m: "planks" };
    return b;
  });
}

/** Tipo de madeira predominante a partir de um resumo {typeId: qtd}. */
export function dominantWood(summary) {
  let best = "oak", n = 0;
  for (const w of WOODS) {
    const c = summary[`minecraft:${w}_log`] ?? 0;
    if (c > n) {
      n = c;
      best = w;
    }
  }
  return best;
}

/** Drops "realistas" para blocos minerados pela Lyra. */
export const ORE_DROPS = {
  coal: { blocks: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"], item: "minecraft:coal" },
  iron: { blocks: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"], item: "minecraft:raw_iron" },
  gold: { blocks: ["minecraft:gold_ore", "minecraft:deepslate_gold_ore"], item: "minecraft:raw_gold" },
  copper: { blocks: ["minecraft:copper_ore", "minecraft:deepslate_copper_ore"], item: "minecraft:raw_copper" },
  diamond: { blocks: ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"], item: "minecraft:diamond" },
  redstone: { blocks: ["minecraft:redstone_ore", "minecraft:deepslate_redstone_ore"], item: "minecraft:redstone" },
  lapis: { blocks: ["minecraft:lapis_ore", "minecraft:deepslate_lapis_ore"], item: "minecraft:lapis_lazuli" },
};

export const STONE_LIKE = ["minecraft:stone", "minecraft:cobblestone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite",
  "minecraft:deepslate", "minecraft:tuff", "minecraft:cobbled_deepslate"];

/** Blocos naturais que podem ser limpos de um terreno de obra (nunca construções do jogador). */
export const NATURAL_CLEARABLE = [
  "minecraft:air", "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:dandelion",
  "minecraft:poppy", "minecraft:blue_orchid", "minecraft:allium", "minecraft:azure_bluet", "minecraft:red_tulip", "minecraft:orange_tulip",
  "minecraft:white_tulip", "minecraft:pink_tulip", "minecraft:oxeye_daisy", "minecraft:cornflower", "minecraft:lily_of_the_valley",
  "minecraft:snow_layer", "minecraft:deadbush", "minecraft:sweet_berry_bush", "minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt",
  "minecraft:podzol", "minecraft:sand", "minecraft:red_sand", "minecraft:gravel", "minecraft:stone", "minecraft:andesite", "minecraft:diorite",
  "minecraft:granite", "minecraft:clay", "minecraft:moss_block", "minecraft:moss_carpet", "minecraft:mycelium", "minecraft:snow",
  "minecraft:pink_petals", "minecraft:leaf_litter", "minecraft:bush", "minecraft:firefly_bush", "minecraft:short_dry_grass", "minecraft:tall_dry_grass",
  "minecraft:wildflowers", "minecraft:vine", "minecraft:glow_lichen",
];
