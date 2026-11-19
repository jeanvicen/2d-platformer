// Conhecimento do Minecraft que a Lila usa para agir como uma jogadora (puro, testável).
// Ferramentas e níveis, dureza e ferramenta certa por bloco, comida, combustível e grupos de itens.

export const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "poplar"];
export const STEMS = ["crimson", "warped"];

export const TIERS = ["wooden", "stone", "iron", "diamond", "netherite"];
export const TIER_RANK = { none: 0, wooden: 1, golden: 1, stone: 2, iron: 3, diamond: 4, netherite: 5 };
export const TOOL_KINDS = ["pickaxe", "axe", "shovel", "hoe", "sword"];
/** Velocidade de mineração por nível (igual ao jogo). */
export const TIER_SPEED = { none: 1, wooden: 2, stone: 4, iron: 6, diamond: 8, netherite: 9, golden: 12 };
export const TOOL_DAMAGE = {
  sword: { wooden: 4, golden: 4, stone: 5, iron: 6, diamond: 7, netherite: 8 },
  axe: { wooden: 7, golden: 7, stone: 9, iron: 9, diamond: 9, netherite: 10 },
  pickaxe: { wooden: 2, golden: 2, stone: 3, iron: 4, diamond: 5, netherite: 6 },
  shovel: { wooden: 2.5, golden: 2.5, stone: 3.5, iron: 4.5, diamond: 5.5, netherite: 6.5 },
  hoe: { wooden: 1, golden: 1, stone: 1, iron: 1, diamond: 1, netherite: 1 },
};

/** "minecraft:iron_pickaxe" -> {kind:"pickaxe", tier:"iron"} */
export function toolInfo(id) {
  const m = /^minecraft:(wooden|stone|iron|golden|diamond|netherite)_(pickaxe|axe|shovel|hoe|sword)$/.exec(id ?? "");
  if (!m) return undefined;
  return { tier: m[1], kind: m[2] };
}

export function toolId(kind, tier) {
  return `minecraft:${tier}_${kind}`;
}

const LOG_RE = /^minecraft:(?:stripped_)?(oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak|poplar)_(log|wood)$|^minecraft:(?:stripped_)?(crimson|warped)_(stem|hyphae)$/;
export const isLog = (id) => LOG_RE.test(id ?? "");
export const isLeaves = (id) => /_leaves$/.test(id ?? "") || id === "minecraft:azalea_leaves" || id === "minecraft:azalea_leaves_flowered";
export const isPlanks = (id) => /^minecraft:[a-z_]+_planks$/.test(id ?? "");
export function woodOf(id) {
  const m = /^minecraft:(?:stripped_)?([a-z_]+?)_(log|wood|planks|stem|hyphae)$/.exec(id ?? "");
  return m ? m[1] : undefined;
}

export const ORES = {
  coal: ["minecraft:coal_ore", "minecraft:deepslate_coal_ore"],
  iron: ["minecraft:iron_ore", "minecraft:deepslate_iron_ore"],
  copper: ["minecraft:copper_ore", "minecraft:deepslate_copper_ore"],
  gold: ["minecraft:gold_ore", "minecraft:deepslate_gold_ore", "minecraft:nether_gold_ore"],
  redstone: ["minecraft:redstone_ore", "minecraft:deepslate_redstone_ore", "minecraft:lit_redstone_ore", "minecraft:lit_deepslate_redstone_ore"],
  lapis: ["minecraft:lapis_ore", "minecraft:deepslate_lapis_ore"],
  diamond: ["minecraft:diamond_ore", "minecraft:deepslate_diamond_ore"],
  emerald: ["minecraft:emerald_ore", "minecraft:deepslate_emerald_ore"],
};
/** Nível mínimo de picareta para cada minério (regra do jogo). */
export const ORE_TIER = { coal: "wooden", copper: "stone", iron: "stone", lapis: "stone", gold: "iron", redstone: "iron", diamond: "iron", emerald: "iron" };
/** Altura preferida para procurar cada minério (Y) — distribuição do jogo atual. */
export const ORE_DEPTH = { coal: 40, copper: 40, iron: 14, lapis: 0, gold: -16, redstone: -54, diamond: -54, emerald: 60 };
export const ORE_ITEM = {
  coal: "minecraft:coal", iron: "minecraft:raw_iron", copper: "minecraft:raw_copper", gold: "minecraft:raw_gold",
  redstone: "minecraft:redstone", lapis: "minecraft:lapis_lazuli", diamond: "minecraft:diamond", emerald: "minecraft:emerald",
};
export function oreOf(id) {
  for (const [k, list] of Object.entries(ORES)) if (list.includes(id)) return k;
  return undefined;
}

const PICK_BLOCKS = /stone|cobble|deepslate|ore$|_ore|andesite|diorite|granite|tuff|calcite|basalt|blackstone|netherrack|brick|obsidian|furnace|anvil|iron_block|gold_block|diamond_block|terracotta|concrete$|sandstone|prismarine|end_stone|quartz|amethyst|dripstone|lantern|rail|cauldron|hopper|copper/;
const SHOVEL_BLOCKS = /dirt|grass_block|sand|gravel|clay|soul_s|mycelium|podzol|snow|farmland|mud|concrete_powder|grass_path|dirt_path|rooted_dirt/;
const AXE_BLOCKS = /_log|_wood|_stem|_hyphae|planks|crafting_table|chest|barrel|bookshelf|fence|door|sign|ladder|pumpkin|melon|bamboo|note_block|composter|trapdoor|wood/;
const HOE_BLOCKS = /leaves|hay_block|sponge|moss|sculk|wart_block|target/;

/** Ferramenta ideal para quebrar o bloco. */
export function toolFor(id) {
  if (!id) return "none";
  if (SHOVEL_BLOCKS.test(id)) return "shovel";
  if (AXE_BLOCKS.test(id)) return "axe";
  if (HOE_BLOCKS.test(id)) return "hoe";
  if (PICK_BLOCKS.test(id)) return "pickaxe";
  return "none";
}

/** Nível mínimo de picareta para o bloco dar drop (0 = qualquer coisa / mão). */
export function requiredTier(id) {
  const ore = oreOf(id);
  if (ore) return ORE_TIER[ore];
  if (/obsidian|ancient_debris|crying_obsidian/.test(id)) return "diamond";
  if (/iron_block|gold_block|diamond_block|emerald_block/.test(id)) return "iron";
  if (toolFor(id) === "pickaxe") return "wooden";
  return "none";
}

/** @type {[RegExp, number][]} */
const HARD = [
  [/obsidian/, 50], [/ancient_debris/, 30], [/deepslate.*ore|deepslate/, 3], [/_ore$/, 3], [/furnace|anvil/, 3.5],
  [/stone|cobble|andesite|diorite|granite|tuff|blackstone|brick/, 1.5], [/basalt/, 1.25], [/_log|_wood|planks|stem|chest|table/, 2],
  [/netherrack/, 0.4], [/sandstone/, 0.8], [/grass_block|mycelium|podzol/, 0.6], [/dirt|sand|farmland|snow_block|clay|gravel|mud/, 0.55],
  [/leaves/, 0.2], [/short_grass|tall_grass|fern|flower|tulip|poppy|dandelion|sapling|wheat|carrots|potatoes|beetroot|bush|torch|snow_layer|vine/, 0],
  [/glass/, 0.3], [/wool/, 0.8], [/pumpkin|melon/, 1],
];
export function hardness(id) {
  for (const [re, h] of HARD) if (re.test(id)) return h;
  return 1;
}

/**
 * Tempo de quebra em ticks como no jogo (com ferramenta certa ou não), multiplicado pela força da Lila.
 * @param {string} id bloco
 * @param {{kind:string,tier:string}|undefined} tool
 * @param {number} strength multiplicador de velocidade (Lila = 1.6)
 */
export function breakTicks(id, tool, strength = 1.6) {
  const h = hardness(id);
  if (h <= 0) return 2;
  const need = toolFor(id);
  const right = tool && tool.kind === need;
  const speed = right ? TIER_SPEED[tool.tier] ?? 1 : 1;
  const canHarvest = requiredTier(id) === "none" || (right && TIER_RANK[tool.tier] >= TIER_RANK[requiredTier(id)]);
  const factor = canHarvest ? 30 : 100;
  const ticks = Math.ceil(((h * factor) / speed / 20) * 20 / strength);
  return Math.max(3, Math.min(ticks, 200));
}

/** Pode coletar o drop deste bloco com essa ferramenta? */
export function canHarvest(id, tool) {
  const req = requiredTier(id);
  if (req === "none") return true;
  if (!tool || tool.kind !== "pickaxe") return false;
  return TIER_RANK[tool.tier] >= TIER_RANK[req];
}

// ------------------------------------------------------------ comida
/** Pontos de fome restaurados (igual ao jogo). */
export const FOOD = {
  "minecraft:apple": 4, "minecraft:bread": 5, "minecraft:baked_potato": 5, "minecraft:carrot": 3, "minecraft:potato": 1,
  "minecraft:beetroot": 1, "minecraft:beetroot_soup": 6, "minecraft:cooked_beef": 8, "minecraft:cooked_porkchop": 8,
  "minecraft:cooked_mutton": 6, "minecraft:cooked_chicken": 6, "minecraft:cooked_rabbit": 5, "minecraft:cooked_cod": 5,
  "minecraft:cooked_salmon": 6, "minecraft:golden_carrot": 6, "minecraft:golden_apple": 4, "minecraft:melon_slice": 2,
  "minecraft:sweet_berries": 2, "minecraft:glow_berries": 2, "minecraft:cookie": 2, "minecraft:pumpkin_pie": 8,
  "minecraft:mushroom_stew": 6, "minecraft:rabbit_stew": 10, "minecraft:dried_kelp": 1, "minecraft:beef": 3,
  "minecraft:porkchop": 3, "minecraft:mutton": 2, "minecraft:chicken": 2, "minecraft:rabbit": 3, "minecraft:cod": 2,
  "minecraft:salmon": 2,
};
/** Comidas cruas que ela prefere assar antes de comer. */
export const RAW_TO_COOKED = {
  "minecraft:beef": "minecraft:cooked_beef", "minecraft:porkchop": "minecraft:cooked_porkchop",
  "minecraft:mutton": "minecraft:cooked_mutton", "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:rabbit": "minecraft:cooked_rabbit", "minecraft:cod": "minecraft:cooked_cod",
  "minecraft:salmon": "minecraft:cooked_salmon", "minecraft:potato": "minecraft:baked_potato",
};
export const isFood = (id) => id in FOOD && id !== "minecraft:chicken" && id !== "minecraft:rotten_flesh";

// ------------------------------------------------------------ combustível (segundos de fornalha / 10 = itens)
export const FUEL = {
  "minecraft:coal": 8, "minecraft:charcoal": 8, "minecraft:coal_block": 80, "minecraft:lava_bucket": 100,
  "minecraft:blaze_rod": 12, "minecraft:dried_kelp_block": 20, "minecraft:stick": 0.5, "minecraft:bamboo": 0.25,
};
export function fuelValue(id) {
  if (id in FUEL) return FUEL[id];
  if (isLog(id) || isPlanks(id)) return 1.5;
  if (/_slab$/.test(id) && /oak|spruce|birch|jungle|acacia|dark_oak|mangrove|cherry|pale_oak|bamboo/.test(id)) return 0.75;
  if (/sapling/.test(id)) return 0.5;
  return 0;
}

// ------------------------------------------------------------ grupos de itens (para pedidos genéricos)
export const GROUPS = {
  log: (id) => isLog(id),
  planks: (id) => isPlanks(id),
  stone_material: (id) => ["minecraft:cobblestone", "minecraft:cobbled_deepslate", "minecraft:blackstone"].includes(id),
  food: (id) => isFood(id),
  wool: (id) => /_wool$/.test(id),
  sapling: (id) => /_sapling$|propagule/.test(id),
  seeds: (id) => ["minecraft:wheat_seeds", "minecraft:beetroot_seeds", "minecraft:carrot", "minecraft:potato"].includes(id),
  coal: (id) => id === "minecraft:coal" || id === "minecraft:charcoal",
  fuel: (id) => fuelValue(id) > 0,
};
export function inGroup(group, id) {
  const f = GROUPS[group];
  return f ? f(id) : false;
}

/** Blocos sem colisão (anda através). */
const PASSABLE_RE = /^minecraft:(air|cave_air|void_air|short_grass|tall_grass|fern|large_fern|dandelion|poppy|blue_orchid|allium|azure_bluet|.*_tulip|oxeye_daisy|cornflower|lily_of_the_valley|wither_rose|sunflower|lilac|rose_bush|peony|torchflower|pitcher_plant|.*_sapling|.*torch|redstone_wire|.*rail|snow_layer|vine|glow_lichen|sugar_cane|wheat|carrots|potatoes|beetroots|melon_stem|pumpkin_stem|deadbush|dead_bush|.*_button|lever|.*_sign|.*_banner|.*pressure_plate|tripwire.*|seagrass|tall_seagrass|kelp.*|pink_petals|leaf_litter|bush|firefly_bush|short_dry_grass|tall_dry_grass|wildflowers|moss_carpet|.*_carpet|hanging_roots|cave_vines.*|spore_blossom|structure_void|light_block.*|frog_spawn|.*coral_fan|.*coral|nether_sprouts|crimson_roots|warped_roots|crimson_fungus|warped_fungus|brown_mushroom|red_mushroom|weeping_vines.*|twisting_vines.*|small_dripleaf_block|cocoa|nether_wart|torchflower_crop|pitcher_crop|sweet_berry_bush|resin_clump|closed_eyeblossom|open_eyeblossom|cactus_flower)$/;
const DANGER_RE = /^minecraft:(lava|flowing_lava|fire|soul_fire|magma_block|cactus|powder_snow|campfire|soul_campfire|sweet_berry_bush|wither_rose|cobweb|pointed_dripstone)$/;
const TALL_RE = /(_fence|_wall|fence_gate|cobblestone_wall|iron_bars|border_block)$/;
const DOOR_RE = /^minecraft:(?!.*trapdoor).*door$/;
const CLIMB_RE = /^minecraft:(ladder|vine|scaffolding|twisting_vines|weeping_vines|cave_vines)$/;

/**
 * Classifica um bloco para o pathfinding.
 * @returns {0|1|2|3|4|5|6} AIR, SOLID, DANGER, WATER, TALL, DOOR, CLIMB
 */
export function classifyId(id, isLiquid = false) {
  if (!id) return 1;
  if (DANGER_RE.test(id)) return 2;
  if (id === "minecraft:water" || id === "minecraft:flowing_water" || id === "minecraft:bubble_column") return 3;
  if (isLiquid) return id.includes("lava") ? 2 : 3;
  if (CLIMB_RE.test(id)) return 6;
  if (PASSABLE_RE.test(id)) return 0;
  if (DOOR_RE.test(id)) return 5;
  if (TALL_RE.test(id)) return 4;
  return 1;
}

/** Blocos naturais que a Lila pode quebrar livremente (nunca construções do jogador). */
const NATURAL_RE = /^minecraft:(stone|granite|diorite|andesite|deepslate|tuff|calcite|dripstone_block|dirt|coarse_dirt|rooted_dirt|grass_block|podzol|mycelium|mud|clay|gravel|sand|red_sand|sandstone|red_sandstone|snow|snow_layer|ice|netherrack|soul_sand|soul_soil|basalt|blackstone|end_stone|moss_block|moss_carpet|short_grass|tall_grass|fern|large_fern|dandelion|poppy|blue_orchid|allium|azure_bluet|.*_tulip|oxeye_daisy|cornflower|lily_of_the_valley|deadbush|dead_bush|vine|glow_lichen|pink_petals|leaf_litter|bush|firefly_bush|short_dry_grass|tall_dry_grass|wildflowers|sweet_berry_bush|.*_leaves|.*_log|.*_stem|.*_ore|ancient_debris|obsidian|cobweb|pumpkin|melon_block|melon|sugar_cane|cactus|bamboo|kelp|seagrass|tall_seagrass|hanging_roots|cave_vines.*|spore_blossom|amethyst_cluster|budding_amethyst|amethyst_block|pointed_dripstone|sculk|sculk_vein|brown_mushroom|red_mushroom|mushroom_stem|brown_mushroom_block|red_mushroom_block|smooth_basalt|magma_block|packed_ice|blue_ice|powder_snow|.*_coral.*)$/;
export const isNatural = (id) => NATURAL_RE.test(id ?? "");
export const isAirId = (id) => id === "minecraft:air";

/** Plantas maduras (para colher sem estragar a plantação). */
export const CROPS = {
  "minecraft:wheat": { state: "growth", ripe: 7, seed: "minecraft:wheat_seeds", item: "minecraft:wheat" },
  "minecraft:carrots": { state: "growth", ripe: 7, seed: "minecraft:carrot", item: "minecraft:carrot" },
  "minecraft:potatoes": { state: "growth", ripe: 7, seed: "minecraft:potato", item: "minecraft:potato" },
  "minecraft:beetroot": { state: "growth", ripe: 7, seed: "minecraft:beetroot_seeds", item: "minecraft:beetroot" },
};
/** Semente -> bloco plantado. */
export const SEED_TO_CROP = {
  "minecraft:wheat_seeds": "minecraft:wheat", "minecraft:carrot": "minecraft:carrots",
  "minecraft:potato": "minecraft:potatoes", "minecraft:beetroot_seeds": "minecraft:beetroot",
};

export const HOSTILE_SKIP = new Set(["minecraft:enderman", "minecraft:zombie_pigman", "minecraft:piglin", "minecraft:creaking"]);

/** Nome amigável em português para mensagens. */
export const PT_NAMES = {
  "minecraft:oak_log": "tronco de carvalho", log: "madeira", planks: "tábuas", "minecraft:stick": "gravetos",
  "minecraft:cobblestone": "pedregulho", "minecraft:coal": "carvão", "minecraft:charcoal": "carvão vegetal",
  "minecraft:raw_iron": "ferro bruto", "minecraft:iron_ingot": "barras de ferro", "minecraft:raw_gold": "ouro bruto",
  "minecraft:gold_ingot": "barras de ouro", "minecraft:raw_copper": "cobre bruto", "minecraft:copper_ingot": "barras de cobre",
  "minecraft:diamond": "diamantes", "minecraft:redstone": "redstone", "minecraft:lapis_lazuli": "lápis-lazúli",
  "minecraft:emerald": "esmeraldas", "minecraft:sand": "areia", "minecraft:glass": "vidro", "minecraft:dirt": "terra",
  "minecraft:gravel": "cascalho", "minecraft:wheat": "trigo", "minecraft:wheat_seeds": "sementes", "minecraft:bread": "pão",
  "minecraft:apple": "maçãs", "minecraft:torch": "tochas", "minecraft:crafting_table": "bancada",
  "minecraft:furnace": "fornalha", "minecraft:chest": "baú", "minecraft:bucket": "balde", "minecraft:water_bucket": "balde de água",
  food: "comida", "minecraft:carrot": "cenouras", "minecraft:potato": "batatas", "minecraft:baked_potato": "batatas assadas",
  "minecraft:sweet_berries": "frutas vermelhas", "minecraft:cooked_beef": "bife", "minecraft:flint": "sílex",
  "minecraft:stone": "pedra", "minecraft:stone_bricks": "tijolos de pedra", "minecraft:ladder": "escadas de mão",
  "minecraft:shield": "escudo", "minecraft:string": "linha", "minecraft:leather": "couro", "minecraft:feather": "penas",
  "minecraft:bone": "ossos", "minecraft:arrow": "flechas", "minecraft:bow": "arco", "minecraft:white_wool": "lã",
  "minecraft:shears": "tesoura", "minecraft:sugar_cane": "cana-de-açúcar", "minecraft:clay_ball": "argila",
};
const KIND_PT = { pickaxe: "picareta", axe: "machado", shovel: "pá", hoe: "enxada", sword: "espada" };
const TIER_PT = { wooden: "de madeira", stone: "de pedra", iron: "de ferro", golden: "de ouro", diamond: "de diamante", netherite: "de netherita" };

export function ptName(id) {
  if (PT_NAMES[id]) return PT_NAMES[id];
  const t = toolInfo(id);
  if (t) return `${KIND_PT[t.kind]} ${TIER_PT[t.tier]}`;
  if (isLog(id)) return "madeira";
  if (isPlanks(id)) return "tábuas";
  return String(id ?? "?").replace("minecraft:", "").replace(/_/g, " ");
}
