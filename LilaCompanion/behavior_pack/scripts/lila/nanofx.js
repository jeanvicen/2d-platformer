// Efeitos do enxame Hacknd disparados pelo script (a nuvem em si roda no cliente, presa na
// entidade: ver resource_pack/particles/lila_nano_swarm.json). Aqui ficam só os momentos
// especiais: chegada pelo céu, desligar (a poeira cai), montar/desmanchar formas, golpes.
import { MolangVariableMap } from "@minecraft/server";
import { particle } from "./anim.js";

/** Tamanho aproximado de cada forma (para a nuvem convergir/desmanchar no tamanho certo). */
export const FORM_SIZE = { drone: 0.6, swarm: 0.6, heli: 1.4, car: 1.1, excavator: 1.3, tank: 1.4, jet: 1.6, moto: 0.8, colossus: 4.5, turret: 1.4,
  ship: 1.6, ufo: 1.7, sub: 1.5, boat: 1.2, truck: 1.4, stealth: 1.8 };

/** Partícula com variáveis Molang (v.size, v.yaw...). */
export function nanoFx(dim, id, at, vars = {}) {
  try {
    const m = new MolangVariableMap();
    for (const [k, v] of Object.entries(vars)) m.setFloat(`variable.${k}`, v);
    dim.spawnParticle(id, at, m);
  } catch {
    /* fora da área carregada */
  }
}

/** Rastro de nanorrobôs de a até b. */
export function nanoStream(dim, a, b, max = 8, step = 1.6) {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const n = Math.min(max, Math.max(2, Math.ceil(d / step)));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    particle(dim, "lila:nano_point", { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
}

/** Invocar / ligar: milhares de robozinhos descem do céu em várias correntes até a nuvem. */
export function nanoArrive(dim, at) {
  nanoFx(dim, "lila:nano_arrive", at);
  try {
    dim.playSound("mob.blaze.breathe", at, { volume: 1, pitch: 0.6 });
    dim.playSound("beacon.activate", at, { volume: 0.5, pitch: 1.8 });
  } catch {
    /* ignore */
  }
}

/** Desligar: o campo cai e a poeira desce num montinho. */
export function nanoCollapse(dim, at) {
  nanoFx(dim, "lila:nano_collapse", at);
  try {
    dim.playSound("beacon.deactivate", at, { volume: 0.7, pitch: 1.2 });
    dim.playSound("mob.blaze.breathe", at, { volume: 0.5, pitch: 0.5 });
  } catch {
    /* ignore */
  }
}

/** A nuvem converge e compacta numa forma (veículo, titã, torreta, soldado). */
export function nanoAssemble(dim, at, size = 1) {
  nanoFx(dim, "lila:nano_assemble", at, { size });
}

/** Uma forma se desfaz em poeira. */
export function nanoBurst(dim, at, size = 1) {
  nanoFx(dim, "lila:nano_burst", at, { size });
}
