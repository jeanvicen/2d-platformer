/**
 * Task runners. One generator per task kind; the Executor drives them over time.
 * Runners are written to be RESTARTABLE: all progress lives in task.data / task.progress
 * (persisted), so after a reload, death or interruption the runner simply starts again and
 * continues from the real state of the world and inventory.
 */
import { BlockPermutation, Entity, EntityDamageCause, ItemStack, type Player } from "@minecraft/server";
import type { Agent } from "../ai/agent";
import { AnimState, Mood, TUNING } from "../core/constants";
import { center, dist, getBlock, isPassableBlock, isValid, particle, safe, sound, yawTo } from "../core/mc";
import type { Intent, MaterialKind, StoredItem, Task, Vec3 } from "../core/types";
import { craft, findRecipe, missingFor, plankPotential, type Recipe } from "../crafting/recipes";
import { makeBlueprint, rotate, ladderFacing } from "../building/blueprints";
import { countNeeds, roleMat, shortfall, type Have, type MatKey } from "../building/materials";
import {
  COOK_RESULT, CROPS, FOOD_ANIMALS, FOODS, fuelValue, isLeafBlock, isLogBlock, isFood, isLogItem, isPlanksItem, itemMatchesResource, NATURAL_DIG,
  oreInfo, prettyItem, RARE_ITEMS, resourceOfOre, RESOURCE_PT, SOFT_BLOCKS, STONE_BLOCKS, TIER_LEVEL, toolInfo,
  weaponDamage, isFoodCookable, type Tier,
} from "../inventory/item_catalog";
import { equipBestArmor, equipBestTool, equipBestWeapon, damageMainhand, unequip } from "../inventory/equipment";
import { say, sayKey, setMood, actionBar } from "../communication/comms";
import { entitiesNear, exposed, findTree, inspectTree, nearLiquid, scanBlocks, TICK, type TreeInfo } from "../perception/perception";
import { stateForStep } from "../state/state_machine";
import { chooseFood, eat } from "../survival/needs";
import { breakAt, collectNear, deliverTo, explore, goNear, placeAt, returnAndDeliver, returnToOwner, type R } from "./routines";
import { plan } from "../planner/planner";
import { agents } from "../ai/agent_manager";
import { handOff } from "../ai/squad";

export type Outcome =
  | { ok: true; msg?: string; followUp?: Task[] }
  | { ok: false; reason: string; retry?: boolean }
  /** prerequisites first: `before` runs ahead of this task, which stays in the queue */
  | { ok: "defer"; before: Task[]; msg?: string };

const key = (p: Vec3) => `${p.x},${p.y},${p.z}`;

export function step(a: Agent, t: Task, name: string): void {
  const i = t.steps.indexOf(name);
  if (i >= 0 && i !== t.stepIndex) {
    t.stepIndex = i;
    a.markDirty();
  }
  a.sm.set(stateForStep(t.kind, name));
  a.rt.lastWhy = "";
}

function progress(a: Agent, t: Task, done: number, total: number, what: string): void {
  t.progress = { done: Math.min(done, total), total };
  actionBar(a, `${what} ${Math.min(done, total)}/${total}`);
}

type D = Record<string, unknown> & { collected: number; delivered: number };
function data(t: Task): D {
  const d = t.data as D;
  if (typeof d.collected !== "number") d.collected = 0;
  if (typeof d.delivered !== "number") d.delivered = 0;
  return d;
}

/** verify -> return -> deliver -> confirm, shared by every gathering task */
function* finish(a: Agent, t: Task, match: (id: string) => boolean, label: string): R<Outcome> {
  const d = data(t);
  step(a, t, "verify");
  const have = a.inv.count(match);
  // deliver exactly what was asked (never more), even if a tree dropped extra logs
  const asked = t.goal.count ?? Infinity;
  const toDeliver = Math.min(have, Math.max(0, Math.min(d.collected, asked) - d.delivered));
  const toAgent = t.data.deliverToAgent as string | undefined;
  if (toAgent && toDeliver > 0) {
    const target = agents.get(toAgent);
    const tb = target?.body();
    if (target && tb) {
      step(a, t, "return");
      const g = yield* goNear(a, tb.location, 3, { run: true });
      if (g.ok || dist(a.body()?.location ?? tb.location, tb.location) < 8) {
        step(a, t, "deliver");
        const r = handOff(a, toAgent, match, toDeliver);
        d.delivered += r.n;
        a.setAnim(AnimState.Wave, 1000);
        step(a, t, "confirm");
        return { ok: true, msg: r.n ? `Entreguei ${r.n} de ${label} para ${target.name}.` : `${target.name} estava sem espaço.` };
      }
    }
  }
  if (!t.deliver) {
    step(a, t, "confirm");
    return { ok: true, msg: `Guardei ${d.collected} de ${label} na minha mochila.` };
  }
  if (toDeliver <= 0) {
    step(a, t, "confirm");
    return d.delivered > 0 ? { ok: true, msg: `Entreguei tudo (${d.delivered} de ${label}).` } : { ok: false, reason: `não consegui nenhum(a) ${label}` };
  }
  sayKey(a, "returning", undefined, { throttleMs: 4000 });
  step(a, t, "return");
  const back = yield* returnToOwner(a);
  if (!back.ok) return { ok: false, reason: `peguei ${toDeliver} de ${label}, mas não consegui voltar: ${back.reason}. Os itens estão comigo.`, retry: true };
  step(a, t, "deliver");
  const owner = a.owner();
  if (!owner) return { ok: false, reason: "você não está aqui para receber", retry: true };
  a.setAnim(AnimState.Wave, 1200);
  const res = deliverTo(a, owner, (s) => match(s.id), toDeliver);
  d.delivered += res.n;
  step(a, t, "confirm");
  setMood(a.body(), Mood.Happy, 3000);
  return { ok: true, msg: res.n ? `Aqui está: ${res.text}.` : `Não sobrou nada para entregar.` };
}


function* handleFull(a: Agent, t: Task, match: (id: string) => boolean): R<Outcome | undefined> {
  sayKey(a, "full", undefined, { throttleMs: 8000 });
  const r = yield* returnAndDeliver(a, (s) => match(s.id));
  data(t).delivered += r.n;
  if (!r.ok) return { ok: false, reason: `minha mochila encheu e não consegui voltar: ${r.reason}`, retry: true };
  if (a.inv.freeSlots() === 0) {
    const r2 = yield* returnAndDeliver(a, (s) => !RARE_ITEMS.has(s.id) && !isFood(s.id));
    if (!r2.ok || a.inv.freeSlots() === 0) return { ok: false, reason: "minha mochila está cheia de outras coisas" };
  }
  return undefined;
}

// =============================================================================================
// WOOD
// =============================================================================================
export function* gatherWood(a: Agent, t: Task): R<Outcome> {
  const need = t.goal.count ?? 16;
  const d = data(t);
  const e = a.body();
  if (!e) return { ok: false, reason: "corpo indisponível", retry: true };
  step(a, t, "check_inventory");
  if (!d.init) {
    d.init = true;
    d.collected = Math.min(a.inv.count(isLogItem), need);
    if (!d.announced) {
      d.announced = true;
      sayKey(a, "start_wood");
    }
  }
  step(a, t, "select_tool");
  if (!equipBestTool(a, "axe") && !d.warnedAxe) {
    d.warnedAxe = true;
    say(a, "Estou sem machado, vou cortar na mão (mais devagar).", { key: "noaxe", throttleMs: 60000 });
  }
  const avoid = new Set<string>((d.avoid as string[]) ?? []);
  let emptyTrees = 0;
  while (d.collected < need) {
    step(a, t, "find_target");
    const body = a.body();
    if (!body) return { ok: false, reason: "corpo indisponível", retry: true };
    let tree: TreeInfo | undefined;
    const forced = d.treePos as Vec3 | undefined;
    if (forced) tree = inspectTree(body.dimension, forced) ?? { base: forced, logs: [forced] };
    else tree = yield* findTree(body.dimension, body.location, avoid);
    if (!tree) {
      const tries = (d.explored as number) ?? 0;
      if (tries < 3) {
        d.explored = tries + 1;
        say(a, "Não vejo árvores aqui. Vou explorar um pouco!", { key: "explore-wood", throttleMs: 20000 });
        yield* explore(a, tries);
        continue;
      }
      if (d.collected > 0) break;
      return { ok: false, reason: "explorei os arredores e não encontrei árvores naturais. Me leve até uma floresta?" };
    }
    let gotHere = 0;
    for (const log of tree.logs) {
      if (d.collected >= need) break;
      const b = getBlock(body.dimension, log);
      if (!b || !/(_log|_stem|^minecraft:log2?$)/.test(b.typeId)) continue;
      step(a, t, "goto_target");
      const g = yield* goNear(a, log, TUNING.reach, { shadowStep: true });
      if (!g.ok) continue;
      step(a, t, "harvest");
      const br = yield* breakAt(a, log);
      if (!br.ok) continue;
      step(a, t, "collect");
      const c = yield* collectNear(a, log, 3.5);
      const got = c.picked.filter((s) => isLogItem(s.id)).reduce((x, y) => x + y.n, 0);
      d.collected += got;
      gotHere += got;
      a.record.stats.logs += got;
      progress(a, t, d.collected, need, "Troncos");
      if (c.full || a.inv.freeSlots() === 0) {
        const f = yield* handleFull(a, t, isLogItem);
        if (f) return f;
      }
    }
    const sweep = yield* collectNear(a, a.body()?.location ?? tree.base, 5, 8);
    const extra = sweep.picked.filter((s) => isLogItem(s.id)).reduce((x, y) => x + y.n, 0);
    d.collected += extra;
    avoid.add(key(tree.base));
    d.avoid = [...avoid].slice(-40);
    d.treePos = undefined;
    if (gotHere + extra === 0 && ++emptyTrees >= 3) {
      if (d.collected > 0) break;
      return { ok: false, reason: "as árvores daqui estão fora do meu alcance", retry: true };
    }
    yield TICK;
  }
  return yield* finish(a, t, isLogItem, RESOURCE_PT.wood);
}

// =============================================================================================
// MINING (stone, ores, sand, dirt, gravel)
// =============================================================================================
const NEED_LEVEL: Partial<Record<string, number>> = { stone: 1, coal: 1, copper: 2, iron: 2, lapis: 2, gold: 3, diamond: 3, redstone: 3, emerald: 3, ore: 1 };

function bestPickLevel(a: Agent): number {
  let lvl = 0;
  const all = [...a.inv.slots, ...(a.record.equipment.mainhand ? [a.record.equipment.mainhand] : [])];
  for (const s of all) {
    const ti = toolInfo(s.id);
    if (ti && ti.kind === "pickaxe" && ti.tier) lvl = Math.max(lvl, TIER_LEVEL[ti.tier]);
  }
  return lvl;
}

export function* mine(a: Agent, t: Task): R<Outcome> {
  const r = t.goal.resource ?? "stone";
  const need = t.goal.count ?? 16;
  const d = data(t);
  const match = (id: string) => itemMatchesResource(id, r);
  const soft = r === "sand" || r === "dirt" || r === "gravel";
  step(a, t, "check_inventory");
  if (!d.init) {
    d.init = true;
    d.collected = Math.min(a.inv.count(match), need);
    sayKey(a, "start_mine");
  }
  step(a, t, "select_tool");
  if (!soft) {
    const lvl = NEED_LEVEL[r] ?? 1;
    if (bestPickLevel(a) < lvl) {
      const want = lvl >= 3 ? "iron_pickaxe" : lvl === 2 ? "stone_pickaxe" : "wooden_pickaxe";
      say(a, `Preciso de uma ${prettyItem("minecraft:" + want)}... vou tentar fabricar.`, { key: "needpick", throttleMs: 20000 });
      const made = yield* craftByKey(a, want, 1);
      if (!made.ok && bestPickLevel(a) < lvl) {
        return { ok: false, reason: `preciso de uma picareta ${lvl >= 3 ? "de ferro" : lvl === 2 ? "de pedra" : "de madeira"} para minerar ${RESOURCE_PT[r]} (${made.reason})` };
      }
    }
    equipBestTool(a, "pickaxe");
  } else equipBestTool(a, "shovel");

  const blockPred = (id: string): boolean => {
    if (soft) return SOFT_BLOCKS[id] === r;
    if (r === "stone") return STONE_BLOCKS.has(id);
    const ok = resourceOfOre(r)(id);
    if (!ok) return false;
    const info = oreInfo(id);
    return !!info && info.needLevel <= bestPickLevel(a);
  };
  const avoid = new Set<string>();
  const stairFloors = new Set<string>((d.stairFloors as string[]) ?? []);
  let staircaseSteps = (d.stair as number) ?? 0;
  let misses = 0;
  while (d.collected < need) {
    const body = a.body();
    if (!body) return { ok: false, reason: "corpo indisponível", retry: true };
    step(a, t, "find_target");
    const targets = yield* scanBlocks(
      body.dimension,
      body.location,
      (b) =>
        blockPred(b.typeId) &&
        !avoid.has(key(b.location)) &&
        !stairFloors.has(key(b.location)) && // never break the steps of the way out
        exposed(body.dimension, b.location) &&
        !nearLiquid(body.dimension, b.location),
      { radius: 14, yDown: 8, yUp: 6, limit: 6, minRing: 2 },
    );
    if (!targets.length) {
      // alternative strategy: dig a safe staircase down (natural blocks only)
      if (!soft && staircaseSteps < 16 && body.location.y > -50) {
        const s = yield* staircase(a, 4, match, t, stairFloors);
        d.stairFloors = [...stairFloors].slice(-40);
        staircaseSteps += s.steps;
        d.stair = staircaseSteps;
        d.collected += s.got;
        if (s.stop) {
          if (d.collected > 0) break;
          return { ok: false, reason: s.stop };
        }
        continue;
      }
      const tries = (d.explored as number) ?? 0;
      if (tries < 2) {
        d.explored = tries + 1;
        say(a, `Não acho ${RESOURCE_PT[r]} por aqui. Vou procurar em outro lugar.`, { key: "explore-mine", throttleMs: 20000 });
        yield* explore(a, tries);
        continue;
      }
      if (d.collected > 0) break;
      return { ok: false, reason: `procurei em volta e não encontrei ${RESOURCE_PT[r]} exposto. Me leve até uma caverna ou encosta.` };
    }
    let gotRound = 0;
    for (const p of targets) {
      if (d.collected >= need) break;
      step(a, t, "goto_target");
      const g = yield* goNear(a, p, TUNING.reach);
      if (!g.ok) {
        avoid.add(key(p));
        continue;
      }
      // like a careful player: never dig out the block you are standing on
      const me = a.body();
      if (me && p.x === Math.floor(me.location.x) && p.z === Math.floor(me.location.z) && p.y < Math.floor(me.location.y + 0.05)) {
        avoid.add(key(p));
        continue;
      }
      step(a, t, "harvest");
      const br = yield* breakAt(a, p);
      if (!br.ok) {
        avoid.add(key(p));
        if (br.reason?.includes("picareta")) return { ok: false, reason: br.reason };
        continue;
      }
      step(a, t, "collect");
      const c = yield* collectNear(a, p, 3.5);
      const got = c.picked.filter((s) => match(s.id)).reduce((x, y) => x + y.n, 0);
      d.collected += got;
      gotRound += got;
      a.record.stats.mined += 1;
      progress(a, t, d.collected, need, RESOURCE_PT[r]);
      if (c.full || a.inv.freeSlots() === 0) {
        const f = yield* handleFull(a, t, match);
        if (f) return f;
      }
    }
    if (gotRound === 0 && ++misses >= 4) {
      if (d.collected > 0) break;
      return { ok: false, reason: `os blocos de ${RESOURCE_PT[r]} estão fora do meu alcance`, retry: true };
    }
  }
  return yield* finish(a, t, match, RESOURCE_PT[r]);
}

/** Dig a 1-wide staircase down in the direction she is facing. Natural blocks only. */
function* staircase(a: Agent, steps: number, match: (id: string) => boolean, t: Task, floors: Set<string>): R<{ steps: number; got: number; stop?: string }> {
  let got = 0;
  let done = 0;
  for (let i = 0; i < steps; i++) {
    const e = a.body();
    if (!e) return { steps: done, got, stop: "corpo indisponível" };
    const dim = e.dimension;
    const rot = safe(() => e.getRotation().y, 0);
    const rad = (rot * Math.PI) / 180;
    const dx = Math.round(-Math.sin(rad));
    const dz = Math.round(Math.cos(rad));
    const fx = dx !== 0 ? dx : 0;
    const fz = dx !== 0 ? 0 : dz || 1;
    const base = { x: Math.floor(e.location.x), y: Math.floor(e.location.y + 0.05), z: Math.floor(e.location.z) };
    const cells = [
      { x: base.x + fx, y: base.y + 1, z: base.z + fz },
      { x: base.x + fx, y: base.y, z: base.z + fz },
      { x: base.x + fx, y: base.y - 1, z: base.z + fz },
    ];
    const floor = { x: base.x + fx, y: base.y - 2, z: base.z + fz };
    const fb = getBlock(dim, floor);
    if (!fb || fb.isAir || fb.isLiquid) return { steps: done, got, stop: "há um buraco ou água/lava à frente, parei por segurança" };
    floors.add(key(floor));
    floors.add(key({ x: base.x, y: base.y - 1, z: base.z }));
    for (const c of cells) {
      const b = getBlock(dim, c);
      if (!b) return { steps: done, got, stop: "área não carregada" };
      if (isPassableBlock(b)) continue;
      if (!NATURAL_DIG.has(b.typeId) && !oreInfo(b.typeId)) return { steps: done, got, stop: `encontrei ${prettyItem(b.typeId)} no caminho e não vou quebrar` };
      if (nearLiquid(dim, c)) return { steps: done, got, stop: "tem lava ou água perto, parei por segurança" };
      step(a, t, "harvest");
      const br = yield* breakAt(a, c);
      if (!br.ok) return { steps: done, got, stop: br.reason };
      const col = yield* collectNear(a, c, 3);
      got += col.picked.filter((s) => match(s.id)).reduce((x, y) => x + y.n, 0);
    }
    step(a, t, "goto_target");
    const g = yield* goNear(a, { x: base.x + fx, y: base.y - 1, z: base.z + fz }, 1.8);
    if (!g.ok) return { steps: done, got, stop: g.reason };
    done++;
  }
  return { steps: done, got };
}

// =============================================================================================
// FARMING & FOOD
// =============================================================================================
function growth(b: { permutation: BlockPermutation }): number {
  return Number(safe(() => (b.permutation.getState as (n: string) => unknown)("growth"), 0)) || 0;
}

function* harvestCrop(a: Agent, p: Vec3): R<StoredItem[]> {
  const e = a.body();
  if (!e) return [];
  const dim = e.dimension;
  const b = getBlock(dim, p);
  if (!b) return [];
  const id = b.typeId;
  if (id === "minecraft:sweet_berry_bush") {
    const g = growth(b);
    if (g < 2) return [];
    const n = g >= 3 ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
    a.setWorkAnim(AnimState.Build);
    yield { t: "wait", ticks: 8 };
    const ok = safe(() => {
      b.setPermutation((b.permutation.withState as (n: string, v: number) => BlockPermutation)("growth", 1));
      return true;
    }, false);
    a.setWorkAnim(AnimState.Idle);
    if (!ok) return [];
    sound(dim, "block.sweet_berry_bush.pick", center(p));
    const left = a.inv.add({ id: "minecraft:sweet_berries", n });
    return [{ id: "minecraft:sweet_berries", n: n - left }];
  }
  const crop = CROPS[id];
  if (!crop || growth(b) < crop.mature) return [];
  const br = yield* breakAt(a, p);
  if (!br.ok) return [];
  const c = yield* collectNear(a, p, 3);
  // replant like a player
  const now = getBlock(dim, p);
  const below = getBlock(dim, { x: p.x, y: p.y - 1, z: p.z });
  if (now && now.isAir && below && below.typeId === "minecraft:farmland" && a.inv.countId(crop.seed) > 0) {
    yield* placeAt(a, p, { id: crop.seed, n: 1 }, BlockPermutation.resolve(id));
  }
  return c.picked;
}

function* findCrops(a: Agent, filter?: (blockId: string) => boolean): R<Vec3[]> {
  const e = a.body();
  if (!e) return [];
  return yield* scanBlocks(
    e.dimension,
    e.location,
    (b) => {
      if (filter && !filter(b.typeId)) return false;
      if (b.typeId === "minecraft:sweet_berry_bush") return growth(b) >= 2;
      const c = CROPS[b.typeId];
      return !!c && growth(b) >= c.mature;
    },
    { radius: 16, yDown: 4, yUp: 4, limit: 12, minRing: 4 },
  );
}

export function* farm(a: Agent, t: Task): R<Outcome> {
  const d = data(t);
  const need = t.goal.count ?? 9;
  const r = t.goal.resource;
  const cropFilter = r ? (id: string) => CROPS[id] !== undefined && itemMatchesResource(CROPS[id].product, r) : undefined;
  const match = r ? (id: string) => itemMatchesResource(id, r) : (id: string) => Object.values(CROPS).some((c) => c.product === id) || id === "minecraft:sweet_berries";
  step(a, t, "select_tool");
  equipBestTool(a, "hoe");
  let empty = 0;
  while (d.collected < need) {
    step(a, t, "find_target");
    const crops = yield* findCrops(a, cropFilter);
    if (!crops.length) {
      if (d.collected > 0) break;
      return { ok: false, reason: "não há plantação madura por perto" };
    }
    let got = 0;
    for (const p of crops) {
      if (d.collected >= need) break;
      step(a, t, "goto_target");
      const g = yield* goNear(a, p, TUNING.reach);
      if (!g.ok) continue;
      step(a, t, "harvest");
      const items = yield* harvestCrop(a, p);
      const n = items.filter((s) => match(s.id)).reduce((x, y) => x + y.n, 0);
      d.collected += n;
      got += n;
      progress(a, t, d.collected, need, "Colheita");
    }
    if (!got && ++empty >= 2) break;
  }
  return yield* finish(a, t, match, r ? RESOURCE_PT[r] : "colheita");
}

export function* gatherFood(a: Agent, t: Task): R<Outcome> {
  const d = data(t);
  const need = t.goal.count ?? 6;
  step(a, t, "check_inventory");
  if (!d.init) {
    d.init = true;
    d.food = 0;
    d.wheat = 0;
    sayKey(a, "start_food");
  }
  const effective = () => (d.food as number) + Math.floor((d.wheat as number) / 3);
  // deliver what was gathered/cooked for THIS order, not food she already carried
  const gathered = new Set<string>((d.ids as string[]) ?? []);
  let rounds = 0;
  while (effective() < need && rounds++ < 12) {
    step(a, t, "find_target");
    const crops = yield* findCrops(a);
    if (crops.length) {
      for (const p of crops) {
        if (effective() >= need) break;
        step(a, t, "goto_target");
        const g = yield* goNear(a, p, TUNING.reach);
        if (!g.ok) continue;
        step(a, t, "harvest");
        const items = yield* harvestCrop(a, p);
        for (const s of items) {
          if (s.id === "minecraft:wheat") d.wheat = (d.wheat as number) + s.n;
          else if (isFood(s.id)) d.food = (d.food as number) + s.n;
          gathered.add(s.id);
        }
        progress(a, t, effective(), need, "Comida");
      }
      continue;
    }
    const canHunt = a.record.settings.allowHunting || t.goal.allowHunting;
    if (canHunt) {
      const h = yield* huntOnce(a, t, undefined, gathered);
      if (h > 0) {
        d.food = (d.food as number) + h;
        progress(a, t, effective(), need, "Comida");
        continue;
      }
    }
    // nothing here: look around before giving up (like a player would)
    const tries = (d.explored as number) ?? 0;
    if (tries < 3) {
      d.explored = tries + 1;
      say(a, canHunt ? "Não achei plantação nem animais aqui. Vou procurar mais longe!" : "Não achei plantação aqui. Vou procurar mais longe!", { key: "explore-food", throttleMs: 20000 });
      yield* explore(a, tries);
      continue;
    }
    if (effective() > 0) break;
    if (!canHunt) {
      a.rt.clarification = {
        question: "Não achei plantação madura nem frutinhas. Posso caçar animais?",
        options: [
          { label: "Pode caçar", text: "cace animais" },
          { label: "Não, deixa", text: "cancela" },
        ],
        context: "",
      };
      return { ok: false, reason: "não achei plantação madura nem frutinhas. Posso caçar animais? Diga 'cace animais' (ou ative a caça nas configurações)." };
    }
    return { ok: false, reason: "explorei em volta e não encontrei comida nem animais" };
  }
  // process: wheat -> bread at a crafting table, raw meat stays raw unless a furnace is used
  step(a, t, "process");
  const wheat = a.inv.countId("minecraft:wheat");
  if (wheat >= 3) {
    const made = yield* craftByKey(a, "bread", Math.floor(wheat / 3), true);
    if (made.ok) d.food = (d.food as number) + (made.n ?? 0);
    else say(a, `Tenho trigo mas não consegui fazer pão: ${made.reason}. Vou entregar o trigo.`, { key: "nobread", throttleMs: 30000 });
  }
  // cook raw meat when a furnace is available (or can be made): cooked food is much better
  const raw = a.inv.slots.find((x) => isFoodCookable(x.id) && FOODS[x.id]?.raw);
  if (raw) {
    const cooked = yield* smeltAt(a, raw.id, a.inv.countId(raw.id), a.inv.count((id) => id === "minecraft:cobblestone" || id === "minecraft:cobbled_deepslate") >= 8 || a.inv.countId("minecraft:furnace") > 0);
    if (cooked.got) {
      gathered.add(COOK_RESULT[raw.id]);
      say(a, `Assei ${cooked.got} ${prettyItem(COOK_RESULT[raw.id])} pra você!`, { key: "cooked", throttleMs: 10000 });
    }
  }
  if (wheat >= 3) gathered.add("minecraft:bread");
  d.ids = [...gathered];
  d.collected = (d.food as number) + (wheat >= 3 ? 0 : (d.wheat as number));
  a.record.stats.food += d.food as number;
  const match = (id: string) => (gathered.size ? gathered.has(id) : isFood(id) || id === "minecraft:wheat");
  return yield* finish(a, t, match, RESOURCE_PT.food);
}

// =============================================================================================
// COMBAT based tasks (hunt / attack)
// =============================================================================================
export function attackDamage(a: Agent): number {
  const w = a.record.equipment.mainhand?.id;
  return 4 + Math.max(0, weaponDamage(w) - 1) + (a.persona === "raven" ? 1 : 0);
}

export function* fight(a: Agent, target: Entity, maxTicks = 20 * 40): R<{ killed: boolean; reason?: string; at?: Vec3 }> {
  equipBestWeapon(a);
  setMood(a.body(), Mood.Focused);
  let ticks = 0;
  let lastLoc: Vec3 | undefined;
  while (ticks < maxTicks) {
    const e = a.body();
    if (!e) return { killed: false, reason: "corpo indisponível" };
    if (!isValid(target)) return { killed: true, at: lastLoc };
    const hp = safe(() => target.getComponent("minecraft:health")?.currentValue ?? 0, 0);
    if (hp <= 0) return { killed: true, at: lastLoc ?? target.location };
    lastLoc = { ...target.location };
    const owner = a.owner();
    if (owner && dist(owner.location, target.location) > TUNING.leashCombatDistance + 8) {
      return { killed: false, reason: "o alvo fugiu para longe de você, não vou persegui-lo" };
    }
    const d = dist(e.location, target.location);
    if (d > 2.8) {
      a.setNativeMode("scripted");
      a.mover.start({
        target: target.location,
        isGoal: (c) => Math.hypot(c.x + 0.5 - target.location.x, c.y - target.location.y, c.z + 0.5 - target.location.z) <= 2.2,
        run: true,
        maxRadius: 24,
      });
      yield { t: "wait", ticks: 8 };
      ticks += 8;
      if (a.mover.status === "failed") return { killed: false, reason: `não consigo alcançar o alvo (${a.mover.failReason})` };
      continue;
    }
    a.mover.stop();
    safe(() => e.teleport(e.location, { facingLocation: { x: target.location.x, y: target.location.y + 1, z: target.location.z } }), undefined);
    a.setAnim(AnimState.Attack, 500);
    safe(() => target.applyDamage(attackDamage(a), { cause: EntityDamageCause.entityAttack, damagingEntity: e }), false);
    damageMainhand(a);
    a.rt.lastHitAt = Date.now();
    yield { t: "wait", ticks: 12 };
    ticks += 12;
  }
  return { killed: false, reason: "a luta demorou demais" };
}

function isBaby(e: Entity): boolean {
  return safe(() => !!e.getComponent("minecraft:is_baby"), false);
}

/** Hunt one animal; returns the amount of meat collected. */
function* huntOnce(a: Agent, t: Task, mob?: string, gathered?: Set<string>): R<number> {
  const e = a.body();
  if (!e) return 0;
  step(a, t, "find_target");
  const list = entitiesNear(e.dimension, e.location, 24).filter((x) => {
    const id = safe(() => x.typeId, "");
    if (!(id in FOOD_ANIMALS)) return false;
    if (mob && id !== mob) return false;
    if (isBaby(x)) return false; // never the babies
    if (safe(() => x.nameTag, "")) return false; // never named pets
    return true;
  });
  list.sort((x, y) => dist(x.location, e.location) - dist(y.location, e.location));
  const target = list[0];
  if (!target) return 0;
  step(a, t, "goto_target");
  const f = yield* fight(a, target, 20 * 30);
  setMood(a.body(), Mood.Neutral);
  if (!f.killed) return 0;
  step(a, t, "collect");
  const c = yield* collectNear(a, f.at ?? target.location, 4, 20);
  for (const s of c.picked) if (isFood(s.id)) gathered?.add(s.id);
  return c.picked.filter((s) => isFood(s.id)).reduce((x, y) => x + y.n, 0);
}

/** Beasts hunt near the owner and leave the meat on the ground for the squad/owner. */
function* beastHunt(a: Agent, t: Task): R<Outcome> {
  const need = t.goal.count ?? 3;
  let kills = 0;
  let misses = 0;
  while (kills < need && misses < 3) {
    const e = a.body();
    const owner = a.owner();
    if (!e) return { ok: false, reason: "corpo indisponível", retry: true };
    step(a, t, "find_target");
    const center = owner && owner.dimension.id === e.dimension.id ? owner.location : e.location;
    const list = entitiesNear(e.dimension, center, 24).filter((x) => {
      const id = safe(() => x.typeId, "");
      return id in FOOD_ANIMALS && !isBaby(x) && !safe(() => x.nameTag, "");
    });
    list.sort((x, y) => dist(x.location, e.location) - dist(y.location, e.location));
    if (!list[0]) {
      misses++;
      yield { t: "wait", ticks: 40 };
      continue;
    }
    step(a, t, "work");
    const f = yield* fight(a, list[0], 20 * 25);
    if (f.killed) kills++;
    else misses++;
    progress(a, t, kills, need, "Caça");
  }
  step(a, t, "confirm");
  return kills ? { ok: true, msg: `Abateu ${kills} animal(is). A carne ficou no chão perto do local.` } : { ok: false, reason: "não achou animais adultos por perto" };
}

export function* hunt(a: Agent, t: Task): R<Outcome> {
  if (a.isBeast) return yield* beastHunt(a, t);
  const d = data(t);
  const need = t.goal.count ?? 4;
  const mob = t.goal.target?.kind === "mob" ? t.goal.target.mob : undefined;
  if (mob && !(mob in FOOD_ANIMALS)) return { ok: false, reason: "esse bicho não dá carne" };
  step(a, t, "select_tool");
  equipBestWeapon(a);
  let misses = 0;
  while (d.collected < need) {
    const got = yield* huntOnce(a, t, mob);
    if (!got) {
      if (++misses >= 2) {
        if (d.collected > 0) break;
        return { ok: false, reason: mob ? `não achei ${prettyItem(mob)} adulto por perto` : "não achei animais adultos por perto" };
      }
      continue;
    }
    d.collected += got;
    a.record.stats.kills++;
    progress(a, t, d.collected, need, "Carne");
  }
  return yield* finish(a, t, (id) => isFood(id) && id in COOK_RESULT || /cooked_/.test(id), "carne");
}

export function* attack(a: Agent, t: Task): R<Outcome> {
  step(a, t, "find_target");
  const id = t.data.entityId as string | undefined;
  const e = a.body();
  if (!e) return { ok: false, reason: "corpo indisponível" };
  let target: Entity | undefined;
  if (id) target = safe(() => e.dimension.getEntities({ location: e.location, maxDistance: 40 }).find((x) => x.id === id), undefined);
  if (!target) return { ok: false, reason: "não encontrei o alvo" };
  if (safe(() => target!.typeId, "") === "minecraft:player" || safe(() => target!.matches({ families: ["shadowbound"] }), false)) {
    return { ok: false, reason: "não ataco jogadores nem outras sombras" };
  }
  step(a, t, "work");
  const f = yield* fight(a, target);
  setMood(a.body(), Mood.Neutral);
  if (!f.killed) return { ok: false, reason: f.reason ?? "não consegui derrotar o alvo" };
  a.record.stats.kills++;
  if (!a.isBeast) yield* collectNear(a, f.at ?? e.location, 4, 12);
  step(a, t, "confirm");
  return { ok: true, msg: "Alvo derrotado." };
}

// =============================================================================================
// CRAFTING
// =============================================================================================
const TIER_TRY: Tier[] = ["diamond", "iron", "stone", "wooden"];

function* ensurePlanks(a: Agent, n: number): R<{ ok: boolean; reason?: string }> {
  const have = a.inv.count(isPlanksItem);
  if (have >= n) return { ok: true };
  const logs = Math.ceil((n - have) / 4);
  if (a.inv.count(isLogItem) < logs) return { ok: false, reason: `faltam ${n - have} tábuas (ou ${logs} troncos)` };
  const r = craft(findRecipe("planks")!, a.inv, logs);
  yield { t: "wait", ticks: 4 };
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
}

/** Make sure intermediate ingredients (planks, sticks) exist; never touches rare items. */
function* prepare(a: Agent, recipe: Recipe, times: number): R<{ ok: boolean; reason?: string }> {
  const plankIng = recipe.inputs.find((i) => i.match === isPlanksItem || i.label === "tábua" || i.label === "madeira");
  const stickIng = recipe.inputs.find((i) => i.label === "graveto");
  const planksFor = plankIng ? plankIng.n * times : 0;
  let sticksNeed = stickIng ? Math.max(0, stickIng.n * times - a.inv.countId("minecraft:stick")) : 0;
  const stickCrafts = Math.ceil(sticksNeed / 4);
  const totalPlanks = planksFor + stickCrafts * 2;
  if (totalPlanks > 0) {
    const p = yield* ensurePlanks(a, totalPlanks);
    if (!p.ok) return p;
  }
  if (stickCrafts > 0) {
    const s = craft(findRecipe("stick")!, a.inv, stickCrafts);
    if (!s.ok) return { ok: false, reason: s.reason };
    sticksNeed = 0;
  }
  const missing = missingFor(recipe, a.inv, times);
  if (missing.length) return { ok: false, reason: "faltam " + missing.map((m) => `${m.need - m.have} ${m.label}`).join(", ") };
  return { ok: true };
}

/** Find a crafting table within reach area, or place one (crafting it if needed). */
function* ensureTable(a: Agent): R<{ ok: boolean; pos?: Vec3; reason?: string }> {
  const e = a.body();
  if (!e) return { ok: false, reason: "corpo indisponível" };
  const found = yield* scanBlocks(e.dimension, e.location, (b) => b.typeId === "minecraft:crafting_table", { radius: 10, yDown: 3, yUp: 3, limit: 1 });
  if (found.length) return { ok: true, pos: found[0] };
  if (a.inv.countId("minecraft:crafting_table") === 0) {
    const pre = yield* ensurePlanks(a, 4);
    if (!pre.ok) return { ok: false, reason: "não há bancada por perto e não tenho madeira para fazer uma" };
    const r = craft(findRecipe("crafting_table")!, a.inv, 1);
    if (!r.ok) return { ok: false, reason: r.reason };
  }
  // place it on free ground next to her
  const base = { x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z) };
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const p = { x: base.x + dx, y: base.y, z: base.z + dz };
    const b = getBlock(e.dimension, p);
    const below = getBlock(e.dimension, { x: p.x, y: p.y - 1, z: p.z });
    if (b && b.isAir && below && !below.isAir && !below.isLiquid) {
      const pl = yield* placeAt(a, p, { id: "minecraft:crafting_table", n: 1 }, BlockPermutation.resolve("minecraft:crafting_table"));
      if (pl.ok) {
        say(a, "Coloquei uma bancada aqui do lado.", { key: "table", throttleMs: 10000 });
        return { ok: true, pos: p };
      }
    }
  }
  return { ok: false, reason: "não achei espaço para colocar a bancada" };
}

export function* craftByKey(a: Agent, keyIn: string, times: number, quiet = false): R<{ ok: boolean; n?: number; id?: string; reason?: string }> {
  let k = keyIn;
  if (k.startsWith("best_")) {
    const tool = k.slice(5);
    let chosen: string | undefined;
    for (const tier of TIER_TRY) {
      const rec = findRecipe(`${tier}_${tool}`);
      if (!rec) continue;
      const mats = rec.inputs[0];
      const have = mats.match === isPlanksItem ? plankPotential(a.inv) : a.inv.count(mats.match);
      if (have >= mats.n * times) {
        chosen = rec.key;
        break;
      }
    }
    if (!chosen) return { ok: false, reason: `não tenho material para nenhum(a) ${tool}` };
    k = chosen;
  }
  const recipe = findRecipe(k);
  if (!recipe) return { ok: false, reason: `não conheço a receita de ${k}` };
  // the station first: building a table consumes planks the recipe would otherwise count on
  let tablePos: Vec3 | undefined;
  if (recipe.station === "crafting_table") {
    const tb = yield* ensureTable(a);
    if (!tb.ok || !tb.pos) return { ok: false, reason: tb.reason };
    tablePos = tb.pos;
  }
  const prep = yield* prepare(a, recipe, times);
  if (!prep.ok) return { ok: false, reason: prep.reason };
  if (recipe.station === "crafting_table" && tablePos) {
    const tb = { pos: tablePos };
    const g = yield* goNear(a, tb.pos, 4);
    if (!g.ok) return { ok: false, reason: `não alcancei a bancada (${g.reason})` };
    const e = a.body();
    if (e) safe(() => e.teleport(e.location, { facingLocation: center(tb.pos!) }), undefined);
  }
  a.setWorkAnim(AnimState.Cast);
  const e = a.body();
  if (e) particle(e.dimension, "shadowbound:sparkle", { x: e.location.x, y: e.location.y + 1.2, z: e.location.z }, a.color().particle);
  yield { t: "wait", ticks: Math.min(60, 16 * times) };
  const r = craft(recipe, a.inv, times);
  a.setWorkAnim(AnimState.Idle);
  a.markDirty();
  if (!r.ok) return { ok: false, reason: r.reason };
  if (!quiet) sound(a.body()!.dimension, "random.anvil_use", a.body()!.location, 0.3, 1.6);
  return { ok: true, n: r.n, id: r.id };
}

export function* craftTask(a: Agent, t: Task): R<Outcome> {
  const keyName = t.goal.item ?? "planks";
  const base = findRecipe(keyName.startsWith("best_") ? `wooden_${keyName.slice(5)}` : keyName);
  if (!base) return { ok: false, reason: `não sei fabricar ${keyName}` };
  const want = t.goal.count ?? 1;
  const times = Math.max(1, Math.ceil(want / base.count));
  step(a, t, "check_inventory");
  step(a, t, "prepare_materials");
  const r = yield* craftByKey(a, keyName, times);
  if (!r.ok) return { ok: false, reason: r.reason ?? "falhou" };
  step(a, t, "verify");
  const outId = r.id!;
  t.data.collected = r.n;
  if (!t.deliver) return { ok: true, msg: `Fabriquei ${r.n} ${prettyItem(outId)} e guardei.` };
  const d = data(t);
  d.collected = r.n ?? 0;
  return yield* finish(a, t, (id) => id === outId, prettyItem(outId));
}

// =============================================================================================
// COOKING / SMELTING in a REAL furnace block
// =============================================================================================
const STATIONS = ["minecraft:furnace", "minecraft:lit_furnace", "minecraft:smoker", "minecraft:lit_smoker", "minecraft:blast_furnace", "minecraft:lit_blast_furnace"];

/**
 * Smelt/cook `inputId` in a REAL furnace block. Finds one within 12 blocks; with `placeIfMissing`
 * it places a furnace from the inventory (crafting one from 8 cobblestone if needed).
 */
function* smeltAt(a: Agent, inputId: string, nMax: number, placeIfMissing: boolean): R<{ got: number; reason?: string }> {
  const e0 = a.body();
  if (!e0) return { got: 0, reason: "corpo indisponível" };
  const food = isFood(COOK_RESULT[inputId]);
  const found = yield* scanBlocks(e0.dimension, e0.location, (b) => STATIONS.includes(b.typeId) && (food || !b.typeId.includes("smoker")) && (!food || !b.typeId.includes("blast")), { radius: 12, yDown: 4, yUp: 4, limit: 1 });
  let st = found[0];
  if (!st && placeIfMissing) {
    if (a.inv.countId("minecraft:furnace") === 0) {
      const made = yield* craftByKey(a, "furnace", 1, true);
      if (!made.ok) return { got: 0, reason: "não há fornalha por perto e não tenho 8 pedregulhos para fazer uma" };
    }
    const e = a.body();
    if (!e) return { got: 0, reason: "corpo indisponível" };
    const base = { x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z) };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      const p = { x: base.x + dx, y: base.y, z: base.z + dz };
      const b = getBlock(e.dimension, p);
      const below = getBlock(e.dimension, { x: p.x, y: p.y - 1, z: p.z });
      if (b && b.isAir && below && !below.isAir && !below.isLiquid) {
        const pl = yield* placeAt(a, p, { id: "minecraft:furnace", n: 1 }, BlockPermutation.resolve("minecraft:furnace"));
        if (pl.ok) {
          st = p;
          say(a, "Coloquei uma fornalha aqui pra cozinhar.", { key: "furnace", throttleMs: 15000 });
          break;
        }
      }
    }
  }
  if (!st) return { got: 0, reason: "não há fornalha por perto (até 12 blocos). Coloque uma e eu uso." };
  const g = yield* goNear(a, st, 4);
  if (!g.ok) return { got: 0, reason: `não alcancei a fornalha (${g.reason})` };
  const e = a.body();
  if (!e) return { got: 0, reason: "corpo indisponível" };
  const block = getBlock(e.dimension, st);
  const cont = block ? safe(() => block.getComponent("minecraft:inventory")?.container, undefined) : undefined;
  if (!cont) return { got: 0, reason: "não consegui acessar essa fornalha" };
  const inSlot = safe(() => cont.getItem(0), undefined);
  const outSlot = safe(() => cont.getItem(2), undefined);
  const fuelSlot = safe(() => cont.getItem(1), undefined);
  if (inSlot || outSlot) return { got: 0, reason: "a fornalha já está em uso (tem itens dentro); não vou mexer nas suas coisas" };
  const n = Math.min(a.inv.countId(inputId), nMax, 64);
  if (n <= 0) return { got: 0, reason: "não tenho o que cozinhar" };
  const fuels = a.inv.slots.filter((s) => fuelValue(s.id) > 0 && s.id !== inputId && !RARE_ITEMS.has(s.id)).sort((x, y) => fuelValue(y.id) - fuelValue(x.id));
  let fuelId: string | undefined;
  let fuelN = 0;
  const existingFuel = fuelSlot ? fuelValue(fuelSlot.typeId) * fuelSlot.amount : 0;
  if (existingFuel < n) {
    if (fuelSlot) return { got: 0, reason: "a fornalha tem outro combustível dentro; não vou misturar" };
    const f = fuels[0];
    if (!f) return { got: 0, reason: "não tenho combustível (carvão, madeira ou tábuas)" };
    fuelId = f.id;
    fuelN = Math.min(a.inv.countId(f.id), Math.ceil(n / fuelValue(f.id)), 64);
  }
  const took = a.inv.removeId(inputId, n);
  const tookFuel = fuelId ? a.inv.removeId(fuelId, fuelN) : 0;
  const inStack = safe(() => makeStack(inputId, took), undefined);
  const fuelStack = fuelId ? safe(() => makeStack(fuelId!, tookFuel), undefined) : undefined;
  const placed = safe(() => {
    cont.setItem(0, inStack);
    if (fuelStack) cont.setItem(1, fuelStack);
    return true;
  }, false);
  if (!placed) {
    a.inv.add({ id: inputId, n: took });
    if (fuelId) a.inv.add({ id: fuelId, n: tookFuel });
    return { got: 0, reason: "não consegui colocar os itens na fornalha" };
  }
  a.markDirty();
  say(a, `Coloquei ${took} ${prettyItem(inputId)} na fornalha. Vou esperar ficar pronto.`, { key: "cook", throttleMs: 5000 });
  const perItem = block!.typeId.includes("smoker") || block!.typeId.includes("blast") ? 100 : 200;
  const limit = took * perItem + 200;
  let waited = 0;
  let got = 0;
  a.setWorkAnim(AnimState.Cast);
  while (got < took && waited < limit) {
    yield { t: "wait", ticks: 20 };
    waited += 20;
    const out = safe(() => cont.getItem(2), undefined);
    if (out && out.amount > 0) {
      const left = a.inv.add({ id: out.typeId, n: out.amount });
      const moved = out.amount - left;
      if (moved > 0) {
        safe(() => cont.setItem(2, left > 0 ? makeStack(out.typeId, left) : undefined), undefined);
        got += moved;
        actionBar(a, `Cozinhando ${got}/${took}`);
      }
    }
  }
  // take back whatever is left (never leave items behind silently)
  const rest = safe(() => cont.getItem(0), undefined);
  if (rest && rest.typeId === inputId) {
    a.inv.add({ id: inputId, n: rest.amount });
    safe(() => cont.setItem(0, undefined), undefined);
  }
  const fuelRest = safe(() => cont.getItem(1), undefined);
  if (fuelRest && fuelId && fuelRest.typeId === fuelId) {
    a.inv.add({ id: fuelId, n: fuelRest.amount });
    safe(() => cont.setItem(1, undefined), undefined);
  }
  a.setWorkAnim(AnimState.Idle);
  a.markDirty();
  return got ? { got } : { got: 0, reason: "a fornalha não produziu nada a tempo" };
}

export function* cook(a: Agent, t: Task): R<Outcome> {
  step(a, t, "check_inventory");
  const r = t.goal.resource;
  const inputs = a.inv.slots.filter((s) => {
    if (!(s.id in COOK_RESULT)) return false;
    if (r === "iron" || r === "gold" || r === "copper") return s.id === `minecraft:raw_${r}`;
    if (r && r !== "food" && r !== "meat") return itemMatchesResource(s.id, r);
    return isFoodCookable(s.id);
  });
  if (!inputs.length) return { ok: false, reason: "não tenho nada cru para cozinhar/fundir" };
  const inputId = inputs[0].id;
  step(a, t, "find_station");
  const res = yield* smeltAt(a, inputId, t.goal.count ?? 64, true);
  step(a, t, "verify");
  if (!res.got) return { ok: false, reason: res.reason ?? "não consegui cozinhar" };
  const d = data(t);
  d.collected = res.got;
  const outId = COOK_RESULT[inputId];
  return yield* finish(a, t, (id) => id === outId, prettyItem(outId));
}

function makeStack(id: string, n: number): ItemStack {
  return new ItemStack(id, n);
}

// =============================================================================================
// BUILDING
// =============================================================================================
const ROLE_ORDER: Record<string, number> = {
  foundation: 0, floor: 1, main: 2, frame: 2, wall: 3, window: 4, ladder: 5, door_lower: 6, door_upper: 7, fence: 8, roof: 9, torch: 10, table: 10, chest: 10,
};

function haveCounts(a: Agent): Have {
  const c = (f: (id: string) => boolean) => a.inv.count(f);
  return {
    planks: c(isPlanksItem),
    log: c(isLogItem),
    cobblestone: c((id) => id === "minecraft:cobblestone" || id === "minecraft:cobbled_deepslate"),
    coal: c((id) => id === "minecraft:coal" || id === "minecraft:charcoal"),
    stick: c((id) => id === "minecraft:stick"),
    fence: c((id) => /_fence$/.test(id) && !id.includes("nether")),
    door: c((id) => id === "minecraft:wooden_door"),
    torch: c((id) => id === "minecraft:torch"),
    crafting_table: c((id) => id === "minecraft:crafting_table"),
    chest: c((id) => id === "minecraft:chest"),
    ladder: c((id) => id === "minecraft:ladder"),
  };
}

function mostOf(a: Agent, pred: (id: string) => boolean): string | undefined {
  const m = new Map<string, number>();
  for (const s of a.inv.slots) if (pred(s.id)) m.set(s.id, (m.get(s.id) ?? 0) + s.n);
  return [...m.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
}

function itemFor(a: Agent, mat: MatKey): string | undefined {
  switch (mat) {
    case "planks":
      return mostOf(a, isPlanksItem);
    case "log":
      return mostOf(a, isLogItem);
    case "cobblestone":
      return mostOf(a, (id) => id === "minecraft:cobblestone" || id === "minecraft:cobbled_deepslate");
    case "fence":
      return mostOf(a, (id) => /_fence$/.test(id) && !id.includes("nether"));
    case "door":
      return a.inv.countId("minecraft:wooden_door") ? "minecraft:wooden_door" : undefined;
    case "torch":
      return a.inv.countId("minecraft:torch") ? "minecraft:torch" : undefined;
    case "crafting_table":
      return a.inv.countId("minecraft:crafting_table") ? "minecraft:crafting_table" : undefined;
    case "chest":
      return a.inv.countId("minecraft:chest") ? "minecraft:chest" : undefined;
    case "ladder":
      return a.inv.countId("minecraft:ladder") ? "minecraft:ladder" : undefined;
  }
}

function satisfiedBy(typeId: string, mat: MatKey | null, role: string): boolean {
  if (mat === null) return /door/.test(typeId);
  switch (mat) {
    case "planks":
      return isPlanksItem(typeId);
    case "log":
      return isLogBlock(typeId) || /_wood$/.test(typeId);
    case "cobblestone":
      return /(cobblestone|cobbled_deepslate|stone_bricks)$/.test(typeId) || (role === "foundation" && typeId !== "minecraft:air");
    case "fence":
      return /_fence$/.test(typeId) || /glass/.test(typeId);
    case "door":
      return /door/.test(typeId);
    case "torch":
      return /torch/.test(typeId);
    case "crafting_table":
      return typeId === "minecraft:crafting_table";
    case "chest":
      return typeId === "minecraft:chest";
    case "ladder":
      return typeId === "minecraft:ladder";
  }
}

function permFor(itemId: string, role: string, facing: number): BlockPermutation | undefined {
  try {
    if (role === "torch") return BlockPermutation.resolve("minecraft:torch", { torch_facing_direction: "top" } as never);
    if (role === "ladder") return BlockPermutation.resolve("minecraft:ladder", { facing_direction: ladderFacing(facing) } as never);
    if (role === "door_lower" || role === "door_upper") {
      return BlockPermutation.resolve("minecraft:wooden_door", { direction: [3, 0, 1, 2][facing], upper_block_bit: role === "door_upper" } as never);
    }
    return BlockPermutation.resolve(itemId);
  } catch {
    return undefined; // block not available in this version: leave the spot open
  }
}

export function* build(a: Agent, t: Task): R<Outcome> {
  const d = data(t);
  const bp = makeBlueprint(t.goal.structure ?? "hut", t.goal.size);
  const origin = d.origin as Vec3 | undefined;
  const facing = (d.facing as number) ?? 0;
  if (!origin) return { ok: false, reason: "não sei onde construir" };
  const e0 = a.body();
  if (!e0) return { ok: false, reason: "corpo indisponível", retry: true };
  const dim = e0.dimension;
  const pref = (t.goal.material ?? "any") as MaterialKind;
  const fillOnly = bp.kind === "platform" || bp.kind === "bridge";
  const world = bp.placements.map((p) => {
    const r = rotate(p, facing);
    return { pos: { x: origin.x + r.x, y: origin.y + p.y, z: origin.z + r.z }, role: p.role, mat: roleMat(p.role, pref) };
  });
  world.sort((x, y) => x.pos.y - y.pos.y || (ROLE_ORDER[x.role] ?? 5) - (ROLE_ORDER[y.role] ?? 5));
  const isDone = (w: (typeof world)[number]) => {
    const b = getBlock(dim, w.pos);
    if (!b) return false;
    if (satisfiedBy(b.typeId, w.mat, w.role)) return true;
    return (fillOnly || w.role === "foundation") && !isPassableBlock(b) && !b.isLiquid;
  };

  // ---- 1. materials (gather what is missing first, alone or with helpers) ----------------
  step(a, t, "check_inventory");
  for (;;) {
    const todo = world.filter((w) => !isDone(w));
    if (!todo.length) break;
    const need = countNeeds(todo.map((w) => ({ x: 0, y: 0, z: 0, role: w.role })), pref);
    const sf = shortfall(need, haveCounts(a), !d.skipTorches);
    const missingCoalOnly = !sf.logs && !sf.cobblestone && sf.coal > 0;
    if (missingCoalOnly && ((d.matRound as number) ?? 0) >= 1) {
      d.skipTorches = true; // decoration without torches rather than failing the house
      continue;
    }
    if (!sf.logs && !sf.cobblestone && !sf.coal) break;
    step(a, t, "prepare_materials");
    const rounds = (d.matRound as number) ?? 0;
    const helpers = ((t.data.helpers as string[]) ?? []).map((k) => agents.get(k)).filter((h): h is Agent => !!h && h.record.active && !h.record.dead);
    if (d.waitingHelpers) {
      // helpers are bringing materials: wait while any of them is still working on it
      const busy = helpers.some((h) => h.record.queue.some((q) => q.data.deliverToAgent === a.key));
      if (busy && ((d.waited as number) ?? 0) < 20 * 60 * 15) {
        actionBar(a, "esperando materiais das ajudantes...");
        a.setWorkAnim(AnimState.Idle);
        yield { t: "wait", ticks: 60 };
        d.waited = ((d.waited as number) ?? 0) + 60;
        continue;
      }
      d.waitingHelpers = false;
    }
    if (rounds >= 3) {
      const parts = [sf.logs ? `${sf.logs} troncos` : "", sf.cobblestone ? `${sf.cobblestone} pedregulhos` : ""].filter(Boolean).join(" e ");
      return { ok: false, reason: `ainda faltam ${parts} para ${bp.label}. Me traga ou me leve a uma floresta/caverna.` };
    }
    d.matRound = rounds + 1;
    const want: Intent[] = [];
    if (sf.logs) want.push({ kind: "gather", resource: "wood", quantity: sf.logs + 2, priority: "normal", raw: "material" });
    if (sf.cobblestone) want.push({ kind: "mine", resource: "stone", quantity: sf.cobblestone + 2, priority: "normal", raw: "material" });
    if (sf.coal) want.push({ kind: "mine", resource: "coal", quantity: sf.coal, priority: "normal", raw: "material" });
    const tasks = plan(want).tasks;
    for (const x of tasks) x.deliver = false;
    const summary = [sf.logs ? `~${sf.logs} troncos` : "", sf.cobblestone ? `${sf.cobblestone} pedras` : "", sf.coal ? `${sf.coal} carvão` : ""].filter(Boolean).join(", ");
    if (helpers.length) {
      // split every material task between the builder and the helpers
      const crew = [a, ...helpers];
      const mine: Task[] = [];
      for (const x of tasks) {
        const total = x.goal.count ?? 1;
        const share = Math.ceil(total / crew.length);
        crew.forEach((m, i) => {
          const part: Task = JSON.parse(JSON.stringify(x));
          part.id = `${x.id}-h${i}`;
          part.goal.count = Math.min(share, Math.max(0, total - share * i));
          if (!part.goal.count) return;
          part.progress = { done: 0, total: part.goal.count };
          part.label = x.label.replace(/\d+/, String(part.goal.count)) + (m === a ? "" : ` para ${a.name}`);
          if (m === a) mine.push(part);
          else {
            part.data.deliverToAgent = a.key;
            m.record.queue.push(part);
            m.markDirty();
          }
        });
      }
      d.waitingHelpers = true;
      d.waited = 0;
      say(a, `Para ${bp.label} faltam ${summary}. ${helpers.map((h) => h.name).join(" e ")} vão me ajudar a buscar!`, { force: true });
      if (mine.length) return { ok: "defer", before: mine };
      continue;
    }
    return { ok: "defer", before: tasks, msg: `Para ${bp.label} faltam ${summary}. Vou buscar primeiro e depois construo!` };
  }

  // ---- 2. craft the parts --------------------------------------------------------------
  {
    const todo = world.filter((w) => !isDone(w));
    const need = countNeeds(todo.map((w) => ({ x: 0, y: 0, z: 0, role: w.role })), pref);
    const sf = shortfall(need, haveCounts(a), !d.skipTorches);
    // logs -> planks, keeping the logs the frame needs
    const have = haveCounts(a);
    const planksShort = Math.max(0, sf.planksTotal - have.planks);
    const spareLogs = Math.max(0, have.log - need.log);
    const convert = Math.min(spareLogs, Math.ceil(planksShort / 4));
    if (convert > 0) {
      const r = craft(findRecipe("planks")!, a.inv, convert);
      if (!r.ok) return { ok: false, reason: r.reason };
    }
    for (const [k, times] of [["fence", sf.crafts.fence], ["door", sf.crafts.door], ["torch", sf.crafts.torch], ["crafting_table", sf.crafts.crafting_table], ["chest", sf.crafts.chest], ["ladder", sf.crafts.ladder]] as [string, number][]) {
      if (times <= 0) continue;
      const r = yield* craftByKey(a, k, times, true);
      if (!r.ok && k !== "torch") say(a, `Não consegui fazer ${k}: ${r.reason}. Vou seguir sem.`, { key: "craft" + k, throttleMs: 30000 });
    }
  }

  // ---- 3. space: clear natural obstacles, refuse to destroy builds -------------------------
  step(a, t, "check_space");
  const clear: Vec3[] = [];
  let obstructed = 0;
  for (const w of world) {
    if (isDone(w)) continue;
    const b = getBlock(dim, w.pos);
    if (!b) return { ok: false, reason: "parte da área não está carregada" };
    if (isPassableBlock(b) || (fillOnly && b.isLiquid)) continue;
    if (NATURAL_DIG.has(b.typeId) || isLeafBlock(b.typeId)) clear.push(w.pos);
    else obstructed++;
  }
  if (obstructed > 0) return { ok: false, reason: `tem ${obstructed} blocos que não são naturais no lugar d${bp.label === "mansão" ? "a" : "a"} ${bp.label}. Escolha um lugar mais aberto.` };
  const owner = a.owner();
  if (owner && world.some((w) => Math.floor(owner.location.x) === w.pos.x && Math.floor(owner.location.z) === w.pos.z && Math.abs(owner.location.y - w.pos.y) < 2)) {
    say(a, "Sai um pouquinho do lugar da construção, por favor!", { key: "move", throttleMs: 8000 });
    yield { t: "wait", ticks: 60 };
  }
  if (clear.length) say(a, `Limpando ${clear.length} blocos de terreno antes de construir.`, { key: "clear", throttleMs: 20000 });
  for (const p of clear.sort((x, y) => y.y - x.y)) {
    const g = yield* goNear(a, p, 5, { shadowStep: true });
    if (g.ok) {
      yield* breakAt(a, p, { allowAny: true });
      yield* collectNear(a, p, 3, 4);
    }
  }

  // ---- 4. build layer by layer ---------------------------------------------------------
  step(a, t, "work");
  say(a, `Começando ${bp.label}! São ${world.length} blocos.`, { key: "buildstart", throttleMs: 10000 });
  const occupied = new Set<string>();
  for (const w of world) {
    occupied.add(`${w.pos.x},${w.pos.y},${w.pos.z}`);
    occupied.add(`${w.pos.x},${w.pos.y - 1},${w.pos.z}`); // never stand with the head inside a future block
  }
  let placed = 0;
  let unreachable = 0;
  let skipped = 0;
  for (const w of world) {
    if (isDone(w)) {
      placed++;
      continue;
    }
    if (w.role === "torch" && d.skipTorches && a.inv.countId("minecraft:torch") === 0) {
      skipped++;
      continue;
    }
    const itemId = w.mat ? itemFor(a, w.mat) : "minecraft:wooden_door";
    if (!itemId) {
      if (["torch", "table", "chest", "fence", "window", "door_lower", "door_upper", "ladder"].includes(w.role)) {
        skipped++; // decoration/parts we could not make: keep building
        continue;
      }
      return { ok: false, reason: `acabou o material (${w.mat}): coloquei ${placed}/${world.length} blocos` };
    }
    const perm = permFor(itemId, w.role, facing);
    if (!perm) {
      skipped++;
      continue;
    }
    const g = yield* goNear(a, w.pos, 5.5, { avoid: occupied, shadowStep: true });
    if (!g.ok) {
      unreachable++;
      continue;
    }
    const pl = yield* placeAt(a, w.pos, w.role === "door_upper" ? undefined : { id: itemId, n: 1 }, perm);
    if (pl.ok) {
      placed++;
      d.placed = placed;
      progress(a, t, placed, world.length, bp.label);
    } else unreachable++;
  }
  a.setWorkAnim(AnimState.Idle);
  a.record.stats.built += placed;
  step(a, t, "verify");
  const verified = world.filter(isDone).length;
  step(a, t, "confirm");
  const ratio = verified / world.length;
  if (ratio >= 0.97) {
    setMood(a.body(), Mood.Happy, 4000);
    a.setAnim(AnimState.Wave, 1500);
    return { ok: true, msg: `${bp.label[0].toUpperCase() + bp.label.slice(1)} pronta! ${verified} blocos${skipped ? ` (${skipped} detalhes de decoração ficaram de fora)` : ""}.` };
  }
  return { ok: false, reason: `${bp.label} ficou incompleta: ${verified}/${world.length} blocos (${unreachable} fora de alcance)`, retry: unreachable > 0 };
}

// =============================================================================================
// DESTROY
// =============================================================================================
export function* destroy(a: Agent, t: Task): R<Outcome> {
  const positions = (t.data.positions as Vec3[]) ?? [];
  if (!positions.length) return { ok: false, reason: "não sei qual bloco quebrar (olhe para ele e repita)" };
  const area = t.goal.target?.kind === "area";
  let broken = (t.data.broken as number) ?? 0;
  let skipped = 0;
  const e0 = a.body();
  if (!e0) return { ok: false, reason: "corpo indisponível", retry: true };
  // top-down so she never digs under her own feet first
  const order = [...positions].sort((x, y) => y.y - x.y);
  for (const p of order) {
    const b = getBlock(e0.dimension, p);
    if (!b || b.isAir || b.isLiquid) continue;
    if (area && !NATURAL_DIG.has(b.typeId) && !oreInfo(b.typeId)) {
      skipped++;
      continue; // never grief builds when digging an area
    }
    step(a, t, "goto_target");
    const g = yield* goNear(a, p, TUNING.reach);
    if (!g.ok) {
      skipped++;
      continue;
    }
    step(a, t, "harvest");
    const br = yield* breakAt(a, p);
    if (!br.ok) {
      if (!area) return { ok: false, reason: br.reason ?? "não consegui quebrar" };
      skipped++;
      continue;
    }
    broken++;
    t.data.broken = broken;
    progress(a, t, broken, positions.length, "Blocos");
    step(a, t, "collect");
    const c = yield* collectNear(a, p, 3);
    if (c.full) {
      const f = yield* handleFull(a, t, () => true);
      if (f) return f;
    }
  }
  step(a, t, "confirm");
  if (!broken) return { ok: false, reason: skipped ? "não havia nada que eu pudesse quebrar ali" : "o bloco já não estava lá" };
  return { ok: true, msg: `Quebrei ${broken} bloco(s)${skipped ? ` (pulei ${skipped} que não são naturais ou estavam fora de alcance)` : ""}. Os itens estão comigo.` };
}

// =============================================================================================
// DELIVER / EAT / EQUIP / RETURN
// =============================================================================================
export function deliverPredicate(t: Task): (s: StoredItem) => boolean {
  const g = t.goal;
  if (g.all) return () => true;
  if (g.resource) return (s) => itemMatchesResource(s.id, g.resource!);
  if (g.item) {
    const k = g.item;
    if (k === "planks") return (s) => isPlanksItem(s.id);
    return (s) => s.id.endsWith(k) || s.id.includes(k);
  }
  return () => true;
}

export function* deliver(a: Agent, t: Task): R<Outcome> {
  step(a, t, "check_inventory");
  const pred = deliverPredicate(t);
  // equipped item requested? ("me dá o machado")
  if (t.goal.item && !t.goal.all) {
    for (const slot of ["mainhand", "offhand", "head", "chest", "legs", "feet"] as const) {
      const s = a.record.equipment[slot];
      if (s && pred(s) && a.inv.count((id) => id === s.id) === 0) unequip(a, slot);
    }
  }
  const have = a.inv.count((id) => pred({ id, n: 1 }));
  if (!have) {
    if (t.goal.resource && ["wood", "food", "stone", "coal", "iron"].includes(t.goal.resource)) {
      const n = t.goal.count ?? 16;
      say(a, `Não tenho ${RESOURCE_PT[t.goal.resource]} agora. Vou buscar ${n}!`);
      const kind = t.goal.resource === "wood" || t.goal.resource === "food" ? "gather" : "mine";
      const p = plan([{ kind, resource: t.goal.resource, quantity: n, priority: "normal", raw: "auto", deliver: true }]);
      return { ok: true, followUp: p.tasks };
    }
    return { ok: false, reason: "não tenho isso comigo" };
  }
  const r = yield* returnAndDeliver(a, pred, t.goal.count ?? Infinity);
  if (!r.ok) return { ok: false, reason: r.reason ?? "não consegui entregar", retry: true };
  step(a, t, "confirm");
  return { ok: true, msg: r.n ? `Aqui está: ${r.text}.` : "Não tinha nada para entregar." };
}
export function* eatTask(a: Agent, t: Task): R<Outcome> {
  step(a, t, "check_inventory");
  if (a.record.needs.hunger >= TUNING.maxHunger) return { ok: true, msg: "Estou satisfeita, obrigada!" };
  const choice = chooseFood(a.inv.slots, { ...a.record.needs, hunger: Math.min(a.record.needs.hunger, TUNING.hungerStarving) }, 0);
  if (!choice) return { ok: false, reason: "não tenho comida comestível" };
  step(a, t, "work");
  const ok = yield* eatNow(a, choice.id);
  if (!ok) return { ok: false, reason: "não consegui comer" };
  return { ok: true, msg: `Comi ${prettyItem(choice.id)}. Fome: ${Math.round(a.record.needs.hunger)}/20.` };
}

/** Real consumption from the logical inventory + animation. */
export function* eatNow(a: Agent, id: string): R<boolean> {
  const e = a.body();
  if (!e) return false;
  a.mover.stop();
  a.setWorkAnim(AnimState.Eat);
  setMood(e, Mood.Happy, 1800);
  for (let i = 0; i < 4; i++) {
    sound(e.dimension, "random.eat", e.location, 0.6, 0.9 + Math.random() * 0.3);
    yield { t: "wait", ticks: 8 };
  }
  if (a.inv.removeId(id, 1) < 1) {
    a.setWorkAnim(AnimState.Idle);
    return false;
  }
  const f = FOODS[id];
  a.record.needs = eat(a.record.needs, { id, food: f.food, sat: f.sat });
  sound(e.dimension, "random.burp", e.location, 0.5, 1);
  a.setWorkAnim(AnimState.Idle);
  a.markDirty();
  return true;
}
export function* equipTask(a: Agent, t: Task): R<Outcome> {
  step(a, t, "work");
  const item = t.goal.item;
  if (item === "armor") {
    const ch = equipBestArmor(a);
    return ch.length ? { ok: true, msg: `Vesti: ${ch.map(prettyItem).join(", ")}.` } : { ok: false, reason: "não tenho armadura melhor na mochila" };
  }
  if (!item) return { ok: false, reason: "equipar o quê?" };
  const kind = item as "axe";
  if (t.goal.tier) {
    const wanted = `minecraft:${t.goal.tier}_${item}`;
    const s = a.inv.slots.find((x) => x.id === wanted);
    if (!s) return { ok: false, reason: `não tenho ${prettyItem(wanted)}` };
  }
  const got = equipBestTool(a, kind);
  return got ? { ok: true, msg: `Equipei ${prettyItem(got)}.` } : { ok: false, reason: `não tenho ${item} na mochila` };
}

export function* returnTask(a: Agent, t: Task): R<Outcome> {
  step(a, t, "return");
  const r = yield* returnToOwner(a);
  step(a, t, "confirm");
  return r.ok ? { ok: true, msg: "Cheguei!" } : { ok: false, reason: r.reason ?? "não consegui voltar" };
}

export const RUNNERS: Record<Task["kind"], (a: Agent, t: Task) => R<Outcome>> = {
  gather_wood: gatherWood,
  gather_food: gatherFood,
  mine,
  hunt,
  farm,
  craft: craftTask,
  cook,
  build,
  destroy,
  deliver,
  eat: eatTask,
  attack,
  equip: equipTask,
  return: returnTask,
};

export function ownerLookFacing(owner: Player): { origin: Vec3; facing: number } {
  const rot = owner.getRotation().y;
  const y = ((rot % 360) + 360) % 360;
  const facing = y >= 315 || y < 45 ? 0 : y < 135 ? 1 : y < 225 ? 2 : 3;
  const fwd = [{ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }, { x: 1, z: 0 }][facing];
  const l = owner.location;
  return { origin: { x: Math.floor(l.x) + fwd.x * 3, y: Math.floor(l.y), z: Math.floor(l.z) + fwd.z * 3 }, facing };
}

export { yawTo };
