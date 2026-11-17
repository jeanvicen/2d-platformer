/**
 * OPTIONAL generative-AI layer (offline-first).
 *
 * The add-on itself never makes network calls: phones and Windows clients cannot use
 * @minecraft/server-net (it only exists on Bedrock Dedicated Server). When a separate
 * "bridge" behavior pack runs on a BDS, it announces itself with a script event and relays
 * requests to the backend in optional/llm-backend. Messages travel as script events:
 *
 *   addon  -> bridge : shadowbound:llm_request  {id, text, persona, state}
 *   bridge -> addon  : shadowbound:llm_response {id, plan}   (plan validated locally)
 *   bridge -> addon  : shadowbound:bridge_ready
 *
 * Without the bridge (or with the setting off) everything works with the local interpreter.
 */
import { system } from "@minecraft/server";
import type { Agent } from "./agent";
import type { Intent } from "../core/types";
import { validateExternalPlan } from "./plan_schema";
import { log, safe } from "../core/mc";
import { say } from "../communication/comms";

let bridgeSeenAt = 0;
let seq = 0;
const pending = new Map<string, { a: Agent; done: (intents: Intent[], reply?: string) => void; at: number }>();
const lastCall = new Map<string, number>();

export function bridgeAvailable(): boolean {
  return Date.now() - bridgeSeenAt < 120000;
}

export function requestExternalPlan(a: Agent, text: string, done: (intents: Intent[], reply?: string) => void): boolean {
  if (!a.record.settings.externalAI || !bridgeAvailable()) return false;
  const now = Date.now();
  if ((lastCall.get(a.record.ownerId) ?? 0) + 4000 > now) return false; // rate limit
  lastCall.set(a.record.ownerId, now);
  const id = `${a.record.ownerId.slice(-6)}-${seq++}`;
  const t = a.record.queue[0];
  const payload = JSON.stringify({
    id,
    text: text.slice(0, 200),
    persona: a.persona,
    state: {
      mode: a.record.mode,
      task: t ? t.label : null,
      hunger: Math.round(a.record.needs.hunger),
      inventory: a.inv.summary().slice(0, 8).map((s) => `${s.n} ${s.id.replace("minecraft:", "")}`),
    },
  });
  if (payload.length > 1800) return false;
  pending.set(id, { a, done, at: now });
  safe(() => system.sendScriptEvent("shadowbound:llm_request", payload), undefined, "sendScriptEvent");
  system.runTimeout(() => {
    if (pending.has(id)) {
      pending.delete(id);
      say(a, "A IA externa não respondeu. Usei só meu entendimento local: não entendi a ordem.", { force: true });
    }
  }, 200);
  return true;
}

export function onScriptEvent(id: string, message: string): void {
  if (id === "shadowbound:bridge_ready") {
    bridgeSeenAt = Date.now();
    return;
  }
  if (id !== "shadowbound:llm_response") return;
  let msg: { id?: string; plan?: unknown };
  try {
    msg = JSON.parse(message);
  } catch {
    return;
  }
  if (!msg.id || !pending.has(msg.id)) return;
  const p = pending.get(msg.id)!;
  pending.delete(msg.id);
  const v = validateExternalPlan(typeof msg.plan === "string" ? msg.plan : JSON.stringify(msg.plan ?? {}));
  if (!v.ok) {
    log("rejected external plan:", v.error);
    say(p.a, "Recebi um plano inválido da IA externa e ignorei por segurança.", { force: true });
    return;
  }
  if (v.plan.clarify) say(p.a, v.plan.clarify, { force: true });
  p.done(v.plan.intents, v.plan.reply || undefined);
}
