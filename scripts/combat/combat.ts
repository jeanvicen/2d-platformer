/**
 * Combat Behavior.
 *  - native AI (component groups) does the melee: defends the owner, attacks monsters,
 *    ignores passive mobs, players and other shadows
 *  - this module adds: threat detection around the owner, the combat leash (never chase
 *    far from the owner), weapon/armor effects, and Luna's ranged magic bolt
 */
import { Entity, EntityDamageCause } from "@minecraft/server";
import type { Agent } from "../ai/agent";
import { AnimState, CASTERS, Mood, TUNING } from "../core/constants";
import { dist, isValid, particle, safe, sound } from "../core/mc";
import { armorPoints, equipBestWeapon } from "../inventory/equipment";
import { weaponDamage } from "../inventory/item_catalog";
import { nearestHostile } from "../perception/perception";
import { sayKey, setMood } from "../communication/comms";

/** Returns the most urgent threat to the owner, if any. */
export function ownerThreat(a: Agent): Entity | undefined {
  const owner = a.owner();
  const e = a.body();
  if (!owner || !e || owner.dimension.id !== e.dimension.id) return undefined;
  // 1) whoever hurt the owner in the last 6 seconds
  if (a.rt.ownerAttackerId && Date.now() - a.rt.ownerHurtAt < 6000) {
    const att = safe(() => owner.dimension.getEntities({ location: owner.location, maxDistance: 24 }).find((x) => x.id === a.rt.ownerAttackerId), undefined);
    if (isValid(att) && safe(() => att.typeId, "") !== "minecraft:player" && !safe(() => att.matches({ families: ["shadowbound"] }), false)) return att;
  }
  // 2) hostile mobs close to the owner
  return nearestHostile(owner.dimension, owner.location, a.record.mode === "protect" ? TUNING.protectRadius : 8);
}

/** Luna's magic bolt: ranged damage with a particle trail (also handles creepers safely). */
export function magicBolt(a: Agent, target: Entity): boolean {
  const e = a.body();
  if (!e || !isValid(target) || !CASTERS.includes(a.persona)) return false;
  if (Date.now() < a.rt.boltCooldown) return false;
  const d = dist(e.location, target.location);
  if (d > 12 || d < 2) return false;
  a.rt.boltCooldown = Date.now() + 2500;
  const from = { x: e.location.x, y: e.location.y + 1.4, z: e.location.z };
  const to = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
  const steps = Math.ceil(d * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    particle(e.dimension, "shadowbound:sparkle", { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t }, a.color().particle);
  }
  safe(() => e.teleport(e.location, { facingLocation: to }), undefined);
  a.setAnim(AnimState.Cast, 600);
  sound(e.dimension, "mob.evocation_illager.cast_spell", e.location, 0.5, 1.4);
  safe(() => target.applyDamage(5, { cause: EntityDamageCause.magic, damagingEntity: e }), false);
  return true;
}

/** Keep fights close to the owner. */
export function leash(a: Agent): void {
  const owner = a.owner();
  const e = a.body();
  if (!owner || !e) return;
  if (a.nativeMode === "follow" && dist(owner.location, e.location) > TUNING.leashCombatDistance) a.resetNativeTargets();
}

/**
 * Status effects that represent equipment on an NPC body:
 *  - armor points -> Resistance (each level = 20% less damage)
 *  - weapon damage -> Strength (each level = +3 melee damage)
 */
export function refreshCombatEffects(a: Agent): void {
  const e = a.body();
  if (!e) return;
  const pts = armorPoints(a);
  const res = pts >= 20 ? 2 : pts >= 13 ? 1 : pts >= 6 ? 0 : -1;
  if (res >= 0) safe(() => e.addEffect("resistance", 260, { amplifier: res, showParticles: false }), undefined);
  const w = weaponDamage(a.record.equipment.mainhand?.id);
  const str = (w >= 7 ? 1 : w >= 5 ? 0 : -1) + (a.persona === "raven" ? 1 : 0);
  if (str >= 0) safe(() => e.addEffect("strength", 260, { amplifier: Math.min(str, 2), showParticles: false }), undefined);
}

export function enterProtect(a: Agent, threat: Entity): void {
  const first = Date.now() > a.rt.protectUntil;
  a.rt.protectUntil = Date.now() + 5000;
  a.rt.threatId = threat.id;
  equipBestWeapon(a);
  a.setNativeMode("follow");
  setMood(a.body(), Mood.Focused);
  if (first) sayKey(a, "threat", undefined, { throttleMs: 15000 });
}
