/**
 * Material planning for blueprints. Pure module.
 * role -> material, total needs, and the raw shortfall (logs, cobblestone, coal) after
 * counting what can be crafted from what the builder already has.
 */
import type { MaterialKind } from "../core/types";
import type { Blueprint, BlockRole, Placement } from "./blueprints";

export type MatKey = "planks" | "log" | "cobblestone" | "fence" | "door" | "torch" | "crafting_table" | "chest" | "ladder";

export function roleMat(role: BlockRole, pref: MaterialKind): MatKey | null {
  const main: MatKey = pref === "cobblestone" || pref === "stone" ? "cobblestone" : pref === "log" ? "log" : "planks";
  switch (role) {
    case "main":
    case "wall":
      return main;
    case "foundation":
      return pref === "planks" ? "planks" : "cobblestone";
    case "floor":
    case "roof":
      return "planks";
    case "frame":
      return "log";
    case "window":
    case "fence":
      return "fence";
    case "door_lower":
      return "door";
    case "door_upper":
      return null;
    case "torch":
      return "torch";
    case "table":
      return "crafting_table";
    case "chest":
      return "chest";
    case "ladder":
      return "ladder";
  }
}

export function countNeeds(placements: Placement[], pref: MaterialKind): Record<MatKey, number> {
  const n: Record<MatKey, number> = { planks: 0, log: 0, cobblestone: 0, fence: 0, door: 0, torch: 0, crafting_table: 0, chest: 0, ladder: 0 };
  for (const p of placements) {
    const m = roleMat(p.role, pref);
    if (m) n[m]++;
  }
  return n;
}

export interface Have {
  planks: number;
  log: number;
  cobblestone: number;
  coal: number;
  stick: number;
  fence: number;
  door: number;
  torch: number;
  crafting_table: number;
  chest: number;
  ladder: number;
}

export interface Shortfall {
  logs: number;
  cobblestone: number;
  coal: number;
  planksTotal: number; // planks needed including the ones for crafted parts
  crafts: { fence: number; door: number; torch: number; crafting_table: number; chest: number; ladder: number; stick: number };
}

export function shortfall(need: Record<MatKey, number>, have: Have, wantTorches = true): Shortfall {
  const fence = Math.ceil(Math.max(0, need.fence - have.fence) / 3);
  const door = Math.ceil(Math.max(0, need.door - have.door) / 3);
  const torch = wantTorches ? Math.ceil(Math.max(0, need.torch - have.torch) / 4) : 0;
  const table = Math.max(0, need.crafting_table - have.crafting_table);
  const chest = Math.max(0, need.chest - have.chest);
  const ladder = Math.ceil(Math.max(0, need.ladder - have.ladder) / 3);
  const sticksNeed = fence * 2 + torch + ladder * 7;
  const stick = Math.ceil(Math.max(0, sticksNeed - have.stick) / 4);
  const craftedPlanks = fence * 4 + door * 6 + table * 4 + chest * 8 + stick * 2;
  const stationBuffer = craftedPlanks > 0 || torch > 0 || ladder > 0 ? 4 : 0; // a table to craft the parts, if none is around
  const planksTotal = need.planks + craftedPlanks + stationBuffer;
  const planksShort = Math.max(0, planksTotal - have.planks);
  const logsNeeded = need.log + Math.ceil(planksShort / 4);
  return {
    logs: Math.max(0, logsNeeded - have.log),
    cobblestone: Math.max(0, need.cobblestone - have.cobblestone),
    coal: Math.max(0, torch - have.coal),
    planksTotal,
    crafts: { fence, door, torch, crafting_table: table, chest, ladder, stick },
  };
}

export function describeBlueprint(bp: Blueprint, pref: MaterialKind): string {
  const n = countNeeds(bp.placements, pref);
  const parts = Object.entries(n).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`);
  return `${bp.label}: ${bp.placements.length} blocos (${parts.join(", ")})`;
}
