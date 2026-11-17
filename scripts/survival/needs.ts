/**
 * Simulated needs (the companion is an NPC, not a player, so hunger is implemented here).
 * Pure module: the Survival Manager calls these with real data.
 */
import { TUNING } from "../core/constants";
import type { Needs, StoredItem } from "../core/types";
import { FOODS, RARE_ITEMS } from "../inventory/item_catalog";

export function freshNeeds(): Needs {
  return { hunger: TUNING.maxHunger, saturation: 5, exhaustion: 0 };
}

/** Adds exhaustion (like the player: 4 exhaustion = -1 saturation, then -1 hunger). */
export function exert(n: Needs, amount: number): Needs {
  const out = { ...n, exhaustion: n.exhaustion + amount };
  while (out.exhaustion >= 4) {
    out.exhaustion -= 4;
    if (out.saturation > 0) out.saturation = Math.max(0, out.saturation - 1);
    else out.hunger = Math.max(0, out.hunger - 1);
  }
  return out;
}

export const EXERTION = {
  idlePerSecond: 0.02,
  walkPerSecond: 0.05,
  workPerAction: 0.12, // each block broken / placed
  attack: 0.1,
  hurt: 0.1,
};

export interface FoodChoice {
  id: string;
  food: number;
  sat: number;
}

/**
 * Picks what to eat. Rules:
 *  - never eat rare items (golden apples...) on her own
 *  - risky foods (rotten flesh, raw chicken, spider eye) only when starving
 *  - keep a reserve of `reserve` food items unless starving
 *  - prefer the food that fills the gap with the least waste, then cooked over raw
 */
export function chooseFood(inv: StoredItem[], needs: Needs, reserve: number): FoodChoice | undefined {
  const starving = needs.hunger <= TUNING.hungerStarving;
  const totalFood = inv.filter((s) => s.id in FOODS && !RARE_ITEMS.has(s.id)).reduce((a, b) => a + b.n, 0);
  if (!starving && totalFood <= reserve) return undefined;
  const gap = TUNING.maxHunger - needs.hunger;
  let best: { id: string; score: number } | undefined;
  for (const s of inv) {
    const f = FOODS[s.id];
    if (!f || RARE_ITEMS.has(s.id)) continue;
    if (f.risky && !starving) continue;
    const waste = Math.max(0, f.food - gap);
    const score = waste * 2 - f.sat * 0.5 + (f.raw ? 3 : 0) + (f.risky ? 10 : 0);
    if (!best || score < best.score) best = { id: s.id, score };
  }
  if (!best) return undefined;
  const f = FOODS[best.id];
  return { id: best.id, food: f.food, sat: f.sat };
}

export function eat(n: Needs, food: FoodChoice): Needs {
  const hunger = Math.min(TUNING.maxHunger, n.hunger + food.food);
  const saturation = Math.min(hunger, n.saturation + food.sat);
  return { hunger, saturation, exhaustion: n.exhaustion };
}

/** Health change per second from hunger: regen when well fed, damage when starving. */
export function healthDelta(n: Needs): number {
  if (n.hunger >= 18) return 0.25; // +1 HP every 4s
  if (n.hunger <= 0) return -0.25;
  return 0;
}

export function shouldEat(n: Needs, autoEat: boolean): boolean {
  return autoEat && n.hunger <= TUNING.hungerEatThreshold;
}
