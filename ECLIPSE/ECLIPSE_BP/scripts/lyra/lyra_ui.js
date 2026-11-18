// Painel da Lyra (Laço de Lyra ou botão "Falar" ao olhar para ela).
import { BLUEPRINTS } from "../lib/blueprints.js";
import { ask, menu } from "../ui/forms.js";
import { getProfile, markDirty } from "../core/player_profile.js";
import { worldConfig } from "../core/world_config.js";
import { describeQueue, enqueue, isLyraSummoned, lyraEntity, recallLyra, stopAll, summonLyra, talk } from "./lyra_manager.js";

const ICON = "textures/items/eclipse/";

export async function openLyraPanel(player) {
  if (!isLyraSummoned(player)) {
    const s = await menu(player, "§dLyra, a Sombra Viva", "§7Lyra está descansando na sombra.\nEla coleta madeira, pedra e comida, minera, explora, protege e constrói casas, torres e até mansões — sozinha.", [
      { text: "§l✦ Chamar Lyra", icon: ICON + "lyra_bond" },
      { text: "Fechar", icon: ICON + "relic_recall" },
    ]);
    if (s === 0) summonLyra(player);
    return;
  }
  const p = getProfile(player);
  const sel = await menu(player, `§d${p.lyra.name ?? "Lyra"} §7— a Sombra Viva`,
    `§fFila de tarefas:\n${describeQueue(player)}\n\n§7Dica: escreva o pedido do seu jeito, ex.: "faz uma mansão aqui e depois pega comida".`, [
      { text: "§l💬 Falar com a Lyra", icon: ICON + "lyra_bond" },
      { text: "§l🏗 Construir…", icon: ICON + "shadow_hand" },
      { text: "§l🪵 Coletar…", icon: ICON + "shadow_axe_tool" },
      { text: "§l🧭 Explorar", icon: ICON + "eclipse_core" },
      { text: "➜ Seguir  /  ✋ Esperar  /  ⚔ Proteger", icon: ICON + "legion_sigil" },
      { text: "🎒 Ver bolsa / receber itens", icon: ICON + "codex" },
      { text: "⛔ Cancelar tarefas", icon: ICON + "relic_recall" },
      { text: "✎ Renomear", icon: ICON + "codex" },
      { text: "☾ Recolher à sombra", icon: ICON + "relic_recall" },
    ]);
  switch (sel) {
    case 0: {
      const text = await ask(player, "Falar com a Lyra", "O que você quer que eu faça?", "ex.: pega 32 madeiras e faz uma casa aqui");
      if (text) talk(player, text);
      return;
    }
    case 1: return buildMenu(player);
    case 2: return gatherMenu(player);
    case 3: {
      const r = await menu(player, "Explorar", "Até onde?", ["Perto (48 blocos)", "Médio (96 blocos)", "Longe (160 blocos)"]);
      if (r >= 0) talk(player, ["explora perto", "explora", "explora bem longe"][r]);
      return;
    }
    case 4: {
      const r = await menu(player, "Comportamento", "", ["➜ Seguir", "✋ Esperar aqui", "⚔ Proteger", "📍 Vir até mim"]);
      if (r >= 0) talk(player, ["me segue", "espera", "me protege", "vem aqui"][r]);
      return;
    }
    case 5: {
      const r = await menu(player, "Bolsa da Lyra", "", ["Ver o que ela tem", "Receber tudo", "Receber madeira", "Receber pedra", "Receber comida"]);
      if (r >= 0) talk(player, ["o que você tem", "me dá tudo", "me dá madeira", "me dá pedra", "me dá comida"][r]);
      return;
    }
    case 6: return stopAll(player);
    case 7: {
      const name = await ask(player, "Renomear", "Nome da sua companheira", "Lyra", p.lyra.name ?? "Lyra");
      if (name) {
        p.lyra.name = name.slice(0, 20);
        markDirty(player);
        const e = lyraEntity(player);
        if (e) e.nameTag = `§d${p.lyra.name}`;
      }
      return;
    }
    case 8: return recallLyra(player);
    default:
      return;
  }
}

async function buildMenu(player) {
  const keys = Object.keys(BLUEPRINTS);
  const mode = worldConfig().lyraMaterials === "real" ? "§7Ela coleta os materiais que faltarem antes de construir." : "§7Modo materiais da sombra: constrói direto.";
  const r = await menu(player, "Construir", `${mode}\n§8A frente da construção fica virada para você.`, keys.map((k) => `§l${BLUEPRINTS[k].name}§r\n§7${BLUEPRINTS[k].desc}`));
  if (r < 0) return;
  const w = await menu(player, BLUEPRINTS[keys[r]].name, "Onde?", ["Onde estou olhando", "Logo à minha frente"]);
  if (w < 0) return;
  talk(player, `constroi ${keys[r]} ${w === 0 ? "ali" : "aqui"}`);
}

async function gatherMenu(player) {
  const opts = [
    ["Madeira (32)", "pega 32 madeiras"], ["Madeira (64)", "pega 64 madeiras"], ["Pedra (64)", "pega 64 pedras"],
    ["Comida (10)", "pega 10 comidas"], ["Areia (32)", "pega 32 areias"], ["Carvão (16)", "pega 16 carvao"],
    ["Ferro (16)", "pega 16 ferro"], ["Diamante (5)", "pega 5 diamantes"],
  ];
  const r = await menu(player, "Coletar", "§7Ela vai até onde estiver o recurso e volta.", opts.map((o) => o[0]));
  if (r >= 0) talk(player, opts[r][1]);
}

export { enqueue };
