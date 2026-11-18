/**
 * Catalogs for the squad: companion specialties and shadow beasts. Pure module.
 * Beasts are original shadow animals (wolves, owl, serpent, toad, elephant, rabbit, deer,
 * bull, tiger, lion, dragon and a colossus). They fight, hunt and guard; they never gather.
 */
import type { Persona } from "./constants";
import type { TaskKind } from "./types";

export const BEASTS = ["wolf", "owl", "serpent", "toad", "elephant", "rabbit", "deer", "bull", "tiger", "lion", "dragon", "colossus"] as const;
export type BeastSpecies = (typeof BEASTS)[number];

export interface BeastInfo {
  pt: string; // display name
  article: "o" | "a";
  sound: string; // shown in chat instead of speech
  alias: RegExp; // how the owner refers to it (normalized text)
  health: number;
  attack: number;
  speed: number;
  width: number;
  height: number;
  ability: string; // PT description
  big: boolean;
}

export const BEAST_INFO: Record<BeastSpecies, BeastInfo> = {
  wolf: { pt: "Lobo Sombrio", article: "o", sound: "*uivo baixo*", alias: /\b(lobos?|cachorros?|caes|cao)\b/, health: 30, attack: 5, speed: 0.36, width: 0.7, height: 0.9, ability: "rápido, caça em dupla e marca o alvo", big: false },
  owl: { pt: "Coruja Sombria", article: "a", sound: "*pio grave*", alias: /\b(corujas?|ave|aves|passaro|passaros)\b/, health: 24, attack: 4, speed: 0.34, width: 0.8, height: 1.1, ability: "mergulho que derruba e deixa o alvo lento", big: false },
  serpent: { pt: "Serpente Sombria", article: "a", sound: "*sibilo*", alias: /\b(serpentes?|cobras?)\b/, health: 50, attack: 6, speed: 0.28, width: 1.2, height: 0.9, ability: "prende o alvo e o envenena", big: true },
  toad: { pt: "Sapo Sombrio", article: "o", sound: "*croac*", alias: /\b(sapos?|rans?)\b/, health: 36, attack: 4, speed: 0.26, width: 1.0, height: 1.0, ability: "puxa inimigos com a língua", big: false },
  elephant: { pt: "Elefante Sombrio", article: "o", sound: "*barrido*", alias: /\b(elefantes?)\b/, health: 90, attack: 8, speed: 0.24, width: 1.8, height: 2.3, ability: "jato de água que empurra e apaga fogo", big: true },
  rabbit: { pt: "Coelho Sombrio", article: "o", sound: "*tump tump*", alias: /\b(coelhos?)\b/, health: 16, attack: 2, speed: 0.42, width: 0.5, height: 0.6, ability: "nuvem de sombra que cega os inimigos", big: false },
  deer: { pt: "Cervo Sombrio", article: "o", sound: "*bramido suave*", alias: /\b(cervos?|veados?|alces?)\b/, health: 40, attack: 3, speed: 0.32, width: 0.9, height: 1.7, ability: "cura você e o esquadrão", big: false },
  bull: { pt: "Touro Sombrio", article: "o", sound: "*bufada*", alias: /\b(touros?|bois?)\b/, health: 70, attack: 9, speed: 0.3, width: 1.4, height: 1.6, ability: "investida que arremessa inimigos", big: true },
  tiger: { pt: "Tigre Sombrio", article: "o", sound: "*rosnado*", alias: /\b(tigres?)\b/, health: 60, attack: 9, speed: 0.36, width: 1.1, height: 1.2, ability: "golpes rápidos e fortes", big: true },
  lion: { pt: "Leão Sombrio", article: "o", sound: "*rugido*", alias: /\b(leoes|leao)\b/, health: 70, attack: 8, speed: 0.33, width: 1.2, height: 1.4, ability: "rugido que enfraquece inimigos perto", big: true },
  dragon: { pt: "Dragão Sombrio", article: "o", sound: "*rugido profundo*", alias: /\b(dragoes|dragao)\b/, health: 140, attack: 12, speed: 0.3, width: 2.4, height: 2.6, ability: "sopro de fogo sombrio em área", big: true },
  colossus: { pt: "Colosso Sombrio", article: "o", sound: "*estrondo*", alias: /\b(colossos?|gigantes?|guardiao)\b/, health: 200, attack: 14, speed: 0.26, width: 1.6, height: 3.4, ability: "se adapta: cada golpe que recebe o deixa mais resistente", big: true },
};

export function beastFromText(s: string): BeastSpecies | undefined {
  for (const b of BEASTS) if (BEAST_INFO[b].alias.test(s)) return b;
  return undefined;
}

/** What a beast may be ordered to do. Beasts never gather, craft or build. */
export const BEAST_TASKS: TaskKind[] = ["attack", "hunt", "return"];

/** Specialty score per persona and task kind (higher = assigned first). Default 1. */
export const SPECIALTY: Record<Persona, Partial<Record<TaskKind, number>>> = {
  luna: { craft: 3, cook: 3, gather_food: 2, attack: 2 },
  raven: { attack: 3, hunt: 3, mine: 2, destroy: 2 },
  sora: { mine: 3, destroy: 3, gather_wood: 2, build: 2 },
  yuki: { cook: 3, deliver: 3, gather_food: 2, attack: 2 },
  hana: { gather_food: 3, farm: 3, gather_wood: 2, hunt: 2 },
  aiko: { build: 3, gather_wood: 3, craft: 2, mine: 2 },
};

export const PERSONA_ROLE: Record<Persona, string> = {
  luna: "bruxinha: magia, fabricação e cozinha",
  raven: "guerreira: combate e caça",
  sora: "psíquica: mineração e demolição",
  yuki: "irmã elegante: cozinha, entregas e proteção",
  hana: "fazendeira: comida, plantação e madeira",
  aiko: "construtora: obras grandes e madeira",
};
