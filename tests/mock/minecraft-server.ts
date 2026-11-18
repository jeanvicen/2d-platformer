/**
 * Minimal simulator of the @minecraft/server surface used by Shadowbound, for integration
 * tests in Node. It is NOT the game: it models a voxel world, entities, items, events and the
 * scheduler closely enough to exercise the real compiled brain end to end.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Fn = (ev: any) => void;
class Signal {
  ls: Fn[] = [];
  subscribe(f: Fn) {
    this.ls.push(f);
    return f;
  }
  unsubscribe(f: Fn) {
    this.ls = this.ls.filter((x) => x !== f);
  }
  fire(ev: any) {
    for (const l of [...this.ls]) l(ev);
  }
}

// ------------------------------------------------------------------ clock & scheduler
let tick = 0;
let clock = 1_700_000_000_000;
Date.now = () => clock;
let nextId = 1;
const timers: { id: number; at: number; fn: () => void; every?: number }[] = [];
const jobs = new Map<number, Generator<any, any, any>>();

export const system = {
  get currentTick() {
    return tick;
  },
  run(fn: () => void) {
    return system.runTimeout(fn, 0);
  },
  runTimeout(fn: () => void, d = 0) {
    const id = nextId++;
    timers.push({ id, at: tick + Math.max(0, d), fn });
    return id;
  },
  runInterval(fn: () => void, every = 1) {
    const id = nextId++;
    timers.push({ id, at: tick + every, fn, every });
    return id;
  },
  clearRun(id: number) {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  },
  runJob(g: Generator<any, any, any>) {
    const id = nextId++;
    jobs.set(id, g);
    return id;
  },
  clearJob(id: number) {
    jobs.delete(id);
  },
  sendScriptEvent(id: string, message: string) {
    system.afterEvents.scriptEventReceive.fire({ id, message });
  },
  beforeEvents: { startup: new Signal() },
  afterEvents: { scriptEventReceive: new Signal() },
};

export const errors: string[] = [];
export function __advance(n: number) {
  for (let i = 0; i < n; i++) {
    tick++;
    clock += 50;
    const due = timers.filter((t) => t.at <= tick).sort((a, b) => a.at - b.at || a.id - b.id);
    for (const t of due) {
      if (t.every) t.at = tick + t.every;
      else timers.splice(timers.indexOf(t), 1);
      try {
        t.fn();
      } catch (e) {
        errors.push(String((e as Error).stack ?? e));
      }
    }
    for (const [id, g] of [...jobs]) {
      for (let k = 0; k < 30; k++) {
        try {
          const r = g.next();
          if (r.done) {
            jobs.delete(id);
            break;
          }
        } catch (e) {
          errors.push(String((e as Error).stack ?? e));
          jobs.delete(id);
          break;
        }
      }
    }
  }
}
export function __time() {
  return { tick, clock };
}
export function __skipClock(ms: number) {
  clock += ms;
}

// ------------------------------------------------------------------ enums & small classes
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const EntityDamageCause = { entityAttack: "entityAttack", magic: "magic" };
export const CommandPermissionLevel = { Any: 0 };
export const CustomCommandParamType = { String: "String" };
export const CustomCommandStatus = { Success: 0, Failure: 1 };
export class MolangVariableMap {
  setColorRGB() {}
}
export class EntityHealthComponent {}

const DURABILITY: Record<string, number> = { wooden: 59, stone: 131, iron: 250, golden: 32, diamond: 1561, netherite: 2031 };
export class ItemStack {
  typeId: string;
  amount: number;
  nameTag?: string;
  private dur?: { damage: number; maxDurability: number };
  constructor(id: string, amount = 1) {
    if (!/^(minecraft|shadowbound):[a-z0-9_]+$/.test(id)) throw new Error("bad item " + id);
    this.typeId = id;
    this.amount = amount;
    const m = /^minecraft:(wooden|stone|iron|golden|diamond|netherite)_/.exec(id);
    if (m && /(axe|pickaxe|shovel|sword|hoe)$/.test(id)) this.dur = { damage: 0, maxDurability: DURABILITY[m[1]] };
  }
  get maxAmount() {
    return this.dur || this.typeId === "shadowbound:shadow_summoner" ? 1 : 64;
  }
  getComponent(name: string) {
    if (name === "minecraft:durability") return this.dur;
    return undefined;
  }
}

export class Container {
  slots: (ItemStack | undefined)[];
  constructor(public size = 36) {
    this.slots = new Array(size).fill(undefined);
  }
  addItem(s: ItemStack): ItemStack | undefined {
    let left = s.amount;
    for (const x of this.slots) {
      if (x && x.typeId === s.typeId && x.amount < x.maxAmount && s.maxAmount > 1) {
        const mv = Math.min(left, x.maxAmount - x.amount);
        x.amount += mv;
        left -= mv;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const mv = Math.min(left, s.maxAmount);
        const n = new ItemStack(s.typeId, mv);
        this.slots[i] = n;
        left -= mv;
      }
    }
    return left > 0 ? new ItemStack(s.typeId, left) : undefined;
  }
  getItem(i: number) {
    return this.slots[i];
  }
  setItem(i: number, s?: ItemStack) {
    this.slots[i] = s;
  }
  count(id: string) {
    return this.slots.reduce((a, s) => a + (s && s.typeId === id ? s.amount : 0), 0);
  }
}

// ------------------------------------------------------------------ blocks
export class BlockPermutation {
  constructor(public type: { id: string }, public states: Record<string, any> = {}) {}
  static resolve(id: string, states: Record<string, any> = {}) {
    return new BlockPermutation({ id }, { ...states });
  }
  getState(n: string) {
    return this.states[n];
  }
  withState(n: string, v: any) {
    return new BlockPermutation(this.type, { ...this.states, [n]: v });
  }
}

const k = (x: number, y: number, z: number) => `${x},${y},${z}`;

class Block {
  constructor(public dimension: Dimension, public location: { x: number; y: number; z: number }) {}
  private get rec() {
    return this.dimension.rec(this.location.x, this.location.y, this.location.z);
  }
  get typeId() {
    return this.rec.id;
  }
  get isAir() {
    return this.typeId === "minecraft:air";
  }
  get isLiquid() {
    return /water|lava/.test(this.typeId);
  }
  get permutation() {
    return new BlockPermutation({ id: this.typeId }, { ...this.rec.states });
  }
  setPermutation(p: BlockPermutation) {
    this.dimension.set(this.location.x, this.location.y, this.location.z, p.type.id, p.states);
  }
  below() {
    return this.dimension.getBlock({ ...this.location, y: this.location.y - 1 });
  }
  above() {
    return this.dimension.getBlock({ ...this.location, y: this.location.y + 1 });
  }
  getComponent() {
    return undefined;
  }
}

const DROPS: Record<string, string | null> = {
  "minecraft:stone": "minecraft:cobblestone",
  "minecraft:grass_block": "minecraft:dirt",
  "minecraft:oak_leaves": null,
  "minecraft:wheat": "minecraft:wheat",
};

export class Dimension {
  blocks = new Map<string, { id: string; states: Record<string, any> }>();
  constructor(public id: string) {}
  rec(x: number, y: number, z: number) {
    const r = this.blocks.get(k(x, y, z));
    if (r) return r;
    if (y < 60) return { id: "minecraft:stone", states: {} };
    if (y < 63) return { id: "minecraft:dirt", states: {} };
    if (y === 63) return { id: "minecraft:grass_block", states: {} };
    return { id: "minecraft:air", states: {} };
  }
  set(x: number, y: number, z: number, id: string, states: Record<string, any> = {}) {
    this.blocks.set(k(x, y, z), { id, states });
  }
  getBlock(l: { x: number; y: number; z: number }) {
    return new Block(this, { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });
  }
  isChunkLoaded(l: { x: number; z: number }) {
    return Math.abs(l.x) < 200 && Math.abs(l.z) < 200;
  }
  runCommand(cmd: string) {
    const m = /^setblock (-?\d+) (-?\d+) (-?\d+) air destroy$/.exec(cmd);
    if (m) {
      const [x, y, z] = [+m[1], +m[2], +m[3]];
      const id = this.rec(x, y, z).id;
      this.set(x, y, z, "minecraft:air");
      const drop = id in DROPS ? DROPS[id] : id;
      if (drop) this.spawnItem(new ItemStack(drop, 1), { x: x + 0.5, y: y + 0.2, z: z + 0.5 });
      if (id === "minecraft:wheat") this.spawnItem(new ItemStack("minecraft:wheat_seeds", 1), { x: x + 0.5, y: y + 0.2, z: z + 0.5 });
      return { successCount: 1 };
    }
    return { successCount: 0 };
  }
  spawnEntity(id: string, loc: any) {
    const e = new Entity(id, this, { ...loc });
    if (id === "shadowbound:companion" || id === "shadowbound:beast") {
      const max = id === "shadowbound:beast" ? 60 : 40;
      e.health = { currentValue: max, effectiveMax: max, setCurrentValue: (v: number) => ((e.health!.currentValue = v), true) };
      e.props = { "shadowbound:anim": 0, "shadowbound:persona": 0, "shadowbound:mood": 0, "shadowbound:species": 0 };
    }
    if (id === "minecraft:cow" || id === "minecraft:zombie") {
      e.health = { currentValue: 10, effectiveMax: 10, setCurrentValue: (v: number) => ((e.health!.currentValue = v), true) };
    }
    entities.push(e);
    world.afterEvents.entitySpawn.fire({ entity: e, cause: "Spawned" });
    return e;
  }
  spawnItem(stack: ItemStack, loc: any) {
    const e = new Entity("minecraft:item", this, { ...loc });
    e.item = { itemStack: stack };
    entities.push(e);
    world.afterEvents.entitySpawn.fire({ entity: e, cause: "Spawned" });
    return e;
  }
  getEntities(o: any = {}) {
    return entities.filter((e) => e.isValid && e.dimension === this && matchesQuery(e, o));
  }
  spawnParticle() {}
  playSound() {}
}

function dist(a: any, b: any) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function families(e: Entity): string[] {
  if (e.typeId === "shadowbound:companion" || e.typeId === "shadowbound:beast") return ["shadowbound", "companion", "mob"];
  if (e.typeId === "minecraft:zombie") return ["zombie", "monster", "mob"];
  if (e.typeId === "minecraft:player") return ["player"];
  if (e.typeId === "minecraft:cow") return ["cow", "mob"];
  return [];
}
function matchesQuery(e: Entity, o: any) {
  if (o.type && e.typeId !== o.type) return false;
  if (o.excludeTypes && o.excludeTypes.includes(e.typeId)) return false;
  if (o.families && !o.families.every((f: string) => families(e).includes(f))) return false;
  if (o.excludeFamilies && o.excludeFamilies.some((f: string) => families(e).includes(f))) return false;
  if (o.location && o.maxDistance !== undefined && dist(e.location, o.location) > o.maxDistance) return false;
  return true;
}

// ------------------------------------------------------------------ entities
const entities: Entity[] = [];
export class Entity {
  id = String(nextId++);
  isValid = true;
  nameTag = "";
  props: Record<string, any> = {};
  dyn: Record<string, any> = {};
  health?: { currentValue: number; effectiveMax: number; setCurrentValue: (v: number) => boolean };
  item?: { itemStack: ItemStack };
  tamedTo?: string;
  events: string[] = [];
  commands: string[] = [];
  isSneaking = false;
  constructor(public typeId: string, public dimension: Dimension, public location: { x: number; y: number; z: number }) {}
  getProperty(n: string) {
    return this.props[n];
  }
  setProperty(n: string, v: any) {
    this.props[n] = v;
  }
  getDynamicProperty(n: string) {
    return this.dyn[n];
  }
  setDynamicProperty(n: string, v: any) {
    this.dyn[n] = v;
  }
  triggerEvent(n: string) {
    this.events.push(n);
  }
  teleport(l: any, o: any = {}) {
    this.location = { x: l.x, y: l.y, z: l.z };
    if (o.dimension) this.dimension = o.dimension;
  }
  getRotation() {
    return { x: 0, y: 0 };
  }
  matches(o: any) {
    return matchesQuery(this, o);
  }
  getComponent(n: string): any {
    if (n === "minecraft:health") return this.health;
    if (n === "minecraft:item") return this.item;
    if (n === "minecraft:tameable") return { tame: (p: Player) => ((this.tamedTo = p.id), true) };
    if (n === "minecraft:is_baby") return undefined;
    return undefined;
  }
  remove() {
    this.isValid = false;
  }
  kill() {
    this.applyDamage(9999);
    return true;
  }
  applyDamage(n: number, o: any = {}) {
    if (!this.health) return false;
    this.health.currentValue -= n;
    world.afterEvents.entityHurt.fire({ hurtEntity: this, damage: n, damageSource: { cause: o.cause, damagingEntity: o.damagingEntity } });
    if (this.health.currentValue <= 0) {
      this.isValid = false;
      world.afterEvents.entityDie.fire({ deadEntity: this, damageSource: o });
      if (this.typeId === "minecraft:cow") this.dimension.spawnItem(new ItemStack("minecraft:beef", 2), this.location);
    }
    return true;
  }
  effects: string[] = [];
  addEffect(name: string) {
    this.effects.push(name);
    return undefined;
  }
  applyImpulse() {}
  extinguishFire() {
    return true;
  }
  setOnFire() {
    return true;
  }
  runCommand(c: string) {
    this.commands.push(c);
    return { successCount: 1 };
  }
}

export class Player extends Entity {
  messages: string[] = [];
  actionbars: string[] = [];
  inventory = new Container(36);
  selectedSlotIndex = 0;
  viewBlock?: { x: number; y: number; z: number };
  onScreenDisplay = { setActionBar: (t: string) => this.actionbars.push(t) };
  constructor(public name: string, dim: Dimension, loc: any) {
    super("minecraft:player", dim, loc);
  }
  sendMessage(m: string) {
    this.messages.push(String(m));
  }
  getComponent(n: string): any {
    if (n === "minecraft:inventory") return { container: this.inventory };
    return super.getComponent(n);
  }
  getBlockFromViewDirection() {
    return this.viewBlock ? { block: this.dimension.getBlock(this.viewBlock), face: "Up" } : undefined;
  }
  getEntitiesFromViewDirection() {
    return [];
  }
  playSound() {}
}
Object.setPrototypeOf(Player.prototype, Entity.prototype);

// ------------------------------------------------------------------ world
const dims = new Map<string, Dimension>([
  ["minecraft:overworld", new Dimension("minecraft:overworld")],
  ["minecraft:nether", new Dimension("minecraft:nether")],
  ["minecraft:the_end", new Dimension("minecraft:the_end")],
]);
const players: Player[] = [];
const worldDyn: Record<string, any> = {};

export const world = {
  getDimension: (id: string) => dims.get(id)!,
  getAllPlayers: () => players.filter((p) => p.isValid),
  getPlayers: () => players.filter((p) => p.isValid),
  getEntity: (id: string) => entities.find((e) => e.id === id && e.isValid) ?? players.find((p) => p.id === id),
  getDynamicProperty: (n: string) => worldDyn[n],
  setDynamicProperty: (n: string, v: any) => {
    worldDyn[n] = v;
  },
  afterEvents: {
    playerSpawn: new Signal(),
    playerLeave: new Signal(),
    itemUse: new Signal(),
    itemCompleteUse: new Signal(),
    entityDie: new Signal(),
    entityHurt: new Signal(),
    entityHitEntity: new Signal(),
    entitySpawn: new Signal(),
  },
  beforeEvents: { playerInteractWithEntity: new Signal() },
};

export function __addPlayer(name: string, loc = { x: 0.5, y: 64, z: 0.5 }) {
  const p = new Player(name, dims.get("minecraft:overworld")!, loc);
  players.push(p);
  return p;
}
export function __entities() {
  return entities;
}
export function __worldDyn() {
  return worldDyn;
}
