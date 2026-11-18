// Invocação/recolhimento de criaturas, propriedade e supervisão (FOLLOW/STAY/GUARD/EXPLORE/RECOVER).
import { EntityComponentTypes, world } from "@minecraft/server";
import { GENERATED } from "../data/generated.js";
import { actionbar, chat, particle, playerSound, sound } from "../core/fx.js";
import { logError } from "../core/log.js";
import { getProfile, markDirty, saveSoon } from "../core/player_profile.js";
import { later } from "../core/scheduler.js";
import { worldConfig } from "../core/world_config.js";
import { dist, uid, yawDir } from "../core/util.js";
import { addXp, questProgress } from "../progression/progression_manager.js";

export const CREATURES = GENERATED.creatures;
export const byKey = (k) => CREATURES.find((c) => c.key === k);

/** Posição segura de spawn perto do jogador (à frente, no chão, com espaço livre). */
export function safeSpot(player, ahead = 2.5, flying = false) {
  const dim = player.dimension;
  const d = yawDir(player.getRotation().y);
  const base = player.location;
  const tries = [[ahead, 0], [ahead, 1.5], [ahead, -1.5], [1, 0], [-1.5, 0], [0, 0]];
  for (const [f, s] of tries) {
    const x = base.x + d.x * f - d.z * s;
    const z = base.z + d.z * f + d.x * s;
    for (let dy = 2; dy >= -4; dy--) {
      const y = Math.floor(base.y) + dy;
      try {
        const below = dim.getBlock({ x, y: y - 1, z });
        const feet = dim.getBlock({ x, y, z });
        const head = dim.getBlock({ x, y: y + 1, z });
        if (below && !below.isAir && !below.isLiquid && feet?.isAir && head?.isAir) {
          return { x: Math.floor(x) + 0.5, y: y + (flying ? 1.5 : 0), z: Math.floor(z) + 0.5 };
        }
      } catch {
        /* chunk não carregado */
      }
    }
  }
  return { x: base.x, y: base.y + (flying ? 1.5 : 0), z: base.z };
}

function bind(player, ent, key, group) {
  ent.setDynamicProperty("eclipse:owner", player.id);
  ent.setDynamicProperty("eclipse:ownerName", player.name);
  ent.setDynamicProperty("eclipse:uid", group);
  ent.setDynamicProperty("eclipse:key", key);
  try {
    ent.getComponent(EntityComponentTypes.Tameable)?.tame(player);
  } catch (e) {
    logError("summon.tame", e);
  }
  const c = byKey(key);
  ent.nameTag = `§d${c?.name ?? key}`;
  ent.triggerEvent("eclipse:state_follow");
}

export function activeCompanions(player) {
  return getProfile(player).companions.filter((c) => c.key !== "lyra");
}

/** Invoca a criatura `key`. Retorna as entidades criadas. */
export function summon(player, key) {
  const c = byKey(key);
  if (!c) return [];
  const p = getProfile(player);
  const cfg = worldConfig();
  const groups = new Set(activeCompanions(player).map((x) => x.uid));
  if (groups.size >= cfg.maxCompanions) {
    actionbar(player, `§7Limite de ${cfg.maxCompanions} companheiros ativos. Recolha um antes (Selo da Legião).`);
    return [];
  }
  const group = uid("g");
  const out = [];
  for (let i = 0; i < (c.group ?? 1); i++) {
    try {
      const spot = safeSpot(player, 2.5 + i * 0.8, c.flying);
      const ent = player.dimension.spawnEntity(c.id, spot);
      bind(player, ent, key, group);
      p.companions.push({ uid: group, key, id: ent.id, state: "follow" });
      out.push(ent);
      particle(player.dimension, "eclipse:shadow_manifest", spot, {});
      later(30, () => {
        try {
          if (ent.isValid) ent.triggerEvent("eclipse:phase_idle");
        } catch {
          /* */
        }
      }, "summon.idle");
    } catch (e) {
      logError("summon.spawn", e);
    }
  }
  if (out.length) {
    p.stats.summons++;
    if (!p.quests._species) p.quests._species = [];
    if (!p.quests._species.includes(key)) {
      p.quests._species.push(key);
      questProgress(player, "bestiary");
    }
    questProgress(player, "summoner");
    addXp(player, 8, `summon.${key}`);
    playerSound(player, "eclipse.manifest", 1, 1);
    actionbar(player, `§5✦ ${c.emoji} ${c.name} §7— ${c.title} emergiu da sombra`);
    saveSoon(player);
  } else {
    actionbar(player, "§cNão foi possível manifestar a criatura aqui.");
  }
  return out;
}

/** Recolhe para a sombra (animação + remoção); nunca deixa entidade órfã. */
export function recall(player, entity, silent = false) {
  const p = getProfile(player);
  try {
    if (entity?.isValid) {
      entity.triggerEvent("eclipse:phase_recall");
      particle(entity.dimension, "eclipse:shadow_recall", entity.location, {});
      if (!silent) sound(entity.dimension, "eclipse.recall", entity.location, 1, 1);
      const id = entity.id;
      later(18, () => {
        try {
          const e = world.getEntity(id);
          if (e?.isValid) e.remove();
        } catch (err) {
          logError("summon.remove", err);
        }
      }, "summon.recall");
    }
  } catch (e) {
    logError("summon.recall", e);
  }
  if (entity) p.companions = p.companions.filter((c) => c.id !== entity.id);
  markDirty(player);
}

/** Recolhe o grupo inteiro (ex.: bando de corvos) de uma espécie. */
export function recallKey(player, key) {
  const p = getProfile(player);
  const mine = p.companions.filter((c) => c.key === key);
  for (const c of mine) {
    const e = c.id ? world.getEntity(c.id) : undefined;
    if (e) recall(player, e, true);
  }
  p.companions = p.companions.filter((c) => c.key !== key);
  playerSound(player, "eclipse.recall", 1, 1);
  markDirty(player);
  saveSoon(player);
}

export function recallAll(player) {
  const keys = [...new Set(activeCompanions(player).map((c) => c.key))];
  for (const k of keys) recallKey(player, k);
}

export function isSummoned(player, key) {
  return getProfile(player).companions.some((c) => c.key === key);
}

/** Selo da Legião: toque = invocar/recolher a criatura ativa. */
export function toggleActive(player) {
  const p = getProfile(player);
  if (isSummoned(player, p.activeCreature)) {
    recallKey(player, p.activeCreature);
    actionbar(player, `§7${byKey(p.activeCreature)?.name} voltou para a sombra.`);
  } else summon(player, p.activeCreature);
}

export function cycleActive(player, step = 1) {
  const p = getProfile(player);
  const i = (CREATURES.findIndex((c) => c.key === p.activeCreature) + step + CREATURES.length) % CREATURES.length;
  p.activeCreature = CREATURES[i].key;
  markDirty(player);
  const c = CREATURES[i];
  actionbar(player, `§5◆ ${c.emoji} ${c.name} §7— ${c.title}${isSummoned(player, c.key) ? " §a(ativo)" : ""}`);
  playerSound(player, "eclipse.ui_click", 0.7, 1.1);
}

export function setState(player, entity, state) {
  try {
    entity.triggerEvent(`eclipse:state_${state}`);
    const p = getProfile(player);
    for (const c of p.companions) if (c.id === entity.id) c.state = state;
    markDirty(player);
  } catch (e) {
    logError("summon.state", e);
  }
}

/**
 * Supervisor (a cada 10 ticks, por jogador): reencontra criaturas, recupera as presas/distantes,
 * acompanha troca de dimensão e evita duplicatas. Criaturas recolhidas não existem no mundo.
 */
export function superviseCompanions(player) {
  const p = getProfile(player);
  if (!p.companions.length) return;
  const keep = [];
  for (const c of p.companions) {
    if (c.key === "lyra") {
      keep.push(c);
      continue;
    }
    let e;
    try {
      e = c.id ? world.getEntity(c.id) : undefined;
    } catch {
      e = undefined;
    }
    if (!e || !e.isValid) {
      if (c.state === "stay") {
        keep.push(c); // esperando num lugar que não está carregado: respeita a ordem
        continue;
      }
      // pode estar num chunk descarregado: manifesta de novo perto do dono (RECOVER)
      const def = byKey(c.key);
      try {
        const spot = safeSpot(player, 2, def?.flying);
        const ne = player.dimension.spawnEntity(def.id, spot);
        bind(player, ne, c.key, c.uid);
        later(20, () => ne.isValid && ne.triggerEvent("eclipse:phase_idle"), "summon.idle");
        if (c.state && c.state !== "follow") ne.triggerEvent(`eclipse:state_${c.state}`);
        keep.push({ ...c, id: ne.id });
      } catch (err) {
        logError("summon.recover", err);
      }
      continue;
    }
    keep.push(c);
    try {
      const sameDim = e.dimension.id === player.dimension.id;
      const d = sameDim ? dist(e.location, player.location) : Infinity;
      const state = c.state ?? "follow";
      const limit = state === "explore" ? 48 : state === "stay" ? Infinity : 26;
      if (!sameDim || d > limit) {
        const spot = safeSpot(player, 2, byKey(c.key)?.flying);
        e.teleport(spot, { dimension: player.dimension, keepVelocity: false });
        particle(player.dimension, "eclipse:shadow_manifest", spot, {});
        if (state === "explore") setState(player, e, "follow");
      } else if (state !== "stay") {
        // anti-travamento: preso num lugar por muito tempo enquanto o dono está longe
        const last = /** @type {any} */ (e.getDynamicProperty("eclipse:lastPos"));
        const moved = last ? dist(last, e.location) : 99;
        const stuck = (Number(e.getDynamicProperty("eclipse:stuck")) || 0) + (moved < 0.3 && d > 8 ? 1 : -1);
        e.setDynamicProperty("eclipse:stuck", Math.max(0, stuck));
        e.setDynamicProperty("eclipse:lastPos", e.location);
        if (stuck > 12) {
          e.setDynamicProperty("eclipse:stuck", 0);
          const spot = safeSpot(player, 2, byKey(c.key)?.flying);
          e.teleport(spot, { keepVelocity: false });
          particle(player.dimension, "eclipse:shadow_manifest", spot, {});
        }
        // não ficar em cima do dono / bloqueando a passagem
        if (d < 0.8) e.applyImpulse?.({ x: (Math.random() - 0.5) * 0.4, y: 0, z: (Math.random() - 0.5) * 0.4 });
      }
    } catch (err) {
      logError("summon.supervise", err);
    }
  }
  p.companions = keep;
}

/** Remove criaturas "eclipse" sem dono válido (ex.: duplicatas antigas que voltaram a carregar). */
export function validateLoadedCompanion(entity) {
  try {
    if (!entity.isValid || !entity.typeId.startsWith("eclipse:")) return;
    if (!entity.matches({ families: ["eclipse_companion"] })) return;
    const owner = entity.getDynamicProperty("eclipse:owner");
    if (typeof owner !== "string") return;
    const pl = world.getAllPlayers().find((x) => x.id === owner);
    if (!pl) return; // dono offline: mantém (será reconciliado quando voltar)
    const p = getProfile(pl);
    const ok = p.companions.some((c) => c.id === entity.id) || (entity.typeId === "eclipse:lyra" && p.lyra.id === entity.id);
    if (!ok) {
      particle(entity.dimension, "eclipse:shadow_recall", entity.location, {});
      entity.remove();
    }
  } catch (e) {
    logError("summon.validate", e);
  }
}

export function describeCompanions(player) {
  const list = activeCompanions(player);
  if (!list.length) return "§7Nenhuma criatura manifestada.";
  return list.map((c) => `§d${byKey(c.key)?.emoji ?? ""} ${byKey(c.key)?.name ?? c.key} §7(${stateName(c.state)})`).join("\n");
}

export function stateName(s) {
  return { follow: "seguindo", stay: "esperando", guard: "protegendo", explore: "explorando", rest: "descansando", recover: "recuperando" }[s] ?? s;
}

export { chat };
