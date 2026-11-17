/**
 * Perception System: localised, budgeted observation of the world.
 *  - block scans expand in rings from the shadow (nearest first) and yield every batch,
 *    so they are spread over many ticks and stop as soon as enough targets are found
 *  - entity queries always use a radius (never world-wide)
 */
import { Block, Dimension, Entity } from "@minecraft/server";
import { getBlock, isPassableBlock, safe } from "../core/mc";
import type { Vec3 } from "../core/types";
import { isLeafBlock, isLogBlock } from "../inventory/item_catalog";

export type Tick = { t: "tick" } | { t: "wait"; ticks: number } | { t: "move" };
export const TICK: Tick = { t: "tick" };

export interface ScanOptions {
  radius: number;
  yDown: number;
  yUp: number;
  limit: number;
  batch?: number;
  /** stop expanding once something was found and the ring is at least this big */
  minRing?: number;
}

export function* scanBlocks(dim: Dimension, origin: Vec3, pred: (b: Block) => boolean, o: ScanOptions): Generator<Tick, Vec3[], void> {
  const ox = Math.floor(origin.x);
  const oy = Math.floor(origin.y);
  const oz = Math.floor(origin.z);
  const found: Vec3[] = [];
  const batch = o.batch ?? 1200;
  let n = 0;
  for (let r = 0; r <= o.radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // ring only
        const x = ox + dx;
        const z = oz + dz;
        if (!safe(() => dim.isChunkLoaded({ x, y: oy, z }), false)) continue;
        for (let y = oy - o.yDown; y <= oy + o.yUp; y++) {
          const b = getBlock(dim, { x, y, z });
          if (b && pred(b)) found.push({ x, y, z });
          if (++n % batch === 0) yield TICK;
        }
      }
    }
    if (found.length >= o.limit && r >= (o.minRing ?? 0)) break;
  }
  found.sort((a, b) => Math.hypot(a.x - ox, a.y - oy, a.z - oz) - Math.hypot(b.x - ox, b.y - oy, b.z - oz));
  return found;
}

const GROUND_FOR_TREE = /(dirt|grass_block|podzol|mud|moss_block|mycelium|rooted_dirt|farmland)/;

export interface TreeInfo {
  base: Vec3;
  logs: Vec3[];
}

/** A natural tree: base log on soil, connected logs, and leaves nearby (never a log house). */
export function inspectTree(dim: Dimension, base: Vec3): TreeInfo | undefined {
  const logs: Vec3[] = [];
  const seen = new Set<string>();
  const queue: Vec3[] = [base];
  let leaves = 0;
  while (queue.length && logs.length < 48) {
    const p = queue.shift()!;
    const k = `${p.x},${p.y},${p.z}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const b = getBlock(dim, p);
    if (!b || !isLogBlock(b.typeId)) continue;
    if (Math.abs(p.x - base.x) > 5 || Math.abs(p.z - base.z) > 5 || p.y < base.y || p.y > base.y + 30) continue;
    logs.push(p);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const q = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
          const qb = getBlock(dim, q);
          if (!qb) continue;
          if (isLogBlock(qb.typeId)) queue.push(q);
          else if (isLeafBlock(qb.typeId)) leaves++;
        }
      }
    }
  }
  if (!logs.length || leaves < 3) return undefined;
  logs.sort((a, b) => a.y - b.y);
  return { base, logs };
}

export function* findTree(dim: Dimension, origin: Vec3, avoid: Set<string>, radius = 22): Generator<Tick, TreeInfo | undefined, void> {
  const candidates = yield* scanBlocks(
    dim,
    origin,
    (b) => {
      if (!isLogBlock(b.typeId)) return false;
      const below = safe(() => b.below(), undefined);
      if (!below) return false;
      if (GROUND_FOR_TREE.test(below.typeId)) return true;
      // partially chopped tree: lowest remaining log above an empty stump on soil
      if (isLogBlock(below.typeId) || !isPassableBlock(below)) return false;
      for (let d = 2; d <= 4; d++) {
        const g = getBlock(dim, { x: b.location.x, y: b.location.y - d, z: b.location.z });
        if (!g) return false;
        if (GROUND_FOR_TREE.test(g.typeId)) return true;
        if (!isPassableBlock(g)) return false;
      }
      return false;
    },
    { radius, yDown: 4, yUp: 8, limit: 3, minRing: 3 },
  );
  for (const c of candidates) {
    if (avoid.has(`${c.x},${c.y},${c.z}`)) continue;
    const t = inspectTree(dim, c);
    if (t) return t;
    avoid.add(`${c.x},${c.y},${c.z}`);
    yield TICK;
  }
  return undefined;
}

/** Block is exposed (minable without tunnelling) if one neighbour is passable. */
export function exposed(dim: Dimension, p: Vec3): boolean {
  const n: Vec3[] = [
    { x: p.x + 1, y: p.y, z: p.z }, { x: p.x - 1, y: p.y, z: p.z }, { x: p.x, y: p.y + 1, z: p.z },
    { x: p.x, y: p.y - 1, z: p.z }, { x: p.x, y: p.y, z: p.z + 1 }, { x: p.x, y: p.y, z: p.z - 1 },
  ];
  return n.some((q) => isPassableBlock(getBlock(dim, q)));
}

/** Liquids next to a block make mining it dangerous (lava) or messy (water floods). */
export function nearLiquid(dim: Dimension, p: Vec3): boolean {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
    const b = getBlock(dim, { x: p.x + dx, y: p.y + dy, z: p.z + dz });
    if (b && b.isLiquid) return true;
  }
  return false;
}

export function entitiesNear(dim: Dimension, loc: Vec3, radius: number, opts: { type?: string; families?: string[]; excludeFamilies?: string[] } = {}): Entity[] {
  return safe(
    () =>
      dim.getEntities({
        location: loc,
        maxDistance: radius,
        type: opts.type,
        families: opts.families,
        excludeFamilies: opts.excludeFamilies,
      }),
    [] as Entity[],
  );
}

export function nearestHostile(dim: Dimension, loc: Vec3, radius: number): Entity | undefined {
  const list = entitiesNear(dim, loc, radius, { families: ["monster"] });
  let best: Entity | undefined;
  let bd = Infinity;
  for (const e of list) {
    const id = safe(() => e.typeId, "");
    if (id === "minecraft:enderman" || id === "minecraft:zombie_pigman" || id === "minecraft:piglin") continue;
    const d = Math.hypot(e.location.x - loc.x, e.location.y - loc.y, e.location.z - loc.z);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}
