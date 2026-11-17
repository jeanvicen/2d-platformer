/**
 * Bounded A* over a voxel world, written as a generator so the game adapter can spread the
 * work across ticks with system.runJob (no lag spikes). Pure: world access is injected.
 *
 * A cell (x,y,z) is standable when feet and head are passable and the block below is solid
 * ground. Moves: 8 horizontal directions, step up 1 (needs head room), drop down up to 3.
 */
import type { Vec3 } from "../core/types";

export interface WorldProbe {
  /** feet/head space: true if an entity can occupy it */
  passable(x: number, y: number, z: number): boolean;
  /** can be stood on */
  solid(x: number, y: number, z: number): boolean;
  /** hazardous (lava, fire, cactus, magma, berry bush, powder snow) */
  danger(x: number, y: number, z: number): boolean;
  /** false if the chunk is unloaded: the path must not enter it */
  loaded(x: number, y: number, z: number): boolean;
}

export interface PathOptions {
  maxNodes: number;
  maxRadius: number; // from start, horizontal
  /** goal test on a standable cell */
  isGoal: (c: Vec3) => boolean;
  /** heuristic target */
  target: Vec3;
  /** expansions per generator yield */
  batch?: number;
}

export type PathResult = { ok: true; path: Vec3[] } | { ok: false; reason: "no_path" | "too_far" | "budget" | "start_blocked" };

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function standable(w: WorldProbe, x: number, y: number, z: number): boolean {
  return (
    w.loaded(x, y, z) &&
    w.passable(x, y, z) &&
    w.passable(x, y + 1, z) &&
    w.solid(x, y - 1, z) &&
    !w.danger(x, y, z) &&
    !w.danger(x, y - 1, z) &&
    !w.danger(x, y + 1, z)
  );
}

/** Find the nearest standable cell at or below/above a position (used for start/goal snapping). */
export function snap(w: WorldProbe, p: Vec3, range = 3): Vec3 | undefined {
  const bx = Math.floor(p.x);
  const by = Math.floor(p.y);
  const bz = Math.floor(p.z);
  for (let dy = 0; dy <= range; dy++) {
    for (const yy of dy === 0 ? [by] : [by - dy, by + dy]) {
      if (standable(w, bx, yy, bz)) return { x: bx, y: yy, z: bz };
    }
  }
  return undefined;
}

class MinHeap<T> {
  private a: { k: number; v: T }[] = [];
  get size() {
    return this.a.length;
  }
  push(k: number, v: T) {
    const a = this.a;
    a.push({ k, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].k <= a[i].k) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0].v;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].k < a[m].k) m = l;
        if (r < a.length && a[r].k < a[m].k) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const DIRS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function* findPath(w: WorldProbe, start: Vec3, opt: PathOptions): Generator<void, PathResult, void> {
  const s = snap(w, start);
  if (!s) return { ok: false, reason: "start_blocked" };
  const batch = opt.batch ?? 60;
  const h = (c: Vec3) => {
    const dx = Math.abs(c.x - opt.target.x);
    const dz = Math.abs(c.z - opt.target.z);
    const dy = Math.abs(c.y - opt.target.y);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + dy * 0.8;
  };
  const open = new MinHeap<Vec3>();
  const g = new Map<string, number>();
  const came = new Map<string, string>();
  const cells = new Map<string, Vec3>();
  const sk = key(s.x, s.y, s.z);
  g.set(sk, 0);
  cells.set(sk, s);
  open.push(h(s), s);
  let expanded = 0;
  const closed = new Set<string>();

  while (open.size) {
    const cur = open.pop()!;
    const ck = key(cur.x, cur.y, cur.z);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (opt.isGoal(cur)) {
      const path: Vec3[] = [cur];
      let k = ck;
      while (came.has(k)) {
        k = came.get(k)!;
        path.push(cells.get(k)!);
      }
      return { ok: true, path: path.reverse() };
    }
    if (++expanded > opt.maxNodes) return { ok: false, reason: "budget" };
    if (expanded % batch === 0) yield;

    for (const [dx, dz] of DIRS) {
      const nx = cur.x + dx;
      const nz = cur.z + dz;
      if (Math.abs(nx - s.x) > opt.maxRadius || Math.abs(nz - s.z) > opt.maxRadius) continue;
      const diag = dx !== 0 && dz !== 0;
      // candidate heights: same level, step up 1, drop 1..3
      for (const dy of [0, 1, -1, -2, -3]) {
        const ny = cur.y + dy;
        if (dy === 1 && !w.passable(cur.x, cur.y + 2, cur.z)) continue; // head room to jump
        if (dy < 0) {
          // must be able to walk off the edge horizontally first
          if (!w.passable(nx, cur.y, nz) || !w.passable(nx, cur.y + 1, nz)) continue;
          let clear = true;
          for (let yy = ny + 1; yy < cur.y; yy++) if (!w.passable(nx, yy, nz)) clear = false;
          if (!clear) continue;
        }
        if (!standable(w, nx, ny, nz)) continue;
        if (diag) {
          // no corner cutting
          const hy = Math.max(cur.y, ny);
          if (!w.passable(cur.x + dx, hy, cur.z) || !w.passable(cur.x + dx, hy + 1, cur.z)) continue;
          if (!w.passable(cur.x, hy, cur.z + dz) || !w.passable(cur.x, hy + 1, cur.z + dz)) continue;
        }
        const nk = key(nx, ny, nz);
        if (closed.has(nk)) continue;
        const cost = (diag ? 1.414 : 1) + (dy > 0 ? 0.6 : dy < 0 ? 0.3 * -dy : 0);
        const ng = g.get(ck)! + cost;
        if (ng < (g.get(nk) ?? Infinity)) {
          g.set(nk, ng);
          came.set(nk, ck);
          const nc = { x: nx, y: ny, z: nz };
          cells.set(nk, nc);
          open.push(ng + h(nc), nc);
        }
        break; // only one height per column
      }
    }
  }
  return { ok: false, reason: "no_path" };
}

/** Run a generator synchronously (tests / tiny searches). */
export function runSync<T>(gen: Generator<void, T, void>): T {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

export function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function dist2D(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
