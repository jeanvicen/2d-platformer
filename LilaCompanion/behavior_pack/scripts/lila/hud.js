// HUDLocator: "Hacknd ↗ 38m" na barra de ação + ponto na barra de localização nativa.
// Mostra onde ele está mesmo longe, a forma atual, outra dimensão ou volta da derrota.
import { inSmokeForm } from "./curse.js";
import { EntityWaypoint, WaypointTexture } from "@minecraft/server";
import { goalLabel } from "./goals.js";
import { logError } from "../core/log.js";
import { DRONE } from "./registry.js";
import { FORM_NAMES } from "../lib/catalog.js";

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
    holding = it?.typeId === DRONE.controller;
  } catch {
    /* ignore */
  }
  let text;
  if (c.rec.form === "army") {
    text = `§5${c.def?.name ?? "Maldição"}§r §7· §8exército de sombras em ação§7 (use a Maldição para comandar)`;
  } else if (c.rec.defeat) {
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
    const form = c.rec.form && c.rec.form !== "drone" ? ` §6[${FORM_NAMES[c.rec.form] ?? c.rec.form}]` : "";
    text = `§5${c.def?.name ?? "Maldição"}${form} §f${arrow} §e${Math.round(d)}m${vert}§r §7· ${goalLabel(cur)}`;
  }
  c.flags.hudText = text;
}

function ensureNative(c, o) {
  if (!c.alive() || c.waypoint) return;
  try {
    const wp = new EntityWaypoint(c.entity, { textureBoundsList: [{ lowerBound: 0, texture: WaypointTexture.Circle }] },
      { showInvisible: true, showSneaking: true, showDead: false }, c.def?.color ?? DRONE.color);
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
  if (inSmokeForm(owner)) return; // de fumaça: a barra mostra como voltar ao corpo (não esconder isso)
  const parts = comps.map((c) => c.flags.hudText).filter(Boolean);
  if (!parts.length) return;
  try {
    owner.onScreenDisplay.setActionBar(parts.join("  §8|  "));
  } catch (e) {
    logError("hud.bar", e);
  }
}
