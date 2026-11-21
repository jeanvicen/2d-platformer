// Modo criativo do Hacknd: itens infinitos (ele "materializa" qualquer item do jogo), kits
// encantados que te deixam mais forte e efeitos de suporte. Tudo vira item real no inventário.
import { EnchantmentType, ItemStack, ItemTypes } from "@minecraft/server";
import { representative } from "../lib/recipes.js";
import * as inv from "./inventory.js";
import { particle, sound } from "./anim.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

export const isCreative = (c) => !!c?.def?.creative;

const TIERS = ["wooden", "stone", "iron", "golden", "diamond", "netherite"];

/** Item concreto para um alvo do planejador ({id}|{group}|{toolKind,tier}|"id"). */
export function concreteId(target) {
  if (typeof target === "string") return target;
  if (target?.toolKind) {
    const tier = TIERS.includes(target.tier) && target.tier !== "wooden" ? target.tier : "netherite";
    return `minecraft:${tier}_${target.toolKind}`;
  }
  if (target?.id) return target.id;
  if (target?.group === "food") return "minecraft:cooked_beef";
  if (target?.group) return representative({ group: target.group });
  return undefined;
}

/** Faz aparecer `count` itens no inventário dele (com brilho). Retorna true se deu certo. */
export function materialize(c, target, count = 1) {
  const id = concreteId(target);
  if (!id || !ItemTypes.get(id)) return false;
  const have = inv.count(c, typeof target === "object" && !target.toolKind ? target : id);
  const need = Math.max(0, count - have);
  if (need > 0) {
    inv.addId(c, id, need);
    const p = c.pos();
    particle(c.dim(), "lila:build", { x: p.x, y: p.y + 0.6, z: p.z });
  }
  return true;
}

/** Procura um item pelo texto (id em inglês, com ou sem minecraft:). */
export function findItemType(text) {
  const q = String(text ?? "").toLowerCase().trim().replace(/\s+/g, "_");
  if (!q) return undefined;
  const direct = ItemTypes.get(q.includes(":") ? q : `minecraft:${q}`);
  if (direct) return direct.id;
  const words = q.split("_").filter((w) => w.length > 2);
  let best, bs = 0;
  for (const t of ItemTypes.getAll()) {
    const id = t.id.replace("minecraft:", "");
    let s = 0;
    for (const w of words) if (id.includes(w)) s += w.length;
    if (s > bs || (s === bs && best && id.length < best.length)) {
      bs = s;
      best = t.id;
    }
  }
  return bs > 0 ? best : undefined;
}

function enchanted(id, list, amount = 1) {
  const it = new ItemStack(id, amount);
  try {
    const ench = it.getComponent("minecraft:enchantable");
    for (const [name, lvl] of list) {
      try {
        ench?.addEnchantment({ type: new EnchantmentType(name), level: lvl });
      } catch {
        /* encantamento incompatível nessa versão: ignora */
      }
    }
  } catch (e) {
    logError("creative.enchant", e);
  }
  return it;
}

const ARMOR = ["helmet", "chestplate", "leggings", "boots"];

/**
 * Kit de força: armadura encantada, armas, ferramentas, totens, maçãs. Devolve as pilhas.
 * @param {{armorOnly?:boolean, tier?:string}} o
 */
export function strengthKit(o = {}) {
  const tier = o.tier && TIERS.includes(o.tier) ? o.tier : "netherite";
  const prot = [["protection", 4], ["unbreaking", 3], ["mending", 1]];
  const out = ARMOR.map((p) => enchanted(`minecraft:${tier}_${p}`,
    p === "helmet" ? [...prot, ["respiration", 3], ["aqua_affinity", 1]] : p === "boots" ? [...prot, ["feather_falling", 4], ["depth_strider", 3]] : prot));
  if (o.armorOnly) return out;
  out.push(enchanted("minecraft:netherite_sword", [["sharpness", 5], ["looting", 3], ["fire_aspect", 2], ["unbreaking", 3], ["mending", 1]]));
  out.push(enchanted("minecraft:bow", [["power", 5], ["punch", 2], ["flame", 1], ["infinity", 1], ["unbreaking", 3]]));
  out.push(new ItemStack("minecraft:arrow", 1));
  out.push(enchanted("minecraft:netherite_pickaxe", [["efficiency", 5], ["fortune", 3], ["unbreaking", 3], ["mending", 1]]));
  out.push(enchanted("minecraft:netherite_axe", [["efficiency", 5], ["sharpness", 5], ["unbreaking", 3]]));
  out.push(enchanted("minecraft:shield", [["unbreaking", 3], ["mending", 1]]));
  out.push(new ItemStack("minecraft:totem_of_undying", 1));
  out.push(new ItemStack("minecraft:golden_apple", 16));
  out.push(new ItemStack("minecraft:enchanted_golden_apple", 4));
  out.push(new ItemStack("minecraft:cooked_beef", 32));
  out.push(new ItemStack("minecraft:ender_pearl", 16));
  out.push(enchanted("minecraft:elytra", [["unbreaking", 3], ["mending", 1]]));
  out.push(new ItemStack("minecraft:firework_rocket", 64));
  return out;
}

/** Efeitos de suporte (força, resistência, regeneração...). */
export function buff(player, kind = "battle") {
  const sets = {
    battle: [["strength", 2], ["resistance", 1], ["regeneration", 1], ["speed", 1], ["fire_resistance", 0]],
    heal: [["regeneration", 2], ["absorption", 2], ["instant_health", 1]],
    night: [["night_vision", 0]],
    water: [["water_breathing", 0], ["night_vision", 0]],
    fire: [["fire_resistance", 0]],
    fall: [["slow_falling", 0]],
  };
  for (const [id, amp] of sets[kind] ?? []) {
    try {
      player.addEffect(id, id === "instant_health" ? 1 : 20 * 90, { amplifier: amp, showParticles: false });
    } catch {
      /* efeito inexistente na versão */
    }
  }
  try {
    player.dimension.spawnParticle("lila:sparkle", { x: player.location.x, y: player.location.y + 1, z: player.location.z });
  } catch {
    /* ignore */
  }
}

/** Coloca pilhas direto no inventário do jogador (o que não couber cai no pé dele). */
export function giveStacks(player, stacks) {
  const ct = player.getComponent("minecraft:inventory")?.container;
  let n = 0;
  for (const s of stacks) {
    n += s.amount;
    const left = ct ? ct.addItem(s) : s;
    if (left) {
      try {
        player.dimension.spawnItem(left, player.location);
      } catch {
        /* ignore */
      }
    }
  }
  sound(player, "random.levelup", 0.7, 1.3);
  return n;
}

/** Veste a armadura direto no jogador (troca peça por peça se a nova for melhor). */
export function equipArmor(player, stacks) {
  const eq = player.getComponent("minecraft:equippable");
  const slots = { helmet: "Head", chestplate: "Chest", leggings: "Legs", boots: "Feet" };
  const rest = [];
  for (const s of stacks) {
    const m = /_(helmet|chestplate|leggings|boots)$/.exec(s.typeId);
    if (!m || !eq) {
      rest.push(s);
      continue;
    }
    try {
      const cur = eq.getEquipment(/** @type {any} */ (slots[m[1]]));
      const rank = (id) => TIERS.indexOf(/^minecraft:([a-z]+)_/.exec(id ?? "")?.[1] ?? "") + (id?.includes("chainmail") ? 2.5 : 0);
      if (!cur || rank(cur.typeId) < rank(s.typeId)) {
        if (cur) rest.push(cur);
        eq.setEquipment(/** @type {any} */ (slots[m[1]]), s);
      } else rest.push(s);
    } catch {
      rest.push(s);
    }
  }
  return rest;
}
