// MODO HAZE — Soberano dos Elementos (fogo, água, terra, ar, relâmpago, gelo, natureza).
import { EntityComponentTypes, EntityDamageCause } from "@minecraft/server";
import { ELEMENTS } from "../core/config.js";
import { actionbar, groundRune, particle, playerParticle, playerSound, sound, title } from "../core/fx.js";
import { getProfile } from "../core/player_profile.js";
import { alliesAround, effect, heal, hostilesAround, hurt, push } from "../abilities/combat.js";
import { placeTemporary, shape } from "../abilities/shadow_creation.js";
import { addXp, questProgress } from "../progression/progression_manager.js";
import { ascend } from "./eclipse_mode.js";
import { later } from "../core/scheduler.js";
import { logError } from "../core/log.js";

const usedElements = new Map();

function el(player) {
  const p = getProfile(player);
  return { key: p.element, ...ELEMENTS[p.element] };
}

/** Dispara um projétil elemental (entidade com componente de projétil oficial). */
export function shootBolt(player, element, speed = 2.2, elementId = undefined) {
  try {
    const head = player.getHeadLocation();
    const dir = player.getViewDirection();
    const start = { x: head.x + dir.x * 0.9, y: head.y + dir.y * 0.9 - 0.1, z: head.z + dir.z * 0.9 };
    const bolt = player.dimension.spawnEntity("eclipse:spell_bolt", start);
    bolt.triggerEvent(`eclipse:element_${element}`);
    bolt.setDynamicProperty("eclipse:owner", player.id);
    bolt.setDynamicProperty("eclipse:element", element);
    const proj = bolt.getComponent(EntityComponentTypes.Projectile);
    proj.owner = player;
    proj.shoot({ x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }, { uncertainty: 0 });
    return bolt;
  } catch (e) {
    logError("haze.shoot", e);
    return undefined;
  }
}

/** Efeitos ao acertar (chamado pelos eventos de projétil). */
export function boltImpact(player, element, loc, target) {
  const dim = player?.dimension;
  if (!dim) return;
  const E = ELEMENTS[element];
  const color = E?.rgb ?? { red: 0.6, green: 0.3, blue: 1 };
  particle(dim, "eclipse:spark_burst", loc, { color, count: 16, speed: 3 });
  if (target && target.isValid) {
    switch (element) {
      case "fire": target.setOnFire(4, true); break;
      case "water": push(target, player.location, 1.4, 0.3); try { player.extinguishFire?.(); } catch { /* */ } break;
      case "earth": hurt(player, target, 3, EntityDamageCause.entityAttack); effect(target, "slowness", 3, 1); break;
      case "air": push(target, player.location, 2.2, 0.7); break;
      case "lightning": hurt(player, target, 5, EntityDamageCause.lightning); particle(dim, "eclipse:lightning_column", target.location, { color }); sound(dim, "eclipse.thunder", target.location, 0.6, 1.4); break;
      case "ice": effect(target, "slowness", 5, 3); particle(dim, "eclipse:frost_burst", target.location, {}); break;
      case "nature": effect(target, "poison", 4, 0); particle(dim, "eclipse:leaf_burst", target.location, {}); break;
      case "light": if (target.matches({ families: ["undead"] })) hurt(player, target, 6, EntityDamageCause.magic); break;
      case "shadow": effect(target, "weakness", 5, 0); break;
      default: break;
    }
  }
}

export const HAZE_TECHNIQUES = [
  {
    key: "bolt", name: "Projétil Elemental", cooldown: 12, level: 1, active: true,
    desc: "Dispara o elemento ativo. Cada elemento tem um efeito próprio ao acertar.",
    run(player) {
      const e = el(player);
      if (shootBolt(player, e.key)) {
        playerSound(player, "eclipse.element_cast", 0.8, 0.9 + Math.random() * 0.3);
        trackElement(player, e.key);
        addXp(player, 1, "haze.bolt");
      }
    },
  },
  {
    key: "wall", name: "Muralha Elemental", cooldown: 120, level: 2, active: true,
    desc: "Ergue uma barreira 5×3 do elemento ativo à sua frente (temporária).",
    run(player) {
      const e = el(player);
      const n = placeTemporary(player, shape(player, "wall"), e.block);
      playerSound(player, "eclipse.construct", 1, 0.8);
      actionbar(player, n ? `${e.color}✦ Muralha de ${e.name}` : "§7Sem espaço livre à frente.");
      trackElement(player, e.key);
    },
  },
  {
    key: "manifest", name: "Manifestação", cooldown: 160, level: 3, active: true,
    desc: "Fenômeno do elemento ao seu redor: anel de fogo, onda, espinhos de terra, rajada, cadeia de raios, nevasca ou raízes.",
    run(player) {
      const e = el(player);
      const at = player.location;
      const dim = player.dimension;
      groundRune(dim, at, e.rgb, 3, 1.2);
      const foes = hostilesAround(player, at, 7);
      switch (e.key) {
        case "fire":
          for (const f of foes) { hurt(player, f, 6, EntityDamageCause.fire); f.setOnFire(5, true); }
          particle(dim, "eclipse:spark_burst", { x: at.x, y: at.y + 0.5, z: at.z }, { color: e.rgb, count: 40, radius: 2.5, speed: 2, gravity: 1.5 });
          break;
        case "water":
          for (const f of foes) push(f, at, 2.4, 0.4);
          effect(player, "water_breathing", 30);
          particle(dim, "eclipse:ring", { x: at.x, y: at.y + 0.3, z: at.z }, { color: e.rgb, radius: 8 });
          break;
        case "earth":
          for (const f of foes) { hurt(player, f, 7, EntityDamageCause.entityAttack); push(f, at, 0.3, 1.0); }
          particle(dim, "eclipse:ground_impact", at, {});
          break;
        case "air":
          player.applyKnockback({ x: 0, z: 0 }, 1.4);
          effect(player, "slow_falling", 6);
          for (const f of foes) push(f, at, 2.6, 0.8);
          particle(dim, "eclipse:smoke_puff", at, { color: e.rgb, count: 20, speed: 3 });
          break;
        case "lightning":
          foes.slice(0, 5).forEach((f, i) => later(i * 4, () => {
            if (!f.isValid) return;
            particle(dim, "eclipse:lightning_column", f.location, { color: e.rgb });
            particle(dim, "eclipse:flash", { x: f.location.x, y: f.location.y + 1, z: f.location.z }, { color: e.rgb, radius: 3 });
            sound(dim, "eclipse.thunder", f.location, 0.7, 1.2);
            hurt(player, f, 9, EntityDamageCause.lightning);
          }, "haze.chain"));
          break;
        case "ice":
          for (const f of foes) { effect(f, "slowness", 6, 3); hurt(player, f, 5, EntityDamageCause.freezing); }
          particle(dim, "eclipse:frost_burst", { x: at.x, y: at.y + 1, z: at.z }, {});
          break;
        case "nature":
          for (const a of [player, ...alliesAround(player, 10)]) { heal(a, 6); effect(a, "regeneration", 6, 0); }
          for (const f of foes) { effect(f, "poison", 5, 1); effect(f, "slowness", 4, 4); }
          particle(dim, "eclipse:leaf_burst", { x: at.x, y: at.y + 1, z: at.z }, {});
          break;
        default:
          break;
      }
      playerSound(player, "eclipse.element_cast", 1, 0.7);
      actionbar(player, `${e.color}✦ Manifestação de ${e.name} §7— ${foes.length} afetados`);
      trackElement(player, e.key);
      addXp(player, 4 + foes.length, "haze.manifest");
    },
  },
  {
    key: "affinity", name: "Afinidade", cooldown: 1200, level: 2, active: true,
    desc: "Bênção do elemento por 60 s (fogo: imunidade a fogo; água: respirar; terra: resistência; ar: salto e queda suave; relâmpago: velocidade; gelo: absorção; natureza: regeneração).",
    run(player) {
      const e = el(player);
      const map = {
        fire: [["fire_resistance", 0]], water: [["water_breathing", 0], ["conduit_power", 0]], earth: [["resistance", 0]],
        air: [["jump_boost", 1], ["slow_falling", 0]], lightning: [["speed", 1]], ice: [["absorption", 1]], nature: [["regeneration", 0]],
      };
      for (const [id, amp] of map[e.key] ?? []) effect(player, id, 60, amp);
      playerParticle(player, "eclipse:mote", { x: player.location.x, y: player.location.y + 0.3, z: player.location.z }, { color: e.rgb, count: 14, radius: 1 });
      playerSound(player, "eclipse.materialize", 1, 0.9);
      actionbar(player, `${e.color}✦ Afinidade com ${e.name} (60s)`);
    },
  },
  {
    key: "ascendant", name: "Haze Ascendant", cooldown: 6000, level: 8, active: true, ultimate: true,
    desc: "Tempestade elemental por 20 s: a cada segundo um elemento diferente atinge o inimigo mais próximo.",
    run(player) {
      ascend(player, "haze", 20);
      effect(player, "resistance", 20, 1);
      effect(player, "speed", 20, 1);
      title(player, "§b§lHAZE ASCENDANT", "§fos sete elementos obedecem", 60);
      playerSound(player, "eclipse.awaken", 1, 1.25);
      const keys = Object.keys(ELEMENTS);
      for (let i = 0; i < 20; i++) {
        later(i * 20, () => {
          if (!player.isValid) return;
          const k = keys[i % keys.length];
          const foe = hostilesAround(player, player.location, 14)[0];
          particle(player.dimension, "eclipse:mote", { x: player.location.x, y: player.location.y + 1, z: player.location.z }, { color: ELEMENTS[k].rgb, count: 8, radius: 1.5 });
          if (foe) {
            particle(player.dimension, "eclipse:lightning_column", foe.location, { color: ELEMENTS[k].rgb });
            hurt(player, foe, 6, EntityDamageCause.magic);
            boltImpact(player, k, foe.location, foe);
          }
        }, "haze.ascendant");
      }
      questProgress(player, "ascend");
    },
  },
];

function trackElement(player, key) {
  let s = usedElements.get(player.id);
  if (!s) usedElements.set(player.id, (s = new Set()));
  if (!s.has(key)) {
    s.add(key);
    questProgress(player, "elements");
  }
}
