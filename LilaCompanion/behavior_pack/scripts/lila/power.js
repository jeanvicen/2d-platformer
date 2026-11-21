// Desligar / ligar o Hacknd (2.2). Desligado, o robô desmonta no chão (cabeça, mãos, tronco e
// engrenagens caem; brilhos apagam — animação "power" do pacote de recursos pela propriedade
// lila:off) e fica parado, sem seguir nem atacar. Ao ligar, as peças sobem voando, se encaixam,
// os olhos acendem piscando e ele volta ao que fazia.
import { system } from "@minecraft/server";
import { particle, setAction, setMove, sound } from "./anim.js";
import { formOf, setForm } from "./forms.js";
import { abortAll } from "./lifecycle.js";
import { nanoArrive, nanoCollapse } from "./nanofx.js";
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
  // Hacknd: o campo do enxame cai e a poeira de nanorrobôs desce num montinho no chão
  nanoCollapse(dim, at);
  system.runTimeout(() => c.entity?.isValid && sound(c.entity, "dig.sand", 0.4, 1.6), 14);
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
  // Hacknd: a poeira levanta do chão e mais nanorrobôs descem do céu até formar a nuvem
  nanoArrive(c.dim(), c.pos());
  sound(e, "lila.transform", 0.6, 1.5);
  system.runTimeout(() => c.alive() && sound(c.entity, "lila.split", 0.5, 1.8), 30);
  if (!quiet) system.runTimeout(() => c.alive() && say(c, "Enxame online! Pronto pra te proteger.", { force: true }), BOOT_TICKS);
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
