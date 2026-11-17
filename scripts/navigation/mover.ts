/**
 * Navigation Manager.
 *  - Following the owner uses the engine's native follow_owner AI (smooth, handles doors).
 *  - Task movement uses our bounded A* (computed with system.runJob, spread over ticks) and
 *    a per-tick path follower. The path is re-validated while walking; blocked paths are
 *    re-planned a limited number of times, then the move fails with a reason.
 *  - Never enters unloaded chunks, never walks through solid blocks.
 */
import { Dimension, Entity, system } from "@minecraft/server";
import { TUNING } from "../core/constants";
import { getBlock, isDangerBlock, isPassableBlock, isSolidGround, isValid, safe } from "../core/mc";
import type { Vec3 } from "../core/types";
import { findPath, standable, type PathResult, type WorldProbe } from "./astar";

export function makeProbe(dim: Dimension): WorldProbe & { clear(): void } {
  const pass = new Map<string, boolean>();
  const sol = new Map<string, boolean>();
  const dan = new Map<string, boolean>();
  const k = (x: number, y: number, z: number) => `${x},${y},${z}`;
  return {
    passable(x, y, z) {
      const key = k(x, y, z);
      let r = pass.get(key);
      if (r === undefined) {
        r = isPassableBlock(getBlock(dim, { x, y, z }));
        pass.set(key, r);
      }
      return r;
    },
    solid(x, y, z) {
      const key = k(x, y, z);
      let r = sol.get(key);
      if (r === undefined) {
        r = isSolidGround(getBlock(dim, { x, y, z }));
        sol.set(key, r);
      }
      return r;
    },
    danger(x, y, z) {
      const key = k(x, y, z);
      let r = dan.get(key);
      if (r === undefined) {
        r = isDangerBlock(getBlock(dim, { x, y, z }));
        dan.set(key, r);
      }
      return r;
    },
    loaded(x, y, z) {
      return safe(() => dim.isChunkLoaded({ x, y, z }), false);
    },
    clear() {
      pass.clear();
      sol.clear();
      dan.clear();
    },
  };
}

export type MoveStatus = "idle" | "planning" | "moving" | "arrived" | "failed";

export interface MoveGoal {
  target: Vec3;
  isGoal: (c: Vec3) => boolean;
  run?: boolean;
  maxRadius?: number;
}

export class Mover {
  status: MoveStatus = "idle";
  failReason = "";
  private path: Vec3[] = [];
  private idx = 0;
  private goal?: MoveGoal;
  private job?: number;
  private replans = 0;
  private stuckTicks = 0;
  private lastPos?: Vec3;
  /** called when the follower starts/stops so the brain can set animations */
  onMoving: (moving: boolean, run: boolean) => void = () => undefined;

  constructor(private readonly body: () => Entity | undefined) {}

  start(goal: MoveGoal): void {
    this.stop();
    this.goal = goal;
    this.replans = 0;
    this.plan();
  }

  stop(): void {
    if (this.job !== undefined) {
      safe(() => system.clearJob(this.job!), undefined);
      this.job = undefined;
    }
    if (this.status === "moving") this.onMoving(false, false);
    this.status = "idle";
    this.path = [];
  }

  private plan(): void {
    const e = this.body();
    const goal = this.goal;
    if (!isValid(e) || !goal) {
      this.fail("corpo indisponível");
      return;
    }
    this.status = "planning";
    const dim = e.dimension;
    const probe = makeProbe(dim);
    const start = e.location;
    const gen = findPath(probe, start, {
      maxNodes: TUNING.maxPathNodes,
      maxRadius: goal.maxRadius ?? TUNING.maxSearchRadius + 8,
      isGoal: goal.isGoal,
      target: goal.target,
      batch: 80,
    });
    const self = this;
    function* wrapper(): Generator<void, void, void> {
      let r: IteratorResult<void, PathResult>;
      for (;;) {
        try {
          r = gen.next();
        } catch (err) {
          self.fail("erro no caminho");
          return;
        }
        if (r.done) break;
        yield;
      }
      self.job = undefined;
      const res = r.value;
      if (res.ok) {
        self.path = res.path;
        self.idx = 1;
        self.status = self.path.length <= 1 ? "arrived" : "moving";
        if (self.status === "moving") self.onMoving(true, !!goal!.run);
      } else {
        self.fail(
          res.reason === "start_blocked" ? "estou presa (sem chão firme)" : res.reason === "budget" ? "o caminho é longo ou complicado demais" : "não há caminho acessível",
        );
      }
    }
    this.job = system.runJob(wrapper());
  }

  private fail(reason: string): void {
    if (this.status === "moving") this.onMoving(false, false);
    this.status = "failed";
    this.failReason = reason;
    this.path = [];
  }

  /** Per-tick follower. */
  tick(): void {
    if (this.status !== "moving") return;
    const e = this.body();
    if (!isValid(e) || !this.goal) {
      this.fail("corpo indisponível");
      return;
    }
    const dim = e.dimension;
    const pos = e.location;
    const node = this.path[this.idx];
    if (!node) {
      this.status = "arrived";
      this.onMoving(false, false);
      return;
    }
    const nc = { x: node.x + 0.5, y: node.y, z: node.z + 0.5 };
    // re-validate the node we are walking into (blocks can change)
    if (!safe(() => dim.isChunkLoaded(nc), false)) {
      this.fail("a área à frente não está carregada");
      return;
    }
    const probe = makeProbe(dim);
    if (!standable(probe, node.x, node.y, node.z)) {
      if (this.replans++ < 3) {
        this.onMoving(false, false);
        this.plan();
      } else this.fail("o caminho ficou bloqueado");
      return;
    }
    const speed = this.goal.run ? TUNING.runSpeed : TUNING.walkSpeed;
    const dx = nc.x - pos.x;
    const dz = nc.z - pos.z;
    const dy = nc.y - pos.y;
    const horiz = Math.hypot(dx, dz);
    let nx: number;
    let nz: number;
    let ny: number;
    if (horiz <= speed) {
      nx = nc.x;
      nz = nc.z;
      ny = nc.y;
      this.idx++;
    } else {
      nx = pos.x + (dx / horiz) * speed;
      nz = pos.z + (dz / horiz) * speed;
      // climb smoothly when stepping up, drop when stepping down near the edge
      ny = dy > 0 ? Math.min(nc.y, pos.y + 0.35) : horiz < 0.6 ? Math.max(nc.y, pos.y - 0.5) : pos.y;
    }
    const look = this.path[Math.min(this.idx, this.path.length - 1)];
    safe(
      () =>
        e.teleport(
          { x: nx, y: ny, z: nz },
          { facingLocation: { x: look.x + 0.5, y: look.y + 1.6, z: look.z + 0.5 }, keepVelocity: false },
        ),
      undefined,
    );
    // stuck detection (should not happen with teleports, but guards against engine pushes)
    if (this.lastPos && Math.hypot(this.lastPos.x - pos.x, this.lastPos.z - pos.z) < 0.01) this.stuckTicks++;
    else this.stuckTicks = 0;
    this.lastPos = { ...pos };
    if (this.stuckTicks > 60) {
      if (this.replans++ < 3) this.plan();
      else this.fail("fiquei presa no caminho");
      return;
    }
    if (this.idx >= this.path.length) {
      this.status = "arrived";
      this.onMoving(false, false);
    }
  }
}
