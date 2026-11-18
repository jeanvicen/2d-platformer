// Grimório (menu do Núcleo): pequeno, por abas, aberto só quando o jogador pede.
import { MODE_ORDER, MODES, PRESETS, PRESET_ORDER, VERSION, xpForLevel } from "../core/config.js";
import { actionbar, chat } from "../core/fx.js";
import { getProfile, markDirty, saveSoon } from "../core/player_profile.js";
import { setWorldConfig, worldConfig } from "../core/world_config.js";
import { isAdmin } from "../core/permissions.js";
import { bar } from "../core/util.js";
import { menu } from "./forms.js";
import { openCodex } from "./book_ui.js";
import { openForge } from "./forge_ui.js";
import { TECHNIQUES, isUnlocked, setMode } from "../modes/mode_manager.js";
import { CREATURES, describeCompanions, recallAll, summon } from "../summoning/summon_manager.js";
import { FORMS, revert, transform } from "../abilities/metamorphosis.js";
import { startFlight, wearingWings } from "../abilities/flight.js";
import { clearConstructs } from "../abilities/shadow_creation.js";
import { openLyraPanel } from "../lyra/lyra_ui.js";
import { levelTitle } from "../progression/progression_manager.js";
import { QUESTS } from "../data/quests.js";
import { diagnosticsText } from "../systems/diagnostics.js";
import { recallAllRelics } from "../systems/thrown_relic_manager.js";
import { giveKit } from "../systems/awakening.js";

const I = "textures/items/eclipse/";

export async function openCoreMenu(player) {
  const p = getProfile(player);
  const M = MODES[p.mode];
  const m = p.modes[p.mode];
  const body = `${M.color}§l${M.name}§r §7— ${M.title}\n§fNível ${m.level} §7(${levelTitle(m.level)})  ${bar(m.xp / xpForLevel(m.level))}\n§7Núcleo: §f${p.core}  §7Companheiros: §f${p.companions.length}`;
  const buttons = [
    { text: "§l⚔ Modos e técnicas", icon: I + "power_sigil" },
    { text: "§l🐺 Legião (criaturas)", icon: I + "legion_sigil" },
    { text: "§l⚒ Forja de Sombras", icon: I + "eclipse_hammer" },
    { text: "§l🦅 Formas", icon: I + "form_essence" },
    { text: "§l🪽 Voar", icon: I + "wings_shadow" },
    { text: "§l💜 Lyra", icon: I + "lyra_bond" },
    { text: "§l★ Domínio e desafios", icon: I + "eclipse_core" },
    { text: "§l📖 Códice (manual)", icon: I + "codex" },
    { text: "§l⚙ Configurações", icon: I + "shadow_hand" },
  ];
  if (isAdmin(player)) buttons.push({ text: "§l🛠 Administração", icon: I + "relic_recall" });
  const sel = await menu(player, "§5§lGrimório do Eclipse", body, buttons);
  switch (sel) {
    case 0: return modesMenu(player);
    case 1: return legionMenu(player);
    case 2: return openForge(player);
    case 3: return formsMenu(player);
    case 4:
      if (!wearingWings(player)) actionbar(player, "§7Equipe asas no peito primeiro (Forja → Asas).");
      else startFlight(player, 1.0);
      return;
    case 5: return openLyraPanel(player);
    case 6: return masteryMenu(player);
    case 7: return openCodex(player);
    case 8: return settingsMenu(player);
    case 9: return adminMenu(player);
    default: return;
  }
}

async function modesMenu(player) {
  const p = getProfile(player);
  const r = await menu(player, "Modos", "§7Escolha sua linhagem. O progresso de cada Modo é guardado separadamente.",
    MODE_ORDER.map((k) => ({ text: `${MODES[k].color}§l${MODES[k].name}§r ${p.mode === k ? "§a(ativo)" : ""}\n§7${MODES[k].title} · nível ${p.modes[k].level}`, icon: I + (k === "god" ? "power_sigil" : k === "haze" ? "element_prism" : "eclipse_core") })).concat([{ text: "§lVer técnicas do Modo atual", icon: I + "codex" }]));
  if (r < 0) return;
  if (r < MODE_ORDER.length) return setMode(player, MODE_ORDER[r]);
  const list = TECHNIQUES[p.mode];
  const lines = list.map((t, i) => `${isUnlocked(player, p.mode, t) ? "§a✔" : "§c✖"} §l${t.name}§r §7(nível ${t.level} · custo 1 ponto · recarga ${Math.round(t.cooldown / 20)}s · ${t.ultimate ? "suprema" : "ativa"})\n§f${t.desc}\n§8Celular: Selo do Poder — agache+toque até "${t.name}", depois toque.${i === 0 ? "" : ""}`);
  await menu(player, `Técnicas — ${MODES[p.mode].name}`, lines.join("\n\n"), ["OK"]);
}

async function legionMenu(player) {
  const r = await menu(player, "Legião", `§fManifestadas:\n${describeCompanions(player)}\n\n§7Toque numa espécie para invocar.`,
    CREATURES.map((c) => ({ text: `§l${c.emoji} ${c.name}§r — ${c.title}\n§7${c.special.split(":")[0]}`, icon: I + "legion_sigil" })).concat([{ text: "§l☾ Recolher todas", icon: I + "relic_recall" }]));
  if (r < 0) return;
  if (r === CREATURES.length) return recallAll(player);
  summon(player, CREATURES[r].key);
}

async function formsMenu(player) {
  const p = getProfile(player);
  const r = await menu(player, "Formas", p.form ? `§7Você está na forma §f${p.form}§7.` : "§7Escolha uma forma.",
    FORMS.map((f) => ({ text: `§l${f.name}§r\n§7${f.desc}`, icon: `textures/items/eclipse/form_${f.key}` })).concat(p.form ? [{ text: "§l↩ Voltar ao normal", icon: I + "relic_recall" }] : []));
  if (r < 0) return;
  if (r === FORMS.length) return revert(player);
  p.formSel = FORMS[r].key;
  markDirty(player);
  if (p.form) revert(player, true);
  transform(player, FORMS[r].key);
}

async function masteryMenu(player) {
  const p = getProfile(player);
  const lines = MODE_ORDER.map((k) => {
    const m = p.modes[k];
    return `${MODES[k].color}§l${MODES[k].name}§r nível ${m.level} (${levelTitle(m.level)}) ${bar(m.xp / xpForLevel(m.level), 8)} §7pontos: ${m.points}`;
  });
  const q = QUESTS.map((x) => {
    const st = p.quests[x.id] ?? { n: 0, done: false };
    return `${st.done ? "§a✔" : "§7•"} §f${x.name}§7 — ${x.desc} §8(${Math.min(st.n, x.goal)}/${x.goal}) +${x.xp} XP`;
  });
  const stats = `§7Invocações: §f${p.stats.summons}§7 · Lançamentos: §f${p.stats.throws}§7 · Voo: §f${Math.round(p.stats.flightTicks / 20)}s§7 · Formas: §f${p.stats.forms}§7 · Criações: §f${p.stats.constructs}§7 · Tarefas da Lyra: §f${p.stats.lyraTasks}\n§7Biomas: §f${p.biomes.length}§7 · Títulos: §d${p.titles.join(", ") || "—"}`;
  await menu(player, "Domínio", `${lines.join("\n")}\n\n§l§fDesafios§r\n${q.join("\n")}\n\n${stats}\n\n§8${worldConfig().unlockAll ? "Todas as técnicas estão liberadas neste mundo." : "Progressão clássica: técnicas liberam por nível."}`, ["OK"]);
}

async function settingsMenu(player) {
  const p = getProfile(player);
  const r = await menu(player, "Configurações", `§7Efeitos: §f${PRESETS[p.preset]?.label}§7 · Aura: §f${p.prefs.aura ? "ligada" : "desligada"}§7 · Sons: §f${p.prefs.sounds ? "ligados" : "desligados"}§7 · Voo: §f${p.prefs.flight ? "ligado" : "desligado"}`, [
    "§lEfeitos visuais (VISUAL / EQUILIBRADO / DESEMPENHO)", "§lLigar/desligar aura", "§lLigar/desligar sons do add-on", "§lLigar/desligar voo com asas",
    "§lLimpar minhas criações temporárias", "§lRecolher todas as criaturas", "§lRecuperar relíquias lançadas", "§lVoltar à forma normal", "§lRecuperar kit de itens",
  ]);
  switch (r) {
    case 0: {
      const i = await menu(player, "Efeitos visuais", "", PRESET_ORDER.map((k) => `§l${PRESETS[k].label}`));
      if (i >= 0) p.preset = PRESET_ORDER[i];
      break;
    }
    case 1: p.prefs.aura = !p.prefs.aura; p.core = p.prefs.aura ? (p.core === "awakened" ? "manifested" : p.core) : (p.core === "manifested" ? "awakened" : p.core); break;
    case 2: p.prefs.sounds = !p.prefs.sounds; break;
    case 3: p.prefs.flight = !p.prefs.flight; break;
    case 4: actionbar(player, `§7${clearConstructs(player)} blocos desfeitos.`); break;
    case 5: recallAll(player); break;
    case 6: recallAllRelics(player); break;
    case 7: revert(player); break;
    case 8: giveKit(player, true); break;
    default: return;
  }
  markDirty(player);
  saveSoon(player);
}

async function adminMenu(player) {
  if (!isAdmin(player)) return;
  const c = worldConfig();
  const r = await menu(player, "Administração", `§7Versão ${VERSION}\n${diagnosticsText()}`, [
    `Tudo liberado: §f${c.unlockAll ? "SIM" : "não (progressão clássica)"}`,
    `Limite de companheiros: §f${c.maxCompanions}`,
    `Teto de efeitos do mundo: §f${PRESETS[c.worldPreset]?.label}`,
    `PvP dos poderes: §f${c.pvp ? "ligado" : "desligado"}`,
    `Raio real do Martelo (pode causar fogo): §f${c.realLightning ? "ligado" : "desligado"}`,
    `Materiais da Lyra: §f${c.lyraMaterials === "real" ? "coleta real" : "da sombra (instantâneo)"}`,
    `Velocidade de construção da Lyra: §f${c.lyraBuildSpeed}`,
    `Mensagem de boas-vindas: §f${c.welcomeMessage ? "ligada" : "desligada"}`,
  ]);
  const patch = {};
  if (r === 0) patch.unlockAll = !c.unlockAll;
  if (r === 1) patch.maxCompanions = c.maxCompanions >= 6 ? 1 : c.maxCompanions + 1;
  if (r === 2) patch.worldPreset = PRESET_ORDER[(PRESET_ORDER.indexOf(c.worldPreset) + 1) % PRESET_ORDER.length];
  if (r === 3) patch.pvp = !c.pvp;
  if (r === 4) patch.realLightning = !c.realLightning;
  if (r === 5) patch.lyraMaterials = c.lyraMaterials === "real" ? "shadow" : "real";
  if (r === 6) patch.lyraBuildSpeed = { lento: "normal", normal: "rapido", rapido: "lento" }[c.lyraBuildSpeed] ?? "normal";
  if (r === 7) patch.welcomeMessage = !c.welcomeMessage;
  if (Object.keys(patch).length) {
    setWorldConfig(patch);
    chat(player, "§7[ECLIPSE] Configuração do mundo atualizada.");
    return adminMenu(player);
  }
}
