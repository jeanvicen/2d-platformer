/**
 * Shikigami abilities (Ten Shadows Technique). Melee comes from the native AI of the beast entity;
 * each species adds its own move on a cooldown, used only against hostile mobs (never players,
 * never squad members). Origin of each ability (canon / interpretation / original): scripts/jujutsu/canon.ts
 */
import { Entity, EntityDamageCause, Player } from "@minecraft/server";
import type { Agent } from "../ai/agent";
import { AnimState, BODY_TYPES } from "../core/constants";
import { BEAST_INFO, type BeastSpecies } from "../core/species";
import { dist, isValid, particle, safe, sound } from "../core/mc";
import { nearestHostile } from "../perception/perception";
import { adaptHit, spawnDecoys } from "../jujutsu/ritual";

const cooldown = new WeakMap<Agent, number>();

function hostileOk(e: Entity | undefined): e is Entity {
  if (!isValid(e)) return false;
  if (e instanceof Player) return false;
  return !BODY_TYPES.includes(safe(() => e.typeId, ""));
}

function ready(a: Agent, ms: number): boolean {
  const now = Date.now();
  if ((cooldown.get(a) ?? 0) > now) return false;
  cooldown.set(a, now + ms);
  return true;
}

function line(from: Entity, to: Entity, color: { red: number; green: number; blue: number }): void {
  const f = { x: from.location.x, y: from.location.y + 1, z: from.location.z };
  const t = { x: to.location.x, y: to.location.y + 1, z: to.location.z };
  const n = Math.ceil(dist(f, t) * 2);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    particle(from.dimension, "shadowbound:sparkle", { x: f.x + (t.x - f.x) * k, y: f.y + (t.y - f.y) * k, z: f.z + (t.z - f.z) * k }, color);
  }
}

function hostilesAround(center: Entity, r: number): Entity[] {
  return safe(() => center.dimension.getEntities({ location: center.location, maxDistance: r, families: ["monster"] }), [] as Entity[]).filter(hostileOk);
}

function hit(t: Entity, n: number, by: Entity, cause = EntityDamageCause.entityAttack): void {
  safe(() => t.applyDamage(n, { cause, damagingEntity: by }), false);
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

/** Support moves that do not need an enemy. Returns true if something was done. */
function support(a: Agent, e: Entity, owner: Player | undefined, sp: BeastSpecies, force: boolean): boolean {
  if (sp === "deer") {
    if (!force && !ready(a, 5000)) return false;
    const allies: Entity[] = [];
    if (owner && dist(owner.location, e.location) < 10) allies.push(owner);
    for (const x of safe(() => e.dimension.getEntities({ location: e.location, maxDistance: 10, families: ["shadowbound"] }), [] as Entity[])) allies.push(x);
    let n = 0;
    for (const x of allies) {
      const h = safe(() => x.getComponent("minecraft:health"), undefined);
      const hurt = h && h.currentValue < h.effectiveMax;
      for (const ef of ["poison", "wither", "slowness", "weakness", "blindness"]) safe(() => x.removeEffect(ef), false);
      if (hurt || force) {
        safe(() => x.addEffect("regeneration", 80, { amplifier: 1, showParticles: true }), undefined);
        particle(e.dimension, "shadowbound:sparkle", { x: x.location.x, y: x.location.y + 1.5, z: x.location.z }, { red: 0.95, green: 1, blue: 0.8 });
        n++;
      }
    }
    if (n) a.setAnim(AnimState.Cast, 800);
    return n > 0;
  }
  if (sp === "owl" && owner) {
    // Nue gives the summoner aerial mobility: it catches falls
    const v = safe(() => owner.getVelocity(), { x: 0, y: 0, z: 0 });
    if (v.y < -0.7 && dist(owner.location, e.location) < 20) {
      safe(() => owner.addEffect("slow_falling", 60, { amplifier: 0, showParticles: false }), undefined);
      particle(e.dimension, "shadowbound:sparkle", owner.location, { red: 1, green: 0.95, blue: 0.4 });
      return true;
    }
  }
  if (sp === "toad" && owner) {
    // rescue: pulls the owner out of danger when badly hurt
    const hp = safe(() => owner.getComponent("minecraft:health")?.currentValue ?? 20, 20);
    const threat = nearestHostile(owner.dimension, owner.location, 4);
    if (hp < 7 && threat && dist(owner.location, e.location) > 4 && dist(owner.location, e.location) < 16 && (force || ready(a, 12000))) {
      line(e, owner, { red: 1, green: 0.4, blue: 0.55 });
      safe(() => owner.teleport({ x: e.location.x + 1, y: e.location.y, z: e.location.z }), undefined);
      safe(() => owner.sendMessage("§d🐸 O Sapo puxou você para longe do perigo!"), undefined);
      a.setAnim(AnimState.Cast, 600);
      return true;
    }
  }
  return false;
}

/** Called every brain tick for shikigami. `force` = the owner pressed the ability button. */
export function beastTick(a: Agent, force = false): boolean {
  const e = a.body();
  if (!e) return false;
  const sp = a.persona as BeastSpecies;
  const owner = a.owner();
  if (support(a, e, owner, sp, force)) return true;
  if (sp === "deer") return false;
  const t = beastTarget(a);
  if (!t) {
    if (force && owner) safe(() => owner.sendMessage(`§7${a.name}: nenhum inimigo por perto.`), undefined);
    return false;
  }
  const d = dist(e.location, t.location);
  const color = a.color().particle;
  const cd = (ms: number) => force || ready(a, ms);
  switch (sp) {
    case "wolf":
    case "dog_white":
    case "totality": {
      // tracking: the dogs sniff the enemy out and tell the owner where it is
      if (!cd(sp === "totality" ? 4000 : 7000)) return false;
      line(e, t, sp === "dog_white" ? { red: 0.9, green: 0.95, blue: 1 } : { red: 0.25, green: 0.25, blue: 0.35 });
      if (owner) safe(() => owner.onScreenDisplay.setActionBar(`§7🐺 ${a.name} farejou ${t.typeId.replace("minecraft:", "")} a ${Math.round(d)} blocos`), undefined);
      if (sp === "totality" && d < 4) {
        hit(t, 8, e);
        safe(() => t.addEffect("slowness", 60, { amplifier: 1 }), undefined);
      }
      a.setAnim(AnimState.Cast, 700);
      return true;
    }
    case "owl":
      if (d > 2 && d < 14 && cd(4500)) {
        line(e, t, { red: 1, green: 0.95, blue: 0.35 });
        hit(t, 5, e, EntityDamageCause.lightning);
        safe(() => t.addEffect("slowness", 50, { amplifier: 3 }), undefined); // electric paralysis
        sound(e.dimension, "ambient.weather.lightning.impact", t.location, 0.3, 1.8);
        a.setAnim(AnimState.Attack, 600);
        return true;
      }
      return false;
    case "serpent":
      if (d < 14 && cd(6000)) {
        // emerges from the shadow under the target and holds it
        particle(e.dimension, "shadowbound:wisp", e.location);
        safe(() => e.teleport({ x: t.location.x + 0.6, y: t.location.y, z: t.location.z + 0.6 }, { facingLocation: t.location }), undefined);
        particle(e.dimension, "shadowbound:wisp", t.location);
        hit(t, 6, e);
        safe(() => t.addEffect("slowness", 70, { amplifier: 5 }), undefined);
        sound(e.dimension, "mob.endermen.portal", t.location, 0.5, 0.5);
        a.setAnim(AnimState.Attack, 700);
        return true;
      }
      return false;
    case "toad":
      if (d > 3 && d < 11 && cd(5000)) {
        line(e, t, color);
        safe(() => t.teleport({ x: e.location.x + (t.location.x - e.location.x) * 0.2, y: e.location.y, z: e.location.z + (t.location.z - e.location.z) * 0.2 }), undefined);
        safe(() => t.addEffect("slowness", 40, { amplifier: 2 }), undefined);
        sound(e.dimension, "mob.slime.attack", e.location, 0.8, 0.6);
        a.setAnim(AnimState.Cast, 600);
        return true;
      }
      return false;
    case "elephant":
      if (d < 8 && cd(7000)) {
        for (const h of hostilesAround(e, 8)) {
          const dx = h.location.x - e.location.x;
          const dz = h.location.z - e.location.z;
          const n = Math.hypot(dx, dz) || 1;
          safe(() => h.applyImpulse({ x: (dx / n) * 2, y: 0.6, z: (dz / n) * 2 }), undefined);
          hit(h, 5, e, EntityDamageCause.drowning);
          safe(() => h.extinguishFire(true), false);
        }
        if (owner) safe(() => owner.extinguishFire(true), false);
        for (let i = 0; i < 8; i++) particle(e.dimension, "shadowbound:sparkle", { x: e.location.x + Math.cos(i) * 3, y: e.location.y + 2.5, z: e.location.z + Math.sin(i) * 3 }, { red: 0.4, green: 0.7, blue: 1 });
        sound(e.dimension, "random.splash", e.location, 1, 0.6);
        a.setAnim(AnimState.Cast, 900);
        return true;
      }
      return false;
    case "rabbit":
      if (d < 10 && cd(15000)) {
        spawnDecoys(e, 6, 20);
        for (const h of hostilesAround(e, 8)) safe(() => h.addEffect("blindness", 80, { amplifier: 0 }), undefined);
        sound(e.dimension, "mob.rabbit.hop", e.location, 1, 1.4);
        a.setAnim(AnimState.Cast, 800);
        return true;
      }
      return false;
    case "bull":
      // Piercing Ox: straight-line charge, stronger the longer the run
      if (d > 3 && d < 15 && cd(5000)) {
        const dmg = Math.round(4 + d * 1.1);
        safe(() => e.teleport({ x: t.location.x - (t.location.x - e.location.x) / d, y: t.location.y, z: t.location.z - (t.location.z - e.location.z) / d }, { facingLocation: t.location }), undefined);
        hit(t, dmg, e);
        safe(() => t.applyImpulse({ x: ((t.location.x - e.location.x) / d) * (1 + d / 6), y: 0.6, z: ((t.location.z - e.location.z) / d) * (1 + d / 6) }), undefined);
        line(e, t, { red: 0.5, green: 0.3, blue: 0.2 });
        sound(e.dimension, "mob.ravager.roar", e.location, 0.6, 1.2);
        if (owner && force) safe(() => owner.sendMessage(`§7Boi Perfurante: investida de ${Math.round(d)} blocos, ${dmg} de dano.`), undefined);
        a.setAnim(AnimState.Attack, 600);
        return true;
      }
      return false;
    case "tiger":
      // original to the mod: "Bote Fúnebre"
      if (d > 2 && d < 9 && cd(6000)) {
        safe(() => e.teleport({ x: t.location.x, y: t.location.y, z: t.location.z + 0.8 }, { facingLocation: t.location }), undefined);
        hit(t, 9, e);
        safe(() => t.addEffect("weakness", 80, { amplifier: 1 }), undefined);
        sound(e.dimension, "mob.ravager.roar", e.location, 0.7, 0.9);
        a.setAnim(AnimState.Attack, 700);
        return true;
      }
      return false;
    case "lion":
      if (d < 9 && cd(8000)) {
        for (const h of hostilesAround(e, 9)) safe(() => h.addEffect("weakness", 120, { amplifier: 1 }), undefined);
        sound(e.dimension, "mob.ravager.roar", e.location, 1, 0.8);
        a.setAnim(AnimState.Cast, 900);
        return true;
      }
      return false;
    case "dragon":
      if (d < 9 && cd(4000)) {
        for (const h of hostilesAround(e, 8)) {
          safe(() => h.setOnFire(4, true), false);
          hit(h, 6, e, EntityDamageCause.fire);
          line(e, h, { red: 0.6, green: 0.2, blue: 1 });
        }
        sound(e.dimension, "mob.enderdragon.growl", e.location, 0.6, 1.3);
        a.setAnim(AnimState.Cast, 900);
        return true;
      }
      return false;
    case "colossus":
      // Mahoraga's sword of extermination (positive energy): devastating on undead
      if (d < 5 && cd(5000)) {
        const undead = safe(() => t.matches({ families: ["undead"] }), false);
        hit(t, undead ? 22 : 12, e);
        particle(e.dimension, "shadowbound:sparkle", t.location, { red: 1, green: 1, blue: 0.85 });
        sound(e.dimension, "mob.irongolem.throw", e.location, 1, 0.6);
        a.setAnim(AnimState.Attack, 900);
        return true;
      }
      return false;
    default:
      return false;
  }
}

/** Extra effects when a shikigami lands a melee hit. */
export function onBeastHit(a: Agent, target: Entity): void {
  if (!hostileOk(target)) return;
  const sp = a.persona as BeastSpecies;
  if (sp === "wolf" || sp === "dog_white") safe(() => target.addEffect("slowness", 40, { amplifier: 0 }), undefined);
  if (sp === "totality") safe(() => target.addEffect("weakness", 60, { amplifier: 0 }), undefined);
  if (sp === "serpent") safe(() => target.addEffect("slowness", 80, { amplifier: 3 }), undefined);
  if (sp === "colossus" && safe(() => target.matches({ families: ["undead"] }), false)) hit(target, 8, a.body() ?? target);
}

/** Mahoraga adapts to each kind of damage (the wheel turns); see jujutsu/ritual.ts. */
export function onBeastHurt(a: Agent, damage: number, cause = "entityAttack"): void {
  if (a.persona !== "colossus" || damage <= 0) return;
  const e = a.body();
  if (e) adaptHit(e, cause, damage, a.owner());
}

export function beastInfo(a: Agent) {
  return BEAST_INFO[a.persona as BeastSpecies];
}
