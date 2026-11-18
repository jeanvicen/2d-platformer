// Tarefas da Lyra como generators (um passo por tick): coletar madeira, pedra, areia, comida,
// minérios, construir plantas inteiras, explorar e entregar itens — como um jogador faria.
import { BlockPermutation, EntityComponentTypes, EntityDamageCause } from "@minecraft/server";
import { BLUEPRINTS, buildOrder, footprint } from "../lib/blueprints.js";
import { LOG_IDS, NATURAL_CLEARABLE, ORE_DROPS, STONE_LIKE, dominantWood, requirements, resolveBlock, substitute } from "../lib/recipes.js";
import { makeItem } from "../core/items.js";
import { particle, sound } from "../core/fx.js";
import { logError } from "../core/log.js";
import { directionName, rotateLocal } from "../core/util.js";
import { worldConfig } from "../core/world_config.js";
import { isHostileTarget } from "../abilities/combat.js";
import { collectDrops, findTree, groundAt, scan, solidFn, standNear, treeLogs } from "./lyra_world.js";
import { dist3, glideTo, setAction, shadowStep, wait, walkTo } from "./lyra_motor.js";

// ------------------------------------------------------------------ inventário da Lyra
export function inv(L) {
  try {
    return L.entity()?.getComponent(EntityComponentTypes.Inventory)?.container;
  } catch {
    return undefined;
  }
}

export function count(L, pred) {
  const c = inv(L);
  if (!c) return 0;
  let n = 0;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it && pred(it.typeId)) n += it.amount;
  }
  return n;
}

export function take(L, pred, amount) {
  const c = inv(L);
  if (!c) return 0;
  let left = amount;
  for (let i = 0; i < c.size && left > 0; i++) {
    const it = c.getItem(i);
    if (!it || !pred(it.typeId)) continue;
    const n = Math.min(left, it.amount);
    if (it.amount === n) c.setItem(i, undefined);
    else {
      it.amount -= n;
      c.setItem(i, it);
    }
    left -= n;
  }
  return amount - left;
}

export function add(L, typeId, amount) {
  const c = inv(L);
  if (!c) return false;
  let left = amount;
  while (left > 0) {
    const n = Math.min(64, left);
    const rest = c.addItem(makeItem(typeId, { amount: n }));
    if (rest) {
      L.entity()?.dimension.spawnItem(rest, L.entity().location);
      return false;
    }
    left -= n;
  }
  return true;
}

const isLogItem = (t) => LOG_IDS.includes(t) || t.endsWith("_stem");
const isStoneItem = (t) => t === "minecraft:cobblestone" || t === "minecraft:cobbled_deepslate";

/** Mostra a ferramenta certa na mão (attachable 3D) durante cada trabalho. */
function hold(L, item) {
  try {
    L.entity()?.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${item ?? "air"}`);
  } catch {
    /* */
  }
}

/** Quebra um bloco com efeitos e drops naturais, depois recolhe os itens. */
function breakBlock(L, pos) {
  const e = L.entity();
  if (!e) return;
  try {
    e.dimension.runCommand(`setblock ${pos.x} ${pos.y} ${pos.z} air destroy`);
  } catch (err) {
    try {
      e.dimension.getBlock(pos)?.setType("minecraft:air");
    } catch {
      /* */
    }
  }
}

// ------------------------------------------------------------------ COLETAR MADEIRA
export function* gatherWood(L, amount) {
  const start = count(L, isLogItem);
  const goal = start + amount;
  const avoid = new Set();
  let misses = 0;
  hold(L, "eclipse:shadow_axe_tool");
  while (count(L, isLogItem) < goal && !L.cancelled) {
    const e = L.entity();
    if (!e) return false;
    let base;
    for (const r of [16, 32, 48]) {
      base = findTree(e.dimension, e.location, r, avoid);
      if (base) break;
      yield;
    }
    if (!base) {
      if (++misses > 3) {
        L.say("Não encontrei mais árvores por aqui. Vou trazer o que consegui.");
        break;
      }
      L.say("Sem árvores por perto… vou procurar mais longe.");
      const ang = Math.random() * Math.PI * 2;
      const to = { x: Math.floor(e.location.x + Math.cos(ang) * 40), y: 0, z: Math.floor(e.location.z + Math.sin(ang) * 40) };
      to.y = groundAt(e.dimension, to.x, to.z, e.location.y);
      yield* walkTo(L, to, 2, true);
      continue;
    }
    avoid.add(`${base.x},${base.y},${base.z}`);
    const stand = standNear(e.dimension, base) ?? base;
    yield* walkTo(L, stand, 1.5);
    const logs = treeLogs(e.dimension, base);
    if (!logs.length) continue;
    const ground = L.entity()?.location.y ?? base.y;
    let sapling = undefined;
    for (const lg of logs) {
      if (L.cancelled) return false;
      const ent = L.entity();
      if (!ent) return false;
      L.lookAt = { x: lg.x + 0.5, y: lg.y + 0.5, z: lg.z + 0.5 };
      if (lg.y > ent.location.y + 3.5) {
        yield* glideTo(L, { x: ent.location.x, y: lg.y - 1.5, z: ent.location.z }, 0.25, "float");
      }
      setAction(ent, "chop");
      for (let k = 0; k < 2; k++) {
        sound(ent.dimension, "dig.wood", lg, 0.8, 0.9 + Math.random() * 0.2);
        yield* wait(L, 5);
      }
      breakBlock(L, lg);
      yield;
      collectDrops(ent.dimension, lg, ent, 5);
      if (count(L, isLogItem) >= goal) break;
    }
    // recolhe mudas/maçãs que caíram e replanta uma muda na base
    const ent = L.entity();
    if (ent) {
      if (ent.location.y > ground + 1) yield* glideTo(L, { x: ent.location.x, y: ground, z: ent.location.z }, 0.3, "float");
      collectDrops(ent.dimension, base, ent, 7);
      const sap = inv(L) && findSapling(L);
      if (sap) {
        try {
          const b = ent.dimension.getBlock(base);
          const below = ent.dimension.getBlock({ x: base.x, y: base.y - 1, z: base.z });
          if (b?.isAir && below && ["minecraft:grass_block", "minecraft:dirt", "minecraft:podzol", "minecraft:coarse_dirt"].includes(below.typeId)) {
            b.setType(sap);
            take(L, (t) => t === sap, 1);
            sapling = sap;
          }
        } catch {
          /* */
        }
      }
    }
    L.lookAt = undefined;
    void sapling;
    yield;
  }
  hold(L, undefined);
  const got = count(L, isLogItem) - start;
  L.say(got > 0 ? `Pronto! Juntei §f${got}§d troncos.${got >= amount ? "" : " (as árvores acabaram)"}` : "Não consegui madeira desta vez.");
  return got > 0;
}

function findSapling(L) {
  const c = inv(L);
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it?.typeId.endsWith("_sapling") || it?.typeId === "minecraft:mangrove_propagule") return it.typeId === "minecraft:mangrove_propagule" ? undefined : it.typeId;
  }
  return undefined;
}

// ------------------------------------------------------------------ PEDRA
export function* gatherStone(L, amount) {
  const start = count(L, isStoneItem);
  const goal = start + amount;
  hold(L, "eclipse:shadow_pickaxe");
  // 1) pedra exposta por perto (minera de verdade, com drops)
  let e = L.entity();
  if (!e) return false;
  const exposed = scan(e.dimension, e.location, 20, 14, STONE_LIKE).filter((p) => {
    const up = e.dimension.getBlock({ x: p.x, y: p.y + 1, z: p.z });
    return up?.isAir;
  }).sort((a, b) => dist3(a, e.location) - dist3(b, e.location)).slice(0, 40);
  for (const p of exposed) {
    if (count(L, isStoneItem) >= goal || L.cancelled) break;
    const stand = standNear(e.dimension, p);
    if (!stand) continue;
    if (dist3(L.entity().location, p) > 4) yield* walkTo(L, stand, 1.5);
    const ent = L.entity();
    if (!ent) return false;
    L.lookAt = { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 };
    setAction(ent, "mine");
    sound(ent.dimension, "dig.stone", p, 0.8, 1);
    yield* wait(L, 6);
    breakBlock(L, p);
    yield;
    collectDrops(ent.dimension, p, ent, 4);
  }
  // 2) "extração sombria": retira pedra do subsolo profundo sem abrir buracos na superfície
  e = L.entity();
  if (e && count(L, isStoneItem) < goal && !L.cancelled) {
    L.say("Vou puxar pedra do subsolo pelas sombras (sem abrir buracos na superfície).");
    setAction(e, "mine");
    const c = { x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z) };
    for (let depth = 4; depth <= 30 && count(L, isStoneItem) < goal && !L.cancelled; depth++) {
      for (let dx = -3; dx <= 3 && count(L, isStoneItem) < goal; dx++) {
        for (let dz = -3; dz <= 3 && count(L, isStoneItem) < goal; dz++) {
          const p = { x: c.x + dx, y: c.y - depth, z: c.z + dz };
          const b = e.dimension.getBlock(p);
          if (!b || !STONE_LIKE.includes(b.typeId)) continue;
          if (touchesLiquid(e.dimension, p)) continue;
          const drop = b.typeId === "minecraft:deepslate" || b.typeId === "minecraft:cobbled_deepslate" ? "minecraft:cobbled_deepslate"
            : b.typeId === "minecraft:stone" ? "minecraft:cobblestone" : "minecraft:cobblestone";
          b.setType("minecraft:air");
          add(L, drop, 1);
        }
        if (dx % 2 === 0) {
          particle(e.dimension, "eclipse:smoke_puff", { x: e.location.x, y: e.location.y + 0.2, z: e.location.z }, { color: { red: 0.2, green: 0.1, blue: 0.3 }, count: 3, radius: 0.6 });
          sound(e.dimension, "dig.stone", e.location, 0.4, 0.7);
          yield* wait(L, 4);
        }
      }
    }
  }
  L.lookAt = undefined;
  hold(L, undefined);
  const got = count(L, isStoneItem) - start;
  L.say(`Consegui §f${got}§d blocos de pedra.`);
  return got > 0;
}

function touchesLiquid(dim, p) {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const b = dim.getBlock({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
    if (b?.isLiquid) return true;
  }
  return false;
}

// ------------------------------------------------------------------ AREIA
export function* gatherSand(L, amount) {
  const isSand = (t) => t === "minecraft:sand" || t === "minecraft:red_sand";
  const start = count(L, isSand);
  hold(L, "eclipse:shadow_shovel");
  const e = L.entity();
  if (!e) return false;
  const spots = scan(e.dimension, e.location, 40, 20, ["minecraft:sand", "minecraft:red_sand"])
    .filter((p) => e.dimension.getBlock({ x: p.x, y: p.y + 1, z: p.z })?.isAir)
    .sort((a, b) => dist3(a, e.location) - dist3(b, e.location));
  for (const p of spots) {
    if (count(L, isSand) >= start + amount || L.cancelled) break;
    if (dist3(L.entity().location, p) > 4) {
      const stand = standNear(e.dimension, p);
      if (stand) yield* walkTo(L, stand, 1.5);
    }
    const ent = L.entity();
    if (!ent) return false;
    L.lookAt = { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 };
    setAction(ent, "dig");
    yield* wait(L, 4);
    breakBlock(L, p);
    yield;
    collectDrops(ent.dimension, p, ent, 4);
  }
  L.lookAt = undefined;
  hold(L, undefined);
  const got = count(L, isSand) - start;
  if (got <= 0) L.say("Não achei areia por perto.");
  return got > 0;
}

// ------------------------------------------------------------------ COMIDA
const FOOD_MOBS = ["minecraft:cow", "minecraft:pig", "minecraft:chicken", "minecraft:sheep", "minecraft:rabbit"];
const COOK = { "minecraft:beef": "minecraft:cooked_beef", "minecraft:porkchop": "minecraft:cooked_porkchop", "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:mutton": "minecraft:cooked_mutton", "minecraft:rabbit": "minecraft:cooked_rabbit", "minecraft:cod": "minecraft:cooked_cod", "minecraft:salmon": "minecraft:cooked_salmon" };
const FOOD_ITEMS = new Set(["minecraft:cooked_beef", "minecraft:cooked_porkchop", "minecraft:cooked_chicken", "minecraft:cooked_mutton", "minecraft:cooked_rabbit",
  "minecraft:bread", "minecraft:apple", "minecraft:sweet_berries", "minecraft:cooked_cod", "minecraft:cooked_salmon", "minecraft:baked_potato", "minecraft:carrot"]);

export const isFood = (t) => FOOD_ITEMS.has(t);

export function* gatherFood(L, amount) {
  const start = count(L, isFood);
  let tries = 0;
  while (count(L, isFood) < start + amount && !L.cancelled && tries < 14) {
    tries++;
    const e = L.entity();
    if (!e) return false;
    // 1) colheita: trigo maduro e frutas silvestres (replanta)
    const crops = scan(e.dimension, e.location, 16, 8, ["minecraft:wheat", "minecraft:sweet_berry_bush"]).filter((p) => {
      const b = e.dimension.getBlock(p);
      try {
        if (b.typeId === "minecraft:wheat") return Number(b.permutation.getState("growth")) >= 7;
        return Number(b.permutation.getState("growth")) >= 2;
      } catch {
        return false;
      }
    });
    if (crops.length) {
      for (const p of crops.slice(0, 12)) {
        const stand = standNear(e.dimension, p);
        if (stand) yield* walkTo(L, stand, 1.6);
        const ent = L.entity();
        if (!ent) return false;
        setAction(ent, "build");
        const b = ent.dimension.getBlock(p);
        if (b?.typeId === "minecraft:wheat") {
          b.setPermutation(BlockPermutation.resolve("minecraft:wheat", { growth: 0 }));
          add(L, "minecraft:wheat", 1);
        } else if (b?.typeId === "minecraft:sweet_berry_bush") {
          b.setPermutation(BlockPermutation.resolve("minecraft:sweet_berry_bush", { growth: 1 }));
          add(L, "minecraft:sweet_berries", 2);
        }
        sound(ent.dimension, "dig.grass", p, 0.6, 1.1);
        yield* wait(L, 5);
      }
      bakeBread(L);
      continue;
    }
    // 2) caça sustentável: nunca o último par de uma espécie, nunca animais com nome/domados
    const animals = e.dimension.getEntities({ location: e.location, maxDistance: 32 }).filter((a) => FOOD_MOBS.includes(a.typeId));
    const byType = {};
    for (const a of animals) byType[a.typeId] = (byType[a.typeId] ?? 0) + 1;
    const prey = animals.filter((a) => {
      if (a.nameTag) return false;
      if (byType[a.typeId] <= 2) return false;
      try {
        if (a.getComponent(EntityComponentTypes.Tameable)?.isTamed) return false;
        if (a.getComponent("minecraft:is_baby")) return false;
      } catch {
        /* */
      }
      return true;
    }).sort((a, b) => dist3(a.location, e.location) - dist3(b.location, e.location))[0];
    if (!prey) {
      if (tries > 3) break;
      const ang = Math.random() * Math.PI * 2;
      const to = { x: Math.floor(e.location.x + Math.cos(ang) * 30), y: 0, z: Math.floor(e.location.z + Math.sin(ang) * 30) };
      to.y = groundAt(e.dimension, to.x, to.z, e.location.y);
      L.say("Procurando comida mais adiante…");
      yield* walkTo(L, to, 2, true);
      continue;
    }
    hold(L, "eclipse:shadow_sword");
    for (let hits = 0; hits < 12 && prey.isValid && !L.cancelled; hits++) {
      const tgt = { x: Math.floor(prey.location.x), y: Math.floor(prey.location.y), z: Math.floor(prey.location.z) };
      const ent = L.entity();
      if (!ent) return false;
      if (dist3(ent.location, prey.location) > 2.5) yield* walkTo(L, tgt, 1.6, true);
      if (!prey.isValid) break;
      L.lookAt = { x: prey.location.x, y: prey.location.y + 0.6, z: prey.location.z };
      setAction(ent, "attack");
      try {
        prey.applyDamage(6, { cause: EntityDamageCause.entityAttack, damagingEntity: ent });
      } catch {
        /* */
      }
      yield* wait(L, 9);
    }
    L.lookAt = undefined;
    const ent = L.entity();
    if (ent) {
      yield* wait(L, 10);
      collectDrops(ent.dimension, ent.location, ent, 5);
      cook(L);
    }
    hold(L, undefined);
  }
  const got = count(L, isFood) - start;
  L.say(got > 0 ? `Trouxe §f${got}§d porções de comida, já cozidas no fogo sombrio.` : "Não encontrei comida por aqui.");
  return got > 0;
}

function cook(L) {
  const e = L.entity();
  if (!e) return;
  for (const [raw, done] of Object.entries(COOK)) {
    const n = take(L, (t) => t === raw, 999);
    if (n) {
      add(L, done, n);
      particle(e.dimension, "eclipse:spark_burst", { x: e.location.x, y: e.location.y + 1.2, z: e.location.z }, { color: { red: 0.7, green: 0.35, blue: 1 }, count: 10, speed: 1 });
    }
  }
}

function bakeBread(L) {
  const wheat = count(L, (t) => t === "minecraft:wheat");
  const loaves = Math.floor(wheat / 3);
  if (loaves > 0) {
    take(L, (t) => t === "minecraft:wheat", loaves * 3);
    add(L, "minecraft:bread", loaves);
  }
}

// ------------------------------------------------------------------ MINÉRIOS
export function* gatherOre(L, ore, amount) {
  const def = ORE_DROPS[ore];
  if (!def) return false;
  const start = count(L, (t) => t === def.item);
  hold(L, "eclipse:shadow_pickaxe");
  const e = L.entity();
  if (!e) return false;
  const found = scan(e.dimension, e.location, 24, 48, def.blocks).sort((a, b) => dist3(a, e.location) - dist3(b, e.location));
  if (!found.length) {
    L.say(`Não senti nenhum minério de ${ore} num raio de 24 blocos.`);
    hold(L, undefined);
    return false;
  }
  for (const p of found) {
    if (count(L, (t) => t === def.item) >= start + amount || L.cancelled) break;
    const ent = L.entity();
    if (!ent) return false;
    const surfaceY = groundAt(ent.dimension, p.x, p.z, ent.location.y);
    if (dist3(ent.location, { x: p.x, y: surfaceY, z: p.z }) > 3) yield* walkTo(L, { x: p.x, y: surfaceY, z: p.z }, 2);
    const cur = L.entity();
    if (!cur) return false;
    setAction(cur, "mine");
    sound(cur.dimension, "dig.stone", cur.location, 0.6, 0.8);
    yield* wait(L, 8);
    const b = cur.dimension.getBlock(p);
    if (b && def.blocks.includes(b.typeId)) {
      b.setType(p.y < 0 ? "minecraft:deepslate" : "minecraft:stone");
      add(L, def.item, ore === "redstone" ? 4 : ore === "lapis" ? 5 : 1);
      particle(cur.dimension, "eclipse:spark_burst", { x: cur.location.x, y: cur.location.y + 1, z: cur.location.z }, { color: { red: 0.6, green: 0.6, blue: 1 }, count: 8 });
    }
  }
  hold(L, undefined);
  const got = count(L, (t) => t === def.item) - start;
  L.say(`Extraí §f${got}§d de ${ore} pelas sombras, sem cavar túneis.`);
  return got > 0;
}

// ------------------------------------------------------------------ CONSTRUIR
/**
 * @param {{blueprint:string, origin:{x:number,y:number,z:number}, card:number, dim?:string}} task
 */
export function* build(L, task) {
  const bp = BLUEPRINTS[task.blueprint];
  if (!bp) return false;
  const e0 = L.entity();
  if (!e0) return false;
  const dim = e0.dimension;
  let plan = bp.build();
  const fp = footprint(plan);
  // nível do terreno: mediana do chão na área da fachada
  const gy = groundAt(dim, task.origin.x, task.origin.z, task.origin.y);
  const toWorld = (b) => {
    const r = rotateLocal({ x: b.x, y: b.y, z: b.z }, task.card);
    return { x: task.origin.x + r.x, y: gy + r.y, z: task.origin.z + r.z };
  };
  // 1) vistoria: nunca demolir construções de jogadores
  const natural = new Set(NATURAL_CLEARABLE);
  let foreign = 0;
  for (const b of plan) {
    if (b.y < 0) continue;
    const w = toWorld(b);
    const blk = dim.getBlock(w);
    if (blk && !blk.isAir && !natural.has(blk.typeId) && !blk.typeId.endsWith("_leaves") && !blk.typeId.startsWith("eclipse:")) {
      // troncos naturais (árvores) podem ser removidos
      if (!(blk.typeId.endsWith("_log") && !blk.typeId.includes("stripped"))) foreign++;
    }
    if (foreign > 3) break;
  }
  if (foreign > 3) {
    L.say("Tem construções neste terreno. Não vou destruir nada — escolha outro lugar mais aberto.");
    return false;
  }
  // 2) materiais
  const cfg = worldConfig();
  let need = requirements(plan);
  if (cfg.lyraMaterials === "real") {
    const missing = () => ({
      log: Math.max(0, need.log - count(L, isLogItem)),
      cobblestone: Math.max(0, need.cobblestone - count(L, isStoneItem)),
      sand: Math.max(0, need.sand - count(L, (t) => t === "minecraft:sand" || t === "minecraft:red_sand")),
    });
    let m = missing();
    if (m.log || m.cobblestone || m.sand) {
      L.say(`Para a ${bp.name} preciso de §f${need.log}§d troncos, §f${need.cobblestone}§d pedras e §f${need.sand}§d areias. Vou buscar o que falta!`);
    }
    if (m.log) yield* gatherWood(L, m.log);
    if (L.cancelled) return false;
    m = missing();
    if (m.cobblestone) yield* gatherStone(L, m.cobblestone);
    if (L.cancelled) return false;
    m = missing();
    if (m.sand) yield* gatherSand(L, m.sand);
    if (L.cancelled) return false;
    m = missing();
    if (m.sand) {
      plan = substitute(plan, { sand: true });
      need = requirements(plan);
      L.say("Sem areia suficiente: as janelas vão ganhar grades de madeira.");
    }
    m = missing();
    if (m.cobblestone) {
      plan = substitute(plan, { cobblestone: true });
      need = requirements(plan);
    }
    m = missing();
    if (m.log > 0) {
      L.say(`Ainda faltam §f${m.log}§d troncos. Vou construir o que der e você pode me pedir para continuar depois.`);
    }
  }
  const wood = dominantWood(Object.fromEntries(LOG_IDS.map((id) => [id, count(L, (t) => t === id)])));
  if (cfg.lyraMaterials === "real") {
    take(L, isLogItem, need.log);
    take(L, isStoneItem, need.cobblestone);
    take(L, (t) => t === "minecraft:sand" || t === "minecraft:red_sand", need.sand);
    L.say(`Transformei os materiais em tábuas, lajes, portas e tochas no fogo sombrio. Mãos à obra! ✨`);
  } else {
    L.say("Usando materiais da sombra (modo instantâneo nas configurações). Mãos à obra! ✨");
  }
  // 3) caminhar até a obra
  const site = toWorld({ x: 0, y: 0, z: Math.floor((fp.z0 + fp.z1) / 2) });
  yield* walkTo(L, { x: site.x, y: gy, z: site.z }, 6, true);
  // 4) limpar terreno natural dentro do volume e firmar fundação
  for (let x = fp.x0; x <= fp.x1; x++)
    for (let z = fp.z0; z <= fp.z1; z++)
      for (let y = Math.max(0, fp.y0); y <= fp.y1 + 1; y++) {
        const w = toWorld({ x, y, z });
        const blk = dim.getBlock(w);
        if (blk && !blk.isAir && (natural.has(blk.typeId) || blk.typeId.endsWith("_leaves") || (blk.typeId.endsWith("_log") && !blk.typeId.includes("stripped")))) {
          blk.setType("minecraft:air");
        }
      }
  yield;
  const lowest = fp.y0;
  for (const b of plan) {
    if (b.y !== lowest) continue;
    const w = toWorld(b);
    for (let d = 1; d <= 8; d++) {
      const blk = dim.getBlock({ x: w.x, y: w.y - d, z: w.z });
      if (!blk || (!blk.isAir && !blk.isLiquid)) break;
      blk.setType("minecraft:dirt");
    }
  }
  // 5) construir, bloco a bloco
  const speed = { lento: 7, normal: 3, rapido: 1 }[cfg.lyraBuildSpeed] ?? 3;
  const ordered = buildOrder(plan);
  let placed = 0;
  const seeds = () => count(L, (t) => t === "minecraft:wheat_seeds");
  for (const b of ordered) {
    if (L.cancelled) return false;
    const w = toWorld(b);
    const ent = L.entity();
    if (!ent) return false;
    // posiciona-se perto do bloco (flutua para alcançar partes altas)
    const me = ent.location;
    if (dist3(me, w) > 4.2) {
      const out = { x: w.x + 0.5 + Math.sign(me.x - w.x) * 1.5, y: Math.max(gy, w.y - 1.5), z: w.z + 0.5 + Math.sign(me.z - w.z) * 1.5 };
      L.lookAt = { x: w.x + 0.5, y: w.y + 0.5, z: w.z + 0.5 };
      yield* glideTo(L, out, 0.45, w.y > gy + 2 ? "float" : "walk");
    }
    const cur = L.entity();
    if (!cur) return false;
    L.lookAt = { x: w.x + 0.5, y: w.y + 0.5, z: w.z + 0.5 };
    setAction(cur, "build");
    try {
      placeLogical(dim, w, b.m, wood, task.card, seeds() > 0);
      if (b.m === "crop") take(L, (t) => t === "minecraft:wheat_seeds", 1);
      placed++;
      if (placed % 3 === 0) sound(dim, b.m === "cobble" || b.m === "stone_bricks" ? "use.stone" : "use.wood", w, 0.7, 0.9 + Math.random() * 0.2);
      if (placed % 12 === 0) particle(dim, "eclipse:spark_burst", { x: w.x + 0.5, y: w.y + 0.5, z: w.z + 0.5 }, { color: { red: 0.7, green: 0.45, blue: 1 }, count: 6, speed: 1 });
    } catch (err) {
      logError("lyra.place", err);
    }
    if (placed % 150 === 0) L.say(`Progresso da ${bp.name}: §f${Math.round((placed / ordered.length) * 100)}%`);
    yield* wait(L, speed);
  }
  L.lookAt = undefined;
  const fin = L.entity();
  if (fin) {
    yield* glideTo(L, { x: site.x + 0.5, y: gy, z: toWorld({ x: 0, y: 0, z: fp.z0 - 2 }).z + 0.5 }, 0.4, "walk");
    setAction(fin, "idle");
  }
  L.say(`${bp.name} concluída! §f${placed}§d blocos colocados. Ficou linda, né? ✨`);
  L.onBuilt?.(task.blueprint);
  return true;
}

function placeLogical(dim, w, m, wood, card, hasSeeds) {
  const blk = dim.getBlock(w);
  if (!blk) return;
  const id = resolveBlock(m, wood);
  const dirs = ["south", "west", "north", "east"];
  if (m === "door_lower" || m === "door_upper") {
    const upper = m === "door_upper";
    const tries = [
      { "minecraft:cardinal_direction": dirs[(card + 2) % 4], upper_block_bit: upper },
      { direction: (card + 1) % 4, upper_block_bit: upper },
      { upper_block_bit: upper },
    ];
    for (const st of tries) {
      try {
        blk.setPermutation(BlockPermutation.resolve(id, st));
        return;
      } catch {
        /* tenta o próximo formato de estado */
      }
    }
    blk.setType(id);
    return;
  }
  if (m === "lantern") {
    const above = dim.getBlock({ x: w.x, y: w.y + 1, z: w.z });
    try {
      blk.setPermutation(BlockPermutation.resolve(id, { hanging: !!above && !above.isAir }));
    } catch {
      blk.setType(id);
    }
    return;
  }
  if (m === "lantern_post") {
    blk.setType(id);
    return;
  }
  if (m === "crop") {
    if (hasSeeds) blk.setType("minecraft:wheat");
    return;
  }
  if (m === "farmland") {
    blk.setType("minecraft:farmland");
    return;
  }
  blk.setType(id);
}

// ------------------------------------------------------------------ EXPLORAR
export function* explore(L, radius) {
  const e = L.entity();
  if (!e) return false;
  const origin = { ...e.location };
  const dim = e.dimension;
  const ang0 = Math.random() * Math.PI * 2;
  const report = { biomes: new Map(), villagers: 0, ores: new Map(), structures: [], blocked: false, dangers: 0 };
  L.say(`Vou explorar até ${radius} blocos daqui. Já volto com notícias!`);
  for (let r = 16; r <= radius && !L.cancelled; r += 16) {
    const a = ang0 + Math.sin(r / 40) * 0.6;
    const x = Math.floor(origin.x + Math.cos(a) * r), z = Math.floor(origin.z + Math.sin(a) * r);
    if (!dim.isChunkLoaded({ x, y: origin.y, z })) {
      report.blocked = true;
      break;
    }
    const y = groundAt(dim, x, z, L.entity()?.location.y ?? origin.y);
    yield* walkTo(L, { x, y, z }, 3, true);
    const cur = L.entity();
    if (!cur) return false;
    try {
      const biome = dim.getBiome(cur.location)?.id?.replace("minecraft:", "").replace(/_/g, " ");
      if (biome) report.biomes.set(biome, { x, z });
      report.villagers += dim.getEntities({ location: cur.location, maxDistance: 32, type: "minecraft:villager_v2" }).length;
      report.dangers += dim.getEntities({ location: cur.location, maxDistance: 20, families: ["monster"] }).length;
      for (const o of ["diamond", "iron", "gold", "coal"]) {
        const f = scan(dim, cur.location, 8, 12, ORE_DROPS[o].blocks);
        if (f.length) report.ores.set(o, f[0]);
      }
      const chests = scan(dim, cur.location, 10, 10, ["minecraft:chest", "minecraft:bell", "minecraft:spawner"]);
      if (chests.length) report.structures.push({ x, z });
    } catch {
      /* */
    }
    yield* wait(L, 6);
  }
  yield* walkTo(L, { x: Math.floor(origin.x), y: Math.floor(origin.y), z: Math.floor(origin.z) }, 3, true);
  const lines = ["Voltei! Olha o que eu vi:"];
  for (const [b, at] of [...report.biomes].slice(0, 5)) lines.push(`§7• bioma §f${b}§7 ao ${directionName(origin, at)}`);
  if (report.villagers) lines.push(`§a• vila com uns ${Math.max(1, Math.round(report.villagers / 2))} aldeões no caminho!`);
  for (const [o, at] of report.ores) lines.push(`§b• ${o === "diamond" ? "§bdiamante!" : o} perto de x=${at.x}, z=${at.z}`);
  if (report.structures.length) lines.push(`§6• ruínas/baús encontrados perto de x=${report.structures[0].x}, z=${report.structures[0].z}`);
  if (report.dangers) lines.push(`§c• cuidado: vi ${report.dangers} monstros pelo caminho.`);
  if (report.blocked) lines.push("§8• não consegui ir além: o mundo ainda não carregou aquela região.");
  L.say(lines.join("\n"));
  return true;
}

// ------------------------------------------------------------------ PROTEÇÃO (ataque sombrio à distância)
export function shadowBolt(L, owner) {
  const e = L.entity();
  if (!e || !owner) return false;
  const foe = e.dimension.getEntities({ location: e.location, maxDistance: 12, families: ["monster"] }).find((m) => isHostileTarget(owner, m));
  if (!foe) return false;
  try {
    setAction(e, "cast");
    const from = { x: e.location.x, y: e.location.y + 1.4, z: e.location.z };
    const dx = foe.location.x - from.x, dy = foe.location.y + 0.8 - from.y, dz = foe.location.z - from.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const bolt = e.dimension.spawnEntity("eclipse:spell_bolt", { x: from.x + dx / d, y: from.y + dy / d, z: from.z + dz / d });
    bolt.setDynamicProperty("eclipse:owner", owner.id);
    bolt.setDynamicProperty("eclipse:element", "shadow");
    const proj = bolt.getComponent(EntityComponentTypes.Projectile);
    proj.owner = e;
    proj.shoot({ x: (dx / d) * 2, y: (dy / d) * 2, z: (dz / d) * 2 });
    return true;
  } catch (err) {
    logError("lyra.bolt", err);
    return false;
  }
}

export { shadowStep, walkTo, glideTo, wait, setAction, solidFn };
