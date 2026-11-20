// Combate e proteção: a Lila defende o dono, luta com a melhor arma que tiver e bate 5× mais
// forte que um jogador com a mesma arma. Nunca ataca jogadores, aldeões, golens nem animais
// domesticados/nomeados. Caçar animais passivos só com permissão (pedido direto ou configuração).
import { EntityDamageCause, ItemStack, system } from "@minecraft/server";
import { HOSTILE_SKIP, TOOL_DAMAGE, ptName } from "../lib/items.js";
import { GoalError } from "./companion.js";
import { face } from "./blocks.js";
import { goTo, stop } from "./motor.js";
import { exploreStep, sweepItems } from "./resource.js";
import * as inv from "./inventory.js";
import { hold, setAction, sound } from "./anim.js";
import { say, pick, LINES } from "./talk.js";
import { obtain } from "./planner.js";
import { logError } from "../core/log.js";
import { LILA } from "./registry.js";
import { gunFight } from "./drone.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {import("@minecraft/server").Entity} Entity */

export const STRENGTH = LILA.strength; // multiplicador sobre o dano de um jogador com a mesma arma
const NEVER = new Set(["minecraft:player", "minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader", "minecraft:iron_golem",
  "minecraft:snow_golem", "minecraft:allay", "minecraft:copper_golem", "lila:lila", "lila:drone", "minecraft:armor_stand", "minecraft:item", "minecraft:xp_orb"]);

/** Melhor arma: espada > machado > qualquer ferramenta > mão. */
export function bestWeapon(c) {
  let best, bd = 1;
  for (const kind of ["sword", "axe", "pickaxe", "shovel"]) {
    const t = inv.bestTool(c, kind);
    if (!t) continue;
    const d = TOOL_DAMAGE[kind][t.tier] ?? 1;
    if (d > bd) {
      bd = d;
      best = t;
    }
  }
  return { tool: best, damage: bd };
}

/** Pode atacar essa entidade? */
export function canAttack(c, e, allowPassive = false) {
  if (!e?.isValid || NEVER.has(e.typeId)) return false;
  try {
    if (e.nameTag) return false; // nomeado pelo jogador
    const tame = e.getComponent("minecraft:tameable");
    if (tame?.isTamed) return false;
    if (e.getComponent("minecraft:is_tamed")) return false;
  } catch {
    /* ignore */
  }
  if (isHostile(e)) return true;
  return allowPassive;
}

export function isHostile(e) {
  try {
    const fam = e.getComponent("minecraft:type_family");
    return !!fam?.hasTypeFamily("monster") && !HOSTILE_SKIP.has(e.typeId);
  } catch {
    return false;
  }
}

/** Monstros perto do dono ou dela, mais perigosos primeiro (creeper perto do dono = prioridade). */
export function findThreat(c) {
  if (!c.alive()) return undefined;
  const dim = c.dim();
  const owner = c.owner();
  const centers = [c.pos()];
  if (owner && owner.dimension.id === dim.id) centers.push(owner.location);
  let best, bs = -Infinity;
  for (const center of centers) {
    let list = [];
    try {
      list = dim.getEntities({ location: center, maxDistance: 14, families: ["monster"] });
    } catch {
      continue;
    }
    for (const e of list) {
      if (!canAttack(c, e)) continue;
      const d = Math.hypot(e.location.x - center.x, e.location.z - center.z);
      let s = 20 - d;
      if (e.typeId === "minecraft:creeper") s += 8;
      if (owner && center === owner.location) s += 4;
      if (Math.abs(e.location.y - center.y) > 6) s -= 10;
      if (s > bs) {
        bs = s;
        best = e;
      }
    }
  }
  return best;
}

/**
 * Luta até o alvo cair (ou fugir para longe).
 * @param {Companion} c
 * @param {Entity} target
 */
export function* fight(c, target, maxTicks = 600) {
  if (c.def?.gun) {
    // drone: metralha de longe e depois desce pra recolher o que caiu (carne, couro...)
    const box = { loc: target.location };
    const dead = yield* gunFight(c, target, maxTicks, box);
    if (dead && c.alive()) {
      yield 10;
      yield* sweepItems(c, box.loc, 6);
    }
    return dead;
  }
  const t0 = system.currentTick;
  const w = bestWeapon(c);
  hold(c.entity, w.tool?.id);
  c.target = target;
  let lastLoc = target.location;
  try {
    while (c.alive() && target.isValid && system.currentTick - t0 < maxTicks) {
      let hp = 1;
      try {
        hp = target.getComponent("minecraft:health")?.currentValue ?? 1;
      } catch {
        /* ignore */
      }
      if (hp <= 0) break;
      lastLoc = target.location;
      const p = c.pos();
      const d = Math.hypot(lastLoc.x - p.x, lastLoc.z - p.z);
      if (d > 40 || Math.abs(lastLoc.y - p.y) > 12) break;
      if (d > 2.6 || Math.abs(lastLoc.y - p.y) > 2.2) {
        yield* goTo(c, lastLoc, { reach: 2.0, yTol: 2, run: true, timeout: 160, allowTeleport: false, follow: () => (target.isValid ? target.location : undefined) });
        continue;
      }
      stop(c);
      face(c, { x: lastLoc.x - 0.5, y: lastLoc.y, z: lastLoc.z - 0.5 });
      if (system.currentTick - c.lastHit >= 11) {
        c.lastHit = system.currentTick;
        setAction(c.entity, "attack");
        const dmg = w.damage * (c.def?.strength ?? STRENGTH);
        try {
          target.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity });
          const kx = lastLoc.x - p.x, kz = lastLoc.z - p.z;
          const kl = Math.hypot(kx, kz) || 1;
          target.applyKnockback({ x: (kx / kl) * 0.9, z: (kz / kl) * 0.9 }, 0.32);
        } catch (e) {
          logError("combat.hit", e);
        }
        sound(c.entity, "game.player.attack.strong", 0.8, 1.1);
        if (w.tool) inv.wearTool(c, w.tool.slot, 1);
      }
      yield 2;
    }
  } finally {
    setAction(c.entity, "idle");
    c.target = undefined;
  }
  let dead = !target.isValid;
  try {
    dead = dead || (target.getComponent("minecraft:health")?.currentValue ?? 1) <= 0;
  } catch {
    dead = true;
  }
  if (dead) {
    c.rec.stats.kills++;
    yield 12;
    yield* sweepItems(c, lastLoc, 5);
  }
  return dead;
}

/** Proteção contínua: enquanto houver ameaça, luta (usado como interrupção). */
export function* defend(c) {
  for (let i = 0; i < 6 && c.alive(); i++) {
    const t = findThreat(c);
    if (!t) return;
    if (i === 0 && Math.random() < 0.4) say(c, pick(LINES.hurtOwner), { chatter: true });
    yield* fight(c, t, 500);
  }
}

/** Caça para conseguir um item (couro, carne, linha...). */
export function* huntFor(c, item, mobs, count, allowed) {
  if (!allowed) throw new GoalError(`para ${ptName(item)} eu teria que caçar — ligue "Caçar animais" nas configurações ou me peça diretamente`, "hunt");
  if (!mobs.length) throw new GoalError(`não sei como conseguir ${ptName(item)}`);
  let explorations = 0;
  while (inv.count(c, item) < count && c.alive()) {
    yield 1;
    let list = [];
    try {
      list = c.dim().getEntities({ location: c.pos(), maxDistance: 40 }).filter((e) => mobs.includes(e.typeId) && canAttack(c, e, true));
    } catch {
      /* ignore */
    }
    if (!list.length) {
      if (++explorations > 6) throw new GoalError(`não encontrei ${mobs.map((m) => m.replace("minecraft:", "")).join("/")} por perto`);
      yield* exploreStep(c, "animais");
      continue;
    }
    list.sort((a, b) => dd(a.location, c.pos()) - dd(b.location, c.pos()));
    yield* fight(c, list[0], 400);
  }
  return true;
}

const dd = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

const COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"];

/** Tosquia ovelhas (sem machucar). Precisa de tesoura (ela fabrica: 2 ferros). */
export function* shearSheep(c, count, allowKill) {
  if (inv.count(c, "minecraft:shears") < 1) yield* obtain(c, "minecraft:shears", 1, {});
  let explorations = 0;
  while (inv.count(c, { group: "wool" }) < count && c.alive()) {
    yield 1;
    let sheep = [];
    try {
      sheep = c.dim().getEntities({ type: "minecraft:sheep", location: c.pos(), maxDistance: 40 }).filter((e) => !e.getComponent("minecraft:is_sheared"));
    } catch {
      /* ignore */
    }
    if (!sheep.length) {
      if (++explorations > 6) throw new GoalError("não achei ovelhas com lã por perto");
      yield* exploreStep(c, "ovelhas");
      continue;
    }
    const s = sheep[0];
    if (!(yield* goTo(c, s.location, { reach: 1.8, yTol: 2, follow: () => (s.isValid ? s.location : undefined), timeout: 300 }))) continue;
    face(c, s.location);
    hold(c.entity, "minecraft:shears");
    setAction(c.entity, "place");
    yield 6;
    let ok = false;
    for (const ev of ["minecraft:on_sheared", "minecraft:sheared", "on_sheared"]) {
      try {
        s.triggerEvent(ev);
        if (s.getComponent("minecraft:is_sheared")) {
          ok = true;
          break;
        }
      } catch {
        /* evento não existe nessa versão */
      }
    }
    if (ok) {
      let color = 0;
      try {
        color = s.getComponent("minecraft:color")?.value ?? 0;
      } catch {
        /* ignore */
      }
      inv.add(c, new ItemStack(`minecraft:${COLORS[color] ?? "white"}_wool`, 1 + Math.floor(Math.random() * 3)));
      sound(c.entity, "mob.sheep.shear", 1, 1);
    } else if (allowKill) {
      yield* fight(c, s, 300);
    } else {
      throw new GoalError("não consegui tosquiar (versão do jogo) — me peça para caçar ovelhas se quiser a lã");
    }
    setAction(c.entity, "idle");
  }
  return true;
}
