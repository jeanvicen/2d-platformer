// Ações sobre blocos (quebrar, colocar, coletar drops) com tempo, som, animação e regras reais.
import { BlockPermutation, ItemStack, system } from "@minecraft/server";
import { breakTicks, canHarvest, isAirId, isNatural, requiredTier, toolFor, TIER_RANK, CROPS } from "../lib/items.js";
import { NeedTool } from "./companion.js";
import { blockAt, safeState } from "./world.js";
import * as inv from "./inventory.js";
import { digSound, hold, setAction, sound } from "./anim.js";
import { logError } from "../core/log.js";

const PROTECTED = /bedrock|barrier|command_block|structure_block|jigsaw|end_portal|portal|spawner|reinforced_deepslate|border_block|allow|deny|light_block/;
const STORAGE = /chest|barrel|furnace|smoker|blast_furnace|hopper|dispenser|dropper|shulker_box|brewing_stand|bed|crafting_table|anvil|enchanting_table|lectern|beacon|sign|banner|door|bell/;

export const keyOf = (p, dimId = "") => `${dimId}|${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;

/** Ela pode quebrar este bloco? Natural, colocado por ela, ou planta madura. Nunca construções do jogador. */
export function canBreak(c, dim, p, id) {
  if (!id || isAirId(id) || PROTECTED.test(id)) return false;
  if (c.rec.placed.includes(keyOf(p, dim.id))) return true;
  if (STORAGE.test(id)) return false;
  return isNatural(id) || id in CROPS;
}

export function markPlaced(c, p, dimId) {
  const k = keyOf(p, dimId);
  if (!c.rec.placed.includes(k)) {
    c.rec.placed.push(k);
    if (c.rec.placed.length > 600) c.rec.placed.shift();
  }
}

export function unmarkPlaced(c, p, dimId) {
  const k = keyOf(p, dimId);
  const i = c.rec.placed.indexOf(k);
  if (i >= 0) c.rec.placed.splice(i, 1);
}

/** Lava ou fogo encostado no bloco? (minerar ali soltaria lava em cima dela) */
export function lavaNear(dim, p) {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
    const b = blockAt(dim, p.x + dx, p.y + dy, p.z + dz);
    if (b && /lava/.test(b.typeId)) return true;
  }
  return false;
}

/** Olha para um ponto (vira o corpo e a cabeça). */
export function face(c, p) {
  const e = c.entity;
  if (!e?.isValid) return;
  const l = e.location;
  const dx = p.x + 0.5 - l.x, dz = p.z + 0.5 - l.z;
  if (Math.abs(dx) + Math.abs(dz) < 0.05) return;
  const yaw = (-Math.atan2(dx, dz) * 180) / Math.PI;
  try {
    e.setRotation({ x: 0, y: yaw });
  } catch {
    /* ignore */
  }
}

/** Equipa (visualmente) a melhor ferramenta para o bloco. Retorna info da ferramenta. */
export function equipFor(c, id) {
  const kind = toolFor(id);
  const t = kind === "none" ? undefined : inv.bestTool(c, kind);
  hold(c.entity, t ? t.id : "air");
  return t;
}

/**
 * Quebra um bloco ao alcance (sem andar). Gera drops reais do jogo e coleta.
 * @param {import("./companion.js").Companion} c
 * @param {{x:number,y:number,z:number}} p
 * @param {{strict?:boolean, collect?:boolean}} o strict: exige ferramenta certa (lança NeedTool)
 */
export function* quickBreak(c, p, o = {}) {
  const dim = c.dim();
  const b = blockAt(dim, p.x, p.y, p.z);
  if (!b || b.isAir) return true;
  const id = b.typeId;
  if (b.isLiquid) return true;
  if (!canBreak(c, dim, p, id)) return false;
  const tool = equipFor(c, id);
  const tinfo = tool ? { kind: tool.kind, tier: tool.tier } : undefined;
  if (o.strict !== false && !canHarvest(id, tinfo)) throw new NeedTool("pickaxe", requiredTier(id));
  face(c, p);
  const kind = toolFor(id);
  setAction(c.entity, kind === "axe" ? "chop" : kind === "shovel" || kind === "hoe" || kind === "none" ? (p.y < c.pos().y ? "dig" : "mine") : "mine");
  const ticks = breakTicks(id, tinfo, c.def?.mineSpeed ?? 1.6);
  const snd = digSound(id);
  for (let t = 0; t < ticks; t++) {
    if (t % 4 === 0) sound(c.entity, snd, 0.5, 0.8);
    yield 1;
    if (!c.alive()) return false;
    const now = blockAt(dim, p.x, p.y, p.z);
    if (!now || now.typeId !== id) break; // alguém já quebrou
  }
  try {
    const cur = blockAt(dim, p.x, p.y, p.z);
    if (cur && cur.typeId === id) dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`);
  } catch (e) {
    logError("blocks.break", e);
    try {
      dim.setBlockType(p, "minecraft:air");
    } catch {
      /* ignore */
    }
  }
  unmarkPlaced(c, p, dim.id);
  c.rec.stats.blocks++;
  if (tool) inv.wearTool(c, tool.slot, 1);
  setAction(c.entity, "idle");
  if (o.collect !== false) {
    yield 2;
    collectDrops(c, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 }, 2.6);
  }
  return true;
}

/** Itens que o jogador largou de propósito para ela não pegar de volta (id -> tick). */
export const IGNORE_ITEMS = new Map();

/** Recolhe itens do chão perto de um ponto (como uma jogadora passando por cima). */
export function collectDrops(c, center, r = 2.5) {
  if (!c.alive()) return 0;
  let n = 0;
  try {
    const list = c.dim().getEntities({ type: "minecraft:item", location: center, maxDistance: r });
    for (const it of list) {
      if (IGNORE_ITEMS.has(it.id)) continue;
      const comp = it.getComponent("minecraft:item");
      const stack = comp?.itemStack;
      if (!stack) continue;
      const left = inv.container(c)?.addItem(stack);
      if (left) {
        if (left.amount === stack.amount) continue;
      }
      n += stack.amount - (left?.amount ?? 0);
      it.remove();
      if (left) c.dim().spawnItem(left, center);
    }
    if (n) sound(c.entity, "random.pop", 0.4, 1.4 + Math.random() * 0.4);
  } catch (e) {
    logError("blocks.collect", e);
  }
  return n;
}

export function cleanupIgnored() {
  const now = system.currentTick;
  for (const [k, t] of IGNORE_ITEMS) if (now - t > 2400) IGNORE_ITEMS.delete(k);
}

/**
 * Coloca um bloco gastando o item do inventário (ao alcance, sem andar).
 * @param {string} blockId
 * @param {string|null} itemId item consumido (null = nenhum)
 * @param {Record<string, any>} [states]
 */
export function* placeAt(c, p, blockId, itemId, states) {
  const dim = c.dim();
  const b = blockAt(dim, p.x, p.y, p.z);
  if (!b) return false;
  if (!b.isAir && !b.isLiquid && !/short_grass|tall_grass|fern|snow_layer|flower|deadbush|dead_bush|bush|leaf_litter|petals/.test(b.typeId)) {
    if (b.typeId === blockId) return true;
    return false;
  }
  if (itemId && inv.take(c, itemId, 1) < 1) return false;
  face(c, p);
  if (itemId) hold(c.entity, itemId);
  setAction(c.entity, "place");
  yield 3;
  try {
    const perm = BlockPermutation.resolve(blockId, states ?? {});
    const blk = blockAt(dim, p.x, p.y, p.z);
    blk?.setPermutation(perm);
    markPlaced(c, p, dim.id);
    sound(c.entity, digSound(blockId).replace("dig.", "use."), 0.7, 0.9);
  } catch (e) {
    logError("blocks.place", `${blockId}: ${e}`);
    if (itemId) inv.addId(c, itemId, 1);
    setAction(c.entity, "idle");
    return false;
  }
  yield 2;
  setAction(c.entity, "idle");
  return true;
}

/** Colhe uma planta madura e replanta (não estraga a plantação). */
export function* harvestCrop(c, p) {
  const dim = c.dim();
  const b = blockAt(dim, p.x, p.y, p.z);
  if (!b) return false;
  const info = CROPS[b.typeId];
  if (!info) return false;
  const age = safeState(b, info.state);
  if (typeof age === "number" && age < info.ripe) return false;
  face(c, p);
  setAction(c.entity, "farm");
  yield 8;
  try {
    dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`);
  } catch (e) {
    logError("blocks.harvest", e);
  }
  yield 2;
  collectDrops(c, { x: p.x + 0.5, y: p.y + 0.3, z: p.z + 0.5 }, 2.2);
  // replanta se tiver semente
  if (inv.count(c, info.seed) > 0) {
    const below = blockAt(dim, p.x, p.y - 1, p.z);
    if (below?.typeId === "minecraft:farmland") {
      inv.take(c, info.seed, 1);
      try {
        blockAt(dim, p.x, p.y, p.z)?.setPermutation(BlockPermutation.resolve(b.typeId, { [info.state]: 0 }));
      } catch (e) {
        logError("blocks.replant", e);
      }
    }
  }
  setAction(c.entity, "idle");
  return true;
}

/** Arbusto de frutas: colhe sem quebrar (como o jogador faz com a mão). */
export function* pickBerries(c, p) {
  const dim = c.dim();
  const b = blockAt(dim, p.x, p.y, p.z);
  if (b?.typeId !== "minecraft:sweet_berry_bush") return false;
  const g = safeState(b, "growth");
  if (typeof g !== "number" || g < 2) return false;
  face(c, p);
  setAction(c.entity, "farm");
  yield 6;
  try {
    b.setPermutation(BlockPermutation.resolve("minecraft:sweet_berry_bush", { growth: 1 }));
    inv.add(c, new ItemStack("minecraft:sweet_berries", g >= 3 ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2)));
    sound(c.entity, "block.sweet_berry_bush.pick", 0.8, 1);
  } catch (e) {
    logError("blocks.berries", e);
  }
  setAction(c.entity, "idle");
  return true;
}

export { TIER_RANK };
