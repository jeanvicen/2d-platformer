// NavigationService: anda como uma jogadora seguindo caminhos do A*, com estados de navegação,
// detecção de travamento e recuperação em camadas: replanejar → cavar/construir ponte → teleporte.
import { BlockPermutation, system } from "@minecraft/server";
import { astar, simplify, AIR, SOLID, WATER, DOOR, CLIMB } from "../lib/pathfinding.js";
import { blockAt, cellFn, groundY, isLoaded, safeState, standSpot } from "./world.js";
import { canBreak, face, placeAt, quickBreak } from "./blocks.js";
import * as inv from "./inventory.js";
import { setAction, setMove, hold } from "./anim.js";
import { logError } from "../core/log.js";

/** @typedef {{x:number,y:number,z:number}} Vec */
/** @typedef {import("./companion.js").Companion} Companion */

export const NAV = { IDLE: "idle", PLANNING: "planning", MOVING: "moving", RECOVERING: "recovering", ARRIVED: "arrived", FAILED: "failed" };

const WALK = 0.215;
const RUN = 0.29;
const SWIM = 0.12;

const dist3 = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
const distXZ = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);

export function stop(c) {
  setMove(c.entity, "none");
  c.nav = NAV.IDLE;
}

/** Já está perto o bastante? */
export function near(c, target, reach = 1.6, yTol = 2.5) {
  const p = c.pos();
  return distXZ(p, { x: target.x, z: target.z }) <= reach && Math.abs(p.y - target.y) <= yTol;
}

/**
 * Planeja um caminho (generator, orçamento por tick).
 * @returns {Generator<any, {path:Vec[]|null, complete:boolean}>}
 */
function* plan(c, goal, reach, yTol, maxNodes) {
  const dim = c.dim();
  const cell = cellFn(dim);
  c.nav = NAV.PLANNING;
  const gen = astar(c.pos(), goal, { cell, budget: 120, maxNodes, reach, yTol, sliceMs: 3 });
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value ?? { path: null, complete: false };
    yield 1;
    if (!c.alive() || c.abortMove) return { path: null, complete: false };
  }
}

/** Ponto intermediário para destinos distantes (o A* fica rápido e o chunk à frente carrega). */
function waypoint(c, target, maxLeg = 36) {
  const p = c.pos();
  const d = distXZ(p, target);
  if (d <= maxLeg) return target;
  const dim = c.dim();
  for (let leg = maxLeg; leg >= 12; leg -= 8) {
    const k = leg / d;
    const x = Math.floor(p.x + (target.x - p.x) * k), z = Math.floor(p.z + (target.z - p.z) * k);
    const probe = { x, y: Math.floor(p.y), z };
    if (!isLoaded(dim, probe)) continue;
    const gy = groundY(dim, x, z, Math.max(p.y, Math.min(target.y, p.y + 20)));
    if (gy !== undefined) return { x: x + 0.5, y: gy, z: z + 0.5 };
  }
  return { x: p.x + (target.x - p.x) * (12 / d), y: p.y, z: p.z + (target.z - p.z) * (12 / d) };
}

/**
 * Vai até um alvo. Retorna true ao chegar, false se desistiu (raro: só após todas as recuperações).
 * @param {Companion} c
 * @param {Vec} target
 * @param {{reach?:number, yTol?:number, run?:boolean, timeout?:number, allowTeleport?:boolean, follow?:()=>Vec|undefined}} o
 */
export function* goTo(c, target, o = {}) {
  const reach = o.reach ?? 1.6;
  const yTol = o.yTol ?? 2.5;
  let failures = 0;
  const t0 = system.currentTick;
  const timeout = o.timeout ?? Math.max(400, distXZ(c.pos(), target) * 40 + 400);
  c.abortMove = false;
  while (c.alive()) {
    if (o.follow) {
      const nt = o.follow();
      if (nt) target = nt;
    }
    if (near(c, target, reach, yTol)) {
      stop(c);
      c.nav = NAV.ARRIVED;
      return true;
    }
    if (c.abortMove) {
      stop(c);
      return false;
    }
    if (system.currentTick - t0 > timeout) {
      if (o.allowTeleport !== false && (yield* recoverTeleport(c, target))) return true;
      stop(c);
      c.nav = NAV.FAILED;
      return false;
    }
    const far = distXZ(c.pos(), target) > 40;
    const goal = far ? waypoint(c, target) : target;
    const res = yield* plan(c, goal, far ? 3 : reach, far ? 4 : yTol, failures ? 4000 : 2500);
    const path = res.path;
    if (!path || path.length < 2) {
      failures++;
      c.nav = NAV.RECOVERING;
      if (failures === 1) {
        yield 2;
        continue;
      }
      if (failures <= 3 && (yield* digToward(c, target, 10))) continue;
      if (o.allowTeleport !== false && failures >= 3 && (yield* recoverTeleport(c, target))) return true;
      if (failures >= 5) {
        stop(c);
        c.nav = NAV.FAILED;
        return false;
      }
      yield 10;
      continue;
    }
    const r = yield* walkPath(c, simplify(path), o.run || distXZ(c.pos(), target) > 14, o.follow ? 30 : 0);
    if (r === "blocked") {
      failures++;
      if (failures >= 2) yield* digToward(c, target, 6);
    } else if (r === "stuck") {
      failures++;
      yield* digToward(c, target, 8);
    } else if (r === "ok" && !res.complete && !far) {
      // caminho parcial: chegou o mais perto possível — tenta cavar/construir até o alvo
      failures++;
      if (!(yield* digToward(c, target, 12)) && failures >= 3 && o.allowTeleport !== false) {
        if (yield* recoverTeleport(c, target)) return true;
      }
    }
    if (failures >= 8) {
      stop(c);
      c.nav = NAV.FAILED;
      return false;
    }
    yield 1; // toda volta do laço cede pelo menos um tick
  }
  return false;
}

/**
 * Anda pelo caminho com física de verdade (impulso por tick, pulo nos degraus, nado):
 * o cliente interpola o movimento suave e as animações de andar/correr ficam naturais.
 * Se emperrar num trecho, dá um passo interpolado (recuperação) e segue.
 * @returns {Generator<any, "ok"|"blocked"|"stuck"|"abort">}
 */
function* walkPath(c, path, run, replanEvery = 0) {
  const dim = c.dim();
  const cell = cellFn(dim);
  c.nav = NAV.MOVING;
  let i = 1;
  const openDoors = [];
  let ticks = 0;
  let best = Infinity;
  let noProgress = 0;
  let rescues = 0;
  let lastJump = -10;
  while (i < path.length) {
    if (!c.alive() || c.abortMove) {
      halt(c);
      return "abort";
    }
    const e = c.entity;
    if (!e) return "abort";
    const node = path[i];
    const tgt = { x: node.x + 0.5, y: node.y, z: node.z + 0.5 };
    const here = e.location;
    const fc = cell(node.x, node.y, node.z), hc = cell(node.x, node.y + 1, node.z);
    if (fc === SOLID || hc === SOLID) {
      halt(c);
      return "blocked";
    }
    if (fc === DOOR || hc === DOOR) openDoor(dim, node, openDoors);
    const dx = tgt.x - here.x, dz = tgt.z - here.z, dy = tgt.y - here.y;
    const dh = Math.sqrt(dx * dx + dz * dz);
    // chegou no nó: passa para o próximo (sem gastar tick)
    if (dh < 0.32 && dy > -1.2 && dy < 0.6) {
      i++;
      best = Infinity;
      noProgress = 0;
      closeDoors(dim, openDoors, here);
      continue;
    }
    const inWater = fc === WATER || cell(Math.floor(here.x), Math.floor(here.y), Math.floor(here.z)) === WATER;
    const climbing = fc === CLIMB || cell(Math.floor(here.x), Math.floor(here.y), Math.floor(here.z)) === CLIMB;
    let speed = inWater ? SWIM : run ? RUN : WALK;
    if (dh < speed) speed = dh; // não passa do ponto
    let v = { x: 0, y: 0, z: 0 };
    try {
      v = e.getVelocity();
    } catch {
      /* ignore */
    }
    const imp = { x: (dx / (dh || 1)) * speed - v.x, y: 0, z: (dz / (dh || 1)) * speed - v.z };
    let onGround = true;
    try {
      onGround = e.isOnGround;
    } catch {
      /* ignore */
    }
    if (dy > 0.45 && onGround && !inWater && ticks - lastJump > 6 && dh < 1.7) {
      imp.y = 0.42 - Math.max(0, v.y); // pulo de jogador (1 bloco)
      lastJump = ticks;
    } else if (inWater && dy > -0.3) imp.y = Math.max(0, 0.07 - v.y); // nada para cima
    else if (climbing && dy > 0.2) imp.y = 0.14 - v.y; // sobe a escada
    try {
      e.applyImpulse(imp);
      if (dh > 0.05) e.setRotation({ x: 0, y: (-Math.atan2(dx, dz) * 180) / Math.PI });
    } catch (err) {
      logError("motor.impulse", err);
      return "stuck";
    }
    setMove(e, inWater ? "swim" : climbing ? "climb" : !onGround && v.y < -0.35 ? "fall" : run ? "run" : "walk");
    yield 1;
    ticks++;
    // progresso: se não chega mais perto do nó por 1,5 s, dá um passo de recuperação
    const nd = Math.hypot(tgt.x - c.pos().x, tgt.z - c.pos().z) + Math.abs(tgt.y - c.pos().y) * 0.5;
    if (nd < best - 0.03) {
      best = nd;
      noProgress = 0;
    } else if (++noProgress > 30) {
      if (++rescues > 3) {
        halt(c);
        return "stuck";
      }
      yield* stepTo(c, tgt, 5);
      best = Infinity;
      noProgress = 0;
    }
    // empurrada (dano, pistão, água corrente): se saiu muito do trilho, replaneja
    if (nd > 6) {
      halt(c);
      return "blocked";
    }
    if (replanEvery && ticks >= replanEvery) break;
  }
  closeDoors(dim, openDoors, c.pos(), true);
  halt(c);
  return "ok";
}

/** Para o corpo (zera o embalo horizontal) e volta para a pose parada. */
function halt(c) {
  const e = c.entity;
  if (e?.isValid) {
    try {
      const v = e.getVelocity();
      e.applyImpulse({ x: -v.x * 0.8, y: 0, z: -v.z * 0.8 });
    } catch {
      /* ignore */
    }
  }
  stop(c);
}

/** Passo interpolado curto (recuperação, túneis, escadarias): suave e sem atravessar blocos. */
export function* stepTo(c, to, frames = 4) {
  const e = c.entity;
  if (!e?.isValid) return;
  const from = e.location;
  const up = to.y - from.y > 0.3;
  setMove(e, "walk");
  face(c, { x: to.x - 0.5, y: to.y, z: to.z - 0.5 });
  for (let k = 1; k <= frames; k++) {
    const t = k / frames;
    try {
      e.teleport({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t + (up ? Math.sin(t * Math.PI) * 0.35 : 0), z: from.z + (to.z - from.z) * t }, { keepVelocity: false });
    } catch {
      break;
    }
    yield 1;
  }
  setMove(e, "none");
}

function openDoor(dim, node, opened) {
  for (const dy of [0, 1]) {
    const b = blockAt(dim, node.x, node.y + dy, node.z);
    if (!b || !/door$/.test(b.typeId) || /trapdoor|iron_door/.test(b.typeId)) continue;
    if (safeState(b, "open_bit") === false) {
      try {
        // abre as duas metades (o jogo sincroniza a de cima pela de baixo)
        const base = safeState(b, "upper_block_bit") ? blockAt(dim, node.x, node.y + dy - 1, node.z) : b;
        if (base) {
          base.setPermutation(base.permutation.withState(/** @type {any} */ ("open_bit"), true));
          dim.playSound("random.door_open", base.location);
          opened.push({ x: base.x, y: base.y, z: base.z });
        }
      } catch {
        /* ignore */
      }
    }
  }
}

function closeDoors(dim, opened, pos, all = false) {
  for (let i = opened.length - 1; i >= 0; i--) {
    const p = opened[i];
    if (!all && distXZ(pos, { x: p.x + 0.5, z: p.z + 0.5 }) < 1.8) continue;
    const b = blockAt(dim, p.x, p.y, p.z);
    try {
      if (b && /door$/.test(b.typeId) && safeState(b, "open_bit") === true) {
        b.setPermutation(b.permutation.withState(/** @type {any} */ ("open_bit"), false));
        dim.playSound("random.door_close", b.location);
      }
    } catch {
      /* ignore */
    }
    opened.splice(i, 1);
  }
}

/**
 * Plano B como uma jogadora: segue em linha reta até o alvo cavando blocos naturais,
 * fazendo ponte sobre buracos e pilar para subir. Nunca quebra construções do jogador.
 * @returns {Generator<any, boolean>} true se avançou
 */
export function* digToward(c, target, steps = 10) {
  const dim = c.dim();
  const cell = cellFn(dim);
  let moved = false;
  for (let s = 0; s < steps && c.alive(); s++) {
    const p = c.pos();
    if (near(c, target, 1.6, 2.5)) return true;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const dx = target.x - p.x, dz = target.z - p.z;
    const dy = Math.floor(target.y) - by;
    let sx = 0, sz = 0;
    if (Math.abs(dx) >= Math.abs(dz)) sx = Math.sign(dx);
    else sz = Math.sign(dz);
    if (Math.abs(dx) < 0.8 && Math.abs(dz) < 0.8) {
      // alvo está em cima ou embaixo: pilar ou escadaria para baixo
      if (dy > 1) {
        if (!(yield* pillarUp(c))) return moved;
        moved = true;
        continue;
      }
      if (dy < -1) {
        sx = 1; // desce em escada para o lado
      } else return moved;
    }
    const nx = bx + sx, nz = bz + sz;
    // nível do próximo passo: sobe se o alvo está acima, desce se está abaixo
    let ny = by;
    if (dy > 0 && cell(bx, by + 2, bz) !== SOLID) ny = by + 1;
    else if (dy < 0) ny = by - 1;
    // limpa espaço (pés e cabeça) — só blocos naturais
    for (const yy of [ny, ny + 1]) {
      const code = cell(nx, yy, nz);
      if (code === SOLID || code === 4) {
        const b = blockAt(dim, nx, yy, nz);
        if (!b || !canBreak(c, dim, { x: nx, y: yy, z: nz }, b.typeId)) return moved;
        if (!(yield* quickBreak(c, { x: nx, y: yy, z: nz }, { strict: false }))) return moved;
      } else if (code === 2) return moved; // lava/fogo: não passa
    }
    if (ny > by && cell(bx, by + 2, bz) === SOLID) {
      const b = blockAt(dim, bx, by + 2, bz);
      if (!b || !canBreak(c, dim, { x: bx, y: by + 2, z: bz }, b.typeId)) return moved;
      yield* quickBreak(c, { x: bx, y: by + 2, z: bz }, { strict: false });
    }
    // chão: ponte se não houver
    const g = cell(nx, ny - 1, nz);
    if (g !== SOLID && g !== WATER) {
      const blk = inv.scaffoldBlock(c);
      if (!blk) return moved;
      if (cell(nx, ny - 1, nz) === 2) return moved;
      yield* placeAt(c, { x: nx, y: ny - 1, z: nz }, blk, blk);
    }
    // anda o passo
    if (!c.entity) return moved;
    yield* stepTo(c, { x: nx + 0.5, y: ny, z: nz + 0.5 }, 4);
    moved = true;
  }
  return moved;
}

/** Sobe colocando blocos embaixo de si (pilar), como uma jogadora. */
export function* pillarUp(c) {
  const dim = c.dim();
  const cell = cellFn(dim);
  const p = c.pos();
  const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
  if (cell(bx, by + 2, bz) === SOLID) {
    const b = blockAt(dim, bx, by + 2, bz);
    if (!b || !canBreak(c, dim, { x: bx, y: by + 2, z: bz }, b.typeId)) return false;
    yield* quickBreak(c, { x: bx, y: by + 2, z: bz }, { strict: false });
  }
  const blk = inv.scaffoldBlock(c);
  if (!blk || inv.take(c, blk, 1) < 1) return false;
  const e = c.entity;
  if (!e) return false;
  setAction(e, "place");
  for (let k = 1; k <= 4; k++) {
    try {
      e.teleport({ x: bx + 0.5, y: by + k * 0.3, z: bz + 0.5 }, { keepVelocity: false });
    } catch {
      return false;
    }
    yield 1;
  }
  try {
    blockAt(dim, bx, by, bz)?.setPermutation(BlockPermutation.resolve(blk));
    e.teleport({ x: bx + 0.5, y: by + 1, z: bz + 0.5 }, { keepVelocity: false });
  } catch (err) {
    logError("motor.pillar", err);
    inv.addId(c, blk, 1);
    return false;
  }
  setAction(e, "idle");
  yield 2;
  return true;
}

/** Última opção: reaparece perto do alvo (só se o alvo estiver carregado). */
export function* recoverTeleport(c, target) {
  const dim = c.dim();
  if (!isLoaded(dim, target)) return false;
  const spot = standSpot(dim, target, 3);
  if (!spot) return false;
  const e = c.entity;
  if (!e) return false;
  try {
    dim.spawnParticle("lila:leaves", e.location);
    e.teleport({ x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 }, { keepVelocity: false });
    dim.spawnParticle("lila:sparkle", { x: spot.x + 0.5, y: spot.y, z: spot.z + 0.5 });
  } catch (err) {
    logError("motor.recover", err);
    return false;
  }
  stop(c);
  yield 2;
  return true;
}

/** Fica perto de um ponto, olhando em volta (espera ativa). */
export function* idleNear(c, ticks) {
  stop(c);
  hold(c.entity, undefined);
  setAction(c.entity, "idle");
  for (let t = 0; t < ticks && c.alive(); t += 10) yield 10;
}

export { AIR };
