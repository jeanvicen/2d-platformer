// MODO ECLIPSE — Soberano das Sombras.
import { EntityDamageCause } from "@minecraft/server";
import { COLORS } from "../core/config.js";
import { actionbar, groundRune, particle, playerParticle, playerSound, title } from "../core/fx.js";
import { getProfile, markDirty } from "../core/player_profile.js";
import { effect, hostilesAround, hurt, push } from "../abilities/combat.js";
import { addXp, questProgress } from "../progression/progression_manager.js";
import { later } from "../core/scheduler.js";

const C = COLORS.violet;

export const ECLIPSE_TECHNIQUES = [
  {
    key: "burst", name: "Explosão Sombria", cooldown: 160, level: 1, active: true,
    desc: "Onda de sombra (raio 6): dano e cegueira em monstros, empurrando-os.",
    run(player) {
      const at = player.location;
      groundRune(player.dimension, at, C, 3.5, 1.0);
      playerParticle(player, "eclipse:smoke_puff", { x: at.x, y: at.y + 0.6, z: at.z }, { color: { red: 0.18, green: 0.08, blue: 0.3 }, count: 26, radius: 1.2, speed: 3 });
      playerParticle(player, "eclipse:spark_burst", { x: at.x, y: at.y + 1, z: at.z }, { color: C, count: 30, speed: 6 });
      playerSound(player, "eclipse.shadow_cast", 1, 0.8);
      let n = 0;
      for (const e of hostilesAround(player, at, 6)) {
        hurt(player, e, 8, EntityDamageCause.magic);
        push(e, at, 1.6, 0.45);
        effect(e, "blindness", 4);
        effect(e, "slowness", 4, 1);
        n++;
      }
      actionbar(player, `§5✦ Explosão Sombria §7— ${n} inimigos atingidos`);
      addXp(player, 4 + n, "eclipse.burst");
    },
  },
  {
    key: "step", name: "Passo Sombrio", cooldown: 70, level: 1, active: true,
    desc: "Teleporta até onde você olha (até 28 blocos), atravessando a sombra.",
    run(player) {
      const hit = player.getBlockFromViewDirection({ maxDistance: 28 });
      if (!hit) return actionbar(player, "§7Olhe para um bloco para o Passo Sombrio.");
      const b = hit.block.location;
      let dest = { x: b.x + 0.5, y: b.y + 1, z: b.z + 0.5 };
      const dim = player.dimension;
      // garante espaço para os pés e a cabeça
      for (let i = 0; i < 4; i++) {
        const f = dim.getBlock(dest);
        const h = dim.getBlock({ x: dest.x, y: dest.y + 1, z: dest.z });
        if (f?.isAir && h?.isAir) break;
        dest = { x: dest.x, y: dest.y + 1, z: dest.z };
      }
      const from = player.location;
      playerParticle(player, "eclipse:smoke_puff", { x: from.x, y: from.y + 1, z: from.z }, { color: { red: 0.15, green: 0.06, blue: 0.25 }, count: 18 });
      player.teleport(dest, { keepVelocity: false, checkForBlocks: true });
      playerParticle(player, "eclipse:shadow_manifest", dest, {});
      playerSound(player, "eclipse.recall", 0.9, 1.6);
      addXp(player, 2, "eclipse.step");
    },
  },
  {
    key: "cloak", name: "Manto da Sombra", cooldown: 500, level: 2, active: true,
    desc: "Invisibilidade, velocidade e visão noturna por 12 s.",
    run(player) {
      effect(player, "invisibility", 12);
      effect(player, "speed", 12, 1);
      effect(player, "night_vision", 14);
      playerParticle(player, "eclipse:smoke_puff", { x: player.location.x, y: player.location.y + 1, z: player.location.z }, { color: { red: 0.1, green: 0.05, blue: 0.18 }, count: 20 });
      playerSound(player, "eclipse.shadow_cast", 1, 0.6);
      actionbar(player, "§5✦ Manto da Sombra §7— você se funde à escuridão (12s)");
      addXp(player, 3, "eclipse.cloak");
    },
  },
  {
    key: "aura", name: "Manifestar Aura", cooldown: 10, level: 1, active: true,
    desc: "Liga/desliga a aura visível (estado MANIFESTADO). Modo econômico disponível nas configurações.",
    run(player) {
      const p = getProfile(player);
      p.core = p.core === "manifested" ? "awakened" : p.core === "awakened" ? "manifested" : p.core;
      p.prefs.aura = p.core === "manifested";
      markDirty(player);
      actionbar(player, p.core === "manifested" ? "§5✦ Aura manifestada" : "§7Aura recolhida");
    },
  },
  {
    key: "supreme", name: "Eclipse Supremo", cooldown: 6000, level: 8, active: true, ultimate: true,
    desc: "Forma máxima por 30 s: força, resistência, regeneração, aura intensa e um bando espectral.",
    run(player) {
      ascend(player, "eclipse");
      effect(player, "strength", 30, 1);
      effect(player, "resistance", 30, 1);
      effect(player, "regeneration", 30, 0);
      effect(player, "speed", 30, 0);
      title(player, "§5§lECLIPSE SUPREMO", "§7as sombras curvam-se a você", 60);
      playerSound(player, "eclipse.awaken", 1, 1.1);
      // bando espectral: corvos de partículas que circulam e golpeiam monstros
      for (let i = 0; i < 6; i++) {
        later(i * 20, () => {
          if (!player.isValid) return;
          const foes = hostilesAround(player, player.location, 12);
          for (const f of foes.slice(0, 3)) {
            particle(player.dimension, "eclipse:feather_fall", { x: f.location.x, y: f.location.y + 1.5, z: f.location.z }, { count: 4 });
            hurt(player, f, 4, EntityDamageCause.magic);
          }
        }, "eclipse.supreme");
      }
      questProgress(player, "ascend");
    },
  },
];

/** Estado ASCENDANT temporário (comum aos três modos). */
export function ascend(player, mode, seconds = 30) {
  const p = getProfile(player);
  const prev = p.core;
  p.core = "ascendant";
  markDirty(player);
  later(seconds * 20, () => {
    if (!player.isValid) return;
    const q = getProfile(player);
    if (q.core === "ascendant") q.core = prev === "ascendant" ? "awakened" : prev;
    markDirty(player);
    actionbar(player, "§7A ascensão se dissipa…");
  }, `ascend.${mode}`);
}
