/**
 * Cursed tools, uniforms and consumables. Forged from the Grimório (no crafting table needed on a phone):
 * materials come out of the player's inventory. On-hit effects run here.
 */
import { EntityDamageCause, Player, type Entity } from "@minecraft/server";
import { safe } from "../core/mc";
import type { Origin } from "./canon";
import { burst } from "./fx";
import { giveItem, heldItemId, sorcerer, usesVigor } from "./sorcerer";
import { FINGER_ITEM, FRAGMENT_ITEM, SYRUP_ITEM } from "./sukuna";

export interface GearInfo {
  id: string;
  name: string;
  kind: "ferramenta" | "uniforme" | "consumivel";
  origin: Origin;
  effectOrigin: Origin;
  desc: string;
  cost: Record<string, number>; // materials to forge
  icon: string;                 // item atlas name (also used by the menu)
}

export const GEAR: GearInfo[] = [
  { id: "shadowbound:playful_cloud", name: "Nuvem Brincalhona", kind: "ferramenta", origin: "canon", effectOrigin: "original", icon: "sb_playful_cloud",
    desc: "Bastão de três seções. Não tem técnica própria: amplifica a força de quem usa. Golpes com empurrão enorme.",
    cost: { [FRAGMENT_ITEM]: 6, "minecraft:iron_ingot": 3, "minecraft:chain": 2 } },
  { id: "shadowbound:inverted_spear", name: "Lança Invertida do Céu", kind: "ferramenta", origin: "canon", effectOrigin: "incerto", icon: "sb_inverted_spear",
    desc: "Anula técnicas amaldiçoadas ao tocar. No jogo: tira todos os efeitos do alvo e fura a adaptação do Mahoraga.",
    cost: { [FRAGMENT_ITEM]: 10, "minecraft:diamond": 2, "minecraft:stick": 2 } },
  { id: "shadowbound:split_soul_katana", name: "Katana Alma Dividida", kind: "ferramenta", origin: "canon", effectOrigin: "incerto", icon: "sb_split_soul_katana",
    desc: "Corta a alma, ignorando a resistência do corpo. No jogo: dano extra que ignora armadura e corta a regeneração do alvo.",
    cost: { [FRAGMENT_ITEM]: 8, "minecraft:iron_ingot": 4, "minecraft:stick": 1 } },
  { id: "shadowbound:dragon_bone", name: "Osso de Dragão", kind: "ferramenta", origin: "canon", effectOrigin: "incerto", icon: "sb_dragon_bone",
    desc: "Lâmina que acumula a energia dos impactos e a libera depois. No jogo: guarda o dano que você recebe e solta no próximo golpe.",
    cost: { [FRAGMENT_ITEM]: 8, "minecraft:bone_block": 2, "minecraft:iron_ingot": 2 } },
  { id: "shadowbound:slaughter_demon", name: "Demônio Matador", kind: "ferramenta", origin: "canon", effectOrigin: "original", icon: "sb_slaughter_demon",
    desc: "Faca amaldiçoada. No jogo: dano dobrado contra mortos-vivos (maldições).",
    cost: { [FRAGMENT_ITEM]: 4, "minecraft:iron_ingot": 2 } },
  { id: "shadowbound:uniform_tokyo_chest", name: "Jaqueta da Escola de Tóquio", kind: "uniforme", origin: "canon", effectOrigin: "original", icon: "sb_uniform_tokyo_chest",
    desc: "Uniforme do Colégio Técnico de Jujutsu de Tóquio, com botões em espiral.",
    cost: { "minecraft:black_wool": 4, "minecraft:gold_nugget": 3 } },
  { id: "shadowbound:uniform_tokyo_legs", name: "Calça da Escola de Tóquio", kind: "uniforme", origin: "canon", effectOrigin: "original", icon: "sb_uniform_tokyo_legs",
    desc: "Calça do uniforme de Tóquio.",
    cost: { "minecraft:black_wool": 3 } },
  { id: "shadowbound:uniform_kyoto_chest", name: "Jaqueta da Escola de Kyoto", kind: "uniforme", origin: "canon", effectOrigin: "original", icon: "sb_uniform_kyoto_chest",
    desc: "Uniforme da escola irmã de Kyoto.",
    cost: { "minecraft:gray_wool": 4, "minecraft:gold_nugget": 2 } },
  { id: "shadowbound:gojo_blindfold", name: "Venda Preta", kind: "uniforme", origin: "canon", effectOrigin: "original", icon: "sb_gojo_blindfold",
    desc: "A venda que Gojo usa para descansar os Seis Olhos.",
    cost: { "minecraft:black_wool": 1, [FRAGMENT_ITEM]: 1 } },
  { id: SYRUP_ITEM, name: "Xarope para Garganta", kind: "consumivel", origin: "canon", effectOrigin: "original", icon: "sb_throat_syrup",
    desc: "O remédio de quem usa a Fala Amaldiçoada. Alivia a garganta.",
    cost: { "minecraft:honey_bottle": 1, "minecraft:sugar": 1 } },
  { id: FINGER_ITEM, name: "Dedo de Sukuna", kind: "consumivel", origin: "canon", effectOrigin: "incerto", icon: "sb_sukuna_finger",
    desc: "Um dos vinte dedos do Rei das Maldições. Não pode ser forjado: cai, raramente, de inimigos derrotados.",
    cost: {} },
  { id: FRAGMENT_ITEM, name: "Fragmento Amaldiçoado", kind: "consumivel", origin: "original", effectOrigin: "original", icon: "sb_cursed_fragment",
    desc: "Resto de energia amaldiçoada. Cai de inimigos derrotados. Material da forja.",
    cost: {} },
];

export const TOOL_IDS = GEAR.filter((g) => g.kind === "ferramenta").map((g) => g.id);

function countItem(p: Player, id: string): number {
  const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
  if (!cont) return 0;
  let n = 0;
  for (let i = 0; i < cont.size; i++) {
    const st = safe(() => cont.getItem(i), undefined);
    if (st && st.typeId === id) n += st.amount;
  }
  return n;
}

function takeItem(p: Player, id: string, n: number): void {
  const cont = safe(() => p.getComponent("minecraft:inventory")?.container, undefined);
  if (!cont) return;
  for (let i = 0; i < cont.size && n > 0; i++) {
    const st = safe(() => cont.getItem(i), undefined);
    if (!st || st.typeId !== id) continue;
    const k = Math.min(n, st.amount);
    n -= k;
    if (k >= st.amount) safe(() => cont.setItem(i, undefined), undefined);
    else {
      st.amount -= k;
      safe(() => cont.setItem(i, st), undefined);
    }
  }
}

export function missing(p: Player, g: GearInfo): string[] {
  return Object.entries(g.cost).filter(([id, n]) => countItem(p, id) < n).map(([id, n]) => `${n - countItem(p, id)}× ${prettyId(id)}`);
}

export function prettyId(id: string): string {
  const g = GEAR.find((x) => x.id === id);
  return g ? g.name : id.replace(/^\w+:/, "").replace(/_/g, " ");
}

export function forge(p: Player, g: GearInfo): boolean {
  if (!Object.keys(g.cost).length) {
    p.sendMessage(`§7${g.name} não pode ser forjado.`);
    return false;
  }
  const miss = missing(p, g);
  if (miss.length) {
    p.sendMessage(`§7Falta material para ${g.name}: ${miss.join(", ")}.`);
    return false;
  }
  for (const [id, n] of Object.entries(g.cost)) takeItem(p, id, n);
  giveItem(p, g.id, 1);
  burst(p.dimension, { x: p.location.x, y: p.location.y + 1.2, z: p.location.z }, { red: 0.7, green: 0.4, blue: 1 }, 12, 0.8);
  p.sendMessage(`§5✦ Forjado:§f ${g.name}`);
  return true;
}

// Dragon-Bone: damage the wielder took, released on the next hit
const stored = new Map<string, number>();

export function onPlayerHurt(p: Player, damage: number): void {
  if (heldItemId(p) !== "shadowbound:dragon_bone") return;
  stored.set(p.id, Math.min(30, (stored.get(p.id) ?? 0) + damage));
}

/** Melee hit by a player: cursed tool effects (+50% for Heavenly Restriction). */
export function onToolHit(p: Player, target: Entity): void {
  const id = heldItemId(p);
  if (!id || !TOOL_IDS.includes(id)) return;
  const r = sorcerer(p.id);
  const k = usesVigor(r) ? 1.5 : 1;
  const extra = (n: number, cause: EntityDamageCause = EntityDamageCause.entityAttack) => safe(() => target.applyDamage(Math.round(n * k), { cause, damagingEntity: p }), false);
  switch (id) {
    case "shadowbound:playful_cloud": {
      const dx = target.location.x - p.location.x;
      const dz = target.location.z - p.location.z;
      const n = Math.hypot(dx, dz) || 1;
      safe(() => target.applyImpulse({ x: (dx / n) * 2.5 * k, y: 0.6, z: (dz / n) * 2.5 * k }), undefined);
      if (k > 1) extra(4);
      break;
    }
    case "shadowbound:inverted_spear":
      for (const ef of safe(() => target.getEffects(), [] as { typeId: string }[])) safe(() => target.removeEffect(ef.typeId), false);
      extra(4, EntityDamageCause.magic);
      break;
    case "shadowbound:split_soul_katana":
      safe(() => target.removeEffect("regeneration"), false);
      safe(() => target.removeEffect("absorption"), false);
      extra(5, EntityDamageCause.magic);
      break;
    case "shadowbound:dragon_bone": {
      const s = stored.get(p.id) ?? 0;
      if (s > 0) {
        extra(s);
        stored.delete(p.id);
        burst(p.dimension, target.location, { red: 1, green: 0.9, blue: 0.7 }, 12, 1);
      }
      break;
    }
    case "shadowbound:slaughter_demon":
      if (safe(() => target.matches({ families: ["undead"] }), false)) extra(6);
      break;
    default:
      break;
  }
}
