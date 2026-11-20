// Menu do Controle do DR-0N: ordem por texto + botões (formas, colosso, torreta, exército,
// megaconstruções, biomas, itens infinitos, kit de força...). "Cancelar" sempre volta ao normal.
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { BLUEPRINTS } from "../lib/blueprints.js";
import { BIOMES, CREATIVE_ITEMS, FORM_NAMES, MEGA, SWARM_SHAPES } from "../lib/catalog.js";
import { loadCompanion } from "../lila/companion.js";
import { summon, dismiss } from "../lila/lifecycle.js";
import { command, handleIntents, inventoryText, statusText } from "../lila/brain.js";
import { goalLabel } from "../lila/goals.js";
import { missions } from "../lila/drone.js";
import { formOf, isRideForm, isVehicle, beam, roar, stomp, switchSeat, mountOwner, riders, jumpAction, tractor } from "../lila/forms.js";
import { shieldOn } from "../lila/swarm.js";
import * as A from "../lib/archgen.js";
import { armyActive, command as armyCommand, empower, robotsOf } from "../lila/army.js";
import { findItemType } from "../lila/creative.js";
import { say } from "../lila/talk.js";
import { show } from "./forms.js";
import { logError } from "../core/log.js";

const I = {
  write: "textures/items/book_writable",
  follow: "textures/items/feather",
  stay: "textures/items/bed_red",
  come: "textures/items/ender_pearl",
  auto: "textures/items/map_filled",
  protect: "textures/items/netherite_sword",
  info: "textures/items/name_tag",
  settings: "textures/items/comparator",
  dismiss: "textures/items/ender_eye",
  cancel: "textures/blocks/barrier",
  ride: "textures/items/saddle",
  turret: "textures/items/crossbow_standby",
  scan: "textures/items/spyglass",
  missions: "textures/items/book_enchanted",
  memory: "textures/items/map_filled",
  drone: "textures/items/lila/drone_controller",
  back: "textures/items/arrow",
  vehicle: "textures/items/minecart_normal",
  colossus: "textures/items/nether_star",
  army: "textures/items/iron_horse_armor",
  build: "textures/blocks/stonebrick",
  biome: "textures/blocks/sapling_oak",
  creative: "textures/blocks/chest_front",
  kit: "textures/items/totem",
  flatten: "textures/items/diamond_shovel",
  sweep: "textures/items/hopper",
  swarm: "textures/items/glowstone_dust",
  house: "textures/items/door_wood",
};

const EXAMPLES = [
  "— escolha um exemplo —",
  "vira helicóptero",
  "modo colosso",
  "modo enxame",
  "enxame faz uma ponte",
  "vira submarino",
  "vira nave espacial",
  "constrói uma padaria pequena estilo medieval",
  "constrói uma casa moderna grande",
  "modo exército com 10 robôs",
  "constrói um castelo aqui",
  "faz uma cidade inteira",
  "faz uma montanha russa",
  "transforma aqui em neve",
  "me dá 64 diamantes",
  "me fortalece",
  "me protege",
  "deixa tudo plano",
  "recolhe os itens do chão",
  "constrói devagar",
  "volta ao normal",
];

const comp = (player) => loadCompanion(player, "drone");
const SPEED_KEYS = ["humano", "normal", "rapido", "instantaneo"];

/**
 * Abre o menu principal do controle.
 * @param {import("@minecraft/server").Player} player
 */
export async function openController(player) {
  try {
    const c = comp(player);
    // pilotando: painel do piloto
    if (c.alive() && isRideForm(formOf(c)) && riders(c).some((r) => r.id === player.id)) return pilotPanel(player);
    if (!c.rec.summoned || (!c.alive() && !c.rec.defeat && !armyActive(c))) {
      const f = new ActionFormData()
        .title("§l§bControle do DR-0N")
        .body(c.rec.defeat
          ? `§7O DR-0N está se recuperando. Volta em §e${Math.ceil(c.rec.defeat.left / 20)}s§7.`
          : "§fO §bDR-0N§f é um drone com §eitens infinitos§f: vira §bhelicóptero, carro, escavadeira, tanque, jato e moto§f, vira §ctorreta gigante§f, vira o §6colosso TITÃ§f, se divide num §aexército de robôs§f, constrói §ecidades, castelos, montanhas-russas§f e transforma biomas.")
        .button("§l§bInvocar DR-0N", I.drone)
        .button("Como funciona", I.info);
      const r = await show(player, f);
      if (!r || r.canceled) return;
      if (r.selection === 0) summon(c, player);
      else if (r.selection === 1) await help(player);
      return;
    }
    const cur = c.urgent?.desc ?? c.job?.desc ?? c.rec.goals[0];
    const army = armyActive(c);
    const f = new ActionFormData()
      .title("§l§bControle do DR-0N")
      .body(`§7${statusText(c)}\n§fAgora: §a${army ? `exército (${robotsOf(c).length} robôs)` : goalLabel(cur)}${c.rec.paused ? " §c(pausado)" : ""}`);
    /** @type {[string, string, () => any][]} */
    const buttons = [
      ["§l✎ Escrever ordem", I.write, () => writeOrder(player)],
      ["§c§l✖ Cancelar tudo §r§c(volta ao normal)", I.cancel, () => handleIntents(c, [{ type: "stop" }])],
      ["§bVeículos…", I.vehicle, () => vehicleMenu(player)],
      [formOf(c) === "colossus" ? "§6Subir no TITÃ (em cima da cabeça)" : "§6§lRobô gigante TITÃ", I.colossus, () => (formOf(c) === "colossus" ? mountOwner(c, player) : handleIntents(c, [{ type: "form", form: "colossus" }]))],
      [formOf(c) === "swarm" ? "§d§lEnxame: formas e poderes…" : "§d§lModo ENXAME (nanorrobôs)", I.swarm, () => (formOf(c) === "swarm" ? swarmMenu(player) : handleIntents(c, [{ type: "swarm" }]))],
      [c.rec.mode === "turret" ? "§cDesmontar a torreta" : "§cTorreta gigante", I.turret, () => handleIntents(c, [{ type: c.rec.mode === "turret" ? "stop" : "turret" }])],
      [army ? "§aComandar o exército…" : "§aModo EXÉRCITO", I.army, () => (army ? armyMenu(player) : handleIntents(c, [{ type: "army", count: c.rec.settings.army ?? 10 }]))],
      ["§eConstruções gigantes…", I.build, () => buildMenu(player)],
      ["§eCatálogo: 1000+ construções…", I.house, () => archMenu(player)],
      ["§2Transformar bioma…", I.biome, () => biomeMenu(player)],
      ["§6Aplainar / destruir em volta…", I.flatten, () => flattenMenu(player)],
      ["§6Recolher os itens do chão", I.sweep, () => handleIntents(c, [{ type: "vacuum", radius: 32 }])],
      ["§dItens infinitos…", I.creative, () => creativeMenu(player)],
      ["§dMe fortalecer (kit encantado)", I.kit, () => handleIntents(c, [{ type: "kit" }])],
      ["§4Me proteger (ataca primeiro)", I.protect, () => handleIntents(c, [{ type: "protect" }])],
      ["Me seguir", I.follow, () => handleIntents(c, [{ type: "follow" }])],
      ["Ficar aqui", I.stay, () => handleIntents(c, [{ type: "stay" }])],
      ["Vem aqui", I.come, () => handleIntents(c, [{ type: "come" }])],
      ["Carona (subir no drone)", I.ride, () => handleIntents(c, [{ type: "ride" }])],
      ["Modo livre", I.auto, () => handleIntents(c, [{ type: "auto" }])],
      ["Escanear você", I.scan, () => handleIntents(c, [{ type: "scan" }])],
      ["Missões", I.missions, () => missionsMenu(player)],
      ["Memórias", I.memory, () => memoriesMenu(player)],
      ["Inventário e status", I.info, () => infoMenu(player)],
      ["Configurações", I.settings, () => settingsMenu(player)],
      ["§cDispensar DR-0N", I.dismiss, () => dismiss(c)],
    ];
    for (const [t, icon] of buttons) f.button(t, icon);
    const r = await show(player, f);
    if (!r || r.canceled || r.selection === undefined) return;
    await buttons[r.selection][2]();
  } catch (e) {
    logError("ui.controller", e);
  }
}

async function writeOrder(player) {
  const c = comp(player);
  const f = new ModalFormData()
    .title("§l§bOrdem para o DR-0N")
    .textField("§fO que o DR-0N deve fazer?\n§7Ex.: \"vira tanque\", \"constrói uma vila\", \"me dá um élitro\"", "ex.: modo colosso", { defaultValue: "" })
    .dropdown("§7ou toque num exemplo:", EXAMPLES, { defaultValueIndex: 0 })
    .submitButton("§lEnviar");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  const text = String(r.formValues[0] ?? "").trim();
  const ex = Number(r.formValues[1] ?? 0);
  const order = text || (ex > 0 ? EXAMPLES[ex] : "");
  if (!order) return;
  player.sendMessage(`§7Você » DR-0N: §f${order}`);
  command(c, order);
}

async function vehicleMenu(player) {
  const c = comp(player);
  const list = [["heli", "textures/items/elytra"], ["car", "textures/items/minecart_normal"], ["moto", "textures/items/saddle"],
    ["truck", "textures/items/minecart_chest"], ["excavator", "textures/items/iron_shovel"], ["tank", "textures/items/fireworks"],
    ["jet", "textures/items/elytra"], ["stealth", "textures/items/phantom_membrane"], ["ship", "textures/items/nether_star"],
    ["ufo", "textures/items/ender_eye"], ["boat", "textures/items/boat_oak"], ["sub", "textures/items/heart_of_the_sea"]];
  const f = new ActionFormData().title("§l§bVeículos")
    .body("§fEle vira o veículo e você já entra (a capota recolhe: você enxerga tudo).\n§7Andar = acelerar · olhar = direção (voadores sobem/descem para onde você olha) · pular = pular/subir · bater = arma · §fAGACHAR = sair§7 (ele volta a ser drone). Outros jogadores entram de carona tocando no veículo.");
  for (const [k, icon] of list) f.button(`§l${FORM_NAMES[k][0].toUpperCase()}${FORM_NAMES[k].slice(1)}`, icon);
  f.button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection >= list.length) return openController(player);
  handleIntents(c, [{ type: "form", form: list[r.selection][0] }]);
}

/** Enxame de nanorrobôs: formas e poderes. */
async function swarmMenu(player) {
  const c = comp(player);
  const keys = Object.keys(SWARM_SHAPES);
  const f = new ActionFormData().title("§l§dEnxame de nanorrobôs")
    .body(`§fMilhares de nanorrobôs. Eles continuam fazendo tudo que o drone faz e picam sozinhos os monstros perto de você.\n§7Escudo: ${shieldOn(c) ? "§aLIGADO (nada te acerta)" : "§cdesligado"}`);
  for (const k of keys) f.button(k === "escudo" ? `${SWARM_SHAPES[k].name}: ${shieldOn(c) ? "§cdesligar" : "§aligar"}` : SWARM_SHAPES[k].name, I.swarm);
  f.button("§c✖ Voltar a ser drone", I.cancel);
  f.button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection === keys.length) return handleIntents(c, [{ type: "stop" }]);
  if (r.selection > keys.length) return openController(player);
  handleIntents(c, [{ type: "swarm", shape: keys[r.selection] }]);
}

/** Catálogo de 1000+ construções (tipo × estilo × tamanho), todas mobiliadas por dentro. */
async function archMenu(player) {
  const c = comp(player);
  const cats = A.CATEGORIES;
  const f = new ActionFormData().title("§l§eCatálogo de construções")
    .body(`§f${A.TOTAL} construções diferentes (${A.TYPES.length} tipos × ${A.STYLES.length} estilos × ${A.SIZES.length} tamanhos + ${A.OBJECTS.length} objetos/decorações), todas com interior arrumado e mobiliado.\n§7Ele constrói à mão, voando, bloco por bloco (velocidade em Configurações).`);
  for (const cat of cats) f.button(`§l${cat.name}`, I.house);
  f.button("§dSurpresa (uma aleatória)", I.creative);
  f.button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection === cats.length) {
    const t = A.TYPES[Math.floor(Math.random() * A.TYPES.length)];
    return handleIntents(c, [{ type: "arch", kind: t.key, style: A.STYLES[Math.floor(Math.random() * A.STYLES.length)].key, size: A.SIZES[Math.floor(Math.random() * 3)].key }]);
  }
  if (r.selection > cats.length) return openController(player);
  const cat = cats[r.selection];
  const types = A.TYPES.filter((t) => t.cat === cat.key);
  const isObj = cat.key === "objetos";
  const items = isObj ? A.OBJECTS : types;
  const m = new ModalFormData().title(`§l${cat.name}`)
    .dropdown("O quê?", items.map((t) => t.name), { defaultValueIndex: 0 })
    .dropdown("Estilo", A.STYLES.map((s) => s.name), { defaultValueIndex: 0 });
  if (!isObj) m.dropdown("Tamanho", A.SIZES.map((s) => s.name), { defaultValueIndex: 1 });
  m.submitButton("§lConstruir aqui");
  const r2 = await show(player, m);
  if (!r2 || r2.canceled || !r2.formValues) return;
  const it = items[Number(r2.formValues[0] ?? 0)];
  const st = A.STYLES[Number(r2.formValues[1] ?? 0)];
  const sz = isObj ? A.SIZES[1] : A.SIZES[Number(r2.formValues[2] ?? 1)];
  handleIntents(c, [{ type: "arch", kind: it.key, style: st.key, size: sz.key }]);
}

/** Painel de quem está pilotando (usar o controle dentro do veículo/colosso). */
async function pilotPanel(player) {
  const c = comp(player);
  const f = formOf(c);
  const col = f === "colossus";
  /** @type {[string, string, () => any][]} */
  const b = col ? [
    ["§l§cRaio do visor", I.colossus, () => beam(c, player)],
    ["§6Pose de poder (monstros ficam fracos)", "textures/items/goat_horn", () => roar(c)],
    ["§eSalto com pisão", "textures/items/iron_boots", () => jumpAction(c)],
    ["§ePisão (onda de choque)", "textures/items/iron_boots", () => stomp(c)],
    ["Ir para a cabeça (pilotar)", I.ride, () => switchSeat(c, player, true)],
    ["Ir para uma ombreira", I.ride, () => switchSeat(c, player, false) || say(c, "Precisa de alguém na cabeça pra você ir pra ombreira.", { force: true })],
    ["Sair (ele fica TITÃ)", I.back, () => exit(c, player)],
    ["§c✖ Voltar a ser drone", I.cancel, () => handleIntents(c, [{ type: "stop" }])],
  ] : [
    .../** @type {[string, string, () => any][]} */ (f === "ufo" ? [["§dRaio trator (abduzir)", "textures/items/ender_eye", () => tractor(c)]] : []),
    ["Sair (vira drone de novo)", I.back, () => exit(c, player)],
    ["§c✖ Cancelar tudo", I.cancel, () => handleIntents(c, [{ type: "stop" }])],
  ];
  const weapon = ({ heli: "metralhadora", tank: "canhão", jet: "mísseis", stealth: "mísseis", excavator: "cavar", car: "turbo", moto: "turbo",
    truck: "turbo", boat: "turbo", ship: "lasers", ufo: "raio desintegrador (olhando pra baixo: raio trator)", sub: "torpedo" })[f] ?? "arma";
  const form = new ActionFormData().title(`§l§bPainel — ${FORM_NAMES[f]}`)
    .body(col
      ? "§fVocê está em cima da cabeça do TITÃ: quase imortal aqui.\n§7andar = mover · bater perto = soco · mirar longe + bater = raio do visor · pular = salto com pisão · agachar = sair"
      : `§fPilotando: ${FORM_NAMES[f]}.\n§7bater = ${weapon} · pular = ${["heli", "ship", "ufo", "sub"].includes(f) ? "subir" : f === "jet" || f === "stealth" ? "pós-combustor" : "pular"} · agachar = sair`);
  for (const [t, icon] of b) form.button(t, icon);
  const r = await show(player, form);
  if (!r || r.canceled || r.selection === undefined) return;
  await b[r.selection][2]();
}

function exit(c, player) {
  try {
    player.inputPermissions.setPermissionCategory(8, true);
    c.entity?.getComponent("minecraft:rideable")?.ejectRider(player);
  } catch {
    /* ignore */
  }
}

async function armyMenu(player) {
  const c = comp(player);
  const n = robotsOf(c).length;
  /** @type {[string, string, () => any][]} */
  const b = [
    ["§aProteger (atacam primeiro)", I.protect, () => armyCommand(c, "guard", player)],
    ["Me seguir", I.follow, () => armyCommand(c, "follow", player)],
    ["Ficar aqui", I.stay, () => armyCommand(c, "stay", player)],
    ["§cAtacar o que estou olhando", I.turret, () => armyCommand(c, "attack", player)],
    ["Ir até onde estou olhando", I.come, () => armyCommand(c, "goto", player)],
    ["Formação em círculo", I.army, () => armyCommand(c, "circle", player)],
    ["§dMe fortalecer (kit + efeitos)", I.kit, () => empower(c, player)],
    ["§c✖ Juntar e voltar ao drone", I.cancel, () => handleIntents(c, [{ type: "stop" }])],
  ];
  const f = new ActionFormData().title("§l§aExército DR-0N").body(`§f${n} robôs ativos.\n§7Eles caçam monstros, revidam em quem te atacar (jogador também), atiram laser e trazem o que você precisar: cura, comida, armadura, visão noturna, respiração na água, resistência a fogo e queda lenta.`);
  for (const [t, icon] of b) f.button(t, icon);
  f.button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection >= b.length) return openController(player);
  await b[r.selection][2]();
}

async function buildMenu(player) {
  const c = comp(player);
  const mega = Object.keys(MEGA);
  const small = Object.keys(BLUEPRINTS);
  const names = [...mega.map((k) => `§e${MEGA[k].name}§r — ${MEGA[k].desc}`), ...small.map((k) => `${BLUEPRINTS[k].name} — ${BLUEPRINTS[k].desc}`)];
  const f = new ModalFormData()
    .title("§l§eConstruções gigantes")
    .dropdown(`§fO que construir? §7(material infinito · construção ${({ humano: "à mão, bloco por bloco", normal: "normal", rapido: "rápida", instantaneo: "instantânea" })[c.rec.settings.buildSpeed ?? "humano"]} — muda em Configurações)`, names, { defaultValueIndex: 0 })
    .toggle("§fBem aqui na minha frente", { defaultValue: true })
    .submitButton("§lConstruir");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  const i = Number(r.formValues[0] ?? 0);
  const here = !!r.formValues[1];
  if (i < mega.length) handleIntents(c, [{ type: "mega", key: mega[i], here }]);
  else {
    const key = small[i - mega.length];
    handleIntents(c, [key === "fazenda" ? { type: "farm", here, crop: "minecraft:wheat_seeds" } : { type: "build", blueprint: key, here }]);
  }
}

async function flattenMenu(player) {
  const c = comp(player);
  const radii = [12, 16, 24, 32, 48, 64];
  const f = new ModalFormData()
    .title("§l§6Aplainar / destruir em volta")
    .dropdown("§fRaio em volta de você (blocos)", radii.map(String), { defaultValueIndex: 2 })
    .toggle("§cDestruir TUDO, inclusive construções §7(baús, camas e blocos com itens ficam)", { defaultValue: false })
    .submitButton("§lDeixar plano");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  handleIntents(c, [{ type: "flatten", radius: radii[Number(r.formValues[0] ?? 2)], all: !!r.formValues[1] }]);
}

async function biomeMenu(player) {
  const c = comp(player);
  const keys = Object.keys(BIOMES);
  const f = new ActionFormData().title("§l§2Transformar bioma")
    .body("§fTransforma tudo num raio de 36 blocos em volta de você: chão, árvores, plantas, água.\n§7(O jogo não deixa trocar o ID do bioma por script: a cor da grama e o clima continuam os de antes.)");
  for (const k of keys) f.button(`§l${BIOMES[k].name}`, I.biome);
  f.button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection >= keys.length) return openController(player);
  handleIntents(c, [{ type: "biome", biome: keys[r.selection] }]);
}

async function creativeMenu(player) {
  const c = comp(player);
  const quick = CREATIVE_ITEMS.slice(0, 40);
  const f = new ModalFormData()
    .title("§l§dItens infinitos")
    .dropdown("§fEscolha um item", ["— digitar abaixo —", ...quick.map((x) => `${x.w[0]} (${x.id.replace("minecraft:", "")})`)], { defaultValueIndex: 0 })
    .textField("§fou digite o nome (pt ou id do jogo, ex.: beacon, netherite_sword)", "ex.: tridente", { defaultValue: "" })
    .slider("§fQuantidade", 1, 64, { valueStep: 1, defaultValue: 64 })
    .submitButton("§lPegar");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  const pick = Number(r.formValues[0] ?? 0);
  const text = String(r.formValues[1] ?? "").trim();
  const n = Number(r.formValues[2] ?? 1);
  let id = pick > 0 ? quick[pick - 1].id : undefined;
  if (!id && text) {
    const hit = CREATIVE_ITEMS.find((x) => x.w.includes(text.toLowerCase()));
    id = hit?.id ?? findItemType(text);
  }
  if (!id) {
    say(c, "Não achei esse item. Tenta o nome do jogo em inglês (ex.: golden_apple).", { force: true });
    return;
  }
  handleIntents(c, [{ type: "give", item: { id }, count: n, creative: true }]);
}

async function infoMenu(player) {
  const c = comp(player);
  const s = c.rec.stats;
  const f = new ActionFormData()
    .title("§lDR-0N — status")
    .body(`§f${statusText(c)}\n\n§bInventário:§f\n${inventoryText(c)}\n\n§bRecordes:§f ${s.kills} inimigos derrotados · ${s.built} construções · ${s.crafted} itens fabricados`)
    .button("Me dá tudo", I.creative)
    .button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled) return;
  if (r.selection === 0) handleIntents(c, [{ type: "give", all: true }]);
  else return openController(player);
}

async function settingsMenu(player) {
  const c = comp(player);
  const st = c.rec.settings;
  const hud = ["auto", "always", "off"];
  const chat = ["normal", "pouco", "silencio"];
  const f = new ModalFormData()
    .title("§lConfigurações do DR-0N")
    .dropdown("§fIndicador de posição (HUD)", ["Automático", "Sempre visível", "Desligado"], { defaultValueIndex: Math.max(0, hud.indexOf(st.hud)) })
    .dropdown("§fConversa no chat", ["Normal", "Pouca", "Só respostas"], { defaultValueIndex: Math.max(0, chat.indexOf(st.chat)) })
    .slider("§fRobôs no modo exército", 1, 24, { valueStep: 1, defaultValue: st.army ?? 10 })
    .dropdown("§fVelocidade de construção", ["À mão, bloco por bloco (devagar, como jogador)", "Normal", "Rápido", "Instantâneo (tudo de uma vez)"],
      { defaultValueIndex: Math.max(0, SPEED_KEYS.indexOf(st.buildSpeed ?? "humano")) })
    .toggle("§fArmas quebram blocos (colosso, canhão, mísseis)", { defaultValue: st.destroy !== false })
    .toggle("§fRevidar quando EU bater nele (lição de leve)", { defaultValue: st.lesson !== false })
    .submitButton("§lSalvar");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  st.hud = hud[Number(r.formValues[0] ?? 0)];
  st.chat = chat[Number(r.formValues[1] ?? 0)];
  st.army = Number(r.formValues[2] ?? 10);
  st.buildSpeed = SPEED_KEYS[Number(r.formValues[3] ?? 0)];
  st.destroy = !!r.formValues[4];
  st.lesson = !!r.formValues[5];
  c.save();
  player.sendMessage("§b[DR-0N]§r Configurações salvas.");
}

async function help(player) {
  const f = new ActionFormData()
    .title("§lComo funciona")
    .body([
      "§bControle:§f use para abrir o menu. Toque no drone segurando o controle para falar com ele; de mão vazia você sobe nele.",
      "§bOrdens em texto:§f \"vira helicóptero\", \"modo colosso\", \"modo exército\", \"constrói um castelo\", \"faz uma cidade\", \"transforma aqui em neve\", \"me dá um élitro\", \"me fortalece\", \"me protege\", \"volta ao normal\".",
      "§bPelo chat:§f /drone vira tanque",
      "§bCancelar tudo:§f larga o que estiver fazendo e volta a ser o drone normal (junta o exército, desfaz veículo/colosso/torreta).",
      "§bProteção:§f no modo proteger ele ataca primeiro. Quem bater em você ou nele vira alvo, até outro jogador.",
      "§bDerrota:§f se cair, volta em 20 segundos.",
    ].join("\n\n"))
    .button("Entendi!");
  await show(player, f);
}

async function missionsMenu(player) {
  const c = comp(player);
  const ms = missions(c);
  const f = new ActionFormData().title("§l§bMissões do DR-0N").body(`§7Missões concluídas: §e${c.rec.stats.missions ?? 0}§7.`);
  for (const m of ms) f.button(`${m.done ? "§a✔ " : ""}${m.title}\n§8${m.desc} (${Math.min(m.have, m.need)}/${m.need})`, I.missions);
  f.button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection >= ms.length) return openController(player);
  const m = ms[r.selection];
  if (m.done) {
    say(c, `Essa missão já está cumprida: ${m.title}.`, { force: true });
    return;
  }
  handleIntents(c, [{ type: "stop" }]);
  c.rec.goals.push({ type: "mission", args: { key: m.key }, origin: "cmd", label: m.title });
  c.save();
}

async function memoriesMenu(player) {
  const c = comp(player);
  const diary = (c.rec.diary ?? []).slice(-12).reverse().map((d) => `§7•§f ${d.msg}`).join("\n") || "§7(ainda sem memórias)";
  const f = new ActionFormData().title("§l§bMemórias do DR-0N")
    .body(`§bDiário:§f\n${diary}\n\n§bÁreas mapeadas:§f ${c.mem.explored.length}\n§bMissões concluídas:§f ${c.rec.stats.missions ?? 0}`)
    .button("Voltar", I.back);
  const r = await show(player, f);
  if (r && !r.canceled) return openController(player);
}

export { isVehicle };
