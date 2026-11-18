/** Cursed-energy visual effects built from the add-on's tintable sparkle particle (+ a few vanilla ones). */
import { Player, type Dimension, type Entity, type Vector3 } from "@minecraft/server";
import { BODY_TYPES } from "../core/constants";
import { isValid, particle, safe } from "../core/mc";
import type { Rgb } from "./clans";

export function vanilla(dim: Dimension, id: string, at: Vector3): void {
  safe(() => dim.spawnParticle(id, at), undefined);
}

export function burst(dim: Dimension, at: Vector3, c: Rgb, n = 10, spread = 0.8): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = spread * (0.4 + ((i * 37) % 10) / 16);
    particle(dim, "shadowbound:sparkle", { x: at.x + Math.cos(a) * r, y: at.y + ((i * 13) % 7) / 7 * spread, z: at.z + Math.sin(a) * r }, c);
  }
}

export function ring(dim: Dimension, at: Vector3, radius: number, c: Rgb, n = 16, y = 0.15): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    particle(dim, "shadowbound:sparkle", { x: at.x + Math.cos(a) * radius, y: at.y + y, z: at.z + Math.sin(a) * radius }, c);
  }
}

export function orb(dim: Dimension, at: Vector3, radius: number, c: Rgb, n = 20): void {
  for (let i = 0; i < n; i++) {
    const t = Math.acos(1 - (2 * (i + 0.5)) / n);
    const ph = Math.PI * (1 + Math.sqrt(5)) * i;
    particle(dim, "shadowbound:sparkle", { x: at.x + Math.cos(ph) * Math.sin(t) * radius, y: at.y + Math.cos(t) * radius, z: at.z + Math.sin(ph) * Math.sin(t) * radius }, c);
  }
}

export function beam(dim: Dimension, from: Vector3, dir: Vector3, len: number, c: Rgb, step = 0.6, thick = 0): void {
  for (let d = 0; d <= len; d += step) {
    const p = { x: from.x + dir.x * d, y: from.y + dir.y * d, z: from.z + dir.z * d };
    particle(dim, "shadowbound:sparkle", p, c);
    if (thick > 0) burst(dim, p, c, 3, thick);
  }
}

/** Aura rising around a body (reinforcement, toggles). */
export function aura(e: Entity, c: Rgb, n = 4): void {
  const t = Date.now() / 300;
  for (let i = 0; i < n; i++) {
    const a = t + (i / n) * Math.PI * 2;
    particle(e.dimension, "shadowbound:sparkle", { x: e.location.x + Math.cos(a) * 0.6, y: e.location.y + 0.2 + ((i + t) % 2), z: e.location.z + Math.sin(a) * 0.6 }, c);
  }
}

export function head(p: Player): Vector3 {
  return safe(() => p.getHeadLocation(), { x: p.location.x, y: p.location.y + 1.6, z: p.location.z });
}

export function look(p: Player): Vector3 {
  const v = safe(() => p.getViewDirection(), { x: 0, y: 0, z: 1 });
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

export function ahead(p: Player, d: number): Vector3 {
  const h = head(p);
  const v = look(p);
  return { x: h.x + v.x * d, y: h.y + v.y * d, z: h.z + v.z * d };
}

function enemyOk(e: Entity | undefined, owner: Player): e is Entity {
  if (!isValid(e) || e.id === owner.id) return false;
  if (e instanceof Player) return false;
  const id = safe(() => e.typeId, "");
  return !BODY_TYPES.includes(id) && id !== "minecraft:item" && id !== "minecraft:xp_orb" && id !== "minecraft:arrow";
}

/** Hostile mobs around a point (never players, never shikigami). */
export function enemiesNear(p: Player, at: Vector3, r: number): Entity[] {
  return safe(() => p.dimension.getEntities({ location: at, maxDistance: r, families: ["monster"] }), [] as Entity[]).filter((e) => enemyOk(e, p));
}

/** What the player is aiming at: raycast first, then the nearest enemy in front, then the nearest enemy. */
export function targetAhead(p: Player, range: number): Entity | undefined {
  const hits = safe(() => p.getEntitiesFromViewDirection({ maxDistance: range }), [] as { entity: Entity }[]);
  for (const h of hits) if (enemyOk(h.entity, p)) return h.entity;
  const v = look(p);
  const list = enemiesNear(p, p.location, range);
  let best: Entity | undefined;
  let bestScore = -Infinity;
  for (const e of list) {
    const dx = e.location.x - p.location.x;
    const dz = e.location.z - p.location.z;
    const d = Math.hypot(dx, dz) || 1;
    const facing = (dx * v.x + dz * v.z) / d;
    const score = facing * 10 - d;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** Enemies along a line from the head in the view direction. */
export function lineHits(p: Player, len: number, radius: number): Entity[] {
  const h = head(p);
  const v = look(p);
  const seen = new Map<string, Entity>();
  for (let d = 1; d <= len; d += radius) {
    const at = { x: h.x + v.x * d, y: h.y + v.y * d - 0.8, z: h.z + v.z * d };
    for (const e of enemiesNear(p, at, radius + 0.6)) seen.set(e.id, e);
  }
  if (!seen.size) { // aim assist: the target in front, if any
    const t = targetAhead(p, len);
    if (t) seen.set(t.id, t);
  }
  return [...seen.values()];
}
