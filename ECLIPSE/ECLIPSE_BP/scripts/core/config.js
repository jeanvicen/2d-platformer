// ECLIPSE — Shadow Sovereign · configuração central.
import { GENERATED } from "../data/generated.js";

export const VERSION = GENERATED.version;
export const CREATOR = "0neajx";
export const NS = "eclipse";
export const PROFILE_SCHEMA = 3;

/** Configuração do mundo (administrador). Persistida em world dynamic property. */
export const DEFAULT_WORLD_CONFIG = Object.freeze({
  unlockAll: true, // pedido do criador: tudo liberado desde o início
  maxCompanions: 3,
  maxConstructsPerPlayer: 220,
  constructLifetimeSec: 240,
  relicGroundTimeSec: 300,
  realLightning: false, // raio real pode causar fogo — desligado por padrão
  pvp: false,
  lyraMaterials: "real", // "real" = coleta de verdade | "shadow" = materiais da sombra (instantâneo)
  lyraBuildSpeed: "normal", // lento | normal | rapido
  toolLifetimeMin: 20,
  worldPreset: "balanced", // teto global de efeitos
  welcomeMessage: true,
});

/** Presets de efeitos visuais (por jogador, limitados pelo teto do mundo). */
export const PRESETS = Object.freeze({
  visual: { label: "VISUAL", aura: true, auraEvery: 6, trails: true, mul: 1.0, flightFx: 2 },
  balanced: { label: "EQUILIBRADO", aura: true, auraEvery: 12, trails: true, mul: 0.6, flightFx: 4 },
  performance: { label: "DESEMPENHO", aura: false, auraEvery: 40, trails: false, mul: 0.3, flightFx: 10 },
});
export const PRESET_ORDER = ["performance", "balanced", "visual"];

export const MODES = Object.freeze({
  eclipse: { name: "Eclipse", title: "Soberano das Sombras", color: "§5", rgb: { red: 0.62, green: 0.3, blue: 1.0 } },
  god: { name: "God", title: "Soberano Divino", color: "§6", rgb: { red: 1.0, green: 0.85, blue: 0.45 } },
  haze: { name: "Haze", title: "Soberano dos Elementos", color: "§b", rgb: { red: 0.55, green: 0.85, blue: 1.0 } },
});
export const MODE_ORDER = ["eclipse", "god", "haze"];

export const ELEMENTS = Object.freeze({
  fire: { name: "Fogo", color: "§c", rgb: { red: 1.0, green: 0.45, blue: 0.15 }, block: "eclipse:ember_block", id: 2 },
  water: { name: "Água", color: "§9", rgb: { red: 0.25, green: 0.55, blue: 1.0 }, block: "eclipse:tide_block", id: 3 },
  earth: { name: "Terra", color: "§6", rgb: { red: 0.6, green: 0.45, blue: 0.25 }, block: "eclipse:earth_block", id: 4 },
  air: { name: "Ar", color: "§f", rgb: { red: 0.85, green: 0.95, blue: 1.0 }, block: "eclipse:gale_block", id: 5 },
  lightning: { name: "Relâmpago", color: "§e", rgb: { red: 0.7, green: 0.8, blue: 1.0 }, block: "eclipse:storm_block", id: 6 },
  ice: { name: "Gelo", color: "§b", rgb: { red: 0.7, green: 0.9, blue: 1.0 }, block: "eclipse:frost_block", id: 7 },
  nature: { name: "Natureza", color: "§a", rgb: { red: 0.35, green: 0.85, blue: 0.3 }, block: "eclipse:root_block", id: 8 },
});
export const ELEMENT_ORDER = ["fire", "water", "earth", "air", "lightning", "ice", "nature"];

export const LEVEL_TITLES = [
  "Desperto", "Invocador", "Moldador", "Alado", "Metamorfo", "Soberano", "Ascendente", "Eclipse Supremo",
];

/** XP necessário para o próximo nível (curva suave, nunca bloqueia pois unlockAll=true por padrão). */
export function xpForLevel(level) {
  return Math.floor(120 * Math.pow(level, 1.45));
}

export const COLORS = Object.freeze({
  violet: { red: 0.62, green: 0.3, blue: 1.0 },
  shadow: { red: 0.35, green: 0.15, blue: 0.6 },
  gold: { red: 1.0, green: 0.82, blue: 0.4 },
  white: { red: 1.0, green: 0.97, blue: 1.0 },
  cyan: { red: 0.5, green: 0.9, blue: 1.0 },
  green: { red: 0.4, green: 0.9, blue: 0.4 },
  red: { red: 1.0, green: 0.3, blue: 0.3 },
});
