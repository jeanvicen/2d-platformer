/**
 * Sukuna's fingers: 20 per world (canon: his soul is split into twenty indestructible fingers).
 * Eating one: an incompatible body is poisoned (in the work almost everyone dies; the mod lets you
 * survive at low health), a compatible one becomes Sukuna's VESSEL and unlocks Shrine.
 * Influence grows with every finger; at high influence Sukuna may take over for a few seconds
 * (narrative possession, original to the mod). Meditating lowers the influence.
 */
import { EntityDamageCause, InputPermissionCategory, ItemStack, Player, system, world, type Entity } from "@minecraft/server";
import { currentOverlay, setOverlay } from "./overlay";
import { syncKit } from "./skills";
import { BODY_TYPES } from "../core/constants";
import { isValid, safe, sound } from "../core/mc";
import { addXp, maxEnergyOf, saveSorcerer, sorcerer, spend, type SorcererRecord } from "./sorcerer";
import { beam, burst } from "./fx";

import { FINGER_ITEM, FRAGMENT_ITEM, SYRUP_ITEM } from "./ids";
export { FINGER_ITEM, FRAGMENT_ITEM, SYRUP_ITEM };
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
      system.runTimeout(() => syncKit(p), 5);
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
    system.runTimeout(() => syncKit(p), 5);
    const unlock = r.fingersEaten === 3 ? "Clivar" : r.fingersEaten === 10 ? "Fuga (\"Abrir\")" : r.fingersEaten === 15 ? "Santuário Malevolente" : "";
    if (Math.random() < 0.12 + r.influence / 400 && (r.cooldowns.possessao ?? 0) < Date.now()) system.runTimeout(() => startPossession(p, sorcerer(p.id)), 40);
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

/** Every second: influence decay and the chance that Sukuna takes over. */
export function sukunaTick(p: Player, r: SorcererRecord): void {
  if (!r.vessel || isPossessed(p.id)) return;
  const now = Date.now();
  if (Math.random() < 1 / 60) r.influence = Math.max(0, r.influence - 1);
  if (r.influence < 30 || (r.cooldowns.possessao ?? 0) > now) return;
  const hp = safe(() => p.getComponent("minecraft:health"), undefined);
  const low = hp ? hp.currentValue / hp.effectiveMax < 0.3 : false;
  // stronger influence = higher chance; nearly dying makes it much more likely
  const chance = (r.influence / 100) * (low ? 0.08 : 0.006);
  if (Math.random() < chance) startPossession(p, r);
}

// ------------------------------------------------------------------------------------------
// Possession: Sukuna controls the body. You only watch (third person) while he kills and
// destroys around you, and you fight back by pressing SNEAK repeatedly.
// ------------------------------------------------------------------------------------------
const POSSESSION_MS = 25000;
const NATURAL = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|mycelium|sand|red_sand|gravel|stone|andesite|diorite|granite|deepslate|tuff|netherrack|snow_layer|snow|clay|short_grass|tall_grass|fern|large_fern|dandelion|poppy|\w+_flower|\w+_tulip|azure_bluet|oxeye_daisy|cornflower|allium|blue_orchid|\w+_leaves|\w+_log|sweet_berry_bush|dead_bush|vine|moss_block|moss_carpet)$/;
const lastSneak = new Map<string, boolean>();
const lastStrike = new Map<string, number>();

function control(p: Player, enabled: boolean): void {
  for (const c of [InputPermissionCategory.Movement, InputPermissionCategory.Jump]) safe(() => p.inputPermissions.setPermissionCategory(c, enabled), undefined);
  if (enabled) safe(() => p.camera.clear(), undefined);
  else safe(() => p.camera.setCamera("minecraft:third_person"), undefined);
}

export function startPossession(p: Player, r: SorcererRecord): void {
  r.possessedUntil = Date.now() + POSSESSION_MS;
  r.resist = 0;
  control(p, false);
  setOverlay(p, "marks");
  safe(() => p.onScreenDisplay.setTitle("§4§lSUKUNA ASSUMIU", { subtitle: "§cAgache várias vezes para lutar pelo controle", fadeInDuration: 3, stayDuration: 60, fadeOutDuration: 10 }), undefined);
  p.sendMessage("§c[Sukuna]§r Finalmente... este corpo é meu. Assista, moleque.");
  sound(p.dimension, "mob.wither.spawn", p.location, 0.5, 0.6);
  saveSorcerer(p.id);
}

export function endPossession(p: Player, won: boolean): void {
  const r = sorcerer(p.id);
  r.possessedUntil = undefined;
  r.resist = 0;
  r.cooldowns.possessao = Date.now() + (won ? 150000 : 90000);
  r.influence = won ? Math.max(0, r.influence - 10) : Math.min(100, r.influence + 3);
  control(p, true);
  setOverlay(p, undefined);
  safe(() => p.onScreenDisplay.setTitle(won ? "§fVocê retomou o controle" : "§7Sukuna se cansou", { subtitle: won ? "§aVocê empurrou Sukuna para o fundo" : "§7Ele devolveu o corpo... por enquanto", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 }), undefined);
  p.sendMessage(won ? `§fVocê venceu Sukuna por dentro. Influência: §c${Math.round(r.influence)}%` : `§c[Sukuna]§r Hmph. Que tédio. §7(influência ${Math.round(r.influence)}%)`);
  saveSorcerer(p.id);
}

/** Safety net (join, reload): give the controls back if no possession is running. */
export function releaseIfStuck(p: Player): void {
  if (!isPossessed(p.id)) {
    control(p, true);
    if (currentOverlay(p) === "marks") setOverlay(p, undefined);
  }
}

function crater(p: Player, at: { x: number; y: number; z: number }): number {
  let n = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dz * dz > 5) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const loc = { x: Math.floor(at.x) + dx, y: Math.floor(at.y) + dy, z: Math.floor(at.z) + dz };
        const b = safe(() => p.dimension.getBlock(loc), undefined);
        if (b && NATURAL.test(safe(() => b.typeId, ""))) {
          safe(() => b.setType("minecraft:air"), undefined);
          n++;
        }
      }
    }
  }
  return n;
}

function victims(p: Player): Entity[] {
  const list = safe(() => p.dimension.getEntities({ location: p.location, maxDistance: 18, excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow"], excludeFamilies: ["player", "shadowbound", "inanimate"] }), [] as Entity[]);
  return list.filter((e) => isValid(e) && !(e instanceof Player) && !BODY_TYPES.includes(safe(() => e.typeId, "")) && !!safe(() => e.getComponent("minecraft:health"), undefined));
}

/** Called every 2 ticks for possessed players. */
export function possessionTick(p: Player): void {
  const r = sorcerer(p.id);
  if (!r.possessedUntil) return;
  const now = Date.now();
  // the struggle: every new sneak press pushes Sukuna back
  r.resist = Math.max(0, (r.resist ?? 0) - r.influence / 400); // he pushes back harder with more influence
  const sneak = safe(() => p.isSneaking, false);
  if (sneak && !lastSneak.get(p.id)) r.resist = Math.min(100, (r.resist ?? 0) + 7);
  lastSneak.set(p.id, sneak);
  const bar = Math.round((r.resist ?? 0) / 10);
  safe(() => p.onScreenDisplay.setActionBar(`§4§lSUKUNA NO CONTROLE §r§7| agache repetidamente: §a${"▮".repeat(bar)}§8${"▮".repeat(10 - bar)} §f${Math.round(r.resist ?? 0)}%`), undefined);
  if ((r.resist ?? 0) >= 100) return endPossession(p, true);
  if (now >= r.possessedUntil) return endPossession(p, false);
  for (const ef of [["strength", 4], ["resistance", 3]] as const) safe(() => p.addEffect(ef[0], 20, { amplifier: ef[1], showParticles: false }), undefined);
  if ((lastStrike.get(p.id) ?? 0) + 600 > now) return;
  lastStrike.set(p.id, now);
  // he moves the body by himself: dash to the next victim and cut it down
  const list = victims(p).sort((a, b) => Math.hypot(a.location.x - p.location.x, a.location.z - p.location.z) - Math.hypot(b.location.x - p.location.x, b.location.z - p.location.z));
  const t = list[0];
  if (t) {
    const d = Math.hypot(t.location.x - p.location.x, t.location.z - p.location.z) || 1;
    const stop = { x: t.location.x - ((t.location.x - p.location.x) / d) * 1.5, y: t.location.y, z: t.location.z - ((t.location.z - p.location.z) / d) * 1.5 };
    beam(p.dimension, { x: p.location.x, y: p.location.y + 1, z: p.location.z }, { x: (stop.x - p.location.x) / d, y: 0, z: (stop.z - p.location.z) / d }, Math.max(0, d - 1.5), { red: 0.9, green: 0.1, blue: 0.15 }, 0.8);
    safe(() => p.teleport(stop, { facingLocation: t.location }), undefined);
    safe(() => t.applyDamage(14, { cause: EntityDamageCause.entityAttack, damagingEntity: p }), false);
    for (let i = 0; i < 3; i++) beam(p.dimension, { x: t.location.x - 1.2, y: t.location.y + 0.4 + i * 0.5, z: t.location.z - 0.6 }, { x: 0.9, y: 0.15, z: 0.45 }, 2.6, { red: 1, green: 1, blue: 1 }, 0.3);
    sound(p.dimension, "item.trident.riptide_1", t.location, 0.8, 1.6);
    if (r.destruction !== false) crater(p, { x: t.location.x, y: t.location.y - 1, z: t.location.z });
  } else if (r.destruction !== false) {
    // nothing alive nearby: he cuts the scenery to pieces
    const ang = Math.random() * Math.PI * 2;
    const at = { x: p.location.x + Math.cos(ang) * 4, y: p.location.y - 1, z: p.location.z + Math.sin(ang) * 4 };
    beam(p.dimension, { x: p.location.x, y: p.location.y + 1, z: p.location.z }, { x: Math.cos(ang), y: -0.2, z: Math.sin(ang) }, 4, { red: 1, green: 1, blue: 1 }, 0.4);
    crater(p, at);
    sound(p.dimension, "random.explode", at, 0.4, 1.4);
  }
  if (Math.random() < 0.2) p.sendMessage(SUKUNA_LINES[Math.floor(Math.random() * SUKUNA_LINES.length)]);
}

export function isPossessed(pid: string): boolean {
  const r = sorcerer(pid);
  return !!r.possessedUntil && r.possessedUntil > Date.now();
}

export function isBodyType(e: Entity): boolean {
  return isValid(e) && BODY_TYPES.includes(safe(() => e.typeId, ""));
}
