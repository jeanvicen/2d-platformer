// Plantas de construção da Lyra (puras). Coordenadas locais: x = direita, y = cima, z = frente.
// Origem = centro da fachada, no nível do piso. Cada bloco usa um "material lógico" que é
// resolvido para o bloco real conforme o tipo de madeira que a Lyra coletou.

/** @typedef {{x:number,y:number,z:number,m:string}} BP */

function box(out, x0, x1, y0, y1, z0, z1, m, hollow = false) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        if (hollow && x > x0 && x < x1 && z > z0 && z < z1 && y > y0 && y < y1) continue;
        out.push({ x, y, z, m });
      }
}

function walls(out, x0, x1, y0, y1, z0, z1, m) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      out.push({ x, y, z: z0, m });
      out.push({ x, y, z: z1, m });
    }
    for (let z = z0 + 1; z < z1; z++) {
      out.push({ x: x0, y, z, m });
      out.push({ x: x1, y, z, m });
    }
  }
}

/** Plano com indexação O(1): escritas posteriores substituem as anteriores. */
class Plan {
  constructor() {
    /** @type {Map<string, BP>} */
    this.map = new Map();
  }
  push(b) {
    this.map.set(`${b.x},${b.y},${b.z}`, b);
  }
}

function setAt(out, x, y, z, m) {
  out.push({ x, y, z, m });
}

function door(out, x, y, z) {
  setAt(out, x, y, z, "door_lower");
  setAt(out, x, y + 1, z, "door_upper");
}

/** Telhado em degraus (lajes + tábuas), sem depender de orientação de escadas. */
function steppedRoof(out, x0, x1, z0, z1, y, m = "planks", top = "slab") {
  let a = x0 - 1, b = x1 + 1, c = z0 - 1, d = z1 + 1, yy = y;
  while (a <= b && c <= d) {
    for (let x = a; x <= b; x++) {
      out.push({ x, y: yy, z: c, m });
      out.push({ x, y: yy, z: d, m });
    }
    for (let z = c + 1; z < d; z++) {
      out.push({ x: a, y: yy, z, m });
      out.push({ x: b, y: yy, z, m });
    }
    a++; b--; c++; d--; yy++;
  }
  // fecha o topo com lajes
  for (let x = a - 1; x <= b + 1; x++) for (let z = c - 1; z <= d + 1; z++) if (x >= x0 - 1 && x <= x1 + 1 && z >= z0 - 1 && z <= z1 + 1) out.push({ x, y: yy, z, m: top });
}

function dedupe(plan) {
  return [...plan.map.values()];
}

// ----------------------------------------------------------------------------- plantas
function cabana() {
  const o = new Plan();
  box(o, -3, 3, -1, -1, 1, 7, "cobble");
  box(o, -3, 3, 0, 0, 1, 7, "planks");
  walls(o, -3, 3, 1, 3, 1, 7, "planks");
  for (const [x, z] of [[-3, 1], [3, 1], [-3, 7], [3, 7]]) for (let y = 1; y <= 3; y++) setAt(o, x, y, z, "log");
  door(o, 0, 1, 1);
  for (const [x, z] of [[-3, 4], [3, 4], [0, 7]]) setAt(o, x, 2, z, "glass");
  setAt(o, -2, 2, 1, "glass");
  setAt(o, 2, 2, 1, "glass");
  steppedRoof(o, -3, 3, 1, 7, 4);
  setAt(o, -2, 1, 6, "table");
  setAt(o, 2, 1, 6, "chest");
  setAt(o, 0, 3, 4, "lantern");
  return dedupe(o);
}

function casa() {
  const o = new Plan();
  box(o, -5, 5, -1, -1, 1, 11, "cobble");
  box(o, -5, 5, 0, 0, 1, 11, "planks");
  walls(o, -5, 5, 1, 4, 1, 11, "planks");
  for (const [x, z] of [[-5, 1], [5, 1], [-5, 11], [5, 11], [-5, 6], [5, 6]]) for (let y = 1; y <= 4; y++) setAt(o, x, y, z, "log");
  // parede interna com passagem
  for (let x = -4; x <= 4; x++) for (let y = 1; y <= 4; y++) if (!(x >= -1 && x <= 0 && y <= 2)) setAt(o, x, y, 6, "planks");
  door(o, 0, 1, 1);
  for (const x of [-3, -2, 2, 3]) setAt(o, x, 2, 1, "glass");
  for (const z of [3, 4, 8, 9]) {
    setAt(o, -5, 2, z, "glass");
    setAt(o, 5, 2, z, "glass");
  }
  for (const x of [-2, 2]) setAt(o, x, 2, 11, "glass");
  steppedRoof(o, -5, 5, 1, 11, 5);
  setAt(o, -4, 1, 10, "table");
  setAt(o, 4, 1, 10, "chest");
  setAt(o, 3, 1, 10, "chest");
  setAt(o, 0, 4, 4, "lantern");
  setAt(o, 0, 4, 9, "lantern");
  // varanda
  for (let x = -2; x <= 2; x++) setAt(o, x, -1, 0, "cobble");
  for (const x of [-2, 2]) for (let y = 0; y <= 1; y++) setAt(o, x, y, 0, "fence");
  return dedupe(o);
}

function torre() {
  const o = new Plan();
  box(o, -2, 2, -1, -1, 1, 5, "cobble");
  walls(o, -2, 2, 0, 13, 1, 5, "cobble");
  for (const [x, z] of [[-2, 1], [2, 1], [-2, 5], [2, 5]]) for (let y = 0; y <= 13; y++) setAt(o, x, y, z, "stone_bricks");
  door(o, 0, 0, 1);
  for (const y of [4, 8, 12]) {
    setAt(o, 0, y, 1, "glass");
    setAt(o, 0, y, 5, "glass");
    setAt(o, -2, y, 3, "glass");
    setAt(o, 2, y, 3, "glass");
  }
  // pisos internos
  for (const y of [5, 10]) for (let x = -1; x <= 1; x++) for (let z = 2; z <= 4; z++) if (!(x === 1 && z === 4)) setAt(o, x, y, z, "planks");
  box(o, -3, 3, 14, 14, 0, 6, "stone_bricks");
  for (let x = -3; x <= 3; x += 2) {
    setAt(o, x, 15, 0, "cobble");
    setAt(o, x, 15, 6, "cobble");
  }
  for (let z = 2; z <= 4; z += 2) {
    setAt(o, -3, 15, z, "cobble");
    setAt(o, 3, 15, z, "cobble");
  }
  setAt(o, 0, 15, 3, "lantern");
  return dedupe(o);
}

function muralha() {
  const o = new Plan();
  for (let x = -7; x <= 7; x++) {
    setAt(o, x, -1, 2, "cobble");
    for (let y = 0; y <= 3; y++) {
      setAt(o, x, y, 2, y === 3 ? "stone_bricks" : "cobble");
      setAt(o, x, y, 3, "cobble");
    }
    if (x % 2 === 0) setAt(o, x, 4, 2, "stone_bricks");
  }
  for (const x of [-7, 0, 7]) setAt(o, x, 5, 2, "lantern");
  return dedupe(o);
}

function ponte() {
  const o = new Plan();
  for (let z = 1; z <= 14; z++) {
    for (let x = -1; x <= 1; x++) setAt(o, x, -1, z, "planks");
    setAt(o, -2, -1, z, "log");
    setAt(o, 2, -1, z, "log");
    setAt(o, -2, 0, z, "fence");
    setAt(o, 2, 0, z, "fence");
  }
  for (const z of [1, 7, 14]) {
    setAt(o, -2, 1, z, "lantern");
    setAt(o, 2, 1, z, "lantern");
  }
  return dedupe(o);
}

function fazenda() {
  const o = new Plan();
  for (let x = -4; x <= 4; x++)
    for (let z = 1; z <= 9; z++) {
      const edge = x === -4 || x === 4 || z === 1 || z === 9;
      if (edge) setAt(o, x, 0, z, "fence");
      else if (x === 0 && z === 5) {
        setAt(o, x, -1, z, "water");
      } else {
        setAt(o, x, -1, z, "farmland");
        setAt(o, x, 0, z, "crop");
      }
    }
  setAt(o, 0, 0, 1, "air");
  setAt(o, 0, 1, 5, "lantern_post");
  return dedupe(o);
}

function abrigo() {
  const o = new Plan();
  box(o, -2, 2, -1, -1, 1, 5, "cobble");
  walls(o, -2, 2, 0, 2, 1, 5, "cobble");
  box(o, -2, 2, 3, 3, 1, 5, "planks");
  door(o, 0, 0, 1);
  setAt(o, 0, 2, 5, "glass");
  setAt(o, 0, 2, 3, "lantern");
  return dedupe(o);
}

function mansao() {
  const o = new Plan();
  const X0 = -10, X1 = 10, Z0 = 2, Z1 = 16;
  box(o, X0, X1, -1, -1, Z0, Z1, "stone_bricks");
  box(o, X0, X1, 0, 0, Z0, Z1, "planks");
  // térreo em pedra, primeiro andar em madeira
  walls(o, X0, X1, 1, 5, Z0, Z1, "stone_bricks");
  box(o, X0, X1, 6, 6, Z0, Z1, "planks");
  walls(o, X0, X1, 7, 11, Z0, Z1, "planks");
  // pilares de tronco
  for (const x of [X0, -5, 0, 5, X1]) for (const z of [Z0, Z1]) for (let y = 1; y <= 11; y++) setAt(o, x, y, z, "log");
  for (const z of [Z0, 9, Z1]) for (const x of [X0, X1]) for (let y = 1; y <= 11; y++) setAt(o, x, y, z, "log");
  // janelas (térreo e andar)
  for (const x of [-8, -7, -3, -2, 2, 3, 7, 8]) {
    for (const y of [2, 3]) setAt(o, x, y, Z0, "glass");
    for (const y of [8, 9]) {
      setAt(o, x, y, Z0, "glass");
      setAt(o, x, y, Z1, "glass");
    }
    for (const y of [2, 3]) setAt(o, x, y, Z1, "glass");
  }
  for (const z of [4, 5, 7, 11, 12, 14]) for (const y of [2, 3, 8, 9]) {
    setAt(o, X0, y, z, "glass");
    setAt(o, X1, y, z, "glass");
  }
  // entrada dupla + varanda com colunas
  door(o, -1, 1, Z0);
  door(o, 0, 1, Z0);
  setAt(o, 1, 1, Z0, "stone_bricks");
  for (let x = -4; x <= 3; x++) for (let z = -1; z <= 1; z++) setAt(o, x, -1, z, "stone_bricks");
  for (const x of [-4, 3]) for (let y = 0; y <= 5; y++) setAt(o, x, y, -1, "log");
  for (let x = -4; x <= 3; x++) for (let z = -1; z <= 1; z++) setAt(o, x, 6, z, "slab");
  // paredes internas (salas) com passagens
  for (let z = Z0 + 1; z < Z1; z++) for (let y = 1; y <= 5; y++) if (!(z >= 8 && z <= 9 && y <= 2)) {
    setAt(o, -5, y, z, "planks");
    setAt(o, 5, y, z, "planks");
  }
  // escada interna (blocos em degraus) até o andar de cima
  for (let i = 0; i < 6; i++) {
    setAt(o, 7, i, 10 + i, "planks");
    for (let y = i + 1; y <= 6; y++) setAt(o, 7, y, 10 + i, "air");
  }
  for (let i = 0; i < 6; i++) setAt(o, 7, 6, 10 + i, "air");
  // mobília
  for (const [x, z] of [[-8, 14], [8, 4]]) setAt(o, x, 1, z, "table");
  for (const [x, z] of [[-9, 15], [-8, 15], [9, 15]]) setAt(o, x, 1, z, "chest");
  for (const [x, z] of [[-7, 9], [7, 6], [0, 9], [-7, 12], [3, 13]]) setAt(o, x, 5, z, "lantern");
  for (const [x, z] of [[-7, 9], [7, 9], [0, 5], [0, 13]]) setAt(o, x, 11, z, "lantern");
  steppedRoof(o, X0, X1, Z0, Z1, 12);
  // torres nos cantos
  for (const [cx, cz] of [[X0, Z0], [X1, Z0]]) {
    for (let y = 12; y <= 16; y++) {
      setAt(o, cx, y, cz, "stone_bricks");
    }
    setAt(o, cx, 17, cz, "lantern");
  }
  return dedupe(o);
}

export const BLUEPRINTS = {
  cabana: { name: "Cabana", desc: "Casinha aconchegante 7×7", build: cabana },
  casa: { name: "Casa", desc: "Casa de dois cômodos com varanda", build: casa },
  torre: { name: "Torre", desc: "Torre de vigia de pedra com 16 m", build: torre },
  muralha: { name: "Muralha", desc: "Muro defensivo de 15 blocos", build: muralha },
  ponte: { name: "Ponte", desc: "Ponte de 14 blocos com lanternas", build: ponte },
  fazenda: { name: "Fazenda", desc: "Plantação cercada com irrigação", build: fazenda },
  abrigo: { name: "Abrigo", desc: "Refúgio rápido de pedra", build: abrigo },
  mansao: { name: "Mansão", desc: "Mansão de dois andares 21×15 com torres", build: mansao },
};

/** Ordem de construção: fundação → piso → paredes de baixo para cima → telhado → detalhes. */
export function buildOrder(blocks) {
  const prio = (m) => (m === "air" ? 0 : ["door_lower", "door_upper", "lantern", "lantern_post", "table", "chest", "crop", "fence"].includes(m) ? 2 : 1);
  return [...blocks].sort((a, b) => prio(a.m) - prio(b.m) || a.y - b.y || a.z - b.z || a.x - b.x);
}

export function footprint(blocks) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const b of blocks) {
    x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x);
    z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z);
    y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y);
  }
  return { x0, x1, y0, y1, z0, z1 };
}
