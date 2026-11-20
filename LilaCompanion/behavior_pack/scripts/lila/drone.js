// DR-0N — o drone-robô: voo, metralhadora, modo torreta, carona controlada pelo dono,
// escaneamento do dono, memórias (diário) e missões. O resto (planejar, coletar, fabricar,
// construir, plantar) é o mesmo cérebro da Lila.
import { ButtonState, EntityDamageCause, InputButton, system } from "@minecraft/server";
import { blockAt, isLoaded, standSpot } from "./world.js";
import { face } from "./blocks.js";
import { setAction, setMove, sound, particle } from "./anim.js";
import { canAttack, findThreat, isHostile } from "./combat.js";
import { say } from "./talk.js";
import * as inv from "./inventory.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {{x:number,y:number,z:number}} Vec */

const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Velocidade de cruzeiro (blocos/tick). */
const cruise = (c) => 0.3 * (c.def?.speed ?? 2);

/** Há caminho livre em linha reta (raio) entre dois pontos? Folga para o alvo ser um bloco. */
export function clearLine(dim, a, b, slack = 1.5) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.5) return true;
  try {
    const hit = dim.getBlockFromRay(a, { x: dx / len, y: dy / len, z: dz / len }, { maxDistance: len, includeLiquidBlocks: false, includePassableBlocks: false });
    if (!hit) return true;
    const h = hit.block.location;
    return Math.hypot(h.x + 0.5 - a.x, h.y + 0.5 - a.y, h.z + 0.5 - a.z) >= len - slack;
  } catch {
    return false;
  }
}

/** Ajusta a velocidade do corpo (física, sem gravidade) para seguir em direção ao ponto. */
function steer(c, to, speed) {
  const e = c.entity;
  if (!e?.isValid) return 0;
  const p = e.location;
  const dx = to.x - p.x, dy = to.y - p.y, dz = to.z - p.z;
  const d = Math.hypot(dx, dy, dz);
  const s = Math.min(speed, d * 0.5); // freia chegando
  let v = { x: 0, y: 0, z: 0 };
  try {
    v = e.getVelocity();
  } catch {
    /* ignore */
  }
  const k = d > 0.01 ? s / d : 0;
  try {
    e.applyImpulse({ x: dx * k - v.x, y: dy * k - v.y, z: dz * k - v.z });
    if (Math.hypot(dx, dz) > 0.2) e.setRotation({ x: 0, y: (-Math.atan2(dx, dz) * 180) / Math.PI });
  } catch {
    /* ignore */
  }
  setMove(e, s > 0.35 ? "run" : s > 0.04 ? "walk" : "none");
  return d;
}

export function hover(c) {
  const e = c.entity;
  if (!e?.isValid) return;
  try {
    const v = e.getVelocity();
    e.applyImpulse({ x: -v.x, y: -v.y, z: -v.z });
  } catch {
    /* ignore */
  }
  setMove(e, "none");
}

/** Altura do terreno (topo sólido) numa coluna, procurando a partir de cima. */
function surfaceY(dim, x, z, fromY) {
  for (let y = Math.floor(fromY) + 24; y > fromY - 40; y--) {
    const b = blockAt(dim, Math.floor(x), y, Math.floor(z));
    if (b && !b.isAir && !b.isLiquid && !/grass$|fern|flower|torch|snow_layer|leaf_litter|bush/.test(b.typeId)) return y + 1;
  }
  return fromY;
}

/**
 * Voa até o alvo como um piloto: direto se a linha está livre; senão sobe acima do terreno,
 * cruza e desce. Alvo fechado (caverna/túnel) → pousa e usa o caminho por terra.
 * @param {Companion} c
 * @param {Vec} target
 * @param {{reach?:number, yTol?:number, timeout?:number, follow?:()=>Vec|undefined, ground?:(t:Vec)=>Generator}} o
 */
export function* flyTo(c, target, o = {}) {
  const reach = o.reach ?? 1.6;
  const yTol = (o.yTol ?? 2.5) + 1;
  const t0 = system.currentTick;
  const dim = c.dim();
  const timeout = o.timeout ?? Math.max(300, hdist(c.pos(), target) * 8 + 300);
  let best = Infinity, still = 0, climbs = 0;
  c.abortMove = false;
  while (c.alive()) {
    if (o.follow) {
      const nt = o.follow();
      if (nt) target = nt;
    }
    const p = c.pos();
    if (hdist(p, target) <= reach && Math.abs(p.y - target.y) <= yTol) {
      hover(c);
      return true;
    }
    if (c.abortMove) {
      hover(c);
      return false;
    }
    if (system.currentTick - t0 > timeout) break;
    const eye = { x: p.x, y: p.y + 0.5, z: p.z };
    const aim = { x: target.x, y: target.y + 0.6, z: target.z };
    let way = aim;
    if (!clearLine(dim, eye, aim, reach + 0.5)) {
      // caminho por cima: sobe até ter linha livre para um ponto acima do alvo
      const topT = Math.max(surfaceY(dim, target.x, target.z, target.y), target.y) + 3;
      const mid = { x: (p.x + target.x) / 2, z: (p.z + target.z) / 2 };
      const topM = surfaceY(dim, mid.x, mid.z, Math.max(p.y, target.y)) + 4;
      const cruiseY = Math.min(dim.heightRange.max - 3, Math.max(topT, topM, p.y));
      const above = { x: target.x, y: cruiseY, z: target.z };
      if (clearLine(dim, eye, above, 1)) way = above;
      else way = { x: p.x, y: Math.min(dim.heightRange.max - 3, p.y + 3), z: p.z }; // sobe reto
      // alvo fechado por cima (subsolo): o resto é por terra
      if (hdist(p, target) < 3 && !clearLine(dim, above, aim, reach + 0.5) && o.ground) {
        hover(c);
        return yield* o.ground(target);
      }
    }
    const d = steer(c, way, cruise(c));
    yield 1;
    const nd = d3(c.pos(), target);
    if (nd < best - 0.05) {
      best = nd;
      still = 0;
    } else if (++still > 40) {
      // empacou: sobe um pouco e tenta de novo; depois chão; por último reaparece perto
      still = 0;
      climbs++;
      if (climbs >= 3 && o.ground) {
        hover(c);
        return yield* o.ground(target);
      }
      const e = c.entity;
      try {
        e?.teleport({ x: p.x, y: Math.min(dim.heightRange.max - 3, p.y + 2.5), z: p.z }, { keepVelocity: false });
      } catch {
        /* ignore */
      }
    }
    if (d < 0.05) yield 1;
  }
  // último recurso: reaparece perto do alvo
  if (isLoaded(dim, target)) {
    const spot = standSpot(dim, target, 3);
    if (spot) {
      try {
        c.entity?.teleport({ x: spot.x + 0.5, y: spot.y + 1, z: spot.z + 0.5 }, { keepVelocity: false });
        particle(dim, "lila:sparkle", { x: spot.x + 0.5, y: spot.y + 1, z: spot.z + 0.5 });
        hover(c);
        return true;
      } catch {
        /* ignore */
      }
    }
  }
  hover(c);
  return false;
}

/** Seguir voando em órbita em volta do dono (como um drone de verdade). */
export function* orbitOwner(c, ticks = Infinity) {
  const t0 = system.currentTick;
  let ang = Math.random() * Math.PI * 2;
  while (c.alive() && system.currentTick - t0 < ticks) {
    const o = c.owner();
    if (!o || o.dimension.id !== c.dim().id) {
      hover(c);
      yield 20;
      continue;
    }
    const d = hdist(c.pos(), o.location);
    if (d > 24) {
      yield* flyTo(c, { x: o.location.x, y: o.location.y + 3, z: o.location.z }, { reach: 6, yTol: 4, timeout: 200, follow: () => { const q = c.owner()?.location; return q ? { x: q.x, y: q.y + 3, z: q.z } : undefined; } });
      continue;
    }
    ang += 0.035;
    const ring = { x: o.location.x + Math.cos(ang) * 3.2, y: o.location.y + 2.6 + Math.sin(ang * 2) * 0.3, z: o.location.z + Math.sin(ang) * 3.2 };
    if (!clearLine(c.dim(), c.pos(), ring, 0.5)) ring.y += 2;
    steer(c, ring, Math.min(cruise(c), 0.12 + d * 0.06));
    yield 1;
  }
  hover(c);
}

// ------------------------------------------------------------------ armas
/** Um tiro da metralhadora (instantâneo, com rastro e faísca). Retorna true se acertou. */
export function shoot(c, target) {
  const e = c.entity;
  if (!e?.isValid || !target?.isValid) return false;
  const dim = c.dim();
  const from = { x: e.location.x, y: e.location.y + 0.25, z: e.location.z };
  const to = { x: target.location.x, y: target.location.y + 0.9, z: target.location.z };
  const range = c.def?.gun?.range ?? 24;
  const dist = d3(from, to);
  if (dist > range || !clearLine(dim, from, to, 1.2)) return false;
  face(c, { x: to.x - 0.5, y: to.y, z: to.z - 0.5 });
  setAction(e, "attack");
  // rastro da bala
  const n = Math.min(14, Math.ceil(dist / 1.4));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    particle(dim, "lila:tracer", { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t });
  }
  particle(dim, "lila:ping", to);
  sound(e, "random.click", 0.6, 1.9);
  sound(e, "mob.blaze.shoot", 0.25, 1.9);
  try {
    target.applyDamage(c.def?.gun?.damage ?? 4, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
  } catch (err) {
    logError("drone.shoot", err);
  }
  return true;
}

/** Combate à distância: flutua numa boa posição e metralha. */
/** @param {{loc?:any}} [box] recebe a última posição do alvo (para recolher os drops) */
export function* gunFight(c, target, maxTicks = 500, box) {
  const t0 = system.currentTick;
  const every = c.def?.gun?.every ?? 3;
  let last = 0;
  try {
    while (c.alive() && target.isValid && system.currentTick - t0 < maxTicks) {
      let hp = 1;
      try {
        hp = target.getComponent("minecraft:health")?.currentValue ?? 1;
      } catch {
        /* ignore */
      }
      if (hp <= 0) break;
      const tl = target.location;
      if (box) box.loc = tl;
      const p = c.pos();
      const d = d3(p, tl);
      if (d > 48) break;
      const range = (c.def?.gun?.range ?? 24) - 4;
      const spot = { x: tl.x + (p.x - tl.x) * Math.min(1, 7 / Math.max(d, 0.1)), y: tl.y + 4, z: tl.z + (p.z - tl.z) * Math.min(1, 7 / Math.max(d, 0.1)) };
      if (d > range || !clearLine(c.dim(), p, { x: tl.x, y: tl.y + 1, z: tl.z }, 1.2)) steer(c, spot, cruise(c));
      else hover(c);
      if (system.currentTick - last >= every && shoot(c, target)) last = system.currentTick;
      yield 1;
    }
  } finally {
    setAction(c.entity, "idle");
  }
  const dead = !target.isValid || (() => {
    try {
      return (target.getComponent("minecraft:health")?.currentValue ?? 0) <= 0;
    } catch {
      return true;
    }
  })();
  if (dead) c.rec.stats.kills++;
  return dead;
}

/** Primeiro chão firme logo abaixo (não o topo da árvore acima dele). */
function groundBelow(dim, x, z, fromY) {
  for (let y = Math.floor(fromY); y > fromY - 48; y--) {
    const b = blockAt(dim, Math.floor(x), y, Math.floor(z));
    if (!b) return undefined;
    if (b.isLiquid) return y + 1;
    if (!b.isAir && !/grass$|fern|flower|torch|snow_layer|leaf_litter|bush|petals|vine/.test(b.typeId)) return y + 1;
  }
  return undefined;
}

/**
 * Pouso de verdade: desce suave até encostar no chão e encaixa no centro do bloco.
 * @returns {Generator<any, Vec|undefined>}
 */
export function* land(c) {
  const dim = c.dim();
  const e = c.entity;
  if (!e?.isValid) return undefined;
  let p = c.pos();
  let gy = groundBelow(dim, p.x, p.z, p.y + 0.5);
  if (gy === undefined || p.y - gy > 30) {
    // sem chão por perto (vazio/muito alto): pousa do lado do dono
    const o = c.owner();
    if (o && o.dimension.id === dim.id) {
      yield* flyTo(c, { x: o.location.x + 2, y: o.location.y + 2, z: o.location.z + 2 }, { reach: 1.4, yTol: 2, timeout: 200 });
      p = c.pos();
      gy = groundBelow(dim, p.x, p.z, p.y + 0.5);
    }
    if (gy === undefined) return undefined;
  }
  for (let t = 0; t < 120 && c.alive(); t++) {
    p = c.pos();
    const dy = p.y - gy;
    if (dy <= 0.2) break;
    try {
      const v = e.getVelocity();
      const want = -Math.min(0.55, 0.1 + dy * 0.22);
      e.applyImpulse({ x: -v.x * 0.8, y: want - v.y, z: -v.z * 0.8 });
    } catch {
      break;
    }
    setMove(e, "walk");
    yield 1;
  }
  const spot = { x: Math.floor(p.x) + 0.5, y: gy, z: Math.floor(p.z) + 0.5 };
  try {
    e.teleport(spot, { keepVelocity: false });
  } catch (err) {
    logError("drone.land", err);
  }
  hover(c);
  return spot;
}

/** Modo torreta: pousa, se transforma (tripé, escudo, canhão) e metralha tudo que for hostil. */
export function* turret(c) {
  const dim = c.dim();
  const anchor = yield* land(c);
  if (!anchor) {
    say(c, "Não achei chão firme pra virar torreta aqui. Me leva pra perto do chão!", { force: true });
    c.rec.mode = "follow";
    return;
  }
  setAction(c.entity, "sit"); // → "turret" no drone: o modelo desdobra tripé, escudo e canhão
  sound(c.entity, "random.anvil_land", 0.35, 1.6);
  particle(dim, "lila:sparkle", { x: anchor.x, y: anchor.y + 0.3, z: anchor.z });
  yield 12;
  sound(c.entity, "random.door_close", 0.6, 0.6);
  say(c, "Modo torreta ativado: tripé travado, canhão armado. Ninguém passa!", { force: true });
  let last = 0;
  try {
    while (c.alive() && c.rec.mode === "turret") {
      // pernas travadas: se algo empurrar, volta pro lugar
      const p = c.pos();
      if (Math.abs(p.x - anchor.x) > 0.3 || Math.abs(p.z - anchor.z) > 0.3 || Math.abs(p.y - anchor.y) > 0.3) {
        try {
          c.entity?.teleport(anchor, { keepVelocity: false });
        } catch {
          /* ignore */
        }
      }
      let target;
      try {
        const o = c.owner();
        const centers = [c.pos(), ...(o ? [o.location] : [])];
        for (const ce of centers) {
          for (const e of dim.getEntities({ location: ce, maxDistance: (c.def?.gun?.range ?? 24) + 8, families: ["monster"] })) {
            if (!canAttack(c, e) || !isHostile(e)) continue;
            if (!target || d3(e.location, c.pos()) < d3(target.location, c.pos())) target = e;
          }
        }
      } catch {
        /* ignore */
      }
      if (target && system.currentTick - last >= 2 && shoot(c, target)) {
        last = system.currentTick;
        setAction(c.entity, "sit");
      } else if (!target && system.currentTick % 40 === 0) {
        // vigia: o canhão gira devagar procurando alvo
        try {
          const r = c.entity?.getRotation();
          if (r) c.entity?.setRotation({ x: 0, y: r.y + 25 });
        } catch {
          /* ignore */
        }
      }
      hover(c);
      yield 1;
    }
  } finally {
    setAction(c.entity, "idle");
    if (c.alive()) {
      sound(c.entity, "random.door_open", 0.6, 0.7);
      // decola de volta
      try {
        c.entity?.applyImpulse({ x: 0, y: 0.5, z: 0 });
      } catch {
        /* ignore */
      }
    }
  }
}

// ------------------------------------------------------------------ carona
/** O dono está montado nele? */
export function riddenBy(c) {
  try {
    const riders = c.entity?.getComponent("minecraft:rideable")?.getRiders() ?? [];
    const o = c.owner();
    return riders.find((r) => r.id === o?.id);
  } catch {
    return undefined;
  }
}

/** Sobe o dono no drone (chega perto e oferece a montaria). */
export function mount(c, player) {
  const e = c.entity;
  if (!e?.isValid) return false;
  try {
    if (hdist(e.location, player.location) > 4) e.teleport({ x: player.location.x + 1, y: player.location.y + 0.5, z: player.location.z }, { keepVelocity: false });
    const ok = e.getComponent("minecraft:rideable")?.addRider(player) ?? false;
    if (ok) say(c, "Segura firme! Olhe para onde quer ir e ande pra frente. Pular = subir. Agachar = descer do drone.", { force: true });
    return ok;
  } catch (err) {
    logError("drone.mount", err);
    return false;
  }
}

/** Um tick de pilotagem: você controla para onde ele voa; ele ainda atira em monstros por perto. */
export function rideTick(c, rider) {
  const e = c.entity;
  if (!e?.isValid) return;
  let mv = { x: 0, y: 0 };
  let jump = false;
  try {
    mv = rider.inputInfo.getMovementVector();
    jump = rider.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed;
  } catch {
    /* versão sem input: fica parado */
  }
  const view = rider.getViewDirection();
  const yaw = rider.getRotation().y;
  const r = (yaw * Math.PI) / 180;
  const right = { x: -Math.cos(r), z: -Math.sin(r) };
  const speed = 0.95;
  const want = {
    x: view.x * mv.y * speed + right.x * mv.x * speed * 0.7,
    y: view.y * mv.y * speed + (jump ? 0.5 : 0),
    z: view.z * mv.y * speed + right.z * mv.x * speed * 0.7,
  };
  try {
    const v = e.getVelocity();
    e.applyImpulse({ x: want.x - v.x, y: want.y - v.y, z: want.z - v.z });
    e.setRotation({ x: 0, y: yaw });
  } catch {
    /* ignore */
  }
  setMove(e, Math.hypot(want.x, want.z) > 0.5 ? "run" : Math.hypot(want.x, want.y, want.z) > 0.05 ? "walk" : "none");
  if (system.currentTick % 4 === 0) {
    const t = findThreat(c);
    if (t) shoot(c, t);
  }
}

// ------------------------------------------------------------------ escaneamento, memórias e missões
export function remember(c, msg) {
  const d = (c.rec.diary ??= []);
  d.push({ t: system.currentTick, msg });
  if (d.length > 30) d.shift();
  c.save();
}

/** Escaneia o dono: vida, fome, perigo em volta, bioma, recursos lembrados por perto. */
export function scanOwner(c, quiet = false) {
  const o = c.owner();
  if (!o) return "";
  const dim = o.dimension;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    particle(dim, "lila:scan", { x: o.location.x + Math.cos(a) * 0.8, y: o.location.y + 0.1 + k * 0.22, z: o.location.z + Math.sin(a) * 0.8 });
  }
  sound(c.entity, "beacon.ambient", 0.6, 2);
  setAction(c.entity, "think");
  system.runTimeout(() => setAction(c.entity, "idle"), 30);
  let hp = 0, hunger = 0, threats = 0, biome = "?";
  try {
    hp = Math.round(o.getComponent("minecraft:health")?.currentValue ?? 0);
    hunger = Math.round(o.getComponent("minecraft:player.hunger")?.currentValue ?? 0);
    threats = dim.getEntities({ location: o.location, maxDistance: 32, families: ["monster"] }).length;
    biome = dim.getBiome(o.location).id.replace("minecraft:", "").replace(/_/g, " ");
  } catch {
    /* ignore */
  }
  const ores = Object.keys(c.mem.spots).filter((k) => k.startsWith("ore_") && c.mem.nearest(k, o.location, dim.id, 64)).map((k) => k.slice(4));
  const l = o.location;
  const txt = `Escaneamento: vida ${hp}/20 · fome ${hunger}/20 · ${threats ? `§c${threats} monstro(s) a até 32 blocos§r` : "nenhum monstro perto"} · bioma ${biome} · ` +
    `posição ${Math.round(l.x)}, ${Math.round(l.y)}, ${Math.round(l.z)}${ores.length ? ` · minérios que vi aqui perto: ${ores.join(", ")}` : ""}`;
  if (!quiet) say(c, txt, { force: true });
  if (!quiet && hunger && hunger < 8 && inv.bestFood(c)) say(c, "Você tá com fome. Quer comida? Peça \"me dá comida\".", { force: true });
  return txt;
}

/** Missões sugeridas conforme o momento do jogo (com progresso real). */
export function missions(c) {
  const s = inv.summary(c);
  const cnt = (re) => Object.entries(s).filter(([id]) => re.test(id)).reduce((a, [, n]) => a + n, 0);
  const list = [
    { key: "wood", title: "Estoque de madeira", desc: "Juntar 64 troncos", have: cnt(/_log$|_stem$/), need: 64, goal: { type: "gather", args: { item: { group: "log" }, count: 64, deliver: false } } },
    { key: "stone", title: "Pedreira", desc: "Juntar 64 pedregulhos", have: cnt(/^minecraft:cobblestone$/), need: 64, goal: { type: "gather", args: { item: { id: "minecraft:cobblestone" }, count: 64, deliver: false } } },
    { key: "iron", title: "Era do ferro", desc: "Fazer picareta e espada de ferro", have: cnt(/iron_(pickaxe|sword)$/), need: 2, goal: { type: "tools", args: { tier: "iron", kinds: ["pickaxe", "sword"] } } },
    { key: "armor", title: "Blindagem", desc: "Armadura de ferro completa", have: cnt(/iron_(helmet|chestplate|leggings|boots)$/), need: 4, goal: { type: "armor", args: { tier: "iron" } } },
    { key: "diamond", title: "Caçador de diamantes", desc: "Encontrar 5 diamantes", have: cnt(/^minecraft:diamond$/), need: 5, goal: { type: "gather", args: { item: { id: "minecraft:diamond", ore: "diamond" }, count: 5, deliver: false } } },
    { key: "house", title: "Lar doce lar", desc: "Construir uma casa perto de você", have: c.rec.stats.built > 0 ? 1 : 0, need: 1, goal: { type: "build", args: { blueprint: "casa" } } },
    { key: "farm", title: "Fazendeiro", desc: "Montar uma plantação de trigo", have: c.rec.farm ? 1 : 0, need: 1, goal: { type: "farm", args: { crop: "minecraft:wheat_seeds" } } },
    { key: "explore", title: "Cartógrafo", desc: "Explorar e mapear 6 áreas novas", have: Math.min(6, c.mem.explored.length), need: 6, goal: { type: "explore", args: { legs: 6 } } },
  ];
  return list.map((m) => ({ ...m, done: m.have >= m.need }));
}

export { hdist, isHostile };
