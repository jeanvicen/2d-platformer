// Helpers de formulário: abre somente por ação do jogador, tenta de novo se ele estiver ocupado
// (ex.: chat aberto) e nunca entra em loop.
import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import { logError } from "../core/log.js";


const open = new Set();

/**
 * @template T
 * @param {import("@minecraft/server").Player} player
 * @param {{show(p:any):Promise<T>}} form
 * @returns {Promise<T|undefined>}
 */
export async function show(player, form, tries = 6) {
  if (open.has(player.id)) return undefined;
  open.add(player.id);
  try {
    for (let i = 0; i < tries; i++) {
      if (!player.isValid) return undefined;
      const r = /** @type {any} */ (await form.show(player));
      if (r?.canceled && r.cancelationReason === FormCancelationReason.UserBusy) {
        await system.waitTicks(10);
        continue;
      }
      if (!r?.canceled) { try { player.playSound("random.click", { volume: 0.5, pitch: 1.2 }); } catch { /* ignore */ } }
      return r;
    }
  } catch (e) {
    logError("ui.show", e);
  } finally {
    open.delete(player.id);
  }
  return undefined;
}

/** Menu de botões: retorna o índice escolhido ou -1. */
export async function menu(player, titleText, body, buttons) {
  const f = new ActionFormData().title(titleText);
  if (body) f.body(body);
  for (const b of buttons) {
    if (typeof b === "string") f.button(b);
    else f.button(b.text, b.icon);
  }
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return -1;
  return r.selection;
}

/** Campo de texto simples; retorna a string ou undefined. */
export async function ask(player, titleText, label, placeholder, def = "") {
  const f = new ModalFormData().title(titleText).textField(label, placeholder, { defaultValue: def }).submitButton("§lOK");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return undefined;
  const v = r.formValues.find((x) => typeof x === "string");
  return typeof v === "string" ? v : undefined;
}

export function isFormOpen(player) {
  return open.has(player.id);
}
