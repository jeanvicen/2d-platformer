/**
 * Building blueprints. Pure module.
 * Coordinates are relative: x = right, y = up, z = forward (away from the owner).
 * The executor rotates them to the owner's facing direction.
 */
import type { MaterialKind, StructureKind } from "../core/types";

export type BlockRole =
  | "main"
  | "ladder"
  | "foundation"
  | "floor"
  | "frame"
  | "wall"
  | "roof"
  | "window"
  | "fence"
  | "door_lower"
  | "door_upper"
  | "torch"
  | "table"
  | "chest";

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

/** Stepped hip roof made of rings, closing with a ridge. */
function roof(out: Placement[], x0: number, x1: number, z0: number, z1: number, y: number): void {
  let k = 0;
  for (;;) {
    const ax = x0 + k;
    const bx = x1 - k;
    const az = z0 + k;
    const bz = z1 - k;
    if (ax > bx || az > bz) break;
    for (let x = ax; x <= bx; x++) {
      for (let z = az; z <= bz; z++) {
        const ring = x === ax || x === bx || z === az || z === bz;
        if (ring) out.push(P(x, y + k, z, "roof"));
      }
    }
    if (bx - ax <= 1 || bz - az <= 1) break;
    k++;
  }
}

function box(out: Placement[], x0: number, x1: number, z0: number, z1: number, yBase: number, height: number, isWindow: (x: number, y: number, z: number) => boolean, isGap: (x: number, y: number, z: number) => boolean): void {
  for (let y = yBase; y < yBase + height; y++) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!edge) continue;
        const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
        if (corner) out.push(P(x, y, z, "frame"));
        else if (isGap(x, y, z)) continue;
        else if (isWindow(x, y, z)) out.push(P(x, y, z, "window"));
        else out.push(P(x, y, z, "wall"));
      }
    }
  }
}

/** Big house: 9x7, stone foundation, log frame, plank walls, windows, door, ceiling, stepped roof, furniture. */
function bigHouse(): Blueprint {
  const out: Placement[] = [];
  const X0 = -4;
  const X1 = 4;
  const Z0 = 0;
  const Z1 = 6;
  const H = 4;
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) out.push(P(x, -1, z, "foundation"));
  for (let x = X0; x <= X1; x++) {
    for (let z = Z0; z <= Z1; z++) {
      const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
      out.push(P(x, 0, z, edge ? "foundation" : "floor"));
    }
  }
  out.push(P(0, 0, -1, "foundation")); // front step
  const win = (x: number, y: number, z: number) =>
    (y === 2 || y === 3) && (((z === Z0 || z === Z1) && Math.abs(x) === 2) || ((x === X0 || x === X1) && (z === 2 || z === 4)));
  const gap = (x: number, y: number, z: number) => z === Z0 && x === 0 && (y === 1 || y === 2);
  box(out, X0, X1, Z0, Z1, 1, H, win, gap);
  out.push(P(0, 1, Z0, "door_lower"), P(0, 2, Z0, "door_upper"));
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
    out.push(P(x, H + 1, z, edge ? "frame" : "floor")); // beam + ceiling
  }
  roof(out, X0 - 1, X1 + 1, Z0 - 1, Z1 + 1, H + 2);
  out.push(P(X0 + 1, 1, Z0 + 1, "torch"), P(X1 - 1, 1, Z0 + 1, "torch"), P(X1 - 1, 1, Z1 - 1, "torch"));
  out.push(P(X0 + 1, 1, Z1 - 1, "table"), P(X0 + 2, 1, Z1 - 1, "chest"));
  out.push(P(-2, 0, -1, "torch"), P(2, 0, -1, "torch"));
  return { kind: "house", label: "casa grande", placements: out, defaultMaterial: "planks" };
}

/** Mansion: 13x11, two floors, balcony with railing, inner ladder, stepped roof, furniture on both floors. */
function mansion(): Blueprint {
  const out: Placement[] = [];
  const X0 = -6;
  const X1 = 6;
  const Z0 = 0;
  const Z1 = 10;
  const H = 4; // each floor
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) out.push(P(x, -1, z, "foundation"));
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
    out.push(P(x, 0, z, edge ? "foundation" : "floor"));
  }
  out.push(P(0, 0, -1, "foundation"), P(-1, 0, -1, "foundation"), P(1, 0, -1, "foundation"));
  const ladderX = X1 - 1;
  const ladderZ = Z1 - 1;
  const winAt = (x: number, y: number, z: number, y1: number) =>
    (y === y1 || y === y1 + 1) && (((z === Z0 || z === Z1) && x !== 0 && x % 3 === 0) || ((x === X0 || x === X1) && z % 3 === 0 && z !== Z0 && z !== Z1));
  // pillars every 4 blocks on the facades (logs, full height)
  const pillar = (x: number, z: number) => (z === Z0 || z === Z1) && Math.abs(x) === 2;
  const gap1 = (x: number, y: number, z: number) => (z === Z0 && x === 0 && (y === 1 || y === 2)) || pillar(x, z);
  box(out, X0, X1, Z0, Z1, 1, H, (x, y, z) => winAt(x, y, z, 2), gap1);
  out.push(P(0, 1, Z0, "door_lower"), P(0, 2, Z0, "door_upper"));
  // second floor slab (hole for the ladder)
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
    if (x === ladderX && z === ladderZ) continue;
    out.push(P(x, H + 1, z, edge ? "frame" : "floor"));
  }
  const gap2 = (x: number, y: number, z: number) => (z === Z0 && x === 0 && (y === H + 2 || y === H + 3)) || pillar(x, z);
  box(out, X0, X1, Z0, Z1, H + 2, H, (x, y, z) => winAt(x, y, z, H + 3), gap2);
  for (let y = 1; y <= 2 * H + 1; y++) for (const x of [-2, 2]) for (const z of [Z0, Z1]) out.push(P(x, y, z, "frame"));
  for (let y = 1; y <= H + 1; y++) out.push(P(ladderX, y, ladderZ, "ladder"));
  // balcony over the entrance
  for (let x = -3; x <= 3; x++) for (const z of [-1, -2]) out.push(P(x, H + 1, z, "floor"));
  for (const x of [-3, 3]) for (let y = 1; y <= H; y++) out.push(P(x, y, -2, "frame"));
  for (let x = -3; x <= 3; x++) out.push(P(x, H + 2, -2, "fence"));
  for (const x of [-3, 3]) out.push(P(x, H + 2, -1, "fence"));
  // top beam + ceiling
  for (let x = X0; x <= X1; x++) for (let z = Z0; z <= Z1; z++) {
    const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
    out.push(P(x, 2 * H + 2, z, edge ? "frame" : "floor"));
  }
  roof(out, X0 - 1, X1 + 1, Z0 - 1, Z1 + 1, 2 * H + 3);
  // furniture and lights
  for (const y of [1, H + 2]) {
    out.push(P(X0 + 1, y, Z0 + 1, "torch"), P(X1 - 1, y, Z0 + 1, "torch"), P(X0 + 1, y, Z1 - 1, "torch"));
  }
  out.push(P(X0 + 2, 1, Z1 - 1, "table"), P(X0 + 3, 1, Z1 - 1, "chest"), P(X0 + 4, 1, Z1 - 1, "chest"));
  out.push(P(X1 - 2, H + 2, Z0 + 1, "chest"));
  out.push(P(-2, 0, -3, "torch"), P(2, 0, -3, "torch"));
  return { kind: "mansion", label: "mansão", placements: out, defaultMaterial: "planks" };
}

export function makeBlueprint(kind: StructureKind, size?: number): Blueprint {
  switch (kind) {
    case "house":
      return bigHouse();
    case "mansion":
      return mansion();
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
