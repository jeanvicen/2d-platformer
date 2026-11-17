/**
 * State machine. The brain computes the desired state every decision tick from clear
 * priorities; transitions are logged and drive animation/mode changes.
 *
 * Priorities (highest first):
 *  1. PROTECTING  - a threat to the owner's life
 *  2. owner orders marked urgent (handled when the order arrives: queue replaced)
 *  3. RECOVERING / EATING - the shadow's own basic needs
 *  4. task states (GATHERING, MINING, ...) - the active task
 *  5. FOLLOWING / GUARDING / IDLE - default behaviour when there is no task
 */
import type { TaskKind } from "../core/types";

export type AgentState =
  | "IDLE"
  | "FOLLOWING"
  | "GUARDING"
  | "PROTECTING"
  | "GATHERING"
  | "MINING"
  | "FARMING"
  | "CRAFTING"
  | "COOKING"
  | "BUILDING"
  | "EXPLORING"
  | "RETURNING"
  | "DELIVERING"
  | "EATING"
  | "RECOVERING"
  | "FIGHTING"
  | "DEAD"
  | "DISMISSED";

export const STATE_PT: Record<AgentState, string> = {
  IDLE: "parada",
  FOLLOWING: "seguindo você",
  GUARDING: "de guarda",
  PROTECTING: "protegendo você",
  GATHERING: "coletando",
  MINING: "minerando",
  FARMING: "colhendo",
  CRAFTING: "fabricando",
  COOKING: "cozinhando",
  BUILDING: "construindo",
  EXPLORING: "procurando",
  RETURNING: "voltando",
  DELIVERING: "entregando",
  EATING: "comendo",
  RECOVERING: "se recuperando",
  FIGHTING: "lutando",
  DEAD: "nas sombras (ressurgindo)",
  DISMISSED: "dispensada",
};

export function stateForStep(kind: TaskKind, step: string): AgentState {
  if (step === "return") return "RETURNING";
  if (step === "deliver") return "DELIVERING";
  if (step === "find_target" || step === "find_station") return "EXPLORING";
  switch (kind) {
    case "gather_wood":
    case "gather_food":
    case "hunt":
      return "GATHERING";
    case "mine":
    case "destroy":
      return "MINING";
    case "farm":
      return "FARMING";
    case "craft":
    case "equip":
      return "CRAFTING";
    case "cook":
      return "COOKING";
    case "build":
      return "BUILDING";
    case "attack":
      return "FIGHTING";
    case "eat":
      return "EATING";
    case "deliver":
      return "DELIVERING";
    case "return":
      return "RETURNING";
  }
}

export class StateMachine {
  state: AgentState = "IDLE";
  since = Date.now();
  private listeners: ((from: AgentState, to: AgentState) => void)[] = [];

  onChange(fn: (from: AgentState, to: AgentState) => void): void {
    this.listeners.push(fn);
  }

  set(to: AgentState): void {
    if (to === this.state) return;
    const from = this.state;
    this.state = to;
    this.since = Date.now();
    for (const l of this.listeners) l(from, to);
  }

  /** milliseconds in the current state (used by the watchdog) */
  age(): number {
    return Date.now() - this.since;
  }
}
