// SummonRegistry: catálogo de personagens invocáveis pelo controle. A Lila é a primeira entrada.
// Para adicionar outra personagem (ex.: "Nina"), crie a entidade/modelo com os mesmos ossos e
// propriedades (lila:action / lila:move) e registre aqui — o cérebro, o motor, o HUD e o menu
// funcionam para qualquer entrada. Veja README → "Registrar uma segunda invocação".

/**
 * @typedef {{
 *   key:string, name:string, entity:string, controller:string,
 *   health:number, strength:number, respawnTicks:number,
 *   color:{red:number, green:number, blue:number}, chatTag:string,
 *   defaults:{mode:string, roam:number, hunt:boolean},
 *   flying?:boolean, speed?:number, mineSpeed?:number, vision?:number, gun?:{damage:number, every:number, range:number},
 *   actionMap?:Record<string,string>, command?:string, recSuffix?:string
 * }} SummonDef
 */

/** @type {Map<string, SummonDef>} */
export const SUMMONS = new Map();

/** @param {SummonDef} def */
export function registerSummon(def) {
  if (!/^[a-z0-9_]+$/.test(def.key)) throw new Error(`chave inválida: ${def.key}`);
  if (SUMMONS.has(def.key)) throw new Error(`invocação duplicada: ${def.key}`);
  SUMMONS.set(def.key, Object.freeze({ ...def }));
  return def;
}

export const LILA = registerSummon({
  key: "lila",
  name: "Lila",
  entity: "lila:lila",
  controller: "lila:controller",
  health: 100, // 5× a vida de um jogador
  strength: 5, // dano 5× maior que um jogador com a mesma arma
  respawnTicks: 400, // 20 segundos
  color: { red: 0.25, green: 0.9, blue: 0.55 },
  chatTag: "§a§lLila§r§7 »§r ",
  defaults: { mode: "auto", roam: 64, hunt: false },
  speed: 1, mineSpeed: 1.6, vision: 40, command: "lila:lila", recSuffix: "",
});

/**
 * DR-0N: drone-robô grande que voa. Mesmo cérebro da Lila (planeja, coleta, fabrica, constrói),
 * porém voa, é mais rápido, minera mais rápido, enxerga mais longe e tem metralhadora/torreta.
 * O drone não tem as ações de corpo humano: elas são traduzidas para as dele (actionMap).
 */
export const DRONE = registerSummon({
  key: "drone",
  name: "DR-0N",
  entity: "lila:drone",
  controller: "lila:drone_controller",
  health: 160,
  strength: 6,
  respawnTicks: 400,
  color: { red: 0.3, green: 0.75, blue: 1.0 },
  chatTag: "§b§lDR-0N§r§7 »§r ",
  defaults: { mode: "auto", roam: 160, hunt: false },
  flying: true, speed: 2.2, mineSpeed: 3.2, vision: 64,
  gun: { damage: 5, every: 3, range: 28 },
  command: "lila:drone", recSuffix: ":drone",
  actionMap: { mine: "work", chop: "work", dig: "work", attack: "shoot", eat: "charge", sit: "turret", farm: "work",
    place: "place", craft: "craft", wave: "wave", sleep: "sleep", defeat: "defeat", summon: "summon", celebrate: "celebrate", think: "scan", idle: "idle" },
});

/** Definição pela entidade (ex.: ao carregar o mundo). */
export function summonByEntity(typeId) {
  for (const d of SUMMONS.values()) if (d.entity === typeId) return d;
  return undefined;
}
