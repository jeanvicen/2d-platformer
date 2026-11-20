// Formas do DR-0N: veículos (helicóptero, carro, escavadeira, tanque, jato, moto, nave espacial,
// disco voador, submarino, lancha, caminhão-monstro, caça furtivo), o robô gigante TITÃ e a torreta
// gigante. É sempre a MESMA entidade (inventário, memórias e vida continuam): a forma troca grupos
// de componentes (hitbox, gravidade, assentos, escala) e a geometria.
//
// Controles quando você está dentro (2.2):
//   andar = acelerar/ré · olhar = direção (voadores sobem/descem para onde você olha)
//   pular = o veículo pula (terrestres/lancha) · sobe (voadores) · turbo (jatos) · salto com pisão (TITÃ)
//   bater (botão de ataque) = arma da forma · AGACHAR = sair · usar o controle = painel do piloto
import { BlockVolume, ButtonState, EntityDamageCause, InputButton, InputPermissionCategory, system } from "@minecraft/server";
import { FORM_LIST, FORM_NAMES } from "../lib/catalog.js";
import { blockAt } from "./world.js";
import { getAction, particle, setAction, setMove, sound } from "./anim.js";
import { canAttack, findThreat, isHostile } from "./combat.js";
import { clearLine, hover, land } from "./drone.js";
import { say } from "./talk.js";
import { logError } from "../core/log.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {{x:number,y:number,z:number}} Vec */

export const VEHICLES = ["heli", "car", "excavator", "tank", "jet", "moto", "ship", "ufo", "sub", "boat", "truck", "stealth"];
export const formOf = (c) => c.rec.form ?? "drone";
export const isVehicle = (f) => VEHICLES.includes(f);
export const isRideForm = (f) => isVehicle(f) || f === "colossus";
const FLIERS = new Set(["heli", "jet", "ship", "ufo", "stealth"]);

/**
 * Velocidades em blocos por tick (×20 = blocos/s). A velocidade é COMANDADA (guardada em
 * c.flags.spd), não lida de volta da entidade: lida depois do atrito, ela travava o carro em ~15%.
 * No chão o jogo ainda aplica o atrito antes de mover (anda ~55% do comandado, medido no servidor
 * oficial), por isso os terrestres comandam mais: carro ≈ 23 blocos/s de verdade.
 */
export const SPEC = {
  heli: { mode: "hover", speed: 1.0, climb: 0.55, follow: 0.8, turn: 0.25, k: 0.12, sound: "lila.heli", every: 19, vol: 1.0, pitch: 1 },
  ufo: { mode: "hover", speed: 1.4, climb: 0.8, follow: 0.6, turn: 0.5, k: 0.16, sound: "beacon.ambient", every: 40, vol: 1.0, pitch: 1.6 },
  ship: { mode: "hover", speed: 1.8, climb: 0.9, follow: 1.0, turn: 0.3, k: 0.1, sound: "lila.jet", every: 23, vol: 1.0, pitch: 1.4 },
  jet: { mode: "jet", speed: 2.2, min: 0.45, sound: "lila.jet", every: 23, vol: 1.2, pitch: 1 },
  stealth: { mode: "jet", speed: 3.0, min: 0.5, sound: "lila.jet", every: 23, vol: 1.3, pitch: 0.8 },
  car: { mode: "ground", speed: 2.1, accel: 0.06, hop: 0.5, jump: 0.6, sound: "lila.engine", every: 19, vol: 0.8, pitch: 1 },
  moto: { mode: "ground", speed: 2.4, accel: 0.08, hop: 0.5, jump: 0.6, sound: "lila.engine", every: 19, vol: 0.8, pitch: 1.5 },
  excavator: { mode: "ground", speed: 0.85, accel: 0.05, hop: 0.55, jump: 0.55, sound: "lila.engine", every: 19, vol: 0.9, pitch: 0.55 },
  tank: { mode: "ground", speed: 1.0, accel: 0.04, hop: 0.55, jump: 0.55, sound: "lila.engine", every: 19, vol: 1.0, pitch: 0.45 },
  truck: { mode: "ground", speed: 1.8, accel: 0.06, hop: 0.6, jump: 0.95, crush: true, sound: "lila.engine", every: 19, vol: 1.2, pitch: 0.7 },
  boat: { mode: "boat", speed: 1.5, accel: 0.05, jump: 0.55, sound: "lila.engine", every: 19, vol: 0.8, pitch: 1.3 },
  sub: { mode: "sub", speed: 0.8, k: 0.08, sound: "lila.engine", every: 25, vol: 0.6, pitch: 0.4 },
  colossus: { mode: "ground", speed: 0.6, accel: 0.2, colossus: true },
};
const SCALE = 3.4; // escala do colosso (igual ao pacote)

const yawDir = (yaw) => {
  const r = (yaw * Math.PI) / 180;
  return { x: -Math.sin(r), z: Math.cos(r) };
};
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function riders(c) {
  try {
    return c.entity?.getComponent("minecraft:rideable")?.getRiders() ?? [];
  } catch {
    return [];
  }
}

function setPerm(player, on) {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Dismount, on);
  } catch {
    /* versão sem permissões: agachar desmonta normalmente */
  }
}

/** Devolve a permissão de descer a todos que estavam dentro (sempre, mesmo em erro). */
export function releaseRiders(c) {
  for (const r of riders(c)) if (r.typeId === "minecraft:player") setPerm(/** @type {any} */ (r), true);
  const o = c.owner();
  if (o) setPerm(o, true);
  c.flags.permOff = false;
}

function shake(dim, at, power = 0.4, secs = 1, r = 40) {
  try {
    dim.runCommand(`camerashake add @a[x=${Math.floor(at.x)},y=${Math.floor(at.y)},z=${Math.floor(at.z)},r=${r}] ${power} ${secs} positional`);
  } catch {
    /* ignore */
  }
}

function burst(dim, at, kind = "lila:sparkle", n = 6, r = 1.5) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    particle(dim, kind, { x: at.x + Math.cos(a) * r, y: at.y + (i % 3) * 0.6, z: at.z + Math.sin(a) * r });
  }
}

/**
 * Troca de forma com efeito (partículas, som, giro). O dono entra sozinho nos veículos.
 * @param {Companion} c
 * @param {string} form
 * @param {{mount?:boolean, quiet?:boolean}} o
 */
export function setForm(c, form, o = {}) {
  const e = c.entity;
  if (!e?.isValid || !FORM_LIST.includes(form)) return false;
  const prev = formOf(c);
  const inside = riders(c);
  releaseRiders(c);
  try {
    e.getComponent("minecraft:rideable")?.ejectRiders();
  } catch {
    /* ignore */
  }
  const dim = e.dimension;
  const at = e.location;
  if (form === "colossus") clearAround(dim, at, 5, 26); // árvores/folhas em volta não prendem o gigante
  try {
    e.triggerEvent(`lila:form_${form}`);
  } catch (err) {
    logError("forms.event", err);
    return false;
  }
  c.rec.form = form;
  c.save();
  setAction(e, "idle");
  setMove(e, "none");
  try {
    e.setProperty("lila:aim", 0);
    e.setProperty("lila:pitch", 0);
  } catch {
    /* ignore */
  }
  c.flags.hadDriver = false;
  c.flags.formAt = system.currentTick;
  if (!o.quiet) {
    sound(e, "lila.transform", 1.0, form === "colossus" ? 0.8 : 1.0);
    sound(e, "random.anvil_use", 0.35, 1.4);
    burst(dim, at, "lila:sparkle", 10, form === "colossus" ? 4 : 1.6);
    burst(dim, at, "lila:smoke", 6, form === "colossus" ? 5 : 1.4);
    if (form === "colossus") {
      shake(dim, at, 0.6, 2.4, 60);
      system.runTimeout(() => {
        if (!c.alive()) return;
        sound(c.entity, "lila.roar", 2.0, 0.85);
        sound(c.entity, "mob.ravager.roar", 1.2, 0.45);
        setAction(c.entity, "celebrate");
        system.runTimeout(() => getAction(c.entity) === "celebrate" && setAction(c.entity, "idle"), 44);
      }, 46);
    }
  }
  // dono (e quem estava junto) entra na forma nova
  const owner = c.owner();
  if (form === "swarm") c.flags.swarmShield = true;
  if (o.mount !== false && isRideForm(form) && owner) {
    system.runTimeout(() => {
      if (!c.alive()) return;
      const seated = mountOwner(c, owner);
      if (seated) for (const r of inside) if (r.id !== owner.id && r.isValid) tryAdd(c, r);
    }, form === "colossus" ? 30 : 8);
  }
  if (prev !== form && !o.quiet) {
    const msgs = {
      drone: "De volta à forma normal. Pronto pra próxima!",
      colossus: "ROBÔ GIGANTE TITÃ! Você está em cima da cabeça: andar = mover · bater perto = soco · mirar longe e bater = raio do visor · pular = salto com pisão · agachar = sair.",
      turret: "Torreta gigante armada e cravada no chão. Ninguém passa!",
      swarm: "ENXAME! Virei milhares de nanorrobôs. Escudo em volta de você ligado. Me peça: muralha, ponte, escada, cúpula, punho, espada, tornado, asas, ataca, devora tudo.",
      sub: "Submarino! Olhe pra baixo e acelere pra mergulhar. Bater = torpedo. Você respira e enxerga debaixo d'água. Agachar = sair.",
      boat: "Lancha! Na água ela voa. Pular = salto nas ondas, bater = turbo. Agachar = sair.",
      ufo: "Disco voador! Bater = raio desintegrador · olhando pra baixo = raio trator (abduz quem estiver embaixo). Agachar = sair.",
    };
    say(c, msgs[form] ?? `Virei ${FORM_NAMES[form]}! Andar acelera, olhar dá a direção, pular ${FLIERS.has(form) ? "sobe" : "pula"}, bater usa a arma, agachar sai.`, { force: true });
  }
  return true;
}

function tryAdd(c, p) {
  try {
    return c.entity?.getComponent("minecraft:rideable")?.addRider(p) ?? false;
  } catch {
    return false;
  }
}

/** Põe o dono no assento do piloto (primeiro assento). */
export function mountOwner(c, owner) {
  const e = c.entity;
  if (!e?.isValid) return false;
  const rs = riders(c);
  if (rs[0]?.id === owner.id) return true;
  try {
    const others = rs.filter((r) => r.id !== owner.id);
    const rc = e.getComponent("minecraft:rideable");
    if (!rc) return false;
    if (rs.length) rc.ejectRiders();
    if (Math.hypot(owner.location.x - e.location.x, owner.location.z - e.location.z) > 6 && formOf(c) !== "colossus") {
      e.teleport({ x: owner.location.x + 1, y: owner.location.y, z: owner.location.z }, { keepVelocity: false });
    }
    const ok = rc.addRider(owner);
    for (const r of others) if (r.isValid) rc.addRider(r);
    return ok;
  } catch (err) {
    logError("forms.mount", err);
    return false;
  }
}

/** Apaga árvores/folhas/plantas numa caixa (para o colosso caber). */
function clearAround(dim, at, r, h) {
  try {
    const vol = new BlockVolume({ x: Math.floor(at.x - r), y: Math.floor(at.y), z: Math.floor(at.z - r) },
      { x: Math.floor(at.x + r), y: Math.floor(at.y + h), z: Math.floor(at.z + r) });
    dim.fillBlocks(vol, "minecraft:air", { blockFilter: { includeTypes: SOFT } });
  } catch (err) {
    logError("forms.clear", err);
  }
}

const SOFT = ["minecraft:oak_leaves", "minecraft:spruce_leaves", "minecraft:birch_leaves", "minecraft:jungle_leaves", "minecraft:acacia_leaves",
  "minecraft:dark_oak_leaves", "minecraft:mangrove_leaves", "minecraft:cherry_leaves", "minecraft:azalea_leaves", "minecraft:pale_oak_leaves",
  "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log", "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log",
  "minecraft:mangrove_log", "minecraft:cherry_log", "minecraft:pale_oak_log", "minecraft:vine", "minecraft:short_grass", "minecraft:tall_grass",
  "minecraft:snow_layer", "minecraft:fern", "minecraft:large_fern", "minecraft:bamboo", "minecraft:sweet_berry_bush"];
const NEVER_BREAK = ["minecraft:bedrock", "minecraft:barrier", "minecraft:command_block", "minecraft:end_portal_frame", "minecraft:end_portal",
  "minecraft:structure_block", "minecraft:jigsaw", "minecraft:reinforced_deepslate", "minecraft:allow", "minecraft:deny", "minecraft:border_block"];

/** Destrói blocos numa "bola" (aproximada por camadas de caixas) — soco, raio, canhão. */
export function smash(dim, at, r, drops = false) {
  const R = Math.max(1, Math.round(r));
  for (let dy = -R; dy <= R; dy++) {
    const rr = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (rr < 0) continue;
    try {
      const y = Math.floor(at.y + dy);
      if (y < dim.heightRange.min || y >= dim.heightRange.max) continue;
      const vol = new BlockVolume({ x: Math.floor(at.x - rr), y, z: Math.floor(at.z - rr) }, { x: Math.floor(at.x + rr), y, z: Math.floor(at.z + rr) });
      if (drops) {
        dim.runCommand(`fill ${Math.floor(at.x - rr)} ${y} ${Math.floor(at.z - rr)} ${Math.floor(at.x + rr)} ${y} ${Math.floor(at.z + rr)} air destroy`);
      } else {
        dim.fillBlocks(vol, "minecraft:air", { blockFilter: { excludeTypes: NEVER_BREAK } });
      }
    } catch {
      /* fora do mundo / descarregado */
    }
  }
}

/** Dano em área (não acerta o dono, os passageiros nem o próprio exército). */
export function areaDamage(c, at, r, dmg, knock = 1.2, up = 0.4) {
  const dim = c.dim();
  const keep = new Set([c.rec.ownerId, c.entity?.id, ...riders(c).map((x) => x.id)]);
  let n = 0;
  try {
    for (const t of dim.getEntities({ location: at, maxDistance: r })) {
      if (keep.has(t.id) || t.typeId === "minecraft:item" || t.typeId === "lila:robot" || t.typeId === "minecraft:xp_orb") continue;
      if (t.typeId === "minecraft:player" && !c.flags.aggro?.has(t.id)) continue; // jogador só se for inimigo marcado
      if (t.typeId !== "minecraft:player" && !isHostile(t) && !canAttack(c, t, false) && !c.flags.aggro?.has(t.id)) continue;
      try {
        t.applyDamage(dmg, { cause: EntityDamageCause.entityExplosion, damagingEntity: c.entity });
        const dx = t.location.x - at.x, dz = t.location.z - at.z, l = Math.hypot(dx, dz) || 1;
        t.applyKnockback({ x: (dx / l) * knock, z: (dz / l) * knock }, up);
        n++;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return n;
}

// ------------------------------------------------------------------ por tick
/**
 * Um tick da forma (veículos e colosso). Retorna true se cuidou do tick (cérebro descansa).
 * Sair = agachar (o jogo desmonta sozinho; o add-on não bloqueia mais isso).
 * @param {Companion} c
 */
export function formTick(c) {
  const f = formOf(c);
  const e = c.entity;
  if (!e?.isValid || !isRideForm(f)) return false;
  if (c.flags.testDriving) return true; // autoteste dirigindo direto
  const owner = c.owner();
  const rs = riders(c);
  const piloting = !!owner && rs.some((r) => r.id === owner.id);
  if (owner && !c.flags.permFixed) {
    setPerm(owner, true); // mundos da 2.1 podiam ter ficado com "descer" bloqueado
    c.flags.permFixed = true;
  }
  if (f === "sub" && system.currentTick % 40 === 0) subPerks(rs);
  if (piloting && owner) {
    c.flags.hadDriver = true;
    c.flags.piloting = true;
    // agachar = sair (o jogo já faz; isto garante em qualquer versão/controle)
    let sneaking = false;
    try {
      sneaking = owner.isSneaking;
    } catch {
      /* ignore */
    }
    c.flags.sneakT = sneaking ? (c.flags.sneakT ?? 0) + 1 : 0;
    if (c.flags.sneakT >= 2) {
      c.flags.sneakT = 0;
      try {
        e.getComponent("minecraft:rideable")?.ejectRider(owner);
      } catch {
        /* ignore */
      }
      c.flags.piloting = false;
      onExit(c, owner, f);
      if (f === "colossus") {
        idleTick(c, f);
        return true;
      }
      setForm(c, "drone", { mount: false });
      c.abortMove = true;
      return true;
    }
    if (f === "colossus" && rs[0]?.id !== owner.id) {
      // dono numa ombreira/mochila: o robô fica parado (só quem está na cabeça pilota)
      idleTick(c, f);
      return true;
    }
    drive(c, owner, f);
    return true;
  }
  if (c.flags.piloting) {
    c.flags.piloting = false;
    onExit(c, owner, f);
  }
  if (isVehicle(f)) {
    // você desceu do veículo: ele volta a ser drone (e retoma o que fazia)
    if (c.flags.hadDriver || system.currentTick - (c.flags.formAt ?? 0) > 200) {
      setForm(c, "drone", { mount: false });
      c.abortMove = true;
    } else idleTick(c, f);
    return true;
  }
  idleTick(c, f); // colosso sem piloto: fica de pé onde está até você cancelar
  return true;
}

/** Saiu do veículo (agachou): do alto, cai devagar em vez de se esborrachar. */
function onExit(c, owner, f) {
  c.flags.spd = 0;
  c.flags.fv = undefined;
  if (!owner?.isValid) return;
  let high = f === "colossus";
  try {
    if (!owner.dimension.getBlockBelow(owner.location, { maxDistance: 4 })) high = true;
  } catch {
    /* ignore */
  }
  if (high) {
    try {
      owner.addEffect("slow_falling", 240, { amplifier: 0, showParticles: false });
    } catch {
      /* ignore */
    }
  }
}

/** Submarino: quem está dentro respira, enxerga e se move bem debaixo d'água. */
function subPerks(rs) {
  for (const r of rs) {
    try {
      r.addEffect("water_breathing", 300, { amplifier: 0, showParticles: false });
      r.addEffect("night_vision", 400, { amplifier: 0, showParticles: false });
      r.addEffect("conduit_power", 300, { amplifier: 0, showParticles: false });
    } catch {
      /* ignore */
    }
  }
}

function idleTick(c, f) {
  const e = c.entity;
  if (!e) return;
  try {
    const v = e.getVelocity();
    const spec = SPEC[f] ?? {};
    let vy = FLIERS.has(f) ? -v.y : 0;
    if (spec.mode === "boat" || spec.mode === "sub") vy = floatY(c, f) - v.y;
    e.applyImpulse({ x: -v.x * 0.5, y: vy, z: -v.z * 0.5 });
  } catch {
    /* ignore */
  }
  c.flags.spd = 0;
  setMove(e, "none");
  // colosso parado ainda protege: pisa em monstros que chegarem perto
  if (f === "colossus" && system.currentTick % 40 === 0) {
    const t = findThreat(c);
    if (t && d3(t.location, c.pos()) < 14 && getAction(e) === "idle") stomp(c);
  }
}

const isWater = (b) => !!b && (b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water" || (b.isWaterlogged ?? false));

/** Nível da água sob a entidade (topo do bloco de água mais alto), ou null. */
function waterTop(dim, p) {
  const x = Math.floor(p.x), z = Math.floor(p.z), y0 = Math.floor(p.y);
  for (let y = y0 + 1; y >= y0 - 2; y--) if (isWater(blockAt(dim, x, y, z))) return y + 1;
  return null;
}

/** Velocidade vertical desejada para boiar (lancha) / ficar neutro (submarino) ou cair (fora d'água). */
function floatY(c, f) {
  const e = c.entity;
  const p = e.location;
  const top = waterTop(e.dimension, p);
  const v = e.getVelocity();
  if (f === "sub") {
    if (isWater(blockAt(e.dimension, Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)))) return 0;
    if (top !== null) return Math.max(-0.2, (top - 1.2 - p.y) * 0.3);
  } else if (top !== null) return Math.max(-0.3, Math.min(0.3, (top - 0.3 - p.y) * 0.4));
  return e.isOnGround ? 0 : Math.max(-1.4, v.y - 0.08); // fora d'água: gravidade "de mentira"
}

/** Lê o controle do piloto (ou a entrada simulada do autoteste). */
function readInput(c, owner) {
  const ti = c.flags.testInput;
  if (ti) {
    return { mv: ti.mv ?? { x: 0, y: 0 }, jump: !!ti.jump, look: ti.yaw ?? c.entity.getRotation().y, view: ti.view ?? viewOf(ti.yaw ?? c.entity.getRotation().y, 0) };
  }
  let mv = { x: 0, y: 0 }, jump = false;
  try {
    mv = owner.inputInfo.getMovementVector();
    jump = owner.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed;
  } catch {
    /* sem leitura de controle nessa versão */
  }
  return { mv, jump, look: owner.getRotation().y, view: owner.getViewDirection() };
}

const viewOf = (yaw, pitch) => {
  const r = (yaw * Math.PI) / 180, q = (pitch * Math.PI) / 180;
  return { x: -Math.sin(r) * Math.cos(q), y: -Math.sin(q), z: Math.cos(r) * Math.cos(q) };
};

/** Aproxima uma velocidade comandada (vetor) e aplica: impulso = alvo − velocidade atual. */
function push(c, e, want, k) {
  const fv = c.flags.fv ?? { x: 0, y: 0, z: 0 };
  fv.x += (want.x - fv.x) * k;
  fv.y += (want.y - fv.y) * k;
  fv.z += (want.z - fv.z) * k;
  c.flags.fv = fv;
  const v = e.getVelocity();
  e.applyImpulse({ x: fv.x - v.x, y: fv.y - v.y, z: fv.z - v.z });
  return fv;
}

/** Pilotagem. */
function drive(c, owner, f) {
  const e = c.entity;
  const spec = SPEC[f];
  const { mv, jump, look, view } = readInput(c, owner);
  const jumpEdge = jump && !c.flags.jumpHeld;
  c.flags.jumpHeld = jump;
  const cur = e.getRotation().y;
  let v = { x: 0, y: 0, z: 0 };
  try {
    v = e.getVelocity();
  } catch {
    /* ignore */
  }
  let yaw = cur;
  if (spec.mode === "hover") {
    // helicóptero / disco / nave: vai para onde você olha; olhar pra baixo e acelerar = desce
    yaw = cur + wrap(look - cur) * spec.turn;
    const fwd = yawDir(look);
    const side = { x: -fwd.z, z: fwd.x };
    const s = spec.speed * (mv.y >= 0 ? mv.y : mv.y * 0.5);
    const vy = jump ? spec.climb : mv.y > 0.1 ? view.y * s * spec.follow : 0;
    push(c, e, { x: fwd.x * s + side.x * mv.x * spec.speed * 0.5, y: vy, z: fwd.z * s + side.z * mv.x * spec.speed * 0.5 }, spec.k);
  } else if (spec.mode === "jet") {
    // jatos: velocidade mínima no ar, pular = pós-combustor, puxar pra trás = freio aerodinâmico
    yaw = cur + wrap(look - cur) * 0.25;
    const air = !e.isOnGround;
    let throttle = mv.y > 0.1 ? mv.y : mv.y < -0.1 ? (air ? 0.25 : 0) : air ? spec.min : 0;
    if (jump) throttle = Math.max(throttle, 1) * 1.5;
    const s = spec.speed * throttle;
    push(c, e, { x: view.x * s, y: air || throttle > 0.55 ? view.y * s : 0, z: view.z * s }, 0.08);
  } else if (spec.mode === "sub") {
    yaw = cur + wrap(look - cur) * 0.2;
    const p = e.location;
    const under = isWater(blockAt(e.dimension, Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)));
    const fwd = yawDir(look);
    if (under) {
      // debaixo d'água: 3D para onde você olha; pular = subir; não sai voando da água
      const s = spec.speed * (mv.y >= 0 ? mv.y : mv.y * 0.5);
      let vy = jump ? 0.4 : mv.y > 0.1 ? view.y * s : 0;
      const head = blockAt(e.dimension, Math.floor(p.x), Math.floor(p.y + 2.2), Math.floor(p.z));
      if (vy > 0 && !isWater(head) && !jump) vy = 0;
      push(c, e, { x: fwd.x * s, y: vy, z: fwd.z * s }, spec.k);
    } else {
      // na superfície: navega; olhar pra baixo e acelerar = mergulha. Em terra: se arrasta.
      const top = waterTop(e.dimension, p);
      const s = (top !== null ? spec.speed * 0.8 : 0.1) * (mv.y >= 0 ? mv.y : mv.y * 0.5);
      let vy = floatY(c, f);
      if (top !== null && mv.y > 0.1 && view.y < -0.25) vy = view.y * s;
      c.flags.fv = { x: fwd.x * s, y: vy, z: fwd.z * s };
      e.applyImpulse({ x: fwd.x * s - v.x, y: vy - v.y, z: fwd.z * s - v.z });
    }
  } else {
    yaw = groundDrive(c, e, spec, f, mv, jump, jumpEdge, look, v);
  }
  try {
    e.setRotation({ x: 0, y: yaw });
  } catch {
    /* ignore */
  }
  let hs = 0;
  try {
    const nv = e.getVelocity();
    hs = Math.hypot(nv.x, nv.z);
  } catch {
    /* ignore */
  }
  if (spec.mode !== "ground" && spec.mode !== "boat") setMove(e, hs > 0.5 ? "run" : hs > 0.03 ? "walk" : "none");
  // mira da torre (tanque) / cabine (escavadeira) acompanha o seu olhar
  if ((f === "tank" || f === "excavator") && system.currentTick % 2 === 0) {
    try {
      e.setProperty("lila:aim", Math.round(Math.max(-180, Math.min(180, wrap(-(look - yaw))))));
    } catch {
      /* ignore */
    }
  }
  // som do motor/rotor/turbina em loop
  if (spec.sound && system.currentTick % spec.every === 0) {
    const pitch = spec.pitch * (0.75 + Math.min(1, hs / Math.max(0.1, spec.speed)) * 0.5);
    try {
      e.dimension.playSound(spec.sound, e.location, { volume: spec.vol, pitch });
    } catch {
      /* ignore */
    }
  }
  if (f === "colossus") colossusTick(c, hs);
  if (spec.crush && hs > 0.4 && system.currentTick % 4 === 0) crush(c, hs);
  if (c.flags.testLog) c.flags.testLog.push({ x: e.location.x, y: e.location.y, z: e.location.z });
}

/** Autoteste: um tick de pilotagem com a entrada simulada em c.flags.testInput (sem jogador). */
export function testDrive(c, f = formOf(c)) {
  drive(c, /** @type {any} */ (undefined), f);
}

/** Terrestres, lancha e colosso: esterça para o olhar, velocidade comandada com aceleração. */
function groundDrive(c, e, spec, f, mv, jump, jumpEdge, look, v) {
  const cur = e.getRotation().y;
  const now = system.currentTick;
  let spd = c.flags.spd ?? 0;
  const rate = f === "colossus" ? 3 : 3 + Math.min(7, Math.abs(spd) * 6);
  const diff = wrap(look - cur) + mv.x * -25;
  const yaw = cur + Math.max(-rate, Math.min(rate, diff));
  const fwd = yawDir(yaw);
  const p = e.location;
  let top = null;
  if (spec.mode === "boat") top = waterTop(e.dimension, p);
  const max = spec.mode === "boat" && top === null ? 0.15 : spec.speed; // lancha encalhada quase não anda
  const target = max * (mv.y >= 0 ? mv.y : mv.y * 0.5);
  spd += (target - spd) * (spec.accel ?? 0.2) * (Math.abs(target) < Math.abs(spd) ? 1.8 : 1);
  if ((c.flags.nitroUntil ?? 0) > now && mv.y > -0.1) spd = Math.max(spd, max * 1.7);
  // bateu numa parede: perde velocidade (em vez de ficar "empurrando" para sempre)
  const lp = c.flags.lastPos;
  if (lp) {
    const moved = Math.hypot(p.x - lp.x, p.z - lp.z);
    c.flags.stuckT = Math.abs(spd) > 0.2 && moved < Math.abs(spd) * 0.3 ? (c.flags.stuckT ?? 0) + 1 : 0;
    if (c.flags.stuckT > 3) spd *= 0.6;
  }
  c.flags.lastPos = { x: p.x, z: p.z };
  c.flags.spd = spd;
  let vy = spec.mode === "boat" ? floatY(c, f) : v.y;
  // degrau na frente: pulinho automático (carros/moto/caminhão) ou subida (colosso)
  if (Math.abs(spd) > 0.05) {
    const sg = Math.sign(spd);
    if (f === "colossus") colossusStep(c, fwd, sg);
    else if (e.isOnGround && spec.mode === "ground") {
      const ahead = 0.9 + Math.abs(spd) * 1.2;
      const ax = Math.floor(p.x + fwd.x * ahead * sg), az = Math.floor(p.z + fwd.z * ahead * sg);
      const b0 = blockAt(e.dimension, ax, Math.floor(p.y), az);
      const b1 = blockAt(e.dimension, ax, Math.floor(p.y) + 1, az);
      if (b0 && !b0.isAir && !b0.isLiquid && b1?.isAir) vy = spec.hop ?? 0.5;
    }
  }
  if (jumpEdge) {
    if (f === "colossus") colossusJump(c);
    else if (spec.mode === "boat" ? top !== null && p.y > top - 0.8 : e.isOnGround) {
      vy = spec.jump ?? 0.55;
      sound(e, "random.door_close", 0.6, 0.5);
    }
  }
  if (f === "colossus" && (c.flags.colJumpAt ?? -1) === now) vy = 1.15;
  e.applyImpulse({ x: fwd.x * spd - v.x, y: vy - v.y, z: fwd.z * spd - v.z });
  setMove(e, spd < -0.02 ? "sneak" : Math.abs(spd) > 0.5 ? "run" : Math.abs(spd) > 0.02 ? "walk" : "none");
  return yaw;
}

/** Caminhão-monstro: passa por cima de monstros e amassa plantas/cercas na frente. */
function crush(c, hs) {
  const e = c.entity;
  const fwd = yawDir(e.getRotation().y);
  const at = { x: e.location.x + fwd.x * 2.2, y: e.location.y + 0.8, z: e.location.z + fwd.z * 2.2 };
  if (areaDamage(c, at, 2.4, 6 + hs * 10, 1.4, 0.6) > 0) sound(e, "random.anvil_land", 0.6, 0.6);
  try {
    const vol = new BlockVolume({ x: Math.floor(at.x - 1), y: Math.floor(at.y - 0.5), z: Math.floor(at.z - 1) },
      { x: Math.floor(at.x + 1), y: Math.floor(at.y + 1), z: Math.floor(at.z + 1) });
    e.dimension.fillBlocks(vol, "minecraft:air", { blockFilter: { includeTypes: SOFT } });
  } catch {
    /* ignore */
  }
}

// ------------------------------------------------------------------ armas (botão de ataque)
/** Botão de ataque do piloto. */
export function primaryAttack(c, owner) {
  const f = formOf(c);
  const now = system.currentTick;
  const cd = (k, t) => {
    if (now < (c.flags[k] ?? 0)) return false;
    c.flags[k] = now + t;
    return true;
  };
  if (f === "colossus") {
    // mirando longe = raio do visor; perto = soco
    const far = d3(aimPoint(c, owner, 120), c.pos()) > 18;
    if (far && now >= (c.flags.cdBeam ?? 0)) {
      beam(c, owner);
      return true;
    }
    if (cd("cdPunch", 16)) return punch(c, owner);
    return false;
  }
  if (f === "tank" && cd("cdShell", 28)) return cannon(c, owner);
  if ((f === "jet" || f === "stealth") && cd("cdMissile", f === "stealth" ? 12 : 18)) return missiles(c, owner);
  if (f === "heli" && cd("cdGun", 3)) return heliGun(c, owner);
  if (f === "excavator" && cd("cdDig", 14)) return dig(c, owner);
  if (f === "ship" && cd("cdLaser", 5)) return shipLaser(c, owner);
  if (f === "ufo" && cd("cdUfo", 10)) return ufoAttack(c, owner);
  if (f === "sub" && cd("cdTorpedo", 24)) return torpedo(c, owner);
  if ((f === "car" || f === "moto" || f === "truck" || f === "boat") && cd("cdNitro", 70)) return nitro(c);
  return false;
}

/** Botão de pular (o tick de pilotagem já trata; isto é para o painel e o autoteste). */
export function jumpAction(c) {
  if (formOf(c) === "colossus") colossusJump(c);
}

/** Turbo (carro, moto, caminhão, lancha): 2 s de arrancada com chamas. */
function nitro(c) {
  const e = c.entity;
  c.flags.nitroUntil = system.currentTick + 40;
  sound(e, "lila.jet", 1.0, 1.7);
  sound(e, "note.bass", 1, 0.6);
  for (let k = 0; k < 8; k += 2) {
    system.runTimeout(() => {
      if (!c.alive()) return;
      const fwd = yawDir(c.entity.getRotation().y);
      const p = c.pos();
      particle(c.dim(), "lila:fire", { x: p.x - fwd.x * 1.8, y: p.y + 0.5, z: p.z - fwd.z * 1.8 });
    }, k * 5);
  }
  return true;
}

/** Nave: lasers gêmeos das pontas das asas. */
function shipLaser(c, owner) {
  const dim = c.dim();
  const e = c.entity;
  const at = aimPoint(c, owner, 110);
  setAction(e, "shoot");
  system.runTimeout(() => getAction(c.entity) === "shoot" && setAction(c.entity, "idle"), 6);
  sound(e, "lila.laser", 1.2, 1.3);
  const fwd = yawDir(e.getRotation().y);
  for (const side of [-1, 1]) {
    const from = { x: e.location.x - fwd.z * 2.3 * side + fwd.x * 0.4, y: e.location.y + 0.7, z: e.location.z + fwd.x * 2.3 * side + fwd.z * 0.4 };
    trail(dim, from, at, "lila:laser", 1.6);
  }
  particle(dim, "lila:fire", at);
  areaDamage(c, at, 2.2, 16, 0.6, 0.1);
  if (c.rec.settings.destroy !== false && system.currentTick % 2 === 0) smash(dim, at, 1.2);
  return true;
}

/** Disco voador: olhando pra baixo = raio trator (abduz); senão, raio desintegrador. */
function ufoAttack(c, owner) {
  let view = { x: 0, y: -1, z: 0 };
  try {
    view = c.flags.testInput?.view ?? owner.getViewDirection();
  } catch {
    /* ignore */
  }
  if (view.y < -0.75) return tractor(c);
  const dim = c.dim();
  const e = c.entity;
  const from = { x: e.location.x, y: e.location.y + 0.4, z: e.location.z };
  const at = aimPoint(c, owner, 110);
  setAction(e, "shoot");
  system.runTimeout(() => getAction(c.entity) === "shoot" && setAction(c.entity, "idle"), 8);
  sound(e, "lila.beam", 1.2, 1.7);
  trail(dim, from, at, "lila:vlaser", 1.3);
  particle(dim, "lila:shock", at);
  if (c.rec.settings.destroy !== false) smash(dim, at, 2.2);
  areaDamage(c, at, 3.2, 26, 0.8, 0.3);
  return true;
}

/** Raio trator: ergue monstros, bichos e itens que estiverem embaixo do disco. */
export function tractor(c) {
  const e = c.entity;
  const dim = c.dim();
  const p = c.pos();
  setAction(e, "charge");
  system.runTimeout(() => getAction(c.entity) === "charge" && setAction(c.entity, "idle"), 40);
  sound(e, "beacon.power", 1.4, 1.5);
  sound(e, "lila.beam", 0.8, 2);
  for (let y = 0; y < 24; y += 2) particle(dim, "lila:scan", { x: p.x + (Math.random() - 0.5) * 3, y: p.y - y, z: p.z + (Math.random() - 0.5) * 3 });
  const keep = new Set([c.rec.ownerId, e.id, ...riders(c).map((r) => r.id)]);
  let n = 0;
  try {
    for (const t of dim.getEntities({ location: { x: p.x, y: p.y - 16, z: p.z }, maxDistance: 20 })) {
      if (keep.has(t.id) || t.typeId === "lila:robot" || t.typeId === "lila:drone" || t.location.y > p.y) continue;
      if (Math.hypot(t.location.x - p.x, t.location.z - p.z) > 5.5) continue;
      if (t.typeId === "minecraft:player" && !c.flags.aggro?.has(t.id)) continue;
      if (t.typeId === "minecraft:item" || t.typeId === "minecraft:xp_orb") {
        t.teleport({ x: p.x, y: p.y - 1.5, z: p.z });
      } else {
        t.addEffect("levitation", 70, { amplifier: 4, showParticles: true });
      }
      n++;
    }
  } catch (err) {
    logError("forms.tractor", err);
  }
  return n >= 0;
}

/** Submarino: torpedo com rastro de bolhas (explode debaixo d'água também). */
function torpedo(c, owner) {
  const dim = c.dim();
  const from = muzzle(c, 3.2, 0.7);
  const at = aimPoint(c, owner, 100);
  setAction(c.entity, "shoot");
  system.runTimeout(() => getAction(c.entity) === "shoot" && setAction(c.entity, "idle"), 10);
  sound(c.entity, "lila.missile", 1.2, 0.7);
  sound(c.entity, "bubble.upinside", 1, 1);
  trail(dim, from, at, "lila:bubbles", 2.4);
  system.runTimeout(() => {
    try {
      dim.createExplosion(at, 3.2, { breaksBlocks: c.rec.settings.destroy !== false, causesFire: false, source: c.entity });
    } catch {
      smash(dim, at, 2.6);
    }
    areaDamage(c, at, 5, 30, 1.4, 0.5);
    particle(dim, "lila:bubbles", at);
    particle(dim, "lila:shock", at);
  }, Math.min(14, Math.ceil(d3(from, at) / 8)));
  return true;
}

/** Ponto onde o olhar do piloto encosta (bloco ou longe). Sem piloto: em frente. */
function aimPoint(c, owner, max = 96) {
  const dim = c.dim();
  if (!owner?.getHeadLocation) {
    const f = yawDir(c.entity?.getRotation().y ?? 0);
    const p = c.pos();
    return { x: p.x + f.x * 8, y: p.y + 1, z: p.z + f.z * 8 };
  }
  const head = owner.getHeadLocation();
  const dir = owner.getViewDirection();
  let at = { x: head.x + dir.x * max, y: head.y + dir.y * max, z: head.z + dir.z * max };
  try {
    const hit = dim.getBlockFromRay(head, dir, { maxDistance: max, includeLiquidBlocks: false, includePassableBlocks: false });
    if (hit) at = { x: hit.block.location.x + hit.faceLocation.x, y: hit.block.location.y + hit.faceLocation.y, z: hit.block.location.z + hit.faceLocation.z };
  } catch {
    /* ignore */
  }
  try {
    const ents = dim.getEntitiesFromRay(head, dir, { maxDistance: max });
    for (const h of ents) {
      const t = h.entity;
      if (t.id === owner.id || t.id === c.entity?.id || riders(c).some((r) => r.id === t.id)) continue;
      if (h.distance < d3(head, at)) at = { ...t.location, y: t.location.y + 0.8 };
      break;
    }
  } catch {
    /* ignore */
  }
  return at;
}

function trail(dim, a, b, kind = "lila:tracer", step = 1.4) {
  const d = d3(a, b);
  const n = Math.min(40, Math.ceil(d / step));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    particle(dim, kind, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
}

function muzzle(c, fwdDist, up) {
  const e = c.entity;
  const f = yawDir(e.getRotation().y);
  return { x: e.location.x + f.x * fwdDist, y: e.location.y + up, z: e.location.z + f.z * fwdDist };
}

function cannon(c, owner) {
  const dim = c.dim();
  const from = muzzle(c, 5, 1.4);
  const at = aimPoint(c, owner, 120);
  setAction(c.entity, "shoot");
  system.runTimeout(() => getAction(c.entity) === "shoot" && setAction(c.entity, "idle"), 14);
  sound(c.entity, "lila.cannon", 2.0, 1);
  particle(dim, "lila:muzzle", from);
  particle(dim, "lila:smoke", from);
  trail(dim, from, at, "lila:tracer", 2);
  system.runTimeout(() => {
    try {
      dim.createExplosion(at, 3.5, { breaksBlocks: c.rec.settings.destroy !== false, causesFire: false, source: c.entity });
    } catch {
      smash(dim, at, 3);
    }
    areaDamage(c, at, 5, 30, 1.6, 0.5);
    particle(dim, "lila:fire", at);
    particle(dim, "lila:smoke", at);
    shake(dim, at, 0.3, 0.6, 24);
  }, Math.min(10, Math.ceil(d3(from, at) / 12)));
  return true;
}

function missiles(c, owner) {
  const dim = c.dim();
  const at = aimPoint(c, owner, 140);
  setAction(c.entity, "charge");
  system.runTimeout(() => getAction(c.entity) === "charge" && setAction(c.entity, "idle"), 12);
  for (const side of [-1, 1]) {
    const e = c.entity;
    const fwd = yawDir(e.getRotation().y);
    const from = { x: e.location.x - fwd.z * 1.6 * side, y: e.location.y + 0.5, z: e.location.z + fwd.x * 1.6 * side };
    sound(e, "lila.missile", 1.4, 1 + side * 0.05);
    trail(dim, from, at, "lila:smoke", 2.5);
    system.runTimeout(() => {
      try {
        dim.createExplosion({ x: at.x + side, y: at.y, z: at.z }, 3, { breaksBlocks: c.rec.settings.destroy !== false, source: c.entity });
      } catch {
        smash(dim, at, 2.5);
      }
      areaDamage(c, at, 5, 24);
      particle(dim, "lila:fire", at);
    }, 6 + (side > 0 ? 3 : 0));
  }
  return true;
}

function heliGun(c, owner) {
  const dim = c.dim();
  const from = muzzle(c, 2.6, 0.4);
  const at = aimPoint(c, owner, 64);
  setAction(c.entity, "shoot");
  system.runTimeout(() => getAction(c.entity) === "shoot" && setAction(c.entity, "idle"), 6);
  sound(c.entity, "lila.gatling", 0.9, 1.1);
  particle(dim, "lila:muzzle", from);
  trail(dim, from, at);
  areaDamage(c, at, 1.8, 9, 0.4, 0.1);
  particle(dim, "lila:ping", at);
  return true;
}

function dig(c, owner) {
  const dim = c.dim();
  const at = aimPoint(c, owner, 9);
  if (d3(at, c.pos()) > 9.5) return false;
  setAction(c.entity, "work");
  system.runTimeout(() => getAction(c.entity) === "work" && setAction(c.entity, "idle"), 24);
  system.runTimeout(() => {
    smash(dim, at, 1.6, true);
    particle(dim, "lila:dust", at);
    sound(c.entity, "dig.gravel", 1, 0.6);
    sound(c.entity, "lila.servo", 0.7, 0.8);
  }, 8);
  return true;
}

// ------------------------------------------------------------------ colosso
function colossusTick(c, hs) {
  const e = c.entity;
  if (!e) return;
  // pouso do salto: onda de choque
  if (!e.isOnGround) c.flags.colAir = (c.flags.colAir || 0) + 1;
  else if (c.flags.colAir > 8) {
    c.flags.colAir = 0;
    landShock(c);
  } else c.flags.colAir = 0;
  // passos pesados: som, poeira e tremor no ritmo da passada
  c.flags.stride = (c.flags.stride ?? 0) + hs;
  if (c.flags.stride > 5.5) {
    c.flags.stride = 0;
    const p = e.location;
    sound(e, "lila.stomp", 1.4, 1.1 + Math.random() * 0.15);
    sound(e, "mob.irongolem.walk", 1.5, 0.4);
    sound(e, "lila.servo", 0.5, 0.7);
    particle(e.dimension, "lila:dust", { x: p.x, y: p.y + 0.2, z: p.z });
    shake(e.dimension, p, 0.12, 0.35, 30);
    // pisar em monstros pequenos
    areaDamage(c, p, 4.5, 14, 0.8, 0.2);
  }
}

/** Anda derrubando o que estiver na frente (árvores, paredes) e sobe morros. */
function colossusStep(c, fwd, sign) {
  const e = c.entity;
  if (!e || system.currentTick % 4 !== 0) return;
  const dim = e.dimension;
  const p = e.location;
  const ax = p.x + fwd.x * 4.5 * sign, az = p.z + fwd.z * 4.5 * sign;
  // degrau de até 6 blocos: sobe
  for (let up = 1; up <= 6; up++) {
    const b = blockAt(dim, Math.floor(ax), Math.floor(p.y) + up - 1, Math.floor(az));
    const free = blockAt(dim, Math.floor(ax), Math.floor(p.y) + up, Math.floor(az));
    if (!b || b.isAir || b.isLiquid) break;
    if (free && free.isAir && up >= 2) {
      try {
        e.teleport({ x: p.x + fwd.x * 0.6 * sign, y: Math.floor(p.y) + up, z: p.z + fwd.z * 0.6 * sign }, { keepVelocity: false });
      } catch {
        /* ignore */
      }
      return;
    }
  }
  // o que tiver na altura do corpo, ele atravessa derrubando
  try {
    const left = { x: -fwd.z, z: fwd.x };
    const x0 = ax - left.x * 3, z0 = az - left.z * 3, x1 = ax + left.x * 3, z1 = az + left.z * 3;
    const vol = new BlockVolume({ x: Math.floor(Math.min(x0, x1)), y: Math.floor(p.y) + 1, z: Math.floor(Math.min(z0, z1)) },
      { x: Math.floor(Math.max(x0, x1)), y: Math.floor(p.y) + 22, z: Math.floor(Math.max(z0, z1)) });
    if (c.rec.settings.destroy !== false) {
      const before = dim.getBlock({ x: Math.floor(ax), y: Math.floor(p.y) + 2, z: Math.floor(az) });
      if (before && !before.isAir) {
        dim.fillBlocks(vol, "minecraft:air", { blockFilter: { excludeTypes: NEVER_BREAK } });
        particle(dim, "lila:dust", { x: ax, y: p.y + 3, z: az });
        sound(e, "random.break", 1, 0.5);
      }
    } else {
      dim.fillBlocks(vol, "minecraft:air", { blockFilter: { includeTypes: SOFT } });
    }
  } catch {
    /* ignore */
  }
}

function colossusFront(c, dist, up) {
  const e = c.entity;
  const fwd = yawDir(e.getRotation().y);
  return { x: e.location.x + fwd.x * dist, y: e.location.y + up, z: e.location.z + fwd.z * dist };
}

function punch(c, owner) {
  const e = c.entity;
  setAction(e, "work");
  sound(e, "lila.servo", 1, 0.6);
  system.runTimeout(() => {
    if (!c.alive()) return;
    const at = colossusFront(c, 2.6 * SCALE, 2.4 * SCALE);
    // o soco acompanha um pouco o seu olhar (mira de cima pra baixo)
    const look = owner?.getViewDirection?.();
    if (look) at.y = Math.max(c.pos().y + 1, at.y + look.y * 8);
    const dim = c.dim();
    if (c.rec.settings.destroy !== false) smash(dim, at, 3.6);
    // o golpe pega do punho até o chão (monstros pequenos não escapam por baixo)
    areaDamage(c, at, 6, 70, 2.6, 0.7);
    areaDamage(c, { x: at.x, y: c.pos().y + 1, z: at.z }, 6, 70, 2.6, 0.7);
    particle(dim, "lila:dust", { x: at.x, y: c.pos().y + 0.5, z: at.z });
    particle(dim, "lila:shock", at);
    particle(dim, "lila:dust", at);
    particle(dim, "lila:smoke", at);
    sound(e, "random.explode", 1.6, 0.55);
    sound(e, "lila.stomp", 1.6, 1.3);
    shake(dim, at, 0.35, 0.6, 40);
  }, 8);
  system.runTimeout(() => getAction(c.entity) === "work" && setAction(c.entity, "idle"), 18);
  return true;
}

function landShock(c) {
  const at = c.pos();
  const dim = c.dim();
  for (let k = 0; k < 3; k++) particle(dim, "lila:shock", { x: at.x, y: at.y + 0.3 + k * 0.4, z: at.z });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    particle(dim, "lila:dust", { x: at.x + Math.cos(a) * 8, y: at.y + 0.3, z: at.z + Math.sin(a) * 8 });
  }
  areaDamage(c, at, 14, 50, 3.4, 1.0);
  sound(c.entity, "lila.stomp", 2.4, 0.7);
  sound(c.entity, "random.explode", 2, 0.4);
  shake(dim, at, 0.8, 1.4, 70);
}

export function stomp(c) {
  const e = c.entity;
  if (!e) return;
  setAction(e, "place");
  sound(e, "lila.servo", 1, 0.5);
  system.runTimeout(() => {
    if (!c.alive()) return;
    const at = c.pos();
    const dim = c.dim();
    for (let k = 0; k < 3; k++) particle(dim, "lila:shock", { x: at.x, y: at.y + 0.3 + k * 0.4, z: at.z });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      particle(dim, "lila:dust", { x: at.x + Math.cos(a) * 7, y: at.y + 0.3, z: at.z + Math.sin(a) * 7 });
    }
    areaDamage(c, at, 12, 45, 3.2, 0.9);
    sound(e, "lila.stomp", 2, 0.8);
    sound(e, "random.explode", 1.8, 0.4);
    shake(dim, at, 0.7, 1.2, 60);
  }, 13);
  system.runTimeout(() => getAction(c.entity) === "place" && setAction(c.entity, "idle"), 24);
}

/** Salto do TITÃ: agacha, os propulsores acendem, sobe ~8 blocos e cai com onda de choque. */
function colossusJump(c) {
  const e = c.entity;
  const now = system.currentTick;
  if (!e || now < (c.flags.cdStomp ?? 0) || !e.isOnGround) return;
  c.flags.cdStomp = now + 40;
  c.flags.colJumpAt = now + 6;
  c.flags.colAir = false;
  setAction(e, "place");
  sound(e, "lila.servo", 1, 0.5);
  system.runTimeout(() => {
    if (!c.alive()) return;
    sound(c.entity, "lila.jet", 2, 0.6);
    sound(c.entity, "mob.enderdragon.flap", 1.5, 0.5);
    const p = c.pos();
    for (const s of [-1, 1]) particle(c.dim(), "lila:fire", { x: p.x + s * 1.2, y: p.y + 4, z: p.z + 2 });
    if (!c.flags.piloting) {
      try {
        c.entity.applyImpulse({ x: 0, y: 1.15, z: 0 });
      } catch {
        /* ignore */
      }
    }
  }, 6);
  system.runTimeout(() => getAction(c.entity) === "place" && setAction(c.entity, "idle"), 26);
}

/** Raio do visor, para onde você olha (carrega 1 s, dispara 2,5 s). */
export function beam(c, owner) {
  const e = c.entity;
  if (!e || system.currentTick < (c.flags.cdBeam ?? 0)) return;
  c.flags.cdBeam = system.currentTick + 110;
  setAction(e, "charge");
  sound(e, "beacon.activate", 1.5, 0.6);
  sound(e, "lila.servo", 1, 0.4);
  const dim = c.dim();
  let k = 0;
  const id = system.runInterval(() => {
    k++;
    if (!c.alive() || formOf(c) !== "colossus") {
      system.clearRun(id);
      return;
    }
    if (k === 20) {
      sound(c.entity, "mob.warden.sonic_boom", 2, 0.6);
      sound(c.entity, "lila.beam", 2, 1);
    }
    if (k > 20 && k % 2 === 0) {
      const mouth = colossusFront(c, 0.8 * SCALE, 7.25 * SCALE); // visor em T
      const o = c.owner();
      const dir = o && riders(c).some((r) => r.id === o.id) ? o.getViewDirection() : (() => {
        const f = yawDir(c.entity.getRotation().y);
        return { x: f.x, y: -0.25, z: f.z };
      })();
      let end = { x: mouth.x + dir.x * 90, y: mouth.y + dir.y * 90, z: mouth.z + dir.z * 90 };
      try {
        const hit = dim.getBlockFromRay(mouth, dir, { maxDistance: 90, includeLiquidBlocks: true, includePassableBlocks: false });
        if (hit) end = { x: hit.block.location.x + 0.5, y: hit.block.location.y + 0.5, z: hit.block.location.z + 0.5 };
      } catch {
        /* ignore */
      }
      trail(dim, mouth, end, "lila:beam", 2.2);
      if (c.rec.settings.destroy !== false) smash(dim, end, 2.6);
      particle(dim, "lila:fire", end);
      particle(dim, "lila:shock", end);
      try {
        for (const h of dim.getEntitiesFromRay(mouth, dir, { maxDistance: 90 })) {
          const t = h.entity;
          if (t.id === c.rec.ownerId || t.id === c.entity?.id || t.typeId === "lila:robot" || riders(c).some((r) => r.id === t.id)) continue;
          if (t.typeId === "minecraft:player" && !c.flags.aggro?.has(t.id)) continue;
          t.applyDamage(28, { cause: EntityDamageCause.fire, damagingEntity: c.entity });
          t.setOnFire?.(5, true);
        }
      } catch {
        /* ignore */
      }
      areaDamage(c, end, 4, 18, 1.2, 0.3);
      if (k % 20 === 0) sound(c.entity, "lila.beam", 2, 1);
      if (k % 10 === 0) shake(dim, c.pos(), 0.2, 0.5, 40);
    }
    if (k >= 70) {
      system.clearRun(id);
      if (c.alive() && getAction(c.entity) === "charge") setAction(c.entity, "idle");
    }
  }, 1);
}

export function roar(c) {
  const e = c.entity;
  if (!e || system.currentTick < (c.flags.cdRoar ?? 0)) return;
  c.flags.cdRoar = system.currentTick + 60;
  setAction(e, "celebrate");
  sound(e, "lila.roar", 2.4, 0.9);
  sound(e, "mob.ravager.roar", 1.5, 0.4);
  sound(e, "mob.enderdragon.growl", 0.8, 0.6);
  shake(e.dimension, e.location, 0.5, 2, 70);
  // monstros por perto ficam fracos e lentos de medo
  try {
    for (const t of e.dimension.getEntities({ location: e.location, maxDistance: 28, families: ["monster"] })) {
      t.addEffect("slowness", 200, { amplifier: 2 });
      t.addEffect("weakness", 200, { amplifier: 1 });
    }
  } catch {
    /* ignore */
  }
  system.runTimeout(() => getAction(c.entity) === "celebrate" && setAction(c.entity, "idle"), 44);
}

/** Troca de cabine: o dono vai pra cabeça (pilota) ou para uma cabine (fica parado). */
export function switchSeat(c, owner, toHead = true) {
  const e = c.entity;
  const rc = e?.getComponent("minecraft:rideable");
  if (!rc) return false;
  const rs = riders(c);
  const others = rs.filter((r) => r.id !== owner.id);
  rc.ejectRiders();
  if (toHead) {
    rc.addRider(owner);
    for (const r of others) rc.addRider(r);
  } else {
    // ocupa o assento da cabeça com ninguém: entra depois dos outros
    for (const r of others) rc.addRider(r);
    if (!others.length) {
      // sozinho: precisa de alguém na cabeça para ir a uma cabine — fica na cabeça
      rc.addRider(owner);
      return false;
    }
    rc.addRider(owner);
  }
  return true;
}

// ------------------------------------------------------------------ torreta gigante
/** Modo torreta: pousa, vira a ARMA GIGANTE fincada no chão e metralha tudo que for inimigo. */
export function* turretGoal(c) {
  if (formOf(c) !== "turret") {
    const spot = yield* land(c);
    if (!spot) {
      say(c, "Não achei chão firme pra virar torreta aqui. Me leva pra perto do chão!", { force: true });
      c.rec.mode = "follow";
      return;
    }
    setForm(c, "turret");
    yield 20;
  }
  const e = c.entity;
  if (!e) return;
  const anchor = { ...e.location };
  const baseYaw = e.getRotation().y;
  let lastShot = 0, lastMissile = 0;
  while (c.alive() && c.rec.mode === "turret" && formOf(c) === "turret") {
    const p = c.pos();
    if (Math.abs(p.x - anchor.x) > 0.4 || Math.abs(p.z - anchor.z) > 0.4) {
      try {
        c.entity?.teleport(anchor, { keepVelocity: false, rotation: { x: 0, y: baseYaw } });
      } catch {
        /* ignore */
      }
    }
    const t = turretTarget(c);
    if (t) {
      const eye = { x: p.x, y: p.y + 3.6, z: p.z };
      const tl = { x: t.location.x, y: t.location.y + 0.9, z: t.location.z };
      const yaw = (-Math.atan2(tl.x - eye.x, tl.z - eye.z) * 180) / Math.PI;
      const pitch = (Math.atan2(tl.y - eye.y, Math.hypot(tl.x - eye.x, tl.z - eye.z)) * 180) / Math.PI;
      try {
        c.entity?.setProperty("lila:aim", Math.round(Math.max(-180, Math.min(180, wrap(-(yaw - baseYaw))))));
        c.entity?.setProperty("lila:pitch", Math.round(Math.max(-60, Math.min(60, pitch))));
      } catch {
        /* ignore */
      }
      const now = system.currentTick;
      if (now - lastShot >= 2 && clearLine(c.dim(), eye, tl, 1.2)) {
        lastShot = now;
        setAction(c.entity, "shoot");
        const dim = c.dim();
        trail(dim, eye, tl);
        particle(dim, "lila:muzzle", eye);
        if (now % 6 === 0) sound(c.entity, "lila.gatling", 1.2, 0.9);
        try {
          t.applyDamage((c.def?.gun?.damage ?? 7) * 1.6, { cause: EntityDamageCause.entityAttack, damagingEntity: c.entity });
        } catch {
          /* ignore */
        }
      }
      if (now - lastMissile >= 70 && crowd(c, t) >= 2) {
        lastMissile = now;
        setAction(c.entity, "charge");
        sound(c.entity, "lila.missile", 1.5, 1);
        const at = { ...t.location };
        trail(c.dim(), eye, at, "lila:smoke", 2);
        system.runTimeout(() => {
          try {
            c.dim().createExplosion(at, 2.6, { breaksBlocks: false, source: c.entity });
          } catch {
            /* ignore */
          }
          areaDamage(c, at, 5, 26);
        }, 8);
      }
    } else {
      if (getAction(c.entity) !== "idle") setAction(c.entity, "idle");
      if (system.currentTick % 50 === 0) {
        try {
          const a = Number(c.entity?.getProperty("lila:aim") ?? 0);
          c.entity?.setProperty("lila:aim", Math.round(wrap(a + 30)));
          c.entity?.setProperty("lila:pitch", 0);
        } catch {
          /* ignore */
        }
      }
    }
    hover(c);
    yield 1;
  }
  setAction(c.entity, "idle");
  if (c.alive() && formOf(c) === "turret") setForm(c, "drone", { mount: false });
}

function crowd(c, t) {
  try {
    return t.dimension.getEntities({ location: t.location, maxDistance: 5, families: ["monster"] }).length;
  } catch {
    return 0;
  }
}

function turretTarget(c) {
  const dim = c.dim();
  const p = c.pos();
  let best, bd = Infinity;
  // inimigos marcados (inclusive jogadores que bateram em você ou nele) primeiro
  for (const id of c.flags.aggro?.keys() ?? []) {
    try {
      const t = dim.getEntities({ location: p, maxDistance: 56 }).find((x) => x.id === id);
      if (t?.isValid) {
        const d = d3(t.location, p);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (best) return best;
  const o = c.owner();
  const centers = [p, ...(o ? [o.location] : [])];
  for (const ce of centers) {
    try {
      for (const t of dim.getEntities({ location: ce, maxDistance: 44, families: ["monster"] })) {
        if (!canAttack(c, t) || !isHostile(t)) continue;
        const d = d3(t.location, p);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return best;
}
