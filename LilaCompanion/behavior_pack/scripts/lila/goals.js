// GoalExecutor: cada objetivo é um generator retomável (persistido como descrição + argumentos).
// Ao renascer ou recarregar o mundo, ela reabre o objetivo e continua — os passos já feitos
// ficam no inventário/mundo, então nada se repete à toa.
import { ItemStack, system, world } from "@minecraft/server";
import { BLUEPRINTS } from "../lib/blueprints.js";
import { FOOD, isFood, ptName, toolInfo, CROPS } from "../lib/items.js";
import { describe, targetName } from "../lib/intent.js";
import { GoalError } from "./companion.js";
import { blockAt, findBlocks, safeState, standSpot } from "./world.js";
import { IGNORE_ITEMS, face, harvestCrop, placeAt } from "./blocks.js";
import { goTo, idleNear, stop } from "./motor.js";
import { obtain, obtainFood } from "./planner.js";
import { exploreStep, placeTorchHere, reach, scanSurroundings, sweepItems } from "./resource.js";
import { buildBlueprint } from "./build.js";
import { defend, fight, findThreat, huntFor } from "./combat.js";
import { craft, freeSpotAround } from "./crafting.js";
import * as inv from "./inventory.js";
import { hold, setAction, sound } from "./anim.js";
import { LINES, pick, say } from "./talk.js";
import { keepLoaded } from "./areas.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {import("./companion.js").GoalDesc} GoalDesc */

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Entrega itens ao dono: anda até ele e coloca direto no inventário (sobra cai no pé dele). */
export function* deliver(c, stacks, label) {
  if (!stacks.length) return;
  const owner = c.owner();
  if (!owner) {
    for (const s of stacks) inv.add(c, s);
    return;
  }
  if (!(yield* goTo(c, owner.location, { reach: 2.2, yTol: 3, run: true, follow: () => c.owner()?.location }))) {
    for (const s of stacks) inv.add(c, s);
    throw new GoalError("não consegui chegar até você para entregar");
  }
  face(c, owner.location);
  setAction(c.entity, "wave");
  yield 8;
  const pc = owner.getComponent("minecraft:inventory")?.container;
  let total = 0;
  for (const s of stacks) {
    total += s.amount;
    const left = pc ? pc.addItem(s) : s;
    if (left) {
      try {
        const ent = owner.dimension.spawnItem(left, owner.location);
        IGNORE_ITEMS.set(ent.id, system.currentTick);
      } catch {
        inv.add(c, left);
      }
    }
  }
  sound(c.entity, "random.pop", 0.8, 1.0);
  setAction(c.entity, "idle");
  say(c, `Toma: ${total} ${label}.`, { force: true });
}

/** Ferramentas equipadas que ela mantém ao entregar "tudo" (a melhor de cada tipo). */
function keptTools(c) {
  const keep = new Set();
  for (const k of ["pickaxe", "axe", "shovel", "sword", "hoe"]) {
    const t = inv.bestTool(c, k);
    if (t) keep.add(t.slot);
  }
  return keep;
}

export function* giveAll(c) {
  const cont = inv.container(c);
  if (!cont) return;
  const keep = keptTools(c);
  const stacks = [];
  for (let i = 0; i < cont.size; i++) {
    if (keep.has(i)) continue;
    const it = cont.getItem(i);
    if (it) {
      stacks.push(it);
      cont.setItem(i, undefined);
    }
  }
  if (!stacks.length) {
    say(c, "Não tenho nada além das minhas ferramentas agora.", { force: true });
    return;
  }
  yield* deliver(c, stacks, "itens (fiquei só com minhas ferramentas)");
}

function* giveTarget(c, target, count) {
  const have = inv.count(c, target);
  if (have <= 0) throw new GoalError(`não tenho ${targetName(target)} agora`);
  const stacks = inv.takeStacks(c, target, count ?? have);
  yield* deliver(c, stacks, targetName(target));
}

/** Comer (animação, som e fome restaurada). */
export function* eat(c) {
  const food = inv.bestFood(c);
  if (!food) return false;
  stop(c);
  hold(c.entity, food);
  setAction(c.entity, "eat");
  for (let i = 0; i < 4; i++) {
    sound(c.entity, "random.eat", 0.6, 0.9 + Math.random() * 0.3);
    yield 8;
  }
  inv.take(c, food, 1);
  c.rec.hunger = Math.min(20, c.rec.hunger + (FOOD[food] ?? 2));
  sound(c.entity, "random.burp", 0.5, 1);
  setAction(c.entity, "idle");
  hold(c.entity, undefined);
  return true;
}

/** Seguir o dono a uma distância natural, olhando para ele e pegando itens perto. */
export function* followOwner(c, ticks = Infinity) {
  const t0 = system.currentTick;
  while (c.alive() && system.currentTick - t0 < ticks) {
    const o = c.owner();
    if (!o) {
      yield* idleNear(c, 40);
      continue;
    }
    if (o.dimension.id !== c.dim().id) {
      yield 40;
      continue;
    }
    const d = dist(c.pos(), o.location);
    if (d > 5 || Math.abs(o.location.y - c.pos().y) > 4) {
      yield* goTo(c, o.location, { reach: 3, yTol: 3, run: d > 10, follow: () => c.owner()?.location, timeout: 400 });
    } else {
      stop(c);
      if (Math.random() < 0.08) face(c, o.location);
      yield 10;
    }
  }
}

function* stayHere(c) {
  const sp = c.rec.stayPos ?? c.pos();
  c.rec.stayPos = { x: sp.x, y: sp.y, z: sp.z };
  let still = 0;
  while (c.alive()) {
    if (dist(c.pos(), sp) > 2) {
      yield* goTo(c, sp, { reach: 1, yTol: 2 });
      still = 0;
    }
    still += 20;
    if (still > 1200) setAction(c.entity, "sit");
    yield 20;
  }
}

/** Dormir: perto do dono (ou na cama da base). Acorda de dia ou se houver perigo. */
export function* sleep(c, untilDay = true) {
  const o = c.owner();
  const bed = c.rec.base ? findBlocks(c.dim(), c.rec.base, ["minecraft:bed"], { r: 10, dy: 4, max: 1 })[0] : undefined;
  if (bed) yield* goTo(c, { x: bed.x + 0.5, y: bed.y, z: bed.z + 0.5 }, { reach: 1.5, yTol: 2 });
  else if (o) yield* goTo(c, o.location, { reach: 3, yTol: 3 });
  stop(c);
  hold(c.entity, undefined);
  say(c, pick(LINES.sleepy), { chatter: true });
  c.sleeping = true;
  setAction(c.entity, "sleep");
  try {
    while (c.alive()) {
      yield 40;
      const time = world.getTimeOfDay();
      if (untilDay && (time < 12500 || time > 23400)) break;
      if (findThreat(c)) break;
      if (c.flags.wake) break;
      const ow = c.owner();
      if (ow && !bed && (ow.dimension.id !== c.dim().id || dist(ow.location, c.pos()) > 24)) break; // você saiu: ela levanta e vai junto
    }
  } finally {
    c.sleeping = false;
    c.flags.wake = false;
    setAction(c.entity, "idle");
  }
  say(c, pick(LINES.wake), { chatter: true });
}

/** Ilumina a área do dono com tochas (fabrica as tochas se precisar). */
function* torches(c, count) {
  if (inv.count(c, "minecraft:torch") < count) yield* obtain(c, "minecraft:torch", count, { cmd: true });
  const o = c.owner();
  const center = o?.location ?? c.pos();
  const dim = c.dim();
  let placed = 0;
  for (let r = 3; r <= 12 && placed < count; r += 5) {
    for (let k = 0; k < 8 && placed < count; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const x = Math.floor(center.x + Math.cos(ang) * r), z = Math.floor(center.z + Math.sin(ang) * r);
      const spot = standSpot(dim, { x, y: center.y, z }, 1);
      if (!spot) continue;
      const b = blockAt(dim, spot.x, spot.y, spot.z);
      try {
        if (!b || b.getLightLevel() > 9) continue;
      } catch {
        continue;
      }
      if (!(yield* reach(c, spot, 3.5))) continue;
      if (yield* placeAt(c, spot, "minecraft:torch", "minecraft:torch", { torch_facing_direction: "top" })) placed++;
    }
  }
  say(c, placed ? `Coloquei ${placed} tochas por aqui.` : "Já está bem iluminado por aqui!", { force: true });
}

/** Guarda tudo (menos ferramentas, comida e blocos de apoio) no baú da base. */
export function* deposit(c) {
  const dim = c.dim();
  let chestPos = c.mem.nearest("chest", c.pos(), dim.id, 200);
  if (chestPos && !/chest|barrel/.test(blockAt(dim, chestPos.x, chestPos.y, chestPos.z)?.typeId ?? "")) {
    c.mem.forget("chest", chestPos);
    chestPos = undefined;
  }
  if (!chestPos) {
    if (inv.count(c, "minecraft:chest") < 1) yield* obtain(c, "minecraft:chest", 1, {});
    if (c.rec.base) yield* goTo(c, c.rec.base, { reach: 2, yTol: 3 });
    const spot = freeSpotAround(c);
    if (!spot || !(yield* placeAt(c, spot, "minecraft:chest", "minecraft:chest", { "minecraft:cardinal_direction": "north" }))) throw new GoalError("não consegui colocar um baú");
    chestPos = { ...spot, d: dim.id, t: system.currentTick };
    c.mem.remember("chest", spot, dim.id);
  }
  if (!(yield* goTo(c, { x: chestPos.x + 0.5, y: chestPos.y, z: chestPos.z + 0.5 }, { reach: 2.5, yTol: 3 }))) throw new GoalError("não consegui chegar no baú");
  const cc = blockAt(dim, chestPos.x, chestPos.y, chestPos.z)?.getComponent("minecraft:inventory")?.container;
  const mine = inv.container(c);
  if (!cc || !mine) throw new GoalError("o baú não abriu");
  face(c, chestPos);
  sound(c.entity, "random.chestopen", 0.6, 1);
  const keep = keptTools(c);
  let moved = 0;
  for (let i = 0; i < mine.size; i++) {
    if (keep.has(i)) continue;
    const it = mine.getItem(i);
    if (!it) continue;
    if (isFood(it.typeId) || /torch|cobblestone|dirt/.test(it.typeId)) continue;
    const left = cc.addItem(it);
    moved += it.amount - (left?.amount ?? 0);
    mine.setItem(i, left);
    if (i % 4 === 0) yield 1;
  }
  sound(c.entity, "random.chestclosed", 0.6, 1);
  say(c, `Guardei ${moved} itens no baú.`, { chatter: true });
}

/** Cuida da plantação: colhe o que está maduro e replanta. */
export function* tendFarm(c) {
  const f = c.rec.farm;
  if (!f) return;
  const dim = c.dim();
  if (f.d !== dim.id) return;
  const center = { x: (f.from.x + f.to.x) / 2, y: f.from.y, z: (f.from.z + f.to.z) / 2 };
  yield* goTo(c, center, { reach: 4, yTol: 3 });
  const ripe = findBlocks(dim, center, Object.keys(CROPS), { r: 6, dy: 2, max: 60, filter: (p) => {
    const b = blockAt(dim, p.x, p.y, p.z);
    const info = b && CROPS[b.typeId];
    return !!info && safeState(b, info.state) === info.ripe;
  } });
  for (const p of ripe) {
    if (!(yield* reach(c, p, 2.6))) continue;
    yield* harvestCrop(c, p);
  }
  yield* sweepItems(c, center, 7);
  if (inv.count(c, "minecraft:wheat") >= 3) yield* craft(c, "minecraft:bread", inv.count(c, "minecraft:bread") + Math.floor(inv.count(c, "minecraft:wheat") / 3));
}

/** Exploração longa (vários trechos), anotando recursos, depois volta. */
function* explore(c, legs = 5) {
  say(c, "Partiu aventura! Vou explorar e anotar tudo que eu achar.", { force: true });
  for (let i = 0; i < legs && c.alive(); i++) {
    yield* exploreStep(c, "lugares novos");
    scanSurroundings(c);
    keepLoaded(c);
  }
  const s = c.mem.spots;
  const found = Object.entries(s).filter(([, v]) => v.length).map(([k, v]) => `${v.length}× ${k.replace("ore_", "minério de ")}`).slice(0, 6);
  say(c, found.length ? `Voltando! Anotei: ${found.join(", ")}.` : "Voltando! Não achei nada muito especial.", { force: true });
  const o = c.owner();
  if (o) yield* goTo(c, o.location, { reach: 4, yTol: 4, run: true, follow: () => c.owner()?.location });
}

/**
 * Cria o generator de um objetivo.
 * @param {Companion} c
 * @param {GoalDesc} g
 */
export function runGoal(c, g) {
  const a = g.args ?? {};
  const cmd = g.origin === "cmd";
  switch (g.type) {
    case "follow": return followOwner(c);
    case "stay": return stayHere(c);
    case "come": return (function* () {
      const o = c.owner();
      if (o) yield* goTo(c, o.location, { reach: 2.5, yTol: 3, run: true, follow: () => c.owner()?.location });
      say(c, "Tô aqui!", { force: cmd });
    })();
    case "gather": return (function* () {
      const base = a.base ?? inv.count(c, a.item);
      a.base = base;
      const want = base + (a.count ?? 16);
      yield* obtain(c, a.item, want, { cmd });
      say(c, `${pick(LINES.done)} Juntei ${a.count ?? ""} ${targetName(a.item)}.`, { force: cmd });
      if (cmd && a.deliver !== false) yield* deliver(c, inv.takeStacks(c, a.item, a.count ?? 16), targetName(a.item));
    })();
    case "craft": return (function* () {
      let item = a.item;
      if (item.toolKind) item = { id: `minecraft:${a.tier ?? bestCraftableTier(c)}_${item.toolKind}` };
      const id = item.id;
      const base = a.base ?? inv.count(c, id);
      a.base = base;
      yield* obtain(c, id, base + (a.count ?? 1), { cmd });
      say(c, `${pick(LINES.done)} Fiz ${a.count ?? 1} ${ptName(id)}.`, { force: cmd });
      if (cmd && a.deliver !== false) yield* deliver(c, inv.takeStacks(c, id, a.count ?? 1), ptName(id));
    })();
    case "build": return (function* () {
      const ok = yield* buildBlueprint(c, a.blueprint, { here: a.here, cmd, site: a.site });
      if (ok) say(c, `${pick(LINES.done)} ${BLUEPRINTS[a.blueprint]?.name ?? "A obra"} está pronta!`, { force: true });
    })();
    case "farm": return (function* () {
      const ok = yield* buildBlueprint(c, "fazenda", { here: a.here, cmd, crop: a.crop, site: a.site });
      if (ok) say(c, "Plantação pronta! Vou cuidar dela e colher quando amadurecer.", { force: true });
    })();
    case "tend": return tendFarm(c);
    case "food": return (function* () {
      const want = (a.base ?? inv.count(c, { group: "food" })) + (a.count ?? 8);
      a.base ??= inv.count(c, { group: "food" });
      yield* obtainFood(c, want, { cmd });
      if (a.forOwner) {
        const stacks = inv.takeStacks(c, { group: "food" }, a.count ?? 8);
        yield* deliver(c, stacks, "de comida");
      } else say(c, "Comida garantida!", { force: cmd });
    })();
    case "give": return a.all ? giveAll(c) : giveTarget(c, a.item, a.count);
    case "explore": return explore(c, a.legs ?? 5);
    case "hunt": return (function* () {
      yield* huntFor(c, "minecraft:beef", ["minecraft:cow", "minecraft:pig", "minecraft:sheep", "minecraft:chicken"], inv.count(c, { group: "food" }) + (a.count ?? 4), true);
    })();
    case "protect": return (function* () {
      say(c, "Modo guarda-costas ativado. Ninguém encosta em você!", { force: cmd });
      c.rec.mode = "guard";
      yield* followOwner(c);
    })();
    case "attack": return (function* () {
      const t = findThreat(c);
      if (!t) {
        say(c, "Não vejo nenhum monstro por perto.", { force: cmd });
        return;
      }
      yield* fight(c, t);
      yield* defend(c);
    })();
    case "sleep": return sleep(c, !cmd || world.getTimeOfDay() > 12000);
    case "home": return (function* () {
      if (!c.rec.base) throw new GoalError("ainda não temos base. Diga \"aqui é a base\" ou peça uma casa");
      yield* goTo(c, c.rec.base, { reach: 2, yTol: 3, run: true });
      say(c, "Cheguei em casa!", { force: cmd });
    })();
    case "torches": return torches(c, a.count ?? 16);
    case "deposit": return deposit(c);
    case "eat": return eat(c);
    case "defend": return defend(c);
    case "regroup": return (function* () {
      const o = c.owner();
      if (o) yield* goTo(c, o.location, { reach: 4, yTol: 4, run: true, follow: () => c.owner()?.location });
    })();
    case "hangout": return hangout(c, a.ticks ?? 400);
    case "tools": return (function* () {
      for (const kind of a.kinds ?? ["pickaxe", "axe", "sword", "shovel"]) {
        yield* obtain(c, { toolKind: kind, tier: a.tier ?? "stone" }, 1, {});
      }
      say(c, `Fiz ferramentas novas ${a.tier === "iron" ? "de ferro" : a.tier === "diamond" ? "de diamante" : "de pedra"}!`, { chatter: true });
    })();
    case "armor": return (function* () {
      for (const piece of ["chestplate", "leggings", "helmet", "boots"]) {
        const id = `minecraft:${a.tier ?? "iron"}_${piece}`;
        if (inv.count(c, id) > 0) continue;
        yield* obtain(c, id, 1, {});
      }
      say(c, "Armadura nova! Agora aguento muito mais.", { chatter: true });
    })();
    case "stock": return (function* () {
      yield* obtain(c, a.item, inv.count(c, a.item) + (a.count ?? 16), {});
    })();
    default:
      return (function* () {
        throw new GoalError(`não sei fazer "${g.type}" ainda`);
      })();
  }
}

/** Ficar por perto de boa: olha o dono, acena às vezes, junta itens e flores do chão. */
function* hangout(c, ticks) {
  const t0 = system.currentTick;
  while (c.alive() && system.currentTick - t0 < ticks) {
    const o = c.owner();
    if (o && dist(c.pos(), o.location) > 8) {
      yield* goTo(c, o.location, { reach: 4, yTol: 3, follow: () => c.owner()?.location, timeout: 300 });
      continue;
    }
    const r = Math.random();
    if (o && r < 0.05) {
      face(c, o.location);
      setAction(c.entity, "wave");
      yield 30;
      setAction(c.entity, "idle");
    } else if (r < 0.25) {
      // passeia um pouquinho em volta
      const p = c.pos();
      const spot = standSpot(c.dim(), { x: p.x + (Math.random() - 0.5) * 10, y: p.y, z: p.z + (Math.random() - 0.5) * 10 }, 2);
      if (spot) yield* goTo(c, { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 }, { reach: 1, yTol: 2, timeout: 160, allowTeleport: false });
    } else if (r < 0.32) {
      setAction(c.entity, "think");
      yield 40;
      setAction(c.entity, "idle");
    } else {
      if (o) face(c, o.location);
      yield 20;
    }
    yield* sweepItems(c, c.pos(), 3);
  }
}

/** Melhor nível de ferramenta que vale a pena fazer agora. */
export function bestCraftableTier(c) {
  const s = inv.summary(c);
  if ((s["minecraft:diamond"] ?? 0) >= 3) return "diamond";
  if ((s["minecraft:iron_ingot"] ?? 0) >= 3 || (s["minecraft:raw_iron"] ?? 0) >= 3) return "iron";
  if (inv.toolTier(c, "pickaxe") !== "none") return "stone";
  return "wooden";
}

/** Rótulo curto de um objetivo para HUD/menus. */
export function goalLabel(g) {
  if (!g) return "livre";
  const a = g.args ?? {};
  switch (g.type) {
    case "follow": return "te seguindo";
    case "stay": return "esperando aqui";
    case "hangout": return "de boa por perto";
    case "regroup": return "voltando pra perto de você";
    case "tend": return "cuidando da plantação";
    case "tools": return "fazendo ferramentas";
    case "armor": return "fazendo armadura";
    case "stock": return `juntando ${targetName(a.item)}`;
    case "eat": return "comendo";
    case "defend": return "lutando";
    case "sleep": return "dormindo";
    case "deposit": return "guardando coisas no baú";
    default: return describe({ type: g.type, ...a });
  }
}

export { ItemStack, toolInfo };
