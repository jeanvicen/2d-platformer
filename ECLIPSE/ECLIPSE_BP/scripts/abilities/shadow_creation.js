// Criações temporárias (plataformas, pontes, escadas, barreiras, pilar, lanterna, cúpula)
// e manipulação (puxar itens, empurrar/puxar criaturas). Toda criação tem dono, dimensão,
// posição e validade registrados; só ocupa espaço de AR e se desfaz sozinha.
import { world } from "@minecraft/server";
import { ELEMENTS } from "../core/config.js";
import { actionbar, particle, playerParticle, playerSound, sound } from "../core/fx.js";
import { logError } from "../core/log.js";
import { readJSON, writeJSON } from "../core/persistence.js";
import { getProfile, markDirty } from "../core/player_profile.js";
import { tryUse } from "../core/cooldowns.js";
import { worldConfig } from "../core/world_config.js";
import { cardinal, rightOf, yawDir } from "../core/util.js";
import { isHostileTarget, push } from "./combat.js";
import { addXp } from "../progression/progression_manager.js";

/** @type {{o:string,d:string,p:[number,number,number],t:string,e:number}[]} */
let registry = [];
let loaded = false;
let changed = false;

export const CONSTRUCTS = [
  { key: "platform", name: "Plataforma", desc: "5×5 sob seus pés (ou à frente no chão)" },
  { key: "bridge", name: "Ponte", desc: "12 blocos na direção do olhar" },
  { key: "stairs", name: "Escadaria", desc: "8 degraus subindo à frente" },
  { key: "wall", name: "Barreira", desc: "Muro 5×3 à sua frente" },
  { key: "pillar", name: "Pilar Ascendente", desc: "Ergue você 6 blocos" },
  { key: "lantern", name: "Lanterna", desc: "Luz onde você olha" },
  { key: "dome", name: "Cúpula de Refúgio", desc: "Abrigo ao seu redor" },
  { key: "pull", name: "Puxar Itens", desc: "Atrai itens caídos até você" },
  { key: "grip", name: "Telecinese", desc: "Puxa a criatura que você olha" },
];

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  const data = readJSON(world, "eclipse:constructs", []);
  registry = Array.isArray(data) ? data.filter((r) => r && Array.isArray(r.p)) : [];
}

export function persistConstructs() {
  if (!changed) return;
  changed = false;
  writeJSON(world, "eclipse:constructs", registry);
}

export function constructCount(playerId) {
  ensureLoaded();
  return registry.filter((r) => r.o === playerId).length;
}

/** Bloco temporário apropriado ao modo/elemento do jogador. */
export function blockFor(player) {
  const p = getProfile(player);
  if (p.mode === "god") return "eclipse:radiant_block";
  if (p.mode === "haze") return ELEMENTS[p.element]?.block ?? "eclipse:earth_block";
  return "eclipse:shadow_block";
}

/**
 * Coloca blocos temporários somente em ar, sem prender entidades.
 * @returns {number} quantos foram colocados
 */
export function placeTemporary(player, positions, blockId, lifetimeSec) {
  ensureLoaded();
  const dim = player.dimension;
  const cfg = worldConfig();
  const life = (lifetimeSec ?? cfg.constructLifetimeSec) * 1000;
  let placed = 0;
  for (const pos of positions) {
    try {
      const b = dim.getBlock(pos);
      if (!b || !b.isAir) continue;
      const occupied = dim.getEntities({ location: { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 }, maxDistance: 0.95, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] });
      if (occupied.length) continue;
      b.setType(blockId);
      registry.push({ o: player.id, d: dim.id, p: [pos.x, pos.y, pos.z], t: blockId, e: Date.now() + life });
      placed++;
    } catch (e) {
      // fora de chunk carregado ou limite do mundo: ignora a célula
    }
  }
  if (placed) {
    changed = true;
    // limite por jogador: remove as mais antigas
    const mine = registry.filter((r) => r.o === player.id);
    const over = mine.length - cfg.maxConstructsPerPlayer;
    if (over > 0) {
      const old = new Set(mine.slice(0, over));
      for (const r of old) removeEntry(r);
      registry = registry.filter((r) => !old.has(r));
    }
    const p = getProfile(player);
    p.stats.constructs += placed;
    markDirty(player);
  }
  return placed;
}

function removeEntry(r) {
  try {
    const dim = world.getDimension(r.d);
    const loc = { x: r.p[0], y: r.p[1], z: r.p[2] };
    if (!dim.isChunkLoaded(loc)) return false;
    const b = dim.getBlock(loc);
    if (b && b.typeId === r.t) {
      b.setType("minecraft:air");
      particle(dim, "eclipse:smoke_puff", { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }, { color: { red: 0.25, green: 0.12, blue: 0.4 }, count: 2, radius: 0.3 });
    }
    return true;
  } catch (e) {
    logError("construct.remove", e);
    return false;
  }
}

/** Varredura periódica: desfaz criações expiradas (as de chunks não carregados ficam para depois). */
export function sweepConstructs() {
  ensureLoaded();
  if (!registry.length) return;
  const now = Date.now();
  const keep = [];
  let budget = 60;
  for (const r of registry) {
    if (r.e <= now && budget > 0) {
      budget--;
      if (removeEntry(r)) {
        changed = true;
        continue;
      }
    }
    keep.push(r);
  }
  registry = keep;
}

export function clearConstructs(player) {
  ensureLoaded();
  let n = 0;
  const keep = [];
  for (const r of registry) {
    if (r.o === player.id && removeEntry(r)) {
      n++;
      continue;
    }
    keep.push(r);
  }
  registry = keep;
  changed = true;
  return n;
}

// --------------------------------------------------------------------- formas
function feet(player) {
  const l = player.location;
  return { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) };
}

function lookCard(player) {
  return cardinal(yawDir(player.getRotation().y));
}

function dirOf(card) {
  return [{ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }, { x: 1, z: 0 }][card];
}

export function shape(player, key) {
  const f = feet(player);
  const card = lookCard(player);
  const d = dirOf(card);
  const r = rightOf({ x: d.x, y: 0, z: d.z });
  const out = [];
  switch (key) {
    case "platform": {
      const airborne = !player.isOnGround;
      const cy = airborne ? f.y - 1 : f.y - 1;
      const cx = airborne ? f.x : f.x + d.x * 3;
      const cz = airborne ? f.z : f.z + d.z * 3;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) out.push({ x: cx + i, y: cy, z: cz + j });
      break;
    }
    case "bridge":
      for (let s = 1; s <= 12; s++) for (let w = -1; w <= 1; w++) out.push({ x: f.x + d.x * s + r.x * w, y: f.y - 1, z: f.z + d.z * s + r.z * w });
      break;
    case "stairs":
      for (let s = 1; s <= 8; s++) for (let w = 0; w <= 1; w++) out.push({ x: f.x + d.x * s + r.x * w, y: f.y - 1 + s, z: f.z + d.z * s + r.z * w });
      break;
    case "wall":
      for (let w = -2; w <= 2; w++) for (let h = 0; h < 3; h++) out.push({ x: f.x + d.x * 3 + r.x * w, y: f.y + h, z: f.z + d.z * 3 + r.z * w });
      break;
    case "dome":
      for (let x = -3; x <= 3; x++)
        for (let y = 0; y <= 3; y++)
          for (let z = -3; z <= 3; z++) {
            const dd = Math.sqrt(x * x + y * y * 1.2 + z * z);
            if (dd >= 2.6 && dd <= 3.4) out.push({ x: f.x + x, y: f.y + y, z: f.z + z });
          }
      break;
    default:
      break;
  }
  return out;
}

/** Executa a criação/manipulação selecionada (Mão da Sombra). */
export function useShadowHand(player, key) {
  const p = getProfile(player);
  key = key ?? p.construct;
  const blk = blockFor(player);
  const col = p.mode === "god" ? { red: 1, green: 0.85, blue: 0.45 } : p.mode === "haze" ? { red: 0.6, green: 0.85, blue: 1 } : { red: 0.6, green: 0.3, blue: 1 };
  if (key === "pull") return pullItems(player);
  if (key === "grip") return telekinesis(player);
  if (!tryUse(player, `construct.${key}`, key === "dome" ? 200 : key === "pillar" ? 60 : 16, "Criação")) return;
  if (key === "lantern") {
    const hit = player.getBlockFromViewDirection({ maxDistance: 12 });
    const loc = hit ? { x: hit.block.location.x + faceOff(hit.face).x, y: hit.block.location.y + faceOff(hit.face).y, z: hit.block.location.z + faceOff(hit.face).z } : feet(player);
    const n = placeTemporary(player, [loc], "eclipse:shadow_lantern", worldConfig().constructLifetimeSec * 2);
    feedback(player, n, "Lanterna", col, loc);
    return;
  }
  if (key === "pillar") {
    const f = feet(player);
    const free = [];
    for (let i = 1; i <= 6; i++) {
      const b = player.dimension.getBlock({ x: f.x, y: f.y + i + 1, z: f.z });
      if (!b?.isAir) break;
      free.push(i);
    }
    const h = free.length;
    if (h < 1) {
      actionbar(player, "§7Sem espaço acima para o pilar.");
      return;
    }
    player.teleport({ x: f.x + 0.5, y: f.y + h, z: f.z + 0.5 }, { keepVelocity: false });
    const col2 = [];
    for (let i = 0; i < h; i++) col2.push({ x: f.x, y: f.y + i, z: f.z });
    const n = placeTemporary(player, col2, blk);
    feedback(player, n, "Pilar", col, f);
    return;
  }
  const pos = shape(player, key);
  const n = placeTemporary(player, pos, blk);
  feedback(player, n, CONSTRUCTS.find((c) => c.key === key)?.name ?? key, col, pos[0] ?? feet(player));
}

function faceOff(face) {
  switch (String(face)) {
    case "Up": return { x: 0, y: 1, z: 0 };
    case "Down": return { x: 0, y: -1, z: 0 };
    case "North": return { x: 0, y: 0, z: -1 };
    case "South": return { x: 0, y: 0, z: 1 };
    case "East": return { x: 1, y: 0, z: 0 };
    case "West": return { x: -1, y: 0, z: 0 };
    default: return { x: 0, y: 1, z: 0 };
  }
}

function feedback(player, n, name, color, at) {
  if (n > 0) {
    playerSound(player, "eclipse.construct", 0.9, 0.9 + Math.random() * 0.2);
    playerParticle(player, "eclipse:spark_burst", { x: at.x + 0.5, y: at.y + 1, z: at.z + 0.5 }, { color, count: 16, speed: 2 });
    actionbar(player, `§d✦ ${name} criada §7(${n} blocos · some sozinha)`);
    addXp(player, 2, "construct");
  } else {
    actionbar(player, "§7Não há espaço livre (só crio em ar, sem prender ninguém).");
  }
}

function pullItems(player) {
  if (!tryUse(player, "hand.pull", 30, "Puxar itens")) return;
  const items = player.dimension.getEntities({ location: player.location, maxDistance: 16, type: "minecraft:item" });
  const target = { x: player.location.x, y: player.location.y + 0.5, z: player.location.z };
  for (const it of items) {
    try {
      particle(player.dimension, "eclipse:trail", it.location, { color: { red: 0.5, green: 0.25, blue: 0.9 }, size: 0.3 });
      it.teleport(target);
    } catch {
      /* item pode ter sumido */
    }
  }
  playerSound(player, "eclipse.shadow_cast", 0.8, 1.4);
  actionbar(player, items.length ? `§d✦ ${items.length} itens puxados pela sombra` : "§7Nenhum item caído por perto.");
}

function telekinesis(player) {
  if (!tryUse(player, "hand.grip", 30, "Telecinese")) return;
  const hits = player.getEntitiesFromViewDirection({ maxDistance: 20 });
  const target = hits.find((h) => h.entity.typeId !== "minecraft:player" || worldConfig().pvp)?.entity;
  if (!target) {
    actionbar(player, "§7Olhe para uma criatura para puxá-la.");
    return;
  }
  const isFoe = isHostileTarget(player, target, { includeNeutral: true });
  const from = { x: target.location.x * 2 - player.location.x, y: 0, z: target.location.z * 2 - player.location.z };
  push(target, from, isFoe ? 1.8 : 1.0, 0.35);
  playerSound(player, "eclipse.shadow_cast", 1, 0.8);
  particle(player.dimension, "eclipse:spark_burst", target.location, { color: { red: 0.6, green: 0.3, blue: 1 }, count: 12 });
}

export function cycleConstruct(player, step = 1) {
  const p = getProfile(player);
  const i = (CONSTRUCTS.findIndex((c) => c.key === p.construct) + step + CONSTRUCTS.length) % CONSTRUCTS.length;
  p.construct = CONSTRUCTS[i].key;
  markDirty(player);
  actionbar(player, `§8◆ §f${CONSTRUCTS[i].name} §7— ${CONSTRUCTS[i].desc}`);
  playerSound(player, "eclipse.ui_click", 0.7, 1.0);
}
