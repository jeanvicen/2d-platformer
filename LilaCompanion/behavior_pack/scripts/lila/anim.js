// AnimationController: liga as propriedades sincronizadas (lila:action / lila:move) às animações
// do pacote de recursos, efeitos de som/partícula e o item visível na mão dela.
import { logError } from "../core/log.js";
import { DRONE } from "./registry.js";

export const ACTIONS = ["idle", "mine", "chop", "dig", "place", "attack", "eat", "sleep", "craft",
  "farm", "wave", "sit", "defeat", "summon", "celebrate", "think"];
export const MOVES = ["none", "walk", "run", "swim", "climb", "fall", "sneak"];

/** @param {import("@minecraft/server").Entity|undefined} e */
export function setAction(e, action) {
  if (!e?.isValid) return;
  if (e.typeId === DRONE.entity) action = DRONE.actionMap?.[action] ?? action;
  try {
    if (e.getProperty("lila:action") !== action) e.setProperty("lila:action", action);
  } catch (err) {
    logError("anim.action", err);
  }
}

export function getAction(e) {
  try {
    return /** @type {string} */ (e?.getProperty("lila:action") ?? "idle");
  } catch {
    return "idle";
  }
}

export function setMove(e, move) {
  if (!e?.isValid) return;
  try {
    if (e.getProperty("lila:move") !== move) e.setProperty("lila:move", move);
  } catch (err) {
    logError("anim.move", err);
  }
}

const HELD = new Map();

/** Mostra um item na mão dela (cópia visual; o item real fica no inventário). */
export function hold(e, itemId) {
  if (!e?.isValid) return;
  const id = itemId ?? "air";
  if (HELD.get(e.id) === id) return;
  HELD.set(e.id, id);
  try {
    e.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${id} 1`);
  } catch {
    /* item sem forma visível: ignora */
  }
}

export function heldVisual(e) {
  return e ? HELD.get(e.id) ?? "air" : "air";
}

export function sound(e, id, volume = 1, pitch = 1) {
  if (!e?.isValid) return;
  try {
    e.dimension.playSound(id, e.location, { volume, pitch });
  } catch {
    /* som inexistente em alguma versão: ignora */
  }
}

export function particle(dim, id, loc) {
  try {
    dim.spawnParticle(id, loc);
  } catch {
    /* chunk descarregado */
  }
}

/** Som de quebra/batida por material. */
export function digSound(blockId) {
  if (/log|wood|planks|stem|chest|table|fence|door/.test(blockId)) return "dig.wood";
  if (/dirt|grass_block|farmland|mud|clay|podzol|mycelium/.test(blockId)) return "dig.grass";
  if (/sand|gravel|snow/.test(blockId)) return /sand/.test(blockId) ? "dig.sand" : "dig.gravel";
  if (/leaves|grass|fern|flower|bush|vine|crop|wheat|carrot|potato/.test(blockId)) return "dig.grass";
  if (/glass/.test(blockId)) return "random.glass";
  if (/wool/.test(blockId)) return "dig.cloth";
  return "dig.stone";
}
