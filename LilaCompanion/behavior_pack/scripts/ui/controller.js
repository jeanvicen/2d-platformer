// Menu do Controle da Lila: campo de texto para ordens livres + botões rápidos e submenus.
// Só controla a Lila do próprio dono. O controle nunca é gasto.
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { BLUEPRINTS } from "../lib/blueprints.js";
import { loadCompanion } from "../lila/companion.js";
import { summon, dismiss } from "../lila/lifecycle.js";
import { command, handleIntents, inventoryText, statusText } from "../lila/brain.js";
import { goalLabel } from "../lila/goals.js";
import { show } from "./forms.js";
import { logError } from "../core/log.js";

const I = {
  write: "textures/items/book_writable",
  follow: "textures/items/feather",
  stay: "textures/items/bed_red",
  come: "textures/items/ender_pearl",
  auto: "textures/items/map_filled",
  wood: "textures/items/wood_axe",
  mine: "textures/items/iron_pickaxe",
  food: "textures/items/bread",
  build: "textures/items/door_wood",
  farm: "textures/items/wheat",
  craft: "textures/blocks/crafting_table_front",
  protect: "textures/items/iron_sword",
  explore: "textures/items/map_empty",
  give: "textures/blocks/chest_front",
  info: "textures/items/name_tag",
  pause: "textures/items/redstone_dust",
  settings: "textures/items/comparator",
  dismiss: "textures/items/ender_eye",
  summon: "textures/items/lila/controller",
  torch: "textures/blocks/torch_on",
  home: "textures/items/emerald",
  back: "textures/items/arrow",
};

const EXAMPLES = [
  "— escolha um exemplo —",
  "pega 32 madeira",
  "faz uma picareta de ferro",
  "minera 10 ferro e depois faz uma armadura de ferro",
  "constrói uma casa aqui",
  "faz uma plantação de trigo aqui",
  "arranja comida pra mim",
  "procura diamante",
  "coloca tochas por aqui",
  "me dá tudo",
  "aqui é a base",
  "vai pra casa",
  "constrói uma mansão aqui",
];

/**
 * Abre o menu principal do controle.
 * @param {import("@minecraft/server").Player} player
 */
export async function openController(player) {
  try {
    const c = loadCompanion(player);
    if (!c.rec.summoned || (!c.alive() && !c.rec.defeat)) {
      const f = new ActionFormData()
        .title("§l§2Controle da Lila")
        .body(c.rec.defeat
          ? `§7A Lila está se recuperando. Volta em §e${Math.ceil(c.rec.defeat.left / 20)}s§7.`
          : "§fA §aLila§f é sua companheira: coleta, minera, fabrica, constrói, planta, cozinha, explora e te protege.\n\n§7Quando você não pede nada, ela joga sozinha como uma jogadora de verdade.")
        .button("§l§2Invocar Lila", I.summon)
        .button("Como funciona", I.info);
      const r = await show(player, f);
      if (!r || r.canceled) return;
      if (r.selection === 0) summon(c, player);
      else if (r.selection === 1) await help(player);
      return;
    }
    const cur = c.urgent?.desc ?? c.job?.desc ?? c.rec.goals[0];
    const f = new ActionFormData()
      .title("§l§2Controle da Lila")
      .body(`§7${statusText(c)}\n§fAgora: §a${goalLabel(cur)}${c.rec.paused ? " §c(pausada)" : ""}`);
    /** @type {[string, string, () => any][]} */
    const buttons = [
      ["§l✎ Escrever ordem", I.write, () => writeOrder(player)],
      ["Me seguir", I.follow, () => handleIntents(c, [{ type: "follow" }])],
      ["Ficar aqui", I.stay, () => handleIntents(c, [{ type: "stay" }])],
      ["Vem aqui", I.come, () => handleIntents(c, [{ type: "come" }])],
      ["Modo livre (autônoma)", I.auto, () => handleIntents(c, [{ type: "auto" }])],
      ["Pegar madeira", I.wood, () => handleIntents(c, [{ type: "gather", item: { group: "log" }, count: 32 }])],
      ["Minerar…", I.mine, () => mineMenu(player)],
      ["Achar comida", I.food, () => handleIntents(c, [{ type: "food", count: 8, forOwner: true }])],
      ["Construir…", I.build, () => buildMenu(player)],
      ["Fazer plantação", I.farm, () => farmMenu(player)],
      ["Fabricar…", I.craft, () => craftMenu(player)],
      ["Me proteger", I.protect, () => handleIntents(c, [{ type: "protect" }])],
      ["Explorar", I.explore, () => handleIntents(c, [{ type: "explore", here: false }])],
      ["Colocar tochas", I.torch, () => handleIntents(c, [{ type: "torches", count: 16 }])],
      ["Me dá tudo", I.give, () => handleIntents(c, [{ type: "give", all: true }])],
      ["Ir para a base", I.home, () => handleIntents(c, [{ type: "home" }])],
      ["Inventário e status", I.info, () => infoMenu(player)],
      [c.rec.paused ? "Continuar" : "Pausar", I.pause, () => handleIntents(c, [{ type: c.rec.paused ? "resume" : "pause" }])],
      ["Configurações", I.settings, () => settingsMenu(player)],
      ["§cDispensar Lila", I.dismiss, () => dismiss(c)],
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
  const c = loadCompanion(player);
  const f = new ModalFormData()
    .title("§l§2Ordem para a Lila")
    .textField("§fO que a Lila deve fazer?\n§7Pode encadear: \"pega madeira e depois faz uma casa aqui\"", "ex.: minera ferro e faz uma picareta", { defaultValue: "" })
    .dropdown("§7ou toque num exemplo:", EXAMPLES, { defaultValueIndex: 0 })
    .submitButton("§lEnviar");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  const text = String(r.formValues[0] ?? "").trim();
  const ex = Number(r.formValues[1] ?? 0);
  const order = text || (ex > 0 ? EXAMPLES[ex] : "");
  if (!order) return;
  player.sendMessage(`§7Você » Lila: §f${order}`);
  command(c, order);
}

async function mineMenu(player) {
  const c = loadCompanion(player);
  /** @type {any[]} */
  const opts = [
    ["Pedra (pedregulho)", "textures/blocks/cobblestone", { id: "minecraft:cobblestone" }, 64],
    ["Carvão", "textures/items/coal", { group: "coal" }, 32],
    ["Ferro", "textures/items/iron_ingot", { id: "minecraft:iron_ingot", ore: "iron" }, 16],
    ["Cobre", "textures/items/copper_ingot", { id: "minecraft:copper_ingot", ore: "copper" }, 16],
    ["Ouro", "textures/items/gold_ingot", { id: "minecraft:gold_ingot", ore: "gold" }, 8],
    ["Redstone", "textures/items/redstone_dust", { id: "minecraft:redstone", ore: "redstone" }, 16],
    ["Lápis-lazúli", "textures/items/dye_powder_blue", { id: "minecraft:lapis_lazuli", ore: "lapis" }, 16],
    ["Diamante", "textures/items/diamond", { id: "minecraft:diamond", ore: "diamond" }, 5],
    ["Areia", "textures/blocks/sand", { id: "minecraft:sand" }, 32],
  ];
  const f = new ActionFormData().title("§lMinerar").body("§7Ela faz a picareta certa, desce até a camada do minério e volta com tudo.");
  for (const [t, icon] of opts) f.button(t, icon);
  f.button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection >= opts.length) return openController(player);
  const [, , item, n] = opts[r.selection];
  handleIntents(c, [{ type: "gather", item, count: n }]);
}

async function buildMenu(player) {
  const c = loadCompanion(player);
  const keys = Object.keys(BLUEPRINTS);
  const f = new ModalFormData()
    .title("§lConstruir")
    .dropdown("§fO que construir?", keys.map((k) => `${BLUEPRINTS[k].name} — ${BLUEPRINTS[k].desc}`), { defaultValueIndex: 0 })
    .toggle("§fBem aqui na minha frente", { defaultValue: true })
    .submitButton("§lConstruir");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  const key = keys[Number(r.formValues[0] ?? 0)];
  const here = !!r.formValues[1];
  handleIntents(c, [key === "fazenda" ? { type: "farm", here, crop: "minecraft:wheat_seeds" } : { type: "build", blueprint: key, here }]);
}

async function farmMenu(player) {
  const c = loadCompanion(player);
  const crops = [["Trigo", "minecraft:wheat_seeds"], ["Cenoura", "minecraft:carrot"], ["Batata", "minecraft:potato"], ["Beterraba", "minecraft:beetroot_seeds"]];
  const f = new ModalFormData()
    .title("§lPlantação")
    .dropdown("§fO que plantar?", crops.map((x) => x[0]), { defaultValueIndex: 0 })
    .toggle("§fBem aqui na minha frente", { defaultValue: true })
    .submitButton("§lPlantar");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  handleIntents(c, [{ type: "farm", here: !!r.formValues[1], crop: crops[Number(r.formValues[0] ?? 0)][1] }]);
}

async function craftMenu(player) {
  const c = loadCompanion(player);
  /** @type {any[]} */
  const opts = [
    ["Picareta (melhor possível)", "textures/items/iron_pickaxe", { toolKind: "pickaxe" }, 1],
    ["Machado", "textures/items/iron_axe", { toolKind: "axe" }, 1],
    ["Espada", "textures/items/iron_sword", { toolKind: "sword" }, 1],
    ["Pá", "textures/items/iron_shovel", { toolKind: "shovel" }, 1],
    ["Enxada", "textures/items/iron_hoe", { toolKind: "hoe" }, 1],
    ["16 tochas", "textures/blocks/torch_on", { id: "minecraft:torch" }, 16],
    ["Baú", "textures/blocks/chest_front", { id: "minecraft:chest" }, 1],
    ["Fornalha", "textures/blocks/furnace_front_off", { id: "minecraft:furnace" }, 1],
    ["Bancada", "textures/blocks/crafting_table_front", { id: "minecraft:crafting_table" }, 1],
    ["8 pães", "textures/items/bread", { id: "minecraft:bread" }, 8],
    ["Armadura de ferro (peitoral)", "textures/items/iron_chestplate", { id: "minecraft:iron_chestplate" }, 1],
    ["Escudo", "textures/items/shield", { id: "minecraft:shield" }, 1],
    ["Balde", "textures/items/bucket_empty", { id: "minecraft:bucket" }, 1],
    ["Cama", "textures/items/bed_red", { id: "minecraft:bed" }, 1],
  ];
  const f = new ActionFormData().title("§lFabricar").body("§7Ela junta os materiais que faltarem, fabrica e te entrega.");
  for (const [t, icon] of opts) f.button(t, icon);
  f.button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled || r.selection === undefined) return;
  if (r.selection >= opts.length) return openController(player);
  const [, , item, n] = opts[r.selection];
  handleIntents(c, [{ type: "craft", item, count: n }]);
}

async function infoMenu(player) {
  const c = loadCompanion(player);
  const s = c.rec.stats;
  const base = c.rec.base ? `${c.rec.base.x}, ${c.rec.base.y}, ${c.rec.base.z}` : "não definida";
  const queue = c.rec.goals.map((g, i) => `${i + 1}. ${goalLabel(g)}`).join("\n") || "§7(vazia)";
  const f = new ActionFormData()
    .title("§lLila — status")
    .body(`§f${statusText(c)}\n\n§2Fila de ordens:§f\n${queue}\n\n§2Inventário:§f\n${inventoryText(c)}\n\n§2Base:§f ${base}\n§2Recordes:§f ${s.blocks} blocos quebrados · ${s.crafted} itens fabricados · ${s.kills} monstros derrotados · ${s.built} construções`)
    .button("Me dá tudo", I.give)
    .button("Guardar no baú da base", "textures/blocks/chest_front")
    .button("Cancelar a fila", "textures/blocks/barrier")
    .button("Voltar", I.back);
  const r = await show(player, f);
  if (!r || r.canceled) return;
  if (r.selection === 0) handleIntents(c, [{ type: "give", all: true }]);
  else if (r.selection === 1) handleIntents(c, [{ type: "deposit" }]);
  else if (r.selection === 2) handleIntents(c, [{ type: "stop" }]);
  else if (r.selection === 3) return openController(player);
}

async function settingsMenu(player) {
  const c = loadCompanion(player);
  const st = c.rec.settings;
  const hud = ["auto", "always", "off"];
  const chat = ["normal", "pouco", "silencio"];
  const f = new ModalFormData()
    .title("§lConfigurações da Lila")
    .dropdown("§fIndicador de posição (HUD)", ["Automático (quando longe ou com o controle)", "Sempre visível", "Desligado"], { defaultValueIndex: Math.max(0, hud.indexOf(st.hud)) })
    .dropdown("§fConversa no chat", ["Normal", "Pouca", "Só respostas"], { defaultValueIndex: Math.max(0, chat.indexOf(st.chat)) })
    .toggle("§fPode caçar animais (comida, couro, lã)", { defaultValue: !!st.hunt })
    .slider("§fDistância máxima para explorar sozinha (blocos)", 32, 256, { valueStep: 16, defaultValue: st.roam ?? 96 })
    .submitButton("§lSalvar");
  const r = await show(player, f);
  if (!r || r.canceled || !r.formValues) return;
  st.hud = hud[Number(r.formValues[0] ?? 0)];
  st.chat = chat[Number(r.formValues[1] ?? 0)];
  st.hunt = !!r.formValues[2];
  st.roam = Number(r.formValues[3] ?? 96);
  c.save();
  player.sendMessage("§a[Lila]§r Configurações salvas.");
}

async function help(player) {
  const f = new ActionFormData()
    .title("§lComo funciona")
    .body([
      "§2Controle:§f use (toque/clique direito) para abrir o menu. Toque na Lila segurando o controle para falar com ela.",
      "§2Ordens em texto:§f escreva do seu jeito: \"pega 20 madeira\", \"minera ferro\", \"faz uma picareta de diamante\", \"constrói uma casa aqui\", \"planta cenoura\", \"me dá tudo\", \"me segue\", \"fica aqui\".",
      "§2Pelo chat:§f /lila pega 32 madeira",
      "§2Sozinha:§f no modo livre ela faz ferramentas, junta recursos, constrói a casinha dela, planta, cozinha, dorme à noite, explora e te protege.",
      "§2Derrota:§f se cair em batalha, volta em 20 segundos e continua o que estava fazendo.",
      "§2Força:§f 100 de vida, bate 5× mais forte que você com a mesma arma.",
    ].join("\n\n"))
    .button("Entendi!");
  await show(player, f);
}
