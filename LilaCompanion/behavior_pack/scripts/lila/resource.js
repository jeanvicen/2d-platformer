// ResourceService: coleta de verdade — corta árvores inteiras, minera com a picareta certa,
// desce em escadaria até a camada do minério, abre túneis, colhe plantas maduras e explora longe.
import { system } from "@minecraft/server";
import { ORES, ORE_DEPTH, ORE_TIER, TIER_RANK, CROPS, isLog, isLeaves, oreOf } from "../lib/items.js";
import { GoalError, NeedTool } from "./companion.js";
import { blockAt, cellFn, exposed, findBlocks, groundY, isLoaded, isTreeLog, safeState, treeLogs } from "./world.js";
import { canBreak, collectDrops, face, harvestCrop, lavaNear, pickBerries, placeAt, quickBreak } from "./blocks.js";
import { goTo, stop } from "./motor.js";
import * as inv from "./inventory.js";
import { hold, setAction } from "./anim.js";
import { say } from "./talk.js";
import { keepLoaded } from "./areas.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {{x:number,y:number,z:number}} Vec */

const LOG_TYPES = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "poplar"].map((w) => `minecraft:${w}_log`)
  .concat(["minecraft:crimson_stem", "minecraft:warped_stem"]);

/** Anda até ficar ao alcance de um bloco (pode estar acima/abaixo). */
export function* reach(c, p, r = 3.2) {
  const target = { x: p.x + 0.5, y: p.y, z: p.z + 0.5 };
  if (near3(c.pos(), target, r + 0.6)) return true;
  return yield* goTo(c, target, { reach: Math.min(r, 2.6), yTol: 3.2 });
}

const near3 = (a, b, r) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= r * r && Math.abs(a.y + 1 - b.y) <= r;

/** Quebra um bloco em qualquer lugar: anda até ele e quebra (resolve NeedTool no planejador). */
export function* breakBlock(c, p, strict = true) {
  if (!(yield* reach(c, p))) return false;
  if (lavaNear(c.dim(), p)) return false;
  return yield* quickBreak(c, p, { strict });
}

/**
 * Corta árvores até ter `want` troncos no inventário. Corta a árvore inteira (como jogadora),
 * pega mudas/maçãs do chão e replanta uma muda quando tiver.
 */
export function* chopTrees(c, want) {
  const dim = c.dim();
  let explorations = 0;
  while (inv.count(c, { group: "log" }) < want && c.alive()) {
    const here = c.pos();
    const remembered = c.mem.nearest("tree", here, dim.id, 64);
    let base;
    if (remembered) {
      const b = blockAt(dim, remembered.x, remembered.y, remembered.z);
      if (b && isLog(b.typeId)) base = remembered;
      else c.mem.forget("tree", remembered);
    }
    if (!base) {
      const logs = findBlocks(dim, here, LOG_TYPES, { r: 28, dy: 12, max: 40, filter: (p) => isTreeLog(dim, p) && canBreak(c, dim, p, blockAt(dim, p.x, p.y, p.z)?.typeId) });
      // prefere o tronco mais baixo de cada árvore
      base = logs.sort((a, b) => a.y - b.y || 0)[0];
      for (const l of logs.slice(0, 6)) c.mem.remember("tree", l, dim.id);
    }
    if (!base) {
      if (++explorations > 10) throw new GoalError("não achei árvores por perto, mesmo explorando bem longe");
      yield* exploreStep(c, "árvores");
      continue;
    }
    explorations = 0;
    const logs = treeLogs(dim, base);
    for (const l of logs) {
      if (inv.count(c, { group: "log" }) >= want + 6) break;
      // troncos altos: sobe em pilar se não alcança
      if (l.y - c.pos().y > 4.5) {
        const ok = yield* reach(c, l, 4.2);
        if (!ok) break;
      }
      const ok = yield* breakBlock(c, l, false);
      if (!ok) continue;
    }
    c.mem.forget("tree", base);
    yield* sweepItems(c, base, 6);
    // replanta (boa cidadã da floresta)
    yield* replant(c, base);
  }
  return true;
}

function* replant(c, base) {
  const dim = c.dim();
  const sap = Object.keys(inv.summary(c)).find((id) => /_sapling$/.test(id));
  if (!sap) return;
  const ground = blockAt(dim, base.x, base.y - 1, base.z);
  const spot = blockAt(dim, base.x, base.y, base.z);
  if (!ground || !spot || !spot.isAir || !/grass_block|dirt|podzol|moss/.test(ground.typeId)) return;
  if (!(yield* reach(c, base))) return;
  yield* placeAt(c, base, sap, sap);
}

/** Recolhe itens caídos numa área (anda até eles). */
export function* sweepItems(c, center, r = 6) {
  const dim = c.dim();
  for (let k = 0; k < 6; k++) {
    let items = [];
    try {
      items = dim.getEntities({ type: "minecraft:item", location: center, maxDistance: r });
    } catch {
      return;
    }
    if (!items.length) return;
    const it = items[0];
    if (!it.isValid) continue;
    yield* goTo(c, it.location, { reach: 1.0, yTol: 2, timeout: 120, allowTeleport: false });
    collectDrops(c, c.pos(), 2.2);
  }
}

/**
 * Minera blocos de certos tipos até ter `want` do item. Procura blocos expostos (visíveis),
 * e se não houver: desce em escadaria até a camada certa e abre túnel.
 * @param {{types:string[], item:any, want:number, depth?:number, tier?:string, label:string}} o
 */
export function* mineFor(c, o) {
  const dim = c.dim();
  let tunnels = 0;
  let explorations = 0;
  if (o.tier && o.tier !== "none") {
    const have = inv.toolTier(c, "pickaxe");
    if (TIER_RANK[have] < TIER_RANK[o.tier]) throw new NeedTool("pickaxe", o.tier);
  }
  while (inv.count(c, o.item) < o.want && c.alive()) {
    const here = c.pos();
    // 1) visíveis num raio grande (cavernas, encostas) ou qualquer um bem pertinho
    let list = findBlocks(dim, here, o.types, { r: 20, dy: 14, max: 30, filter: (p) => exposed(dim, p) && !lavaNear(dim, p) });
    if (!list.length) list = findBlocks(dim, here, o.types, { r: 4, dy: 4, max: 10, filter: (p) => !lavaNear(dim, p) });
    if (list.length) {
      const target = list[0];
      const ok = yield* breakBlock(c, target, true);
      if (!ok) {
        // inalcançável: marca e tenta outro
        c.flags.badBlocks = (c.flags.badBlocks ?? 0) + 1;
        if (c.flags.badBlocks > 6) {
          c.flags.badBlocks = 0;
          yield* exploreStep(c, o.label);
        }
        continue;
      }
      c.flags.badBlocks = 0;
      // veio de minério: pega os vizinhos do mesmo tipo
      yield* mineVein(c, target, o.types, o.item, o.want);
      continue;
    }
    // 2) sem nada à vista: escadaria até a camada do recurso e túnel
    if (o.depth !== undefined && Math.abs(c.pos().y - o.depth) > 6) {
      yield* staircase(c, o.depth);
      continue;
    }
    if (tunnels < 6) {
      tunnels++;
      yield* tunnel(c, 16, o.types);
      continue;
    }
    if (++explorations > 8) throw new GoalError(`não encontrei ${o.label} depois de procurar muito`);
    tunnels = 0;
    yield* exploreStep(c, o.label);
  }
  return true;
}

function* mineVein(c, start, types, item, want) {
  const dim = c.dim();
  const seen = new Set();
  const q = [start];
  let n = 0;
  while (q.length && n < 16 && inv.count(c, item) < want + 4) {
    const p = q.shift();
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const np = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
      const k = `${np.x},${np.y},${np.z}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const b = blockAt(dim, np.x, np.y, np.z);
      if (!b || !types.includes(b.typeId) || lavaNear(dim, np)) continue;
      if (yield* breakBlock(c, np, true)) {
        n++;
        q.push(np);
      }
    }
  }
}

/** Escadaria para baixo/cima até uma altura (2 de altura, sem cair em buracos, desvia de lava). */
export function* staircase(c, targetY, maxSteps = 40) {
  const dim = c.dim();
  const cell = cellFn(dim);
  let dir = pickDir(c);
  say(c, targetY < c.pos().y ? "Vou descer cavando uma escadaria." : "Subindo de volta pra superfície.", { chatter: true });
  for (let s = 0; s < maxSteps && c.alive(); s++) {
    const p = c.pos();
    const by = Math.floor(p.y);
    if (Math.abs(by - targetY) <= 2) return true;
    const down = targetY < by;
    const bx = Math.floor(p.x), bz = Math.floor(p.z);
    const nx = bx + dir[0], nz = bz + dir[1];
    const ny = down ? by - 1 : by + 1;
    const cells = down ? [ny, ny + 1, ny + 2] : [ny, ny + 1, by + 2];
    let blocked = false;
    for (const yy of cells) {
      const xx = yy === by + 2 && !down ? bx : nx, zz = yy === by + 2 && !down ? bz : nz;
      const b = blockAt(dim, xx, yy, zz);
      if (!b) {
        blocked = true;
        break;
      }
      if (/lava/.test(b.typeId) || lavaNear(dim, { x: xx, y: yy, z: zz })) {
        blocked = true;
        break;
      }
      if (cell(xx, yy, zz) === 1 || cell(xx, yy, zz) === 4) {
        if (!canBreak(c, dim, { x: xx, y: yy, z: zz }, b.typeId)) {
          blocked = true;
          break;
        }
        try {
          if (!(yield* quickBreak(c, { x: xx, y: yy, z: zz }, { strict: false }))) {
            blocked = true;
            break;
          }
        } catch {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) {
      dir = turn(dir);
      continue;
    }
    // chão do próximo degrau
    if (cell(nx, ny - 1, nz) !== 1) {
      const blk = inv.scaffoldBlock(c);
      if (blk) yield* placeAt(c, { x: nx, y: ny - 1, z: nz }, blk, blk);
      else {
        dir = turn(dir);
        continue;
      }
    }
    stepTo(c, { x: nx + 0.5, y: ny, z: nz + 0.5 });
    yield 3;
    if (s % 8 === 7) yield* placeTorchHere(c);
  }
  return Math.abs(Math.floor(c.pos().y) - targetY) <= 3;
}

/** Túnel reto 1×2 procurando minérios nas paredes (mineração em galeria). */
export function* tunnel(c, len, oreTypes) {
  const dim = c.dim();
  const cell = cellFn(dim);
  let dir = pickDir(c);
  for (let s = 0; s < len && c.alive(); s++) {
    const p = c.pos();
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const nx = bx + dir[0], nz = bz + dir[1];
    let blocked = false;
    for (const yy of [by, by + 1]) {
      const b = blockAt(dim, nx, yy, nz);
      if (!b || /lava/.test(b.typeId) || lavaNear(dim, { x: nx, y: yy, z: nz })) {
        blocked = true;
        break;
      }
      if (cell(nx, yy, nz) === 1) {
        if (!canBreak(c, dim, { x: nx, y: yy, z: nz }, b.typeId)) {
          blocked = true;
          break;
        }
        if (!(yield* quickBreak(c, { x: nx, y: yy, z: nz }, { strict: false }))) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) {
      dir = turn(dir);
      continue;
    }
    if (cell(nx, by - 1, nz) !== 1) {
      const blk = inv.scaffoldBlock(c);
      if (blk) yield* placeAt(c, { x: nx, y: by - 1, z: nz }, blk, blk);
      else {
        dir = turn(dir);
        continue;
      }
    }
    stepTo(c, { x: nx + 0.5, y: by, z: nz + 0.5 });
    yield 3;
    if (s % 10 === 9) yield* placeTorchHere(c);
    // olha as paredes: achou minério? para o túnel e deixa o mineFor pegar
    if (oreTypes && findBlocks(dim, c.pos(), oreTypes, { r: 3, dy: 2, max: 1 }).length) return true;
  }
  return false;
}

function stepTo(c, p) {
  const e = c.entity;
  if (!e) return;
  face(c, { x: p.x - 0.5, y: p.y, z: p.z - 0.5 });
  try {
    e.teleport(p, { keepVelocity: false });
  } catch {
    /* ignore */
  }
}

function pickDir(c) {
  const y = c.entity?.getRotation().y ?? 0;
  const r = ((y % 360) + 360) % 360;
  if (r < 45 || r >= 315) return [0, 1];
  if (r < 135) return [-1, 0];
  if (r < 225) return [0, -1];
  return [1, 0];
}

const turn = (d) => [-d[1], d[0]];

/** Coloca uma tocha se estiver escuro e ela tiver tochas. */
export function* placeTorchHere(c) {
  const dim = c.dim();
  const p = c.pos();
  const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
  if (inv.count(c, "minecraft:torch") < 1) return;
  const b = blockAt(dim, bx, by, bz);
  try {
    if (b && b.getLightLevel() > 7) return;
  } catch {
    /* ignore */
  }
  const below = blockAt(dim, bx, by - 1, bz);
  if (!b?.isAir || !below || below.isAir) return;
  // tocha atrás dela para não atrapalhar o caminho
  yield* placeAt(c, { x: bx, y: by, z: bz }, "minecraft:torch", "minecraft:torch", { torch_facing_direction: "top" });
}

/**
 * Explora: anda 40–60 blocos para uma área ainda não visitada (mantendo os chunks carregados),
 * anotando árvores, água, areia e minérios visíveis no caminho.
 */
export function* exploreStep(c, what) {
  const dim = c.dim();
  const p = c.pos();
  const home = c.ownerPos();
  const roam = c.rec.settings.roam ?? 96;
  let best, bestScore = -Infinity;
  for (let k = 0; k < 12; k++) {
    const ang = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 24;
    const q = { x: p.x + Math.cos(ang) * d, y: p.y, z: p.z + Math.sin(ang) * d };
    const fromHome = Math.hypot(q.x - home.x, q.z - home.z);
    let score = (c.mem.isExplored(q) ? -40 : 20) - Math.max(0, fromHome - roam * 2.5) * 2;
    if (!isLoaded(dim, q)) score -= 5;
    if (score > bestScore) {
      bestScore = score;
      best = q;
    }
  }
  if (!best) return false;
  say(c, `Vou explorar ali pra frente procurando ${what}.`, { chatter: true });
  c.mem.markExplored(p);
  keepLoaded(c, true);
  // sobe para a superfície se estiver no subsolo (exploração é por cima)
  const gy = groundY(dim, Math.floor(best.x), Math.floor(best.z), p.y);
  const target = { x: best.x, y: gy ?? p.y, z: best.z };
  const ok = yield* goTo(c, target, { reach: 4, yTol: 8, run: true, timeout: 900, allowTeleport: false });
  c.mem.markExplored(c.pos());
  scanSurroundings(c);
  return ok;
}

/** Anota recursos visíveis por perto na memória espacial. */
export function scanSurroundings(c) {
  const dim = c.dim();
  const p = c.pos();
  for (const t of findBlocks(dim, p, LOG_TYPES, { r: 20, dy: 10, max: 4, filter: (q) => isTreeLog(dim, q) })) c.mem.remember("tree", t, dim.id);
  for (const w of findBlocks(dim, p, ["minecraft:water"], { r: 20, dy: 8, max: 2 })) c.mem.remember("water", w, dim.id);
  for (const s of findBlocks(dim, p, ["minecraft:sand"], { r: 20, dy: 8, max: 2 })) c.mem.remember("sand", s, dim.id);
  for (const [ore, types] of Object.entries(ORES)) {
    for (const o of findBlocks(dim, p, types, { r: 16, dy: 10, max: 2, filter: (q) => exposed(dim, q) })) c.mem.remember(`ore_${ore}`, o, dim.id);
  }
}

/** Itens de blocos simples (terra, areia, cascalho, argila, pedra...). */
export function* digFor(c, types, item, want, label) {
  const dim = c.dim();
  let explorations = 0;
  while (inv.count(c, item) < want && c.alive()) {
    const here = c.pos();
    const list = findBlocks(dim, here, types, { r: 24, dy: 10, max: 20, filter: (p) => exposed(dim, p) && canBreak(c, dim, p, blockAt(dim, p.x, p.y, p.z)?.typeId) && !lavaNear(dim, p) });
    if (!list.length) {
      if (++explorations > 8) throw new GoalError(`não achei ${label} por perto`);
      yield* exploreStep(c, label);
      continue;
    }
    explorations = 0;
    // pega primeiro os mais altos (não cava buracos fundos no chão)
    list.sort((a, b) => b.y - a.y);
    yield* breakBlock(c, list[0], true);
  }
  return true;
}

/** Colhe plantas maduras e frutas por perto até ter `want` do item (ou comida). */
export function* harvestNearby(c, target, want, r = 24) {
  const dim = c.dim();
  const crops = findBlocks(dim, c.pos(), Object.keys(CROPS), { r, dy: 6, max: 40, filter: (p) => {
    const b = blockAt(dim, p.x, p.y, p.z);
    const info = b && CROPS[b.typeId];
    return !!info && safeState(b, info.state) === info.ripe;
  } });
  for (const p of crops) {
    if (inv.count(c, target) >= want) return true;
    if (!(yield* reach(c, p, 2.6))) continue;
    yield* harvestCrop(c, p);
  }
  const bushes = findBlocks(dim, c.pos(), ["minecraft:sweet_berry_bush"], { r, dy: 6, max: 12, filter: (p) => (safeState(blockAt(dim, p.x, p.y, p.z), "growth") ?? 0) >= 2 });
  for (const p of bushes) {
    if (inv.count(c, target) >= want) return true;
    if (!(yield* reach(c, p, 2.6))) continue;
    yield* pickBerries(c, p);
  }
  return inv.count(c, target) >= want;
}

/** Folhas de carvalho podem dar maçã — ela quebra algumas folhas baixas. */
export function* applesFromLeaves(c, want, maxLeaves = 40) {
  const dim = c.dim();
  const leaves = findBlocks(dim, c.pos(), ["minecraft:oak_leaves", "minecraft:dark_oak_leaves"], { r: 16, dy: 6, max: maxLeaves,
    filter: (p) => safeState(blockAt(dim, p.x, p.y, p.z), "persistent_bit") !== true && exposed(dim, p) });
  for (const p of leaves) {
    if (inv.count(c, "minecraft:apple") >= want) break;
    if (!(yield* reach(c, p, 3))) continue;
    yield* quickBreak(c, p, { strict: false });
  }
  return inv.count(c, "minecraft:apple") >= want;
}

/** Grama alta dá sementes (como no jogo). */
export function* seedsFromGrass(c, want) {
  const dim = c.dim();
  let tries = 0;
  while (inv.count(c, "minecraft:wheat_seeds") < want && tries < 4 && c.alive()) {
    const grass = findBlocks(dim, c.pos(), ["minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern"], { r: 20, dy: 6, max: 30 });
    if (!grass.length) {
      tries++;
      yield* exploreStep(c, "grama para sementes");
      continue;
    }
    for (const p of grass) {
      if (inv.count(c, "minecraft:wheat_seeds") >= want) break;
      if (!(yield* reach(c, p, 3))) continue;
      yield* quickBreak(c, p, { strict: false });
    }
    tries++;
  }
  return inv.count(c, "minecraft:wheat_seeds") >= want;
}

/** Enche um balde em água próxima. */
export function* fillBucket(c) {
  const dim = c.dim();
  if (inv.count(c, "minecraft:water_bucket") > 0) return true;
  if (inv.count(c, "minecraft:bucket") < 1) return false;
  let explorations = 0;
  for (;;) {
    const mem = c.mem.nearest("water", c.pos(), dim.id, 80);
    let list = findBlocks(dim, c.pos(), ["minecraft:water"], { r: 28, dy: 10, max: 10, filter: (p) => safeState(blockAt(dim, p.x, p.y, p.z), "liquid_depth") === 0 });
    if (!list.length && mem) list = [mem];
    if (list.length) {
      const w = list[0];
      if (!(yield* reach(c, w, 3))) {
        c.mem.forget("water", w);
        if (++explorations > 6) return false;
        continue;
      }
      face(c, w);
      setAction(c.entity, "place");
      yield 6;
      inv.take(c, "minecraft:bucket", 1);
      inv.addId(c, "minecraft:water_bucket", 1);
      c.entity?.dimension.playSound("bucket.fill_water", c.pos());
      setAction(c.entity, "idle");
      c.mem.remember("water", w, dim.id);
      return true;
    }
    if (++explorations > 6) return false;
    yield* exploreStep(c, "água");
  }
}

export { stop, hold, isLeaves, oreOf, ORE_DEPTH, ORE_TIER, system };
