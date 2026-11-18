// Perfil individual por player.id, cache em memória + gravação periódica.
import { system } from "@minecraft/server";
import { migrate } from "../lib/profile_schema.js";
import { logError } from "./log.js";
import { readJSON, writeJSON } from "./persistence.js";

const KEY = "eclipse:profile";
/** @type {Map<string, any>} */
const cache = new Map();
const dirty = new Set();

/** @param {import("@minecraft/server").Player} player */
export function getProfile(player) {
  let p = cache.get(player.id);
  if (!p) {
    p = migrate(readJSON(player, KEY, null));
    cache.set(player.id, p);
  }
  return p;
}

export function markDirty(player) {
  dirty.add(player.id);
}

/** @param {import("@minecraft/server").Player} player */
export function saveProfile(player) {
  const p = cache.get(player.id);
  if (!p) return;
  try {
    p.lastSeen = Date.now();
    writeJSON(player, KEY, p);
    dirty.delete(player.id);
  } catch (e) {
    logError("profile.save", e);
  }
}

export function update(player, fn) {
  const p = getProfile(player);
  fn(p);
  markDirty(player);
  return p;
}

/** Grava perfis "sujos" — chamado pelo agendador e em eventos importantes. */
export function flushProfiles(players) {
  for (const pl of players) {
    if (dirty.has(pl.id)) saveProfile(pl);
  }
}

export function dropFromCache(playerId) {
  cache.delete(playerId);
  dirty.delete(playerId);
}

export function cachedProfiles() {
  return cache;
}

/** Salva imediatamente no próximo tick (fora de contexto restrito). */
export function saveSoon(player) {
  markDirty(player);
  system.run(() => {
    try {
      if (player.isValid) saveProfile(player);
    } catch (e) {
      logError("profile.saveSoon", e);
    }
  });
}
