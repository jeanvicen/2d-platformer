// Regras de combate compartilhadas: quem pode ser atingido, dano, empurrão e cura.
import { EntityComponentTypes, EntityDamageCause } from "@minecraft/server";
import { worldConfig } from "../core/world_config.js";
import { ownerOf } from "../core/permissions.js";
import { logError } from "../core/log.js";

const PASSIVE_SAFE = ["minecraft:villager_v2", "minecraft:villager", "minecraft:wandering_trader", "minecraft:iron_golem", "minecraft:snow_golem",
  "minecraft:allay", "minecraft:wolf", "minecraft:cat", "minecraft:parrot", "minecraft:horse", "minecraft:donkey", "minecraft:mule",
  "minecraft:llama", "minecraft:axolotl", "minecraft:armor_stand", "minecraft:item", "minecraft:xp_orb", "minecraft:painting"];

/**
 * Alvo válido para poderes ofensivos de `player`:
 * monstros sempre; jogadores só com PvP ligado; nunca o próprio dono, suas criaturas, aldeões ou pets.
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Entity} e
 */
export function isHostileTarget(player, e, { includeNeutral = false } = {}) {
  try {
    if (!e.isValid || e.id === player.id) return false;
    if (e.typeId === "minecraft:player") return worldConfig().pvp;
    if (e.typeId.startsWith("eclipse:")) return false;
    if (PASSIVE_SAFE.includes(e.typeId)) return false;
    if (ownerOf(e)) return false;
    const tame = e.getComponent(EntityComponentTypes.Tameable);
    if (tame?.isTamed) return false;
    if (e.matches({ families: ["monster"] })) return true;
    return includeNeutral && e.matches({ families: ["mob"] }) && !e.nameTag;
  } catch {
    return false;
  }
}

/** Entidades hostis num raio. */
export function hostilesAround(player, loc, radius, opts = {}) {
  try {
    return player.dimension
      .getEntities({ location: loc, maxDistance: radius, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] })
      .filter((e) => isHostileTarget(player, e, opts));
  } catch (e) {
    logError("combat.around", e);
    return [];
  }
}

export function hurt(player, target, amount, cause = EntityDamageCause.magic) {
  try {
    return target.applyDamage(amount, { cause, damagingEntity: player });
  } catch {
    return false;
  }
}

/** Empurra um alvo (mobs usam impulso; jogadores, knockback). */
export function push(target, from, strength = 1.2, up = 0.4) {
  try {
    const dx = target.location.x - from.x;
    const dz = target.location.z - from.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    target.applyKnockback({ x: (dx / d) * strength, z: (dz / d) * strength }, up);
  } catch {
    try {
      target.applyImpulse({ x: 0, y: up, z: 0 });
    } catch {
      /* algumas entidades não aceitam */
    }
  }
}

export function heal(entity, amount) {
  try {
    const h = entity.getComponent(EntityComponentTypes.Health);
    if (!h) return 0;
    const before = h.currentValue;
    h.setCurrentValue(Math.min(h.effectiveMax, before + amount));
    return h.currentValue - before;
  } catch {
    return 0;
  }
}

export function healthFrac(entity) {
  try {
    const h = entity.getComponent(EntityComponentTypes.Health);
    return h ? h.currentValue / h.effectiveMax : 1;
  } catch {
    return 1;
  }
}

export function effect(entity, id, seconds, amp = 0, particles = false) {
  try {
    entity.addEffect(id, Math.round(seconds * 20), { amplifier: amp, showParticles: particles });
  } catch (e) {
    logError("combat.effect", `${id}: ${e}`);
  }
}

/** Companheiros e aliados do jogador num raio (para curas/buffs). */
export function alliesAround(player, radius) {
  try {
    return player.dimension.getEntities({ location: player.location, maxDistance: radius, families: ["eclipse_companion"] })
      .filter((e) => ownerOf(e) === player.id);
  } catch {
    return [];
  }
}
