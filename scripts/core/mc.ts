/**
 * Thin, defensive helpers over the stable @minecraft/server API.
 * Every call that can throw (unloaded chunks, removed entities) is guarded here so the
 * rest of the brain can stay readable.
 */
import { Block, Dimension, Entity, ItemStack, MolangVariableMap, Player, world } from "@minecraft/server";
import type { StoredItem, Vec3 } from "./types";

declare const console: { warn(...args: unknown[]): void };

export const LOG_PREFIX = "[Shadowbound]";

export function log(...args: unknown[]): void {
  console.warn(LOG_PREFIX, ...args);
}

export function safe<T>(fn: () => T, fallback: T, label?: string): T {
  try {
    return fn();
  } catch (e) {
    if (label) log(label, String(e));
    return fallback;
  }
}

export const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const center = (b: Vec3): Vec3 => ({ x: Math.floor(b.x) + 0.5, y: Math.floor(b.y) + 0.5, z: Math.floor(b.z) + 0.5 });
export const floorV = (p: Vec3): Vec3 => ({ x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const dist2 = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

export function isValid(e: Entity | undefined): e is Entity {
  return !!e && safe(() => e.isValid, false);
}

export function getBlock(dim: Dimension, p: Vec3): Block | undefined {
  try {
    return dim.getBlock(floorV(p));
  } catch {
    return undefined; // unloaded / out of world
  }
}

export function getDimension(id: string): Dimension {
  return world.getDimension(id);
}

export function findPlayerById(id: string): Player | undefined {
  for (const p of world.getAllPlayers()) if (p.id === id) return p;
  return undefined;
}

// ------------------------------------------------------------------------------------------
// Block classification for navigation
// ------------------------------------------------------------------------------------------
const NON_COLLIDING = new Set([
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern", "minecraft:dead_bush",
  "minecraft:snow_layer", "minecraft:torch", "minecraft:soul_torch", "minecraft:redstone_torch", "minecraft:vine",
  "minecraft:glow_lichen", "minecraft:seagrass", "minecraft:tall_seagrass", "minecraft:kelp", "minecraft:wheat",
  "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot", "minecraft:sugar_cane", "minecraft:rail",
  "minecraft:golden_rail", "minecraft:detector_rail", "minecraft:activator_rail", "minecraft:redstone_wire",
  "minecraft:lever", "minecraft:tripwire", "minecraft:light_block", "minecraft:structure_void", "minecraft:hanging_roots",
  "minecraft:pink_petals", "minecraft:leaf_litter", "minecraft:short_dry_grass", "minecraft:tall_dry_grass", "minecraft:bush",
  "minecraft:firefly_bush", "minecraft:wildflowers", "minecraft:cave_vines", "minecraft:twisting_vines", "minecraft:weeping_vines",
]);
const FLOWER_LIKE = /(sapling|flower|tulip|dandelion|poppy|orchid|allium|bluet|daisy|cornflower|lily_of_the_valley|rose|peony|lilac|sunflower|mushroom$|button|pressure_plate|_sign|banner|carpet|torchflower|pitcher_plant|propagule|eyeblossom)/;
const DANGER = new Set([
  "minecraft:lava", "minecraft:flowing_lava", "minecraft:fire", "minecraft:soul_fire", "minecraft:magma",
  "minecraft:cactus", "minecraft:sweet_berry_bush", "minecraft:powder_snow", "minecraft:campfire",
  "minecraft:soul_campfire", "minecraft:wither_rose", "minecraft:pointed_dripstone",
]);
const NOT_STANDABLE = /(fence|_wall$|cobblestone_wall|^minecraft:.*_door$|trapdoor|bed$|lava|water|fire)/;

export function isPassableBlock(b: Block | undefined): boolean {
  if (!b) return false;
  if (b.isAir) return true;
  const id = b.typeId;
  if (id === "minecraft:water" || id === "minecraft:flowing_water") return true;
  if (b.isLiquid) return false; // lava
  if (NON_COLLIDING.has(id)) return true;
  if (FLOWER_LIKE.test(id) && !id.includes("carpet") && !id.includes("banner")) return true;
  if (id.includes("carpet")) return true; // 1/16 tall
  return false;
}

export function isSolidGround(b: Block | undefined): boolean {
  if (!b) return false;
  if (b.isAir || b.isLiquid) return false;
  const id = b.typeId;
  if (NON_COLLIDING.has(id) || FLOWER_LIKE.test(id)) return false;
  if (NOT_STANDABLE.test(id)) return false;
  return true;
}

export function isDangerBlock(b: Block | undefined): boolean {
  return !!b && DANGER.has(b.typeId);
}

// ------------------------------------------------------------------------------------------
// Items
// ------------------------------------------------------------------------------------------
const maxCache = new Map<string, number>();
export function maxStack(id: string): number {
  const c = maxCache.get(id);
  if (c !== undefined) return c;
  const m = safe(() => new ItemStack(id, 1).maxAmount, 64);
  maxCache.set(id, m);
  return m;
}

export function itemExists(id: string): boolean {
  return safe(() => !!new ItemStack(id, 1), false);
}

export function toStored(stack: ItemStack): StoredItem {
  const s: StoredItem = { id: stack.typeId, n: stack.amount };
  const dur = safe(() => stack.getComponent("minecraft:durability"), undefined);
  if (dur && dur.damage > 0) s.dmg = dur.damage;
  if (stack.nameTag) s.name = stack.nameTag;
  const ench = safe(() => stack.getComponent("minecraft:enchantable")?.getEnchantments(), undefined);
  if (ench && ench.length) s.ench = ench.map((e) => ({ id: e.type.id, lvl: e.level }));
  return s;
}

export function toStack(s: StoredItem, amount?: number): ItemStack | undefined {
  try {
    const st = new ItemStack(s.id, Math.max(1, Math.min(amount ?? s.n, maxStack(s.id))));
    if (s.dmg) {
      const d = st.getComponent("minecraft:durability");
      if (d) d.damage = Math.min(s.dmg, d.maxDurability);
    }
    if (s.name) st.nameTag = s.name;
    if (s.ench && s.ench.length) {
      const en = st.getComponent("minecraft:enchantable");
      if (en) {
        for (const e of s.ench) {
          try {
            en.addEnchantment({ type: e.id, level: e.lvl } as never);
          } catch {
            /* enchant not applicable: keep the item anyway */
          }
        }
      }
    }
    return st;
  } catch (e) {
    log("toStack failed", s.id, String(e));
    return undefined;
  }
}

export function maxDurability(id: string): number {
  return safe(() => new ItemStack(id, 1).getComponent("minecraft:durability")?.maxDurability ?? 0, 0);
}

// ------------------------------------------------------------------------------------------
// Effects
// ------------------------------------------------------------------------------------------
export function particle(dim: Dimension, id: string, p: Vec3, color?: { red: number; green: number; blue: number }): void {
  try {
    if (color) {
      const m = new MolangVariableMap();
      m.setColorRGB("variable.color", color);
      dim.spawnParticle(id, p, m);
    } else {
      dim.spawnParticle(id, p);
    }
  } catch {
    /* unloaded or particle missing: cosmetic only */
  }
}

export function sound(dim: Dimension, id: string, p: Vec3, volume = 1, pitch = 1): void {
  try {
    dim.playSound(id, p, { volume, pitch });
  } catch {
    /* cosmetic */
  }
}

export function yawTo(from: Vec3, to: Vec3): number {
  return (Math.atan2(-(to.x - from.x), to.z - from.z) * 180) / Math.PI;
}
