// DR-0N Mega Drone — ponto de entrada (APIs estáveis: @minecraft/server 2.x + server-ui 2.x).
// Nada aparece quando o jogador entra no mundo: tudo começa quando ele fabrica o Controle do DR-0N.
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, EntityDamageCause, Player, system, world } from "@minecraft/server";
import { every, startScheduler } from "./core/scheduler.js";
import { logError, logInfo } from "./core/log.js";
import { COMPANIONS, OWNER_PROP, adopt, companionForEntity, companionsOf, findEntityFor, isCompanionType, loadAllRecords, loadCompanion } from "./lila/companion.js";
import { command, metabolism, sense, tick } from "./lila/brain.js";
import { backupInventory, defeat, tickDefeat } from "./lila/lifecycle.js";
import { flushHud, resetWaypoint, updateHud } from "./lila/hud.js";
import { riddenBy, rideTick } from "./lila/drone.js";
import { fight, markAggro } from "./lila/combat.js";
import { formOf, formTick, isRideForm, primaryAttack, releaseRiders, riders } from "./lila/forms.js";
import { shieldOn, swarmTick } from "./lila/swarm.js";
import { armyActive, armyTick, ROBOT } from "./lila/army.js";
import { particle, sound } from "./lila/anim.js";
import { say } from "./lila/talk.js";
import { openController } from "./ui/controller.js";
import { runSelfTest } from "./test/selftest.js";
import { DRONE, SUMMONS } from "./lila/registry.js";

const CONTROLLER = DRONE.controller;

// ------------------------------------------------------------------ registro antecipado
system.beforeEvents.startup.subscribe((ev) => {
  try {
    const optional = [];
    for (let i = 1; i <= 8; i++) optional.push({ name: `p${i}`, type: CustomCommandParamType.String });
    for (const def of SUMMONS.values()) {
      ev.customCommandRegistry.registerCommand({
        name: def.command ?? `lila:${def.key}`,
        description: "Dá uma ordem para o DR-0N. Ex.: /drone vira helicóptero (sem texto: abre o menu)",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        optionalParameters: optional,
      }, (origin, ...args) => {
        const src = origin.sourceEntity ?? origin.initiator;
        if (!(src instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Só jogadores podem usar este comando." };
        const text = args.filter((x) => typeof x === "string" && x.length).join(" ");
        system.run(() => {
          const c = loadCompanion(src, def.key);
          if (!text) {
            openController(src);
            return;
          }
          if (!c.rec.summoned || (!c.alive() && !armyActive(c))) {
            src.sendMessage(`${def.chatTag}Me invoque primeiro com o §lControle do DR-0N§r.`);
            return;
          }
          src.sendMessage(`§7Você » ${def.name}: §f${text}`);
          command(c, text);
        });
        return { status: CustomCommandStatus.Success };
      });
    }
  } catch (e) {
    logError("startup.command", e);
  }
});

const setDismount = (p, on) => {
  try {
    p.inputPermissions.setPermissionCategory(8, on);
  } catch {
    /* ignore */
  }
};

// ------------------------------------------------------------------ mundo carregado
world.afterEvents.worldLoad.subscribe(() => {
  loadAllRecords();
  for (const p of world.getAllPlayers()) setDismount(p, true); // segurança: nunca deixa ninguém preso
  for (const c of COMPANIONS.values()) {
    const e = findEntityFor(c);
    if (e) adopt(e);
  }
  every("lila.tick", 1, () => {
    for (const c of COMPANIONS.values()) {
      try {
        if (c.rec.defeat) {
          tickDefeat(c);
          continue;
        }
      } catch (e) {
        logError("lila.defeat", e);
      }
      if (!c.owner() && !c.flags.test) continue; // dono offline: ele espera
      try {
        if (armyActive(c)) {
          armyTick(c);
          continue;
        }
        if (c.alive() && isRideForm(formOf(c))) {
          formTick(c); // veículos e colosso: você pilota, o cérebro descansa
          continue;
        }
        if (c.alive() && formOf(c) === "swarm") swarmTick(c); // enxame: poderes + o cérebro de sempre
        // carona no drone: o dono pilota; o cérebro espera e retoma quando ele descer
        if (c.def?.flying && c.alive()) {
          const rider = riddenBy(c);
          if (rider) {
            c.flags.ridden = true;
            rideTick(c, rider);
            continue;
          }
          if (c.flags.ridden) {
            c.flags.ridden = false;
            c.abortMove = true;
          }
        }
        tick(c);
      } catch (e) {
        logError("lila.tick", e);
      }
    }
  });
  every("lila.sense", 10, () => {
    const owners = new Map();
    for (const c of COMPANIONS.values()) {
      if (!c.owner() && !c.flags.test) continue;
      try {
        if (!armyActive(c) && !c.alive() && c.rec.summoned && !c.rec.defeat) {
          const e = findEntityFor(c);
          if (e) {
            adopt(e);
            resetWaypoint(c);
          }
        }
        if (!c.flags.ridden && !armyActive(c) && !isRideForm(formOf(c))) sense(c);
        updateHud(c);
        const o = c.owner();
        if (o) owners.set(o.id, o);
      } catch (e) {
        logError("lila.sense", e);
      }
    }
    for (const o of owners.values()) flushHud(o, companionsOf(o.id));
  }, 3);
  every("lila.slow", 20, () => {
    for (const c of COMPANIONS.values()) {
      try {
        if (!c.rec.defeat) metabolism(c);
      } catch (e) {
        logError("lila.slow", e);
      }
    }
  }, 7);
  every("lila.save", 100, () => {
    for (const c of COMPANIONS.values()) {
      try {
        if (c.alive() && !c.rec.defeat) backupInventory(c);
        c.flush();
      } catch (e) {
        logError("lila.save", e);
      }
    }
  }, 11);
  startScheduler();
  logInfo("boot", "DR-0N Mega Drone carregado");
});

// ------------------------------------------------------------------ controle
world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack?.typeId === CONTROLLER) openController(ev.source);
});

world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
  if (ev.itemStack?.typeId === CONTROLLER) openController(ev.player);
});

world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  const t = ev.target;
  if (!t || !isCompanionType(t.typeId)) return;
  const owner = t.getDynamicProperty(OWNER_PROP);
  const c = companionForEntity(t);
  const held = ev.player.getComponent("minecraft:inventory")?.container?.getItem(ev.player.selectedSlotIndex)?.typeId;
  if (owner !== ev.player.id) {
    // outros jogadores podem pegar carona nos veículos/colosso (o assento é nativo)
    if (c && isRideForm(formOf(c))) ev.player.sendMessage(`${c.def.chatTag}Bem-vindo a bordo! Só o dono pilota. Agache para descer.`);
    else ev.player.sendMessage(`${c?.def.chatTag ?? "§b[DR-0N]§r "}Oi! Eu sou o DR-0N de ${c?.rec.ownerName ?? "outra pessoa"}. Fabrique o seu controle para ter o seu!`);
    return;
  }
  if (held !== CONTROLLER) return; // mão vazia = subir (assento nativo)
  openController(ev.player);
});

// ------------------------------------------------------------------ pilotagem: botões do jogo
function pilotOf(player) {
  for (const c of companionsOf(player.id)) {
    if (c.alive() && isRideForm(formOf(c)) && riders(c).some((r) => r.id === player.id)) return c;
  }
  return undefined;
}

world.afterEvents.playerSwingStart.subscribe((ev) => {
  const c = pilotOf(ev.player);
  if (c) primaryAttack(c, ev.player);
});

// Sair do veículo = agachar (o próprio jogo desmonta). Pular = o tick de pilotagem lê o botão.

// ------------------------------------------------------------------ entidades
world.afterEvents.entityLoad.subscribe((ev) => {
  if (ev.entity && isCompanionType(ev.entity.typeId)) {
    const c = adopt(ev.entity);
    if (c) resetWaypoint(c);
  }
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  setDismount(ev.player, true);
  for (const kind of SUMMONS.keys()) {
    const c = loadCompanion(ev.player, kind);
    if (c.rec.summoned && !c.alive() && !armyActive(c)) {
      const e = findEntityFor(c);
      if (e) adopt(e);
    }
  }
});

world.afterEvents.playerLeave.subscribe((ev) => {
  try {
    for (const c of companionsOf(ev.playerId)) {
      if (c.alive() && isRideForm(formOf(c))) releaseRiders(c);
      c.flush();
    }
  } catch (e) {
    logError("leave", e);
  }
});

// ------------------------------------------------------------------ dano
function particleAt(e, id) {
  try {
    particle(e.dimension, id, { x: e.location.x, y: e.location.y + 1, z: e.location.z });
  } catch {
    /* ignore */
  }
}

/** Dono pilotando o colosso: quase imortal. Dono batendo no próprio drone/robôs: sem dano. */
world.beforeEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  const src = ev.damageSource?.damagingEntity;
  if (e.typeId === "minecraft:player") {
    for (const c of companionsOf(e.id)) {
      if (c.alive() && formOf(c) === "colossus" && riders(c).some((r) => r.id === e.id)) {
        ev.cancel = true;
        return;
      }
      // escudo do enxame: nada passa (só o vazio do mundo e comandos)
      const cause = ev.damageSource?.cause;
      if (shieldOn(c) && cause !== "void" && cause !== "selfDestruct" && cause !== "override") {
        ev.cancel = true;
        const a = ev.damageSource?.damagingEntity;
        system.run(() => {
          try {
            particleAt(e, "lila:nano_shield");
            if (a && a.id !== e.id && a.isValid) {
              const dx = a.location.x - e.location.x, dz = a.location.z - e.location.z, l = Math.hypot(dx, dz) || 1;
              a.applyKnockback({ x: (dx / l) * 1.4, z: (dz / l) * 1.4 }, 0.4);
              markAggro(c, a, 800);
            }
          } catch {
            /* ignore */
          }
        });
        return;
      }
    }
    // passageiros do colosso também ficam protegidos
    const v = e.getComponent?.("minecraft:riding")?.entityRidingOn;
    if (v?.typeId === DRONE.entity && Number(v.getProperty("lila:form")) === 7) ev.cancel = true;
    return;
  }
  if (e.typeId === ROBOT) {
    if (src && src.id === e.getDynamicProperty(OWNER_PROP)) ev.cancel = true;
    return;
  }
  if (!isCompanionType(e.typeId)) return;
  const c = companionForEntity(e);
  if (!c) return;
  if (c.rec.defeat || (src && src.id === c.rec.ownerId)) {
    ev.cancel = true;
    return;
  }
  const f = formOf(c);
  ev.damage = ev.damage * (f === "colossus" ? 0.08 : f === "turret" ? 0.3 : f === "tank" ? 0.25 : f === "swarm" ? 0.15 : 0.45);
  let hp = 100;
  try {
    hp = e.getComponent("minecraft:health")?.currentValue ?? 100;
  } catch {
    /* ignore */
  }
  if (hp - ev.damage <= 0.5) {
    ev.cancel = true;
    system.run(() => defeat(c));
  }
});

/** Quem machucar o dono (ou o drone/robôs) vira alvo imediato — jogadores também. */
world.afterEvents.entityHurt.subscribe((ev) => {
  const attacker = ev.damageSource.damagingEntity;
  const hurt = ev.hurtEntity;
  if (!attacker || attacker.typeId === ROBOT || isCompanionType(attacker.typeId)) return;
  let list = [];
  if (hurt.typeId === "minecraft:player") list = companionsOf(hurt.id).filter((c) => c.rec.ownerId !== attacker.id);
  else if (isCompanionType(hurt.typeId)) list = [companionForEntity(hurt)];
  else if (hurt.typeId === ROBOT) {
    const owner = hurt.getDynamicProperty(OWNER_PROP);
    if (typeof owner === "string") list = companionsOf(owner);
  }
  for (const c of list) {
    if (!c || c.rec.defeat || attacker.id === c.rec.ownerId) continue;
    markAggro(c, attacker, 800);
    if (!c.alive() || c.urgent || c.flags.ridden || isRideForm(formOf(c)) || armyActive(c) || formOf(c) === "turret") continue;
    if (attacker.typeId === "minecraft:player") say(c, `${/** @type {any} */ (attacker).name ?? "Jogador"} te atacou. Revidando!`, { force: true });
    const gen = fight(c, attacker, 600);
    c.urgent = { desc: { type: "defend", origin: "auto" }, gen, wait: 0, t0: system.currentTick };
  }
});

/** Você bateu no DR-0N: ele te dá uma "lição" de leve (3 tirinhos fracos). */
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const p = ev.damagingEntity;
  const t = ev.hitEntity;
  if (p?.typeId !== "minecraft:player" || !t || !isCompanionType(t.typeId)) return;
  const c = companionForEntity(t);
  if (!c || c.rec.ownerId !== p.id || c.rec.settings.lesson === false || isRideForm(formOf(c))) return;
  const now = system.currentTick;
  if (now < (c.flags.lessonUntil ?? 0)) return;
  c.flags.lessonUntil = now + 80;
  say(c, "Ei! Bateu, levou! Toma uma liçãozinha...", { force: true });
  for (let k = 0; k < 3; k++) {
    system.runTimeout(() => {
      if (!c.alive() || !p.isValid) return;
      const a = c.pos(), b = p.location;
      for (let i = 1; i <= 6; i++) particle(c.dim(), "lila:tracer", { x: a.x + (b.x - a.x) * (i / 7), y: a.y + 0.3 + (b.y + 1 - a.y) * (i / 7), z: a.z + (b.z - a.z) * (i / 7) });
      sound(c.entity, "random.click", 0.7, 1.9);
      try {
        p.applyDamage(2, { cause: EntityDamageCause.magic, damagingEntity: c.entity }); // 1 coração (ignora armadura)
        p.applyKnockback({ x: (b.x - a.x) * 0.15, z: (b.z - a.z) * 0.15 }, 0.25);
      } catch {
        /* ignore */
      }
    }, 6 + k * 5);
  }
});

// Morte de verdade (ex.: /kill): mesmo assim ele volta em 20 s.
world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (!e || !isCompanionType(e.typeId)) return;
  for (const c of COMPANIONS.values()) {
    if (c.entity === e || c.rec.entityId === e.id) {
      if (!c.rec.defeat) {
        c.rec.defeat = { left: 400, sid: "", goals: c.rec.goals.slice() };
        c.rec.stats.defeats++;
      }
      c.rec.form = "drone";
      c.entity = undefined;
      c.save();
    }
  }
});

// ------------------------------------------------------------------ diagnóstico / autoteste
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "lila:selftest") runSelfTest(ev.message);
});
