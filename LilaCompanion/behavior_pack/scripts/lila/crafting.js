// CraftingService: fabrica com custo real. Receitas 3×3 exigem bancada por perto (ela coloca a
// dela e depois recolhe), fundição usa uma fornalha de verdade com combustível e tempo real.
import { ItemStack, system } from "@minecraft/server";
import { fuelValue, ptName } from "../lib/items.js";
import { matchesNeed, recipesFor } from "../lib/recipes.js";
import { GoalError } from "./companion.js";
import { blockAt, findBlocks, standSpot } from "./world.js";
import { collectDrops, face, placeAt, quickBreak } from "./blocks.js";
import { goTo } from "./motor.js";
import * as inv from "./inventory.js";
import { hold, setAction, sound } from "./anim.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {import("../lib/recipes.js").Recipe} Recipe */

/** Ingredientes presentes para `times` execuções da receita? */
export function canCraft(c, r, times = 1) {
  return r.needs.every((n) => inv.count(c, needTarget(n)) >= n.n * times);
}

export function needTarget(n) {
  return n.id ? n.id : { group: n.group };
}

/** Escolhe a variante de receita (ex.: tábuas de carvalho vs. abeto conforme o tronco que ela tem). */
export function chooseRecipe(c, id) {
  const rs = recipesFor(id).filter((r) => !r.smelt);
  return rs.find((r) => canCraft(c, r)) ?? rs[0];
}

/** Tábuas: escolhe a madeira que ela tem em mãos. */
export function planksFor(c) {
  const s = inv.summary(c);
  let best = "minecraft:oak_planks", n = 0;
  for (const [id, k] of Object.entries(s)) {
    const m = /^minecraft:(?:stripped_)?([a-z_]+?)_(log|wood|stem|hyphae)$/.exec(id);
    if (m && k > n) {
      n = k;
      best = `minecraft:${m[1]}_planks`;
    }
  }
  return best;
}

/** Encontra/garante uma bancada a até 4 blocos. Retorna {pos, temp}. */
function* ensureTable(c) {
  const dim = c.dim();
  const near = findBlocks(dim, c.pos(), ["minecraft:crafting_table"], { r: 12, dy: 5, max: 1 });
  if (near.length) {
    const p = near[0];
    if (!(yield* goTo(c, { x: p.x + 0.5, y: p.y, z: p.z + 0.5 }, { reach: 2.8, yTol: 3 }))) throw new GoalError("não consegui chegar na bancada");
    return { pos: p, temp: false };
  }
  if (inv.count(c, "minecraft:crafting_table") < 1) {
    const plank = { group: "planks" };
    if (inv.count(c, plank) < 4) {
      const logs = inv.count(c, { group: "log" });
      if (logs < 1) throw new GoalError("preciso de madeira para fazer uma bancada", "need");
      yield* craftOnce(c, chooseRecipe(c, planksFor(c)), false);
    }
    yield* craftOnce(c, chooseRecipe(c, "minecraft:crafting_table"), false);
  }
  const spot = freeSpotAround(c);
  if (!spot) throw new GoalError("não achei lugar para pôr a bancada");
  if (!(yield* placeAt(c, spot, "minecraft:crafting_table", "minecraft:crafting_table"))) throw new GoalError("não consegui colocar a bancada");
  return { pos: spot, temp: !c.rec.base || Math.hypot(c.rec.base.x - spot.x, c.rec.base.z - spot.z) > 12 };
}

/** Bloco livre no chão ao lado dela (para bancada/fornalha). */
export function freeSpotAround(c) {
  const dim = c.dim();
  const p = c.pos();
  const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
  for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2]]) {
    const b = blockAt(dim, bx + dx, by, bz + dz);
    const g = blockAt(dim, bx + dx, by - 1, bz + dz);
    if (b && (b.isAir || /short_grass|fern|flower|snow_layer/.test(b.typeId)) && g && !g.isAir && !g.isLiquid) return { x: bx + dx, y: by, z: bz + dz };
  }
  const s = standSpot(dim, { x: bx + 2, y: by, z: bz }, 2);
  return s;
}

/** Executa uma receita uma vez (ingredientes já no inventário). */
function* craftOnce(c, r, needTable) {
  if (!r) throw new GoalError("não sei fazer isso");
  if (!canCraft(c, r)) throw new GoalError(`faltam ingredientes para ${ptName(r.out)}`, "need");
  for (const n of r.needs) inv.take(c, needTarget(n), n.n);
  setAction(c.entity, "craft");
  hold(c.entity, undefined);
  yield needTable ? 10 : 6;
  inv.addId(c, r.out, r.n);
  sound(c.entity, "random.pop", 0.5, 1.2);
  c.rec.stats.crafted++;
  setAction(c.entity, "idle");
}

/**
 * Fabrica `count` itens (ingredientes já devem estar no inventário — o planejador cuida disso).
 * @param {Companion} c
 */
export function* craft(c, id, count) {
  const r = id.endsWith("_planks") ? chooseRecipe(c, id) : chooseRecipe(c, id);
  if (!r) throw new GoalError(`não conheço receita de ${ptName(id)}`);
  const times = Math.ceil(Math.max(0, count - inv.count(c, id)) / r.n);
  if (times <= 0) return true;
  let table = null;
  if (r.table) table = yield* ensureTable(c);
  if (table) face(c, table.pos);
  let ok = false;
  try {
    for (let i = 0; i < times; i++) {
      const rr = chooseRecipe(c, id) ?? r;
      yield* craftOnce(c, rr, !!table);
    }
    ok = true;
  } finally {
    // deu errado no meio: recolhe a bancada temporária na hora (sem deixar lixo no mundo)
    if (!ok && table?.temp && c.alive()) {
      try {
        const g = quickBreak(c, table.pos, { strict: false });
        for (let k = 0; k < 400; k++) if (g.next().done) break;
        collectNow(c, table.pos);
      } catch (e) {
        logError("craft.pickup", e);
      }
    }
  }
  if (table?.temp) {
    // recolhe a bancada temporária (como jogadora econômica)
    yield* quickBreak(c, table.pos, { strict: false });
  } else if (table) c.mem.remember("table", table.pos, c.dim().id);
  return true;
}

function collectNow(c, p) {
  system.runTimeout(() => collectDrops(c, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 }, 2.6), 3);
}

/** Combustível disponível em "itens fundíveis". */
export function fuelUnits(c) {
  const s = inv.summary(c);
  let u = 0;
  for (const [id, n] of Object.entries(s)) u += fuelValue(id) * n;
  return u;
}

function pickFuel(c, needUnits, avoid) {
  const s = inv.summary(c);
  const opts = Object.entries(s).filter(([id]) => fuelValue(id) > 0 && id !== avoid)
    .sort((a, b) => {
      // gasta primeiro carvão, depois tábuas/gravetos; troncos por último (são valiosos)
      const rank = (id) => (/coal|charcoal/.test(id) ? 0 : /planks|stick|slab|sapling/.test(id) ? 1 : 2);
      return rank(a[0]) - rank(b[0]);
    });
  for (const [id, n] of opts) {
    const v = fuelValue(id);
    const k = Math.min(n, Math.ceil(needUnits / v), 64);
    if (k > 0) return { id, n: k };
  }
  return undefined;
}

/** Garante uma fornalha por perto: dela (memória), uma vazia próxima ou coloca a dela. */
function* ensureFurnace(c) {
  const dim = c.dim();
  const mem = c.mem.nearest("furnace", c.pos(), dim.id, 32);
  if (mem) {
    const b = blockAt(dim, mem.x, mem.y, mem.z);
    if (b && /furnace/.test(b.typeId)) {
      if (yield* goTo(c, { x: mem.x + 0.5, y: mem.y, z: mem.z + 0.5 }, { reach: 2.6, yTol: 3 })) return { pos: mem, temp: false };
    } else c.mem.forget("furnace", mem);
  }
  const near = findBlocks(dim, c.pos(), ["minecraft:furnace", "minecraft:lit_furnace"], { r: 10, dy: 4, max: 3, filter: (p) => furnaceEmpty(dim, p) });
  if (near.length) {
    const p = near[0];
    if (yield* goTo(c, { x: p.x + 0.5, y: p.y, z: p.z + 0.5 }, { reach: 2.6, yTol: 3 })) return { pos: p, temp: false, shared: true };
  }
  if (inv.count(c, "minecraft:furnace") < 1) {
    if (inv.count(c, { group: "stone_material" }) < 8) throw new GoalError("preciso de 8 pedregulhos para a fornalha", "need");
    yield* craft(c, "minecraft:furnace", 1);
  }
  const spot = freeSpotAround(c);
  if (!spot) throw new GoalError("sem lugar para a fornalha");
  if (!(yield* placeAt(c, spot, "minecraft:furnace", "minecraft:furnace", { "minecraft:cardinal_direction": "north" }))) throw new GoalError("não consegui pôr a fornalha");
  const temp = !c.rec.base || Math.hypot(c.rec.base.x - spot.x, c.rec.base.z - spot.z) > 12;
  if (!temp) c.mem.remember("furnace", spot, dim.id);
  return { pos: spot, temp };
}

function furnaceEmpty(dim, p) {
  try {
    const cont = blockAt(dim, p.x, p.y, p.z)?.getComponent("minecraft:inventory")?.container;
    if (!cont) return false;
    for (let i = 0; i < cont.size; i++) if (cont.getItem(i)) return false;
    return true;
  } catch {
    return false;
  }
}

function furnaceContainer(c, pos) {
  try {
    return blockAt(c.dim(), pos.x, pos.y, pos.z)?.getComponent("minecraft:inventory")?.container;
  } catch {
    return undefined;
  }
}

/**
 * Funde de verdade: coloca o material e o combustível na fornalha e espera o tempo do jogo
 * (10 s por item), recolhendo o resultado. Ingredientes e combustível já devem estar com ela.
 * @param {Companion} c
 * @param {{id?:string, group?:string, n:number}} input
 */
export function* smelt(c, outId, input, count) {
  const want = inv.count(c, outId) + count;
  const furnace = yield* ensureFurnace(c);
  const dim = c.dim();
  let guard = 0;
  while (inv.count(c, outId) < want && c.alive() && guard++ < 40) {
    const cont = furnaceContainer(c, furnace.pos);
    if (!cont) throw new GoalError("a fornalha sumiu");
    const missing = want - inv.count(c, outId);
    // entrada
    const curIn = cont.getItem(0);
    if (!curIn) {
      const k = Math.min(missing, 64);
      const stacks = inv.takeStacks(c, input.id ?? { group: input.group }, k);
      if (!stacks.length && !cont.getItem(2)) throw new GoalError(`acabou ${ptName(input.id ?? input.group)} para fundir`, "need");
      if (stacks.length) {
        const first = stacks.shift();
        cont.setItem(0, first);
        for (const s of stacks) inv.add(c, s);
      }
    }
    // combustível
    if (!cont.getItem(1)) {
      const inSlot = cont.getItem(0)?.amount ?? 0;
      const f = pickFuel(c, Math.max(1, inSlot), input.id);
      if (f) {
        inv.take(c, f.id, f.n);
        cont.setItem(1, new ItemStack(f.id, f.n));
      } else if (!litNow(dim, furnace.pos)) throw new GoalError("acabou o combustível", "need");
    }
    face(c, furnace.pos);
    setAction(c.entity, "think");
    sound(c.entity, "block.furnace.lit", 0.6, 1);
    // espera ~1 item (10 s) e recolhe
    for (let t = 0; t < 10; t++) {
      yield 20;
      if (!c.alive()) return false;
      const out = cont.getItem(2);
      if (out && out.amount >= Math.min(missing, 8)) break;
    }
    const out = cont.getItem(2);
    if (out) {
      cont.setItem(2, undefined);
      inv.add(c, out);
      sound(c.entity, "random.pop", 0.5, 1.1);
    }
  }
  setAction(c.entity, "idle");
  // devolve sobras e recolhe a fornalha temporária
  const cont = furnaceContainer(c, furnace.pos);
  if (cont && !furnace.shared) {
    for (const slot of [0, 1, 2]) {
      const it = cont.getItem(slot);
      if (it) {
        cont.setItem(slot, undefined);
        inv.add(c, it);
      }
    }
    if (furnace.temp) {
      try {
        yield* quickBreak(c, furnace.pos, { strict: false });
      } catch (e) {
        logError("smelt.pickup", e);
      }
    }
  }
  return inv.count(c, outId) >= want;
}

function litNow(dim, p) {
  return blockAt(dim, p.x, p.y, p.z)?.typeId === "minecraft:lit_furnace";
}

export { matchesNeed, system };
