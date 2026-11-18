// Boas-vindas, despertar do Núcleo (sequência animada) e kit de itens.
import { MemoryTier, system } from "@minecraft/server";
import { CREATOR, MODES, MODE_ORDER, VERSION } from "../core/config.js";
import { chat, particle, playerSound, title } from "../core/fx.js";
import { give, hasItem, makeItem } from "../core/items.js";
import { getProfile, markDirty, saveSoon } from "../core/player_profile.js";
import { worldConfig } from "../core/world_config.js";
import { later } from "../core/scheduler.js";
import { menu } from "../ui/forms.js";
import { setMode } from "../modes/mode_manager.js";
import { questProgress } from "../progression/progression_manager.js";

export const KIT = ["codex", "legion_sigil", "power_sigil", "form_essence", "shadow_hand", "element_prism", "lyra_bond", "wings_shadow", "eclipse_hammer"];

/** Mensagem no chat quando o jogador entra. */
export function welcome(player) {
  if (!worldConfig().welcomeMessage) return;
  chat(player, [
    "§8§m                                        ",
    "§5§l   ✦ ECLIPSE §d— SHADOW SOVEREIGN §5✦",
    `§f   Mod criado por §d§l${CREATOR}`,
    `§7   v${VERSION} · use o §5Núcleo do Eclipse§7 para despertar`,
    "§8§m                                        ",
  ].join("\n"));
}

export function firstJoin(player) {
  const p = getProfile(player);
  if (!p.firstJoin) return;
  p.firstJoin = false;
  // celulares com pouca memória começam no preset DESEMPENHO
  try {
    const tier = player.clientSystemInfo.memoryTier;
    if (tier !== undefined && tier <= MemoryTier.Low) p.preset = "performance";
  } catch {
    /* */
  }
  if (!hasItem(player, "eclipse:eclipse_core")) give(player, makeItem("eclipse:eclipse_core", { keep: true }));
  markDirty(player);
  saveSoon(player);
}

/** Entrega os itens do kit que estiverem faltando (nunca duplica). */
export function giveKit(player, announce = false) {
  let n = 0;
  if (!hasItem(player, "eclipse:eclipse_core")) {
    give(player, makeItem("eclipse:eclipse_core", { keep: true }));
    n++;
  }
  const thrown = Object.values(getProfile(player).thrown ?? {}).map((t) => t.relic);
  for (const k of KIT) {
    if (thrown.includes(k)) continue; // relíquia lançada: volta pelo Chamado, nunca duplica
    if (hasItem(player, `eclipse:${k}`)) continue;
    give(player, makeItem(`eclipse:${k}`, { keep: true }));
    n++;
  }
  if (announce) chat(player, n ? `§5✦ ${n} itens do kit materializados.` : "§7Você já tem todo o kit.");
  return n;
}

/** Sequência de despertar: escuridão → coluna de sombras → título → kit → escolha do Modo. */
export function awaken(player) {
  const p = getProfile(player);
  if (p.core !== "dormant") return false;
  p.core = "awakened";
  markDirty(player);
  const at = player.location;
  try {
    player.camera.fade({ fadeColor: { red: 0.05, green: 0.0, blue: 0.1 }, fadeTime: { fadeInTime: 0.6, holdTime: 0.8, fadeOutTime: 1.4 } });
  } catch {
    /* */
  }
  playerSound(player, "eclipse.awaken", 1, 1);
  for (let i = 0; i < 6; i++) {
    later(i * 6, () => {
      if (!player.isValid) return;
      particle(player.dimension, "eclipse:ring", { x: at.x, y: at.y + 0.1 + i * 0.5, z: at.z }, { color: { red: 0.6, green: 0.3, blue: 1 }, radius: 4 - i * 0.5 });
      particle(player.dimension, "eclipse:mote", { x: at.x, y: at.y + i * 0.6, z: at.z }, { color: { red: 0.7, green: 0.4, blue: 1 }, count: 6, radius: 1.2 });
    }, "awaken.fx");
  }
  later(30, () => {
    if (!player.isValid) return;
    particle(player.dimension, "eclipse:lightning_column", at, { color: { red: 0.7, green: 0.45, blue: 1 } });
    particle(player.dimension, "eclipse:flash", { x: at.x, y: at.y + 1, z: at.z }, { color: { red: 0.8, green: 0.6, blue: 1 }, radius: 5 });
    title(player, "§5§lO ECLIPSE DESPERTOU", "§7as sombras agora respondem a você", 70);
    giveKit(player);
    questProgress(player, "awaken");
    saveSoon(player);
  }, "awaken.main");
  later(110, async () => {
    if (!player.isValid) return;
    const r = await menu(player, "§5Escolha sua linhagem inicial", "§7Você pode trocar a qualquer momento (agache + toque com o Núcleo). Cada Modo guarda seu próprio progresso.",
      MODE_ORDER.map((k) => `${MODES[k].color}§l${MODES[k].name}§r\n§7${MODES[k].title}`));
    if (r >= 0) setMode(player, MODE_ORDER[r]);
    chat(player, "§5✦ §fDica: abra o §dCódice do Eclipse§f para aprender todos os controles. Toque com o §5Núcleo§f para abrir o Grimório.");
  }, "awaken.mode");
  void system;
  return true;
}
