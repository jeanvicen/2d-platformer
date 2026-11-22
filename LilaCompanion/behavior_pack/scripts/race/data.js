// Raças, pesos da roleta e números de equilíbrio — TUDO num lugar só (nada de número mágico
// espalhado). Pesos em pontos-base: a soma é exatamente 10 000 (100,00%).

/** Ordem fixa (índice = propriedade lila:race do jogador − 1, e setor da roda da roleta). */
export const RACE_IDS = ["vampire", "giant", "angel", "demon", "god", "dark"];

export const RACES = {
  vampire: { n: 1, name: "Vampiro", title: "§4§lVAMPIRO", color: "§c", weight: 2800, resource: "Sangue", res: "§4",
    blurb: "Rápido, regenera, suga sangue e vira morcego. O sol queima — capacete protege.", weakness: "Luz do sol direta (capacete ou forma de morcego protegem)." },
  giant: { n: 2, name: "Gigante", title: "§6§lGIGANTE", color: "§6", weight: 2400, resource: "Fúria", res: "§6",
    blurb: "Do tamanho de três golens: 3× força, 3× resistência, 3× velocidade.", weakness: "Grande demais para túneis, portas e tetos baixos." },
  angel: { n: 3, name: "Anjo", title: "§f§lANJO", color: "§e", weight: 2200, resource: "Graça", res: "§e",
    blurb: "Auréola, asas que crescem e voo. Cura e protege; regeneração 5×.", weakness: "Golpes de demônios e das trevas ferem 50% mais; no Nether a graça não volta." },
  demon: { n: 4, name: "Demônio", title: "§c§lDEMÔNIO", color: "§c", weight: 2400, resource: "Energia Infernal", res: "§c",
    blurb: "Asas e coroa rubras, fogo infernal e maldições; imune a fogo; regeneração 5×.", weakness: "Golpes sagrados ferem 50% mais; na água/chuva a regeneração e a imunidade a fogo param." },
  god: { n: 5, name: "DEUS", title: "§e§l✦ DEUS ✦", color: "§e", weight: 100, resource: "Energia Divina", res: "§e",
    blurb: "Coroa de luz, asas imensas, Lâmina Divina (30 de dano) e regeneração 10×.", weakness: "Golpes das trevas ferem 50% mais; poderes caros." },
  dark: { n: 6, name: "TREVAS", title: "§5§l✦ TREVAS ✦", color: "§5", weight: 100, resource: "Vazio", res: "§5",
    blurb: "Coroa negra, asas sombrias, Foice do Vazio (35 de dano), 20× resistência e regeneração 10× em pulsos.", weakness: "No sol direto a resistência cai para 10×; golpes sagrados ferem o dobro." },
};
export const RACE_BY_N = Object.fromEntries(Object.entries(RACES).map(([k, r]) => [r.n, k]));
export const TOTAL_WEIGHT = 10000;

/**
 * Números de equilíbrio (centrais). Regeneração: o jogador normal recupera ~1 ponto a cada 4 s
 * (0,25 ponto/s) com a fome cheia; "N×" = o jogo continua dando 1× e o script soma (N−1)×.
 */
export const BAL = {
  baseRegenPerSec: 0.25,
  regenMult: { vampire: 2, giant: 1, angel: 5, demon: 5, god: 10, dark: 10 },
  regenPulse: { vampire: 40, giant: 0, angel: 20, demon: 20, god: 20, dark: 80 },   // ticks entre pulsos (trevas: pulsos lentos e pesados)
  damageTakenMult: { giant: 1 / 3, dark: 1 / 20 },   // resistência: dano recebido × (Gigante 3×, Trevas 20×)
  darkSunDamageMult: 1 / 10,                          // trevas no sol direto: só 10×
  meleeMult: { giant: 3 },                            // força corpo a corpo
  speedAmp: { vampire: 4, giant: 9 },                 // efeito Velocidade: +20% por nível → 2× (nível 5) e 3× (nível 10)
  vampireSprintAmp: 19,                               // 5× (nível 20)
  giantScale: 4.5,                                    // 1,8 × 4,5 ≈ 8,1 blocos = 3 golens (2,7)
  batScale: 0.32,
  holyBonus: 0.5, holyVsDark: 1.0,                    // golpes sagrados: +50% (trevas +100%)
  angelWeakTo: ["demon", "dark"], angelWeakMult: 1.5,
  godWeakTo: ["dark"], godWeakMult: 1.5,
  sunBurnEvery: 30, sunBurnDamage: 2,                 // vampiro: 2 de dano a cada 1,5 s no sol direto
  godSwordDamage: 30, darkScytheDamage: 35,           // dano base por golpe (antes de armadura)
  resourceMax: 100, resourceRegen: 2,                 // recurso: +2 a cada segundo (mais em condições da raça)
  cooldownScale: 1.0,
  wingMax: 20, wingXpPer: 5,                          // +1 de asa a cada 5 de XP ganho (sem gastar o seu XP)
  drainRange: 3.5, drainDamage: 2, drainEvery: 10,    // dreno: 2 de dano a cada 0,5 s, cura o mesmo
  quickSlots: 18,                                     // 2 páginas de 9 (a barra de itens escolhe)
};

/** Confere os pesos (o autoteste usa isto). */
export function validateWeights() {
  const sum = RACE_IDS.reduce((s, r) => s + RACES[r].weight, 0);
  const errs = [];
  if (sum !== TOTAL_WEIGHT) errs.push(`soma dos pesos = ${sum} (precisa de ${TOTAL_WEIGHT})`);
  if (RACES.god.weight !== 100) errs.push("DEUS precisa de exatamente 1% (100 pontos-base)");
  if (RACES.dark.weight !== 100) errs.push("TREVAS precisa de exatamente 1% (100 pontos-base)");
  for (const r of RACE_IDS) if (!Number.isInteger(RACES[r].weight) || RACES[r].weight <= 0) errs.push(`${r}: peso inválido`);
  return errs;
}

/** Sorteio ponderado sem viés: um inteiro uniforme em [0, 10000) cai num intervalo por raça. */
export function pickRace(roll) {
  let acc = 0;
  for (const r of RACE_IDS) {
    acc += RACES[r].weight;
    if (roll < acc) return r;
  }
  return RACE_IDS[RACE_IDS.length - 1];
}
export const rollInt = () => Math.floor(Math.random() * TOTAL_WEIGHT);

export const oddsText = () => RACE_IDS.map((r) => `${RACES[r].color}${RACES[r].name} §f${(RACES[r].weight / 100).toFixed(0)}%`).join("§7 · ");
