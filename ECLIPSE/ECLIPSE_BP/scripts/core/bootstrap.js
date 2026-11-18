// Inicialização única do ECLIPSE: registra componentes/comandos no startup e liga os
// sistemas quando o mundo carrega. Protegido contra execução/listeners duplicados.
import { BlockPermutation, ButtonState, InputButton, system, world } from "@minecraft/server";
import { logError, logInfo } from "./log.js";
import { every, later, startScheduler } from "./scheduler.js";
import { dropFromCache, flushProfiles, getProfile, markDirty, saveProfile } from "./player_profile.js";
import { clearPlayer } from "./cooldowns.js";
import { isAdmin } from "./permissions.js";
import { chat, particle } from "./fx.js";
import { VERSION } from "./config.js";
import { dispatchItemUse } from "../abilities/ability_dispatcher.js";
import { registerCommands } from "../systems/commands.js";
import { firstJoin, giveKit, welcome } from "../systems/awakening.js";
import { openCoreMenu } from "../ui/core_menu.js";
import { openCodex } from "../ui/book_ui.js";
import { openForge } from "../ui/forge_ui.js";
import { auraTick, passiveTick } from "../modes/mode_manager.js";
import { superviseCompanions, validateLoadedCompanion, recallAll } from "../summoning/summon_manager.js";
import { openOrders } from "../summoning/companion_orders.js";
import { maintainThrown, purgeIfOrphan, reconcileOnJoin, recallAllRelics, tickThrown } from "../systems/thrown_relic_manager.js";
import { indexPlayers, onJumpPressed, stopFlight, tickFlight } from "../abilities/flight.js";
import { maintainForm, onDeathRevert, revert } from "../abilities/metamorphosis.js";
import { clearConstructs, persistConstructs, sweepConstructs } from "../abilities/shadow_creation.js";
import { materializeFx, sweepTempTools } from "../abilities/relics.js";
import { boltImpact } from "../modes/haze_mode.js";
import { careLyra, forgetLyra, lyraOnJoin, talk, tickLyra } from "../lyra/lyra_manager.js";
import { openLyraPanel } from "../lyra/lyra_ui.js";
import { explorationTick, forget as forgetProgress } from "../progression/progression_manager.js";
import { diagnosticsText } from "../systems/diagnostics.js";
import { runSelfTest } from "../systems/selftest.js";
import { GENERATED } from "../data/generated.js";

const G = /** @type {any} */ (globalThis);
const RELIC_IDS = new Set(GENERATED.relics.map((r) => r.id));

export function bootstrap() {
  if (G.__ECLIPSE_BOOTSTRAPPED) return;
  G.__ECLIPSE_BOOTSTRAPPED = true;

  // ------------------------------------------------------------ startup (early execution)
  system.beforeEvents.startup.subscribe((ev) => {
    try {
      ev.itemComponentRegistry.registerCustomComponent("eclipse:power", {
        onUse: (e) => {
          if (e.itemStack) dispatchItemUse(e.source, e.itemStack);
        },
        onUseOn: (e) => {
          if (e.source?.typeId === "minecraft:player") dispatchItemUse(/** @type {any} */ (e.source), e.itemStack);
        },
      });
    } catch (e) {
      logError("startup.item", e);
    }
    try {
      // blocos temporários se desfazem sozinhos mesmo se o registro se perder
      ev.blockComponentRegistry.registerCustomComponent("eclipse:temporary", {
        onTick: (e) => {
          const b = e.block;
          const age = Number(b.permutation.getState(/** @type {any} */ ("eclipse:age")) ?? 0);
          if (age >= 15) {
            particle(b.dimension, "eclipse:smoke_puff", b.center(), { color: { red: 0.3, green: 0.15, blue: 0.45 }, count: 2, radius: 0.3 });
            b.setType("minecraft:air");
          } else b.setPermutation(BlockPermutation.resolve(b.typeId, { "eclipse:age": age + 1 }));
        },
      });
    } catch (e) {
      logError("startup.block", e);
    }
    try {
      registerCommands(ev.customCommandRegistry, {
        menu: (p) => openCoreMenu(p),
        codex: (p) => openCodex(p),
        forge: (p) => openForge(p),
        kit: (p) => giveKit(p, true),
        lyra: (p, text) => (text ? talk(p, text) : openLyraPanel(p)),
        clear: (p) => chat(p, `§7${clearConstructs(p)} blocos temporários desfeitos.`),
        unstuck: (p) => {
          revert(p);
          stopFlight(p);
          recallAllRelics(p);
          chat(p, "§5[ECLIPSE] §fForma normal restaurada, asas recolhidas e relíquias recuperadas.");
        },
        diag: (p) => chat(p, diagnosticsText()),
        selftest: (p) => runSelfTest(p),
      });
    } catch (e) {
      logError("startup.commands", e);
    }
  });

  // ------------------------------------------------------------ mundo carregado
  world.afterEvents.worldLoad.subscribe(() => {
    try {
      init();
      logInfo("boot", `ECLIPSE — Shadow Sovereign v${VERSION} carregado.`);
    } catch (e) {
      logError("boot", e);
    }
  });
}

function players() {
  return world.getAllPlayers();
}

function init() {
  // ---------------- rotinas periódicas (um único runInterval no agendador)
  every("relics.tick", 1, tickThrown);
  every("flight.tick", 1, () => {
    indexPlayers(players());
    tickFlight();
  });
  every("lyra.tick", 1, () => {
    for (const p of players()) tickLyra(p);
  });
  every("aura", 2, () => {
    for (const p of players()) auraTick(p);
  });
  every("companions", 10, () => {
    for (const p of players()) superviseCompanions(p);
  }, 3);
  every("lyra.care", 10, () => {
    for (const p of players()) careLyra(p);
  }, 7);
  every("constructs", 40, sweepConstructs, 11);
  every("tools", 100, () => {
    for (const p of players()) sweepTempTools(p);
  }, 23);
  every("passives", 100, () => {
    for (const p of players()) {
      passiveTick(p);
      maintainForm(p);
      explorationTick(p);
    }
  }, 37);
  every("relics.maintain", 100, maintainThrown, 51);
  every("persist", 100, () => {
    flushProfiles(players());
    persistConstructs();
  }, 67);
  startScheduler();

  // ---------------- eventos
  world.afterEvents.itemUse.subscribe((ev) => dispatchItemUse(ev.source, ev.itemStack));

  world.afterEvents.playerSpawn.subscribe((ev) => {
    const player = ev.player;
    try {
      if (ev.initialSpawn) {
        getProfile(player);
        firstJoin(player);
        later(60, () => player.isValid && welcome(player), "welcome");
        later(40, () => player.isValid && reconcileOnJoin(player), "relics.join");
        later(80, () => player.isValid && lyraOnJoin(player), "lyra.join");
        later(20, () => {
          // estados inválidos de sessões anteriores (forma sem item, etc.)
          if (player.isValid && getProfile(player).form) maintainForm(player);
        }, "form.join");
      } else {
        if (getProfile(player).form) revert(player, true);
      }
    } catch (e) {
      logError("spawn", e);
    }
  });

  world.beforeEvents.playerLeave.subscribe((ev) => {
    const player = ev.player;
    const id = player.id;
    try {
      saveProfile(player);
    } catch {
      /* contexto restrito: o salvamento periódico já cobre */
    }
    system.run(() => {
      dropFromCache(id);
      clearPlayer(id);
      forgetLyra(id);
      forgetProgress(id);
    });
  });

  world.afterEvents.entityDie.subscribe((ev) => {
    const e = ev.deadEntity;
    try {
      if (e.typeId === "minecraft:player") {
        onDeathRevert(/** @type {any} */ (e));
        stopFlight(/** @type {any} */ (e), false);
        return;
      }
      if (!e.typeId.startsWith("eclipse:")) return;
      const ownerId = e.getDynamicProperty("eclipse:owner");
      const owner = players().find((p) => p.id === ownerId);
      if (!owner) return;
      const prof = getProfile(owner);
      if (e.typeId === "eclipse:lyra") {
        prof.lyra.id = null;
        prof.lyra.summoned = false;
        chat(owner, "§d[Lyra] §fFui ferida demais e voltei para a sombra para me recuperar. Me chame de novo quando quiser!");
      } else {
        prof.companions = prof.companions.filter((c) => c.id !== e.id);
        chat(owner, `§7${e.nameTag || e.typeId} voltou para a sombra para se recuperar.`);
      }
      markDirty(owner);
    } catch (err) {
      logError("die", err);
    }
  });

  world.afterEvents.entityLoad.subscribe((ev) => {
    const e = ev.entity;
    try {
      if (!e.typeId.startsWith("eclipse:")) return;
      if (e.typeId.startsWith("eclipse:thrown_")) purgeIfOrphan(e);
      else validateLoadedCompanion(e);
    } catch (err) {
      logError("load", err);
    }
  });

  world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
    const t = ev.target;
    try {
      if (!t?.typeId?.startsWith("eclipse:")) return;
      const owner = t.getDynamicProperty("eclipse:owner");
      if (t.typeId === "eclipse:lyra") {
        if (owner === ev.player.id || isAdmin(ev.player)) openLyraPanel(ev.player);
        else chat(ev.player, "§7Esta Lyra pertence a outro soberano.");
        return;
      }
      openOrders(ev.player, t);
    } catch (err) {
      logError("interact", err);
    }
  });

  world.afterEvents.playerButtonInput.subscribe((ev) => {
    try {
      if (ev.button === InputButton.Jump && ev.newButtonState === ButtonState.Pressed) onJumpPressed(ev.player);
    } catch (err) {
      logError("input", err);
    }
  });

  world.afterEvents.playerHotbarSelectedSlotChange.subscribe((ev) => {
    try {
      const it = ev.itemStack;
      if (it && RELIC_IDS.has(it.typeId)) materializeFx(ev.player, it.typeId.slice(8));
    } catch (err) {
      logError("hotbar", err);
    }
  });

  const onBoltHit = (projectile, loc, target) => {
    try {
      if (projectile?.typeId !== "eclipse:spell_bolt") return;
      const owner = players().find((p) => p.id === projectile.getDynamicProperty("eclipse:owner"));
      const el = String(projectile.getDynamicProperty("eclipse:element") ?? "shadow");
      if (owner) boltImpact(owner, el, loc, target);
    } catch (err) {
      logError("bolt", err);
    }
  };
  world.afterEvents.projectileHitEntity.subscribe((ev) => onBoltHit(ev.projectile, ev.location, ev.getEntityHit()?.entity));
  world.afterEvents.projectileHitBlock.subscribe((ev) => onBoltHit(ev.projectile, ev.location, undefined));

  world.afterEvents.playerDimensionChange.subscribe((ev) => {
    try {
      stopFlight(ev.player, false);
    } catch {
      /* */
    }
  });

  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === "eclipse:selftest") runSelfTest(ev.sourceEntity?.typeId === "minecraft:player" ? /** @type {any} */ (ev.sourceEntity) : undefined);
    if (ev.id === "eclipse:diag") logInfo("diag", diagnosticsText().replace(/§./g, ""));
    if (ev.id === "eclipse:recall_all" && ev.sourceEntity?.typeId === "minecraft:player") recallAll(/** @type {any} */ (ev.sourceEntity));
  });

  // jogadores já presentes (reload de scripts com /reload)
  for (const p of players()) getProfile(p);
}
