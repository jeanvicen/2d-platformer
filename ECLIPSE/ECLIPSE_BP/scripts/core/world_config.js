// Configuração do mundo (opções de administrador), persistida no mundo.
import { world } from "@minecraft/server";
import { DEFAULT_WORLD_CONFIG, PRESET_ORDER, PRESETS } from "./config.js";
import { readJSON, writeJSON } from "./persistence.js";

let cfg = null;

export function worldConfig() {
  if (!cfg) cfg = { ...DEFAULT_WORLD_CONFIG, ...(readJSON(world, "eclipse:world_config", {}) ?? {}) };
  return cfg;
}

export function setWorldConfig(patch) {
  cfg = { ...worldConfig(), ...patch };
  writeJSON(world, "eclipse:world_config", cfg);
  return cfg;
}

/** Preset efetivo = o mais leve entre a preferência do jogador e o teto do mundo. */
export function effectivePreset(profile) {
  const mine = PRESET_ORDER.indexOf(profile?.preset ?? "balanced");
  const cap = PRESET_ORDER.indexOf(worldConfig().worldPreset ?? "visual");
  const idx = Math.min(mine < 0 ? 1 : mine, cap < 0 ? 2 : cap);
  return PRESETS[PRESET_ORDER[idx]];
}
