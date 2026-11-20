// Autoteste dentro do jogo (servidor dedicado oficial): /scriptevent lila:selftest [owner]
// Sem "owner": monta uma arena no céu e testa o DR-0N sozinho (criativo, todas as formas, colosso,
// torreta, megaconstruções, bioma, derrota). Com "owner": usa jogadores simulados (Dono e Intruso)
// para testar pilotagem, imortalidade no colosso, revide contra jogador, exército e entregas.
import { system, world } from "@minecraft/server";
import { COMPANIONS, Companion, ENTITY_ID, OWNER_PROP, adopt, compKey, loadCompanion, newRecord } from "../lila/companion.js";
import * as inv from "../lila/inventory.js";
import { obtain } from "../lila/planner.js";
import { command, handleIntents, stats } from "../lila/brain.js";
import { summon, dismiss, restoreBodyForTest, RESPAWN_TICKS } from "../lila/lifecycle.js";
import { formOf, riders, setForm, turretGoal, primaryAttack } from "../lila/forms.js";
import { megaBuild, biomeTransform } from "../lila/mega.js";
import { armyActive, robotsOf } from "../lila/army.js";
import { FORM_LIST } from "../lib/catalog.js";
import { logError } from "../core/log.js";

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
    await mgr.createTickingArea(name, { dimension: dim, from: { x: x0, y: Y - 8, z: z0 }, to: { x: x1, y: Y + 30, z: z1 } });
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
  check("creative: tool materializes instantly", r.ok && inv.toolTier(c, "pickaxe") === "netherite", `tier=${inv.toolTier(c, "pickaxe")} ticks=${r.ticks}`);
  r = await runGen(obtain(c, { group: "log" }, 64), 200);
  check("creative: 64 logs instantly", r.ok && inv.count(c, { group: "log" }) >= 64 && r.ticks < 20, `ticks=${r.ticks}`);

  // todas as formas: propriedade, assentos e escala
  const SEATS = { drone: 1, heli: 4, car: 4, excavator: 2, tank: 3, jet: 2, moto: 2, colossus: 6, turret: 0 };
  let formsOk = 0;
  const bad = [];
  for (const f of FORM_LIST) {
    setForm(c, f, { mount: false, quiet: true });
    await system.waitTicks(4);
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
  check("all 9 forms switch (property + seats)", formsOk === FORM_LIST.length, bad.join(" "));

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
  check("colossus punch breaks blocks and hits", stoneLeft < 105, `stone left=${stoneLeft}/105 zombie=${dead(zz) ? "down" : hp(zz)}`);
  setForm(c, "drone", { mount: false, quiet: true });
  await system.waitTicks(4);
  c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 });

  // torreta gigante: pousa, vira arma e derruba 3 zumbis
  const zs = [0, 1, 2].map((k) => dim.spawnEntity("minecraft:zombie", { x: 8 + k * 3, y: Y + 1, z: 16 }));
  c.rec.mode = "turret";
  const tg = turretGoal(c);
  const tt = system.currentTick;
  const tr = runGen(tg, 700);
  await waitUntil(() => zs.every(dead), 600);
  const wasTurret = formOf(c) === "turret";
  c.rec.mode = "follow";
  await tr;
  check("giant turret form kills 3 zombies", zs.every(dead) && wasTurret, `ticks=${system.currentTick - tt} form=${wasTurret}`);
  check("turret folds back to drone when done", formOf(c) === "drone");

  // megaconstruções (cada uma longe, numa área própria carregada)
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
    if (key === "montanha_russa") {
      const rails = countBlocks(dim, "minecraft:rail", x - 30, Y - 2, 0, x + 30, Y + 16, 60, 1) + countBlocks(dim, "minecraft:golden_rail", x - 30, Y - 2, 0, x + 30, Y + 16, 60, 1);
      const carts = dim.getEntities({ type: "minecraft:minecart", location: { x, y: Y, z: 30 }, maxDistance: 60 }).length;
      check("roller coaster has a full closed track + cart", rails >= 100 && carts >= 1, `rails=${rails} carts=${carts}`);
    }
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
  const rb = await runGen(biomeTransform(c, "neve"), 3000);
  const snow = countBlocks(dim, "minecraft:snow_layer", bx - 30, Y + 1, -30, bx + 30, Y + 1, 30, 2);
  check("biome transform: snow", rb.ok && snow > 150, `snow layers(sample)=${snow} ticks=${rb.ticks} ${rb.err ?? ""}`);
  dropArea("lila_test_biome");
  c.entity?.teleport({ x: 0.5, y: Y + 2, z: 0.5 });
  await system.waitTicks(4);

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
  await system.waitTicks(5);
  const back = restoreBodyForTest(c, dim, { x: 0.5, y: Y + 2, z: 0.5 });
  check("dismiss + resummon keeps everything", !!back && inv.totalItems(c) === items);
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
  await system.waitTicks(20);

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
  try {
    c.entity?.getComponent("minecraft:rideable")?.ejectRider(owner);
  } catch {
    /* ignore */
  }
  await waitUntil(() => formOf(c) === "drone", 40);
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
  check("colossus: owner is in the head seat", formOf(c) === "colossus" && riders(c)[0]?.id === owner.id);
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
  check("colossus: attack button = punch", c.entity?.getProperty("lila:action") === "work" || (c.flags.cdPunch ?? 0) > 0);
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
    await waitUntil(() => hp(intr) < ih0 - 2, 300);
    check("a player who hits you gets attacked by the drone", hp(intr) < ih0 - 2, `intruder hp ${ih0}->${hp(intr)} aggro=${c.flags.aggro?.has(intr.id)}`);
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
  await waitUntil(() => dead(far), 400);
  check("protect mode attacks first (zombie 20 blocks away)", dead(far), `ticks=${system.currentTick - tz}`);

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
  handleIntents(c, [{ type: "stop" }]);
  await waitUntil(() => c.alive() && robotsOf(c).length === 0, 100);
  check("cancel merges the army back into the drone", c.alive() && !armyActive(c) && robotsOf(c).length === 0, `robots=${robotsOf(c).length}`);

  // construção e bioma por texto
  owner.teleport({ x: 0.5, y: Y + 1, z: -20.5 }, { rotation: { x: 0, y: 180 } });
  await system.waitTicks(10);
  const b0 = c.rec.stats.built;
  c.rec.paused = false;
  command(c, "constrói um poço aqui");
  await waitUntil(() => c.rec.stats.built > b0, 600);
  check("'constrói um poço aqui' (mega builder by text)", c.rec.stats.built > b0);
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
    if (mode.includes("owner")) await ownerTests(dim, check);
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
