/**
 * Logical inventory: a fixed number of slots holding StoredItem stacks.
 * Pure (no @minecraft imports). Max stack size and stackability are injected so the
 * game adapter can use the real ItemStack.maxAmount and tests can use a table.
 *
 * Every mutating method is all-or-nothing where it matters (remove returns what it removed,
 * add returns what did NOT fit) so callers can never create or destroy items by accident.
 */
import type { StoredItem } from "../core/types";

export type MaxStackFn = (id: string) => number;

export class LogicalInventory {
  constructor(
    public slots: StoredItem[],
    public readonly capacity: number,
    private readonly maxStack: MaxStackFn,
  ) {
    this.compact();
  }

  private canMerge(a: StoredItem, b: StoredItem): boolean {
    return (
      a.id === b.id &&
      !a.dmg && !b.dmg && !a.name && !b.name && !(a.ench && a.ench.length) && !(b.ench && b.ench.length) &&
      this.maxStack(a.id) > 1
    );
  }

  /** Remove empty stacks. */
  compact(): void {
    this.slots = this.slots.filter((s) => s && s.n > 0);
  }

  count(pred: (id: string) => boolean): number {
    let n = 0;
    for (const s of this.slots) if (pred(s.id)) n += s.n;
    return n;
  }

  countId(id: string): number {
    return this.count((x) => x === id);
  }

  freeSlots(): number {
    return this.capacity - this.slots.length;
  }

  isFull(): boolean {
    return this.slots.length >= this.capacity && this.slots.every((s) => s.n >= this.maxStack(s.id));
  }

  /** How many of `id` could still be added. */
  roomFor(id: string): number {
    const max = this.maxStack(id);
    let room = this.freeSlots() * max;
    const probe: StoredItem = { id, n: 1 };
    for (const s of this.slots) if (this.canMerge(s, probe)) room += max - s.n;
    return room;
  }

  /** Adds a stack, returns the amount that did NOT fit (0 = all stored). */
  add(item: StoredItem): number {
    let left = item.n;
    const max = this.maxStack(item.id);
    if (left <= 0) return 0;
    for (const s of this.slots) {
      if (left <= 0) break;
      if (this.canMerge(s, item) && s.n < max) {
        const mv = Math.min(max - s.n, left);
        s.n += mv;
        left -= mv;
      }
    }
    while (left > 0 && this.slots.length < this.capacity) {
      const mv = Math.min(max, left);
      const copy: StoredItem = { ...item, n: mv };
      if (item.ench) copy.ench = item.ench.map((e) => ({ ...e }));
      this.slots.push(copy);
      left -= mv;
    }
    return left;
  }

  /** Removes up to n items matching pred; returns the removed stacks (exact). */
  remove(pred: (s: StoredItem) => boolean, n: number): StoredItem[] {
    const out: StoredItem[] = [];
    let need = n;
    for (let i = this.slots.length - 1; i >= 0 && need > 0; i--) {
      const s = this.slots[i];
      if (!pred(s)) continue;
      const mv = Math.min(s.n, need);
      const piece: StoredItem = { ...s, n: mv };
      s.n -= mv;
      need -= mv;
      out.push(piece);
    }
    this.compact();
    return out;
  }

  removeId(id: string, n: number): number {
    return this.remove((s) => s.id === id, n).reduce((a, b) => a + b.n, 0);
  }

  /** Atomically consume a set of requirements; if any is missing, nothing is removed. */
  consumeAll(reqs: { match: (id: string) => boolean; n: number }[]): StoredItem[] | undefined {
    const snapshot = this.slots.map((s) => ({ ...s }));
    const removed: StoredItem[] = [];
    for (const r of reqs) {
      const got = this.remove((s) => r.match(s.id) && !s.dmg, r.n);
      const total = got.reduce((a, b) => a + b.n, 0);
      if (total < r.n) {
        this.slots = snapshot;
        return undefined;
      }
      removed.push(...got);
    }
    return removed;
  }

  /** Total item count. */
  total(): number {
    return this.slots.reduce((a, b) => a + b.n, 0);
  }

  /** Grouped summary for messages. */
  summary(): { id: string; n: number }[] {
    const m = new Map<string, number>();
    for (const s of this.slots) m.set(s.id, (m.get(s.id) ?? 0) + s.n);
    return [...m.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n);
  }
}
