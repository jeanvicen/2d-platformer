/**
 * Building blueprints. Pure module.
 * Coordinates are relative: x = right, y = up, z = forward (away from the owner).
 * The executor rotates them to the owner's facing direction.
 */
import type { MaterialKind, StructureKind } from "../core/types";

export type BlockRole = "main" | "ladder";

export interface Placement {
  x: number;
  y: number;
  z: number;
  role: BlockRole;
}

export interface Blueprint {
  kind: StructureKind;
  label: string;
  placements: Placement[]; // ordered bottom-up, safe to place in order
  defaultMaterial: MaterialKind;
}

const P = (x: number, y: number, z: number, role: BlockRole = "main"): Placement => ({ x, y, z, role });

function hut(): Blueprint {
  const out: Placement[] = [];
  const W = 5;
  const D = 5;
  const H = 3;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const edge = x === 0 || x === W - 1 || z === 0 || z === D - 1;
        if (!edge) continue;
        const door = z === 0 && x === 2 && y < 2; // doorway facing the owner
        const window = y === 1 && ((x === 0 || x === W - 1) && z === 2);
        if (door || window) continue;
        out.push(P(x - 2, y, z));
      }
    }
  }
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) out.push(P(x - 2, H, z)); // roof
  return { kind: "hut", label: "casinha", placements: out, defaultMaterial: "planks" };
}

function wall(len: number): Blueprint {
  const out: Placement[] = [];
  const L = Math.max(3, Math.min(16, len));
  for (let y = 0; y < 3; y++) for (let x = 0; x < L; x++) out.push(P(x - Math.floor(L / 2), y, 0));
  return { kind: "wall", label: "muro", placements: out, defaultMaterial: "cobblestone" };
}

function platform(size: number): Blueprint {
  const out: Placement[] = [];
  const S = Math.max(3, Math.min(9, size));
  for (let x = 0; x < S; x++) for (let z = 0; z < S; z++) out.push(P(x - Math.floor(S / 2), -1, z));
  return { kind: "platform", label: "plataforma", placements: out, defaultMaterial: "planks" };
}

function bridge(len: number): Blueprint {
  const out: Placement[] = [];
  const L = Math.max(3, Math.min(24, len));
  for (let z = 0; z < L; z++) for (let x = -1; x <= 1; x++) out.push(P(x, -1, z));
  return { kind: "bridge", label: "ponte", placements: out, defaultMaterial: "planks" };
}

function pillar(h: number): Blueprint {
  const out: Placement[] = [];
  const H = Math.max(2, Math.min(16, h));
  for (let y = 0; y < H; y++) out.push(P(0, y, 0));
  return { kind: "pillar", label: "pilar", placements: out, defaultMaterial: "cobblestone" };
}

function tower(h: number): Blueprint {
  const out: Placement[] = [];
  const H = Math.max(4, Math.min(12, h));
  for (let y = 0; y < H; y++) {
    for (let x = -1; x <= 1; x++) {
      for (let z = 0; z <= 2; z++) {
        const inner = x === 0 && z === 1;
        if (inner) {
          out.push(P(0, y, 1, "ladder")); // ladder on the inner face of the back wall
          continue;
        }
        if (z === 0 && x === 0 && y < 2) continue; // doorway
        out.push(P(x, y, z));
      }
    }
  }
  // top floor with a hatch over the ladder and battlements
  for (let x = -2; x <= 2; x++) {
    for (let z = -1; z <= 3; z++) {
      if (x === 0 && z === 1) continue;
      out.push(P(x, H, z));
    }
  }
  for (let x = -2; x <= 2; x++) {
    for (let z = -1; z <= 3; z++) {
      const edge = x === -2 || x === 2 || z === -1 || z === 3;
      if (edge && (x + z) % 2 === 0) out.push(P(x, H + 1, z));
    }
  }
  return { kind: "tower", label: "torre", placements: out, defaultMaterial: "cobblestone" };
}

export function makeBlueprint(kind: StructureKind, size?: number): Blueprint {
  switch (kind) {
    case "hut":
      return hut();
    case "wall":
      return wall(size ?? 7);
    case "platform":
      return platform(size ?? 5);
    case "bridge":
      return bridge(size ?? 8);
    case "pillar":
      return pillar(size ?? 5);
    case "tower":
      return tower(size ?? 7);
  }
}

export function countRoles(bp: Blueprint): { main: number; ladder: number } {
  let main = 0;
  let ladder = 0;
  for (const p of bp.placements) {
    if (p.role === "ladder") ladder++;
    else main++;
  }
  return { main, ladder };
}

/** Cardinal facing: 0 = +z (south), 1 = -x (west), 2 = -z (north), 3 = +x (east). */
export function rotate(p: { x: number; z: number }, facing: number): { x: number; z: number } {
  switch (((facing % 4) + 4) % 4) {
    case 0:
      return { x: -p.x, z: p.z };
    case 1:
      return { x: -p.z, z: -p.x };
    case 2:
      return { x: p.x, z: -p.z };
    default:
      return { x: p.z, z: p.x };
  }
}

/** Yaw (degrees, Minecraft convention: 0 = +z) to cardinal index used by rotate(). */
export function yawToFacing(yaw: number): number {
  const y = ((yaw % 360) + 360) % 360;
  if (y >= 315 || y < 45) return 0;
  if (y < 135) return 1;
  if (y < 225) return 2;
  return 3;
}

/** Bedrock ladder facing_direction (2 n, 3 s, 4 w, 5 e) so it hangs on the block behind it. */
export function ladderFacing(facing: number): number {
  // ladder attached to the back wall, facing back toward the doorway (the owner)
  return [2, 5, 3, 4][((facing % 4) + 4) % 4];
}
