// Roteador de toques dos itens ECLIPSE (toque = ação principal; agachado + toque = alternar).
import { system } from "@minecraft/server";
import { actionbar } from "../core/fx.js";
import { logError } from "../core/log.js";
import { getProfile, markDirty } from "../core/player_profile.js";
import { awaken } from "../systems/awakening.js";
import { openCoreMenu } from "../ui/core_menu.js";
import { openCodex } from "../ui/book_ui.js";
import { cycleElement, cycleMode, cycleTechnique, useTechnique } from "../modes/mode_manager.js";
import { cycleActive, toggleActive } from "../summoning/summon_manager.js";
import { cycleForm, revert, transform } from "./metamorphosis.js";
import { cycleConstruct, useShadowHand } from "./shadow_creation.js";
import { useRelic } from "./relics.js";
import { recallRelic } from "../systems/thrown_relic_manager.js";
import { openLyraPanel } from "../lyra/lyra_ui.js";
import { isLyraSummoned, lyraEntity, summonLyra } from "../lyra/lyra_manager.js";
import { GENERATED } from "../data/generated.js";

const RELIC_KEYS = new Set(GENERATED.relics.map((r) => r.key));
const lastUse = new Map();

/**
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").ItemStack} item
 */
export function dispatchItemUse(player, item) {
  if (!item || !item.typeId.startsWith("eclipse:")) return;
  // dedupe: componente customizado + evento global podem disparar no mesmo tick
  const k = `${player.id}`;
  const t = system.currentTick;
  if (lastUse.get(k) === t) return;
  lastUse.set(k, t);
  const key = item.typeId.slice(8);
  const sneaking = player.isSneaking;
  try {
    const p = getProfile(player);
    switch (key) {
      case "eclipse_core":
        if (p.core === "dormant") return void awaken(player);
        if (sneaking) return cycleMode(player);
        return void openCoreMenu(player);
      case "codex":
        return void openCodex(player);
      case "legion_sigil":
        return sneaking ? cycleActive(player) : toggleActive(player);
      case "power_sigil":
        return sneaking ? cycleTechnique(player) : useTechnique(player);
      case "form_essence":
        if (p.form) return sneaking ? revert(player) : transform(player, p.form);
        return sneaking ? cycleForm(player) : transform(player, p.formSel);
      case "shadow_hand":
        return sneaking ? cycleConstruct(player) : useShadowHand(player);
      case "element_prism":
        if (p.mode !== "haze") actionbar(player, "§7O elemento é usado no Modo Haze (agache + toque com o Núcleo para trocar de Modo).");
        return cycleElement(player, sneaking ? -1 : 1);
      case "lyra_bond":
        if (!isLyraSummoned(player)) return void summonLyra(player);
        if (sneaking) return quickLyra(player);
        return void openLyraPanel(player);
      case "relic_recall":
        return recallRelic(player, item);
      default:
        if (RELIC_KEYS.has(key)) return useRelic(player, key, sneaking);
        return;
    }
  } catch (e) {
    logError(`use.${key}`, e);
  }
}

/** Agachado + toque no Laço: alterna Seguir → Esperar → Proteger. */
function quickLyra(player) {
  const e = lyraEntity(player);
  if (!e) return;
  const st = String(e.getProperty("eclipse:state") ?? "follow");
  const next = st === "follow" ? "stay" : st === "stay" ? "guard" : "follow";
  e.triggerEvent(`eclipse:state_${next}`);
  actionbar(player, `§d[Lyra] §f${{ follow: "Seguindo você", stay: "Esperando aqui", guard: "Protegendo você" }[next]}`);
  markDirty(player);
}
