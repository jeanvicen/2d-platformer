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
  const right = rotateLocal({ x: 1, y: 0, z: 0 }, card);
  for (const shift of [0, width, -width, 2 * width, -2 * width]) {
    const ox = base.x + right.x * shift, oz = base.z + right.z * shift;
    const gy = groundY(dim, ox, oz, base.y);
    if (gy === undefined) continue;
    const site = { origin: { x: ox, y: gy - 1, z: oz }, card };
    if (siteFree(c, blocks, site)) return site;
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
  // lista de compras (já descontando o que ela tem)
  const list = shoppingList(blocks, wood);
  const crop = o.crop ?? "minecraft:wheat_seeds";
  c.flags.crop = crop;
  if (list["minecraft:wheat_seeds"]) {
    list[crop] = list["minecraft:wheat_seeds"];
    if (crop !== "minecraft:wheat_seeds") delete list["minecraft:wheat_seeds"];
  }
  // fundação: estima buracos a preencher
  const fill = estimateFill(c, blocks, site);
  if (fill > 0) list["minecraft:cobblestone"] = (list["minecraft:cobblestone"] ?? 0) + fill;
  if (blocks.some((b) => b.m === "farmland")) list["minecraft:wooden_hoe"] = 1;
  const missing = Object.entries(list).filter(([id, n]) => inv.count(c, id) < n);
  if (missing.length) {
    const txt = missing.slice(0, 6).map(([id, n]) => `${n - inv.count(c, id)} ${ptName(id)}`).join(", ");
    say(c, `Pra ${bp.name.toLowerCase()} eu preciso de: ${txt}${missing.length > 6 ? "..." : ""}. Vou juntar tudo!`, { force: !!o.cmd });
  }
  if (list["minecraft:wooden_hoe"]) {
    delete list["minecraft:wooden_hoe"];
    if (inv.toolTier(c, "hoe") === "none") yield* obtain(c, { toolKind: "hoe", tier: "wooden" }, 1, o);
  }
  yield* obtainAll(c, list, o);
  say(c, `Materiais prontos! Começando ${bp.name.toLowerCase()}.`, { force: !!o.cmd });
  const dim = c.dim();
  // limpeza do interior (só natural) e fundação
  yield* clearInterior(c, blocks, site);
  yield* fillFoundation(c, blocks, site);
  const order = buildOrder(blocks);
  let placed = 0;
  for (const b of order) {
    if (!c.alive()) return false;
    yield* breathe();
    if (b.m === "door_upper") continue;
    const w = toWorld(site, b);
    const want = blueprintBlock(b.m, wood);
    const cur = blockAt(dim, w.x, w.y, w.z);
    if (!cur) continue;
    if (b.m === "air") {
      if (!cur.isAir && canBreak(c, dim, w, cur.typeId)) {
        if (yield* reach(c, w, 4)) yield* quickBreak(c, w, { strict: false });
      }
      continue;
    }
    if (cur.typeId === want) continue;
    if (!cur.isAir && !REPLACEABLE.test(cur.typeId)) {
      if (!canBreak(c, dim, w, cur.typeId)) continue; // nunca mexe no que é do jogador
      if (!(yield* reach(c, w, 4))) continue;
      yield* quickBreak(c, w, { strict: false });
    }
    if (!(yield* reach(c, w, 4.2))) continue;
    const ok = yield* placeOne(c, b, w, wood, site);
    if (ok) placed++;
    if (placed % 40 === 39) say(c, `Obra em andamento: ${Math.round((placed / order.length) * 100)}%`, { chatter: true });
  }
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
      yield 5;
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
    default: {
      const id = blueprintBlock(b.m, wood);
      const item = blueprintItem(b.m, wood);
      const states = b.m === "log" ? { pillar_axis: "y" } : b.m === "slab" ? { "minecraft:vertical_half": "bottom" } : undefined;
      return yield* placeAt(c, w, id, item ?? null, states);
    }
  }
}
