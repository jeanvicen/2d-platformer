// Relíquias lançáveis (Martelo, Machado, Lança) — ciclo de estados explícito e anti-duplicação.
//
//   STORED → MATERIALIZING → HELD → THROWING → FLYING → LANDED → RETURNING → CAUGHT
//                                                   ↘ EXPIRED (tempo máximo) / SHADOW RETURN (chunk/dimensão)
//
// Invariante: cada instância (instanceId) existe em EXATAMENTE um lugar —
//   (a) item da relíquia no inventário, ou (b) "Chamado da Relíquia" + entidade lançada.
// O item original só sai da mão depois que a entidade foi criada com sucesso.
import { EntityDamageCause, system, world } from "@minecraft/server";
import { COLORS } from "../core/config.js";
import { actionbar, chat, particle, playerSound, sound } from "../core/fx.js";
import { container, findSlotByProp, give, makeItem } from "../core/items.js";
import { logError } from "../core/log.js";
import { readJSON, writeJSON } from "../core/persistence.js";
import { getProfile, markDirty, saveSoon } from "../core/player_profile.js";
import { worldConfig } from "../core/world_config.js";
import { dist, lerpV, norm, sub, uid } from "../core/util.js";
import { hostilesAround, hurt, isHostileTarget, push } from "../abilities/combat.js";
import { GENERATED } from "../data/generated.js";
import { addXp, questProgress } from "../progression/progression_manager.js";

const REG = "eclipse:thrown_registry";
/** @type {Record<string, {id:string,owner:string,ownerName:string,relic:string,dim:string,pos:number[],state:string,t:number}>} */
let registry = {};
let loaded = false;
/** runtime de voo/retorno: id -> {...} */
const live = new Map();

const NAMES = Object.fromEntries(GENERATED.relics.map((r) => [r.key, r.name]));
export const THROWABLE = GENERATED.relics.filter((r) => r.throwable).map((r) => r.key);

function load() {
  if (loaded) return;
  loaded = true;
  const r = readJSON(world, REG, {});
  registry = r && typeof r === "object" ? r : {};
}

function persist() {
  writeJSON(world, REG, registry);
}

function handPos(player) {
  const h = player.getHeadLocation();
  const d = player.getViewDirection();
  return { x: h.x + d.x * 0.6 - d.z * 0.35, y: h.y - 0.45, z: h.z + d.z * 0.6 + d.x * 0.35 };
}

export function relicItem(relic) {
  return makeItem(`eclipse:${relic}`, { keep: true });
}

/** Lança a relíquia que está na mão. */
export function throwRelic(player, relic) {
  load();
  try {
    const inv = container(player);
    const slot = player.selectedSlotIndex;
    const held = inv?.getItem(slot);
    if (!inv || held?.typeId !== `eclipse:${relic}`) return false;
    const dim = player.dimension;
    const head = player.getHeadLocation();
    const dir = player.getViewDirection();
    const start = { x: head.x + dir.x * 1.1, y: head.y + dir.y * 1.1 - 0.3, z: head.z + dir.z * 1.1 };
    const range = relic === "astral_spear" ? 48 : 40;
    let end = { x: start.x + dir.x * range, y: start.y + dir.y * range, z: start.z + dir.z * range };
    let landedOnBlock = false;
    const hit = dim.getBlockFromRay(start, dir, { maxDistance: range, includeLiquidBlocks: false, includePassableBlocks: false });
    if (hit) {
      const b = hit.block.location;
      end = { x: b.x + hit.faceLocation.x, y: b.y + hit.faceLocation.y, z: b.z + hit.faceLocation.z };
      landedOnBlock = true;
    }
    // primeiro inimigo no caminho (martelo e machado param nele; a lança atravessa)
    const reach = dist(start, end);
    if (relic !== "astral_spear") {
      const ents = dim.getEntitiesFromRay(start, dir, { maxDistance: reach });
      const foe = ents.find((h) => isHostileTarget(player, h.entity, { includeNeutral: false }));
      if (foe) end = { x: foe.entity.location.x, y: foe.entity.location.y + 0.6, z: foe.entity.location.z };
    }
    const id = uid("r");
    // 1) cria a entidade; 2) só então troca o item da mão pelo Chamado
    const ent = dim.spawnEntity(`eclipse:thrown_${relic}`, start);
    if (!ent?.isValid) return false;
    ent.setDynamicProperty("eclipse:instance", id);
    ent.setDynamicProperty("eclipse:owner", player.id);
    ent.setDynamicProperty("eclipse:relic", relic);
    const token = makeItem("eclipse:relic_recall", {
      name: `§5Chamado: ${NAMES[relic] ?? relic}`,
      lore: ["§7Toque para trazer a relíquia de volta à mão.", "§8Vinculado a você — não pode ser descartado."],
      lock: "inventory",
      keep: true,
      props: { "eclipse:instance": id, "eclipse:relic": relic },
    });
    try {
      inv.setItem(slot, token);
    } catch (e) {
      ent.remove();
      logError("relic.token", e);
      return false;
    }
    registry[id] = { id, owner: player.id, ownerName: player.name, relic, dim: dim.id, pos: [start.x, start.y, start.z], state: "flying", t: system.currentTick };
    const p = getProfile(player);
    p.thrown[id] = { relic, state: "flying" };
    p.stats.throws++;
    markDirty(player);
    const d = dist(start, end);
    live.set(id, {
      phase: "flying", start, end, n: Math.max(6, Math.min(32, Math.round(d / 1.6))), i: 0,
      arc: relic === "astral_spear" ? 0 : Math.min(3, d * 0.07), hitIds: new Set(), landedOnBlock, speed: 0.5, steps: 0,
    });
    playerSound(player, "eclipse.hammer_throw", 1, relic === "eclipse_axe" ? 1.2 : 1.0);
    actionbar(player, "§5✦ Relíquia lançada §7— toque no §dChamado§7 para ela voltar");
    persist();
    return true;
  } catch (e) {
    logError("relic.throw", e);
    return false;
  }
}

/** Toque no "Chamado da Relíquia". */
export function recallRelic(player, token) {
  load();
  const id = String(token?.getDynamicProperty("eclipse:instance") ?? "");
  const relic = String(token?.getDynamicProperty("eclipse:relic") ?? "");
  const reg = registry[id];
  if (!reg || reg.owner !== player.id) {
    // token órfão (ex.: registro perdido): devolve a relíquia uma única vez
    convertToken(player, id, relic || "eclipse_hammer");
    actionbar(player, "§7A relíquia atravessou as sombras e voltou para você.");
    return;
  }
  const ent = findEntity(id, reg);
  if (!ent || ent.dimension.id !== player.dimension.id) {
    shadowReturn(player, id, reg, ent);
    return;
  }
  const rt = live.get(id) ?? { hitIds: new Set(), speed: 0.5, steps: 0 };
  rt.phase = "returning";
  rt.steps = 0;
  rt.speed = 0.6;
  live.set(id, rt);
  reg.state = "returning";
  try {
    ent.triggerEvent("eclipse:spin_on");
  } catch {
    /* */
  }
  playerSound(player, "eclipse.hammer_return", 1, 1);
  persist();
}

function findEntity(id, reg) {
  try {
    const dim = world.getDimension(reg.dim);
    const pos = { x: reg.pos[0], y: reg.pos[1], z: reg.pos[2] };
    if (!dim.isChunkLoaded(pos)) return undefined;
    const ents = dim.getEntities({ location: pos, maxDistance: 6, type: `eclipse:thrown_${reg.relic}` });
    return ents.find((e) => e.getDynamicProperty("eclipse:instance") === id);
  } catch {
    return undefined;
  }
}

/** Retorno pela sombra quando a entidade não pode voar até você (chunk descarregado/outra dimensão). */
function shadowReturn(player, id, reg, ent) {
  try {
    if (ent?.isValid) ent.remove();
  } catch {
    /* */
  }
  finishCatch(player, id, reg.relic, true);
  actionbar(player, "§5✦ A relíquia atravessou as sombras e voltou para sua mão.");
}

/** Troca o Chamado pela relíquia (ou entrega, se o Chamado sumiu). Nunca cria duas. */
function convertToken(player, id, relic) {
  const inv = container(player);
  const slot = inv ? findSlotByProp(player, "eclipse:relic_recall", "eclipse:instance", id) : -1;
  if (slot >= 0) inv.setItem(slot, relicItem(relic));
  else give(player, relicItem(relic));
}

function finishCatch(player, id, relic, silent = false) {
  convertToken(player, id, relic);
  delete registry[id];
  live.delete(id);
  const p = getProfile(player);
  delete p.thrown[id];
  p.owed = p.owed.filter((x) => x !== id);
  markDirty(player);
  persist();
  saveSoon(player);
  if (!silent) {
    playerSound(player, "random.anvil_land", 0.35, 1.7);
    particle(player.dimension, "eclipse:spark_burst", handPos(player), { color: COLORS.violet, count: 14, speed: 1.5 });
  }
  if (relic === "eclipse_hammer") questProgress(player, "thunder");
  addXp(player, 3, "relic.catch");
}

function impact(owner, ent, relic, loc) {
  const dim = ent.dimension;
  const cfg = worldConfig();
  if (relic === "eclipse_hammer") {
    particle(dim, "eclipse:lightning_column", loc, { color: { red: 0.8, green: 0.65, blue: 1 } });
    particle(dim, "eclipse:flash", { x: loc.x, y: loc.y + 1, z: loc.z }, { color: { red: 0.85, green: 0.7, blue: 1 }, radius: 5 });
    particle(dim, "eclipse:ring", { x: loc.x, y: loc.y + 0.1, z: loc.z }, { color: COLORS.violet, radius: 7, life: 0.6 });
    particle(dim, "eclipse:ground_impact", loc, {});
    sound(dim, "eclipse.thunder", loc, 1.2, 1);
    if (cfg.realLightning) {
      try {
        dim.spawnEntity("minecraft:lightning_bolt", loc);
      } catch (e) {
        logError("relic.lightning", e);
      }
    }
    if (owner) for (const e of hostilesAround(owner, loc, 3.8)) {
      hurt(owner, e, 10, EntityDamageCause.lightning);
      push(e, loc, 1.2, 0.5);
    }
  } else if (relic === "eclipse_axe") {
    particle(dim, "eclipse:spark_burst", loc, { color: COLORS.violet, count: 24, speed: 4 });
    particle(dim, "eclipse:ground_impact", loc, {});
    sound(dim, "random.anvil_land", loc, 0.5, 0.7);
    if (owner) for (const e of hostilesAround(owner, loc, 2.8)) {
      hurt(owner, e, 8, EntityDamageCause.entityAttack);
      try {
        e.addEffect("slowness", 60, { amplifier: 1 });
      } catch {
        /* */
      }
    }
  } else {
    particle(dim, "eclipse:spark_burst", loc, { color: COLORS.cyan, count: 18, speed: 3 });
    sound(dim, "item.trident.hit_ground", loc, 1, 1);
  }
}

/** Avanço por tick de todas as relíquias em voo/retorno. */
export function tickThrown() {
  if (!live.size) return;
  load();
  for (const [id, rt] of live) {
    const reg = registry[id];
    if (!reg) {
      live.delete(id);
      continue;
    }
    const owner = world.getAllPlayers().find((p) => p.id === reg.owner);
    let ent = rt.entity && rt.entity.isValid ? rt.entity : findEntity(id, reg);
    if (!ent) {
      // entidade descarregada: congela; recuperação ocorre via Chamado (retorno pela sombra)
      if (rt.phase === "returning" && owner) shadowReturn(owner, id, reg, undefined);
      continue;
    }
    rt.entity = ent;
    try {
      if (rt.phase === "flying") {
        rt.i++;
        const t = Math.min(1, rt.i / rt.n);
        const pos = lerpV(rt.start, rt.end, t);
        pos.y += Math.sin(t * Math.PI) * rt.arc;
        ent.teleport(pos, { keepVelocity: false });
        reg.pos = [pos.x, pos.y, pos.z];
        if (owner) {
          for (const e of ent.dimension.getEntities({ location: pos, maxDistance: 1.6 })) {
            if (rt.hitIds.has(e.id) || !isHostileTarget(owner, e)) continue;
            rt.hitIds.add(e.id);
            hurt(owner, e, reg.relic === "astral_spear" ? 9 : 7, EntityDamageCause.projectile);
            push(e, rt.start, 0.8, 0.3);
          }
        }
        if (rt.i % 2 === 0) particle(ent.dimension, "eclipse:trail", pos, { color: reg.relic === "astral_spear" ? COLORS.cyan : COLORS.violet, size: 0.35 });
        if (t >= 1) {
          rt.phase = "landed";
          reg.state = "landed";
          reg.t = system.currentTick;
          ent.triggerEvent("eclipse:spin_off");
          impact(owner, ent, reg.relic, pos);
          persist();
          if (reg.relic === "astral_spear") {
            // a Lança Astral volta sozinha
            system.runTimeout(() => {
              const pl = world.getAllPlayers().find((p) => p.id === reg.owner);
              const tokenOwner = pl;
              if (tokenOwner && registry[id]) {
                const rr = live.get(id);
                if (rr) {
                  rr.phase = "returning";
                  rr.speed = 0.6;
                  rr.steps = 0;
                  ent.isValid && ent.triggerEvent("eclipse:spin_on");
                  registry[id].state = "returning";
                }
              }
            }, 15);
          }
        }
      } else if (rt.phase === "returning") {
        if (!owner || owner.dimension.id !== ent.dimension.id) {
          if (owner) shadowReturn(owner, id, reg, ent);
          continue;
        }
        const target = handPos(owner);
        const d = dist(ent.location, target);
        rt.steps++;
        rt.speed = Math.min(2.2, rt.speed * 1.12);
        if (d <= Math.max(1.3, rt.speed) || rt.steps > 120) {
          try {
            ent.remove();
          } catch {
            /* */
          }
          finishCatch(owner, id, reg.relic);
          continue;
        }
        const dir = norm(sub(target, ent.location));
        const pos = { x: ent.location.x + dir.x * rt.speed, y: ent.location.y + dir.y * rt.speed, z: ent.location.z + dir.z * rt.speed };
        ent.teleport(pos, { keepVelocity: false, facingLocation: target });
        reg.pos = [pos.x, pos.y, pos.z];
        if (rt.steps % 2 === 0) particle(ent.dimension, "eclipse:trail", pos, { color: COLORS.violet, size: 0.3 });
      }
    } catch (e) {
      logError("relic.tick", e);
    }
  }
}

/** Expiração no chão + reconciliação de entidades (a cada 5 s). */
export function maintainThrown() {
  load();
  const now = system.currentTick;
  const max = worldConfig().relicGroundTimeSec * 20;
  let changed = false;
  for (const [id, reg] of Object.entries(registry)) {
    if (reg.state !== "landed") continue;
    const owner = world.getAllPlayers().find((p) => p.id === reg.owner);
    if (now - reg.t < max && now >= reg.t) continue;
    // EXPIRED: volta sozinha se o dono está online; senão fica "devida" para quando ele voltar
    if (owner) {
      const ent = findEntity(id, reg);
      if (ent && ent.dimension.id === owner.dimension.id) {
        const rt = live.get(id) ?? { hitIds: new Set(), speed: 0.6, steps: 0 };
        rt.phase = "returning";
        rt.entity = ent;
        live.set(id, rt);
        reg.state = "returning";
        ent.triggerEvent("eclipse:spin_on");
        chat(owner, "§7A relíquia ficou tempo demais no chão e está voltando para você.");
      } else shadowReturn(owner, id, reg, ent);
    } else {
      const ent = findEntity(id, reg);
      try {
        if (ent) ent.remove();
      } catch {
        /* */
      }
      reg.state = "owed";
    }
    changed = true;
  }
  // entidades lançadas sem registro válido (duplicatas/órfãs) são removidas
  for (const dimId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    try {
      const dim = world.getDimension(dimId);
      for (const e of dim.getEntities({ families: ["eclipse_thrown"] })) purgeIfOrphan(e);
    } catch {
      /* */
    }
  }
  if (changed) persist();
}

export function purgeIfOrphan(e) {
  try {
    load();
    const id = e.getDynamicProperty("eclipse:instance");
    const reg = typeof id === "string" ? registry[id] : undefined;
    if (!reg || reg.state === "owed") {
      e.remove();
      return true;
    }
    if (!live.has(id)) live.set(id, { phase: reg.state === "returning" ? "returning" : "landed", entity: e, hitIds: new Set(), speed: 0.6, steps: 0 });
  } catch (err) {
    logError("relic.purge", err);
  }
  return false;
}

/** Ao entrar no mundo: devolve relíquias devidas e retoma as pendentes. */
export function reconcileOnJoin(player) {
  load();
  for (const [id, reg] of Object.entries(registry)) {
    if (reg.owner !== player.id) continue;
    if (reg.state === "owed" || reg.state === "returning") {
      finishCatch(player, id, reg.relic, true);
      chat(player, `§5✦ Sua relíquia §d${NAMES[reg.relic] ?? reg.relic}§5 retornou das sombras.`);
    } else if (!live.has(id)) {
      live.set(id, { phase: "landed", hitIds: new Set(), speed: 0.6, steps: 0 });
    }
  }
  // Chamados sem registro (ex.: mundo restaurado de backup) viram relíquia, uma vez
  const inv = container(player);
  if (inv) for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it?.typeId !== "eclipse:relic_recall") continue;
    const id = String(it.getDynamicProperty("eclipse:instance") ?? "");
    if (!registry[id]) inv.setItem(i, relicItem(String(it.getDynamicProperty("eclipse:relic") ?? "eclipse_hammer")));
  }
}

export function relicsOut(player) {
  load();
  return Object.values(registry).filter((r) => r.owner === player.id);
}

/** Recupera todas as relíquias lançadas (comando de emergência). */
export function recallAllRelics(player) {
  load();
  for (const [id, reg] of Object.entries(registry)) if (reg.owner === player.id) shadowReturn(player, id, reg, findEntity(id, reg));
}

export function thrownStats() {
  load();
  return { registered: Object.keys(registry).length, live: live.size };
}
