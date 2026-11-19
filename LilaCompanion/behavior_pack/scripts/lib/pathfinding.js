// A* em grade de blocos (puro, sem dependência do jogo) com orçamento por tick via generator.
// O mundo é abstraído por um callback `cell(x,y,z)` que devolve um código de célula, o que
// permite testar o algoritmo em Node com mapas falsos (tests/pathfinding.test.mjs).

export const AIR = 0; // atravessável
export const SOLID = 1; // sólido: pode pisar em cima, não atravessa
export const DANGER = 2; // lava, fogo, cacto, neve fofa... nunca pisa nem atravessa
export const WATER = 3; // nada através
export const TALL = 4; // cerca/muro: não atravessa e não dá para pisar (1,5 de altura)
export const DOOR = 5; // porta: atravessa (ela abre)
export const CLIMB = 6; // escada de mão / trepadeira: sobe e desce

const PASS = new Set([AIR, WATER, DOOR, CLIMB]);

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
];

class MinHeap {
  constructor() {
    /** @type {{f:number,x:number,y:number,z:number,k:string}[]} */
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
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
    if (a.length && last) {
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

/**
 * Consultas de caminhabilidade com cache.
 * @param {(x:number,y:number,z:number)=>number} cellFn
 */
export function makeWalker(cellFn) {
  const cache = new Map();
  const cell = (x, y, z) => {
    const k = `${x},${y},${z}`;
    let v = cache.get(k);
    if (v === undefined) {
      v = cellFn(x, y, z);
      cache.set(k, v);
    }
    return v;
  };
  const passable = (x, y, z) => PASS.has(cell(x, y, z));
  /** Dá para ficar com os pés em (x,y,z)? */
  const standable = (x, y, z) => {
    const feet = cell(x, y, z);
    if (!PASS.has(feet) || !passable(x, y + 1, z)) return false;
    if (feet === WATER || feet === CLIMB) return true;
    return cell(x, y - 1, z) === SOLID;
  };
  return { cell, passable, standable, cache };
}

/**
 * Generator A*: faz `yield` a cada `budget` nós expandidos.
 * Retorna `{ path, complete }` — `complete=false` traz o melhor caminho parcial rumo ao alvo.
 * @param {{x:number,y:number,z:number}} start
 * @param {{x:number,y:number,z:number}} goal
 * @param {{cell:(x:number,y:number,z:number)=>number, budget?:number, maxNodes?:number, reach?:number, yTol?:number, maxDrop?:number}} opts
 */
export function* astar(start, goal, opts) {
  const W = makeWalker(opts.cell);
  const budget = opts.budget ?? 150;
  const maxNodes = opts.maxNodes ?? 3000;
  const reach = opts.reach ?? 1.5;
  const yTol = opts.yTol ?? 2;
  const maxDrop = opts.maxDrop ?? 3;
  const gx = Math.floor(goal.x), gy = Math.floor(goal.y), gz = Math.floor(goal.z);
  const h = (x, y, z) => {
    const dx = Math.abs(x - gx), dz = Math.abs(z - gz);
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + Math.abs(y - gy) * 0.9;
  };
  let sx = Math.floor(start.x), sy = Math.floor(start.y), sz = Math.floor(start.z);
  // se começa num ponto inválido (meio bloco, folha), tenta ajustar ±1
  if (!W.standable(sx, sy, sz)) {
    if (W.standable(sx, sy + 1, sz)) sy += 1;
    else if (W.standable(sx, sy - 1, sz)) sy -= 1;
  }
  const open = new MinHeap();
  const g = new Map();
  const came = new Map();
  const k0 = `${sx},${sy},${sz}`;
  g.set(k0, 0);
  open.push({ x: sx, y: sy, z: sz, f: h(sx, sy, sz), k: k0 });
  let expanded = 0;
  let best = { k: k0, h: h(sx, sy, sz) };
  const closed = new Set();
  while (open.size) {
    const cur = open.pop();
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);
    const ch = h(cur.x, cur.y, cur.z);
    if (ch < best.h) best = { k: cur.k, h: ch };
    const dGoal = Math.sqrt((cur.x + 0.5 - goal.x) ** 2 + (cur.z + 0.5 - goal.z) ** 2);
    if (dGoal <= reach && Math.abs(cur.y - gy) <= yTol) return { path: rebuild(came, cur.k), complete: true };
    if (++expanded > maxNodes) break;
    if (expanded % budget === 0) yield;
    const gc = g.get(cur.k) ?? 0;
    const here = W.cell(cur.x, cur.y, cur.z);
    const swimming = here === WATER || here === CLIMB;
    const tryAdd = (nx, ny, nz, cost) => {
      const nk = `${nx},${ny},${nz}`;
      if (closed.has(nk)) return;
      let c = cost;
      const t = W.cell(nx, ny, nz);
      if (t === WATER) c += 1.2;
      if (t === DOOR) c += 0.3;
      if (W.cell(nx, ny - 1, nz) === DANGER) return;
      // evita andar colado em lava/fogo
      if (W.cell(nx + 1, ny, nz) === DANGER || W.cell(nx - 1, ny, nz) === DANGER ||
        W.cell(nx, ny, nz + 1) === DANGER || W.cell(nx, ny, nz - 1) === DANGER) c += 3;
      const ng = gc + c;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, cur.k);
        open.push({ x: nx, y: ny, z: nz, f: ng + h(nx, ny, nz) * 1.05, k: nk });
      }
    };
    for (const [dx, dz, cost] of DIRS) {
      const nx = cur.x + dx, nz = cur.z + dz;
      if (dx && dz && (!W.passable(cur.x + dx, cur.y, cur.z) || !W.passable(cur.x, cur.y, cur.z + dz) ||
        !W.passable(cur.x + dx, cur.y + 1, cur.z) || !W.passable(cur.x, cur.y + 1, cur.z + dz))) continue;
      if (W.standable(nx, cur.y, nz)) {
        tryAdd(nx, cur.y, nz, cost);
      } else if (!dx || !dz) {
        // subir um degrau (só ortogonal) — precisa de espaço para a cabeça
        if (W.standable(nx, cur.y + 1, nz) && W.passable(cur.x, cur.y + 2, cur.z)) {
          tryAdd(nx, cur.y + 1, nz, cost + 0.6);
          continue;
        }
        // descer até maxDrop
        if (W.passable(nx, cur.y, nz) && W.passable(nx, cur.y + 1, nz)) {
          for (let d = 1; d <= maxDrop; d++) {
            if (!W.passable(nx, cur.y - d + 1, nz)) break;
            if (W.standable(nx, cur.y - d, nz)) {
              tryAdd(nx, cur.y - d, nz, cost + 0.25 * d);
              break;
            }
          }
        }
      }
    }
    // movimento vertical na água / escada
    if (swimming) {
      if (W.standable(cur.x, cur.y + 1, cur.z)) tryAdd(cur.x, cur.y + 1, cur.z, 1.4);
      if (W.standable(cur.x, cur.y - 1, cur.z)) tryAdd(cur.x, cur.y - 1, cur.z, 1.2);
    } else if (W.cell(cur.x, cur.y - 1, cur.z) === CLIMB && W.standable(cur.x, cur.y - 1, cur.z)) {
      tryAdd(cur.x, cur.y - 1, cur.z, 1.2);
    }
  }
  if (best.k !== k0) return { path: rebuild(came, best.k), complete: false };
  return { path: null, complete: false };
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

/** Remove pontos colineares no mesmo nível (menos curvas desnecessárias). */
export function simplify(path) {
  if (!path || path.length < 3) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1], b = path[i], c = path[i + 1];
    const d1 = [b.x - a.x, b.y - a.y, b.z - a.z];
    const d2 = [c.x - b.x, c.y - b.y, c.z - b.z];
    const same = d1[1] === 0 && d2[1] === 0 && d1[0] * d2[2] === d1[2] * d2[0] &&
      Math.sign(d1[0]) === Math.sign(d2[0]) && Math.sign(d1[2]) === Math.sign(d2[2]);
    if (!same) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}
