// Autoteste dentro do mundo (admin: /eclipse:autoteste · console: scriptevent eclipse:selftest).
// Cria uma plataforma limpa no alto, testa entidades, estados, blocos, projéteis, persistência
// e faz a Lyra cortar uma árvore e construir um abrigo de verdade. Relata PASS/FAIL no log.
import { BlockPermutation, BlockVolume, EntityComponentTypes, system, world } from "@minecraft/server";
import { GENERATED } from "../data/generated.js";
import { parseRequest } from "../lib/lyra_parser.js";
import { searchCatalog } from "../lib/forge_catalog.js";
import { BLUEPRINTS } from "../lib/blueprints.js";
import { requirements } from "../lib/recipes.js";
import { readJSON, writeJSON } from "../core/persistence.js";
import { setWorldConfig, worldConfig } from "../core/world_config.js";
import { build, count, gatherFood, gatherStone, gatherWood } from "../lyra/lyra_tasks.js";
import { walkTo } from "../lyra/lyra_motor.js";
import { logError, logInfo } from "../core/log.js";

let running = false;

export async function runSelfTest(reportTo) {
  if (running) return;
  running = true;
  const results = [];
  const check = (name, cond, info = "") => {
    results.push({ name, pass: !!cond, info: String(info) });
    logInfo("selftest", `${cond ? "PASS" : "FAIL"} ${name}${info ? " — " + info : ""}`);
  };
  const spawned = [];
  const dim = world.getDimension("overworld");
  const O = { x: 8, y: 220, z: 8 };
  try {
    // ---------------------------------------------------------------- puros
    const p1 = parseRequest("faz uma mansão aqui e depois pega comida");
    check("parser: mansão + comida", p1.tasks[0]?.type === "build" && p1.tasks[0]?.blueprint === "mansao" && p1.tasks[1]?.type === "food", JSON.stringify(p1.tasks));
    const p2 = parseRequest("pega 32 madeiras");
    check("parser: 32 madeiras", p2.tasks[0]?.type === "gather" && p2.tasks[0]?.amount === 32, JSON.stringify(p2.tasks));
    const p3 = parseRequest("explora bem longe");
    check("parser: explorar longe", p3.tasks[0]?.type === "explore" && p3.tasks[0]?.radius === 160);
    for (const [q, id] of [["martelo", "eclipse_hammer"], ["machado", "eclipse_axe"], ["espada", "shadow_sword"], ["asas", "wings_shadow"], ["lobo", "c_umbra"], ["cão sombrio", "c_umbra"], ["ponte", "k_bridge"], ["hammer", "eclipse_hammer"]]) {
      check(`forja: "${q}"`, searchCatalog(q)[0]?.id === id, searchCatalog(q)[0]?.id);
    }
    const mansion = BLUEPRINTS.mansao.build();
    check("planta: mansão grande", mansion.length > 1500, `${mansion.length} blocos · req ${JSON.stringify(requirements(mansion))}`);
    // ---------------------------------------------------------------- persistência
    const big = { s: "x".repeat(70000), n: 42 };
    writeJSON(world, "eclipse:selftest_big", big);
    const back = readJSON(world, "eclipse:selftest_big", null);
    check("persistência: JSON fatiado 70KB", back?.n === 42 && back?.s?.length === 70000);
    world.setDynamicProperty("eclipse:selftest_big", undefined);
    // ---------------------------------------------------------------- área de teste
    try {
      dim.runCommand(`tickingarea add ${O.x - 20} 0 ${O.z - 20} ${O.x + 20} 0 ${O.z + 20} eclipse_selftest true`);
    } catch (e) {
      logError("selftest.tickingarea", e);
    }
    const corners = [[-16, -16], [16, -16], [-16, 16], [16, 16], [0, 0]].map(([dx, dz]) => ({ x: O.x + dx, y: O.y, z: O.z + dz }));
    for (let i = 0; i < 240 && !corners.every((c) => dim.isChunkLoaded(c)); i++) await system.waitTicks(5);
    check("chunks de teste carregados", corners.every((c) => dim.isChunkLoaded(c)));
    dim.fillBlocks(new BlockVolume({ x: O.x - 14, y: O.y - 1, z: O.z - 14 }, { x: O.x + 14, y: O.y - 1, z: O.z + 14 }), "minecraft:grass_block");
    dim.fillBlocks(new BlockVolume({ x: O.x - 14, y: O.y, z: O.z - 14 }, { x: O.x + 14, y: O.y + 18, z: O.z + 14 }), "minecraft:air");
    check("plataforma criada", dim.getBlock({ x: O.x, y: O.y - 1, z: O.z })?.typeId === "minecraft:grass_block");
    const EXP = { x: O.x - 12, y: O.y, z: O.z - 12 };
    dim.getBlock(EXP).setPermutation(BlockPermutation.resolve("eclipse:shadow_block", { "eclipse:age": 15 }));
    const expStart = system.currentTick;
    // ---------------------------------------------------------------- criaturas
    for (const c of GENERATED.creatures) {
      try {
        const e = dim.spawnEntity(c.id, { x: O.x + 0.5, y: O.y, z: O.z + 0.5 });
        spawned.push(e);
        await system.waitTicks(2);
        const okSpawn = e.isValid && e.typeId === c.id;
        e.triggerEvent("eclipse:state_stay");
        e.triggerEvent("eclipse:phase_idle");
        await system.waitTicks(2);
        const st = e.getProperty("eclipse:state");
        const ph = e.getProperty("eclipse:phase");
        e.triggerEvent("eclipse:state_guard");
        await system.waitTicks(1);
        const st2 = e.getProperty("eclipse:state");
        const tame = !!e.getComponent(EntityComponentTypes.Tameable);
        check(`criatura ${c.key}`, okSpawn && st === "stay" && ph === "idle" && st2 === "guard" && tame, `state=${st}/${st2} phase=${ph} tameable=${tame}`);
        e.remove();
      } catch (err) {
        check(`criatura ${c.key}`, false, String(err));
      }
    }
    // relíquias lançadas e projétil
    for (const r of ["thrown_eclipse_hammer", "thrown_eclipse_axe", "thrown_astral_spear"]) {
      try {
        const e = dim.spawnEntity(`eclipse:${r}`, { x: O.x + 2.5, y: O.y + 1, z: O.z + 0.5 });
        spawned.push(e);
        e.triggerEvent("eclipse:spin_off");
        await system.waitTicks(1);
        const v = e.getProperty("eclipse:spin");
        e.teleport({ x: O.x + 3.5, y: O.y + 1, z: O.z + 0.5 });
        check(`entidade ${r}`, e.isValid && v === false);
        e.remove();
      } catch (err) {
        check(`entidade ${r}`, false, String(err));
      }
    }
    try {
      const b = dim.spawnEntity("eclipse:spell_bolt", { x: O.x + 0.5, y: O.y + 3, z: O.z + 0.5 });
      b.triggerEvent("eclipse:element_ice");
      const start = { ...b.location };
      b.getComponent(EntityComponentTypes.Projectile)?.shoot({ x: 1.5, y: 0, z: 0 });
      await system.waitTicks(4);
      const moved = b.isValid ? Math.abs(b.location.x - start.x) : 99;
      check("projétil elemental voa", moved > 1, `deslocamento ${moved.toFixed?.(2)} · elemento=${b.isValid ? b.getProperty("eclipse:element_id") : "(atingiu algo)"}`);
      if (b.isValid) b.remove();
    } catch (err) {
      check("projétil elemental voa", false, String(err));
    }
    // ---------------------------------------------------------------- blocos temporários
    for (const blk of GENERATED.blocks) {
      try {
        const at = dim.getBlock({ x: O.x - 10, y: O.y, z: O.z - 10 });
        at.setType(blk.id);
        const age = at.permutation.getState(/** @type {any} */ ("eclipse:age"));
        check(`bloco ${blk.key}`, at.typeId === blk.id && age === 0, `age=${age}`);
        at.setPermutation(BlockPermutation.resolve(blk.id, { "eclipse:age": 3 }));
        at.setType("minecraft:air");
      } catch (err) {
        check(`bloco ${blk.key}`, false, String(err));
      }
    }
    // ---------------------------------------------------------------- LYRA
    const lyra = dim.spawnEntity("eclipse:lyra", { x: O.x + 0.5, y: O.y, z: O.z + 0.5 });
    spawned.push(lyra);
    await system.waitTicks(2);
    const lyraInv = lyra.getComponent(EntityComponentTypes.Inventory)?.container;
    check("Lyra: entidade + inventário", lyra.isValid && lyraInv?.size === 36, `slots=${lyraInv?.size}`);
    lyra.triggerEvent("eclipse:script_on");
    lyra.setProperty("eclipse:action", "build");
    await system.waitTicks(1); // propriedades são aplicadas no fim do tick
    check("Lyra: propriedade de ação", lyra.getProperty("eclipse:action") === "build");
    const said = [];
    const L = { cancelled: false, lookAt: undefined, entity: () => (lyra.isValid ? lyra : undefined), say: (m) => said.push(m), onBuilt: () => said.push("built") };
    const runGen = async (gen, maxTicks) => {
      for (let t = 0; t < maxTicks; t++) {
        const r = gen.next();
        if (r.done) return { done: true, value: r.value, ticks: t };
        await system.waitTicks(1);
      }
      return { done: false, ticks: maxTicks };
    };
    // caminhada com obstáculo (muro de pedra)
    dim.fillBlocks(new BlockVolume({ x: O.x + 3, y: O.y, z: O.z - 4 }, { x: O.x + 3, y: O.y + 2, z: O.z + 4 }), "minecraft:stone");
    const wr = await runGen(walkTo(L, { x: O.x + 7, y: O.y, z: O.z }, 1.2), 400);
    const dWalk = Math.hypot(lyra.location.x - (O.x + 7.5), lyra.location.z - (O.z + 0.5));
    check("Lyra: A* contorna muro", wr.done && dWalk < 2.6, `dist final ${dWalk.toFixed(2)} em ${wr.ticks} ticks`);
    dim.fillBlocks(new BlockVolume({ x: O.x + 3, y: O.y, z: O.z - 4 }, { x: O.x + 3, y: O.y + 2, z: O.z + 4 }), "minecraft:air");
    // árvore artificial (tronco + copa)
    const T = { x: O.x - 6, y: O.y, z: O.z + 6 };
    for (let i = 0; i < 5; i++) dim.getBlock({ x: T.x, y: T.y + i, z: T.z }).setType("minecraft:oak_log");
    dim.fillBlocks(new BlockVolume({ x: T.x - 2, y: T.y + 3, z: T.z - 2 }, { x: T.x + 2, y: T.y + 5, z: T.z + 2 }), "minecraft:oak_leaves", { blockFilter: { includeTypes: ["minecraft:air"] } });
    const before = count(L, (t) => t === "minecraft:oak_log");
    const gw = await runGen(gatherWood(L, 4), 900);
    const got = count(L, (t) => t === "minecraft:oak_log") - before;
    check("Lyra: corta árvore e recolhe troncos", got >= 4, `troncos=${got} concluiu=${gw.done} ticks=${gw.ticks}`);
    // construção com materiais da sombra (rápida) — abrigo
    const cfg = { ...worldConfig() };
    setWorldConfig({ lyraMaterials: "shadow", lyraBuildSpeed: "rapido" });
    const origin = { x: O.x + 2, y: O.y, z: O.z - 8 };
    const br = await runGen(build(L, { blueprint: "abrigo", origin, card: 0 }), 2500);
    setWorldConfig({ lyraMaterials: cfg.lyraMaterials, lyraBuildSpeed: cfg.lyraBuildSpeed });
    const plan = BLUEPRINTS.abrigo.build();
    let placed = 0;
    for (const b of plan) {
      const w = { x: origin.x - b.x, y: O.y + b.y, z: origin.z + b.z }; // card 0 = frente sul
      const blk = dim.getBlock(w);
      if (blk && (b.m === "air" ? blk.isAir : !blk.isAir)) placed++;
    }
    check("Lyra: constrói abrigo", br.done && placed >= plan.length * 0.85, `${placed}/${plan.length} blocos · ticks=${br.ticks} · falas=${said.length}`);
    // caça sustentável + cozimento: 5 vacas (ela nunca abate as 2 últimas)
    for (let i = 0; i < 5; i++) spawned.push(dim.spawnEntity("minecraft:cow", { x: O.x - 8 + i, y: O.y, z: O.z - 2 }));
    const gf = await runGen(gatherFood(L, 2), 1500);
    const beef = count(L, (t) => t === "minecraft:cooked_beef");
    const cowsLeft = dim.getEntities({ location: O, maxDistance: 30, type: "minecraft:cow" }).length;
    check("Lyra: caça e cozinha (sustentável)", beef >= 1 && cowsLeft >= 2, `carne assada=${beef} vacas restantes=${cowsLeft} concluiu=${gf.done}`);
    // extração sombria de pedra (sem buraco na superfície)
    dim.fillBlocks(new BlockVolume({ x: O.x - 4, y: O.y - 12, z: O.z - 4 }, { x: O.x + 4, y: O.y - 6, z: O.z + 4 }), "minecraft:stone");
    lyra.teleport({ x: O.x + 0.5, y: O.y, z: O.z + 0.5 });
    const st0 = count(L, (t) => t === "minecraft:cobblestone");
    const gs = await runGen(gatherStone(L, 12), 900);
    const cob = count(L, (t) => t === "minecraft:cobblestone") - st0;
    const surfaceIntact = dim.getBlock({ x: O.x, y: O.y - 1, z: O.z })?.typeId === "minecraft:grass_block";
    check("Lyra: extração de pedra pelo subsolo", cob >= 12 && surfaceIntact, `pedras=${cob} superfície intacta=${surfaceIntact} concluiu=${gs.done}`);
    // bloco temporário se desfaz sozinho (componente customizado onTick)
    while (system.currentTick - expStart < 640) await system.waitTicks(20);
    check("bloco temporário se autodestrói", dim.getBlock(EXP)?.isAir === true, `tipo=${dim.getBlock(EXP)?.typeId}`);
  } catch (e) {
    check("execução do autoteste", false, String(e));
    logError("selftest", e);
  } finally {
    for (const e of spawned) {
      try {
        if (e.isValid) e.remove();
      } catch {
        /* */
      }
    }
    try {
      dim.fillBlocks(new BlockVolume({ x: O.x - 14, y: O.y - 1, z: O.z - 14 }, { x: O.x + 14, y: O.y + 18, z: O.z + 14 }), "minecraft:air");
      dim.runCommand("tickingarea remove eclipse_selftest");
    } catch {
      /* */
    }
    running = false;
  }
  const pass = results.filter((r) => r.pass).length;
  const summary = `ECLIPSE SELFTEST: ${pass}/${results.length} PASS`;
  logInfo("selftest", summary);
  writeJSON(world, "eclipse:selftest_result", { at: Date.now(), pass, total: results.length, results });
  if (reportTo) {
    try {
      reportTo.sendMessage(`§5[ECLIPSE] §f${summary}\n${results.filter((r) => !r.pass).map((r) => `§c✖ ${r.name}: ${r.info}`).join("\n")}`);
    } catch {
      /* */
    }
  }
  return results;
}
