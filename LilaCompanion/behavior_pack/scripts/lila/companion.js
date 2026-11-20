// CompanionController: o estado de cada Lila (uma por dono), persistência e utilidades de contexto.
import { system, world } from "@minecraft/server";
import { readJSON, writeJSON } from "../core/persistence.js";
import { logError } from "../core/log.js";
import { SpatialMemory } from "./world.js";

import { LILA, SUMMONS, summonByEntity } from "./registry.js";

export const ENTITY_ID = LILA.entity;
/** Entidade é uma das companheiras (Lila, DR-0N...)? */
export const isCompanionType = (typeId) => !!summonByEntity(typeId);
export const OWNER_PROP = "lila:owner";

/**
 * @typedef {{type:string, args?:any, origin?:"cmd"|"auto", label?:string, tries?:number}} GoalDesc
 * @typedef {{
 *   v:number, ownerId:string, ownerName:string, summoned:boolean, entityId?:string,
 *   dim:string, pos:{x:number,y:number,z:number}, hunger:number, mode:string,
 *   stayPos?:{x:number,y:number,z:number}, goals:GoalDesc[], paused:boolean,
 *   defeat?:{left:number, sid:string, goals:GoalDesc[]}|null, saved?:{sid:string}|null,
 *   base?:{x:number,y:number,z:number,d:string}|null, farm?:any, mem:any,
 *   settings:{hud:string, chat:string, hunt:boolean, roam:number},
 *   stats:{blocks:number, crafted:number, kills:number, defeats:number, built:number, missions?:number},
 *   placed:string[], kind?:string, diary?:{t:number,msg:string}[], anchor?:{x:number,y:number,z:number}, backup?:{id:string,n:number,d:number}[]
 * }} Rec
 */

/** @returns {Rec} */
export function newRecord(player) {
  return {
    v: 1, ownerId: player.id, ownerName: player.name, summoned: false, dim: "minecraft:overworld",
    pos: { x: 0, y: 64, z: 0 }, hunger: 20, mode: "auto", goals: [], paused: false, defeat: null, saved: null,
    base: null, farm: null, mem: {}, settings: { hud: "auto", chat: "normal", hunt: false, roam: 64 },
    stats: { blocks: 0, crafted: 0, kills: 0, defeats: 0, built: 0 }, placed: [],
  };
}

export class Companion {
  /** @param {Rec} rec */
  constructor(rec) {
    this.rec = rec;
    this.kind = rec.kind ?? "lila";
    rec.kind = this.kind;
    /** definição do registro (velocidade, voo, armas, nomes) */
    this.def = SUMMONS.get(this.kind) ?? LILA;
    /** @type {import("@minecraft/server").Entity|undefined} */
    this.entity = undefined;
    this.mem = new SpatialMemory(rec.mem);
    /** tarefa principal em execução */
    this.job = null;
    /** interrupção (combate, comer, fugir) */
    this.urgent = null;
    this.dirty = true;
    this.lastSay = 0;
    this.lastChatter = 0;
    this.abortMove = false;
    this.lastProgress = { t: 0, pos: { x: 0, y: 0, z: 0 } };
    this.tickingArea = null;
    this.waypoint = null;
    this.target = undefined; // inimigo atual
    this.lastHit = 0;
    this.sleeping = false;
    this.flags = {};
    this.nav = "idle";
  }

  get ownerId() {
    return this.rec.ownerId;
  }

  /** Dono online (ou undefined). */
  owner() {
    try {
      for (const p of world.getAllPlayers()) if (p.id === this.rec.ownerId) return p;
    } catch {
      /* ignore */
    }
    return undefined;
  }

  alive() {
    return !!this.entity?.isValid;
  }

  pos() {
    const e = this.entity;
    if (e?.isValid) return e.location;
    return this.rec.pos;
  }

  dim() {
    const e = this.entity;
    if (e?.isValid) return e.dimension;
    return world.getDimension(this.rec.dim);
  }

  /** Posição de referência do dono: online -> onde ele está; offline -> última âncora. */
  ownerPos() {
    const o = this.owner();
    if (o && o.dimension.id === this.dim().id) return o.location;
    return this.rec.anchor ?? this.rec.base ?? this.rec.pos;
  }

  save() {
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    if (this.entity?.isValid) {
      const l = this.entity.location;
      this.rec.pos = { x: l.x, y: l.y, z: l.z };
      this.rec.dim = this.entity.dimension.id;
    }
    this.rec.mem = this.mem.toJSON();
    writeJSON(world, recKey(this.rec.ownerId, this.kind), this.rec);
  }
}

export const recKey = (ownerId, kind = "lila") => `lila:rec:${ownerId}${SUMMONS.get(kind)?.recSuffix ?? ""}`;
export const compKey = (ownerId, kind = "lila") => `${ownerId}|${kind}`;

/** @type {Map<string, Companion>} */
export const COMPANIONS = new Map();

export function companionOf(player, kind = "lila") {
  return COMPANIONS.get(compKey(player.id, kind));
}

/** Todas as companheiras de um dono (Lila e/ou DR-0N). */
export function companionsOf(ownerId) {
  return [...COMPANIONS.values()].filter((c) => c.rec.ownerId === ownerId);
}

function normalize(rec, kind) {
  const def = SUMMONS.get(kind) ?? LILA;
  rec.kind = kind;
  rec.settings = { hud: "auto", chat: "normal", hunt: false, roam: def.defaults.roam, ...(rec.settings ?? {}) };
  rec.stats = { blocks: 0, crafted: 0, kills: 0, defeats: 0, built: 0, missions: 0, ...(rec.stats ?? {}) };
  rec.goals ??= [];
  rec.placed ??= [];
  rec.diary ??= [];
  return rec;
}

export function loadCompanion(player, kind = "lila") {
  const key = compKey(player.id, kind);
  let c = COMPANIONS.get(key);
  if (c) {
    c.rec.ownerName = player.name;
    return c;
  }
  const rec = normalize(readJSON(world, recKey(player.id, kind), null) ?? newRecord(player), kind);
  rec.ownerName = player.name;
  if (!rec.mode) rec.mode = (SUMMONS.get(kind) ?? LILA).defaults.mode;
  c = new Companion(rec);
  COMPANIONS.set(key, c);
  return c;
}

/** Companheiras salvas sem jogador online (usado pelo autoteste e ao carregar o mundo). */
export function loadAllRecords() {
  try {
    for (const id of world.getDynamicPropertyIds()) {
      const m = /^lila:rec:([^:#]+)(?::([a-z_]+))?$/.exec(id);
      if (!m) continue;
      const kind = m[2] ?? "lila";
      if (COMPANIONS.has(compKey(m[1], kind))) continue;
      const rec = readJSON(world, id, null);
      if (rec?.ownerId) COMPANIONS.set(compKey(rec.ownerId, kind), new Companion(normalize(rec, kind)));
    }
  } catch (e) {
    logError("companion.loadAll", e);
  }
}

/** Companheira dona desta entidade (pelo dono + tipo). */
export function companionForEntity(entity) {
  try {
    const def = summonByEntity(entity.typeId);
    const owner = entity.getDynamicProperty(OWNER_PROP);
    if (!def || typeof owner !== "string") return undefined;
    return COMPANIONS.get(compKey(owner, def.key));
  } catch {
    return undefined;
  }
}

/** Liga a entidade carregada ao registro do dono (após recarregar o mundo, estrutura, etc.). */
export function adopt(entity) {
  try {
    const def = summonByEntity(entity.typeId);
    if (!def) return undefined;
    const owner = entity.getDynamicProperty(OWNER_PROP);
    if (typeof owner !== "string") return undefined;
    const key = compKey(owner, def.key);
    let c = COMPANIONS.get(key);
    if (!c) {
      const rec = readJSON(world, recKey(owner, def.key), null);
      if (!rec) return undefined;
      c = new Companion(normalize(rec, def.key));
      COMPANIONS.set(key, c);
    }
    if (c.entity?.isValid && c.entity.id !== entity.id) {
      // duplicata (nunca deveria existir): mantém a registrada e remove a outra
      system.run(() => {
        try {
          entity.remove();
        } catch {
          /* ignore */
        }
      });
      return c;
    }
    c.entity = entity;
    c.rec.entityId = entity.id;
    return c;
  } catch (e) {
    logError("companion.adopt", e);
    return undefined;
  }
}

export function findEntityFor(c) {
  try {
    if (c.rec.entityId) {
      const e = world.getEntity(c.rec.entityId);
      if (e?.isValid && e.typeId === c.def.entity) return e;
    }
    for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
      const dim = world.getDimension(dimId);
      for (const e of dim.getEntities({ type: c.def.entity })) {
        if (e.getDynamicProperty(OWNER_PROP) === c.rec.ownerId) return e;
      }
    }
  } catch (e) {
    logError("companion.find", e);
  }
  return undefined;
}

export class GoalError extends Error {
  constructor(msg, code = "fail") {
    super(msg);
    this.code = code;
  }
}

/** Erro especial: falta ferramenta (o planejador resolve e tenta de novo). */
export class NeedTool extends GoalError {
  constructor(kind, tier) {
    super(`preciso de ${kind} ${tier}`, "tool");
    this.kind = kind;
    this.tier = tier;
  }
}
