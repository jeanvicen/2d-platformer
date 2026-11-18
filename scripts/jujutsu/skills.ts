/**
 * Power buttons in the hotbar: every castable ability of the player's set becomes an item.
 * Tap the slot and use it: the ability fires, and the item shows the cooldown overlay.
 * Kit items are locked to the inventory (cannot be dropped) and kept on death.
 */
import { ItemLockMode, ItemStack, Player } from "@minecraft/server";
import { safe } from "../core/mc";
import { ABILITIES } from "./clans";
import { abilitiesFor, blocked, cast } from "./abilities";
import { sorcerer, summonDivineDogs } from "./sorcerer";
import { openShikigamiList } from "./seal_menu";

export const SKILL_PREFIX = "shadowbound:skill_";
/** Extra buttons that are not abilities. */
export const EXTRA_SKILLS: Record<string, { name: string; icon: string; tech: string }> = {
  caes_divinos: { name: "Invocar Cães Divinos", icon: "dogs", tech: "ten_shadows" },
  shikigamis: { name: "Shikigamis", icon: "summon", tech: "ten_shadows" },
};

export function isSkillItem(id: string | undefined): boolean {
  return !!id && id.startsWith(SKILL_PREFIX);
}

/** Abilities that get a hotbar button for this player right now. */
export function kitFor(pid: string): string[] {
  const r = sorcerer(pid);
  const ids = abilitiesFor(r).filter((a) => a.kind !== "passiva" && a.id !== "guardar" && !blocked(r, a)).map((a) => a.id);
  for (const [id, x] of Object.entries(EXTRA_SKILLS)) if (r.tech === x.tech) ids.unshift(id);
  return ids;
}

function inventory(p: Player) {
  return safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
}

/** Give missing buttons, remove buttons that no longer belong to the player (e.g. after a new clan). */
export function syncKit(p: Player): number {
  const cont = inventory(p);
  if (!cont) return 0;
  const want = new Set(kitFor(p.id));
  const have = new Set<string>();
  for (let i = 0; i < cont.size; i++) {
    const st = safe(() => cont.getItem(i), undefined);
    if (!st || !isSkillItem(st.typeId)) continue;
    const id = st.typeId.slice(SKILL_PREFIX.length);
    if (!want.has(id) || have.has(id)) safe(() => cont.setItem(i, undefined), undefined);
    else have.add(id);
  }
  let added = 0;
  for (const id of want) {
    if (have.has(id)) continue;
    const st = safe(() => new ItemStack(SKILL_PREFIX + id, 1), undefined);
    if (!st) continue;
    safe(() => (st.lockMode = ItemLockMode.inventory), undefined);
    safe(() => (st.keepOnDeath = true), undefined);
    const left = safe(() => cont.addItem(st), st);
    if (!left) added++;
  }
  return added;
}

/** A power button was used. */
export function onSkillUse(p: Player, stack: ItemStack): void {
  const id = stack.typeId.slice(SKILL_PREFIX.length);
  let ok = false;
  if (id === "caes_divinos") ok = summonDivineDogs(p).some((x) => x === "spawned");
  else if (id === "shikigamis") {
    openShikigamiList(p);
    return;
  } else if (ABILITIES[id]) ok = cast(p, id);
  if (ok) safe(() => stack.getComponent("minecraft:cooldown")?.startCooldown(p), undefined);
}
