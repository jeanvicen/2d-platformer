// MODO GOD — Soberano Divino.
import { EntityDamageCause } from "@minecraft/server";
import { COLORS } from "../core/config.js";
import { actionbar, groundRune, particle, playerParticle, playerSound, title } from "../core/fx.js";
import { alliesAround, effect, heal, hostilesAround, hurt, push } from "../abilities/combat.js";
import { placeTemporary } from "../abilities/shadow_creation.js";
import { addXp, questProgress } from "../progression/progression_manager.js";
import { ascend } from "./eclipse_mode.js";
import { later } from "../core/scheduler.js";

const G = COLORS.gold;

export const GOD_TECHNIQUES = [
  {
    key: "pulse", name: "Pulso de Luz", cooldown: 120, level: 1, active: true,
    desc: "Anel de luz (raio 8): repele monstros e fere mortos-vivos.",
    run(player) {
      const at = player.location;
      particle(player.dimension, "eclipse:ring", { x: at.x, y: at.y + 0.2, z: at.z }, { color: G, radius: 9, life: 0.8 });
      playerParticle(player, "eclipse:spark_burst", { x: at.x, y: at.y + 1, z: at.z }, { color: COLORS.white, count: 30, speed: 5, gravity: 0.5 });
      playerSound(player, "eclipse.divine_pulse", 1, 1.1);
      let n = 0;
      for (const e of hostilesAround(player, at, 8)) {
        push(e, at, 2.0, 0.5);
        const undead = e.matches({ families: ["undead"] });
        hurt(player, e, undead ? 12 : 4, EntityDamageCause.magic);
        if (undead) e.setOnFire(3, true);
        n++;
      }
      actionbar(player, `§6✦ Pulso de Luz §7— ${n} repelidos`);
      addXp(player, 4 + n, "god.pulse");
    },
  },
  {
    key: "aegis", name: "Égide Divina", cooldown: 600, level: 2, active: true,
    desc: "Escudo de energia: absorção e resistência para você e seus companheiros (20 s).",
    run(player) {
      const targets = [player, ...alliesAround(player, 14)];
      for (const t of targets) {
        effect(t, "absorption", 20, 1);
        effect(t, "resistance", 20, 0);
        particle(player.dimension, "eclipse:ring", { x: t.location.x, y: t.location.y + 1, z: t.location.z }, { color: G, radius: 2, life: 0.6 });
      }
      playerSound(player, "eclipse.divine_pulse", 1, 0.8);
      actionbar(player, `§6✦ Égide Divina §7— ${targets.length} protegidos`);
      addXp(player, 5, "god.aegis");
    },
  },
  {
    key: "heal", name: "Cura Sagrada", cooldown: 500, level: 2, active: true,
    desc: "Recupera 10 de vida sua e dos companheiros próximos + regeneração breve.",
    run(player) {
      const targets = [player, ...alliesAround(player, 14)];
      let total = 0;
      for (const t of targets) {
        total += heal(t, 10);
        effect(t, "regeneration", 5, 0);
        particle(player.dimension, "eclipse:mote", { x: t.location.x, y: t.location.y + 0.5, z: t.location.z }, { color: G, count: 10, radius: 0.8 });
      }
      playerSound(player, "eclipse.divine_pulse", 1, 1.4);
      actionbar(player, `§6✦ Cura Sagrada §7— +${Math.round(total)} de vida distribuída`);
      addXp(player, 5, "god.heal");
      questProgress(player, "divine", targets.length > 1 ? targets.length - 1 : 0);
    },
  },
  {
    key: "platform", name: "Plataforma de Luz", cooldown: 40, level: 1, active: true,
    desc: "Cria uma plataforma radiante 5×5 sob você (ou à frente). Temporária.",
    run(player) {
      const f = { x: Math.floor(player.location.x), y: Math.floor(player.location.y) - 1, z: Math.floor(player.location.z) };
      const pos = [];
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) pos.push({ x: f.x + i, y: f.y, z: f.z + j });
      const n = placeTemporary(player, pos, "eclipse:radiant_block");
      groundRune(player.dimension, player.location, G, 2.5, 1);
      playerSound(player, "eclipse.construct", 1, 1.3);
      actionbar(player, n ? `§6✦ Plataforma de Luz (${n} blocos)` : "§7Não há espaço livre abaixo.");
    },
  },
  {
    key: "ascendant", name: "God Ascendant", cooldown: 6000, level: 8, active: true, ultimate: true,
    desc: "30 s de halo divino: regeneração, força, resistência e luz que fere mortos-vivos a cada segundo.",
    run(player) {
      ascend(player, "god");
      effect(player, "regeneration", 30, 1);
      effect(player, "strength", 30, 0);
      effect(player, "resistance", 30, 1);
      title(player, "§6§lGOD ASCENDANT", "§fa luz responde ao seu chamado", 60);
      playerSound(player, "eclipse.awaken", 1, 1.4);
      for (let i = 0; i < 30; i++) {
        later(i * 20, () => {
          if (!player.isValid) return;
          for (const e of hostilesAround(player, player.location, 7)) if (e.matches({ families: ["undead"] })) hurt(player, e, 4, EntityDamageCause.magic);
          if (i % 3 === 0) particle(player.dimension, "eclipse:ring", { x: player.location.x, y: player.location.y + 2.2, z: player.location.z }, { color: G, radius: 1.2, life: 1.0 });
        }, "god.ascendant");
      }
      questProgress(player, "ascend");
    },
  },
];
