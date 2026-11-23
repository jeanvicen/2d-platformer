// Passivas, pontos fracos e poderes únicos (morcego, dreno, rajada 5×, super pulo, voo) das raças.
// Um laço por tick só sobre jogadores COM raça; o resto é por evento (dano, morte, renascer).
import { EntityDamageCause, system, world } from "@minecraft/server";
import * as V from "./vfx.js";
import { SIG_HOOK, sigAfterHit, sigDamage, sigLethal } from "./signature.js";
import { BY_RACE } from "./catalog.js";
import { BAL, RACES } from "./data.js";
import { saveState, stateOf } from "./state.js";
import { FX, SPECIAL_RUN, THORNS, cast, fx, heal, setPose, canHit } from "./engine.js";

/** Passivas por raça (todas ativas para quem é da raça): chave → parâmetro p/r. */
export const PASS = Object.fromEntries(Object.entries(BY_RACE).map(([r, list]) => [r, new Map(list.filter((a) => a.passive).map((a) => [a.passive, a.p.p ?? a.p.r ?? 0]))]));
export const hasPass = (race, k) => !!race && PASS[race]?.has(k);
const passVal = (race, k) => PASS[race]?.get(k) ?? 0;

const DRAIN = new Map();
export const DRAIN_STOP = { why: "" };
const BAT_FORMS = new Set();

const v3 = (x, y, z) => ({ x, y, z });
function eff(p, name, ticks, amp = 0) {
  try {
    p.addEffect(name, ticks, { amplifier: amp, showParticles: false });
  } catch {
    /* ignore */
  }
}
function prop(p, k, v) {
  try {
    if (p.getProperty(k) !== v) p.setProperty(k, v);
  } catch {
    /* sem o pacote do jogador */
  }
}
export const TRIGGER_LOG = [];
function trigger(p, ev) {
  // jogador: o caminho garantido é o comando /event (triggerEvent pode não valer para jogadores)
  try {
    p.runCommand(`event entity @s ${ev}`);
  } catch (e) {
    TRIGGER_LOG.push(`cmd ${ev}: ${e}`);
    try {
      p.triggerEvent(ev);
    } catch (e2) {
      TRIGGER_LOG.push(`trigger ${ev}: ${e2}`);
    }
  }
}
const isDay = () => {
  const t = world.getTimeOfDay();
  return t < 12500 || t > 23400;
};
function sky(p) {
  try {
    if (p.dimension.id !== "minecraft:overworld") return false;
    const h = p.getHeadLocation();
    const top = p.dimension.getTopmostBlock({ x: h.x, z: h.z });
    return !top || top.y < Math.floor(h.y);
  } catch {
    return false;
  }
}
function raining(p) {
  try {
    return p.dimension.getWeather() !== "Clear";
  } catch {
    return false;
  }
}
/** Sol direto: overworld, de dia, sem chuva, céu aberto acima da cabeça. */
export const directSun = (p) => isDay() && !raining(p) && sky(p);
function hasHelmet(p) {
  try {
    return !!p.getComponent("minecraft:equippable")?.getEquipment(/** @type {any} */ ("Head"));
  } catch {
    return false;
  }
}
const health = (p) => {
  try {
    return p.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
};

// ------------------------------------------------------------------ aplicar a raça no corpo
/** Põe a raça no corpo: propriedades (o cliente desenha asas/auréola/coroa), escala, efeitos. */
export function applyBody(player) {
  const s = stateOf(player);
  const n = s.race ? RACES[s.race].n : 0;
  prop(player, "lila:race", n);
  prop(player, "lila:wing", s.race === "god" || s.race === "dark" ? BAL.wingMax : s.wing);
  prop(player, "lila:bat", !!s.tog.bat && s.race === "vampire");
  prop(player, "lila:fly", false);
  trigger(player, s.race === "giant" ? "lila:giant_on" : "lila:giant_off");
  trigger(player, s.tog.bat && s.race === "vampire" ? "lila:bat_on" : "lila:bat_off");
  if (s.race !== "vampire") BAT_FORMS.delete(player.id);
  if (BAL.speedAmp[s.race] !== undefined) eff(player, "speed", 220, BAL.speedAmp[s.race]);
  giantCamera(player, s.race === "giant" && !s.tog.giantCamOff);
}

/**
 * Câmera do GIGANTE em primeira pessoa na altura dos olhos dele (≈ 7,3 blocos do chão).
 * O Bedrock não sobe a câmera de um jogador escalado, então usamos o preset "lila:giant_eye"
 * (follow_orbit com raio mínimo 0,1 = praticamente dentro dos olhos) com o ponto de apoio
 * levantado. A cabeça do próprio gigante some SÓ na tela dele (q.is_local_player no pacote de
 * recursos), para ele não ver o lado de dentro da cabeça; os outros veem o gigante inteiro.
 */
export const GIANT_CAM = "lila:giant_eye";
export const GIANT_EYE_BASE = 5.7; // acima do ponto do jogador (olhos normais 1,62 → olhos do gigante 7,3)
export const CAM_LOG = [];
export const MEGA_EYE_EXTRA = 2.9; // Fúria Titânica (escala 6,3): olhos ≈ 10,2 blocos
SIG_HOOK.cam = (p) => {
  const st = stateOf(p);
  giantCamera(p, st.race === "giant" && !st.tog.giantCamOff);
};
export function giantCamera(player, on) {
  const s = stateOf(player);
  const y = GIANT_EYE_BASE + (s.eye || 0) + (s.tog.mega ? MEGA_EYE_EXTRA : 0);
  if (on) {
    try {
      player.camera.setCamera(GIANT_CAM, { entityOffset: { x: 0, y, z: 0 } });
    } catch (e) {
      CAM_LOG.push(`preset: ${e}`);
      try {
        player.camera.setCamera("minecraft:follow_orbit", { entityOffset: { x: 0, y, z: 0 } });
      } catch (e2) {
        CAM_LOG.push(`follow_orbit: ${e2}`);
      }
    }
    prop(player, "lila:eyecam", true);
    s.tog.giantCam = true;
  } else {
    prop(player, "lila:eyecam", false);
    if (s.tog.giantCam) {
      try {
        player.camera.clear();
      } catch {
        /* ignore */
      }
    }
    s.tog.giantCam = false;
  }
}

/** Tira o que era da raça antiga (efeitos que só ela dava). */
export function clearBody(player) {
  for (const n of ["speed", "night_vision", "fire_resistance", "slow_falling", "levitation"]) {
    try {
      player.removeEffect(n);
    } catch {
      /* ignore */
    }
  }
  DRAIN.delete(player.id);
  BAT_FORMS.delete(player.id);
}

// ------------------------------------------------------------------ poderes únicos
SPECIAL_RUN.bat = (ctx) => {
  const { player, s } = ctx;
  s.tog.bat = !s.tog.bat;
  if (s.tog.bat) {
    BAT_FORMS.add(player.id);
    s.tog.fly = false;
  } else BAT_FORMS.delete(player.id);
  applyBody(player);
  fx(player.dimension, "lila:rc_bats", v3(player.location.x, player.location.y + 1, player.location.z));
  try {
    player.dimension.playSound(s.tog.bat ? "mob.bat.takeoff" : "mob.bat.death", player.location, { volume: 1, pitch: 1.2 });
  } catch {
    /* ignore */
  }
  if (!s.tog.bat) eff(player, "slow_falling", 60, 0);
  ctx.msg = s.tog.bat ? "forma de morcego (imune ao sol)" : "forma normal";
  ctx.touched = 1;
};
SPECIAL_RUN.drain = (ctx) => {
  if (!startDrain(ctx.player)) return "Mire numa criatura bem perto para sugar.";
  ctx.touched = 1;
  ctx.msg = "sugando... (solte para parar)";
};
SPECIAL_RUN.sprint5x = (ctx) => {
  ctx.s.tog.sprintUntil = system.currentTick + (ctx.a.p.dur ?? 160);
  eff(ctx.player, "speed", ctx.a.p.dur ?? 160, BAL.vampireSprintAmp);
  fx(ctx.player.dimension, FX.vampire.zone, ctx.player.location, { size: 2 });
  ctx.msg = "5× mais rápido";
  ctx.touched = 1;
};
SPECIAL_RUN.superjump = (ctx) => {
  const d = ctx.player.getViewDirection();
  const l = Math.hypot(d.x, d.z) || 1;
  try {
    ctx.player.applyKnockback({ x: (d.x / l) * 0.8, z: (d.z / l) * 0.8 }, 2.4);
  } catch {
    /* ignore */
  }
  ctx.s.tog.safeFallUntil = system.currentTick + 120;
  fx(ctx.player.dimension, FX[ctx.race].burst, ctx.player.location);
  ctx.touched = 1;
};
SPECIAL_RUN.flight = (ctx) => {
  const { player, s } = ctx;
  if (s.tog.bat) return "Saia da forma de morcego primeiro.";
  s.tog.fly = !s.tog.fly;
  if (s.tog.fly) {
    try {
      player.applyKnockback({ x: 0, z: 0 }, 0.9);
    } catch {
      /* ignore */
    }
    fx(player.dimension, FX[ctx.race].zone, player.location, { size: 2 });
  } else eff(player, "slow_falling", 100, 0);
  ctx.msg = s.tog.fly ? "voo LIGADO — olhe e ande para voar, pule sobe, agache desce" : "voo desligado";
  ctx.touched = 1;
};

/** Dreno: começa quando você segura o Núcleo mirando numa criatura perto. */
export function startDrain(player) {
  const s = stateOf(player);
  if (s.race !== "vampire" || s.tog.bat) return false;
  let t;
  try {
    t = player.dimension.getEntitiesFromRay(player.getHeadLocation(), player.getViewDirection(), { maxDistance: BAL.drainRange })
      .map((h) => h.entity).find((e) => canHit(player, e));
  } catch {
    /* ignore */
  }
  if (!t) return false;
  DRAIN.set(player.id, { t, next: system.currentTick });
  setPose(player, "drain", 400);
  try {
    player.onScreenDisplay.setActionBar("§4◆ Sugando sangue... (solte para parar)");
  } catch {
    /* ignore */
  }
  return true;
}
export function stopDrain(player) {
  if (!DRAIN.delete(player.id)) return;
  setPose(player, "none", 1);
}
export const draining = (player) => DRAIN.has(player.id);

function drainTick(player, d, tick) {
  if (tick < d.next) return;
  d.next = tick + BAL.drainEvery;
  const t = d.t;
  const s = stateOf(player);
  const head = player.getHeadLocation();
  const stop = (why = "?") => {
    DRAIN_STOP.why = why;
    stopDrain(player);
  };
  if (!t?.isValid || s.race !== "vampire" || s.tog.bat) return stop("alvo/estado");
  const h = health(t);
  if (!h || h.currentValue <= 0) return stop("morreu");
  const to = v3(t.location.x, t.location.y + 0.9, t.location.z);
  if (Math.hypot(to.x - head.x, to.y - head.y, to.z - head.z) > BAL.drainRange + 0.8) return stop("longe");
  // linha de visão: o alvo continua à sua frente (cone estreito) e sem bloco sólido no meio
  const vd = player.getViewDirection();
  const dx = to.x - head.x, dy = to.y - head.y, dz = to.z - head.z;
  const dl = Math.hypot(dx, dy, dz) || 1;
  if ((dx * vd.x + dy * vd.y + dz * vd.z) / dl < 0.75) return stop(`mira ${((dx * vd.x + dy * vd.y + dz * vd.z) / dl).toFixed(2)}`);
  try {
    const hb = player.dimension.getBlockFromRay(head, { x: dx / dl, y: dy / dl, z: dz / dl }, { maxDistance: dl, includePassableBlocks: false, includeLiquidBlocks: false });
    if (hb && hb.block.isSolid && Math.hypot(hb.block.location.x + 0.5 - head.x, hb.block.location.z + 0.5 - head.z) < Math.hypot(dx, dz) - 0.8) return stop("bloco");
  } catch {
    /* ignore */
  }
  try {
    t.applyDamage(BAL.drainDamage, { cause: EntityDamageCause.magic, damagingEntity: player }); // sem empurrão: o alvo não escapa da boca
  } catch {
    return stop("dano");
  }
  heal(player, BAL.drainDamage);
  s.res = Math.min(BAL.resourceMax, s.res + 3);
  // fio de sangue do alvo até a boca: gotas grossas + brilho
  for (let i = 1; i <= 7; i++) {
    const k = i / 8;
    const at = v3(to.x + (head.x - to.x) * k, to.y + (head.y - 0.3 - to.y) * k, to.z + (head.z - to.z) * k);
    V.emit(player.dimension, "lila:vfx_dot_d", at, { c: [0.75, 0.02, 0.08], d: [0.25, 0, 0.02], size: 0.28, life: 0.5 });
    if (i % 2) V.emit(player.dimension, "lila:vfx_dot", at, { c: [1, 0.2, 0.25], size: 0.12, life: 0.35 });
  }
  V.emit(player.dimension, "lila:vfx_drops", to, { c: [0.7, 0.02, 0.06], n: 4, size: 0.6 });
  try {
    player.dimension.playSound("mob.vex.hurt", to, { volume: 0.4, pitch: 0.6 });
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ voo (asas) e morcego
function moveVec(p) {
  try {
    return p.inputInfo.getMovementVector();
  } catch {
    return { x: 0, y: 0 };
  }
}
function flyTick(player, s, bat) {
  if (player.isOnGround && !player.isJumping) {
    prop(player, "lila:fly", false);
    return;
  }
  const yaw = (player.getRotation().y * Math.PI) / 180;
  const f = { x: -Math.sin(yaw), z: Math.cos(yaw) };
  const r = { x: -f.z, z: f.x };
  const mv = moveVec(player);
  const dir = player.getViewDirection();
  const sp = (bat ? 0.75 : 0.62) + (player.isSprinting ? 0.5 : 0);
  let vy = mv.y > 0.1 ? dir.y * sp * 1.1 + 0.07 : 0.03;
  if (player.isJumping) vy += 0.35;
  if (player.isSneaking) vy = -0.25;
  if (!bat && s.res <= 0) vy = Math.min(vy, -0.08); // sem recurso: só plana
  try {
    player.applyKnockback({ x: (f.x * Math.max(0, mv.y) + r.x * -mv.x * 0.7) * sp, z: (f.z * Math.max(0, mv.y) + r.z * -mv.x * 0.7) * sp }, vy);
  } catch {
    /* ignore */
  }
  prop(player, "lila:fly", true);
  if (system.currentTick % 6 === 0) fx(player.dimension, bat ? "lila:rc_bats" : FX[s.race].trail, v3(player.location.x, player.location.y + 1.2, player.location.z));
}

// ------------------------------------------------------------------ tick por jogador
const lastStep = new Map();
const lastXp = new Map();
const fallStart = new Map();

export function raceTick(player, tick) {
  const s = stateOf(player);
  if (!s.race || s.pending) return;
  const race = s.race;
  const d = DRAIN.get(player.id);
  if (d) drainTick(player, d, tick);
  if (s.tog.bat) flyTick(player, s, true);
  else if (s.tog.fly && ["angel", "demon", "god", "dark"].includes(race)) flyTick(player, s, false);
  if (race === "giant" && tick % 4 === 0) giantStep(player, tick);
  if (tick % 10 !== player.id.length % 10) return; // o resto a cada 0,5 s, espalhado entre jogadores
  const h = health(player);
  // ---- regeneração da raça (em pulsos)
  const pulse = BAL.regenPulse[race];
  if (pulse && h && h.currentValue < h.effectiveMax && tick % pulse < 10) {
    const blocked = race === "demon" && (player.isInWater || raining(player));
    const nether = race === "angel" && player.dimension.id === "minecraft:nether";
    if (!blocked && !nether) {
      const amount = (BAL.regenMult[race] - 1) * BAL.baseRegenPerSec * (pulse / 20);
      heal(player, amount);
      if (race === "dark") fx(player.dimension, "lila:rc_dark_zone", player.location, { size: 1.2 }); // pulso pesado e visível
    }
  }
  if (hasPass(race, "dayregen") && isDay() && tick % 40 < 10 && h && h.currentValue < h.effectiveMax) heal(player, passVal(race, "dayregen"));
  // ---- vampiro: sol, visão noturna, velocidade
  if (race === "vampire") {
    if (!s.tog.bat && directSun(player) && !hasHelmet(player)) {
      if (tick % BAL.sunBurnEvery < 10) {
        try {
          player.setOnFire(2, true);
          player.applyDamage(BAL.sunBurnDamage, { cause: EntityDamageCause.fireTick });
        } catch {
          /* ignore */
        }
        if (!s.tog.sunWarned) {
          s.tog.sunWarned = true;
          player.onScreenDisplay.setActionBar("§6☀ O sol queima! Use um capacete, vá para a sombra ou vire morcego.");
        }
      }
    } else s.tog.sunWarned = false;
    let dark = false;
    try {
      const b = player.dimension.getBlock(player.getHeadLocation());
      dark = !!b && b.getLightLevel() < 7;
    } catch {
      /* ignore */
    }
    if (dark && (!s.tog.nvAuto || tick % 200 < 10)) {
      eff(player, "night_vision", 400, 0);
      s.tog.nvAuto = true;
    } else if (!dark && s.tog.nvAuto) {
      try {
        player.removeEffect("night_vision");
      } catch {
        /* ignore */
      }
      s.tog.nvAuto = false;
    }
  }
  // ---- velocidades (2× vampiro, 3× gigante; rajada do vampiro vai a 5×)
  if (BAL.speedAmp[race] !== undefined && tick % 100 < 10 && !((s.tog.sprintUntil ?? 0) > tick)) eff(player, "speed", 220, BAL.speedAmp[race]);
  // ---- imunidades / efeitos contínuos
  if ((hasPass(race, "fireimm") || hasPass(race, "lavaswim")) && tick % 100 < 10 && !(race === "demon" && (player.isInWater || raining(player)))) eff(player, "fire_resistance", 220, 0);
  if (hasPass(race, "poisonimm")) {
    for (const n of ["poison", "wither"]) {
      try {
        player.removeEffect(n);
      } catch {
        /* ignore */
      }
    }
  }
  if (hasPass(race, "fearaura") && tick % 40 < 10) {
    try {
      for (const e of player.dimension.getEntities({ location: player.location, maxDistance: passVal(race, "fearaura") || 6, families: ["monster"] })) {
        eff(e, "weakness", 60, 0);
        eff(e, "slowness", 60, 0);
      }
    } catch {
      /* ignore */
    }
  }
  // ---- asas que crescem com XP próprio (0→20), nunca encolhem, sem gastar o seu XP
  if (race === "angel" || race === "demon") {
    let xp = 0;
    try {
      xp = player.getTotalXp();
    } catch {
      /* ignore */
    }
    const prev = lastXp.get(player.id);
    lastXp.set(player.id, xp);
    if (prev !== undefined && xp > prev && s.wing < BAL.wingMax) {
      s.tog.wingAcc = (s.tog.wingAcc ?? 0) + (xp - prev);
      const grow = Math.floor(s.tog.wingAcc / BAL.wingXpPer);
      if (grow > 0) {
        s.tog.wingAcc -= grow * BAL.wingXpPer;
        s.wing = Math.min(BAL.wingMax, s.wing + grow);
        prop(player, "lila:wing", s.wing);
        player.onScreenDisplay.setActionBar(s.wing >= BAL.wingMax ? "§e✦ Suas asas chegaram ao tamanho adulto — para sempre!" : `§e✦ Asas crescendo: ${s.wing}/${BAL.wingMax}`);
        saveState(player);
      }
    }
  }
  // ---- recurso da raça
  if (tick % 20 < 10) {
    let g = BAL.resourceRegen;
    if (race === "vampire" && !isDay()) g += 2;
    if (race === "angel") g += player.dimension.id === "minecraft:nether" ? -BAL.resourceRegen : isDay() ? 2 : 0;
    if (race === "demon" && (player.dimension.id === "minecraft:nether" || player.getComponent("minecraft:onfire"))) g += 3;
    if (race === "god") g += 2;
    if (race === "dark" && (!isDay() || !sky(player))) g += 3;
    if ((s.tog.fly || s.tog.bat) && !player.isOnGround) g -= s.tog.bat ? 0 : 3; // voar gasta
    for (const a of BY_RACE[race]) {
      if (a.shape !== "aura" || !s.tog[a.id]) continue;
      g -= 1;
      auraPulse(player, a);
    }
    s.res = Math.max(0, Math.min(BAL.resourceMax, s.res + g));
    if (s.res <= 0) {
      for (const a of BY_RACE[race]) if (a.shape === "aura" && s.tog[a.id]) s.tog[a.id] = false;
    }
  }
  if (tick % 200 < 10) saveState(player);
}

function auraPulse(player, a) {
  const r = a.p.r ?? 6;
  fx(player.dimension, FX[a.race].zone, player.location, { size: r });
  const targets = a.p.allies ? [player, ...player.dimension.getPlayers({ location: player.location, maxDistance: r }).filter((x) => x.id !== player.id)]
    : player.dimension.getEntities({ location: player.location, maxDistance: r }).filter((e) => canHit(player, e));
  for (const t of targets.slice(0, 16)) {
    for (const e of a.p.allies ? a.self : [...a.foe, ...a.self]) {
      const map = { slow: "slowness", weak: "weakness", burn: null, wither: "wither", regen: "regeneration", blind: "blindness" };
      if (e.k === "burn") {
        try {
          t.setOnFire(2, true);
        } catch {
          /* ignore */
        }
      } else if (e.k === "holy") continue;
      else if (map[e.k]) eff(t, map[e.k], e.t || 40, Math.max(0, e.a - 1));
    }
  }
}

function giantStep(player, tick) {
  const p = player.location;
  const last = lastStep.get(player.id);
  if (!last || !player.isOnGround) {
    if (!last) lastStep.set(player.id, { ...p });
    if (!player.isOnGround) {
      if (!fallStart.has(player.id)) fallStart.set(player.id, p.y);
    }
    return;
  }
  const fy = fallStart.get(player.id);
  if (fy !== undefined) {
    fallStart.delete(player.id);
    if (fy - p.y > 4 && hasPass("giant", "fallslam")) {
      fx(player.dimension, "lila:rc_giant_zone", p, { size: 6 });
      for (const e of player.dimension.getEntities({ location: p, maxDistance: 6 })) {
        if (!canHit(player, e)) continue;
        try {
          e.applyDamage(passVal("giant", "fallslam"), { cause: EntityDamageCause.entityAttack, damagingEntity: player });
          e.applyKnockback({ x: e.location.x - p.x, z: e.location.z - p.z }, 0.6);
        } catch {
          /* ignore */
        }
      }
    }
  }
  if (Math.hypot(p.x - last.x, p.z - last.z) < 3) return;
  lastStep.set(player.id, { ...p });
  fx(player.dimension, "lila:rc_debris", p);
  try {
    player.dimension.playSound("mob.irongolem.walk", p, { volume: 1, pitch: 0.55 });
    player.runCommand("camerashake add @s 0.08 0.15 positional");
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ dano (central)
/** Multiplicadores de dano das raças. Só lê estado (roda no beforeEvent). */
export function damageMods(ev) {
  const target = ev.hurtEntity;
  const src = ev.damageSource?.damagingEntity;
  const cause = ev.damageSource?.cause;
  if (sigDamage(target, src) === 0) return 0;
  const m = damageMult(ev, target, src, cause);
  if (m > 0 && target?.typeId === "minecraft:player" && sigLethal(target, ev.damage * m)) return 0;
  return m;
}
function damageMult(ev, target, src, cause) {
  let m = 1;
  // quem bate
  if (src?.typeId === "minecraft:player") {
    const s = stateOf(src);
    const r = s.race;
    if (r && !s.pending && cause === "entityAttack") {
      if (BAL.meleeMult[r]) m *= BAL.meleeMult[r];
      if (hasPass(r, "nightdmg") && !isDay()) m *= 1 + passVal(r, "nightdmg") / 100;
      if (hasPass(r, "ragedmg")) {
        const h = health(src);
        if (h) m *= 1 + (passVal(r, "ragedmg") / 100) * (1 - h.currentValue / h.effectiveMax);
      }
      if (hasPass(r, "holyhit")) {
        const tr = target?.typeId === "minecraft:player" ? stateOf(target).race : null;
        let undead = false;
        try {
          undead = target.matches({ families: ["undead"] });
        } catch {
          /* ignore */
        }
        if (tr === "demon" || tr === "dark" || undead) m *= 1 + passVal(r, "holyhit") / 100;
      }
    }
  }
  // quem apanha
  if (target?.typeId === "minecraft:player") {
    const s = stateOf(target);
    const r = s.race;
    if (r && !s.pending) {
      if ((cause === "fall" || cause === "flyIntoWall") && (hasPass(r, "nofall") || (s.tog.safeFallUntil ?? 0) > system.currentTick || s.tog.fly || s.tog.bat)) return 0;
      if ((cause === "fire" || cause === "fireTick" || cause === "lava" || cause === "magma") && hasPass(r, "fireimm") && !(r === "demon" && target.isInWater)) return 0;
      if ((cause === "poison" || cause === "wither") && hasPass(r, "poisonimm")) return 0;
      if (r === "vampire" && cause === "fireTick" && hasHelmet(target)) return 0;
      if (r === "giant") m *= BAL.damageTakenMult.giant;
      if (r === "dark") m *= cause === "fireTick" || !directSun(target) ? BAL.damageTakenMult.dark : BAL.darkSunDamageMult;
      const sr = src?.typeId === "minecraft:player" ? stateOf(src).race : null;
      if (r === "angel" && BAL.angelWeakTo.includes(sr)) m *= BAL.angelWeakMult;
      if (r === "god" && BAL.godWeakTo.includes(sr)) m *= BAL.godWeakMult;
      if (hasPass(r, "lowhpres")) {
        const h = health(target);
        if (h && h.currentValue / h.effectiveMax < 0.3) m *= 1 - passVal(r, "lowhpres") / 100;
      }
      if (hasPass(r, "dodge") && src && Math.random() * 100 < passVal(r, "dodge")) return 0;
    }
  }
  return m;
}

/** Depois do dano: roubo de vida, espinhos, fogo/murchar nos golpes, fúria, sair do morcego, empurrão. */
export function afterHurt(ev) {
  const target = ev.hurtEntity;
  const src = ev.damageSource?.damagingEntity;
  const dmg = ev.damage;
  if (src?.typeId === "minecraft:player" && target?.isValid && ev.damageSource.cause === "entityAttack") {
    const s = stateOf(src);
    const r = s.race;
    if (r) {
      sigAfterHit(src, dmg);
      if (hasPass(r, "lifesteal")) heal(src, (dmg * passVal(r, "lifesteal")) / 100);
      if (hasPass(r, "burnhit")) try {
        target.setOnFire(passVal(r, "burnhit") || 3, true);
      } catch {
        /* ignore */
      }
      if (hasPass(r, "witherhit") && Math.random() * 100 < passVal(r, "witherhit")) eff(target, "wither", 60, 0);
      if (hasPass(r, "critkb") && Math.random() * 100 < passVal(r, "critkb")) {
        try {
          target.applyKnockback({ x: target.location.x - src.location.x, z: target.location.z - src.location.z }, 0.8);
        } catch {
          /* ignore */
        }
      }
      if (r === "giant") s.res = Math.min(BAL.resourceMax, s.res + 2);
    }
  }
  if (target?.typeId === "minecraft:player") {
    const s = stateOf(target);
    if (!s.race) return;
    const th = THORNS.get(target.id);
    if (th && src?.isValid && src.id !== target.id && th.until > system.currentTick) {
      try {
        src.applyDamage(th.dmg, { cause: EntityDamageCause.thorns, damagingEntity: target });
      } catch {
        /* ignore */
      }
    }
    if (s.race === "giant") s.res = Math.min(BAL.resourceMax, s.res + 3);
    if (s.tog.bat && dmg >= 6) {
      s.tog.bat = false;
      applyBody(target);
      target.onScreenDisplay.setActionBar("§4O golpe te tirou da forma de morcego!");
    }
    if (hasPass(s.race, "kbres") && src) {
      system.run(() => {
        try {
          target.clearVelocity();
        } catch {
          /* ignore */
        }
      });
    }
  }
}

export function onKill(ev) {
  const src = ev.damageSource?.damagingEntity;
  if (src?.typeId !== "minecraft:player") return;
  const s = stateOf(src);
  if (s.race && hasPass(s.race, "killheal")) heal(src, passVal(s.race, "killheal"));
  if (s.race) s.res = Math.min(BAL.resourceMax, s.res + 6);
}

/** Atalho usado pelo painel e pelo botão de bater: usa o poder ativo da barra. */
export function castActive(player) {
  const s = stateOf(player);
  const id = s.slots[s.active];
  if (!id) {
    player.onScreenDisplay.setActionBar("§7Barra vazia: use o Núcleo (botão usar) para escolher um poder.");
    return false;
  }
  return cast(player, id).ok;
}
