// SummonRegistry: catálogo de personagens invocáveis pelo controle. A Lila é a primeira entrada.
// Para adicionar outra personagem (ex.: "Nina"), crie a entidade/modelo com os mesmos ossos e
// propriedades (lila:action / lila:move) e registre aqui — o cérebro, o motor, o HUD e o menu
// funcionam para qualquer entrada. Veja README → "Registrar uma segunda invocação".

/**
 * @typedef {{
 *   key:string, name:string, entity:string, controller:string,
 *   health:number, strength:number, respawnTicks:number,
 *   color:{red:number, green:number, blue:number}, chatTag:string,
 *   defaults:{mode:string, roam:number, hunt:boolean}
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
  defaults: { mode: "auto", roam: 96, hunt: false },
});

/** Definição pela entidade (ex.: ao carregar o mundo). */
export function summonByEntity(typeId) {
  for (const d of SUMMONS.values()) if (d.entity === typeId) return d;
  return undefined;
}
