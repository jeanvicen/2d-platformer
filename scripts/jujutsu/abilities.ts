/**
 * Every innate technique's abilities, general techniques, toggles and domain expansions.
 * Targets are hostile mobs only (never players, never shikigami). No ability breaks blocks.
 */
import { EntityDamageCause, Player, system, world, type Entity } from "@minecraft/server";
import { isValid, safe, sound } from "../core/mc";
import { squadOf } from "../ai/agent_manager";
import { ABILITIES, GENERAL, TECHS, type AbilityInfo, type Rgb } from "./clans";
import { masteryLevel } from "./canon";
import { addXp, depositHeld, giveItem, maxEnergyOf, refund, saveSorcerer, sorcerer, spend, usesVigor, type SorcererRecord } from "./sorcerer";
import { ahead, aura, beam, burst, enemiesNear, head, lineHits, look, orb, ring, targetAhead, vanilla } from "./fx";
import { getBlock, isPassableBlock, particle } from "../core/mc";

const WHITE: Rgb = { red: 1, green: 1, blue: 1 };
const BLUE: Rgb = { red: 0.3, green: 0.65, blue: 1 };
const RED: Rgb = { red: 1, green: 0.15, blue: 0.15 };
const PURPLE: Rgb = { red: 0.65, green: 0.25, blue: 1 };
const BLOOD: Rgb = { red: 0.75, green: 0.02, blue: 0.08 };
const GOLD: Rgb = { red: 1, green: 0.85, blue: 0.3 };

/** Abilities this sorcerer has, in display order (innate first, then Shrine, then general). */
export function abilitiesFor(r: SorcererRecord): AbilityInfo[] {
  const out: string[] = [];
  if (r.tech) {
    const t = TECHS[r.tech];
    out.push(...t.abilities);
    if (t.domain) out.push(t.domain);
  }
  if (r.vessel) out.push(...TECHS.shrine.abilities, TECHS.shrine.domain!);
  if (!usesVigor(r)) out.push(...GENERAL);
  return out.map((id) => ABILITIES[id]).filter(Boolean);
}

export function costOf(r: SorcererRecord, a: AbilityInfo): number {
  return r.tech === "limitless" ? Math.ceil(a.cost / 2) : a.cost; // Six Eyes
}
export function drainOf(r: SorcererRecord, a: AbilityInfo): number {
  return r.tech === "limitless" ? a.drain / 2 : a.drain;
}

function cdLeft(r: SorcererRecord, id: string): number {
  return Math.max(0, Math.ceil(((r.cooldowns[id] ?? 0) - Date.now()) / 1000));
}

/** Why an ability cannot be used right now (or undefined when it can). */
export function blocked(r: SorcererRecord, a: AbilityInfo): string | undefined {
  if (!abilitiesFor(r).some((x) => x.id === a.id)) return "§8sua técnica não tem isso";
  if (masteryLevel(r.xp) < a.mastery) return `§8✖ domínio ${a.mastery}`;
  if (a.fingers && r.fingersEaten < a.fingers) return `§8✖ ${a.fingers} dedos de Sukuna`;
  return undefined;
}

export function abilityState(p: Player, id: string): string {
  const r = sorcerer(p.id);
  const a = ABILITIES[id];
  if (!a) return "";
  const b = blocked(r, a);
  if (b) return b;
  if (a.kind === "passiva") return "§apassiva";
  if (a.kind === "alternavel") return r.toggles[id] ? "§aLIGADA" : `§7desligada · ${drainOf(r, a)}/s`;
  if (a.kind === "dominio" && r.domain && r.domain.kind === id && r.domain.until > Date.now()) return "§5ATIVO";
  const cd = cdLeft(r, id);
  return cd ? `§7recarga ${cd}s` : `§d✦${costOf(r, a)}${a.hp ? ` §c♥${a.hp}` : ""}${a.throat ? ` §5garganta +${a.throat}` : ""}`;
}

function hurt(p: Player, e: Entity, n: number, cause: EntityDamageCause = EntityDamageCause.entityAttack): void {
  safe(() => e.applyDamage(n, { cause, damagingEntity: p }), false);
}
function push(from: { x: number; z: number }, e: Entity, k: number, up = 0.4): void {
  const dx = e.location.x - from.x;
  const dz = e.location.z - from.z;
  const n = Math.hypot(dx, dz) || 1;
  safe(() => e.applyImpulse({ x: (dx / n) * k, y: up, z: (dz / n) * k }), undefined);
}
function freeze(e: Entity, ticks: number): void {
  safe(() => e.addEffect("slowness", ticks, { amplifier: 255, showParticles: false }), undefined);
  safe(() => e.addEffect("weakness", ticks, { amplifier: 255, showParticles: false }), undefined);
}
function title(p: Player, t: string, sub = ""): void {
  safe(() => p.onScreenDisplay.setTitle(t, { subtitle: sub, fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 }), undefined);
}

// Straw Doll marks and Ratio's next critical hit (runtime only)
const marks = new Map<string, number>();
const ratioUntil = new Map<string, number>();

/** Cast an ability. Returns true if it fired. */
export function cast(p: Player, id: string): boolean {
  const r = sorcerer(p.id);
  const a = ABILITIES[id];
  if (!a) return false;
  const why = blocked(r, a);
  if (why) {
    p.sendMessage(`§7${a.name}: ${why.replace(/§./g, "")}.`);
    return false;
  }
  if (a.kind === "passiva") {
    p.sendMessage(`§7${a.name} é passiva: funciona sozinha.`);
    return false;
  }
  if (a.kind === "alternavel") {
    r.toggles[id] = !r.toggles[id];
    saveSorcerer(p.id);
    p.sendMessage(`§5${a.name}: ${r.toggles[id] ? "§aligado" : "§7desligado"}`);
    if (r.toggles[id]) sound(p.dimension, "beacon.activate", p.location, 0.5, 1.4);
    return true;
  }
  const cd = cdLeft(r, id);
  if (cd) {
    p.sendMessage(`§7${a.name} em recarga: ${cd}s.`);
    return false;
  }
  if (a.throat && r.throat >= 100) {
    p.sendMessage("§5Sua garganta está no limite. Espere ou tome um §fXarope para Garganta§5.");
    return false;
  }
  if (id === "guardar") return depositHeld(p);
  const cost = costOf(r, a);
  if (!spend(p, cost, a.name)) return false;
  const ok = run(p, r, a);
  if (!ok) {
    refund(p, cost);
    saveSorcerer(p.id);
    return false;
  }
  r.cooldowns[id] = Date.now() + a.cooldown * 1000;
  if (a.hp) safe(() => p.applyDamage(a.hp!, { cause: EntityDamageCause.magic }), false);
  if (a.throat) {
    r.throat += a.throat;
    if (r.throat > 100) {
      const over = Math.ceil((r.throat - 100) / 8);
      r.throat = 100;
      safe(() => p.applyDamage(over, { cause: EntityDamageCause.magic }), false);
      p.sendMessage("§5O contragolpe da Fala Amaldiçoada machucou sua garganta.");
    }
  }
  saveSorcerer(p.id);
  addXp(p.id, 2);
  return true;
}

function run(p: Player, r: SorcererRecord, a: AbilityInfo): boolean {
  const dim = p.dimension;
  const h = head(p);
  const v = look(p);
  const lv = masteryLevel(r.xp);
  switch (a.id) {
    // ---------------- Limitless ----------------
    case "azul": {
      const t = targetAhead(p, 16);
      const at = t ? { ...t.location } : ahead(p, 8);
      orb(dim, { x: at.x, y: at.y + 1, z: at.z }, 1.2, BLUE, 26);
      for (const e of enemiesNear(p, at, 7)) {
        safe(() => e.teleport({ x: e.location.x + (at.x - e.location.x) * 0.7, y: e.location.y, z: e.location.z + (at.z - e.location.z) * 0.7 }), undefined);
        hurt(p, e, 6 + lv);
        safe(() => e.addEffect("slowness", 40, { amplifier: 2 }), undefined);
      }
      sound(dim, "mob.warden.sonic_charge", at, 0.6, 1.6);
      return true;
    }
    case "vermelho": {
      beam(dim, h, v, 14, RED, 0.5, 0.3);
      for (const e of lineHits(p, 14, 2.5)) {
        hurt(p, e, 10 + lv * 2);
        safe(() => e.applyImpulse({ x: v.x * 3, y: 0.6, z: v.z * 3 }), undefined);
        burst(dim, e.location, RED, 12, 1);
      }
      vanilla(dim, "minecraft:large_explosion", ahead(p, 3));
      sound(dim, "random.explode", p.location, 0.6, 1.4);
      return true;
    }
    case "roxo": {
      title(p, "§5§lRoxo Oco");
      beam(dim, h, v, 30, PURPLE, 0.4, 0.8);
      for (const e of lineHits(p, 30, 3)) {
        hurt(p, e, 30 + lv * 3);
        orb(dim, { x: e.location.x, y: e.location.y + 1, z: e.location.z }, 1, PURPLE, 14);
      }
      vanilla(dim, "minecraft:huge_explosion_emitter", ahead(p, 20));
      sound(dim, "mob.warden.sonic_boom", p.location, 1, 0.7);
      return true;
    }
    case "vazio":
    case "dominio":
    case "santuario": {
      if (r.domain && r.domain.until > Date.now()) {
        p.sendMessage("§7Você já tem um domínio aberto.");
        return false;
      }
      const secs = a.id === "vazio" ? 10 : a.id === "santuario" ? 8 : 30;
      r.domain = { kind: a.id, until: Date.now() + secs * 1000, dim: dim.id, x: p.location.x, y: p.location.y, z: p.location.z };
      title(p, "§5§lExpansão de Domínio", a.name.replace("Expansão de Domínio: ", "§f"));
      sound(dim, "mob.warden.sonic_boom", p.location, 0.8, 0.5);
      return true;
    }
    // ---------------- Ten Shadows ----------------
    case "mergulho": {
      const hit = safe(() => p.getBlockFromViewDirection({ maxDistance: 16 }), undefined);
      if (!hit?.block) {
        p.sendMessage("§7Olhe para um ponto do chão a até 16 blocos.");
        return false;
      }
      const b = hit.block.location;
      const dest = { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 };
      if (!isPassableBlock(getBlock(dim, dest)) || !isPassableBlock(getBlock(dim, { x: dest.x, y: dest.y + 1, z: dest.z }))) {
        p.sendMessage("§7Não há espaço para sair da sombra ali.");
        return false;
      }
      particle(dim, "shadowbound:wisp", p.location);
      safe(() => p.teleport(dest), undefined);
      particle(dim, "shadowbound:wisp", dest);
      sound(dim, "mob.endermen.portal", dest, 0.5, 0.6);
      return true;
    }
    // ---------------- Projection ----------------
    case "quadros": {
      let last = { ...p.location };
      const frozen = new Set<string>();
      for (let d = 1; d <= 8; d++) {
        const at = { x: p.location.x + v.x * d, y: p.location.y, z: p.location.z + v.z * d };
        if (!isPassableBlock(getBlock(dim, at)) || !isPassableBlock(getBlock(dim, { x: at.x, y: at.y + 1, z: at.z }))) break;
        last = at;
        if (d % 2 === 0) burst(dim, { x: at.x, y: at.y + 1, z: at.z }, { red: 0.4, green: 1, blue: 0.75 }, 4, 0.4);
        for (const e of enemiesNear(p, at, 1.8)) if (!frozen.has(e.id)) {
          frozen.add(e.id);
          freeze(e, 30);
          hurt(p, e, 5 + lv);
        }
      }
      safe(() => p.teleport(last), undefined);
      sound(dim, "mob.breeze.jump", last, 0.6, 1.6);
      return true;
    }
    case "quadro_congelado": {
      const t = targetAhead(p, 6);
      if (!t) {
        p.sendMessage("§7Chegue perto de um inimigo para tocá-lo.");
        return false;
      }
      freeze(t, 60);
      hurt(p, t, 6 + lv);
      for (let i = 0; i < 4; i++) ring(dim, t.location, 0.7, { red: 0.4, green: 1, blue: 0.75 }, 10, 0.3 + i * 0.5);
      return true;
    }
    // ---------------- Heavenly Restriction ----------------
    case "investida_celestial": {
      const t = targetAhead(p, 10);
      if (!t) {
        p.sendMessage("§7Nenhum inimigo à frente.");
        return false;
      }
      const d = Math.hypot(t.location.x - p.location.x, t.location.z - p.location.z) || 1;
      safe(() => p.teleport({ x: t.location.x - (t.location.x - p.location.x) / d, y: t.location.y, z: t.location.z - (t.location.z - p.location.z) / d }, { facingLocation: t.location }), undefined);
      hurt(p, t, 10 + lv * 2);
      push(p.location, t, 2.2, 0.5);
      burst(dim, t.location, GOLD, 10, 0.8);
      sound(dim, "mob.irongolem.throw", t.location, 0.8, 0.8);
      return true;
    }
    case "salto_celestial": {
      safe(() => p.applyKnockback({ x: v.x * 1.2, z: v.z * 1.2 }, 1.3), undefined);
      safe(() => p.addEffect("slow_falling", 60, { amplifier: 0, showParticles: false }), undefined);
      ring(dim, p.location, 1.2, GOLD, 14);
      return true;
    }
    // ---------------- Blood Manipulation ----------------
    case "sangue_perfurante": {
      beam(dim, h, v, 22, BLOOD, 0.35);
      for (const e of lineHits(p, 22, 1.4)) hurt(p, e, 14 + lv * 2);
      sound(dim, "mob.guardian.attack", p.location, 0.6, 1.5);
      return true;
    }
    case "amarracao": {
      const t = targetAhead(p, 10);
      if (!t) {
        p.sendMessage("§7Nenhum alvo à frente.");
        return false;
      }
      freeze(t, 80);
      for (let i = 0; i < 3; i++) ring(dim, t.location, 0.8, BLOOD, 12, 0.3 + i * 0.6);
      return true;
    }
    case "supernova": {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        orb(dim, { x: p.location.x + Math.cos(ang) * 2, y: p.location.y + 1.4, z: p.location.z + Math.sin(ang) * 2 }, 0.35, BLOOD, 8);
      }
      system.runTimeout(() => {
        for (const e of enemiesNear(p, p.location, 6)) {
          hurt(p, e, 8 + lv * 2);
          push(p.location, e, 1.6, 0.4);
        }
        burst(dim, { x: p.location.x, y: p.location.y + 1, z: p.location.z }, BLOOD, 24, 3);
        sound(dim, "random.explode", p.location, 0.5, 1.6);
      }, 12);
      return true;
    }
    // ---------------- Cursed Speech ----------------
    case "nao_se_mexa":
    case "exploda":
    case "durma": {
      const words = { nao_se_mexa: "NÃO SE MEXA", exploda: "EXPLODA", durma: "DURMA" }[a.id];
      const list = enemiesNear(p, p.location, 10);
      for (const e of list) {
        if (a.id === "nao_se_mexa") freeze(e, 60);
        else if (a.id === "exploda") {
          hurt(p, e, 9 + lv);
          push(p.location, e, 2.4, 0.7);
        } else {
          freeze(e, 120);
          safe(() => e.addEffect("blindness", 120, { amplifier: 0 }), undefined);
        }
      }
      for (let k = 1; k <= 3; k++) ring(dim, p.location, k * 3, { red: 0.7, green: 0.4, blue: 1 }, 18, 1.4);
      title(p, `§5§l"${words}"`);
      sound(dim, "mob.evocation_illager.cast_spell", p.location, 0.8, 0.7);
      return true;
    }
    case "esmague": {
      const t = targetAhead(p, 16);
      if (!t) {
        p.sendMessage("§7Nenhum alvo à frente.");
        return false;
      }
      hurt(p, t, 20 + lv * 2);
      for (let i = 0; i < 3; i++) ring(dim, t.location, 1.4 - i * 0.4, { red: 0.7, green: 0.4, blue: 1 }, 12, 2 - i * 0.6);
      title(p, '§5§l"ESMAGUE"');
      return true;
    }
    // ---------------- Straw Doll ----------------
    case "pregos": {
      const t = targetAhead(p, 20);
      if (!t) {
        p.sendMessage("§7Nenhum alvo para os pregos.");
        return false;
      }
      beam(dim, h, { x: (t.location.x - h.x) / 20, y: (t.location.y + 1 - h.y) / 20, z: (t.location.z - h.z) / 20 }, 20, { red: 1, green: 0.6, blue: 0.2 }, 1.5);
      hurt(p, t, 5 + lv);
      marks.set(t.id, Date.now() + 30000);
      sound(dim, "random.anvil_land", t.location, 0.3, 1.8);
      return true;
    }
    case "ressonancia":
    case "grampo": {
      const now = Date.now();
      const marked = enemiesNear(p, p.location, 32).filter((e) => (marks.get(e.id) ?? 0) > now);
      if (!marked.length) {
        p.sendMessage("§7Nenhum alvo marcado com pregos por perto.");
        return false;
      }
      for (const e of marked) {
        if (a.id === "ressonancia") {
          hurt(p, e, 12 + lv * 2, EntityDamageCause.magic);
          ring(dim, e.location, 1, { red: 1, green: 0.6, blue: 0.2 }, 12, 1);
        } else {
          for (const x of enemiesNear(p, e.location, 3)) hurt(p, x, 8 + lv);
          burst(dim, e.location, { red: 1, green: 0.45, blue: 0.1 }, 16, 1.5);
          vanilla(dim, "minecraft:large_explosion", e.location);
          marks.delete(e.id);
        }
      }
      sound(dim, "random.anvil_land", p.location, 0.6, 0.7);
      return true;
    }
    // ---------------- Boogie Woogie ----------------
    case "palmas":
    case "troca_confusa": {
      const t = targetAhead(p, 24);
      if (!t) {
        p.sendMessage("§7Nada no alcance para trocar de lugar.");
        return false;
      }
      const mine = { ...p.location };
      const theirs = { ...t.location };
      safe(() => p.teleport(theirs), undefined);
      safe(() => t.teleport(mine), undefined);
      burst(dim, mine, GOLD, 8, 0.6);
      burst(dim, theirs, GOLD, 8, 0.6);
      sound(dim, "random.click", p.location, 1, 0.6);
      if (a.id === "troca_confusa") for (const e of enemiesNear(p, p.location, 8)) {
        safe(() => e.addEffect("nausea", 100, { amplifier: 0 }), undefined);
        safe(() => e.addEffect("slowness", 60, { amplifier: 2 }), undefined);
      }
      return true;
    }
    // ---------------- Ratio ----------------
    case "golpe_73":
      ratioUntil.set(p.id, Date.now() + 6000);
      p.sendMessage("§e7:3 §f— o próximo golpe acerta o ponto fraco.");
      return true;
    case "colapso": {
      const at = ahead(p, 5);
      for (const e of enemiesNear(p, at, 5)) {
        hurt(p, e, 12 + lv * 2);
        push(p.location, e, 1.2, 0.2);
        safe(() => e.addEffect("slowness", 60, { amplifier: 2 }), undefined);
      }
      burst(dim, at, { red: 0.7, green: 0.6, blue: 0.5 }, 30, 4);
      vanilla(dim, "minecraft:huge_explosion_emitter", at);
      sound(dim, "random.explode", at, 0.7, 0.6);
      return true;
    }
    // ---------------- Construction ----------------
    case "criar_municao":
      giveItem(p, "minecraft:arrow", 8);
      burst(dim, head(p), { red: 0.6, green: 0.8, blue: 1 }, 8, 0.5);
      return true;
    case "criar_lamina":
      giveItem(p, "minecraft:iron_sword", 1);
      burst(dim, head(p), { red: 0.6, green: 0.8, blue: 1 }, 12, 0.6);
      return true;
    case "criar_escudo":
      giveItem(p, "minecraft:shield", 1);
      burst(dim, head(p), { red: 0.6, green: 0.8, blue: 1 }, 12, 0.6);
      return true;
    // ---------------- Shrine (Sukuna) ----------------
    case "desmantelar": {
      beam(dim, h, v, 16, WHITE, 0.5);
      for (const e of lineHits(p, 16, 1.5)) hurt(p, e, 10 + lv * 2);
      sound(dim, "item.trident.riptide_1", p.location, 0.6, 1.8);
      return true;
    }
    case "clivar": {
      const t = targetAhead(p, 5);
      if (!t) {
        p.sendMessage("§7Chegue perto do alvo para Clivar.");
        return false;
      }
      const max = safe(() => t.getComponent("minecraft:health")?.effectiveMax ?? 20, 20);
      hurt(p, t, Math.min(40, 6 + max * 0.3));
      for (let i = 0; i < 3; i++) beam(dim, { x: t.location.x - 1, y: t.location.y + 0.5 + i * 0.5, z: t.location.z - 1 }, { x: 0.7, y: 0, z: 0.7 }, 2.8, WHITE, 0.3);
      return true;
    }
    case "fuga": {
      const t = targetAhead(p, 18);
      const at = t ? { ...t.location } : ahead(p, 14);
      beam(dim, h, { x: (at.x - h.x) / 18, y: (at.y + 1 - h.y) / 18, z: (at.z - h.z) / 18 }, 18, { red: 1, green: 0.45, blue: 0.1 }, 0.6, 0.2);
      for (const e of enemiesNear(p, at, 4)) {
        safe(() => e.setOnFire(8, true), false);
        hurt(p, e, 14 + lv * 2, EntityDamageCause.fire);
      }
      for (let i = 0; i < 6; i++) vanilla(dim, "minecraft:basic_flame_particle", { x: at.x + Math.cos(i) * 2, y: at.y + 0.5, z: at.z + Math.sin(i) * 2 });
      burst(dim, at, { red: 1, green: 0.45, blue: 0.1 }, 24, 2.5);
      title(p, '§c§l"Abrir"');
      sound(dim, "mob.blaze.shoot", p.location, 1, 0.6);
      return true;
    }
    case "rct":
      safe(() => p.addEffect("instant_health", 1, { amplifier: 1, showParticles: true }), undefined);
      safe(() => p.addEffect("regeneration", 100, { amplifier: 1, showParticles: true }), undefined);
      orb(dim, { x: p.location.x, y: p.location.y + 1, z: p.location.z }, 0.9, { red: 1, green: 1, blue: 0.85 }, 18);
      return true;
    default:
      return false;
  }
}

// -----------------------------------------------------------------------------------------
// Per-second: toggles, Heavenly Restriction body, domains. Returns energy drained.
// -----------------------------------------------------------------------------------------
const eff = (p: Player, id: string, amp: number, ticks = 40) => safe(() => p.addEffect(id, ticks, { amplifier: amp, showParticles: false }), undefined);

export function abilityTick(p: Player, r: SorcererRecord): number {
  let drain = 0;
  const color = r.tech ? TECHS[r.tech].color : PURPLE;
  for (const id of Object.keys(r.toggles)) {
    if (!r.toggles[id]) continue;
    const a = ABILITIES[id];
    if (!a || blocked(r, a)) {
      r.toggles[id] = false;
      continue;
    }
    drain += drainOf(r, a);
    if (id === "reforco") { eff(p, "strength", 0); eff(p, "speed", 0); aura(p, color); }
    else if (id === "dominio_simples") {
      eff(p, "resistance", 0);
      for (const ef of ["poison", "wither", "slowness", "blindness", "weakness"]) safe(() => p.removeEffect(ef), false);
      ring(p.dimension, p.location, 1.4, { red: 0.55, green: 0.85, blue: 1 }, 10);
    } else if (id === "infinito") {
      eff(p, "resistance", 3);
      for (const e of enemiesNear(p, p.location, 3)) push(p.location, e, 0.9, 0.1);
      ring(p.dimension, p.location, 1.1, BLUE, 8, 1);
    } else if (id === "aceleracao") { eff(p, "speed", 2); eff(p, "haste", 1); aura(p, { red: 0.4, green: 1, blue: 0.75 }, 3); }
    else if (id === "escamas") { eff(p, "strength", 1); eff(p, "speed", 1); eff(p, "resistance", 0); aura(p, BLOOD); }
    else if (id === "hora_extra") { eff(p, "strength", 2); aura(p, { red: 0.95, green: 0.9, blue: 0.6 }, 3); }
  }
  if (r.tech === "heavenly") { // superhuman body, always on
    eff(p, "strength", 1, 60); eff(p, "speed", 1, 60); eff(p, "resistance", 0, 60); eff(p, "jump_boost", 1, 60); eff(p, "night_vision", 0, 400);
  }
  domainTick(p, r);
  return drain;
}

function domainTick(p: Player, r: SorcererRecord): void {
  const d = r.domain;
  if (!d) return;
  if (d.until <= Date.now()) {
    r.domain = undefined;
    safe(() => p.sendMessage("§7O domínio se desfez."), undefined);
    return;
  }
  const dim = safe(() => world.getDimension(d.dim), undefined);
  if (!dim) return;
  const c = { x: d.x, y: d.y, z: d.z };
  const radius = d.kind === "vazio" ? 15 : d.kind === "santuario" ? 14 : 12;
  const col = d.kind === "vazio" ? { red: 0.85, green: 0.95, blue: 1 } : d.kind === "santuario" ? RED : PURPLE;
  ring(dim, c, radius, col, 24, 0.2);
  if (d.kind === "vazio") orb(dim, { x: c.x, y: c.y + 2, z: c.z }, 3, col, 16);
  for (const e of enemiesNear(p, c, radius)) {
    if (d.kind === "vazio") {
      freeze(e, 30);
      safe(() => e.addEffect("mining_fatigue", 30, { amplifier: 4, showParticles: false }), undefined);
    } else if (d.kind === "santuario") {
      hurt(p, e, 6);
      beam(dim, { x: e.location.x - 1, y: e.location.y + 1, z: e.location.z }, { x: 1, y: 0.3, z: 0.4 }, 2, WHITE, 0.4);
    } else {
      safe(() => e.addEffect("slowness", 30, { amplifier: 2 }), undefined);
      safe(() => e.addEffect("blindness", 30, { amplifier: 0 }), undefined);
    }
  }
  if (d.kind === "dominio") {
    for (const m of squadOf(p.id, true).filter((x) => x.isBeast)) {
      const b = m.body();
      if (!b || Math.hypot(b.location.x - c.x, b.location.z - c.z) > radius) continue;
      safe(() => b.addEffect("strength", 30, { amplifier: 1, showParticles: false }), undefined);
      safe(() => b.addEffect("speed", 30, { amplifier: 1, showParticles: false }), undefined);
    }
  }
}

// -----------------------------------------------------------------------------------------
// Melee hooks: Black Flash, Ratio 7:3
// -----------------------------------------------------------------------------------------
export function onPlayerMelee(p: Player, target: Entity): void {
  if (!isValid(target) || target instanceof Player) return;
  const r = sorcerer(p.id);
  const lv = masteryLevel(r.xp);
  if ((ratioUntil.get(p.id) ?? 0) > Date.now()) {
    ratioUntil.delete(p.id);
    hurt(p, target, 10 + lv * 2);
    burst(p.dimension, target.location, { red: 1, green: 0.95, blue: 0.6 }, 10, 0.7);
    safe(() => p.onScreenDisplay.setActionBar("§e§l7:3 — crítico!"), undefined);
  }
  if (!usesVigor(r) && lv >= 1 && Math.random() < Math.min(0.15, 0.04 + 0.01 * lv)) {
    hurt(p, target, 6 + 2 * lv);
    r.energy = Math.min(maxEnergyOf(r), r.energy + 15);
    for (let i = 0; i < 8; i++) particle(p.dimension, "shadowbound:sparkle", { x: target.location.x + (i / 7 - 0.5) * 1.6, y: target.location.y + 1 + Math.sin(i) * 0.6, z: target.location.z }, i % 2 ? { red: 0, green: 0, blue: 0 } : RED);
    sound(p.dimension, "ambient.weather.thunder", target.location, 0.4, 1.6);
    safe(() => p.onScreenDisplay.setActionBar("§4§l⚡ BLACK FLASH! ⚡"), undefined);
    addXp(p.id, 20);
  }
}
