// Megaconstruções procedurais (puro, testável em Node). Cada planta é uma lista de operações em
// coordenadas locais: x/z centrados na obra, y = 0 é o nível do chão (o bloco de grama), y ≥ 1 é
// acima dele. O executor (lila/mega.js) traduz para o mundo, quebra em pedaços pequenos e coloca
// por partes com orçamento de CPU — sem travar o jogo.
//
//   ["f", x0,y0,z0, x1,y1,z1, bloco, estados?]   enche uma caixa
//   ["s", x,y,z, bloco, estados?]                um bloco
//   ["e", x,y,z, entidade]                      cria uma entidade (ex.: carrinho na montanha-russa)
//   ["c", x,y,z, [[item, qtd], ...]]             baú com tesouro

import { archPlan, facingQuarter } from "./archgen.js";

/** Carimba uma planta (ex.: prédio mobiliado do catálogo) dentro de outra, deslocada. */
function stamp(parent, child, dx, dz, dy = 0) {
  for (const op of child.ops) {
    if (op[0] === "f") parent.ops.push(["f", op[1] + dx, op[2] + dy, op[3] + dz, op[4] + dx, op[5] + dy, op[6] + dz, op[7], op[8]]);
    else if (op[0] === "s") parent.ops.push(op[6] ? ["s", op[1] + dx, op[2] + dy, op[3] + dz, op[4], op[5], op[6]] : ["s", op[1] + dx, op[2] + dy, op[3] + dz, op[4], op[5]]);
    else parent.ops.push([op[0], op[1] + dx, op[2] + dy, op[3] + dz, op[4]]);
  }
  parent.height = Math.max(parent.height, (child.height ?? 10) + dy + 2);
  return parent;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class P {
  constructor(name, half, height, clear = true) {
    this.name = name;
    this.half = half; // meia largura (x e z)
    this.height = height;
    this.clear = clear;
    this.ops = [];
  }
  f(x0, y0, z0, x1, y1, z1, b, st) {
    this.ops.push(["f", Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), b, st]);
    return this;
  }
  s(x, y, z, b, st, pair) {
    this.ops.push(pair ? ["s", x, y, z, b, st, pair] : ["s", x, y, z, b, st]);
    return this;
  }
  /** porta com as duas metades colocadas juntas */
  door(x, y, z, b, card) {
    const st = { "minecraft:cardinal_direction": card, upper_block_bit: false };
    return this.s(x, y, z, b, st, [0, 1, 0, { ...st, upper_block_bit: true }]);
  }
  /** paredes de uma caixa (sem teto/chão) */
  walls(x0, y0, z0, x1, y1, z1, b) {
    this.f(x0, y0, z0, x1, y1, z0, b).f(x0, y0, z1, x1, y1, z1, b).f(x0, y0, z0, x0, y1, z1, b).f(x1, y0, z0, x1, y1, z1, b);
    return this;
  }
  /** cilindro (paredes ou cheio) por anéis */
  cyl(cx, cz, r, y0, y1, b, hollow = true) {
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        const d = Math.hypot(x, z);
        if (d > r + 0.4) continue;
        if (hollow && d < r - 0.6) continue;
        this.f(cx + x, y0, cz + z, cx + x, y1, cz + z, b);
      }
    }
    return this;
  }
  /** ameias no topo de um muro */
  crenel(x0, z0, x1, z1, y, b) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if ((x + z) % 2 === 0) this.s(x, y, z, b);
    return this;
  }
  e(x, y, z, id) {
    this.ops.push(["e", x, y, z, id]);
    return this;
  }
  chest(x, y, z, loot) {
    this.s(x, y, z, "minecraft:chest");
    this.ops.push(["c", x, y, z, loot]);
    return this;
  }
}

const LOOT = [["minecraft:diamond", 16], ["minecraft:emerald", 16], ["minecraft:gold_ingot", 32], ["minecraft:golden_apple", 4], ["minecraft:totem_of_undying", 1]];

// ------------------------------------------------------------------ poço
export function poco() {
  const p = new P("poço", 5, 7);
  p.f(-4, 0, -4, 4, 0, 4, "minecraft:gravel");
  p.f(-3, 0, -3, 3, 0, 3, "minecraft:cobblestone");
  p.f(-2, -4, -2, 2, 0, 2, "minecraft:stone_bricks");
  p.f(-1, -4, -1, 1, 0, 1, "minecraft:water");
  p.walls(-2, 1, -2, 2, 1, 2, "minecraft:stone_bricks");
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) p.f(x, 2, z, x, 4, z, "minecraft:spruce_fence");
  p.f(-3, 5, -3, 3, 5, 3, "minecraft:spruce_slab");
  p.f(-2, 5, -2, 2, 5, 2, "minecraft:spruce_planks");
  p.f(-1, 6, -1, 1, 6, 1, "minecraft:spruce_slab");
  p.s(0, 4, 0, "minecraft:iron_chain").s(0, 3, 0, "minecraft:lantern", { hanging: true });
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) p.s(x, 1, z, "minecraft:lantern");
  return p;
}

// ------------------------------------------------------------------ labirinto
export function labirinto(seed = 7) {
  const N = 15; // células
  const S = N * 2 + 1;
  const h = Math.floor(S / 2);
  const p = new P("labirinto", h + 2, 5);
  const R = rng(seed);
  const wall = Array.from({ length: S }, () => Array(S).fill(true));
  const st = [[0, 0]];
  const seen = new Set(["0,0"]);
  wall[1][1] = false;
  while (st.length) {
    const [cx, cz] = st[st.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [cx + dx, cz + dz, dx, dz]).filter(([x, z]) => x >= 0 && z >= 0 && x < N && z < N && !seen.has(`${x},${z}`));
    if (!nb.length) {
      st.pop();
      continue;
    }
    const [nx, nz, dx, dz] = nb[Math.floor(R() * nb.length)];
    wall[cx * 2 + 1 + dx][cz * 2 + 1 + dz] = false;
    wall[nx * 2 + 1][nz * 2 + 1] = false;
    seen.add(`${nx},${nz}`);
    st.push([nx, nz]);
  }
  wall[1][0] = false; // entrada
  wall[S - 2][S - 1] = false; // saída
  // centro aberto com prêmio
  for (let x = h - 2; x <= h + 2; x++) for (let z = h - 2; z <= h + 2; z++) wall[x][z] = false;
  p.f(-h - 1, 0, -h - 1, h + 1, 0, h + 1, "minecraft:moss_block");
  for (let x = 0; x < S; x++) {
    // junta trechos seguidos de parede numa caixa só (menos operações)
    let z = 0;
    while (z < S) {
      if (!wall[x][z]) {
        z++;
        continue;
      }
      let z2 = z;
      while (z2 + 1 < S && wall[x][z2 + 1]) z2++;
      p.f(x - h, 1, z - h, x - h, 3, z2 - h, "minecraft:azalea_leaves", { persistent_bit: true });
      z = z2 + 1;
    }
  }
  p.f(-2, 0, -2, 2, 0, 2, "minecraft:polished_andesite");
  p.s(0, 1, 0, "minecraft:chiseled_stone_bricks").s(0, 2, 0, "minecraft:water");
  p.chest(1, 1, 1, LOOT);
  for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h], [-h + 1, -h - 1], [h - 1, h + 1]]) p.s(x, 4, z, "minecraft:lantern");
  return p;
}

// ------------------------------------------------------------------ castelo
export function castelo(seed = 3) {
  const R = rng(seed);
  const H = 22; // meia largura do muro
  const p = new P("castelo", H + 7, 34);
  const brick = () => (R() < 0.12 ? "minecraft:mossy_stone_bricks" : R() < 0.08 ? "minecraft:cracked_stone_bricks" : "minecraft:stone_bricks");
  // fosso
  p.f(-H - 6, -2, -H - 6, H + 6, 0, H + 6, "minecraft:water");
  p.f(-H - 2, -3, -H - 2, H + 2, 0, H + 2, "minecraft:stone_bricks");
  p.f(-H + 1, 0, -H + 1, H - 1, 0, H - 1, "minecraft:grass_block");
  // muralhas (2 de espessura, 11 de altura) com textura de tijolos variados
  for (let y = 1; y <= 11; y += 2) {
    p.walls(-H, y, -H, H, y + 1, H, brick());
    p.walls(-H + 1, y, -H + 1, H - 1, y + 1, H - 1, "minecraft:stone_bricks");
  }
  p.walls(-H + 1, 12, -H + 1, H - 1, 12, H - 1, "minecraft:stone_brick_slab");
  p.crenel(-H, -H, H, -H, 12, "minecraft:stone_bricks").crenel(-H, H, H, H, 12, "minecraft:stone_bricks");
  p.crenel(-H, -H, -H, H, 12, "minecraft:stone_bricks").crenel(H, -H, H, H, 12, "minecraft:stone_bricks");
  // torres de canto: cilindros com cone de telhado
  for (const [cx, cz] of [[-H, -H], [H, -H], [-H, H], [H, H]]) {
    p.cyl(cx, cz, 5, 0, 17, "minecraft:stone_bricks", false);
    p.cyl(cx, cz, 4, 1, 16, "minecraft:air", false);
    for (let y = 4; y <= 14; y += 5) p.cyl(cx, cz, 4, y, y, "minecraft:spruce_planks", false);
    p.cyl(cx, cz, 5, 18, 18, "minecraft:stone_bricks", false);
    for (let k = 0; k <= 5; k++) p.cyl(cx, cz, 5 - k, 19 + k, 19 + k, "minecraft:deepslate_tiles", false);
    p.s(cx, 25, cz, "minecraft:lightning_rod");
    for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5]]) p.f(cx + dx, 8, cz + dz, cx + dx, 9, cz + dz, "minecraft:glass_pane");
  }
  // portão com grade e ponte levadiça
  p.f(-3, 1, -H - 1, 3, 9, -H + 1, "minecraft:polished_andesite");
  p.f(-2, 1, -H - 1, 2, 7, -H + 1, "minecraft:air");
  p.f(-2, 6, -H, 2, 7, -H, "minecraft:iron_bars");
  p.f(-2, 0, -H - 6, 2, 0, -H - 2, "minecraft:spruce_planks");
  for (const x of [-3, 3]) p.f(x, 1, -H - 6, x, 1, -H - 2, "minecraft:spruce_fence");
  p.crenel(-3, -H - 1, 3, -H + 1, 10, "minecraft:stone_bricks");
  // caminho até a torre de menagem
  p.f(-1, 0, -H + 1, 1, 0, 2, "minecraft:gravel");
  // torre de menagem mobiliada (sala do trono, quartos, biblioteca, dormitório) + ferreiro e estábulo
  stamp(p, archPlan("castelinho", "castelo", "grande", 0, seed, { bare: true }), 0, 9);
  stamp(p, archPlan("ferreiro", "medieval", "pequeno", 1, seed + 1, { bare: true }), -14, -9);
  stamp(p, archPlan("estabulo", "rustico", "pequeno", 3, seed + 2, { bare: true }), 14, -9);
  // tochas nas muralhas (pátio iluminado)
  for (let i = -H + 4; i <= H - 4; i += 6) {
    p.s(i, 13, -H + 1, "minecraft:lantern").s(i, 13, H - 1, "minecraft:lantern").s(-H + 1, 13, i, "minecraft:lantern").s(H - 1, 13, i, "minecraft:lantern");
  }
  p.chest(3, 1, -1, LOOT);
  return p;
}

// ------------------------------------------------------------------ casas (vila/cidade)
function cottage(p, ox, oz, wood, R) {
  const W = 3 + Math.floor(R() * 2), D = 3 + Math.floor(R() * 2);
  p.f(ox - W - 1, 0, oz - D - 1, ox + W + 1, 0, oz + D + 1, "minecraft:cobblestone");
  p.f(ox - W, 1, oz - D, ox + W, 4, oz + D, `minecraft:${wood}_planks`);
  p.f(ox - W + 1, 1, oz - D + 1, ox + W - 1, 4, oz + D - 1, "minecraft:air");
  for (const [x, z] of [[-W, -D], [W, -D], [-W, D], [W, D]]) p.f(ox + x, 1, oz + z, ox + x, 4, oz + z, `minecraft:${wood === "oak" ? "spruce" : "oak"}_log`);
  p.f(ox - 1, 1, oz - D, ox - 1, 2, oz - D, "minecraft:air");
  p.door(ox - 1, 1, oz - D, `minecraft:${wood === "oak" ? "wooden" : wood}_door`, "south");
  p.f(ox + 1, 2, oz - D, ox + 1, 3, oz - D, "minecraft:glass_pane");
  p.f(ox - W, 2, oz, ox - W, 3, oz, "minecraft:glass_pane").f(ox + W, 2, oz, ox + W, 3, oz, "minecraft:glass_pane");
  // telhado em degraus (cumeeira no eixo x)
  for (let k = 0; k <= D + 1; k++) {
    p.f(ox - W - 1, 5 + k, oz - D - 1 + k, ox + W + 1, 5 + k, oz - D - 1 + k, `minecraft:${wood === "oak" ? "dark_oak" : "spruce"}_planks`);
    p.f(ox - W - 1, 5 + k, oz + D + 1 - k, ox + W + 1, 5 + k, oz + D + 1 - k, `minecraft:${wood === "oak" ? "dark_oak" : "spruce"}_planks`);
    if (oz - D - 1 + k >= oz + D + 1 - k) break;
  }
  p.f(ox - W + 1, 5, oz - D + 1, ox + W - 1, 5 + D, oz + D - 1, "minecraft:air");
  p.s(ox, 4, oz, "minecraft:lantern", { hanging: true });
  p.s(ox + W - 1, 1, oz + D - 1, "minecraft:crafting_table").s(ox - W + 1, 1, oz + D - 1, "minecraft:barrel");
}

function lamp(p, x, z, h = 3) {
  p.f(x, 1, z, x, h, z, "minecraft:spruce_fence").s(x, h + 1, z, "minecraft:lantern");
}

function tree(p, x, z, y, R, kind = "oak") {
  const h = 4 + Math.floor(R() * 3);
  const leaves = { oak: "oak_leaves", birch: "birch_leaves", spruce: "spruce_leaves", cherry: "cherry_leaves", jungle: "jungle_leaves" }[kind];
  if (kind === "spruce") {
    for (let k = 0; k < 5; k++) p.cyl(x, z, Math.max(0, 3 - Math.floor(k * 0.7)), y + 2 + k * 2, y + 3 + k * 2, `minecraft:${leaves}`, false);
    p.f(x, y + 1, z, x, y + h + 4, z, "minecraft:spruce_log");
    return;
  }
  p.cyl(x, z, 2, y + h - 1, y + h, `minecraft:${leaves}`, false);
  p.cyl(x, z, 1, y + h + 1, y + h + 1, `minecraft:${leaves}`, false);
  p.f(x, y + 1, z, x, y + h, z, `minecraft:${kind}_log`);
}

// ------------------------------------------------------------------ vila
export function vila(seed = 11) {
  const R = rng(seed);
  const p = new P("vila", 40, 16);
  // ruas em cruz + anel
  p.f(-38, 0, -1, 38, 0, 1, "minecraft:grass_path").f(-1, 0, -38, 1, 0, 38, "minecraft:grass_path");
  for (const [x0, z0, x1, z1] of [[-24, -24, 24, -23], [-24, 23, 24, 24], [-24, -24, -23, 24], [23, -24, 24, 24]]) p.f(x0, 0, z0, x1, 0, z1, "minecraft:grass_path");
  // poço no meio
  for (const op of poco().ops) p.ops.push(op);
  const spots = [[-12, -12], [12, -12], [-12, 12], [12, 12], [-32, -10], [32, 10], [-10, 32], [10, -32], [-32, 14], [32, -14]];
  // casas e lojas do catálogo (mobiliadas por dentro), com a porta virada para o centro da vila
  const kinds = ["casa", "cabana", "padaria", "taverna", "ferreiro", "casa", "acougue", "livraria", "cabana", "casa_fazenda"];
  const styles = ["medieval", "rustico", "rural", "nordico"];
  spots.forEach(([x, z], i) => {
    const plan = archPlan(kinds[i % kinds.length], styles[Math.floor(R() * styles.length)], "pequeno", facingQuarter(x, z), i, { bare: true });
    stamp(p, plan, x, z);
  });
  // igreja de verdade (bancos, altar, velas, torre do sino) virada para a praça
  stamp(p, archPlan("igreja", "medieval", "pequeno", 0, 3, { bare: true }), 0, 33);
  // plantações com canal de água
  for (const [x0, z0] of [[18, 18], [-30, -30], [26, -34]]) {
    p.f(x0, 0, z0, x0 + 8, 0, z0 + 6, "minecraft:farmland", { moisturized_amount: 7 });
    p.f(x0, 1, z0, x0 + 8, 1, z0 + 6, "minecraft:wheat", { growth: 7 });
    p.f(x0 + 4, 0, z0, x0 + 4, 0, z0 + 6, "minecraft:water").f(x0 + 4, 1, z0, x0 + 4, 1, z0 + 6, "minecraft:air");
    p.walls(x0 - 1, 1, z0 - 1, x0 + 9, 1, z0 + 7, "minecraft:oak_fence");
  }
  for (let i = -36; i <= 36; i += 9) {
    lamp(p, i, 3);
    lamp(p, 3, i);
  }
  for (let k = 0; k < 14; k++) {
    const x = Math.floor(R() * 76) - 38, z = Math.floor(R() * 76) - 38;
    if (Math.abs(x) < 6 || Math.abs(z) < 6) continue;
    if (spots.some(([sx, sz]) => Math.abs(sx - x) < 8 && Math.abs(sz - z) < 8)) continue;
    tree(p, x, z, 0, R, R() < 0.5 ? "oak" : "birch");
  }
  return p;
}

// ------------------------------------------------------------------ cidade
export function cidade(seed = 5) {
  const R = rng(seed);
  const B = 24; // quarteirão
  const ST = 8; // rua
  const N = 4; // 4×4 quarteirões
  const span = N * B + (N + 1) * ST;
  const h = Math.floor(span / 2);
  const p = new P("cidade", h + 1, 80);
  p.f(-h, 0, -h, h, 0, h, "minecraft:black_concrete"); // asfalto
  const cell = (i) => -h + ST + i * (B + ST);
  // faixas amarelas tracejadas e postes
  for (let i = 0; i <= N; i++) {
    const c0 = -h + i * (B + ST) + Math.floor(ST / 2);
    for (let t = -h; t <= h; t += 4) {
      p.f(t, 0, c0, t + 1, 0, c0, "minecraft:yellow_concrete");
      p.f(c0, 0, t, c0, 0, t + 1, "minecraft:yellow_concrete");
    }
  }
  const kinds = ["sky", "apt", "office", "park", "houses", "sky", "apt", "office", "plaza"];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x0 = cell(i), z0 = cell(j), x1 = x0 + B - 1, z1 = z0 + B - 1;
      // calçada
      p.f(x0, 1, z0, x1, 1, z1, "minecraft:smooth_stone_slab");
      p.f(x0 + 2, 1, z0 + 2, x1 - 2, 1, z1 - 2, "minecraft:air");
      p.f(x0 + 2, 0, z0 + 2, x1 - 2, 0, z1 - 2, "minecraft:light_gray_concrete");
      for (const [lx, lz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [Math.floor((x0 + x1) / 2), z0], [Math.floor((x0 + x1) / 2), z1]]) {
        p.f(lx, 2, lz, lx, 6, lz, "minecraft:polished_blackstone_wall").s(lx, 7, lz, "minecraft:sea_lantern");
      }
      const k = (i === 1 && j === 1) || (i === 2 && j === 2) ? "plaza" : kinds[Math.floor(R() * kinds.length)];
      const ax = x0 + 3, az = z0 + 3, bx = x1 - 3, bz = z1 - 3;
      if (k === "sky" || k === "office" || k === "apt") {
        // prédios mobiliados do catálogo (apartamentos, escritórios, hotel, hospital, escola...)
        const mx = Math.floor((ax + bx) / 2), mz = Math.floor((az + bz) / 2);
        const opts = { bare: true, w: 17, d: 17 };
        let plan;
        if (k === "sky") {
          plan = archPlan("apartamento", R() < 0.5 ? "futurista" : "moderno", "grande", 0, i * 7 + j, { ...opts, floors: 10 + Math.floor(R() * 7), cycle: true, roof: "flat",
            program: [["recepcao", "sala"], ["sala", "cozinha", "quarto", "banheiro"], ["escritorio", "escritorio", "recepcao", "banheiro"]] });
        } else {
          const pick = (k === "office" ? ["hotel", "hospital", "banco", "prefeitura", "museu", "shopping"] : ["apartamento", "escola", "mercado", "cinema", "restaurante", "biblioteca"])[Math.floor(R() * 6)];
          plan = archPlan(pick, ["moderno", "colonial", "industrial", "futurista", "colorido"][Math.floor(R() * 5)], "medio", 0, i * 7 + j, opts);
        }
        stamp(p, plan, mx, mz);
      } else if (k === "park" || k === "plaza") {
        p.f(ax, 0, az, bx, 0, bz, k === "park" ? "minecraft:grass_block" : "minecraft:polished_andesite");
        const mx = Math.floor((ax + bx) / 2), mz = Math.floor((az + bz) / 2);
        p.cyl(mx, mz, 4, 1, 1, "minecraft:quartz_block", false).cyl(mx, mz, 3, 1, 1, "minecraft:water", false);
        p.f(mx, 1, mz, mx, 3, mz, "minecraft:quartz_pillar").s(mx, 4, mz, "minecraft:water");
        if (k === "park") {
          for (const [tx, tz] of [[ax + 2, az + 2], [bx - 2, az + 2], [ax + 2, bz - 2], [bx - 2, bz - 2], [ax + 2, mz], [bx - 2, mz]]) tree(p, tx, tz, 0, R, R() < 0.5 ? "oak" : "birch");
          p.f(mx - 1, 0, az, mx + 1, 0, bz, "minecraft:gravel");
        }
      } else if (k === "houses") {
        for (const [hx, hz] of [[ax + 4, az + 4], [bx - 4, az + 4], [ax + 4, bz - 4], [bx - 4, bz - 4]]) {
          stamp(p, archPlan(R() < 0.5 ? "casa" : "bangalo", ["moderno", "colorido", "colonial", "praiano"][Math.floor(R() * 4)], "pequeno", hz < (az + bz) / 2 ? 0 : 2, hx * 31 + hz, { bare: true, w: 9, d: 9 }), hx, hz);
        }
      }
    }
  }
  return p;
}

// ------------------------------------------------------------------ montanha-russa
const RAIL = { N: 4, S: 5, E: 2, W: 3 }; // trilho "subindo para" a direção
const STEP = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** Caminho fechado: retângulo com morros. Cada ponto: {x,y,z,dir}. */
export function coasterPath() {
  /** @type {[string, number, (i:number)=>number][]} */
  const segs = [
    // direção, comprimento, perfil de altura (relativo ao início do trecho, por bloco)
    ["E", 34, (i) => (i < 8 ? 0 : i < 21 ? i - 7 : 13)],
    ["S", 22, (i) => (i < 2 ? 0 : i < 13 ? -(i - 1) : i < 17 ? -11 : -11 + (i - 16))],
    ["W", 34, (i) => (i < 2 ? 0 : i < 7 ? -(i - 1) : i < 20 ? -5 : i < 24 ? -5 + (i - 19) : i < 29 ? -1 - (i - 23) : -6)],
    ["N", 22, (i) => (i >= 18 ? -1 : 0)],
  ];
  const pts = [];
  let x = 0, y = 1, z = 0;
  for (const [dir, len, prof] of segs) {
    const y0 = y;
    for (let i = 0; i < len; i++) {
      y = y0 + prof(i);
      pts.push({ x, y, z, dir });
      const [dx, dz] = STEP[dir];
      x += dx;
      z += dz;
    }
  }
  return pts;
}

export function montanha_russa() {
  const pts = coasterPath();
  const minX = Math.min(...pts.map((q) => q.x)), maxX = Math.max(...pts.map((q) => q.x));
  const minZ = Math.min(...pts.map((q) => q.z)), maxZ = Math.max(...pts.map((q) => q.z));
  const cx = Math.floor((minX + maxX) / 2), cz = Math.floor((minZ + maxZ) / 2);
  const p = new P("montanha-russa", Math.ceil(Math.max(maxX - minX, maxZ - minZ) / 2) + 6, 20);
  const n = pts.length;
  const colors = ["red", "orange", "yellow", "lime", "light_blue", "magenta"];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], prev = pts[(i - 1 + n) % n];
    const x = a.x - cx, z = a.z - cz;
    let rail = "minecraft:rail", st = {};
    const turning = prev.dir !== a.dir;
    const powered = !turning && (i % 3 === 0 || (b.y > a.y));
    if (turning) {
      // curva: liga a direção de onde veio (oposta) com a nova
      const from = { N: "S", S: "N", E: "W", W: "E" }[prev.dir];
      const key = [from, a.dir].sort().join("");
      st = { rail_direction: { ES: 6, SW: 7, NW: 8, EN: 9 }[key] ?? 0 };
    } else if (b.y > a.y) st = { rail_direction: RAIL[a.dir] };
    else if (prev.y > a.y && prev.dir === a.dir) st = { rail_direction: RAIL[{ N: "S", S: "N", E: "W", W: "E" }[a.dir]] };
    else st = { rail_direction: a.dir === "N" || a.dir === "S" ? 0 : 1 };
    if (powered && !turning) {
      rail = "minecraft:golden_rail";
      st = { rail_direction: st.rail_direction, rail_data_bit: true };
    }
    const support = rail === "minecraft:golden_rail" ? "minecraft:redstone_block" : `minecraft:${colors[Math.floor(i / 6) % colors.length]}_concrete`;
    p.s(x, a.y - 1, z, support);
    if (a.y > 1) p.f(x, 0, z, x, a.y - 2, z, "minecraft:polished_blackstone_wall");
    p.s(x, a.y, z, rail, st);
  }
  // estação
  const s0 = pts[2];
  p.f(s0.x - cx, 0, s0.z - cz - 4, s0.x - cx + 6, 0, s0.z - cz - 1, "minecraft:polished_andesite");
  p.f(s0.x - cx, 1, s0.z - cz - 4, s0.x - cx, 4, s0.z - cz - 4, "minecraft:spruce_log").f(s0.x - cx + 6, 1, s0.z - cz - 4, s0.x - cx + 6, 4, s0.z - cz - 4, "minecraft:spruce_log");
  p.f(s0.x - cx - 1, 5, s0.z - cz - 5, s0.x - cx + 7, 5, s0.z - cz + 1, "minecraft:red_concrete");
  p.s(s0.x - cx + 3, 4, s0.z - cz - 2, "minecraft:lantern", { hanging: true });
  p.e(s0.x - cx + 0.5, s0.y, s0.z - cz + 0.5, "minecraft:minecart");
  return p;
}

// ------------------------------------------------------------------ casa inteligente
export function casa_tech() {
  const p = new P("casa inteligente", 16, 16);
  const m = archPlan("mansao", "moderno", "grande", 0, 21, { bare: true, roof: "flat" });
  const W = 11, D = 8, top = 12;
  p.f(-W - 4, 0, -D - 7, W + 4, 0, D + 4, "minecraft:smooth_quartz");
  stamp(p, m, 0, 0);
  // piscina iluminada na frente
  p.f(-W - 3, -3, -D - 7, -2, 0, -D - 2, "minecraft:prismarine");
  p.f(-W - 2, -2, -D - 6, -3, 0, -D - 3, "minecraft:water");
  for (let x = -W - 2; x <= -3; x += 3) p.s(x, -3, -D - 4, "minecraft:sea_lantern");
  for (let x = -W - 1; x <= -4; x += 3) p.s(x, 1, -D - 7, "minecraft:white_carpet");
  // placas solares e câmeras no telhado
  for (let x = -W + 2; x <= W - 2; x += 2) p.f(x, top + 1, -D + 2, x, top + 1, -1, "minecraft:daylight_detector");
  for (const [x, z] of [[-W, -D], [W, -D], [W, D], [-W, D]]) p.s(x, top + 2, z, "minecraft:observer", { "minecraft:facing_direction": "down" });
  // luzes do jardim que acendem sozinhas à noite (sensor invertido em cima da lâmpada)
  for (let x = 1; x <= W + 3; x += 4) p.s(x, 1, -D - 4, "minecraft:redstone_lamp").s(x, 2, -D - 4, "minecraft:daylight_detector_inverted");
  for (let x = 3; x <= W + 3; x += 4) p.s(x, 1, -D - 6, "minecraft:flowering_azalea");
  return p;
}

// ------------------------------------------------------------------ montanha
export function montanha(seed = 9) {
  const R = rng(seed);
  const RAD = 34, TOP = 46;
  const p = new P("montanha", RAD + 2, TOP + 8, false);
  const ph = [R() * 6.28, R() * 6.28, R() * 6.28];
  for (let x = -RAD; x <= RAD; x++) {
    for (let z = -RAD; z <= RAD; z++) {
      const r = Math.hypot(x, z) / RAD;
      if (r > 1) continue;
      const a = Math.atan2(z, x);
      const ridge = 0.78 + 0.12 * Math.sin(a * 3 + ph[0]) + 0.07 * Math.sin(a * 7 + ph[1]) + 0.05 * Math.sin(x * 0.3 + z * 0.2 + ph[2]);
      const hgt = Math.round(TOP * Math.pow(1 - r, 1.35) * ridge);
      if (hgt < 1) continue;
      const surf = hgt > TOP * 0.72 ? "minecraft:snow" : hgt > TOP * 0.5 ? (R() < 0.6 ? "minecraft:stone" : "minecraft:andesite") : hgt > TOP * 0.42 ? "minecraft:gravel" : "minecraft:grass_block";
      p.f(x, 1, z, x, hgt - 1, z, "minecraft:stone");
      p.s(x, hgt, z, surf);
      if (surf === "minecraft:snow") p.s(x, hgt + 1, z, "minecraft:snow_layer");
      if (surf === "minecraft:grass_block" && R() < 0.03 && r > 0.35) tree(p, x, z, hgt, R, "spruce");
    }
  }
  // cachoeira de um lado
  p.s(0, Math.round(TOP * 0.55), -Math.round(RAD * 0.38), "minecraft:water");
  return p;
}

// ------------------------------------------------------------------ pirâmide
export function piramide() {
  const p = new P("pirâmide", 23, 24);
  const B = 21;
  for (let k = 0; k <= B; k++) {
    const s = B - k;
    p.f(-s, k + 1, -s, s, k + 1, s, k % 4 === 3 ? "minecraft:chiseled_sandstone" : "minecraft:smooth_sandstone");
  }
  p.f(-B + 3, 1, -B + 3, B - 3, 9, B - 3, "minecraft:air");
  p.f(-B + 3, 0, -B + 3, B - 3, 0, B - 3, "minecraft:cut_sandstone");
  p.f(-1, 1, -B - 1, 1, 4, -B + 3, "minecraft:air"); // entrada
  p.f(-2, 1, -B, 2, 5, -B, "minecraft:cut_sandstone").f(-1, 1, -B, 1, 4, -B, "minecraft:air");
  p.f(-3, 0, -3, 3, 0, 3, "minecraft:gold_block").f(-2, 0, -2, 2, 0, 2, "minecraft:lapis_block");
  p.chest(0, 1, 2, LOOT);
  // câmara do faraó: colunas, sarcófago, braseiros, baús e potes decorados
  for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8], [-8, 0], [8, 0]]) p.f(x, 1, z, x, 8, z, "minecraft:cut_sandstone").s(x, 9, z, "minecraft:chiseled_sandstone");
  p.f(-1, 1, 6, 1, 1, 9, "minecraft:quartz_block").f(-1, 2, 6, 1, 2, 9, "minecraft:smooth_quartz_slab").s(0, 2, 9, "minecraft:carved_pumpkin", { "minecraft:cardinal_direction": "north" });
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 10], [4, 10]]) p.s(x, 1, z, "minecraft:campfire", { "minecraft:cardinal_direction": "north", extinguished: false });
  for (const [x, z] of [[-12, 12], [12, 12], [-12, -12], [12, -12]]) p.chest(x, 1, z, [["minecraft:gold_ingot", 16], ["minecraft:emerald", 8]]).s(x + (x > 0 ? -1 : 1), 1, z, "minecraft:decorated_pot");
  for (const [x, z] of [[-B + 4, -B + 4], [B - 4, -B + 4], [-B + 4, B - 4], [B - 4, B - 4]]) p.s(x, 1, z, "minecraft:lantern");
  for (let x = -B + 4; x <= B - 4; x += 6) p.s(x, 8, 0, "minecraft:lantern", { hanging: true });
  p.s(0, B + 2, 0, "minecraft:gold_block");
  return p;
}

// ------------------------------------------------------------------ farol
export function farol() {
  const p = new P("farol", 8, 40);
  p.cyl(0, 0, 7, 0, 0, "minecraft:stone_bricks", false);
  for (let y = 1; y <= 30; y += 4) p.cyl(0, 0, 4, y, y + 3, y % 8 === 1 ? "minecraft:red_concrete" : "minecraft:white_concrete");
  p.cyl(0, 0, 3, 1, 30, "minecraft:air", false);
  for (let y = 1; y <= 30; y++) p.s(3, y, 0, "minecraft:ladder", { facing_direction: 4 });
  // quarto do faroleiro: cama, baú, mesa e lanterna
  p.s(-2, 1, 1, "minecraft:bed", { direction: 0, head_piece_bit: false }, [0, 0, 1, { direction: 0, head_piece_bit: true }]);
  p.chest(-2, 1, -1, [["minecraft:cod", 8], ["minecraft:empty_map", 1]]).s(0, 1, -2, "minecraft:lectern", { "minecraft:cardinal_direction": "south" }).s(0, 4, 0, "minecraft:lantern", { hanging: true });
  p.f(4, 1, -1, 4, 3, 1, "minecraft:air").f(4, 1, 0, 4, 2, 0, "minecraft:air");
  p.cyl(0, 0, 6, 31, 31, "minecraft:polished_andesite", false).cyl(0, 0, 6, 32, 32, "minecraft:iron_bars");
  p.cyl(0, 0, 3, 32, 35, "minecraft:glass");
  p.cyl(0, 0, 2, 32, 35, "minecraft:air", false);
  p.f(-1, 32, -1, 1, 34, 1, "minecraft:sea_lantern").s(0, 33, 0, "minecraft:glowstone");
  for (let k = 0; k <= 3; k++) p.cyl(0, 0, 4 - k, 36 + k, 36 + k, "minecraft:red_concrete", false);
  p.s(0, 40, 0, "minecraft:lightning_rod");
  return p;
}

// ------------------------------------------------------------------ arranha-céu
export function arranha_ceu() {
  const p = new P("arranha-céu", 12, 128);
  const A = 9, F = 30, top = F * 4;
  p.f(-A - 2, 0, -A - 2, A + 2, 0, A + 2, "minecraft:polished_andesite");
  stamp(p, archPlan("apartamento", "futurista", "grande", 0, 30, { bare: true, w: 19, d: 19, floors: F, cycle: true, roof: "flat",
    program: [["recepcao", "sala"], ["escritorio", "escritorio", "recepcao", "banheiro"], ["sala", "cozinha", "quarto", "banheiro"]] }), 0, 0);
  // heliponto
  p.f(-A, top + 1, -A, A, top + 1, A, "minecraft:gray_concrete");
  p.f(-5, top + 1, -5, 5, top + 1, 5, "minecraft:yellow_concrete").f(-4, top + 1, -4, 4, top + 1, 4, "minecraft:gray_concrete");
  p.f(-2, top + 1, -3, -2, top + 1, 3, "minecraft:white_concrete").f(2, top + 1, -3, 2, top + 1, 3, "minecraft:white_concrete").f(-1, top + 1, 0, 1, top + 1, 0, "minecraft:white_concrete");
  p.f(A - 1, top + 2, A - 1, A - 1, top + 8, A - 1, "minecraft:iron_bars").s(A - 1, top + 9, A - 1, "minecraft:redstone_lamp");
  p.height = top + 12;
  return p;
}

// ------------------------------------------------------------------ estádio
export function estadio() {
  const p = new P("estádio", 44, 16);
  const a = 40, b = 28, tiers = 10;
  for (let x = -a - tiers; x <= a + tiers; x++) {
    for (let z = -b - tiers; z <= b + tiers; z++) {
      const r = Math.hypot(x / a, z / b);
      if (r <= 0.78) {
        p.s(x, 0, z, (Math.floor((x + 100) / 4) % 2 === 0) ? "minecraft:grass_block" : "minecraft:moss_block");
      } else if (r <= 1) {
        p.s(x, 0, z, "minecraft:red_concrete"); // pista
      } else {
        const t = Math.min(tiers, Math.floor((r - 1) * Math.min(a, b)) + 1);
        p.f(x, 1, z, x, t, z, t % 2 ? "minecraft:white_concrete" : "minecraft:light_blue_concrete");
        if (t >= tiers) p.f(x, tiers + 1, z, x, tiers + 3, z, "minecraft:gray_concrete");
      }
    }
  }
  // linhas do campo
  const fa = Math.floor(a * 0.62), fb = Math.floor(b * 0.62);
  p.f(-fa, 0, -fb, fa, 0, -fb, "minecraft:white_concrete").f(-fa, 0, fb, fa, 0, fb, "minecraft:white_concrete");
  p.f(-fa, 0, -fb, -fa, 0, fb, "minecraft:white_concrete").f(fa, 0, -fb, fa, 0, fb, "minecraft:white_concrete");
  p.f(0, 0, -fb, 0, 0, fb, "minecraft:white_concrete");
  p.cyl(0, 0, 6, 0, 0, "minecraft:white_concrete");
  for (const x of [-fa, fa]) p.f(x, 1, -3, x, 3, 3, "minecraft:white_stained_glass_pane");
  // torres de luz
  for (const [x, z] of [[-a, -b], [a, -b], [-a, b], [a, b]]) {
    p.f(x, 1, z, x, 15, z, "minecraft:iron_block");
    p.f(x - 1, 16, z - 1, x + 1, 16, z + 1, "minecraft:sea_lantern");
  }
  return p;
}

export const PLANS = { poco, labirinto, castelo, vila, cidade, montanha_russa, casa_tech, montanha, piramide, farol, arranha_ceu, estadio };

/** Quantos blocos uma planta mexe (estimativa, para a barra de progresso). */
export function volume(plan) {
  let n = 0;
  for (const op of plan.ops) {
    if (op[0] === "f") n += (op[4] - op[1] + 1) * (op[5] - op[2] + 1) * (op[6] - op[3] + 1);
    else if (op[0] === "s") n++;
  }
  return n;
}
