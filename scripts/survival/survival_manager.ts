/**
 * Survival Manager: runs once per second. Applies simulated hunger, health regen/drain,
 * and decides when the shadow must eat or recover (the brain acts on these flags).
 */
import type { Agent } from "../ai/agent";
import { TUNING } from "../core/constants";
import { safe } from "../core/mc";
import { exert, EXERTION, healthDelta } from "./needs";

export function survivalTick(a: Agent, seconds: number): void {
  const e = a.body();
  if (!e) return;
  const moving = a.mover.status === "moving";
  a.record.needs = exert(a.record.needs, (moving ? EXERTION.walkPerSecond : EXERTION.idlePerSecond) * seconds);
  const h = safe(() => e.getComponent("minecraft:health"), undefined);
  if (h) {
    const delta = healthDelta(a.record.needs) * seconds;
    if (delta > 0 && h.currentValue < h.effectiveMax) safe(() => h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + delta)), false);
    // starvation never kills: stops at 1 heart, like Normal difficulty
    if (delta < 0 && h.currentValue > 2) safe(() => h.setCurrentValue(Math.max(2, h.currentValue + delta)), false);
    a.record.health = h.currentValue;
  }
  a.markDirty();
}

export function healthRatio(a: Agent): number {
  const h = a.health();
  return h.max > 0 ? h.cur / h.max : 1;
}

export function needsRecovery(a: Agent): boolean {
  return healthRatio(a) < TUNING.healthRecoverRatio;
}

export function recovered(a: Agent): boolean {
  return healthRatio(a) >= TUNING.healthResumeRatio;
}
