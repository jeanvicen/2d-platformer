// Permissões: dono de criaturas/relíquias e administração.
import { PlayerPermissionLevel } from "@minecraft/server";

/** @param {import("@minecraft/server").Player} player */
export function isAdmin(player) {
  try {
    if (player.hasTag("eclipse_admin")) return true;
    return player.playerPermissionLevel >= PlayerPermissionLevel.Operator;
  } catch {
    return false;
  }
}

/** @param {import("@minecraft/server").Entity} entity */
export function ownerOf(entity) {
  try {
    const v = entity.getDynamicProperty("eclipse:owner");
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

export function isOwner(player, entity) {
  return ownerOf(entity) === player.id;
}

/** Jogadores podem comandar apenas o que é seu (admins podem tudo). */
export function canCommand(player, entity) {
  return isOwner(player, entity) || isAdmin(player);
}
