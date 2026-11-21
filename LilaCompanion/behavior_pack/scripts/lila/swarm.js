// Enxame de nanorrobôs (2.3): o DR-0N vira uma névoa de milhares de robozinhos. Em vez de ficar
// orbitando você, eles se espalham pelo ar em volta (uma "atmosfera" sutil: pontinhos que brilham
// e uma névoa levíssima) e agem SOZINHOS, sem precisar abrir o controle:
//   - mão vazia e você começa a quebrar madeira → eles se juntam na sua mão e viram um MACHADO de
//     nanorrobôs (derruba a árvore inteira); pedra/minério → PICARETA (veio inteiro / túnel 3×3);
//     terra/areia → PÁ (3×3); folhas/plantas → ENXADA. Bateu num monstro de mão vazia → ESPADA;
//   - te seguram nas quedas (almofada de nanorrobôs embaixo de você), acendem o escuro, te dão
//     fôlego debaixo d'água e apagam o fogo;
//   - picam os monstros que chegam perto e somem com flechas antes de te acertarem.
// Modos (troque usando o item "Núcleo do enxame", falando ou no controle):
//   Inteligente · Escudo (barreira giratória: nada passa e nada te acerta; eles não atacam) ·
//   Asas (asas enormes nas costas: voe olhando para onde quer ir) · Prancha voadora ·
//   Mãos gigantes (duas mãozonas atrás de você socam junto com você) · Devorador (come tudo por
//   onde você anda; agachado, come o chão também).
// Ferramentas pedidas: espada, machado, picareta, pá, enxada e o MARTELO (use para arremessar:
// explode no que acertar e volta voando para a sua mão).
// Formas antigas continuam: muralha, ponte, escada, cúpula, punho do céu, lâmina giratória,
// tornado, elevador e "ataca" (no que você olha).
import { BlockVolume, EntityDamageCause, ItemStack, MolangVariableMap, system } from "@minecraft/server";
import { particle, setAction, sound } from "./anim.js";
import { canAttack, isHostile } from "./combat.js";
import { areaDamage, smash } from "./forms.js";
import { UNBREAKABLE } from "./handwork.js";
import { CONTAINER_IDS } from "./mega.js";
import { say } from "./talk.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */

export const NANO_BLOCK = "minecraft:tinted_glass"; // "parede de nanorrobôs": escura e translúcida
export const NANO_ITEMS = {
  sword: "lila:nano_sword", pickaxe: "lila:nano_pickaxe", axe: "lila:nano_axe", shovel: "lila:nano_shovel", hoe: "lila:nano_hoe",
  hammer: "lila:nano_hammer", core: "lila:nano_core",
};
const TOOL_NAMES = { sword: "Espada", pickaxe: "Picareta", axe: "Machado", shovel: "Pá", hoe: "Enxada", hammer: "Martelo" };
export const isNanoItem = (id) => typeof id === "string" && id.startsWith("lila:nano_");
export const NANO_MODES = ["auto", "escudo", "asas", "prancha", "maos", "devorador"];
export const MODE_NAMES = {
  auto: "Inteligente", escudo: "Escudo (barreira)", asas: "Asas", prancha: "Prancha voadora", maos: "Mãos gigantes", devorador: "Devorador",
};
const MODE_HELP = {
  auto: "eles agem sozinhos: ferramentas na sua mão, proteção de queda, luz, e picam monstros",
  escudo: "barreira girando em volta de você: nada passa e nada te acerta (eles não atacam)",
  asas: "olhe para onde quer ir e ande para voar · pular sobe · agachar desce planando",
  prancha: "ande para voar na prancha · pular sobe · agachar desce",
  maos: "duas mãos gigantes atrás de você: bata e elas socam junto",
  devorador: "eles comem tudo por onde você passa (agachado: o chão também)",
};

const PROJECTILES = new Set(["minecraft:arrow", "minecraft:fireball", "minecraft:small_fireball", "minecraft:dragon_fireball",
  "minecraft:wither_skull", "minecraft:wither_skull_dangerous", "minecraft:shulker_bullet", "minecraft:llama_spit", "minecraft:snowball",
  "minecraft:egg", "minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:thrown_trident", "minecraft:wind_charge_projectile",
  "minecraft:breeze_wind_charge_projectile"]);
const REPLACEABLE = new Set(["minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:snow_layer", "minecraft:fire",
  "minecraft:deadbush", "minecraft:seagrass", "minecraft:vine"]);
const SKIP = new Set(["minecraft:item", "minecraft:xp_orb", "lila:robot", "lila:drone"]);
const NO_EAT = [...new Set([...UNBREAKABLE, ...CONTAINER_IDS, "minecraft:air", "minecraft:end_portal_frame", "minecraft:end_portal", "minecraft:portal",
  "minecraft:mob_spawner", "minecraft:trial_spawner", "minecraft:vault", "minecraft:reinforced_deepslate"])];
const LIGHT = "minecraft:light_block_12";

const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const flat = (yaw) => {
  const r = (yaw * Math.PI) / 180;
  return { x: -Math.sin(r), z: Math.cos(r) };
};
const right = (f) => ({ x: -f.z, z: f.x });

export const modeOf = (c) => (c.rec.form === "swarm" ? c.flags.nanoMode ?? c.rec.settings.nanoMode ?? "auto" : "off");
/** Escudo total (main.js cancela qualquer dano no dono). */
export const shieldOn = (c) => c.rec.form === "swarm" && c.alive() && modeOf(c) === "escudo";

/**
 * Dano que o enxame segura mesmo fora do modo escudo (lido no beforeEvent: só lê flags).
 * Queda (eles amortecem), e a explosão do próprio martelo perto de você.
 */
export function nanoProtects(c, cause) {
  if (c.rec.form !== "swarm" || !c.alive()) return false;
  if (cause === "fall" || cause === "flyIntoWall") return true;
  if ((cause === "entityExplosion" || cause === "blockExplosion") && system.currentTick < (c.flags.hammerSafe ?? 0)) return true;
  return false;
}

/** Rastro de nanorrobôs de a até b (o enxame "voa" até lá). */
export function stream(dim, a, b, step = 1.8, max = 8) {
  const d = d3(a, b);
  const n = Math.min(max, Math.max(2, Math.ceil(d / step)));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    particle(dim, "lila:nano_point", { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
}

/** Partícula com variáveis Molang (orientação das asas, prancha, mãos). */
function fxv(dim, id, at, vars) {
  try {
    const m = new MolangVariableMap();
    for (const [k, v] of Object.entries(vars)) m.setFloat(`variable.${k}`, v);
    dim.spawnParticle(id, at, m);
  } catch {
    /* fora do mundo carregado */
  }
}

function handPos(p) {
  const h = p.getHeadLocation();
  const f = flat(p.getRotation().y);
  const s = right(f);
  return { x: h.x + f.x * 0.45 + s.x * 0.38, y: h.y - 0.6, z: h.z + f.z * 0.45 + s.z * 0.38 };
}

function bar(p, msg) {
  try {
    p.onScreenDisplay.setActionBar(msg);
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ ciclo de vida
function startSwarm(c, owner) {
  c.flags.nanoActive = true;
  c.flags.nanoMode = c.rec.settings.nanoMode ?? "auto";
  c.flags.nanoHeld = {};
  try {
    owner.runCommand("fog @s push lila:nano_fog lila_nano");
  } catch {
    /* sem névoa nesta versão */
  }
  giveCore(owner);
}

function giveCore(owner) {
  const ct = owner.getComponent("minecraft:inventory")?.container;
  if (!ct) return;
  for (let i = 0; i < ct.size; i++) if (ct.getItem(i)?.typeId === NANO_ITEMS.core) return;
  for (let i = 0; i < 9; i++) {
    if (!ct.getItem(i)) {
      ct.setItem(i, new ItemStack(NANO_ITEMS.core, 1));
      return;
    }
  }
  ct.addItem(new ItemStack(NANO_ITEMS.core, 1));
}

/** O enxame acabou (voltou ao normal, virou outra coisa, foi derrotado): limpa tudo. */
export function endSwarm(c) {
  c.flags.nanoActive = false;
  const owner = c.owner();
  tempTick(c, true);
  clearLight(c);
  c.flags.shape = undefined;
  c.flags.swarmTarget = undefined;
  c.flags.hammer = undefined;
  c.flags.breakQ = undefined;
  c.flags.punch = undefined;
  if (!owner) return;
  try {
    owner.runCommand("fog @s remove lila_nano");
  } catch {
    /* ignore */
  }
  const ct = owner.getComponent("minecraft:inventory")?.container;
  if (ct) {
    for (let i = 0; i < ct.size; i++) {
      try {
        if (isNanoItem(ct.getItem(i)?.typeId)) ct.setItem(i, undefined);
      } catch {
        /* ignore */
      }
    }
  }
  const m = c.flags.nanoMode;
  if ((m === "asas" || m === "prancha") && !owner.isOnGround) {
    try {
      owner.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });
    } catch {
      /* ignore */
    }
  }
}

/** Troca o modo do enxame. */
export function setNanoMode(c, mode, owner = c.owner()) {
  if (!NANO_MODES.includes(mode)) return false;
  const prev = modeOf(c);
  c.flags.nanoMode = mode;
  c.rec.settings.nanoMode = mode;
  c.flags.swarmShield = mode === "escudo";
  if (mode === "prancha" && owner) c.flags.boardY = owner.location.y + 1.4;
  if ((prev === "asas" || prev === "prancha") && mode !== prev && owner && !owner.isOnGround) {
    try {
      owner.addEffect("slow_falling", 160, { amplifier: 0, showParticles: false });
    } catch {
      /* ignore */
    }
  }
  if (owner) {
    const dim = owner.dimension;
    particle(dim, "lila:nano_form", { x: owner.location.x, y: owner.location.y + 1.2, z: owner.location.z });
    try {
      dim.playSound("lila.split", owner.location, { volume: 0.5, pitch: 1.7 });
      dim.playSound("mob.bee.loop", owner.location, { volume: 0.4, pitch: 1.5 });
    } catch {
      /* ignore */
    }
    bar(owner, `§b⬢ Enxame: §l${MODE_NAMES[mode]}§r §7— ${MODE_HELP[mode]}`);
  }
  if (c.entity?.isValid) setAction(c.entity, mode === "escudo" ? "scan" : "idle");
  c.save();
  return true;
}

// ------------------------------------------------------------------ tick
/**
 * Um tick do enxame (todo tick enquanto a forma é "swarm"; o cérebro continua rodando: ele segue
 * você, passeia por perto, constrói etc.).
 * @param {Companion} c
 */
export function swarmTick(c) {
  const e = c.entity;
  if (!e?.isValid) return;
  const owner = c.owner();
  if (!c.flags.nanoActive && owner) startSwarm(c, owner);
  const pass = (c.flags.swPass = (c.flags.swPass ?? 0) + 1);
  const dim = c.dim();
  const p = c.pos();
  // o núcleo: uma fumacinha escura com brilhos (leve: poucas partículas que duram mais)
  if (pass % 6 === 0) particle(dim, "lila:nano_smoke", { x: p.x, y: p.y + 0.6, z: p.z });
  if (pass % 14 === 7) particle(dim, "lila:nano_point", { x: p.x, y: p.y + 0.6, z: p.z });
  if (!owner || owner.dimension.id !== dim.id) return;
  const od = owner.dimension;
  const mode = modeOf(c);
  // a atmosfera: nanorrobôs minúsculos espalhados no ar em volta (não orbitam)
  if (pass % 20 === 0) particle(od, "lila:nano_air", owner.location);
  if (pass % 80 === 0) sound(e, "mob.bee.loop", 0.22, 1.9);
  try {
    if (mode === "escudo") {
      if (pass % 2 === 0) barrierTick(c, owner);
      if (pass % 5 === 0) particle(od, "lila:nano_ring", { x: owner.location.x, y: owner.location.y + 1, z: owner.location.z });
    } else if (mode === "asas") wingsTick(c, owner, pass);
    else if (mode === "prancha") boardTick(c, owner, pass);
    else if (mode === "maos") handsTick(c, owner, pass);
    else if (mode === "devorador") {
      if (pass % 3 === 0) devourTick(c, owner, pass);
    }
    if (mode === "auto" || mode === "maos" || mode === "devorador") {
      if (pass % 2 === 1) interceptTick(c, owner, 6);
      if (pass % 10 === 5) stingTick(c, owner);
    } else if (mode !== "escudo" && pass % 2 === 1) interceptTick(c, owner, 4);
    if (mode !== "asas" && mode !== "prancha") fallTick(c, owner);
    if (pass % 10 === 0) careTick(c, owner);
    if (pass % 4 === 2) heldTick(c, owner, pass);
    if (c.flags.hammer) hammerTick(c, owner);
    if (c.flags.breakQ?.length) breakTick(c, owner);
    shapeTick(c, pass);
  } catch (err) {
    logError("swarm.tick", err);
    c.flags.shape = undefined;
  }
  if (pass % 20 === 10) tempTick(c);
}

// ------------------------------------------------------------------ escudo / proteção
/** Barreira: nada atravessa. Projéteis somem, quem chegar perto é empurrado para fora (sem dano). */
function barrierTick(c, owner) {
  const o = owner.location;
  const dim = owner.dimension;
  let list = [];
  try {
    list = dim.getEntities({ location: { x: o.x, y: o.y + 1, z: o.z }, maxDistance: 5 });
  } catch {
    return;
  }
  for (const t of list) {
    if (t.id === owner.id || t.id === c.entity?.id || SKIP.has(t.typeId)) continue;
    try {
      if (PROJECTILES.has(t.typeId)) {
        if (t.getComponent("minecraft:projectile")?.owner?.id === owner.id) continue;
        particle(dim, "lila:nano_point", t.location);
        t.remove();
        continue;
      }
      if (t.typeId === "minecraft:player" && !c.flags.aggro?.has(t.id)) continue;
      const dx = t.location.x - o.x, dz = t.location.z - o.z, l = Math.hypot(dx, dz) || 1;
      if (l > 3.4) continue;
      t.applyKnockback({ x: (dx / l) * 0.9, z: (dz / l) * 0.9 }, 0.22);
      if (Math.random() < 0.4) particle(dim, "lila:nano_point", { x: o.x + (dx / l) * 2.6, y: t.location.y + 1, z: o.z + (dz / l) * 2.6 });
    } catch {
      /* ignore */
    }
  }
}

/** Fora do escudo: projéteis perto de você somem no ar (o enxame engole). */
function interceptTick(c, owner, r) {
  const o = owner.location;
  try {
    for (const t of owner.dimension.getEntities({ location: { x: o.x, y: o.y + 1, z: o.z }, maxDistance: r })) {
      if (!PROJECTILES.has(t.typeId)) continue;
      if (t.getComponent("minecraft:projectile")?.owner?.id === owner.id) continue;
      particle(owner.dimension, "lila:nano_smoke", t.location);
      t.remove();
    }
  } catch {
    /* ignore */
  }
}

/** Queda: almofada de nanorrobôs e sem dano (main.js); lava/vazio embaixo → plataforma. */
function fallTick(c, owner) {
  if (owner.isOnGround || owner.isGliding || owner.isFlying) return;
  let v;
  try {
    v = owner.getVelocity();
  } catch {
    return;
  }
  if (v.y > -0.7) return;
  const dim = owner.dimension;
  const o = owner.location;
  let hit;
  try {
    hit = dim.getBlockFromRay(o, { x: 0, y: -1, z: 0 }, { maxDistance: 40, includeLiquidBlocks: true, includePassableBlocks: false });
  } catch {
    /* ignore */
  }
  const now = system.currentTick;
  const gy = hit ? hit.block.location.y + 1 : -1e9;
  if (o.y - gy < 4.5 && now >= (c.flags.cushionAt ?? 0)) {
    c.flags.cushionAt = now + 10;
    try {
      owner.addEffect("slow_falling", 30, { amplifier: 0, showParticles: false });
    } catch {
      /* ignore */
    }
    fxv(dim, "lila:nano_board", { x: o.x, y: gy + 0.2, z: o.z }, { yaw: owner.getRotation().y, size: 1.8 });
    particle(dim, "lila:nano_smoke", { x: o.x, y: gy + 0.3, z: o.z });
  }
  const lava = hit && /lava/.test(hit.block.typeId);
  if ((!hit || lava) && now >= (c.flags.padAt ?? 0)) {
    // vazio ou lava: plataforma de nanorrobôs logo abaixo
    c.flags.padAt = now + 30;
    const y = Math.floor(o.y) - 3;
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) nano(c, dim, Math.floor(o.x) + x, y, Math.floor(o.z) + z, 15);
    try {
      owner.addEffect("slow_falling", 60, { amplifier: 0, showParticles: false });
    } catch {
      /* ignore */
    }
  }
}

/** Cuidados automáticos: luz no escuro, fôlego na água, apagar fogo, vida baixa. */
function careTick(c, owner) {
  const now = system.currentTick;
  const dim = owner.dimension;
  const h = owner.getHeadLocation();
  const hx = Math.floor(h.x), hy = Math.floor(h.y), hz = Math.floor(h.z);
  // luz que acompanha você no escuro (bloco de luz invisível)
  try {
    const L = c.flags.nanoLight;
    const head = dim.getBlock({ x: hx, y: hy, z: hz });
    const dark = head && (head.isAir || head.typeId === LIGHT) && head.getLightLevel() < 7;
    if (L && (L.x !== hx || L.y !== hy || L.z !== hz || !dark)) clearLight(c);
    if (dark && !c.flags.nanoLight && head.isAir) {
      head.setType(LIGHT);
      c.flags.nanoLight = { x: hx, y: hy, z: hz, d: dim.id };
    }
  } catch {
    /* ignore */
  }
  try {
    if (owner.isInWater && now >= (c.flags.breathAt ?? 0)) {
      c.flags.breathAt = now + 300;
      owner.addEffect("water_breathing", 400, { amplifier: 0, showParticles: false });
    }
    if (owner.getComponent("minecraft:onfire")) {
      owner.extinguishFire(true);
      owner.addEffect("fire_resistance", 120, { amplifier: 0, showParticles: false });
      particle(dim, "lila:nano_smoke", { x: owner.location.x, y: owner.location.y + 1, z: owner.location.z });
    }
    const hp = owner.getComponent("minecraft:health");
    if (hp && hp.currentValue <= 8 && now >= (c.flags.patchAt ?? 0)) {
      c.flags.patchAt = now + 600;
      owner.addEffect("absorption", 600, { amplifier: 1, showParticles: false });
      owner.addEffect("regeneration", 100, { amplifier: 1, showParticles: false });
      particle(dim, "lila:nano_form", { x: owner.location.x, y: owner.location.y + 1, z: owner.location.z });
      say(c, "Nanorrobôs remendando você!", { chatter: true });
    }
  } catch {
    /* ignore */
  }
}

function clearLight(c) {
  const L = c.flags.nanoLight;
  if (!L) return;
  c.flags.nanoLight = undefined;
  try {
    const b = c.dim().id === L.d ? c.dim().getBlock(L) : c.owner()?.dimension.getBlock(L);
    if (b?.typeId === LIGHT) b.setType("minecraft:air");
  } catch {
    /* ignore */
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
    stream(dim, { x: p.x, y: p.y + 0.6, z: p.z }, at, 2.2, 6);
    particle(dim, "lila:nano_smoke", at);
    try {
      t.applyDamage(t.id === c.flags.swarmTarget ? 10 : 6, { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity });
    } catch {
      /* ignore */
    }
  }
  if (now % 20 < 10) sound(c.entity, "mob.bee.aggressive", 0.6, 1.4);
}

// ------------------------------------------------------------------ asas e prancha
function moveInput(owner) {
  try {
    return owner.inputInfo.getMovementVector();
  } catch {
    return { x: 0, y: 0 };
  }
}

/** Asas enormes de nanorrobôs: voe para onde olha. */
function wingsTick(c, owner, pass) {
  const dim = owner.dimension;
  const o = owner.location;
  const yaw = owner.getRotation().y;
  const air = !owner.isOnGround;
  if (pass % 2 === 0) {
    const flap = (pass * (air ? 22 : 7)) % 360;
    fxv(dim, "lila:nano_wings", { x: o.x, y: o.y + 1.35, z: o.z }, { yaw, flap });
  }
  if (!air) return;
  const mv = moveInput(owner);
  const dir = owner.getViewDirection();
  const f = flat(yaw), s = right(f);
  try {
    if (owner.isSneaking) {
      owner.applyKnockback({ x: f.x * 0.3 * Math.max(0, mv.y), z: f.z * 0.3 * Math.max(0, mv.y) }, -0.12);
      return;
    }
    const sp = 0.62 + (owner.isSprinting ? 0.55 : 0);
    const fw = Math.max(0, mv.y);
    const hx = (f.x * fw + s.x * -mv.x * 0.7) * sp, hz = (f.z * fw + s.z * -mv.x * 0.7) * sp;
    let vy = fw > 0.1 ? dir.y * sp * 1.2 + 0.07 : 0.02;
    if (owner.isJumping) vy += 0.32;
    owner.applyKnockback({ x: hx, z: hz }, vy);
    if (pass % 16 === 0) dim.playSound("mob.enderdragon.flap", o, { volume: 0.25, pitch: 1.8 });
  } catch {
    /* ignore */
  }
}

/** Prancha voadora: mantém a altura, pular sobe, agachar desce. */
function boardTick(c, owner, pass) {
  const dim = owner.dimension;
  const o = owner.location;
  const yaw = owner.getRotation().y;
  if (c.flags.boardY === undefined) c.flags.boardY = o.y + 1.4;
  if (owner.isJumping) c.flags.boardY += 0.32;
  if (owner.isSneaking) c.flags.boardY -= 0.32;
  // nunca abaixo do chão (sobe junto com morros)
  try {
    const hit = dim.getBlockFromRay({ x: o.x, y: o.y + 0.5, z: o.z }, { x: 0, y: -1, z: 0 }, { maxDistance: 6, includeLiquidBlocks: true });
    if (hit) c.flags.boardY = Math.max(c.flags.boardY, hit.block.location.y + 1.25);
  } catch {
    /* ignore */
  }
  if (pass % 2 === 0) fxv(dim, "lila:nano_board", { x: o.x, y: o.y - 0.15, z: o.z }, { yaw, size: 1 });
  const mv = moveInput(owner);
  const f = flat(yaw), s = right(f);
  const sp = 0.7 + (owner.isSprinting ? 0.6 : 0);
  const hx = (f.x * mv.y + s.x * -mv.x * 0.8) * sp, hz = (f.z * mv.y + s.z * -mv.x * 0.8) * sp;
  const vy = Math.max(-0.5, Math.min(0.6, (c.flags.boardY - o.y) * 0.35)) + 0.08;
  try {
    owner.applyKnockback({ x: hx, z: hz }, vy);
    if (pass % 30 === 0) dim.playSound("mob.bee.loop", o, { volume: 0.3, pitch: 2 });
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ mãos gigantes
function handBase(owner, side, pass) {
  const o = owner.location;
  const f = flat(owner.getRotation().y), s = right(f);
  const bob = Math.sin((pass + side * 10) * 0.12) * 0.25;
  return { x: o.x - f.x * 1.5 + s.x * side * 1.9, y: o.y + 2.5 + bob, z: o.z - f.z * 1.5 + s.z * side * 1.9 };
}

function handsTick(c, owner, pass) {
  const dim = owner.dimension;
  const yaw = owner.getRotation().y;
  const P = c.flags.punch;
  const now = system.currentTick;
  for (const side of [-1, 1]) {
    let at = handBase(owner, side, pass);
    if (P && P.side === side) {
      const k = (now - P.t0) / 5; // 0→1 vai, 1→2 volta
      const e = k < 1 ? 1 - (1 - k) ** 3 : Math.max(0, 1 - (k - 1));
      at = { x: at.x + (P.to.x - at.x) * e, y: at.y + (P.to.y - at.y) * e, z: at.z + (P.to.z - at.z) * e };
      if (k >= 1 && !P.hit) {
        P.hit = true;
        punchHit(c, owner, P);
      }
      if (k >= 2) c.flags.punch = undefined;
      fxv(dim, "lila:nano_hand", at, { yaw, size: 1.25 });
    } else if (pass % 2 === 0) fxv(dim, "lila:nano_hand", at, { yaw, size: 1.1 });
  }
}

/** Bateu com as mãos gigantes: a mão do lado da vez dispara até onde você olha. */
export function nanoSwing(c, owner) {
  if (modeOf(c) !== "maos" || c.flags.punch) return;
  const head = owner.getHeadLocation();
  const dir = owner.getViewDirection();
  let to = { x: head.x + dir.x * 12, y: head.y + dir.y * 12, z: head.z + dir.z * 12 };
  try {
    const t = owner.dimension.getEntitiesFromRay(head, dir, { maxDistance: 14 }).map((h) => h.entity)
      .find((x) => x.id !== owner.id && x.id !== c.entity?.id && !SKIP.has(x.typeId));
    if (t) to = { x: t.location.x, y: t.location.y + 1, z: t.location.z };
    else {
      const hit = owner.dimension.getBlockFromRay(head, dir, { maxDistance: 14 });
      if (hit) to = { x: hit.block.location.x + 0.5, y: hit.block.location.y + 0.5, z: hit.block.location.z + 0.5 };
    }
  } catch {
    /* ignore */
  }
  c.flags.punchSide = -(c.flags.punchSide ?? 1);
  c.flags.punch = { side: c.flags.punchSide, t0: system.currentTick, to, dir, hit: false };
  try {
    owner.dimension.playSound("mob.bee.aggressive", owner.location, { volume: 0.6, pitch: 0.7 });
  } catch {
    /* ignore */
  }
}

function punchHit(c, owner, P) {
  const dim = owner.dimension;
  let n = 0;
  try {
    for (const t of dim.getEntities({ location: P.to, maxDistance: 3 })) {
      if (t.id === owner.id || t.id === c.entity?.id || SKIP.has(t.typeId)) continue;
      if (t.typeId === "minecraft:player" && !c.flags.aggro?.has(t.id)) continue;
      t.applyDamage(22, { cause: EntityDamageCause.entityAttack, damagingEntity: owner });
      t.applyKnockback({ x: P.dir.x * 2.4, z: P.dir.z * 2.4 }, 0.6);
      n++;
    }
  } catch {
    /* ignore */
  }
  if (!n && c.rec.settings.destroy !== false) smash(dim, P.to, 1.6);
  particle(dim, "lila:dust", P.to);
  particle(dim, "lila:nano_smoke", P.to);
  try {
    dim.playSound("random.explode", P.to, { volume: 0.5, pitch: 1.6 });
    dim.playSound("lila.stomp", P.to, { volume: 0.7, pitch: 1.5 });
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ devorador
function devourTick(c, owner, pass) {
  if (c.rec.settings.destroy === false) {
    if (!c.flags.devourWarned) {
      c.flags.devourWarned = true;
      say(c, "O devorador precisa de \"pode destruir\" ligado (Configurações).", { force: true });
    }
    return;
  }
  const dim = owner.dimension;
  const o = owner.location;
  const fx = Math.floor(o.x), fy = Math.floor(o.y), fz = Math.floor(o.z);
  const last = c.flags.devourAt;
  const moved = !last || Math.abs(last.x - o.x) + Math.abs(last.z - o.z) + Math.abs(last.y - o.y) > 0.6;
  if (!moved && pass % 15 !== 0) return;
  c.flags.devourAt = { x: o.x, y: o.y, z: o.z };
  const down = owner.isSneaking ? 2 : 0;
  let n = 0;
  try {
    const vol = new BlockVolume({ x: fx - 2, y: fy - down, z: fz - 2 }, { x: fx + 2, y: fy + 3, z: fz + 2 });
    n = dim.fillBlocks(vol, "minecraft:air", { blockFilter: { excludeTypes: NO_EAT } }).getCapacity();
  } catch {
    /* ignore */
  }
  if (n > 0) {
    c.flags.devoured = (c.flags.devoured ?? 0) + n;
    const f = flat(owner.getRotation().y);
    particle(dim, "lila:nano_smoke", { x: o.x + f.x * 2, y: o.y + 1, z: o.z + f.z * 2 });
    if (pass % 6 === 0) dim.playSound("random.eat", o, { volume: 0.35, pitch: 0.55 + Math.random() * 0.2 });
  }
  if (pass % 12 === 0) {
    try {
      for (const t of dim.getEntities({ location: o, maxDistance: 6 })) {
        if (t.typeId === "minecraft:item" || t.typeId === "minecraft:xp_orb") t.teleport(o);
        else if (t.id !== owner.id && !SKIP.has(t.typeId) && t.typeId !== "minecraft:player" && isHostile(t)) {
          t.applyDamage(6, { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity });
          particle(dim, "lila:nano_smoke", t.location);
        }
      }
    } catch {
      /* ignore */
    }
  }
}

// ------------------------------------------------------------------ ferramentas de nanorrobô
/** Qual ferramenta o bloco pede. */
export function toolFor(id) {
  const n = String(id).replace("minecraft:", "");
  if (/log|_wood|stem|hyphae|planks|bamboo|fence|chest|barrel|bookshelf|crafting_table|ladder|door|trapdoor|sign|mushroom_block|melon|pumpkin|campfire|composter|lectern|loom|beehive|bee_nest|note_block|jukebox/.test(n)) return "axe";
  if (/leaves|hay|wart_block|sponge|moss|vine|sculk|target|dried_kelp|wheat|carrots|potatoes|beetroot|crop|azalea|grass$|short_grass|tall_grass|fern|flower|tulip|sapling|bush/.test(n)) return "hoe";
  if (/dirt|grass_block|sand|gravel|clay|snow|soul_soil|soul_sand|mud|farmland|podzol|mycelium|concrete_powder|grass_path|dirt_path|suspicious/.test(n)) return "shovel";
  return "pickaxe";
}

/** Os nanorrobôs se juntam na sua mão e viram a ferramenta (some quando você larga de usar). */
export function formTool(c, owner, kind, why = "") {
  const now = system.currentTick;
  if (now < (c.flags.formingUntil ?? 0)) return false;
  const id = NANO_ITEMS[kind];
  if (!id) return false;
  const ct = owner.getComponent("minecraft:inventory")?.container;
  if (!ct) return false;
  let slot = owner.selectedSlotIndex;
  const held = ct.getItem(slot);
  if (held?.typeId === id) return true;
  if (held && !isNanoItem(held.typeId)) {
    // mão ocupada (pedido por voz/controle): vai para o primeiro espaço livre da barra
    slot = -1;
    for (let i = 0; i < 9; i++) {
      if (!ct.getItem(i)) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      if (why === "ask") say(c, "Sua barra está cheia: libere um espaço que eu formo a ferramenta.", { force: true });
      return false;
    }
  }
  c.flags.formingUntil = now + 8;
  const dim = owner.dimension;
  const hp = handPos(owner);
  stream(dim, c.pos(), hp, 1.4, 8);
  particle(dim, "lila:nano_form", hp);
  try {
    dim.playSound("lila.split", hp, { volume: 0.45, pitch: 1.9 });
    dim.playSound("mob.bee.loop", hp, { volume: 0.5, pitch: 1.4 });
  } catch {
    /* ignore */
  }
  const target = slot;
  system.runTimeout(() => {
    try {
      if (!owner.isValid || modeOf(c) === "off") return;
      const cur = ct.getItem(target);
      if (cur && !isNanoItem(cur.typeId)) return;
      ct.setItem(target, new ItemStack(id, 1));
      (c.flags.nanoHeld ??= {})[id] = system.currentTick;
      particle(dim, "lila:nano_point", handPos(owner));
      dim.playSound("random.anvil_land", owner.location, { volume: 0.12, pitch: 2 });
      bar(owner, `§b⬢ ${TOOL_NAMES[kind]} de nanorrobôs${kind === "hammer" ? " §7(use para arremessar)" : ""}`);
    } catch {
      /* ignore */
    }
  }, 5);
  return true;
}

/** Você começou a bater num bloco: mão vazia → os nanorrobôs viram a ferramenta certa. */
export function nanoHitBlock(c, owner, block) {
  if (modeOf(c) === "off" || modeOf(c) === "devorador" || !block) return;
  const ct = owner.getComponent("minecraft:inventory")?.container;
  const held = ct?.getItem(owner.selectedSlotIndex);
  if (held && (!isNanoItem(held.typeId) || held.typeId === NANO_ITEMS.hammer || held.typeId === NANO_ITEMS.core)) return;
  const kind = toolFor(block.typeId);
  if (held?.typeId === NANO_ITEMS[kind]) return;
  formTool(c, owner, kind);
}

/** Você bateu num bicho: mão vazia → espada; com a espada → corte em área de nanorrobôs. */
export function nanoHitEntity(c, owner, target) {
  if (modeOf(c) === "off" || !target?.isValid || SKIP.has(target.typeId)) return;
  const ct = owner.getComponent("minecraft:inventory")?.container;
  const held = ct?.getItem(owner.selectedSlotIndex);
  if (!held || (isNanoItem(held.typeId) && held.typeId !== NANO_ITEMS.sword && held.typeId !== NANO_ITEMS.core && held.typeId !== NANO_ITEMS.hammer)) {
    formTool(c, owner, "sword");
    return;
  }
  if (held.typeId !== NANO_ITEMS.sword) return;
  (c.flags.nanoHeld ??= {})[held.typeId] = system.currentTick;
  const dim = owner.dimension;
  const at = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
  particle(dim, "lila:nano_slash", at);
  try {
    for (const t of dim.getEntities({ location: at, maxDistance: 3 })) {
      if (t.id === owner.id || t.id === target.id || t.id === c.entity?.id || SKIP.has(t.typeId) || t.typeId === "minecraft:player") continue;
      if (!isHostile(t) && !c.flags.aggro?.has(t.id)) continue;
      t.applyDamage(9, { cause: EntityDamageCause.entityAttack, damagingEntity: owner });
    }
    const dx = target.location.x - owner.location.x, dz = target.location.z - owner.location.z, l = Math.hypot(dx, dz) || 1;
    target.applyKnockback({ x: (dx / l) * 1.1, z: (dz / l) * 1.1 }, 0.3);
    dim.playSound("item.trident.riptide_1", at, { volume: 0.35, pitch: 1.8 });
  } catch {
    /* ignore */
  }
}

/** Quebrou um bloco com ferramenta de nanorrobô: árvore inteira, veio inteiro, túnel 3×3. */
export function nanoBreak(c, owner, block, brokenId, tool) {
  if (!tool || !isNanoItem(tool.typeId)) return;
  (c.flags.nanoHeld ??= {})[tool.typeId] = system.currentTick;
  const at = block.location;
  const q = (c.flags.breakQ ??= []);
  if (q.length > 300) return;
  const dim = block.dimension;
  const add = (x, y, z, id) => q.push({ x, y, z, id, d: dim.id });
  if (tool.typeId === NANO_ITEMS.axe && /log|stem|_wood|hyphae/.test(brokenId)) {
    // derruba a árvore: todos os troncos ligados (diagonais também)
    const seen = new Set([`${at.x},${at.y},${at.z}`]);
    const open = [at];
    while (open.length && seen.size < 260) {
      const p = open.shift();
      for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const k = `${p.x + dx},${p.y + dy},${p.z + dz}`;
        if (seen.has(k)) continue;
        seen.add(k);
        try {
          const b = dim.getBlock({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
          if (b && /log|stem|_wood|hyphae/.test(b.typeId)) {
            add(b.x, b.y, b.z, b.typeId);
            open.push(b.location);
          }
        } catch {
          /* ignore */
        }
      }
    }
    q.sort((a, b) => a.y - b.y);
  } else if (tool.typeId === NANO_ITEMS.pickaxe && /_ore$|ancient_debris|raw_.*_block|amethyst_cluster/.test(brokenId)) {
    // veio inteiro de minério
    const seen = new Set([`${at.x},${at.y},${at.z}`]);
    const open = [at];
    while (open.length && seen.size < 96) {
      const p = open.shift();
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const k = `${p.x + dx},${p.y + dy},${p.z + dz}`;
        if (seen.has(k)) continue;
        seen.add(k);
        try {
          const b = dim.getBlock({ x: p.x + dx, y: p.y + dy, z: p.z + dz });
          if (b?.typeId === brokenId) {
            add(b.x, b.y, b.z, b.typeId);
            open.push(b.location);
          }
        } catch {
          /* ignore */
        }
      }
    }
  } else if (tool.typeId === NANO_ITEMS.pickaxe || tool.typeId === NANO_ITEMS.shovel) {
    // túnel 3×3 na face que você está olhando
    const v = owner.getViewDirection();
    const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
    const want = tool.typeId === NANO_ITEMS.shovel ? "shovel" : "pickaxe";
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!a && !b) continue;
      const p = ay > ax && ay > az ? { x: at.x + a, y: at.y, z: at.z + b } : ax > az ? { x: at.x, y: at.y + a, z: at.z + b } : { x: at.x + a, y: at.y + b, z: at.z };
      try {
        const bl = dim.getBlock(p);
        if (bl && !bl.isAir && !bl.isLiquid && !UNBREAKABLE.has(bl.typeId) && !CONTAINER_IDS.includes(bl.typeId) && toolFor(bl.typeId) === want) add(p.x, p.y, p.z, bl.typeId);
      } catch {
        /* ignore */
      }
    }
  } else if (tool.typeId === NANO_ITEMS.hoe) {
    for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
      try {
        const bl = dim.getBlock({ x: at.x + dx, y: at.y + dy, z: at.z + dz });
        if (bl && !bl.isAir && /leaves|short_grass|tall_grass|fern|vine|deadbush|bush|azalea|wart_block|hay/.test(bl.typeId)) add(bl.x, bl.y, bl.z, bl.typeId);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Quebra a fila aos poucos (cascata bonita, sem travar): 6 blocos por tick, com os drops. */
function breakTick(c, owner) {
  const q = c.flags.breakQ;
  const dim = owner.dimension;
  for (let k = 0; k < 6 && q.length; k++) {
    const t = q.shift();
    if (t.d !== dim.id) continue;
    try {
      const b = dim.getBlock(t);
      if (!b || b.typeId !== t.id) continue;
      dim.runCommand(`setblock ${t.x} ${t.y} ${t.z} air destroy`);
      if ((q.length & 3) === 0) particle(dim, "lila:nano_point", { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
    } catch {
      /* ignore */
    }
  }
}

/** Brilhinho na mão enquanto segura algo de nanorrobô, e ferramentas esquecidas se desmancham. */
function heldTick(c, owner, pass) {
  const ct = owner.getComponent("minecraft:inventory")?.container;
  if (!ct) return;
  const now = system.currentTick;
  const held = ct.getItem(owner.selectedSlotIndex);
  const H = (c.flags.nanoHeld ??= {});
  if (held && isNanoItem(held.typeId)) {
    H[held.typeId] = now;
    if (held.typeId !== NANO_ITEMS.core) particle(owner.dimension, "lila:nano_point", handPos(owner));
    else if (pass % 20 === 2) bar(owner, `§b⬢ Enxame: §l${MODE_NAMES[modeOf(c)]}§r §7— use para trocar (agachado volta)`);
  }
  if (pass % 20 !== 2) return;
  for (let i = 0; i < ct.size; i++) {
    const it = ct.getItem(i);
    if (!it || !isNanoItem(it.typeId) || it.typeId === NANO_ITEMS.core || i === owner.selectedSlotIndex) continue;
    if (now - (H[it.typeId] ?? 0) < 300) continue;
    try {
      ct.setItem(i, undefined); // ninguém usou faz 15 s: os nanorrobôs voltam para o enxame
      particle(owner.dimension, "lila:nano_smoke", { x: owner.location.x, y: owner.location.y + 1, z: owner.location.z });
    } catch {
      /* ignore */
    }
  }
}

/** Item de nanorrobô caiu no chão: se desfaz na hora. */
export function nanoDropped(item) {
  try {
    const st = item.getComponent("minecraft:item")?.itemStack;
    if (!st || !isNanoItem(st.typeId)) return;
    particle(item.dimension, "lila:nano_smoke", item.location);
    item.remove();
  } catch {
    /* ignore */
  }
}

/** Usou o núcleo (troca de modo) ou o martelo (arremesso). */
export function nanoUse(c, owner, stack) {
  if (modeOf(c) === "off") return;
  if (stack.typeId === NANO_ITEMS.core) {
    const i = NANO_MODES.indexOf(modeOf(c));
    const next = NANO_MODES[(i + (owner.isSneaking ? NANO_MODES.length - 1 : 1)) % NANO_MODES.length];
    setNanoMode(c, next, owner);
    return;
  }
  if (stack.typeId === NANO_ITEMS.hammer) throwHammer(c, owner);
}

// ------------------------------------------------------------------ martelo
function throwHammer(c, owner) {
  if (c.flags.hammer) return;
  const ct = owner.getComponent("minecraft:inventory")?.container;
  const slot = owner.selectedSlotIndex;
  if (ct?.getItem(slot)?.typeId !== NANO_ITEMS.hammer) return;
  ct.setItem(slot, undefined);
  const h = owner.getHeadLocation();
  const dir = owner.getViewDirection();
  c.flags.hammer = { pos: { x: h.x + dir.x, y: h.y + dir.y, z: h.z + dir.z }, dir, back: false, t: 0, slot, dist: 0 };
  try {
    owner.dimension.playSound("item.trident.throw", h, { volume: 0.8, pitch: 0.7 });
  } catch {
    /* ignore */
  }
}

function hammerTick(c, owner) {
  const H = c.flags.hammer;
  const dim = owner.dimension;
  H.t++;
  if (!H.back) {
    for (let k = 0; k < 3 && !H.back; k++) {
      H.pos = { x: H.pos.x + H.dir.x * 0.6, y: H.pos.y + H.dir.y * 0.6, z: H.pos.z + H.dir.z * 0.6 };
      H.dist += 0.6;
      let boom = H.dist > 42;
      try {
        const b = dim.getBlock({ x: Math.floor(H.pos.x), y: Math.floor(H.pos.y), z: Math.floor(H.pos.z) });
        if (!b) boom = true;
        else if (b.isSolid) boom = true;
        if (!boom) {
          boom = dim.getEntities({ location: H.pos, maxDistance: 1.4 }).some((t) => t.id !== owner.id && t.id !== c.entity?.id && !SKIP.has(t.typeId));
        }
      } catch {
        boom = true;
      }
      if (boom) {
        H.back = true;
        c.flags.hammerSafe = system.currentTick + 10;
        try {
          dim.createExplosion(H.pos, 3, { breaksBlocks: c.rec.settings.destroy !== false, causesFire: false, source: c.entity });
        } catch {
          /* ignore */
        }
        particle(dim, "lila:nano_smoke", H.pos);
        particle(dim, "lila:shock", H.pos);
      }
    }
  } else {
    const hp = handPos(owner);
    const dx = hp.x - H.pos.x, dy = hp.y - H.pos.y, dz = hp.z - H.pos.z;
    const d = Math.hypot(dx, dy, dz);
    const sp = Math.min(d, 1.2 + H.t * 0.04);
    H.pos = { x: H.pos.x + (dx / (d || 1)) * sp, y: H.pos.y + (dy / (d || 1)) * sp, z: H.pos.z + (dz / (d || 1)) * sp };
    if (d < 1.3 || H.t > 200) {
      c.flags.hammer = undefined;
      const ct = owner.getComponent("minecraft:inventory")?.container;
      if (ct) {
        const slot = !ct.getItem(H.slot) ? H.slot : !ct.getItem(owner.selectedSlotIndex) ? owner.selectedSlotIndex : -1;
        if (slot >= 0) ct.setItem(slot, new ItemStack(NANO_ITEMS.hammer, 1));
        else ct.addItem(new ItemStack(NANO_ITEMS.hammer, 1));
        (c.flags.nanoHeld ??= {})[NANO_ITEMS.hammer] = system.currentTick;
      }
      try {
        dim.playSound("random.anvil_land", hp, { volume: 0.25, pitch: 1.6 });
      } catch {
        /* ignore */
      }
      return;
    }
  }
  particle(dim, "lila:nano_ball", H.pos);
  if (H.t % 6 === 0) {
    try {
      dim.playSound("item.trident.riptide_1", H.pos, { volume: 0.3, pitch: 1.9 });
    } catch {
      /* ignore */
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
        if (n % 8 === 0) particle(dim, "lila:nano_point", { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
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
  clearLight(c);
  c.flags.shape = undefined;
  c.flags.swarmTarget = undefined;
  c.flags.wingsUntil = 0;
}

// ------------------------------------------------------------------ formas e pedidos
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

const MODE_SHAPES = { escudo: "escudo", asas: "asas", prancha: "prancha", maos: "maos", devorador: "devorador", auto: "auto" };
const TOOL_SHAPES = { espada: "sword", machado: "axe", picareta: "pickaxe", pa: "shovel", enxada: "hoe", martelo: "hammer" };

/**
 * Executa um pedido ao enxame: modo, ferramenta ou forma.
 * @param {Companion} c
 * @param {string} kind
 */
export function doShape(c, kind, owner = c.owner()) {
  if (!owner || !c.alive() || c.rec.form !== "swarm") return false;
  if (!c.flags.nanoActive) startSwarm(c, owner);
  if (MODE_SHAPES[kind]) {
    // "escudo" de novo com o escudo ligado: desliga (volta ao inteligente)
    const m = kind === "escudo" && modeOf(c) === "escudo" ? "auto" : MODE_SHAPES[kind];
    setNanoMode(c, m, owner);
    say(c, `Enxame: ${MODE_NAMES[m]}. ${MODE_HELP[m][0].toUpperCase()}${MODE_HELP[m].slice(1)}.`, { force: true });
    return true;
  }
  if (TOOL_SHAPES[kind]) return formTool(c, owner, TOOL_SHAPES[kind], "ask");
  const dim = owner.dimension;
  const o = owner.location;
  const f = flat(owner.getRotation().y);
  const side = right(f);
  const now = system.currentTick;
  const fx = Math.floor(o.x), fy = Math.floor(o.y), fz = Math.floor(o.z);
  sound(c.entity, "mob.bee.aggressive", 1, 1.2);
  sound(c.entity, "lila.split", 0.6, 1.6);
  switch (kind) {
    case "muralha": {
      for (let row = 0; row < 5; row++) {
        system.runTimeout(() => {
          for (let k = -6; k <= 6; k++) {
            const x = Math.floor(o.x + f.x * 4 + side.x * k), z = Math.floor(o.z + f.z * 4 + side.z * k);
            nano(c, dim, x, fy + row, z, 60);
            if (k % 4 === 0) particle(dim, "lila:nano_point", { x: x + 0.5, y: fy + row + 0.5, z: z + 0.5 });
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
          if (i % 2 === 0) particle(dim, "lila:nano_point", { x: o.x + f.x * i, y: fy, z: o.z + f.z * i });
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
          if (i % 2 === 0) particle(dim, "lila:nano_point", { x: o.x + f.x * i, y: fy + i, z: o.z + f.z * i });
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
          particle(dim, "lila:nano_smoke", { x: o.x, y: o.y + y, z: o.z });
        }, y * 2);
      }
      say(c, "Cúpula de nanorrobôs em volta de você (com porta na frente, dura 90 s).", { force: true });
      return true;
    }
    case "punho":
      c.flags.shape = { kind: "punho", t0: now, until: now + 22, at: aim(owner, 64) };
      say(c, "PUNHO GIGANTE!", { force: true });
      return true;
    case "giro":
      c.flags.shape = { kind: "giro", t0: now, until: now + 120 };
      say(c, "Lâmina de enxame girando em volta de você!", { force: true });
      return true;
    case "tornado": {
      const at = aim(owner, 40);
      c.flags.shape = { kind: "tornado", t0: now, until: now + 200, at };
      say(c, "TORNADO de nanorrobôs!", { force: true });
      return true;
    }
    case "elevador":
      try {
        owner.addEffect("levitation", 60, { amplifier: 2, showParticles: false });
        system.runTimeout(() => owner.isValid && owner.addEffect("slow_falling", 300, { amplifier: 0, showParticles: false }), 55);
      } catch {
        /* ignore */
      }
      for (let k = 0; k < 6; k++) system.runTimeout(() => owner.isValid && particle(dim, "lila:nano_ring", owner.location), k * 10);
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
      fxv(dim, "lila:nano_hand", { x: s.at.x, y: s.at.y + h + 2, z: s.at.z }, { yaw: owner.getRotation().y, size: 3.2 });
      if (pass % 4 === 0) stream(dim, c.pos(), { x: s.at.x, y: s.at.y + h + 2, z: s.at.z }, 3, 5);
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
  } else if (s.kind === "giro") {
    const o = owner.location;
    if (pass % 2 === 0) {
      const a = (t * 36 * Math.PI) / 180;
      for (let r = 1.5; r <= 7; r += 1.1) particle(dim, "lila:nano_point", { x: o.x + Math.cos(a) * r, y: o.y + 1.1, z: o.z + Math.sin(a) * r });
    }
    if (t % 10 === 0) {
      areaDamage(c, { x: o.x, y: o.y + 1, z: o.z }, 7.5, 12, 1.2, 0.3);
      sound(c.entity, "item.trident.riptide_1", 0.8, 1.6);
    }
  } else if (s.kind === "tornado") {
    if (pass % 3 === 0) {
      for (let h = 0; h <= 14; h += 2) {
        const r = 1 + h * 0.35;
        for (let k = 0; k < 3; k++) {
          const a = ((t * 25 + h * 30 + k * 120) * Math.PI) / 180;
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
