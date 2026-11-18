// Relíquias: habilidades de uso, materialização animada e arsenal.
import { EntityDamageCause, system } from "@minecraft/server";
import { COLORS } from "../core/config.js";
import { actionbar, groundRune, line, particle, playerParticle, playerSound } from "../core/fx.js";
import { tryUse } from "../core/cooldowns.js";
import { container, give, hasItem, makeItem } from "../core/items.js";
import { later } from "../core/scheduler.js";
import { worldConfig } from "../core/world_config.js";
import { GENERATED } from "../data/generated.js";
import { effect, heal, hostilesAround, hurt, isHostileTarget, push } from "./combat.js";
import { shootBolt } from "../modes/haze_mode.js";
import { relicsOut, throwRelic } from "../systems/thrown_relic_manager.js";
import { addXp } from "../progression/progression_manager.js";
import { getProfile } from "../core/player_profile.js";

export const RELICS = GENERATED.relics;

/** Efeito de materialização na mão: partículas → silhueta → revelação → som. */
export function materializeFx(player, relicKey) {
  const h = player.getHeadLocation();
  const d = player.getViewDirection();
  const hand = { x: h.x + d.x * 0.7 - d.z * 0.4, y: h.y - 0.5, z: h.z + d.z * 0.7 + d.x * 0.4 };
  const col = relicKey === "celestial_bow" ? COLORS.gold : relicKey === "astral_spear" ? COLORS.cyan : COLORS.violet;
  playerParticle(player, "eclipse:materialize", hand, { color: col });
  later(4, () => player.isValid && particle(player.dimension, "eclipse:smoke_puff", hand, { color: { red: 0.12, green: 0.06, blue: 0.2 }, count: 6, radius: 0.15, speed: 0.2 }), "relic.fx");
  later(8, () => {
    if (!player.isValid) return;
    playerParticle(player, "eclipse:spark_burst", hand, { color: col, count: 10, speed: 1.2, radius: 0.1 });
    playerSound(player, "eclipse.materialize", 0.9, 1.0 + Math.random() * 0.15);
  }, "relic.fx");
}

/** Entrega uma relíquia pela Forja (sem duplicar se você já a tem ou ela está lançada). */
export function materializeRelic(player, key) {
  const id = `eclipse:${key}`;
  if (hasItem(player, id)) {
    actionbar(player, "§7Você já possui esta relíquia.");
    return false;
  }
  if (relicsOut(player).some((r) => r.relic === key)) {
    actionbar(player, "§7Esta relíquia está lançada — use o Chamado para trazê-la.");
    return false;
  }
  give(player, makeItem(id, { keep: true }));
  materializeFx(player, key);
  addXp(player, 3, "forge.relic");
  return true;
}

/** Uso (toque) de cada relíquia. */
export function useRelic(player, key, sneaking) {
  switch (key) {
    case "eclipse_hammer":
    case "eclipse_axe":
    case "astral_spear":
      if (!tryUse(player, `throw.${key}`, 10, "Lançamento")) return;
      throwRelic(player, key);
      return;
    case "shadow_sword":
      return swordDash(player);
    case "eclipse_scythe":
      return scytheWhirl(player);
    case "celestial_bow":
      return bowShot(player, sneaking);
    case "guardian_shield":
      return shieldAegis(player);
    case "titan_gauntlets":
      return gauntletSlam(player);
    case "shadow_chains":
      return chainsHook(player);
    default:
      return;
  }
}

function swordDash(player) {
  if (!tryUse(player, "relic.sword", 60, "Investida Sombria")) return;
  const d = player.getViewDirection();
  const start = { ...player.location };
  player.applyKnockback({ x: d.x * 2.4, z: d.z * 2.4 }, 0.15);
  playerSound(player, "eclipse.shadow_cast", 1, 1.5);
  const hit = new Set();
  for (let i = 1; i <= 6; i++) {
    later(i, () => {
      if (!player.isValid) return;
      const at = player.location;
      particle(player.dimension, "eclipse:trail", { x: at.x, y: at.y + 1, z: at.z }, { color: COLORS.violet, size: 0.5 });
      for (const e of hostilesAround(player, at, 2.4)) {
        if (hit.has(e.id)) continue;
        hit.add(e.id);
        hurt(player, e, 9, EntityDamageCause.entityAttack);
        push(e, start, 0.8, 0.25);
        particle(player.dimension, "eclipse:spark_burst", e.location, { color: COLORS.violet, count: 10 });
      }
    }, "relic.sword");
  }
  addXp(player, 2, "relic.sword");
}

function scytheWhirl(player) {
  if (!tryUse(player, "relic.scythe", 120, "Ceifa Giratória")) return;
  const at = player.location;
  groundRune(player.dimension, at, COLORS.violet, 4.5, 0.8);
  playerSound(player, "eclipse.shadow_cast", 1, 0.7);
  let dealt = 0;
  for (const e of hostilesAround(player, at, 4.5)) {
    if (hurt(player, e, 8, EntityDamageCause.entityAttack)) dealt += 8;
    push(e, at, 1.0, 0.2);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    particle(player.dimension, "eclipse:trail", { x: at.x + Math.cos(a) * 3, y: at.y + 1, z: at.z + Math.sin(a) * 3 }, { color: COLORS.violet, size: 0.6 });
  }
  if (dealt) heal(player, Math.min(6, dealt * 0.25));
  addXp(player, 2, "relic.scythe");
}

function bowShot(player, sneaking) {
  if (!tryUse(player, "relic.bow", sneaking ? 30 : 10, "Arco Celestial")) return;
  if (sneaking) {
    for (let i = -1; i <= 1; i++) later(i + 1, () => player.isValid && shootBolt(player, "light", 3.0), "relic.bow");
  } else shootBolt(player, "light", 3.2);
  playerSound(player, "eclipse.divine_pulse", 0.4, 1.8);
}

function shieldAegis(player) {
  if (!tryUse(player, "relic.shield", 300, "Égide")) return;
  effect(player, "resistance", 6, 2);
  for (const e of hostilesAround(player, player.location, 5)) push(e, player.location, 2.0, 0.4);
  particle(player.dimension, "eclipse:ring", { x: player.location.x, y: player.location.y + 1, z: player.location.z }, { color: COLORS.white, radius: 5 });
  playerSound(player, "random.anvil_land", 0.5, 1.2);
  actionbar(player, "§7✦ Égide do Guardião: resistência alta por 6s");
}

function gauntletSlam(player) {
  if (!tryUse(player, "relic.gauntlet", 160, "Impacto Sísmico")) return;
  const at = player.location;
  particle(player.dimension, "eclipse:ground_impact", at, {});
  particle(player.dimension, "eclipse:ring", { x: at.x, y: at.y + 0.1, z: at.z }, { color: { red: 0.5, green: 0.4, blue: 0.7 }, radius: 7 });
  playerSound(player, "random.explode", 0.5, 0.7);
  for (const e of hostilesAround(player, at, 5.5)) {
    hurt(player, e, 9, EntityDamageCause.entityAttack);
    push(e, at, 0.5, 1.0);
  }
  addXp(player, 2, "relic.gauntlet");
}

function chainsHook(player) {
  if (!tryUse(player, "relic.chains", 50, "Correntes")) return;
  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  const ents = player.dimension.getEntitiesFromRay(head, dir, { maxDistance: 24 });
  const target = ents.find((h) => h.entity.id !== player.id && (h.entity.typeId !== "minecraft:player" || worldConfig().pvp))?.entity;
  if (target) {
    line(player.dimension, head, target.location, { red: 0.45, green: 0.3, blue: 0.7 }, 0.7);
    if (target.typeId === "minecraft:item") target.teleport(player.location);
    else {
      const from = { x: target.location.x * 2 - player.location.x, y: 0, z: target.location.z * 2 - player.location.z };
      push(target, from, isHostileTarget(player, target) ? 2.2 : 1.2, 0.4);
      if (isHostileTarget(player, target)) effect(target, "slowness", 3, 2);
    }
    playerSound(player, "eclipse.shadow_cast", 1, 1.2);
    return;
  }
  const hit = player.dimension.getBlockFromRay(head, dir, { maxDistance: 32, includePassableBlocks: false });
  if (!hit) {
    actionbar(player, "§7Mire em um bloco ou criatura (até 32 blocos).");
    return;
  }
  const to = { x: hit.block.location.x + 0.5, y: hit.block.location.y + 1, z: hit.block.location.z + 0.5 };
  line(player.dimension, head, to, { red: 0.45, green: 0.3, blue: 0.7 }, 0.8);
  const dx = to.x - player.location.x, dy = to.y - player.location.y, dz = to.z - player.location.z;
  const dh = Math.sqrt(dx * dx + dz * dz) || 1;
  const k = Math.min(3.2, dh * 0.16 + 0.6);
  player.applyKnockback({ x: (dx / dh) * k, z: (dz / dh) * k }, Math.min(1.4, 0.45 + Math.max(0, dy) * 0.12));
  effect(player, "slow_falling", 3);
  playerSound(player, "eclipse.shadow_cast", 1, 1.6);
}

/** Varre itens temporários (ferramentas de sombra) e remove os expirados. */
export function sweepTempTools(player) {
  const inv = container(player);
  if (!inv) return;
  const now = Date.now();
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (!it || !it.hasTag("eclipse:temp_tool")) continue;
    const exp = Number(it.getDynamicProperty("eclipse:expires") ?? 0);
    if (exp && now > exp) {
      inv.setItem(i, undefined);
      particle(player.dimension, "eclipse:smoke_puff", player.location, { color: COLORS.shadow, count: 6 });
      actionbar(player, "§7Uma ferramenta de sombra se dissipou.");
    }
  }
  void system;
  void getProfile;
}

export function giveTempTool(player, key) {
  const it = makeItem(`eclipse:${key}`, { props: { "eclipse:expires": Date.now() + worldConfig().toolLifetimeMin * 60000 },
    lore: [`§7Temporária — some em ${worldConfig().toolLifetimeMin} min`] });
  give(player, it);
  materializeFx(player, key);
}
