// Interface (feita para o celular: botões grandes com ícone, 1 toque para usar).
//   Painel rápido (usar o Núcleo): os 20 poderes da sua barra — tocar = usa e vira o "ativo".
//   Grimório (agachar + usar): os 100 poderes da raça por categoria, busca, detalhes, montar a barra.
// Todo formulário é enviado pelo servidor e cada escolha é validada de novo antes de valer.
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { BY_ID, BY_RACE, CATEGORIES } from "./catalog.js";
import { BAL, RACES, oddsText } from "./data.js";
import { now, saveState, stateOf } from "./state.js";
import { cast } from "./engine.js";

export const icon = (a) => `textures/ui/race/${a.race}/${String(a.index + 1).padStart(3, "0")}`;
const emblem = (race) => `textures/ui/race/emblem_${race}`;
const show = async (player, f) => {
  try {
    return await f.show(player);
  } catch {
    return undefined;
  }
};
function cdText(s, a) {
  if (a.passive) return "§8passiva (sempre ativa)";
  const left = ((s.cd[a.id] ?? 0) - now()) / 20;
  const tog = s.tog[a.id] ? " §a● ligada" : "";
  return `${left > 0 ? `§c⏱ ${left.toFixed(1)}s` : "§a✔ pronto"}§8 · ${a.cost ? `custa ${a.cost}` : "grátis"}${tog}`;
}
const bar = (v, max, col) => `${col}${"█".repeat(Math.round((v / max) * 10))}§8${"█".repeat(10 - Math.round((v / max) * 10))}`;
function header(player) {
  const s = stateOf(player);
  const R = RACES[s.race];
  const wing = ["angel", "demon"].includes(s.race) ? `\n§7Asas: ${bar(s.wing, BAL.wingMax, "§f")} §7${s.wing}/${BAL.wingMax}${s.wing >= BAL.wingMax ? " §e(adultas)" : ""}` : "";
  const act = s.slots[s.active] ? BY_ID.get(s.slots[s.active]) : null;
  return `${R.title}§r\n§7${R.resource}: ${bar(s.res, BAL.resourceMax, R.res)} §f${Math.floor(s.res)}§7/${BAL.resourceMax}${wing}\n§7Poder ativo (bater com o Núcleo): §f${act?.name ?? "—"}`;
}

/** Painel rápido: os 20 slots. */
export async function openQuick(player) {
  const s = stateOf(player);
  if (!s.race) {
    player.onScreenDisplay.setActionBar("§7Você ainda não tem raça: use a Roleta das Essências.");
    return;
  }
  const f = new ActionFormData().title(`§l${RACES[s.race].color}Poderes — ${RACES[s.race].name}`).body(header(player));
  const map = [];
  s.slots.forEach((id, i) => {
    const a = id ? BY_ID.get(id) : null;
    if (!a) return;
    f.button(`${i === s.active ? "§l§a▶ " : "§l"}${i + 1}. ${a.name}§r\n${cdText(s, a)}`, icon(a));
    map.push(["slot", i]);
  });
  f.button("§l§d📖 Grimório§r\n§8os 100 poderes · montar a barra", emblem(s.race));
  map.push(["grim"]);
  f.button("§l§6ℹ Sua raça§r\n§8passivas, ponto fraco, chances", emblem(s.race));
  map.push(["info"]);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  const [k, i] = map[r.selection];
  if (k === "grim") return openGrimoire(player);
  if (k === "info") return openInfo(player);
  const st = stateOf(player);
  if (!st.slots[i] || BY_ID.get(st.slots[i])?.race !== st.race) return;
  st.active = i;
  saveState(player);
  cast(player, st.slots[i]);
}

/** Grimório: categorias, busca, barra. */
export async function openGrimoire(player) {
  const s = stateOf(player);
  if (!s.race) return;
  const list = BY_RACE[s.race];
  const cats = Object.keys(CATEGORIES).filter((c) => list.some((a) => a.cat === c));
  const f = new ActionFormData().title(`§l${RACES[s.race].color}Grimório — ${RACES[s.race].name}`)
    .body(`${header(player)}\n\n§fTodos os §e100 poderes§f da sua raça estão liberados. Toque num para ver, usar ou pôr na barra (20 lugares).`);
  f.button("§l🔎 Buscar poder§r\n§8pelo nome ou efeito", "textures/ui/magnifyingGlass");
  f.button("§l⚙ Montar a barra (20)§r\n§8trocar, subir, descer, esvaziar", emblem(s.race));
  for (const c of cats) {
    const n = list.filter((a) => a.cat === c).length;
    const first = list.find((a) => a.cat === c);
    f.button(`§l${CATEGORIES[c]}§r\n§8${n} poder${n > 1 ? "es" : ""}`, icon(first));
  }
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection === 0) return openSearch(player);
  if (r.selection === 1) return openLoadout(player);
  const cat = cats[r.selection - 2];
  return openList(player, list.filter((a) => a.cat === cat), CATEGORIES[cat]);
}

async function openSearch(player) {
  const f = new ModalFormData().title("§lBuscar poder").textField("Nome ou efeito (ex.: morcego, cura, queima, voo)", "digite aqui", { defaultValue: "" });
  const r = await show(player, f);
  if (!r || r.canceled) return openGrimoire(player);
  const q = String(r.formValues?.[0] ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const s = stateOf(player);
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const found = BY_RACE[s.race].filter((a) => !q || norm(a.name).includes(q) || norm(a.desc).includes(q) || norm(CATEGORIES[a.cat]).includes(q));
  return openList(player, found, `Busca: ${q || "tudo"}`);
}

async function openList(player, list, title, page = 0) {
  const s = stateOf(player);
  const PER = 25;
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const slice = list.slice(page * PER, page * PER + PER);
  const f = new ActionFormData().title(`§l${title}`).body(list.length ? `§7${list.length} poderes${pages > 1 ? ` · página ${page + 1}/${pages}` : ""}` : "§cNada encontrado.");
  for (const a of slice) f.button(`§l${a.name}§r\n${cdText(s, a)}`, icon(a));
  const extra = [];
  if (page > 0) {
    f.button("§l◀ Página anterior");
    extra.push("prev");
  }
  if (page < pages - 1) {
    f.button("§lPróxima página ▶");
    extra.push("next");
  }
  f.button("Voltar");
  extra.push("back");
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection < slice.length) return openDetail(player, slice[r.selection], () => openList(player, list, title, page));
  const k = extra[r.selection - slice.length];
  if (k === "prev") return openList(player, list, title, page - 1);
  if (k === "next") return openList(player, list, title, page + 1);
  return openGrimoire(player);
}

async function openDetail(player, a, back) {
  const s = stateOf(player);
  const inBar = s.slots.indexOf(a.id);
  const body = [`§l${RACES[a.race].color}${a.name}§r`, `§7${CATEGORIES[a.cat]} · ${a.mode}`, "", `§f${a.desc}`, "",
    a.passive ? "§8Passiva: sempre ativa, não ocupa lugar na barra." : `§7Recarga: §f${a.cd}s §7· Custo: §f${a.cost} ${RACES[a.race].resource}${a.p.r ? ` §7· Alcance: §f${a.p.r}` : ""}`,
    inBar >= 0 ? `§aNa barra: lugar ${inBar + 1}` : "§8Fora da barra"].join("\n");
  const f = new ActionFormData().title(`§l${a.name}`).body(body);
  const opts = [];
  if (!a.passive) {
    f.button("§l§a▶ Usar agora", icon(a));
    opts.push("use");
    f.button(inBar >= 0 ? "§lTrocar de lugar na barra" : "§l§ePôr na barra (escolher lugar)");
    opts.push("slot");
    if (inBar >= 0) {
      f.button("§lTornar o poder ativo§r\n§8bater com o Núcleo usa ele");
      opts.push("active");
    }
  }
  f.button("Voltar");
  opts.push("back");
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  const k = opts[r.selection];
  if (k === "use") return void cast(player, a.id);
  if (k === "slot") return pickSlot(player, a, back);
  if (k === "active") {
    s.active = inBar;
    saveState(player);
    player.onScreenDisplay.setActionBar(`§a◆ Ativo: ${a.name}`);
    return;
  }
  return back();
}

async function pickSlot(player, a, back) {
  const s = stateOf(player);
  const f = new ActionFormData().title(`§lOnde pôr "${a.name}"?`).body("§7Escolha um dos 20 lugares da barra.");
  for (let i = 0; i < BAL.quickSlots; i++) {
    const cur = s.slots[i] ? BY_ID.get(s.slots[i]) : null;
    f.button(`§l${i + 1}.§r ${cur ? cur.name : "§8(vazio)"}`, cur ? icon(cur) : undefined);
  }
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return back();
  const st = stateOf(player);
  if (a.race !== st.race || a.passive) return; // valida de novo
  const old = st.slots.indexOf(a.id);
  if (old >= 0) st.slots[old] = st.slots[r.selection] ?? null; // troca de lugar
  st.slots[r.selection] = a.id;
  saveState(player);
  player.onScreenDisplay.setActionBar(`§a${a.name} no lugar ${r.selection + 1}`);
  return back();
}

async function openLoadout(player, sel = -1) {
  const s = stateOf(player);
  const f = new ActionFormData().title("§lMontar a barra (20)").body("§7Toque num lugar para trocar, subir, descer ou esvaziar.");
  for (let i = 0; i < BAL.quickSlots; i++) {
    const a = s.slots[i] ? BY_ID.get(s.slots[i]) : null;
    f.button(`${i === s.active ? "§a▶ " : ""}§l${i + 1}.§r ${a ? a.name : "§8(vazio)"}`, a ? icon(a) : undefined);
  }
  f.button("Voltar");
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection >= BAL.quickSlots) return openGrimoire(player);
  const i = r.selection;
  const g = new ActionFormData().title(`§lLugar ${i + 1}`).body(s.slots[i] ? `§f${BY_ID.get(s.slots[i]).name}` : "§8vazio");
  const opts = ["pick", "up", "down", "clear", "active", "back"];
  g.button("§lEscolher poder para este lugar");
  g.button("§l▲ Subir");
  g.button("§l▼ Descer");
  g.button("§l§cEsvaziar");
  g.button("§l§aTornar ativo");
  g.button("Voltar");
  const r2 = await show(player, g);
  if (!r2 || r2.canceled || r2.selection === undefined) return openLoadout(player);
  const k = opts[r2.selection];
  const st = stateOf(player);
  const swap = (a, b) => {
    if (b < 0 || b >= BAL.quickSlots) return;
    [st.slots[a], st.slots[b]] = [st.slots[b], st.slots[a]];
    if (st.active === a) st.active = b;
    else if (st.active === b) st.active = a;
  };
  if (k === "pick") {
    const avail = BY_RACE[st.race].filter((a) => !a.passive);
    return openPickFor(player, i, avail);
  }
  if (k === "up") swap(i, i - 1);
  if (k === "down") swap(i, i + 1);
  if (k === "clear") st.slots[i] = null;
  if (k === "active" && st.slots[i]) st.active = i;
  saveState(player);
  return openLoadout(player, i);
}

async function openPickFor(player, slot, avail, page = 0) {
  const PER = 24;
  const slice = avail.slice(page * PER, page * PER + PER);
  const f = new ActionFormData().title(`§lPoder para o lugar ${slot + 1}`).body(`§7Página ${page + 1}/${Math.ceil(avail.length / PER)}`);
  for (const a of slice) f.button(`§l${a.name}§r\n§8${CATEGORIES[a.cat]} · ${a.cd}s`, icon(a));
  const extra = [];
  if (page > 0) {
    f.button("§l◀ Anterior");
    extra.push("prev");
  }
  if ((page + 1) * PER < avail.length) {
    f.button("§lPróxima ▶");
    extra.push("next");
  }
  f.button("Voltar");
  extra.push("back");
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return openLoadout(player);
  if (r.selection < slice.length) {
    const st = stateOf(player);
    const a = slice[r.selection];
    if (a.race !== st.race) return;
    const old = st.slots.indexOf(a.id);
    if (old >= 0) st.slots[old] = st.slots[slot] ?? null;
    st.slots[slot] = a.id;
    saveState(player);
    return openLoadout(player, slot);
  }
  const k = extra[r.selection - slice.length];
  if (k === "prev") return openPickFor(player, slot, avail, page - 1);
  if (k === "next") return openPickFor(player, slot, avail, page + 1);
  return openLoadout(player);
}

export async function openInfo(player) {
  const s = stateOf(player);
  const R = RACES[s.race];
  const pas = BY_RACE[s.race].filter((a) => a.passive).map((a) => `§f• ${a.name}§7 — ${a.desc.replace("Passiva: ", "")}`).join("\n");
  const f = new ActionFormData().title(`§l${R.name}`)
    .body(`${R.title}§r\n§f${R.blurb}\n\n§c⚠ Ponto fraco:§f ${R.weakness}\n\n§6Passivas (sempre ativas):\n${pas}\n\n§7Chances da roleta: ${oddsText()}`)
    .button(`§lEfeitos reduzidos: ${s.tog.lowfx ? "§aLIGADO" : "§7desligado"}§r\n§8menos partículas (celular fraco / acessibilidade)`)
    .button("Voltar");
  const r = await show(player, f);
  if (r && !r.canceled && r.selection === 0) {
    s.tog.lowfx = !s.tog.lowfx;
    saveState(player);
    return openInfo(player);
  }
  return openQuick(player);
}

/** Informações da roleta (antes de girar). */
export async function openRouletteInfo(player) {
  const f = new ActionFormData().title("§l§6Roleta das Essências")
    .body(`§fUse a roleta para sortear uma raça (o sorteio é do servidor).\n\n§7Chances exatas:\n${oddsText()}\n\n§eDEUS§f e §5TREVAS§f: exatamente §l1%§r§f cada.`)
    .button("Ok");
  await show(player, f);
}
