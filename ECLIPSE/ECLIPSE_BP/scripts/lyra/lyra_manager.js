// LYRA — a Sombra Viva: invocação, persistência, cérebro (fila de tarefas), autocuidado e conversa.
import { EntityComponentTypes, ItemStack, system, world } from "@minecraft/server";
import { BLUEPRINTS } from "../lib/blueprints.js";
import { LYRA_EXAMPLES, parseRequest } from "../lib/lyra_parser.js";
import { actionbar, chat, particle, playerSound, sound } from "../core/fx.js";
import { logError } from "../core/log.js";
import { getProfile, markDirty, saveSoon } from "../core/player_profile.js";
import { cardinal, pick, yawDir } from "../core/util.js";
import { heal, healthFrac } from "../abilities/combat.js";
import { safeSpot } from "../summoning/summon_manager.js";
import { addXp, questProgress } from "../progression/progression_manager.js";
import { build, count, explore, gatherFood, gatherOre, gatherSand, gatherStone, gatherWood, isFood, inv, setAction, shadowBolt, take, walkTo, wait } from "./lyra_tasks.js";
import { groundAt } from "./lyra_world.js";

/** Estado em memória por dono. @type {Map<string, any>} */
const states = new Map();

function L_of(player) {
  let L = states.get(player.id);
  if (!L) {
    L = {
      ownerId: player.id, queue: [], current: null, gen: null, cancelled: false, lastBolt: 0, lastEat: 0, lookAt: undefined, lastTalk: 0,
      entity() {
        const p = getProfile(player);
        if (!p.lyra.id) return undefined;
        try {
          const e = world.getEntity(p.lyra.id);
          return e && e.isValid ? e : undefined;
        } catch {
          return undefined;
        }
      },
      say(msg) {
        try {
          if (player.isValid) player.sendMessage(`§d[${getProfile(player).lyra.name ?? "Lyra"}] §f${msg}`);
        } catch {
          /* */
        }
      },
      onBuilt(bp) {
        questProgress(player, "lyra_builder");
        addXp(player, 40, `lyra.build.${bp}`);
      },
    };
    const p = getProfile(player);
    L.queue = Array.isArray(p.lyra.tasks) ? [...p.lyra.tasks] : [];
    states.set(player.id, L);
  }
  return L;
}

export function lyraEntity(player) {
  return L_of(player).entity();
}

export function isLyraSummoned(player) {
  return !!lyraEntity(player);
}

// ------------------------------------------------------------------ invocar / recolher
export function summonLyra(player) {
  const p = getProfile(player);
  const L = L_of(player);
  if (L.entity()) return L.entity();
  try {
    const spot = safeSpot(player, 2.5, false);
    const e = player.dimension.spawnEntity("eclipse:lyra", spot);
    e.setDynamicProperty("eclipse:owner", player.id);
    e.setDynamicProperty("eclipse:ownerName", player.name);
    e.setDynamicProperty("eclipse:key", "lyra");
    try {
      e.getComponent(EntityComponentTypes.Tameable)?.tame(player);
    } catch {
      /* */
    }
    e.nameTag = `§d${p.lyra.name ?? "Lyra"}`;
    e.triggerEvent("eclipse:state_follow");
    // restaura o inventário guardado na sombra
    const c = e.getComponent(EntityComponentTypes.Inventory)?.container;
    if (c) for (const s of p.lyra.inv ?? []) {
      try {
        const it = new ItemStack(s.t, Math.max(1, Math.min(64, s.n)));
        if (s.name) it.nameTag = s.name;
        c.addItem(it);
      } catch {
        /* item inválido em versão nova: ignora */
      }
    }
    p.lyra.inv = [];
    p.lyra.id = e.id;
    p.lyra.summoned = true;
    markDirty(player);
    saveSoon(player);
    particle(player.dimension, "eclipse:shadow_manifest", spot, {});
    playerSound(player, "eclipse.manifest", 1, 1.2);
    system.runTimeout(() => {
      try {
        if (e.isValid) e.triggerEvent("eclipse:phase_idle");
      } catch {
        /* */
      }
    }, 30);
    L.say(pick([
      "Oi! Estou aqui. É só pedir que eu faço — madeira, comida, casas, o que precisar. ✨",
      "Cheguei! Da sombra para o seu lado. O que vamos fazer hoje?",
      "Presente! Me diga o que você precisa.",
    ]));
    if (L.queue.length) L.say(`Ainda tenho ${L.queue.length} tarefa(s) pendente(s) — vou continuar.`);
    return e;
  } catch (e) {
    logError("lyra.summon", e);
    actionbar(player, "§cNão foi possível chamar a Lyra aqui.");
    return undefined;
  }
}

export function recallLyra(player, silent = false) {
  const p = getProfile(player);
  const L = L_of(player);
  const e = L.entity();
  stopAll(player, true);
  if (e) {
    // guarda o inventário (tipo, quantidade, nome) na sombra
    const c = e.getComponent(EntityComponentTypes.Inventory)?.container;
    const saved = [];
    if (c) for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it) saved.push({ t: it.typeId, n: it.amount, name: it.nameTag });
    }
    p.lyra.inv = saved;
    try {
      e.triggerEvent("eclipse:phase_recall");
      particle(e.dimension, "eclipse:shadow_recall", e.location, {});
      if (!silent) sound(e.dimension, "eclipse.recall", e.location, 1, 1.2);
      const id = e.id;
      system.runTimeout(() => {
        try {
          const ent = world.getEntity(id);
          if (ent?.isValid) ent.remove();
        } catch {
          /* */
        }
      }, 18);
    } catch (err) {
      logError("lyra.recall", err);
    }
  }
  p.lyra.id = null;
  p.lyra.summoned = false;
  markDirty(player);
  saveSoon(player);
  if (!silent) chat(player, "§d[Lyra] §fVou descansar na sombra. Me chame quando precisar! (Seus itens ficaram guardados comigo.)");
}

// ------------------------------------------------------------------ fila de tarefas
const LABEL = {
  gather: (t) => `coletar ${t.amount} ${t.resource === "log" ? "troncos" : t.resource === "cobblestone" ? "pedras" : t.resource}`,
  food: (t) => `buscar ${t.amount} comidas`,
  ore: (t) => `minerar ${t.amount} ${t.ore}`,
  build: (t) => `construir ${BLUEPRINTS[t.blueprint]?.name ?? t.blueprint}`,
  explore: (t) => `explorar ${t.radius} blocos`,
  give: (t) => `entregar ${t.resource}`,
};

export function describeQueue(player) {
  const L = L_of(player);
  const items = [];
  if (L.current) items.push(`§a▶ ${LABEL[L.current.type]?.(L.current) ?? L.current.type}`);
  for (const t of L.queue) items.push(`§7• ${LABEL[t.type]?.(t) ?? t.type}`);
  return items.length ? items.join("\n") : "§7Nenhuma tarefa no momento.";
}

function persistQueue(player) {
  const L = L_of(player);
  const p = getProfile(player);
  p.lyra.tasks = [...(L.current ? [L.current] : []), ...L.queue].slice(0, 12);
  markDirty(player);
}

export function enqueue(player, task) {
  const L = L_of(player);
  if (L.queue.length >= 10) {
    L.say("Minha lista já está cheia — me deixe terminar algumas tarefas primeiro.");
    return;
  }
  L.queue.push(task);
  persistQueue(player);
}

export function stopAll(player, silent = false) {
  const L = L_of(player);
  L.cancelled = true;
  L.queue = [];
  L.current = null;
  L.gen = null;
  L.lookAt = undefined;
  persistQueue(player);
  const e = L.entity();
  if (e) {
    try {
      e.runCommand("replaceitem entity @s slot.weapon.mainhand 0 air");
      setAction(e, "idle");
      e.triggerEvent("eclipse:state_follow");
    } catch {
      /* */
    }
  }
  if (!silent) L.say("Parei tudo. Estou com você.");
}

function startTask(player, L, t) {
  const e = L.entity();
  if (!e) return false;
  L.cancelled = false;
  L.current = t;
  try {
    e.triggerEvent("eclipse:script_on");
  } catch {
    /* */
  }
  switch (t.type) {
    case "gather":
      L.gen = t.resource === "log" ? gatherWood(L, t.amount) : t.resource === "sand" ? gatherSand(L, t.amount) : gatherStone(L, t.amount);
      break;
    case "food":
      L.gen = gatherFood(L, t.amount);
      break;
    case "ore":
      L.gen = gatherOre(L, t.ore, t.amount);
      break;
    case "build":
      L.gen = build(L, t);
      break;
    case "explore":
      L.gen = explore(L, t.radius ?? 96);
      break;
    case "come":
      L.gen = (function* () {
        const o = player.location;
        yield* walkTo(L, { x: Math.floor(o.x), y: Math.floor(o.y), z: Math.floor(o.z) }, 2, true);
      })();
      break;
    default:
      L.gen = null;
  }
  persistQueue(player);
  return !!L.gen;
}

function finishTask(player, L) {
  const done = L.current;
  L.current = null;
  L.gen = null;
  L.lookAt = undefined;
  const e = L.entity();
  if (e) {
    try {
      setAction(e, "idle");
      if (!L.queue.length) e.triggerEvent("eclipse:state_follow");
    } catch {
      /* */
    }
  }
  if (done) {
    const p = getProfile(player);
    p.stats.lyraTasks++;
    questProgress(player, "lyra_helper");
    addXp(player, 6, `lyra.${done.type}`);
  }
  persistQueue(player);
}

/** Um passo do cérebro (todo tick, só quando há tarefa). */
export function tickLyra(player) {
  const L = states.get(player.id);
  if (!L) return;
  const e = L.entity();
  if (!e) return; // fora do alcance/descarregada: a fila espera
  if (!L.gen && L.queue.length) {
    const t = L.queue.shift();
    if (!startTask(player, L, t)) finishTask(player, L);
    return;
  }
  if (!L.gen) return;
  try {
    const r = L.gen.next();
    if (r.done) finishTask(player, L);
  } catch (err) {
    logError("lyra.task", err);
    L.say("Algo deu errado nessa tarefa, mas estou bem. Vou para a próxima.");
    finishTask(player, L);
  }
}

/** Autocuidado e proteção (a cada 10 ticks). */
export function careLyra(player) {
  const L = states.get(player.id) ?? (getProfile(player).lyra.id ? L_of(player) : undefined);
  if (!L) return;
  const e = L.entity();
  if (!e) return;
  try {
    // come quando está ferida e tem comida
    if (healthFrac(e) < 0.5 && system.currentTick - L.lastEat > 100 && count(L, isFood) > 0) {
      L.lastEat = system.currentTick;
      take(L, isFood, 1);
      heal(e, 8);
      setAction(e, "eat");
      sound(e.dimension, "random.eat", e.location, 0.7, 1.1);
      system.runTimeout(() => e.isValid && !L.gen && setAction(e, "idle"), 30);
    }
    // ataque sombrio à distância contra monstros perto do dono ou dela
    if (system.currentTick - L.lastBolt > 50) {
      if (shadowBolt(L, player)) {
        L.lastBolt = system.currentTick;
        system.runTimeout(() => e.isValid && !L.gen && setAction(e, "idle"), 20);
      }
    }
    // sem tarefa e muito longe do dono → volta
    if (!L.gen && e.dimension.id === player.dimension.id) {
      const d = Math.hypot(e.location.x - player.location.x, e.location.z - player.location.z);
      if (d > 30) {
        e.teleport(safeSpot(player, 2), { keepVelocity: false });
        particle(e.dimension, "eclipse:shadow_manifest", e.location, {});
      }
    } else if (!L.gen && e.dimension.id !== player.dimension.id) {
      e.teleport(safeSpot(player, 2), { dimension: player.dimension, keepVelocity: false });
    }
  } catch (err) {
    logError("lyra.care", err);
  }
}

// ------------------------------------------------------------------ conversa
export function talk(player, text) {
  const L = L_of(player);
  if (!L.entity()) summonLyra(player);
  const { tasks, reply, unknown } = parseRequest(text);
  if (reply === "greet") L.say(pick(["Oi! 😊 O que a gente faz agora?", "Olá! Pronta para o trabalho.", "E aí! Me diga o que precisa."]));
  if (reply === "thanks") L.say(pick(["De nada! Sempre que precisar.", "Imagina! Adoro ajudar.", "Por você, qualquer coisa. ✨"]));
  if (reply === "help") L.say(`Eu entendo pedidos como: §7${LYRA_EXAMPLES.join("§f, §7")}§f. Também dá para usar o menu do Laço de Lyra.`);
  if (reply === "build_what") L.say(`Construir o quê? Sei fazer: §7${Object.values(BLUEPRINTS).map((b) => b.name.toLowerCase()).join(", ")}§f.`);
  if (unknown) {
    L.say(`Hmm, não entendi "${text.slice(0, 40)}". Tente: §7${pick(LYRA_EXAMPLES)}§f.`);
    return;
  }
  for (const t of tasks) handleTask(player, L, t);
}

function lookOrigin(player, where) {
  const dim = player.dimension;
  const card = cardinal(yawDir(player.getRotation().y));
  if (where === "look") {
    const hit = player.getBlockFromViewDirection({ maxDistance: 32 });
    if (hit) {
      const b = hit.block.location;
      return { origin: { x: b.x, y: groundAt(dim, b.x, b.z, b.y + 1), z: b.z }, card };
    }
  }
  const d = yawDir(player.getRotation().y);
  const x = Math.floor(player.location.x + d.x * 3), z = Math.floor(player.location.z + d.z * 3);
  return { origin: { x, y: groundAt(dim, x, z, player.location.y), z }, card };
}

function handleTask(player, L, t) {
  const e = L.entity();
  switch (t.type) {
    case "stop":
      stopAll(player);
      return;
    case "recall":
      recallLyra(player);
      return;
    case "follow":
      stopAll(player, true);
      e?.triggerEvent("eclipse:state_follow");
      L.say(pick(["Estou te seguindo!", "Bora! Logo atrás de você.", "Vamos juntos."]));
      return;
    case "stay":
      stopAll(player, true);
      e?.triggerEvent("eclipse:state_stay");
      L.say("Vou esperar aqui.");
      return;
    case "guard":
      stopAll(player, true);
      e?.triggerEvent("eclipse:state_guard");
      L.say("Nenhum monstro chega perto de você. Modo proteção ativado! ⚔");
      return;
    case "come":
      enqueue(player, { type: "come" });
      L.say("Indo até você!");
      return;
    case "dance":
      try {
        e?.triggerEvent("eclipse:phase_special");
        system.runTimeout(() => e?.isValid && e.triggerEvent("eclipse:phase_idle"), 30);
      } catch {
        /* */
      }
      L.say("✨ Ta-dá!");
      return;
    case "inventory": {
      const c = inv(L);
      if (!c) return;
      const sum = {};
      for (let i = 0; i < c.size; i++) {
        const it = c.getItem(i);
        if (it) sum[it.typeId] = (sum[it.typeId] ?? 0) + it.amount;
      }
      const lines = Object.entries(sum).map(([k, v]) => `§7${k.replace("minecraft:", "").replace(/_/g, " ")}: §f${v}`);
      L.say(lines.length ? `Na minha bolsa tenho:\n${lines.join("\n")}` : "Minha bolsa está vazia.");
      return;
    }
    case "dump":
    case "give":
      giveToPlayer(player, L, t.type === "dump" ? null : t.resource, t.amount ?? 999);
      return;
    case "build": {
      const { origin, card } = lookOrigin(player, t.where);
      enqueue(player, { type: "build", blueprint: t.blueprint, origin, card });
      L.say(`Vou construir uma ${BLUEPRINTS[t.blueprint].name.toLowerCase()} ${t.where === "here" ? "aqui na sua frente" : "onde você está olhando"}! ${BLUEPRINTS[t.blueprint].desc}.`);
      return;
    }
    case "gather":
      enqueue(player, t);
      L.say(`Combinado: vou ${LABEL.gather(t)}.`);
      return;
    case "food":
      enqueue(player, t);
      L.say("Deixa comigo, vou arrumar comida!");
      return;
    case "ore":
      enqueue(player, t);
      L.say(`Vou procurar ${t.ore} para você.`);
      return;
    case "explore":
      enqueue(player, t);
      return;
    default:
      return;
  }
}

const RES_PRED = {
  log: (t) => t.endsWith("_log") || t.endsWith("_stem"),
  cobblestone: (t) => t === "minecraft:cobblestone" || t === "minecraft:cobbled_deepslate",
  sand: (t) => t === "minecraft:sand" || t === "minecraft:red_sand",
  food: (t) => isFood(t),
  coal: (t) => t === "minecraft:coal" || t === "minecraft:charcoal",
  iron: (t) => t === "minecraft:raw_iron" || t === "minecraft:iron_ingot",
  gold: (t) => t === "minecraft:raw_gold" || t === "minecraft:gold_ingot",
  diamond: (t) => t === "minecraft:diamond",
  copper: (t) => t === "minecraft:raw_copper",
  redstone: (t) => t === "minecraft:redstone",
  lapis: (t) => t === "minecraft:lapis_lazuli",
};

function giveToPlayer(player, L, resource, amount) {
  const c = inv(L);
  const pc = player.getComponent(EntityComponentTypes.Inventory)?.container;
  if (!c || !pc) return;
  let moved = 0;
  for (let i = 0; i < c.size && moved < amount; i++) {
    const it = c.getItem(i);
    if (!it) continue;
    if (resource && !(RES_PRED[resource] ?? (() => false))(it.typeId)) continue;
    const left = pc.addItem(it);
    if (left) {
      player.dimension.spawnItem(left, player.location);
    }
    c.setItem(i, undefined);
    moved += it.amount;
  }
  const e = L.entity();
  if (e) setAction(e, "wave");
  L.say(moved ? `Aqui está! Entreguei §f${moved}§f itens. 🎁` : "Não tenho isso na bolsa agora. Quer que eu vá buscar?");
}

/** Reconciliação ao entrar: Lyra existente é reencontrada; se sumiu, pode ser chamada de novo. */
export function lyraOnJoin(player) {
  const p = getProfile(player);
  if (p.lyra.id) {
    const L = L_of(player);
    if (!L.entity()) {
      // ainda pode estar carregando; o supervisor tenta de novo depois
      system.runTimeout(() => {
        if (!player.isValid) return;
        if (!L.entity() && p.lyra.summoned) {
          p.lyra.id = null;
          summonLyra(player);
        }
      }, 100);
    }
  }
}

export function forgetLyra(playerId) {
  states.delete(playerId);
}

export function lyraStats() {
  let active = 0, busy = 0;
  for (const L of states.values()) {
    if (L.entity()) active++;
    if (L.gen) busy++;
  }
  return { active, busy };
}

export { wait };
