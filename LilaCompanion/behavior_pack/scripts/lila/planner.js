// TaskPlanner: encadeamento para trás (estilo GOAP) sobre o livro de receitas.
// obtain(item, n) descobre sozinho o que falta: "picareta de ferro" → 3 barras de ferro → fundir
// ferro bruto (fornalha, combustível) → minerar ferro (picareta de pedra) → pedregulho
// (picareta de madeira) → tábuas e gravetos → troncos → cortar árvores. Sem atalhos, sem trapaça.
import { ORES, ORE_DEPTH, ORE_ITEM, ORE_TIER, TIER_RANK, isLog, ptName, toolId, toolInfo } from "../lib/items.js";
import { recipesFor, representative } from "../lib/recipes.js";
import { GoalError, NeedTool } from "./companion.js";
import * as inv from "./inventory.js";
import { craft, fuelUnits, needTarget, planksFor, smelt } from "./crafting.js";
import { applesFromLeaves, chopTrees, digFor, exploreStep, fillBucket, harvestNearby, mineFor, seedsFromGrass } from "./resource.js";
import { canAttack, fight, huntFor, shearSheep } from "./combat.js";
import { findBlocks } from "./world.js";
import { say } from "./talk.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {string | {id?:string, group?:string, toolKind?:string, tier?:string, ore?:string}} Target */

const MAX_DEPTH = 12;

const DIG = {
  "minecraft:dirt": [["minecraft:dirt", "minecraft:grass_block", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:dirt_with_roots"], "terra"],
  "minecraft:sand": [["minecraft:sand"], "areia"],
  "minecraft:red_sand": [["minecraft:red_sand"], "areia vermelha"],
  "minecraft:gravel": [["minecraft:gravel"], "cascalho"],
  "minecraft:clay_ball": [["minecraft:clay"], "argila"],
  "minecraft:snowball": [["minecraft:snow", "minecraft:snow_layer"], "neve"],
  "minecraft:flint": [["minecraft:gravel"], "cascalho (para sílex)"],
  "minecraft:pumpkin": [["minecraft:pumpkin"], "abóboras"],
  "minecraft:melon_slice": [["minecraft:melon_block"], "melancias"],
  "minecraft:sugar_cane": [["minecraft:sugar_cane"], "cana-de-açúcar"],
  "minecraft:obsidian": [["minecraft:obsidian"], "obsidiana"],
  "minecraft:ice": [["minecraft:ice"], "gelo"],
};

const ORE_BY_ITEM = Object.fromEntries(Object.entries(ORE_ITEM).map(([ore, item]) => [item, ore]));

const HUNT = {
  "minecraft:beef": ["minecraft:cow"], "minecraft:leather": ["minecraft:cow"], "minecraft:porkchop": ["minecraft:pig"],
  "minecraft:mutton": ["minecraft:sheep"], "minecraft:chicken": ["minecraft:chicken"], "minecraft:feather": ["minecraft:chicken"],
  "minecraft:rabbit": ["minecraft:rabbit"], "minecraft:string": ["minecraft:spider", "minecraft:cave_spider"],
  "minecraft:bone": ["minecraft:skeleton", "minecraft:stray"], "minecraft:gunpowder": ["minecraft:creeper"],
  "minecraft:egg": [], "minecraft:cod": [], "minecraft:salmon": [],
};

function normTarget(t) {
  return typeof t === "string" ? { id: t } : t;
}

export function targetLabel(t) {
  const n = normTarget(t);
  if (n.toolKind) return { pickaxe: "picareta", axe: "machado", shovel: "pá", hoe: "enxada", sword: "espada" }[n.toolKind];
  if (n.group) return ptName(n.group);
  return ptName(n.id);
}

/**
 * Consegue `count` unidades do alvo por qualquer caminho possível.
 * @param {Companion} c
 * @param {Target} target
 * @param {number} count quantidade total desejada no inventário
 * @param {{depth?:number, cmd?:boolean}} o
 */
export function* obtain(c, target, count, o = {}) {
  const t = normTarget(target);
  const depth = o.depth ?? 0;
  if (depth > MAX_DEPTH) throw new GoalError("essa cadeia de fabricação ficou longa demais");
  if (t.toolKind) return yield* ensureTool(c, t.toolKind, t.tier ?? "wooden", o);
  if (inv.count(c, t.id ?? t) >= count) return true;
  let toolRetries = 0;
  for (;;) {
    yield 1;
    try {
      yield* strategy(c, t, count, { ...o, depth: depth + 1 });
      if (inv.count(c, t.id ?? t) >= count) return true;
      // a estratégia rendeu menos do que o esperado (drops aleatórios): tenta de novo
      if (++toolRetries > 6) throw new GoalError(`não consegui juntar ${targetLabel(t)} suficiente`);
    } catch (e) {
      if (e instanceof NeedTool && toolRetries++ < 4) {
        say(c, `Preciso de uma ${ptName(toolId(e.kind, e.tier === "none" ? "wooden" : e.tier))} primeiro. Vou fazer uma!`, { chatter: true });
        yield* ensureTool(c, e.kind, e.tier === "none" ? "wooden" : e.tier, { ...o, depth: depth + 1 });
        continue;
      }
      throw e;
    }
  }
}

/** Garante uma ferramenta de pelo menos esse nível. */
export function* ensureTool(c, kind, minTier, o = {}) {
  const cur = inv.toolTier(c, kind);
  if (TIER_RANK[cur] >= TIER_RANK[minTier]) return true;
  return yield* obtain(c, toolId(kind, minTier), 1, o);
}

/** Melhor ferramenta que dá para fazer agora (para a progressão autônoma). */
export function nextToolTier(c) {
  const s = inv.summary(c);
  if ((s["minecraft:diamond"] ?? 0) >= 3) return "diamond";
  if ((s["minecraft:iron_ingot"] ?? 0) + (s["minecraft:raw_iron"] ?? 0) >= 3) return "iron";
  return "stone";
}

function* strategy(c, t, count, o) {
  const id = t.id;
  const group = t.group;
  // ------------------------------------------------ grupos
  if (group === "log" || (id && isLog(id))) return yield* chopTrees(c, count);
  if (group === "planks") return yield* viaRecipe(c, planksFor(c), count, o);
  if (group === "food") return yield* obtainFood(c, count, o);
  if (group === "coal") {
    const visibleCoal = yield* tryMine(c, "coal", count, o, true);
    if (visibleCoal) return;
    return yield* viaSmelt(c, "minecraft:charcoal", count, o);
  }
  if (group === "stone_material") return yield* obtain(c, "minecraft:cobblestone", count, o);
  if (group === "sapling") {
    yield* applesFromLeaves(c, 0, 30);
    return;
  }
  if (group === "wool") return yield* shearSheep(c, count, !!o.cmd || c.rec.settings.hunt);
  if (group === "seeds") return yield* seedsFromGrass(c, count);
  if (group) throw new GoalError(`não sei conseguir ${targetLabel(t)}`);
  if (!id) throw new GoalError("alvo inválido");

  // ------------------------------------------------ itens específicos
  const ore = ORE_BY_ITEM[id];
  if (ore) return yield* tryMine(c, ore, count, o, false);
  if (id === "minecraft:cobblestone") {
    return yield* mineFor(c, { types: ["minecraft:stone"], item: id, want: count, depth: Math.floor(c.pos().y) - 6, tier: "wooden", label: "pedra" });
  }
  if (id === "minecraft:cobbled_deepslate") {
    return yield* mineFor(c, { types: ["minecraft:deepslate", "minecraft:cobbled_deepslate"], item: id, want: count, depth: -4, tier: "wooden", label: "ardósia" });
  }
  if (DIG[id]) {
    const [types, label] = DIG[id];
    return yield* digFor(c, types, id, count, label);
  }
  if (id === "minecraft:wheat_seeds") return yield* seedsFromGrass(c, count);
  if (id === "minecraft:apple") return yield* applesFromLeaves(c, count);
  if (["minecraft:wheat", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot", "minecraft:sweet_berries"].includes(id)) {
    if (yield* harvestNearby(c, id, count, 40)) return;
    throw new GoalError(`não tem ${ptName(id)} madura por perto — posso fazer uma plantação`);
  }
  if (id === "minecraft:water_bucket") {
    if (inv.count(c, "minecraft:bucket") < 1) yield* obtain(c, "minecraft:bucket", 1, o);
    if (!(yield* fillBucket(c))) throw new GoalError("não achei água por perto");
    return;
  }
  if (HUNT[id]) return yield* huntFor(c, id, HUNT[id], count, !!o.cmd || c.rec.settings.hunt);
  const rs = recipesFor(id);
  if (rs.length) {
    const r = rs.find((x) => !x.smelt);
    if (r) return yield* viaRecipe(c, id, count, o);
    return yield* viaSmelt(c, id, count, o);
  }
  throw new GoalError(`ainda não sei como conseguir ${ptName(id)}`);
}

/** Minera um minério (respeitando o nível de picareta e a profundidade certa). */
function* tryMine(c, ore, count, o, onlyVisible) {
  const item = ore === "coal" ? { group: "coal" } : ORE_ITEM[ore];
  const tier = ORE_TIER[ore];
  if (TIER_RANK[inv.toolTier(c, "pickaxe")] < TIER_RANK[tier]) yield* ensureTool(c, "pickaxe", tier, o);
  if (onlyVisible) {
    try {
      // carvão: tenta só o que estiver à vista/perto; se não houver, usa carvão vegetal
      yield* mineFor(c, { types: ORES[ore], item, want: count, tier, label: "carvão" });
      return true;
    } catch (e) {
      if (e instanceof NeedTool) throw e;
      return false;
    }
  }
  say(c, `Vou atrás de ${ptName(ORE_ITEM[ore])}.`, { chatter: true });
  return yield* mineFor(c, { types: ORES[ore], item, want: count, depth: ORE_DEPTH[ore], tier, label: ptName(ORE_ITEM[ore]) });
}

/** Fabrica pela receita, obtendo antes cada ingrediente que faltar. */
export function* viaRecipe(c, id, count, o) {
  const rs = recipesFor(id).filter((r) => !r.smelt);
  if (!rs.length) throw new GoalError(`não conheço receita de ${ptName(id)}`);
  const r = rs[0];
  const missing = count - inv.count(c, id);
  if (missing <= 0) return;
  const times = Math.ceil(missing / r.n);
  // bancada/fornalha primeiro: fabricá-las depois gastaria ingredientes já separados
  if (r.table && inv.count(c, "minecraft:crafting_table") < 1 && !nearbyBlock(c, "minecraft:crafting_table", 12)) {
    yield* obtain(c, "minecraft:crafting_table", 1, o);
  }
  // repete até TODOS os ingredientes estarem presentes ao mesmo tempo (fazer gravetos gasta tábuas, etc.)
  for (let round = 0; round < 8; round++) {
    let complete = true;
    for (const need of r.needs) {
      const tgt = needTarget(need);
      const total = need.n * times;
      if (inv.count(c, tgt) >= total) continue;
      complete = false;
      if (need.group === "planks") {
        const planksNeeded = total - inv.count(c, { group: "planks" });
        const logsNeeded = Math.ceil(planksNeeded / 4);
        if (inv.count(c, { group: "log" }) < logsNeeded) yield* obtain(c, { group: "log" }, logsNeeded, o);
        yield* craft(c, planksFor(c), inv.count(c, planksFor(c)) + planksNeeded);
        continue;
      }
      if (need.group?.startsWith("log:")) {
        yield* obtain(c, { group: "log" }, total, o);
        continue;
      }
      yield* obtain(c, need.id ? need.id : { group: need.group }, total, o);
    }
    if (complete) break;
  }
  yield* craft(c, id, count);
}

/** Funde: garante o material de entrada, combustível e fornalha (8 pedregulhos). */
export function* viaSmelt(c, id, count, o) {
  const r = recipesFor(id).find((x) => x.smelt);
  if (!r) throw new GoalError(`não sei fundir ${ptName(id)}`);
  const missing = count - inv.count(c, id);
  if (missing <= 0) return;
  // fornalha antes do material (fundir pedregulho gastaria o da fornalha)
  if (inv.count(c, "minecraft:furnace") < 1 && !c.mem.nearest("furnace", c.pos(), c.dim().id, 32) && !nearbyBlock(c, "minecraft:furnace", 10)) {
    yield* obtain(c, "minecraft:furnace", 1, o);
  }
  const input = r.needs[0];
  const inTarget = input.id ? input.id : { group: input.group };
  if (inv.count(c, inTarget) < missing) yield* obtain(c, inTarget, missing, o);
  // combustível: ~1 unidade por item (carvão = 8)
  if (fuelUnits(c) < missing + (input.group === "log" ? missing * 1.5 : 0)) {
    const extraLogs = Math.ceil(missing / 1.5) + 1;
    if (inv.count(c, { group: "coal" }) * 8 < missing) yield* obtain(c, { group: "log" }, inv.count(c, { group: "log" }) + extraLogs + (input.group === "log" ? missing : 0), o);
  }
  say(c, `Fundindo ${missing} ${ptName(id)} na fornalha...`, { chatter: true });
  yield* smelt(c, id, input, missing);
}

/** Animais de comida por perto (para caçar rápido, sem sair explorando à toa). */
function nearbyFoodAnimals(c, r = 36) {
  try {
    return c.dim().getEntities({ location: c.pos(), maxDistance: r })
      .filter((e) => FOOD_MOBS[e.typeId] && canAttack(c, e, true))
      .sort((a, b) => dist2(a.location, c.pos()) - dist2(b.location, c.pos()));
  } catch {
    return [];
  }
}
const FOOD_MOBS = { "minecraft:cow": "minecraft:beef", "minecraft:pig": "minecraft:porkchop", "minecraft:sheep": "minecraft:mutton",
  "minecraft:chicken": "minecraft:chicken", "minecraft:rabbit": "minecraft:rabbit" };
const MOB_PT = { "minecraft:cow": "uma vaca", "minecraft:pig": "um porco", "minecraft:sheep": "uma ovelha", "minecraft:chicken": "uma galinha", "minecraft:rabbit": "um coelho" };
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

/**
 * Comida, do jeito mais rápido e visível: maduro/frutas perto → pão com o trigo → caçar os
 * animais que estão perto (pedido direto ou caça ligada) → assar se der → maçãs só em folhas
 * bem perto → explorar procurando animais/plantas. Para quando tiver `count` itens.
 * @param {number} count número total de itens de comida desejado
 * @param {{cmd?:boolean, quick?:boolean}} o quick: aceita o que conseguir rápido (entrega parcial)
 */
export function* obtainFood(c, count, o = {}) {
  const food = { group: "food" };
  const have = () => inv.count(c, food);
  const enough = () => have() >= count;
  if (enough()) return;
  const allowHunt = !!o.cmd || c.rec.settings.hunt;
  const talk = (m) => say(c, m, { force: !!o.cmd });
  for (let round = 0; round < 4 && !enough(); round++) {
    yield 1;
    // 1) plantas maduras e frutinhas por perto
    const before = have();
    yield* harvestNearby(c, food, count, 24);
    if (have() > before) talk("Colhi umas coisas maduras aqui perto.");
    if (enough()) return;
    // 2) pão com o trigo que ela tiver
    const wheat = inv.count(c, "minecraft:wheat");
    if (wheat >= 3) {
      yield* craft(c, "minecraft:bread", inv.count(c, "minecraft:bread") + Math.floor(wheat / 3));
      if (enough()) return;
    }
    // 3) caça os animais que estão perto (sem sair explorando ainda)
    if (allowHunt) {
      let hunted = 0;
      for (let k = 0; k < 6 && !enough(); k++) {
        const target = nearbyFoodAnimals(c)[0];
        if (!target) break;
        if (hunted === 0) talk(`Vi ${MOB_PT[target.typeId] ?? "um bicho"} ali, vou caçar pra gente.`);
        if (yield* fight(c, target, 300)) hunted++;
      }
      // 4) assa o que for cru se já tiver fornalha/pedra (senão entrega cru mesmo, rápido)
      if (hunted && (inv.count(c, "minecraft:furnace") > 0 || inv.count(c, { group: "stone_material" }) >= 8 || c.mem.nearest("furnace", c.pos(), c.dim().id, 24))) {
        for (const raw of Object.values(FOOD_MOBS)) {
          const n = inv.count(c, raw);
          if (!n) continue;
          try {
            talk("Vou assar a carne rapidinho.");
            yield* viaSmelt(c, raw.replace("minecraft:", "minecraft:cooked_"), inv.count(c, raw.replace("minecraft:", "minecraft:cooked_")) + n, o);
          } catch {
            /* sem combustível agora: vai crua mesmo */
          }
        }
      }
      if (enough() || (o.quick && have() > 0)) return;
    }
    if (o.quick && have() > 0) return;
    // 5) maçãs só em folhas bem pertinho
    yield* applesFromLeaves(c, Math.min(count, inv.count(c, "minecraft:apple") + 1), 10);
    if (enough() || (o.quick && have() > 0)) return;
    // 6) nada por perto: explora procurando animais e plantações
    talk(allowHunt ? "Não tem comida aqui perto, vou procurar animais mais longe." : "Não achei nada maduro aqui. Vou procurar mais longe.");
    yield* exploreStep(c, "comida");
  }
  if (have() > 0) return;
  throw new GoalError(allowHunt ? "procurei bastante e não achei comida nem animais por perto" : "não achei comida madura. Posso caçar se você ligar \"caça\" nas configurações, ou fazer uma plantação", "food");
}

function nearbyBlock(c, id, r) {
  try {
    return findBlocks(c.dim(), c.pos(), [id], { r, dy: 5, max: 1 }).length > 0;
  } catch {
    return false;
  }
}

/** Lista de compras -> obtém tudo na ordem mais barata (madeira primeiro, depois pedra...). */
export function* obtainAll(c, list, o = {}) {
  const order = Object.entries(list).sort(([a], [b]) => rank(a) - rank(b));
  for (const [id, n] of order) {
    yield* obtain(c, id, n, o);
  }
}

function rank(id) {
  if (/log|planks|stick|slab|fence|door|table|chest/.test(id)) return 0;
  if (/cobble|stone/.test(id)) return 1;
  if (/torch/.test(id)) return 2;
  if (/glass/.test(id)) return 3;
  return 4;
}

export { toolInfo, representative };
