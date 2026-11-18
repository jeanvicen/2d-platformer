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
import { BODY_TYPES, DP_GOT_ITEM, SUMMONER_ITEM, TUNING } from "./core/constants";
import { isValid, log, safe } from "./core/mc";
import { agentByBody, agents, dedupeSweep, executorOf, onDeath, onEntitySpawn, onJoin, onLeave, respawnTick, squadOf } from "./ai/agent_manager";
import { rallyTo, socialTick } from "./ai/squad";
import { onBeastHit, onBeastHurt } from "./combat/beasts";
import { brainTick } from "./ai/brain";
import { onScriptEvent } from "./ai/llm_bridge";
import { isOwnerOfBody } from "./authorization/owner_auth";
import { refreshCombatEffects } from "./combat/combat";
import { survivalTick } from "./survival/survival_manager";
import { giveHeldItem, openMember } from "./ui/menus";
import { openSeal } from "./jujutsu/seal_menu";
import { addXp, onPlayerHit, onShikigamiDestroyed, sorcererTick } from "./jujutsu/sorcerer";
import { isRitualBody, onRitualDie, onRitualHurt, ritualTick } from "./jujutsu/ritual";
import { setBeastDeathHook } from "./ai/agent_manager";
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
            "§5[Legado das Dez Sombras]§r Você herdou a §fTécnica das Dez Sombras§r e recebeu o §5Selo das Dez Sombras§r! Segure e use (toque e segure) para abrir o Selo: invocações, técnicas, energia e o caderno. Comece com §f/sombra invocar caes divinos§r.",
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
  openSeal(p);
});

world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (!BODY_TYPES.includes(ev.target.typeId)) return;
  ev.cancel = true; // nobody can ride/trade/name/feed the shadow through vanilla interactions
  const player = ev.player;
  const target = ev.target;
  const sneaking = player.isSneaking;
  system.run(() => {
    if (!isOwnerOfBody(player, target)) {
      safe(() => player.onScreenDisplay.setActionBar("§7Acesso negado: esta sombra pertence a outra pessoa."), undefined);
      return;
    }
    const a = agentByBody(target);
    if (!a) return;
    if (sneaking && !a.isBeast) giveHeldItem(player, a);
    else openMember(player, a);
  });
});

// ---------------------------------------------------------------------------------------------
// Combat & life events
// ---------------------------------------------------------------------------------------------
setBeastDeathHook(onShikigamiDestroyed);

world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (!BODY_TYPES.includes(safe(() => e.typeId, ""))) return;
  if (isRitualBody(e)) onRitualDie(e);
  else onDeath(e);
});

world.afterEvents.entityHurt.subscribe((ev) => {
  const hurt = ev.hurtEntity;
  const attacker = ev.damageSource.damagingEntity;
  if (hurt instanceof Player) {
    if (!attacker || attacker instanceof Player || BODY_TYPES.includes(safe(() => attacker.typeId, ""))) return;
    for (const a of squadOf(hurt.id, true)) {
      a.rt.ownerHurtAt = Date.now();
      a.rt.ownerAttackerId = attacker.id;
    }
    return;
  }
  if (!BODY_TYPES.includes(safe(() => hurt.typeId, ""))) return;
  if (isRitualBody(hurt)) {
    onRitualHurt(hurt, attacker, String(ev.damageSource.cause), ev.damage);
    return;
  }
  const a = agentByBody(hurt);
  if (!a) return;
  a.markDirty();
  if (a.isBeast) onBeastHurt(a, ev.damage, String(ev.damageSource.cause));
  if (attacker && !(attacker instanceof Player) && !BODY_TYPES.includes(safe(() => attacker.typeId, ""))) {
    // attacked while working: defend herself (native hurt_by_target in follow mode), friends come to help
    a.rt.protectUntil = Date.now() + 4000;
    a.rt.threatId = attacker.id;
    executorOf(a).interrupt();
    a.setNativeMode("follow");
    rallyTo(a, attacker);
  }
});

world.afterEvents.entityHitEntity.subscribe((ev) => {
  const d = ev.damagingEntity;
  if (d instanceof Player) {
    onPlayerHit(d, ev.hitEntity);
    return;
  }
  if (!BODY_TYPES.includes(safe(() => d.typeId, ""))) return;
  const a = agentByBody(d);
  if (!a) return;
  a.setAnim(AnimState.Attack, 450);
  if (a.isBeast) onBeastHit(a, ev.hitEntity);
  else damageMainhand(a);
  const hit = ev.hitEntity;
  const hp = safe(() => (hit.getComponent("minecraft:health") as EntityHealthComponent | undefined)?.currentValue ?? 1, 1);
  if (hp <= 0) {
    a.record.stats.kills++;
    if (a.isBeast) addXp(a.record.ownerId, 5); // mastery grows as your shikigami exorcise enemies
  }
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
  try {
    sorcererTick();
    ritualTick();
  } catch (e) {
    log("jujutsu", String(e));
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
  if (slow % 10 === 0) {
    try {
      socialTick();
    } catch (e) {
      log("social", String(e));
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
    if (squadOf(p.id, true).some((a) => !isValid(a.body()))) onJoin(p);
  }
});

log("loaded");
