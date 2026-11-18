/**
 * Shadow beast abilities. Melee comes from the native AI of the beast entity; each species
 * adds one special move on a cooldown, used only against hostile mobs (never players, never
 * squad members, never passive animals unless the owner ordered a hunt).
 */
import { Entity, EntityDamageCause, Player } from "@minecraft/server";
import type { Agent } from "../ai/agent";
import { AnimState, BODY_TYPES } from "../core/constants";
import { BEAST_INFO, type BeastSpecies } from "../core/species";
import { dist, isValid, particle, safe, sound } from "../core/mc";
import { nearestHostile } from "../perception/perception";

const cooldown = new WeakMap<Agent, number>();
const adapt = new WeakMap<Agent, { stacks: number; until: number }>();

function hostileOk(e: Entity | undefined): e is Entity {
  if (!isValid(e)) return false;
  if (e instanceof Player) return false;
  const id = safe(() => e.typeId, "");
  if (BODY_TYPES.includes(id)) return false;
  return true;
}

function ready(a: Agent, ms: number): boolean {
  const now = Date.now();
  if ((cooldown.get(a) ?? 0) > now) return false;
  cooldown.set(a, now + ms);
  return true;
}

function line(a: Agent, from: Entity, to: Entity, color: { red: number; green: number; blue: number }): void {
  const f = { x: from.location.x, y: from.location.y + 1, z: from.location.z };
  const t = { x: to.location.x, y: to.location.y + 1, z: to.location.z };
  const d = dist(f, t);
  const n = Math.ceil(d * 2);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    particle(from.dimension, "shadowbound:sparkle", { x: f.x + (t.x - f.x) * k, y: f.y + (t.y - f.y) * k, z: f.z + (t.z - f.z) * k }, color);
  }
  void a;
}

function hostilesAround(center: Entity, r: number): Entity[] {
  return safe(() => center.dimension.getEntities({ location: center.location, maxDistance: r, families: ["monster"] }), [] as Entity[]).filter(hostileOk);
}

/** Current target: the threat the squad is handling, or the nearest monster near the owner. */
export function beastTarget(a: Agent): Entity | undefined {
  const e = a.body();
  if (!e) return undefined;
  if (a.rt.threatId) {
    const t = safe(() => e.dimension.getEntities({ location: e.location, maxDistance: 16 }).find((x) => x.id === a.rt.threatId), undefined);
    if (hostileOk(t)) return t;
  }
  const owner = a.owner();
  const near = nearestHostile(e.dimension, e.location, 12);
  if (near && (!owner || dist(owner.location, near.location) < 24)) return near;
  return undefined;
}

/** Called every brain tick for beasts. */
export function beastTick(a: Agent): void {
  const e = a.body();
  if (!e) return;
  const sp = a.persona as BeastSpecies;
  const owner = a.owner();
  // the deer heals even without enemies
  if (sp === "deer") {
    if (!ready(a, 5000)) return;
    const allies: Entity[] = [];
    if (owner && dist(owner.location, e.location) < 10) allies.push(owner);
    for (const x of safe(() => e.dimension.getEntities({ location: e.location, maxDistance: 10, families: ["shadowbound"] }), [] as Entity[])) allies.push(x);
    let healed = 0;
    for (const x of allies) {
      const h = safe(() => x.getComponent("minecraft:health"), undefined);
      if (h && h.currentValue < h.effectiveMax) {
        safe(() => x.addEffect("regeneration", 80, { amplifier: 0, showParticles: true }), undefined);
        particle(e.dimension, "shadowbound:sparkle", { x: x.location.x, y: x.location.y + 1.5, z: x.location.z }, { red: 0.5, green: 1, blue: 0.6 });
        healed++;
      }
    }
    if (healed) a.setAnim(AnimState.Cast, 800);
    return;
  }
  const t = beastTarget(a);
  if (!t) return;
  const d = dist(e.location, t.location);
  const color = a.color().particle;
  switch (sp) {
    case "toad":
      if (d > 3 && d < 11 && ready(a, 5000)) {
        line(a, e, t, color);
        safe(() => t.teleport({ x: e.location.x + (t.location.x - e.location.x) * 0.2, y: e.location.y, z: e.location.z + (t.location.z - e.location.z) * 0.2 }), undefined);
        sound(e.dimension, "mob.slime.attack", e.location, 0.8, 0.6);
        a.setAnim(AnimState.Cast, 600);
      }
      break;
    case "elephant":
      if (d < 6 && ready(a, 6000)) {
        for (const h of hostilesAround(e, 6)) {
          const dx = h.location.x - e.location.x;
          const dz = h.location.z - e.location.z;
          const n = Math.hypot(dx, dz) || 1;
          safe(() => h.applyImpulse({ x: (dx / n) * 1.6, y: 0.5, z: (dz / n) * 1.6 }), undefined);
          safe(() => h.applyDamage(4, { cause: EntityDamageCause.entityAttack, damagingEntity: e }), false);
        }
        if (owner) safe(() => owner.extinguishFire(true), false);
        particle(e.dimension, "shadowbound:sparkle", { x: e.location.x, y: e.location.y + 2, z: e.location.z }, { red: 0.4, green: 0.7, blue: 1 });
        sound(e.dimension, "random.splash", e.location, 1, 0.8);
        a.setAnim(AnimState.Cast, 800);
      }
      break;
    case "rabbit":
      if (d < 7 && ready(a, 6000)) {
        for (const h of hostilesAround(e, 7)) {
          safe(() => h.addEffect("blindness", 80, { amplifier: 0 }), undefined);
          safe(() => h.addEffect("slowness", 80, { amplifier: 1 }), undefined);
        }
        particle(e.dimension, "shadowbound:wisp", e.location);
        a.setAnim(AnimState.Cast, 600);
      }
      break;
    case "bull":
      if (d > 3 && d < 11 && ready(a, 5000)) {
        safe(() => e.teleport({ x: t.location.x - (t.location.x - e.location.x) / d, y: t.location.y, z: t.location.z - (t.location.z - e.location.z) / d }, { facingLocation: t.location }), undefined);
        safe(() => t.applyDamage(8, { cause: EntityDamageCause.entityAttack, damagingEntity: e }), false);
        safe(() => t.applyImpulse({ x: ((t.location.x - e.location.x) / d) * 2, y: 0.7, z: ((t.location.z - e.location.z) / d) * 2 }), undefined);
        particle(e.dimension, "shadowbound:wisp", e.location);
        sound(e.dimension, "mob.ravager.roar", e.location, 0.6, 1.2);
        a.setAnim(AnimState.Attack, 600);
      }
      break;
    case "lion":
      if (d < 9 && ready(a, 8000)) {
        for (const h of hostilesAround(e, 9)) {
          safe(() => h.addEffect("weakness", 120, { amplifier: 1 }), undefined);
          safe(() => h.addEffect("slowness", 60, { amplifier: 0 }), undefined);
        }
        sound(e.dimension, "mob.ravager.roar", e.location, 1, 0.8);
        a.setAnim(AnimState.Cast, 900);
      }
      break;
    case "dragon":
      if (d < 9 && ready(a, 4000)) {
        for (const h of hostilesAround(e, 8)) {
          safe(() => h.setOnFire(4, true), false);
          safe(() => h.applyDamage(6, { cause: EntityDamageCause.fire, damagingEntity: e }), false);
          line(a, e, h, { red: 0.6, green: 0.2, blue: 1 });
        }
        sound(e.dimension, "mob.enderdragon.growl", e.location, 0.6, 1.3);
        a.setAnim(AnimState.Cast, 900);
      }
      break;
    case "owl":
      if (d > 2 && d < 12 && ready(a, 4500)) {
        line(a, e, t, color);
        safe(() => t.applyDamage(4, { cause: EntityDamageCause.entityAttack, damagingEntity: e }), false);
        safe(() => t.addEffect("slowness", 60, { amplifier: 2 }), undefined);
        safe(() => t.applyImpulse({ x: 0, y: 0.6, z: 0 }), undefined);
        a.setAnim(AnimState.Attack, 600);
      }
      break;
    default:
      break;
  }
}

/** Extra effects when a beast lands a melee hit. */
export function onBeastHit(a: Agent, target: Entity): void {
  if (!hostileOk(target)) return;
  const sp = a.persona as BeastSpecies;
  if (sp === "wolf") safe(() => target.addEffect("slowness", 60, { amplifier: 0 }), undefined);
  if (sp === "serpent") {
    safe(() => target.addEffect("slowness", 80, { amplifier: 3 }), undefined);
    safe(() => target.addEffect("poison", 80, { amplifier: 0 }), undefined);
  }
  if (sp === "tiger") safe(() => target.addEffect("weakness", 40, { amplifier: 0 }), undefined);
}

/** The colossus adapts: every hit it takes makes it tougher for a while. */
export function onBeastHurt(a: Agent, damage: number): void {
  if (a.persona !== "colossus" || damage <= 0) return;
  const e = a.body();
  if (!e) return;
  const st = adapt.get(a) ?? { stacks: 0, until: 0 };
  if (Date.now() > st.until) st.stacks = 0;
  st.stacks = Math.min(3, st.stacks + 1);
  st.until = Date.now() + 30000;
  adapt.set(a, st);
  safe(() => e.addEffect("resistance", 600, { amplifier: st.stacks - 1, showParticles: false }), undefined);
  if (st.stacks === 3) particle(e.dimension, "shadowbound:sparkle", { x: e.location.x, y: e.location.y + 3, z: e.location.z }, { red: 1, green: 0.85, blue: 0.3 });
}

export function beastInfo(a: Agent) {
  return BEAST_INFO[a.persona as BeastSpecies];
}
