/**
 * SHADOWBOUND - entry point. Wires events and the scheduler. All logic lives in modules.
 *
 * Scheduler (no work every tick except moving bodies):
 *   every tick      path followers (smooth movement)
 *   every 4 ticks   brain decision tick
 *   every 20 ticks  survival (hunger/health), respawns
 *   every 100 ticks save dirty records, anti-duplication sweep, combat effects
 */
import { EntityHealthComponent, Player, system, world } from "@minecraft/server";
import { DP_GOT_ITEM, ENTITY_ID, SUMMONER_ITEM, TUNING } from "./core/constants";
import { isValid, log, safe } from "./core/mc";
import { agentByBody, agentFor, agents, dedupeSweep, executorOf, onDeath, onEntitySpawn, onJoin, onLeave, respawnTick } from "./ai/agent_manager";
import { brainTick } from "./ai/brain";
import { onScriptEvent } from "./ai/llm_bridge";
import { isOwnerOfBody } from "./authorization/owner_auth";
import { refreshCombatEffects } from "./combat/combat";
import { survivalTick } from "./survival/survival_manager";
import { giveHeldItem, openMain } from "./ui/menus";
import { registerCommands } from "./ui/commands";
import { AnimState } from "./core/constants";
import { damageMainhand } from "./inventory/equipment";
import { ItemStack } from "@minecraft/server";
import { particle } from "./core/mc";

// ---------------------------------------------------------------------------------------------
// Startup: custom command (stable API, works without cheats)
// ---------------------------------------------------------------------------------------------
system.beforeEvents.startup.subscribe((ev) => {
  try {
    registerCommands(ev);
  } catch (e) {
    log("command registration failed", String(e));
  }
});

// ---------------------------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------------------------
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  // starter item, once per player
  if (!safe(() => p.getDynamicProperty(DP_GOT_ITEM), false)) {
    system.runTimeout(() => {
      const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
      const left = cont ? safe(() => cont.addItem(new ItemStack(SUMMONER_ITEM, 1)), undefined) : undefined;
      if (left) safe(() => p.dimension.spawnItem(left, p.location), undefined);
      safe(() => p.setDynamicProperty(DP_GOT_ITEM, true), undefined);
      safe(
        () =>
          p.sendMessage(
            "§d[Shadowbound]§r Você recebeu o §dInvocador das Sombras§r! Segure e use (toque e segure) para invocar sua companheira. Ou digite §f/sombra invocar luna§r.",
          ),
        undefined,
      );
    }, 40);
  }
  onJoin(p);
});

world.afterEvents.playerLeave.subscribe((ev) => onLeave(ev.playerId));

// ---------------------------------------------------------------------------------------------
// Input: summoner item, tapping the companion
// ---------------------------------------------------------------------------------------------
const lastUse = new Map<string, number>();
world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack.typeId !== SUMMONER_ITEM) return;
  const p = ev.source;
  const now = Date.now();
  if ((lastUse.get(p.id) ?? 0) + 600 > now) return;
  lastUse.set(p.id, now);
  openMain(p);
});

world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (ev.target.typeId !== ENTITY_ID) return;
  ev.cancel = true; // nobody can ride/trade/name/feed the shadow through vanilla interactions
  const player = ev.player;
  const target = ev.target;
  const sneaking = player.isSneaking;
  system.run(() => {
    if (!isOwnerOfBody(player, target)) {
      safe(() => player.onScreenDisplay.setActionBar("§7Acesso negado: esta sombra pertence a outra pessoa."), undefined);
      return;
    }
    const a = agentFor(player.id);
    if (!a) return;
    if (sneaking) giveHeldItem(player, a);
    else openMain(player);
  });
});

// ---------------------------------------------------------------------------------------------
// Combat & life events
// ---------------------------------------------------------------------------------------------
world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (safe(() => e.typeId, "") === ENTITY_ID) onDeath(e);
});

world.afterEvents.entityHurt.subscribe((ev) => {
  const hurt = ev.hurtEntity;
  const attacker = ev.damageSource.damagingEntity;
  if (hurt instanceof Player) {
    const a = agents.get(hurt.id);
    if (a && attacker && attacker.id !== a.bodyId && !(attacker instanceof Player)) {
      a.rt.ownerHurtAt = Date.now();
      a.rt.ownerAttackerId = attacker.id;
    }
    return;
  }
  if (safe(() => hurt.typeId, "") !== ENTITY_ID) return;
  const a = agentByBody(hurt);
  if (!a) return;
  a.markDirty();
  if (attacker && !(attacker instanceof Player) && safe(() => attacker.typeId, "") !== ENTITY_ID) {
    // attacked while working: defend herself (native hurt_by_target in follow mode)
    a.rt.protectUntil = Date.now() + 4000;
    a.rt.threatId = attacker.id;
    executorOf(a).interrupt();
    a.setNativeMode("follow");
  }
});

world.afterEvents.entityHitEntity.subscribe((ev) => {
  const d = ev.damagingEntity;
  if (safe(() => d.typeId, "") !== ENTITY_ID) return;
  const a = agentByBody(d);
  if (!a) return;
  a.setAnim(AnimState.Attack, 450);
  damageMainhand(a);
  const hit = ev.hitEntity;
  const hp = safe(() => (hit.getComponent("minecraft:health") as EntityHealthComponent | undefined)?.currentValue ?? 1, 1);
  if (hp <= 0) a.record.stats.kills++;
});

world.afterEvents.entitySpawn.subscribe((ev) => onEntitySpawn(ev.entity));

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id.startsWith("shadowbound:")) onScriptEvent(ev.id, ev.message);
});

// ---------------------------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------------------------
system.runInterval(() => {
  for (const a of agents.values()) {
    if (a.mover.status === "moving") {
      try {
        a.mover.tick();
      } catch (e) {
        log("mover", String(e));
      }
    }
  }
}, 1);

system.runInterval(() => {
  for (const a of agents.values()) {
    try {
      brainTick(a, TUNING.brainIntervalTicks);
    } catch (e) {
      log("brain", String(e), (e as Error)?.stack ?? "");
    }
  }
}, TUNING.brainIntervalTicks);

let slow = 0;
system.runInterval(() => {
  slow++;
  try {
    respawnTick();
  } catch (e) {
    log("respawn", String(e));
  }
  for (const a of agents.values()) {
    if (!a.record.active || a.record.dead) continue;
    try {
      survivalTick(a, 1);
      if (slow % 10 === 0) refreshCombatEffects(a);
      // discreet shadow wisps at her feet (low frequency, cheap)
      const b = a.body();
      if (b && slow % 6 === 0 && a.mover.status !== "moving") particle(b.dimension, "shadowbound:wisp", b.location);
    } catch (e) {
      log("survival", String(e));
    }
  }
  if (slow % 5 === 0) {
    for (const a of agents.values()) if (a.dirty) a.save();
    try {
      dedupeSweep();
    } catch (e) {
      log("dedupe", String(e));
    }
  }
}, 20);

// players already online when scripts reload (/reload)
system.run(() => {
  for (const p of world.getAllPlayers()) {
    const a = agentFor(p.id);
    if (a && a.record.active && !isValid(a.body())) onJoin(p);
  }
});

log("loaded");
