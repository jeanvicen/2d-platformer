/**
 * Clans, innate techniques and abilities (pure data). Every entry carries its origin:
 * "canon" (confirmed in Jujutsu Kaisen), "incerto" (interpretation) or "original" (made for the mod).
 * Research and sources: documentation/PESQUISA_JJK.md
 */
import type { Origin } from "./canon";

export type ClanId = "gojo" | "zenin" | "kamo" | "inumaki" | "none";
export type TechId = "limitless" | "ten_shadows" | "projection" | "heavenly" | "blood" | "speech" | "straw_doll" | "boogie" | "ratio" | "construction";
export type AbilityKind = "ativa" | "alternavel" | "passiva" | "dominio";
export type Rgb = { red: number; green: number; blue: number };

export interface ClanInfo {
  id: ClanId;
  name: string;
  rarity: "Lendário" | "Raro" | "Incomum" | "Comum";
  tag: string;            // § color
  weight: number;         // roulette weight (sum = 100)
  techs: { tech: TechId; weight: number }[];
  desc: string;
  origin: Origin;
}

export interface TechInfo {
  id: TechId | "shrine";
  name: string;
  origin: Origin;
  color: Rgb;
  desc: string;
  abilities: string[];
  domain?: string;
  noEnergy?: boolean;     // Heavenly Restriction: no cursed energy (uses Vigor)
}

export interface AbilityInfo {
  id: string;
  name: string;
  kind: AbilityKind;
  cost: number;
  drain: number;          // per second (toggles)
  cooldown: number;       // seconds
  mastery: number;
  fingers?: number;       // Sukuna's fingers eaten (Shrine)
  hp?: number;            // health it costs (Blood Manipulation)
  throat?: number;        // throat strain (Cursed Speech)
  origin: Origin;
  effectOrigin: Origin;
  desc: string;
  icon: string;           // generated icon name (textures/ui/shadowbound/a_<icon>)
}

export const CLANS: Record<ClanId, ClanInfo> = {
  gojo: { id: "gojo", name: "Gojo", rarity: "Lendário", tag: "§b", weight: 3, origin: "canon",
    techs: [{ tech: "limitless", weight: 1 }],
    desc: "Um dos Três Grandes Clãs. O Ilimitado junto com os Seis Olhos é raríssimo." },
  zenin: { id: "zenin", name: "Zenin", rarity: "Raro", tag: "§2", weight: 22, origin: "canon",
    techs: [{ tech: "ten_shadows", weight: 40 }, { tech: "projection", weight: 35 }, { tech: "heavenly", weight: 25 }],
    desc: "Um dos Três Grandes Clãs. Valoriza as técnicas herdadas: Dez Sombras e Feitiçaria de Projeção. Nem todo membro tem a mesma técnica." },
  kamo: { id: "kamo", name: "Kamo", rarity: "Incomum", tag: "§c", weight: 18, origin: "canon",
    techs: [{ tech: "blood", weight: 1 }],
    desc: "Um dos Três Grandes Clãs. Técnica herdada: Manipulação de Sangue." },
  inumaki: { id: "inumaki", name: "Inumaki", rarity: "Incomum", tag: "§5", weight: 12, origin: "canon",
    techs: [{ tech: "speech", weight: 1 }],
    desc: "Família da Fala Amaldiçoada. Não é um dos Três Grandes Clãs." },
  none: { id: "none", name: "Sem clã", rarity: "Comum", tag: "§f", weight: 45, origin: "original",
    techs: [{ tech: "straw_doll", weight: 30 }, { tech: "boogie", weight: 25 }, { tech: "ratio", weight: 25 }, { tech: "construction", weight: 20 }],
    desc: "Feiticeiro(a) sem clã famoso, com uma técnica inata própria. (Agrupar essas técnicas como 'sem clã' é uma escolha do mod.)" },
};
export const CLAN_ORDER: ClanId[] = ["gojo", "zenin", "kamo", "inumaki", "none"];

export const TECHS: Record<TechId | "shrine", TechInfo> = {
  limitless: { id: "limitless", name: "Ilimitado + Seis Olhos", origin: "canon", color: { red: 0.35, green: 0.75, blue: 1 },
    desc: "Controla o espaço com o infinito. Os Seis Olhos reduzem o gasto de energia pela metade.", abilities: ["infinito", "azul", "vermelho", "roxo"], domain: "vazio" },
  ten_shadows: { id: "ten_shadows", name: "Técnica das Dez Sombras", origin: "canon", color: { red: 0.55, green: 0.35, blue: 1 },
    desc: "Invoca shikigamis da própria sombra. Os outros shikigamis vêm por ritual de exorcismo.", abilities: ["mergulho", "guardar"], domain: "dominio" },
  projection: { id: "projection", name: "Feitiçaria de Projeção", origin: "canon", color: { red: 0.4, green: 1, blue: 0.75 },
    desc: "Divide um segundo em 24 quadros e move o corpo seguindo o movimento planejado. Quem é tocado e falha na regra fica congelado num quadro.", abilities: ["quadros", "aceleracao", "quadro_congelado"] },
  heavenly: { id: "heavenly", name: "Restrição Celestial", origin: "canon", color: { red: 1, green: 0.85, blue: 0.4 }, noEnergy: true,
    desc: "Sem energia amaldiçoada, mas com um físico sobre-humano. Usa Vigor em vez de energia e é muito mais forte com ferramentas amaldiçoadas.", abilities: ["investida_celestial", "salto_celestial"] },
  blood: { id: "blood", name: "Manipulação de Sangue", origin: "canon", color: { red: 0.9, green: 0.1, blue: 0.15 },
    desc: "Controla o próprio sangue: disparos, explosões, amarras e reforço do corpo. Cada uso custa um pouco de vida.", abilities: ["sangue_perfurante", "amarracao", "supernova", "escamas"] },
  speech: { id: "speech", name: "Fala Amaldiçoada", origin: "canon", color: { red: 0.7, green: 0.4, blue: 1 },
    desc: "Palavras carregadas de energia viram ordens. Ordens fortes machucam a garganta de quem fala.", abilities: ["nao_se_mexa", "exploda", "durma", "esmague"] },
  straw_doll: { id: "straw_doll", name: "Técnica do Boneco de Palha", origin: "canon", color: { red: 1, green: 0.6, blue: 0.2 },
    desc: "Pregos, martelo e um boneco de palha: marca o alvo com pregos e o atinge pela ressonância.", abilities: ["pregos", "ressonancia", "grampo"] },
  boogie: { id: "boogie", name: "Boogie Woogie", origin: "canon", color: { red: 1, green: 0.85, blue: 0.3 },
    desc: "Com uma palma, troca de lugar quem tem energia amaldiçoada no alcance.", abilities: ["palmas", "troca_confusa"] },
  ratio: { id: "ratio", name: "Técnica de Proporção", origin: "canon", color: { red: 0.95, green: 0.9, blue: 0.6 },
    desc: "Divide o alvo em 10 partes: um golpe no ponto 7:3 vira um crítico garantido.", abilities: ["golpe_73", "hora_extra", "colapso"] },
  construction: { id: "construction", name: "Construção", origin: "canon", color: { red: 0.6, green: 0.8, blue: 1 },
    desc: "Cria matéria do nada a partir de energia amaldiçoada, com um custo enorme.", abilities: ["criar_municao", "criar_lamina", "criar_escudo"] },
  shrine: { id: "shrine", name: "Santuário (Sukuna)", origin: "canon", color: { red: 0.95, green: 0.2, blue: 0.25 },
    desc: "A técnica do Rei das Maldições, liberada ao virar receptáculo comendo os dedos de Sukuna.", abilities: ["desmantelar", "clivar", "fuga"], domain: "santuario" },
};

const A = (a: AbilityInfo) => a;
export const ABILITIES: Record<string, AbilityInfo> = Object.fromEntries([
  // ---- general (every sorcerer except Heavenly Restriction) ----
  A({ id: "reforco", name: "Reforço com Energia", kind: "alternavel", cost: 0, drain: 1, cooldown: 0, mastery: 0, origin: "canon", effectOrigin: "original", icon: "reforco",
    desc: "Energia envolvendo o corpo: mais força e velocidade enquanto ligado." }),
  A({ id: "kokusen", name: "Black Flash", kind: "passiva", cost: 0, drain: 0, cooldown: 0, mastery: 1, origin: "canon", effectOrigin: "incerto", icon: "kokusen",
    desc: "Chance de uma distorção de 0,000001 s no golpe: dano enorme e energia de volta." }),
  A({ id: "dominio_simples", name: "Domínio Simples", kind: "alternavel", cost: 0, drain: 2, cooldown: 0, mastery: 3, origin: "canon", effectOrigin: "original", icon: "dominio_simples",
    desc: "Barreira pequena que neutraliza acertos garantidos: resistência e limpeza de efeitos ruins." }),
  A({ id: "rct", name: "Técnica Reversa", kind: "ativa", cost: 50, drain: 0, cooldown: 20, mastery: 4, origin: "canon", effectOrigin: "original", icon: "rct",
    desc: "Energia negativa × negativa = positiva: cura o próprio corpo." }),
  // ---- Limitless ----
  A({ id: "infinito", name: "Infinito", kind: "alternavel", cost: 0, drain: 3, cooldown: 0, mastery: 0, origin: "canon", effectOrigin: "incerto", icon: "infinito",
    desc: "O espaço entre você e o inimigo nunca acaba: quase nada te atinge e quem chega perto é afastado." }),
  A({ id: "azul", name: "Azul (Atração)", kind: "ativa", cost: 25, drain: 0, cooldown: 6, mastery: 0, origin: "canon", effectOrigin: "original", icon: "azul",
    desc: "Um ponto de atração puxa e esmaga os inimigos ao redor." }),
  A({ id: "vermelho", name: "Vermelho Reverso", kind: "ativa", cost: 35, drain: 0, cooldown: 8, mastery: 1, origin: "canon", effectOrigin: "original", icon: "vermelho",
    desc: "Repulsão: uma explosão que arremessa tudo à frente." }),
  A({ id: "roxo", name: "Roxo Oco", kind: "ativa", cost: 80, drain: 0, cooldown: 30, mastery: 3, origin: "canon", effectOrigin: "original", icon: "roxo",
    desc: "Azul + Vermelho: uma massa imaginária que apaga tudo na linha. (No mod não destrói blocos.)" }),
  A({ id: "vazio", name: "Expansão de Domínio: Vazio Infinito", kind: "dominio", cost: 150, drain: 0, cooldown: 150, mastery: 5, origin: "canon", effectOrigin: "original", icon: "vazio",
    desc: "Informação infinita: todos os inimigos no domínio ficam paralisados por 10 s." }),
  // ---- Ten Shadows (shikigami live in their own tab) ----
  A({ id: "mergulho", name: "Mergulho nas Sombras", kind: "ativa", cost: 15, drain: 0, cooldown: 4, mastery: 1, origin: "canon", effectOrigin: "incerto", icon: "mergulho",
    desc: "Afunda na sombra e sai no ponto para onde você olha (16 blocos)." }),
  A({ id: "guardar", name: "Armazenar na Sombra", kind: "ativa", cost: 5, drain: 0, cooldown: 0, mastery: 0, origin: "canon", effectOrigin: "original", icon: "guardar",
    desc: "Guarda o item da mão dentro da sombra (9 pilhas)." }),
  A({ id: "dominio", name: "Expansão de Domínio: Jardim Sombrio da Quimera", kind: "dominio", cost: 120, drain: 0, cooldown: 120, mastery: 6, origin: "canon", effectOrigin: "original", icon: "jardim",
    desc: "Domínio incompleto: chão de sombras, inimigos lentos e cegos, shikigamis mais fortes, invocar custa metade." }),
  // ---- Projection ----
  A({ id: "quadros", name: "Investida de 24 Quadros", kind: "ativa", cost: 20, drain: 0, cooldown: 3, mastery: 0, origin: "canon", effectOrigin: "original", icon: "quadros",
    desc: "Avança 8 blocos em quadros; quem estiver no caminho fica congelado." }),
  A({ id: "aceleracao", name: "Aceleração", kind: "alternavel", cost: 0, drain: 2, cooldown: 0, mastery: 1, origin: "canon", effectOrigin: "original", icon: "aceleracao",
    desc: "Cada movimento fica mais rápido que o anterior: velocidade e pressa." }),
  A({ id: "quadro_congelado", name: "Quadro Congelado", kind: "ativa", cost: 30, drain: 0, cooldown: 10, mastery: 2, origin: "canon", effectOrigin: "original", icon: "quadro_congelado",
    desc: "Toca o alvo: ele falha na regra dos 24 quadros e fica preso num quadro." }),
  // ---- Heavenly Restriction ----
  A({ id: "investida_celestial", name: "Investida Celestial", kind: "ativa", cost: 20, drain: 0, cooldown: 4, mastery: 0, origin: "canon", effectOrigin: "original", icon: "investida",
    desc: "Disparada de força bruta até o inimigo com um golpe devastador." }),
  A({ id: "salto_celestial", name: "Salto Celestial", kind: "ativa", cost: 15, drain: 0, cooldown: 3, mastery: 1, origin: "canon", effectOrigin: "original", icon: "salto",
    desc: "Um salto impossível para um corpo comum." }),
  // ---- Blood Manipulation ----
  A({ id: "sangue_perfurante", name: "Sangue Perfurante", kind: "ativa", cost: 30, drain: 0, cooldown: 6, mastery: 0, hp: 2, origin: "canon", effectOrigin: "original", icon: "sangue_perfurante",
    desc: "Comprime o sangue e dispara um raio que atravessa a linha." }),
  A({ id: "amarracao", name: "Amarração Carmesim", kind: "ativa", cost: 20, drain: 0, cooldown: 8, mastery: 1, hp: 1, origin: "canon", effectOrigin: "original", icon: "amarracao",
    desc: "Fios de sangue prendem o alvo." }),
  A({ id: "supernova", name: "Supernova", kind: "ativa", cost: 40, drain: 0, cooldown: 12, mastery: 2, hp: 2, origin: "canon", effectOrigin: "original", icon: "supernova",
    desc: "Esferas de sangue ao seu redor explodem em todas as direções." }),
  A({ id: "escamas", name: "Escamas Vermelhas Fluentes", kind: "alternavel", cost: 0, drain: 2, cooldown: 0, mastery: 0, origin: "canon", effectOrigin: "original", icon: "escamas",
    desc: "Acelera o sangue no corpo: força, velocidade e resistência." }),
  // ---- Cursed Speech ----
  A({ id: "nao_se_mexa", name: "\"Não se mexa\"", kind: "ativa", cost: 20, drain: 0, cooldown: 6, mastery: 0, throat: 15, origin: "canon", effectOrigin: "original", icon: "fala",
    desc: "Todos os inimigos perto param no lugar." }),
  A({ id: "exploda", name: "\"Exploda\"", kind: "ativa", cost: 30, drain: 0, cooldown: 8, mastery: 1, throat: 25, origin: "canon", effectOrigin: "original", icon: "exploda",
    desc: "Os inimigos perto são arremessados com força." }),
  A({ id: "durma", name: "\"Durma\"", kind: "ativa", cost: 25, drain: 0, cooldown: 10, mastery: 2, throat: 20, origin: "canon", effectOrigin: "original", icon: "durma",
    desc: "Os inimigos perto caem num sono pesado." }),
  A({ id: "esmague", name: "\"Esmague\"", kind: "ativa", cost: 45, drain: 0, cooldown: 15, mastery: 3, throat: 40, origin: "canon", effectOrigin: "original", icon: "esmague",
    desc: "Uma ordem fortíssima contra um único alvo." }),
  // ---- Straw Doll ----
  A({ id: "pregos", name: "Pregos", kind: "ativa", cost: 10, drain: 0, cooldown: 1.5, mastery: 0, origin: "canon", effectOrigin: "original", icon: "pregos",
    desc: "Martela pregos carregados de energia no alvo e o marca." }),
  A({ id: "ressonancia", name: "Ressonância", kind: "ativa", cost: 30, drain: 0, cooldown: 8, mastery: 1, origin: "canon", effectOrigin: "original", icon: "ressonancia",
    desc: "Martela o boneco de palha: todos os alvos marcados sofrem o golpe." }),
  A({ id: "grampo", name: "Grampo", kind: "ativa", cost: 25, drain: 0, cooldown: 6, mastery: 2, origin: "canon", effectOrigin: "original", icon: "grampo",
    desc: "Os pregos cravados explodem." }),
  // ---- Boogie Woogie ----
  A({ id: "palmas", name: "Palma (Troca)", kind: "ativa", cost: 10, drain: 0, cooldown: 1, mastery: 0, origin: "canon", effectOrigin: "original", icon: "palmas",
    desc: "Bate palma e troca de lugar com o alvo." }),
  A({ id: "troca_confusa", name: "Troca Confusa", kind: "ativa", cost: 20, drain: 0, cooldown: 6, mastery: 1, origin: "canon", effectOrigin: "original", icon: "troca",
    desc: "Troca de lugar e deixa os inimigos perto desnorteados." }),
  // ---- Ratio ----
  A({ id: "golpe_73", name: "Golpe 7:3", kind: "ativa", cost: 15, drain: 0, cooldown: 5, mastery: 0, origin: "canon", effectOrigin: "original", icon: "golpe_73",
    desc: "O próximo golpe corpo a corpo (6 s) acerta o ponto fraco: dano triplo." }),
  A({ id: "hora_extra", name: "Hora Extra", kind: "alternavel", cost: 0, drain: 1, cooldown: 0, mastery: 2, origin: "canon", effectOrigin: "original", icon: "hora_extra",
    desc: "Voto de restrição de quem passou do horário: força muito maior." }),
  A({ id: "colapso", name: "Colapso", kind: "ativa", cost: 50, drain: 0, cooldown: 20, mastery: 3, origin: "canon", effectOrigin: "original", icon: "colapso",
    desc: "A proporção aplicada ao ambiente: tudo à frente desaba sobre os inimigos. (No mod não destrói blocos.)" }),
  // ---- Construction ----
  A({ id: "criar_municao", name: "Criar Munição", kind: "ativa", cost: 20, drain: 0, cooldown: 5, mastery: 0, origin: "canon", effectOrigin: "original", icon: "municao",
    desc: "Cria 8 flechas a partir de energia." }),
  A({ id: "criar_lamina", name: "Criar Lâmina", kind: "ativa", cost: 35, drain: 0, cooldown: 30, mastery: 1, origin: "canon", effectOrigin: "original", icon: "lamina",
    desc: "Cria uma espada de ferro." }),
  A({ id: "criar_escudo", name: "Criar Escudo", kind: "ativa", cost: 30, drain: 0, cooldown: 30, mastery: 2, origin: "canon", effectOrigin: "original", icon: "escudo",
    desc: "Cria um escudo." }),
  // ---- Shrine (Sukuna's vessel) ----
  A({ id: "desmantelar", name: "Desmantelar", kind: "ativa", cost: 25, drain: 0, cooldown: 3, mastery: 0, fingers: 1, origin: "canon", effectOrigin: "original", icon: "desmantelar",
    desc: "Um corte invisível que voa em linha reta." }),
  A({ id: "clivar", name: "Clivar", kind: "ativa", cost: 35, drain: 0, cooldown: 6, mastery: 0, fingers: 3, origin: "canon", effectOrigin: "incerto", icon: "clivar",
    desc: "Corte que se ajusta à resistência do alvo: quanto mais vida ele tem, maior o dano." }),
  A({ id: "fuga", name: "Fuga (\"Abrir\")", kind: "ativa", cost: 80, drain: 0, cooldown: 25, mastery: 0, fingers: 10, origin: "canon", effectOrigin: "incerto", icon: "fuga",
    desc: "Uma flecha de fogo que explode em chamas." }),
  A({ id: "santuario", name: "Expansão de Domínio: Santuário Malevolente", kind: "dominio", cost: 160, drain: 0, cooldown: 160, mastery: 0, fingers: 15, origin: "canon", effectOrigin: "original", icon: "santuario",
    desc: "Domínio sem barreira: cortes contínuos em todos os inimigos ao redor por 8 s." }),
].map((a) => [a.id, a]));

export const GENERAL = ["reforco", "kokusen", "dominio_simples", "rct"];

/** Weighted roulette: clan, then technique inside the clan. `rand` returns [0,1). */
export function rollClan(rand: () => number = Math.random): { clan: ClanId; tech: TechId } {
  const total = CLAN_ORDER.reduce((s, c) => s + CLANS[c].weight, 0);
  let x = rand() * total;
  let clan: ClanId = "none";
  for (const c of CLAN_ORDER) {
    x -= CLANS[c].weight;
    if (x < 0) {
      clan = c;
      break;
    }
  }
  const techs = CLANS[clan].techs;
  const tt = techs.reduce((s, t) => s + t.weight, 0);
  let y = rand() * tt;
  let tech = techs[techs.length - 1].tech;
  for (const t of techs) {
    y -= t.weight;
    if (y < 0) {
      tech = t.tech;
      break;
    }
  }
  return { clan, tech };
}

export function clanOfTech(t: TechId): ClanId {
  for (const c of CLAN_ORDER) if (CLANS[c].techs.some((x) => x.tech === t)) return c;
  return "none";
}
