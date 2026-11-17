/**
 * Touch-friendly menus (Android/Windows). Opened by using the Shadow Summoner, by tapping
 * the companion, or with "/sombra menu". Every action goes through handleOrder(), so the
 * same authorization and planning rules apply as for typed orders.
 */
import { Player, system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import type { Agent } from "../ai/agent";
import { agentFor, summon, executorOf } from "../ai/agent_manager";
import { applyIntents, handleOrder, statusText } from "../ai/brain";
import { isOwner } from "../authorization/owner_auth";
import { say } from "../communication/comms";
import { safe, toStack, toStored } from "../core/mc";
import { prettyItem } from "../inventory/item_catalog";
import { equipBestArmor } from "../inventory/equipment";
import { deliverTo } from "../executor/routines";
import { bridgeAvailable } from "../ai/llm_bridge";
import { TUNING } from "../core/constants";

type Shown = { canceled: boolean; cancelationReason?: FormCancelationReason };

/** Show a form, retrying while the player is busy (chat open, another screen). */
function show<T extends Shown>(player: Player, open: () => Promise<T>, then: (r: T) => void, tries = 12): void {
  open()
    .then((r) => {
      if (r.canceled && r.cancelationReason === FormCancelationReason.UserBusy && tries > 0) {
        system.runTimeout(() => show(player, open, then, tries - 1), 10);
        return;
      }
      if (!r.canceled) then(r);
    })
    .catch(() => undefined);
}

const askForm = (a: Agent, question: string, options: { label: string; text: string }[]) => {
  const p = a.owner();
  if (!p) return;
  const f = new ActionFormData().title(a.name).body(question);
  for (const o of options) f.button(o.label);
  show(p, () => f.show(p), (r) => {
    const o = r.selection !== undefined ? options[r.selection] : undefined;
    if (o) handleOrder(a, p, o.text, { fromMenu: true, askForm });
  });
};

function order(a: Agent, p: Player, text: string): void {
  handleOrder(a, p, text, { fromMenu: true, askForm });
}

export function openMain(player: Player): void {
  const a = agentFor(player.id);
  if (!a || !a.record.active) {
    openSummon(player);
    return;
  }
  if (!isOwner(player, a)) return;
  if (a.record.dead) {
    say(a, `Ainda estou nas sombras... volto em ${Math.max(0, Math.ceil((a.record.respawnAt - Date.now()) / 1000))}s.`, { force: true });
    return;
  }
  const items: [string, () => void][] = [
    ["§lDar uma ordem (texto)", () => openOrder(player, a)],
    ["Me seguir", () => order(a, player, "me siga")],
    ["Me proteger", () => order(a, player, "me proteja")],
    ["Ficar de guarda aqui", () => order(a, player, "fique de guarda aqui")],
    ["Ficar parada aqui", () => order(a, player, "fica aqui")],
    ["Coletar madeira", () => openAmount(player, a, "Quantos troncos?", 16, 64, (n) => `pegue ${n} troncos`)],
    ["Conseguir comida", () => order(a, player, "consiga comida")],
    ["Minerar...", () => openMine(player, a)],
    ["Construir...", () => openBuild(player, a)],
    ["Fabricar...", () => openCraft(player, a)],
    ["Inventário e itens", () => openInventory(player, a)],
    ["Me entregar tudo", () => order(a, player, "me da tudo")],
    ["Status", () => say(a, "\n" + statusText(a), { force: true })],
    [a.record.pausedByOwner ? "Retomar tarefa" : "Pausar tarefa", () => order(a, player, a.record.pausedByOwner ? "continua" : "pausa")],
    ["Cancelar tarefas", () => order(a, player, "cancela")],
    ["Configurações", () => openSettings(player, a)],
    ["§cDispensar a sombra", () => order(a, player, "pode ir")],
  ];
  const f = new ActionFormData().title(`${a.color().tag}${a.name}`).body(statusText(a));
  for (const [label] of items) f.button(label);
  show(player, () => f.show(player), (r) => {
    if (r.selection !== undefined) items[r.selection]?.[1]();
  });
}

export function openOrder(player: Player, a: Agent): void {
  const f = new ModalFormData()
    .title(`Ordem para ${a.name}`)
    .textField("O que devo fazer?", "ex.: pegue 32 troncos e volte")
    .submitButton("Enviar");
  show(player, () => f.show(player), (r) => {
    const text = r.formValues?.[0];
    if (typeof text === "string" && text.trim()) order(a, player, text);
  });
}

function openAmount(player: Player, a: Agent, label: string, def: number, max: number, mk: (n: number) => string): void {
  const f = new ModalFormData().title(a.name).slider(label, 1, max, { defaultValue: def }).submitButton("Ok");
  show(player, () => f.show(player), (r) => {
    const n = Number(r.formValues?.[0] ?? def);
    order(a, player, mk(Math.max(1, Math.floor(n))));
  });
}

function pick(player: Player, a: Agent, title: string, options: [string, string][]): void {
  const f = new ActionFormData().title(title);
  for (const [l] of options) f.button(l);
  show(player, () => f.show(player), (r) => {
    const o = r.selection !== undefined ? options[r.selection] : undefined;
    if (o) order(a, player, o[1]);
  });
}

function openMine(player: Player, a: Agent): void {
  pick(player, a, "Minerar", [
    ["Pedra (32)", "pegue 32 pedras"],
    ["Carvão (8)", "minere 8 carvao"],
    ["Ferro (8)", "minere 8 ferro"],
    ["Cobre (8)", "minere 8 cobre"],
    ["Ouro (6)", "minere 6 ouro"],
    ["Diamante (3)", "minere 3 diamantes"],
    ["Areia (16)", "pegue 16 areia"],
    ["Cavar buraco 3x3 na minha frente", "cave um buraco 3"],
    ["Quebrar o bloco que estou olhando", "quebre esse bloco"],
  ]);
}

function openBuild(player: Player, a: Agent): void {
  pick(player, a, "Construir (na sua frente)", [
    ["Casinha de madeira", "construa uma casinha de madeira"],
    ["Casinha de pedra", "construa uma casinha de pedra"],
    ["Muro de pedra", "construa um muro de pedra"],
    ["Plataforma 5x5", "construa uma plataforma"],
    ["Ponte (8 blocos)", "construa uma ponte"],
    ["Pilar", "construa um pilar"],
    ["Torre de vigia", "construa uma torre de pedra"],
  ]);
}

function openCraft(player: Player, a: Agent): void {
  pick(player, a, "Fabricar", [
    ["Tábuas (16)", "faça 16 tabuas"],
    ["Gravetos (8)", "faça 8 gravetos"],
    ["Bancada", "faça uma bancada"],
    ["Tochas (8)", "faça 8 tochas"],
    ["Baú", "faça um bau"],
    ["Fornalha", "faça uma fornalha"],
    ["Pão", "faça pao"],
    ["Melhor picareta possível", "faça uma picareta"],
    ["Melhor machado possível", "faça um machado"],
    ["Melhor espada possível", "faça uma espada"],
    ["Cozinhar/fundir na fornalha", "cozinhe"],
  ]);
}

function openInventory(player: Player, a: Agent): void {
  const s = a.inv.summary();
  const eq = Object.entries(a.record.equipment).filter(([, v]) => !!v).map(([k, v]) => `${k}: ${prettyItem(v!.id)}`);
  const body = [
    `Espaços: ${a.inv.slots.length}/${a.inv.capacity}`,
    s.length ? s.map((x) => `- ${x.n} ${prettyItem(x.id)}`).join("\n") : "(vazia)",
    eq.length ? `Equipado: ${eq.join(", ")}` : "",
    "",
    "Dica: agache e toque na sombra segurando um item para dar o item a ela.",
  ].join("\n");
  const f = new ActionFormData().title(`Mochila de ${a.name}`).body(body).button("Pegar um item").button("Me entregar tudo").button("Dar o item da minha mão").button("Vestir a melhor armadura").button("Voltar");
  show(player, () => f.show(player), (r) => {
    if (r.selection === 0) openTake(player, a);
    if (r.selection === 1) order(a, player, "me da tudo");
    if (r.selection === 2) giveHeldItem(player, a);
    if (r.selection === 3) {
      const ch = equipBestArmor(a);
      say(a, ch.length ? `Vesti: ${ch.map(prettyItem).join(", ")}.` : "Não tenho armadura melhor na mochila.", { force: true });
    }
    if (r.selection === 4) openMain(player);
  });
}

function openTake(player: Player, a: Agent): void {
  const s = a.inv.summary();
  if (!s.length) {
    say(a, "Minha mochila está vazia.", { force: true });
    return;
  }
  const f = new ModalFormData()
    .title("Pegar item")
    .dropdown("Item", s.map((x) => `${prettyItem(x.id)} (${x.n})`))
    .slider("Quantidade", 1, 64, { defaultValue: 64 })
    .submitButton("Pegar");
  show(player, () => f.show(player), (r) => {
    const idx = Number(r.formValues?.[0] ?? 0);
    const n = Number(r.formValues?.[1] ?? 1);
    const it = s[idx];
    if (!it) return;
    const body = a.body();
    if (body && body.dimension.id === player.dimension.id && Math.hypot(body.location.x - player.location.x, body.location.z - player.location.z) <= 6) {
      const res = deliverTo(a, player, (x) => x.id === it.id, n);
      say(a, res.n ? `Aqui está: ${res.text}.` : "Não consegui entregar.", { force: true });
    } else applyIntents(a, player, [{ kind: "deliver", item: it.id, quantity: n, priority: "normal", raw: "menu" }], false);
  });
}

/** Owner gives the item in hand to the shadow (exact amounts, no loss, no duplication). */
export function giveHeldItem(player: Player, a: Agent): void {
  if (!isOwner(player, a)) return;
  const cont = safe(() => player.getComponent("minecraft:inventory")?.container, undefined);
  if (!cont) return;
  const slot = player.selectedSlotIndex;
  const st = safe(() => cont.getItem(slot), undefined);
  if (!st) {
    say(a, "Segure o item que quer me dar.", { force: true });
    return;
  }
  if (st.typeId === "shadowbound:shadow_summoner") return;
  const stored = toStored(st);
  const left = a.inv.add(stored);
  const took = stored.n - left;
  if (took <= 0) {
    say(a, "Minha mochila está cheia!", { force: true });
    return;
  }
  const rest = left > 0 ? toStack({ ...stored, n: left }) : undefined;
  safe(() => cont.setItem(slot, rest), undefined);
  a.markDirty();
  const armor = equipBestArmor(a);
  say(a, `Guardei ${took} ${prettyItem(stored.id)}${armor.length ? ` e vesti ${armor.map(prettyItem).join(", ")}` : ""}. Obrigada!`, { force: true });
}

function openSettings(player: Player, a: Agent): void {
  const s = a.record.settings;
  const f = new ModalFormData()
    .title("Configurações")
    .toggle("Pode caçar animais para conseguir comida", { defaultValue: s.allowHunting })
    .toggle("Comer sozinha quando tiver fome", { defaultValue: s.autoEat })
    .toggle("Mensagens no chat (desligado = barra de ação)", { defaultValue: s.chatMessages })
    .toggle(`IA externa (só servidor BDS com ponte) ${bridgeAvailable() ? "§a[ponte conectada]" : "§7[sem ponte]"}`, { defaultValue: s.externalAI })
    .slider("Tempo para ressurgir (segundos)", 5, 120, { defaultValue: s.respawnSeconds })
    .slider("Reserva de comida (não come abaixo disso)", 0, 8, { defaultValue: s.foodReserve })
    .textField("Nome da sombra", a.record.shadowName, { defaultValue: a.record.shadowName })
    .submitButton("Salvar");
  show(player, () => f.show(player), (r) => {
    const v = r.formValues ?? [];
    s.allowHunting = !!v[0];
    s.autoEat = !!v[1];
    s.chatMessages = !!v[2];
    s.externalAI = !!v[3];
    s.respawnSeconds = Math.max(5, Math.min(120, Number(v[4] ?? TUNING.defaultRespawnSeconds)));
    s.foodReserve = Math.max(0, Math.min(8, Number(v[5] ?? TUNING.foodReserve)));
    const nm = typeof v[6] === "string" ? v[6].replace(/§./g, "").trim().slice(0, 16) : "";
    if (nm) {
      a.record.shadowName = nm;
      const b = a.body();
      if (b) safe(() => (b.nameTag = `${a.color().tag}${nm}`), undefined);
    }
    a.markDirty();
    a.save();
    say(a, "Configurações salvas.", { force: true });
  });
}

export function openSummon(player: Player): void {
  const f = new ActionFormData()
    .title("Invocar sombra")
    .body("Escolha sua companheira. Ela só obedece a você.\n\n§dLuna§r: bruxinha fofa e esperta, ataca à distância com magia.\n§cRaven§r: guerreira das sombras, fria e letal no corpo a corpo.")
    .button("§dLuna§r - a bruxinha")
    .button("§cRaven§r - a guerreira");
  show(player, () => f.show(player), (r) => {
    const persona = r.selection === 1 ? "raven" : "luna";
    const res = summon(player, persona);
    if (res === "failed") player.sendMessage("§cNão consegui invocar aqui. Tente num lugar aberto.");
  });
}

/** Ensure the executor exists so tasks start ticking right after summon. */
export function warm(a: Agent): void {
  executorOf(a);
}
