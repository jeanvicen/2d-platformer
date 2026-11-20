// Autoteste dentro do jogo (servidor dedicado sem jogadores): /scriptevent lila:selftest [quick]
// Monta uma arena no céu com árvores, rocha com minérios, areia, água, grama e uma "construção
// do jogador", invoca uma Lila de teste e verifica comportamento real (nada simulado).
import { system, world, ItemStack } from "@minecraft/server";
import { COMPANIONS, Companion, ENTITY_ID, OWNER_PROP, adopt, newRecord } from "../lila/companion.js";
import * as inv from "../lila/inventory.js";
import { obtain } from "../lila/planner.js";
import { goTo } from "../lila/motor.js";
import { buildBlueprint } from "../lila/build.js";
import { BLUEPRINTS } from "../lib/blueprints.js";
import { blueprintBlock } from "../lib/recipes.js";
import { command, handleIntents, stats, statusText } from "../lila/brain.js";
import { loadCompanion } from "../lila/companion.js";
import { summon } from "../lila/lifecycle.js";
import { missions, riddenBy, scanOwner } from "../lila/drone.js";
import { isFood } from "../lib/items.js";
import { mineFor } from "../lila/resource.js";
import { defend } from "../lila/combat.js";
import { dismiss, restoreBodyForTest, RESPAWN_TICKS } from "../lila/lifecycle.js";
import { readJSON } from "../core/persistence.js";
import { compKey, recKey } from "../lila/companion.js";
import { toWorld } from "../lila/build.js";
import { findBlocks } from "../lila/world.js";
import { logError } from "../core/log.js";

const Y = 150; // topo da arena (grama); a Lila anda em Y+1
const OWNER = "selftest-owner";
let running = false;

const fmt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;

function log(s) {
  console.info(`LILA-TEST ${s}`);
}

function runGen(gen, timeout) {
  return new Promise((resolve) => {
    let wait = 0;
    const t0 = system.currentTick;
    const id = system.runInterval(() => {
      if (system.currentTick - t0 > timeout) {
        system.clearRun(id);
        try {
          gen.return(undefined);
        } catch {
          /* ignore */
        }
        resolve({ ok: false, err: "timeout" });
        return;
      }
      if (wait > 0) {
        wait--;
        return;
      }
      try {
        const r = gen.next();
        if (r.done) {
          system.clearRun(id);
          resolve({ ok: true, value: r.value });
          return;
        }
        wait = typeof r.value === "number" ? Math.max(0, r.value - 1) : 0;
      } catch (e) {
        system.clearRun(id);
        resolve({ ok: false, err: String(e?.message ?? e) });
      }
    }, 1);
  });
}

/** Progresso legível de um companheiro (diagnóstico dos testes longos). */
function trace(c) {
  const p = c.pos();
  return `job=${c.job?.desc?.type ?? "-"} pos=${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)} obra=${c.flags.buildProgress ?? "-"} solido=${Object.entries(inv.summary(c)).filter(([id]) => /_planks$|_log$|cobble/.test(id)).map(([id, n]) => `${id.replace("minecraft:", "")}:${n}`).join(",")}`;
}

async function waitUntil(pred, timeout, c) {
  const t0 = system.currentTick;
  while (system.currentTick - t0 < timeout) {
    if (c && (system.currentTick - t0) % 200 < 5) console.info(`[Lila:trace] t=${system.currentTick - t0} ${trace(c)}`);
    try {
      if (pred()) return true;
    } catch {
      /* ignore */
    }
    await system.waitTicks(5);
  }
  return false;
}

function cmd(dim, s) {
  try {
    dim.runCommand(s);
  } catch (e) {
    logError("test.cmd", `${s}: ${e}`);
  }
}

async function buildArena(dim) {
  // chão: pedra com grama em cima, 64×64
  cmd(dim, `fill -32 ${Y - 4} -32 31 ${Y - 1} 31 stone`);
  cmd(dim, `fill -32 ${Y} -32 31 ${Y} 31 grass_block`);
  for (let y = Y + 1; y < Y + 24; y += 7) cmd(dim, `fill -32 ${y} -32 31 ${Math.min(Y + 23, y + 6)} 31 air`);
  // árvores
  for (const [x, z] of [[10, 10], [14, 4], [-12, 12], [6, 20]]) {
    cmd(dim, `fill ${x - 2} ${Y + 4} ${z - 2} ${x + 2} ${Y + 5} ${z + 2} oak_leaves`);
    cmd(dim, `fill ${x - 1} ${Y + 6} ${z - 1} ${x + 1} ${Y + 6} ${z + 1} oak_leaves`);
    cmd(dim, `fill ${x} ${Y + 1} ${z} ${x} ${Y + 5} ${z} oak_log`);
  }
  // rocha com minérios expostos
  cmd(dim, `fill -14 ${Y + 1} -14 -4 ${Y + 3} -4 stone`);
  for (const [x, y, z, b] of [[-4, Y + 1, -6, "iron_ore"], [-4, Y + 2, -8, "iron_ore"], [-6, Y + 3, -4, "iron_ore"], [-8, Y + 3, -6, "iron_ore"],
    [-4, Y + 3, -12, "coal_ore"], [-10, Y + 3, -4, "coal_ore"], [-12, Y + 3, -10, "coal_ore"]]) cmd(dim, `setblock ${x} ${y} ${z} ${b}`);
  // areia, água e grama alta
  cmd(dim, `fill 4 ${Y} -12 7 ${Y} -9 sand`);
  cmd(dim, `fill -4 ${Y} 6 -2 ${Y} 8 water`);
  for (let x = 0; x <= 8; x += 2) for (let z = 13; z <= 17; z += 2) cmd(dim, `setblock ${x} ${Y + 1} ${z} short_grass`);
  // "construção do jogador" (nunca pode ser quebrada) e um muro para contornar
  cmd(dim, `fill 20 ${Y + 1} -5 20 ${Y + 3} 5 oak_planks`);
  cmd(dim, `fill -20 ${Y + 1} -24 -20 ${Y + 3} -2 cobblestone`);
}

function spawnTestLila(dim) {
  for (const e of dim.getEntities({ type: ENTITY_ID })) {
    if (e.getDynamicProperty(OWNER_PROP) === OWNER) e.remove();
  }
  const rec = newRecord({ id: OWNER, name: "Teste" });
  rec.summoned = true;
  rec.mode = "stay";
  rec.anchor = { x: 0.5, y: Y + 1, z: 0.5 };
  rec.pos = { ...rec.anchor };
  const c = new Companion(rec);
  c.flags.test = true;
  COMPANIONS.set(compKey(OWNER, "lila"), c);
  const e = dim.spawnEntity(ENTITY_ID, { x: 0.5, y: Y + 1, z: 0.5 });
  e.setDynamicProperty(OWNER_PROP, OWNER);
  adopt(e);
  c.rec.paused = true; // os testes dirigem os objetivos diretamente
  return c;
}

/** Testes com um jogador de verdade (simulado pelo GameTest no servidor de teste). */
async function ownerTests(dim, check) {
  cmd(dim, "scriptevent lilatest:spawn_owner");
  /** @type {import("@minecraft/server").Player | undefined} */
  let player = undefined;
  await waitUntil(() => !!(player = world.getAllPlayers().find((p) => p.name === "Dono")), 200);
  check("simulated owner joined", !!player);
  if (!player) return;
  const owner = /** @type {import("@minecraft/server").Player} */ (/** @type {unknown} */ (player));
  const c = loadCompanion(owner);
  check("summon in front of owner", summon(c, owner) && c.alive());
  const pinv = () => owner.getComponent("minecraft:inventory")?.container;
  const pcount = (pred) => {
    const ct = pinv();
    let n = 0;
    for (let i = 0; ct && i < ct.size; i++) {
      const it = ct.getItem(i);
      if (it && pred(it.typeId)) n += it.amount;
    }
    return n;
  };
  // seguir: o dono anda 18 blocos; ela tem que ir junto
  handleIntents(c, [{ type: "follow" }]);
  for (let k = 0; k < 18; k++) {
    owner.teleport({ x: 0.5 + k, y: Y + 1, z: 6.5 });
    await system.waitTicks(6);
  }
  await system.waitTicks(120);
  const d = Math.hypot(c.pos().x - owner.location.x, c.pos().z - owner.location.z);
  check("follows the owner while walking", d < 6, `dist=${d.toFixed(1)}`);
  // ladeira de degraus de 1 bloco: ela tem que subir atrás de você sem empacar
  for (let k = 0; k < 8; k++) cmd(dim, `fill ${2 + k} ${Y + 1} -30 ${2 + k} ${Y + 1 + k} -24 stone`);
  owner.teleport({ x: 0.5, y: Y + 1, z: -27.5 });
  c.entity?.teleport({ x: -2.5, y: Y + 1, z: -27.5 });
  await system.waitTicks(20);
  for (let k = 0; k < 8; k++) {
    owner.teleport({ x: 2.5 + k, y: Y + 2 + k, z: -27.5 });
    await system.waitTicks(10);
  }
  const tH = system.currentTick;
  await waitUntil(() => Math.hypot(c.pos().x - owner.location.x, c.pos().z - owner.location.z) < 4 && Math.abs(c.pos().y - owner.location.y) < 2.5, 400);
  check("climbs a 1-block-step hill after the owner", Math.hypot(c.pos().x - owner.location.x, c.pos().z - owner.location.z) < 4 && Math.abs(c.pos().y - owner.location.y) < 2.5,
    `ticks=${system.currentTick - tH} dy=${(owner.location.y - c.pos().y).toFixed(1)} native=${!!c.flags.nativeFollow}`);
  check("tamed to the owner (native follow)", !!c.entity?.getComponent("minecraft:tameable")?.isTamed);
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 });
  await system.waitTicks(40);
  let walkSeen = false;
  // vem aqui: muda de lugar e chama
  owner.teleport({ x: -6.5, y: Y + 1, z: 2.5 });
  command(c, "vem aqui");
  const t0 = system.currentTick;
  await waitUntil(() => {
    if (c.entity?.getProperty("lila:move") !== "none") walkSeen = true;
    return Math.hypot(c.pos().x - owner.location.x, c.pos().z - owner.location.z) < 3.5;
  }, 400);
  check("'vem aqui' brings her to the owner", Math.hypot(c.pos().x - owner.location.x, c.pos().z - owner.location.z) < 3.5, `ticks=${system.currentTick - t0}`);
  check("walk animation property set while moving", walkSeen);
  // madeira entregue no inventário do dono
  const logs0 = pcount((id) => /_log$/.test(id));
  command(c, "pega 4 madeira");
  await waitUntil(() => pcount((id) => /_log$/.test(id)) >= logs0 + 4, 3000);
  check("'pega 4 madeira' delivers logs to the owner", pcount((id) => /_log$/.test(id)) >= logs0 + 4, `logs=${pcount((id) => /_log$/.test(id))} goal=${c.rec.goals[0]?.type ?? "-"}`);
  // comida com vacas por perto
  for (let k = 0; k < 4; k++) dim.spawnEntity("minecraft:cow", { x: 18 + k, y: Y + 1, z: -18 });
  const food0 = pcount(isFood);
  const tf = system.currentTick;
  command(c, "arranja comida pra mim");
  c.flags.trace = true;
  await waitUntil(() => pcount(isFood) > food0, 1800, c);
  c.flags.trace = false;
  check("'arranja comida pra mim' brings food within 90 s", pcount(isFood) > food0, `food=${pcount(isFood)} ticks=${system.currentTick - tf} job=${c.job?.desc?.type ?? "-"}`);
  const built0 = c.rec.stats.built;
  // ferramenta pedida é fabricada e entregue
  const tp = system.currentTick;
  command(c, "faz uma picareta de pedra");
  await waitUntil(() => pcount((id) => id === "minecraft:stone_pickaxe") > 0, 3600);
  check("'faz uma picareta de pedra' crafts and delivers", pcount((id) => id === "minecraft:stone_pickaxe") > 0, `ticks=${system.currentTick - tp} job=${c.job?.desc?.type ?? "-"}`);
  // construção rápida: cabana só com troncos (sem vidro/tocha/pedra: ela adapta e não trava)
  owner.teleport({ x: 24.5, y: Y + 1, z: 22.5 }, { rotation: { x: 0, y: 180 } });
  await system.waitTicks(10);
  inv.addId(c, "minecraft:oak_log", 60); // as árvores da arena já foram cortadas nos testes anteriores
  const tb = system.currentTick;
  command(c, "constroi uma cabana aqui");
  c.flags.trace = true;
  await waitUntil(() => c.rec.stats.built > built0 || (c.rec.goals.length === 0 && system.currentTick - tb > 60), 4800, c);
  check("'constrói uma cabana' (só troncos) termina em até 4 min", c.rec.stats.built > built0, `ticks=${system.currentTick - tb} job=${c.job?.desc?.type ?? "-"} err=${c.lastError ?? "-"}`);
  // plantação rápida: poucas sementes e sem balde → planta o que tem e usa terra molhada
  owner.teleport({ x: -24.5, y: Y + 1, z: 24.5 }, { rotation: { x: 0, y: 180 } });
  await system.waitTicks(10);
  inv.addId(c, "minecraft:wheat_seeds", 6);
  inv.addId(c, "minecraft:oak_log", 16);
  const tz = system.currentTick;
  const built1 = c.rec.stats.built;
  command(c, "faz uma plantação aqui");
  await waitUntil(() => c.rec.stats.built > built1 || (c.rec.goals.length === 0 && system.currentTick - tz > 60), 3600, c);
  c.flags.trace = false;
  check("'faz uma plantação' (6 sementes, sem balde) termina em até 3 min", c.rec.stats.built > built1 && !!c.rec.farm, `ticks=${system.currentTick - tz} job=${c.job?.desc?.type ?? "-"} err=${c.lastError ?? "-"}`);
  // me dá tudo: fica só com as ferramentas
  command(c, "me dá tudo");
  await waitUntil(() => c.rec.goals.length === 0, 600);
  const left = Object.keys(inv.summary(c)).filter((id) => !/_(pickaxe|axe|shovel|sword|hoe)$/.test(id));
  check("'me dá tudo' keeps only her tools", left.length === 0, `left=${left.join(",")}`);
  check("status answers", statusText(c).includes("Vida"));
  await droneTests(dim, check, owner, pcount);
}

/** DR-0N com o dono: voar, seguir em órbita, passar por cima de muro, torreta, carona, coleta, escaneamento. */
async function droneTests(dim, check, owner, pcount) {
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 });
  await system.waitTicks(10);
  const d = loadCompanion(owner, "drone");
  check("drone: summon", summon(d, owner) && d.alive() && d.entity?.typeId === "lila:drone");
  // órbita: anda 20 blocos e ele vem voando em volta
  handleIntents(d, [{ type: "follow" }]);
  for (let k = 0; k < 20; k++) {
    owner.teleport({ x: 0.5 - k, y: Y + 1, z: 6.5 });
    await system.waitTicks(5);
  }
  await system.waitTicks(80);
  const dd = Math.hypot(d.pos().x - owner.location.x, d.pos().z - owner.location.z);
  check("drone: flies around the owner", dd < 8 && d.pos().y > owner.location.y + 0.5, `dist=${dd.toFixed(1)} h=${(d.pos().y - owner.location.y).toFixed(1)}`);
  // muro alto entre os dois: tem que passar voando por cima
  cmd(dim, `fill -26 ${Y + 1} -12 -26 ${Y + 9} 12 cobblestone`);
  d.entity?.teleport({ x: -22.5, y: Y + 2, z: 0.5 });
  owner.teleport({ x: -30.5, y: Y + 1, z: 0.5 });
  await system.waitTicks(4);
  handleIntents(d, [{ type: "stay" }]);
  await system.waitTicks(4);
  const tw = system.currentTick;
  command(d, "vem aqui");
  await waitUntil(() => Math.hypot(d.pos().x - owner.location.x, d.pos().z - owner.location.z) < 4, 400);
  check("drone: flies over a 9-block wall to the owner", Math.hypot(d.pos().x - owner.location.x, d.pos().z - owner.location.z) < 4, `ticks=${system.currentTick - tw}`);
  check("drone: player wall intact", dim.getBlock({ x: -26, y: Y + 5, z: 0 })?.typeId === "minecraft:cobblestone");
  cmd(dim, `fill -26 ${Y + 1} -12 -26 ${Y + 9} 12 air`);
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 });
  await system.waitTicks(10);
  // torreta: zumbis por perto
  const zs = [0, 1, 2].map((k) => dim.spawnEntity("minecraft:zombie", { x: 8 + k * 2, y: Y + 1, z: 14 }));
  command(d, "modo torreta");
  const tt = system.currentTick;
  await waitUntil(() => zs.every((z) => !z.isValid || (z.getComponent("minecraft:health")?.currentValue ?? 0) <= 0), 500);
  {
    const gp = d.pos();
    let gy = gp.y;
    for (let y = Math.floor(gp.y); y > gp.y - 20; y--) {
      const b = dim.getBlock({ x: Math.floor(gp.x), y, z: Math.floor(gp.z) });
      if (b && !b.isAir) {
        gy = y + 1;
        break;
      }
    }
    check("drone: turret lands on the ground and transforms", Math.abs(gp.y - gy) < 0.4 && d.entity?.getProperty("lila:action") === "turret", `h=${(gp.y - gy).toFixed(2)} act=${d.entity?.getProperty("lila:action")}`);
  }
  check("drone: turret mode kills 3 zombies", zs.every((z) => !z.isValid || (z.getComponent("minecraft:health")?.currentValue ?? 0) <= 0) && d.rec.mode === "turret", `ticks=${system.currentTick - tt}`);
  // carona
  handleIntents(d, [{ type: "follow" }]);
  await system.waitTicks(20);
  command(d, "me dá carona");
  await system.waitTicks(10);
  check("drone: owner can ride it", !!riddenBy(d));
  try {
    d.entity?.getComponent("minecraft:rideable")?.ejectRider(owner);
  } catch {
    /* ignore */
  }
  await system.waitTicks(20);
  check("drone: resumes work after the ride", !riddenBy(d) && !d.flags.ridden);
  // coleta voando + entrega
  const logs0 = pcount((id) => /_log$/.test(id));
  command(d, "pega 4 madeira");
  const tg = system.currentTick;
  await waitUntil(() => pcount((id) => /_log$/.test(id)) >= logs0 + 4, 2400);
  check("drone: 'pega 4 madeira' (flying) delivers", pcount((id) => /_log$/.test(id)) >= logs0 + 4, `ticks=${system.currentTick - tg}`);
  // comida: abate a vaca de longe e desce pra recolher a carne e entregar
  for (let k = 0; k < 3; k++) dim.spawnEntity("minecraft:cow", { x: 6 + k, y: Y + 1, z: 16 });
  const dfood0 = pcount(isFood);
  const tdf = system.currentTick;
  command(d, "quero comida");
  await waitUntil(() => pcount(isFood) > dfood0, 1600);
  check("drone: 'quero comida' hunts, picks up and delivers food", pcount(isFood) > dfood0, `food=${pcount(isFood)} ticks=${system.currentTick - tdf} job=${d.job?.desc?.type ?? "-"}`);
  check("drone: scan reports owner", scanOwner(d, true).includes("vida"));
  check("drone: missions list", missions(d).length >= 8);
  check("drone: lila still alive alongside", !!loadCompanion(owner, "lila").alive());
}

/** @param {string} mode */
export async function runSelfTest(mode = "") {
  if (running) return;
  running = true;
  const quick = mode.includes("quick");
  const dim = world.getDimension("overworld");
  const results = [];
  const check = (name, ok, info = "") => {
    results.push({ name, ok });
    log(`${ok ? "PASS" : "FAIL"} ${name}${info ? " :: " + info : ""}`);
  };
  try {
    log("START");
    try {
      const mgr = world.tickingAreaManager;
      if (mgr.hasTickingArea("lila_selftest")) mgr.removeTickingArea("lila_selftest");
      await mgr.createTickingArea("lila_selftest", { dimension: dim, from: { x: -40, y: Y - 8, z: -40 }, to: { x: 40, y: Y + 30, z: 40 } });
    } catch (e) {
      log(`WARN tickingarea ${e}`);
      cmd(dim, `tickingarea add -40 ${Y - 8} -40 40 ${Y + 30} 40 lila_selftest true`);
    }
    const loaded = await waitUntil(() => [[-32, -32], [31, 31], [-32, 31], [31, -32], [0, 0]].every(([x, z]) => dim.isChunkLoaded({ x, y: Y, z })), 600);
    check("arena chunks loaded", loaded);
    await buildArena(dim);
    await system.waitTicks(10);
    if (mode.includes("owner")) {
      await ownerTests(dim, check);
      return;
    }
    const c = spawnTestLila(dim);
    await system.waitTicks(5);
    check("spawn + adopt", c.alive() && c.entity?.getDynamicProperty(OWNER_PROP) === OWNER);

    // 1) inventário real
    inv.addId(c, "minecraft:dirt", 20);
    check("inventory add/count", inv.count(c, "minecraft:dirt") === 20);
    check("inventory take", inv.take(c, "minecraft:dirt", 5) === 5 && inv.count(c, "minecraft:dirt") === 15);

    // 2) caminho contornando um muro que ela não pode quebrar
    c.entity?.teleport({ x: -25.5, y: Y + 1, z: -10.5 });
    await system.waitTicks(2);
    let r = await runGen(goTo(c, { x: -14.5, y: Y + 1, z: -10.5 }, { reach: 1.6, allowTeleport: false }), 900);
    const p = c.pos();
    check("pathfinding around wall", r.ok && Math.hypot(p.x + 14.5, p.z + 10.5) < 2.5, `pos=${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} ${r.err ?? ""}`);
    check("wall intact (player build)", dim.getBlock({ x: -20, y: Y + 2, z: -10 })?.typeId === "minecraft:cobblestone");

    // 3) cortar árvores de verdade
    r = await runGen(obtain(c, { group: "log" }, 8), 2400);
    check("chop trees -> 8 logs", r.ok && inv.count(c, { group: "log" }) >= 8, `logs=${inv.count(c, { group: "log" })} ${r.err ?? ""}`);

    // 4) cadeia de ferramentas: madeira -> pedra
    r = await runGen(obtain(c, "minecraft:wooden_pickaxe", 1), 1200);
    check("craft wooden pickaxe (planks, sticks, table)", r.ok && inv.count(c, "minecraft:wooden_pickaxe") >= 1, r.err ?? "");
    r = await runGen(obtain(c, "minecraft:stone_pickaxe", 1), 2400);
    check("stone pickaxe (mines real stone)", r.ok && inv.count(c, "minecraft:stone_pickaxe") >= 1, `${r.err ?? ""} pos=${fmt(c.pos())} ores=${findBlocks(dim, c.pos(), ["minecraft:iron_ore"], { r: 20, dy: 14, max: 9 }).length}`);
    const tables = findBlocks(dim, { x: 0, y: Y + 1, z: 0 }, ["minecraft:crafting_table"], { r: 32, dy: 8, max: 5 });
    check("temporary crafting table picked back up", tables.length === 0, `tables=${tables.length}`);

    // 5) ferro: minerar + fornalha + combustível + fundição real
    if (!quick) {
      r = await runGen(obtain(c, "minecraft:iron_ingot", 2), 4800);
      check("iron ingots via mining + furnace smelting", r.ok && inv.count(c, "minecraft:iron_ingot") >= 2, `iron=${inv.count(c, "minecraft:iron_ingot")} raw=${inv.count(c, "minecraft:raw_iron")} ${r.err ?? ""}`);
    }

    // 6) ordem em texto pela fila do cérebro
    c.rec.paused = false;
    const sandBefore = inv.count(c, "minecraft:sand");
    command(c, "pega 3 areia");
    const done = await waitUntil(() => c.rec.goals.length === 0 && !c.job?.desc || (c.job?.desc?.type === "stay"), 2400);
    check("text command 'pega 3 areia'", done && inv.count(c, "minecraft:sand") >= sandBefore + 3, `sand=${inv.count(c, "minecraft:sand")}`);
    c.rec.paused = true;
    await system.waitTicks(2);

    // 7) construção por planta com materiais na mão
    inv.addId(c, "minecraft:cobblestone", 90);
    inv.addId(c, "minecraft:oak_planks", 40);
    inv.addId(c, "minecraft:glass", 2);
    inv.addId(c, "minecraft:wooden_door", 1);
    inv.addId(c, "minecraft:torch", 4);
    const site = { origin: { x: -2, y: Y, z: -26 }, card: 0 };
    c.entity?.teleport({ x: 0.5, y: Y + 1, z: -22.5 });
    r = await runGen(buildBlueprint(c, "abrigo", { site }), 3600);
    const plan = BLUEPRINTS.abrigo.build();
    let okBlocks = 0;
    for (const b of plan) {
      if (b.m === "door_upper" || b.m === "air") continue;
      const w = toWorld(site, b);
      const id = dim.getBlock(w)?.typeId;
      const want = blueprintBlock(b.m, "oak");
      const solid = ["planks", "cobble", "stone_bricks", "log", "slab"].includes(b.m) && id && id !== "minecraft:air" && !/water|grass$|flower/.test(id);
      if (id === want || solid || (b.m === "glass" && id === "minecraft:air") || (b.m.startsWith("lantern") && id && id !== "minecraft:air")) okBlocks++;
    }
    const total = plan.filter((b) => b.m !== "door_upper" && b.m !== "air").length;
    check("build 'abrigo' from blueprint", r.ok && okBlocks / total >= 0.9, `${okBlocks}/${total} ${r.err ?? ""}`);

    // 8) combate: zumbi perto
    const z = dim.spawnEntity("minecraft:zombie", { x: c.pos().x + 4, y: Y + 1, z: c.pos().z });
    r = await runGen(defend(c), 600);
    check("defend: kills zombie", !z.isValid || (z.getComponent("minecraft:health")?.currentValue ?? 0) <= 0, r.err ?? "");

    // 9) dispensar e invocar de novo sem perder nada
    const countBefore = inv.totalItems(c);
    c.rec.paused = false;
    dismiss(c);
    await system.waitTicks(4);
    check("dismiss stores body", !c.alive() && !!c.rec.saved?.sid);
    const back = restoreBodyForTest(c, dim, { x: 0.5, y: Y + 1, z: 0.5 });
    await system.waitTicks(4);
    check("resummon restores full inventory", !!back && c.alive() && inv.totalItems(c) === countBefore, `before=${countBefore} after=${inv.totalItems(c)}`);
    c.rec.summoned = true;
    c.rec.paused = true;

    // 10) derrota -> volta em 20 s exatos e retoma o plano
    c.rec.goals = [{ type: "gather", args: { item: { group: "log" }, count: 1 }, origin: "cmd" }];
    const itemsBefore = inv.totalItems(c);
    const t0 = system.currentTick;
    c.entity?.applyDamage(5000);
    await system.waitTicks(2);
    check("lethal hit -> defeat (no death)", !!c.rec.defeat);
    await waitUntil(() => !c.alive(), 80);
    check("body stored during defeat", !c.alive());
    const back2 = await waitUntil(() => !c.rec.defeat && c.alive(), RESPAWN_TICKS + 80);
    const dt = system.currentTick - t0;
    check("respawn after exactly 400 ticks (20 s)", back2 && dt >= RESPAWN_TICKS - 2 && dt <= RESPAWN_TICKS + 10, `ticks=${dt}`);
    check("inventory kept after defeat", inv.totalItems(c) === itemsBefore, `before=${itemsBefore} after=${inv.totalItems(c)}`);
    check("plan resumed after defeat", c.rec.goals.length === 1 && c.rec.goals[0].type === "gather");
    c.rec.goals = [];

    // 11) persistência
    c.flush();
    const saved = readJSON(world, recKey(OWNER), null);
    check("record persisted", saved?.ownerId === OWNER && saved.stats.blocks > 0, `blocks=${saved?.stats?.blocks}`);

    // 12) construção do jogador intacta no fim
    check("player planks wall intact", [-5, 0, 5].every((zz) => dim.getBlock({ x: 20, y: Y + 2, z: zz })?.typeId === "minecraft:oak_planks"));

    // 12a) perto primeiro: uma árvore a 4 blocos e outra lembrada lá longe — ela tem que ir na de perto
    {
      const tree = (x, z) => {
        cmd(dim, `fill ${x - 2} ${Y + 4} ${z - 2} ${x + 2} ${Y + 5} ${z + 2} oak_leaves`);
        cmd(dim, `fill ${x} ${Y + 1} ${z} ${x} ${Y + 5} ${z} oak_log`);
      };
      tree(26, -8);
      tree(-28, -28);
      c.mem.remember("tree", { x: -28, y: Y + 1, z: -28 }, dim.id);
      c.entity?.teleport({ x: 22.5, y: Y + 1, z: -8.5 });
      await system.waitTicks(4);
      const have = inv.count(c, { group: "log" });
      const rn = await runGen(obtain(c, { group: "log" }, have + 2), 900);
      check("nearest resource first (ignores far remembered tree)", rn.ok && dim.getBlock({ x: 26, y: Y + 1, z: -8 })?.typeId !== "minecraft:oak_log" &&
        dim.getBlock({ x: -28, y: Y + 1, z: -28 })?.typeId === "minecraft:oak_log", rn.err ?? "");
    }

    // 12b) regressão do crash: cercada por blocos do jogador, mandada minerar fundo
    {
      const bx = 24, bz = 20;
      cmd(dim, `fill ${bx - 2} ${Y + 1} ${bz - 2} ${bx + 2} ${Y + 4} ${bz + 2} oak_planks`);
      cmd(dim, `fill ${bx - 2} ${Y - 4} ${bz - 2} ${bx + 2} ${Y} ${bz + 2} oak_planks`);
      cmd(dim, `fill ${bx} ${Y + 1} ${bz} ${bx} ${Y + 2} ${bz} air`);
      c.entity?.teleport({ x: bx + 0.5, y: Y + 1, z: bz + 0.5 });
      await system.waitTicks(2);
      stats.maxStepMs = 0;
      const t0 = system.currentTick;
      const rr = await runGen(mineFor(c, { types: ["minecraft:diamond_ore"], item: "minecraft:diamond", want: 1, depth: -50, tier: "none", label: "diamante" }), 1200);
      const dt = system.currentTick - t0;
      check("trapped deep-mining never hangs (crash fix)", dt > 5 && stats.maxStepMs < 60, `ticks=${dt} maxStep=${stats.maxStepMs}ms ${rr.err ?? ""}`);
      check("trapped: player blocks untouched", dim.getBlock({ x: bx + 1, y: Y + 1, z: bz })?.typeId === "minecraft:oak_planks");
      cmd(dim, `fill ${bx - 2} ${Y + 1} ${bz - 2} ${bx + 2} ${Y + 4} ${bz + 2} air`);
      cmd(dim, `fill ${bx - 2} ${Y - 4} ${bz - 2} ${bx + 2} ${Y - 1} ${bz + 2} stone`);
      cmd(dim, `fill ${bx - 2} ${Y} ${bz - 2} ${bx + 2} ${Y} ${bz + 2} grass_block`);
      c.entity?.teleport({ x: 0.5, y: Y + 1, z: 0.5 });
      await system.waitTicks(2);
    }

    // 12c) andar com física (sem teleporte): chega ao destino
    {
      c.entity?.teleport({ x: 0.5, y: Y + 1, z: 4.5 });
      await system.waitTicks(4);
      const r2 = await runGen(goTo(c, { x: 12.5, y: Y + 1, z: -2.5 }, { reach: 1.5, allowTeleport: false }), 600);
      const q = c.pos();
      check("physics walking reaches target", r2.ok && Math.hypot(q.x - 12.5, q.z + 2.5) < 2.5, `pos=${q.x.toFixed(1)},${q.z.toFixed(1)} ${r2.err ?? ""}`);
    }

    // 13) autonomia: sem ordens, ela decide sozinha e faz algo útil
    if (!quick) {
      const blocks0 = c.rec.stats.blocks, crafted0 = c.rec.stats.crafted;
      stats.maxStepMs = 0;
      const seen = new Set();
      c.rec.mode = "auto";
      c.rec.goals = [];
      c.rec.paused = false;
      const t1 = system.currentTick;
      while (system.currentTick - t1 < 1800) {
        const g = c.job?.desc?.type;
        if (g) seen.add(g);
        await system.waitTicks(20);
      }
      c.rec.paused = true;
      check("autonomy: slowest script step under 60 ms", stats.maxStepMs < 60, `maxStep=${stats.maxStepMs}ms`);
      check("autonomy chooses and works on its own", c.rec.stats.blocks + c.rec.stats.crafted > blocks0 + crafted0 && seen.size >= 1,
        `goals=[${[...seen].join(",")}] blocks+${c.rec.stats.blocks - blocks0} crafted+${c.rec.stats.crafted - crafted0}`);
    }

    // 14) intents prontos (sem rodar)
    handleIntents(c, [{ type: "stay" }]);
    check("mode stay", c.rec.mode === "stay");
    void ItemStack;
  } catch (e) {
    log(`FAIL exception :: ${e}${e?.stack ? " " + String(e.stack).split("\n").slice(0, 3).join(" | ") : ""}`);
    results.push({ name: "exception", ok: false });
  } finally {
    const pass = results.filter((r) => r.ok).length;
    log(`DONE pass=${pass} fail=${results.length - pass}`);
    running = false;
  }
}
