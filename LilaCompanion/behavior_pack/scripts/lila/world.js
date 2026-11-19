// WorldScanner: lê o mundo para o pathfinding, procura recursos e mantém uma memória espacial.
import { BlockVolume, system } from "@minecraft/server";
import { classifyId, isLeaves, isLog } from "../lib/items.js";
import { logError } from "../core/log.js";

/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {{x:number,y:number,z:number}} Vec */

/** Bloco com proteção contra chunk descarregado / fora da altura. */
export function blockAt(dim, x, y, z) {
  try {
    const r = dim.heightRange;
    if (y < r.min || y >= r.max) return undefined;
    return dim.getBlock({ x, y, z });
  } catch {
    return undefined;
  }
}

/** Código de célula para o A* (ver lib/pathfinding.js). Chunk descarregado conta como sólido. */
export function cellFn(dim) {
  return (x, y, z) => {
    const b = blockAt(dim, x, y, z);
    if (!b) return 1;
    if (b.isAir) return 0;
    if (b.isWaterlogged && classifyId(b.typeId) === 0) return 3;
    return classifyId(b.typeId, b.isLiquid);
  };
}

export function isLoaded(dim, p) {
  try {
    return dim.isChunkLoaded(p);
  } catch {
    return false;
  }
}

/**
 * Procura blocos de certos tipos perto de um ponto (mais próximos primeiro).
 * @param {Dimension} dim
 * @param {Vec} c
 * @param {string[]} types
 * @param {{r?:number, dy?:number, max?:number, filter?:(b:Vec)=>boolean}} o
 * @returns {Vec[]}
 */
export function findBlocks(dim, c, types, o = {}) {
  const r = o.r ?? 16, dy = o.dy ?? 8, max = o.max ?? 24;
  const cx = Math.floor(c.x), cy = Math.floor(c.y), cz = Math.floor(c.z);
  const range = dim.heightRange;
  const y0 = Math.max(range.min, cy - dy), y1 = Math.min(range.max - 1, cy + dy);
  const found = [];
  // varre em fatias de 16×16 para não estourar o orçamento e pular chunks descarregados
  for (let x0 = cx - r; x0 <= cx + r; x0 += 16) {
    for (let z0 = cz - r; z0 <= cz + r; z0 += 16) {
      const x1 = Math.min(cx + r, x0 + 15), z1 = Math.min(cz + r, z0 + 15);
      if (!isLoaded(dim, { x: x0, y: cy, z: z0 }) || !isLoaded(dim, { x: x1, y: cy, z: z1 })) continue;
      try {
        const list = dim.getBlocks(new BlockVolume({ x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 }), { includeTypes: types }, false);
        for (const p of list.getBlockLocationIterator()) {
          if (o.filter && !o.filter(p)) continue;
          found.push({ x: p.x, y: p.y, z: p.z });
        }
      } catch (e) {
        logError("world.find", e);
      }
    }
  }
  found.sort((a, b) => d2(a, c) - d2(b, c));
  return found.slice(0, max);
}

const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 * 1.5 + (a.z - b.z) ** 2;

/** Bloco exposto ao ar/água (visível para uma jogadora, sem "raio-x")? */
export function exposed(dim, p) {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const b = blockAt(dim, p.x + dx, p.y + dy, p.z + dz);
    if (b && (b.isAir || b.isLiquid || classifyId(b.typeId) === 0)) return true;
  }
  return false;
}

/** Um tronco faz parte de uma árvore natural (tem folhas por perto)? Nunca derruba casas de toras. */
export function isTreeLog(dim, p) {
  for (let dy = 0; dy <= 6; dy++) {
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const b = blockAt(dim, p.x + dx, p.y + dy, p.z + dz);
      if (b && isLeaves(b.typeId)) {
        const persistent = safeState(b, "persistent_bit");
        if (persistent !== true) return true;
      }
    }
  }
  return false;
}

/** Todos os troncos conectados da árvore (até 64), de baixo para cima. */
export function treeLogs(dim, base) {
  const out = [];
  const seen = new Set();
  const q = [base];
  while (q.length && out.length < 64) {
    const p = q.shift();
    const k = `${p.x},${p.y},${p.z}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const b = blockAt(dim, p.x, p.y, p.z);
    if (!b || !isLog(b.typeId)) continue;
    out.push(p);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = 0; dy <= 1; dy++) if (dx || dz || dy) q.push({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
  }
  return out.sort((a, b) => a.y - b.y);
}

export function safeState(block, name) {
  try {
    return /** @type {any} */ (block.permutation).getState(name);
  } catch {
    return undefined;
  }
}

/** Primeiro ponto onde dá para ficar em pé perto de (x,z), procurando em volta da altura dada. */
export function standSpot(dim, p, maxR = 3) {
  const cell = cellFn(dim);
  const ok = (x, y, z) => {
    const f = cell(x, y, z), h = cell(x, y + 1, z), g = cell(x, y - 1, z);
    return (f === 0 || f === 5) && (h === 0 || h === 5) && g === 1;
  };
  const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
  for (let r = 0; r <= maxR; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        for (const dy of [0, 1, -1, 2, -2, 3, -3]) {
          if (ok(bx + dx, by + dy, bz + dz)) return { x: bx + dx, y: by + dy, z: bz + dz };
        }
      }
    }
  }
  return undefined;
}

/** Altura do chão (primeiro bloco sólido de cima para baixo) — usa getTopmostBlock quando possível. */
export function groundY(dim, x, z, fromY) {
  const cell = cellFn(dim);
  const start = Math.floor(fromY ?? 0);
  for (let y = start + 8; y > start - 24; y--) {
    if (cell(x, y - 1, z) === 1 && cell(x, y, z) !== 1 && cell(x, y + 1, z) !== 1) return y;
  }
  return undefined;
}

// ------------------------------------------------------------------ memória espacial
/**
 * Memória de lugares importantes (por dono): árvores, minérios vistos, água, areia, bancadas,
 * fornalhas e baús da Lila. Guardada no registro dela e limitada em tamanho.
 */
export class SpatialMemory {
  constructor(data) {
    /** @type {Record<string, {x:number,y:number,z:number,d:string,t:number}[]>} */
    this.spots = data?.spots ?? {};
    /** áreas já exploradas (células de 32×32) */
    this.explored = data?.explored ?? [];
  }
  remember(kind, p, dimId) {
    const list = (this.spots[kind] ??= []);
    if (list.some((s) => s.d === dimId && Math.abs(s.x - p.x) + Math.abs(s.y - p.y) + Math.abs(s.z - p.z) < 3)) return;
    list.push({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), d: dimId, t: system.currentTick });
    if (list.length > 24) list.shift();
  }
  forget(kind, p) {
    const list = this.spots[kind];
    if (!list) return;
    this.spots[kind] = list.filter((s) => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) + Math.abs(s.z - p.z) > 1);
  }
  nearest(kind, p, dimId, maxDist = 256) {
    const list = this.spots[kind] ?? [];
    let best, bd = maxDist * maxDist;
    for (const s of list) {
      if (s.d !== dimId) continue;
      const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2 + (s.z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }
  markExplored(p) {
    const k = `${Math.floor(p.x / 32)},${Math.floor(p.z / 32)}`;
    if (!this.explored.includes(k)) {
      this.explored.push(k);
      if (this.explored.length > 200) this.explored.shift();
    }
  }
  isExplored(p) {
    return this.explored.includes(`${Math.floor(p.x / 32)},${Math.floor(p.z / 32)}`);
  }
  toJSON() {
    return { spots: this.spots, explored: this.explored };
  }
}
