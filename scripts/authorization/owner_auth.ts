/**
 * OWNER AUTHORIZATION SYSTEM.
 *  - The owner is identified by the persistent `player.id` recorded at summon time
 *    (never by the display name, which can be changed or spoofed).
 *  - Every entry point (commands, menus, interaction, item transfers, external AI plans)
 *    calls isOwner() before doing anything.
 *  - Ownership is never transferred automatically; the external AI cannot change it.
 */
import type { Entity, Player } from "@minecraft/server";
import { DP_OWNER } from "../core/constants";
import { safe } from "../core/mc";
import type { Agent } from "../ai/agent";

export function isOwner(player: Player | undefined, a: Agent): boolean {
  if (!player) return false;
  const pid = safe(() => player.id, "");
  return pid !== "" && pid === a.record.ownerId;
}

/** Owner id stored on a body (used when the agent is not loaded yet). */
export function bodyOwnerId(e: Entity): string | undefined {
  return safe(() => e.getDynamicProperty(DP_OWNER) as string | undefined, undefined);
}

export function isOwnerOfBody(player: Player, e: Entity): boolean {
  const o = bodyOwnerId(e);
  return !!o && o === player.id;
}
