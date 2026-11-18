/**
 * Clan roulette: plays when a player joins for the first time (and on extra spins).
 * The names spin on screen, slow down and land on the result, then the reveal screen opens.
 */
import { Player, system } from "@minecraft/server";
import { safe, sound } from "../core/mc";
import { dismiss, squadOf } from "../ai/agent_manager";
import { CLANS, CLAN_ORDER, TECHS, rollClan, type ClanId, type TechId } from "./clans";
import { giveItem, saveSorcerer, sorcerer } from "./sorcerer";
import { ring } from "./fx";
import { SYRUP_ITEM } from "./ids";
import { syncKit } from "./skills";

const spinning = new Set<string>();
const DELAYS = [2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6, 7, 8, 10, 12, 15];

export function isSpinning(pid: string): boolean {
  return spinning.has(pid);
}

/** Change clan/technique, cleaning up what belonged to the old technique. */
export function applyClan(p: Player, clan: ClanId, tech: TechId): void {
  const r = sorcerer(p.id);
  if (r.tech === "ten_shadows" && tech !== "ten_shadows") squadOf(p.id, true).filter((m) => m.isBeast).forEach((m, i) => dismiss(m, i > 0));
  r.clan = clan;
  r.tech = tech;
  r.toggles = {};
  r.quick = undefined;
  r.rolled = true;
  saveSorcerer(p.id);
  syncKit(p); // the new clan's power buttons replace the old ones
}

/**
 * Spin the roulette. `free` = the automatic first spin. `then` runs after the result is applied.
 * Returns false if the player has no spins left or is already spinning.
 */
export function spin(p: Player, free: boolean, then?: (clan: ClanId, tech: TechId) => void): boolean {
  const r = sorcerer(p.id);
  if (spinning.has(p.id)) return false;
  if (!free) {
    if (r.spins <= 0) {
      p.sendMessage("§7Você não tem giros. Ganhe +1 giro a cada nível de domínio.");
      return false;
    }
    r.spins--;
    saveSorcerer(p.id);
  }
  const result = rollClan();
  spinning.add(p.id);
  let t = 0;
  DELAYS.forEach((d, i) => {
    t += d;
    system.runTimeout(() => {
      const c = CLANS[CLAN_ORDER[(i * 3 + (i % 2)) % CLAN_ORDER.length]];
      safe(() => p.onScreenDisplay.setTitle(`${c.tag}§l${c.name}`, { subtitle: "§7roleta de clã...", fadeInDuration: 0, stayDuration: d + 4, fadeOutDuration: 0 }), undefined);
      sound(p.dimension, "random.click", p.location, 0.6, 0.6 + i * 0.06);
    }, t);
  });
  system.runTimeout(() => {
    spinning.delete(p.id);
    const c = CLANS[result.clan];
    applyClan(p, result.clan, result.tech);
    safe(() => p.onScreenDisplay.setTitle(`${c.tag}§l${c.name}`, { subtitle: `§f${TECHS[result.tech].name} §8· ${c.rarity}`, fadeInDuration: 2, stayDuration: 70, fadeOutDuration: 15 }), undefined);
    const big = c.rarity === "Lendário" || c.rarity === "Raro";
    sound(p.dimension, big ? "random.totem" : "random.levelup", p.location, 0.8, big ? 1 : 1.2);
    const col = TECHS[result.tech].color;
    for (let k = 1; k <= 3; k++) ring(p.dimension, p.location, k * 1.2, col, 14 + k * 4, 0.2 + k * 0.3);
    p.sendMessage(`§5✦ Roleta de clã:§r ${c.tag}${c.name}§r (${c.rarity}) · técnica inata: §f${TECHS[result.tech].name}`);
    then?.(result.clan, result.tech);
  }, t + 10);
  return true;
}

/** First join: spin once for free, then hand over the starter kit. */
export function firstJoin(p: Player, reveal: (p: Player) => void): void {
  const r = sorcerer(p.id);
  if (r.rolled) return;
  spin(p, true, (clan, tech) => {
    giveItem(p, "shadowbound:uniform_tokyo_chest", 1);
    giveItem(p, "shadowbound:uniform_tokyo_legs", 1);
    if (tech === "speech") giveItem(p, SYRUP_ITEM, 3);
    void clan;
    system.runTimeout(() => reveal(p), 40);
  });
}
