// Estado de raça por jogador: JSON versionado numa dynamic property do próprio jogador (persiste
// com morte, relogar, troca de dimensão e reinício do servidor). Recargas são guardadas em tempo
// ABSOLUTO do mundo (não zeram ao relogar/reiniciar). Dados velhos/corrompidos → valor seguro.
import { world } from "@minecraft/server";
import { BAL, RACES } from "./data.js";
import { BY_ID, BY_RACE } from "./catalog.js";

const KEY = "lila:race_state";
export const SCHEMA = 2; // 2 = 3.2 (poderes assinatura entraram no catálogo: barra antiga é refeita)
const cache = new Map();

/** @returns {{v:number, race:string|null, wing:number, xpSeen:number, res:number, slots:(string|null)[], active:number, cd:Record<string,number>, tog:Record<string,boolean>, serial:number, pending:boolean, rolls:number, pm:boolean, page:number, eye:number}} */
function fresh() {
  return { v: SCHEMA, race: null, wing: 0, xpSeen: -1, res: 50, slots: Array(BAL.quickSlots).fill(null), active: 0, cd: {}, tog: {}, serial: 0, pending: false, rolls: 0, pm: false, page: 0, eye: 0 };
}

function sanitize(d) {
  const s = fresh();
  if (!d || typeof d !== "object") return s;
  s.race = typeof d.race === "string" && RACES[d.race] ? d.race : null;
  s.wing = Math.max(0, Math.min(BAL.wingMax, Math.floor(Number(d.wing) || 0)));
  s.xpSeen = Number.isFinite(d.xpSeen) ? d.xpSeen : -1;
  s.res = Math.max(0, Math.min(BAL.resourceMax, Number(d.res) || 0));
  if (Array.isArray(d.slots)) {
    for (let i = 0; i < BAL.quickSlots; i++) {
      const id = d.slots[i];
      s.slots[i] = typeof id === "string" && BY_ID.get(id)?.race === s.race ? id : null; // nunca poder de outra raça
    }
  }
  if ((Number(d.v) || 1) < SCHEMA && s.race) {
    s.slots = defaultSlots(BY_RACE[s.race]); // ids mudaram de lugar na 3.2: barra nova com os poderes assinatura
    d.cd = {};
  }
  s.active = Math.max(0, Math.min(BAL.quickSlots - 1, Math.floor(Number(d.active) || 0)));
  if (d.cd && typeof d.cd === "object") for (const [k, v] of Object.entries(d.cd)) if (BY_ID.has(k) && Number.isFinite(v)) s.cd[k] = v;
  if (d.tog && typeof d.tog === "object") for (const [k, v] of Object.entries(d.tog)) s.tog[k] = !!v;
  s.serial = Math.max(0, Math.floor(Number(d.serial) || 0));
  s.pending = !!d.pending;
  s.rolls = Math.max(0, Math.floor(Number(d.rolls) || 0));
  s.pm = !!d.pm && !!s.race;
  s.page = Math.max(0, Math.min(Math.ceil(BAL.quickSlots / 9) - 1, Math.floor(Number(d.page) || 0)));
  s.eye = Math.max(-4, Math.min(4, Math.round((Number(d.eye) || 0) * 2) / 2)); // ajuste da câmera do gigante (blocos)
  return s;
}

/** Estado do jogador (lido uma vez e mantido em memória). */
export function stateOf(player) {
  let s = cache.get(player.id);
  if (s) return s;
  let raw;
  try {
    raw = player.getDynamicProperty(KEY);
  } catch {
    /* ignore */
  }
  try {
    s = sanitize(typeof raw === "string" ? JSON.parse(raw) : null);
  } catch {
    s = fresh(); // JSON corrompido: começa limpo em vez de travar
  }
  cache.set(player.id, s);
  return s;
}

export function saveState(player) {
  const s = cache.get(player.id);
  if (!s) return;
  try {
    player.setDynamicProperty(KEY, JSON.stringify(s));
  } catch {
    /* jogador saiu */
  }
}

export function forget(playerId) {
  cache.delete(playerId);
}

/** Tempo absoluto do mundo (persistente). */
export const now = () => world.getAbsoluteTime();

/** Loadout inicial: os primeiros poderes ativos da raça (o jogador troca no grimório). */
export function defaultSlots(list) {
  const act = list.filter((a) => !a.passive).slice(0, BAL.quickSlots).map((a) => a.id);
  while (act.length < BAL.quickSlots) act.push(null);
  return act;
}
