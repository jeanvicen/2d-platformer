/**
 * Sukuna's fingers: 20 per world (canon: his soul is split into twenty indestructible fingers).
 * Eating one: an incompatible body is poisoned (in the work almost everyone dies; the mod lets you
 * survive at low health), a compatible one becomes Sukuna's VESSEL and unlocks Shrine.
 * Influence grows with every finger; at high influence Sukuna may take over for a few seconds
 * (narrative possession, original to the mod). Meditating lowers the influence.
 */
import { EntityDamageCause, ItemStack, Player, world, type Entity } from "@minecraft/server";
import { BODY_TYPES } from "../core/constants";
import { isValid, safe, sound } from "../core/mc";
import { addXp, maxEnergyOf, saveSorcerer, sorcerer, spend, type SorcererRecord } from "./sorcerer";
import { beam, burst, enemiesNear } from "./fx";

export const FINGER_ITEM = "shadowbound:sukuna_finger";
export const FRAGMENT_ITEM = "shadowbound:cursed_fragment";
export const SYRUP_ITEM = "shadowbound:throat_syrup";
export const FINGERS_TOTAL = 20;
const WORLD_KEY = "sb:jjk_fingers_world";
/** Chance that a first-time eater is a compatible vessel (mod rule; Yuji is a rare exception in the work). */
export const TUNING_SUKUNA = { vesselChance: 0.25, fingerDrop: 0.012, fragmentDrop: 0.12 };

const SUKUNA_LINES = [
  "§c[Sukuna]§r Hmph. Que corpo fraco.",
  "§c[Sukuna]§r Saiam da minha frente, vermes.",
  "§c[Sukuna]§r Conheça o seu lugar.",
  "§c[Sukuna]§r Isso é tudo? Que tédio.",
];

export function fingersInWorld(): number {
  return safe(() => (world.getDynamicProperty(WORLD_KEY) as number | undefined) ?? 0, 0);
}

export function onFingerEaten(p: Player): void {
  const r = sorcerer(p.id);
  if (!r.vessel) {
    if (Math.random() < TUNING_SUKUNA.vesselChance) {
      r.vessel = true;
      r.fingersEaten = 1;
      r.influence = 8;
      safe(() => p.onScreenDisplay.setTitle("§4§lRECEPTÁCULO", { subtitle: "§cSukuna despertou dentro de você", fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15 }), undefined);
      p.sendMessage("§4☠ Seu corpo resistiu ao veneno do dedo. Você virou o receptáculo de Sukuna!§r\n§fTécnica liberada: §cSantuário§f (Desmantelar). Mais dedos liberam Clivar (3), Fuga (10) e o Santuário Malevolente (15). §7Cuidado com a influência dele.");
      sound(p.dimension, "mob.wither.spawn", p.location, 0.5, 0.8);
      addXp(p.id, 50);
    } else {
      safe(() => p.addEffect("wither", 200, { amplifier: 1 }), undefined);
      safe(() => p.addEffect("nausea", 300, { amplifier: 0 }), undefined);
      safe(() => p.addEffect("hunger", 300, { amplifier: 2 }), undefined);
      const h = safe(() => p.getComponent("minecraft:health"), undefined);
      if (h) safe(() => h.setCurrentValue(Math.min(h.currentValue, 4)), false);
      p.sendMessage("§2☠ O veneno do dedo de Sukuna quase te matou.§r §7Seu corpo não é compatível... desta vez. (Na obra, quase todo mundo morre ao comer um dedo; aqui você sobrevive por pouco e pode tentar de novo.)");
    }
  } else {
    r.fingersEaten = Math.min(FINGERS_TOTAL, r.fingersEaten + 1);
    r.influence = Math.min(100, r.influence + 4);
    const unlock = r.fingersEaten === 3 ? "Clivar" : r.fingersEaten === 10 ? "Fuga (\"Abrir\")" : r.fingersEaten === 15 ? "Santuário Malevolente" : "";
    p.sendMessage(`§4☠ Dedo ${r.fingersEaten}/${FINGERS_TOTAL}.§r Energia máxima ${maxEnergyOf(r)} · influência de Sukuna §c${Math.round(r.influence)}%${unlock ? `\n§c✦ Liberado: ${unlock}` : ""}`);
    sound(p.dimension, "mob.wither.ambient", p.location, 0.5, 0.6);
  }
  saveSorcerer(p.id);
}

/** Hostile mob killed by a player (or their shikigami): cursed fragments and, rarely, a finger. */
export function onEnemyKilled(e: Entity, killer: Player): void {
  if (!safe(() => e.matches({ families: ["monster"] }), false)) return;
  const loc = { ...e.location };
  if (Math.random() < TUNING_SUKUNA.fragmentDrop) safe(() => e.dimension.spawnItem(new ItemStack(FRAGMENT_ITEM, 1), loc), undefined);
  const found = fingersInWorld();
  if (found < FINGERS_TOTAL && Math.random() < TUNING_SUKUNA.fingerDrop) {
    safe(() => e.dimension.spawnItem(new ItemStack(FINGER_ITEM, 1), loc), undefined);
    safe(() => world.setDynamicProperty(WORLD_KEY, found + 1), undefined);
    const r = sorcerer(killer.id);
    r.fingersFound++;
    saveSorcerer(killer.id);
    killer.sendMessage(`§4☠ Um Dedo de Sukuna caiu! §7(${found + 1}/${FINGERS_TOTAL} neste mundo)`);
    sound(e.dimension, "mob.wither.ambient", loc, 0.6, 0.5);
  }
}

export function onSyrup(p: Player): void {
  const r = sorcerer(p.id);
  r.throat = Math.max(0, r.throat - 60);
  saveSorcerer(p.id);
  p.sendMessage("§dXarope para Garganta:§f sua garganta melhorou.");
}

export function meditate(p: Player): boolean {
  const r = sorcerer(p.id);
  if (!r.vessel) {
    p.sendMessage("§7Você não carrega Sukuna.");
    return false;
  }
  if ((r.cooldowns.meditar ?? 0) > Date.now()) {
    p.sendMessage("§7Ainda concentrado(a)... tente daqui a pouco.");
    return false;
  }
  if (!spend(p, 40, "meditar")) return false;
  r.influence = Math.max(0, r.influence - 12);
  r.cooldowns.meditar = Date.now() + 30000;
  saveSorcerer(p.id);
  burst(p.dimension, { x: p.location.x, y: p.location.y + 1, z: p.location.z }, { red: 0.9, green: 0.9, blue: 1 }, 14, 1);
  p.sendMessage(`§fVocê se concentra e empurra Sukuna para o fundo. Influência: §c${Math.round(r.influence)}%`);
  return true;
}

/** Every second: influence decay and the possession event. */
export function sukunaTick(p: Player, r: SorcererRecord): void {
  if (!r.vessel) return;
  const now = Date.now();
  if (r.possessedUntil && r.possessedUntil > now) {
    // Sukuna is in control: the body becomes monstrous and cuts everything around
    for (const ef of [["strength", 3], ["resistance", 3], ["speed", 1]] as const) safe(() => p.addEffect(ef[0], 40, { amplifier: ef[1], showParticles: false }), undefined);
    for (const e of enemiesNear(p, p.location, 10)) {
      safe(() => e.applyDamage(8, { cause: EntityDamageCause.entityAttack, damagingEntity: p }), false);
      beam(p.dimension, { x: e.location.x - 1, y: e.location.y + 1, z: e.location.z }, { x: 1, y: 0.2, z: 0.5 }, 2, { red: 1, green: 1, blue: 1 }, 0.4);
    }
    if (Math.random() < 0.25) p.sendMessage(SUKUNA_LINES[Math.floor(Math.random() * SUKUNA_LINES.length)]);
    return;
  }
  if (r.possessedUntil && r.possessedUntil <= now) {
    r.possessedUntil = undefined;
    r.cooldowns.possessao = now + 180000;
    safe(() => p.onScreenDisplay.setTitle("§fVocê retomou o controle", { subtitle: "§7Sukuna voltou para o fundo", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 }), undefined);
    saveSorcerer(p.id);
    return;
  }
  if (Math.random() < 1 / 60) r.influence = Math.max(0, r.influence - 1);
  if (r.influence < 30 || (r.cooldowns.possessao ?? 0) > now) return;
  const hp = safe(() => p.getComponent("minecraft:health"), undefined);
  const low = hp ? hp.currentValue / hp.effectiveMax < 0.3 : false;
  const chance = low ? 0.08 : r.influence >= 60 ? 0.004 : 0;
  if (Math.random() < chance) startPossession(p, r);
}

export function startPossession(p: Player, r: SorcererRecord): void {
  r.possessedUntil = Date.now() + 12000;
  safe(() => p.onScreenDisplay.setTitle("§4§lSUKUNA ASSUMIU", { subtitle: "§cAguente 12 segundos ou medite depois", fadeInDuration: 3, stayDuration: 50, fadeOutDuration: 10 }), undefined);
  p.sendMessage("§c[Sukuna]§r Finalmente... deixe-me brincar um pouco.");
  sound(p.dimension, "mob.wither.spawn", p.location, 0.4, 0.6);
  saveSorcerer(p.id);
}

export function isPossessed(pid: string): boolean {
  const r = sorcerer(pid);
  return !!r.possessedUntil && r.possessedUntil > Date.now();
}

export function isBodyType(e: Entity): boolean {
  return isValid(e) && BODY_TYPES.includes(safe(() => e.typeId, ""));
}
