/**
 * Catalogs for the squad: companion specialties and shadow beasts. Pure module.
 * Beasts are original shadow animals (wolves, owl, serpent, toad, elephant, rabbit, deer,
 * bull, tiger, lion, dragon and a colossus). They fight, hunt and guard; they never gather.
 */
import type { Persona } from "./constants";
import type { TaskKind } from "./types";

export const BEASTS = ["wolf", "owl", "serpent", "toad", "elephant", "rabbit", "deer", "bull", "tiger", "lion", "dragon", "colossus", "dog_white", "totality"] as const;
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

/**
 * Ids are internal and stable (saved worlds keep working). Display names follow the Ten Shadows
 * Technique (Jujutsu Kaisen); lion and dragon are ORIGINAL creations of the mod (Forja de Sombras).
 */
export const BEAST_INFO: Record<BeastSpecies, BeastInfo> = {
  wolf: { pt: "Cão Divino Preto", article: "o", sound: "*rosnado*", alias: /\b(cao divino preto|cachorro preto|lobo preto|cao preto|lobos?|cachorros?|caes|cao|cao divino)\b/, health: 30, attack: 5, speed: 0.38, width: 0.7, height: 0.9, ability: "fareja e rastreia inimigos, mordida que prende", big: false },
  owl: { pt: "Nue", article: "o", sound: "*grito agudo*", alias: /\b(nue|corujas?|ave|aves|passaro|passaros)\b/, health: 28, attack: 4, speed: 0.36, width: 0.8, height: 1.1, ability: "voa, mergulha com descarga elétrica e amortece sua queda", big: false },
  serpent: { pt: "Grande Serpente", article: "a", sound: "*sibilo*", alias: /\b(grande serpente|serpentes?|cobras?|orochi)\b/, health: 55, attack: 6, speed: 0.28, width: 1.2, height: 0.9, ability: "surge da sombra embaixo do alvo e o prende", big: true },
  toad: { pt: "Sapo", article: "o", sound: "*croac*", alias: /\b(sapos?|ras?|gama)\b/, health: 36, attack: 4, speed: 0.26, width: 1.0, height: 1.0, ability: "puxa inimigos com a língua e resgata você do perigo", big: false },
  elephant: { pt: "Elefante Máximo", article: "o", sound: "*barrido*", alias: /\b(elefante maximo|elefantes?|bansho)\b/, health: 100, attack: 8, speed: 0.24, width: 1.8, height: 2.3, ability: "despeja uma enorme massa de água que empurra tudo", big: true },
  rabbit: { pt: "Fuga dos Coelhos", article: "a", sound: "*tump tump*", alias: /\b(fuga dos coelhos|coelhos?|datto)\b/, health: 16, attack: 1, speed: 0.42, width: 0.5, height: 0.6, ability: "multiplica-se em vários coelhos que distraem e cegam", big: false },
  deer: { pt: "Veado Redondo", article: "o", sound: "*bramido suave*", alias: /\b(veado redondo|veados?|cervos?|madoka)\b/, health: 45, attack: 3, speed: 0.32, width: 0.9, height: 1.7, ability: "energia positiva: cura e limpa efeitos ruins", big: false },
  bull: { pt: "Boi Perfurante", article: "o", sound: "*bufada*", alias: /\b(boi perfurante|bois?|touros?)\b/, health: 70, attack: 9, speed: 0.3, width: 1.4, height: 1.6, ability: "investida em linha reta, mais forte quanto maior a distância", big: true },
  tiger: { pt: "Funeral do Tigre", article: "o", sound: "*rosnado*", alias: /\b(funeral do tigre|tigres?)\b/, health: 60, attack: 9, speed: 0.36, width: 1.1, height: 1.2, ability: "bote fúnebre (habilidade original do mod)", big: true },
  lion: { pt: "Leão de Sombra (original)", article: "o", sound: "*rugido*", alias: /\b(leoes|leao)\b/, health: 70, attack: 8, speed: 0.33, width: 1.2, height: 1.4, ability: "criação original: rugido que enfraquece", big: true },
  dragon: { pt: "Dragão de Sombra (original)", article: "o", sound: "*rugido profundo*", alias: /\b(dragoes|dragao)\b/, health: 140, attack: 12, speed: 0.3, width: 2.4, height: 2.6, ability: "criação original: sopro de fogo sombrio", big: true },
  colossus: { pt: "Mahoraga", article: "o", sound: "*a roda gira*", alias: /\b(mahoraga|general divino|colossos?|gigantes?)\b/, health: 220, attack: 15, speed: 0.27, width: 1.6, height: 3.4, ability: "adapta-se a cada tipo de ataque (a roda gira); espada de energia positiva", big: true },
  dog_white: { pt: "Cão Divino Branco", article: "o", sound: "*uivo*", alias: /\b(cao divino branco|cachorro branco|lobo branco|cao branco)\b/, health: 30, attack: 5, speed: 0.38, width: 0.7, height: 0.9, ability: "fareja e rastreia inimigos, mordida que prende", big: false },
  totality: { pt: "Cão Divino: Totalidade", article: "o", sound: "*uivo profundo*", alias: /\b(totalidade|cao divino totalidade)\b/, health: 80, attack: 11, speed: 0.37, width: 1.2, height: 1.5, ability: "herdou o poder do cão destruído: rastreia e despedaça", big: true },
};

/** Most specific names first ("cão divino branco" before the generic "cão"). */
const MATCH_ORDER: BeastSpecies[] = ["totality", "dog_white", "wolf", "owl", "serpent", "toad", "elephant", "rabbit", "deer", "bull", "tiger", "colossus", "lion", "dragon"];
export function beastFromText(s: string): BeastSpecies | undefined {
  for (const b of MATCH_ORDER) if (BEAST_INFO[b].alias.test(s)) return b;
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
