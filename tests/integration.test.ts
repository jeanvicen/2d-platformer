/**
 * End-to-end test of the real brain against the simulator in tests/mock.
 * Mirrors the mandatory tests of the master prompt (section 18) that can be simulated.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as mc from "./mock/minecraft-server";
import * as ui from "./mock/minecraft-server-ui";
import "../scripts/main";
import { agents } from "../scripts/ai/agent_manager";
import { DP_AGENT_PREFIX } from "../scripts/core/constants";

const cmds: Record<string, (origin: unknown, ...a: unknown[]) => unknown> = {};
mc.system.beforeEvents.startup.fire({
  customCommandRegistry: {
    registerCommand: (def: { name: string }, cb: (o: unknown, ...a: unknown[]) => unknown) => (cmds[def.name] = cb),
    registerEnum: () => undefined,
  },
});
const run = (p: mc.Player, text: string) => {
  cmds["shadowbound:sombra"]({ sourceEntity: p }, ...text.split(" "));
  mc.__advance(2);
};
const until = (pred: () => boolean, max: number) => {
  for (let i = 0; i < max; i++) {
    if (pred()) return true;
    mc.__advance(1);
  }
  return pred();
};
const bodies = () => mc.__entities().filter((e) => e.typeId === "shadowbound:companion" && e.isValid);
const dim = mc.world.getDimension("minecraft:overworld") as unknown as mc.Dimension;

const A = mc.__addPlayer("Jogador A", { x: 0.5, y: 64, z: 0.5 });
const B = mc.__addPlayer("Jogador B", { x: -6.5, y: 64, z: 0.5 });
mc.world.afterEvents.playerSpawn.fire({ player: A, initialSpawn: true });
mc.world.afterEvents.playerSpawn.fire({ player: B, initialSpawn: true });
mc.__advance(80);

test("recebe o Invocador das Sombras ao entrar", () => {
  assert.equal(A.inventory.count("shadowbound:shadow_summoner"), 1);
});

test("1-3) invocar, vínculo ao dono, impedir segunda invocação", () => {
  run(A, "invocar luna");
  mc.__advance(40);
  assert.equal(bodies().length, 1);
  const b = bodies()[0];
  assert.equal(b.dyn["sb:owner"], A.id, "dono gravado pelo id persistente");
  assert.equal(b.tamedTo, A.id, "domada pelo dono (seguir nativo)");
  run(A, "invocar raven");
  mc.__advance(10);
  assert.equal(bodies().length, 1, "continua uma só sombra");
});

test("4) outro jogador é ignorado e não acessa a sombra", () => {
  const before = A.messages.length;
  run(B, "pegue madeira");
  assert.equal(agents.get(A.id)!.record.queue.length, 0, "ordem de B não chega na sombra de A");
  assert.ok(B.messages.some((m) => m.includes("não tem uma sombra")));
  const ev = { player: B, target: bodies()[0], cancel: false };
  mc.world.beforeEvents.playerInteractWithEntity.fire(ev);
  mc.__advance(2);
  assert.equal(ev.cancel, true);
  assert.ok(B.actionbars.some((m) => m.includes("Acesso negado")));
  assert.ok(!ui.shown.some((s) => s.title.includes("Luna")), "nenhum menu aberto para B");
  assert.equal(A.messages.length, before, "nada vazou para A");
});

test("5) seguir: modo nativo follow ativo", () => {
  run(A, "me siga");
  mc.__advance(20);
  assert.ok(bodies()[0].events.includes("shadowbound:mode_follow"));
  assert.equal(agents.get(A.id)!.record.mode, "follow");
});

test("7/11) coleta madeira DE VERDADE, volta e entrega", () => {
  // a natural tree: 4 logs on grass with leaves around the top
  for (let y = 64; y <= 67; y++) dim.set(4, y, 3, "minecraft:oak_log");
  for (let x = 2; x <= 6; x++) for (let z = 1; z <= 5; z++) for (let y = 66; y <= 68; y++) if (!(x === 4 && z === 3 && y <= 67)) dim.set(x, y, z, "minecraft:oak_leaves");
  run(A, "pegue 4 troncos e volte");
  const a = agents.get(A.id)!;
  assert.equal(a.record.queue[0]?.kind, "gather_wood");
  const ok = until(() => A.inventory.count("minecraft:oak_log") >= 4, 20 * 150);
  assert.ok(ok, `entregou troncos (tem ${A.inventory.count("minecraft:oak_log")}); erros: ${mc.errors.slice(0, 2).join(" | ")}`);
  for (let y = 64; y <= 67; y++) assert.equal(dim.rec(4, y, 3).id, "minecraft:air", "tronco realmente quebrado");
  mc.__advance(40);
  assert.equal(a.record.queue.length, 0, "tarefa concluída e removida");
  assert.ok(A.messages.some((m) => m.includes("Aqui está")), "confirmou só depois de entregar");
  assert.equal(a.record.history[0]?.startsWith("✔"), true);
});

test("9) come pão sozinha quando está com fome (e o dono pode dar itens)", () => {
  const a = agents.get(A.id)!;
  A.inventory.setItem(0, new mc.ItemStack("minecraft:bread", 5));
  A.selectedSlotIndex = 0;
  A.isSneaking = true;
  mc.world.beforeEvents.playerInteractWithEntity.fire({ player: A, target: bodies()[0], cancel: false });
  mc.__advance(2);
  A.isSneaking = false;
  assert.equal(a.inv.countId("minecraft:bread"), 5, "recebeu 5 pães");
  assert.equal(A.inventory.getItem(0), undefined, "saíram da mão do dono (sem duplicar)");
  a.record.needs.hunger = 8;
  const ate = until(() => a.inv.countId("minecraft:bread") === 4, 400);
  assert.ok(ate, "comeu 1 pão");
  assert.ok(a.record.needs.hunger >= 13, `fome recuperada (${a.record.needs.hunger})`);
  mc.__advance(200);
  assert.equal(a.inv.countId("minecraft:bread"), 4, "não come tudo de uma vez");
});

test("12) cancelar e substituir tarefas", () => {
  const a = agents.get(A.id)!;
  run(A, "pegue 32 troncos");
  assert.equal(a.record.queue.length, 1);
  run(A, "cancela");
  assert.equal(a.record.queue.length, 0);
  assert.ok(A.messages.some((m) => /Cancelando|parei/i.test(m)));
  run(A, "minere 5 de pedra");
  run(A, "pegue 10 troncos");
  assert.equal(a.record.queue.length, 1);
  assert.equal(a.record.queue[0].kind, "gather_wood", "nova ordem substitui a anterior");
  run(A, "depois construa uma casinha");
  assert.equal(a.record.queue.length, 2, "'depois' adiciona na fila");
  run(A, "fica aqui");
  assert.equal(a.record.queue.length, 0, "modo novo substitui o trabalho");
  assert.equal(a.record.mode, "stay");
  run(A, "me siga");
});

test("perguntas: status, inventário, por que parou", () => {
  run(A, "o que você tem?");
  assert.ok(A.messages.some((m) => m.includes("pão")));
  run(A, "por que parou?");
  run(A, "status");
  assert.ok(A.messages.some((m) => m.includes("Fome:")));
  run(A, "blablabla xyz");
  assert.ok(A.messages.some((m) => m.includes("não entendi") || m.includes("Não entendi")));
});

test("15) persistência: registro salvo no mundo", () => {
  const a = agents.get(A.id)!;
  a.save();
  const raw = mc.__worldDyn()[DP_AGENT_PREFIX + A.id];
  const rec = JSON.parse(raw);
  assert.equal(rec.ownerId, A.id);
  assert.equal(rec.inventory.find((s: { id: string }) => s.id === "minecraft:bread")?.n, 4);
});

test("14) morre e ressuscita sem duplicar itens nem corpos", () => {
  const a = agents.get(A.id)!;
  const before = JSON.stringify(a.inv.summary());
  const genBefore = a.record.gen;
  const body = bodies()[0];
  body.applyDamage(9999, {});
  mc.__advance(5);
  assert.equal(a.record.dead, true);
  assert.equal(bodies().length, 0);
  const dropped = mc.__entities().filter((e) => e.typeId === "minecraft:item" && e.isValid && e.dimension === dim && Math.hypot(e.location.x - body.location.x, e.location.z - body.location.z) < 3);
  assert.equal(dropped.length, 0, "nada caiu no chão");
  mc.__skipClock(a.record.settings.respawnSeconds * 1000 + 1000);
  const back = until(() => bodies().length === 1, 200);
  assert.ok(back, "voltou");
  assert.equal(a.record.dead, false);
  assert.equal(a.record.gen, genBefore + 1);
  assert.equal(JSON.stringify(a.inv.summary()), before, "inventário idêntico");
  assert.ok(A.messages.some((m) => /Voltei|Ressurgi|Recomposta|Pronto, recomposta/.test(m)));
});

test("construção: casinha de madeira com materiais reais", () => {
  const a = agents.get(A.id)!;
  a.inv.add({ id: "minecraft:oak_planks", n: 72 });
  // owner faces +z; build area 3 blocks ahead is flat and free
  A.teleport({ x: 0.5, y: 64, z: -10.5 });
  mc.__advance(5);
  run(A, "construa uma casinha de madeira");
  const done = until(() => a.record.queue.length === 0, 20 * 400);
  assert.ok(done, `terminou; erros: ${mc.errors.slice(0, 2).join(" | ")}; última: ${A.messages.slice(-2).join(" / ")}`);
  let placed = 0;
  for (let x = -5; x <= 5; x++) for (let y = 64; y <= 68; y++) for (let z = -10; z <= 0; z++) if (dim.rec(x, y, z).id === "minecraft:oak_planks") placed++;
  assert.equal(placed, 69, `blocos colocados: ${placed}`);
  assert.equal(a.inv.countId("minecraft:oak_planks"), 3, "consumiu exatamente 69 tábuas");
  assert.ok(A.messages.some((m) => m.includes("pronta")));
});

test("13) falha honesta e recuperação: sem árvores, explica o motivo", () => {
  const a = agents.get(A.id)!;
  A.teleport({ x: 120.5, y: 64, z: 120.5 });
  bodies()[0].teleport({ x: 121.5, y: 64, z: 120.5 });
  mc.__advance(5);
  run(A, "pegue 5 troncos");
  until(() => a.record.queue.length === 0, 20 * 60);
  assert.equal(a.record.queue.length, 0);
  assert.ok(A.messages.some((m) => m.includes("não encontrei árvores")), A.messages.slice(-3).join(" / "));
  run(A, "por que parou?");
  assert.ok(A.messages[A.messages.length - 1].includes("Motivo"));
});

test("8) obtém comida DE VERDADE: colhe trigo maduro, replanta e faz pão na bancada", () => {
  const a = agents.get(A.id)!;
  A.teleport({ x: 60.5, y: 64, z: 60.5 });
  bodies()[0].teleport({ x: 61.5, y: 64, z: 60.5 });
  for (let x = 63; x <= 65; x++) for (let z = 62; z <= 64; z++) {
    dim.set(x, 63, z, "minecraft:farmland");
    dim.set(x, 64, z, "minecraft:wheat", { growth: 7 });
  }
  dim.set(58, 64, 60, "minecraft:crafting_table");
  mc.__advance(5);
  const breadBefore = A.inventory.count("minecraft:bread");
  run(A, "consiga 3 de comida");
  const ok = until(() => a.record.queue.length === 0, 20 * 300);
  assert.ok(ok, "terminou");
  assert.ok(A.inventory.count("minecraft:bread") > breadBefore, `recebeu pão: ${A.messages.slice(-2).join(" / ")}`);
  let replanted = 0;
  for (let x = 63; x <= 65; x++) for (let z = 62; z <= 64; z++) if (dim.rec(x, 64, z).id === "minecraft:wheat") replanted++;
  assert.ok(replanted > 0, "replantou com as sementes colhidas");
});

test("10) equipa uma ferramenta suportada", () => {
  const a = agents.get(A.id)!;
  a.inv.add({ id: "minecraft:stone_axe", n: 1 });
  run(A, "equipe o machado");
  mc.__advance(10);
  assert.equal(a.record.equipment.mainhand?.id, "minecraft:stone_axe");
  assert.ok(bodies()[0].commands.some((c) => c.includes("slot.weapon.mainhand 0 minecraft:stone_axe")), "visual atualizado");
});

test("6) protege contra inimigos perto do dono", () => {
  const a = agents.get(A.id)!;
  const z = dim.spawnEntity("minecraft:zombie", { x: A.location.x + 4, y: 64, z: A.location.z });
  z.health = { currentValue: 20, effectiveMax: 20, setCurrentValue: (v: number) => ((z.health!.currentValue = v), true) };
  mc.__advance(20);
  assert.equal(a.sm.state, "PROTECTING");
  assert.ok(bodies()[0].events.slice(-3).includes("shadowbound:mode_follow"), "IA nativa de combate ligada");
  assert.ok(z.health!.currentValue < 20, "Luna acertou o raio mágico");
  z.applyDamage(999);
  mc.__advance(200);
  assert.notEqual(a.sm.state, "PROTECTING", "volta ao normal depois do combate");
});

test("mineração: fabrica picareta na bancada, cava escada segura e entrega pedra", () => {
  const a = agents.get(A.id)!;
  A.teleport({ x: -60.5, y: 64, z: -60.5 });
  bodies()[0].teleport({ x: -59.5, y: 64, z: -60.5 });
  a.inv.add({ id: "minecraft:birch_log", n: 3 });
  mc.__advance(5);
  run(A, "pegue 3 pedras");
  const ok = until(() => a.record.queue.length === 0, 20 * 600);
  assert.ok(ok, "terminou");
  assert.ok(A.inventory.count("minecraft:cobblestone") >= 3, `pedra entregue: ${A.messages.slice(-3).join(" / ")}`);
  assert.ok(a.inv.slots.some((s) => s.id === "minecraft:wooden_pickaxe") || a.record.equipment.mainhand?.id === "minecraft:wooden_pickaxe", "fez a picareta");
});

test("15/13) sai do mundo no meio da tarefa, volta, e ela retoma do estado salvo", () => {
  A.teleport({ x: 40.5, y: 64, z: -40.5 });
  bodies()[0].teleport({ x: 41.5, y: 64, z: -40.5 });
  for (let y = 64; y <= 68; y++) dim.set(44, y, -38, "minecraft:oak_log");
  for (let x = 42; x <= 46; x++) for (let z = -40; z <= -36; z++) for (let y = 67; y <= 69; y++) if (!(x === 44 && z === -38 && y <= 68)) dim.set(x, y, z, "minecraft:oak_leaves");
  mc.__advance(5);
  const logs = () => A.inventory.count("minecraft:oak_log") + A.inventory.count("minecraft:birch_log");
  const logsBefore = logs();
  run(A, "pegue 5 troncos");
  const a1 = agents.get(A.id)!;
  until(() => (a1.record.queue[0]?.data.collected as number) >= 2, 20 * 120);
  const mid = a1.record.queue[0]?.data.collected as number;
  assert.ok(mid >= 2 && mid < 5, `no meio da tarefa (${mid})`);
  mc.world.afterEvents.playerLeave.fire({ playerId: A.id, playerName: A.name });
  mc.__advance(5);
  assert.equal(agents.has(A.id), false, "agente descarregado");
  assert.equal(bodies().length, 0, "corpo recolhido às sombras");
  mc.world.afterEvents.playerSpawn.fire({ player: A, initialSpawn: true });
  mc.__advance(80);
  const a2 = agents.get(A.id)!;
  assert.notEqual(a2, a1, "agente recriado a partir do disco");
  assert.equal(a2.record.queue[0]?.kind, "gather_wood", "tarefa recuperada");
  assert.ok((a2.record.queue[0]?.data.collected as number) >= mid, "progresso recuperado");
  const ok = until(() => logs() >= logsBefore + 5, 20 * 200); // counts logs she already had ("quanto falta")
  assert.ok(ok, `terminou depois de recarregar: ${A.messages.slice(-2).join(" / ")}`);
  assert.equal(bodies().length, 1, "só uma sombra");
});

test("16) funciona sem internet (nenhuma chamada de rede) e sem erros de script", () => {
  assert.deepEqual(mc.errors, []);
});
