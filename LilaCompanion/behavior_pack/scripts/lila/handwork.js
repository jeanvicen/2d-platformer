// Trabalho "à mão": o DR-0N voa até cada ponto e coloca/quebra bloco por bloco, como um jogador
// (mas voando): mira, feixe de construção, som do material, poeira ao quebrar. Usado pelas
// megaconstruções, biomas, aplainar o terreno e recolher itens do chão.
//
// Velocidades (Configurações → Velocidade de construção):
//   humano  ≈ 10 blocos/s (padrão: dá pra ver ele construindo como um jogador)
//   normal  ≈ 60 blocos/s · rapido ≈ 500 blocos/s · instantaneo = tudo de uma vez (antigo)
import { BlockPermutation, system } from "@minecraft/server";
import { steer, hover } from "./drone.js";
import { digSound, particle, setAction, sound } from "./anim.js";
import * as inv from "./inventory.js";
import { breathe } from "../core/budget.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {{x:number,y:number,z:number,id:string,st?:any,soft?:boolean,natural?:boolean}} Work */

export const SPEEDS = {
  humano: { per: 1, every: 2, reach: 5, glide: 0.35, sfx: 1, fx: 1, label: "humano (devagar, bloco por bloco)", rate: 10 },
  normal: { per: 3, every: 1, reach: 7, glide: 0.55, sfx: 3, fx: 2, label: "normal", rate: 60 },
  rapido: { per: 25, every: 1, reach: 14, glide: 0.9, sfx: 12, fx: 8, label: "rápido", rate: 500 },
};
export const speedOf = (c) => (c.rec.settings.buildSpeed && (SPEEDS[c.rec.settings.buildSpeed] || c.rec.settings.buildSpeed === "instantaneo") ? c.rec.settings.buildSpeed : "humano");

/** Blocos que nunca quebra (nem no "destruir tudo"). */
export const UNBREAKABLE = new Set(["minecraft:bedrock", "minecraft:barrier", "minecraft:command_block", "minecraft:chain_command_block",
  "minecraft:repeating_command_block", "minecraft:structure_block", "minecraft:jigsaw", "minecraft:end_portal_frame", "minecraft:end_portal",
  "minecraft:portal", "minecraft:reinforced_deepslate", "minecraft:allow", "minecraft:deny", "minecraft:border_block"]);
/** Guardam itens: no "destruir tudo" ele deixa em pé para você não perder nada. */
export const CONTAINERS = /chest|barrel|shulker_box|furnace|smoker|hopper|dispenser|dropper|brewing_stand|crafter|decorated_pot|chiseled_bookshelf|lectern|jukebox|_bed$|^minecraft:bed$|beacon|enchanting_table|ender_chest/;

const PERM = new Map();
export function perm(id, st) {
  const k = st ? `${id}|${JSON.stringify(st)}` : id;
  let p = PERM.get(k);
  if (p === undefined) {
    try {
      p = BlockPermutation.resolve(id, st ?? {});
    } catch {
      try {
        p = BlockPermutation.resolve(id);
      } catch (e) {
        logError("hand.perm", `${id}: ${e}`);
        p = null;
      }
    }
    PERM.set(k, p);
  }
  return p;
}

export class Placer {
  /**
   * @param {Companion} c
   * @param {string} speed
   * @param {{natural?:Set<string>, all?:boolean}} o natural = blocos que pode quebrar; all = qualquer um (menos baús/indestrutíveis)
   */
  constructor(c, speed, o = {}) {
    this.c = c;
    this.sp = SPEEDS[speed] ?? SPEEDS.humano;
    this.natural = o.natural;
    this.all = !!o.all;
    this.n = 0;
    this.placed = 0;
    this.broken = 0;
    this.stuck = 0;
  }

  /** Voa até ficar ao alcance do bloco (paira acima dele, como quem constrói voando). */
  *reach(x, y, z) {
    const c = this.c;
    let best = Infinity, still = 0;
    for (let t = 0; t < 200; t++) {
      const e = c.entity;
      if (!e?.isValid) return false;
      const p = e.location;
      const d = Math.hypot(p.x - (x + 0.5), p.y - (y + 0.5), p.z - (z + 0.5));
      if (d <= this.sp.reach) {
        if (t) hover(c);
        return true;
      }
      // preso em árvore/parede que ele mesmo pôs: em vez de ficar batendo, "salta" por cima até o ponto
      if (d < best - 0.05) {
        best = d;
        still = 0;
      } else if (++still > 8) break;
      steer(c, { x: x + 0.5, y: y + 4, z: z + 0.5 }, Math.min(this.sp.glide, 0.12 + d * 0.08));
      yield 1;
    }
    // não conseguiu chegar voando (preso): reaparece em cima do ponto, com brilho
    try {
      particle(c.dim(), "lila:sparkle", c.pos());
      c.entity?.teleport({ x: x + 0.5, y: y + 4, z: z + 0.5 }, { keepVelocity: false });
    } catch {
      /* ignore */
    }
    return true;
  }

  /**
   * Coloca (ou quebra, se id for ar) um bloco do jeito "à mão".
   * @param {Work} w
   */
  *work(w) {
    const c = this.c;
    const dim = c.dim();
    let b;
    try {
      b = dim.getBlock({ x: w.x, y: w.y, z: w.z });
    } catch {
      return;
    }
    if (!b) return;
    const cur = b.typeId;
    const breaking = w.id === "minecraft:air";
    if (breaking) {
      if (b.isAir || UNBREAKABLE.has(cur)) return;
      if (this.all ? CONTAINERS.test(cur) : !(this.natural?.has(cur) || b.isLiquid)) return;
    } else {
      if (cur === w.id && !w.st) return; // já está certo
      if (w.soft && !(b.isAir || b.isLiquid || this.natural?.has(cur))) return;
      if (UNBREAKABLE.has(cur)) return;
    }
    const p = breaking ? null : perm(w.id, w.st);
    if (!breaking && !p) return;
    if (!(yield* this.reach(w.x, w.y, w.z))) return;
    const e = c.entity;
    if (!e?.isValid) return;
    const from = e.location;
    try {
      e.setRotation({ x: 0, y: (-Math.atan2(w.x + 0.5 - from.x, w.z + 0.5 - from.z) * 180) / Math.PI });
    } catch {
      /* ignore */
    }
    setAction(e, breaking ? "work" : "place");
    try {
      if (breaking) b.setType("minecraft:air");
      else b.setPermutation(/** @type {any} */ (p));
    } catch (err) {
      logError("hand.set", `${w.id}: ${err}`);
      return;
    }
    // feixe do drone até o bloco + efeito no bloco (nos modos rápidos, a cada alguns blocos)
    const at = { x: w.x + 0.5, y: w.y + 0.5, z: w.z + 0.5 };
    if (this.n % this.sp.fx === 0) {
      for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        particle(dim, "lila:scan", { x: from.x + (at.x - from.x) * t, y: from.y + 0.3 + (at.y - from.y - 0.3) * t, z: from.z + (at.z - from.z) * t });
      }
      particle(dim, breaking ? "lila:dust" : "lila:build", at);
    }
    if (this.n % this.sp.sfx === 0) {
      try {
        const snd = breaking ? digSound(cur) : digSound(w.id).replace("dig.", "use.");
        dim.playSound(snd, at, { volume: 0.7, pitch: 0.9 + Math.random() * 0.2 });
      } catch {
        /* ignore */
      }
    }
    if (breaking) this.broken++;
    else this.placed++;
    this.n++;
    if (this.n % this.sp.per === 0) yield this.sp.every;
    else yield* breathe(9);
  }

  /** Executa uma fila (array ou gerador de Work; números no gerador = esperar ticks). */
  *run(stream) {
    for (const w of stream) {
      if (!this.c.alive()) return false;
      if (typeof w === "number") {
        if (w > 0) yield w;
        else yield* breathe(9);
        continue;
      }
      yield* this.work(w);
    }
    setAction(this.c.entity, "idle");
    return true;
  }
}

/** Ordem em zigue-zague (anda menos entre um bloco e outro, como um jogador faria). */
export function serpentine(cells) {
  return cells.sort((a, b) => a.z - b.z || ((a.z & 1) ? b.x - a.x : a.x - b.x));
}

/**
 * Recolhe os itens do chão em volta (vai voando até eles; o que não couber no inventário dele some).
 * @param {Companion} c
 */
export function* vacuum(c, center, radius = 32, speed = "humano") {
  const dim = c.dim();
  const sp = SPEEDS[speed] ?? SPEEDS.humano;
  let got = 0, gone = 0;
  for (let round = 0; round < 400 && c.alive(); round++) {
    let items = [];
    try {
      items = dim.getEntities({ location: center, maxDistance: radius }).filter((e) => e.typeId === "minecraft:item" || e.typeId === "minecraft:xp_orb");
    } catch {
      break;
    }
    if (!items.length) break;
    const p = c.pos();
    items.sort((a, b) => (a.location.x - p.x) ** 2 + (a.location.z - p.z) ** 2 - ((b.location.x - p.x) ** 2 + (b.location.z - p.z) ** 2));
    const it = items[0];
    // voa até o item
    for (let t = 0; t < 80 && it.isValid; t++) {
      const q = c.pos();
      const d = Math.hypot(q.x - it.location.x, q.z - it.location.z);
      if (d < 3 && Math.abs(q.y - it.location.y) < 4) break;
      steer(c, { x: it.location.x, y: it.location.y + 2, z: it.location.z }, Math.min(sp.glide * 1.6, 0.15 + d * 0.1));
      yield 1;
    }
    // aspira tudo que estiver perto dele
    const q = c.pos();
    let near = [];
    try {
      near = dim.getEntities({ location: q, maxDistance: 4.5 }).filter((e) => e.typeId === "minecraft:item" || e.typeId === "minecraft:xp_orb");
    } catch {
      /* ignore */
    }
    if (!near.length && it.isValid) near = [it];
    for (const e of near) {
      try {
        particle(dim, "lila:scan", e.location);
        if (e.typeId === "minecraft:item") {
          const stack = e.getComponent("minecraft:item")?.itemStack;
          if (stack) {
            const left = inv.container(c)?.addItem(stack);
            if (left) gone += left.amount;
            got += stack.amount - (left?.amount ?? 0);
          }
        }
        e.remove();
      } catch {
        /* ignore */
      }
    }
    sound(c.entity, "random.pop", 0.6, 1.3 + Math.random() * 0.4);
    setAction(c.entity, "scan");
    yield sp.every;
  }
  hover(c);
  setAction(c.entity, "idle");
  return { got, gone };
}

export { system };
