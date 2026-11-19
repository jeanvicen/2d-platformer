// Testes unitários das partes puras (rodam em Node, sem o jogo): node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { astar, simplify, AIR, SOLID, WATER, DANGER, DOOR } from "../behavior_pack/scripts/lib/pathfinding.js";
import { parseCommands, parseOne } from "../behavior_pack/scripts/lib/intent.js";
import { parseAmount } from "../behavior_pack/scripts/lib/text.js";
import { RECIPES, recipesFor, rawCost, shoppingList, matchesNeed } from "../behavior_pack/scripts/lib/recipes.js";
import { breakTicks, canHarvest, classifyId, isNatural, requiredTier, toolFor, toolInfo, isLog } from "../behavior_pack/scripts/lib/items.js";
import { BLUEPRINTS } from "../behavior_pack/scripts/lib/blueprints.js";

/** Mundo falso: chão sólido em y=0, ar acima, com blocos extras. */
function world(extra = {}) {
  return (x, y, z) => {
    const k = `${x},${y},${z}`;
    if (k in extra) return extra[k];
    return y <= 0 ? SOLID : AIR;
  };
}

function run(gen) {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

test("A*: linha reta em terreno plano", () => {
  const r = run(astar({ x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, { cell: world() }));
  assert.ok(r.complete);
  assert.equal(r.path.at(-1).x >= 9, true);
});

test("A*: contorna um muro", () => {
  const extra = {};
  for (let z = -5; z <= 5; z++) for (const y of [1, 2, 3]) extra[`5,${y},${z}`] = SOLID;
  const r = run(astar({ x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, { cell: world(extra), maxNodes: 5000 }));
  assert.ok(r.complete);
  assert.ok(r.path.every((p) => !(p.x === 5 && Math.abs(p.z) <= 5)));
});

test("A*: sobe degraus de 1 bloco, não de 2", () => {
  const step = { "3,1,0": SOLID };
  const r = run(astar({ x: 0, y: 1, z: 0 }, { x: 3.5, y: 2, z: 0.5 }, { cell: world(step), reach: 0.6, yTol: 0 }));
  assert.ok(r.complete);
  const wall = {};
  for (let z = -40; z <= 40; z++) {
    wall[`3,1,${z}`] = SOLID;
    wall[`3,2,${z}`] = SOLID;
  }
  const r2 = run(astar({ x: 0, y: 1, z: 0 }, { x: 6, y: 1, z: 0 }, { cell: world(wall), maxNodes: 1500 }));
  assert.equal(r2.complete, false);
});

test("A*: nunca pisa em lava", () => {
  const extra = {};
  for (let x = 2; x <= 4; x++) for (let z = -1; z <= 1; z++) extra[`${x},0,${z}`] = DANGER;
  const r = run(astar({ x: 0, y: 1, z: 0 }, { x: 7, y: 1, z: 0 }, { cell: world(extra), maxNodes: 4000 }));
  assert.ok(r.complete);
  assert.ok(r.path.every((p) => extra[`${p.x},0,${p.z}`] !== DANGER));
});

test("A*: atravessa porta e nada na água", () => {
  const extra = { "3,1,0": DOOR, "3,2,0": DOOR };
  for (let z = -6; z <= 6; z++) if (z !== 0) for (const y of [1, 2, 3]) extra[`3,${y},${z}`] = SOLID;
  const r = run(astar({ x: 0, y: 1, z: 0 }, { x: 6, y: 1, z: 0 }, { cell: world(extra), maxNodes: 4000 }));
  assert.ok(r.complete);
  const pool = {};
  for (let x = 2; x <= 5; x++) for (let z = -8; z <= 8; z++) {
    pool[`${x},0,${z}`] = WATER;
    pool[`${x},1,${z}`] = WATER;
  }
  const r2 = run(astar({ x: 0, y: 1, z: 0 }, { x: 8, y: 1, z: 0 }, { cell: world(pool), maxNodes: 6000 }));
  assert.ok(r2.complete);
});

test("A*: alvo inalcançável devolve caminho parcial", () => {
  const extra = {};
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z) for (const y of [1, 2, 3, 4]) extra[`${x + 20},${y},${z}`] = SOLID;
  const r = run(astar({ x: 0, y: 1, z: 0 }, { x: 20, y: 1, z: 0 }, { cell: world(extra), maxNodes: 3000, reach: 0.5 }));
  assert.equal(r.complete, false);
  assert.ok(r.path && r.path.length > 5);
});

test("simplify remove pontos colineares", () => {
  const p = [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }, { x: 3, y: 1, z: 1 }];
  assert.equal(simplify(p).length, 3);
});

test("quantidades em português", () => {
  assert.equal(parseAmount("pega 20 madeira"), 20);
  assert.equal(parseAmount("vinte e cinco carvão"), 25);
  assert.equal(parseAmount("uma dúzia de pães"), 12);
  assert.equal(parseAmount("2 pilhas de pedra"), 128);
  assert.equal(parseAmount("faz uma casa"), null);
});

test("intenções: frases do dia a dia", () => {
  const cases = {
    "pega 20 madeira": "gather", "me segue": "follow", "fica aqui": "stay", "vem aqui": "come",
    "constrói uma mansão aqui": "build", "minera ferro": "gather", "faz uma picareta de ferro": "craft",
    "me dá tudo": "give", "estou com fome": "food", "planta trigo": "farm", "procura diamante": "gather",
    "explora": "explore", "para": "stop", "continua": "resume", "dorme": "sleep", "acorda": "wake",
    "me protege": "protect", "caça uns animais": "hunt", "coloca tochas": "torches", "aqui é a base": "sethome",
    "vai pra casa": "home", "tchau lila": "dismiss", "status": "status", "o que você tem": "inventory",
    "modo livre": "auto", "corta árvore": "gather", "pega madeira para mim": "gather", "faz pão": "craft",
    "obrigado": "thanks", "xyzzy": "unknown", "faz uma fazenda de cenoura": "farm",
  };
  for (const [s, t] of Object.entries(cases)) assert.equal(parseOne(s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())?.type, t, s);
});

test("intenções encadeadas", () => {
  const r = parseCommands("pega 20 madeira e depois faz uma casa aqui");
  assert.deepEqual(r.map((x) => x.type), ["gather", "build"]);
  assert.equal(r[0].count, 20);
  assert.equal(r[1].here, true);
  const r2 = parseCommands("faz um baú e guarda as coisas");
  assert.deepEqual(r2.map((x) => x.type), ["craft", "deposit"]);
});

test("receitas: custos reais", () => {
  const pick = recipesFor("minecraft:iron_pickaxe")[0];
  assert.deepEqual(pick.needs.map((n) => [n.id ?? n.group, n.n]), [["minecraft:iron_ingot", 3], ["minecraft:stick", 2]]);
  assert.ok(recipesFor("minecraft:iron_ingot")[0].smelt);
  assert.ok(recipesFor("minecraft:chest")[0].table);
  assert.equal(recipesFor("minecraft:crafting_table")[0].table, false);
  const raw = rawCost("minecraft:wooden_pickaxe", 1);
  assert.ok(raw["minecraft:oak_log"] >= 1);
  assert.ok(matchesNeed({ group: "planks", n: 1 }, "minecraft:spruce_planks"));
  assert.ok(!matchesNeed({ group: "planks", n: 1 }, "minecraft:stone"));
  assert.ok(RECIPES.length > 80);
});

test("ferramentas, nível e tempo de quebra", () => {
  assert.equal(toolFor("minecraft:oak_log"), "axe");
  assert.equal(toolFor("minecraft:iron_ore"), "pickaxe");
  assert.equal(toolFor("minecraft:dirt"), "shovel");
  assert.equal(requiredTier("minecraft:diamond_ore"), "iron");
  assert.ok(!canHarvest("minecraft:iron_ore", { kind: "pickaxe", tier: "wooden" }));
  assert.ok(canHarvest("minecraft:iron_ore", { kind: "pickaxe", tier: "stone" }));
  assert.ok(breakTicks("minecraft:stone", { kind: "pickaxe", tier: "iron" }) < breakTicks("minecraft:stone", { kind: "pickaxe", tier: "wooden" }));
  assert.deepEqual(toolInfo("minecraft:diamond_sword"), { tier: "diamond", kind: "sword" });
  assert.ok(isLog("minecraft:cherry_log") && !isLog("minecraft:cherry_planks"));
});

test("segurança: só blocos naturais", () => {
  for (const id of ["minecraft:stone", "minecraft:oak_log", "minecraft:iron_ore", "minecraft:grass_block", "minecraft:oak_leaves"]) assert.ok(isNatural(id), id);
  for (const id of ["minecraft:oak_planks", "minecraft:cobblestone", "minecraft:chest", "minecraft:glass", "minecraft:stone_bricks", "minecraft:bed"]) assert.ok(!isNatural(id), id);
  assert.equal(classifyId("minecraft:lava"), DANGER);
  assert.equal(classifyId("minecraft:short_grass"), AIR);
  assert.equal(classifyId("minecraft:oak_fence"), 4);
  assert.equal(classifyId("minecraft:wooden_door"), DOOR);
  assert.equal(classifyId("minecraft:water"), WATER);
});

test("plantas: todas geram blocos e lista de compras", () => {
  for (const [k, bp] of Object.entries(BLUEPRINTS)) {
    const blocks = bp.build();
    assert.ok(blocks.length > 50, k);
    const list = shoppingList(blocks, "oak");
    assert.ok(Object.keys(list).length > 0, k);
  }
  const list = shoppingList(BLUEPRINTS.cabana.build(), "spruce");
  assert.ok(list["minecraft:spruce_planks"] > 100);
});
