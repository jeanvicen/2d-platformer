// ConversationService: a voz da Lila no chat (pt-BR), com limite de frequência e níveis de conversa.
import { system } from "@minecraft/server";

import { LILA } from "./registry.js";

const TAG = LILA.chatTag;

/**
 * @param {import("./companion.js").Companion} c
 * @param {string} msg
 * @param {{force?:boolean, chatter?:boolean, sound?:boolean}} o
 *   force: sempre mostra (respostas a ordens); chatter: comentário opcional (respeita config)
 */
export function say(c, msg, o = {}) {
  const p = c.owner();
  if (c.flags.test || c.flags.trace) console.info(`[Lila:say] ${msg}`);
  if (!p) {
    return;
  }
  const now = system.currentTick;
  const mode = c.rec.settings.chat;
  if (!o.force) {
    if (mode === "silencio") return;
    if (o.chatter && (mode === "pouco" || now - c.lastChatter < 900)) return;
    if (now - c.lastSay < 30) return;
  }
  c.lastSay = now;
  if (o.chatter) c.lastChatter = now;
  try {
    p.sendMessage((c.def?.chatTag ?? TAG) + msg);
    if (o.sound !== false) p.playSound("random.orb", { volume: 0.25, pitch: 1.7 });
  } catch {
    /* jogador saiu */
  }
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const LINES = {
  summon: ["Cheguei! Pode contar comigo.", "Oi! Tava com saudade.", "Aqui! O que vamos aprontar hoje?", "Presente! Bora jogar."],
  ack: ["Deixa comigo!", "Pode deixar!", "Beleza, já vou.", "Fechado!", "Tô indo!", "Ok, considera feito."],
  done: ["Pronto!", "Feito!", "Terminei!", "Missão cumprida!", "Prontinho."],
  idleChatter: [
    "Vou dar uma olhada por aí, já volto.", "Que dia bonito pra minerar...", "Se precisar de algo, é só chamar no controle.",
    "Acho que vou juntar mais madeira, nunca é demais.", "Vi uns minérios ali, vou conferir.", "Hmm, tô pensando em melhorar minhas ferramentas.",
  ],
  night: ["Tá escurecendo... fica perto de mim.", "Noite chegando, cuidado com os monstros!"],
  sleepy: ["Boa noite! Zzz...", "Vou deitar um pouquinho. Me acorda se precisar."],
  wake: ["Bom dia! Bora trabalhar.", "Acordei! Dormi muito bem."],
  hurtOwner: ["Ei! Ninguém mexe com você!", "Deixa que eu cuido dele!", "Fica atrás de mim!"],
  defeat: ["Ai... já volto, prometo...", "Fui derrotada... volto em 20 segundos!"],
  back: ["Voltei! Continuando de onde parei.", "Tô de volta! Onde a gente estava mesmo? Ah, lembrei."],
  thanks: ["De nada! :)", "Imagina, a gente é um time!", "Tamo junto!"],
  hello: ["Oi oi!", "E aí! Tudo certo?", "Olá! Precisa de algo?"],
  unknown: [
    "Hmm, não entendi bem. Tenta algo como \"pega 20 madeira\", \"faz uma casa aqui\" ou \"me segue\".",
    "Não peguei essa. Fala de outro jeito? Ex.: \"minera ferro\", \"planta trigo\", \"me dá tudo\".",
  ],
};
