/**
 * The player as a jujutsu sorcerer: clan + innate technique (from the roulette), cursed energy
 * (or Vigor for Heavenly Restriction), mastery, Ten Shadows shikigami, Sukuna's fingers and
 * influence, throat strain (Cursed Speech) and shadow storage.
 * Stored in the WORLD (dynamic property per player id), validated on the server side.
 */
import { ItemStack, Player, world } from "@minecraft/server";
import { SUMMONER_ITEM } from "../core/constants";
import { BEAST_INFO, type BeastSpecies } from "../core/species";
import type { StoredItem } from "../core/types";
import { particle, safe, sound, toStack, toStored } from "../core/mc";
import type { Agent } from "../ai/agent";
import { squadOf, summon, type SummonResult } from "../ai/agent_manager";
import { SHIKIGAMI, masteryLevel, shikigamiLimit } from "./canon";
import { TECHS, type ClanId, type TechId } from "./clans";
import { abilityTick } from "./abilities";
import { sukunaTick } from "./sukuna";

export interface SorcererRecord {
  v: 1;
  energy: number;
  xp: number;
  clan?: ClanId;
  tech?: TechId;
  rolled: boolean;
  spins: number;
  unlocked: string[];
  destroyed: string[];
  inherited: number;
  toggles: Record<string, boolean>;
  cooldowns: Record<string, number>;
  store: StoredItem[];
  canonMode: boolean;
  hud: boolean;
  quick?: string;
  fingersEaten: number;
  fingersFound: number;
  vessel: boolean;
  influence: number;
  throat: number;
  possessedUntil?: number;
  domain?: { kind: string; until: number; dim: string; x: number; y: number; z: number };
}

const KEY = "sb:jjk:";
const STORE_SLOTS = 9;
const cache = new Map<string, SorcererRecord>();
const lastChange = new Map<string, number>();

function fresh(): SorcererRecord {
  return {
    v: 1, energy: 100, xp: 0, rolled: false, spins: 2,
    unlocked: Object.entries(SHIKIGAMI).filter(([, i]) => i.start).map(([k]) => k),
    destroyed: [], inherited: 0, toggles: {}, cooldowns: {}, store: [], canonMode: true, hud: true,
    fingersEaten: 0, fingersFound: 0, vessel: false, influence: 0, throat: 0,
  };
}

export function sorcerer(pid: string): SorcererRecord {
  let r = cache.get(pid);
  if (r) return r;
  const raw = safe(() => world.getDynamicProperty(KEY + pid) as string | undefined, undefined);
  r = fresh();
  if (raw) {
    try {
      r = { ...r, ...(JSON.parse(raw) as Partial<SorcererRecord>) } as SorcererRecord;
    } catch {
      /* keep fresh record */
    }
  }
  cache.set(pid, r);
  return r;
}

export function saveSorcerer(pid: string): void {
  const r = cache.get(pid);
  if (!r) return;
  safe(() => world.setDynamicProperty(KEY + pid, JSON.stringify(r)), undefined, "save sorcerer");
  lastChange.set(pid, Date.now());
}

export function level(pid: string): number {
  return masteryLevel(sorcerer(pid).xp);
}

/** Heavenly Restriction has no cursed energy: the same bar is "Vigor". */
export function usesVigor(r: SorcererRecord): boolean {
  return !!r.tech && !!TECHS[r.tech].noEnergy;
}
export function maxEnergyOf(r: SorcererRecord): number {
  const lv = masteryLevel(r.xp);
  if (usesVigor(r)) return 100 + 10 * lv;
  return 100 + 25 * lv + (r.vessel ? r.fingersEaten * 10 : 0);
}
export function regenOf(r: SorcererRecord): number {
  const lv = masteryLevel(r.xp);
  if (usesVigor(r)) return 6 + lv;
  return (2 + 0.5 * lv) * (r.tech === "limitless" ? 1.5 : 1);
}
export function energyName(r: SorcererRecord): string {
  return usesVigor(r) ? "Vigor" : "Energia amaldiçoada";
}

export function addXp(pid: string, n: number): void {
  const r = sorcerer(pid);
  const before = masteryLevel(r.xp);
  r.xp += n;
  const after = masteryLevel(r.xp);
  if (after > before) r.spins += after - before; // one extra clan spin per level
  saveSorcerer(pid);
  if (after > before) {
    const p = world.getAllPlayers().find((x) => x.id === pid);
    if (p) {
      safe(() => p.sendMessage(`§5✦ Domínio subiu para o nível ${after}!§r ${energyName(r)} máxima: ${maxEnergyOf(r)}. §7(+1 giro na roleta de clã)`), undefined);
      sound(p.dimension, "random.levelup", p.location, 0.6, 0.8);
    }
  }
}

export function spend(p: Player, n: number, what: string): boolean {
  const r = sorcerer(p.id);
  const cost = Math.ceil(n);
  if (r.energy < cost) {
    safe(() => p.sendMessage(`§c${energyName(r)} insuficiente para ${what}: precisa de ${cost}, você tem ${Math.floor(r.energy)}.`), undefined);
    return false;
  }
  r.energy -= cost;
  saveSorcerer(p.id);
  return true;
}

export function refund(p: Player, n: number): void {
  const r = sorcerer(p.id);
  r.energy = Math.min(maxEnergyOf(r), r.energy + Math.ceil(n));
}

export function domainActive(pid: string, kind?: string): boolean {
  const d = sorcerer(pid).domain;
  return !!d && d.until > Date.now() && (!kind || d.kind === kind);
}

// -----------------------------------------------------------------------------------------
// Ten Shadows: summoning gate (technique, unlocked, not destroyed, energy, field limit)
// -----------------------------------------------------------------------------------------
export type GateResult = SummonResult | "locked" | "destroyed" | "energy" | "limit" | "notech";

export function summonShikigami(p: Player, sp: BeastSpecies): GateResult {
  const info = SHIKIGAMI[sp];
  const r = sorcerer(p.id);
  if (r.tech !== "ten_shadows") {
    p.sendMessage("§7Só quem herdou a §fTécnica das Dez Sombras§7 invoca shikigamis.");
    return "notech";
  }
  if (r.destroyed.includes(sp)) {
    p.sendMessage(`§8☠ ${info.name} foi destruído e não pode mais ser invocado (Modo Cânone).`);
    return "destroyed";
  }
  if (!info.freeMode && !r.unlocked.includes(sp)) {
    if (info.inherited) p.sendMessage(`§7✖ ${info.name} só aparece por herança: quando um Cão Divino é destruído.`);
    else p.sendMessage(`§7✖ ${info.name} ainda não foi domado. Vença o ritual de exorcismo: §f/sombra ritual ${info.name.toLowerCase()}§7 ou pelo Grimório.`);
    return "locked";
  }
  const field = squadOf(p.id, true).filter((m) => m.isBeast);
  const same = field.find((m) => m.persona === sp);
  if (same) {
    const b = same.body();
    if (b) safe(() => b.teleport(p.location), undefined);
    p.sendMessage(`§7${info.name} já está em campo.`);
    return "already";
  }
  if (field.length >= shikigamiLimit(r.xp)) {
    p.sendMessage(`§7Limite de shikigamis em campo (${shikigamiLimit(r.xp)}). Recolha um ou aumente o seu domínio.`);
    return "limit";
  }
  const cost = domainActive(p.id, "dominio") ? info.cost / 2 : info.cost;
  if (!spend(p, cost, `invocar ${info.name}`)) return "energy";
  const res = summon(p, { kind: "beast", species: sp });
  if (res !== "spawned") {
    refund(p, cost);
    saveSorcerer(p.id);
    return res;
  }
  safe(() => p.onScreenDisplay.setActionBar(`§8✋ §fSinal de mãos: §5${info.name}§f!`), undefined);
  addXp(p.id, 2);
  return res;
}

export function summonDivineDogs(p: Player): GateResult[] {
  const r = sorcerer(p.id);
  const out: GateResult[] = [];
  if (r.unlocked.includes("totality") && !r.destroyed.includes("totality")) out.push(summonShikigami(p, "totality"));
  for (const sp of ["wolf", "dog_white"] as BeastSpecies[]) if (!r.destroyed.includes(sp)) out.push(summonShikigami(p, sp));
  return out;
}

/** A shikigami was destroyed: in Modo Cânone it is gone for good and its power is inherited. */
export function onShikigamiDestroyed(a: Agent): boolean {
  if (!a.isBeast) return false;
  const sp = a.persona as BeastSpecies;
  const info = SHIKIGAMI[sp];
  const r = sorcerer(a.record.ownerId);
  if (!r.canonMode || info.freeMode) return false;
  if (!r.destroyed.includes(sp)) r.destroyed.push(sp);
  r.unlocked = r.unlocked.filter((x) => x !== sp);
  const owner = a.owner();
  let msg = `§8☠ ${info.name} foi destruído. Ele não poderá mais ser invocado.`;
  const otherDog = sp === "wolf" ? "dog_white" : sp === "dog_white" ? "wolf" : undefined;
  if (otherDog && !r.destroyed.includes(otherDog) && !r.unlocked.includes("totality")) {
    r.unlocked.push("totality");
    msg += `\n§5✦ Herança: o poder dele passou para o ${BEAST_INFO[otherDog as BeastSpecies].pt}. Agora você pode invocar §fCão Divino: Totalidade§5!`;
  } else if (!otherDog) {
    r.inherited = Math.min(3, r.inherited + 1);
    msg += `\n§5✦ Herança: o poder dele foi distribuído entre os shikigamis que restam (vida extra nível ${r.inherited}).`;
  }
  saveSorcerer(a.record.ownerId);
  if (owner) safe(() => owner.sendMessage(msg), undefined);
  return true;
}

// -----------------------------------------------------------------------------------------
// Shadow storage (Ten Shadows)
// -----------------------------------------------------------------------------------------
function heldSlot(p: Player): number {
  return safe(() => p.selectedSlotIndex, 0);
}

export function heldItemId(p: Player): string | undefined {
  const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
  return safe(() => cont?.getItem(heldSlot(p))?.typeId, undefined);
}

export function depositHeld(p: Player): boolean {
  const r = sorcerer(p.id);
  const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
  const stack = cont ? safe(() => cont.getItem(heldSlot(p)), undefined) : undefined;
  if (!cont || !stack) {
    p.sendMessage("§7Segure na mão o item que quer guardar na sombra.");
    return false;
  }
  if (stack.typeId === SUMMONER_ITEM) {
    p.sendMessage("§7O Grimório não pode ser guardado dentro da própria sombra.");
    return false;
  }
  if (r.store.length >= STORE_SLOTS) {
    p.sendMessage(`§7Sua sombra está cheia (${STORE_SLOTS} pilhas).`);
    return false;
  }
  if (!spend(p, 5, "guardar na sombra")) return false;
  r.store.push(toStored(stack));
  safe(() => cont.setItem(heldSlot(p), undefined), undefined);
  saveSorcerer(p.id);
  particle(p.dimension, "shadowbound:wisp", p.location);
  p.sendMessage(`§5${stack.amount}× ${stack.typeId.replace(/^\w+:/, "")} §fafundou na sua sombra.`);
  return true;
}

export function withdraw(p: Player, i: number): boolean {
  const r = sorcerer(p.id);
  const s = r.store[i];
  if (!s) return false;
  const st = toStack(s);
  if (!st) return false;
  const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
  const left: ItemStack | undefined = cont ? safe(() => cont.addItem(st), st) : st;
  if (left) safe(() => p.dimension.spawnItem(left, p.location), undefined);
  r.store.splice(i, 1);
  saveSorcerer(p.id);
  particle(p.dimension, "shadowbound:wisp", p.location);
  return true;
}

/** Give an item to the player (falls at their feet if the inventory is full). */
export function giveItem(p: Player, id: string, n = 1): void {
  const st = safe(() => new ItemStack(id, n), undefined);
  if (!st) return;
  const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
  const left = cont ? safe(() => cont.addItem(st), st) : st;
  if (left) safe(() => p.dimension.spawnItem(left, p.location), undefined);
}

// -----------------------------------------------------------------------------------------
// Per-second tick
// -----------------------------------------------------------------------------------------
let tickN = 0;
export function sorcererTick(): void {
  tickN++;
  for (const p of world.getAllPlayers()) {
    const r = sorcerer(p.id);
    const max = maxEnergyOf(r);
    const drain = abilityTick(p, r);
    if (drain > 0) {
      if (r.energy < drain) {
        r.toggles = {};
        safe(() => p.sendMessage(`§7Sua ${energyName(r).toLowerCase()} acabou: técnicas alternáveis desligadas.`), undefined);
      } else r.energy -= drain;
    } else r.energy = Math.min(max, r.energy + regenOf(r));
    r.throat = Math.max(0, r.throat - 3);
    sukunaTick(p, r);
    if (r.inherited > 0 && tickN % 10 === 0) {
      for (const m of squadOf(p.id, true).filter((x) => x.isBeast)) {
        const b = m.body();
        if (b) safe(() => b.addEffect("health_boost", 240, { amplifier: Math.min(2, r.inherited - 1), showParticles: false }), undefined);
      }
    }
    if (tickN % 15 === 0) saveSorcerer(p.id);
    const recent = Date.now() - (lastChange.get(p.id) ?? 0) < 3000;
    const holding = heldItemId(p) === SUMMONER_ITEM;
    if (r.hud && (recent || holding || drain || r.domain)) {
      const bar = Math.round((r.energy / max) * 10);
      const on = Object.keys(r.toggles).filter((k) => r.toggles[k]).length;
      const extra = `${on ? ` §a[${on} ligada${on > 1 ? "s" : ""}]` : ""}${r.domain && r.domain.until > Date.now() ? " §5[DOMÍNIO]" : ""}${r.tech === "speech" && r.throat ? ` §d[garganta ${Math.round(r.throat)}%]` : ""}${r.vessel ? ` §c[Sukuna ${Math.round(r.influence)}%]` : ""}`;
      const col = usesVigor(r) ? "§6" : "§d";
      safe(() => p.onScreenDisplay.setActionBar(`${col}✦ ${"▮".repeat(bar)}§8${"▮".repeat(10 - bar)} §f${Math.floor(r.energy)}/${max} §7· nv ${masteryLevel(r.xp)}${extra}`), undefined);
    }
  }
}
