// HUDLocator: "Lila ↗ 38m" na barra de ação + ponto verde na barra de localização nativa.
// Mostra onde ela está mesmo longe, avisa se está em outra dimensão ou voltando da derrota.
import { EntityWaypoint, WaypointTexture } from "@minecraft/server";
import { goalLabel } from "./goals.js";
import { logError } from "../core/log.js";
import { LILA } from "./registry.js";

/** @typedef {import("./companion.js").Companion} Companion */

const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
const DIM_PT = { "minecraft:overworld": "na Superfície", "minecraft:nether": "no Nether", "minecraft:the_end": "no End" };

/** Seta relativa à direção que o jogador olha. */
export function arrowFor(playerYaw, from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const targetYaw = (-Math.atan2(dx, dz) * 180) / Math.PI;
  let rel = ((targetYaw - playerYaw + 540) % 360) - 180;
  const idx = Math.round(rel / 45);
  return ARROWS[((idx % 8) + 8) % 8];
}

/**
 * Atualiza o HUD do dono (a cada 10 ticks).
 * @param {Companion} c
 */
export function updateHud(c) {
  c.flags.hudText = "";
  const o = c.owner();
  if (!o) return;
  const mode = c.rec.settings.hud;
  if (mode === "off") {
    removeNative(c, o);
    return;
  }
  ensureNative(c, o);
  let holding = false;
  try {
    const it = o.getComponent("minecraft:inventory")?.container?.getItem(o.selectedSlotIndex);
    holding = it?.typeId === "lila:controller";
  } catch {
    /* ignore */
  }
  let text;
  if (c.rec.defeat) {
    text = `${c.kind === "drone" ? "§b" : "§a"}${c.def?.name ?? "Lila"}§r §7volta em §e${Math.max(1, Math.ceil(c.rec.defeat.left / 20))}s`;
  } else if (!c.rec.summoned) {
    if (!holding) return;
    text = `${c.kind === "drone" ? "§b" : "§a"}${c.def?.name ?? "Lila"}§r §7descansando — use o controle para chamar`;
  } else if (!c.alive()) {
    if (!holding && mode !== "always") return;
    text = `${c.kind === "drone" ? "§b" : "§a"}${c.def?.name ?? "Lila"}§r §7fora de alcance (área não carregada)`;
  } else if (c.dim().id !== o.dimension.id) {
    text = `${c.kind === "drone" ? "§b" : "§a"}${c.def?.name ?? "Lila"}§r §7está ${DIM_PT[c.dim().id] ?? "em outra dimensão"}`;
  } else {
    const p = c.pos();
    const d = Math.hypot(p.x - o.location.x, p.z - o.location.z);
    if (mode === "auto" && d < 10 && !holding) return;
    const arrow = arrowFor(o.getRotation().y, o.location, p);
    const dy = p.y - o.location.y;
    const vert = dy > 4 ? " §b▲" : dy < -4 ? " §b▼" : "";
    const cur = c.urgent?.desc ?? c.job?.desc;
    text = `${c.kind === "drone" ? "§b" : "§a"}${c.def?.name ?? "Lila"} §f${arrow} §e${Math.round(d)}m${vert}§r §7· ${goalLabel(cur)}`;
  }
  c.flags.hudText = text;
}

function ensureNative(c, o) {
  if (!c.alive() || c.waypoint) return;
  try {
    const wp = new EntityWaypoint(c.entity, { textureBoundsList: [{ lowerBound: 0, texture: WaypointTexture.Circle }] },
      { showInvisible: true, showSneaking: true, showDead: false }, c.def?.color ?? LILA.color);
    o.locatorBar.addWaypoint(wp);
    c.waypoint = wp;
  } catch {
    c.waypoint = "unsupported";
  }
}

function removeNative(c, o) {
  if (!c.waypoint || c.waypoint === "unsupported") return;
  try {
    o.locatorBar.removeWaypoint(c.waypoint);
  } catch {
    /* ignore */
  }
  c.waypoint = null;
}

/** Quando a entidade muda (renasceu, recarregou), o marcador precisa ser recriado. */
export function resetWaypoint(c) {
  const o = c.owner();
  if (o) removeNative(c, o);
  c.waypoint = null;
}

/** Junta as linhas de todas as companheiras do dono numa barra só (sem piscar uma por cima da outra). */
export function flushHud(owner, comps) {
  const parts = comps.map((c) => c.flags.hudText).filter(Boolean);
  if (!parts.length) return;
  try {
    owner.onScreenDisplay.setActionBar(parts.join("  §8|  "));
  } catch (e) {
    logError("hud.bar", e);
  }
}
