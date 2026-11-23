// Desligar / ligar a Maldição. Desligada, ela adormece: afunda na terra (ação "sink"), o corpo some no
// cliente (render controller: lila:off + 2,9 s) e fica parada, sem seguir nem atacar. Ao ligar, ela sai
// do chão devagar (a mesma animação de quando é invocada) e volta ao que fazia.
import { system } from "@minecraft/server";
import { setAction, setMove, sound } from "./anim.js";
import { formOf, setForm } from "./forms.js";
import { abortAll } from "./lifecycle.js";
import { emergeFx, sinkThen } from "./curse.js";
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
  // 3.3: a maldição adormece — afunda na terra e fica escondida (o corpo some no cliente depois de 2,9 s)
  sinkThen(c, () => {});
  if (!quiet) say(c, "A maldição adormeceu debaixo da terra... (use a Maldição ou diga \"liga\" para acordar)", { force: true });
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
  // 3.3: acorda saindo do chão, devagar (a mesma animação de quando é invocada)
  emergeFx(c, c.dim(), c.pos());
  sound(e, "lila.transform", 0.6, 1.5);
  if (!quiet) system.runTimeout(() => c.alive() && say(c, "A maldição acordou. Ninguém toca em você.", { force: true }), BOOT_TICKS);
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
