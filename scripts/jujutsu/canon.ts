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

export type TechCategory = "passiva" | "ativa" | "alternavel" | "suprema";
export const CATEGORY_PT: Record<TechCategory, string> = { passiva: "Passiva", ativa: "Ativa", alternavel: "Alternável", suprema: "Suprema" };

export interface TechniqueInfo {
  id: string;
  name: string;
  cat: TechCategory;
  origin: Origin;      // the concept
  effectOrigin: Origin; // how it plays in Minecraft
  cost: number;        // instant cost
  drain: number;       // per second while on (toggles)
  cooldown: number;    // seconds
  mastery: number;
  desc: string;
}

export const TECHNIQUES: TechniqueInfo[] = [
  { id: "reforco", name: "Reforço com Energia Amaldiçoada", cat: "alternavel", origin: "canon", effectOrigin: "original", cost: 0, drain: 1, cooldown: 0, mastery: 0,
    desc: "Envolve o corpo com energia: mais força e velocidade enquanto ligado. Gasta 1 de energia por segundo." },
  { id: "kokusen", name: "Black Flash (Kokusen)", cat: "passiva", origin: "canon", effectOrigin: "incerto", cost: 0, drain: 0, cooldown: 0, mastery: 1,
    desc: "Ao acertar um golpe corpo a corpo, pequena chance de uma distorção que multiplica o dano. No cânone o dano sobe à potência de 2,5; no jogo é dano extra grande. Também devolve energia (o 'estado de zona')." },
  { id: "guardar", name: "Armazenar na Sombra", cat: "ativa", origin: "canon", effectOrigin: "original", cost: 5, drain: 0, cooldown: 0, mastery: 0,
    desc: "Guarda o item da sua mão dentro da sua sombra (até 9 pilhas) e tira de volta quando quiser." },
  { id: "mergulho", name: "Mergulho nas Sombras", cat: "ativa", origin: "canon", effectOrigin: "incerto", cost: 15, drain: 0, cooldown: 4, mastery: 1,
    desc: "Afunda na própria sombra e reaparece no ponto para onde você olha (até 16 blocos)." },
  { id: "dominio_simples", name: "Domínio Simples", cat: "alternavel", origin: "canon", effectOrigin: "original", cost: 0, drain: 2, cooldown: 0, mastery: 3,
    desc: "Uma pequena barreira que neutraliza ataques garantidos. No jogo: resistência e remoção de efeitos ruins enquanto ligado. 2 de energia por segundo." },
  { id: "rct", name: "Técnica Reversa", cat: "ativa", origin: "canon", effectOrigin: "original", cost: 50, drain: 0, cooldown: 20, mastery: 4,
    desc: "Multiplica energia negativa por negativa e gera energia positiva para curar o próprio corpo." },
  { id: "dominio", name: "Expansão de Domínio: Jardim Sombrio da Quimera", cat: "suprema", origin: "canon", effectOrigin: "original", cost: 120, drain: 0, cooldown: 120, mastery: 6,
    desc: "Domínio incompleto de Megumi: o chão vira sombra por 30 s. Inimigos ficam lentos e cegos; seus shikigamis ficam mais fortes e invocar custa metade." },
];

export interface ClanInfo { name: string; techniques: string; implemented: string; }
export const CLANS: ClanInfo[] = [
  { name: "Zenin", techniques: "Técnica das Dez Sombras; Feitiçaria de Projeção (nem todo membro tem a mesma técnica)", implemented: "Dez Sombras: jogável. Projeção: ainda não." },
  { name: "Gojo", techniques: "Técnica do Ilimitado e os Seis Olhos (raros, nascem juntos poucas vezes)", implemented: "Ainda não implementado." },
  { name: "Kamo", techniques: "Manipulação de Sangue", implemented: "Ainda não implementado." },
  { name: "Inumaki", techniques: "Fala Amaldiçoada", implemented: "Ainda não implementado." },
];

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
  { title: "Como começar", text: "Você herdou a Técnica das Dez Sombras (clã Zenin). Use o §dSelo das Dez Sombras§r para abrir tudo. No começo só os §fCães Divinos§r obedecem a você. Os outros shikigamis precisam ser vencidos num §fritual de exorcismo§r." },
  { title: "Energia amaldiçoada", text: "Toda invocação e técnica gasta energia amaldiçoada. Ela se recupera sozinha (mais rápido conforme o seu domínio). Segure o Selo para ver a barra. O domínio sobe ao vencer rituais, usar técnicas e quando suas invocações derrotam inimigos." },
  { title: "Rituais de exorcismo", text: "Escolha um shikigami bloqueado e toque em 'Iniciar ritual'. Ele aparece SELVAGEM e ataca você. Vença-o usando você e seus próprios shikigamis. Se outra pessoa ou suas companheiras atacarem, o ritual é anulado. Se você morrer, se afastar ou passar 5 minutos, o ritual falha." },
  { title: "Destruição e herança", text: "§fModo Cânone§r (padrão): um shikigami destruído não volta mais. O poder dele é herdado: se um Cão Divino for destruído, o outro vira §fCão Divino: Totalidade§r. Outros shikigamis destruídos fortalecem os que restam. No §fModo Livre§r eles voltam depois de um tempo." },
  { title: "Mahoraga", text: "General Divino Mahoraga só vem por ritual e exige domínio 5 e 150 de energia. A roda gira a cada golpe de um mesmo tipo; depois de 4 giros ele se ADAPTA e ignora aquele tipo de dano. Mude de ataque! Megumi nunca o dominou no cânone: domá-lo aqui é uma rota original do mod." },
  { title: "Técnicas", text: "Na aba Técnicas e Habilidades: Passivas funcionam sozinhas, Ativas têm botão, Alternáveis ficam ligadas gastando energia, e a Suprema (Expansão de Domínio) exige domínio 6." },
  { title: "Ordens", text: "Cada shikigami aceita: seguir, ficar de guarda, proteger você, procurar inimigos e voltar à sombra. Você também pode digitar: §f/sombra invocar nue§r, §f/sombra ritual sapo§r, §f/sombra dominio§r, §f/sombra energia§r." },
  { title: "Companheiras", text: "Luna, Raven, Sora, Yuki, Hana e Aiko são feiticeiras ORIGINAIS do mod (não são personagens da obra). Elas coletam, constroem, cozinham e lutam ao seu lado. Use 'Esquadrão' no Selo." },
  { title: "Cânone ou criação do mod?", text: "§a[cânone]§r confirmado na obra. §e[interpretação]§r a obra não deixa claro e o mod escolheu um jeito. §d[original do mod]§r criado aqui. Os detalhes e as fontes estão em documentation/PESQUISA_JJK.md. Mod de fã, sem ligação oficial com Jujutsu Kaisen (Gege Akutami/Shueisha)." },
];
