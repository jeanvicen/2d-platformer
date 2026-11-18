// Recargas por jogador (em ticks), mantidas em memória (não precisam sobreviver ao reinício).
import { system } from "@minecraft/server";
import { formatTicks } from "./util.js";

/** @type {Map<string, Map<string, number>>} */
const store = new Map();

export function ready(player, key) {
  const m = store.get(player.id);
  if (!m) return true;
  return (m.get(key) ?? 0) <= system.currentTick;
}

export function remaining(player, key) {
  const m = store.get(player.id);
  if (!m) return 0;
  return Math.max(0, (m.get(key) ?? 0) - system.currentTick);
}

export function start(player, key, ticks) {
  let m = store.get(player.id);
  if (!m) store.set(player.id, (m = new Map()));
  m.set(key, system.currentTick + ticks);
}

/** Tenta usar: se pronto, inicia a recarga e retorna true; senão avisa e retorna false. */
export function tryUse(player, key, ticks, label) {
  if (!ready(player, key)) {
    try {
      player.onScreenDisplay.setActionBar(`§7${label ?? "Habilidade"} em recarga: §f${formatTicks(remaining(player, key))}`);
    } catch {
      /* jogador pode ter saído */
    }
    return false;
  }
  start(player, key, ticks);
  return true;
}

export function clearPlayer(playerId) {
  store.delete(playerId);
}
