// A* em grade de blocos (puro, com orçamento por tick via generator).
// O "mundo" é abstraído por um callback, permitindo testar em Node com um mapa falso.

/**
 * @typedef {(x:number,y:number,z:number)=>number} SolidFn  // 0 = ar/atravessável, 1 = sólido, 2 = perigo (lava/fogo), 3 = água
 */

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
];

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Fábrica de testes de caminhabilidade com cache. */
export function makeWalker(solidFn) {
  const cache = new Map();
  const solid = (x, y, z) => {
    const k = `${x},${y},${z}`;
    let v = cache.get(k);
    if (v === undefined) {
      v = solidFn(x, y, z);
      cache.set(k, v);
    }
    return v;
  };
  const standable = (x, y, z) => {
    const ground = solid(x, y - 1, z);
    return (ground === 1) && solid(x, y, z) === 0 && solid(x, y + 1, z) === 0;
  };
  return { solid, standable, cache };
}

/**
 * Generator A*: faça `yield` a cada `budget` nós; retorna array de pontos (blocos) ou null.
 * @param {{x:number,y:number,z:number}} start
 * @param {{x:number,y:number,z:number}} goal
 * @param {{solid:SolidFn, budget?:number, maxNodes?:number, reach?:number, maxDrop?:number}} opts
 */
export function* astar(start, goal, opts) {
  const walker = makeWalker(opts.solid);
  const budget = opts.budget ?? 120;
  const maxNodes = opts.maxNodes ?? 2500;
  const reach = opts.reach ?? 1.5;
  const maxDrop = opts.maxDrop ?? 3;
  const h = (x, y, z) => {
    const dx = Math.abs(x - goal.x), dz = Math.abs(z - goal.z);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + Math.abs(y - goal.y) * 0.8;
  };
  const sx = Math.floor(start.x), sy = Math.floor(start.y), sz = Math.floor(start.z);
  const open = new MinHeap();
  const g = new Map();
  const came = new Map();
  const k0 = `${sx},${sy},${sz}`;
  g.set(k0, 0);
  open.push({ x: sx, y: sy, z: sz, f: h(sx, sy, sz), k: k0 });
  let expanded = 0;
  let best = { k: k0, h: h(sx, sy, sz) };
  while (open.size) {
    const cur = open.pop();
    const ch = h(cur.x, cur.y, cur.z);
    if (ch < best.h) best = { k: cur.k, h: ch };
    const dGoal = Math.sqrt((cur.x - goal.x) ** 2 + (cur.z - goal.z) ** 2);
    if (dGoal <= reach && Math.abs(cur.y - goal.y) <= 3) return rebuild(came, cur.k);
    if (++expanded > maxNodes) break;
    if (expanded % budget === 0) yield;
    const gc = g.get(cur.k);
    for (const [dx, dz, cost] of DIRS) {
      const nx = cur.x + dx, nz = cur.z + dz;
      // diagonais: os dois lados devem estar livres (sem cortar quinas)
      if (dx && dz && (walker.solid(cur.x + dx, cur.y, cur.z) || walker.solid(cur.x, cur.y, cur.z + dz) ||
        walker.solid(cur.x + dx, cur.y + 1, cur.z) || walker.solid(cur.x, cur.y + 1, cur.z + dz))) continue;
      let ny = null;
      if (walker.standable(nx, cur.y, nz)) ny = cur.y;
      else if (walker.standable(nx, cur.y + 1, nz) && walker.solid(cur.x, cur.y + 2, cur.z) === 0) ny = cur.y + 1;
      else {
        for (let d = 1; d <= maxDrop; d++) {
          if (walker.solid(nx, cur.y - d + 1, nz) !== 0) break;
          if (walker.standable(nx, cur.y - d, nz)) {
            ny = cur.y - d;
            break;
          }
        }
      }
      if (ny === null) continue;
      if (walker.solid(nx, ny - 1, nz) === 2) continue; // não pisa em perigo
      const nk = `${nx},${ny},${nz}`;
      const ng = gc + cost + (ny > cur.y ? 0.6 : 0) + (ny < cur.y ? 0.2 : 0);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, cur.k);
        open.push({ x: nx, y: ny, z: nz, f: ng + h(nx, ny, nz), k: nk });
      }
    }
  }
  // sem caminho completo: devolve o melhor caminho parcial (aproxima o alvo)
  if (best.k !== k0) return rebuild(came, best.k);
  return null;
}

function rebuild(came, k) {
  const out = [];
  let cur = k;
  while (cur) {
    const [x, y, z] = cur.split(",").map(Number);
    out.push({ x, y, z });
    cur = came.get(cur);
  }
  return out.reverse();
}

/** Simplifica o caminho removendo pontos colineares (menos teleportes intermediários). */
export function simplify(path) {
  if (!path || path.length < 3) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1], b = path[i], c = path[i + 1];
    const d1 = [b.x - a.x, b.y - a.y, b.z - a.z];
    const d2 = [c.x - b.x, c.y - b.y, c.z - b.z];
    const same = d1[1] === 0 && d2[1] === 0 && Math.sign(d1[0]) === Math.sign(d2[0]) && Math.sign(d1[2]) === Math.sign(d2[2]) &&
      d1[0] * d2[2] === d1[2] * d2[0];
    if (!same) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}
