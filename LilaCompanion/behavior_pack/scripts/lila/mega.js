// Executor das megaconstruções, transformações de bioma e do "aplainar". O DR-0N tem material
// infinito. No modo padrão ("humano") ele constrói À MÃO: voa até cada ponto e coloca bloco por
// bloco, parte por parte, de baixo para cima, como um jogador voando (veja handwork.js). O modo
// "instantâneo" (Configurações) ainda existe. Nunca quebra construção de jogador sem você pedir:
// a limpeza só remove blocos naturais, e se o lugar tem coisa sua ele procura outro ao lado.
import { BlockPermutation, BlockVolume, ItemStack, system } from "@minecraft/server";
import { PLANS, volume } from "../lib/megaplans.js";
import { BIOMES, MEGA } from "../lib/catalog.js";
import { GoalError } from "./companion.js";
import { particle, setAction, sound } from "./anim.js";
import { hover } from "./drone.js";
import { Placer, SPEEDS, serpentine, speedOf, vacuum } from "./handwork.js";
import { say } from "./talk.js";
import { breathe } from "../core/budget.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

const LEAVES = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "azalea", "flowering_azalea", "pale_oak"].map((w) => `minecraft:${w}_leaves`);
const LOGS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak"].map((w) => `minecraft:${w}_log`);
const PLANTS = ["minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:dandelion", "minecraft:poppy",
  "minecraft:deadbush", "minecraft:vine", "minecraft:sweet_berry_bush", "minecraft:snow_layer", "minecraft:sugar_cane", "minecraft:cactus",
  "minecraft:bamboo", "minecraft:pink_petals", "minecraft:red_mushroom", "minecraft:brown_mushroom", "minecraft:azure_bluet", "minecraft:oxeye_daisy",
  "minecraft:cornflower", "minecraft:allium", "minecraft:blue_orchid", "minecraft:lily_of_the_valley", "minecraft:red_tulip", "minecraft:orange_tulip",
  "minecraft:white_tulip", "minecraft:pink_tulip", "minecraft:waterlily", "minecraft:leaf_litter", "minecraft:bush", "minecraft:firefly_bush",
  "minecraft:short_dry_grass", "minecraft:tall_dry_grass", "minecraft:wildflowers", "minecraft:seagrass"].filter(Boolean);
const GROUND = ["minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:mycelium", "minecraft:stone",
  "minecraft:granite", "minecraft:diorite", "minecraft:andesite", "minecraft:deepslate", "minecraft:tuff", "minecraft:sand", "minecraft:red_sand",
  "minecraft:gravel", "minecraft:clay", "minecraft:snow", "minecraft:ice", "minecraft:packed_ice", "minecraft:mud", "minecraft:sandstone",
  "minecraft:red_sandstone", "minecraft:calcite", "minecraft:moss_block", "minecraft:powder_snow", "minecraft:dirt_with_roots"];
/** O que a limpeza pode tirar do caminho (só natureza). */
export const NATURAL = [...GROUND, ...LEAVES, ...LOGS, ...PLANTS, "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:pumpkin", "minecraft:melon_block", "minecraft:brown_mushroom_block", "minecraft:red_mushroom_block", "minecraft:mushroom_stem", "minecraft:kelp",
  "minecraft:coal_ore", "minecraft:iron_ore", "minecraft:copper_ore"];
const NATSET = new Set([...NATURAL, "minecraft:air"]);
const NAT_BREAK = new Set(NATURAL);

const PERM = new Map();
function perm(id, st) {
  const k = st ? `${id}|${JSON.stringify(st)}` : id;
  let p = PERM.get(k);
  if (p === undefined) {
    try {
      p = BlockPermutation.resolve(id, st ?? {});
    } catch {
      try {
        p = BlockPermutation.resolve(id);
      } catch (e) {
        logError("mega.perm", `${id}: ${e}`);
        p = null;
      }
    }
    PERM.set(k, p);
  }
  return p;
}

/** Enche uma caixa grande em pedaços de até 16×16×16 (cede o tick entre pedaços). */
function* fillBox(dim, a, b, p, filter) {
  for (let x = a.x; x <= b.x; x += 16) {
    for (let z = a.z; z <= b.z; z += 16) {
      for (let y = a.y; y <= b.y; y += 16) {
        const lo = { x, y: Math.max(y, dim.heightRange.min), z };
        const hi = { x: Math.min(b.x, x + 15), y: Math.min(b.y, y + 15, dim.heightRange.max - 1), z: Math.min(b.z, z + 15) };
        if (hi.y < lo.y) continue;
        try {
          dim.fillBlocks(new BlockVolume(lo, hi), p, filter ? { blockFilter: filter } : undefined);
        } catch (e) {
          if (!String(e).includes("unloaded")) logError("mega.fill", e);
        }
        yield* breathe(6);
      }
    }
  }
}

function topSolid(dim, x, z, fromY) {
  // uma chamada nativa acha o topo; depois desce só pela vegetação (folhas, troncos, plantas)
  let b;
  try {
    b = dim.getTopmostBlock({ x, z }, Math.min(dim.heightRange.max - 1, Math.floor(fromY) + 40));
  } catch {
    return undefined;
  }
  for (let k = 0; b && k < 48; k++) {
    if (b.y < fromY - 40) return undefined;
    if (!(b.isAir || b.isLiquid || LEAVES.includes(b.typeId) || LOGS.includes(b.typeId) || PLANTS.includes(b.typeId))) return b.y;
    b = dim.getBlock({ x, y: b.y - 1, z });
  }
  return undefined;
}

/** Área carregada enquanto constrói (tickingarea temporária). */
function loadArea(dim, c, a, b) {
  const name = `lila_mega_${c.rec.ownerId.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`;
  try {
    dim.runCommand(`tickingarea remove ${name}`);
  } catch {
    /* não existia */
  }
  try {
    dim.runCommand(`tickingarea add ${Math.floor(a.x)} 0 ${Math.floor(a.z)} ${Math.floor(b.x)} 0 ${Math.floor(b.z)} ${name} true`);
  } catch (e) {
    logError("mega.area", e);
  }
  return name;
}

function unloadArea(dim, name) {
  try {
    dim.runCommand(`tickingarea remove ${name}`);
  } catch {
    /* ignore */
  }
}

/** Conta blocos de jogador numa amostra da área (para não construir em cima de nada seu). */
function* playerBlocks(dim, cx, cz, y0, half) {
  let n = 0;
  const step = half > 30 ? 4 : 3;
  for (let x = cx - half; x <= cx + half; x += step) {
    for (let z = cz - half; z <= cz + half; z += step) {
      for (const dy of [1, 3]) {
        const b = dim.getBlock({ x, y: y0 + dy, z });
        if (b && !NATSET.has(b.typeId)) n++;
      }
    }
    yield* breathe(6);
  }
  return n;
}

/**
 * Constrói uma megaconstrução na sua frente.
 * @param {Companion} c
 */
export function* megaBuild(c, key, o = {}) {
  const make = PLANS[key];
  if (!make) throw new GoalError(`não conheço a construção "${key}"`);
  const owner = c.owner();
  const dim = c.dim();
  const plan = make(Math.floor(Math.random() * 1e6));
  const ref = owner && owner.dimension.id === dim.id ? owner.location : c.pos();
  const view = owner ? owner.getViewDirection() : { x: 0, y: 0, z: 1 };
  const vl = Math.hypot(view.x, view.z) || 1;
  const fwd = { x: view.x / vl, z: view.z / vl };
  const dist = plan.half + (o.here ? 3 : 8);
  let cx = Math.round(ref.x + fwd.x * dist), cz = Math.round(ref.z + fwd.z * dist);
  const label = MEGA[key]?.name ?? plan.name;
  say(c, `Construindo: ${label} (${plan.half * 2 + 1}×${plan.half * 2 + 1}, ~${Math.round(volume(plan) / 1000)} mil blocos). Material infinito, bora!`, { force: true });
  const area = loadArea(dim, c, { x: cx - plan.half - 2, z: cz - plan.half - 2 }, { x: cx + plan.half + 2, z: cz + plan.half + 2 });
  try {
    // espera a área carregar
    for (let t = 0; t < 200; t++) {
      if (dim.getBlock({ x: cx + plan.half, y: Math.floor(ref.y), z: cz + plan.half }) && dim.getBlock({ x: cx - plan.half, y: Math.floor(ref.y), z: cz - plan.half })) break;
      yield 5;
    }
    let y0 = topSolid(dim, cx, cz, ref.y) ?? Math.floor(ref.y) - 1;
    // tem construção de jogador aqui? tenta ao lado
    const side = { x: -fwd.z, z: fwd.x };
    for (const shift of [0, 1, -1, 2]) {
      const tx = Math.round(cx + side.x * shift * (plan.half * 2 + 6)), tz = Math.round(cz + side.z * shift * (plan.half * 2 + 6));
      const ty = topSolid(dim, tx, tz, ref.y) ?? y0;
      const n = yield* playerBlocks(dim, tx, tz, ty, plan.half);
      if (n <= 3) {
        cx = tx;
        cz = tz;
        y0 = ty;
        break;
      }
      if (shift === 2) throw new GoalError("tem construção sua em todo lugar aqui na frente. Vai pra um lugar mais aberto e me pede de novo");
    }
    c.flags.lastBuild = { cx, cz, y0, half: plan.half };
    const speed = speedOf(c);
    if (speed === "instantaneo") {
      setAction(c.entity, "craft");
      // terreno: limpa só natureza acima e nivela a base
      if (plan.clear) {
        yield* fillBox(dim, { x: cx - plan.half, y: y0 + 1, z: cz - plan.half }, { x: cx + plan.half, y: y0 + plan.height + 2, z: cz + plan.half }, perm("minecraft:air"), { includeTypes: NATURAL });
        yield* fillBox(dim, { x: cx - plan.half, y: y0 - 4, z: cz - plan.half }, { x: cx + plan.half, y: y0 - 1, z: cz + plan.half }, perm("minecraft:dirt"), { includeTypes: ["minecraft:air", "minecraft:water", "minecraft:flowing_water"] });
        yield* fillBox(dim, { x: cx - plan.half, y: y0, z: cz - plan.half }, { x: cx + plan.half, y: y0, z: cz + plan.half }, perm("minecraft:grass_block"), { includeTypes: ["minecraft:air", "minecraft:water", "minecraft:flowing_water", ...PLANTS] });
      }
      const total = plan.ops.length;
      let done = 0, lastPct = 0;
      for (const op of plan.ops) {
        if (!c.alive()) return false;
        done++;
        try {
          if (op[0] === "f") {
            const p = perm(op[7], op[8]);
            if (p) yield* fillBox(dim, { x: cx + op[1], y: y0 + op[2], z: cz + op[3] }, { x: cx + op[4], y: y0 + op[5], z: cz + op[6] }, p);
          } else if (op[0] === "s") {
            const p = perm(op[4], op[5]);
            const b = p && dim.getBlock({ x: cx + op[1], y: y0 + op[2], z: cz + op[3] });
            b?.setPermutation(p);
          } else if (op[0] === "e") {
            dim.spawnEntity(op[4], { x: cx + op[1], y: y0 + op[2], z: cz + op[3] });
          } else if (op[0] === "c") {
            const ct = dim.getBlock({ x: cx + op[1], y: y0 + op[2], z: cz + op[3] })?.getComponent("minecraft:inventory")?.container;
            for (const [id, n] of op[4]) ct?.addItem(new ItemStack(id, n));
          }
        } catch (e) {
          logError("mega.op", `${op[0]} ${op[op[0] === "f" ? 7 : 4]}: ${e}`);
        }
        if (done % 12 === 0) beamFx(c, { x: cx + (op[1] ?? 0), y: y0 + (op[2] ?? 0) + 1, z: cz + (op[3] ?? 0) });
        const pct = Math.floor((done / total) * 4) * 25;
        if (pct > lastPct && pct < 100) {
          lastPct = pct;
          say(c, `${label}: ${pct}%`, { force: true });
        }
        yield* breathe(6);
      }
    } else {
      // À MÃO: parte por parte (quadrados de 24×24), de baixo para cima, bloco por bloco
      const sp = SPEEDS[speed];
      const est = Math.max(1, Math.round((volume(plan) * 0.3) / sp.rate / 60));
      say(c, `Vou construir à mão, bloco por bloco (modo ${sp.label}): uns ${est} min. Dá pra acelerar em Configurações → Velocidade.`, { force: true });
      const placer = new Placer(c, speed, { natural: NAT_BREAK });
      yield* placer.run(manualStream(c, dim, plan, cx, cz, y0, label));
      if (!c.alive()) return false;
      for (const op of plan.ops) {
        try {
          if (op[0] === "e") dim.spawnEntity(op[4], { x: cx + op[1], y: y0 + op[2], z: cz + op[3] });
          else if (op[0] === "c") {
            const ct = dim.getBlock({ x: cx + op[1], y: y0 + op[2], z: cz + op[3] })?.getComponent("minecraft:inventory")?.container;
            for (const [id, n] of op[4]) ct?.addItem(new ItemStack(id, n));
          }
        } catch (e) {
          logError("mega.extra", e);
        }
      }
    }
    setAction(c.entity, "celebrate");
    sound(c.entity, "random.levelup", 1, 1.1);
    sound(c.entity, "lila.split", 0.6, 1.4);
    c.rec.stats.built++;
    c.save();
    say(c, `${label} pronto! Fica a ${Math.round(Math.hypot(cx - ref.x, cz - ref.z))} blocos na sua frente.`, { force: true });
    yield 40;
    return true;
  } finally {
    unloadArea(dim, area);
    setAction(c.entity, "idle");
  }
}

/** Gera o trabalho à mão: para cada parte (24×24) limpa o terreno natural, nivela e ergue a obra. */
function* manualStream(c, dim, plan, cx, cz, y0, label) {
  const T = 24, H = plan.half;
  const tiles = [];
  let row = 0;
  for (let tz = -H; tz <= H; tz += T, row++) {
    const r = [];
    for (let tx = -H; tx <= H; tx += T) r.push([tx, tz]);
    if (row & 1) r.reverse();
    tiles.push(...r);
  }
  let done = 0, lastPct = 0;
  for (const [tx, tz] of tiles) {
    const rx1 = Math.min(H, tx + T - 1), rz1 = Math.min(H, tz + T - 1);
    if (plan.clear) yield* prepTile(dim, cx, cz, y0, tx, tz, rx1, rz1, plan.height);
    yield* planTile(plan, cx, cz, y0, tx, tz, rx1, rz1);
    done++;
    const pct = Math.floor((done / tiles.length) * 4) * 25;
    if (pct > lastPct && pct < 100) {
      lastPct = pct;
      say(c, `${label}: ${pct}%`, { force: true });
    }
  }
}

/** Terreno de uma parte: quebra o natural acima do chão e nivela (terra embaixo, grama em cima). */
function* prepTile(dim, cx, cz, y0, x0, z0, x1, z1, height) {
  const cols = [];
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) cols.push({ x, z });
  for (const { x, z } of serpentine(cols)) {
    const wx = cx + x, wz = cz + z;
    let top;
    try {
      top = dim.getTopmostBlock({ x: wx, z: wz }, Math.min(dim.heightRange.max - 1, y0 + height + 2)); // começa a busca de cima
    } catch {
      continue;
    }
    if (top && top.y > y0) {
      for (let y = Math.min(top.y, y0 + height + 2); y > y0; y--) {
        const b = dim.getBlock({ x: wx, y, z: wz });
        if (b && !b.isAir && (NAT_BREAK.has(b.typeId) || b.isLiquid)) yield { x: wx, y, z: wz, id: "minecraft:air" };
      }
    }
    const g = dim.getBlock({ x: wx, y: y0, z: wz });
    if (g && (g.isAir || g.isLiquid || PLANTS.includes(g.typeId))) {
      for (let y = y0 - 3; y < y0; y++) {
        const u = dim.getBlock({ x: wx, y, z: wz });
        if (u && (u.isAir || u.isLiquid)) yield { x: wx, y, z: wz, id: "minecraft:dirt" };
      }
      yield { x: wx, y: y0, z: wz, id: "minecraft:grass_block" };
    }
    yield 0;
  }
}

/** A obra de uma parte, camada por camada (o resultado final de todas as operações). */
function* planTile(plan, cx, cz, y0, x0, z0, x1, z1) {
  const ops = plan.ops.filter((op) => (op[0] === "f" ? !(op[4] < x0 || op[1] > x1 || op[6] < z0 || op[3] > z1)
    : op[0] === "s" ? op[1] >= x0 && op[1] <= x1 && op[3] >= z0 && op[3] <= z1 : false));
  if (!ops.length) return;
  let ymin = Infinity, ymax = -Infinity;
  for (const op of ops) {
    ymin = Math.min(ymin, op[2]);
    ymax = Math.max(ymax, op[0] === "f" ? op[5] : op[2]);
  }
  for (let y = ymin; y <= ymax; y++) {
    const layer = new Map();
    for (const op of ops) {
      if (op[0] === "f") {
        if (y < op[2] || y > op[5]) continue;
        const ax = Math.max(op[1], x0), bx = Math.min(op[4], x1), az = Math.max(op[3], z0), bz = Math.min(op[6], z1);
        for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) layer.set((x + 4096) * 8192 + (z + 4096), [op[7], op[8], x, z]);
      } else if (op[2] === y) layer.set((op[1] + 4096) * 8192 + (op[3] + 4096), [op[4], op[5], op[1], op[3]]);
    }
    const cells = [...layer.values()].map(([id, st, x, z]) => ({ x, z, id, st }));
    for (const w of serpentine(cells)) {
      yield { x: cx + w.x, y: y0 + y, z: cz + w.z, id: w.id, st: w.st };
    }
    yield 0;
  }
}

/** O drone voa pela obra e dispara o feixe de construção. */
function beamFx(c, at) {
  const e = c.entity;
  if (!e?.isValid) return;
  const p = e.location;
  const goal = { x: at.x + 3, y: at.y + 6, z: at.z + 3 };
  try {
    const dx = goal.x - p.x, dy = goal.y - p.y, dz = goal.z - p.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 40) e.teleport(goal, { keepVelocity: false });
    else if (d > 1) {
      const v = e.getVelocity();
      const s = Math.min(1.2, d * 0.2);
      e.applyImpulse({ x: (dx / d) * s - v.x, y: (dy / d) * s - v.y, z: (dz / d) * s - v.z });
    } else hover(c);
  } catch {
    /* ignore */
  }
  const dim = e.dimension;
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    particle(dim, "lila:scan", { x: p.x + (at.x - p.x) * t, y: p.y + (at.y - p.y) * t, z: p.z + (at.z - p.z) * t });
  }
  particle(dim, "lila:build", at);
  if (Math.random() < 0.3) sound(e, "random.pop", 0.4, 1.6 + Math.random() * 0.3);
}

// ------------------------------------------------------------------ biomas
const FLOWERS = ["minecraft:dandelion", "minecraft:poppy", "minecraft:cornflower", "minecraft:allium", "minecraft:azure_bluet", "minecraft:oxeye_daisy",
  "minecraft:red_tulip", "minecraft:orange_tulip", "minecraft:white_tulip", "minecraft:pink_tulip", "minecraft:lily_of_the_valley", "minecraft:blue_orchid"];

/**
 * Transforma o lugar em volta de você (raio 36) num bioma: chão, árvores, plantas, água.
 * O jogo não deixa trocar o ID do bioma por script (a cor da grama/clima continuam).
 * @param {Companion} c
 */
export function* biomeTransform(c, biome) {
  const def = BIOMES[biome];
  if (!def) throw new GoalError(`não conheço o bioma "${biome}"`);
  const owner = c.owner();
  const dim = c.dim();
  const ref = owner && owner.dimension.id === dim.id ? owner.location : c.pos();
  const R = 36;
  const cx = Math.floor(ref.x), cz = Math.floor(ref.z), cy = Math.floor(ref.y);
  say(c, `Transformando tudo em volta em ${def.name}... segura aí!`, { force: true });
  const area = loadArea(dim, c, { x: cx - R, z: cz - R }, { x: cx + R, z: cz + R });
  setAction(c.entity, "scan");
  try {
    for (let t = 0; t < 120; t++) {
      if (dim.getBlock({ x: cx + R, y: cy, z: cz + R }) && dim.getBlock({ x: cx - R, y: cy, z: cz - R })) break;
      yield 5;
    }
    const speed = speedOf(c);
    const manual = speed !== "instantaneo";
    const placer = manual ? new Placer(c, speed, { natural: NAT_BREAK }) : null;
    const queue = [];
    const clearVeg = ["deserto", "cogumelo", "flores", "neve", "cerejeira", "selva", "pantano"].includes(biome);
    if (manual) {
      say(c, `Vou fazer à mão, coluna por coluna (modo ${SPEEDS[speed].label}): uns ${Math.max(1, Math.round((Math.PI * R * R * 3) / SPEEDS[speed].rate / 60))} min.`, { force: true });
    } else if (clearVeg) {
      // tira árvores e plantas antigas quando o bioma novo não combina com elas
      yield* fillBox(dim, { x: cx - R, y: cy - 6, z: cz - R }, { x: cx + R, y: cy + 30, z: cz + R }, perm("minecraft:air"), { includeTypes: [...LEAVES, ...LOGS, ...PLANTS] });
    }
    const put = manual
      ? (x, y, z, id, st) => queue.push({ x, y, z, id, st, soft: true })
      : (x, y, z, id, st) => {
        const p = perm(id, st);
        const b = p && dim.getBlock({ x, y, z });
        if (b && (b.isAir || PLANTS.includes(b.typeId) || LEAVES.includes(b.typeId) || id === "minecraft:air" || GROUND.includes(b.typeId) || b.isLiquid)) b.setPermutation(p);
      };
    const rnd = Math.random;
    let col = 0;
    for (let x = -R; x <= R; x++) {
      for (let zi = -R; zi <= R; zi++) {
        const z = (x & 1) ? -zi : zi; // zigue-zague
        if (manual && queue.length) yield* /** @type {Placer} */ (placer).run(queue.splice(0));
        const r = Math.hypot(x, z);
        if (r > R) continue;
        const wx = cx + x, wz = cz + z;
        const y = topSolid(dim, wx, wz, cy);
        if (y === undefined) continue;
        const top = dim.getBlock({ x: wx, y, z: wz });
        const above = dim.getBlock({ x: wx, y: y + 1, z: wz });
        const water = above?.isLiquid;
        const edge = r > R - 4 && rnd() < (r - (R - 4)) / 4; // borda irregular (mistura com o resto)
        if (!top || !GROUND.includes(top.typeId) || edge) continue;
        if (manual && clearVeg) {
          // à mão: derruba a vegetação antiga desta coluna, de cima para baixo
          let tb;
          try {
            tb = dim.getTopmostBlock({ x: wx, z: wz }, Math.min(dim.heightRange.max - 1, y + 40)); // começa a busca de cima
          } catch {
            /* ignore */
          }
          if (tb) for (let yy = Math.min(tb.y, y + 40); yy > y; yy--) queue.push({ x: wx, y: yy, z: wz, id: "minecraft:air" });
        }
        const ground = (id) => put(wx, y, wz, id);
        switch (biome) {
          case "neve":
            if (water) put(wx, y + 1, wz, "minecraft:ice");
            else {
              if (rnd() < 0.15) ground("minecraft:snow");
              put(wx, y + 1, wz, "minecraft:snow_layer", { height: Math.floor(rnd() * 2) });
              if (rnd() < 0.018) spruce(put, wx, y, wz, rnd, true);
            }
            break;
          case "deserto":
            if (!water) {
              ground("minecraft:sand");
              put(wx, y - 1, wz, "minecraft:sandstone");
              put(wx, y - 2, wz, "minecraft:sandstone");
              if (rnd() < 0.008) for (let k = 1; k <= 1 + Math.floor(rnd() * 3); k++) put(wx, y + k, wz, "minecraft:cactus");
              else if (rnd() < 0.02) put(wx, y + 1, wz, "minecraft:deadbush");
            }
            break;
          case "selva":
            if (!water) {
              ground("minecraft:grass_block");
              if (rnd() < 0.012) jungle(put, wx, y, wz, rnd);
              else if (rnd() < 0.05) bush(put, wx, y, wz, "minecraft:jungle_leaves");
              else if (rnd() < 0.01) for (let k = 1; k <= 5 + Math.floor(rnd() * 6); k++) put(wx, y + k, wz, "minecraft:bamboo");
              else if (rnd() < 0.006) put(wx, y + 1, wz, "minecraft:melon_block");
              else if (rnd() < 0.25) put(wx, y + 1, wz, rnd() < 0.5 ? "minecraft:short_grass" : "minecraft:fern");
            }
            break;
          case "cerejeira":
            if (!water) {
              ground("minecraft:grass_block");
              if (rnd() < 0.014) cherry(put, wx, y, wz, rnd);
              else if (rnd() < 0.3) put(wx, y + 1, wz, "minecraft:pink_petals", { growth: Math.floor(rnd() * 4), "minecraft:cardinal_direction": "north" });
              else if (rnd() < 0.05) put(wx, y + 1, wz, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
            }
            break;
          case "cogumelo":
            if (!water) {
              ground("minecraft:mycelium");
              if (rnd() < 0.008) giantMushroom(put, wx, y, wz, rnd);
              else if (rnd() < 0.04) put(wx, y + 1, wz, rnd() < 0.5 ? "minecraft:red_mushroom" : "minecraft:brown_mushroom");
            }
            break;
          case "flores":
            if (!water) {
              ground("minecraft:grass_block");
              if (rnd() < 0.45) put(wx, y + 1, wz, FLOWERS[Math.floor(rnd() * FLOWERS.length)]);
              else if (rnd() < 0.2) put(wx, y + 1, wz, "minecraft:short_grass");
            }
            break;
          case "floresta":
            if (!water) {
              ground("minecraft:grass_block");
              if (rnd() < 0.035) oak(put, wx, y, wz, rnd, rnd() < 0.35 ? "birch" : "oak");
              else if (rnd() < 0.2) put(wx, y + 1, wz, rnd() < 0.6 ? "minecraft:short_grass" : "minecraft:fern");
            }
            break;
          case "pantano":
            if (!water) {
              const n = Math.sin(wx * 0.21) + Math.cos(wz * 0.17) + Math.sin((wx + wz) * 0.09);
              if (n > 1.2) {
                ground("minecraft:water");
                if (rnd() < 0.2) put(wx, y + 1, wz, "minecraft:waterlily");
              } else {
                ground(rnd() < 0.3 ? "minecraft:mud" : "minecraft:grass_block");
                if (rnd() < 0.015) oak(put, wx, y, wz, rnd, "oak", true);
                else if (rnd() < 0.15) put(wx, y + 1, wz, "minecraft:short_grass");
              }
            } else if (rnd() < 0.15) put(wx, y + 1, wz, "minecraft:waterlily");
            break;
        }
        if (++col % 24 === 0) {
          particle(dim, "lila:build", { x: wx + 0.5, y: y + 1.2, z: wz + 0.5 });
          yield* breathe(6);
        }
      }
      if (x % 12 === 0) say(c, `Bioma: ${Math.round(((x + R) / (2 * R)) * 100)}%`, { chatter: true });
    }
    if (manual && queue.length) yield* /** @type {Placer} */ (placer).run(queue.splice(0));
    sound(c.entity, "random.levelup", 1, 1.2);
    say(c, `Pronto: aqui agora é ${def.name}! (O jogo não deixa mudar a cor da grama/clima por script.)`, { force: true });
    c.save();
    return true;
  } finally {
    unloadArea(dim, area);
    setAction(c.entity, "idle");
  }
}

function oak(put, x, y, z, rnd, kind = "oak", vines = false) {
  const h = 4 + Math.floor(rnd() * 3);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = h - 1; dy <= h + 1; dy++) {
    if (Math.abs(dx) + Math.abs(dz) + (dy - h) > 3) continue;
    put(x + dx, y + dy, z + dz, `minecraft:${kind}_leaves`);
  }
  for (let k = 1; k <= h; k++) put(x, y + k, z, `minecraft:${kind}_log`);
  if (vines) for (let k = 0; k < 3; k++) put(x + 2, y + h - k, z, "minecraft:vine", { vine_direction_bits: 2 });
}

function spruce(put, x, y, z, rnd, snowy = false) {
  const h = 6 + Math.floor(rnd() * 4);
  for (let k = 2; k <= h; k++) {
    const rad = Math.max(0, Math.floor((h - k) / 2.5)) + (k % 2 === 0 ? 1 : 0);
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > rad + 1) continue;
      put(x + dx, y + k, z + dz, "minecraft:spruce_leaves");
      if (snowy) put(x + dx, y + k + 1, z + dz, "minecraft:snow_layer");
    }
  }
  put(x, y + h + 1, z, "minecraft:spruce_leaves");
  for (let k = 1; k < h; k++) put(x, y + k, z, "minecraft:spruce_log");
}

function jungle(put, x, y, z, rnd) {
  const h = 12 + Math.floor(rnd() * 8);
  for (let dx = -4; dx <= 5; dx++) for (let dz = -4; dz <= 5; dz++) for (let dy = h - 2; dy <= h + 1; dy++) {
    if (Math.hypot(dx - 0.5, dz - 0.5) > 5 - (dy - h + 2)) continue;
    put(x + dx, y + dy, z + dz, "minecraft:jungle_leaves");
  }
  for (let k = 1; k <= h; k++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(x + dx, y + k, z + dz, "minecraft:jungle_log");
  for (let k = 2; k < h - 2; k += 1) if (rnd() < 0.6) put(x - 1, y + k, z, "minecraft:vine", { vine_direction_bits: 8 });
}

function cherry(put, x, y, z, rnd) {
  const h = 5 + Math.floor(rnd() * 2);
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let dy = h - 1; dy <= h + 1; dy++) {
    if (Math.hypot(dx, dz) > 3.4 - Math.abs(dy - h) * 0.8) continue;
    put(x + dx, y + dy, z + dz, "minecraft:cherry_leaves");
  }
  for (let k = 1; k <= h; k++) put(x, y + k, z, "minecraft:cherry_log");
}

function bush(put, x, y, z, leaves) {
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + dx, y + 1, z + dz, leaves);
  put(x, y + 2, z, leaves);
}

function giantMushroom(put, x, y, z, rnd) {
  const red = rnd() < 0.5;
  const h = 5 + Math.floor(rnd() * 3);
  const cap = red ? "minecraft:red_mushroom_block" : "minecraft:brown_mushroom_block";
  for (let k = 1; k <= h; k++) put(x, y + k, z, "minecraft:mushroom_stem");
  const r = red ? 2 : 3;
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
    put(x + dx, y + h + 1, z + dz, cap);
    if (red && (Math.abs(dx) === r || Math.abs(dz) === r)) for (let k = 0; k < 3; k++) put(x + dx, y + h - k, z + dz, cap);
  }
}

// ------------------------------------------------------------------ aplainar / destruir tudo em volta
const CONTAINER_IDS = ["minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel", "minecraft:ender_chest", "minecraft:furnace",
  "minecraft:lit_furnace", "minecraft:blast_furnace", "minecraft:smoker", "minecraft:hopper", "minecraft:dispenser", "minecraft:dropper",
  "minecraft:brewing_stand", "minecraft:beacon", "minecraft:enchanting_table", "minecraft:lectern", "minecraft:jukebox", "minecraft:bed",
  "minecraft:undyed_shulker_box", "minecraft:bedrock", "minecraft:barrier", "minecraft:command_block", "minecraft:structure_block"];

/**
 * Deixa tudo plano em volta de você: tira o que estiver acima do chão (só natureza, ou TUDO menos
 * baús/camas/blocos que guardam itens), tapa buracos com terra/grama e recolhe os itens do chão.
 * @param {Companion} c
 */
export function* flatten(c, radius = 24, all = false) {
  const owner = c.owner();
  const dim = c.dim();
  const ref = owner && owner.dimension.id === dim.id ? owner.location : c.pos();
  const R = Math.max(6, Math.min(64, Math.round(radius)));
  const cx = Math.floor(ref.x), cz = Math.floor(ref.z);
  // chão = primeiro bloco firme abaixo de você (mesmo se estiver voando/pulando)
  let y0 = Math.floor(ref.y) - 1;
  for (let k = 0; k < 64; k++) {
    const b = dim.getBlock({ x: cx, y: y0, z: cz });
    if (!b || (!b.isAir && !b.isLiquid && !PLANTS.includes(b.typeId))) break;
    y0--;
  }
  const speed = speedOf(c);
  say(c, all
    ? `Destruindo TUDO num raio de ${R} blocos e deixando plano (menos baús e camas)...`
    : `Aplainando o terreno num raio de ${R} blocos (só natureza; suas construções ficam)...`, { force: true });
  const area = loadArea(dim, c, { x: cx - R, z: cz - R }, { x: cx + R, z: cz + R });
  try {
    for (let t = 0; t < 120; t++) {
      if (dim.getBlock({ x: cx + R, y: y0, z: cz + R }) && dim.getBlock({ x: cx - R, y: y0, z: cz - R })) break;
      yield 5;
    }
    if (speed === "instantaneo") {
      const filter = all ? { excludeTypes: CONTAINER_IDS } : { includeTypes: NATURAL };
      for (let x = -R; x <= R; x++) {
        const w = Math.floor(Math.sqrt(R * R - x * x));
        yield* fillBox(dim, { x: cx + x, y: y0 + 1, z: cz - w }, { x: cx + x, y: Math.min(dim.heightRange.max - 1, y0 + 80), z: cz + w }, perm("minecraft:air"), filter);
        yield* fillBox(dim, { x: cx + x, y: y0 - 3, z: cz - w }, { x: cx + x, y: y0 - 1, z: cz + w }, perm("minecraft:dirt"), { includeTypes: ["minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava"] });
        yield* fillBox(dim, { x: cx + x, y: y0, z: cz - w }, { x: cx + x, y: y0, z: cz + w }, perm("minecraft:grass_block"), { includeTypes: ["minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava", ...PLANTS] });
      }
    } else {
      const placer = new Placer(c, speed, all ? { all: true } : { natural: NAT_BREAK });
      yield* placer.run(flattenStream(dim, cx, cz, y0, R));
    }
    say(c, "Agora vou recolher os itens do chão...", { chatter: true });
    const r = yield* vacuum(c, { x: cx, y: y0 + 1, z: cz }, R + 4, speed === "instantaneo" ? "rapido" : speed);
    sound(c.entity, "random.levelup", 1, 1.2);
    say(c, `Pronto, tudo plano em volta de você! ${r.got ? `Recolhi ${r.got} itens do chão (estão comigo, peça "me dá tudo").` : ""}`, { force: true });
    return true;
  } finally {
    unloadArea(dim, area);
    setAction(c.entity, "idle");
  }
}

function* flattenStream(dim, cx, cz, y0, R) {
  const cols = [];
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) if (x * x + z * z <= R * R) cols.push({ x, z });
  for (const { x, z } of serpentine(cols)) {
    const wx = cx + x, wz = cz + z;
    let top;
    try {
      top = dim.getTopmostBlock({ x: wx, z: wz }, Math.min(dim.heightRange.max - 1, y0 + 80)); // começa a busca de cima
    } catch {
      continue;
    }
    if (top && top.y > y0) for (let y = Math.min(top.y, y0 + 80); y > y0; y--) yield { x: wx, y, z: wz, id: "minecraft:air" };
    const g = dim.getBlock({ x: wx, y: y0, z: wz });
    if (g && (g.isAir || g.isLiquid || PLANTS.includes(g.typeId))) {
      for (let y = y0 - 3; y < y0; y++) {
        const u = dim.getBlock({ x: wx, y, z: wz });
        if (u && (u.isAir || u.isLiquid)) yield { x: wx, y, z: wz, id: "minecraft:dirt" };
      }
      yield { x: wx, y: y0, z: wz, id: "minecraft:grass_block" };
    }
    yield 0;
  }
}

/** Só recolher os itens do chão em volta de você. */
export function* sweepGround(c, radius = 32) {
  const owner = c.owner();
  const ref = owner && owner.dimension.id === c.dim().id ? owner.location : c.pos();
  say(c, `Recolhendo os itens do chão num raio de ${radius} blocos...`, { force: true });
  const speed = speedOf(c);
  const r = yield* vacuum(c, ref, radius, speed === "instantaneo" ? "rapido" : speed);
  say(c, r.got || r.gone ? `Limpei o chão: ${r.got} itens comigo${r.gone ? `, ${r.gone} sumiram (inventário cheio)` : ""}.` : "Não tem item no chão aqui perto.", { force: true });
}
