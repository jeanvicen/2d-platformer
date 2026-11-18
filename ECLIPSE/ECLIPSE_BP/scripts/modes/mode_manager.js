// Gerencia Modo/linhagem ativa, técnicas, passivas e a aura.
import { ELEMENT_ORDER, ELEMENTS, MODE_ORDER, MODES } from "../core/config.js";
import { actionbar, particle, playerSound, title } from "../core/fx.js";
import { tryUse } from "../core/cooldowns.js";
import { getProfile, markDirty, saveSoon } from "../core/player_profile.js";
import { effectivePreset, worldConfig } from "../core/world_config.js";
import { system } from "@minecraft/server";
import { ECLIPSE_TECHNIQUES } from "./eclipse_mode.js";
import { GOD_TECHNIQUES } from "./god_mode.js";
import { HAZE_TECHNIQUES } from "./haze_mode.js";
import { effect, healthFrac } from "../abilities/combat.js";

export const TECHNIQUES = { eclipse: ECLIPSE_TECHNIQUES, god: GOD_TECHNIQUES, haze: HAZE_TECHNIQUES };

export function isUnlocked(player, mode, tech) {
  if (worldConfig().unlockAll) return true;
  const m = getProfile(player).modes[mode];
  return m.level >= (tech.level ?? 1) || m.unlocked.includes(tech.key);
}

export function setMode(player, mode) {
  if (!MODES[mode]) return;
  const p = getProfile(player);
  p.mode = mode;
  markDirty(player);
  const M = MODES[mode];
  title(player, `${M.color}§l${M.name.toUpperCase()}`, `§7${M.title}`, 40);
  playerSound(player, "eclipse.transform", 0.8, mode === "god" ? 1.3 : mode === "haze" ? 1.1 : 0.9);
  particle(player.dimension, "eclipse:ring", { x: player.location.x, y: player.location.y + 0.1, z: player.location.z }, { color: M.rgb, radius: 4 });
  saveSoon(player);
}

export function cycleMode(player) {
  const p = getProfile(player);
  setMode(player, MODE_ORDER[(MODE_ORDER.indexOf(p.mode) + 1) % MODE_ORDER.length]);
}

export function currentTechnique(player) {
  const p = getProfile(player);
  const list = TECHNIQUES[p.mode];
  return list[Math.min(list.length - 1, p.technique[p.mode] ?? 0)];
}

export function cycleTechnique(player, step = 1) {
  const p = getProfile(player);
  const list = TECHNIQUES[p.mode];
  let i = ((p.technique[p.mode] ?? 0) + step + list.length) % list.length;
  p.technique[p.mode] = i;
  markDirty(player);
  const t = list[i];
  const M = MODES[p.mode];
  actionbar(player, `${M.color}◆ ${t.name} §7(${i + 1}/${list.length})${isUnlocked(player, p.mode, t) ? "" : " §c[bloqueada]"}`);
  playerSound(player, "eclipse.ui_click", 0.7, 1.2);
}

export function useTechnique(player) {
  const p = getProfile(player);
  const t = currentTechnique(player);
  if (!isUnlocked(player, p.mode, t)) {
    actionbar(player, `§c${t.name} requer nível ${t.level} no modo ${MODES[p.mode].name}.`);
    return;
  }
  if (!tryUse(player, `tech.${p.mode}.${t.key}`, t.cooldown, t.name)) return;
  p.stats.casts++;
  markDirty(player);
  t.run(player);
}

export function cycleElement(player, step = 1) {
  const p = getProfile(player);
  const i = (ELEMENT_ORDER.indexOf(p.element) + step + ELEMENT_ORDER.length) % ELEMENT_ORDER.length;
  p.element = ELEMENT_ORDER[i];
  markDirty(player);
  const e = ELEMENTS[p.element];
  actionbar(player, `${e.color}✦ Elemento: §l${e.name}`);
  particle(player.dimension, "eclipse:spark_burst", { x: player.location.x, y: player.location.y + 1.2, z: player.location.z }, { color: e.rgb, count: 12, speed: 1.5 });
  playerSound(player, "eclipse.element_cast", 0.6, 1.4);
}

/** Passivas leves por modo (a cada 5 s). */
export function passiveTick(player) {
  const p = getProfile(player);
  if (p.core === "dormant") return;
  if (p.mode === "eclipse") {
    effect(player, "night_vision", 16);
  } else if (p.mode === "god") {
    if (healthFrac(player) < 0.35) effect(player, "resistance", 6, 0);
  } else if (p.mode === "haze") {
    if (p.element === "fire") effect(player, "fire_resistance", 8);
    if (p.element === "water") effect(player, "water_breathing", 8);
  }
}

/** Aura: partículas econômicas em volta do jogador quando MANIFESTADO/ASCENDENTE. */
export function auraTick(player) {
  const p = getProfile(player);
  if (p.core !== "manifested" && p.core !== "ascendant") return;
  const preset = effectivePreset(p);
  if (!preset.aura && p.core !== "ascendant") return;
  const every = p.core === "ascendant" ? Math.max(4, Math.floor(preset.auraEvery / 2)) : preset.auraEvery;
  if (system.currentTick % every !== 0) return;
  const M = MODES[p.mode];
  const color = p.mode === "haze" ? ELEMENTS[p.element].rgb : M.rgb;
  const l = player.location;
  particle(player.dimension, "eclipse:mote", { x: l.x, y: l.y + 0.2, z: l.z }, { color, count: p.core === "ascendant" ? 6 : 2, radius: 0.7 });
}
