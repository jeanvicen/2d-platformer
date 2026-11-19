// Lila Companion — ponto de entrada (APIs estáveis: @minecraft/server 2.x + server-ui 2.x).
// Nada aparece quando o jogador entra no mundo: tudo começa quando ele fabrica o Controle da Lila.
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, world } from "@minecraft/server";
import { every, startScheduler } from "./core/scheduler.js";
import { logError, logInfo } from "./core/log.js";
import { COMPANIONS, ENTITY_ID, OWNER_PROP, adopt, findEntityFor, loadAllRecords, loadCompanion } from "./lila/companion.js";
import { command, metabolism, sense, tick } from "./lila/brain.js";
import { backupInventory, defeat, tickDefeat } from "./lila/lifecycle.js";
import { resetWaypoint, updateHud } from "./lila/hud.js";
import { fight } from "./lila/combat.js";
import { openController } from "./ui/controller.js";
import { runSelfTest } from "./test/selftest.js";
import { LILA } from "./lila/registry.js";

const CONTROLLER = LILA.controller;

// ------------------------------------------------------------------ registro antecipado
system.beforeEvents.startup.subscribe((ev) => {
  try {
    const optional = [];
    for (let i = 1; i <= 8; i++) optional.push({ name: `p${i}`, type: CustomCommandParamType.String });
    ev.customCommandRegistry.registerCommand({
      name: "lila:lila",
      description: "Dá uma ordem para a Lila. Ex.: /lila pega 20 madeira (sem texto: abre o menu)",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      optionalParameters: optional,
    }, (origin, ...args) => {
      const src = origin.sourceEntity ?? origin.initiator;
      if (!(src instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Só jogadores podem usar /lila." };
      const text = args.filter((a) => typeof a === "string" && a.length).join(" ");
      system.run(() => {
        const c = loadCompanion(src);
        if (!text) {
          openController(src);
          return;
        }
        if (!c.rec.summoned || !c.alive()) {
          src.sendMessage("§a[Lila]§r Me invoque primeiro com o §lControle da Lila§r.");
          return;
        }
        src.sendMessage(`§7Você » Lila: §f${text}`);
        command(c, text);
      });
      return { status: CustomCommandStatus.Success };
    });
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
        tick(c);
      } catch (e) {
        logError("lila.tick", e);
      }
    }
  });
  every("lila.sense", 10, () => {
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
        sense(c);
        updateHud(c);
      } catch (e) {
        logError("lila.sense", e);
      }
    }
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
  if (ev.itemStack?.typeId !== CONTROLLER) return;
  openController(ev.source);
});

world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
  if (ev.itemStack?.typeId !== CONTROLLER) return;
  openController(ev.player);
});

world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  const t = ev.target;
  if (t?.typeId !== ENTITY_ID) return;
  const owner = t.getDynamicProperty(OWNER_PROP);
  if (owner !== ev.player.id) {
    const c = COMPANIONS.get(String(owner));
    ev.player.sendMessage(`§a[Lila]§r Oi! Eu sou a Lila de ${c?.rec.ownerName ?? "outra pessoa"}. Fabrique o seu Controle da Lila para ter a sua!`);
    return;
  }
  openController(ev.player);
});

// ------------------------------------------------------------------ entidades
world.afterEvents.entityLoad.subscribe((ev) => {
  if (ev.entity?.typeId === ENTITY_ID) {
    const c = adopt(ev.entity);
    if (c) resetWaypoint(c);
  }
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  // nada é mostrado ao entrar: só reconecta a Lila de quem já tem
  const c = loadCompanion(ev.player);
  if (c.rec.summoned && !c.alive()) {
    const e = findEntityFor(c);
    if (e) adopt(e);
  }
});

world.afterEvents.playerLeave.subscribe((ev) => {
  const c = COMPANIONS.get(ev.playerId);
  try {
    c?.flush();
  } catch (e) {
    logError("leave", e);
  }
});

// ------------------------------------------------------------------ dano: resistência e derrota
world.beforeEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  if (e.typeId !== ENTITY_ID) return;
  const owner = e.getDynamicProperty(OWNER_PROP);
  const c = COMPANIONS.get(String(owner));
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
}, { entityFilter: { type: ENTITY_ID } });

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
  if (!attacker || attacker.typeId === "minecraft:player" || attacker.typeId === ENTITY_ID) return;
  const hurt = ev.hurtEntity;
  let c;
  if (hurt.typeId === "minecraft:player") c = COMPANIONS.get(hurt.id);
  else if (hurt.typeId === ENTITY_ID) c = COMPANIONS.get(String(hurt.getDynamicProperty(OWNER_PROP)));
  if (!c || !c.alive() || c.rec.defeat || c.urgent) return;
  try {
    if (attacker.getComponent("minecraft:tameable")?.isTamed) return;
  } catch {
    /* ignore */
  }
  const gen = fight(c, attacker, 400);
  c.urgent = { desc: { type: "defend", origin: "auto" }, gen, wait: 0, t0: system.currentTick };
});

// Morte de verdade (ex.: /kill): mesmo assim ela volta em 20 s.
world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (e?.typeId !== ENTITY_ID) return;
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
