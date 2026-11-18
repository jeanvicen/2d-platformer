/**
 * Visual overlays worn in the helmet slot (they look painted on the face):
 * Sukuna's markings while he controls the body, and the glowing Six Eyes for Gojo's techniques.
 * The helmet the player was wearing is saved in the world record and put back afterwards.
 * Overlay items are locked in their slot and kept on death, so they never end up in a chest.
 */
import { EquipmentSlot, ItemLockMode, ItemStack, Player } from "@minecraft/server";
import { particle, safe, toStack, toStored } from "../core/mc";
import { saveSorcerer, sorcerer } from "./sorcerer";
import { head, look } from "./fx";

export const OVERLAY_ITEMS = { marks: "shadowbound:sukuna_marks", eyes: "shadowbound:six_eyes" } as const;
export type OverlayKind = keyof typeof OVERLAY_ITEMS;
const OVERLAY_IDS = Object.values(OVERLAY_ITEMS) as string[];

function equip(p: Player) {
  return safe(() => p.getComponent("minecraft:equippable"), undefined);
}

export function currentOverlay(p: Player): OverlayKind | undefined {
  const st = safe(() => equip(p)?.getEquipment(EquipmentSlot.Head), undefined);
  if (!st) return undefined;
  return (Object.keys(OVERLAY_ITEMS) as OverlayKind[]).find((k) => OVERLAY_ITEMS[k] === st.typeId);
}

/** Show an overlay (or none). Cheap when nothing changes. */
export function setOverlay(p: Player, kind: OverlayKind | undefined): void {
  const eq = equip(p);
  if (!eq) return;
  const now = currentOverlay(p);
  if (now === kind) return;
  const r = sorcerer(p.id);
  if (kind) {
    if (!now) {
      const helmet = safe(() => eq.getEquipment(EquipmentSlot.Head), undefined);
      r.savedHelmet = helmet ? toStored(helmet) : null;
    }
    const st = safe(() => new ItemStack(OVERLAY_ITEMS[kind], 1), undefined);
    if (!st) return;
    safe(() => (st.lockMode = ItemLockMode.slot), undefined);
    safe(() => (st.keepOnDeath = true), undefined);
    safe(() => eq.setEquipment(EquipmentSlot.Head, st), false);
  } else {
    const back = r.savedHelmet ? toStack(r.savedHelmet) : undefined;
    safe(() => eq.setEquipment(EquipmentSlot.Head, back), false);
    r.savedHelmet = undefined;
  }
  saveSorcerer(p.id);
}

/** Overlay items must never leave the head slot: clean strays from the inventory. */
export function cleanStrayOverlays(p: Player): void {
  const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
  if (!cont) return;
  for (let i = 0; i < cont.size; i++) {
    const st = safe(() => cont.getItem(i), undefined);
    if (st && OVERLAY_IDS.includes(st.typeId)) safe(() => cont.setItem(i, undefined), undefined);
  }
}

/** Glow particles in front of the eyes while the Six Eyes overlay is on. */
export function eyeGlow(p: Player): void {
  const h = head(p);
  const v = look(p);
  const side = { x: -v.z, z: v.x };
  for (const s of [-0.12, 0.12]) {
    particle(p.dimension, "shadowbound:sparkle", { x: h.x + v.x * 0.35 + side.x * s, y: h.y + 0.05, z: h.z + v.z * 0.35 + side.z * s }, { red: 0.45, green: 0.85, blue: 1 });
  }
}
