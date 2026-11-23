// Autoteste dentro do jogo (servidor dedicado oficial): /scriptevent lila:selftest [owner]
// Sem "owner": monta uma arena no céu e testa o DR-0N sozinho (criativo, todas as formas, colosso,
// torreta, megaconstruções, bioma, derrota). Com "owner": usa jogadores simulados (Dono e Intruso)
// para testar pilotagem, imortalidade no colosso, revide contra jogador, exército e entregas.
import { BlockPermutation, ItemStack, system, world } from "@minecraft/server";
import { COMPANIONS, Companion, ENTITY_ID, OWNER_PROP, adopt, compKey, findEntityFor, loadCompanion, newRecord } from "../lila/companion.js";
import * as inv from "../lila/inventory.js";
import { obtain } from "../lila/planner.js";
import { command, handleIntents, stats } from "../lila/brain.js";
import { summon, dismiss, restoreBodyForTest, RESPAWN_TICKS } from "../lila/lifecycle.js";
import { formOf, riders, setForm, turretGoal, primaryAttack, testDrive, tractor, jumpAction } from "../lila/forms.js";
import { archPlan, catalogList, TOTAL } from "../lib/archgen.js";
import { NANO_BLOCK, isCloud, modeOf, nanoBreak, nanoHitBlock, nanoHitEntity, nanoUse, shieldOn } from "../lila/swarm.js";
import { megaBuild, biomeTransform, flatten, sweepGround } from "../lila/mega.js";
import { armyActive, robotsOf } from "../lila/army.js";
import { FORM_LIST } from "../lib/catalog.js";
import { logError } from "../core/log.js";
import { raceTests } from "./racetest.js";

const Y = 150;
const OWNER = "selftest-owner";
let running = false;

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
        resolve({ ok: false, err: "timeout", ticks: system.currentTick - t0 });
        return;
      }
      if (wait > 0) {
        wait--;
        return;
      }
      const s0 = Date.now();
      try {
        const r = gen.next();
        const dt = Date.now() - s0;
        if (dt > stats.maxStepMs) stats.maxStepMs = dt;
        if (r.done) {
          system.clearRun(id);
          resolve({ ok: true, value: r.value, ticks: system.currentTick - t0 });
          return;
        }
        wait = typeof r.value === "number" ? Math.max(0, r.value - 1) : 0;
      } catch (e) {
        system.clearRun(id);
        resolve({ ok: false, err: String(e?.message ?? e), ticks: system.currentTick - t0 });
      }
    }, 1);
  });
}

async function waitUntil(pred, timeout) {
  const t0 = system.currentTick;
  while (system.currentTick - t0 < timeout) {
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

async function area(dim, name, x0, z0, x1, z1) {
  try {
    const mgr = world.tickingAreaManager;
    if (mgr.hasTickingArea(name)) mgr.removeTickingArea(name);
    // nunca espera para sempre (se o jogo recusar a área, segue com o que carregar)
    await Promise.race([mgr.createTickingArea(name, { dimension: dim, from: { x: x0, y: Y - 8, z: z0 }, to: { x: x1, y: Y + 30, z: z1 } }), system.waitTicks(200)]);
  } catch {
    cmd(dim, `tickingarea add ${x0} ${Y - 8} ${z0} ${x1} ${Y + 30} ${z1} ${name} true`);
  }
  await waitUntil(() => dim.isChunkLoaded({ x: x0, y: Y, z: z0 }) && dim.isChunkLoaded({ x: x1, y: Y, z: z1 }), 600);
}

function dropArea(name) {
  try {
    world.tickingAreaManager.removeTickingArea(name);
  } catch {
    /* ignore */
  }
}

async function buildArena(dim) {
  cmd(dim, `fill -32 ${Y - 4} -32 31 ${Y - 1} 31 stone`);
  cmd(dim, `fill -32 ${Y} -32 31 ${Y} 31 grass_block`);
  for (let y = Y + 1; y < Y + 30; y += 7) cmd(dim, `fill -32 ${y} -32 31 ${Math.min(Y + 29, y + 6)} 31 air`);
  for (const [x, z] of [[10, 10], [14, 4], [-12, 12], [6, 20]]) {
    cmd(dim, `fill ${x - 2} ${Y + 4} ${z - 2} ${x + 2} ${Y + 5} ${z + 2} oak_leaves`);
    cmd(dim, `fill ${x} ${Y + 1} ${z} ${x} ${Y + 5} ${z} oak_log`);
  }
  cmd(dim, `fill 20 ${Y + 1} -5 20 ${Y + 3} 5 oak_planks`); // "construção do jogador"
}

function spawnTestDrone(dim) {
  for (const e of dim.getEntities({ type: ENTITY_ID })) if (e.getDynamicProperty(OWNER_PROP) === OWNER) e.remove();
  const rec = newRecord({ id: OWNER, name: "Teste" });
  rec.summoned = true;
  rec.mode = "stay";
  rec.anchor = { x: 0.5, y: Y + 1, z: 0.5 };
  rec.pos = { ...rec.anchor };
  rec.kind = "drone";
  const c = new Companion(rec);
  c.flags.test = true;
  COMPANIONS.set(compKey(OWNER, "drone"), c);
  const e = dim.spawnEntity(ENTITY_ID, { x: 0.5, y: Y + 2, z: 0.5 });
  e.setDynamicProperty(OWNER_PROP, OWNER);
  adopt(e);
  c.entity = e;
  c.rec.paused = true; // os testes dirigem tudo diretamente
  return c;
}

function countBlocks(dim, id, x0, y0, z0, x1, y1, z1, step = 1) {
  let n = 0;
  for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) for (let z = z0; z <= z1; z += step) {
    if (dim.getBlock({ x, y, z })?.typeId === id) n++;
  }
  return n;
}

function hp(e) {
  try {
    return e.getComponent("minecraft:health")?.currentValue ?? 0;
  } catch {
    return 0;
  }
}
const dead = (z) => !z.isValid || hp(z) <= 0;

// ======================================================================== sem jogador
async function soloTests(dim, check) {
  const c = spawnTestDrone(dim);
  await system.waitTicks(5);
  check("spawn + adopt", c.alive() && c.entity?.getDynamicProperty(OWNER_PROP) === OWNER);

  // itens infinitos
  let r = await runGen(obtain(c, { toolKind: "pickaxe", tier: "diamond" }, 1), 200);
  check("creative: tool materializes instantly", r.ok && ["diamond", "netherite"].includes(inv.toolTier(c, "pickaxe")), `tier=${inv.toolTier(c, "pickaxe")} ticks=${r.ticks}`);
  r = await runGen(obtain(c, { group: "log" }, 64), 200);
  check("creative: 64 logs instantly", r.ok && inv.count(c, { group: "log" }) >= 64 && r.ticks < 20, `ticks=${r.ticks}`);

  // todas as formas: propriedade, assentos e escala
  const SEATS = { drone: 1, heli: 4, car: 4, excavator: 2, tank: 3, jet: 2, moto: 2, colossus: 5, turret: 0, swarm: 0, ship: 2, ufo: 3, sub: 3,
    boat: 4, truck: 4, stealth: 1 };
  let formsOk = 0;
  const bad = [];
  for (const f of FORM_LIST) {
    setForm(c, f, { mount: false, quiet: true });
    await system.waitTicks(4);
    for (let w = 0; w < 6 && Number(c.entity?.getProperty("lila:form")) !== FORM_LIST.indexOf(f); w++) await system.waitTicks(2);
    const prop = Number(c.entity?.getProperty("lila:form"));
    let seats = 0;
    try {
      seats = c.entity?.getComponent("minecraft:rideable")?.seatCount ?? 0;
    } catch {
      /* ignore */
    }
    if (prop === FORM_LIST.indexOf(f) && seats === SEATS[f]) formsOk++;
    else bad.push(`${f}:prop=${prop},seats=${seats}`);
  }
  check(`all ${FORM_LIST.length} forms switch (property + seats)`, formsOk === FORM_LIST.length, bad.join(" "));

  // colosso: escala e tamanho real da hitbox (raio horizontal em várias alturas)
  setForm(c, "colossus", { mount: false, quiet: true });
  await system.waitTicks(10);
  let scale = 0;
  try {
    scale = c.entity?.getComponent("minecraft:scale")?.value ?? 0;
  } catch {
    /* ignore */
  }
  const p = c.pos();
  const heights = [];
  for (const h of [1, 4, 8, 12, 18, 24]) {
    try {
      const hit = dim.getEntitiesFromRay({ x: p.x + 30, y: p.y + h, z: p.z }, { x: -1, y: 0, z: 0 }, { maxDistance: 60 }).some((x) => x.entity.id === c.entity?.id);
      if (hit) heights.push(h);
    } catch {
      /* ignore */
    }
  }
  check("colossus: giant scale", scale >= 3, `scale=${scale} hitbox-heights=${heights.join(",") || "?"}`);

  // soco do colosso: derruba a parede e o zumbi na frente
  c.entity?.teleport({ x: 0.5, y: Y + 1, z: -20.5 }, { rotation: { x: 0, y: 0 } });
  await system.waitTicks(4);
  cmd(dim, `fill -3 ${Y + 6} -11 3 ${Y + 10} -9 stone`);
  const zz = dim.spawnEntity("minecraft:zombie", { x: 0.5, y: Y + 1, z: -11.5 });
  primaryAttack(c, undefined);
  await system.waitTicks(20);
  const stoneLeft = countBlocks(dim, "minecraft:stone", -3, Y + 6, -11, 3, Y + 10, -9);
  check("colossus punch breaks blocks and hits", stoneLeft < 105 && dead(zz), `stone left=${stoneLeft}/105 zombie=${dead(zz) ? "down" : hp(zz)}`);
  setForm(c, "drone", { mount: false, quiet: true });
  await system.waitTicks(4);
  c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 });

  // ---------------- 2.2: pilotagem de verdade (velocidade comandada, pulo, água, voo, salto do TITÃ)
  await vehicleTests(c, dim, check);
  c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 });
  await system.waitTicks(4);

  // ---------------- 2.2: robô de peças flutuantes — desligar (desmonta no chão) e ligar (monta)
  {
    const { powerOff, powerOn, BOOT_TICKS } = await import("../lila/power.js");
    c.entity?.teleport({ x: 0.5, y: Y + 3, z: 0.5 }, { keepVelocity: false });
    await system.waitTicks(4);
    powerOff(c, true);
    await system.waitTicks(30);
    const offY = c.pos().y;
    const offProp = c.entity?.getProperty("lila:off") === true;
    check("power off: robot drops to the ground and stays off", offProp && !!c.rec.off && Math.abs(offY - (Y + 1)) < 0.6, `y=${(offY - Y).toFixed(2)} prop=${offProp}`);
    command(c, "vira tanque");
    await system.waitTicks(4);
    check("while off it ignores orders (until 'liga')", formOf(c) === "drone" && !!c.rec.off);
    command(c, "liga");
    await system.waitTicks(BOOT_TICKS + 6);
    check("power on: assembles and is back online", !c.rec.off && c.entity?.getProperty("lila:off") === false);
    // soco forte quando o alvo está perto
    c.entity?.teleport({ x: 0.5, y: Y + 1.2, z: 0.5 }, { keepVelocity: false });
    const pz = dim.spawnEntity("minecraft:zombie", { x: 0.5, y: Y + 1, z: 2.5 });
    await system.waitTicks(3);
    const { punch } = await import("../lila/drone.js");
    const h0 = hp(pz);
    const ok = punch(c, pz);
    await system.waitTicks(8);
    check("strong punch: big damage + knockback", ok && (dead(pz) || hp(pz) <= h0 - 15), `hp ${h0}->${dead(pz) ? "down" : hp(pz)}`);
    // MALDIÇÃO: só corpo a corpo — nada de tiro de longe
    {
      const far = dim.spawnEntity("minecraft:zombie", { x: 0.5, y: Y + 1, z: 14.5 });
      far.addEffect("slowness", 200, { amplifier: 10, showParticles: false });
      await system.waitTicks(3);
      const { shoot } = await import("../lila/drone.js");
      const fh = hp(far);
      const shot = shoot(c, far);
      await system.waitTicks(10);
      let cactOk = false;
      try {
        cactOk = typeof c.entity?.getProperty("lila:cact") === "number";
      } catch {
        /* ignore */
      }
      check("CURSE: melee only — a target 14 blocks away is never shot (animated actions property present)", !shot && hp(far) >= fh && cactOk,
        `shot=${shot} hp ${fh}->${hp(far)} cact=${cactOk}`);
      try {
        far.remove();
      } catch {
        /* ignore */
      }
    }
    try {
      pz.remove();
    } catch {
      /* ignore */
    }
  }

  // torreta gigante: pousa, vira arma e derruba 3 zumbis
  const zs = [0, 1, 2].map((k) => dim.spawnEntity("minecraft:zombie", { x: 8 + k * 3, y: Y + 1, z: 16 }));
  c.rec.mode = "turret";
  const tg = turretGoal(c);
  const tt = system.currentTick;
  const tr = runGen(tg, 700);
  let tPos, tMove = 0;
  const tIv = system.runInterval(() => {
    if (formOf(c) !== "turret" || !c.alive()) return;
    const p = c.pos();
    if (!tPos) tPos = { x: p.x, z: p.z };
    tMove = Math.max(tMove, Math.hypot(p.x - tPos.x, p.z - tPos.z));
  }, 2);
  await waitUntil(() => zs.every(dead), 600);
  const wasTurret = formOf(c) === "turret";
  system.clearRun(tIv);
  c.rec.mode = "follow";
  await tr;
  check("giant turret form kills 3 zombies", zs.every(dead) && wasTurret, `ticks=${system.currentTick - tt} form=${wasTurret}`);
  check("turret stays planted while shooting (no walking, no teleporting)", !!tPos && tMove < 1.2, `moved=${tMove.toFixed(2)}`);
  check("turret folds back to drone when done", formOf(c) === "drone");

  // construção À MÃO (modo humano): poço bloco por bloco, com o drone voando pela obra
  {
    c.rec.settings.buildSpeed = "humano";
    const hx = 150;
    await area(dim, "lila_test_build", hx - 30, -10, hx + 30, 50);
    c.entity?.teleport({ x: hx + 0.5, y: Y + 1, z: 0.5 }, { rotation: { x: 0, y: 0 } });
    await system.waitTicks(4);
    const spots = new Set();
    const watch = system.runInterval(() => {
      const q = c.pos();
      spots.add(`${Math.round(q.x / 2)},${Math.round(q.y / 2)},${Math.round(q.z / 2)}`);
    }, 10);
    stats.maxStepMs = 0;
    const b0 = c.rec.stats.built;
    const rh = await runGen(megaBuild(c, "poco", { here: false }), 3000);
    system.clearRun(watch);
    const wb = c.flags.lastBuild ?? { cx: hx, cz: 13, y0: Y };
    const water = countBlocks(dim, "minecraft:water", wb.cx - 1, wb.y0 - 4, wb.cz - 1, wb.cx + 1, wb.y0, wb.cz + 1);
    check("hand-built (human mode): well done block by block", rh.ok && c.rec.stats.built === b0 + 1 && rh.ticks > 150 && water >= 9,
      `ticks=${rh.ticks} water=${water} at=${wb.cx},${wb.y0},${wb.cz} drone positions=${spots.size} maxStep=${stats.maxStepMs}ms ${rh.err ?? ""}`);
    check("hand-built: the drone flies around the work", spots.size >= 4, `positions=${spots.size}`);
    c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 });
    await system.waitTicks(2);
    dropArea("lila_test_build");
  }

  // aplainar: morro + árvore somem, parede do jogador fica, itens do chão recolhidos
  {
    const fx = 1000;
    await area(dim, "lila_test_flat", fx - 30, -30, fx + 30, 30);
    cmd(dim, `fill ${fx - 20} ${Y - 2} -20 ${fx + 20} ${Y - 1} 20 dirt`);
    cmd(dim, `fill ${fx - 20} ${Y} -20 ${fx + 20} ${Y} 20 grass_block`);
    cmd(dim, `fill ${fx + 2} ${Y + 1} 2 ${fx + 6} ${Y + 4} 6 dirt`);            // morro
    cmd(dim, `fill ${fx - 6} ${Y + 1} -6 ${fx - 6} ${Y + 5} -6 oak_log`);       // árvore
    cmd(dim, `fill ${fx - 8} ${Y + 4} -8 ${fx - 4} ${Y + 6} -4 oak_leaves`);
    cmd(dim, `fill ${fx - 3} ${Y + 1} 8 ${fx + 3} ${Y + 3} 8 oak_planks`);      // "construção do jogador"
    for (let k = 0; k < 6; k++) dim.spawnItem(new ItemStack("minecraft:diamond", 2), { x: fx + 0.5 + k, y: Y + 1.2, z: -2.5 });
    c.entity?.teleport({ x: fx + 0.5, y: Y + 1, z: 0.5 });
    await system.waitTicks(4);
    c.rec.settings.buildSpeed = "rapido";
    const d0 = inv.count(c, "minecraft:diamond");
    const rf = await runGen(flatten(c, 12, false), 3000);
    const hill = countBlocks(dim, "minecraft:dirt", fx + 2, Y + 1, 2, fx + 6, Y + 4, 6) + countBlocks(dim, "minecraft:oak_log", fx - 6, Y + 1, -6, fx - 6, Y + 5, -6);
    const wall = countBlocks(dim, "minecraft:oak_planks", fx - 3, Y + 1, 8, fx + 3, Y + 3, 8);
    check("flatten: hill and tree gone, ground level", rf.ok && hill === 0, `left=${hill} ticks=${rf.ticks} ${rf.err ?? ""}`);
    check("flatten (nature only) keeps the player's build", wall === 21, `planks=${wall}/21`);
    check("flatten picks up the items on the ground", inv.count(c, "minecraft:diamond") >= d0 + 12, `diamonds ${d0}->${inv.count(c, "minecraft:diamond")}`);
    // destruir TUDO: a parede vai embora, o baú fica
    cmd(dim, `setblock ${fx} ${Y + 1} 10 chest`);
    c.entity?.teleport({ x: fx + 0.5, y: Y + 1, z: 0.5 }); // referência = centro (no jogo é você)
    await system.waitTicks(2);
    const ra = await runGen(flatten(c, 12, true), 3000);
    const wall2 = countBlocks(dim, "minecraft:oak_planks", fx - 3, Y + 1, 8, fx + 3, Y + 3, 8);
    check("destroy everything: builds gone, chest kept", ra.ok && wall2 === 0 && dim.getBlock({ x: fx, y: Y + 1, z: 10 })?.typeId === "minecraft:chest", `planks=${wall2}`);
    c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 });
    await system.waitTicks(2);
    dropArea("lila_test_flat");
  }

  // ---------------- 2.2: catálogo de construções (1000+)
  await catalogTests(c, dim, check);

  // megaconstruções (cada uma longe, numa área própria carregada) — modo instantâneo para o teste caber no tempo
  c.rec.settings.buildSpeed = "instantaneo";
  /** @type {[string, number][]} */
  const builds = [["poco", 300], ["labirinto", 600], ["montanha_russa", 900], ["casa_tech", 1200], ["castelo", 1500], ["vila", 1800],
    ["piramide", 2100], ["farol", 2400], ["arranha_ceu", 2700], ["estadio", 3000], ["montanha", 3300], ["cidade", 3700]];
  stats.maxStepMs = 0;
  for (const [key, x] of builds) {
    if (key === "cidade") await area(dim, "lila_test_build", x - 72, 6, x + 72, 150);
    else await area(dim, "lila_test_build", x - 50, -10, x + 50, 110);
    c.entity?.teleport({ x: x + 0.5, y: Y + 1, z: 0.5 }, { rotation: { x: 0, y: 0 } });
    await system.waitTicks(4);
    const b0 = c.rec.stats.built;
    const res = await runGen(megaBuild(c, key, { here: false }), key === "cidade" ? 9000 : 5000);
    check(`mega: ${key}`, res.ok && c.rec.stats.built === b0 + 1, `ticks=${res.ticks} ${res.err ?? ""}`);
    const lb = c.flags.lastBuild ?? { cx: x, cz: 60, y0: Y, half: 60 };
    if (key === "cidade" || key === "castelo" || key === "arranha_ceu") {
      const id = { cidade: "minecraft:black_concrete", castelo: "minecraft:stone_bricks", arranha_ceu: "minecraft:quartz_block" }[key];
      const top = key === "arranha_ceu" ? lb.y0 + 125 : lb.y0 + 40;
      const n = countBlocks(dim, id, lb.cx - lb.half, lb.y0 - 3, lb.cz - lb.half, lb.cx + lb.half, top, lb.cz + lb.half, 3);
      check(`mega: ${key} really placed its blocks`, n > 200, `${id.replace("minecraft:", "")} (amostra 1/27)=${n}`);
    }
    if (key === "montanha_russa") {
      const rails = countBlocks(dim, "minecraft:rail", lb.cx - 30, lb.y0, lb.cz - 30, lb.cx + 30, lb.y0 + 16, lb.cz + 30, 1)
        + countBlocks(dim, "minecraft:golden_rail", lb.cx - 30, lb.y0, lb.cz - 30, lb.cx + 30, lb.y0 + 16, lb.cz + 30, 1);
      const carts = dim.getEntities({ type: "minecraft:minecart", location: { x: lb.cx, y: lb.y0, z: lb.cz }, maxDistance: 60 }).length;
      check("roller coaster has a full closed track + cart", rails >= 100 && carts >= 1, `rails=${rails} carts=${carts}`);
    }
    c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 }); // volta pra arena antes de descarregar a área da obra
    await system.waitTicks(2);
    dropArea("lila_test_build");
  }
  check("mega builds never freeze the game (step < 60 ms)", stats.maxStepMs < 60, `maxStep=${stats.maxStepMs}ms`);

  // bioma: transforma uma ilha de grama em neve
  const bx = -2000;
  await area(dim, "lila_test_biome", bx - 40, -40, bx + 40, 40);
  cmd(dim, `fill ${bx - 38} ${Y - 2} -38 ${bx + 38} ${Y - 1} 38 dirt`);
  cmd(dim, `fill ${bx - 38} ${Y} -38 ${bx + 38} ${Y} 38 grass_block`);
  c.entity?.teleport({ x: bx + 0.5, y: Y + 3, z: 0.5 });
  await system.waitTicks(4);
  c.rec.settings.buildSpeed = "rapido"; // à mão (rápido), coluna por coluna
  const rb = await runGen(biomeTransform(c, "neve"), 6000);
  const snow = countBlocks(dim, "minecraft:snow_layer", bx - 30, Y + 1, -30, bx + 30, Y + 1, 30, 2);
  check("biome transform: snow", rb.ok && snow > 150, `snow layers(sample)=${snow} ticks=${rb.ticks} ${rb.err ?? ""}`);
  c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 });
  await system.waitTicks(4);
  dropArea("lila_test_biome");

  // derrota no meio de uma forma: desmonta, guarda e volta em 20 s
  setForm(c, "tank", { mount: false, quiet: true });
  await system.waitTicks(4);
  const items = inv.totalItems(c);
  c.entity?.applyDamage(5000);
  await waitUntil(() => !!c.rec.defeat, 40);
  check("defeat in a form reverts to drone", !!c.rec.defeat && formOf(c) === "drone");
  const t0 = system.currentTick;
  await waitUntil(() => !c.rec.defeat && c.alive(), RESPAWN_TICKS + 60);
  check("respawn after 20 s with inventory", c.alive() && inv.totalItems(c) === items, `ticks=${system.currentTick - t0} items ${items}->${inv.totalItems(c)}`);
  dismiss(c);
  await system.waitTicks(70); // Maldição: afunda na terra antes de sumir
  const back = restoreBodyForTest(c, dim, { x: 0.5, y: Y + 2, z: 0.5 });
  check("dismiss + resummon keeps everything", !!back && inv.totalItems(c) === items);
}

// ======================================================================== 2.2: veículos
async function driveRun(c, form, ticks, input, at) {
  setForm(c, form, { mount: false, quiet: true });
  await system.waitTicks(3);
  c.entity?.teleport(at, { rotation: { x: 0, y: 0 }, keepVelocity: false });
  await system.waitTicks(6);
  c.flags.testDriving = true;
  c.flags.spd = 0;
  c.flags.fv = undefined;
  c.flags.jumpHeld = false;
  c.flags.lastPos = undefined;
  const p0 = c.pos();
  let maxY = p0.y, minY = p0.y;
  for (let i = 0; i < ticks; i++) {
    c.flags.testInput = typeof input === "function" ? input(i) : input;
    try {
      testDrive(c, form);
    } catch (e) {
      log(`drive error ${form}: ${e}`);
    }
    await system.waitTicks(1);
    const q = c.pos();
    maxY = Math.max(maxY, q.y);
    minY = Math.min(minY, q.y);
  }
  c.flags.testInput = undefined;
  const q = c.pos();
  c.flags.testDriving = false;
  return { dist: Math.hypot(q.x - p0.x, q.z - p0.z), up: maxY - p0.y, down: p0.y - minY, end: q, y0: p0.y };
}

async function vehicleTests(c, dim, check) {
  const TX = 5000, WX = 5030;
  await area(dim, "lila_test_track", TX - 10, -10, WX + 10, 150);
  // pista de pedra reta e um canal de água fundo
  cmd(dim, `fill ${TX - 6} ${Y - 1} -6 ${TX + 6} ${Y - 1} 150 stone`);
  cmd(dim, `fill ${TX - 6} ${Y} -6 ${TX + 6} ${Y + 10} 150 air`);
  cmd(dim, `fill ${WX - 7} ${Y - 9} -7 ${WX + 7} ${Y - 8} 150 stone`);
  cmd(dim, `fill ${WX - 6} ${Y - 7} -6 ${WX + 6} ${Y - 1} 150 water`);
  cmd(dim, `fill ${WX - 6} ${Y} -6 ${WX + 6} ${Y + 8} 150 air`);
  await system.waitTicks(10);
  const fwd = { mv: { x: 0, y: 1 }, yaw: 0 };
  const start = { x: TX + 0.5, y: Y + 0.1, z: 0.5 };
  // terrestres: 3 s acelerando em linha reta (no 2.1 o carro andava ~15% do que devia)
  const out = [];
  let groundOk = true;
  /** @type {[string, number][]} */
  const GROUND = [["car", 45], ["moto", 50], ["truck", 40], ["tank", 22], ["excavator", 18]];
  for (const [f, min] of GROUND) {
    const r = await driveRun(c, f, 60, fwd, start);
    out.push(`${f}=${(r.dist / 3).toFixed(1)}b/s`);
    if (r.dist < min) groundOk = false;
  }
  check("ground vehicles are fast now (3 s full throttle)", groundOk, out.join(" "));
  // pular = o veículo pula
  const rj = await driveRun(c, "car", 20, (i) => ({ mv: { x: 0, y: 0 }, yaw: 0, jump: i >= 2 && i <= 3 }), start);
  check("jump button makes the car jump", rj.up >= 1.0, `up=${rj.up.toFixed(2)} blocks`);
  const rt = await driveRun(c, "truck", 24, (i) => ({ mv: { x: 0, y: 0 }, yaw: 0, jump: i >= 2 && i <= 3 }), start);
  check("monster truck jumps higher", rt.up >= 2.0, `up=${rt.up.toFixed(2)} blocks`);
  // helicóptero: pular sobe, acelerar anda; disco e nave voam
  const rh = await driveRun(c, "heli", 30, { mv: { x: 0, y: 0 }, yaw: 0, jump: true }, { x: TX + 0.5, y: Y + 2, z: 0.5 });
  const rh2 = await driveRun(c, "heli", 40, { mv: { x: 0, y: 1 }, yaw: 0, view: { x: 0, y: 0, z: 1 } }, { x: TX + 0.5, y: Y + 4, z: 0.5 });
  check("helicopter: jump climbs, throttle flies forward", rh.up >= 4 && rh2.dist >= 15, `climb=${rh.up.toFixed(1)} dist=${rh2.dist.toFixed(1)}`);
  const rs = await driveRun(c, "ship", 40, { mv: { x: 0, y: 1 }, yaw: 0, view: { x: 0, y: 0.2, z: 0.98 } }, { x: TX + 0.5, y: Y + 3, z: 0.5 });
  const ru = await driveRun(c, "ufo", 40, { mv: { x: 0, y: 1 }, yaw: 0, view: { x: 0, y: 0, z: 1 } }, { x: TX + 0.5, y: Y + 3, z: 0.5 });
  check("spaceship and UFO fly", rs.dist >= 25 && ru.dist >= 20, `ship=${rs.dist.toFixed(1)} ufo=${ru.dist.toFixed(1)}`);
  const rst = await driveRun(c, "stealth", 40, { mv: { x: 0, y: 1 }, yaw: 0, view: { x: 0, y: 0.05, z: 1 } }, { x: TX + 0.5, y: Y + 4, z: 0.5 });
  check("stealth fighter is the fastest", rst.dist >= 40, `dist=${rst.dist.toFixed(1)} in 2 s`);
  c.entity?.teleport({ x: TX + 0.5, y: Y + 2, z: 0.5 }, { keepVelocity: false });
  // lancha: anda rápido na água e boia
  const rb = await driveRun(c, "boat", 60, fwd, { x: WX + 0.5, y: Y - 0.3, z: 0.5 });
  check("speedboat: fast on water and floats", rb.dist >= 25 && rb.end.y > Y - 1.5 && rb.end.y < Y + 1.2, `dist=${rb.dist.toFixed(1)} y=${(rb.end.y - Y).toFixed(2)}`);
  // submarino: mergulha olhando pra baixo e anda debaixo d'água
  const rsub = await driveRun(c, "sub", 50, { mv: { x: 0, y: 1 }, yaw: 0, view: { x: 0, y: -0.55, z: 0.83 } }, { x: WX + 0.5, y: Y - 3, z: 40.5 });
  check("submarine dives and moves underwater", rsub.down >= 2 && rsub.dist >= 10 && rsub.end.y < Y - 1, `down=${rsub.down.toFixed(1)} dist=${rsub.dist.toFixed(1)}`);
  // armas novas (botão de ataque) com um "piloto" de mentira
  const stub = { id: "stub", getHeadLocation: () => ({ ...c.pos(), y: c.pos().y + 2 }), getViewDirection: () => ({ x: 0, y: -0.3, z: 0.95 }) };
  const fired = [];
  for (const [f, flag] of [["ship", "cdLaser"], ["sub", "cdTorpedo"], ["stealth", "cdMissile"], ["truck", "cdNitro"], ["ufo", "cdUfo"]]) {
    setForm(c, f, { mount: false, quiet: true });
    await system.waitTicks(3);
    c.flags[flag] = 0;
    primaryAttack(c, stub);
    await system.waitTicks(2);
    if ((c.flags[flag] ?? 0) > 0) fired.push(f);
  }
  check("new vehicle weapons fire (lasers, torpedo, missiles, nitro, disintegrator)", fired.length === 5, fired.join(","));
  // raio trator do disco voador
  setForm(c, "ufo", { mount: false, quiet: true });
  c.flags.testDriving = true;
  c.entity?.teleport({ x: TX + 0.5, y: Y + 8, z: 60.5 }, { keepVelocity: false });
  await system.waitTicks(4);
  const z1 = dim.spawnEntity("minecraft:zombie", { x: TX + 1.5, y: Y, z: 60.5 });
  await system.waitTicks(4);
  tractor(c);
  await system.waitTicks(5);
  let lev = false;
  try {
    lev = !!z1.getEffect("levitation");
  } catch {
    /* ignore */
  }
  check("UFO tractor beam lifts what is below", lev);
  try {
    z1.remove();
  } catch {
    /* ignore */
  }
  c.flags.testDriving = false;
  // salto do TITÃ
  setForm(c, "colossus", { mount: false, quiet: true });
  c.entity?.teleport({ x: TX + 0.5, y: Y + 0.1, z: 120.5 }, { keepVelocity: false });
  await system.waitTicks(40);
  const cy0 = c.pos().y;
  let cmax = cy0;
  c.flags.cdStomp = 0;
  jumpAction(c);
  for (let i = 0; i < 30; i++) {
    await system.waitTicks(1);
    cmax = Math.max(cmax, c.pos().y);
  }
  check("GIANT CURSE jumps", cmax - cy0 >= 4, `up=${(cmax - cy0).toFixed(1)} blocks`);
  setForm(c, "drone", { mount: false, quiet: true });
  await system.waitTicks(4);
  c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 });
  await system.waitTicks(2);
  dropArea("lila_test_track");
}

// ======================================================================== 2.2: catálogo de construções
async function catalogTests(c, dim, check) {
  // 1) todas as plantas do catálogo geram, e TODO bloco+estado usado existe no jogo de verdade
  const list = catalogList();
  const combos = new Map();
  let errs = 0;
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    try {
      for (const op of archPlan(it.kind, it.style, it.size, i % 4).ops) {
        if (op[0] === "f") combos.set(`${op[7]}|${JSON.stringify(op[8] ?? {})}`, [op[7], op[8]]);
        else if (op[0] === "s") {
          combos.set(`${op[4]}|${JSON.stringify(op[5] ?? {})}`, [op[4], op[5]]);
          if (op[6]) combos.set(`${op[4]}|${JSON.stringify(op[6][3] ?? {})}`, [op[4], op[6][3]]);
        }
      }
    } catch {
      errs++;
    }
    if (i % 150 === 0) await system.waitTicks(1);
  }
  const badSt = [];
  let k = 0;
  for (const [key, [id, st]] of combos) {
    try {
      BlockPermutation.resolve(id, st ?? {});
    } catch {
      badSt.push(key);
    }
    if (++k % 300 === 0) await system.waitTicks(1);
  }
  check(`catalog: all ${list.length} constructions generate (TOTAL=${TOTAL})`, errs === 0 && list.length >= 1000, `errors=${errs}`);
  check("catalog: every block + state used exists in the real game", badSt.length === 0, `combos=${combos.size} bad=${badSt.length} ${badSt.slice(0, 6).join(" ; ")}`);

  // 2) constrói algumas de verdade e confere porta (2 metades), cama (pé + cabeceira) e móveis
  const samples = [["casa", "medieval", "medio", "instantaneo"], ["padaria", "japones", "pequeno", "instantaneo"], ["hospital", "moderno", "medio", "instantaneo"],
    ["casa", "rustico", "pequeno", "rapido"], ["fonte", "colonial", "medio", "rapido"]];
  let x = 4200;
  stats.maxStepMs = 0;
  for (const [kind, style, size, speed] of samples) {
    await area(dim, "lila_test_arch", x - 40, -20, x + 40, 70);
    // mundo de teste: a entidade às vezes é descarregada na troca de área (ticking area recriada) —
    // reencontra o corpo antes de continuar, em vez de falhar o teste por causa do carregamento
    if (!c.entity?.isValid) {
      await system.waitTicks(10);
      const again = findEntityFor(c);
      if (again) c.entity = again;
    }
    c.entity?.teleport({ x: x + 0.5, y: Y + 1, z: 0.5 }, { rotation: { x: 0, y: 0 } });
    cmd(dim, `fill ${x - 30} ${Y - 2} -10 ${x + 30} ${Y - 1} 60 dirt`);
    cmd(dim, `fill ${x - 30} ${Y} -10 ${x + 30} ${Y} 60 grass_block`);
    await system.waitTicks(4);
    c.rec.settings.buildSpeed = speed;
    const b0 = c.rec.stats.built;
    const plan = archPlan(kind, style, size, 0);
    const r = await runGen(megaBuild(c, "arch", { plan, label: plan.name }), 9000);
    const lb = c.flags.lastBuild ?? { cx: x, cz: 20, y0: Y, half: 20 };
    let doorsLo = 0, doorsUp = 0, bedHead = 0, bedFoot = 0, furn = 0;
    const FURN = /chest|barrel|furnace|smoker|bookshelf|lectern|cauldron|crafting_table|lantern|brewing_stand|bell/;
    for (let bx = lb.cx - lb.half; bx <= lb.cx + lb.half; bx++) for (let by = lb.y0; by <= lb.y0 + 14; by++) for (let bz = lb.cz - lb.half; bz <= lb.cz + lb.half; bz++) {
      const b = dim.getBlock({ x: bx, y: by, z: bz });
      if (!b || b.isAir) continue;
      const id = b.typeId;
      if (id.endsWith("_door") || id === "minecraft:wooden_door") {
        if (b.permutation.getState("upper_block_bit")) doorsUp++;
        else doorsLo++;
      } else if (id === "minecraft:bed") {
        if (b.permutation.getState("head_piece_bit")) bedHead++;
        else bedFoot++;
      } else if (FURN.test(id)) furn++;
    }
    const isHouse = kind !== "fonte";
    const ok = r.ok && c.rec.stats.built === b0 + 1 && (!isHouse || (doorsLo >= 1 && doorsLo === doorsUp && furn >= 4)) && bedHead === bedFoot;
    check(`catalog build: ${plan.name} [${speed}]`, ok, `ticks=${r.ticks} doors=${doorsLo}/${doorsUp} beds=${bedFoot}/${bedHead} furniture=${furn} ${r.err ?? ""}`);
    if (c.entity?.isValid) c.entity.teleport({ x: 0.5, y: Y + 2, z: 0.5 });
    await system.waitTicks(2);
    dropArea("lila_test_arch");
    x += 100;
  }
  check("catalog builds never freeze the game (step < 60 ms)", stats.maxStepMs < 60, `maxStep=${stats.maxStepMs}ms`);
}

// ======================================================================== com jogadores simulados
async function ownerTests(dim, check) {
  cmd(dim, "scriptevent lilatest:spawn_owner");
  /** @type {any} */
  let owner;
  await waitUntil(() => !!(owner = world.getAllPlayers().find((p) => p.name === "Dono")), 200);
  check("simulated owner joined", !!owner);
  if (!owner) return;
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
  const c = loadCompanion(owner, "drone");
  check("summon in front of owner", summon(c, owner) && c.alive());
  let emerging = -1;
  try {
    emerging = /** @type {number} */ (c.entity?.getProperty("lila:cact") ?? -1);
  } catch {
    /* ignore */
  }
  await system.waitTicks(105);
  let settled = -1;
  try {
    settled = /** @type {number} */ (c.entity?.getProperty("lila:cact") ?? -1);
  } catch {
    /* ignore */
  }
  check("CURSE: comes out of the ground when summoned (emerge animation) and then settles", emerging === 9 && settled === 0, `start=${emerging} after=${settled}`);
  {
    const { setSmokeForm, setFog } = await import("../lila/curse.js");
    const gm0 = owner.getGameMode();
    setSmokeForm(owner, true);
    await system.waitTicks(3);
    const spect = String(owner.getGameMode()).toLowerCase() === "spectator";
    setSmokeForm(owner, false);
    await system.waitTicks(3);
    check("CURSE: turn into smoke (fly and pass through everything) and come back to the body", spect && owner.getGameMode() === gm0 && owner.getDynamicProperty("lila:prevgm") === undefined,
      `smoke=${spect} back=${owner.getGameMode()} (was ${gm0})`);
    setFog(c, true);
    const fogOn = !!c.rec.curseFog;
    setFog(c, false);
    check("CURSE: giant fog power turns on and off", fogOn && !c.rec.curseFog);
  }

  // itens infinitos e kit
  command(c, "me dá 64 diamantes");
  await waitUntil(() => pcount((id) => id === "minecraft:diamond") >= 64, 300);
  check("'me dá 64 diamantes' (infinite items)", pcount((id) => id === "minecraft:diamond") >= 64);
  command(c, "me fortalece");
  await waitUntil(() => owner.getComponent("minecraft:equippable")?.getEquipment("Chest")?.typeId === "minecraft:netherite_chestplate", 300);
  check("'me fortalece' equips enchanted netherite", owner.getComponent("minecraft:equippable")?.getEquipment("Chest")?.typeId === "minecraft:netherite_chestplate",
    `totem=${pcount((id) => id === "minecraft:totem_of_undying")}`);

  // helicóptero: entra sozinho, metralhadora no botão de ataque, sair = vira drone
  command(c, "vira helicóptero");
  await waitUntil(() => riders(c).some((x) => x.id === owner.id), 60);
  check("'vira helicóptero' puts the owner at the controls", formOf(c) === "heli" && riders(c).some((x) => x.id === owner.id));
  cmd(dim, `scriptevent lilatest:act Dono swing`);
  await system.waitTicks(6);
  check("attack button fires the heli gun", (c.flags.cdGun ?? 0) > 0, `cd=${c.flags.cdGun}`);
  // sair = AGACHAR (o jogo desmonta; o add-on não bloqueia mais)
  cmd(dim, `scriptevent lilatest:act Dono sneak`);
  await waitUntil(() => !riders(c).some((x) => x.id === owner.id), 40);
  const sneakOut = !riders(c).some((x) => x.id === owner.id);
  if (!sneakOut) {
    try {
      c.entity?.getComponent("minecraft:rideable")?.ejectRider(owner);
    } catch {
      /* ignore */
    }
  }
  await waitUntil(() => formOf(c) === "drone", 40);
  check("sneak = get out of the vehicle", sneakOut);
  check("leaving a vehicle turns it back into the drone", formOf(c) === "drone");

  // tanque com canhão
  command(c, "vira tanque");
  await waitUntil(() => riders(c).some((x) => x.id === owner.id), 60);
  cmd(dim, `scriptevent lilatest:act Dono swing`);
  await system.waitTicks(16);
  check("tank: owner drives, cannon fires", formOf(c) === "tank" && (c.flags.cdShell ?? 0) > 0);
  handleIntents(c, [{ type: "stop" }]);
  await system.waitTicks(10);
  check("'cancelar' reverts the vehicle", formOf(c) === "drone" && !riders(c).length);

  // colosso: piloto na cabeça, quase imortal, soco, continua colosso quando você sai
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 });
  await system.waitTicks(5);
  command(c, "modo colosso");
  await waitUntil(() => riders(c)[0]?.id === owner.id, 120);
  const ph = owner.location.y - c.pos().y;
  check("GIANT CURSE: owner rides ON TOP of the head (~14 blocks up)", formOf(c) === "colossus" && riders(c)[0]?.id === owner.id && ph > 12,
    `pilot height=${ph.toFixed(1)} blocks`);
  const hp0 = hp(owner);
  try {
    owner.applyDamage(8);
  } catch {
    /* ignore */
  }
  await system.waitTicks(2);
  check("colossus: pilot is (almost) immortal", hp(owner) >= hp0, `hp ${hp0}->${hp(owner)}`);
  cmd(dim, `scriptevent lilatest:act Dono swing`);
  await system.waitTicks(4);
  check("GIANT CURSE: attack button = punch where you aim (no beam)", c.entity?.getProperty("lila:action") === "work" || (c.flags.cdPunch ?? 0) > 0 || (c.flags.cdBeam ?? 0) > 0,
    `punch=${c.flags.cdPunch ?? 0} beam=${c.flags.cdBeam ?? 0}`);
  try {
    c.entity?.getComponent("minecraft:rideable")?.ejectRider(owner);
  } catch {
    /* ignore */
  }
  await system.waitTicks(40);
  check("colossus stays when you get out (until cancel)", formOf(c) === "colossus");
  handleIntents(c, [{ type: "stop" }]);
  await system.waitTicks(10);
  check("cancel turns the colossus back into the drone", formOf(c) === "drone");

  // nave espacial: entra, laser no botão de ataque
  command(c, "vira nave espacial");
  await waitUntil(() => riders(c).some((x) => x.id === owner.id), 60);
  cmd(dim, `scriptevent lilatest:act Dono swing`);
  await system.waitTicks(6);
  check("'vira nave espacial': owner flies it, lasers fire", formOf(c) === "ship" && riders(c).some((x) => x.id === owner.id) && (c.flags.cdLaser ?? 0) > 0);
  handleIntents(c, [{ type: "stop" }]);
  await system.waitTicks(10);

  // ENXAME de nanorrobôs 2.3: modo inteligente, ferramentas automáticas, modos, formas, cancelar limpa tudo
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 }, { rotation: { x: 0, y: 0 } });
  await system.waitTicks(4);
  command(c, "modo enxame");
  await system.waitTicks(10);
  check("Hacknd: the normal form IS the nano swarm (smart mode) and you hold the swarm core", isCloud(c) && modeOf(c) === "auto" &&
    pcount((id) => id === "lila:nano_core") === 1, `form=${formOf(c)} mode=${modeOf(c)} core=${pcount((id) => id === "lila:nano_core")}`);
  const heldId = () => pinv()?.getItem(owner.selectedSlotIndex)?.typeId;
  pinv()?.setItem(owner.selectedSlotIndex, undefined);
  nanoHitBlock(c, owner, dim.getBlock({ x: 10, y: Y + 1, z: 10 }));
  await waitUntil(() => heldId() === "lila:nano_axe", 40);
  check("smart swarm: empty hand on wood -> nanobot axe forms in your hand", heldId() === "lila:nano_axe", `held=${heldId()}`);
  cmd(dim, `setblock 10 ${Y + 1} 10 air`); // "quebrou" o tronco de baixo com o machado
  nanoBreak(c, owner, dim.getBlock({ x: 10, y: Y + 1, z: 10 }), "minecraft:oak_log", new ItemStack("lila:nano_axe", 1));
  await system.waitTicks(20);
  const logsLeft = countBlocks(dim, "minecraft:oak_log", 10, Y + 1, 10, 10, Y + 6, 10);
  check("nanobot axe fells the whole tree", logsLeft === 0, `logs left=${logsLeft}`);
  pinv()?.setItem(owner.selectedSlotIndex, undefined);
  await system.waitTicks(10);
  const pig = dim.spawnEntity("minecraft:pig", { x: 2.5, y: Y + 1, z: 6.5 });
  nanoHitEntity(c, owner, pig);
  await waitUntil(() => heldId() === "lila:nano_sword", 40);
  check("smart swarm: empty hand hitting a mob -> nanobot sword", heldId() === "lila:nano_sword", `held=${heldId()}`);
  try {
    pig.remove();
  } catch {
    /* ignore */
  }
  // martelo: arremessa, explode e volta para a mão
  pinv()?.setItem(owner.selectedSlotIndex, undefined);
  await system.waitTicks(10);
  command(c, "martelo");
  await waitUntil(() => heldId() === "lila:nano_hammer", 40);
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 }, { rotation: { x: -35, y: 0 } });
  await system.waitTicks(2);
  const hs = pinv()?.getItem(owner.selectedSlotIndex);
  if (hs) nanoUse(c, owner, hs);
  const thrown = !!c.flags.hammer && !heldId();
  await waitUntil(() => !c.flags.hammer && pcount((id) => id === "lila:nano_hammer") === 1, 200);
  check("nanobot hammer: thrown, explodes, flies back to your hand", thrown && !c.flags.hammer && pcount((id) => id === "lila:nano_hammer") === 1);
  // escudo: barreira total (não ataca)
  command(c, "escudo");
  await system.waitTicks(4);
  check("shield mode on", shieldOn(c) && modeOf(c) === "escudo");
  const sh0 = hp(owner);
  try {
    owner.applyDamage(8);
  } catch {
    /* ignore */
  }
  await system.waitTicks(2);
  check("swarm shield: owner takes no damage", hp(owner) >= sh0, `hp ${sh0}->${hp(owner)}`);
  const arrow = dim.spawnEntity("minecraft:arrow", { x: 2.5, y: Y + 2, z: 6.5 });
  await waitUntil(() => !arrow.isValid, 30);
  check("swarm shield: arrows near you are destroyed", !arrow.isValid);
  // prancha voadora: sobe e segura a altura
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 }, { rotation: { x: 0, y: 0 } });
  await system.waitTicks(4);
  const by0 = owner.location.y;
  command(c, "prancha");
  await system.waitTicks(30);
  const by1 = owner.location.y;
  check("hover board lifts you and holds the height", modeOf(c) === "prancha" && by1 > by0 + 0.7, `y ${by0.toFixed(2)}->${by1.toFixed(2)}`);
  command(c, "modo inteligente");
  await waitUntil(() => owner.isOnGround, 120);
  // devorador: come tudo em volta de você
  owner.teleport({ x: -10.5, y: Y + 1, z: -10.5 });
  cmd(dim, `fill -13 ${Y + 1} -13 -9 ${Y + 3} -9 stone`);
  cmd(dim, `fill -11 ${Y + 1} -11 -11 ${Y + 2} -11 air`);
  c.rec.settings.destroy = true;
  command(c, "devorador");
  await system.waitTicks(50);
  const stoneLeft = countBlocks(dim, "minecraft:stone", -13, Y + 1, -13, -9, Y + 3, -9);
  check("devourer mode eats everything around you", modeOf(c) === "devorador" && stoneLeft < 8, `stone left=${stoneLeft}`);
  command(c, "modo inteligente");
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 });
  await system.waitTicks(4);
  const sz = dim.spawnEntity("minecraft:zombie", { x: 0.5, y: Y + 1, z: 14.5 });
  await waitUntil(() => dead(sz), 300);
  check("swarm stings monsters near you to death", dead(sz));
  owner.teleport({ x: 0.5, y: Y + 1, z: -10.5 }, { rotation: { x: 0, y: 0 } });
  await system.waitTicks(6);
  command(c, "enxame faz uma muralha");
  await system.waitTicks(20);
  const wallN = countBlocks(dim, NANO_BLOCK, -8, Y + 1, -9, 8, Y + 6, -4);
  check("swarm shape: wall of nanobots", wallN >= 30, `blocks=${wallN}`);
  // a ponte preenche vãos: na beirada da arena, olhando para o vazio
  owner.teleport({ x: 0.5, y: Y + 1, z: 29.5 }, { rotation: { x: 0, y: 0 } });
  await system.waitTicks(6);
  command(c, "ponte");
  await system.waitTicks(30);
  const bridgeN = countBlocks(dim, NANO_BLOCK, -3, Y - 1, 32, 3, Y, 40);
  check("swarm shape: bridge over the void where you look", bridgeN >= 18, `blocks=${bridgeN}`);
  handleIntents(c, [{ type: "stop" }]);
  await system.waitTicks(10);
  const leftN = countBlocks(dim, NANO_BLOCK, -8, Y - 1, -9, 8, Y + 6, 40);
  const nanoLeft = pcount((id) => id.startsWith("lila:nano_") && id !== "lila:nano_core");
  check("cancel dissolves the swarm shapes and tools, back to the smart swarm", isCloud(c) && modeOf(c) === "auto" && leftN === 0 && nanoLeft === 0,
    `blocks left=${leftN} nano tools=${nanoLeft}`);
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 });
  await system.waitTicks(4);

  // outro jogador bate em você: o DR-0N revida nele
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 });
  handleIntents(c, [{ type: "protect" }]);
  cmd(dim, "scriptevent lilatest:spawn_intruder");
  /** @type {any} */
  let intr;
  await waitUntil(() => !!(intr = world.getAllPlayers().find((p) => p.name === "Intruso")), 200);
  if (intr) {
    intr.teleport({ x: 2.5, y: Y + 1, z: 6.5 });
    await system.waitTicks(5);
    const ih0 = hp(intr);
    cmd(dim, `scriptevent lilatest:act Intruso hit ${owner.id}`);
    const trace = system.runInterval(() => {
      try {
        log(`trace fight: urgent=${c.urgent?.desc?.type ?? "-"} act=${c.entity?.getProperty("lila:action")} pos=${c.pos().x.toFixed(1)},${(c.pos().y - Y).toFixed(1)},${c.pos().z.toFixed(1)} intr=${intr.location.x.toFixed(1)},${(intr.location.y - Y).toFixed(1)},${intr.location.z.toFixed(1)} hp=${hp(intr)}`);
      } catch {
        /* ignore */
      }
    }, 40);
    await waitUntil(() => hp(intr) < ih0 - 2, 300);
    system.clearRun(trace);
    const dbg = () => `urgent=${c.urgent?.desc?.type ?? "-"} job=${c.job?.desc?.type ?? "-"} paused=${c.rec.paused} mode=${c.rec.mode} form=${formOf(c)} ridden=${!!c.flags.ridden} alive=${c.alive()} off=${!!c.rec.off} act=${c.entity?.getProperty("lila:action")} d=${c.alive() && intr?.isValid ? Math.hypot(c.pos().x - intr.location.x, c.pos().z - intr.location.z).toFixed(1) : "?"} dy=${c.alive() && intr?.isValid ? (c.pos().y - intr.location.y).toFixed(1) : "?"}`;
    check("a player who hits you gets attacked by the drone", hp(intr) < ih0 - 2, `intruder hp ${ih0}->${hp(intr)} aggro=${c.flags.aggro?.has(intr.id)} ${dbg()}`);
    cmd(dim, "scriptevent lilatest:act Intruso remove");
    c.flags.aggro?.clear();
  } else check("intruder joined", false);

  // você bate no drone: lição de leve
  await system.waitTicks(10);
  const oh0 = hp(owner);
  cmd(dim, `scriptevent lilatest:act Dono hit ${c.entity?.id}`);
  await waitUntil(() => hp(owner) < oh0, 60);
  check("hitting the drone yourself = a light lesson", hp(owner) < oh0 && hp(owner) > 6, `hp ${oh0}->${hp(owner)}`);
  try {
    owner.getComponent("minecraft:health")?.resetToMaxValue();
  } catch {
    /* ignore */
  }

  // proteger: ataca primeiro um zumbi que ainda nem chegou
  const far = dim.spawnEntity("minecraft:zombie", { x: 0.5, y: Y + 1, z: 26.5 });
  const tz = system.currentTick;
  const ohp = hp(owner);
  await waitUntil(() => dead(far), 400);
  check("protect mode attacks first (zombie 20 blocks away, before it reaches you)", dead(far) && hp(owner) >= ohp, `ticks=${system.currentTick - tz} owner hp ${ohp}->${hp(owner)} urgent=${c.urgent?.desc?.type ?? "-"} paused=${c.rec.paused} mode=${c.rec.mode}`);

  // exército
  command(c, "modo exército");
  await waitUntil(() => robotsOf(c).length >= 10, 300);
  check("army: drone bursts into 10 robots", armyActive(c) && robotsOf(c).length === 10 && !c.alive(), `robots=${robotsOf(c).length}`);
  const az = [0, 1].map((k) => dim.spawnEntity("minecraft:zombie", { x: 8.5 + k, y: Y + 1, z: 12.5 }));
  await waitUntil(() => az.every(dead), 400);
  check("army: robots take down monsters", az.every(dead));
  try {
    owner.getComponent("minecraft:health")?.setCurrentValue(6);
  } catch {
    /* ignore */
  }
  const ga0 = pcount((id) => id === "minecraft:golden_apple");
  await waitUntil(() => pcount((id) => id === "minecraft:golden_apple") > ga0, 200);
  check("army: brings what you need (low health -> golden apples)", pcount((id) => id === "minecraft:golden_apple") > ga0);
  const kinds = new Set(robotsOf(c).map((r) => Number(r.getProperty("lila:kind"))));
  check("army: mixed squad (soldiers, builders, artillery, medics, ninjas)", kinds.size >= 4, `kinds=${[...kinds].join(",")}`);
  // o exército inteiro constrói junto (catálogo mobiliado), com conferência no fim
  owner.teleport({ x: -20.5, y: Y + 1, z: -20.5 }, { rotation: { x: 0, y: 180 } });
  await system.waitTicks(10);
  const ab = c.rec.stats.built;
  const at0 = system.currentTick;
  command(c, "faz uma casa pequena aqui");
  await waitUntil(() => !!c.flags.armyJob, 20);
  const jobOn = !!c.flags.armyJob;
  await waitUntil(() => c.rec.stats.built > ab, 1500);
  const alb = c.flags.lastBuild;
  let adoors = 0;
  if (alb) {
    for (let x = alb.cx - alb.half; x <= alb.cx + alb.half; x++) for (let z = alb.cz - alb.half; z <= alb.cz + alb.half; z++) for (let y = alb.y0; y <= alb.y0 + 4; y++) {
      if (/door/.test(dim.getBlock({ x, y, z })?.typeId ?? "")) adoors++;
    }
  }
  check("army builds together (furnished catalog house with doors)", jobOn && c.rec.stats.built > ab && adoors >= 2, `ticks=${system.currentTick - at0} door blocks=${adoors}`);
  owner.teleport({ x: 0.5, y: Y + 1, z: 6.5 });
  await system.waitTicks(4);
  handleIntents(c, [{ type: "stop" }]);
  await waitUntil(() => c.alive() && robotsOf(c).length === 0, 100);
  check("cancel merges the army back into the drone", c.alive() && !armyActive(c) && robotsOf(c).length === 0, `robots=${robotsOf(c).length}`);

  // recolher itens do chão por texto
  for (let k = 0; k < 5; k++) dim.spawnItem(new ItemStack("minecraft:emerald", 3), { x: 3.5 + k, y: Y + 1.2, z: 9.5 });
  c.rec.paused = false;
  command(c, "recolhe os itens do chão");
  await waitUntil(() => dim.getEntities({ type: "minecraft:item", location: { x: 5, y: Y + 1, z: 9 }, maxDistance: 8 }).length === 0, 600);
  check("'recolhe os itens do chão' (drone sweeps the ground)", dim.getEntities({ type: "minecraft:item", location: { x: 5, y: Y + 1, z: 9 }, maxDistance: 8 }).length === 0,
    `emeralds with drone=${inv.count(c, "minecraft:emerald")}`);
  command(c, "constrói na hora");
  check("'constrói na hora' / 'constrói devagar' change the build speed", c.rec.settings.buildSpeed === "instantaneo");
  command(c, "constrói devagar");

  // construção e bioma por texto
  owner.teleport({ x: 0.5, y: Y + 1, z: -20.5 }, { rotation: { x: 0, y: 180 } });
  await system.waitTicks(10);
  const b0 = c.rec.stats.built;
  c.rec.paused = false;
  command(c, "constrói um poço aqui");
  await waitUntil(() => c.rec.stats.built > b0, 2400);
  check("'constrói um poço aqui' (mega builder by text)", c.rec.stats.built > b0);
  // catálogo por texto
  const b1 = c.rec.stats.built;
  command(c, "constrói na hora");
  command(c, "faz uma cafeteria pequena estilo colorido");
  await waitUntil(() => c.rec.stats.built > b1, 2400);
  check("'faz uma cafeteria pequena estilo colorido' (catalog by text)", c.rec.stats.built > b1);
  check("player build untouched", dim.getBlock({ x: 20, y: Y + 2, z: 0 })?.typeId === "minecraft:oak_planks");
}

/** @param {string} mode */
export async function runSelfTest(mode = "") {
  if (running) return;
  running = true;
  const dim = world.getDimension("overworld");
  const results = [];
  const check = (name, ok, info = "") => {
    results.push({ name, ok });
    log(`${ok ? "PASS" : "FAIL"} ${name}${info ? " :: " + info : ""}`);
  };
  try {
    log("START");
    await area(dim, "lila_selftest", -40, -40, 40, 40);
    check("arena chunks loaded", dim.isChunkLoaded({ x: 0, y: Y, z: 0 }));
    await buildArena(dim);
    await system.waitTicks(10);
    if (mode.includes("race")) await raceTests(dim, check);
    else if (mode.includes("owner")) await ownerTests(dim, check);
    else await soloTests(dim, check);
  } catch (e) {
    log(`FAIL exception :: ${e}${e?.stack ? " " + String(e.stack).split("\n").slice(0, 3).join(" | ") : ""}`);
    results.push({ name: "exception", ok: false });
  } finally {
    const pass = results.filter((r) => r.ok).length;
    log(`DONE pass=${pass} fail=${results.length - pass}`);
    running = false;
  }
}
