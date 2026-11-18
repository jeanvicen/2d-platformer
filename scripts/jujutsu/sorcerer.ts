/**
 * The player as a Ten Shadows sorcerer: cursed energy, mastery, unlocked/destroyed shikigami,
 * techniques (toggles, actives, Black Flash, domain), shadow storage and the HUD.
 * Stored in the WORLD (dynamic property per player id), validated on the server side.
 */
import { EntityDamageCause, ItemStack, Player, system, world, type Entity } from "@minecraft/server";
import { BODY_TYPES, SUMMONER_ITEM } from "../core/constants";
import { BEAST_INFO, type BeastSpecies } from "../core/species";
import type { StoredItem } from "../core/types";
import { getBlock, isPassableBlock, isValid, particle, safe, sound, toStack, toStored } from "../core/mc";
import type { Agent } from "../ai/agent";
import { squadOf, summon, type SummonResult } from "../ai/agent_manager";
import { SHIKIGAMI, TECHNIQUES, blackFlashChance, energyRegen, masteryLevel, maxEnergy, shikigamiLimit } from "./canon";

export interface SorcererRecord {
  v: 1;
  energy: number;
  xp: number;
  unlocked: string[];
  destroyed: string[];
  inherited: number;
  toggles: Record<string, boolean>;
  cooldowns: Record<string, number>;
  store: StoredItem[];
  canonMode: boolean;
  hud: boolean;
  domain?: { until: number; dim: string; x: number; y: number; z: number };
}

const KEY = "sb:jjk:";
const STORE_SLOTS = 9;
const cache = new Map<string, SorcererRecord>();
const lastChange = new Map<string, number>();

function fresh(): SorcererRecord {
  return {
    v: 1, energy: 100, xp: 0,
    unlocked: Object.entries(SHIKIGAMI).filter(([, i]) => i.start).map(([k]) => k),
    destroyed: [], inherited: 0, toggles: {}, cooldowns: {}, store: [], canonMode: true, hud: true,
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

export function addXp(pid: string, n: number): void {
  const r = sorcerer(pid);
  const before = masteryLevel(r.xp);
  r.xp += n;
  saveSorcerer(pid);
  const after = masteryLevel(r.xp);
  if (after > before) {
    const p = world.getAllPlayers().find((x) => x.id === pid);
    if (p) {
      safe(() => p.sendMessage(`§5✦ Domínio da técnica subiu para o nível ${after}!§r Energia máxima: ${maxEnergy(r.xp)}.`), undefined);
      sound(p.dimension, "random.levelup", p.location, 0.6, 0.8);
    }
  }
}

export function spend(p: Player, n: number, what: string): boolean {
  const r = sorcerer(p.id);
  const cost = Math.ceil(n);
  if (r.energy < cost) {
    safe(() => p.sendMessage(`§cEnergia amaldiçoada insuficiente para ${what}: precisa de ${cost}, você tem ${Math.floor(r.energy)}.`), undefined);
    return false;
  }
  r.energy -= cost;
  saveSorcerer(p.id);
  return true;
}

export function domainActive(pid: string): boolean {
  const d = sorcerer(pid).domain;
  return !!d && d.until > Date.now();
}

// -----------------------------------------------------------------------------------------
// Summoning through the technique (gated: unlocked, not destroyed, energy, field limit)
// -----------------------------------------------------------------------------------------
export type GateResult = SummonResult | "locked" | "destroyed" | "energy" | "limit";

export function summonShikigami(p: Player, sp: BeastSpecies): GateResult {
  const info = SHIKIGAMI[sp];
  const r = sorcerer(p.id);
  if (r.destroyed.includes(sp)) {
    p.sendMessage(`§8☠ ${info.name} foi destruído e não pode mais ser invocado (Modo Cânone).`);
    return "destroyed";
  }
  if (!info.freeMode && !r.unlocked.includes(sp)) {
    if (info.inherited) p.sendMessage(`§7🔒 ${info.name} só aparece por herança: quando um Cão Divino é destruído.`);
    else p.sendMessage(`§7🔒 ${info.name} ainda não foi domado. Vença o ritual de exorcismo: §f/sombra ritual ${info.name.toLowerCase()}§7 ou pelo Selo.`);
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
  const cost = domainActive(p.id) ? info.cost / 2 : info.cost;
  if (!spend(p, cost, `invocar ${info.name}`)) return "energy";
  const res = summon(p, { kind: "beast", species: sp });
  if (res !== "spawned") {
    r.energy = Math.min(maxEnergy(r.xp), r.energy + Math.ceil(cost));
    saveSorcerer(p.id);
    return res;
  }
  safe(() => p.onScreenDisplay.setActionBar(`§8✋ §fSinal de mãos: §5${info.name}§f!`), undefined);
  addXp(p.id, 2);
  return res;
}

/** The Divine Dogs come as a pair (whichever of the two still exists). */
export function summonDivineDogs(p: Player): GateResult[] {
  const r = sorcerer(p.id);
  const out: GateResult[] = [];
  if (r.unlocked.includes("totality") && !r.destroyed.includes("totality")) out.push(summonShikigami(p, "totality"));
  for (const sp of ["wolf", "dog_white"] as BeastSpecies[]) if (!r.destroyed.includes(sp)) out.push(summonShikigami(p, sp));
  return out;
}

/**
 * A shikigami body was destroyed. In Modo Cânone it is gone for good and its power is inherited.
 * Returns true when the agent must be retired (no respawn).
 */
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
// Techniques
// -----------------------------------------------------------------------------------------
function cdLeft(r: SorcererRecord, id: string): number {
  return Math.max(0, Math.ceil(((r.cooldowns[id] ?? 0) - Date.now()) / 1000));
}

export function techniqueState(p: Player, id: string): string {
  const r = sorcerer(p.id);
  const t = TECHNIQUES.find((x) => x.id === id)!;
  if (masteryLevel(r.xp) < t.mastery) return `§8🔒 domínio ${t.mastery}`;
  if (t.cat === "passiva") return "§apassiva";
  if (t.cat === "alternavel") return r.toggles[id] ? "§aLIGADA" : "§7desligada";
  if (id === "dominio" && domainActive(p.id)) return "§5ATIVO";
  const cd = cdLeft(r, id);
  return cd ? `§7recarga ${cd}s` : `§fcusto ${t.cost}`;
}

export function useTechnique(p: Player, id: string): boolean {
  const r = sorcerer(p.id);
  const t = TECHNIQUES.find((x) => x.id === id);
  if (!t) return false;
  if (masteryLevel(r.xp) < t.mastery) {
    p.sendMessage(`§7🔒 ${t.name} exige domínio ${t.mastery} (você está no ${masteryLevel(r.xp)}).`);
    return false;
  }
  if (t.cat === "passiva") {
    p.sendMessage(`§7${t.name} é passiva: funciona sozinha.`);
    return false;
  }
  if (t.cat === "alternavel") {
    r.toggles[id] = !r.toggles[id];
    saveSorcerer(p.id);
    p.sendMessage(`§5${t.name}: ${r.toggles[id] ? "§aligado" : "§7desligado"}`);
    return true;
  }
  const cd = cdLeft(r, id);
  if (cd) {
    p.sendMessage(`§7${t.name} em recarga: ${cd}s.`);
    return false;
  }
  if (id === "guardar") return depositHeld(p);
  if (!spend(p, t.cost, t.name)) return false;
  r.cooldowns[id] = Date.now() + t.cooldown * 1000;
  let ok = true;
  if (id === "mergulho") ok = shadowDive(p);
  else if (id === "rct") {
    safe(() => p.addEffect("instant_health", 1, { amplifier: 1, showParticles: true }), undefined);
    safe(() => p.addEffect("regeneration", 100, { amplifier: 1, showParticles: true }), undefined);
    particle(p.dimension, "shadowbound:sparkle", { x: p.location.x, y: p.location.y + 1.2, z: p.location.z }, { red: 1, green: 1, blue: 0.85 });
    p.sendMessage("§fTécnica Reversa: energia negativa × negativa = energia positiva. Seu corpo se regenera.");
  } else if (id === "dominio") {
    r.domain = { until: Date.now() + 30000, dim: p.dimension.id, x: p.location.x, y: p.location.y, z: p.location.z };
    safe(() => p.onScreenDisplay.setTitle("§5Expansão de Domínio", { subtitle: "§fJardim Sombrio da Quimera", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 }), undefined);
    sound(p.dimension, "mob.warden.sonic_boom", p.location, 0.6, 0.6);
  }
  if (!ok) {
    r.energy = Math.min(maxEnergy(r.xp), r.energy + t.cost);
    r.cooldowns[id] = 0;
  }
  saveSorcerer(p.id);
  if (ok) addXp(p.id, 2);
  return ok;
}

function shadowDive(p: Player): boolean {
  const hit = safe(() => p.getBlockFromViewDirection({ maxDistance: 16 }), undefined);
  if (!hit?.block) {
    p.sendMessage("§7Olhe para um ponto do chão a até 16 blocos.");
    return false;
  }
  const b = hit.block.location;
  const dest = { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 };
  if (!isPassableBlock(getBlock(p.dimension, dest)) || !isPassableBlock(getBlock(p.dimension, { x: dest.x, y: dest.y + 1, z: dest.z }))) {
    p.sendMessage("§7Não há espaço para sair da sombra ali.");
    return false;
  }
  particle(p.dimension, "shadowbound:wisp", p.location);
  safe(() => p.teleport(dest), undefined);
  particle(p.dimension, "shadowbound:wisp", dest);
  sound(p.dimension, "mob.endermen.portal", dest, 0.5, 0.6);
  return true;
}

// Shadow storage ---------------------------------------------------------------------------
function heldSlot(p: Player): number {
  return safe(() => p.selectedSlotIndex, 0);
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
    p.sendMessage("§7O Selo não pode ser guardado dentro da própria sombra.");
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
  p.sendMessage(`§5${stack.amount}× ${stack.typeId.replace("minecraft:", "")} §fafundou na sua sombra.`);
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

// Black Flash --------------------------------------------------------------------------------
export function onPlayerHit(p: Player, target: Entity): void {
  if (!isValid(target) || target instanceof Player || BODY_TYPES.includes(safe(() => target.typeId, ""))) return;
  const r = sorcerer(p.id);
  if (Math.random() >= blackFlashChance(r.xp)) return;
  const lv = masteryLevel(r.xp);
  safe(() => target.applyDamage(6 + 2 * lv, { cause: EntityDamageCause.entityAttack, damagingEntity: p }), false);
  r.energy = Math.min(maxEnergy(r.xp), r.energy + 15);
  for (let i = 0; i < 6; i++) {
    const k = i / 5;
    particle(p.dimension, "shadowbound:sparkle", { x: target.location.x + (k - 0.5), y: target.location.y + 1 + Math.sin(k * 6), z: target.location.z }, i % 2 ? { red: 0, green: 0, blue: 0 } : { red: 1, green: 0.1, blue: 0.1 });
  }
  sound(p.dimension, "ambient.weather.thunder", target.location, 0.4, 1.6);
  safe(() => p.onScreenDisplay.setActionBar("§4§l⚡ BLACK FLASH! ⚡"), undefined);
  addXp(p.id, 20);
}

// Per-second tick --------------------------------------------------------------------------
function holdingSeal(p: Player): boolean {
  const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
  return safe(() => cont?.getItem(heldSlot(p))?.typeId === SUMMONER_ITEM, false);
}

let tickN = 0;
export function sorcererTick(): void {
  tickN++;
  for (const p of world.getAllPlayers()) {
    const r = sorcerer(p.id);
    const max = maxEnergy(r.xp);
    let drain = 0;
    if (r.toggles.reforco) {
      drain += 1;
      safe(() => p.addEffect("strength", 40, { amplifier: 0, showParticles: false }), undefined);
      safe(() => p.addEffect("speed", 40, { amplifier: 0, showParticles: false }), undefined);
    }
    if (r.toggles.dominio_simples) {
      drain += 2;
      safe(() => p.addEffect("resistance", 40, { amplifier: 0, showParticles: false }), undefined);
      for (const ef of ["poison", "wither", "slowness", "blindness", "weakness"]) safe(() => p.removeEffect(ef), false);
    }
    if (drain) {
      if (r.energy < drain) {
        r.toggles.reforco = false;
        r.toggles.dominio_simples = false;
        safe(() => p.sendMessage("§7Sua energia acabou: técnicas alternáveis desligadas."), undefined);
      } else r.energy -= drain;
    } else r.energy = Math.min(max, r.energy + energyRegen(r.xp));
    domainTick(p, r);
    if (r.inherited > 0 && tickN % 10 === 0) {
      for (const m of squadOf(p.id, true).filter((x) => x.isBeast)) {
        const b = m.body();
        if (b) safe(() => b.addEffect("health_boost", 240, { amplifier: Math.min(2, r.inherited - 1), showParticles: false }), undefined);
      }
    }
    if (tickN % 15 === 0) saveSorcerer(p.id);
    const recent = Date.now() - (lastChange.get(p.id) ?? 0) < 3000;
    if (r.hud && (recent || holdingSeal(p) || drain || domainActive(p.id))) {
      const bar = Math.round((r.energy / max) * 10);
      const tags = `${r.toggles.reforco ? " §c[Reforço]" : ""}${r.toggles.dominio_simples ? " §b[D. Simples]" : ""}${domainActive(p.id) ? " §5[DOMÍNIO]" : ""}`;
      safe(() => p.onScreenDisplay.setActionBar(`§5✦ §d${"▮".repeat(bar)}§8${"▮".repeat(10 - bar)} §f${Math.floor(r.energy)}/${max} §7· domínio ${masteryLevel(r.xp)}${tags}`), undefined);
    }
  }
}

function domainTick(p: Player, r: SorcererRecord): void {
  const d = r.domain;
  if (!d) return;
  if (d.until <= Date.now()) {
    r.domain = undefined;
    safe(() => p.sendMessage("§7O Jardim Sombrio da Quimera se desfez."), undefined);
    return;
  }
  const dim = safe(() => world.getDimension(d.dim), undefined);
  if (!dim) return;
  const c = { x: d.x, y: d.y, z: d.z };
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + system.currentTick * 0.05;
    particle(dim, "shadowbound:wisp", { x: c.x + Math.cos(ang) * 12, y: c.y + 0.2, z: c.z + Math.sin(ang) * 12 });
  }
  for (const e of safe(() => dim.getEntities({ location: c, maxDistance: 12, families: ["monster"] }), [] as Entity[])) {
    safe(() => e.addEffect("slowness", 30, { amplifier: 2 }), undefined);
    safe(() => e.addEffect("blindness", 30, { amplifier: 0 }), undefined);
  }
  for (const m of squadOf(p.id, true).filter((x) => x.isBeast)) {
    const b = m.body();
    if (!b) continue;
    const dx = b.location.x - c.x;
    const dz = b.location.z - c.z;
    if (dx * dx + dz * dz > 144) continue;
    safe(() => b.addEffect("strength", 30, { amplifier: 1, showParticles: false }), undefined);
    safe(() => b.addEffect("speed", 30, { amplifier: 1, showParticles: false }), undefined);
  }
}
