/**
 * Inventory Manager - equipment handlers by category (tools, weapons, armor, shield).
 * Logical equipment lives in the record; the body only shows a visual copy whose
 * drop chance is 0 (see entity JSON), so death can never duplicate it.
 */
import { EquipmentSlot } from "@minecraft/server";
import type { Agent } from "../ai/agent";
import { maxDurability, safe, toStack } from "../core/mc";
import type { EquipSlot, StoredItem } from "../core/types";
import { armorInfo, TIER_LEVEL, toolInfo, weaponDamage, type ToolKind } from "./item_catalog";

const SLOT_MAP: Record<EquipSlot, EquipmentSlot> = {
  mainhand: EquipmentSlot.Mainhand,
  offhand: EquipmentSlot.Offhand,
  head: EquipmentSlot.Head,
  chest: EquipmentSlot.Chest,
  legs: EquipmentSlot.Legs,
  feet: EquipmentSlot.Feet,
};
const CMD_SLOT: Record<EquipSlot, string> = {
  mainhand: "slot.weapon.mainhand",
  offhand: "slot.weapon.offhand",
  head: "slot.armor.head",
  chest: "slot.armor.chest",
  legs: "slot.armor.legs",
  feet: "slot.armor.feet",
};

function toolScore(s: StoredItem, kind: ToolKind): number {
  const t = toolInfo(s.id);
  if (!t || t.kind !== kind) return -1;
  const max = maxDurability(s.id) || 1;
  const left = max - (s.dmg ?? 0);
  if (left <= 1) return -1;
  return (t.tier ? TIER_LEVEL[t.tier] * 10 : 5) + left / max;
}

/** Equip the best tool of a kind (moving it from the inventory); returns its id or undefined. */
export function equipBestTool(a: Agent, kind: ToolKind): string | undefined {
  const cur = a.record.equipment.mainhand;
  let best: { s: StoredItem; score: number; fromInv: boolean } | undefined;
  if (cur) {
    const sc = toolScore(cur, kind);
    if (sc >= 0) best = { s: cur, score: sc, fromInv: false };
  }
  for (const s of a.inv.slots) {
    const sc = toolScore(s, kind);
    if (sc >= 0 && (!best || sc > best.score)) best = { s, score: sc, fromInv: true };
  }
  if (!best) return undefined;
  if (best.fromInv) {
    const taken = a.inv.remove((x) => x === best!.s, 1)[0];
    if (!taken) return undefined;
    if (cur) {
      if (a.inv.add(cur) > 0) {
        // no room to put the old one back: undo the swap
        a.inv.add(taken);
        return toolInfo(cur.id)?.kind === kind ? cur.id : undefined;
      }
    }
    a.record.equipment.mainhand = taken;
    a.markDirty();
    refreshVisual(a, "mainhand");
  }
  return a.record.equipment.mainhand?.id;
}

/** Best weapon for combat (swords first, then axes). */
export function equipBestWeapon(a: Agent): void {
  const cur = a.record.equipment.mainhand;
  let best = cur && weaponDamage(cur.id) > 1 ? cur : undefined;
  let bestDmg = best ? weaponDamage(best.id) : 1;
  for (const s of a.inv.slots) {
    const t = toolInfo(s.id);
    if (!t || (t.kind !== "sword" && t.kind !== "axe")) continue;
    const d = weaponDamage(s.id);
    if (d > bestDmg) {
      best = s;
      bestDmg = d;
    }
  }
  if (best && best !== cur) {
    const taken = a.inv.remove((x) => x === best, 1)[0];
    if (!taken) return;
    if (cur && a.inv.add(cur) > 0) {
      a.inv.add(taken);
      return;
    }
    a.record.equipment.mainhand = taken;
    a.markDirty();
    refreshVisual(a, "mainhand");
  }
}

/** Wear the best armor pieces and shield found in the inventory. */
export function equipBestArmor(a: Agent): string[] {
  const changed: string[] = [];
  for (const s of [...a.inv.slots]) {
    const ai = armorInfo(s.id);
    if (!ai) continue;
    const cur = a.record.equipment[ai.slot];
    const curPts = cur ? armorInfo(cur.id)?.points ?? 0 : -1;
    if (ai.points > curPts || (!cur && ai.slot === "offhand")) {
      const taken = a.inv.remove((x) => x === s, 1)[0];
      if (!taken) continue;
      if (cur && a.inv.add(cur) > 0) {
        a.inv.add(taken);
        continue;
      }
      a.record.equipment[ai.slot] = taken;
      changed.push(s.id);
      refreshVisual(a, ai.slot);
    }
  }
  if (changed.length) a.markDirty();
  return changed;
}

export function armorPoints(a: Agent): number {
  let p = 0;
  for (const k of ["head", "chest", "legs", "feet"] as EquipSlot[]) {
    const s = a.record.equipment[k];
    if (s) p += armorInfo(s.id)?.points ?? 0;
  }
  return p;
}

/** Use the main-hand tool once. Returns true if the tool broke. */
export function damageMainhand(a: Agent): boolean {
  const s = a.record.equipment.mainhand;
  if (!s) return false;
  const max = maxDurability(s.id);
  if (!max) return false;
  const unbreaking = s.ench?.find((e) => e.id === "unbreaking")?.lvl ?? 0;
  if (Math.random() >= 1 / (unbreaking + 1)) return false;
  s.dmg = (s.dmg ?? 0) + 1;
  a.markDirty();
  if (s.dmg >= max) {
    a.record.equipment.mainhand = undefined;
    refreshVisual(a, "mainhand");
    return true;
  }
  return false;
}

/** Show the logical equipment on the body (cosmetic copy). */
export function refreshVisual(a: Agent, slot?: EquipSlot): void {
  const e = a.body();
  if (!e) return;
  const slots: EquipSlot[] = slot ? [slot] : ["mainhand", "offhand", "head", "chest", "legs", "feet"];
  const eq = safe(() => e.getComponent("minecraft:equippable"), undefined);
  for (const sl of slots) {
    const item = a.record.equipment[sl];
    const stack = item ? toStack(item, 1) : undefined;
    let ok = false;
    if (eq) ok = safe(() => eq.setEquipment(SLOT_MAP[sl], stack), false);
    if (!ok) {
      const id = item ? item.id : "minecraft:air";
      safe(() => e.runCommand(`replaceitem entity @s ${CMD_SLOT[sl]} 0 ${id}`), undefined);
    }
  }
}

/** Move an equipped item back to the inventory (e.g. when the owner asks for it). */
export function unequip(a: Agent, slot: EquipSlot): boolean {
  const s = a.record.equipment[slot];
  if (!s) return false;
  if (a.inv.add(s) > 0) return false;
  a.record.equipment[slot] = undefined;
  refreshVisual(a, slot);
  a.markDirty();
  return true;
}
