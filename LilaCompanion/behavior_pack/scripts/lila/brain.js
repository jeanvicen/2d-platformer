// O cérebro: executa objetivos (generators), atende ordens, trata necessidades (perigo, fome,
// sono) e, quando ninguém pede nada, decide sozinha o que fazer como uma jogadora de verdade
// (IA por utilidade: cada opção recebe uma nota conforme a situação e a melhor vence).
import { system, world } from "@minecraft/server";
import { parseCommands, describe } from "../lib/intent.js";
import { ORES, TIER_RANK } from "../lib/items.js";
import { GoalError } from "./companion.js";
import { runGoal, goalLabel } from "./goals.js";
import { findThreat } from "./combat.js";
import { abortAll, dismiss } from "./lifecycle.js";
import { keepLoaded } from "./areas.js";
import { collectDrops, cleanupIgnored } from "./blocks.js";
import * as inv from "./inventory.js";
import { setAction, getAction } from "./anim.js";
import { LINES, pick, say } from "./talk.js";
import { logError } from "../core/log.js";
import { missions, mount } from "./drone.js";
import { formOf, setForm, releaseRiders } from "./forms.js";
import { armyActive, merge, command as armyCommand } from "./army.js";
import { FORM_NAMES } from "../lib/catalog.js";
import { overBudget } from "../core/budget.js";

/** @typedef {import("./companion.js").Companion} Companion */
/** @typedef {import("./companion.js").GoalDesc} GoalDesc */

function start(c, desc, urgent = false) {
  let gen;
  try {
    gen = runGoal(c, desc);
  } catch (e) {
    logError("brain.start", e);
    return;
  }
  const job = { desc, gen, wait: 0, t0: system.currentTick };
  if (urgent || desc.type !== "follow" && desc.type !== "tagalong") {
    try {
      if (c.flags.nativeFollow) c.entity?.triggerEvent("lila:follow_off");
    } catch {
      /* ignore */
    }
    c.flags.nativeFollow = false;
  }
  if (urgent) c.urgent = job;
  else c.job = job;
  c.abortMove = false;
}

/** Avança um job um passo. */
function step(c, job) {
  if (job.wait > 0) {
    job.wait--;
    return "run";
  }
  let r;
  const t0 = Date.now();
  try {
    r = job.gen.next();
  } catch (e) {
    job.error = e;
    return "fail";
  } finally {
    const dt = Date.now() - t0;
    if (dt > (stats.maxStepMs ?? 0)) stats.maxStepMs = dt;
    if (dt > 50) logError("brain.slow", `${job.desc.type}: passo de ${dt} ms`);
  }
  if (r.done) return "done";
  job.wait = typeof r.value === "number" ? Math.max(0, r.value - 1) : 0;
  return "run";
}

/** Estatísticas de desempenho (o autoteste confere o passo mais lento). */
export const stats = { maxStepMs: 0 };

/** Chamado todo tick para cada Lila ativa. */
export function tick(c) {
  if (!c.alive() || c.rec.defeat || c.rec.paused) return;
  if (overBudget(14)) return; // o tick já está pesado: ela espera o próximo
  const job = c.urgent ?? c.job;
  if (!job) {
    pickNext(c);
    return;
  }
  const res = step(c, job);
  if (res === "run") return;
  const urgent = job === c.urgent;
  if (urgent) c.urgent = null;
  else c.job = null;
  if (!c.alive()) return;
  setAction(c.entity, c.sleeping ? "sleep" : "idle");
  if (res === "done") {
    if (!urgent && job.desc.origin === "cmd") {
      c.rec.goals.shift();
      c.save();
    }
    return;
  }
  // falhou
  const e = job.error;
  const msg = e instanceof GoalError ? e.message : String(e?.message ?? e);
  c.lastError = `${job.desc.type}: ${msg}`;
  if (!(e instanceof GoalError)) logError(`goal.${job.desc.type}`, e);
  if (!urgent && job.desc.origin === "cmd") {
    const g = c.rec.goals[0];
    g.tries = (g.tries ?? 0) + 1;
    if (g.tries < 2 && (!(e instanceof GoalError) || e.code === "fail")) {
      say(c, `Opa, deu um problema (${msg}). Vou tentar de outro jeito...`, { force: true });
      c.flags.retryAt = system.currentTick + 60;
    } else {
      say(c, `Não deu pra ${describe({ type: g.type, ...(g.args ?? {}) })}: ${msg}.`, { force: true });
      c.rec.goals.shift();
    }
    c.save();
  } else if (!urgent) {
    c.flags.autoCooldown = system.currentTick + 200;
    c.flags.lastFail = { type: job.desc.type, t: system.currentTick };
  }
}

/** Escolhe o próximo objetivo: fila de ordens → modo (seguir/ficar/guarda) → autonomia. */
function pickNext(c) {
  if (c.flags.retryAt && system.currentTick < c.flags.retryAt) return;
  const g = c.rec.goals[0];
  if (g) {
    start(c, g);
    return;
  }
  const mode = c.rec.mode;
  if (mode === "stay") return start(c, { type: "stay", origin: "auto" });
  if (mode === "turret") return start(c, { type: "turret", origin: "auto" });
  if (mode === "follow" || mode === "guard") {
    if (nightTime() && !findThreat(c) && ownerResting(c)) return start(c, { type: "sleep", origin: "auto" });
    return start(c, { type: "follow", origin: "auto" });
  }
  if (c.flags.autoCooldown && system.currentTick < c.flags.autoCooldown) {
    return start(c, { type: "hangout", origin: "auto", args: { ticks: 200 } });
  }
  const pickG = chooseAuto(c);
  announce(c, pickG);
  start(c, pickG);
}

const PLANS = {
  stock: (a) => `Vou juntar ${a.count ?? ""} ${a.item?.group === "log" ? "madeira" : String(a.item?.id ?? a.item ?? "").replace("minecraft:", "").replace(/_/g, " ")} aqui perto.`,
  tools: (a) => `Vou fazer umas ferramentas ${a.tier === "iron" ? "de ferro" : a.tier === "stone" ? "de pedra" : "de madeira"}.`,
  food: () => "Vou procurar comida pra gente.",
  build: () => "Vou construir uma casinha pra gente aqui perto!",
  farm: () => "Vou fazer uma plantação do lado da casa.",
  tend: () => "Vou dar uma olhada na plantação.",
  deposit: () => "Mochila cheia, vou guardar as coisas no baú.",
  armor: () => "Vou fazer uma armadura pra mim.",
  explore: () => "Vou dar uma explorada por aqui, já volto!",
  sleep: () => "Tá tarde... vou descansar perto de você.",
};

function announce(c, g) {
  const f = PLANS[g.type];
  if (!f || c.flags.lastAnnounced === g.type) return;
  c.flags.lastAnnounced = g.type;
  say(c, f(g.args ?? {}), { chatter: true });
}

const nightTime = () => {
  const t = world.getTimeOfDay();
  return t > 13000 && t < 23000;
};

function ownerResting(c) {
  const o = c.owner();
  if (!o) return true;
  try {
    if (o.isSleeping) return true;
  } catch {
    /* ignore */
  }
  return Math.hypot(o.location.x - c.pos().x, o.location.z - c.pos().z) < 12 && world.getTimeOfDay() > 14000;
}

/**
 * IA por utilidade: nota para cada atividade possível.
 * @returns {GoalDesc}
 */
export function chooseAuto(c) {
  const s = inv.summary(c);
  const cnt = (id) => s[id] ?? 0;
  const logs = Object.entries(s).filter(([id]) => /_log$|_stem$/.test(id)).reduce((a, [, n]) => a + n, 0);
  const planks = Object.entries(s).filter(([id]) => /_planks$/.test(id)).reduce((a, [, n]) => a + n, 0);
  const wood = logs * 4 + planks;
  const food = inv.count(c, { group: "food" });
  const pick = TIER_RANK[inv.toolTier(c, "pickaxe")];
  const axe = TIER_RANK[inv.toolTier(c, "axe")];
  const sword = TIER_RANK[inv.toolTier(c, "sword")];
  const o = c.owner();
  const d = o ? Math.hypot(o.location.x - c.pos().x, o.location.z - c.pos().z) : 0;
  const roam = c.rec.settings.roam ?? 96;
  const opts = [];
  const add = (score, desc) => opts.push({ score: score + Math.random() * 6, desc: { origin: "auto", ...desc } });
  const failed = c.flags.lastFail && system.currentTick - c.flags.lastFail.t < 2400 ? c.flags.lastFail.type : null;
  if (c.def?.creative) {
    // itens infinitos: nada de juntar recurso — ele fica com você, ilumina, patrulha e explora perto
    if (o && d > roam) add(95, { type: "regroup" });
    if (o && (system.currentTick < (c.flags.tagUntil ?? 0) || c.flags.ownerMoving)) add(90, { type: "tagalong", args: { ticks: 240 } });
    if (o && c.flags.ownerDark && system.currentTick - (c.flags.lastTorch ?? -9999) > 1200) add(70, { type: "torches", args: { count: 4, quiet: true } });
    add(40, { type: "tagalong", args: { ticks: 400 } });
    add(18, { type: "hangout", args: { ticks: 300 } });
    if (d < roam / 2 && !c.flags.ownerMoving) add(12, { type: "explore", args: { legs: 1 } });
    opts.sort((a, b) => b.score - a.score);
    return (opts.find((x) => x.desc.type !== failed) ?? opts[0]).desc;
  }

  if (o && d > roam) add(95, { type: "regroup" });
  // acabou de chegar ou você está viajando: vai junto (como uma amiga de verdade)
  if (o && (system.currentTick < (c.flags.tagUntil ?? 0) || c.flags.ownerMoving)) add(90, { type: "tagalong", args: { ticks: 240 } });
  // escuro perto de você e ela tem tochas: ilumina
  if (o && c.flags.ownerDark && cnt("minecraft:torch") > 0 && system.currentTick - (c.flags.lastTorch ?? -9999) > 1200) add(70, { type: "torches", args: { count: 4, quiet: true } });
  if (c.rec.hunger < 8 && food === 0) add(88, { type: "food", args: { count: 6 } });
  else if (food < 4) add(42, { type: "food", args: { count: 8 } });
  if (nightTime() && !findThreat(c) && (ownerResting(c) || d < 16)) add(72, { type: "sleep" });
  if (inv.freeSlots(c) < 4) add(58, { type: "deposit" });
  if (pick === 0 || axe === 0) add(66, { type: "tools", args: { tier: wood >= 12 ? "stone" : "wooden", kinds: ["pickaxe", "axe", "sword"] } });
  else if (pick < 2 || sword < 2) add(52, { type: "tools", args: { tier: "stone", kinds: ["pickaxe", "sword", "axe", "shovel"] } });
  else if (pick < 3 && cnt("minecraft:iron_ingot") + cnt("minecraft:raw_iron") >= 6) add(40, { type: "tools", args: { tier: "iron", kinds: ["pickaxe", "sword"] } });
  else if (pick < 3) add(24, { type: "stock", args: { item: "minecraft:raw_iron", count: 6 } });
  if (wood < 64) add(38 - wood / 4, { type: "stock", args: { item: { group: "log" }, count: 16 } });
  if (pick >= 1 && cnt("minecraft:cobblestone") < 32) add(30, { type: "stock", args: { item: "minecraft:cobblestone", count: 32 } });
  if (cnt("minecraft:torch") < 8 && pick >= 1) add(22, { type: "stock", args: { item: "minecraft:torch", count: 16 } });
  if (pick >= 3 && cnt("minecraft:iron_ingot") >= 24 && cnt("minecraft:iron_chestplate") === 0) add(26, { type: "armor", args: { tier: "iron" } });
  if (pick >= 3 && cnt("minecraft:diamond") < 3) add(16, { type: "stock", args: { item: "minecraft:diamond", count: 3 } });
  if (!c.rec.base && pick >= 2 && !nightTime()) add(32, { type: "build", args: { blueprint: "cabana" } });
  if (c.rec.base && !c.rec.farm && !nightTime()) add(28, { type: "farm", args: { crop: "minecraft:wheat_seeds" } });
  if (c.rec.farm) add(18 + (system.currentTick % 6000 < 200 ? 20 : 0), { type: "tend" });
  add(18, { type: "hangout", args: { ticks: 400 } });
  if (d < roam / 2 && !c.flags.ownerMoving) add(12, { type: "explore", args: { legs: 2 } });
  opts.sort((a, b) => b.score - a.score);
  const best = opts.find((x) => x.desc.type !== failed) ?? opts[0];
  return best.desc;
}

/** A cada 10 ticks: perigo, fome, distância do dono, área carregada. */
export function sense(c) {
  if (!c.alive() || c.rec.defeat || c.rec.paused) return;
  const now = system.currentTick;
  // sense() roda a cada 10 ticks (com deslocamento): conta as próprias passadas em vez de usar o tick
  const pass = (c.flags.sensePass = (c.flags.sensePass ?? 0) + 1);
  // perigo: interrompe qualquer coisa (exceto se já está lutando) — no modo proteger ele vai atrás primeiro
  if (!c.urgent) {
    const t = findThreat(c);
    if (t) {
      if (c.sleeping) c.flags.wake = true;
      start(c, { type: "defend", origin: "auto" }, true);
      return;
    }
  }
  // fome: come quando der (interrupção curta)
  if (!c.urgent && c.rec.hunger < 12 && inv.bestFood(c) && getAction(c.entity) !== "eat") {
    start(c, { type: "eat", origin: "auto" }, true);
    return;
  }
  // no modo autônomo, se o dono foi longe demais, larga a tarefa e volta
  const o = c.owner();
  if (o && pass % 2 === 0) watchOwner(c, o);
  if (o) {
    if (o.dimension.id !== c.dim().id) {
      c.flags.otherDim = (c.flags.otherDim ?? 0) + 10;
      if (c.flags.otherDim > 200) {
        c.flags.otherDim = 0;
        followAcrossDimension(c, o);
      }
    } else {
      c.flags.otherDim = 0;
      const d = Math.hypot(o.location.x - c.pos().x, o.location.z - c.pos().z);
      const roam = c.rec.settings.roam ?? 96;
      const jt = c.job?.desc.type;
      const casual = jt && c.job?.desc.origin === "auto" && !["regroup", "tagalong", "follow", "sleep"].includes(jt);
      if (casual && (d > roam * 1.6 || (c.flags.ownerMoving && d > 24))) {
        abortAll(c, true);
        start(c, { type: "tagalong", origin: "auto", args: { ticks: 240 } });
      }
    }
  }
  keepLoaded(c);
  // pega itens do chão quando passa por cima (como jogadora)
  if (pass % 2 === 1) collectDrops(c, c.pos(), c.def?.flying ? 3 : 2);
}

/** Observa o dono: está viajando? está no escuro? está machucado? */
function watchOwner(c, o) {
  const trail = (c.flags.trail ??= []);
  trail.push({ x: o.location.x, z: o.location.z });
  if (trail.length > 6) trail.shift(); // ~6 s
  const a = trail[0], b = trail[trail.length - 1];
  c.flags.ownerMoving = trail.length >= 3 && Math.hypot(a.x - b.x, a.z - b.z) > 9;
  try {
    const blk = o.dimension.getBlock({ x: Math.floor(o.location.x), y: Math.floor(o.location.y), z: Math.floor(o.location.z) });
    c.flags.ownerDark = !!blk && blk.getLightLevel() < 7 && !c.flags.ownerMoving;
  } catch {
    c.flags.ownerDark = false;
  }
  // você agachou olhando pra ela, pertinho: ela acena de volta (como amigos fazem no jogo)
  try {
    const dx = c.pos().x - o.location.x, dz = c.pos().z - o.location.z;
    const dd = Math.hypot(dx, dz);
    const v = o.getViewDirection();
    if (o.isSneaking && dd < 6 && dd > 0.5 && (v.x * dx + v.z * dz) / dd > 0.85 && system.currentTick - (c.flags.lastWave ?? -999) > 200 && !c.urgent) {
      c.flags.lastWave = system.currentTick;
      const e = c.entity;
      if (e) {
        e.setRotation({ x: 0, y: (-Math.atan2(-dx, -dz) * 180) / Math.PI });
        setAction(e, "wave");
        system.runTimeout(() => setAction(c.entity, "idle"), 30);
      }
      say(c, pick(["Oi! 👋", "E aí!", "Tô aqui!", "Hehe, oi!"]).replace(" 👋", ""), { chatter: true });
    }
  } catch {
    /* ignore */
  }
  // vida baixa: leva comida até ele (no máximo 1× por minuto)
  try {
    const hp = o.getComponent("minecraft:health");
    if (hp && hp.currentValue <= 8 && !c.urgent && system.currentTick - (c.flags.lastHeal ?? -99999) > 1200 && inv.bestFood(c)) {
      c.flags.lastHeal = system.currentTick;
      say(c, "Você tá machucado! Toma, come alguma coisa.", { force: true });
      start(c, { type: "give", origin: "auto", args: { item: { group: "food" }, count: 3 } }, true);
    }
  } catch {
    /* ignore */
  }
}

function followAcrossDimension(c, o) {
  try {
    const l = o.location;
    c.entity?.teleport({ x: l.x + 1, y: l.y, z: l.z + 1 }, { dimension: o.dimension, keepVelocity: false });
    say(c, "Te segui pelo portal!", { chatter: true });
  } catch (e) {
    logError("brain.dimension", e);
  }
}

/** A cada 20 ticks: fome cai, vida regenera com a barriga cheia. */
export function metabolism(c) {
  if (!c.alive() || c.rec.defeat) return;
  if (c.def?.creative) c.rec.hunger = 20; // energia infinita
  const working = !!c.job && !["hangout", "stay", "follow", "sleep"].includes(c.job.desc.type);
  c.rec.hunger = Math.max(0, c.rec.hunger - (working ? 0.025 : 0.01));
  // roda a cada 20 ticks com deslocamento: alterna pelas próprias passadas (o tick nunca seria múltiplo de 40 aqui)
  c.flags.metaPass = (c.flags.metaPass ?? 0) + 1;
  if (c.rec.hunger >= 12 && c.flags.metaPass % 2 === 0) {
    try {
      const hp = c.entity?.getComponent("minecraft:health");
      if (hp && hp.currentValue < hp.effectiveMax) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 1));
    } catch {
      /* ignore */
    }
  }
  cleanupIgnored();
}

/**
 * Recebe uma ordem em texto livre (controle ou /lila).
 * @param {Companion} c
 * @param {string} text
 */
export function command(c, text) {
  const intents = parseCommands(text);
  if (!intents.length) return;
  handleIntents(c, intents, text);
}

const GOAL_TYPES = new Set(["gather", "craft", "build", "farm", "food", "give", "explore", "hunt", "attack", "sleep", "home", "torches", "deposit", "come",
  "mega", "biome", "kit", "flatten", "vacuum"]);

/** "Cancelar": larga tudo e volta a ser o drone normal (junta o exército, desfaz veículo/colosso/torreta). */
export function backToNormal(c, quiet = false) {
  abortAll(c);
  if (armyActive(c)) merge(c);
  else if (c.alive() && formOf(c) !== "drone") {
    releaseRiders(c);
    setForm(c, "drone", { mount: false, quiet });
  }
  if (c.rec.mode === "turret" || c.rec.mode === "stay") c.rec.mode = "follow";
  c.save();
}

export function handleIntents(c, intents, raw = "") {
  const newGoals = [];
  for (const it of intents) {
    switch (it.type) {
      case "stop":
      case "normal":
        backToNormal(c);
        say(c, it.type === "normal" ? "Voltei ao normal! Drone de novo." : "Cancelei tudo e voltei ao normal. O que você quer agora?", { force: true });
        break;
      case "form": {
        if (armyActive(c)) merge(c);
        abortAll(c);
        const o = c.owner();
        if (!c.alive() || !o) {
          say(c, "Me invoque primeiro!", { force: true });
          break;
        }
        if (it.form === formOf(c)) {
          say(c, `Já estou de ${FORM_NAMES[it.form]}!`, { force: true });
          break;
        }
        // vem pra perto e se transforma do seu lado
        try {
          const l = o.location, r = (o.getRotation().y * Math.PI) / 180;
          const d = it.form === "colossus" ? 9 : 2.5;
          c.entity?.teleport({ x: l.x - Math.sin(r) * d, y: l.y + (it.form === "heli" || it.form === "jet" ? 0.5 : 0), z: l.z + Math.cos(r) * d }, { keepVelocity: false });
        } catch {
          /* ignore */
        }
        if (c.rec.mode === "turret") c.rec.mode = "follow";
        setForm(c, it.form);
        break;
      }
      case "pause":
        abortAll(c, true);
        c.rec.paused = true;
        setAction(c.entity, "idle");
        say(c, "Pausada. Diga \"continua\" quando quiser.", { force: true });
        break;
      case "resume":
        c.rec.paused = false;
        say(c, c.rec.goals.length ? `Continuando: ${goalLabel(c.rec.goals[0])}.` : "Voltei à ativa!", { force: true });
        break;
      case "follow":
        abortAll(c);
        c.rec.mode = "follow";
        say(c, "Tô te seguindo!", { force: true });
        break;
      case "stay":
        abortAll(c);
        c.rec.mode = "stay";
        c.rec.stayPos = { ...c.pos() };
        say(c, "Fico aqui esperando.", { force: true });
        break;
      case "auto":
        abortAll(c);
        if (c.rec.mode === "turret") setAction(c.entity, "idle");
        c.rec.mode = "auto";
        say(c, "Modo livre! Vou cuidar da minha vida e ficar de olho em você.", { force: true });
        break;
      case "protect":
        abortAll(c);
        c.rec.mode = "guard";
        if (armyActive(c)) armyCommand(c, "guard");
        say(c, "Modo proteger: eu ataco primeiro qualquer monstro perto de você, e quem te bater (até jogador) vira alvo!", { force: true });
        break;
      case "buildspeed": {
        c.rec.settings.buildSpeed = it.speed;
        const lbl = { humano: "à mão, bloco por bloco (devagar, como um jogador)", normal: "normal", rapido: "rápido", instantaneo: "instantâneo (tudo de uma vez)" }[it.speed];
        say(c, `Beleza: vou construir ${lbl}.`, { force: true });
        break;
      }
      case "army":
        if (armyActive(c)) {
          say(c, "Já estou em modo exército! Use o controle para mandar neles.", { force: true });
          break;
        }
        if (formOf(c) !== "drone") setForm(c, "drone", { mount: false, quiet: true });
        abortAll(c);
        newGoals.push({ type: "army", args: { count: it.count ?? c.rec.settings.army ?? 10 }, origin: "cmd", label: "modo exército" });
        break;
      case "wake":
        c.flags.wake = true;
        say(c, "Tô acordada!", { force: true });
        break;
      case "turret":
        if (armyActive(c)) merge(c);
        abortAll(c);
        if (formOf(c) !== "drone" && formOf(c) !== "turret") setForm(c, "drone", { mount: false, quiet: true });
        c.rec.mode = c.def?.gun ? "turret" : "guard";
        if (!c.def?.gun) say(c, "Não tenho arma de torreta, mas fico de guarda-costas!", { force: true });
        break;
      case "scan":
        newGoals.push({ type: "scan", args: {}, origin: "cmd", label: "escanear você" });
        break;
      case "ride": {
        const o = c.owner();
        if (!c.def?.flying) say(c, "Eu não consigo te carregar... mas o DR-0N consegue!", { force: true });
        else if (o && !mount(c, o)) say(c, "Não consegui te pegar agora. Chega mais perto!", { force: true });
        break;
      }
      case "missions": {
        const ms = missions(c);
        say(c, "Missões: " + ms.map((m) => `${m.done ? "§a✔" : "§e•"} ${m.title} (${Math.min(m.have, m.need)}/${m.need})§r`).join("  "), { force: true });
        break;
      }
      case "sethome": {
        const o = c.owner();
        const p = o?.location ?? c.pos();
        c.rec.base = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), d: (o?.dimension ?? c.dim()).id };
        say(c, "Anotado: aqui é a nossa base!", { force: true });
        break;
      }
      case "dismiss":
        dismiss(c);
        return;
      case "status":
        say(c, statusText(c), { force: true });
        break;
      case "inventory":
        say(c, inventoryText(c), { force: true });
        break;
      case "thanks":
        say(c, pick(LINES.thanks), { force: true });
        break;
      case "hello":
        say(c, pick(LINES.hello), { force: true });
        break;
      case "unknown":
        say(c, pick(LINES.unknown), { force: true });
        break;
      default:
        if (GOAL_TYPES.has(it.type)) {
          const { type, ...args } = it;
          newGoals.push({ type, args, origin: "cmd", label: describe(it) });
        }
    }
  }
  if (newGoals.length) {
    const append = /\bdepois\b|\bem seguida\b|\btambem\b/.test(raw.toLowerCase()) && c.rec.goals.length && !intents.some((i) => i.type === "stop");
    if (!append) abortAll(c);
    c.rec.goals.push(...newGoals);
    c.rec.paused = false;
    c.flags.retryAt = 0;
    const lbl = newGoals.map((g) => g.label).join(", depois ");
    say(c, `${pick(LINES.ack)} (${lbl})`, { force: true });
  }
  c.save();
}

export function statusText(c) {
  let hp = 0, max = 100;
  try {
    const h = c.entity?.getComponent("minecraft:health");
    hp = Math.round(h?.currentValue ?? 0);
    max = Math.round(h?.effectiveMax ?? 100);
  } catch {
    /* ignore */
  }
  const cur = c.urgent?.desc ?? c.job?.desc ?? c.rec.goals[0];
  const mode = { auto: "livre", follow: "seguindo", stay: "parado", guard: "proteger (ataca primeiro)", turret: "torreta" }[c.rec.mode] ?? c.rec.mode;
  const pickT = inv.toolTier(c, "pickaxe");
  return `Vida ${hp}/${max} · Fome ${Math.round(c.rec.hunger)}/20 · Modo ${mode} · Agora: ${goalLabel(cur)}` +
    (c.rec.goals.length > 1 ? ` (+${c.rec.goals.length - 1} na fila)` : "") + ` · Forma: ${c.rec.form === "army" ? "exército" : FORM_NAMES[c.rec.form ?? "drone"] ?? "drone"}` +
    (c.def?.creative ? " · Itens: infinitos" : ` · Picareta: ${pickT === "none" ? "nenhuma" : pickT}`);
}

export function inventoryText(c) {
  const s = Object.entries(inv.summary(c)).sort((a, b) => b[1] - a[1]);
  if (!s.length) return "Meu inventário está vazio.";
  return "Tenho: " + s.slice(0, 14).map(([id, n]) => `${n}× ${id.replace("minecraft:", "").replace(/_/g, " ")}`).join(", ") + (s.length > 14 ? "..." : "");
}

export { ORES };
