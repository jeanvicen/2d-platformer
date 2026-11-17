import { test } from "node:test";
import assert from "node:assert/strict";
import { LogicalInventory } from "../scripts/inventory/logical_inventory";
import { craft, findRecipe } from "../scripts/crafting/recipes";
import { makeBlueprint, countRoles, rotate, yawToFacing } from "../scripts/building/blueprints";
import { chooseFood, eat, exert, freshNeeds } from "../scripts/survival/needs";
import { findPath, runSync, type WorldProbe } from "../scripts/navigation/astar";
import { validateExternalPlan } from "../scripts/ai/plan_schema";
import { breakTicks, oreInfo, itemMatchesResource } from "../scripts/inventory/item_catalog";

const MAX = (id: string) => (/(pickaxe|axe|sword|shovel|hoe)$/.test(id) ? 1 : id.endsWith("ender_pearl") ? 16 : 64);
const inv = (slots: any[] = [], cap = 27) => new LogicalInventory(slots, cap, MAX);

test("inventário: empilha, respeita capacidade e devolve o que não coube", () => {
  const i = inv([], 2);
  assert.equal(i.add({ id: "minecraft:oak_log", n: 100 }), 0);
  assert.equal(i.slots.length, 2);
  assert.equal(i.add({ id: "minecraft:oak_log", n: 40 }), 12, "sobram 12 (128 cabe)");
  assert.equal(i.countId("minecraft:oak_log"), 128);
  assert.equal(i.add({ id: "minecraft:stone_axe", n: 1 }), 1, "sem slot livre");
});

test("inventário: ferramentas com durabilidade não se fundem", () => {
  const i = inv();
  i.add({ id: "minecraft:stone_axe", n: 1, dmg: 10 });
  i.add({ id: "minecraft:stone_axe", n: 1 });
  assert.equal(i.slots.length, 2);
});

test("inventário: consumo atômico não perde itens", () => {
  const i = inv([{ id: "minecraft:oak_planks", n: 3 }, { id: "minecraft:stick", n: 1 }]);
  const before = JSON.stringify(i.slots);
  const r = i.consumeAll([
    { match: (x) => x === "minecraft:oak_planks", n: 3 },
    { match: (x) => x === "minecraft:stick", n: 2 },
  ]);
  assert.equal(r, undefined);
  assert.equal(JSON.stringify(i.slots), before, "rollback total");
});

test("receitas: tronco -> tábuas -> gravetos -> picareta de madeira", () => {
  const i = inv([{ id: "minecraft:birch_log", n: 3 }]);
  assert.deepEqual(craft(findRecipe("planks")!, i, 3), { ok: true, id: "minecraft:birch_planks", n: 12 });
  assert.equal(craft(findRecipe("stick")!, i, 1).ok, true);
  const r = craft(findRecipe("wooden_pickaxe")!, i, 1);
  assert.deepEqual(r, { ok: true, id: "minecraft:wooden_pickaxe", n: 1 });
  assert.equal(i.countId("minecraft:birch_planks"), 12 - 2 - 3);
  assert.equal(i.countId("minecraft:stick"), 2);
  const fail = craft(findRecipe("iron_pickaxe")!, i, 1);
  assert.equal(fail.ok, false);
});

test("receitas: pão a partir de trigo", () => {
  const i = inv([{ id: "minecraft:wheat", n: 7 }]);
  assert.deepEqual(craft(findRecipe("bread")!, i, 2), { ok: true, id: "minecraft:bread", n: 2 });
  assert.equal(i.countId("minecraft:wheat"), 1);
});

test("plantas: casinha tem porta e telhado, rotação correta", () => {
  const bp = makeBlueprint("hut");
  const c = countRoles(bp);
  assert.equal(c.main, 16 * 3 - 2 - 2 + 25);
  assert.equal(yawToFacing(0), 0);
  assert.equal(yawToFacing(90), 1);
  assert.equal(yawToFacing(-90), 3);
  assert.deepEqual(rotate({ x: 1, z: 2 }, 2), { x: 1, z: -2 });
  const t = makeBlueprint("tower");
  assert.ok(countRoles(t).ladder > 0);
});

test("fome: come pão sozinha, guarda reserva e evita comida arriscada", () => {
  let n = freshNeeds();
  for (let k = 0; k < 200; k++) n = exert(n, 0.5);
  assert.ok(n.hunger < 20);
  const hungry = { hunger: 10, saturation: 0, exhaustion: 0 };
  const choice = chooseFood([{ id: "minecraft:bread", n: 5 }, { id: "minecraft:rotten_flesh", n: 3 }], hungry, 2);
  assert.equal(choice?.id, "minecraft:bread");
  assert.equal(eat(hungry, choice!).hunger, 15);
  assert.equal(chooseFood([{ id: "minecraft:bread", n: 2 }], hungry, 2), undefined, "não come a reserva");
  assert.equal(chooseFood([{ id: "minecraft:bread", n: 1 }], { hunger: 3, saturation: 0, exhaustion: 0 }, 2)?.id, "minecraft:bread", "faminta come a reserva");
  assert.equal(chooseFood([{ id: "minecraft:golden_apple", n: 4 }], { hunger: 2, saturation: 0, exhaustion: 0 }, 0), undefined, "nunca come item raro");
});

function grid(walls: Set<string>, floorY = 0): WorldProbe {
  return {
    passable: (x, y, z) => y > floorY && !walls.has(`${x},${y},${z}`),
    solid: (x, y, z) => y <= floorY || walls.has(`${x},${y},${z}`),
    danger: () => false,
    loaded: (x) => Math.abs(x) < 100,
  };
}

test("A*: contorna parede e sobe degrau", () => {
  const walls = new Set<string>();
  for (let z = -5; z <= 5; z++) for (let y = 1; y <= 3; y++) walls.add(`3,${y},${z}`);
  walls.add("6,1,0"); // a step
  const w = grid(walls);
  const r = runSync(findPath(w, { x: 0, y: 1, z: 0 }, { maxNodes: 4000, maxRadius: 20, target: { x: 6, y: 2, z: 0 }, isGoal: (c) => c.x === 6 && c.z === 0 }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.path[r.path.length - 1].y, 2, "subiu no degrau");
    assert.ok(r.path.every((p) => !walls.has(`${p.x},${p.y},${p.z}`)));
  }
});

test("A*: falha honesta quando cercado", () => {
  const walls = new Set<string>();
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) for (let y = 1; y <= 4; y++) if (Math.abs(x) === 2 || Math.abs(z) === 2) walls.add(`${x},${y},${z}`);
  const r = runSync(findPath(grid(walls), { x: 0, y: 1, z: 0 }, { maxNodes: 2000, maxRadius: 20, target: { x: 10, y: 1, z: 0 }, isGoal: (c) => c.x === 10 }));
  assert.equal(r.ok, false);
});

test("A*: não entra em chunk descarregado", () => {
  const r = runSync(findPath(grid(new Set()), { x: 90, y: 1, z: 0 }, { maxNodes: 3000, maxRadius: 30, target: { x: 110, y: 1, z: 0 }, isGoal: (c) => c.x === 110 }));
  assert.equal(r.ok, false);
});

test("IA externa: só aceita intenções da lista fechada", () => {
  const ok = validateExternalPlan(JSON.stringify({ reply: "§kOk!", intents: [{ kind: "gather", resource: "wood", quantity: 9999 }, { kind: "eval", code: "x" }, { kind: "set_owner", owner: "B" }] }));
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.plan.intents.length, 1);
    assert.equal(ok.plan.intents[0].quantity, 256);
    assert.equal(ok.plan.reply, "Ok!");
  }
  assert.equal(validateExternalPlan("not json").ok, false);
});

test("catálogo: minérios, tempo de quebra e ferramentas", () => {
  assert.equal(oreInfo("minecraft:deepslate_iron_ore")?.resource, "iron");
  assert.ok(breakTicks("minecraft:oak_log", "minecraft:iron_axe") < breakTicks("minecraft:oak_log", undefined));
  assert.ok(itemMatchesResource("minecraft:raw_iron", "iron"));
  assert.ok(itemMatchesResource("minecraft:spruce_log", "wood"));
});
