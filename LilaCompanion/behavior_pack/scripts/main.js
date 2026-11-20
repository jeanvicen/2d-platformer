// Lila Companion — ponto de entrada (APIs estáveis: @minecraft/server 2.x + server-ui 2.x).
// Nada aparece quando o jogador entra no mundo: tudo começa quando ele fabrica o Controle da Lila.
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, world } from "@minecraft/server";
import { every, startScheduler } from "./core/scheduler.js";
import { logError, logInfo } from "./core/log.js";
import { COMPANIONS, OWNER_PROP, adopt, companionForEntity, companionsOf, findEntityFor, isCompanionType, loadAllRecords, loadCompanion } from "./lila/companion.js";
import { command, metabolism, sense, tick } from "./lila/brain.js";
import { backupInventory, defeat, tickDefeat } from "./lila/lifecycle.js";
import { flushHud, resetWaypoint, updateHud } from "./lila/hud.js";
import { riddenBy, rideTick } from "./lila/drone.js";
import { fight } from "./lila/combat.js";
import { openController } from "./ui/controller.js";
import { runSelfTest } from "./test/selftest.js";
import { SUMMONS } from "./lila/registry.js";

/** Item de controle -> tipo de companheira. */
const CONTROLLERS = Object.fromEntries([...SUMMONS.values()].map((d) => [d.controller, d.key]));

// ------------------------------------------------------------------ registro antecipado
system.beforeEvents.startup.subscribe((ev) => {
  try {
    const optional = [];
    for (let i = 1; i <= 8; i++) optional.push({ name: `p${i}`, type: CustomCommandParamType.String });
    for (const def of SUMMONS.values()) {
      ev.customCommandRegistry.registerCommand({
        name: def.command ?? `lila:${def.key}`,
        description: `Dá uma ordem para ${def.name}. Ex.: /${(def.command ?? def.key).split(":")[1]} pega 20 madeira (sem texto: abre o menu)`,
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
            openController(src, def.key);
            return;
          }
          if (!c.rec.summoned || !c.alive()) {
            src.sendMessage(`${def.chatTag}Me invoque primeiro com o §l${def.key === "drone" ? "Controle do DR-0N" : "Controle da Lila"}§r.`);
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

// ------------------------------------------------------------------ mundo carregado
world.afterEvents.worldLoad.subscribe(() => {
  loadAllRecords();
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
      if (!c.owner() && !c.flags.test) continue; // dono offline: ela espera
      try {
        // carona: o dono pilota; o cérebro espera e retoma quando ele descer
        if (c.def?.flying && c.alive()) {
          const rider = riddenBy(c);
          if (rider) {
            c.flags.ridden = true;
            rideTick(c, rider);
            continue;
          }
          if (c.flags.ridden) {
            c.flags.ridden = false;
            c.abortMove = true; // replaneja o caminho a partir de onde ele foi deixado
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
        if (!c.alive() && c.rec.summoned && !c.rec.defeat) {
          const e = findEntityFor(c);
          if (e) {
            adopt(e);
            resetWaypoint(c);
          }
        }
        if (!c.flags.ridden) sense(c);
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
  logInfo("boot", "Lila Companion carregado");
});

// ------------------------------------------------------------------ controle
world.afterEvents.itemUse.subscribe((ev) => {
  const kind = CONTROLLERS[ev.itemStack?.typeId ?? ""];
  if (kind) openController(ev.source, kind);
});

world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
  const kind = CONTROLLERS[ev.itemStack?.typeId ?? ""];
  if (kind) openController(ev.player, kind);
});

world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  const t = ev.target;
  if (!t || !isCompanionType(t.typeId)) return;
  const owner = t.getDynamicProperty(OWNER_PROP);
  const c = companionForEntity(t);
  if (owner !== ev.player.id) {
    ev.player.sendMessage(`${c?.def.chatTag ?? "§a[Lila]§r "}Oi! Eu sou ${c?.def.name ?? "a Lila"} de ${c?.rec.ownerName ?? "outra pessoa"}. Fabrique o seu controle para ter o seu!`);
    return;
  }
  // tocar no drone de mão vazia = subir nele (carona); com o controle = menu
  const held = ev.player.getComponent("minecraft:inventory")?.container?.getItem(ev.player.selectedSlotIndex)?.typeId;
  if (c?.def.flying && held !== c.def.controller) return;
  openController(ev.player, c?.kind ?? "lila");
});

// ------------------------------------------------------------------ entidades
world.afterEvents.entityLoad.subscribe((ev) => {
  if (ev.entity && isCompanionType(ev.entity.typeId)) {
    const c = adopt(ev.entity);
    if (c) resetWaypoint(c);
  }
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  // nada é mostrado ao entrar: só reconecta as companheiras de quem já tem
  for (const kind of SUMMONS.keys()) {
    const c = loadCompanion(ev.player, kind);
    if (c.rec.summoned && !c.alive()) {
      const e = findEntityFor(c);
      if (e) adopt(e);
    }
  }
});

world.afterEvents.playerLeave.subscribe((ev) => {
  try {
    for (const c of companionsOf(ev.playerId)) c.flush();
  } catch (e) {
    logError("leave", e);
  }
});

// ------------------------------------------------------------------ dano: resistência e derrota
world.beforeEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  if (!isCompanionType(e.typeId)) return;
  const c = companionForEntity(e);
  if (!c) return;
  if (c.rec.defeat) {
    ev.cancel = true;
    return;
  }
  ev.damage = ev.damage * armorFactor(c);
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
}, { entityFilter: { families: ["lila_companion"] } });

/** Resistência: metade do dano normal, menos ainda com armadura no inventário. */
function armorFactor(c) {
  let pts = 0;
  try {
    const inv = c.entity?.getComponent("minecraft:inventory")?.container;
    const seen = new Set();
    for (let i = 0; inv && i < inv.size; i++) {
      const id = inv.getItem(i)?.typeId;
      if (!id || seen.has(id)) continue;
      const m = /^minecraft:(iron|diamond|netherite|golden)_(helmet|chestplate|leggings|boots)$/.exec(id);
      if (!m) continue;
      seen.add(m[2]);
      const table = { iron: { helmet: 2, chestplate: 6, leggings: 5, boots: 2 }, diamond: { helmet: 3, chestplate: 8, leggings: 6, boots: 3 },
        netherite: { helmet: 3, chestplate: 8, leggings: 6, boots: 3 }, golden: { helmet: 2, chestplate: 5, leggings: 3, boots: 1 } };
      pts += table[m[1]][m[2]];
    }
  } catch {
    /* ignore */
  }
  return 0.5 * (1 - Math.min(20, pts) * 0.035);
}

// Quem machucar o dono (ou ela) vira alvo imediato.
world.afterEvents.entityHurt.subscribe((ev) => {
  const attacker = ev.damageSource.damagingEntity;
  if (!attacker || attacker.typeId === "minecraft:player" || isCompanionType(attacker.typeId)) return;
  const hurt = ev.hurtEntity;
  /** @type {any[]} */
  let list = [];
  if (hurt.typeId === "minecraft:player") list = companionsOf(hurt.id);
  else if (isCompanionType(hurt.typeId)) list = [companionForEntity(hurt)];
  try {
    if (attacker.getComponent("minecraft:tameable")?.isTamed) return;
  } catch {
    /* ignore */
  }
  for (const c of list) {
    if (!c || !c.alive() || c.rec.defeat || c.urgent || c.flags.ridden) continue;
    const gen = fight(c, attacker, 400);
    c.urgent = { desc: { type: "defend", origin: "auto" }, gen, wait: 0, t0: system.currentTick };
  }
});

// Morte de verdade (ex.: /kill): mesmo assim ela volta em 20 s.
world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (!e || !isCompanionType(e.typeId)) return;
  for (const c of COMPANIONS.values()) {
    if (c.entity === e || c.rec.entityId === e.id) {
      if (!c.rec.defeat) {
        c.rec.defeat = { left: 400, sid: "", goals: c.rec.goals.slice() };
        c.rec.stats.defeats++;
      }
      c.entity = undefined;
      c.save();
    }
  }
});

// ------------------------------------------------------------------ diagnóstico / autoteste
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id === "lila:selftest") runSelfTest(ev.message);
});
