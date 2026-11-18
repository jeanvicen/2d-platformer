// Helpers de inventário e itens.
import { EntityComponentTypes, EquipmentSlot, ItemLockMode, ItemStack } from "@minecraft/server";
import { logError } from "./log.js";

/** @param {import("@minecraft/server").Entity} entity */
export function container(entity) {
  try {
    const inv = entity.getComponent(EntityComponentTypes.Inventory);
    return inv?.container;
  } catch {
    return undefined;
  }
}

/** @param {import("@minecraft/server").Player} player */
export function equippable(player) {
  try {
    return player.getComponent(EntityComponentTypes.Equippable);
  } catch {
    return undefined;
  }
}

export function chestItem(player) {
  return equippable(player)?.getEquipment(EquipmentSlot.Chest);
}

export function mainhand(player) {
  return equippable(player)?.getEquipment(EquipmentSlot.Mainhand);
}

export function makeItem(id, opts = {}) {
  const it = new ItemStack(id, opts.amount ?? 1);
  if (opts.name) it.nameTag = opts.name;
  if (opts.lore) it.setLore(opts.lore);
  if (opts.lock) it.lockMode = opts.lock === "slot" ? ItemLockMode.slot : ItemLockMode.inventory;
  if (opts.keep) it.keepOnDeath = true;
  if (opts.props) {
    for (const [k, v] of Object.entries(opts.props)) it.setDynamicProperty(k, v);
  }
  return it;
}

/** Entrega um item; se o inventário estiver cheio, larga aos pés do jogador. */
export function give(player, itemStack) {
  try {
    const c = container(player);
    const left = c ? c.addItem(itemStack) : itemStack;
    if (left) player.dimension.spawnItem(left, player.location);
    return true;
  } catch (e) {
    logError("items.give", e);
    return false;
  }
}

export function hasItem(entity, typeId) {
  const c = container(entity);
  if (!c) return false;
  for (let i = 0; i < c.size; i++) if (c.getItem(i)?.typeId === typeId) return true;
  if (entity.typeId === "minecraft:player") {
    const eq = equippable(/** @type {any} */ (entity));
    for (const s of [EquipmentSlot.Chest, EquipmentSlot.Offhand]) if (eq?.getEquipment(s)?.typeId === typeId) return true;
  }
  return false;
}

export function countItem(entity, typeId) {
  const c = container(entity);
  if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it?.typeId === typeId) n += it.amount;
  }
  return n;
}

/** Remove até `amount` unidades; retorna quantas removeu. */
export function takeItem(entity, typeId, amount) {
  const c = container(entity);
  if (!c) return 0;
  let left = amount;
  for (let i = 0; i < c.size && left > 0; i++) {
    const it = c.getItem(i);
    if (it?.typeId !== typeId) continue;
    const n = Math.min(left, it.amount);
    if (it.amount - n <= 0) c.setItem(i, undefined);
    else {
      it.amount -= n;
      c.setItem(i, it);
    }
    left -= n;
  }
  return amount - left;
}

/** Procura no inventário um item com uma dynamic property específica. */
export function findSlotByProp(entity, typeId, prop, value) {
  const c = container(entity);
  if (!c) return -1;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it?.typeId === typeId && it.getDynamicProperty(prop) === value) return i;
  }
  return -1;
}

/** Lista resumida {typeId: total} de um contêiner. */
export function summarize(entity) {
  const c = container(entity);
  const out = {};
  if (!c) return out;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it) out[it.typeId] = (out[it.typeId] ?? 0) + it.amount;
  }
  return out;
}

export function prettyItem(typeId) {
  const id = typeId.replace(/^minecraft:/, "").replace(/^eclipse:/, "");
  return id.replace(/_/g, " ");
}
