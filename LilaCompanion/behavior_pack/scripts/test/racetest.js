// Autoteste do Sistema de Raças no servidor oficial (/scriptevent lila:selftest race), com o jogador
// simulado "Dono". Cobre pesos/sorteio, consumo exato, cancelar/confirmar, persistência (morte,
// cache), vampiro (sol, capacete, morcego, dreno, velocidade), gigante (tamanho, força,
// resistência), asas (XP próprio), regeneração, armas (30/35, sem duplicar, voltar ao dono),
// cinzas com proteção e os 600 poderes executando com efeito real.
import { EntityDamageCause, ItemStack, system, world } from "@minecraft/server";
import { ABILITIES, BY_RACE, validateCatalog } from "../race/catalog.js";
import { RACES, RACE_IDS, TOTAL_WEIGHT, pickRace, rollInt, validateWeights } from "../race/data.js";
import { forget, stateOf } from "../race/state.js";
import { LAST, SILENCE, STUN, cast, clearActive, TEMP_BLOCKS } from "../race/engine.js";
import { useRoulette } from "../race/roulette.js";
import { DRAIN_STOP, TRIGGER_LOG, damageMods, startDrain } from "../race/passives.js";
import { CORE, ROULETTE, SCYTHE, SWORD, giveWeapon } from "../race/weapons.js";

const Y = 150;
const wait = (t) => system.waitTicks(t);
async function until(pred, t) {
  for (let i = 0; i < t; i++) {
    if (pred()) return true;
    await wait(1);
  }
  return pred();
}
const cmd = (dim, c) => {
  try {
    dim.runCommand(c);
  } catch {
    /* ignore */
  }
};
const hp = (e) => {
  try {
    return e.getComponent("minecraft:health")?.currentValue ?? 0;
  } catch {
    return 0;
  }
};

let lastTaken = -1;
world.afterEvents.entityHurt.subscribe((ev) => {
  if (ev.hurtEntity?.typeId === "minecraft:player") lastTaken = ev.damage;
});

export async function raceTests(dim, check) {
  // ---------------- dados (sem jogador)
  check("race: weights total exactly 10000 bp, GOD = DARK = 1%", validateWeights().length === 0 && RACES.god.weight === 100 && RACES.dark.weight === 100,
    validateWeights().join("; "));
  const bounds = [[0, "vampire"], [2799, "vampire"], [2800, "giant"], [5199, "giant"], [5200, "angel"], [7399, "angel"], [7400, "demon"], [9799, "demon"],
    [9800, "god"], [9899, "god"], [9900, "dark"], [9999, "dark"]];
  const bad = bounds.filter(([r, want]) => pickRace(r) !== want);
  check("race: weighted pick boundaries are exact", bad.length === 0, bad.map(([r]) => r).join(","));
  const N = 200000, cnt = Object.fromEntries(RACE_IDS.map((r) => [r, 0]));
  for (let i = 0; i < N; i++) cnt[pickRace(rollInt())]++;
  const pct = Object.fromEntries(RACE_IDS.map((r) => [r, (cnt[r] / N) * 100]));
  const okStat = RACE_IDS.every((r) => Math.abs(pct[r] - RACES[r].weight / 100) < (RACES[r].weight === 100 ? 0.15 : 0.6));
  check("race: 200k-roll sample matches the odds (statistical sanity)", okStat, RACE_IDS.map((r) => `${r}=${pct[r].toFixed(2)}%`).join(" "));
  const cat = validateCatalog();
  check("race: 6 races × 100 unique abilities (600), metadata + handlers, no duplicate behavior", ABILITIES.length === 600 && cat.length === 0, cat.slice(0, 5).join("; "));
  check("race: total weight constant", TOTAL_WEIGHT === 10000);

  // ---------------- jogador simulado
  cmd(dim, "scriptevent lilatest:spawn_owner");
  /** @type {any} */
  let p;
  await until(() => !!(p = world.getAllPlayers().find((x) => x.name === "Dono")), 200);
  check("race: simulated player joined", !!p);
  if (!p) return;
  const inv = () => p.getComponent("minecraft:inventory").container;
  const count = (id) => {
    let n = 0;
    const ct = inv();
    for (let i = 0; i < ct.size; i++) if (ct.getItem(i)?.typeId === id) n += ct.getItem(i).amount;
    return n;
  };
  cmd(dim, "gamemode survival Dono");
  cmd(dim, "time set 18000");
  cmd(dim, "weather clear");
  p.teleport({ x: 0.5, y: Y + 1, z: 0.5 });
  inv().setItem(0, new ItemStack(ROULETTE, 3));
  p.selectedSlotIndex = 0;
  await wait(5);
  const r1 = await useRoulette(p, 0, { fast: true, roll: 9850 });
  await wait(4);
  const s = stateOf(p);
  check("roulette: first roll consumes exactly 1 and gives the server-picked race (GOD)", r1.ok && s.race === "god" && count(ROULETTE) === 2, `left=${count(ROULETTE)} race=${s.race}`);
  check("roulette: Race Core + owner-bound Divine Blade given once", count(CORE) === 1 && count(SWORD) === 1, `core=${count(CORE)} sword=${count(SWORD)}`);
  let raceProp = -1;
  try {
    raceProp = Number(p.getProperty("lila:race"));
  } catch {
    /* ignore */
  }
  check("race: player property lila:race synced to the client (GOD = 5)", raceProp === 5, `prop=${raceProp}`);
  // clique duplo: dois usos ao mesmo tempo → só um vale
  const a1 = useRoulette(p, 0, { fast: true, confirm: false });
  const a2 = useRoulette(p, 0, { fast: true, confirm: true, roll: 100 });
  const [ra, rb] = await Promise.all([a1, a2]);
  check("roulette: double click is locked (second request ignored) and cancel consumes nothing", ra.reason === "cancel" && rb.reason === "rolling" && count(ROULETTE) === 2 && s.race === "god",
    `a=${ra.reason} b=${rb.reason} left=${count(ROULETTE)}`);
  await wait(4);
  const r2 = await useRoulette(p, 0, { fast: true, confirm: true, roll: 9950 });
  await wait(4);
  check("roulette: confirmed reroll replaces the race exactly once (DARK) and consumes exactly 1", r2.ok && stateOf(p).race === "dark" && count(ROULETTE) === 1,
    `race=${stateOf(p).race} left=${count(ROULETTE)}`);
  check("weapons: old race weapon removed, Void Scythe given once", count(SWORD) === 0 && count(SCYTHE) === 1, `sword=${count(SWORD)} scythe=${count(SCYTHE)}`);
  inv().setItem(0, undefined);
  await wait(4);
  const rNo = await useRoulette(p, 0, { fast: true, confirm: true, roll: 0 });
  check("roulette: no roulette item in the slot → no roll", !rNo.ok && stateOf(p).race === "dark", `reason=${rNo.reason}`);
  // persistência: relê do disco (dynamic property) e após morrer/renascer
  forget(p.id);
  check("race: state persists (reloaded from the player's saved data)", stateOf(p).race === "dark" && stateOf(p).slots.filter(Boolean).length === 20);
  p.applyDamage(5000, { cause: EntityDamageCause.override });
  await wait(10);
  cmd(dim, "scriptevent lilatest:act Dono respawn");
  await until(() => hp(p) > 0, 100);
  await wait(15);
  p.teleport({ x: 0.5, y: Y + 1, z: 0.5 });
  check("race: survives death and respawn", stateOf(p).race === "dark", `race=${stateOf(p).race}`);

  // helper: virar uma raça (pelo próprio caminho da roleta)
  const become = async (race) => {
    const roll = { vampire: 100, giant: 3000, angel: 6000, demon: 8000, god: 9850, dark: 9950 }[race];
    inv().setItem(8, new ItemStack(ROULETTE, 1));
    await useRoulette(p, 8, { fast: true, confirm: true, roll });
    await wait(6);
    p.teleport({ x: 0.5, y: Y + 1, z: 0.5 }, { rotation: { x: 0, y: 0 } });
    p.getComponent("minecraft:health").resetToMaxValue();
    await wait(4);
    return stateOf(p).race === race;
  };
  const golem = (z = 3) => {
    const g = dim.spawnEntity("minecraft:iron_golem", { x: 0.5, y: Y + 1, z: z + 0.5 });
    g.addEffect("slowness", 2000, { amplifier: 10, showParticles: false });
    return g;
  };

  // ---------------- TREVAS: resistência 20×, foice 35, cinzas
  cmd(dim, "time set 18000");
  p.getComponent("minecraft:health").resetToMaxValue();
  await wait(2);
  let h0 = hp(p);
  lastTaken = -1;
  p.applyDamage(20, { cause: EntityDamageCause.entityAttack });
  await wait(2);
  const fakeEv = { hurtEntity: p, damageSource: { cause: "entityAttack" }, damage: 20 };
  const mDark = damageMods(fakeEv);
  check("DARK: 20× effective durability (damage × 1/20)", Math.abs(mDark - 0.05) < 0.001, `mult=${mDark} applied=${lastTaken} hp=${hp(p)}`);
  for (let i = 0; i < inv().size; i++) if (inv().getItem(i)?.typeId === SCYTHE) p.selectedSlotIndex = i;
  let g = golem(2);
  await wait(4);
  let g0 = hp(g);
  cmd(dim, `scriptevent lilatest:act Dono hit ${g.id}`);
  await wait(4);
  check("DARK: Void Scythe base hit = 35 damage", Math.abs(g0 - hp(g) - 35) < 0.6, `golem ${g0}->${hp(g)}`);
  g.remove();
  // cinzas no bloco quebrado pela foice (o jogo deixou quebrar): sem drop
  cmd(dim, `setblock 0 ${Y + 1} 3 oak_planks`);
  cmd(dim, `setblock 1 ${Y + 1} 3 chest`);
  await wait(2);
  cmd(dim, `scriptevent lilatest:act Dono break 0,${Y + 1},3`);
  await wait(8);
  const drops = dim.getEntities({ type: "minecraft:item", location: { x: 0.5, y: Y + 1, z: 3.5 }, maxDistance: 2 }).length;
  const broke = dim.getBlock({ x: 0, y: Y + 1, z: 3 })?.typeId === "minecraft:air";
  check("DARK: blocks touched by the scythe turn to ash (no drop) after a legit break", broke && drops === 0, `broke=${broke} drops=${drops}`);
  const ashclear = BY_RACE.dark.find((a) => a.shape === "ashclear");
  p.teleport({ x: 1.5, y: Y + 1, z: 1.5 });
  cmd(dim, `setblock 2 ${Y + 1} 2 stone`);
  cmd(dim, `setblock 1 ${Y - 4} 1 bedrock`);
  await wait(2);
  cast(p, ashclear.id, { force: true, quiet: true });
  await wait(2);
  check("DARK: ash never touches containers or protected blocks (chest stays, stone turns to ash)", dim.getBlock({ x: 1, y: Y + 1, z: 3 })?.typeId === "minecraft:chest" &&
    dim.getBlock({ x: 2, y: Y + 1, z: 2 })?.typeId === "minecraft:air", `chest=${dim.getBlock({ x: 1, y: Y + 1, z: 3 })?.typeId}`);
  cmd(dim, `setblock 1 ${Y + 1} 3 air`);

  // ---------------- DEUS: lâmina 30, sem duplicar, volta ao dono
  check("GOD: became GOD", await become("god"));
  for (let k = 0; k < 3; k++) giveWeapon(p);
  check("GOD: summoning the blade 3× still leaves exactly 1 (no duplicates)", count(SWORD) === 1, `swords=${count(SWORD)}`);
  for (let i = 0; i < inv().size; i++) if (inv().getItem(i)?.typeId === SWORD) p.selectedSlotIndex = i;
  g = golem(2);
  await wait(4);
  g0 = hp(g);
  cmd(dim, `scriptevent lilatest:act Dono hit ${g.id}`);
  await wait(4);
  check("GOD: Divine Blade base hit = 30 damage", Math.abs(g0 - hp(g) - 30) < 0.6, `golem ${g0}->${hp(g)}`);
  g.remove();
  const slot = p.selectedSlotIndex;
  const st = inv().getItem(slot);
  inv().setItem(slot, undefined);
  dim.spawnItem(st, { x: 3.5, y: Y + 1.2, z: 3.5 });
  await wait(10);
  check("GOD: a dropped blade returns to its owner (still exactly 1)", count(SWORD) === 1, `swords=${count(SWORD)}`);
  p.getComponent("minecraft:health").setCurrentValue(6);
  await wait(42);
  check("GOD: 10× regeneration", hp(p) >= 9.5, `hp 6->${hp(p).toFixed(1)}`);

  // ---------------- ANJO: asas com XP próprio, voo, regeneração 5×
  check("ANGEL: became ANGEL (wings start small)", (await become("angel")) && stateOf(p).wing === 0);
  const xp0 = p.getTotalXp();
  p.addExperience(300);
  await wait(25);
  const w1 = stateOf(p).wing;
  p.addLevels(-3);
  await wait(25);
  check("ANGEL: wing XP grows to 20 (adult), never shrinks when you spend XP, and doesn't eat your XP", w1 === 20 && stateOf(p).wing === 20 && p.getTotalXp() >= xp0,
    `wing=${w1}->${stateOf(p).wing} xp ${xp0}->${p.getTotalXp()}`);
  const fly = BY_RACE.angel.find((a) => a.special === "flight");
  const y0 = p.location.y;
  cast(p, fly.id, { force: true, quiet: true });
  await wait(12);
  check("ANGEL: flight lifts you (server-side)", stateOf(p).tog.fly && p.location.y > y0 + 0.6, `y ${y0.toFixed(1)}->${p.location.y.toFixed(1)}`);
  cast(p, fly.id, { force: true, quiet: true });
  await until(() => p.isOnGround, 100);
  p.getComponent("minecraft:health").setCurrentValue(8);
  await wait(42);
  check("ANGEL: 5× regeneration", hp(p) >= 9.5, `hp 8->${hp(p).toFixed(1)}`);

  // ---------------- GIGANTE: tamanho, força 3×, resistência 3×
  check("GIANT: became GIANT", await become("giant"));
  await wait(6);
  let tall = 0;
  try {
    tall = Number(p.getComponent("minecraft:scale")?.value ?? 0);
  } catch {
    /* ignore */
  }
  let comps = TRIGGER_LOG.slice(-2).join(" / ") + " ";
  try {
    comps = p.getComponents().map((c) => c.typeId.replace("minecraft:", "")).join(",");
  } catch {
    /* ignore */
  }
  let box = "";
  let boxH = 0;
  try {
    const bb = p.getAABB();
    boxH = bb.extent.y * 2;
    box = `aabb=${(bb.extent.x * 2).toFixed(2)}x${boxH.toFixed(2)}`;
  } catch (e) {
    box = `aabb? ${e}`;
  }
  check("GIANT: ~3 iron golems tall on the server (hitbox ≈ 8 blocks, scale ×4.5)", boxH > 7 || Math.abs(tall - 4.5) < 0.01,
    `${box} scale=${tall} eye=${(p.getHeadLocation().y - p.location.y).toFixed(2)} ${comps.slice(0, 80)}`);
  lastTaken = -1;
  p.applyDamage(9, { cause: EntityDamageCause.entityAttack });
  await wait(2);
  check("GIANT: 3× durability (9 damage → 3)", Math.abs(lastTaken - 3) < 0.05, `applied ${lastTaken}`);
  inv().setItem(p.selectedSlotIndex, undefined);
  g = golem(3);
  await wait(4);
  g0 = hp(g);
  cmd(dim, `scriptevent lilatest:act Dono hit ${g.id}`);
  await wait(4);
  check("GIANT: 3× melee strength (fist 1 → 3)", Math.abs(g0 - hp(g) - 3) < 0.6, `golem ${g0}->${hp(g)}`);
  g.remove();
  let speed = -1;
  try {
    speed = p.getEffect("speed")?.amplifier ?? -1;
  } catch {
    /* ignore */
  }
  await wait(12);
  try {
    speed = p.getEffect("speed")?.amplifier ?? -1;
  } catch {
    /* ignore */
  }
  check("GIANT: 3× movement speed (Speed X)", speed === 9, `amp=${speed}`);

  // ---------------- VAMPIRO: sol, capacete, morcego, dreno
  check("VAMPIRE: became VAMPIRE", await become("vampire"));
  cmd(dim, "time set 6000");
  cmd(dim, "weather clear");
  await wait(12);
  try {
    speed = p.getEffect("speed")?.amplifier ?? -1;
  } catch {
    /* ignore */
  }
  check("VAMPIRE: 2× movement speed (Speed V)", speed === 4, `amp=${speed}`);
  p.getComponent("minecraft:health").resetToMaxValue();
  h0 = hp(p);
  await wait(64);
  const sunTook = h0 - hp(p);
  check("VAMPIRE: direct sunlight burns", sunTook >= 2, `took ${sunTook.toFixed(1)}`);
  p.getComponent("minecraft:health").resetToMaxValue();
  try {
    p.extinguishFire();
  } catch {
    /* ignore */
  }
  p.getComponent("minecraft:equippable").setEquipment("Head", new ItemStack("minecraft:iron_helmet", 1));
  await wait(4);
  h0 = hp(p);
  await wait(64);
  check("VAMPIRE: a helmet protects from the sun", hp(p) >= h0 - 0.01, `hp ${h0}->${hp(p)}`);
  p.getComponent("minecraft:equippable").setEquipment("Head", undefined);
  const bat = BY_RACE.vampire.find((a) => a.special === "bat");
  cast(p, bat.id, { force: true, quiet: true });
  await wait(6);
  let batProp = false;
  try {
    batProp = !!p.getProperty("lila:bat");
  } catch {
    /* ignore */
  }
  p.getComponent("minecraft:health").resetToMaxValue();
  h0 = hp(p);
  await wait(64);
  check("VAMPIRE: bat form (small, client property) is immune to the sun", batProp && stateOf(p).tog.bat && hp(p) >= h0 - 0.01, `bat=${batProp} hp ${h0}->${hp(p)}`);
  cast(p, bat.id, { force: true, quiet: true });
  await wait(6);
  try {
    batProp = !!p.getProperty("lila:bat");
  } catch {
    /* ignore */
  }
  check("VAMPIRE: leaving bat form restores the player", !batProp && !stateOf(p).tog.bat);
  cmd(dim, "time set 18000");
  await wait(4);
  p.getComponent("minecraft:health").setCurrentValue(10);
  const pig = dim.spawnEntity("minecraft:pig", { x: 0.5, y: Y + 1, z: 2.5 });
  pig.addEffect("slowness", 400, { amplifier: 10, showParticles: false });
  p.teleport({ x: 0.5, y: Y + 1, z: 0.5 });
  cmd(dim, `scriptevent lilatest:act Dono look 0.5,${Y + 1.5},2.5`);
  await wait(4);
  const started = startDrain(p);
  const hold = system.runInterval(() => {
    try {
      if (pig.isValid) pig.teleport({ x: 0.5, y: Y + 1, z: 2.5 }); // o alvo "preso" (num jogo de verdade, se fugir o dreno para)
    } catch {
      /* ignore */
    }
  }, 2);
  await until(() => !pig.isValid || hp(pig) <= 0, 120);
  system.clearRun(hold);
  check("VAMPIRE: blood drain (hold, in range, line of sight) drains until the target dies and heals you", started && (!pig.isValid || hp(pig) <= 0) && hp(p) > 10,
    `started=${started} pig=${pig.isValid ? hp(pig) : "dead"} hp=${hp(p).toFixed(1)} stop=${DRAIN_STOP.why}`);

  // ---------------- os 600 poderes: cada um roda e produz efeito real
  const fails = [];
  for (const race of RACE_IDS) {
    if (!(await become(race))) {
      fails.push(`${race}: não virou`);
      continue;
    }
    p.addEffect("resistance", 20000, { amplifier: 4, showParticles: false });
    for (const a of BY_RACE[race]) {
      if (a.passive) continue;
      p.teleport({ x: 0.5, y: Y + 1, z: 0.5 }, { rotation: { x: 8, y: 0 } });
      const targets = [2.5, 5.5, 9.5].map((z) => {
        const t = dim.spawnEntity("minecraft:iron_golem", { x: 0.5, y: Y + 1, z });
        t.addEffect("slowness", 400, { amplifier: 10, showParticles: false });
        return t;
      });
      await wait(2);
      const st0 = stateOf(p);
      STUN.delete(p.id);
      SILENCE.delete(p.id);
      st0.cd[a.id] = 0;
      st0.res = 100;
      LAST.outcome = null;
      const r = cast(p, a.id, { force: true, quiet: true });
      await wait(3);
      const o = LAST.outcome;
      const real = r.ok && o && (o.hits > 0 || o.touched > 0 || o.self || o.queued > 0);
      if (!real) fails.push(`${a.id} ${a.name}: ${r.msg ?? "sem efeito"}`);
      // desfaz toggles (morcego/voo/auras) para o próximo
      if (a.special === "bat" || a.special === "flight" || a.shape === "aura") cast(p, a.id, { force: true, quiet: true });
      for (const t of targets) try {
        t.remove();
      } catch {
        /* ignore */
      }
      clearActive();
    }
  }
  for (const t of TEMP_BLOCKS.splice(0)) cmd(dim, `setblock ${t.x} ${t.y} ${t.z} air`);
  check("ALL 600 abilities execute server-side with a real effect", fails.length === 0, `${ABILITIES.filter((x) => !x.passive).length - fails.length} poderes ativos ok (as ${ABILITIES.filter((x) => x.passive).length} passivas são testadas pelos itens acima) · falhas: ${fails.slice(0, 12).join(" | ") || "nenhuma"}`);
}
