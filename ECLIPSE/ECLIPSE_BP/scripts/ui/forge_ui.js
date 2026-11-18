// Forja de Sombras: catálogo por categoria + busca por texto (assistente local, offline).
import { CATALOG, CATEGORIES, NOT_FOUND, searchCatalog } from "../lib/forge_catalog.js";
import { ELEMENTS } from "../core/config.js";
import { actionbar, playerSound } from "../core/fx.js";
import { give, hasItem, makeItem } from "../core/items.js";
import { getProfile, markDirty } from "../core/player_profile.js";
import { ask, menu } from "./forms.js";
import { giveTempTool, materializeFx, materializeRelic } from "../abilities/relics.js";
import { summon } from "../summoning/summon_manager.js";
import { summonLyra } from "../lyra/lyra_manager.js";
import { useShadowHand } from "../abilities/shadow_creation.js";
import { setMode } from "../modes/mode_manager.js";

const ICON = {
  relic: (k) => `textures/items/eclipse/${k}`,
  tool: (k) => `textures/items/eclipse/${k}`,
  item: (k) => `textures/items/eclipse/${k}`,
  wings: (k) => `textures/items/eclipse/${k}`,
  creature: () => "textures/items/eclipse/legion_sigil",
  lyra: () => "textures/items/eclipse/lyra_bond",
  element: () => "textures/items/eclipse/element_prism",
  construct: () => "textures/items/eclipse/shadow_hand",
};

export async function openForge(player) {
  const sel = await menu(player, "§5§lForja de Sombras", "§7Escolha uma categoria ou §fescreva§7 o que você quer criar.", [
    { text: "§l🔎 Escrever o que quero…", icon: "textures/items/eclipse/codex" },
    ...CATEGORIES.map((c) => ({ text: `§l${c.name}`, icon: c.icon })),
  ]);
  if (sel < 0) return;
  if (sel === 0) return searchFlow(player);
  const cat = CATEGORIES[sel - 1];
  const list = CATALOG.filter((e) => e.cat === cat.id);
  return pickFrom(player, cat.name, list);
}

async function searchFlow(player) {
  const q = await ask(player, "Forja de Sombras", "O que você quer criar?", "ex.: martelo, asas de anjo, lobo, ponte");
  if (!q) return;
  const res = searchCatalog(q);
  if (!res.length) {
    await menu(player, "Forja de Sombras", `§7"${q}"\n\n§f${NOT_FOUND}`, ["Tentar de novo", "Ver catálogo"]).then((r) => (r === 0 ? searchFlow(player) : r === 1 ? openForge(player) : undefined));
    return;
  }
  if (res.length === 1) return confirm(player, res[0]);
  return pickFrom(player, `Resultados: "${q}"`, res);
}

async function pickFrom(player, titleText, list) {
  const r = await menu(player, titleText, "§7Toque para ver detalhes e materializar.", list.map((e) => ({ text: `§l${e.name}§r\n§7${e.desc}`, icon: ICON[e.action.type]?.(e.action.key) })));
  if (r < 0) return;
  return confirm(player, list[r]);
}

async function confirm(player, entry) {
  // Todo o catálogo está liberado (itens da Forja não dependem de nível; técnicas sim, se a progressão clássica estiver ligada).
  const r = await menu(player, entry.name, `§f${entry.desc}\n\n§7Requisito: §aliberado§7 · Categoria: §f${entry.cat}`, [
    { text: "§l✦ Materializar", icon: ICON[entry.action.type]?.(entry.action.key) },
    { text: "Voltar", icon: "textures/items/eclipse/relic_recall" },
  ]);
  if (r !== 0) return r === 1 ? openForge(player) : undefined;
  execute(player, entry);
}

export function execute(player, entry) {
  const { type, key } = entry.action;
  switch (type) {
    case "relic":
      materializeRelic(player, key);
      break;
    case "tool":
      giveTempTool(player, key);
      break;
    case "item":
    case "wings":
      if (hasItem(player, `eclipse:${key}`)) {
        actionbar(player, "§7Você já tem este item.");
        return;
      }
      give(player, makeItem(`eclipse:${key}`, { keep: true }));
      materializeFx(player, key);
      break;
    case "creature":
      summon(player, key);
      break;
    case "lyra":
      summonLyra(player);
      break;
    case "element": {
      const p = getProfile(player);
      p.element = key;
      markDirty(player);
      if (p.mode !== "haze") setMode(player, "haze");
      actionbar(player, `${ELEMENTS[key].color}✦ Elemento ${ELEMENTS[key].name} ativo (Modo Haze)`);
      break;
    }
    case "construct": {
      const p = getProfile(player);
      p.construct = key;
      markDirty(player);
      useShadowHand(player, key);
      break;
    }
    default:
      break;
  }
  playerSound(player, "eclipse.materialize", 0.8, 1.1);
}
