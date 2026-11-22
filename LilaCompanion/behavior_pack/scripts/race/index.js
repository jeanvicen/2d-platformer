// Sistema de Raças — liga tudo aos eventos do jogo. Não mexe no enxame Hacknd nem nos robôs:
// só reage aos itens da raça (roleta, Núcleo, Lâmina, Foice) e a jogadores com raça.
import { system, world } from "@minecraft/server";
import { forget, stateOf } from "./state.js";
import { engineTick } from "./engine.js";
import { afterHurt, applyBody, castActive, damageMods, draining, onKill, raceTick, stopDrain } from "./passives.js";
import { CORE, ROULETTE, ensureCore, itemSpawned, scytheBreak, weaponDamage, weaponHit, weaponPendingTick } from "./weapons.js";
import { reveal, useRoulette } from "./roulette.js";
import { openGrimoire } from "./ui.js";
import { cast } from "./engine.js";
import { sigForget } from "./signature.js";
import { godHistory } from "./signature2.js";
import { hudForget, hudRender, nextPage, selectedPower, setPowerMode } from "./hud.js";
import { logError } from "../core/log.js";

system.runInterval(() => {
  try {
    engineTick();
  } catch (e) {
    logError("race.engine", e);
  }
  const tick = system.currentTick;
  for (const p of world.getAllPlayers()) {
    try {
      raceTick(p, tick);
      if (tick % 40 === 7) weaponPendingTick(p);
      if (tick % 10 === 3) hudRender(p);
      if (tick % 10 === 0 && stateOf(p).race === "god") godHistory(p);
    } catch (e) {
      logError("race.tick", e);
    }
  }
}, 1);

world.afterEvents.itemUse.subscribe((ev) => {
  const p = ev.source;
  const id = ev.itemStack?.typeId;
  if (id === ROULETTE) {
    system.run(() => void useRoulette(p, p.selectedSlotIndex));
    return;
  }
  if (id !== CORE) return;
  const s = stateOf(p);
  if (!s.race) {
    p.onScreenDisplay.setActionBar("§7Você ainda não tem raça: use a Roleta das Essências.");
    return;
  }
  if (p.isSneaking) void openGrimoire(p); // agachar + usar = grimório (montar a barra, ver tudo)
  else setPowerMode(p, !s.pm);             // usar = liga/desliga o MODO PODER (painel na direita)
});

world.afterEvents.itemStopUse.subscribe((ev) => {
  if (ev.itemStack?.typeId === CORE && draining(ev.source)) stopDrain(ev.source);
});

// Modo poder: bater/quebrar/tocar usa o poder escolhido na barra de itens.
const SWING_OK = new Set(["Attack", "Mine", "None"]);
const lastTry = new Map(); // id → {id do poder, tick} (não repetir a mensagem de recarga ao segurar)
const lastPage = new Map();
world.afterEvents.playerSwingStart.subscribe((ev) => {
  const p = ev.player;
  let s;
  try {
    s = stateOf(p);
  } catch {
    return;
  }
  if (s.race && s.pm) {
    if (!SWING_OK.has(String(ev.swingSource))) return;
    try {
      if (p.getComponent("minecraft:riding")?.entityRidingOn) return; // pilotando veículo/TITÃ: a barra é dos poderes do veículo
    } catch {
      /* ignore */
    }
    if (draining(p)) return; // o dreno segue sozinho até o alvo morrer/escapar
    const tick = system.currentTick;
    if (p.isSneaking) {
      if (tick - (lastPage.get(p.id) ?? -99) > 8) {
        lastPage.set(p.id, tick);
        nextPage(p);
      }
      return;
    }
    const sel = selectedPower(p);
    if (!sel) {
      p.onScreenDisplay.setActionBar("§7Lugar vazio — agache e use o Núcleo para montar a barra.");
      return;
    }
    const prev = lastTry.get(p.id);
    const quiet = !!prev && prev.id === sel.id && tick - prev.tick < 12;
    lastTry.set(p.id, { id: sel.id, tick });
    s.active = sel.i;
    cast(p, sel.id, { quiet });
    hudRender(p, true);
    return;
  }
  if (ev.heldItemStack?.typeId === CORE) castActive(p);
});

world.afterEvents.playerHotbarSelectedSlotChange.subscribe((ev) => {
  const p = ev.player;
  const s = stateOf(p);
  if (!s.race || !s.pm) return;
  if (draining(p)) stopDrain(p);
  hudRender(p, true);
});

// No modo poder bater não quebra bloco (vira poder).
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
  try {
    const s = stateOf(ev.player);
    if (s.race && s.pm) ev.cancel = true;
  } catch {
    /* ignore */
  }
});

world.beforeEvents.entityHurt.subscribe((ev) => {
  const src = ev.damageSource?.damagingEntity;
  if (src?.typeId === "minecraft:player" && ev.damageSource.cause === "entityAttack") {
    const wd = weaponDamage(src);
    if (wd !== undefined) ev.damage = wd; // 30 (Lâmina) / 35 (Foice): dano base antes da armadura
  }
  const m = damageMods(ev);
  if (m === 0) {
    ev.cancel = true;
    return;
  }
  if (m !== 1) ev.damage = ev.damage * m;
});

world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    afterHurt(ev);
    const src = ev.damageSource?.damagingEntity;
    if (src?.typeId === "minecraft:player" && ev.damageSource.cause === "entityAttack") weaponHit(src, ev.hurtEntity);
  } catch (e) {
    logError("race.hurt", e);
  }
});

world.afterEvents.entityDie.subscribe((ev) => {
  try {
    onKill(ev);
  } catch {
    /* ignore */
  }
});

world.afterEvents.playerBreakBlock.subscribe((ev) => {
  try {
    scytheBreak(ev.player, ev.block, ev.brokenBlockPermutation.type.id, ev.itemStackBeforeBreak);
    if (stateOf(ev.player).race === "giant") {
      const at = { x: ev.block.location.x + 0.5, y: ev.block.location.y + 0.5, z: ev.block.location.z + 0.5 };
      ev.block.dimension.spawnParticle("lila:rc_debris", at);
    }
  } catch {
    /* ignore */
  }
});

world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (e?.typeId === "minecraft:item") system.run(() => e.isValid && itemSpawned(e));
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  const p = ev.player;
  system.runTimeout(() => {
    if (!p.isValid) return;
    const s = stateOf(p);
    if (!s.race) return;
    if (s.pending) reveal(p); // caiu no meio da roleta: aplica agora (nada duplica)
    else applyBody(p);
    ensureCore(p);
    weaponPendingTick(p); // a arma que caiu na morte volta já
    hudRender(p, true);
  }, 10);
});

world.afterEvents.playerLeave.subscribe((ev) => {
  forget(ev.playerId);
  hudForget(ev.playerId);
  sigForget(ev.playerId);
});
