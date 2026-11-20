// Desligar / ligar o DR-0N (2.2). Desligado, o robô desmonta no chão (cabeça, mãos, tronco e
// engrenagens caem; brilhos apagam — animação "power" do pacote de recursos pela propriedade
// lila:off) e fica parado, sem seguir nem atacar. Ao ligar, as peças sobem voando, se encaixam,
// os olhos acendem piscando e ele volta ao que fazia.
import { system } from "@minecraft/server";
import { particle, setAction, setMove, sound } from "./anim.js";
import { formOf, setForm } from "./forms.js";
import { abortAll } from "./lifecycle.js";
import { say } from "./talk.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

export const BOOT_TICKS = 46; // duração da montagem (casa com a animação)
export const isOff = (c) => !!c.rec.off;
export const booting = (c) => system.currentTick < (c.flags.bootUntil ?? 0);

function setProp(c, on) {
  try {
    c.entity?.setProperty("lila:off", !on);
  } catch (err) {
    logError("power.prop", err);
  }
}

/** Primeiro chão firme abaixo de p. */
function groundY(dim, p) {
  let y = Math.floor(p.y);
  for (let k = 0; k < 48; k++) {
    let b;
    try {
      b = dim.getBlock({ x: Math.floor(p.x), y: y - 1, z: Math.floor(p.z) });
    } catch {
      break;
    }
    if (!b) break;
    if (!b.isAir && !b.isLiquid && !/grass$|fern|flower|torch|snow_layer|vine/.test(b.typeId)) break;
    y--;
  }
  return y;
}

/**
 * Desliga: volta à forma normal, larga tarefas, pousa e desmonta no chão.
 * @param {Companion} c
 */
export function powerOff(c, quiet = false) {
  if (!c.alive()) return false;
  if (formOf(c) !== "drone") setForm(c, "drone", { mount: false, quiet: true });
  abortAll(c);
  const e = c.entity;
  if (!e) return false;
  try {
    e.getComponent("minecraft:rideable")?.ejectRiders();
  } catch {
    /* ignore */
  }
  const dim = e.dimension;
  const p = e.location;
  const y = groundY(dim, p);
  const at = { x: Math.floor(p.x) + 0.5, y, z: Math.floor(p.z) + 0.5 };
  try {
    e.teleport(at, { keepVelocity: false });
  } catch {
    /* ignore */
  }
  c.rec.off = true;
  c.rec.offPos = at;
  c.flags.bootUntil = 0;
  setAction(e, "idle");
  setMove(e, "none");
  setProp(c, false);
  c.save();
  sound(e, "beacon.deactivate", 1, 0.8);
  sound(e, "lila.servo", 0.8, 0.45);
  // as peças batendo no chão, uma depois da outra
  /** @type {[number, string, number][]} */
  const clank = [[7, "random.anvil_land", 1.7], [11, "dig.stone", 0.8], [15, "random.anvil_land", 1.4], [19, "dig.stone", 0.7]];
  for (const [t, s, pitch] of clank) {
    system.runTimeout(() => {
      if (!c.entity?.isValid) return;
      sound(c.entity, s, 0.5, pitch);
      particle(c.dim(), "lila:dust", { x: at.x, y: at.y + 0.2, z: at.z });
    }, t);
  }
  particle(dim, "lila:smoke", { x: at.x, y: at.y + 1, z: at.z });
  if (!quiet) say(c, "Desligando... (use o controle ou diga \"liga\" para me ligar de novo)", { force: true });
  return true;
}

/**
 * Liga: as peças sobem e se montam; depois ele volta a seguir você.
 * @param {Companion} c
 */
export function powerOn(c, quiet = false) {
  if (!c.alive()) return false;
  c.rec.off = false;
  c.rec.offPos = undefined;
  c.flags.bootUntil = system.currentTick + BOOT_TICKS;
  if (c.rec.mode === "stay") c.rec.mode = "follow";
  c.rec.paused = false;
  setProp(c, true);
  c.save();
  const e = c.entity;
  sound(e, "beacon.activate", 1, 1.25);
  sound(e, "lila.transform", 0.7, 1.4);
  /** @type {[number, string, number, number][]} */
  const seq = [[6, "lila.servo", 0.7, 1.2], [14, "lila.servo", 0.7, 1.5], [22, "random.anvil_use", 0.25, 1.8], [30, "random.orb", 0.6, 1.3], [36, "lila.split", 0.5, 1.8]];
  for (const [t, s, v, pitch] of seq) {
    system.runTimeout(() => {
      if (!c.alive()) return;
      sound(c.entity, s, v, pitch);
      const q = c.pos();
      particle(c.dim(), "lila:sparkle", { x: q.x, y: q.y + 1 + (t / 40), z: q.z });
    }, t);
  }
  if (!quiet) system.runTimeout(() => c.alive() && say(c, "Sistemas online! Pronto pra te proteger.", { force: true }), BOOT_TICKS);
  return true;
}

/** Tick enquanto desligado ou montando: fica no lugar, quieto. */
export function offTick(c) {
  const e = c.entity;
  if (!e?.isValid) return;
  try {
    const v = e.getVelocity();
    if (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) > 0.01) e.applyImpulse({ x: -v.x, y: -v.y, z: -v.z });
    const o = c.rec.offPos;
    if (c.rec.off && o && system.currentTick % 10 === 0) {
      const p = e.location;
      if (Math.abs(p.x - o.x) + Math.abs(p.y - o.y) + Math.abs(p.z - o.z) > 0.4) e.teleport(o, { keepVelocity: false });
    }
  } catch {
    /* ignore */
  }
}
