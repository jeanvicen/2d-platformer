/**
 * Action Executor - reusable routines (generators driven by the executor).
 * Each routine performs REAL world operations and reports real outcomes:
 *  - goNear: A* + path follower, honest failure reasons
 *  - breakAt: timed breaking with the right tool, vanilla drops via `setblock ... destroy`
 *  - collectNear: picks up the actual item entities into the logical inventory
 *  - placeAt: validated block placement that consumes the item
 *  - returnToOwner / deliverTo: walk back and move items into the owner's real inventory
 */
import { BlockPermutation, Entity, ItemStack, Player } from "@minecraft/server";
import type { Agent } from "../ai/agent";
import { AnimState, TUNING } from "../core/constants";
import { center, dist, getBlock, isPassableBlock, isValid, log, particle, safe, sound, toStack, toStored } from "../core/mc";
import type { StoredItem, Vec3 } from "../core/types";
import { breakTicks, effectiveTool, PROTECTED_BLOCKS, prettyItem, TIER_LEVEL, toolInfo } from "../inventory/item_catalog";
import { damageMainhand, equipBestTool } from "../inventory/equipment";
import { sayKey } from "../communication/comms";
import { TICK, type Tick } from "../perception/perception";
import { exert, EXERTION } from "../survival/needs";

export type R<T> = Generator<Tick, T, void>;

export function* wait(ticks: number): R<void> {
  yield { t: "wait", ticks };
}

const EYE = 1.6;

/** Walk until the shadow's eye is within `range` of `target` (block center). */
export function* goNear(a: Agent, target: Vec3, range: number, opts: { run?: boolean; avoid?: Set<string> } = {}): R<{ ok: boolean; reason?: string }> {
  const e = a.body();
  if (!e) return { ok: false, reason: "corpo indisponível" };
  const t = center(target);
  const inReach = (c: Vec3) => {
    if (opts.avoid && opts.avoid.has(`${c.x},${c.y},${c.z}`)) return false;
    return Math.hypot(c.x + 0.5 - t.x, c.y + EYE - t.y, c.z + 0.5 - t.z) <= range;
  };
  const here = e.location;
  if (Math.hypot(here.x - t.x, here.y + EYE - t.y, here.z - t.z) <= range) return { ok: true };
  a.setNativeMode("scripted");
  a.mover.start({ target: t, isGoal: inReach, run: opts.run });
  while (a.mover.status === "planning" || a.mover.status === "moving") yield { t: "move" };
  if (a.mover.status === "arrived") {
    a.mover.status = "idle";
    return { ok: true };
  }
  const reason = a.mover.failReason || "não consegui chegar";
  a.mover.status = "idle";
  a.rt.lastWhy = reason;
  return { ok: false, reason };
}

/** Face a position (the follower already faces its path; this is for work). */
export function face(a: Agent, p: Vec3): void {
  const e = a.body();
  if (!e) return;
  const l = e.location;
  safe(() => e.teleport(l, { facingLocation: center(p), keepVelocity: false }), undefined);
}

export interface BreakResult {
  ok: boolean;
  typeId?: string;
  reason?: string;
}

/**
 * Break a block like a player would: equip the right tool, swing for the vanilla-like
 * duration, then destroy it with drops. Verifies the block did not change meanwhile.
 */
export function* breakAt(a: Agent, p: Vec3, opts: { allowAny?: boolean } = {}): R<BreakResult> {
  const e = a.body();
  if (!e) return { ok: false, reason: "corpo indisponível" };
  const dim = e.dimension;
  const b = getBlock(dim, p);
  if (!b) return { ok: false, reason: "bloco fora da área carregada" };
  const typeId = b.typeId;
  if (b.isAir || b.isLiquid) return { ok: false, reason: "não há bloco ali" };
  if (PROTECTED_BLOCKS.has(typeId)) return { ok: false, reason: `não posso quebrar ${prettyItem(typeId)}` };
  const eff = effectiveTool(typeId);
  let tool: string | undefined;
  if (eff.tool !== "none") tool = equipBestTool(a, eff.tool as never);
  if (eff.tool === "pickaxe" && eff.needLevel > 0 && !opts.allowAny) {
    const ti = tool ? toolInfo(tool) : undefined;
    if (!ti || ti.kind !== "pickaxe" || !ti.tier || TIER_LEVEL[ti.tier] < eff.needLevel) {
      return { ok: false, reason: `preciso de uma picareta adequada para ${prettyItem(typeId)}` };
    }
  }
  const total = breakTicks(typeId, tool);
  const anim = eff.tool === "axe" ? AnimState.Chop : eff.tool === "shovel" ? AnimState.Dig : AnimState.Mine;
  a.setWorkAnim(anim);
  face(a, p);
  const digSound = eff.tool === "axe" ? "dig.wood" : eff.tool === "shovel" ? "dig.gravel" : eff.tool === "pickaxe" ? "dig.stone" : "dig.grass";
  let elapsed = 0;
  while (elapsed < total) {
    const step = Math.min(6, total - elapsed);
    yield { t: "wait", ticks: step };
    elapsed += step;
    const cur = getBlock(dim, p);
    if (!cur || cur.typeId !== typeId) {
      a.setWorkAnim(AnimState.Idle);
      return { ok: false, reason: "o bloco mudou antes de eu terminar" };
    }
    sound(dim, digSound, center(p), 0.6, 0.9 + Math.random() * 0.2);
  }
  const res = safe(() => dim.runCommand(`setblock ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)} air destroy`), undefined, "setblock destroy");
  const after = getBlock(dim, p);
  a.setWorkAnim(AnimState.Idle);
  if (!res || !after || !(after.isAir || after.isLiquid)) return { ok: false, reason: "o bloco não quebrou" };
  if (tool && damageMainhand(a)) sayKey(a, "tool_broke", prettyItem(tool));
  a.record.needs = exert(a.record.needs, EXERTION.workPerAction);
  a.markDirty();
  return { ok: true, typeId };
}

export interface CollectResult {
  picked: StoredItem[];
  full: boolean;
}

/**
 * Pick up real item entities near `p` into the logical inventory.
 * The item entity is removed only after the stack was fully stored (no loss, no dupes);
 * a partially stored stack is respawned with exactly the remainder.
 */
export function* collectNear(a: Agent, p: Vec3, radius = 3, ticks = 16): R<CollectResult> {
  const e = a.body();
  const out: CollectResult = { picked: [], full: false };
  if (!e) return out;
  const dim = e.dimension;
  let waited = 0;
  while (waited <= ticks) {
    const items = safe(() => dim.getEntities({ type: "minecraft:item", location: center(p), maxDistance: radius }), [] as Entity[]);
    for (const it of items) {
      if (!isValid(it)) continue;
      const comp = safe(() => it.getComponent("minecraft:item"), undefined);
      if (!comp) continue;
      const stack = safe(() => comp.itemStack, undefined);
      if (!stack) continue;
      const stored = toStored(stack);
      const left = a.inv.add(stored);
      const took = stored.n - left;
      if (took <= 0) {
        out.full = true;
        continue;
      }
      const loc = it.location;
      safe(() => it.remove(), undefined);
      if (left > 0) {
        out.full = true;
        const rest = toStack({ ...stored, n: left });
        if (rest) safe(() => dim.spawnItem(rest, loc), undefined);
      }
      out.picked.push({ ...stored, n: took });
      a.markDirty();
    }
    if (out.picked.length) sound(dim, "random.pop", e.location, 0.4, 1.4);
    if (waited >= 6 && out.picked.length) break; // got the drops
    yield { t: "wait", ticks: 4 };
    waited += 4;
  }
  return out;
}

export function* placeAt(a: Agent, p: Vec3, item: StoredItem | undefined, perm: BlockPermutation): R<{ ok: boolean; reason?: string }> {
  const e = a.body();
  if (!e) return { ok: false, reason: "corpo indisponível" };
  const dim = e.dimension;
  const b = getBlock(dim, p);
  if (!b) return { ok: false, reason: "fora da área carregada" };
  if (!isPassableBlock(b) || b.isLiquid) return { ok: false, reason: "espaço ocupado" };
  // never place into an entity's body (owner or mobs)
  const occupied = safe(() => dim.getEntities({ location: center(p), maxDistance: 0.9, excludeTypes: ["minecraft:item"] }), [] as Entity[]);
  if (occupied.some((x) => x.id !== e.id)) return { ok: false, reason: "tem alguém no lugar" };
  if (item) {
    const removed = a.inv.removeId(item.id, 1);
    if (removed < 1) return { ok: false, reason: `sem ${prettyItem(item.id)}` };
  }
  a.setWorkAnim(AnimState.Build);
  face(a, p);
  const ok = safe(
    () => {
      b.setPermutation(perm);
      return true;
    },
    false,
    "setPermutation",
  );
  if (!ok) {
    if (item) a.inv.add({ id: item.id, n: 1 }); // refund, nothing placed
    return { ok: false, reason: "não consegui colocar o bloco" };
  }
  sound(dim, perm.type.id.includes("stone") || perm.type.id.includes("cobble") ? "use.stone" : "use.wood", center(p), 0.8, 1);
  a.record.needs = exert(a.record.needs, EXERTION.workPerAction * 0.5);
  a.markDirty();
  yield { t: "wait", ticks: 4 };
  return { ok: true };
}

/** Go back to the owner: own A* up to 30 blocks; native follow AI (can teleport like a tamed wolf) when far or blocked. */
export function* returnToOwner(a: Agent, maxTicks = 20 * 40): R<{ ok: boolean; reason?: string }> {
  let ticks = 0;
  let nativeTries = 0;
  while (ticks < maxTicks) {
    const owner = a.owner();
    const e = a.body();
    if (!owner) return { ok: false, reason: "você não está online" };
    if (!e) return { ok: false, reason: "corpo indisponível" };
    if (owner.dimension.id !== e.dimension.id) return { ok: false, reason: "estamos em dimensões diferentes" };
    const d = dist(owner.location, e.location);
    if (d <= 3.2) {
      a.mover.stop();
      return { ok: true };
    }
    if (d > 30 || nativeTries > 0) {
      // far away (or our path failed): native follow_owner walks, and teleports when far
      a.mover.stop();
      a.setNativeMode("follow");
      yield { t: "wait", ticks: 20 };
      ticks += 20;
      nativeTries = Math.max(0, nativeTries - 1);
      continue;
    }
    const target = owner.location;
    const r = yield* goNear(a, { x: target.x, y: target.y, z: target.z }, 2.6, { run: d > 5 });
    ticks += 20;
    if (!r.ok) nativeTries = 5;
  }
  return { ok: false, reason: "demorei demais para te alcançar" };
}

/**
 * Give items to the owner's real inventory. Whatever does not fit is dropped at the owner's
 * feet (still delivered, never deleted). Returns the delivered summary.
 */
export function deliverTo(a: Agent, owner: Player, pred: (s: StoredItem) => boolean, max = Infinity): { n: number; text: string } {
  const cont = safe(() => owner.getComponent("minecraft:inventory")?.container, undefined);
  if (!cont) return { n: 0, text: "" };
  let left = max;
  const given = new Map<string, number>();
  let dropped = 0;
  for (const s of [...a.inv.slots]) {
    if (left <= 0) break;
    if (!pred(s)) continue;
    const amount = Math.min(s.n, left);
    const pieces = a.inv.remove((x) => x === s, amount);
    for (const piece of pieces) {
      let remaining = piece.n;
      while (remaining > 0) {
        const chunk = Math.min(remaining, safe(() => new ItemStack(piece.id, 1).maxAmount, 64));
        const st = toStack({ ...piece, n: chunk }, chunk);
        if (!st) {
          a.inv.add({ ...piece, n: remaining }); // could not build the stack: keep it
          remaining = 0;
          break;
        }
        const rest = safe(() => cont.addItem(st), st as ItemStack | undefined);
        const restN = rest ? rest.amount : 0;
        if (rest) {
          safe(() => owner.dimension.spawnItem(rest, owner.location), undefined);
          dropped += restN;
        }
        given.set(piece.id, (given.get(piece.id) ?? 0) + chunk);
        remaining -= chunk;
        left -= chunk;
      }
    }
  }
  a.markDirty();
  const n = [...given.values()].reduce((x, y) => x + y, 0);
  const text = [...given.entries()].map(([id, k]) => `${k} ${prettyItem(id)}`).join(", ") + (dropped ? ` (${dropped} caíram no chão: sua mochila encheu)` : "");
  if (n) {
    const e = a.body();
    if (e) particle(e.dimension, "shadowbound:sparkle", { x: owner.location.x, y: owner.location.y + 1, z: owner.location.z }, a.color().particle);
    safe(() => owner.playSound("random.pop", { volume: 0.6, pitch: 1.2 }), undefined);
  }
  return { n, text };
}

export function* returnAndDeliver(a: Agent, pred: (s: StoredItem) => boolean, max = Infinity): R<{ ok: boolean; n: number; text: string; reason?: string }> {
  const r = yield* returnToOwner(a);
  if (!r.ok) return { ok: false, n: 0, text: "", reason: r.reason };
  const owner = a.owner();
  if (!owner) return { ok: false, n: 0, text: "", reason: "você saiu" };
  a.setAnim(AnimState.Wave, 1200);
  const d = deliverTo(a, owner, pred, max);
  yield { t: "wait", ticks: 10 };
  return { ok: true, ...d };
}

export function inventoryRoomCheck(a: Agent): boolean {
  return a.inv.freeSlots() > 0;
}

export function debugLog(a: Agent, ...args: unknown[]): void {
  log(a.name, ...args);
}

export { TICK, TUNING };
