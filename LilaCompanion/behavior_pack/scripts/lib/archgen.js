// Gerador de construções (2.2) — puro e testável em Node.
// Mais de 1000 construções diferentes = TIPO (casa, padaria, escola, hospital, igreja, celeiro,
// farol, estufa...) × ESTILO (medieval, moderno, japonês, futurista, gótico, nórdico...) ×
// TAMANHO (pequeno, médio, grande) + OBJETOS/decorações (fonte, estátua, poste, banco...) × estilo.
// Tudo com interior arrumado: cada cômodo recebe móveis do seu tipo (quarto com cama e criado,
// cozinha com fogão/pia/armários, sala com sofá e TV, loja com balcão e prateleiras de mercadoria,
// sala de aula com carteiras e lousa, igreja com bancos e altar...). Escada de mão entre andares,
// portas com as duas metades, janelas, telhado do estilo, caminho e luzes na entrada.
//
// Saída no mesmo formato das megaconstruções (lib/megaplans.js):
//   ["f", x0,y0,z0, x1,y1,z1, bloco, estados?]   ["s", x,y,z, bloco, estados?, par?]
//   ["e", x,y,z, entidade]                      ["c", x,y,z, [[item, qtd], ...]]
// "par" = segundo bloco colocado junto (metade de cima da porta, cabeceira da cama): [dx,dy,dz, estados].
import { rng } from "./megaplans.js";

const M = (s) => `minecraft:${s}`;

// ------------------------------------------------------------------ estilos
const style = (key, name, o) => ({ key, name, lightMode: "hang", roof: "gable", bigWindows: false, ...o });
export const STYLES = [
  style("medieval", "Medieval", { wall: M("cobblestone"), pillar: M("oak_log"), floor: M("oak_planks"), roofS: M("spruce_stairs"), roofB: M("spruce_planks"), roofSl: M("spruce_slab"), glass: M("glass_pane"), wood: "oak", trim: M("stone_bricks"), base: M("cobblestone"), path: M("gravel"), carpet: M("red_carpet"), light: M("lantern") }),
  style("rustico", "Rústico (cabana)", { wall: M("spruce_planks"), pillar: M("spruce_log"), floor: M("dark_oak_planks"), roofS: M("dark_oak_stairs"), roofB: M("dark_oak_planks"), roofSl: M("dark_oak_slab"), glass: M("glass_pane"), wood: "spruce", trim: M("cobblestone"), base: M("cobblestone"), path: M("grass_path"), carpet: M("brown_carpet"), light: M("lantern") }),
  style("moderno", "Moderno", { wall: M("white_concrete"), pillar: M("light_gray_concrete"), floor: M("smooth_quartz"), roofS: M("smooth_stone_slab"), roofB: M("smooth_stone"), roofSl: M("smooth_stone_slab"), glass: M("glass"), wood: "birch", trim: M("black_concrete"), base: M("smooth_stone"), path: M("polished_andesite"), carpet: M("light_gray_carpet"), light: M("sea_lantern"), lightMode: "ceiling", roof: "flat", bigWindows: true }),
  style("futurista", "Futurista", { wall: M("quartz_block"), pillar: M("light_blue_concrete"), floor: M("polished_diorite"), roofS: M("quartz_stairs"), roofB: M("quartz_block"), roofSl: M("quartz_slab"), glass: M("light_blue_stained_glass"), wood: "warped", trim: M("prismarine_bricks"), base: M("quartz_block"), path: M("smooth_quartz"), carpet: M("cyan_carpet"), light: M("sea_lantern"), lightMode: "ceiling", roof: "dome", bigWindows: true }),
  style("japones", "Japonês", { wall: M("white_terracotta"), pillar: M("dark_oak_log"), floor: M("bamboo_planks"), roofS: M("deepslate_tile_stairs"), roofB: M("deepslate_tiles"), roofSl: M("deepslate_tile_slab"), glass: M("white_stained_glass_pane"), wood: "cherry", trim: M("dark_oak_planks"), base: M("stone_bricks"), path: M("gravel"), carpet: M("green_carpet"), light: M("lantern"), roof: "pagoda" }),
  style("desertico", "Desértico", { wall: M("sandstone"), pillar: M("cut_sandstone"), floor: M("smooth_sandstone"), roofS: M("sandstone_stairs"), roofB: M("smooth_sandstone"), roofSl: M("sandstone_slab"), glass: M("glass_pane"), wood: "jungle", trim: M("chiseled_sandstone"), base: M("sandstone"), path: M("sand"), carpet: M("orange_carpet"), light: M("lantern"), roof: "flat" }),
  style("nordico", "Nórdico", { wall: M("spruce_planks"), pillar: M("spruce_log"), floor: M("spruce_planks"), roofS: M("spruce_stairs"), roofB: M("spruce_planks"), roofSl: M("spruce_slab"), glass: M("glass_pane"), wood: "spruce", trim: M("stone_bricks"), base: M("stone_bricks"), path: M("cobblestone"), carpet: M("white_carpet"), light: M("lantern") }),
  style("tropical", "Tropical", { wall: M("bamboo_planks"), pillar: M("jungle_log"), floor: M("jungle_planks"), roofS: M("bamboo_stairs"), roofB: M("bamboo_planks"), roofSl: M("bamboo_slab"), glass: M("glass_pane"), wood: "bamboo", trim: M("jungle_planks"), base: M("mud_bricks"), path: M("sand"), carpet: M("lime_carpet"), light: M("lantern") }),
  style("gotico", "Gótico", { wall: M("deepslate_bricks"), pillar: M("polished_deepslate"), floor: M("polished_blackstone"), roofS: M("deepslate_tile_stairs"), roofB: M("deepslate_tiles"), roofSl: M("deepslate_tile_slab"), glass: M("purple_stained_glass_pane"), wood: "dark_oak", trim: M("chiseled_deepslate"), base: M("cobbled_deepslate"), path: M("cobbled_deepslate"), carpet: M("purple_carpet"), light: M("soul_lantern") }),
  style("colonial", "Colonial", { wall: M("brick_block"), pillar: M("quartz_pillar"), floor: M("oak_planks"), roofS: M("spruce_stairs"), roofB: M("spruce_planks"), roofSl: M("spruce_slab"), glass: M("glass_pane"), wood: "oak", trim: M("quartz_block"), base: M("stone_bricks"), path: M("stone_bricks"), carpet: M("blue_carpet"), light: M("lantern"), roof: "hip" }),
  style("castelo", "Castelo", { wall: M("stone_bricks"), pillar: M("chiseled_stone_bricks"), floor: M("spruce_planks"), roofS: M("stone_brick_stairs"), roofB: M("stone_bricks"), roofSl: M("stone_brick_slab"), glass: M("iron_bars"), wood: "spruce", trim: M("mossy_stone_bricks"), base: M("cobblestone"), path: M("cobblestone"), carpet: M("red_carpet"), light: M("lantern"), roof: "crenel" }),
  style("nether", "Infernal (Nether)", { wall: M("nether_brick"), pillar: M("crimson_stem"), floor: M("crimson_planks"), roofS: M("nether_brick_stairs"), roofB: M("nether_brick"), roofSl: M("nether_brick_slab"), glass: M("red_stained_glass_pane"), wood: "crimson", trim: M("red_nether_brick"), base: M("blackstone"), path: M("blackstone"), carpet: M("red_carpet"), light: M("soul_lantern") }),
  style("gelo", "Gelo", { wall: M("packed_ice"), pillar: M("blue_ice"), floor: M("snow"), roofS: M("packed_ice"), roofB: M("packed_ice"), roofSl: M("snow_layer"), glass: M("light_blue_stained_glass_pane"), wood: "spruce", trim: M("snow"), base: M("packed_ice"), path: M("snow"), carpet: M("white_carpet"), light: M("sea_lantern"), lightMode: "ceiling", roof: "dome" }),
  style("mansao", "Mansão", { wall: M("quartz_bricks"), pillar: M("dark_oak_log"), floor: M("dark_oak_planks"), roofS: M("dark_oak_stairs"), roofB: M("dark_oak_planks"), roofSl: M("dark_oak_slab"), glass: M("glass_pane"), wood: "dark_oak", trim: M("polished_andesite"), base: M("stone_bricks"), path: M("polished_andesite"), carpet: M("red_carpet"), light: M("lantern"), roof: "hip" }),
  style("rural", "Rural (fazenda)", { wall: M("oak_planks"), pillar: M("stripped_oak_log"), floor: M("spruce_planks"), roofS: M("spruce_stairs"), roofB: M("spruce_planks"), roofSl: M("spruce_slab"), glass: M("glass_pane"), wood: "oak", trim: M("hay_block"), base: M("cobblestone"), path: M("grass_path"), carpet: M("yellow_carpet"), light: M("lantern") }),
  style("praiano", "Praiano", { wall: M("birch_planks"), pillar: M("birch_log"), floor: M("smooth_sandstone"), roofS: M("prismarine_bricks_stairs"), roofB: M("prismarine_bricks"), roofSl: M("prismarine_brick_slab"), glass: M("glass_pane"), wood: "birch", trim: M("white_concrete"), base: M("sandstone"), path: M("sand"), carpet: M("light_blue_carpet"), light: M("lantern") }),
  style("steampunk", "Steampunk", { wall: M("waxed_cut_copper"), pillar: M("polished_basalt"), floor: M("spruce_planks"), roofS: M("waxed_cut_copper_stairs"), roofB: M("waxed_cut_copper"), roofSl: M("waxed_cut_copper_slab"), glass: M("glass_pane"), wood: "spruce", trim: M("polished_blackstone_bricks"), base: M("polished_blackstone_bricks"), path: M("polished_blackstone_bricks"), carpet: M("brown_carpet"), light: M("lantern") }),
  style("elfico", "Élfico (floresta)", { wall: M("mangrove_planks"), pillar: M("mangrove_log"), floor: M("mangrove_planks"), roofS: M("cherry_stairs"), roofB: M("azalea_leaves"), roofSl: M("cherry_slab"), glass: M("lime_stained_glass_pane"), wood: "mangrove", trim: M("moss_block"), base: M("mossy_stone_bricks"), path: M("moss_block"), carpet: M("moss_carpet"), light: M("lantern"), roof: "dome" }),
  style("industrial", "Industrial", { wall: M("polished_andesite"), pillar: M("stripped_spruce_log"), floor: M("smooth_stone"), roofS: M("andesite_stairs"), roofB: M("smooth_stone"), roofSl: M("smooth_stone_slab"), glass: M("glass_pane"), wood: "spruce", trim: M("stone_bricks"), base: M("cobblestone"), path: M("gravel"), carpet: M("gray_carpet"), light: M("lantern"), roof: "flat" }),
  style("colorido", "Colorido", { wall: M("light_blue_terracotta"), pillar: M("white_concrete"), floor: M("birch_planks"), roofS: M("red_nether_brick_stairs"), roofB: M("red_nether_brick"), roofSl: M("red_nether_brick_slab"), glass: M("yellow_stained_glass_pane"), wood: "acacia", trim: M("orange_terracotta"), base: M("white_concrete"), path: M("smooth_stone"), carpet: M("magenta_carpet"), light: M("lantern"), roof: "hip" }),
  style("savana", "Savana", { wall: M("acacia_planks"), pillar: M("acacia_log"), floor: M("hardened_clay"), roofS: M("acacia_stairs"), roofB: M("acacia_planks"), roofSl: M("acacia_slab"), glass: M("glass_pane"), wood: "acacia", trim: M("orange_terracotta"), base: M("red_sandstone"), path: M("red_sand"), carpet: M("orange_carpet"), light: M("lantern"), roof: "hip" }),
];
export const SIZES = [{ key: "pequeno", name: "Pequeno", k: 0 }, { key: "medio", name: "Médio", k: 1 }, { key: "grande", name: "Grande", k: 2 }];

/** Peças de madeira do estilo (o carvalho tem nomes diferentes no Bedrock). */
function W(wood, kind) {
  if (wood === "oak") return { door: M("wooden_door"), trapdoor: M("trapdoor"), plate: M("wooden_pressure_plate"), button: M("wooden_button"), fence_gate: M("fence_gate") }[kind] ?? M(`oak_${kind}`);
  if (wood === "bamboo" && kind === "log") return M("bamboo_block");
  if ((wood === "crimson" || wood === "warped") && kind === "log") return M(`${wood}_stem`);
  return M(`${wood}_${kind === "plate" ? "pressure_plate" : kind}`);
}

// ------------------------------------------------------------------ direções e estados
const DIR = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPP = { N: "S", S: "N", E: "W", W: "E" };
const CARD = { N: "north", S: "south", E: "east", W: "west" };
const STAIR = { E: 0, W: 1, S: 2, N: 3 };          // weirdo_direction: lado do encosto (onde sobe)
const BEDD = { S: 0, W: 1, N: 2, E: 3 };           // direction da cama: do pé para a cabeceira
const FACE = { N: 2, S: 3, W: 4, E: 5 };           // facing_direction (escada de mão, barril...)
const stair = (d, up = false) => ({ weirdo_direction: STAIR[d], upside_down_bit: up });
const slabTop = { "minecraft:vertical_half": "top" };

class Plan {
  constructor(name) {
    this.name = name;
    this.ops = [];
    this.half = 6;
    this.height = 10;
    this.clear = true;
    this.loot = [];
  }
  f(x0, y0, z0, x1, y1, z1, b, st) {
    this.ops.push(["f", Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), b, st]);
    return this;
  }
  s(x, y, z, b, st, pair) {
    this.ops.push(pair ? ["s", x, y, z, b, st, pair] : st ? ["s", x, y, z, b, st] : ["s", x, y, z, b]);
    return this;
  }
  walls(x0, y0, z0, x1, y1, z1, b) {
    return this.f(x0, y0, z0, x1, y1, z0, b).f(x0, y0, z1, x1, y1, z1, b).f(x0, y0, z0, x0, y1, z1, b).f(x1, y0, z0, x1, y1, z1, b);
  }
  e(x, y, z, id) {
    this.ops.push(["e", x, y, z, id]);
    return this;
  }
  chest(x, y, z, d, loot) {
    this.s(x, y, z, M("chest"), { "minecraft:cardinal_direction": CARD[d] });
    if (loot?.length) this.ops.push(["c", x, y, z, loot]);
    return this;
  }
  door(x, y, z, id, d) {
    const st = { "minecraft:cardinal_direction": CARD[d], upper_block_bit: false };
    return this.s(x, y, z, id, st, [0, 1, 0, { ...st, upper_block_bit: true }]);
  }
  /** cama: cabeceira em (x,z) encostada na parede do lado d; pé um bloco para dentro. */
  bed(x, y, z, d) {
    const [dx, dz] = DIR[d];
    const dir = BEDD[d];
    return this.s(x - dx, y, z - dz, M("bed"), { direction: dir, head_piece_bit: false }, [dx, 0, dz, { direction: dir, head_piece_bit: true }]);
  }
  cyl(cx, cz, r, y0, y1, b, hollow = true) {
    for (let x = -r; x <= r; x++) {
      for (let z = -r; z <= r; z++) {
        const d = Math.hypot(x, z);
        if (d > r + 0.4 || (hollow && d < r - 0.6)) continue;
        this.f(cx + x, y0, cz + z, cx + x, y1, cz + z, b);
      }
    }
    return this;
  }
}

// ------------------------------------------------------------------ cômodos e móveis
/** Lados de um cômodo (células encostadas na parede), sem as da frente das portas e reservadas. */
function sides(room, reserved) {
  const out = [];
  const ok = (x, z) => !reserved.has(`${x},${z}`);
  const mk = (d, cells) => ({ d, cells: cells.filter(([x, z]) => ok(x, z)) });
  const xs = [], xs2 = [], zs = [], zs2 = [];
  for (let x = room.x0; x <= room.x1; x++) {
    xs.push([x, room.z1]);
    xs2.push([x, room.z0]);
  }
  for (let z = room.z0 + 1; z <= room.z1 - 1; z++) {
    zs.push([room.x1, z]);
    zs2.push([room.x0, z]);
  }
  out.push(mk("S", xs), mk("N", xs2), mk("E", zs), mk("W", zs2));
  return out.sort((a, b) => b.cells.length - a.cells.length);
}

function takeRun(side, n) {
  // pega n células seguidas (o maior trecho contínuo) de um lado
  const c = side.cells;
  let best = [], cur = [];
  for (let i = 0; i < c.length; i++) {
    const prev = cur[cur.length - 1];
    if (prev && Math.abs(c[i][0] - prev[0]) + Math.abs(c[i][1] - prev[1]) === 1) cur.push(c[i]);
    else cur = [c[i]];
    if (cur.length > best.length) best = cur.slice();
  }
  const run = best.slice(0, n);
  side.cells = c.filter((x) => !run.includes(x));
  return run;
}

function center(room) {
  return [Math.round((room.x0 + room.x1) / 2), Math.round((room.z0 + room.z1) / 2)];
}

function light(p, st, room, y, top) {
  const [cx, cz] = center(room);
  if (st.lightMode === "ceiling") p.s(cx, top, cz, st.light);
  else p.s(cx, top - 1, cz, st.light === M("soul_lantern") ? M("soul_lantern") : M("lantern"), { hanging: true });
  if ((room.x1 - room.x0) >= 6 || (room.z1 - room.z0) >= 6) {
    const qx = Math.round((room.x0 + cx) / 2), qz = Math.round((room.z0 + cz) / 2);
    if (st.lightMode === "ceiling") p.s(qx, top, qz, st.light);
    else p.s(qx, top - 1, qz, M("lantern"), { hanging: true });
  }
}

function rug(p, st, room, y, reserved) {
  const [cx, cz] = center(room);
  for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) {
    if (x > room.x0 && x < room.x1 && z > room.z0 && z < room.z1 && !reserved.has(`${x},${z}`)) p.s(x, y, z, st.carpet);
  }
}

function table(p, st, x, y, z, chairs, R) {
  p.s(x, y, z, W(st.wood, "fence")).s(x, y + 1, z, R() < 0.5 ? W(st.wood, "plate") : st.carpet);
  for (const d of chairs) {
    const [dx, dz] = DIR[d];
    p.s(x + dx, y, z + dz, W(st.wood, "stairs"), stair(d)); // encosto para fora, assento virado pra mesa
  }
}

/** Mobília por tipo de cômodo. y = piso do cômodo (móveis em y+1), top = teto. */
const FURN = {
  quarto(p, st, room, y, top, res, R) {
    const S = sides(room, res);
    const s0 = S[0];
    const run = takeRun(s0, 3);
    if (run.length >= 3) {
      const [bx, bz] = run[1];
      p.bed(bx, y + 1, bz, s0.d);
      for (const [x, z] of [run[0], run[2]]) p.s(x, y + 1, z, M("barrel"), { facing_direction: 1 }).s(x, y + 2, z, M("lantern"));
    } else if (run.length) p.bed(run[0][0], y + 1, run[0][1], s0.d);
    const s1 = S[1];
    const r1 = takeRun(s1, 3);
    const items = [[M("chest"), true], [M("bookshelf")], [M("decorated_pot")]];
    r1.forEach(([x, z], i) => {
      const [id, isChest] = items[i % items.length];
      if (isChest) p.chest(x, y + 1, z, OPP[s1.d], [["minecraft:bread", 8]]);
      else p.s(x, y + 1, z, id);
    });
    rug(p, st, room, y + 1, res);
    light(p, st, room, y, top);
  },
  cozinha(p, st, room, y, top, res, R) {
    const S = sides(room, res);
    const s0 = S[0];
    const kit = [[M("smoker"), "card"], [M("furnace"), "card"], [M("cauldron"), "water"], [M("crafting_table")], [M("barrel"), "up"], [M("barrel"), "up"]];
    takeRun(s0, 6).forEach(([x, z], i) => {
      const [id, kind] = kit[i % kit.length];
      if (kind === "card") p.s(x, y + 1, z, id, { "minecraft:cardinal_direction": CARD[OPP[s0.d]] });
      else if (kind === "water") p.s(x, y + 1, z, id, { cauldron_liquid: "water", fill_level: 6 });
      else if (kind === "up") p.s(x, y + 1, z, id, { facing_direction: 1 });
      else p.s(x, y + 1, z, id);
      if (top - y >= 4) p.s(x, y + 3, z, M("barrel"), { facing_direction: FACE[OPP[s0.d]] }); // armários em cima
    });
    const [cx, cz] = center(room);
    if (room.x1 - room.x0 >= 3 && room.z1 - room.z0 >= 3) {
      p.s(cx, y + 1, cz, W(st.wood, "fence")).s(cx, y + 2, cz, M("cake"));
      for (const d of ["E", "W"]) {
        const [dx, dz] = DIR[d];
        if (!res.has(`${cx + dx},${cz + dz}`)) p.s(cx + dx, y + 1, cz + dz, W(st.wood, "stairs"), stair(d));
      }
    }
    light(p, st, room, y, top);
  },
  sala(p, st, room, y, top, res, R) {
    const S = sides(room, res);
    const s0 = S[0];
    takeRun(s0, 3).forEach(([x, z]) => p.s(x, y + 1, z, W(st.wood, "stairs"), stair(s0.d))); // sofá
    const opp = S.find((s) => s.d === OPP[s0.d]) ?? S[1];
    const tv = takeRun(opp, 2);
    for (const [x, z] of tv) p.s(x, y + 1, z, W(st.wood, "slab"), slabTop).s(x, y + 2, z, M("black_concrete"));
    const s2 = S.find((s) => s !== s0 && s !== opp && s.cells.length);
    if (s2) takeRun(s2, 3).forEach(([x, z], i) => p.s(x, y + 1, z, [M("bookshelf"), M("jukebox"), M("decorated_pot")][i % 3]));
    rug(p, st, room, y + 1, res);
    light(p, st, room, y, top);
  },
  jantar(p, st, room, y, top, res, R) {
    const [cx, cz] = center(room);
    const long = room.x1 - room.x0 >= room.z1 - room.z0;
    for (let k = -1; k <= 1; k++) {
      const x = long ? cx + k : cx, z = long ? cz : cz + k;
      if (x <= room.x0 || x >= room.x1 || z <= room.z0 || z >= room.z1) continue;
      table(p, st, x, y + 1, z, long ? ["N", "S"] : ["E", "W"], R);
    }
    const S = sides(room, res);
    takeRun(S[0], 2).forEach(([x, z]) => p.s(x, y + 1, z, M("barrel"), { facing_direction: 1 }));
    light(p, st, room, y, top);
  },
  banheiro(p, st, room, y, top, res) {
    const S = sides(room, res);
    const s0 = S[0];
    const run = takeRun(s0, 3);
    if (run[0]) p.s(run[0][0], y + 1, run[0][1], M("quartz_stairs"), stair(s0.d));                  // vaso
    if (run[1]) p.s(run[1][0], y + 1, run[1][1], M("cauldron"), { cauldron_liquid: "water", fill_level: 6 }); // pia
    if (run[2]) p.s(run[2][0], y + 1, run[2][1], M("light_blue_stained_glass")).s(run[2][0], y + 2, run[2][1], M("light_blue_stained_glass")); // box
    for (let x = room.x0; x <= room.x1; x++) for (let z = room.z0; z <= room.z1; z++) {
      if (!res.has(`${x},${z}`) && !run.some((c) => c[0] === x && c[1] === z)) p.s(x, y + 1, z, M("white_carpet"));
    }
    light(p, st, room, y, top);
  },
  escritorio(p, st, room, y, top, res, R) {
    const S = sides(room, res);
    takeRun(S[0], 4).forEach(([x, z], i) => p.s(x, y + 1, z, i % 2 ? M("bookshelf") : M("lectern"), i % 2 ? undefined : { "minecraft:cardinal_direction": CARD[OPP[S[0].d]] }));
    const [cx, cz] = center(room);
    p.s(cx, y + 1, cz, W(st.wood, "slab"), slabTop).s(cx + 1 <= room.x1 ? cx + 1 : cx - 1, y + 1, cz, W(st.wood, "slab"), slabTop);
    p.s(cx, y + 1, cz + 1 <= room.z1 ? cz + 1 : cz - 1, W(st.wood, "stairs"), stair("S"));
    takeRun(S[1], 2).forEach(([x, z]) => p.s(x, y + 1, z, M("cartography_table")));
    light(p, st, room, y, top);
  },
  biblioteca(p, st, room, y, top, res, R) {
    for (const s of sides(room, res)) for (const [x, z] of s.cells) p.f(x, y + 1, z, x, Math.min(top - 1, y + 3), z, M("bookshelf"));
    const [cx, cz] = center(room);
    if (!res.has(`${cx},${cz}`)) p.s(cx, y + 1, cz, M("enchanting_table"));
    if (room.x1 - room.x0 >= 4) table(p, st, cx - 2, y + 1, cz, ["N", "S"], R);
    if (room.x1 - room.x0 >= 4) p.s(cx + 2, y + 1, cz, M("lectern"), { "minecraft:cardinal_direction": "north" });
    light(p, st, room, y, top);
  },
  loja(p, st, room, y, top, res, R, goods) {
    // balcão na frente da parede do fundo, prateleiras de mercadoria atrás e nas laterais
    const g = GOODS[goods] ?? GOODS.geral;
    const zc = room.z1 - 2;
    if (zc > room.z0) {
      for (let x = room.x0; x <= room.x1 - 1; x++) if (!res.has(`${x},${zc}`)) p.s(x, y + 1, x === room.x0 + 1 ? zc : zc, g.counter ?? W(st.wood, "planks"));
      p.s(room.x0 + 1, y + 2, zc, M("bell"), { attachment: "standing", direction: 0 });
    }
    for (let x = room.x0; x <= room.x1; x++) {
      const id = g.back[(x - room.x0) % g.back.length];
      if (id === "chest") p.chest(x, y + 1, room.z1, "N", g.loot);
      else p.s(x, y + 1, room.z1, id, g.backSt);
      if (top - y >= 4) p.s(x, y + 2, room.z1, g.back2 ?? M("barrel"), g.back2 ? undefined : { facing_direction: 2 });
    }
    for (const s of sides({ ...room, z1: zc - 1 }, res)) {
      if (s.d === "S" || s.d === "N") continue;
      s.cells.forEach(([x, z], i) => {
        if (i % 2 === 0) p.s(x, y + 1, z, g.side[i % g.side.length]);
      });
    }
    if (g.extra) g.extra(p, st, room, y, R);
    light(p, st, room, y, top);
  },
  salao(p, st, room, y, top, res, R, what = "igreja") {
    // fileiras de assentos virados para a frente (lado do fundo = palco/altar/lousa/tela)
    const front = room.z1;
    for (let z = room.z0 + 1; z <= front - 3; z += 2) {
      for (let x = room.x0 + 1; x <= room.x1 - 1; x++) {
        if (x === Math.round((room.x0 + room.x1) / 2)) continue; // corredor
        p.s(x, y + 1, z, W(st.wood, "stairs"), stair("N"));
        if (what === "escola") p.s(x, y + 1, z + 1, W(st.wood, "slab"), slabTop);
      }
    }
    const cx = Math.round((room.x0 + room.x1) / 2);
    if (what === "igreja") {
      p.f(room.x0 + 1, y + 1, front - 1, room.x1 - 1, y + 1, front, M("quartz_block"));
      p.s(cx, y + 2, front - 1, M("gold_block")).s(cx - 1, y + 2, front - 1, M("candle"), { candles: 3, lit: true }).s(cx + 1, y + 2, front - 1, M("candle"), { candles: 3, lit: true });
      for (let z = room.z0; z <= front; z++) p.s(cx, y + 1, z, M("red_carpet"));
    } else if (what === "escola") {
      p.f(cx - 2, y + 2, front, cx + 2, y + 3 <= top - 1 ? y + 3 : y + 2, front, M("green_concrete"));
      p.s(cx, y + 1, front - 1, M("lectern"), { "minecraft:cardinal_direction": "north" });
    } else if (what === "teatro") {
      p.f(room.x0, y + 1, front - 2, room.x1, y + 1, front, W(st.wood, "planks"));
      p.f(room.x0, y + 2, front, room.x1, top - 1, front, M("red_wool"));
      p.s(room.x0, y + 2, front - 2, M("red_wool")).s(room.x1, y + 2, front - 2, M("red_wool"));
    } else if (what === "cinema") {
      p.f(room.x0 + 1, y + 2, front, room.x1 - 1, top - 1, front, M("white_concrete"));
    } else if (what === "trono") {
      p.f(cx - 1, y + 1, front - 1, cx + 1, y + 1, front, M("gold_block"));
      p.s(cx, y + 2, front, M("quartz_stairs"), stair("S"));
      for (let z = room.z0; z <= front - 2; z++) p.s(cx, y + 1, z, M("red_carpet"));
    }
    light(p, st, room, y, top);
  },
  dormitorio(p, st, room, y, top, res, R) {
    for (const s of sides(room, res).slice(0, 2)) {
      if (s.d !== "E" && s.d !== "W" && s.d !== "N" && s.d !== "S") continue;
      s.cells.forEach(([x, z], i) => {
        if (i % 2 === 0) p.bed(x, y + 1, z, s.d);
      });
    }
    light(p, st, room, y, top);
  },
  celas(p, st, room, y, top, res, R) {
    const zb = room.z1 - 2;
    for (let x = room.x0; x <= room.x1; x++) p.f(x, y + 1, zb, x, top - 1, zb, M("iron_bars"));
    for (let x = room.x0 + 2; x < room.x1; x += 3) {
      p.f(x, y + 1, zb + 1, x, top - 1, room.z1, M("iron_bars"));
    }
    for (let x = room.x0; x <= room.x1; x += 3) {
      p.bed(x, y + 1, room.z1, "S");
      if (x + 1 <= room.x1) p.s(x + 1, y + 1, room.z1, M("cauldron"));
      p.s(x + (x + 1 <= room.x1 ? 1 : 0), y + 1, zb, M("air")); // porta da cela (vão)
    }
    light(p, st, room, y, top);
  },
  deposito(p, st, room, y, top, res, R) {
    for (let x = room.x0; x <= room.x1; x += 2) {
      for (let z = room.z0 + 1; z <= room.z1 - 1; z++) {
        if (res.has(`${x},${z}`)) continue;
        if ((z - room.z0) % 4 === 0) continue;
        p.s(x, y + 1, z, R() < 0.5 ? M("barrel") : M("chest"), R() < 0.5 ? { facing_direction: 1 } : { "minecraft:cardinal_direction": "east" });
        if (top - y >= 4) p.s(x, y + 2, z, M("barrel"), { facing_direction: 1 });
      }
    }
    light(p, st, room, y, top);
  },
  oficina(p, st, room, y, top, res, R) {
    const kit = [M("crafting_table"), M("smithing_table"), M("anvil"), M("grindstone"), M("stonecutter_block"), M("fletching_table"), M("loom"), M("cartography_table")];
    let i = 0;
    for (const s of sides(room, res)) for (const [x, z] of s.cells) {
      const id = kit[i++ % kit.length];
      const stt = id === M("anvil") || id === M("stonecutter_block") ? { "minecraft:cardinal_direction": CARD[OPP[s.d]] }
        : id === M("grindstone") ? { attachment: "standing", direction: 0 } : undefined;
      if (i % 2) p.s(x, y + 1, z, id, stt);
    }
    light(p, st, room, y, top);
  },
  lab(p, st, room, y, top, res, R) {
    let i = 0;
    for (const s of sides(room, res)) for (const [x, z] of s.cells) {
      const k = i++ % 4;
      if (k === 0) p.s(x, y + 1, z, M("brewing_stand"));
      else if (k === 1) p.s(x, y + 1, z, M("cauldron"), { cauldron_liquid: "water", fill_level: 6 });
      else if (k === 2) p.s(x, y + 1, z, M("glass")).s(x, y + 2, z, M("glass"));
      else p.s(x, y + 1, z, M("crafting_table"));
    }
    const [cx, cz] = center(room);
    p.s(cx, y + 1, cz, M("enchanting_table"));
    light(p, st, room, y, top);
  },
  academia(p, st, room, y, top, res, R) {
    const [cx, cz] = center(room);
    for (let x = room.x0 + 1; x <= room.x1 - 1; x += 2) for (let z = room.z0 + 1; z <= room.z1 - 1; z += 3) {
      if (res.has(`${x},${z}`)) continue;
      p.s(x, y + 1, z, R() < 0.5 ? M("iron_block") : M("anvil"), R() < 0.5 ? undefined : { "minecraft:cardinal_direction": "north" });
      if (z + 1 <= room.z1) p.s(x, y + 1, z + 1, M("black_carpet"));
    }
    p.s(cx, y + 1, room.z1, M("jukebox"));
    light(p, st, room, y, top);
  },
  museu(p, st, room, y, top, res, R) {
    const show = [M("diamond_block"), M("emerald_block"), M("gold_block"), M("amethyst_block"), M("beacon"), M("lodestone"), M("lapis_block"), M("copper_block")];
    let i = 0;
    for (let x = room.x0 + 1; x <= room.x1 - 1; x += 3) for (let z = room.z0 + 1; z <= room.z1 - 1; z += 3) {
      if (res.has(`${x},${z}`)) continue;
      p.s(x, y + 1, z, st.trim).s(x, y + 2, z, show[i++ % show.length]);
    }
    light(p, st, room, y, top);
  },
  recepcao(p, st, room, y, top, res, R) {
    const zc = room.z1 - 1;
    for (let x = room.x0 + 1; x <= room.x1 - 1; x++) if (!res.has(`${x},${zc}`)) p.s(x, y + 1, zc, W(st.wood, "planks"));
    p.s(room.x0 + 1, y + 2, zc, M("bell"), { attachment: "standing", direction: 0 });
    const S = sides({ ...room, z1: zc - 1 }, res).filter((s) => s.d === "E" || s.d === "W");
    for (const s of S) takeRun(s, 2).forEach(([x, z]) => p.s(x, y + 1, z, W(st.wood, "stairs"), stair(s.d)));
    rug(p, st, room, y + 1, res);
    light(p, st, room, y, top);
  },
  cofre(p, st, room, y, top, res, R) {
    for (const s of sides(room, res)) s.cells.forEach(([x, z], i) => {
      p.s(x, y + 1, z, [M("gold_block"), M("diamond_block"), M("emerald_block")][i % 3]);
      if (i % 3 === 1) p.s(x, y + 2, z, M("gold_block"));
    });
    const [cx, cz] = center(room);
    p.chest(cx, y + 1, cz, "N", [["minecraft:gold_ingot", 32], ["minecraft:emerald", 16], ["minecraft:diamond", 8]]);
    light(p, st, room, y, top);
  },
  baias(p, st, room, y, top, res, R) {
    // estábulo/celeiro: baias com cerca e portão, feno e bebedouro
    for (let x = room.x0; x <= room.x1; x += 3) {
      p.f(x, y + 1, room.z1 - 3, x, y + 1, room.z1, W(st.wood, "fence"));
      if (x + 1 <= room.x1) p.s(x + 1, y + 1, room.z1, M("hay_block"));
      if (x + 2 <= room.x1) p.s(x + 2, y + 1, room.z1, M("cauldron"), { cauldron_liquid: "water", fill_level: 6 });
    }
    for (let x = room.x0; x <= room.x1; x++) if (!res.has(`${x},${room.z1 - 4}`) && (x - room.x0) % 3 !== 0) p.s(x, y + 1, room.z1 - 4, W(st.wood, "fence_gate"), { "minecraft:cardinal_direction": "north", in_wall_bit: false, open_bit: false });
    light(p, st, room, y, top);
  },
  estufa(p, st, room, y, top, res, R) {
    const crops = [[M("wheat"), { growth: 7 }], [M("carrots"), { growth: 7 }], [M("potatoes"), { growth: 7 }], [M("beetroot"), { growth: 7 }]];
    for (let x = room.x0; x <= room.x1; x++) {
      const water = (x - room.x0) % 4 === 2;
      for (let z = room.z0 + 1; z <= room.z1 - 1; z++) {
        if (res.has(`${x},${z}`)) continue;
        if (water) p.s(x, y, z, M("water"));
        else {
          const [id, s] = crops[Math.floor((x - room.x0) / 4) % crops.length];
          p.s(x, y, z, M("farmland"), { moisturized_amount: 7 }).s(x, y + 1, z, id, s);
        }
      }
    }
    light(p, st, room, y, top);
  },
  vazio(p, st, room, y, top) {
    light(p, st, room, y, top);
  },
};

// mercadoria das lojas
const GOODS = {
  geral: { back: ["chest", M("barrel")], side: [M("barrel"), M("pumpkin"), M("melon_block"), M("hay_block")], loot: [["minecraft:apple", 16], ["minecraft:bread", 16]] },
  padaria: { back: [M("smoker"), "chest", M("hay_block")], side: [M("hay_block"), M("cake"), M("barrel")], loot: [["minecraft:bread", 32], ["minecraft:cookie", 32], ["minecraft:cake", 2]], backSt: { "minecraft:cardinal_direction": "north" } },
  acougue: { back: [M("smoker"), "chest"], side: [M("barrel"), M("smoker")], loot: [["minecraft:cooked_beef", 24], ["minecraft:cooked_porkchop", 24], ["minecraft:cooked_chicken", 16]], backSt: { "minecraft:cardinal_direction": "north" } },
  armas: { back: [M("blast_furnace"), "chest", M("anvil")], side: [M("grindstone"), M("smithing_table")], loot: [["minecraft:iron_sword", 2], ["minecraft:bow", 2], ["minecraft:arrow", 32], ["minecraft:iron_chestplate", 1]], backSt: { "minecraft:cardinal_direction": "north" }, extra: (p, st, room, y) => p.e(room.x0 + 1, y + 1, room.z0 + 1, M("armor_stand")) },
  farmacia: { back: [M("brewing_stand"), "chest", M("cauldron")], side: [M("brewing_stand"), M("barrel")], loot: [["minecraft:glass_bottle", 16], ["minecraft:golden_apple", 2], ["minecraft:honey_bottle", 8]] },
  livraria: { back: [M("bookshelf")], back2: M("bookshelf"), side: [M("bookshelf"), M("lectern")], loot: [["minecraft:book", 16]] },
  taverna: { back: [M("barrel"), M("barrel"), "chest"], side: [M("barrel")], loot: [["minecraft:honey_bottle", 16], ["minecraft:cooked_salmon", 16]], extra: (p, st, room, y, R) => { const [cx, cz] = center(room); table(p, st, cx, y + 1, cz - 1, ["E", "W", "N"], R); } },
  restaurante: { back: [M("smoker"), M("furnace"), "chest"], side: [M("barrel")], loot: [["minecraft:cooked_beef", 16], ["minecraft:pumpkin_pie", 8], ["minecraft:mushroom_stew", 4]], backSt: { "minecraft:cardinal_direction": "north" }, extra: (p, st, room, y, R) => { const [cx, cz] = center(room); table(p, st, cx - 2 >= room.x0 + 1 ? cx - 2 : cx, y + 1, cz - 1, ["E", "W"], R); if (cx + 2 < room.x1) table(p, st, cx + 2, y + 1, cz - 1, ["E", "W"], R); } },
  cafeteria: { back: [M("cauldron"), "chest", M("smoker")], side: [M("cake"), M("barrel")], loot: [["minecraft:cookie", 32], ["minecraft:pumpkin_pie", 8]], extra: (p, st, room, y, R) => { const [cx, cz] = center(room); table(p, st, cx, y + 1, cz - 1, ["E", "W"], R); } },
  banco: { back: [M("iron_block"), "chest"], counter: M("iron_bars"), side: [M("gold_block")], loot: [["minecraft:gold_ingot", 16], ["minecraft:emerald", 16]] },
  joalheria: { back: ["chest", M("glass")], side: [M("diamond_block"), M("emerald_block"), M("gold_block"), M("amethyst_block")], counter: M("glass"), loot: [["minecraft:diamond", 4], ["minecraft:emerald", 8], ["minecraft:gold_ingot", 8]] },
  roupas: { back: [M("loom"), "chest"], side: [M("white_wool"), M("red_wool"), M("blue_wool"), M("yellow_wool")], loot: [["minecraft:leather_chestplate", 2], ["minecraft:leather_boots", 2]], backSt: { direction: 0 }, extra: (p, st, room, y) => { p.e(room.x0 + 1, y + 1, room.z0 + 1, M("armor_stand")); p.e(room.x1 - 1, y + 1, room.z0 + 1, M("armor_stand")); } },
  mercado: { back: ["chest", M("barrel"), M("hay_block")], side: [M("pumpkin"), M("melon_block"), M("hay_block"), M("barrel"), M("dried_kelp_block")], loot: [["minecraft:apple", 32], ["minecraft:carrot", 32], ["minecraft:bread", 32]] },
  barbearia: { back: [M("cauldron"), "chest"], side: [M("quartz_stairs")], loot: [["minecraft:shears", 2]] },
  correio: { back: [M("barrel"), "chest", M("lectern")], side: [M("barrel")], loot: [["minecraft:paper", 32], ["minecraft:book", 8]] },
  ferragem: { back: [M("anvil"), "chest", M("grindstone")], side: [M("iron_block"), M("barrel")], loot: [["minecraft:iron_ingot", 32], ["minecraft:iron_pickaxe", 2]], backSt: { "minecraft:cardinal_direction": "north" } },
  pet: { back: [M("barrel"), "chest"], side: [M("hay_block"), M("composter")], loot: [["minecraft:bone", 16], ["minecraft:wheat", 32]], extra: (p, st, room, y) => p.e(room.x0 + 1, y + 1, room.z0 + 1, M("cat")) },
  flores: { back: [M("decorated_pot"), "chest"], side: [M("flowering_azalea"), M("azalea"), M("decorated_pot")], loot: [["minecraft:poppy", 16], ["minecraft:cornflower", 16]] },
  brinquedos: { back: ["chest", M("jukebox"), M("noteblock")], side: [M("noteblock"), M("target")], loot: [["minecraft:firework_rocket", 16], ["minecraft:snowball", 16]] },
};

// ------------------------------------------------------------------ planta baixa
/** Divide o andar em cômodos (retângulos internos) e diz onde ficam as portas internas. */
function layout(hw, hd, n) {
  const X0 = -hw + 1, X1 = hw - 1, Z0 = -hd + 1, Z1 = hd - 1;
  const rooms = [], walls = [], doors = [];
  if (n <= 1) rooms.push({ x0: X0, x1: X1, z0: Z0, z1: Z1 });
  else if (n === 2) {
    rooms.push({ x0: X0, x1: -1, z0: Z0, z1: Z1 }, { x0: 1, x1: X1, z0: Z0, z1: Z1 });
    walls.push([0, Z0, 0, Z1]);
    doors.push([0, Math.min(Z1 - 1, Z0 + 2)]);
  } else if (n === 3) {
    rooms.push({ x0: X0, x1: -1, z0: Z0, z1: Z1 }, { x0: 1, x1: X1, z0: Z0, z1: -1 }, { x0: 1, x1: X1, z0: 1, z1: Z1 });
    walls.push([0, Z0, 0, Z1], [1, 0, X1, 0]);
    doors.push([0, Z0 + 1], [0, Math.max(1, Z1 - 1)]);
  } else if (n === 4) {
    rooms.push({ x0: X0, x1: -1, z0: Z0, z1: -1 }, { x0: 1, x1: X1, z0: Z0, z1: -1 }, { x0: X0, x1: -1, z0: 1, z1: Z1 }, { x0: 1, x1: X1, z0: 1, z1: Z1 });
    walls.push([0, Z0, 0, Z1], [X0, 0, X1, 0]);
    doors.push([0, Math.round(Z0 / 2)], [0, Math.round(Z1 / 2)], [Math.round(X0 / 2), 0]);
  } else {
    // corredor no meio (x de -1 a 1) com cômodos dos dois lados
    const left = Math.ceil(n / 2), right = n - left;
    walls.push([-2, Z0, -2, Z1], [2, Z0, 2, Z1]);
    const split = (cnt, xa, xb, wx, side) => {
      const len = Z1 - Z0 + 1;
      for (let i = 0; i < cnt; i++) {
        const za = Z0 + Math.floor((len * i) / cnt), zb = Z0 + Math.floor((len * (i + 1)) / cnt) - 1;
        const room = { x0: xa, x1: xb, z0: i ? za + 1 : za, z1: zb };
        if (room.z1 < room.z0) continue;
        rooms.push(room);
        if (i) walls.push([xa, za, xb, za]);
        doors.push([wx, Math.round((room.z0 + room.z1) / 2)]);
      }
    };
    split(left, X0, -3, -2, -1);
    split(right, 3, X1, 2, 1);
    rooms.push({ x0: -1, x1: 1, z0: Z0, z1: Z1, corridor: true });
  }
  return { rooms, walls, doors };
}

// ------------------------------------------------------------------ prédio genérico
/**
 * @param {Plan} p
 * @param {any} st estilo
 * @param {{w:number,d:number,floors:number,program:string[][],goods?:string,hall?:string,openFront?:boolean,glassRoof?:boolean,roof?:string,
 *   storey?:number,glassWalls?:boolean,bigWindows?:boolean,doorX?:number}} o
 */
function building(p, st, o, R) {
  const hw = Math.floor(o.w / 2), hd = Math.floor(o.d / 2);
  const H = o.storey ?? 4;
  const F = o.floors;
  const top = F * H;
  const roofKind = o.roof ?? st.roof;
  // base e piso
  p.f(-hw, 0, -hd, hw, 0, hd, st.base);
  const ladder = [-hw + 1, hd - 1];
  for (let f = 0; f < F; f++) {
    const y = f * H;
    const yT = y + H;
    if (f > 0) {
      p.f(-hw, y, -hd, hw, y, hd, st.floor);
      p.s(ladder[0], y, ladder[1], M("ladder"), { facing_direction: FACE.N }); // a escada atravessa o piso
    } else p.f(-hw + 1, 0, -hd + 1, hw - 1, 0, hd - 1, st.floor);
    // paredes externas, pilares nos cantos, faixa entre andares
    p.walls(-hw, y + 1, -hd, hw, yT - 1, hd, o.glassWalls ? M("glass") : st.wall);
    for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) p.f(x, y + 1, z, x, yT, z, st.pillar, pillarSt(st.pillar));
    if (f > 0) p.walls(-hw, y, -hd, hw, y, hd, st.trim);
    // cômodos do andar
    const plan = o.program[Math.min(f, o.program.length - 1)];
    const L = layout(hw, hd, plan.length);
    for (const [xa, za, xb, zb] of L.walls) p.f(xa, y + 1, za, xb, yT - 1, zb, st.wall === M("glass") ? M("white_concrete") : interiorWall(st));
    const reserved = new Set();
    for (const [x, z] of L.doors) {
      p.f(x, y + 1, z, x, y + 2, z, M("air"));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) reserved.add(`${x + dx},${z + dz}`);
    }
    // escada de mão entre andares (canto do fundo à esquerda)
    if (F > 1) {
      reserved.add(`${ladder[0]},${ladder[1]}`).add(`${ladder[0] + 1},${ladder[1]}`).add(`${ladder[0]},${ladder[1] - 1}`);
      if (f < F - 1) {
        p.f(ladder[0], y + 1, ladder[1], ladder[0], yT, ladder[1], M("ladder"), { facing_direction: FACE.N });
      }
    }
    // porta da frente (térreo) e "porta" de saída no topo de prédios com terraço
    let doorX = 0;
    if (f === 0) {
      const r0 = L.rooms[0];
      doorX = plan.length >= 2 && plan.length <= 4 ? Math.round((r0.x0 + r0.x1) / 2) : 0;
      if (o.openFront) {
        p.f(-hw + 1, 1, -hd, hw - 1, Math.min(yT - 1, 3), -hd, M("air"));
      } else {
        p.door(doorX, 1, -hd, W(st.wood, "door"), "S");
        reserved.add(`${doorX},${-hd + 1}`);
      }
      o.doorX = doorX;
    }
    if (f > 0) p.s(ladder[0], y, ladder[1], M("ladder"), { facing_direction: FACE.N });
    // janelas
    windows(p, st, hw, hd, y, yT, L.walls, f === 0 ? doorX : null, o);
    // mobília
    plan.forEach((kind, i) => {
      const room = L.rooms[i];
      if (!room || kind === "-") return;
      const fn = FURN[kind.split(":")[0]];
      const arg = kind.split(":")[1];
      try {
        fn?.(p, st, room, y, yT, reserved, R, arg ?? (kind === "loja" ? o.goods : kind === "salao" ? o.hall : undefined));
      } catch {
        /* um móvel que não coube não derruba a construção */
      }
    });
    const corr = L.rooms.find((r) => r.corridor);
    if (corr) {
      for (let z = corr.z0; z <= corr.z1; z++) if (!reserved.has(`0,${z}`)) p.s(0, y + 1, z, st.carpet);
      light(p, st, corr, y, yT);
    }
  }
  roof(p, st, hw, hd, top, roofKind, o);
  // entrada: caminho, luzes, degrau
  const dx = o.doorX ?? 0;
  for (let z = -hd - 1; z >= -p.half; z--) p.s(dx, 0, z, st.path);
  if (p.half >= hd + 2) {
    const lamp = st.light === M("soul_lantern") ? M("soul_lantern") : M("lantern");
    p.s(dx - 2, 1, -hd - 2, W(st.wood, "fence")).s(dx - 2, 2, -hd - 2, lamp);
    p.s(dx + 2, 1, -hd - 2, W(st.wood, "fence")).s(dx + 2, 2, -hd - 2, lamp);
  }
  return { hw, hd, top, doorX: dx };
}

const pillarSt = (id) => (/(_log|_stem|basalt|pillar|bamboo_block)$/.test(id) ? { pillar_axis: "y" } : undefined);
const interiorWall = (st) => (st.wall.includes("ice") || st.wall.includes("copper") ? W(st.wood, "planks") : st.wall);

function windows(p, st, hw, hd, y, yT, inner, doorX, o) {
  const tall = st.bigWindows || o.bigWindows;
  const y1 = tall ? yT - 1 : y + 2;
  const avoid = new Set();
  for (const [xa, za, xb, zb] of inner) {
    avoid.add(`x${xa}`).add(`x${xb}`).add(`z${za}`).add(`z${zb}`);
  }
  for (let x = -hw + 2; x <= hw - 2; x += 2) {
    if (avoid.has(`x${x}`) || (doorX !== null && Math.abs(x - doorX) <= 1)) continue;
    p.f(x, y + 2, -hd, x, y1, -hd, st.glass);
    p.f(x, y + 2, hd, x, y1, hd, st.glass);
  }
  for (let z = -hd + 2; z <= hd - 2; z += 2) {
    if (avoid.has(`z${z}`)) continue;
    p.f(-hw, y + 2, z, -hw, y1, z, st.glass);
    p.f(hw, y + 2, z, hw, y1, z, st.glass);
  }
}

function roof(p, st, hw, hd, top, kind, o) {
  const stairsOk = st.roofS.endsWith("_stairs");
  if (kind === "gable" && stairsOk) {
    // duas águas: caimento para frente e para trás, cumeeira ao longo de x, oitões fechados
    let i = 0;
    for (; ; i++) {
      const zf = -hd - 1 + i, zb = hd + 1 - i;
      const y = top + i;
      if (zf > zb) break;
      if (zf === zb) {
        p.f(-hw - 1, y, zf, hw + 1, y, zf, st.roofSl);
        break;
      }
      p.f(-hw - 1, y, zf, hw + 1, y, zf, st.roofS, stair("S"));
      p.f(-hw - 1, y, zb, hw + 1, y, zb, st.roofS, stair("N"));
      if (zb - zf >= 2) {
        p.f(-hw, y, zf + 1, -hw, y, zb - 1, st.wall);
        p.f(hw, y, zf + 1, hw, y, zb - 1, st.wall);
      }
    }
    p.height = Math.max(p.height, top + i + 3);
  } else if ((kind === "hip" || kind === "pagoda") && stairsOk) {
    const over = kind === "pagoda" ? 2 : 1;
    let ax = hw + over, az = hd + over, y = top;
    while (ax >= 0 && az >= 0) {
      if (ax === 0 || az === 0) {
        p.f(-ax, y, -az, ax, y, az, st.roofB);
        break;
      }
      p.f(-ax, y, -az, ax, y, -az, st.roofS, stair("S"));
      p.f(-ax, y, az, ax, y, az, st.roofS, stair("N"));
      p.f(-ax, y, -az + 1, -ax, y, az - 1, st.roofS, stair("E"));
      p.f(ax, y, -az + 1, ax, y, az - 1, st.roofS, stair("W"));
      if (kind === "pagoda" && y === top) for (const [x, z] of [[-ax, -az], [ax, -az], [-ax, az], [ax, az]]) p.s(x, y + 1, z, st.roofSl);
      ax--;
      az--;
      y++;
    }
    p.f(-hw + 1, top, -hd + 1, hw - 1, top, hd - 1, st.roofB);
    p.height = Math.max(p.height, y + 3);
  } else if (kind === "dome") {
    const r = Math.min(hw, hd) + 1;
    p.f(-hw, top, -hd, hw, top, hd, st.roofB, st.roofB.includes("leaves") ? { persistent_bit: true } : undefined);
    for (let yy = 1; yy <= r; yy++) {
      const rr = Math.sqrt(Math.max(0, r * r - yy * yy));
      for (let x = -hw; x <= hw; x++) for (let z = -hd; z <= hd; z++) {
        const d = Math.hypot(x * r / Math.max(1, hw), z * r / Math.max(1, hd));
        if (d <= rr + 0.5 && d > rr - 0.9) {
          const id = yy >= r - 1 && !st.roofB.includes("leaves") ? (st.key === "futurista" ? M("light_blue_stained_glass") : st.roofB) : st.roofB;
          p.s(x, top + yy, z, id, id.includes("leaves") ? { persistent_bit: true } : undefined);
        }
      }
    }
    p.height = Math.max(p.height, top + r + 3);
  } else {
    // telhado plano (laje + platibanda); castelo ganha ameias
    p.f(-hw, top, -hd, hw, top, hd, st.roofB);
    p.walls(-hw, top + 1, -hd, hw, top + 1, hd, kind === "crenel" ? st.wall : st.trim);
    if (kind === "crenel") {
      for (let x = -hw; x <= hw; x += 2) p.s(x, top + 2, -hd, st.wall).s(x, top + 2, hd, st.wall);
      for (let z = -hd; z <= hd; z += 2) p.s(-hw, top + 2, z, st.wall).s(hw, top + 2, z, st.wall);
    } else if (o.w >= 9) {
      p.s(hw - 2, top + 1, hd - 2, M("iron_block")).s(hw - 3, top + 1, hd - 2, M("iron_block")); // ar-condicionado / caixa d'água
    }
    p.height = Math.max(p.height, top + 4);
  }
}

// ------------------------------------------------------------------ tipos
const T = (key, name, cat, words, o) => ({ key, name, cat, words, ...o });
const sz = (a, b, c) => [a, b, c];
export const CATEGORIES = [
  { key: "casas", name: "Casas e moradias" }, { key: "comercio", name: "Lojas e comércio" }, { key: "publico", name: "Prédios públicos" },
  { key: "rural", name: "Fazenda e campo" }, { key: "lazer", name: "Lazer, torres e especiais" }, { key: "objetos", name: "Objetos e decorações (pequenos)" },
];
export const TYPES = [
  // casas
  T("casa", "Casa", "casas", ["casa", "casinha", "residencia", "lar"], { w: sz(9, 11, 15), d: sz(9, 11, 13), floors: sz(1, 2, 2), program: [["sala", "cozinha", "quarto", "banheiro"], ["quarto", "quarto", "banheiro", "escritorio"]], garden: true }),
  T("cabana", "Cabana", "casas", ["cabana", "chale", "cabaninha"], { w: sz(7, 9, 11), d: sz(7, 9, 11), floors: sz(1, 1, 2), program: [["sala", "quarto"], ["quarto"]] }),
  T("sobrado", "Sobrado", "casas", ["sobrado", "casa de dois andares", "duplex"], { w: sz(9, 11, 13), d: sz(9, 11, 13), floors: sz(2, 2, 3), program: [["sala", "cozinha", "jantar", "banheiro"], ["quarto", "quarto", "banheiro"], ["escritorio", "quarto"]], garden: true }),
  T("bangalo", "Bangalô", "casas", ["bangalo", "bangalow", "casa de praia", "casa terrea"], { w: sz(11, 13, 17), d: sz(7, 9, 11), floors: sz(1, 1, 1), program: [["sala", "cozinha", "quarto"]], garden: true }),
  T("mansao", "Mansão", "casas", ["mansao", "casarao", "palacete"], { w: sz(15, 19, 23), d: sz(11, 15, 17), floors: sz(2, 2, 3), program: [["sala", "jantar", "cozinha", "banheiro", "escritorio", "biblioteca"], ["quarto", "quarto", "quarto", "banheiro", "banheiro"], ["quarto", "biblioteca", "sala"]], garden: true }),
  T("apartamento", "Prédio de apartamentos", "casas", ["predio", "apartamento", "apartamentos", "condominio", "edificio"], { w: sz(11, 13, 15), d: sz(11, 13, 15), floors: sz(3, 5, 8), program: [["recepcao", "sala"], ["sala", "cozinha", "quarto", "banheiro"]], roof: "flat" }),
  T("hotel", "Hotel", "casas", ["hotel", "pousada", "hospedaria", "motel"], { w: sz(13, 15, 19), d: sz(11, 13, 15), floors: sz(2, 3, 5), program: [["recepcao", "jantar", "cozinha"], ["quarto", "quarto", "quarto", "quarto", "banheiro", "banheiro"]] }),
  T("castelinho", "Castelinho", "casas", ["castelinho", "fortim", "torre de castelo", "mini castelo"], { w: sz(11, 13, 17), d: sz(11, 13, 17), floors: sz(2, 3, 3), program: [["salao:trono", "cozinha"], ["quarto", "quarto", "biblioteca"], ["dormitorio"]], roof: "crenel", towers: true }),
  T("torre_mago", "Torre de mago", "casas", ["torre de mago", "torre do mago", "torre magica", "torre de bruxo", "torre"], { round: true, r: sz(4, 5, 6), floors: sz(3, 4, 6), program: [["sala"], ["lab"], ["biblioteca"], ["quarto"]] }),
  T("casa_arvore", "Casa na árvore", "casas", ["casa na arvore", "casa da arvore", "treehouse"], { tree: true, w: sz(7, 9, 11), d: sz(7, 9, 11), floors: sz(1, 1, 2), program: [["sala", "quarto"], ["quarto"]] }),
  T("iglu", "Iglu", "casas", ["iglu", "iglo", "casa de gelo"], { igloo: true, r: sz(4, 5, 7) }),
  T("palacio", "Palácio", "casas", ["palacio", "palacio real", "corte"], { w: sz(17, 21, 27), d: sz(13, 15, 19), floors: sz(2, 2, 3), program: [["salao:trono", "jantar", "cozinha"], ["quarto", "quarto", "biblioteca", "banheiro"]], garden: true, roof: "hip" }),
  // comércio
  T("padaria", "Padaria", "comercio", ["padaria", "panificadora", "confeitaria"], { w: sz(9, 11, 13), d: sz(9, 11, 13), floors: sz(1, 2, 2), program: [["loja"], ["quarto", "cozinha"]], goods: "padaria" }),
  T("acougue", "Açougue", "comercio", ["acougue", "casa de carnes"], { w: sz(9, 9, 11), d: sz(9, 11, 11), floors: sz(1, 1, 2), program: [["loja"], ["quarto"]], goods: "acougue" }),
  T("ferreiro", "Ferreiro / loja de armas", "comercio", ["ferreiro", "loja de armas", "armaria", "forja", "ferraria"], { w: sz(9, 11, 13), d: sz(9, 11, 13), floors: sz(1, 1, 2), program: [["loja", "oficina"], ["quarto"]], goods: "armas" }),
  T("farmacia", "Farmácia / alquimista", "comercio", ["farmacia", "alquimista", "drogaria", "botica", "loja de pocoes"], { w: sz(9, 9, 11), d: sz(9, 11, 11), floors: sz(1, 1, 2), program: [["loja"], ["lab"]], goods: "farmacia" }),
  T("livraria", "Livraria", "comercio", ["livraria", "sebo", "loja de livros"], { w: sz(9, 11, 13), d: sz(9, 11, 13), floors: sz(1, 2, 2), program: [["loja"], ["biblioteca"]], goods: "livraria" }),
  T("taverna", "Taverna / bar", "comercio", ["taverna", "bar", "boteco", "pub", "saloon", "estalagem"], { w: sz(11, 13, 15), d: sz(9, 11, 13), floors: sz(1, 2, 2), program: [["loja", "cozinha"], ["quarto", "quarto", "banheiro"]], goods: "taverna" }),
  T("restaurante", "Restaurante", "comercio", ["restaurante", "lanchonete", "pizzaria", "churrascaria", "hamburgueria"], { w: sz(11, 13, 17), d: sz(9, 11, 13), floors: sz(1, 1, 2), program: [["loja", "cozinha", "banheiro"], ["jantar"]], goods: "restaurante" }),
  T("cafeteria", "Cafeteria", "comercio", ["cafeteria", "cafe", "doceria", "sorveteria"], { w: sz(9, 9, 11), d: sz(7, 9, 11), floors: sz(1, 1, 2), program: [["loja"], ["sala"]], goods: "cafeteria" }),
  T("mercado", "Mercado", "comercio", ["mercado", "supermercado", "mercadinho", "quitanda", "feira coberta"], { w: sz(11, 15, 19), d: sz(11, 13, 17), floors: sz(1, 1, 1), program: [["loja", "deposito"]], goods: "mercado" }),
  T("banco", "Banco", "comercio", ["banco", "agencia bancaria", "caixa forte"], { w: sz(11, 13, 15), d: sz(9, 11, 13), floors: sz(1, 2, 2), program: [["loja", "cofre"], ["escritorio", "escritorio"]], goods: "banco", roof: "flat" }),
  T("joalheria", "Joalheria", "comercio", ["joalheria", "joias", "relojoaria"], { w: sz(9, 9, 11), d: sz(7, 9, 11), floors: sz(1, 1, 1), program: [["loja"]], goods: "joalheria" }),
  T("loja_roupas", "Loja de roupas", "comercio", ["loja de roupas", "boutique", "alfaiataria", "costureira"], { w: sz(9, 11, 13), d: sz(9, 9, 11), floors: sz(1, 1, 2), program: [["loja"], ["quarto"]], goods: "roupas" }),
  T("barbearia", "Barbearia / salão", "comercio", ["barbearia", "salao de beleza", "cabeleireiro"], { w: sz(7, 9, 11), d: sz(7, 9, 9), floors: sz(1, 1, 1), program: [["loja"]], goods: "barbearia" }),
  T("correio", "Correio", "comercio", ["correio", "agencia de correio", "posto do correio"], { w: sz(9, 11, 13), d: sz(9, 9, 11), floors: sz(1, 1, 2), program: [["loja", "deposito"], ["escritorio"]], goods: "correio" }),
  T("ferragem", "Loja de ferragens", "comercio", ["loja de ferragens", "ferragem", "material de construcao"], { w: sz(9, 11, 13), d: sz(9, 11, 11), floors: sz(1, 1, 1), program: [["loja", "deposito"]], goods: "ferragem" }),
  T("pet_shop", "Pet shop", "comercio", ["pet shop", "petshop", "loja de animais", "veterinario"], { w: sz(9, 9, 11), d: sz(7, 9, 11), floors: sz(1, 1, 1), program: [["loja"]], goods: "pet" }),
  T("floricultura", "Floricultura", "comercio", ["floricultura", "loja de flores"], { w: sz(7, 9, 11), d: sz(7, 9, 9), floors: sz(1, 1, 1), program: [["loja"]], goods: "flores", garden: true }),
  T("loja_brinquedos", "Loja de brinquedos", "comercio", ["loja de brinquedos", "brinquedos", "fliperama"], { w: sz(9, 9, 11), d: sz(7, 9, 11), floors: sz(1, 1, 2), program: [["loja"], ["sala"]], goods: "brinquedos" }),
  T("shopping", "Shopping", "comercio", ["shopping", "centro comercial", "galeria"], { w: sz(19, 23, 29), d: sz(13, 15, 19), floors: sz(1, 2, 2), program: [["loja:padaria", "loja:roupas", "loja:joalheria", "loja:livraria", "loja:cafeteria", "loja:brinquedos"], ["loja:restaurante", "loja:farmacia", "loja:pet", "loja:flores"]], roof: "flat", bigWindows: true }),
  T("posto", "Posto de gasolina", "comercio", ["posto", "posto de gasolina", "posto de combustivel"], { w: sz(9, 9, 11), d: sz(7, 9, 9), floors: sz(1, 1, 1), program: [["loja"]], goods: "geral", roof: "flat", canopy: true }),
  // públicos
  T("escola", "Escola", "publico", ["escola", "colegio", "creche", "universidade", "faculdade"], { w: sz(13, 17, 21), d: sz(11, 13, 15), floors: sz(1, 2, 2), program: [["salao:escola", "salao:escola", "recepcao"], ["salao:escola", "biblioteca", "escritorio"]] }),
  T("hospital", "Hospital", "publico", ["hospital", "posto de saude", "clinica", "pronto socorro"], { w: sz(13, 17, 21), d: sz(11, 13, 15), floors: sz(1, 2, 3), program: [["recepcao", "dormitorio", "lab", "banheiro"], ["dormitorio", "dormitorio", "escritorio"]], roof: "flat" }),
  T("delegacia", "Delegacia", "publico", ["delegacia", "policia", "distrito policial"], { w: sz(11, 13, 15), d: sz(9, 11, 13), floors: sz(1, 1, 2), program: [["recepcao", "celas", "escritorio"], ["dormitorio"]], roof: "flat" }),
  T("bombeiros", "Corpo de bombeiros", "publico", ["bombeiros", "corpo de bombeiros", "quartel dos bombeiros"], { w: sz(11, 13, 15), d: sz(11, 13, 15), floors: sz(1, 2, 2), program: [["vazio"], ["dormitorio", "cozinha"]], openFront: true, roof: "flat", tower: true }),
  T("prefeitura", "Prefeitura", "publico", ["prefeitura", "camara", "paco municipal", "governo"], { w: sz(15, 17, 21), d: sz(11, 13, 15), floors: sz(1, 2, 2), program: [["salao:trono", "recepcao", "escritorio"], ["escritorio", "escritorio", "biblioteca"]], roof: "hip" }),
  T("igreja", "Igreja / capela", "publico", ["igreja", "capela", "templo", "catedral", "santuario"], { w: sz(9, 11, 15), d: sz(13, 17, 23), floors: sz(1, 1, 1), storey: 7, program: [["salao:igreja"]], bell: true }),
  T("biblioteca", "Biblioteca", "publico", ["biblioteca", "arquivo", "acervo"], { w: sz(11, 13, 17), d: sz(9, 11, 13), floors: sz(1, 2, 2), program: [["biblioteca", "recepcao"], ["biblioteca", "escritorio"]] }),
  T("museu", "Museu", "publico", ["museu", "galeria de arte", "exposicao"], { w: sz(13, 15, 19), d: sz(11, 13, 15), floors: sz(1, 2, 2), program: [["museu", "recepcao"], ["museu", "museu"]], roof: "flat" }),
  T("teatro", "Teatro", "publico", ["teatro", "auditorio", "opera"], { w: sz(11, 15, 19), d: sz(13, 17, 21), floors: sz(1, 1, 1), storey: 6, program: [["salao:teatro"]] }),
  T("cinema", "Cinema", "publico", ["cinema", "cine", "sala de cinema"], { w: sz(11, 13, 17), d: sz(13, 15, 19), floors: sz(1, 1, 1), storey: 6, program: [["salao:cinema"]], roof: "flat" }),
  T("estacao", "Estação de trem", "publico", ["estacao", "estacao de trem", "rodoviaria", "metro"], { w: sz(13, 17, 21), d: sz(9, 9, 11), floors: sz(1, 1, 1), program: [["recepcao", "sala"]], rails: true }),
  T("academia", "Academia", "publico", ["academia", "ginasio", "crossfit"], { w: sz(11, 13, 15), d: sz(9, 11, 13), floors: sz(1, 1, 2), program: [["academia", "banheiro"], ["academia"]], roof: "flat" }),
  T("prisao", "Prisão", "publico", ["prisao", "presidio", "cadeia", "penitenciaria"], { w: sz(13, 17, 21), d: sz(11, 13, 15), floors: sz(1, 2, 2), program: [["celas", "recepcao"], ["celas", "celas"]], roof: "crenel" }),
  T("quartel", "Quartel", "publico", ["quartel", "base militar", "caserna", "forte"], { w: sz(13, 15, 19), d: sz(11, 13, 15), floors: sz(1, 2, 2), program: [["dormitorio", "oficina", "cozinha"], ["dormitorio", "escritorio"]], roof: "crenel" }),
  T("observatorio", "Observatório", "publico", ["observatorio", "planetario", "telescopio"], { round: true, r: sz(4, 5, 6), floors: sz(2, 3, 3), program: [["escritorio"], ["biblioteca"], ["lab"]], dome: true }),
  T("laboratorio", "Laboratório", "publico", ["laboratorio", "lab", "centro de pesquisa"], { w: sz(11, 13, 15), d: sz(9, 11, 13), floors: sz(1, 2, 2), program: [["lab", "escritorio"], ["lab", "deposito"]], roof: "flat", bigWindows: true }),
  T("fabrica", "Fábrica", "publico", ["fabrica", "industria", "usina", "galpao"], { w: sz(13, 17, 23), d: sz(11, 15, 19), floors: sz(1, 1, 1), storey: 6, program: [["oficina", "deposito"]], roof: "flat", chimney: true }),
  T("oficina", "Oficina", "publico", ["oficina", "garagem", "oficina mecanica", "atelie"], { w: sz(9, 11, 13), d: sz(9, 11, 11), floors: sz(1, 1, 1), program: [["oficina"]], openFront: true, roof: "flat" }),
  // rurais
  T("celeiro", "Celeiro", "rural", ["celeiro", "paiol", "barracao"], { w: sz(11, 13, 17), d: sz(13, 15, 19), floors: sz(1, 1, 1), storey: 6, program: [["baias"]], openFront: true }),
  T("estabulo", "Estábulo", "rural", ["estabulo", "cocheira", "haras", "estrebaria"], { w: sz(11, 13, 17), d: sz(9, 11, 13), floors: sz(1, 1, 1), program: [["baias"]], animals: "horse" }),
  T("galinheiro", "Galinheiro", "rural", ["galinheiro", "granja", "aviario"], { w: sz(7, 9, 11), d: sz(7, 7, 9), floors: sz(1, 1, 1), program: [["baias"]], animals: "chicken" }),
  T("silo", "Silo", "rural", ["silo", "silo de graos"], { silo: true, r: sz(3, 4, 5), floors: sz(3, 4, 5) }),
  T("moinho", "Moinho de vento", "rural", ["moinho", "moinho de vento", "cata vento gigante"], { round: true, r: sz(3, 4, 5), floors: sz(3, 4, 4), program: [["deposito"], ["vazio"]], windmill: true }),
  T("estufa", "Estufa", "rural", ["estufa", "viveiro", "horta coberta"], { w: sz(9, 13, 17), d: sz(9, 11, 15), floors: sz(1, 1, 1), program: [["estufa"]], glassWalls: true, roof: "flat", glassRoof: true }),
  T("casa_fazenda", "Casa de fazenda", "rural", ["casa de fazenda", "casa do fazendeiro", "sitio", "rancho"], { w: sz(11, 13, 15), d: sz(9, 11, 13), floors: sz(1, 2, 2), program: [["sala", "cozinha", "jantar", "banheiro"], ["quarto", "quarto", "quarto"]], garden: true, fields: true }),
  T("armazem", "Armazém", "rural", ["armazem", "deposito", "galpao de estoque"], { w: sz(11, 15, 19), d: sz(11, 13, 17), floors: sz(1, 1, 1), storey: 5, program: [["deposito"]] }),
  T("apiario", "Apiário", "rural", ["apiario", "colmeias", "casa das abelhas"], { w: sz(7, 9, 11), d: sz(7, 7, 9), floors: sz(1, 1, 1), program: [["deposito"]], bees: true, garden: true }),
  // lazer, torres e especiais
  T("torre_vigia", "Torre de vigia", "lazer", ["torre de vigia", "posto de observacao", "torre de guarda"], { w: sz(5, 5, 7), d: sz(5, 5, 7), floors: sz(3, 4, 6), program: [["vazio"]], roof: "crenel" }),
  T("farolzinho", "Farol pequeno", "lazer", ["farolzinho", "farol pequeno", "mini farol"], { lighthouse: true, r: sz(2, 3, 4), floors: sz(4, 5, 7) }),
  T("quiosque", "Quiosque", "lazer", ["quiosque", "barraca de praia", "lanchonete de praia"], { kiosk: true, w: sz(5, 7, 9) }),
  T("coreto", "Coreto / gazebo", "lazer", ["coreto", "gazebo", "pergolado", "caramanchao"], { gazebo: true, w: sz(5, 7, 9) }),
  T("piscina", "Piscina", "lazer", ["piscina", "parque aquatico", "clube"], { pool: true, w: sz(9, 13, 19), d: sz(7, 9, 13) }),
  T("cais", "Cais / porto", "lazer", ["cais", "porto", "pier", "trapiche", "marina"], { dock: true, w: sz(5, 7, 9), d: sz(9, 13, 19) }),
  T("arena", "Arena", "lazer", ["arena", "coliseu", "ringue", "anfiteatro"], { arena: true, r: sz(7, 10, 14) }),
  T("parquinho", "Parquinho", "lazer", ["parquinho", "playground", "parque infantil"], { playground: true, w: sz(9, 11, 15) }),
];

// ------------------------------------------------------------------ objetos e decorações
export const OBJECTS = [
  { key: "fonte", name: "Fonte", words: ["fonte", "chafariz"] },
  { key: "estatua", name: "Estátua", words: ["estatua", "escultura", "monumento"] },
  { key: "poste", name: "Poste de luz", words: ["poste", "poste de luz", "luminaria"] },
  { key: "banco_praca", name: "Banco de praça", words: ["banco de praca", "banquinho", "banco de jardim"] },
  { key: "arvore", name: "Árvore decorativa", words: ["arvore decorativa", "arvorezinha", "arvore enfeite"] },
  { key: "canteiro", name: "Canteiro de flores", words: ["canteiro", "jardim de flores", "floreira"] },
  { key: "poco_pequeno", name: "Poço pequeno", words: ["poco pequeno", "pocinho"] },
  { key: "ponte", name: "Ponte pequena", words: ["ponte pequena", "pontezinha", "ponte de madeira"] },
  { key: "barraca", name: "Barraca de feira", words: ["barraca de feira", "barraca", "banca", "feira"] },
  { key: "carroca", name: "Carroça", words: ["carroca", "carrinho de mao", "charrete"] },
  { key: "piquenique", name: "Mesa de piquenique", words: ["mesa de piquenique", "piquenique", "mesa"] },
  { key: "fogueira", name: "Fogueira com troncos", words: ["fogueira", "acampamento", "lual"] },
  { key: "arco", name: "Arco / portal", words: ["arco", "portal de entrada", "portico"] },
  { key: "obelisco", name: "Obelisco", words: ["obelisco", "pilar", "coluna"] },
  { key: "relogio", name: "Relógio de praça", words: ["relogio de praca", "torre do relogio pequena", "relogio"] },
  { key: "espantalho", name: "Espantalho", words: ["espantalho"] },
  { key: "caixa_correio", name: "Caixa de correio", words: ["caixa de correio", "caixinha de correio"] },
  { key: "ponto_onibus", name: "Ponto de ônibus", words: ["ponto de onibus", "parada de onibus", "abrigo de onibus"] },
  { key: "jardim_zen", name: "Jardim zen", words: ["jardim zen", "jardim japones"] },
  { key: "laguinho", name: "Laguinho com peixes", words: ["laguinho", "lago", "lago com peixes", "aquario"] },
  { key: "horta", name: "Horta", words: ["horta", "plantacao pequena", "canteiro de horta"] },
  { key: "totem", name: "Totem", words: ["totem"] },
  { key: "tenda", name: "Tenda de camping", words: ["tenda", "barraca de camping", "cabaninha de pano"] },
  { key: "balanco", name: "Balanço", words: ["balanco", "gangorra"] },
  { key: "cerca_portao", name: "Cerca com portão", words: ["cerca com portao", "portao", "cercado"] },
  { key: "vaso_gigante", name: "Vaso gigante com planta", words: ["vaso gigante", "vasao", "planta gigante"] },
  { key: "farolete", name: "Lampião de rua duplo", words: ["lampiao", "lampiao duplo", "farolete"] },
  { key: "cata_vento", name: "Cata-vento", words: ["cata vento", "catavento", "biruta"] },
  { key: "mesa_xadrez", name: "Mesa de xadrez", words: ["mesa de xadrez", "xadrez", "tabuleiro"] },
  { key: "cabine_telefone", name: "Cabine telefônica", words: ["cabine telefonica", "orelhao", "telefone publico"] },
];

export const TOTAL = TYPES.length * STYLES.length * SIZES.length + OBJECTS.length * STYLES.length;

// ------------------------------------------------------------------ especiais
function roundTower(p, st, r, floors, o, R) {
  const H = 4;
  for (let f = 0; f < floors; f++) {
    const y = f * H;
    p.cyl(0, 0, r, y, y, f === 0 ? st.base : st.floor, false);
    p.cyl(0, 0, r, y + 1, y + H - 1, st.wall, true);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + f * 0.6;
      p.s(Math.round(Math.cos(a) * r), y + 2, Math.round(Math.sin(a) * r), st.glass);
    }
    if (f < floors - 1) p.f(0, y + 1, r - 1, 0, y + H, r - 1, M("ladder"), { facing_direction: FACE.N });
    const room = { x0: -r + 2, x1: r - 2, z0: -r + 2, z1: r - 3 };
    const kinds = o.program ?? [["vazio"]];
    const kind = kinds[Math.min(f, kinds.length - 1)][0];
    const res = new Set([`0,${r - 1}`, `0,${r - 2}`, `0,${-r + 1}`]);
    try {
      if (kind !== "vazio" && FURN[kind]) FURN[kind](p, st, room, y, y + H, res, R);
      else light(p, st, room, y, y + H);
    } catch {
      /* ignore */
    }
  }
  const top = floors * H;
  p.door(0, 1, -r, W(st.wood, "door"), "S");
  p.cyl(0, 0, r, top, top, st.roofB, false);
  if (o.dome) {
    for (let yy = 1; yy <= r; yy++) p.cyl(0, 0, Math.round(Math.sqrt(r * r - yy * yy)), top + yy, top + yy, yy > r - 2 ? M("glass") : M("quartz_block"), true);
    p.s(0, top + 1, 0, M("end_rod"), { facing_direction: 2 });
  } else {
    // telhado cônico
    for (let yy = 1; yy <= r + 2; yy++) {
      const rr = Math.max(0, Math.round(r + 1 - yy * (r + 1) / (r + 2)));
      p.cyl(0, 0, rr, top + yy, top + yy, st.roofB, rr > 0);
    }
  }
  if (o.windmill) {
    // pás do moinho na frente (cruz de lã branca em uma armação de madeira)
    const cy = top - 2, z = -r - 1;
    p.s(0, cy, z, W(st.wood, "log"), { pillar_axis: "z" });
    for (let k = 1; k <= r + 4; k++) {
      p.s(k, cy + 0, z - 1, W(st.wood, "fence")).s(-k, cy, z - 1, W(st.wood, "fence")).s(0, cy + k, z - 1, W(st.wood, "fence")).s(0, cy - k, z - 1, W(st.wood, "fence"));
      p.s(k, cy + 1, z - 1, M("white_wool")).s(-k, cy - 1, z - 1, M("white_wool")).s(-1, cy + k, z - 1, M("white_wool")).s(1, cy - k, z - 1, M("white_wool"));
    }
  }
  p.half = r + 4;
  p.height = top + r + 6;
}

function special(p, t, st, k, R) {
  if (t.round) return roundTower(p, st, t.r[k], t.floors[k], t, R);
  if (t.silo) {
    const r = t.r[k], h = t.floors[k] * 4;
    p.cyl(0, 0, r, 0, 0, st.base, false).cyl(0, 0, r, 1, h, st.wall, true).cyl(0, 0, r - 1, 1, Math.floor(h / 2), M("hay_block"), false);
    for (let yy = 1; yy <= r; yy++) p.cyl(0, 0, Math.round(Math.sqrt(r * r - yy * yy)), h + yy, h + yy, st.roofB, false);
    p.f(0, 1, -r, 0, h, -r, M("ladder"), { facing_direction: FACE.N });
    p.s(0, 1, -r + 1, M("air"));
    p.half = r + 3;
    p.height = h + r + 3;
    return;
  }
  if (t.igloo) {
    const r = t.r[k];
    for (let yy = 0; yy <= r; yy++) p.cyl(0, 0, Math.round(Math.sqrt(r * r - yy * yy)), yy, yy, M("snow"), yy > 0);
    p.f(-r + 1, 0, -r + 1, r - 1, 0, r - 1, M("snow"));
    p.f(0, 1, -r - 2, 0, 2, -r, M("air")).walls(-1, 0, -r - 2, 1, 3, -r, M("snow")).f(0, 1, -r - 2, 0, 2, -r, M("air"));
    p.bed(1, 1, r - 2, "S").s(-1, 1, r - 2, M("furnace"), { "minecraft:cardinal_direction": "north" }).chest(-2, 1, 0, "E", [["minecraft:cooked_salmon", 16]]);
    p.s(0, 1, 0, M("white_carpet")).s(0, r - 1, 0, M("lantern"), { hanging: true });
    p.half = r + 4;
    p.height = r + 3;
    return;
  }
  if (t.lighthouse) {
    const r = t.r[k], h = t.floors[k] * 4;
    for (let yy = 0; yy <= h; yy++) p.cyl(0, 0, r, yy, yy, yy === 0 ? st.base : Math.floor(yy / 3) % 2 ? M("red_concrete") : M("white_concrete"), yy > 0);
    p.f(0, 1, r - 1, 0, h, r - 1, M("ladder"), { facing_direction: FACE.N });
    p.door(0, 1, -r, W(st.wood, "door"), "S");
    p.cyl(0, 0, r + 1, h + 1, h + 1, st.trim, false);
    p.cyl(0, 0, r + 1, h + 2, h + 2, M("iron_bars"), true);
    p.cyl(0, 0, Math.max(1, r - 1), h + 2, h + 4, M("glass"), true);
    p.s(0, h + 2, 0, M("glowstone")).s(0, h + 3, 0, M("sea_lantern"));
    p.cyl(0, 0, r, h + 5, h + 5, M("red_concrete"), false).s(0, h + 6, 0, M("lightning_rod"));
    p.half = r + 4;
    p.height = h + 8;
    return;
  }
  if (t.kiosk || t.gazebo) {
    const w = t.w[k], h = Math.floor(w / 2);
    p.f(-h, 0, -h, h, 0, h, st.floor);
    for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]]) p.f(x, 1, z, x, 3, z, W(st.wood, "fence"));
    roof(p, { ...st, roofS: st.roofS.endsWith("_stairs") ? st.roofS : W(st.wood, "stairs") }, h, h, 4, "hip", { w });
    if (t.kiosk) {
      for (let x = -h + 1; x <= h - 1; x++) p.s(x, 1, -h + 1, W(st.wood, "slab"), slabTop);
      p.s(0, 1, h - 1, M("smoker"), { "minecraft:cardinal_direction": "north" }).s(1, 1, h - 1, M("barrel"), { facing_direction: 1 });
      for (let x = -h + 1; x <= h - 1; x += 2) p.s(x, 1, -h - 1, W(st.wood, "fence"));
    } else {
      for (let x = -h + 1; x <= h - 1; x++) p.s(x, 1, h, W(st.wood, "stairs"), stair("S")).s(x, 1, -h, W(st.wood, "stairs"), stair("N"));
      p.s(0, 3, 0, M("lantern"), { hanging: true });
    }
    p.half = h + 3;
    p.height = h + 8;
    return;
  }
  if (t.pool) {
    const hw = Math.floor(t.w[k] / 2), hd = Math.floor(t.d[k] / 2);
    p.f(-hw - 1, 0, -hd - 1, hw + 1, 0, hd + 1, st.path);
    p.f(-hw, -3, -hd, hw, -1, hd, M("light_blue_concrete"));
    p.f(-hw + 1, -2, -hd + 1, hw - 1, 0, hd - 1, M("water"));
    for (let x = -hw + 2; x <= hw - 2; x += 3) p.s(x, -3, 0, M("sea_lantern"));
    for (let x = -hw; x <= hw; x += 3) p.s(x, 1, -hd - 2, W(st.wood, "stairs"), stair("N")).s(x, 1, -hd - 3, W(st.wood, "slab"));
    for (const x of [-hw - 1, hw + 1]) p.f(x, 1, hd + 2, x, 3, hd + 2, W(st.wood, "fence")).f(x - 1, 4, hd + 1, x + 1, 4, hd + 3, M("white_wool"));
    p.half = Math.max(hw, hd) + 5;
    p.height = 6;
    return;
  }
  if (t.dock) {
    const hw = Math.floor(t.w[k] / 2), len = t.d[k];
    p.clear = false;
    p.f(-hw, 0, -len, hw, 0, 0, W(st.wood, "planks"));
    for (let z = -len; z <= 0; z += 3) for (const x of [-hw, hw]) p.f(x, -4, z, x, 0, z, W(st.wood, "log"), { pillar_axis: "y" }).s(x, 1, z, W(st.wood, "fence"));
    p.s(-hw, 2, -len, M("lantern")).s(hw, 2, -len, M("lantern"));
    p.chest(0, 1, 0, "N", [["minecraft:fishing_rod", 2], ["minecraft:cod", 8]]).s(1, 1, 0, M("barrel"), { facing_direction: 1 });
    p.e(-hw - 2, 1, -len + 2, M("boat")).e(hw + 2, 1, -len + 4, M("boat"));
    p.half = len + 2;
    p.height = 4;
    return;
  }
  if (t.arena) {
    const r = t.r[k];
    p.cyl(0, 0, r, 0, 0, M("sand"), false);
    for (let i = 0; i < 4; i++) p.cyl(0, 0, r + 1 + i, i + 1, i + 1, st.wall, true).cyl(0, 0, r + 1 + i, i + 2, i + 2, W(st.wood, "slab"), true);
    p.cyl(0, 0, r + 5, 1, 7, st.wall, true);
    for (let a = 0; a < 8; a++) p.s(Math.round(Math.cos(a * Math.PI / 4) * (r + 5)), 8, Math.round(Math.sin(a * Math.PI / 4) * (r + 5)), M("lantern"));
    p.f(0, 1, -r - 5, 0, 3, -r - 1, M("air"));
    p.half = r + 7;
    p.height = 10;
    return;
  }
  if (t.playground) {
    const h = Math.floor(t.w[k] / 2);
    p.f(-h, 0, -h, h, 0, h, M("sand"));
    p.f(-2, 1, -2, -2, 4, -2, W(st.wood, "fence")).f(2, 1, -2, 2, 4, -2, W(st.wood, "fence")).f(-2, 5, -2, 2, 5, -2, W(st.wood, "planks"));
    p.s(-1, 4, -2, M("iron_chain"), { pillar_axis: "y" }).s(-1, 3, -2, W(st.wood, "slab")).s(1, 4, -2, M("iron_chain"), { pillar_axis: "y" }).s(1, 3, -2, W(st.wood, "slab"));
    for (let i = 0; i < 4; i++) p.s(h - 1 - i, 1 + (3 - i), 2, M("smooth_quartz_stairs"), stair("E"));
    p.f(h - 1, 1, 2, h, 4, 2, W(st.wood, "planks")).f(h, 1, 3, h, 4, 3, M("ladder"), { facing_direction: FACE.S });
    p.s(-h + 1, 1, h - 1, M("jukebox")).s(0, 1, h - 1, W(st.wood, "stairs"), stair("S"));
    p.half = h + 2;
    p.height = 8;
  }
}

function extras(p, t, st, info, k, R) {
  const { hw, hd, top } = info;
  if (t.garden && k >= 1) {
    const flowers = [M("poppy"), M("dandelion"), M("cornflower"), M("oxeye_daisy"), M("azure_bluet"), M("allium")];
    for (let x = -hw - 2; x <= hw + 2; x++) {
      if (x === info.doorX) continue;
      p.s(x, 1, -hd - 2, R() < 0.6 ? flowers[Math.floor(R() * flowers.length)] : M("oak_leaves"), undefined);
    }
    for (const x of [-hw - 3, hw + 3]) for (let z = -hd - 3; z <= hd + 3; z++) p.s(x, 1, z, W(st.wood, "fence"));
    for (let x = -hw - 3; x <= hw + 3; x++) p.s(x, 1, hd + 3, W(st.wood, "fence"));
  }
  if (t.bell) {
    const h = top + 6;
    p.f(-1, top, -hd - 1, 1, h, -hd + 1, st.wall);
    p.f(0, top + 3, -hd, 0, top + 4, -hd, M("air"));
    p.s(0, top + 4, -hd, M("bell"), { attachment: "hanging", direction: 0 });
    p.f(-1, h + 1, -hd - 1, 1, h + 1, -hd + 1, st.roofB).s(0, h + 2, -hd, M("lightning_rod"));
    p.height = Math.max(p.height, h + 4);
  }
  if (t.towers) {
    for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
      p.cyl(x, z, 2, 1, top + 3, st.wall, true);
      for (let a = -2; a <= 2; a += 2) p.s(x + a, top + 4, z - 2, st.wall).s(x + a, top + 4, z + 2, st.wall);
    }
    p.height = Math.max(p.height, top + 6);
  }
  if (t.tower) {
    p.f(hw - 2, top, hd - 2, hw, top + 6, hd, M("red_concrete"));
    p.s(hw - 1, top + 7, hd - 1, M("bell"), { attachment: "standing", direction: 0 });
  }
  if (t.chimney) {
    p.f(hw - 2, 1, hd - 2, hw - 1, top + 6, hd - 1, M("brick_block"));
    p.s(hw - 2, top + 7, hd - 2, M("campfire"), { "minecraft:cardinal_direction": "north", extinguished: false });
    p.height = Math.max(p.height, top + 9);
  }
  if (t.canopy) {
    // cobertura com bombas na frente
    for (const x of [-hw + 1, hw - 1]) p.f(x, 1, -hd - 6, x, 4, -hd - 6, M("iron_block"));
    p.f(-hw, 5, -hd - 8, hw, 5, -hd - 4, M("smooth_stone_slab"));
    for (const x of [-2, 2]) p.s(x, 1, -hd - 6, M("iron_block")).s(x, 2, -hd - 6, M("red_concrete")).s(x, 3, -hd - 6, M("redstone_lamp"));
    p.half = Math.max(p.half, hd + 9);
  }
  if (t.rails) {
    p.f(-hw - 2, 0, hd + 2, hw + 2, 0, hd + 4, M("smooth_stone"));
    for (let x = -hw - 2; x <= hw + 2; x++) p.s(x, 1, hd + 4, M("rail"), { rail_direction: 1 });
    p.e(0, 1, hd + 4, M("minecart"));
    for (let x = -hw; x <= hw; x += 4) p.s(x, 1, hd + 2, W(st.wood, "stairs"), stair("N"));
    p.half = Math.max(p.half, hd + 6);
  }
  if (t.animals) {
    for (let i = 0; i < (k + 2); i++) p.e(-hw + 2 + i * 2, 1, 0, M(t.animals));
  }
  if (t.bees) {
    for (const x of [-hw - 2, hw + 2]) for (let z = -2; z <= 2; z += 2) p.s(x, 1, z, M("beehive"), { direction: 0, honey_level: 3 });
    for (let x = -hw; x <= hw; x += 2) p.s(x, 1, hd + 2, M("cornflower")).s(x + 1, 1, hd + 2, M("poppy"));
  }
  if (t.fields) {
    for (let x = hw + 3; x <= hw + 8; x++) for (let z = -hd; z <= hd; z++) {
      if ((z + hd) % 4 === 0) p.s(x, 0, z, M("water"));
      else p.s(x, 0, z, M("farmland"), { moisturized_amount: 7 }).s(x, 1, z, M("wheat"), { growth: 7 });
    }
    p.half = Math.max(p.half, hw + 9);
  }
  if (t.glassRoof) p.f(-hw + 1, top, -hd + 1, hw - 1, top, hd - 1, M("glass"));
}

function tree(p, st, t, k, R) {
  // tronco grosso, copa, plataforma e a casa em cima
  const h = 7 + k * 2;
  p.f(-1, 1, -1, 1, h, 1, W(st.wood === "bamboo" || st.wood === "crimson" || st.wood === "warped" ? "oak" : st.wood, "log"), { pillar_axis: "y" });
  p.f(2, 1, 0, 2, h, 0, M("ladder"), { facing_direction: FACE.E });
  const sub = new Plan("tmp");
  sub.half = 1;
  const info = building(sub, st, { w: t.w[k], d: t.d[k], floors: t.floors[k], program: t.program }, R);
  for (const op of sub.ops) {
    const o = op.slice();
    if (o[0] === "f") {
      o[2] += h;
      o[5] += h;
    } else o[2] += h;
    p.ops.push(o);
  }
  const r = Math.max(info.hw, info.hd) + 3;
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
    if (Math.hypot(x, z) > r || Math.hypot(x, z) < r - 1.5) continue;
    p.s(x, h + 2 + Math.floor(R() * 3), z, M("oak_leaves"), { persistent_bit: true });
  }
  p.half = r + 2;
  p.height = h + info.top + 10;
}

// ------------------------------------------------------------------ objetos
function object(p, key, st, R) {
  p.half = 4;
  p.height = 8;
  const wood = (k) => W(st.wood, k);
  switch (key) {
    case "fonte":
      p.cyl(0, 0, 3, 0, 1, st.trim, true).cyl(0, 0, 2, 0, 0, st.trim, false).cyl(0, 0, 2, 1, 1, M("water"), false);
      p.f(0, 1, 0, 0, 3, 0, st.pillar, pillarSt(st.pillar)).s(0, 4, 0, M("water"));
      break;
    case "estatua":
      p.f(-1, 1, -1, 1, 1, 1, st.trim).f(0, 2, 0, 0, 3, 0, st.wall).f(-1, 4, 0, 1, 4, 0, st.wall).s(0, 5, 0, st.pillar, pillarSt(st.pillar)).f(-2, 5, 0, -2, 6, 0, st.wall).s(2, 4, 0, st.wall);
      p.s(-1, 2, 0, st.wall).s(1, 2, 0, st.wall).s(0, 6, 0, M("gold_block"));
      break;
    case "poste":
      p.f(0, 1, 0, 0, 4, 0, wood("fence")).s(0, 5, 0, st.trim).s(1, 5, 0, wood("fence")).s(-1, 5, 0, wood("fence")).s(1, 4, 0, M("lantern"), { hanging: true }).s(-1, 4, 0, M("lantern"), { hanging: true });
      break;
    case "banco_praca":
      for (let x = -1; x <= 1; x++) p.s(x, 1, 0, wood("stairs"), stair("S"));
      p.s(-2, 1, 0, wood("fence")).s(2, 1, 0, wood("fence")).s(-3, 1, 0, M("lantern")).s(3, 1, 1, M("decorated_pot"));
      break;
    case "arvore": {
      p.f(0, 1, 0, 0, 5, 0, M("oak_log"), { pillar_axis: "y" });
      for (let x = -3; x <= 3; x++) for (let y = 4; y <= 8; y++) for (let z = -3; z <= 3; z++) if (Math.hypot(x, (y - 6) * 1.3, z) <= 3.2) p.s(x, y, z, M("oak_leaves"), { persistent_bit: true });
      p.cyl(0, 0, 2, 0, 0, st.trim, true);
      break;
    }
    case "canteiro": {
      const fl = [M("poppy"), M("dandelion"), M("cornflower"), M("allium"), M("oxeye_daisy"), M("azure_bluet"), M("lily_of_the_valley")];
      p.walls(-3, 0, -2, 3, 0, 2, st.trim).f(-2, 0, -1, 2, 0, 1, M("grass_block"));
      for (let x = -2; x <= 2; x++) for (let z = -1; z <= 1; z++) p.s(x, 1, z, fl[Math.floor(R() * fl.length)]);
      break;
    }
    case "poco_pequeno":
      p.walls(-1, 1, -1, 1, 1, 1, st.wall).s(0, 0, 0, M("water")).s(0, 1, 0, M("water"));
      for (const [x, z] of [[-1, -1], [1, 1]]) p.f(x, 2, z, x, 3, z, wood("fence"));
      p.f(-1, 4, -1, 1, 4, 1, wood("slab")).s(0, 3, 0, M("iron_chain"), { pillar_axis: "y" });
      break;
    case "ponte":
      p.clear = false;
      for (let z = -4; z <= 4; z++) {
        const y = 1 + (Math.abs(z) <= 1 ? 1 : 0) + (Math.abs(z) <= 3 ? 0 : -1);
        p.f(-1, y, z, 1, y, z, wood("planks")).s(-2, y + 1, z, wood("fence")).s(2, y + 1, z, wood("fence"));
      }
      p.half = 5;
      break;
    case "barraca":
      for (const [x, z] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) p.f(x, 1, z, x, 3, z, wood("fence"));
      p.f(-2, 4, -1, 2, 4, 1, M("red_wool")).f(-2, 4, 0, 2, 4, 0, M("white_wool"));
      p.f(-1, 1, -1, 1, 1, -1, wood("slab"), slabTop).s(-1, 2, -1, M("melon_block")).s(1, 2, -1, M("pumpkin")).s(0, 1, 1, M("barrel"), { facing_direction: 1 });
      break;
    case "carroca":
      p.f(-1, 2, -2, 1, 2, 1, wood("planks")).walls(-1, 3, -2, 1, 3, 1, wood("fence")).s(0, 3, 0, M("hay_block"));
      for (const [x, z] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) p.s(x, 1, z, wood("trapdoor"), { direction: x < 0 ? 1 : 3, open_bit: true, upside_down_bit: false });
      p.f(0, 2, -3, 0, 2, -4, wood("fence"));
      break;
    case "piquenique":
      p.f(-1, 1, 0, 1, 1, 0, wood("fence")).f(-1, 2, 0, 1, 2, 0, wood("slab"));
      for (let x = -1; x <= 1; x++) p.s(x, 1, -1, wood("slab")).s(x, 1, 1, wood("slab"));
      p.s(0, 3, 0, M("cake"));
      break;
    case "fogueira":
      p.s(0, 1, 0, M("campfire"), { "minecraft:cardinal_direction": "north", extinguished: false });
      for (const [x, z, ax] of [[0, -2, "x"], [0, 2, "x"], [-2, 0, "z"], [2, 0, "z"]]) p.s(x, 1, z, wood("log"), { pillar_axis: ax });
      p.cyl(0, 0, 3, 0, 0, M("gravel"), true);
      break;
    case "arco":
      p.f(-3, 1, 0, -3, 5, 0, st.pillar, pillarSt(st.pillar)).f(3, 1, 0, 3, 5, 0, st.pillar, pillarSt(st.pillar)).f(-3, 6, 0, 3, 6, 0, st.trim).f(-2, 7, 0, 2, 7, 0, st.wall);
      p.s(-2, 5, 0, M("lantern"), { hanging: false }).s(2, 5, 0, M("lantern"));
      break;
    case "obelisco":
      p.f(-1, 1, -1, 1, 1, 1, st.trim).f(0, 2, 0, 0, 9, 0, st.wall).s(0, 10, 0, M("gold_block"));
      p.height = 12;
      break;
    case "relogio":
      p.f(-1, 1, -1, 1, 6, 1, st.wall).s(0, 5, -2, M("white_concrete")).s(0, 6, -2, M("daylight_detector")).f(-1, 7, -1, 1, 7, 1, st.trim).s(0, 8, 0, M("bell"), { attachment: "standing", direction: 0 });
      p.height = 10;
      break;
    case "espantalho":
      p.f(0, 1, 0, 0, 2, 0, wood("fence")).s(0, 3, 0, M("hay_block")).s(-1, 3, 0, wood("fence")).s(1, 3, 0, wood("fence")).s(0, 4, 0, M("carved_pumpkin"), { "minecraft:cardinal_direction": "north" });
      for (let x = -3; x <= 3; x++) for (let z = 2; z <= 3; z++) p.s(x, 0, z, M("farmland"), { moisturized_amount: 7 }).s(x, 1, z, M("wheat"), { growth: 7 });
      break;
    case "caixa_correio":
      p.f(0, 1, 0, 0, 1, 0, wood("fence")).s(0, 2, 0, M("barrel"), { facing_direction: 2 }).s(0, 3, 0, M("red_carpet"));
      break;
    case "ponto_onibus":
      p.f(-2, 1, 1, 2, 3, 1, M("glass")).f(-2, 4, -1, 2, 4, 1, M("smooth_stone_slab"));
      for (let x = -1; x <= 1; x++) p.s(x, 1, 0, W(st.wood, "stairs"), stair("S"));
      p.f(-3, 0, -2, 3, 0, 1, st.path).s(3, 1, -1, M("iron_bars")).s(3, 2, -1, M("iron_bars")).s(3, 3, -1, M("yellow_concrete"));
      break;
    case "jardim_zen":
      p.f(-3, 0, -3, 3, 0, 3, M("sand")).walls(-4, 0, -4, 4, 0, 4, M("dark_oak_planks"));
      p.s(-1, 1, -1, M("mossy_cobblestone")).s(2, 1, 1, M("cobblestone")).s(2, 2, 1, M("stone_button"));
      p.f(-3, 1, 3, -3, 3, 3, M("bamboo"));
      p.s(0, 1, 2, M("lantern"));
      break;
    case "laguinho":
      p.cyl(0, 0, 3, -1, 0, M("water"), false).cyl(0, 0, 4, 0, 0, M("stone"), true);
      p.s(-1, 1, 0, M("waterlily")).s(1, 1, 1, M("waterlily")).s(3, 1, 3, M("sugar_cane"));
      p.e(0, -1, 0, M("tropicalfish")).e(1, -1, -1, M("tropicalfish"));
      break;
    case "horta":
      p.walls(-3, 0, -3, 3, 0, 3, wood("log"));
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
        if (x === 0) p.s(x, 0, z, M("water"));
        else p.s(x, 0, z, M("farmland"), { moisturized_amount: 7 }).s(x, 1, z, x < 0 ? M("carrots") : M("potatoes"), { growth: 7 });
      }
      break;
    case "totem":
      for (let y = 1; y <= 6; y++) p.s(0, y, 0, y % 2 ? st.wall : st.trim);
      p.s(-1, 4, 0, wood("fence")).s(1, 4, 0, wood("fence")).s(0, 7, 0, M("carved_pumpkin"), { "minecraft:cardinal_direction": "north" });
      break;
    case "tenda":
      for (let z = -2; z <= 2; z++) {
        p.s(-1, 1, z, M("white_wool")).s(1, 1, z, M("white_wool")).s(0, 2, z, M("white_wool"));
      }
      p.s(0, 1, 2, M("white_wool")).s(0, 1, -3, M("campfire"), { "minecraft:cardinal_direction": "north", extinguished: false });
      break;
    case "balanco":
      p.f(-2, 1, 0, -2, 4, 0, wood("fence")).f(2, 1, 0, 2, 4, 0, wood("fence")).f(-2, 5, 0, 2, 5, 0, wood("log"), { pillar_axis: "x" });
      p.s(0, 4, 0, M("iron_chain"), { pillar_axis: "y" }).s(0, 3, 0, M("iron_chain"), { pillar_axis: "y" }).s(0, 2, 0, wood("slab"));
      break;
    case "cerca_portao":
      for (let x = -4; x <= 4; x++) p.s(x, 1, 0, x === 0 ? wood("fence_gate") : wood("fence"), x === 0 ? { "minecraft:cardinal_direction": "north", in_wall_bit: false, open_bit: false } : undefined);
      p.s(-4, 2, 0, M("lantern")).s(4, 2, 0, M("lantern"));
      break;
    case "vaso_gigante":
      p.cyl(0, 0, 2, 1, 2, M("hardened_clay"), true).cyl(0, 0, 1, 2, 2, M("grass_block"), false);
      p.f(0, 3, 0, 0, 4, 0, M("oak_log"), { pillar_axis: "y" });
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.hypot(x, z) <= 2.3) p.s(x, 5, z, M("azalea_leaves"), { persistent_bit: true });
      break;
    case "farolete":
      p.f(0, 1, 0, 0, 5, 0, M("iron_bars")).f(-2, 6, 0, 2, 6, 0, st.trim).s(-2, 5, 0, M("lantern"), { hanging: true }).s(2, 5, 0, M("lantern"), { hanging: true });
      break;
    case "cata_vento":
      p.f(0, 1, 0, 0, 5, 0, wood("fence")).s(0, 6, 0, st.trim).s(1, 6, 0, M("white_wool")).s(-1, 7, 0, M("white_wool")).s(0, 7, 0, M("white_wool"));
      break;
    case "mesa_xadrez":
      p.s(0, 1, 0, wood("fence")).s(0, 2, 0, M("white_carpet")).s(-1, 1, 0, wood("stairs"), stair("W")).s(1, 1, 0, wood("stairs"), stair("E"));
      p.f(-2, 0, -2, 2, 0, 2, st.path);
      break;
    case "cabine_telefone":
      p.walls(-1, 1, -1, 1, 3, 1, M("red_stained_glass")).f(-1, 4, -1, 1, 4, 1, M("red_concrete")).s(0, 1, -1, M("air")).s(0, 2, -1, M("air"));
      p.s(0, 2, 1, M("lever"), { lever_direction: "north", open_bit: false });
      break;
    default:
      break;
  }
}

// ------------------------------------------------------------------ rotação (a porta fica virada para você)
const ROT_CARD = { north: "east", east: "south", south: "west", west: "north" };
const ROT_WEIRDO = { 0: 2, 2: 1, 1: 3, 3: 0 };   // E→S→W→N→E
const ROT_FACE = { 2: 5, 5: 3, 3: 4, 4: 2 };     // N→E→S→W
function rotState(st, q) {
  if (!st || !q) return st;
  const o = { ...st };
  for (let i = 0; i < q; i++) {
    if (o["minecraft:cardinal_direction"]) o["minecraft:cardinal_direction"] = ROT_CARD[o["minecraft:cardinal_direction"]];
    if (o.weirdo_direction !== undefined) o.weirdo_direction = ROT_WEIRDO[o.weirdo_direction];
    if (o.direction !== undefined && typeof o.direction === "number") o.direction = (o.direction + 1) % 4;
    if (o.facing_direction !== undefined && ROT_FACE[o.facing_direction] !== undefined) o.facing_direction = ROT_FACE[o.facing_direction];
    if (o.pillar_axis === "x") o.pillar_axis = "z";
    else if (o.pillar_axis === "z") o.pillar_axis = "x";
    if (o.rail_direction === 0 || o.rail_direction === 1) o.rail_direction = 1 - o.rail_direction;
    if (o.lever_direction === "north") o.lever_direction = "east";
  }
  return o;
}
// (x, z) girado 90° no sentido horário visto de cima: N→E, E→S...
const rp = (x, z, q) => {
  for (let i = 0; i < q; i++) [x, z] = [-z, x];
  return [x, z];
};

/** Gira a planta toda em q quartos de volta (posições, caixas, pares e estados). */
export function rotatePlan(plan, q) {
  q = ((q % 4) + 4) % 4;
  if (!q) return plan;
  plan.ops = plan.ops.map((op) => {
    if (op[0] === "f") {
      const [ax, az] = rp(op[1], op[3], q), [bx, bz] = rp(op[4], op[6], q);
      return ["f", Math.min(ax, bx), op[2], Math.min(az, bz), Math.max(ax, bx), op[5], Math.max(az, bz), op[7], rotState(op[8], q)];
    }
    const [x, z] = rp(op[1], op[3], q);
    if (op[0] === "s") {
      const out = ["s", x, op[2], z, op[4], rotState(op[5], q)];
      if (op[6]) {
        const [dx, dz] = rp(op[6][0], op[6][2], q);
        out.push([dx, op[6][1], dz, rotState(op[6][3], q)]);
      }
      return out;
    }
    return [op[0], x, op[2], z, op[4]];
  });
  return plan;
}

// ------------------------------------------------------------------ entrada principal
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/**
 * Planta de uma construção do catálogo.
 * @param {string} kind chave do tipo (TYPES) ou do objeto (OBJECTS)
 * @param {string} styleKey  @param {string} sizeKey  @param {number} q quartos de volta (porta para você)
 */
export function archPlan(kind, styleKey = "medieval", sizeKey = "medio", q = 0, seed = 0) {
  const st = STYLES.find((s) => s.key === styleKey) ?? STYLES[0];
  const size = SIZES.find((s) => s.key === sizeKey) ?? SIZES[1];
  const k = size.k;
  const R = rng(hash(`${kind}|${st.key}|${size.key}`) + seed);
  const obj = OBJECTS.find((o) => o.key === kind);
  const t = TYPES.find((x) => x.key === kind);
  const p = new Plan(obj ? `${obj.name} (${st.name})` : `${t?.name ?? kind} ${size.name.toLowerCase()} (${st.name})`);
  if (obj) object(p, kind, st, R);
  else if (t) {
    if (t.tree) tree(p, st, t, k, R);
    else if (t.w && !t.kiosk && !t.gazebo && !t.pool && !t.dock && !t.playground) {
      const hw = Math.floor(t.w[k] / 2), hd = Math.floor(t.d[k] / 2);
      p.half = Math.max(hw, hd) + (t.garden ? 5 : 4);
      const info = building(p, st, { ...t, w: t.w[k], d: t.d[k], floors: t.floors[k] }, R);
      extras(p, t, st, info, k, R);
    } else special(p, t, st, k, R);
  } else throw new Error(`construção desconhecida: ${kind}`);
  return rotatePlan(p, q);
}

/** Lista de nomes de tudo (para o menu, testes e a página). */
export function catalogList() {
  const out = [];
  for (const t of TYPES) for (const s of STYLES) for (const z of SIZES) out.push({ kind: t.key, style: s.key, size: z.key, name: `${t.name} ${z.name.toLowerCase()} (${s.name})` });
  for (const o of OBJECTS) for (const s of STYLES) out.push({ kind: o.key, style: s.key, size: "medio", name: `${o.name} (${s.name})` });
  return out;
}

/** Acha tipo/objeto, estilo e tamanho numa frase já em tokens. */
export function findArch(tok) {
  const joined = ` ${tok.join(" ")} `;
  const hit = (w) => (w.includes(" ") ? joined.includes(` ${w} `) : tok.includes(w));
  let kind = null, bl = 0, word = "";
  for (const t of [...TYPES, ...OBJECTS]) for (const w of t.words) if (hit(w) && w.length > bl) {
    kind = t.key;
    bl = w.length;
    word = w;
  }
  let styleKey = null, sl = 0;
  const SW = {
    medieval: ["medieval", "antigo", "idade media"], rustico: ["rustico", "rustica", "de madeira", "cabana de madeira"], moderno: ["moderno", "moderna", "contemporaneo"],
    futurista: ["futurista", "futuristico", "do futuro", "sci fi", "high tech", "tecnologico"], japones: ["japones", "japonesa", "oriental", "asiatico", "chines"],
    desertico: ["desertico", "do deserto", "egipcio", "arabe"], nordico: ["nordico", "viking", "escandinavo"], tropical: ["tropical", "de bambu", "havaiano"],
    gotico: ["gotico", "gotica", "sombrio", "dark", "assombrado", "vampiro"], colonial: ["colonial", "de tijolo", "de tijolos", "classico"],
    castelo: ["de pedra", "fortificado", "estilo castelo"], nether: ["nether", "infernal", "do inferno"], gelo: ["de gelo", "gelado", "congelado", "polar"],
    mansao: ["luxuoso", "luxuosa", "chique", "rico", "de luxo", "elegante"], rural: ["rural", "do campo", "caipira", "sertanejo"], praiano: ["praiano", "de praia", "litoraneo"],
    steampunk: ["steampunk", "de cobre", "vitoriano"], elfico: ["elfico", "da floresta", "de fada", "encantado", "magico"], industrial: ["industrial", "urbano", "de concreto"],
    colorido: ["colorido", "colorida", "alegre", "fofo", "de doce"], savana: ["savana", "africano", "safari"],
  };
  for (const [k2, ws] of Object.entries(SW)) for (const w of ws) if (hit(w) && w.length > sl) {
    styleKey = k2;
    sl = w.length;
  }
  let sizeKey = null;
  if (["pequeno", "pequena", "pequenininho", "mini", "simples", "pequenino"].some(hit)) sizeKey = "pequeno";
  else if (["grande", "enorme", "gigante", "imensa", "imenso", "grandao", "grandona"].some(hit)) sizeKey = "grande";
  else if (["medio", "media", "normal"].some(hit)) sizeKey = "medio";
  return { kind, style: styleKey, size: sizeKey, len: bl, multi: word.includes(" ") };
}

/** Quartos de volta para a porta (frente = -z) ficar virada para quem olha na direção (vx, vz). */
export function facingQuarter(vx, vz) {
  // a frente deve apontar para o jogador: oposto ao olhar
  const tx = -vx, tz = -vz;
  if (Math.abs(tx) > Math.abs(tz)) return tx > 0 ? 1 : 3;
  return tz < 0 ? 0 : 2;
}
