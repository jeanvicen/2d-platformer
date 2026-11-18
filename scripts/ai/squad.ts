/**
 * Squad Coordinator.
 *  - addresses an order to the right members ("luna, ...", "lobos, ...", "todos, ...")
 *  - splits work by specialty: each member gets its own task; big gather orders are divided;
 *    a build gets a builder plus helpers who bring materials
 *  - a squad of one does everything alone
 *  - members help each other (combat, material delivery) and chat between themselves
 */
import { Entity, Player, system } from "@minecraft/server";
import type { Agent } from "./agent";
import { AnimState, isPersona } from "../core/constants";
import { dist, safe } from "../core/mc";
import type { Intent, Task } from "../core/types";
import { BEAST_TASKS, SPECIALTY } from "../core/species";
import { interpret } from "../nlu/interpreter";
import { plan as makePlan, type Plan } from "../planner/planner";
import { isOwner } from "../authorization/owner_auth";
import { actionBar, say, sayKey } from "../communication/comms";
import { BANTER, HELP_TEXT } from "../communication/phrases";
import { addressees, agents, dismiss, executorOf, squadIndex, squadOf } from "./agent_manager";
import { answerQuery, bindCommandContext, setMode, statusText } from "./brain";
import { requestExternalPlan } from "./llm_bridge";
import { STATE_PT } from "../state/state_machine";
import { magicBolt } from "../combat/combat";

export interface DispatchOptions {
  fromMenu?: boolean;
  askForm?: (a: Agent, question: string, options: { label: string; text: string }[]) => void;
  members?: Agent[]; // explicit addressees (menus); otherwise parsed from the text
}

/** Entry point for every order. Authorization FIRST: only the owner's own squad is touched. */
export function dispatchOrder(owner: Player, text: string, opts: DispatchOptions = {}): void {
  const clean = text.trim().slice(0, 240);
  if (!clean) return;
  let members: Agent[];
  let rest = clean;
  if (opts.members) members = opts.members.filter((m) => isOwner(owner, m) && m.record.active);
  else {
    const ad = addressees(owner.id, clean);
    members = ad.members;
    rest = ad.rest || clean;
  }
  if (!members.length) {
    safe(() => owner.sendMessage("§7Nenhuma sombra ativa. Use o §dSelo das Dez Sombras§7 ou §f/sombra invocar luna§7."), undefined);
    return;
  }
  const lead = pickSpeaker(members);
  const res = interpret(rest);
  if (res.clarification) {
    lead.rt.clarification = res.clarification;
    say(lead, res.clarification.question, { force: true });
    if (opts.askForm) opts.askForm(lead, res.clarification.question, res.clarification.options);
    if (!res.intents.length) return;
  }
  if (!res.understood || (res.intents.length === 1 && res.intents[0].kind === "unknown")) {
    if (requestExternalPlan(lead, rest, (intents, reply) => applyToMembers(owner, members, intents, false, reply))) {
      actionBar(lead, "pensando...");
      return;
    }
    sayKey(lead, "unknown", undefined, { force: true });
    return;
  }
  applyToMembers(owner, members, res.intents, res.append);
}

function pickSpeaker(members: Agent[]): Agent {
  return members.find((m) => !m.isBeast) ?? members[0];
}

export function applyToMembers(owner: Player, membersIn: Agent[], intents: Intent[], append: boolean, reply?: string): void {
  const members = membersIn.filter((m) => isOwner(owner, m));
  if (!members.length) return;
  const lead = pickSpeaker(members);
  if (reply) say(lead, reply, { force: true });
  const p = makePlan(intents);

  for (const c of p.control) {
    for (const a of members) {
      const ex = executorOf(a);
      if (c === "cancel") {
        ex.cancelAll();
        a.record.pausedByOwner = false;
      } else if (c === "pause") {
        a.record.pausedByOwner = true;
        ex.interrupt();
      } else if (c === "resume") a.record.pausedByOwner = false;
      else if (c === "dismiss") dismiss(a, members.length > 3 && a !== lead);
      a.markDirty();
    }
    if (c === "cancel" && !p.tasks.length) sayKey(lead, "cancel", undefined, { force: true });
    if (c === "pause") say(lead, members.length > 1 ? "Todas pausadas. Diga 'continua' quando quiser." : "Pausado. Diga 'continua' quando quiser.", { force: true });
    if (c === "resume") say(lead, "Retomando o trabalho!", { force: true });
    if (c === "dismiss") return;
  }

  if (p.mode) {
    members.forEach((a, i) => {
      setModeQuiet(a, owner, p.mode!, i < 2);
      if (!p.tasks.length && a.record.queue.length && !append) executorOf(a).cancelAll();
    });
  }

  if (p.tasks.length) assignAndQueue(owner, members, p, intents, append);

  for (const q of p.queries) answerSquadQuery(members, q);
}

function setModeQuiet(a: Agent, owner: Player, mode: Agent["record"]["mode"], speak: boolean): void {
  if (speak) setMode(a, owner, mode);
  else {
    a.record.mode = mode;
    if (mode === "guard") {
      const l = owner.location;
      a.record.guardPos = { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z), dim: owner.dimension.id };
    }
    a.markDirty();
  }
}

// ---------------------------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------------------------
const SPLITTABLE: Task["kind"][] = ["gather_wood", "gather_food", "mine", "hunt", "farm"];

export function canDo(a: Agent, t: Task): boolean {
  if (a.isBeast) return BEAST_TASKS.includes(t.kind);
  return true;
}

function score(a: Agent, t: Task, load: Map<Agent, number>): number {
  const spec = isPersona(a.persona) ? SPECIALTY[a.persona][t.kind] ?? 1 : t.kind === "attack" || t.kind === "hunt" ? 3 : 0;
  return spec - (load.get(a) ?? 0) * 1.2 - (a.record.queue.length ? 0.5 : 0);
}

function cloneTask(t: Task, count: number, suffix: string): Task {
  const c: Task = JSON.parse(JSON.stringify(t));
  c.id = t.id + suffix;
  c.goal.count = count;
  c.progress = { done: 0, total: count };
  c.label = t.label.replace(/\d+/, String(count));
  return c;
}

/** Pure assignment (exported for tests): which member gets which task. */
export function assign(members: Agent[], tasks: Task[]): { by: Map<Agent, Task[]>; refused: Task[] } {
  const by = new Map<Agent, Task[]>();
  const load = new Map<Agent, number>();
  const refused: Task[] = [];
  const give = (a: Agent, t: Task) => {
    by.set(a, [...(by.get(a) ?? []), t]);
    load.set(a, (load.get(a) ?? 0) + 1);
  };
  for (const t of tasks) {
    const cands = members.filter((m) => canDo(m, t));
    if (!cands.length) {
      refused.push(t);
      continue;
    }
    cands.sort((x, y) => score(y, t, load) - score(x, t, load));
    const count = t.goal.count ?? 1;
    if (t.kind === "attack") {
      // everyone able to fight goes for the target
      const fighters = cands.filter((m) => m.isBeast || score(m, t, load) >= 2);
      (fighters.length ? fighters : [cands[0]]).forEach((m, i) => give(m, i ? cloneTask(t, count, `-${i}`) : t));
      continue;
    }
    if (SPLITTABLE.includes(t.kind) && cands.length > 1 && count >= 4 && !t.data.treePos) {
      const k = Math.min(cands.length, Math.ceil(count / 4), 6);
      const base = Math.floor(count / k);
      let extra = count - base * k;
      for (let i = 0; i < k; i++) {
        const share = base + (extra-- > 0 ? 1 : 0);
        give(cands[i], i === 0 ? cloneTask(t, share, "") : cloneTask(t, share, `-${i}`));
      }
      continue;
    }
    if (t.kind === "build") {
      const builder = cands[0];
      t.data.helpers = cands.slice(1).filter((m) => !m.isBeast).slice(0, 4).map((m) => m.key);
      give(builder, t);
      continue;
    }
    give(cands[0], t);
  }
  return { by, refused };
}

function assignAndQueue(owner: Player, members: Agent[], p: Plan, intents: Intent[], append: boolean): void {
  const { by, refused } = assign(members, p.tasks);
  if (refused.length) {
    const lead = pickSpeaker(members);
    say(lead, `Criaturas não sabem ${refused.map((t) => t.label).join(", ")}. Invoque uma companheira para isso.`, { force: true });
  }
  let spoken = 0;
  for (const [a, tasks] of by) {
    for (const t of tasks) {
      const err = bindCommandContext(a, owner, t, intents);
      if (err) {
        say(a, err, { force: true });
        return;
      }
    }
    const ex = executorOf(a);
    if (append) a.record.queue.push(...tasks);
    else {
      if (a.record.queue.length) ex.cancelAll();
      a.record.queue = tasks;
      a.record.pausedByOwner = false;
    }
    a.record.queue = a.record.queue.slice(0, 10);
    a.markDirty();
    if (spoken++ < 4) {
      const list = tasks.map((t) => t.label).join(" + ");
      if (a.isBeast) sayKey(a, "ack");
      else say(a, `${ackWord(a)} ${append ? "Na fila: " : ""}${list}`, { force: true });
    }
    if (p.urgent) a.setAnim(AnimState.Run, 300);
  }
}

function ackWord(a: Agent): string {
  return { luna: "Deixa comigo!", raven: "Entendido.", sora: "Tá, eu faço.", yuki: "Pode deixar.", hana: "Já vou!", aiko: "Anotado!" }[a.persona] ?? "Entendido!";
}

function answerSquadQuery(members: Agent[], q: string): void {
  if (members.length === 1) {
    answerQuery(members[0], q);
    return;
  }
  const lead = pickSpeaker(members);
  if (q === "status" || q === "progress" || q === "why") {
    const lines = members.map((a) => {
      const t = a.record.queue[0];
      const h = a.health();
      const what = t ? `${t.label} (${t.progress.done}/${t.progress.total})` : STATE_PT[a.sm.state];
      const why = q === "why" && a.rt.lastWhy ? ` - ${a.rt.lastWhy}` : "";
      return `${a.color().tag}${a.name}§r: ${a.record.dead ? "ressurgindo" : what} ♥${Math.round(h.cur)}${why}`;
    });
    say(lead, "\n" + lines.join("\n"), { force: true });
    return;
  }
  if (q === "inventory") {
    for (const a of members.filter((m) => !m.isBeast)) answerQuery(a, "inventory");
    return;
  }
  if (q === "help") {
    say(lead, "\n" + HELP_TEXT, { force: true });
    return;
  }
  members.slice(0, 2).forEach((a) => answerQuery(a, q));
}

export function squadStatus(ownerId: string): string {
  const m = squadOf(ownerId, true);
  if (!m.length) return "Nenhuma sombra ativa.";
  if (m.length === 1) return statusText(m[0]);
  return m
    .map((a) => {
      const t = a.record.queue[0];
      return `${a.color().tag}${a.name}§r - ${a.record.dead ? "ressurgindo" : t ? t.label : STATE_PT[a.sm.state]}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------------------------
// Helping each other
// ---------------------------------------------------------------------------------------------

/** Called when a squad member is hurt by a mob: nearby idle members come to help. */
export function rallyTo(victim: Agent, attacker: Entity): void {
  const vb = victim.body();
  if (!vb) return;
  for (const a of squadOf(victim.record.ownerId, true)) {
    if (a === victim || a.record.dead) continue;
    const b = a.body();
    if (!b || b.dimension.id !== vb.dimension.id || dist(b.location, vb.location) > 24) continue;
    const busy = a.record.queue.length && ["build", "cook", "craft"].includes(a.record.queue[0].kind);
    if (busy) continue;
    a.rt.protectUntil = Date.now() + 4000;
    a.rt.threatId = attacker.id;
    if (executorOf(a).running()) executorOf(a).interrupt();
    a.setNativeMode("follow");
    magicBolt(a, attacker);
  }
}

/** Material hand-off between members: the target receives items into its logical inventory. */
export function handOff(from: Agent, toKey: string, pred: (id: string) => boolean, max: number): { n: number; to?: Agent } {
  const to = agents.get(toKey);
  if (!to || !to.record.active) return { n: 0 };
  let moved = 0;
  for (const s of [...from.inv.slots]) {
    if (moved >= max) break;
    if (!pred(s.id)) continue;
    const want = Math.min(s.n, max - moved, to.inv.roomFor(s.id));
    if (want <= 0) continue;
    const pieces = from.inv.remove((x) => x === s, want);
    for (const p of pieces) {
      const left = to.inv.add(p);
      if (left > 0) from.inv.add({ ...p, n: left }); // never lose anything
      moved += p.n - left;
    }
  }
  from.markDirty();
  to.markDirty();
  return { n: moved, to };
}

// ---------------------------------------------------------------------------------------------
// Social life: short conversations between companions while idle
// ---------------------------------------------------------------------------------------------
const lastChat = new Map<string, number>();

export function socialTick(): void {
  const owners = new Set<string>();
  for (const a of agents.values()) if (a.record.active) owners.add(a.record.ownerId);
  for (const ownerId of owners) {
    if (!squadIndex(ownerId).settings.chatter) continue;
    if ((lastChat.get(ownerId) ?? 0) + 100000 > Date.now()) continue;
    if (Math.random() > 0.25) continue;
    const idle = squadOf(ownerId, true).filter((a) => !a.isBeast && !a.record.dead && !a.record.queue.length && a.body() && a.owner());
    if (idle.length < 2) continue;
    const A = idle[Math.floor(Math.random() * idle.length)];
    const others = idle.filter((x) => x !== A && dist(x.body()!.location, A.body()!.location) < 10);
    if (!others.length) continue;
    const B = others[Math.floor(Math.random() * others.length)];
    const [l1, l2] = BANTER[Math.floor(Math.random() * BANTER.length)];
    lastChat.set(ownerId, Date.now());
    const ab = A.body()!;
    const bb = B.body()!;
    safe(() => ab.teleport(ab.location, { facingLocation: { x: bb.location.x, y: bb.location.y + 1.6, z: bb.location.z } }), undefined);
    safe(() => bb.teleport(bb.location, { facingLocation: { x: ab.location.x, y: ab.location.y + 1.6, z: ab.location.z } }), undefined);
    A.setAnim(AnimState.Wave, 1200);
    say(A, l1.replace(/\{A\}/g, A.name).replace(/\{B\}/g, B.name), { force: false, key: "banter" });
    system.runTimeout(() => {
      if (!B.body()) return;
      B.setAnim(AnimState.Wave, 1000);
      say(B, l2.replace(/\{A\}/g, A.name).replace(/\{B\}/g, B.name), { force: false, key: "banter" });
    }, 50);
  }
}
