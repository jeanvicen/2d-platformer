// Locomoção da Lyra: caminho A* com passos suaves (sem ficar presa), flutuar e "passo sombrio".
import { astar, simplify } from "../lib/pathfinding.js";
import { particle } from "../core/fx.js";
import { solidFn } from "./lyra_world.js";

const WALK = 0.2;
const RUN = 0.3;

/** @param {import("@minecraft/server").Entity} e */
export function setAction(e, action) {
  try {
    if (e.getProperty("eclipse:action") !== action) e.setProperty("eclipse:action", action);
  } catch {
    /* entidade pode ter sido descarregada */
  }
}

export function dist3(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/** Desliza até um ponto em linha reta (usado ao construir/flutuar). Generator: 1 passo por tick. */
export function* glideTo(L, to, speed = 0.32, action = "float") {
  const e = L.entity();
  if (!e) return false;
  setAction(e, action);
  for (let i = 0; i < 400; i++) {
    const ent = L.entity();
    if (!ent || L.cancelled) return false;
    const p = ent.location;
    const d = dist3(p, to);
    if (d <= speed) {
      ent.teleport(to, { keepVelocity: false, facingLocation: L.lookAt ?? { x: to.x, y: to.y + 1.5, z: to.z + 0.01 } });
      return true;
    }
    const k = speed / d;
    const n = { x: p.x + (to.x - p.x) * k, y: p.y + (to.y - p.y) * k, z: p.z + (to.z - p.z) * k };
    ent.teleport(n, { keepVelocity: false, facingLocation: L.lookAt ?? { x: to.x, y: n.y + 1.5, z: to.z } });
    yield;
  }
  return false;
}

/** Atalho pelas sombras quando não há caminho (ela é uma sombra: some e reaparece). */
export function* shadowStep(L, to) {
  const e = L.entity();
  if (!e) return false;
  particle(e.dimension, "eclipse:shadow_recall", e.location, {});
  yield;
  e.teleport(to, { keepVelocity: false });
  particle(e.dimension, "eclipse:shadow_manifest", to, {});
  return true;
}

/**
 * Caminha até perto de `target` (blocos inteiros). Usa A* com orçamento por tick, segue o caminho
 * passo a passo e recalcula se algo mudar. Sem caminho → passo sombrio.
 */
export function* walkTo(L, target, reach = 1.6, run = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const e = L.entity();
    if (!e || L.cancelled) return false;
    const start = { x: Math.floor(e.location.x), y: Math.floor(e.location.y + 0.01), z: Math.floor(e.location.z) };
    if (dist3(start, target) <= reach + 0.5) return true;
    const gen = astar(start, target, { solid: solidFn(e.dimension), budget: 90, maxNodes: 2600, reach });
    let path;
    for (;;) {
      const r = gen.next();
      if (r.done) {
        path = r.value;
        break;
      }
      yield;
      if (L.cancelled) return false;
    }
    if (!path || path.length < 2) {
      const far = dist3(start, target) > reach + 1;
      if (far) yield* shadowStep(L, { x: target.x + 0.5, y: target.y, z: target.z + 0.5 });
      return true;
    }
    path = simplify(path);
    const speed = run || path.length > 18 ? RUN : WALK;
    let ok = true;
    for (let i = 1; i < path.length; i++) {
      const node = path[i];
      const goal = { x: node.x + 0.5, y: node.y, z: node.z + 0.5 };
      const ent = L.entity();
      if (!ent || L.cancelled) return false;
      setAction(ent, speed === RUN ? "run" : "walk");
      let guard = 0;
      for (;;) {
        const cur = L.entity();
        if (!cur || L.cancelled) return false;
        const p = cur.location;
        const dx = goal.x - p.x, dy = goal.y - p.y, dz = goal.z - p.z;
        const dh = Math.sqrt(dx * dx + dz * dz);
        if (dh <= speed && Math.abs(dy) < 0.6) {
          cur.teleport(goal, { keepVelocity: false, facingLocation: { x: goal.x + dx, y: goal.y + 1.6, z: goal.z + dz } });
          break;
        }
        const k = Math.min(1, speed / Math.max(dh, 0.001));
        // degraus: sobe/desce suavemente acompanhando o avanço horizontal
        const ny = p.y + Math.sign(dy) * Math.min(Math.abs(dy), dy > 0 ? 0.34 : 0.45);
        const n = { x: p.x + dx * k, y: ny, z: p.z + dz * k };
        cur.teleport(n, { keepVelocity: false, facingLocation: { x: goal.x + dx, y: n.y + 1.6, z: goal.z + dz } });
        yield;
        if (++guard > 80) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
      // obstáculo novo surgiu? recalcula
      const sf = solidFn(ent.dimension);
      if (i + 1 < path.length) {
        const nx = path[i + 1];
        if (sf(nx.x, nx.y, nx.z) === 1 || sf(nx.x, nx.y + 1, nx.z) === 1) {
          ok = false;
          break;
        }
      }
    }
    const end = L.entity();
    if (end) setAction(end, "idle");
    if (ok && end && dist3(end.location, target) <= reach + 1.5) return true;
  }
  const e = L.entity();
  if (e && dist3(e.location, target) > reach + 1.5) yield* shadowStep(L, { x: target.x + 0.5, y: target.y, z: target.z + 0.5 });
  return true;
}

/** Espera N ticks (mantendo a ação/animação atual). */
export function* wait(L, ticks) {
  for (let i = 0; i < ticks; i++) {
    if (L.cancelled) return false;
    yield;
  }
  return true;
}
