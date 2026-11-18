/**
 * SHADOW AI BRAIN - orchestrates the modules.
 *
 *   order text -> [Owner Authorization] -> [Natural Language Interpreter] -> [Task Planner]
 *              -> queue -> [Action Executor] (perception, navigation, inventory, combat...)
 *
 *   decision tick (5x/s) applies the priorities documented in state_machine.ts
 */
import { Player, system } from "@minecraft/server";
import type { Agent } from "./agent";
import { AnimState, Mood, PROP_ANIM, TUNING } from "../core/constants";
import { dist, getBlock, isValid, safe } from "../core/mc";
import type { Intent, Task } from "../core/types";
import { stepLabel } from "../planner/planner";
import { isOwner } from "../authorization/owner_auth";
import { say, sayKey, setMood, updateMood, updateTalk } from "../communication/comms";
import { HELP_TEXT } from "../communication/phrases";
import { STATE_PT } from "../state/state_machine";
import { executorOf } from "./agent_manager";
import { applyToMembers, dispatchOrder } from "./squad";
import { enterProtect, leash, magicBolt, ownerThreat } from "../combat/combat";
import { beastTick } from "../combat/beasts";
import { chooseFood, shouldEat } from "../survival/needs";
import { needsRecovery, recovered } from "../survival/survival_manager";
import { eatNow, ownerLookFacing } from "../executor/tasks";
import type { R } from "../executor/routines";
import { prettyItem, RESOURCE_PT } from "../inventory/item_catalog";
import { NATURAL_DIG } from "../inventory/item_catalog";

export interface OrderOptions {
  fromMenu?: boolean;
  askForm?: (a: Agent, question: string, options: { label: string; text: string }[]) => void;
}

/** Order for ONE member (its own menu). Routed through the squad coordinator. */
export function handleOrder(a: Agent, sender: Player, text: string, opts: OrderOptions = {}): void {
  if (!isOwner(sender, a)) return; // other players are ignored silently
  dispatchOrder(sender, text, { ...opts, members: [a] });
}

/** Direct intents for ONE member (menus build them without text). */
export function applyIntents(a: Agent, sender: Player, intents: Intent[], append: boolean, reply?: string): void {
  if (!isOwner(sender, a)) return;
  applyToMembers(sender, [a], intents, append, reply);
}

export function setMode(a: Agent, sender: Player, mode: Agent["record"]["mode"]): void {
  a.record.mode = mode;
  if (mode === "guard") {
    const l = sender.location;
    a.record.guardPos = { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z), dim: sender.dimension.id };
  }
  if (mode === "stay") {
    const b = a.body();
    if (b) a.record.guardPos = { x: Math.floor(b.location.x), y: Math.floor(b.location.y), z: Math.floor(b.location.z), dim: b.dimension.id };
  }
  a.markDirty();
  sayKey(a, mode, undefined, { force: true });
}

/** Resolve things that must be captured at order time (what the owner is looking at, where). */
export function bindCommandContext(a: Agent, sender: Player, t: Task, intents: Intent[]): string | undefined {
  const target = t.goal.target;
  if (t.kind === "build") {
    const { origin, facing } = ownerLookFacing(sender);
    t.data.origin = origin;
    t.data.facing = facing;
  }
  if (t.kind === "destroy") {
    if (target?.kind === "area") {
      const { origin, facing } = ownerLookFacing(sender);
      const fwd = [{ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 }, { x: 1, z: 0 }][facing];
      const right = [{ x: -1, z: 0 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }][facing];
      const positions = [];
      const half = Math.floor(target.w / 2);
      for (let i = 0; i < target.d; i++) {
        for (let j = -half; j < target.w - half; j++) {
          for (let k = 1; k <= target.h; k++) {
            positions.push({ x: origin.x - fwd.x * 1 + fwd.x * i + right.x * j, y: origin.y - k, z: origin.z - fwd.z * 1 + fwd.z * i + right.z * j });
          }
        }
      }
      t.data.positions = positions;
    } else {
      const hit = safe(() => sender.getBlockFromViewDirection({ maxDistance: 24 }), undefined);
      if (!hit) return "Olhe para o bloco que você quer que eu quebre e repita a ordem.";
      const l = hit.block.location;
      t.data.positions = [{ x: l.x, y: l.y, z: l.z }];
    }
  }
  if (t.kind === "gather_wood" && target?.kind === "tree") {
    const hit = safe(() => sender.getBlockFromViewDirection({ maxDistance: 32 }), undefined);
    if (hit && /(_log|_stem)$/.test(hit.block.typeId)) {
      // walk down to the base of that tree
      let p = { ...hit.block.location };
      for (let i = 0; i < 30; i++) {
        const below = getBlock(sender.dimension, { x: p.x, y: p.y - 1, z: p.z });
        if (!below || !/(_log|_stem)$/.test(below.typeId)) break;
        p = below.location;
      }
      t.data.treePos = p;
    }
  }
  if (t.kind === "attack") {
    let found: string | undefined;
    if (target?.kind === "view") {
      const hits = safe(() => sender.getEntitiesFromViewDirection({ maxDistance: 32 }), []);
      for (const h of hits) {
        const id = safe(() => h.entity.typeId, "");
        if (id === "minecraft:player" || id === "minecraft:item" || h.entity.id === a.bodyId) continue;
        found = h.entity.id;
        break;
      }
      if (!found) return "Não vi nenhum alvo na sua mira. Olhe para ele e repita.";
    } else {
      const list = safe(() => sender.dimension.getEntities({ location: sender.location, maxDistance: 20, type: target?.kind === "mob" ? target.mob : undefined, families: target?.kind === "hostiles" ? ["monster"] : undefined }), []);
      const ok = list.filter((x) => safe(() => x.typeId, "") !== "minecraft:player" && x.id !== a.bodyId && !safe(() => x.matches({ families: ["shadowbound"] }), false));
      ok.sort((x, y) => dist(x.location, sender.location) - dist(y.location, sender.location));
      found = ok[0]?.id;
      if (!found) return "Não vejo esse alvo por perto.";
    }
    t.data.entityId = found;
  }
  if (t.kind === "gather_food" && intents.some((i) => i.allowHunting)) t.goal.allowHunting = true;
  void NATURAL_DIG;
  return undefined;
}

export function statusText(a: Agent): string {
  const h = a.health();
  const t = a.record.queue[0];
  const lines = [
    `Estado: ${STATE_PT[a.sm.state]} | Modo: ${{ follow: "seguir", protect: "proteger", guard: "guarda", stay: "parada" }[a.record.mode]}`,
    `Vida: ${Math.round(h.cur)}/${h.max} | Fome: ${Math.round(a.record.needs.hunger)}/20`,
    t ? `Tarefa: ${t.label} - ${stepLabel(t)} - ${t.progress.done}/${t.progress.total}${a.record.pausedByOwner ? " (pausada)" : ""}` : "Sem tarefa.",
    `Mochila: ${a.inv.slots.length}/${a.inv.capacity} espaços, ${a.inv.total()} itens`,
  ];
  if (a.record.queue.length > 1) lines.push(`Na fila: ${a.record.queue.slice(1).map((x) => x.label).join(", ")}`);
  return lines.join("\n");
}

export function answerQuery(a: Agent, q: string): void {
  const t = a.record.queue[0];
  switch (q) {
    case "status":
      say(a, "\n" + statusText(a), { force: true });
      break;
    case "inventory": {
      const s = a.inv.summary();
      const eq = Object.entries(a.record.equipment).filter(([, v]) => !!v).map(([k, v]) => `${k}: ${prettyItem(v!.id)}`);
      say(a, s.length ? `Tenho: ${s.slice(0, 12).map((x) => `${x.n} ${prettyItem(x.id)}`).join(", ")}${s.length > 12 ? "..." : ""}` : "Minha mochila está vazia.", { force: true });
      if (eq.length) say(a, `Equipado: ${eq.join(", ")}`, { force: true });
      break;
    }
    case "why": {
      const why = a.rt.lastWhy || (t ? "" : a.record.lastFailure ?? "");
      if (why) say(a, `Motivo: ${why}`, { force: true });
      else if (a.record.pausedByOwner) say(a, "Você me pediu para pausar.", { force: true });
      else if (t) say(a, `Não parei: estou ${STATE_PT[a.sm.state]} (${stepLabel(t)}).`, { force: true });
      else say(a, "Estou sem tarefa agora. Me dá uma ordem!", { force: true });
      break;
    }
    case "progress":
      if (t) say(a, `Ainda não terminei: ${t.label}, ${t.progress.done}/${t.progress.total}. Agora estou ${stepLabel(t)}.`, { force: true });
      else if (a.record.history[0]) say(a, a.record.history[0].startsWith("✔") ? `Sim! ${a.record.history[0].slice(2)}` : `Não consegui: ${a.record.history[0].slice(2)}`, { force: true });
      else say(a, "Ainda não fiz nenhuma tarefa.", { force: true });
      break;
    case "help":
      say(a, "\n" + HELP_TEXT, { force: true });
      break;
    case "greet":
    case "thanks":
    case "compliment":
      sayKey(a, q, undefined, { force: true });
      if (q !== "greet") setMood(a.body(), Mood.Happy, 3000);
      else a.setAnim(AnimState.Wave, 1500);
      break;
    case "unknown":
      break;
  }
}

// =================================================================================================
// Decision tick
// =================================================================================================
const needGens = new WeakMap<Agent, R<boolean>>();
const needWait = new WeakMap<Agent, number>();

export function brainTick(a: Agent, dt: number): void {
  const e = a.body();
  if (!e || !a.record.active || a.record.dead) return;
  updateTalk(e);
  updateMood(e);
  // end one-shot animations
  if (a.rt.animUntil && Date.now() > a.rt.animUntil) {
    a.rt.animUntil = 0;
    const want = a.mover.status === "moving" ? (a.rt.lastMoveAnimRun ? AnimState.Run : AnimState.Walk) : a.rt.workAnim;
    if (safe(() => e.getProperty(PROP_ANIM) as number, 0) !== want) a.setAnim(want);
  }
  if (Date.now() - a.rt.summonedAt < 1500) return; // let the summon animation play
  const owner = a.owner();
  if (!owner) return;
  const ex = executorOf(a);

  // 1. protect the owner
  const threat = system.currentTick % 10 < dt ? ownerThreat(a) : undefined;
  if (threat && owner.dimension.id === e.dimension.id && dist(owner.location, e.location) < 40) {
    if (ex.running()) ex.interrupt();
    enterProtect(a, threat);
    magicBolt(a, threat);
    if (a.isBeast) beastTick(a);
    a.sm.set("PROTECTING");
    return;
  }
  if (Date.now() < a.rt.protectUntil) {
    leash(a);
    const t = a.rt.threatId ? safe(() => e.dimension.getEntities({ location: e.location, maxDistance: 14 }).find((x) => x.id === a.rt.threatId), undefined) : undefined;
    if (isValid(t)) magicBolt(a, t);
    if (a.isBeast) beastTick(a);
    return;
  }
  if (a.sm.state === "PROTECTING") setMood(e, Mood.Neutral);

  // beasts: no hunger, no equipment; special moves + orders + default behaviour
  if (a.isBeast) {
    beastTick(a);
    if (a.record.queue.length && !a.record.pausedByOwner) ex.tick(dt);
    else idleBehaviour(a);
    return;
  }

  // 3. own needs (health first, then hunger)
  const gen = needGens.get(a);
  if (gen) {
    const w = (needWait.get(a) ?? 0) - dt;
    needWait.set(a, w);
    if (w > 0) return;
    try {
      const r = gen.next();
      if (r.done) needGens.delete(a);
      else if (r.value.t === "wait") needWait.set(a, r.value.ticks);
    } catch {
      needGens.delete(a);
    }
    return;
  }
  if (!a.rt.recovering && needsRecovery(a)) {
    a.rt.recovering = true;
    ex.interrupt();
    sayKey(a, "hurt", undefined, { throttleMs: 20000 });
  }
  if (a.rt.recovering) {
    if (recovered(a)) {
      a.rt.recovering = false;
      if (a.record.queue.length) say(a, "Recuperada! Voltando ao trabalho.", { throttleMs: 10000 });
    } else {
      a.sm.set("RECOVERING");
      a.setNativeMode("follow");
      const choice = chooseFood(a.inv.slots, a.record.needs, 0);
      if (choice && a.record.needs.hunger < 18) startNeed(a, eatNow(a, choice.id), choice.id);
      return;
    }
  }
  if (shouldEat(a.record.needs, a.record.settings.autoEat)) {
    const choice = chooseFood(a.inv.slots, a.record.needs, a.record.settings.foodReserve);
    if (choice) {
      if (ex.running()) ex.interrupt();
      sayKey(a, "hungry", undefined, { throttleMs: 30000 });
      startNeed(a, eatNow(a, choice.id), choice.id);
      return;
    }
    if (a.record.needs.hunger <= 6) sayKey(a, "no_food", undefined, { throttleMs: 90000 });
  }

  // 4. active task
  if (a.record.queue.length && !a.record.pausedByOwner) {
    ex.tick(dt);
    return;
  }

  // 5. default behaviour
  idleBehaviour(a);
}

function startNeed(a: Agent, g: R<boolean>, id: string): void {
  a.sm.set("EATING");
  needWait.set(a, 0);
  needGens.set(
    a,
    (function* () {
      const ok = yield* g;
      if (ok) sayKey(a, "ate", prettyItem(id), { throttleMs: 20000 });
      return ok;
    })(),
  );
}

function idleBehaviour(a: Agent): void {
  const e = a.body();
  if (!e) return;
  const m = a.record.mode;
  if (m === "follow" || m === "protect") {
    a.setNativeMode("follow");
    a.sm.set("FOLLOWING");
    if (a.rt.workAnim !== AnimState.Idle) a.setWorkAnim(AnimState.Idle);
    return;
  }
  const gp = a.record.guardPos;
  if (m === "guard") {
    a.sm.set("GUARDING");
    if (gp && gp.dim === e.dimension.id && dist(gp, e.location) > 8 && a.mover.status !== "moving" && a.mover.status !== "planning") {
      a.setNativeMode("scripted");
      a.mover.start({ target: gp, isGoal: (c) => Math.hypot(c.x - gp.x, c.z - gp.z) <= 2 && Math.abs(c.y - gp.y) <= 2, maxRadius: 40 });
      return;
    }
    if (a.mover.status !== "moving" && a.mover.status !== "planning") {
      a.setNativeMode("guard");
      if (a.rt.workAnim !== AnimState.Guard) a.setWorkAnim(AnimState.Guard);
    }
    return;
  }
  // stay
  a.sm.set("IDLE");
  a.setNativeMode("scripted");
  if (a.rt.workAnim !== AnimState.Idle) a.setWorkAnim(AnimState.Idle);
}

export { RESOURCE_PT, TUNING };
