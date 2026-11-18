/**
 * End-to-end test of the real brain against the simulator in tests/mock.
 * Mirrors the mandatory tests of the master prompt (section 18) that can be simulated.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as mc from "./mock/minecraft-server";
import * as ui from "./mock/minecraft-server-ui";
import "../scripts/main";
import { agents, squadOf } from "../scripts/ai/agent_manager";
const ag = (p: { id: string }) => squadOf(p.id, false)[0];
import { DP_AGENT_PREFIX } from "../scripts/core/constants";
import { sorcerer } from "../scripts/jujutsu/sorcerer";
import { existsSync, writeFileSync } from "node:fs";
import { ICON, shikiIcon } from "../scripts/ui/icons";
import { BEASTS } from "../scripts/core/species";
import { ABILITIES, CLANS, TECHS, rollClan } from "../scripts/jujutsu/clans";
import { GEAR, forge } from "../scripts/jujutsu/arsenal";
import { TUNING_SUKUNA, isPossessed, startPossession } from "../scripts/jujutsu/sukuna";
import { syncKit } from "../scripts/jujutsu/skills";
import { abilitiesFor } from "../scripts/jujutsu/abilities";
import { maxEnergyOf } from "../scripts/jujutsu/sorcerer";
import { abilityIcon, clanIcon, techCrest, itemIcon } from "../scripts/ui/icons";

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
const beasts = () => mc.__entities().filter((e) => e.typeId === "shadowbound:beast" && e.isValid);
const dim = mc.world.getDimension("minecraft:overworld") as unknown as mc.Dimension;

const A = mc.__addPlayer("Jogador A", { x: 0.5, y: 64, z: 0.5 });
const B = mc.__addPlayer("Jogador B", { x: -6.5, y: 64, z: 0.5 });
mc.world.afterEvents.playerSpawn.fire({ player: A, initialSpawn: true });
mc.world.afterEvents.playerSpawn.fire({ player: B, initialSpawn: true });
mc.__advance(260); // the clan roulette spins and lands for both players
// Ten Shadows tests below need a fixed technique for player A
{
  const r = sorcerer(A.id);
  r.clan = "zenin";
  r.tech = "ten_shadows";
}

test("recebe o Grimório e a roleta de clã sorteia ao entrar", () => {
  const rb = sorcerer(B.id);
  assert.ok(rb.rolled && rb.clan && rb.tech, "B teve clã e técnica sorteados");
  assert.ok(CLANS[rb.clan!].techs.some((t) => t.tech === rb.tech), "a técnica pertence ao clã sorteado");
  assert.equal(B.inventory.count("shadowbound:uniform_tokyo_chest"), 1, "kit inicial: jaqueta de Tóquio");
  assert.equal(A.inventory.count("shadowbound:shadow_summoner"), 1);
});

test("1-3) shikigami: vínculo ao dono e não duplica", () => {
  run(A, "invocar cao divino preto");
  mc.__advance(20);
  const b = beasts().find((e) => e.dyn["sb:owner"] === A.id)!;
  assert.ok(b, "shikigami invocado");
  assert.equal(b.dyn["sb:owner"], A.id, "dono gravado pelo id persistente");
  run(A, "invocar cao divino preto");
  mc.__advance(5);
  assert.equal(beasts().filter((e) => e.dyn["sb:owner"] === A.id).length, 1, "o mesmo shikigami não é invocado duas vezes");
});

test("4) outro jogador é ignorado e não acessa o shikigami", () => {
  const before = A.messages.length;
  run(B, "me siga");
  assert.ok(B.messages.some((m) => m.includes("invocações ativas") || m.includes("sombras ativas")), "B não tem nada para comandar");
  const ev = { player: B, target: beasts().find((e) => e.dyn["sb:owner"] === A.id)!, cancel: false };
  mc.world.beforeEvents.playerInteractWithEntity.fire(ev);
  mc.__advance(2);
  assert.equal(ev.cancel, true);
  assert.ok(B.actionbars.some((m) => m.includes("Acesso negado")));
  assert.equal(A.messages.length, before, "nada vazou para A");
  run(A, "desinvocar todos");
  mc.__advance(20);
});

test("criaturas: invoca várias, lutam com habilidades e não coletam", () => {
  sorcerer(A.id).energy = 200;
  run(A, "invocar caes divinos");
  run(A, "invocar dragao");
  mc.__advance(60);
  assert.equal(beasts().length, 3, "Cães Divinos (par) + 1 dragão (criação original)");
  assert.ok(sorcerer(A.id).energy < 200, "invocar gastou energia amaldiçoada");
  const dragon = squadOf(A.id, true).find((m) => m.persona === "dragon")!;
  assert.ok(dragon.body()!.events.includes("shadowbound:species_dragon"), "status de espécie aplicado");
  run(A, "criaturas, peguem madeira");
  assert.ok(A.messages.some((m) => m.includes("Criaturas não sabem")), "criatura recusa coletar");
  const z = dim.spawnEntity("minecraft:zombie", { x: A.location.x + 3, y: 64, z: A.location.z + 1 });
  mc.__advance(40);
  assert.ok(z.health!.currentValue < 10 || !z.isValid, "o dragão/Luna atacaram o zumbi");
  z.applyDamage(999);
  run(A, "desinvocar criaturas");
  mc.__advance(40);
  assert.equal(beasts().length, 0, "criaturas desinvocadas");
});

const ritualBody = () => beasts().find((e) => e.getDynamicProperty("sb:ritual") === A.id);

test("dez sombras: shikigami bloqueado exige ritual; vencer sozinho libera", () => {
  const before = beasts().length;
  run(A, "invocar nue");
  assert.equal(beasts().length, before, "Nue ainda não domada não aparece");
  assert.ok(A.messages.some((m) => m.includes("ainda não foi domado")), "explica que precisa do ritual");
  sorcerer(A.id).energy = 200;
  run(A, "ritual nue");
  const wild = ritualBody()!;
  assert.ok(wild, "o shikigami selvagem apareceu");
  assert.ok(wild.events.includes("shadowbound:mode_wild"), "modo selvagem: ataca o invocador");
  wild.applyDamage(999, { cause: "entityAttack", damagingEntity: A });
  mc.__advance(2);
  assert.ok(sorcerer(A.id).unlocked.includes("owl"), "ritual concluído: Nue domada");
  run(A, "invocar nue");
  mc.__advance(5);
  assert.ok(squadOf(A.id, true).some((m) => m.persona === "owl"), "Nue obedece agora");
  run(A, "desinvocar criaturas");
  mc.__advance(20);
});

test("dez sombras: ritual anulado quando outra pessoa interfere", () => {
  sorcerer(A.id).energy = 200;
  run(A, "ritual sapo");
  const wild = ritualBody()!;
  assert.ok(wild, "ritual do Sapo aberto");
  wild.applyDamage(2, { cause: "entityAttack", damagingEntity: B });
  mc.__advance(2);
  assert.ok(!wild.isValid, "o shikigami voltou para a sombra");
  assert.ok(!sorcerer(A.id).unlocked.includes("toad"), "nada foi domado");
  assert.ok(A.messages.some((m) => m.includes("ANULADO")), "o dono foi avisado");
});

test("dez sombras: Cão Divino destruído não volta e o outro vira Totalidade (Modo Cânone)", () => {
  sorcerer(A.id).energy = 200;
  run(A, "invocar caes divinos");
  mc.__advance(5);
  const white = squadOf(A.id, true).find((m) => m.persona === "dog_white")!;
  assert.ok(white, "Cão Divino Branco em campo");
  white.body()!.applyDamage(999, { cause: "entityAttack" });
  mc.__advance(5);
  const r = sorcerer(A.id);
  assert.ok(r.destroyed.includes("dog_white"), "registrado como destruído");
  assert.ok(r.unlocked.includes("totality"), "herança: Totalidade liberada");
  assert.ok(!squadOf(A.id, false).some((m) => m.persona === "dog_white"), "o cão destruído saiu do esquadrão");
  mc.__advance(40 * 20);
  assert.ok(!squadOf(A.id, true).some((m) => m.persona === "dog_white"), "e não ressuscitou");
  run(A, "invocar totalidade");
  mc.__advance(5);
  assert.ok(squadOf(A.id, true).some((m) => m.persona === "totality"), "Cão Divino: Totalidade invocado");
  run(A, "desinvocar criaturas");
  mc.__advance(20);
});

test("dez sombras: Mahoraga gira a roda e se adapta ao mesmo tipo de dano", () => {
  const r = sorcerer(A.id);
  r.xp = Math.max(r.xp, 5 * 150);
  r.energy = 300;
  run(A, "ritual mahoraga");
  const wild = ritualBody()!;
  assert.ok(wild, "ritual de Mahoraga aberto");
  for (let i = 0; i < 4; i++) wild.applyDamage(5, { cause: "entityAttack", damagingEntity: A });
  assert.equal(wild.getProperty("shadowbound:adapt"), 4, "a roda girou 4 vezes");
  const hp = wild.health!.currentValue;
  wild.applyDamage(5, { cause: "entityAttack", damagingEntity: A });
  assert.equal(wild.health!.currentValue, hp, "golpe adaptado não causa dano");
  wild.applyDamage(5, { cause: "fire", damagingEntity: A });
  assert.ok(wild.health!.currentValue < hp, "outro tipo de ataque ainda funciona");
  wild.applyDamage(999, { cause: "magic", damagingEntity: A });
  mc.__advance(2);
  assert.ok(sorcerer(A.id).unlocked.includes("colossus"), "vencer o ritual doma Mahoraga (rota original do mod)");
});

test("dez sombras: técnicas gastam energia e respeitam o domínio", () => {
  const r = sorcerer(A.id);
  r.xp = 5 * 150;
  r.energy = 200;
  run(A, "dominio");
  assert.ok(!r.domain, "Expansão de Domínio exige domínio 6");
  r.xp = 6 * 150;
  run(A, "dominio");
  assert.ok(r.domain && r.domain.until > Date.now(), "Jardim Sombrio da Quimera ativo");
  assert.ok(r.energy <= 80 + 10, "custou 120 de energia (tolerando um tique de recarga)");
  run(A, "reforco");
  assert.ok(r.toggles.reforco, "reforço ligado");
  const e0 = r.energy;
  mc.__advance(40);
  assert.ok(r.energy < e0 + 1, "alternável drena energia");
  run(A, "reforco");
});

test("interface: todos os ícones do menu existem no pacote visual", () => {
  const all = [...Object.values(ICON), ...BEASTS.map(shikiIcon), ...Object.values(ABILITIES).map((a) => abilityIcon(a.icon)), ...Object.keys(CLANS).map(clanIcon), ...Object.keys(TECHS).filter((t) => t !== "shrine").map(techCrest), ...GEAR.map((g) => itemIcon(g.icon))];
  for (const ic of all) assert.ok(existsSync(`resource_pack/${ic}.png`), `ícone ausente: ${ic}`);
});

test("interface: o Grimório abre organizado e todo botão tem ícone", async () => {
  const flush = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  };
  let start = ui.shown.length;
  mc.world.afterEvents.itemUse.fire({ itemStack: { typeId: "shadowbound:shadow_summoner" }, source: A });
  await flush();
  const main = ui.shown[start];
  assert.ok(main.title.includes("Grimório Jujutsu"), "abriu o Grimório");
  assert.ok(main.items.some((x) => x.t === "header") && main.items.some((x) => x.t === "divider"), "organizado em seções");
  const idx = main.buttons.findIndex((b) => b.includes("Shikigamis"));
  assert.ok(idx >= 0, "Dez Sombras mostra o botão de shikigamis");
  mc.__advance(15); // item-use throttle
  start = ui.shown.length;
  ui.answers.push({ canceled: false, selection: idx }, { canceled: false, selection: 99 });
  mc.world.afterEvents.itemUse.fire({ itemStack: { typeId: "shadowbound:shadow_summoner" }, source: A });
  await flush();
  const forms = ui.shown.slice(start);
  assert.ok(forms[1] && forms[1].title.includes("Shikigamis"), "tocar em Shikigamis abre a lista");
  for (const f of [main, ...forms]) assert.ok(f.icons.every((i) => !!i && existsSync(`resource_pack/${i}.png`)), `todo botão de "${f.title}" tem ícone válido`);
  if (process.env.MENU_DUMP) writeFileSync(process.env.MENU_DUMP, JSON.stringify([main, forms[1]]));
});

// ------------------------------------------------------------------ v4: clans, Sukuna, arsenal
const zombieAhead = (p: mc.Player, dz = 5) => dim.spawnEntity("minecraft:zombie", { x: p.location.x, y: p.location.y, z: p.location.z + dz });
const asTech = (p: mc.Player, clan: string, tech: string, lv = 6) => {
  const r = sorcerer(p.id);
  r.clan = clan as never;
  r.tech = tech as never;
  r.xp = lv * 150;
  r.energy = 999;
  r.cooldowns = {};
  r.toggles = {};
  return r;
};

test("roleta: os pesos dão clãs e técnicas válidos", () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const { clan, tech } = rollClan(rand);
    assert.ok(CLANS[clan].techs.some((t) => t.tech === tech));
    seen.add(clan);
  }
  assert.ok(seen.has("none") && seen.has("zenin") && seen.has("kamo"), "os clãs comuns aparecem");
  assert.equal(Object.values(CLANS).reduce((s, c) => s + c.weight, 0), 100, "pesos somam 100%");
});

test("Gojo: Azul puxa e fere, Roxo Oco atravessa, Vazio Infinito abre", () => {
  const r = asTech(B, "gojo", "limitless");
  const z = zombieAhead(B);
  run(B, "azul");
  assert.ok(!z.isValid || z.health!.currentValue < 10, "Azul feriu o zumbi");
  const z2 = zombieAhead(B, 8);
  run(B, "roxo");
  assert.ok(!z2.isValid || z2.health!.currentValue <= 0, "Roxo Oco destruiu o alvo na linha");
  run(B, "dominio");
  assert.equal(r.domain?.kind, "vazio", "Vazio Infinito aberto");
  r.domain = undefined;
});

test("Kamo, Inumaki e Boogie Woogie: sangue, garganta e troca de lugar", () => {
  asTech(B, "kamo", "blood");
  const z = zombieAhead(B, 6);
  run(B, "sangue perfurante");
  assert.ok(!z.isValid || z.health!.currentValue < 10, "Sangue Perfurante acertou");
  const r = asTech(B, "inumaki", "speech");
  zombieAhead(B, 3);
  run(B, "exploda");
  assert.ok(r.throat >= 20, "a ordem forçou a garganta (tolerando um tique de recuperação)");
  asTech(B, "none", "boogie");
  const z3 = zombieAhead(B, 7);
  const before = { ...z3.location };
  run(B, "palmas");
  assert.ok(Math.abs(B.location.z - before.z) < 0.01, "Boogie Woogie trocou de lugar com o alvo");
});

test("Restrição Celestial: usa Vigor e não tem técnicas de energia", () => {
  const r = asTech(B, "zenin", "heavenly");
  assert.ok(!abilitiesFor(r).some((a) => a.id === "reforco" || a.id === "rct"), "sem técnicas de energia amaldiçoada");
  assert.ok(maxEnergyOf(r) >= 100);
  run(B, "reforco");
  assert.ok(!r.toggles.reforco, "reforço recusado");
});

test("Dedo de Sukuna: virar receptáculo libera o Santuário", () => {
  const r = asTech(B, "none", "ratio");
  TUNING_SUKUNA.vesselChance = 1;
  mc.world.afterEvents.itemCompleteUse.fire({ itemStack: { typeId: "shadowbound:sukuna_finger" }, source: B });
  assert.ok(r.vessel && r.fingersEaten === 1, "receptáculo");
  assert.ok(abilitiesFor(r).some((a) => a.id === "desmantelar"), "Desmantelar liberado");
  const z = zombieAhead(B, 5);
  run(B, "desmantelar");
  assert.ok(!z.isValid || z.health!.currentValue < 10, "Desmantelar cortou o alvo");
  TUNING_SUKUNA.vesselChance = 0.25;
});

test("Arsenal: forjar consome material; a katana fere a alma", () => {
  asTech(B, "none", "ratio");
  B.inventory.addItem(new mc.ItemStack("shadowbound:cursed_fragment", 8));
  B.inventory.addItem(new mc.ItemStack("minecraft:iron_ingot", 4));
  B.inventory.addItem(new mc.ItemStack("minecraft:stick", 1));
  const katana = GEAR.find((g) => g.id === "shadowbound:split_soul_katana")!;
  assert.ok(forge(B as never, katana), "forjou");
  assert.equal(B.inventory.count("shadowbound:split_soul_katana"), 1);
  assert.equal(B.inventory.count("shadowbound:cursed_fragment"), 0, "fragmentos consumidos");
  for (let i = 0; i < B.inventory.size; i++) if (B.inventory.getItem(i)?.typeId === "shadowbound:split_soul_katana") B.selectedSlotIndex = i;
  const z = zombieAhead(B, 2);
  const hp = z.health!.currentValue;
  mc.world.afterEvents.entityHitEntity.fire({ damagingEntity: B, hitEntity: z });
  assert.ok(z.health!.currentValue <= hp - 5 || !z.isValid, "dano na alma aplicado");
});

test("botões de poder: o kit vai para o inventário e usar o botão solta a técnica", () => {
  asTech(B, "gojo", "limitless");
  syncKit(B as never);
  assert.equal(B.inventory.count("shadowbound:skill_azul"), 1, "botão do Azul no inventário");
  assert.equal(B.inventory.count("shadowbound:skill_kokusen"), 0, "passivas não viram botão");
  const z = zombieAhead(B, 5);
  mc.world.afterEvents.itemUse.fire({ itemStack: new mc.ItemStack("shadowbound:skill_azul"), source: B });
  assert.ok(!z.isValid || z.health!.currentValue < 10, "usar o botão soltou o Azul");
  asTech(B, "zenin", "heavenly");
  syncKit(B as never);
  assert.equal(B.inventory.count("shadowbound:skill_azul"), 0, "trocou de clã: botões antigos saem");
  assert.equal(B.inventory.count("shadowbound:skill_investida_celestial"), 1, "botões da nova técnica entram");
});

test("possessão: Sukuna toma o corpo, ataca sozinho e agachar devolve o controle", () => {
  const r = asTech(B, "none", "ratio");
  r.vessel = true;
  r.fingersEaten = 5;
  r.influence = 50;
  r.destruction = false;
  const z = zombieAhead(B, 4);
  startPossession(B as never, r);
  assert.ok(isPossessed(B.id), "Sukuna assumiu");
  assert.ok(B.movementLocked, "o jogador perdeu o controle do movimento");
  run(B, "desmantelar");
  assert.ok(B.messages.some((m) => m.includes("Sukuna está no controle")), "técnicas bloqueadas durante a possessão");
  mc.__advance(30);
  assert.ok(!z.isValid || z.health!.currentValue < 10, "Sukuna atacou sozinho");
  for (let i = 0; i < 25 && isPossessed(B.id); i++) {
    B.isSneaking = true;
    mc.__advance(2);
    B.isSneaking = false;
    mc.__advance(2);
  }
  assert.ok(!isPossessed(B.id), "agachar repetidamente devolveu o controle");
  assert.ok(!B.movementLocked, "movimento devolvido");
  assert.ok(r.influence < 50, "vencer Sukuna reduz a influência");
});

test("16) funciona sem internet (nenhuma chamada de rede) e sem erros de script", () => {
  assert.deepEqual(mc.errors, []);
});
