/**
 * Agent: the runtime object for one shadow (one per owner). Holds the persisted record,
 * the live body reference and the per-module runtime state. Modules receive the Agent and
 * talk to each other only through it (documented in documentation/ARQUITETURA.md).
 */
import { Entity, Player, world } from "@minecraft/server";
import { AnimState, BEAST_COLOR, COLORS, PROP_ANIM, TUNING, isPersona } from "../core/constants";
import { findPlayerById, isValid, maxStack, safe } from "../core/mc";
import { BEAST_INFO } from "../core/species";
import type { AgentRecord, Clarification } from "../core/types";
import { LogicalInventory } from "../inventory/logical_inventory";
import { saveRecord } from "../memory/memory_manager";
import { Mover } from "../navigation/mover";
import { StateMachine } from "../state/state_machine";
import type { Speaker } from "../communication/comms";

export type NativeMode = "follow" | "guard" | "scripted";

export interface Runtime {
  protectUntil: number;
  threatId?: string;
  ownerHurtAt: number;
  ownerAttackerId?: string;
  eating: boolean;
  recovering: boolean;
  animUntil: number;
  workAnim: AnimState;
  boltCooldown: number;
  clarification?: Clarification;
  lastWhy: string;
  waitingLLM: boolean;
  lastFollowCheck: number;
  lastHitAt: number;
  lastMoveAnimRun: boolean;
  summonedAt: number;
}

export class Agent implements Speaker {
  record: AgentRecord;
  bodyId?: string;
  private cachedBody?: Entity;
  readonly sm = new StateMachine();
  readonly mover: Mover;
  inv: LogicalInventory;
  dirty = false;
  nativeMode?: NativeMode;
  rt: Runtime = {
    protectUntil: 0,
    ownerHurtAt: 0,
    eating: false,
    recovering: false,
    animUntil: 0,
    workAnim: AnimState.Idle,
    boltCooldown: 0,
    lastWhy: "",
    waitingLLM: false,
    lastFollowCheck: 0,
    lastHitAt: 0,
    lastMoveAnimRun: false,
    summonedAt: 0,
  };

  constructor(record: AgentRecord) {
    this.record = record;
    this.inv = new LogicalInventory(record.inventory, TUNING.inventorySlots, maxStack);
    this.mover = new Mover(() => this.body());
    this.mover.onMoving = (moving, run) => {
      this.rt.lastMoveAnimRun = run;
      if (moving) this.setAnim(run ? AnimState.Run : AnimState.Walk);
      else if (Date.now() > this.rt.animUntil) this.setAnim(this.rt.workAnim);
    };
  }

  // ---- Speaker -------------------------------------------------------------------------
  get persona(): string {
    return this.record.persona;
  }
  /** globally unique: ownerId:memberId */
  get key(): string {
    return `${this.record.ownerId}:${this.record.id}`;
  }
  get isBeast(): boolean {
    return this.record.kind === "beast";
  }
  get beastSound(): string | undefined {
    return this.isBeast ? (BEAST_INFO as Record<string, { sound: string }>)[this.persona]?.sound ?? "*grunhido*" : undefined;
  }
  get name(): string {
    return this.record.shadowName;
  }
  owner(): Player | undefined {
    return findPlayerById(this.record.ownerId);
  }
  chatEnabled(): boolean {
    return this.record.settings.chatMessages;
  }

  body(): Entity | undefined {
    if (isValid(this.cachedBody)) return this.cachedBody;
    this.cachedBody = undefined;
    if (!this.bodyId) return undefined;
    const e = safe(() => world.getEntity(this.bodyId!), undefined);
    if (isValid(e)) {
      this.cachedBody = e;
      return e;
    }
    return undefined;
  }

  attach(e: Entity): void {
    this.cachedBody = e;
    this.bodyId = e.id;
    this.nativeMode = undefined;
  }

  detach(): void {
    this.cachedBody = undefined;
    this.bodyId = undefined;
    this.mover.stop();
  }

  color() {
    return isPersona(this.persona) ? COLORS[this.persona] : BEAST_COLOR;
  }

  // ---- body helpers ----------------------------------------------------------------------
  setAnim(a: AnimState, holdMs = 0): void {
    const e = this.body();
    if (!e) return;
    if (holdMs) this.rt.animUntil = Date.now() + holdMs;
    if (safe(() => e.getProperty(PROP_ANIM) as number, -1) !== a) safe(() => e.setProperty(PROP_ANIM, a), undefined);
  }

  /** Persistent "working" animation shown whenever she is not walking. */
  setWorkAnim(a: AnimState): void {
    this.rt.workAnim = a;
    if (this.mover.status !== "moving") this.setAnim(a);
  }

  setNativeMode(m: NativeMode): void {
    const e = this.body();
    if (!e || this.nativeMode === m) return;
    safe(() => e.triggerEvent(`shadowbound:mode_${m}`), undefined, "triggerEvent");
    this.nativeMode = m;
  }

  /** Forces the native AI to forget its current target (used for the combat leash). */
  resetNativeTargets(): void {
    const e = this.body();
    if (!e) return;
    const m = this.nativeMode ?? "follow";
    safe(() => e.triggerEvent("shadowbound:mode_scripted"), undefined);
    safe(() => e.triggerEvent(`shadowbound:mode_${m}`), undefined);
  }

  health(): { cur: number; max: number } {
    const e = this.body();
    const h = e ? safe(() => e.getComponent("minecraft:health"), undefined) : undefined;
    return h ? { cur: h.currentValue, max: h.effectiveMax } : { cur: this.record.health, max: 40 };
  }

  markDirty(): void {
    this.dirty = true;
  }

  save(): void {
    this.record.inventory = this.inv.slots;
    const e = this.body();
    if (e) {
      const h = this.health();
      this.record.health = h.cur;
      const l = e.location;
      this.record.lastPos = { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z), dim: e.dimension.id };
    }
    if (saveRecord(this.record)) this.dirty = false;
  }
}
