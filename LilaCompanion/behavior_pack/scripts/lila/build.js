// Construção por plantas: calcula a lista de materiais reais, junta tudo (planejador), prepara o
// terreno (só limpa blocos naturais) e ergue bloco a bloco andando pela obra como uma jogadora.
import { BlockPermutation } from "@minecraft/server";
import { BLUEPRINTS, buildOrder, footprint } from "../lib/blueprints.js";
import { blueprintBlock, blueprintItem, shoppingList } from "../lib/recipes.js";
import { WOODS, isAirId, ptName } from "../lib/items.js";
import { cardinal, rotateLocal, yawDir } from "../core/util.js";
import { GoalError } from "./companion.js";
import { blockAt, groundY } from "./world.js";
import { canBreak, face, markPlaced, placeAt, quickBreak } from "./blocks.js";
import { obtain, obtainAll } from "./planner.js";
import { craft, planksFor } from "./crafting.js";
import { fillBucket, reach } from "./resource.js";
import * as inv from "./inventory.js";
import { hold, setAction, sound } from "./anim.js";
import { say } from "./talk.js";
import { logError } from "../core/log.js";
import { breathe } from "../core/budget.js";

/** @typedef {import("./companion.js").Companion} Companion */

const FWD_NAME = { 0: "south", 1: "west", 2: "north", 3: "east" };
const REPLACEABLE = /^minecraft:(air|short_grass|tall_grass|fern|large_fern|snow_layer|dandelion|poppy|.*_tulip|cornflower|oxeye_daisy|azure_bluet|allium|blue_orchid|lily_of_the_valley|deadbush|dead_bush|bush|leaf_litter|pink_petals|wildflowers|short_dry_grass|tall_dry_grass|firefly_bush|water|flowing_water)$/;

function dominantWood(c) {
  const s = inv.summary(c);
  let best = "oak", n = 0;
  for (const w of WOODS) {
    const k = (s[`minecraft:${w}_log`] ?? 0) * 4 + (s[`minecraft:${w}_planks`] ?? 0);
    if (k > n) {
      n = k;
      best = w;
    }
  }
  return best;
}

/** Transforma coordenadas locais da planta em mundo. */
export function toWorld(site, b) {
  const r = rotateLocal({ x: b.x, y: b.y, z: b.z }, site.card);
  return { x: site.origin.x + r.x, y: site.origin.y + r.y, z: site.origin.z + r.z };
}

/**
 * Escolhe onde construir. "aqui" = na frente do dono, virada para ele; senão perto da base/dono.
 * Rejeita terrenos com construções do jogador e procura ao lado.
 */
export function chooseSite(c, blocks, here) {
  const dim = c.dim();
  const owner = c.owner();
  const ref = owner && owner.dimension.id === dim.id ? owner : undefined;
  let card = 0;
  let base;
  if (ref) {
    const d = yawDir(ref.getRotation().y);
    card = cardinal(d);
    const fwd = rotateLocal({ x: 0, y: 0, z: 1 }, card);
    const dist = here ? 2 : 6;
    base = { x: Math.floor(ref.location.x) + fwd.x * dist, y: Math.floor(ref.location.y), z: Math.floor(ref.location.z) + fwd.z * dist };
  } else {
    const p = c.rec.base ?? c.pos();
    base = { x: Math.floor(p.x) + 4, y: Math.floor(p.y), z: Math.floor(p.z) };
  }
  const fp = footprint(blocks);
  const width = fp.x1 - fp.x0 + 3;
  const depth = fp.z1 - fp.z0 + 3;
  // frente primeiro; se não der, lados, mais longe e por fim atrás (como um jogador procurando lugar)
  const tries = [];
  for (const turn of [0, 1, 3, 2]) {
    const cd = (card + turn) % 4;
    for (const extra of [0, depth]) tries.push({ cd, extra, shifts: [0, width, -width, 2 * width, -2 * width] });
  }
  const t0 = Date.now();
  for (const tr of tries) {
    if (Date.now() - t0 > 40) break;
    let b0 = base;
    if (ref && (tr.cd !== card || tr.extra)) {
      const f = rotateLocal({ x: 0, y: 0, z: 1 }, tr.cd);
      const dist = (here ? 2 : 6) + tr.extra;
      b0 = { x: Math.floor(ref.location.x) + f.x * dist, y: Math.floor(ref.location.y), z: Math.floor(ref.location.z) + f.z * dist };
    }
    const right = rotateLocal({ x: 1, y: 0, z: 0 }, tr.cd);
    for (const shift of tr.shifts) {
      const ox = b0.x + right.x * shift, oz = b0.z + right.z * shift;
      const gy = groundY(dim, ox, oz, b0.y);
      if (gy === undefined) continue;
      const site = { origin: { x: ox, y: gy - 1, z: oz }, card: tr.cd };
      if (siteFree(c, blocks, site)) return site;
    }
  }
  return undefined;
}

function siteFree(c, blocks, site) {
  const dim = c.dim();
  let bad = 0;
  const t0 = Date.now();
  for (const b of blocks) {
    if (Date.now() - t0 > 12) break; // amostra grande o bastante; a obra nunca quebra o que é do jogador
    const w = toWorld(site, b);
    const blk = blockAt(dim, w.x, w.y, w.z);
    if (!blk) return false;
    if (blk.isAir || blk.isLiquid || REPLACEABLE.test(blk.typeId)) continue;
    if (!canBreak(c, dim, w, blk.typeId)) bad++;
    if (bad > 0) return false;
  }
  return true;
}

// ---------- materiais flexíveis (como jogador: usa o que tem, não trava por enfeite) ----------
const SOLID_M = new Set(["planks", "cobble", "stone_bricks", "log", "slab"]);
const FLOOR_M = new Set(["planks", "cobble", "stone_bricks"]);
const SOLID_GROUND = /^minecraft:(dirt|grass_block|coarse_dirt|podzol|rooted_dirt|mycelium|stone|deepslate|andesite|diorite|granite|tuff|sandstone|red_sandstone|cobblestone|mud|packed_mud|clay|terracotta|.*_terracotta|calcite|dirt_with_roots)$/;
const STONEISH = ["minecraft:cobblestone", "minecraft:stone_bricks", "minecraft:stone", "minecraft:cobbled_deepslate",
  "minecraft:mossy_cobblestone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff",
  "minecraft:polished_andesite", "minecraft:polished_diorite", "minecraft:polished_granite", "minecraft:deepslate_bricks",
  "minecraft:sandstone", "minecraft:blackstone"];
const LOG_RE = /^minecraft:(?!stripped_)[a-z_]+_(log|stem)$/;
const SEEDS = ["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"];

/** Unidades de bloco sólido que ela consegue pôr (tronco vale 4: vira 4 tábuas). */
export function solidUnits(c) {
  let n = 0;
  for (const [id, k] of Object.entries(inv.summary(c))) {
    if (id.endsWith("_planks")) n += k;
    else if (LOG_RE.test(id)) n += 4 * k;
    else if (STONEISH.includes(id)) n += k;
  }
  return n;
}

function scaffoldUnits(c) {
  let n = 0;
  for (const id of ["minecraft:dirt", "minecraft:cobbled_deepslate", "minecraft:netherrack", "minecraft:sand"]) n += inv.count(c, id);
  return n;
}

/**
 * Lista de compras inteligente: paredes/chão viram "blocos sólidos" (qualquer tábua/pedra serve),
 * vidro/tochas são opcionais (janela fica aberta), sementes começam com até 8 e água só se já
 * tiver balde (sem balde, a plantação usa terra arada molhada no lugar da água).
 */
export function planMaterials(c, blocks, wood, wantCrop) {
  const raw = shoppingList(blocks, wood);
  const list = {};
  let solidNeed = 0;
  const skipped = [];
  for (const b of blocks) if (SOLID_M.has(b.m)) solidNeed++;
  for (const [id, n] of Object.entries(raw)) {
    if (/_planks$|_log$|^minecraft:cobblestone$|^minecraft:stone_bricks$|_slab$/.test(id)) continue; // já no solidNeed
    if (id === "minecraft:glass") {
      if (inv.count(c, id) < n) skipped.push("vidro (janela aberta)");
      continue;
    }
    if (id === "minecraft:torch") {
      // tocha só se der pra fazer na hora (carvão no bolso); senão fica pra depois
      if (inv.count(c, id) < n && inv.count(c, { group: "coal" }) > 0) list[id] = Math.min(n, inv.count(c, id) + inv.count(c, { group: "coal" }) * 4);
      else if (inv.count(c, id) < n) skipped.push("tochas");
      continue;
    }
    if (id === "minecraft:water_bucket") {
      if (inv.count(c, id) > 0 || inv.count(c, "minecraft:bucket") > 0) list[id] = 1;
      continue;
    }
    if (id === "minecraft:wheat_seeds") continue; // tratado abaixo
    list[id] = n;
  }
  const noWater = !!raw["minecraft:water_bucket"] && !list["minecraft:water_bucket"];
  let crop = wantCrop;
  if (raw["minecraft:wheat_seeds"]) {
    if (inv.count(c, crop) < 1 && crop !== "minecraft:wheat_seeds") crop = SEEDS.find((sd) => inv.count(c, sd) > 0) ?? "minecraft:wheat_seeds";
    const have = SEEDS.reduce((a, sd) => a + inv.count(c, sd), 0);
    const target = Math.min(raw["minecraft:wheat_seeds"], 8);
    if (have < target) list[crop] = inv.count(c, crop) + (target - have);
  }
  if (blocks.some((b) => b.m === "farmland")) list["minecraft:wooden_hoe"] = 1;
  return { list, solidNeed, crop, noWater, skipped };
}

/** Garante mais `n` blocos sólidos (troncos: 1 árvore ≈ 20 tábuas). */
function* obtainSolid(c, n, o) {
  const logs = inv.count(c, { group: "log" }) + Math.ceil(n / 4);
  yield* obtain(c, { group: "log" }, logs, o);
}

/** Escolhe o que pôr num espaço de parede/chão: o preferido, senão qualquer tábua/pedra/tronco. */
function* pickSolid(c, m, wood) {
  const pref = blueprintItem(m, wood);
  const s = inv.summary(c);
  const has = (id) => (s[id] ?? 0) > 0;
  if (pref && has(pref)) {
    const states = m === "log" ? { pillar_axis: "y" } : m === "slab" ? { "minecraft:vertical_half": "bottom" } : undefined;
    return { id: blueprintBlock(m, wood), item: pref, states };
  }
  const planks = Object.keys(s).find((id) => id.endsWith("_planks") && s[id] > 0);
  const stone = STONEISH.find(has);
  const log = Object.keys(s).find((id) => LOG_RE.test(id) && s[id] > 0);
  const order = m === "cobble" || m === "stone_bricks" ? ["stone", "planks", "convert", "log"] : m === "log" ? ["log", "planks", "stone"] : ["planks", "convert", "stone", "log"];
  for (const k of order) {
    if (k === "planks" && planks) return { id: planks, item: planks };
    if (k === "stone" && stone) return { id: stone, item: stone };
    if (k === "log" && log) return { id: log, item: log, states: { pillar_axis: "y" } };
    if (k === "convert" && log) {
      try {
        yield* craft(c, planksFor(c), inv.count(c, planksFor(c)) + 4);
      } catch (e) {
        logError("build.planks", e);
        continue;
      }
      const p = planksFor(c);
      if (inv.count(c, p) > 0) return { id: p, item: p };
    }
  }
  return null;
}

const ACCEPT_SOLID = (id) => id.endsWith("_planks") || LOG_RE.test(id) || STONEISH.includes(id) || id.endsWith("_slab");

/** Uma passada pela obra. Devolve quantos blocos sólidos faltaram. */
function* placePass(c, order, site, wood, st) {
  const dim = c.dim();
  const r = c.def?.flying ? 6 : 4.8;
  let short = 0;
  for (const b of order) {
    if (!c.alive()) return 0;
    yield* breathe();
    if (b.m === "door_upper") continue;
    const w = toWorld(site, b);
    const cur = blockAt(dim, w.x, w.y, w.z);
    if (!cur) continue;
    let m = b.m;
    if (m === "glass" && inv.count(c, "minecraft:glass") < 1) m = "air"; // janela aberta
    if (m === "water" && (c.flags.noWater || (inv.count(c, "minecraft:water_bucket") < 1 && inv.count(c, "minecraft:bucket") < 1))) m = "farmland";
    if (m === "air") {
      if (!cur.isAir && !cur.isLiquid && canBreak(c, dim, w, cur.typeId) && !REPLACEABLE.test(cur.typeId)) {
        if (yield* reach(c, w, r)) yield* quickBreak(c, w, { strict: false });
      }
      continue;
    }
    const want = blueprintBlock(m, wood);
    if (cur.typeId === want) continue;
    if (SOLID_M.has(m) && ACCEPT_SOLID(cur.typeId)) continue; // já tem bloco bom ali (de outra madeira/pedra)
    if (m === "farmland" && cur.typeId === "minecraft:farmland") continue;
    // sem o item: nem anda até lá
    if ((m === "lantern" || m === "lantern_post") && inv.count(c, "minecraft:torch") < 1 && inv.count(c, "minecraft:lantern") < 1) continue;
    if (m === "crop" && !SEEDS.some((sd) => inv.count(c, sd) > 0)) continue;
    if (m === "fence" && inv.count(c, blueprintItem("fence", wood)) < 1 && !Object.keys(inv.summary(c)).some((id) => id.endsWith("_fence"))) continue;
    if (SOLID_M.has(m) && solidUnits(c) < 1) {
      short++;
      continue;
    }
    if (!cur.isAir && !REPLACEABLE.test(cur.typeId)) {
      if (!canBreak(c, dim, w, cur.typeId)) continue; // nunca mexe no que é do jogador
      if (!(yield* reach(c, w, r))) continue;
      yield* quickBreak(c, w, { strict: false });
    }
    if (!(yield* reach(c, w, r))) continue;
    const ok = yield* placeOne(c, { ...b, m }, w, wood, site);
    if (ok) st.placed++;
    else if (SOLID_M.has(m)) short++;
    if (st.placed % 40 === 39) say(c, `Obra em andamento: ${Math.min(99, Math.round((st.placed / st.total) * 100))}%`, { chatter: true });
  }
  return short;
}

/**
 * Constrói uma planta inteira.
 * @param {Companion} c
 * @param {string} key cabana|casa|torre|muralha|ponte|fazenda|abrigo|mansao
 * @param {{here?:boolean, cmd?:boolean, site?:any, crop?:string}} o
 */
export function* buildBlueprint(c, key, o = {}) {
  const bp = BLUEPRINTS[key];
  if (!bp) throw new GoalError(`não conheço a planta "${key}"`);
  let blocks = bp.build();
  const wood = dominantWood(c);
  const site = o.site ?? chooseSite(c, blocks, !!o.here);
  if (!site) throw new GoalError("não achei um terreno livre aqui perto (não vou derrubar suas construções). Tenta outro lugar?");
  c.flags.buildSite = site;
  const dim = c.dim();
  // chão: onde o terreno já é sólido e natural, ela aproveita (economiza material e tempo)
  const minY = Math.min(...blocks.map((b) => b.y));
  const skip = new Set();
  for (const b of blocks) {
    if (b.y !== minY || !FLOOR_M.has(b.m)) continue;
    const w = toWorld(site, b);
    const blk = blockAt(dim, w.x, w.y, w.z);
    if (blk && !blk.isAir && !blk.isLiquid && !REPLACEABLE.test(blk.typeId) && SOLID_GROUND.test(blk.typeId)) skip.add(`${b.x},${b.y},${b.z}`);
  }
  const effective = blocks.filter((b) => !skip.has(`${b.x},${b.y},${b.z}`));
  const plan = planMaterials(c, effective, wood, o.crop ?? "minecraft:wheat_seeds");
  const { list, solidNeed, crop } = plan;
  c.flags.crop = crop;
  c.flags.noWater = plan.noWater;
  // fundação: estima buracos a preencher (terra serve; nada de minerar pedra só pra isso)
  const fill = estimateFill(c, blocks, site);
  const scaffold = scaffoldUnits(c);
  if (fill > scaffold) list["minecraft:dirt"] = inv.count(c, "minecraft:dirt") + (fill - scaffold);
  const solidShort = Math.max(0, solidNeed - solidUnits(c));
  const missing = Object.entries(list).filter(([id, n]) => inv.count(c, id) < n).map(([id, n]) => `${n - inv.count(c, id)} ${ptName(id)}`);
  if (solidShort > 0) missing.unshift(`${solidShort} blocos (tábuas ou pedra)`);
  if (missing.length) {
    say(c, `Pra ${bp.name.toLowerCase()} falta: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}. Já vou buscar!`, { force: !!o.cmd });
  }
  if (plan.skipped.length) say(c, `Sem ${plan.skipped.join(", ")} por enquanto: vou fazer sem e coloco depois.`, { chatter: true });
  if (list["minecraft:wooden_hoe"]) {
    delete list["minecraft:wooden_hoe"];
    if (inv.toolTier(c, "hoe") === "none") yield* obtain(c, { toolKind: "hoe", tier: "wooden" }, 1, o);
  }
  yield* obtainAll(c, list, o);
  // material de parede/chão: madeira rende 4 tábuas por tronco, então é o jeito mais rápido
  if (solidShort > 0) yield* obtainSolid(c, solidShort, o);
  say(c, `Materiais prontos! Começando ${bp.name.toLowerCase()}.`, { force: !!o.cmd });
  // limpeza do interior (só natural) e fundação
  yield* clearInterior(c, blocks, site);
  yield* fillFoundation(c, blocks, site);
  const order = buildOrder(effective);
  const st = { placed: 0, total: order.length };
  for (let pass = 0; pass < 3 && c.alive(); pass++) {
    const short = yield* placePass(c, order, site, wood, st);
    if (!short || !c.alive()) break;
    // faltou bloco (drops/gastos no caminho): busca mais e completa os buracos
    say(c, `Faltaram ${short} blocos, vou buscar mais e terminar.`, { chatter: true });
    try {
      yield* obtainSolid(c, short, o);
    } catch (e) {
      if (!(e instanceof GoalError)) throw e;
      break;
    }
  }
  if (!c.alive()) return false;
  setAction(c.entity, "celebrate");
  sound(c.entity, "random.levelup", 0.6, 1.2);
  yield 40;
  setAction(c.entity, "idle");
  c.rec.stats.built++;
  if (!c.rec.base && key !== "fazenda" && key !== "ponte" && key !== "muralha") {
    const inside = toWorld(site, { x: 0, y: 1, z: 3 });
    c.rec.base = { x: inside.x, y: inside.y, z: inside.z, d: dim.id };
  }
  if (key === "fazenda") {
    const fp = footprint(blocks);
    const a = toWorld(site, { x: fp.x0, y: 0, z: fp.z0 }), z = toWorld(site, { x: fp.x1, y: 0, z: fp.z1 });
    c.rec.farm = { from: { x: Math.min(a.x, z.x), y: a.y, z: Math.min(a.z, z.z) }, to: { x: Math.max(a.x, z.x), y: a.y, z: Math.max(a.z, z.z) }, d: dim.id, crop };
  }
  // lembra bancada/baú da obra
  for (const b of blocks) {
    if (b.m === "table") c.mem.remember("table", toWorld(site, b), dim.id);
    if (b.m === "chest") c.mem.remember("chest", toWorld(site, b), dim.id);
  }
  c.save();
  return true;
}

function estimateFill(c, blocks, site) {
  const dim = c.dim();
  let n = 0;
  const minY = Math.min(...blocks.map((b) => b.y));
  for (const b of blocks) {
    if (b.y !== minY) continue;
    const w = toWorld(site, b);
    for (let d = 1; d <= 4; d++) {
      const blk = blockAt(dim, w.x, w.y - d, w.z);
      if (!blk || (!blk.isAir && !blk.isLiquid)) break;
      n++;
    }
  }
  return n;
}

function* fillFoundation(c, blocks, site) {
  const dim = c.dim();
  const minY = Math.min(...blocks.map((b) => b.y));
  for (const b of blocks) {
    yield* breathe();
    if (b.y !== minY || b.m === "water") continue;
    const w = toWorld(site, b);
    for (let d = 4; d >= 1; d--) {
      const blk = blockAt(dim, w.x, w.y - d, w.z);
      if (!blk || (!blk.isAir && !blk.isLiquid)) continue;
      // só preenche se a coluna abaixo estiver vazia até ali
      const fillWith = inv.scaffoldBlock(c);
      if (!fillWith) return;
      if (!(yield* reach(c, w, 4.5))) break;
      yield* placeAt(c, { x: w.x, y: w.y - d, z: w.z }, fillWith, fillWith);
    }
  }
}

function* clearInterior(c, blocks, site) {
  const dim = c.dim();
  const fp = footprint(blocks);
  const planned = new Set(blocks.map((b) => `${b.x},${b.y},${b.z}`));
  const top = Math.min(fp.y1, 14);
  for (let y = top; y >= 1; y--) {
    for (let x = fp.x0; x <= fp.x1; x++) {
      for (let z = fp.z0; z <= fp.z1; z++) {
        yield* breathe();
        if (planned.has(`${x},${y},${z}`)) continue;
        const w = toWorld(site, { x, y, z });
        const blk = blockAt(dim, w.x, w.y, w.z);
        if (!blk || blk.isAir || blk.isLiquid || isAirId(blk.typeId)) continue;
        if (!canBreak(c, dim, w, blk.typeId)) continue;
        if (!(yield* reach(c, w, 4))) continue;
        yield* quickBreak(c, w, { strict: false });
      }
    }
  }
}

/** Coloca um bloco da planta com o estado certo (portas, tochas, água, plantação, terra arada). */
function* placeOne(c, b, w, wood, site) {
  const dim = c.dim();
  switch (b.m) {
    case "door_lower": {
      const id = blueprintBlock("door_lower", wood);
      const item = blueprintItem("door_lower", wood);
      if (inv.take(c, item, 1) < 1) return false;
      face(c, w);
      hold(c.entity, item);
      setAction(c.entity, "place");
      yield 4;
      try {
        const dir = FWD_NAME[site.card];
        blockAt(dim, w.x, w.y, w.z)?.setPermutation(BlockPermutation.resolve(id, { "minecraft:cardinal_direction": dir, upper_block_bit: false }));
        blockAt(dim, w.x, w.y + 1, w.z)?.setPermutation(BlockPermutation.resolve(id, { "minecraft:cardinal_direction": dir, upper_block_bit: true }));
        markPlaced(c, w, dim.id);
        markPlaced(c, { x: w.x, y: w.y + 1, z: w.z }, dim.id);
        sound(c.entity, "use.wood", 0.8, 1);
      } catch (e) {
        logError("build.door", e);
        inv.addId(c, item, 1);
      }
      setAction(c.entity, "idle");
      return true;
    }
    case "lantern":
    case "lantern_post": {
      // tocha no chão logo abaixo do ponto da luminária (luz garantida, sem flutuar)
      let y = w.y;
      while (y > site.origin.y + 1 && blockAt(dim, w.x, y - 1, w.z)?.isAir) y--;
      const below = blockAt(dim, w.x, y - 1, w.z);
      if (!below || below.isAir || below.isLiquid) return false;
      if (inv.count(c, "minecraft:lantern") > 0) return yield* placeAt(c, { x: w.x, y, z: w.z }, "minecraft:lantern", "minecraft:lantern", { hanging: false });
      return yield* placeAt(c, { x: w.x, y, z: w.z }, "minecraft:torch", "minecraft:torch", { torch_facing_direction: "top" });
    }
    case "farmland": {
      const blk = blockAt(dim, w.x, w.y, w.z);
      if (!blk) return false;
      const hoe = inv.bestTool(c, "hoe");
      if (!/dirt|grass_block|farmland/.test(blk.typeId)) {
        // coloca terra antes de arar (terreno de pedra/areia)
        if (inv.count(c, "minecraft:dirt") < 1) yield* obtain(c, "minecraft:dirt", 4, {});
        if (canBreak(c, dim, w, blk.typeId) && !blk.isAir) yield* quickBreak(c, w, { strict: false });
        yield* placeAt(c, w, "minecraft:dirt", "minecraft:dirt");
      }
      face(c, w);
      hold(c.entity, hoe?.id);
      setAction(c.entity, "farm");
      yield 3;
      try {
        blockAt(dim, w.x, w.y, w.z)?.setPermutation(BlockPermutation.resolve("minecraft:farmland", { moisturized_amount: 7 }));
        sound(c.entity, "use.gravel", 0.8, 1);
        if (hoe) inv.wearTool(c, hoe.slot, 1);
      } catch (e) {
        logError("build.till", e);
      }
      setAction(c.entity, "idle");
      return true;
    }
    case "water": {
      if (inv.count(c, "minecraft:water_bucket") < 1 && !(yield* fillBucket(c))) return false;
      if (!(yield* reach(c, w, 4))) return false;
      const blk = blockAt(dim, w.x, w.y, w.z);
      if (blk && !blk.isAir && canBreak(c, dim, w, blk.typeId)) yield* quickBreak(c, w, { strict: false });
      face(c, w);
      setAction(c.entity, "place");
      yield 4;
      try {
        blockAt(dim, w.x, w.y, w.z)?.setPermutation(BlockPermutation.resolve("minecraft:water"));
        inv.take(c, "minecraft:water_bucket", 1);
        inv.addId(c, "minecraft:bucket", 1);
        sound(c.entity, "bucket.empty_water", 0.8, 1);
      } catch (e) {
        logError("build.water", e);
      }
      setAction(c.entity, "idle");
      return true;
    }
    case "crop": {
      const pref = c.flags.crop ?? c.rec.farm?.crop ?? "minecraft:wheat_seeds";
      const seed = inv.count(c, pref) > 0 ? pref : ["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"].find((s) => inv.count(c, s) > 0) ?? pref;
      const cropBlock = { "minecraft:wheat_seeds": "minecraft:wheat", "minecraft:carrot": "minecraft:carrots", "minecraft:potato": "minecraft:potatoes", "minecraft:beetroot_seeds": "minecraft:beetroot" }[seed] ?? "minecraft:wheat";
      const below = blockAt(dim, w.x, w.y - 1, w.z);
      if (below?.typeId !== "minecraft:farmland") return false;
      return yield* placeAt(c, w, cropBlock, seed, { growth: 0 });
    }
    case "fence": {
      const pref = blueprintItem("fence", wood);
      const item = inv.count(c, pref) > 0 ? pref : Object.keys(inv.summary(c)).find((id) => id.endsWith("_fence"));
      if (!item) return false;
      return yield* placeAt(c, w, item, item);
    }
    default: {
      if (SOLID_M.has(b.m)) {
        const pick = yield* pickSolid(c, b.m, wood);
        if (!pick) return false;
        return yield* placeAt(c, w, pick.id, pick.item, pick.states);
      }
      const id = blueprintBlock(b.m, wood);
      const item = blueprintItem(b.m, wood);
      return yield* placeAt(c, w, id, item ?? null);
    }
  }
}
