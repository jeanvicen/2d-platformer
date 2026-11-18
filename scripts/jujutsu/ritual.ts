/**
 * Exorcism rituals (taming a shikigami), Rabbit Escape decoys and Mahoraga's adaptation wheel.
 * Ritual rules (summary of the work): the untamed shikigami fights the summoner; if someone else
 * joins the fight the ritual is void. Failing (dying, fleeing, timing out) cancels it.
 */
import { Player, world, type Entity } from "@minecraft/server";
import { BODY_TYPES, DP_OWNER, PROP_ANIM, PROP_SPECIES, AnimState } from "../core/constants";
import { BEASTS, type BeastSpecies } from "../core/species";
import { dist, isValid, particle, safe, sound } from "../core/mc";
import { summonFx } from "../ai/agent_manager";
import { SHIKIGAMI, masteryLevel } from "./canon";
import { addXp, saveSorcerer, sorcerer, spend } from "./sorcerer";

export const DP_RITUAL = "sb:ritual";
export const DP_DECOY = "sb:decoy_until";
const RITUAL_MS = 5 * 60 * 1000;

interface Ritual { ownerId: string; species: BeastSpecies; entityId: string; start: number; }
const rituals = new Map<string, Ritual>(); // by owner id

export function activeRitual(ownerId: string): Ritual | undefined {
  return rituals.get(ownerId);
}

function find(id: string): Entity | undefined {
  return safe(() => world.getEntity(id), undefined);
}

export function startRitual(p: Player, sp: BeastSpecies): boolean {
  const info = SHIKIGAMI[sp];
  const r = sorcerer(p.id);
  if (info.inherited) return say(p, `§7${info.name} não vem por ritual: só por herança, quando um Cão Divino é destruído.`);
  if (info.freeMode) return say(p, `§7${info.name} é uma criação original da Forja de Sombras: não precisa de ritual.`);
  if (r.destroyed.includes(sp)) return say(p, `§8${info.name} foi destruído. Não há ritual possível.`);
  if (r.unlocked.includes(sp)) return say(p, `§7${info.name} já obedece a você.`);
  if (masteryLevel(r.xp) < info.mastery) return say(p, `§7O ritual de ${info.name} exige domínio ${info.mastery} (você está no ${masteryLevel(r.xp)}).`);
  if (rituals.has(p.id)) return say(p, "§7Você já está no meio de um ritual.");
  if (!spend(p, info.cost, `o ritual de ${info.name}`)) return false;
  const v = safe(() => p.getViewDirection(), { x: 0, y: 0, z: 1 });
  const n = Math.hypot(v.x, v.z) || 1;
  const loc = { x: p.location.x + (v.x / n) * 5, y: p.location.y, z: p.location.z + (v.z / n) * 5 };
  const e = safe(() => p.dimension.spawnEntity("shadowbound:beast", loc), undefined);
  if (!e) {
    r.energy += info.cost;
    saveSorcerer(p.id);
    return say(p, "§cNão consegui abrir o ritual aqui.");
  }
  safe(() => e.setDynamicProperty(DP_RITUAL, p.id), undefined);
  safe(() => e.triggerEvent(`shadowbound:species_${sp}`), undefined);
  safe(() => e.setProperty(PROP_SPECIES, BEASTS.indexOf(sp)), undefined);
  safe(() => e.triggerEvent("shadowbound:mode_wild"), undefined);
  safe(() => e.setProperty(PROP_ANIM, AnimState.Summon), undefined);
  safe(() => (e.nameTag = `§c✠ Ritual: ${info.name}`), undefined);
  summonFx(p.dimension, loc, { red: 0.8, green: 0.1, blue: 0.2 }, true);
  rituals.set(p.id, { ownerId: p.id, species: sp, entityId: e.id, start: Date.now() });
  const big = sp === "colossus";
  p.sendMessage(big
    ? "§4§l✠ RITUAL DE EXORCISMO ✠§r\n§fO General Divino §cMahoraga§f despertou e ataca TODOS ao redor. A roda gira a cada golpe do mesmo tipo: varie seus ataques!\n§7(No cânone Megumi nunca o dominou. Vencer aqui é uma rota original do mod.)"
    : `§c✠ Ritual de exorcismo:§f vença §c${info.name}§f sozinho (só você e seus shikigamis). Se outra pessoa ou suas companheiras atacarem, o ritual é anulado. Tempo: 5 minutos.`);
  return true;
}

function say(p: Player, m: string): boolean {
  safe(() => p.sendMessage(m), undefined);
  return false;
}

function endRitual(rt: Ritual, reason: string): void {
  rituals.delete(rt.ownerId);
  const e = find(rt.entityId);
  if (isValid(e)) {
    particle(e.dimension, "shadowbound:wisp", e.location);
    safe(() => e.remove(), undefined);
  }
  const p = world.getAllPlayers().find((x) => x.id === rt.ownerId);
  if (p && reason) safe(() => p.sendMessage(reason), undefined);
}

export function isRitualBody(e: Entity): boolean {
  return !!safe(() => e.getDynamicProperty(DP_RITUAL) as string | undefined, undefined);
}

/** Damage on an untamed ritual shikigami: validates who is fighting, drives Mahoraga's wheel. */
export function onRitualHurt(e: Entity, attacker: Entity | undefined, cause: string, damage: number): void {
  const ownerId = safe(() => e.getDynamicProperty(DP_RITUAL) as string | undefined, undefined);
  const rt = ownerId ? rituals.get(ownerId) : undefined;
  if (!rt || rt.entityId !== e.id) return;
  if (attacker) {
    const tid = safe(() => attacker.typeId, "");
    const outsider =
      (attacker instanceof Player && attacker.id !== rt.ownerId) ||
      tid === "shadowbound:companion" ||
      (tid === "shadowbound:beast" && safe(() => attacker.getDynamicProperty(DP_OWNER) as string | undefined, undefined) !== rt.ownerId);
    if (outsider) {
      endRitual(rt, `§8O ritual de ${SHIKIGAMI[rt.species].name} foi ANULADO: outra pessoa interferiu na luta.`);
      return;
    }
  }
  if (rt.species === "colossus") adaptHit(e, cause, damage, world.getAllPlayers().find((x) => x.id === rt.ownerId));
}

export function onRitualDie(e: Entity): void {
  const ownerId = safe(() => e.getDynamicProperty(DP_RITUAL) as string | undefined, undefined);
  const rt = ownerId ? rituals.get(ownerId) : undefined;
  if (!rt || rt.entityId !== e.id) return;
  rituals.delete(rt.ownerId);
  const r = sorcerer(rt.ownerId);
  if (!r.unlocked.includes(rt.species)) r.unlocked.push(rt.species);
  saveSorcerer(rt.ownerId);
  addXp(rt.ownerId, 100);
  const p = world.getAllPlayers().find((x) => x.id === rt.ownerId);
  if (p) {
    const info = SHIKIGAMI[rt.species];
    p.sendMessage(rt.species === "colossus"
      ? "§5§l✦ Você venceu o ritual de Mahoraga!§r §fEle agora obedece a você. §d(rota original do mod: no cânone só Sukuna o dominou)"
      : `§5✦ Ritual concluído!§f ${info.name} agora obedece a você. Invoque pelo Selo ou com §f/sombra invocar ${info.name.toLowerCase()}§f.`);
    sound(p.dimension, "random.totem", p.location, 0.6, 1.2);
  }
}

/** Every second: fail rituals whose summoner died, fled or ran out of time; clean leftovers. */
let sweepN = 0;
export function ritualTick(): void {
  for (const rt of [...rituals.values()]) {
    const p = world.getAllPlayers().find((x) => x.id === rt.ownerId);
    const e = find(rt.entityId);
    if (!isValid(e)) {
      rituals.delete(rt.ownerId);
      continue;
    }
    const hp = p ? safe(() => p.getComponent("minecraft:health")?.currentValue ?? 20, 20) : 0;
    if (!p || hp <= 0) endRitual(rt, "§8Você caiu. O ritual falhou e o shikigami voltou para a sombra.");
    else if (p.dimension.id !== e.dimension.id || dist(p.location, e.location) > 48) endRitual(rt, "§8Você se afastou demais: o ritual falhou.");
    else if (Date.now() - rt.start > RITUAL_MS) endRitual(rt, "§8O tempo do ritual acabou.");
  }
  if (++sweepN % 5) return;
  const live = new Set([...rituals.values()].map((r) => r.entityId));
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    for (const e of safe(() => world.getDimension(dimId).getEntities({ type: "shadowbound:beast" }), [] as Entity[])) {
      const ritual = safe(() => e.getDynamicProperty(DP_RITUAL) as string | undefined, undefined);
      const decoy = safe(() => e.getDynamicProperty(DP_DECOY) as number | undefined, undefined);
      if ((ritual && !live.has(e.id)) || (decoy !== undefined && decoy < Date.now())) {
        particle(e.dimension, "shadowbound:wisp", e.location);
        safe(() => e.remove(), undefined);
      }
    }
  }
}

// -----------------------------------------------------------------------------------------
// Rabbit Escape: a crowd of short-lived rabbits (distraction / cover)
// -----------------------------------------------------------------------------------------
export function spawnDecoys(center: Entity, n: number, seconds: number): number {
  let made = 0;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const loc = { x: center.location.x + Math.cos(ang) * 2, y: center.location.y, z: center.location.z + Math.sin(ang) * 2 };
    const e = safe(() => center.dimension.spawnEntity("shadowbound:beast", loc), undefined);
    if (!e) continue;
    safe(() => e.setDynamicProperty(DP_DECOY, Date.now() + seconds * 1000), undefined);
    safe(() => e.triggerEvent("shadowbound:species_rabbit"), undefined);
    safe(() => e.setProperty(PROP_SPECIES, BEASTS.indexOf("rabbit")), undefined);
    safe(() => e.triggerEvent("shadowbound:mode_guard"), undefined);
    particle(center.dimension, "shadowbound:wisp", loc);
    made++;
  }
  return made;
}

export function isMarkedBody(e: Entity): boolean {
  if (!BODY_TYPES.includes(safe(() => e.typeId, ""))) return false;
  return isRitualBody(e) || safe(() => e.getDynamicProperty(DP_DECOY) as number | undefined, undefined) !== undefined;
}

// -----------------------------------------------------------------------------------------
// Mahoraga: the wheel turns once per hit of the same kind; after 4 turns it has ADAPTED.
// -----------------------------------------------------------------------------------------
const CAUSE_PT: Record<string, string> = {
  entityAttack: "golpes corpo a corpo", projectile: "projéteis", fire: "fogo", fireTick: "fogo", lava: "fogo",
  magic: "magia", entityExplosion: "explosões", blockExplosion: "explosões", lightning: "raios", drowning: "água",
  thorns: "espinhos", wither: "wither", freezing: "gelo", sonicBoom: "ondas sônicas",
};
const FAMILY: Record<string, string> = { fireTick: "fire", lava: "fire", blockExplosion: "entityExplosion" };
interface AdaptState { counts: Record<string, number>; adapted: string[]; wheel: number; }
const adaptMap = new Map<string, AdaptState>();
export const ADAPT_TURNS = 4;

export function adaptedTo(e: Entity): string[] {
  return adaptMap.get(e.id)?.adapted ?? [];
}

export function adaptHit(e: Entity, rawCause: string, damage: number, notify?: Player): void {
  if (damage <= 0) return;
  const cause = FAMILY[rawCause] ?? rawCause;
  const st = adaptMap.get(e.id) ?? { counts: {}, adapted: [], wheel: 0 };
  adaptMap.set(e.id, st);
  if (st.adapted.includes(cause)) {
    // already adapted: the hit is nullified
    const h = safe(() => e.getComponent("minecraft:health"), undefined);
    if (h) safe(() => h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + damage)), false);
    particle(e.dimension, "shadowbound:sparkle", { x: e.location.x, y: e.location.y + 3.6, z: e.location.z }, { red: 1, green: 0.85, blue: 0.3 });
    return;
  }
  st.counts[cause] = (st.counts[cause] ?? 0) + 1;
  st.wheel = (st.wheel + 1) % 8;
  safe(() => e.setProperty("shadowbound:adapt", st.wheel), undefined);
  sound(e.dimension, "block.bell.hit", e.location, 0.7, 0.5);
  if (st.counts[cause] >= ADAPT_TURNS) {
    st.adapted.push(cause);
    if (notify) safe(() => notify.sendMessage(`§6⚙ A roda girou: Mahoraga se ADAPTOU a ${CAUSE_PT[cause] ?? cause}. Esse tipo de dano não funciona mais nele.`), undefined);
  }
}
