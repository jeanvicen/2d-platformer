// InventoryService: o inventário privado da Lila (36 espaços reais da entidade).
// Itens reais: o que ela coleta, fabrica, gasta, entrega ou guarda passa sempre por aqui.
import { ItemStack } from "@minecraft/server";
import { FOOD, TIER_RANK, isFood, toolInfo } from "../lib/items.js";
import { matchesNeed } from "../lib/recipes.js";
import { logError } from "../core/log.js";

/** @param {import("./companion.js").Companion} c */
export function container(c) {
  try {
    return c.entity?.getComponent("minecraft:inventory")?.container;
  } catch {
    return undefined;
  }
}

/** Predicado para um alvo {id}|{group}|{toolKind} ou Need da receita. */
export function matcher(t) {
  if (typeof t === "string") return (id) => id === t;
  if (t.toolKind) return (id) => toolInfo(id)?.kind === t.toolKind;
  if (t.group === "food") return (id) => isFood(id);
  if (t.group) return (id) => matchesNeed({ group: t.group, n: 1 }, id);
  return (id) => id === t.id;
}

/** Quantidade de itens que satisfazem o alvo. */
export function count(c, t) {
  const inv = container(c);
  if (!inv) return 0;
  const m = matcher(t);
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it && m(it.typeId)) n += it.amount;
  }
  return n;
}

/** Resumo {typeId: quantidade}. */
export function summary(c) {
  const inv = container(c);
  const out = {};
  if (!inv) return out;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it) out[it.typeId] = (out[it.typeId] ?? 0) + it.amount;
  }
  return out;
}

export function freeSlots(c) {
  return container(c)?.emptySlotsCount ?? 0;
}

/**
 * Adiciona itens. Se faltar espaço, descarta o que vale menos (terra, pedregulho excedente)
 * e, em último caso, deixa o excedente no chão ao lado dela.
 * @param {import("./companion.js").Companion} c
 * @param {ItemStack} stack
 */
export function add(c, stack) {
  const inv = container(c);
  if (!inv || !stack) return stack;
  let left = inv.addItem(stack);
  if (left && makeRoom(c, left.typeId)) left = inv.addItem(left);
  if (left && c.entity?.isValid) {
    try {
      c.entity.dimension.spawnItem(left, c.entity.location);
    } catch (e) {
      logError("inv.overflow", e);
    }
  }
  return left;
}

export function addId(c, id, n = 1) {
  let rest = n;
  while (rest > 0) {
    const k = Math.min(rest, maxStack(id));
    add(c, new ItemStack(id, k));
    rest -= k;
  }
}

function maxStack(id) {
  try {
    return new ItemStack(id, 1).maxAmount;
  } catch {
    return 64;
  }
}

const JUNK = ["minecraft:dirt", "minecraft:gravel", "minecraft:granite", "minecraft:diorite", "minecraft:andesite", "minecraft:tuff",
  "minecraft:netherrack", "minecraft:rotten_flesh", "minecraft:poisonous_potato", "minecraft:wheat_seeds", "minecraft:cobbled_deepslate",
  "minecraft:cobblestone", "minecraft:sand", "minecraft:stick"];

/** Libera um espaço jogando fora o lixo menos útil (como uma jogadora faria). */
function makeRoom(c, incomingId) {
  const inv = container(c);
  if (!inv) return false;
  for (const junk of JUNK) {
    if (junk === incomingId) continue;
    const total = count(c, junk);
    // mantém um estoque mínimo de blocos úteis para pontes e pilares
    if (junk === "minecraft:cobblestone" && total <= 64) continue;
    if (junk === "minecraft:dirt" && total <= 32 && count(c, "minecraft:cobblestone") < 32) continue;
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it?.typeId === junk) {
        inv.setItem(i, undefined);
        return true;
      }
    }
  }
  return false;
}

/**
 * Remove até n itens que satisfazem o alvo. Retorna quantos removeu.
 */
export function take(c, t, n) {
  const inv = container(c);
  if (!inv || n <= 0) return 0;
  const m = matcher(t);
  let left = n;
  for (let i = inv.size - 1; i >= 0 && left > 0; i--) {
    const it = inv.getItem(i);
    if (!it || !m(it.typeId)) continue;
    const k = Math.min(left, it.amount);
    if (k === it.amount) inv.setItem(i, undefined);
    else {
      it.amount -= k;
      inv.setItem(i, it);
    }
    left -= k;
  }
  return n - left;
}

/** Retira pilhas (com dados: durabilidade, encantamentos) para entregar ao jogador. */
export function takeStacks(c, t, n = Infinity) {
  const inv = container(c);
  const out = [];
  if (!inv) return out;
  const m = matcher(t);
  let left = n;
  for (let i = 0; i < inv.size && left > 0; i++) {
    const it = inv.getItem(i);
    if (!it || !m(it.typeId)) continue;
    if (it.amount <= left) {
      out.push(it);
      inv.setItem(i, undefined);
      left -= it.amount;
    } else {
      const part = it.clone();
      part.amount = left;
      it.amount -= left;
      inv.setItem(i, it);
      out.push(part);
      left = 0;
    }
  }
  return out;
}

/** Melhor ferramenta de um tipo: {slot, id, tier}. */
export function bestTool(c, kind) {
  const inv = container(c);
  if (!inv) return undefined;
  let best;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    const t = it && toolInfo(it.typeId);
    if (!t || t.kind !== kind) continue;
    if (!best || TIER_RANK[t.tier] > TIER_RANK[best.tier]) best = { slot: i, id: it.typeId, tier: t.tier, kind };
  }
  return best;
}

export function toolTier(c, kind) {
  return bestTool(c, kind)?.tier ?? "none";
}

/** Desgasta a ferramenta (durabilidade real). Retorna false se quebrou. */
export function wearTool(c, slot, amount = 1) {
  const inv = container(c);
  if (!inv) return true;
  const it = inv.getItem(slot);
  if (!it) return false;
  try {
    const d = it.getComponent("minecraft:durability");
    if (!d) return true;
    // inquebrável (encantamento) é respeitado pelo próprio jogo na quebra; aqui aplicamos 1 por uso
    if (d.damage + amount >= d.maxDurability) {
      inv.setItem(slot, undefined);
      return false;
    }
    d.damage += amount;
    inv.setItem(slot, it);
  } catch (e) {
    logError("inv.wear", e);
  }
  return true;
}

/** Melhor comida disponível (mais nutritiva primeiro, evitando cru quando houver opção). */
export function bestFood(c) {
  const s = summary(c);
  let best, bv = -1;
  for (const [id, n] of Object.entries(s)) {
    if (!n || !isFood(id)) continue;
    let v = FOOD[id];
    if (/^minecraft:(beef|porkchop|mutton|chicken|rabbit|cod|salmon)$/.test(id)) v -= 4;
    if (id === "minecraft:golden_apple") v -= 10; // guarda para emergências
    if (v > bv) {
      bv = v;
      best = id;
    }
  }
  return best;
}

export function foodPoints(c) {
  const s = summary(c);
  let n = 0;
  for (const [id, k] of Object.entries(s)) if (isFood(id)) n += FOOD[id] * k;
  return n;
}

/** Blocos de construção baratos para pontes/pilares (o que ela tiver sobrando). */
export function scaffoldBlock(c) {
  for (const id of ["minecraft:dirt", "minecraft:cobblestone", "minecraft:cobbled_deepslate", "minecraft:netherrack",
    "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff", "minecraft:sand"]) {
    if (count(c, id) > 0) return id;
  }
  return undefined;
}

export function totalItems(c) {
  return Object.values(summary(c)).reduce((a, b) => a + b, 0);
}
