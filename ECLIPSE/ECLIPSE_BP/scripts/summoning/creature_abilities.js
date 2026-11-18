// Movimentos especiais de cada espécie (ativados pelas ordens) + batedores Corvus.
import { EntityDamageCause, world } from "@minecraft/server";
import { COLORS } from "../core/config.js";
import { actionbar, chat, particle, sound } from "../core/fx.js";
import { tryUse } from "../core/cooldowns.js";
import { later } from "../core/scheduler.js";
import { directionName } from "../core/util.js";
import { alliesAround, effect, heal, hostilesAround, hurt, push } from "../abilities/combat.js";
import { getProfile } from "../core/player_profile.js";
import { setState } from "./summon_manager.js";

function phase(entity, ph, ticks = 50) {
  try {
    entity.triggerEvent(`eclipse:phase_${ph}`);
    later(ticks, () => entity.isValid && entity.triggerEvent("eclipse:phase_idle"), "creature.phase");
  } catch {
    /* */
  }
}

/** @param {import("@minecraft/server").Player} player @param {import("@minecraft/server").Entity} e */
export function creatureSpecial(player, e, key) {
  if (!tryUse(player, `special.${key}`, 400, "Habilidade da criatura")) return;
  const at = e.location;
  const dim = e.dimension;
  phase(e, "special", 60);
  const foes = hostilesAround(player, at, 10);
  switch (key) {
    case "umbra":
      for (const f of foes) { effect(f, "weakness", 10, 1); effect(f, "slowness", 6, 0); }
      particle(dim, "eclipse:ring", at, { color: COLORS.violet, radius: 10 });
      break;
    case "nyx": {
      const t = foes[0];
      if (t) {
        e.teleport({ x: t.location.x, y: t.location.y, z: t.location.z }, { keepVelocity: false });
        hurt(player, t, 12, EntityDamageCause.entityAttack);
        particle(dim, "eclipse:smoke_puff", t.location, { color: COLORS.shadow, count: 12 });
      }
      break;
    }
    case "aegis":
      for (const f of foes.filter((f) => Math.hypot(f.location.x - at.x, f.location.z - at.z) < 6)) { push(f, at, 2.2, 0.5); effect(f, "slowness", 4, 2); }
      effect(player, "resistance", 10, 1);
      particle(dim, "eclipse:ground_impact", at, {});
      break;
    case "nox":
      for (const f of foes) { push(f, at, 2.8, 0.6); effect(f, "slowness", 5, 1); hurt(player, f, 6, EntityDamageCause.magic); }
      break;
    case "vesper":
      for (const a of [player, ...alliesAround(player, 12)]) { heal(a, 8); effect(a, "regeneration", 6, 1); }
      particle(dim, "eclipse:spark_burst", { x: at.x, y: at.y + 1, z: at.z }, { color: { red: 1, green: 0.5, blue: 1 }, count: 40, speed: 4 });
      break;
    case "corvus":
      scout(player, e);
      break;
    case "serpent":
      for (const f of foes.filter((f) => Math.hypot(f.location.x - at.x, f.location.z - at.z) < 6)) effect(f, "poison", 8, 1);
      particle(dim, "eclipse:spark_burst", { x: at.x, y: at.y + 1, z: at.z }, { color: { red: 0.4, green: 1, blue: 0.8 }, count: 24 });
      break;
    case "stag":
      for (const a of [player, ...alliesAround(player, 12)]) { effect(a, "jump_boost", 30, 1); effect(a, "speed", 30, 1); }
      particle(dim, "eclipse:mote", at, { color: { red: 0.7, green: 0.85, blue: 1 }, count: 20, radius: 2 });
      break;
    case "golem":
      for (const f of foes.filter((f) => Math.hypot(f.location.x - at.x, f.location.z - at.z) < 7)) { hurt(player, f, 10, EntityDamageCause.entityAttack); push(f, at, 0.6, 1.1); }
      sound(dim, "random.explode", at, 0.5, 0.6);
      break;
    case "manta":
      effect(player, "slow_falling", 20);
      try { player.applyKnockback({ x: 0, z: 0 }, 1.1); } catch { /* */ }
      particle(dim, "eclipse:smoke_puff", player.location, { color: COLORS.cyan, count: 16, speed: 2 });
      break;
    default:
      break;
  }
}

/** Corvus: explora a região carregada e relata biomas, vilas, perigos e minérios à vista. */
export function scout(player, crow) {
  const dim = player.dimension;
  const origin = player.location;
  setState(player, crow, "explore");
  chat(player, "§8[§5Corvus§8] §7Partimos para explorar… voltaremos com notícias.");
  const findings = { biomes: new Map(), villagers: 0, hostiles: 0, ores: new Map(), water: 0, highest: { y: -999, x: 0, z: 0 } };
  const R = 96;
  let step = 0;
  const steps = 16;
  const run = () => {
    if (!player.isValid) return;
    const ang = (step / steps) * Math.PI * 2;
    for (const rr of [32, 64, R]) {
      const x = origin.x + Math.cos(ang) * rr;
      const z = origin.z + Math.sin(ang) * rr;
      const loc = { x, y: origin.y, z };
      try {
        if (!dim.isChunkLoaded(loc)) continue;
        const top = dim.getTopmostBlock({ x, z });
        if (!top) continue;
        const b = dim.getBiome(top.location)?.id?.replace("minecraft:", "").replace(/_/g, " ");
        if (b) findings.biomes.set(b, { x, z });
        if (top.location.y > findings.highest.y) findings.highest = { y: top.location.y, x, z };
        if (top.isLiquid) findings.water++;
        for (let dy = 1; dy <= 6; dy++) {
          const bb = dim.getBlock({ x, y: top.location.y - dy, z });
          if (bb && /_ore$/.test(bb.typeId)) findings.ores.set(bb.typeId.replace("minecraft:", "").replace(/_/g, " "), { x, z });
        }
      } catch {
        /* chunk em geração */
      }
    }
    step++;
    if (step < steps) {
      later(8, run, "corvus.scout");
      return;
    }
    try {
      findings.villagers = dim.getEntities({ location: origin, maxDistance: R, type: "minecraft:villager_v2" }).length;
      findings.hostiles = dim.getEntities({ location: origin, maxDistance: 48, families: ["monster"] }).length;
    } catch {
      /* */
    }
    const lines = ["§8[§5Corvus§8] §fRelatório da exploração:"];
    for (const [b, at] of [...findings.biomes].slice(0, 5)) lines.push(` §7• Bioma §f${b} §7ao ${directionName(origin, at)}`);
    if (findings.villagers) lines.push(` §a• ${findings.villagers} aldeões avistados — há uma vila por perto!`);
    for (const [o, at] of [...findings.ores].slice(0, 4)) lines.push(` §b• ${o} perto da superfície ao ${directionName(origin, at)}`);
    lines.push(` §7• Ponto mais alto: y=${findings.highest.y} ao ${directionName(origin, findings.highest)}`);
    lines.push(findings.hostiles ? ` §c• ${findings.hostiles} monstros num raio de 48 blocos.` : " §a• Nenhum monstro por perto.");
    chat(player, lines.join("\n"));
    try {
      if (crow.isValid) setState(player, crow, "follow");
    } catch {
      /* */
    }
  };
  later(10, run, "corvus.scout");
  actionbar(player, "§5Corvus está explorando…");
  void getProfile;
  void world;
}
