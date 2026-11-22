// Painel de poderes no CANTO DIREITO da tela (meio transparente) + MODO PODER.
//
// Como aparece na tela: o servidor manda o texto pelo canal do TÍTULO com o marcador "HKD:" na
// frente. O pacote de recursos (ui/hud_screen.json) esconde o título normal quando o texto tem o
// marcador e mostra um painel ancorado à direita com o resto do texto. Sem o pacote de recursos
// nada quebra: só não aparece o painel.
//
// Modo poder (ligado/desligado usando o Núcleo da Raça):
//   • a barra de itens (1–9) escolhe o poder (página 1 = lugares 1–9, página 2 = 10–18);
//   • bater/quebrar/tocar = usa o poder escolhido (quebrar bloco fica bloqueado no modo poder);
//   • agachar + bater = troca a página;  usar o Núcleo de novo = sai do modo poder.
import { system } from "@minecraft/server";
import { BY_ID } from "./catalog.js";
import { BAL, RACES } from "./data.js";
import { now, saveState, stateOf } from "./state.js";

export const MARK = "HKD:";
export const PAGE = 9;
export const PAGES = Math.ceil(BAL.quickSlots / PAGE);
const PAUSE = new Map(); // id → tick até quando o painel não sobrescreve o título (ex.: revelação da roleta)
const SHOWN = new Map(); // id → {t, at} último texto enviado
const NAME_MAX = 17;

/** Não sobrescrever o título por alguns ticks (outro título importante na tela). */
export function hudPause(player, ticks) {
  PAUSE.set(player.id, system.currentTick + ticks);
  SHOWN.delete(player.id);
}

/** Índice do lugar escolhido pela barra de itens na página atual. */
export function slotIndex(player, s = stateOf(player)) {
  let sel = 0;
  try {
    sel = player.selectedSlotIndex;
  } catch {
    /* ignore */
  }
  return Math.min(BAL.quickSlots - 1, s.page * PAGE + Math.max(0, Math.min(PAGE - 1, sel)));
}

const cut = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
function resBar(v, max, col) {
  const n = Math.round((Math.max(0, Math.min(max, v)) / max) * 10);
  return `${col}${"■".repeat(n)}§8${"■".repeat(10 - n)}`;
}

/** Texto do painel (sem o marcador). Linhas curtas: o painel tem ~25 letras de largura. */
export function hudText(player, s = stateOf(player)) {
  const R = RACES[s.race];
  const sel = slotIndex(player, s);
  const t = now();
  const lines = [`§l${R.color}${R.name.toUpperCase()}§r §7pág ${s.page + 1}/${PAGES}`, `${resBar(s.res, BAL.resourceMax, R.res)} §f${Math.floor(s.res)}`, "§8------------------"];
  for (let k = 0; k < PAGE; k++) {
    const i = s.page * PAGE + k;
    if (i >= BAL.quickSlots) break;
    const a = s.slots[i] ? BY_ID.get(s.slots[i]) : null;
    const on = i === sel;
    if (!a) {
      lines.push(`${on ? `${R.color}» ` : "§8  "}${k + 1} §8—`);
      continue;
    }
    const left = ((s.cd[a.id] ?? 0) - t) / 20;
    const poor = s.res < a.cost;
    let tail = "";
    if (s.tog[a.id]) tail = " §a●";
    else if (left > 0) tail = ` §c${left < 10 ? left.toFixed(1) : Math.ceil(left)}s`;
    else if (poor) tail = " §8×";
    const nameCol = on ? `§l${R.color === "§f" ? "§e" : R.color}` : left > 0 || poor ? "§7" : "§f";
    lines.push(`${on ? `${R.color}» ` : "  "}§7${k + 1} ${nameCol}${cut(a.name, NAME_MAX)}§r${tail}`);
  }
  lines.push("§8------------------", "§7bater §f= usar", "§7agachar+bater §f= página", "§7Núcleo §f= sair");
  return lines.join("\n");
}

/** Atualiza o painel (só manda de novo quando o texto muda ou a cada 3 s). */
export function hudRender(player, force = false) {
  const s = stateOf(player);
  if (!s.race || !s.pm) return;
  if (!force && (PAUSE.get(player.id) ?? 0) > system.currentTick) return;
  const txt = hudText(player, s);
  const last = SHOWN.get(player.id);
  if (!force && last && last.t === txt && system.currentTick - last.at < 60) return;
  try {
    player.onScreenDisplay.setTitle(MARK + txt, { fadeInDuration: 0, stayDuration: 200, fadeOutDuration: 0 });
    SHOWN.set(player.id, { t: txt, at: system.currentTick });
  } catch {
    /* jogador saiu */
  }
}

/** Some com o painel (título vazio com o marcador: o pacote esconde tudo). */
export function hudClear(player) {
  SHOWN.delete(player.id);
  try {
    player.onScreenDisplay.setTitle(MARK, { fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 });
  } catch {
    /* ignore */
  }
}

/** Liga/desliga o modo poder. */
export function setPowerMode(player, on) {
  const s = stateOf(player);
  if (!s.race) return false;
  s.pm = !!on;
  saveState(player);
  try {
    if (s.pm) {
      player.onScreenDisplay.setActionBar(`${RACES[s.race].color}§l◆ MODO PODER§r §7— escolha na barra (1-9) e bata para usar`);
      player.dimension.playSound("beacon.activate", player.location, { volume: 0.6, pitch: 1.6 });
      hudRender(player, true);
    } else {
      player.onScreenDisplay.setActionBar("§7Modo poder desligado — bater volta a quebrar blocos");
      player.dimension.playSound("beacon.deactivate", player.location, { volume: 0.6, pitch: 1.6 });
      hudClear(player);
    }
  } catch {
    /* ignore */
  }
  return s.pm;
}

/** Troca a página do painel (1–9 / 10–18). */
export function nextPage(player) {
  const s = stateOf(player);
  s.page = (s.page + 1) % PAGES;
  saveState(player);
  try {
    player.dimension.playSound("item.book.page_turn", player.location, { volume: 0.7, pitch: 1.2 });
  } catch {
    /* ignore */
  }
  hudRender(player, true);
}

/** Poder escolhido agora (ou null). */
export function selectedPower(player) {
  const s = stateOf(player);
  const i = slotIndex(player, s);
  const id = s.slots[i];
  return id ? { i, id } : null;
}

export function hudForget(id) {
  PAUSE.delete(id);
  SHOWN.delete(id);
}
