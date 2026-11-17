/**
 * Action Executor + Recovery System.
 *  - drives the current task's generator over time (wait / move / tick yields)
 *  - watchdog: a step that does not progress for too long is aborted
 *  - errors are caught; a task gets a limited number of attempts with an alternative
 *    strategy, then fails with an honest reason (never "done" without verification)
 *  - interrupt() drops the generator; the task restarts later from persisted progress
 */
import type { Agent } from "../ai/agent";
import { AnimState, Mood, TUNING } from "../core/constants";
import { log } from "../core/mc";
import type { Task } from "../core/types";
import { say, sayKey, setMood } from "../communication/comms";
import { pushHistory } from "../memory/memory_manager";
import { STEP_PT } from "../planner/planner";
import type { Tick } from "../perception/perception";
import type { R } from "./routines";
import { RUNNERS, type Outcome } from "./tasks";

export class Executor {
  private gen?: R<Outcome>;
  private genTaskId?: string;
  private waitTicks = 0;
  private waitingMove = false;
  private lastStep = -1;
  private stepSince = 0;
  private errors = 0;

  constructor(private readonly a: Agent) {}

  current(): Task | undefined {
    return this.a.record.queue[0];
  }

  running(): boolean {
    return !!this.gen;
  }

  /** Called every brain tick (TUNING.brainIntervalTicks game ticks). */
  tick(dt: number): void {
    const a = this.a;
    const t = this.current();
    if (!t) return;
    if (a.record.pausedByOwner) return;
    if (!this.gen || this.genTaskId !== t.id) this.start(t);
    if (!this.gen) return;
    // watchdog
    if (t.stepIndex !== this.lastStep) {
      this.lastStep = t.stepIndex;
      this.stepSince = 0;
    } else {
      this.stepSince += dt;
      if (this.stepSince > TUNING.stepTimeoutTicks) {
        this.finish(t, { ok: false, reason: `a etapa "${STEP_PT[t.steps[t.stepIndex]] ?? "?"}" travou`, retry: true });
        return;
      }
    }
    if (this.waitTicks > 0) {
      this.waitTicks -= dt;
      if (this.waitTicks > 0) return;
    }
    if (this.waitingMove) {
      const s = a.mover.status;
      if (s === "planning" || s === "moving") return;
      this.waitingMove = false;
    }
    for (let i = 0; i < 6; i++) {
      let r: IteratorResult<Tick, Outcome>;
      try {
        r = this.gen.next();
      } catch (e) {
        log("task error", t.kind, String(e), (e as Error)?.stack ?? "");
        this.errors++;
        this.finish(t, { ok: false, reason: "tive um erro interno", retry: this.errors < 3 });
        return;
      }
      if (r.done) {
        this.finish(t, r.value);
        return;
      }
      const y = r.value;
      if (y.t === "wait") {
        this.waitTicks = y.ticks;
        return;
      }
      if (y.t === "move") {
        this.waitingMove = true;
        return;
      }
      // "tick": keep going a little within this brain tick if cheap, else yield
      if (i >= 2) return;
    }
  }

  private start(t: Task): void {
    const a = this.a;
    this.gen = RUNNERS[t.kind](a, t);
    this.genTaskId = t.id;
    this.waitTicks = 0;
    this.waitingMove = false;
    this.lastStep = -1;
    if (t.state !== "running") {
      t.state = "running";
      a.markDirty();
    }
  }

  /** Stop the generator but keep the task (it restarts from persisted progress). */
  interrupt(): void {
    if (this.gen) {
      try {
        this.gen.return({ ok: false, reason: "interrompida" });
      } catch {
        /* ignore */
      }
    }
    this.gen = undefined;
    this.genTaskId = undefined;
    this.waitTicks = 0;
    this.waitingMove = false;
    this.a.mover.stop();
    this.a.setWorkAnim(AnimState.Idle);
  }

  cancelAll(): number {
    this.interrupt();
    const n = this.a.record.queue.length;
    for (const t of this.a.record.queue) t.state = "cancelled";
    this.a.record.queue = [];
    this.a.markDirty();
    return n;
  }

  private finish(t: Task, out: Outcome): void {
    const a = this.a;
    this.gen = undefined;
    this.genTaskId = undefined;
    a.mover.stop();
    a.setWorkAnim(AnimState.Idle);
    if (out.ok) {
      t.state = "done";
      this.errors = 0;
      a.record.queue.shift();
      if (out.followUp?.length) a.record.queue.unshift(...out.followUp);
      pushHistory(a.record, `✔ ${t.label}`);
      if (out.msg) say(a, out.msg, { key: "done" + t.id, force: true });
      setMood(a.body(), Mood.Happy, 3000);
    } else if (out.retry && t.attempts + 1 < t.maxAttempts) {
      t.attempts++;
      t.strategy++;
      t.state = "pending";
      a.rt.lastWhy = out.reason;
      say(a, `Tive um problema (${out.reason}). Tentando de novo (${t.attempts + 1}/${t.maxAttempts})...`, { key: "retry", throttleMs: 4000 });
      this.waitTicks = 40;
    } else {
      t.state = "failed";
      t.failReason = out.reason;
      a.record.lastFailure = `${t.label}: ${out.reason}`;
      a.rt.lastWhy = out.reason;
      a.record.queue.shift();
      pushHistory(a.record, `✖ ${t.label}: ${out.reason}`);
      sayKey(a, "fail", out.reason, { force: true });
    }
    a.markDirty();
    if (!a.record.queue.length) a.setAnim(AnimState.Idle);
  }
}
