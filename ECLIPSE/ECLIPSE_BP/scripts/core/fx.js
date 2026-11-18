// Feedback visual/sonoro centralizado (respeita o preset de desempenho).
import { MolangVariableMap } from "@minecraft/server";
import { getProfile } from "./player_profile.js";
import { effectivePreset } from "./world_config.js";
import { logError } from "./log.js";

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {any} opts
 */
export function particle(dim, id, loc, opts = {}) {
  try {
    const m = new MolangVariableMap();
    if (opts.color) m.setColorRGB("variable.color", opts.color);
    for (const k of ["count", "radius", "speed", "gravity", "size", "life"]) {
      if (opts[k] !== undefined) m.setFloat(`variable.${k}`, opts[k]);
    }
    dim.spawnParticle(id, loc, m);
  } catch (e) {
    // partículas fora de chunk carregado lançam erro: não é crítico
    if (!(String(e).includes("unloaded") || String(e).includes("Unloaded"))) logError("fx.particle", `${id}: ${e}`);
  }
}

/**
 * Mesmo que particle(), mas escala a contagem pelo preset do jogador.
 * @param {any} opts
 */
export function playerParticle(player, id, loc, opts = {}) {
  const preset = effectivePreset(getProfile(player));
  const o = { ...opts };
  if (o.count !== undefined) o.count = Math.max(1, Math.round(o.count * preset.mul));
  particle(player.dimension, id, loc, o);
}

export function sound(dim, id, loc, volume = 1, pitch = 1) {
  try {
    dim.playSound(id, loc, { volume, pitch });
  } catch (e) {
    logError("fx.sound", `${id}: ${e}`);
  }
}

export function playerSound(player, id, volume = 1, pitch = 1) {
  try {
    if (getProfile(player).prefs.sounds === false) return;
    player.playSound(id, { volume, pitch });
  } catch (e) {
    logError("fx.psound", `${id}: ${e}`);
  }
}

export function actionbar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    /* ignore */
  }
}

export function title(player, main, sub = "", stay = 50) {
  try {
    player.onScreenDisplay.setTitle(main, { fadeInDuration: 8, stayDuration: stay, fadeOutDuration: 14, subtitle: sub });
  } catch {
    /* ignore */
  }
}

export function chat(player, text) {
  try {
    player.sendMessage(text);
  } catch {
    /* ignore */
  }
}

/** Anel de partículas no chão (runa giratória). */
export function groundRune(dim, loc, color, radius = 1.5, life = 1.2) {
  particle(dim, "eclipse:ground_rune", { x: loc.x, y: loc.y + 0.05, z: loc.z }, { color, radius, life });
}

/** Linha de partículas entre dois pontos (correntes, ganchos, retornos). */
export function line(dim, a, b, color, step = 0.6, id = "eclipse:trail", size = 0.25) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const n = Math.min(40, Math.max(1, Math.floor(d / step)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    particle(dim, id, { x: a.x + dx * t, y: a.y + dy * t, z: a.z + dz * t }, { color, size });
  }
}
