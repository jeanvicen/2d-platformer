// Testes unitários das bibliotecas puras (rodam em Node: `node --test tools/tests/`).
import test from "node:test";
import assert from "node:assert/strict";
import { parseRequest } from "../../ECLIPSE_BP/scripts/lib/lyra_parser.js";
import { parseAmount, normalize, similar } from "../../ECLIPSE_BP/scripts/lib/text.js";
import { CATALOG, searchCatalog, NOT_FOUND } from "../../ECLIPSE_BP/scripts/lib/forge_catalog.js";
import { astar, simplify } from "../../ECLIPSE_BP/scripts/lib/pathfinding.js";
import { BLUEPRINTS, buildOrder, footprint } from "../../ECLIPSE_BP/scripts/lib/blueprints.js";
import { requirements, resolveBlock, substitute, dominantWood } from "../../ECLIPSE_BP/scripts/lib/recipes.js";
import { defaultProfile, migrate, SCHEMA } from "../../ECLIPSE_BP/scripts/lib/profile_schema.js";
import { rotateLocal, cardinal, yawDir, directionName } from "../../ECLIPSE_BP/scripts/core/util.js";

test("normalização PT-BR remove acentos e pontuação", () => {
  assert.equal(normalize("Constrói uma Mansão, AQUI!"), "constroi uma mansao aqui");
});

test("quantidades por extenso e em pilhas", () => {
  assert.equal(parseAmount("pega 32 madeiras"), 32);
  assert.equal(parseAmount("pega vinte e cinco troncos"), 25);
  assert.equal(parseAmount("me traz 2 pilhas de pedra"), 128);
  assert.equal(parseAmount("uma duzia de ovos"), 12);
  assert.equal(parseAmount("faz uma casa"), null); // "uma" aqui é artigo
  assert.equal(parseAmount("pega muita madeira"), 64);
});

test("tolerância a erro de digitação", () => {
  assert.ok(similar("madera", "madeira"));
  assert.ok(similar("mansao", "manssao"));
  assert.ok(!similar("pa", "pe"));
});

test("Lyra entende pedidos compostos", () => {
  const r = parseRequest("faz uma mansão aqui e depois pega comida");
  assert.deepEqual(r.tasks.map((t) => t.type), ["build", "food"]);
  assert.equal(r.tasks[0].blueprint, "mansao");
  assert.equal(r.tasks[0].where, "here");
});

test("Lyra: coleta, minérios, controle e conversa", () => {
  const cases = [
    ["pega 32 madeiras", { type: "gather", resource: "log", amount: 32 }],
    ["corta umas árvores", { type: "gather", resource: "log" }],
    ["pega 64 pedras", { type: "gather", resource: "cobblestone", amount: 64 }],
    ["busca 5 diamantes", { type: "ore", ore: "diamond", amount: 5 }],
    ["vai caçar comida", { type: "food" }],
    ["constrói uma torre ali", { type: "build", blueprint: "torre", where: "look" }],
    ["faz uma casinha", { type: "build", blueprint: "cabana" }],
    ["faz um castelo aqui", { type: "build", blueprint: "mansao" }],
    ["explora bem longe", { type: "explore", radius: 160 }],
    ["me protege", { type: "guard" }],
    ["espera aqui", { type: "stay" }],
    ["me segue", { type: "follow" }],
    ["para", { type: "stop" }],
    ["o que você tem?", { type: "inventory" }],
    ["me dá tudo", { type: "dump" }],
    ["me dá a madeira", { type: "give", resource: "log" }],
  ];
  for (const [text, expect] of cases) {
    const r = parseRequest(text);
    assert.ok(r.tasks.length >= 1, `sem tarefa: ${text}`);
    for (const [k, v] of Object.entries(expect)) assert.equal(r.tasks[0][k], v, `${text} → ${k}`);
  }
  assert.equal(parseRequest("oi").reply, "greet");
  assert.equal(parseRequest("valeu").reply, "thanks");
  assert.equal(parseRequest("blablabla xyz").unknown, true);
  // "para mim" não é comando de parar
  assert.equal(parseRequest("pega madeira para mim").tasks[0].type, "gather");
});

test("Forja: nomes e sinônimos do pedido original", () => {
  const map = { martelo: "eclipse_hammer", "martelo do eclipse": "eclipse_hammer", hammer: "eclipse_hammer", machado: "eclipse_axe",
    espada: "shadow_sword", asas: "wings_shadow", voar: "wings_shadow", lobo: "c_umbra", "cão sombrio": "c_umbra",
    ponte: "k_bridge", plataforma: "k_platform", "asas de anjo": "wings_celestial", dragao: "c_nox", lyra: "c_lyra" };
  for (const [q, id] of Object.entries(map)) assert.equal(searchCatalog(q)[0]?.id, id, q);
  assert.equal(searchCatalog("geladeira nuclear").length, 0);
  assert.match(NOT_FOUND, /Ainda não existe essa criação no catálogo/);
  assert.ok(new Set(CATALOG.map((e) => e.id)).size === CATALOG.length, "ids únicos");
});

function grid(map) {
  // mapa 2D (z linhas, x colunas): "#" parede, "." chão livre; chão sólido em y=0
  const rows = map.trim().split("\n");
  return (x, y, z) => {
    if (y <= 0) return 1;
    if (y >= 3) return 0;
    const row = rows[z];
    if (!row || x < 0 || x >= row.length) return 1;
    return row[x] === "#" ? 1 : 0;
  };
}

function runAstar(start, goal, solid, reach = 0.5) {
  const g = astar(start, goal, { solid, budget: 50, reach });
  let r;
  do r = g.next();
  while (!r.done);
  return r.value;
}

test("A* contorna paredes e chega ao destino", () => {
  const solid = grid(`
..........
..######..
.......#..
.......#..
..........`);
  const path = runAstar({ x: 0, y: 1, z: 2 }, { x: 9, y: 1, z: 2 }, solid);
  assert.ok(path && path.length > 5);
  const last = path[path.length - 1];
  assert.ok(Math.abs(last.x - 9) <= 1 && Math.abs(last.z - 2) <= 1);
  for (const p of path) assert.equal(solid(p.x, p.y, p.z), 0, "nunca dentro da parede");
  assert.ok(simplify(path).length <= path.length);
});

test("A* sobe degraus de 1 bloco", () => {
  const solid = (x, y, z) => (y <= 0 ? 1 : x >= 5 && y === 1 ? 1 : 0);
  const path = runAstar({ x: 0, y: 1, z: 0 }, { x: 8, y: 2, z: 0 }, solid);
  assert.ok(path.some((p) => p.y === 2));
});

test("plantas: tamanhos, ordem de construção e porta", () => {
  for (const [k, bp] of Object.entries(BLUEPRINTS)) {
    const b = bp.build();
    assert.ok(b.length > 20, k);
    const keys = new Set(b.map((x) => `${x.x},${x.y},${x.z}`));
    assert.equal(keys.size, b.length, `${k}: sem duplicatas`);
    const ord = buildOrder(b);
    // fundação antes do telhado
    const firstY = ord.find((x) => x.m !== "air").y;
    assert.ok(firstY <= Math.min(...b.map((x) => x.y)) + 1, k);
  }
  const m = BLUEPRINTS.mansao.build();
  assert.ok(m.length > 1500, "mansão é grande");
  assert.ok(m.some((x) => x.m === "door_lower") && m.some((x) => x.m === "door_upper"));
  const fp = footprint(m);
  assert.ok(fp.x1 - fp.x0 >= 20 && fp.z1 - fp.z0 >= 14);
});

test("economia de materiais (como um jogador fabricaria)", () => {
  const r = requirements([{ m: "planks" }, { m: "planks" }, { m: "planks" }, { m: "planks" }, { m: "chest" }, { m: "glass" }, { m: "cobble" }]);
  assert.deepEqual(r, { log: 3, cobblestone: 1, sand: 1 });
  assert.equal(resolveBlock("door_lower", "oak"), "minecraft:wooden_door");
  assert.equal(resolveBlock("door_lower", "spruce"), "minecraft:spruce_door");
  assert.equal(resolveBlock("planks", "cherry"), "minecraft:cherry_planks");
  assert.equal(substitute([{ m: "glass" }], { sand: true })[0].m, "fence");
  assert.equal(dominantWood({ "minecraft:birch_log": 10, "minecraft:oak_log": 3 }), "birch");
});

test("perfil: padrão, migração v1→v3 e dados corrompidos", () => {
  const d = defaultProfile();
  assert.equal(d.v, SCHEMA);
  const old = migrate({ race: "god", xp: 500, companions: ["abc"] });
  assert.equal(old.mode, "god");
  assert.equal(old.modes.god.xp, 500);
  assert.equal(old.companions[0].uid, "abc");
  const bad = migrate({ v: 3, mode: "hacker", core: 7, modes: { eclipse: { xp: "x" } }, thrown: [1, 2], quests: null });
  assert.equal(bad.mode, "eclipse");
  assert.equal(bad.core, "dormant");
  assert.equal(bad.modes.eclipse.xp, 0);
  assert.deepEqual(bad.thrown, {});
  assert.deepEqual(migrate("lixo"), defaultProfile());
});

test("rotação de plantas segue a direção do olhar", () => {
  assert.equal(cardinal(yawDir(0)), 0); // olhando para o sul (+z)
  assert.equal(cardinal(yawDir(90)), 1); // oeste
  assert.equal(cardinal(yawDir(180)), 2); // norte
  assert.equal(cardinal(yawDir(-90)), 3); // leste
  // "frente" local (+z) sempre aponta para onde o jogador olha
  assert.deepEqual(rotateLocal({ x: 0, y: 0, z: 1 }, 0), { x: -0, y: 0, z: 1 });
  assert.deepEqual(rotateLocal({ x: 0, y: 0, z: 1 }, 2), { x: 0, y: 0, z: -1 });
  assert.deepEqual(rotateLocal({ x: 0, y: 0, z: 1 }, 3), { x: 1, y: 0, z: 0 });
  assert.deepEqual(rotateLocal({ x: 0, y: 0, z: 1 }, 1), { x: -1, y: 0, z: -0 });
  assert.equal(directionName({ x: 0, z: 0 }, { x: 0, z: -10 }), "norte");
  assert.equal(directionName({ x: 0, z: 0 }, { x: 10, z: 0 }), "leste");
});
