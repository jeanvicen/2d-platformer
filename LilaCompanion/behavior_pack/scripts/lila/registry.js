// SummonRegistry: catálogo do que o controle invoca. Hoje só o DR-0N (a Lila foi removida na 2.0).
// O cérebro, o motor, o HUD e o menu são genéricos: outra entrada registrada aqui funciona igual.

/**
 * @typedef {{
 *   key:string, name:string, entity:string, controller:string,
 *   health:number, strength:number, respawnTicks:number,
 *   color:{red:number, green:number, blue:number}, chatTag:string,
 *   defaults:{mode:string, roam:number, hunt:boolean},
 *   flying?:boolean, speed?:number, mineSpeed?:number, vision?:number, gun?:{damage:number, every:number, range:number},
 *   actionMap?:Record<string,string>, command?:string, recSuffix?:string, creative?:boolean
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

/**
 * DR-0N: drone-robô que voa, tem itens infinitos (modo criativo), metralhadora, e vira veículos,
 * torreta gigante, colosso e exército. As ações "de corpo humano" do cérebro genérico são
 * traduzidas para as dele (actionMap).
 */
export const DRONE = registerSummon({
  key: "drone",
  name: "DR-0N",
  entity: "lila:drone",
  controller: "lila:drone_controller",
  health: 300,
  strength: 8,
  creative: true,
  respawnTicks: 400,
  color: { red: 0.3, green: 0.75, blue: 1.0 },
  chatTag: "§b§lDR-0N§r§7 »§r ",
  defaults: { mode: "follow", roam: 160, hunt: true },
  flying: true, speed: 2.2, mineSpeed: 5, vision: 64,
  gun: { damage: 7, every: 2, range: 36 },
  command: "lila:drone", recSuffix: ":drone",
  actionMap: { mine: "work", chop: "work", dig: "work", attack: "shoot", eat: "charge", sit: "turret", farm: "work",
    place: "place", craft: "craft", wave: "wave", sleep: "sleep", defeat: "defeat", summon: "summon", celebrate: "celebrate", think: "scan", idle: "idle" },
});

/** Definição pela entidade (ex.: ao carregar o mundo). */
export function summonByEntity(typeId) {
  for (const d of SUMMONS.values()) if (d.entity === typeId) return d;
  return undefined;
}
