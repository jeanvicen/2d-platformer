// Percepção do mundo da Lyra: varreduras nativas de blocos, árvores naturais, pontos de apoio.
import { BlockVolume } from "@minecraft/server";
import { LOG_IDS } from "../lib/recipes.js";

const PASSABLE = new Set([
  "minecraft:air", "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:dandelion",
  "minecraft:poppy", "minecraft:snow_layer", "minecraft:torch", "minecraft:deadbush", "minecraft:vine", "minecraft:glow_lichen",
  "minecraft:pink_petals", "minecraft:leaf_litter", "minecraft:wildflowers", "minecraft:short_dry_grass", "minecraft:tall_dry_grass",
  "minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot", "minecraft:redstone_wire", "minecraft:rail",
  "minecraft:wooden_door", "minecraft:spruce_door", "minecraft:birch_door", "minecraft:jungle_door", "minecraft:acacia_door",
  "minecraft:dark_oak_door", "minecraft:mangrove_door", "minecraft:cherry_door", "minecraft:pale_oak_door", "minecraft:lantern",
  "minecraft:cornflower", "minecraft:azure_bluet", "minecraft:oxeye_daisy", "minecraft:red_tulip", "minecraft:white_tulip",
  "minecraft:blue_orchid", "minecraft:allium", "minecraft:lily_of_the_valley", "minecraft:bush", "minecraft:firefly_bush",
]);
const DANGER = new Set(["minecraft:lava", "minecraft:fire", "minecraft:soul_fire", "minecraft:magma_block", "minecraft:campfire",
  "minecraft:soul_campfire", "minecraft:sweet_berry_bush", "minecraft:cactus", "minecraft:powder_snow", "minecraft:wither_rose"]);

/** 0 livre · 1 sólido · 2 perigo · 3 água (para o A*). Blocos não carregados contam como sólidos. */
export function solidFn(dim) {
  return (x, y, z) => {
    try {
      const b = dim.getBlock({ x, y, z });
      if (!b) return 1;
      if (b.isAir) return 0;
      const t = b.typeId;
      if (DANGER.has(t)) return 2;
      if (b.isLiquid) return t.includes("lava") ? 2 : 3;
      if (PASSABLE.has(t) || t.endsWith("_carpet") || t.endsWith("_sapling") || t.endsWith("_flower")) return 0;
      return 1;
    } catch {
      return 1;
    }
  };
}

export function isLog(t) {
  return t.endsWith("_log") && !t.includes("stripped") || t.endsWith("_stem") && !t.includes("stripped") && !t.includes("mushroom");
}
export function isLeaves(t) {
  return t.endsWith("_leaves") || t.includes("leaves");
}

function volume(center, r, h) {
  const c = { x: Math.floor(center.x), y: Math.floor(center.y), z: Math.floor(center.z) };
  return new BlockVolume({ x: c.x - r, y: c.y - Math.floor(h / 2), z: c.z - r }, { x: c.x + r, y: c.y + h, z: c.z + r });
}

/** Lista posições de blocos de certos tipos (varredura nativa, rápida). */
export function scan(dim, center, r, h, types) {
  try {
    const list = dim.getBlocks(volume(center, r, h), { includeTypes: types }, false);
    const out = [];
    for (const loc of list.getBlockLocationIterator()) {
      out.push({ x: loc.x, y: loc.y, z: loc.z });
      if (out.length > 600) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Árvore natural mais próxima: tronco ligado a folhas. Retorna a base do tronco. */
export function findTree(dim, center, r, avoid = new Set()) {
  const logs = scan(dim, center, r, 24, LOG_IDS.concat(["minecraft:crimson_stem", "minecraft:warped_stem"]));
  logs.sort((a, b) => ((a.x - center.x) ** 2 + (a.z - center.z) ** 2) - ((b.x - center.x) ** 2 + (b.z - center.z) ** 2));
  for (const l of logs) {
    // desce até a base
    let base = { ...l };
    for (let i = 0; i < 20; i++) {
      const below = dim.getBlock({ x: base.x, y: base.y - 1, z: base.z });
      if (below && isLog(below.typeId)) base = { x: base.x, y: base.y - 1, z: base.z };
      else break;
    }
    const k = `${base.x},${base.y},${base.z}`;
    if (avoid.has(k)) continue;
    if (!hasLeavesNear(dim, l)) continue; // não derruba troncos de construções
    const ground = dim.getBlock({ x: base.x, y: base.y - 1, z: base.z });
    if (!ground || ground.isAir) continue;
    return base;
  }
  return undefined;
}

function hasLeavesNear(dim, p) {
  for (let dy = 0; dy <= 7; dy++)
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const b = dim.getBlock({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
      if (b && isLeaves(b.typeId)) return true;
    }
  return false;
}

/** Todos os troncos conectados a partir da base (inclui galhos), de baixo para cima. */
export function treeLogs(dim, base, max = 96) {
  const seen = new Set();
  const out = [];
  const stack = [base];
  while (stack.length && out.length < max) {
    const p = stack.pop();
    const k = `${p.x},${p.y},${p.z}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const b = dim.getBlock(p);
    if (!b || !isLog(b.typeId)) continue;
    out.push({ ...p, t: b.typeId });
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = 0; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) if (dx || dy || dz) stack.push({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
  }
  return out.sort((a, b) => a.y - b.y);
}

/** Bloco de chão mais alto na coluna (x,z), procurando a partir de y para baixo/cima. */
export function groundAt(dim, x, z, nearY) {
  const sf = solidFn(dim);
  for (let dy = 6; dy >= -12; dy--) {
    const y = Math.floor(nearY) + dy;
    if (sf(x, y - 1, z) === 1 && sf(x, y, z) === 0 && sf(x, y + 1, z) === 0) return y;
  }
  return Math.floor(nearY);
}

/** Lugar para ficar em pé ao lado de um alvo. */
export function standNear(dim, target) {
  const sf = solidFn(dim);
  const cand = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  for (const [dx, dz] of cand) {
    const x = Math.floor(target.x) + dx, z = Math.floor(target.z) + dz;
    for (let dy = 1; dy >= -3; dy--) {
      const y = Math.floor(target.y) + dy;
      if (sf(x, y - 1, z) === 1 && sf(x, y, z) === 0 && sf(x, y + 1, z) === 0) return { x, y, z };
    }
  }
  return undefined;
}

export function collectDrops(dim, loc, entity, radius = 4) {
  let n = 0;
  try {
    const items = dim.getEntities({ location: loc, maxDistance: radius, type: "minecraft:item" });
    const inv = entity.getComponent("minecraft:inventory")?.container;
    for (const it of items) {
      const stack = it.getComponent("minecraft:item")?.itemStack;
      if (!stack || !inv) continue;
      const left = inv.addItem(stack);
      if (!left) {
        n += stack.amount;
        it.remove();
      }
    }
  } catch {
    /* */
  }
  return n;
}
