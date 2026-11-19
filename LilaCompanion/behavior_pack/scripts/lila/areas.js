// Mantém o lugar onde a Lila está carregado quando ela explora longe do jogador
// (área de processamento móvel). Sem isso, o mundo "congela" ao redor dela.
import { world } from "@minecraft/server";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

const R = 24;

function areaId(c) {
  return `lila_${c.rec.ownerId.replace(/[^a-zA-Z0-9]/g, "").slice(-10)}`;
}

/**
 * Garante uma área carregada em volta dela quando estiver longe do dono.
 * @param {Companion} c
 * @param {boolean} [force] cria mesmo perto do dono (antes de uma viagem de exploração)
 */
export function keepLoaded(c, force = false) {
  if (!c.alive()) return;
  const p = c.pos();
  const o = c.owner();
  const far = !o || o.dimension.id !== c.dim().id || Math.hypot(o.location.x - p.x, o.location.z - p.z) > 56;
  const mgr = world.tickingAreaManager;
  const id = areaId(c);
  if (!far && !force) {
    if (c.tickingArea) release(c);
    return;
  }
  const cur = c.tickingArea;
  if (cur && cur.dim === c.dim().id && Math.hypot(cur.x - p.x, cur.z - p.z) < 14) return;
  try {
    const opts = { dimension: c.dim(), from: { x: p.x - R, y: p.y, z: p.z - R }, to: { x: p.x + R, y: p.y, z: p.z + R } };
    if (mgr.hasTickingArea(id)) mgr.removeTickingArea(id);
    if (!mgr.hasCapacity(opts)) return;
    c.tickingArea = { x: p.x, z: p.z, dim: c.dim().id };
    mgr.createTickingArea(id, opts).catch((e) => logError("areas.create", e));
  } catch (e) {
    logError("areas.keep", e);
  }
}

export function release(c) {
  try {
    const mgr = world.tickingAreaManager;
    const id = areaId(c);
    if (mgr.hasTickingArea(id)) mgr.removeTickingArea(id);
  } catch (e) {
    logError("areas.release", e);
  }
  c.tickingArea = null;
}
