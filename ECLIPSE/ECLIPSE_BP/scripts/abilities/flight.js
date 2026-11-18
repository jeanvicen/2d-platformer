// Voo com asas equipadas no peito.
// Controles (touch): pulo duplo no ar = abrir asas e voar; segurar PULO = subir;
// soltar = planar; joystick = direção; AGACHAR (toque) = mergulhar/descer; pousar = fecha as asas.
// Alternativa sem pulo duplo: Grimório → "Voar".
import { ButtonState, InputButton, system } from "@minecraft/server";
import { COLORS } from "../core/config.js";
import { actionbar, particle, playerSound } from "../core/fx.js";
import { chestItem } from "../core/items.js";
import { getProfile, markDirty } from "../core/player_profile.js";
import { effectivePreset } from "../core/world_config.js";
import { clamp } from "../core/util.js";
import { effect } from "./combat.js";
import { questProgress } from "../progression/progression_manager.js";

/** @type {Map<string, {vx:number,vz:number,t:number,ground:number}>} */
const flying = new Map();
const lastJump = new Map();

const WING_FX = {
  "eclipse:wings_shadow": { id: "eclipse:feather_fall", color: { red: 0.08, green: 0.05, blue: 0.14 } },
  "eclipse:wings_celestial": { id: "eclipse:mote", color: COLORS.gold },
  "eclipse:wings_void": { id: "eclipse:trail", color: COLORS.violet },
  "eclipse:wings_dragon": { id: "eclipse:smoke_puff", color: { red: 0.25, green: 0.12, blue: 0.35 } },
};

export function wearingWings(player) {
  const it = chestItem(player);
  return it?.hasTag("eclipse:wings") ? it.typeId : undefined;
}

export function isFlying(player) {
  return flying.has(player.id);
}

export function startFlight(player, boost = 0.9) {
  if (!wearingWings(player)) {
    actionbar(player, "§7Equipe asas no peito para voar (Forja → Asas).");
    return false;
  }
  if (getProfile(player).prefs.flight === false) return false;
  if (player.isInWater || player.isGliding) return false;
  flying.set(player.id, { vx: 0, vz: 0, t: 0, ground: 0 });
  try {
    player.applyKnockback({ x: 0, z: 0 }, boost);
  } catch {
    /* */
  }
  effect(player, "slow_falling", 2);
  playerSound(player, "eclipse.wings_open", 1, 1);
  actionbar(player, "§d✦ Asas abertas §7— segure PULO para subir · AGACHAR para descer");
  return true;
}

export function stopFlight(player, msg = true) {
  if (!flying.delete(player.id)) return;
  effect(player, "slow_falling", 3); // evita dano de queda ao fechar no ar
  if (msg) actionbar(player, "§7Asas recolhidas.");
}

/** Pulo duplo: um segundo toque em PULO enquanto está no ar abre as asas. */
export function onJumpPressed(player) {
  if (!wearingWings(player)) return;
  if (isFlying(player)) return;
  const now = system.currentTick;
  if (!player.isOnGround) {
    const last = lastJump.get(player.id) ?? -999;
    if (now - last < 14 || player.isFalling) startFlight(player, 0.7);
  }
  lastJump.set(player.id, now);
}

/** Física de voo (a cada tick, só para quem está voando). */
export function tickFlight() {
  for (const [id, st] of flying) {
    const player = system && getPlayer(id);
    if (!player) {
      flying.delete(id);
      continue;
    }
    try {
      if (!wearingWings(player) || player.isInWater || player.isGliding || player.getComponent("minecraft:riding")) {
        stopFlight(player);
        continue;
      }
      st.t++;
      if (player.isOnGround && st.t > 8) {
        st.ground++;
        if (st.ground > 3) {
          stopFlight(player, false);
          particle(player.dimension, "eclipse:ground_impact", player.location, {});
          playerSound(player, "eclipse.wings_open", 0.6, 0.7);
          actionbar(player, "§7Pouso suave.");
          continue;
        }
      } else st.ground = 0;
      const input = player.inputInfo;
      const mv = input.getMovementVector(); // y = frente, x = lado
      const up = input.getButtonState(InputButton.Jump) === ButtonState.Pressed;
      const down = input.getButtonState(InputButton.Sneak) === ButtonState.Pressed;
      const rot = player.getRotation();
      const yaw = (rot.y * Math.PI) / 180;
      const fx = -Math.sin(yaw), fz = Math.cos(yaw);
      const rx = -fz, rz = fx;
      const speed = player.isSprinting ? 0.95 : 0.65;
      const tx = (fx * mv.y - rx * mv.x) * speed;
      const tz = (fz * mv.y - rz * mv.x) * speed;
      // aceleração/desaceleração suaves
      st.vx += (tx - st.vx) * 0.18;
      st.vz += (tz - st.vz) * 0.18;
      const h = Math.sqrt(st.vx * st.vx + st.vz * st.vz);
      if (h > 1.1) {
        st.vx *= 1.1 / h;
        st.vz *= 1.1 / h;
      }
      let vy = up ? 0.42 : down ? -0.7 : -0.06;
      // não atravessa teto
      const head = player.dimension.getBlock({ x: player.location.x, y: player.location.y + 2.1, z: player.location.z });
      if (up && head && !head.isAir && !head.isLiquid) vy = 0;
      player.applyKnockback({ x: st.vx, z: st.vz }, clamp(vy, -0.8, 0.5));
      if (st.t % 10 === 0) effect(player, "slow_falling", 1.5);
      const p = getProfile(player);
      p.stats.flightTicks++;
      if (st.t % 100 === 0) {
        markDirty(player);
        questProgress(player, "flyer", 100);
      }
      const preset = effectivePreset(p);
      if (preset.trails && st.t % preset.flightFx === 0) {
        const fxd = WING_FX[wearingWings(player)] ?? WING_FX["eclipse:wings_shadow"];
        const l = player.location;
        particle(player.dimension, fxd.id, { x: l.x - fx * 0.6, y: l.y + 1.1, z: l.z - fz * 0.6 }, { color: fxd.color, count: 2, size: 0.25 });
      }
      if (st.t > 20 * 60 * 30) stopFlight(player); // proteção contra estados presos
    } catch {
      flying.delete(id);
    }
  }
}

/** @type {Map<string, import("@minecraft/server").Player>} */
const playerIndex = new Map();
export function indexPlayers(players) {
  playerIndex.clear();
  for (const p of players) playerIndex.set(p.id, p);
}
function getPlayer(id) {
  const p = playerIndex.get(id);
  return p && p.isValid ? p : undefined;
}

export function flightCount() {
  return flying.size;
}
