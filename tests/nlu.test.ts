import { test } from "node:test";
import assert from "node:assert/strict";
import { interpret } from "../scripts/nlu/interpreter";
import { normalize } from "../scripts/nlu/normalize";
import { plan } from "../scripts/planner/planner";

const kinds = (t: string) => interpret(t).intents.map((i) => i.kind);

test("normalização: acentos e números por extenso", () => {
  assert.equal(normalize("Pegue VINTE E CINCO troncos!"), "pegue 25 troncos");
  assert.equal(normalize("uma dúzia de pães"), "12 de paes");
  assert.equal(normalize("me dá um pack de pedra"), "me da 64 de pedra");
  assert.equal(normalize("construa uma casa"), "construa uma casa");
});

test("frases diferentes para madeira viram o mesmo pedido (seção 5)", () => {
  for (const f of ["Preciso de madeira.", "Vai buscar madeira.", "Consegue pegar alguns troncos?", "Arruma material para construção."]) {
    const r = interpret(f);
    assert.equal(r.intents.length, 1, f);
    assert.equal(r.intents[0].kind, "gather", f);
    assert.equal(r.intents[0].resource, "wood", f);
  }
});

test("pedido combinado: madeira, comida e depois volte", () => {
  const r = interpret("Pegue madeira, consiga comida e depois volte.");
  assert.deepEqual(r.intents.map((i) => [i.kind, i.resource]), [["gather", "wood"], ["gather", "food"], ["return", undefined]]);
});

test("quantidade e retorno: 'Pegue 32 troncos e volte'", () => {
  const r = interpret("Pegue 32 troncos e volte");
  assert.equal(r.intents[0].quantity, 32);
  const p = plan(r.intents);
  assert.equal(p.tasks.length, 1, "volta já está incluída na tarefa (retorna e entrega)");
  assert.equal(p.tasks[0].kind, "gather_wood");
  assert.equal(p.tasks[0].goal.count, 32);
  assert.ok(p.tasks[0].steps.includes("deliver"));
});

test("modos e controle", () => {
  assert.deepEqual(kinds("Me proteja."), ["protect"]);
  assert.deepEqual(kinds("vem comigo"), ["follow"]);
  assert.deepEqual(kinds("fica aqui"), ["stay"]);
  assert.deepEqual(kinds("fique de guarda aqui"), ["guard"]);
  assert.deepEqual(kinds("Volte imediatamente."), ["return"]);
  assert.equal(interpret("Volte imediatamente.").intents[0].priority, "high");
  assert.deepEqual(kinds("cancela isso"), ["cancel"]);
  assert.deepEqual(kinds("para"), ["cancel"]);
  assert.deepEqual(kinds("pausa"), ["pause"]);
  assert.deepEqual(kinds("pode continuar"), ["resume"]);
});

test("perguntas de estado (seção 15)", () => {
  assert.deepEqual(kinds("Você conseguiu?"), ["progress"]);
  assert.deepEqual(kinds("Por que parou?"), ["why"]);
  assert.deepEqual(kinds("o que você tem na mochila?"), ["inventory"]);
  assert.deepEqual(kinds("como você está?"), ["status"]);
});

test("ambiguidade importante gera pergunta, não chute", () => {
  const r = interpret("pegue");
  assert.equal(r.intents.length, 0);
  assert.ok(r.clarification);
  const b = interpret("construa algo");
  assert.ok(b.clarification);
  const a = interpret("ataque");
  assert.ok(a.clarification);
});

test("construção, fabricação, mineração, entrega", () => {
  const b = interpret("construa uma casinha de pedra");
  assert.equal(b.intents[0].kind, "build");
  assert.equal(b.intents[0].structure, "hut");
  assert.equal(b.intents[0].material, "cobblestone");
  const c = interpret("faça uma picareta de pedra");
  assert.equal(c.intents[0].kind, "craft");
  assert.equal(c.intents[0].item, "pickaxe");
  assert.equal(c.intents[0].tier, "stone");
  const m = interpret("minere 10 de ferro");
  assert.equal(m.intents[0].kind, "mine");
  assert.equal(m.intents[0].resource, "iron");
  assert.equal(m.intents[0].quantity, 10);
  const d = interpret("me dá tudo");
  assert.equal(d.intents[0].kind, "deliver");
  assert.equal(d.intents[0].all, true);
  const e = interpret("me entrega a madeira");
  assert.equal(e.intents[0].kind, "deliver");
  assert.equal(e.intents[0].resource, "wood");
  const q = interpret("quebre esse bloco");
  assert.equal(q.intents[0].kind, "destroy");
  const h = interpret("cave um buraco");
  assert.equal(h.intents[0].kind, "destroy");
  assert.equal(h.intents[0].target?.kind, "area");
});

test("combate e caça exigem ordem explícita para passivos", () => {
  const a = interpret("mate aquele zumbi");
  assert.equal(a.intents[0].kind, "attack");
  assert.deepEqual(a.intents[0].target, { kind: "mob", mob: "minecraft:zombie" });
  const h = interpret("cace umas vacas");
  assert.equal(h.intents[0].kind, "hunt");
  assert.equal(h.intents[0].allowHunting, true);
  const f = interpret("consiga comida");
  assert.notEqual(f.intents[0].allowHunting, true, "comida genérica não autoriza caça sozinha");
});

test("comer e frases de conversa", () => {
  assert.deepEqual(kinds("come alguma coisa"), ["eat"]);
  assert.deepEqual(kinds("pegue algo pra comer"), ["gather"]);
  assert.deepEqual(kinds("obrigado"), ["thanks"]);
  assert.deepEqual(kinds("oi luna"), ["greet"]);
  assert.deepEqual(kinds("blablabla xyz"), ["unknown"]);
});

test("'depois...' adiciona à fila em vez de substituir", () => {
  assert.equal(interpret("depois minere carvão").append, true);
  assert.equal(interpret("minere carvão").append, false);
});
