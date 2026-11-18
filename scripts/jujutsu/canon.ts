/**
 * Jujutsu Kaisen data for the Ten Shadows add-on (pure module, no Minecraft imports).
 * Every entry says where it comes from:
 *   "canon"     confirmed in the anime/manga
 *   "incerto"   detail the work does not state clearly (the mod picked an interpretation)
 *   "original"  created for the mod (Forja de Sombras, game effects, Mahoraga taming route)
 * Research notes and sources: documentation/PESQUISA_JJK.md
 */
import type { BeastSpecies } from "../core/species";

export type Origin = "canon" | "incerto" | "original";
export const ORIGIN_TAG: Record<Origin, string> = { canon: "§a[cânone]§r", incerto: "§e[interpretação]§r", original: "§d[original do mod]§r" };

export interface ShikigamiInfo {
  name: string;
  origin: Origin;            // the shikigami itself
  abilityOrigin: Origin;     // the in-game ability
  cost: number;              // cursed energy to summon (ritual costs the same)
  mastery: number;           // technique mastery level needed for the exorcism ritual
  start?: boolean;           // available from the beginning
  ritual?: boolean;          // obtained through an exorcism ritual
  inherited?: boolean;       // only obtained by inheritance (Totality)
  freeMode?: boolean;        // original creation: only in Modo Livre
  lore: string;
}

/** Menu order. */
export const SHIKIGAMI_ORDER: BeastSpecies[] = ["wolf", "dog_white", "owl", "toad", "serpent", "rabbit", "elephant", "deer", "bull", "tiger", "totality", "colossus", "lion", "dragon"];

export const SHIKIGAMI: Record<BeastSpecies, ShikigamiInfo> = {
  wolf: { name: "Cão Divino Preto", origin: "canon", abilityOrigin: "canon", cost: 15, mastery: 0, start: true,
    lore: "Um dos Cães Divinos, o primeiro shikigami de quem herda as Dez Sombras. Faro e rastreamento." },
  dog_white: { name: "Cão Divino Branco", origin: "canon", abilityOrigin: "canon", cost: 15, mastery: 0, start: true,
    lore: "O par branco dos Cães Divinos. Se um dos cães for destruído, o outro herda o seu poder." },
  owl: { name: "Nue", origin: "canon", abilityOrigin: "canon", cost: 25, mastery: 0, ritual: true,
    lore: "Shikigami alado com descargas elétricas. Dá mobilidade aérea ao usuário." },
  toad: { name: "Sapo", origin: "canon", abilityOrigin: "incerto", cost: 20, mastery: 0, ritual: true,
    lore: "Prende e puxa alvos com a língua. O resgate do dono é uma interpretação do mod." },
  serpent: { name: "Grande Serpente", origin: "canon", abilityOrigin: "canon", cost: 35, mastery: 1, ritual: true,
    lore: "Serpente enorme que emerge da sombra para morder e prender." },
  rabbit: { name: "Fuga dos Coelhos", origin: "canon", abilityOrigin: "canon", cost: 25, mastery: 1, ritual: true,
    lore: "Uma multidão de coelhos para distrair e cobrir a visão. Força individual quase nula." },
  elephant: { name: "Elefante Máximo", origin: "canon", abilityOrigin: "canon", cost: 60, mastery: 2, ritual: true,
    lore: "Invocação pesada que despeja grandes volumes de água. Custo de energia alto." },
  deer: { name: "Veado Redondo", origin: "canon", abilityOrigin: "incerto", cost: 45, mastery: 2, ritual: true,
    lore: "Usa energia positiva (técnica reversa) para curar. 'Limpar efeitos' representa no jogo a anulação de técnicas." },
  bull: { name: "Boi Perfurante", origin: "canon", abilityOrigin: "canon", cost: 40, mastery: 2, ritual: true,
    lore: "Só investe em linha reta, e o golpe fica mais forte quanto maior a distância percorrida." },
  tiger: { name: "Funeral do Tigre", origin: "canon", abilityOrigin: "original", cost: 45, mastery: 3, ritual: true,
    lore: "O cânone mostra pouco das capacidades próprias dele. O 'Bote Fúnebre' é uma habilidade criada para o mod." },
  totality: { name: "Cão Divino: Totalidade", origin: "canon", abilityOrigin: "canon", cost: 55, mastery: 0, inherited: true,
    lore: "Surge quando um Cão Divino é destruído e o outro herda o seu poder. Maior e muito mais forte." },
  colossus: { name: "Mahoraga", origin: "canon", abilityOrigin: "incerto", cost: 150, mastery: 5, ritual: true,
    lore: "General Divino Mahoraga. Adapta-se a qualquer fenômeno: a roda gira a cada adaptação. Espada imbuída de energia positiva. " +
      "No cânone Megumi NUNCA o dominou (só Sukuna, usando o corpo de Megumi). Vencer o ritual e domá-lo aqui é uma rota ORIGINAL do mod." },
  lion: { name: "Leão de Sombra", origin: "original", abilityOrigin: "original", cost: 40, mastery: 0, freeMode: true,
    lore: "Criação da Forja de Sombras (Modo Livre). Não é um shikigami das Dez Sombras." },
  dragon: { name: "Dragão de Sombra", origin: "original", abilityOrigin: "original", cost: 60, mastery: 0, freeMode: true,
    lore: "Criação da Forja de Sombras (Modo Livre). Não é um shikigami das Dez Sombras." },
};

/** Mastery level from experience (0..10). */
export function masteryLevel(xp: number): number {
  return Math.max(0, Math.min(10, Math.floor(xp / 150)));
}
export function maxEnergy(xp: number): number {
  return 100 + 25 * masteryLevel(xp);
}
export function energyRegen(xp: number): number {
  return 2 + 0.5 * masteryLevel(xp);
}
/** Shikigami that can be on the field at the same time. */
export function shikigamiLimit(xp: number): number {
  return 3 + masteryLevel(xp);
}
export function blackFlashChance(xp: number): number {
  const lv = masteryLevel(xp);
  return lv < 1 ? 0 : Math.min(0.15, 0.04 + 0.01 * lv);
}

export interface ManualPage { title: string; text: string; }
export const MANUAL: ManualPage[] = [
  { title: "Como começar", text: "Ao entrar pela primeira vez, a §5roleta de clã§r gira sozinha e sorteia seu clã e sua técnica inata. Use o §5Grimório Jujutsu§r (toque e segure) para abrir tudo. Agachar + usar o Grimório solta a sua §fhabilidade rápida§r." },
  { title: "Clãs e roleta", text: "Gojo (lendário, 3%), Zenin (raro, 22%: Dez Sombras, Projeção ou Restrição Celestial), Kamo (18%), Inumaki (12%) e sem clã (45%: Boneco de Palha, Boogie Woogie, Proporção ou Construção). Você ganha 1 giro extra a cada nível de domínio e pode girar de novo em 'Clã e roleta'." },
  { title: "Energia e Vigor", text: "Técnicas gastam §denergia amaldiçoada§r, que recarrega sozinha. Os Seis Olhos (Gojo) cortam o custo pela metade. Quem tem §6Restrição Celestial§r não tem energia: usa §6Vigor§r, tem um corpo sobre-humano e bate muito mais forte com ferramentas amaldiçoadas." },
  { title: "Habilidades", text: "Ativas: toque para usar. Alternáveis: ficam ligadas gastando energia por segundo. Passivas: funcionam sozinhas (Black Flash). Expansão de Domínio: Vazio Infinito (Gojo), Jardim Sombrio da Quimera (Dez Sombras) e Santuário Malevolente (receptáculo de Sukuna). As outras técnicas não têm domínio conhecido na obra." },
  { title: "Dez Sombras e rituais", text: "Quem herdou as Dez Sombras começa com os Cães Divinos. Os outros shikigamis vêm por ritual de exorcismo: vença-os sozinho. No Modo Cânone, shikigami destruído não volta e o poder é herdado (Totalidade). Mahoraga adapta-se a cada tipo de dano." },
  { title: "Dedos de Sukuna", text: "São 20 por mundo e caem raramente de inimigos. Comer um dedo é perigoso: no mod há 25% de chance de virar receptáculo (Santuário: Desmantelar, Clivar, Fuga, Santuário Malevolente). A influência de Sukuna cresce a cada dedo; com influência alta ele pode assumir seu corpo por alguns segundos. Medite para empurrá-lo de volta." },
  { title: "Arsenal", text: "Forje pelo Grimório (sem bancada): Nuvem Brincalhona, Lança Invertida do Céu, Katana Alma Dividida, Osso de Dragão, Demônio Matador, uniformes de Tóquio e Kyoto, a venda preta e o xarope para garganta. Fragmentos Amaldiçoados caem de inimigos derrotados." },
  { title: "Fala Amaldiçoada", text: "Cada ordem enche a barra da garganta. Passar de 100% machuca você (o contragolpe da técnica). Ela se recupera sozinha; o Xarope para Garganta alivia na hora." },
  { title: "Cânone ou criação do mod?", text: "§a[cânone]§r confirmado na obra. §e[interpretação]§r a obra não deixa claro e o mod escolheu um jeito. §d[original do mod]§r criado aqui (por exemplo: números de dano, chance da roleta, chance de virar receptáculo, possessão). Fontes em documentation/PESQUISA_JJK.md. Mod de fã, sem ligação oficial com Jujutsu Kaisen (Gege Akutami/Shueisha)." },
];
