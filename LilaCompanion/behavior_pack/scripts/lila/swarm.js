// Enxame de nanorrobôs (2.2): o DR-0N se desmancha em milhares de robozinhos (partículas do jogo
// orbitando o núcleo). Ele continua fazendo tudo que o drone faz (seguir, construir, aplainar,
// itens infinitos...) e ganha poderes de enxame:
//   - escudo em volta do dono: bloqueia flechas/bolas de fogo, empurra e pica monstros, e o dono
//     não toma dano enquanto o escudo está ligado (main.js → entityHurt);
//   - pica sozinho os monstros perto do dono (e quem estiver marcado como inimigo);
//   - formas: muralha, ponte, escada, cúpula (blocos de nanorrobô que se desmancham depois),
//     punho gigante, espada giratória, tornado, asas, elevador, ataque ao que você olha.
import { EntityDamageCause, system } from "@minecraft/server";
import { particle, setAction, sound } from "./anim.js";
import { canAttack, isHostile } from "./combat.js";
import { areaDamage, smash } from "./forms.js";
import { say } from "./talk.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

export const NANO_BLOCK = "minecraft:tinted_glass"; // "parede de nanorrobôs": escura e translúcida
const PROJECTILES = new Set(["minecraft:arrow", "minecraft:fireball", "minecraft:small_fireball", "minecraft:dragon_fireball",
  "minecraft:wither_skull", "minecraft:wither_skull_dangerous", "minecraft:shulker_bullet", "minecraft:llama_spit", "minecraft:snowball",
  "minecraft:egg", "minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:thrown_trident", "minecraft:wind_charge_projectile",
  "minecraft:breeze_wind_charge_projectile"]);
const REPLACEABLE = new Set(["minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:snow_layer", "minecraft:fire",
  "minecraft:deadbush", "minecraft:seagrass", "minecraft:vine"]);
const SKIP = new Set(["minecraft:item", "minecraft:xp_orb", "lila:robot", "lila:drone"]);

const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flat = (yaw) => {
  const r = (yaw * Math.PI) / 180;
  return { x: -Math.sin(r), z: Math.cos(r) };
};

export const shieldOn = (c) => !!c.flags.swarmShield && c.rec.form === "swarm" && c.alive();

/** Rastro de nanorrobôs de a até b (o enxame "voa" até lá). */
export function stream(dim, a, b, step = 1.6, max = 14) {
  const d = d3(a, b);
  const n = Math.min(max, Math.max(2, Math.ceil(d / step)));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    particle(dim, "lila:nano_point", { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
}

/**
 * Um tick do enxame (chamado todo tick enquanto a forma é "swarm"; o cérebro continua rodando).
 * @param {Companion} c
 */
export function swarmTick(c) {
  const e = c.entity;
  if (!e?.isValid) return;
  const pass = (c.flags.swPass = (c.flags.swPass ?? 0) + 1);
  const dim = c.dim();
  const p = c.pos();
  if (pass % 4 === 0) particle(dim, "lila:nano_cloud", { x: p.x, y: p.y + 0.7, z: p.z });
  if (pass % 6 === 3) {
    for (let k = 0; k < 3; k++) particle(dim, "lila:nano_point", { x: p.x + (Math.random() - 0.5) * 4, y: p.y + Math.random() * 2, z: p.z + (Math.random() - 0.5) * 4 });
  }
  if (pass % 40 === 0) sound(e, "mob.bee.loop", 0.5, 1.6);
  const owner = c.owner();
  if (owner && owner.dimension.id === dim.id) {
    if (c.flags.swarmShield) {
      if (pass % 4 === 2) particle(dim, "lila:nano_shield", { x: owner.location.x, y: owner.location.y + 1, z: owner.location.z });
      if (pass % 2 === 0) shieldTick(c, owner);
    }
    if (pass % 10 === 5) stingTick(c, owner);
    if ((c.flags.wingsUntil ?? 0) > system.currentTick && pass % 4 === 1) wings(dim, owner);
  }
  try {
    shapeTick(c, pass);
  } catch (err) {
    logError("swarm.shape", err);
    c.flags.shape = undefined;
  }
  if (pass % 20 === 10) tempTick(c);
}

/** Escudo: some com projéteis, empurra e pica quem chegar perto do dono. */
function shieldTick(c, owner) {
  const o = owner.location;
  const dim = owner.dimension;
  let list = [];
  try {
    list = dim.getEntities({ location: { x: o.x, y: o.y + 1, z: o.z }, maxDistance: 5.5 });
  } catch {
    return;
  }
  for (const t of list) {
    if (t.id === owner.id || t.id === c.entity?.id || SKIP.has(t.typeId)) continue;
    try {
      if (PROJECTILES.has(t.typeId)) {
        const shooter = t.getComponent("minecraft:projectile")?.owner;
        if (shooter?.id === owner.id) continue;
        particle(dim, "lila:nano_point", t.location);
        t.remove();
        continue;
      }
      if (t.typeId === "minecraft:player" && !c.flags.aggro?.has(t.id)) continue;
      if (t.typeId !== "minecraft:player" && !isHostile(t) && !c.flags.aggro?.has(t.id)) continue;
      const dx = t.location.x - o.x, dz = t.location.z - o.z, l = Math.hypot(dx, dz) || 1;
      if (l > 3.2) continue;
      t.applyKnockback({ x: (dx / l) * 1.2, z: (dz / l) * 1.2 }, 0.35);
      t.applyDamage(3, { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity });
      particle(dim, "lila:nano_point", t.location);
    } catch {
      /* ignore */
    }
  }
}

/** Picadas: o enxame voa até até 3 monstros perto de você (ou até o alvo que você mandou atacar). */
function stingTick(c, owner) {
  const dim = c.dim();
  const now = system.currentTick;
  const p = c.pos();
  let targets = [];
  if (c.flags.swarmTarget && now < (c.flags.swarmTargetUntil ?? 0)) {
    try {
      const t = dim.getEntities({ location: p, maxDistance: 80 }).find((x) => x.id === c.flags.swarmTarget);
      if (t?.isValid) targets = [t];
      else c.flags.swarmTarget = undefined;
    } catch {
      /* ignore */
    }
  }
  if (!targets.length) {
    try {
      const cand = dim.getEntities({ location: owner.location, maxDistance: 16 })
        .filter((t) => !SKIP.has(t.typeId) && t.id !== owner.id && t.id !== c.entity?.id &&
          ((t.typeId !== "minecraft:player" && isHostile(t) && canAttack(c, t)) || c.flags.aggro?.has(t.id)));
      cand.sort((a, b) => d3(a.location, owner.location) - d3(b.location, owner.location));
      targets = cand.slice(0, 3);
    } catch {
      /* ignore */
    }
  }
  if (!targets.length) {
    if (c.flags.stinging) {
      c.flags.stinging = false;
      setAction(c.entity, "idle");
    }
    return;
  }
  c.flags.stinging = true;
  setAction(c.entity, "shoot");
  for (const t of targets) {
    const at = { x: t.location.x, y: t.location.y + 0.9, z: t.location.z };
    stream(dim, { x: p.x, y: p.y + 0.6, z: p.z }, at);
    particle(dim, "lila:nano_cloud", at);
    try {
      t.applyDamage(t.id === c.flags.swarmTarget ? 10 : 6, { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity });
    } catch {
      /* ignore */
    }
  }
  if (now % 20 < 10) sound(c.entity, "mob.bee.aggressive", 0.8, 1.4);
}

function wings(dim, owner) {
  const o = owner.location;
  const f = flat(owner.getRotation().y);
  const side = { x: -f.z, z: f.x };
  for (const s of [-1, 1]) {
    for (let k = 1; k <= 4; k++) {
      particle(dim, "lila:nano_point", { x: o.x - f.x * 0.5 + side.x * s * k * 0.55, y: o.y + 1.4 + Math.sin(k * 0.7) * 0.4, z: o.z - f.z * 0.5 + side.z * s * k * 0.55 });
    }
  }
}

// ------------------------------------------------------------------ blocos temporários
/** Coloca um "bloco de nanorrobôs" que se desmancha depois (só onde é ar/água/lava/planta). */
function nano(c, dim, x, y, z, secs) {
  try {
    const b = dim.getBlock({ x, y, z });
    if (!b || !REPLACEABLE.has(b.typeId)) return false;
    b.setType(NANO_BLOCK);
    (c.flags.temp ??= []).push({ x, y, z, d: dim.id, until: system.currentTick + secs * 20 });
    return true;
  } catch {
    return false;
  }
}

function tempTick(c, force = false) {
  const list = c.flags.temp;
  if (!list?.length) return;
  const now = system.currentTick;
  const keep = [];
  let n = 0;
  for (const t of list) {
    if (!force && t.until > now) {
      keep.push(t);
      continue;
    }
    if (++n > 400 && !force) {
      keep.push(t); // muitos de uma vez: desmancha aos poucos
      continue;
    }
    try {
      const dim = c.dim();
      const b = dim.id === t.d ? dim.getBlock(t) : undefined;
      if (b?.typeId === NANO_BLOCK) {
        b.setType("minecraft:air");
        if (n % 6 === 0) particle(dim, "lila:nano_point", { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
      }
    } catch {
      /* ignore */
    }
  }
  c.flags.temp = keep;
}

/** Desmancha tudo que o enxame montou (Cancelar). */
export function clearSwarm(c) {
  tempTick(c, true);
  c.flags.shape = undefined;
  c.flags.swarmTarget = undefined;
  c.flags.wingsUntil = 0;
}

// ------------------------------------------------------------------ formas
function aim(owner, max = 64) {
  const head = owner.getHeadLocation();
  const dir = owner.getViewDirection();
  let at = { x: head.x + dir.x * max, y: head.y + dir.y * max, z: head.z + dir.z * max };
  try {
    const hit = owner.dimension.getBlockFromRay(head, dir, { maxDistance: max, includeLiquidBlocks: false, includePassableBlocks: false });
    if (hit) at = { x: hit.block.location.x + 0.5, y: hit.block.location.y + 1, z: hit.block.location.z + 0.5 };
  } catch {
    /* ignore */
  }
  return at;
}

function lookTarget(c, owner) {
  try {
    for (const h of owner.dimension.getEntitiesFromRay(owner.getHeadLocation(), owner.getViewDirection(), { maxDistance: 64 })) {
      const t = h.entity;
      if (t.id === owner.id || t.id === c.entity?.id || SKIP.has(t.typeId)) continue;
      return t;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Executa uma forma do enxame.
 * @param {Companion} c
 * @param {string} kind
 */
export function doShape(c, kind, owner = c.owner()) {
  if (!owner || !c.alive()) return false;
  const dim = owner.dimension;
  const o = owner.location;
  const f = flat(owner.getRotation().y);
  const side = { x: -f.z, z: f.x };
  const now = system.currentTick;
  const fx = Math.floor(o.x), fy = Math.floor(o.y), fz = Math.floor(o.z);
  sound(c.entity, "mob.bee.aggressive", 1, 1.2);
  sound(c.entity, "lila.split", 0.6, 1.6);
  switch (kind) {
    case "escudo":
      c.flags.swarmShield = !c.flags.swarmShield;
      say(c, c.flags.swarmShield ? "Escudo de enxame LIGADO: nada te acerta." : "Escudo de enxame desligado.", { force: true });
      return true;
    case "muralha": {
      let n = 0;
      for (let row = 0; row < 5; row++) {
        system.runTimeout(() => {
          for (let k = -6; k <= 6; k++) {
            const x = Math.floor(o.x + f.x * 4 + side.x * k), z = Math.floor(o.z + f.z * 4 + side.z * k);
            if (nano(c, dim, x, fy + row, z, 60)) n++;
            if (k % 3 === 0) particle(dim, "lila:nano_point", { x: x + 0.5, y: fy + row + 0.5, z: z + 0.5 });
          }
        }, row * 2);
      }
      say(c, "Muralha de nanorrobôs na sua frente (some em 1 minuto)!", { force: true });
      return true;
    }
    case "ponte": {
      for (let i = 1; i <= 40; i++) {
        system.runTimeout(() => {
          for (let k = -1; k <= 1; k++) {
            const x = Math.floor(o.x + f.x * i + side.x * k), z = Math.floor(o.z + f.z * i + side.z * k);
            nano(c, dim, x, fy - 1, z, 120);
          }
          particle(dim, "lila:nano_point", { x: o.x + f.x * i, y: fy, z: o.z + f.z * i });
        }, Math.floor(i / 2));
      }
      say(c, "Ponte de 40 blocos pra onde você olha (dura 2 minutos)!", { force: true });
      return true;
    }
    case "escada": {
      for (let i = 1; i <= 24; i++) {
        system.runTimeout(() => {
          for (let k = -1; k <= 1; k++) {
            const x = Math.floor(o.x + f.x * i + side.x * k), z = Math.floor(o.z + f.z * i + side.z * k);
            nano(c, dim, x, fy - 1 + i, z, 120);
          }
          particle(dim, "lila:nano_point", { x: o.x + f.x * i, y: fy + i, z: o.z + f.z * i });
        }, i);
      }
      say(c, "Escada de nanorrobôs subindo 24 blocos!", { force: true });
      return true;
    }
    case "cupula": {
      const R = 5;
      for (let y = 0; y <= R; y++) {
        system.runTimeout(() => {
          for (let x = -R; x <= R; x++) {
            for (let z = -R; z <= R; z++) {
              const d = Math.hypot(x, y, z);
              if (d > R + 0.5 || d < R - 0.5) continue;
              if (y <= 1 && Math.abs(x * f.x + z * f.z - R) < 1.2 && Math.abs(x * side.x + z * side.z) < 1.2) continue; // porta
              nano(c, dim, fx + x, fy + y, fz + z, 90);
            }
          }
          particle(dim, "lila:nano_big", { x: o.x, y: o.y + y, z: o.z });
        }, y * 2);
      }
      say(c, "Cúpula de nanorrobôs em volta de você (com porta na frente, dura 90 s).", { force: true });
      return true;
    }
    case "punho":
      c.flags.shape = { kind: "punho", t0: now, until: now + 22, at: aim(owner, 64) };
      say(c, "PUNHO GIGANTE!", { force: true });
      return true;
    case "espada":
      c.flags.shape = { kind: "espada", t0: now, until: now + 120 };
      say(c, "Espada de enxame girando em volta de você!", { force: true });
      return true;
    case "tornado": {
      const at = aim(owner, 40);
      c.flags.shape = { kind: "tornado", t0: now, until: now + 200, at };
      say(c, "TORNADO de nanorrobôs!", { force: true });
      return true;
    }
    case "asas":
      c.flags.wingsUntil = now + 1200;
      try {
        owner.addEffect("slow_falling", 1200, { amplifier: 0, showParticles: false });
        owner.addEffect("jump_boost", 1200, { amplifier: 3, showParticles: false });
        owner.addEffect("speed", 1200, { amplifier: 1, showParticles: false });
      } catch {
        /* ignore */
      }
      say(c, "Asas de enxame por 1 minuto: pule alto e plane!", { force: true });
      return true;
    case "elevador":
      try {
        owner.addEffect("levitation", 60, { amplifier: 2, showParticles: false });
        system.runTimeout(() => owner.isValid && owner.addEffect("slow_falling", 300, { amplifier: 0, showParticles: false }), 55);
      } catch {
        /* ignore */
      }
      for (let k = 0; k < 6; k++) system.runTimeout(() => owner.isValid && particle(dim, "lila:nano_shield", owner.location), k * 10);
      say(c, "Subindo! Te seguro na descida.", { force: true });
      return true;
    case "ataque": {
      const t = lookTarget(c, owner);
      if (!t) {
        say(c, "Mire em alguém e mande atacar que o enxame vai em cima!", { force: true });
        return false;
      }
      c.flags.swarmTarget = t.id;
      c.flags.swarmTargetUntil = now + 400;
      say(c, `Enxame atacando ${t.typeId.replace("minecraft:", "").replace(/_/g, " ")}!`, { force: true });
      return true;
    }
    default:
      return false;
  }
}

function shapeTick(c, pass) {
  const s = c.flags.shape;
  if (!s) return;
  const now = system.currentTick;
  const dim = c.dim();
  const owner = c.owner();
  if (now > s.until || !owner) {
    c.flags.shape = undefined;
    return;
  }
  const t = now - s.t0;
  if (s.kind === "punho") {
    // o enxame junta num punho no alto e desce com tudo
    const h = Math.max(0, 14 - t * 0.8);
    if (pass % 2 === 0) {
      particle(dim, "lila:nano_big", { x: s.at.x, y: s.at.y + h + 2, z: s.at.z });
      stream(dim, c.pos(), { x: s.at.x, y: s.at.y + h + 2, z: s.at.z }, 2.5, 8);
    }
    if (t === 18) {
      if (c.rec.settings.destroy !== false) smash(dim, s.at, 3.5);
      areaDamage(c, s.at, 6.5, 70, 2.6, 0.8);
      particle(dim, "lila:shock", s.at);
      particle(dim, "lila:dust", s.at);
      sound(c.entity, "random.explode", 1.6, 0.6);
      sound(c.entity, "lila.stomp", 1.6, 1.2);
      try {
        dim.runCommand(`camerashake add @a[x=${Math.floor(s.at.x)},y=${Math.floor(s.at.y)},z=${Math.floor(s.at.z)},r=30] 0.4 0.6 positional`);
      } catch {
        /* ignore */
      }
    }
  } else if (s.kind === "espada") {
    const o = owner.location;
    if (pass % 2 === 0) {
      const a = (t * 36 * Math.PI) / 180;
      for (let r = 1.5; r <= 7; r += 0.9) particle(dim, "lila:nano_point", { x: o.x + Math.cos(a) * r, y: o.y + 1.1, z: o.z + Math.sin(a) * r });
    }
    if (t % 10 === 0) {
      areaDamage(c, { x: o.x, y: o.y + 1, z: o.z }, 7.5, 12, 1.2, 0.3);
      sound(c.entity, "item.trident.riptide_1", 0.8, 1.6);
    }
  } else if (s.kind === "tornado") {
    if (pass % 2 === 0) {
      for (let h = 0; h <= 14; h += 2) {
        const r = 1 + h * 0.35;
        for (let k = 0; k < 4; k++) {
          const a = ((t * 25 + h * 30 + k * 90) * Math.PI) / 180;
          particle(dim, "lila:nano_point", { x: s.at.x + Math.cos(a) * r, y: s.at.y + h, z: s.at.z + Math.sin(a) * r });
        }
      }
    }
    if (t % 5 === 0) {
      try {
        for (const e of dim.getEntities({ location: s.at, maxDistance: 9 })) {
          if (e.id === owner.id || e.id === c.entity?.id || e.typeId === "lila:robot" || e.typeId === "lila:drone") continue;
          if (e.typeId === "minecraft:player" && !c.flags.aggro?.has(e.id)) continue;
          if (e.typeId !== "minecraft:player" && e.typeId !== "minecraft:item" && !isHostile(e) && !c.flags.aggro?.has(e.id)) continue;
          const dx = s.at.x - e.location.x, dz = s.at.z - e.location.z, l = Math.hypot(dx, dz) || 1;
          if (e.typeId === "minecraft:item") {
            e.applyImpulse?.({ x: (dx / l) * 0.3, y: 0.4, z: (dz / l) * 0.3 });
            continue;
          }
          e.applyKnockback({ x: (dx / l) * 0.6 - (dz / l) * 0.6, z: (dz / l) * 0.6 + (dx / l) * 0.6 }, 0.55);
          e.applyDamage(3, { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity });
        }
      } catch {
        /* ignore */
      }
      if (t % 20 === 0) sound(c.entity, "mob.bee.aggressive", 1.2, 0.8);
    }
  }
}
