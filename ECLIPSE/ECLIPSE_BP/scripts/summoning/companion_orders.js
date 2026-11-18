// Ordens por interação (botão "Ordens" do celular ao olhar para a criatura) e transporte do Nox.
import { system } from "@minecraft/server";
import { actionbar, chat, particle, playerSound } from "../core/fx.js";
import { canCommand } from "../core/permissions.js";
import { menu, ask } from "../ui/forms.js";
import { tryUse } from "../core/cooldowns.js";
import { later } from "../core/scheduler.js";
import { effect } from "../abilities/combat.js";
import { addXp } from "../progression/progression_manager.js";
import { byKey, recall, setState, stateName } from "./summon_manager.js";
import { creatureSpecial } from "./creature_abilities.js";
import { getProfile } from "../core/player_profile.js";

/** @param {import("@minecraft/server").Player} player @param {import("@minecraft/server").Entity} e */
export async function openOrders(player, e) {
  if (!canCommand(player, e)) {
    const ownerName = e.getDynamicProperty("eclipse:ownerName");
    actionbar(player, `§7Esta criatura obedece apenas a §f${ownerName ?? "seu dono"}§7.`);
    return;
  }
  const key = String(e.getDynamicProperty("eclipse:key") ?? e.typeId.replace("eclipse:", ""));
  const c = byKey(key);
  try {
    e.triggerEvent("eclipse:phase_interact");
    later(40, () => e.isValid && e.triggerEvent("eclipse:phase_idle"), "orders.idle");
  } catch {
    /* */
  }
  const st = getProfile(player).companions.find((x) => x.id === e.id)?.state ?? "follow";
  const buttons = [
    { text: "§l➜ Seguir", icon: "textures/items/eclipse/legion_sigil" },
    { text: "§l✋ Esperar aqui", icon: "textures/items/eclipse/guardian_shield" },
    { text: "§l⚔ Proteger", icon: "textures/items/eclipse/shadow_sword" },
    { text: "§l🧭 Explorar a área", icon: "textures/items/eclipse/eclipse_core" },
    { text: `§l✦ ${c?.special?.split(":")[0] ?? "Habilidade"}`, icon: "textures/items/eclipse/power_sigil" },
    { text: "§l☾ Recolher à sombra", icon: "textures/items/eclipse/relic_recall" },
    { text: "§l✎ Renomear", icon: "textures/items/eclipse/codex" },
  ];
  if (key === "nox") buttons.splice(5, 0, { text: "§l🐉 Transporte Sombrio", icon: "textures/items/eclipse/wings_dragon" });
  const sel = await menu(player, `${c?.emoji ?? ""} ${c?.name ?? key} — ${c?.title ?? ""}`,
    `§7Estado atual: §f${stateName(st)}\n§7${c?.desc ?? ""}\n\n§8Especial: §7${c?.special ?? "—"}`, buttons);
  if (sel < 0 || !e.isValid) return;
  const label = buttons[sel].text;
  if (label.includes("Seguir")) setState(player, e, "follow");
  else if (label.includes("Esperar")) setState(player, e, "stay");
  else if (label.includes("Proteger")) setState(player, e, "guard");
  else if (label.includes("Explorar")) setState(player, e, "explore");
  else if (label.includes("Transporte")) return noxTransport(player, e);
  else if (label.includes("Recolher")) return recall(player, e);
  else if (label.includes("Renomear")) {
    const name = await ask(player, "Renomear", "Novo nome", c?.name ?? "", e.nameTag?.replace(/§./g, "") ?? "");
    if (name && e.isValid) e.nameTag = `§d${name.slice(0, 24)}`;
    return;
  } else creatureSpecial(player, e, key);
  actionbar(player, `§d${c?.name}: §f${label.replace(/§l|[^\p{L}\p{N}\s]/gu, "").trim()}`);
  addXp(player, 1, "orders");
}

/**
 * Montaria real e controlável do dragão não é segura via API estável no Android;
 * em vez disso, o Nox leva você voando até onde você olha (até 80 blocos), sem fingir ser montaria.
 */
export function noxTransport(player, nox) {
  if (!tryUse(player, "nox.transport", 200, "Transporte Sombrio")) return;
  const hit = player.getBlockFromViewDirection({ maxDistance: 80 });
  const dir = player.getViewDirection();
  const target = hit
    ? { x: hit.block.location.x + 0.5, y: hit.block.location.y + 1.2, z: hit.block.location.z + 0.5 }
    : { x: player.location.x + dir.x * 60, y: player.location.y + Math.max(4, dir.y * 60), z: player.location.z + dir.z * 60 };
  const start = { ...player.location };
  const total = 50;
  effect(player, "slow_falling", 6);
  playerSound(player, "eclipse.wings_open", 1, 0.8);
  chat(player, "§8[§5Nox§8] §7Segure-se. Para onde você olha, eu levo.");
  let i = 0;
  const id = system.runInterval(() => {
    try {
      if (!player.isValid || i > total) {
        system.clearRun(id);
        return;
      }
      const t = i / total;
      const ease = t * t * (3 - 2 * t);
      const arc = Math.sin(t * Math.PI) * 8;
      const pos = { x: start.x + (target.x - start.x) * ease, y: start.y + (target.y - start.y) * ease + arc, z: start.z + (target.z - start.z) * ease };
      player.teleport(pos, { keepVelocity: false, facingLocation: target });
      if (nox.isValid) nox.teleport({ x: pos.x, y: pos.y + 2.2, z: pos.z }, { keepVelocity: false, facingLocation: target });
      if (i % 3 === 0) particle(player.dimension, "eclipse:smoke_puff", pos, { color: { red: 0.3, green: 0.15, blue: 0.5 }, count: 2 });
      i++;
      if (i > total) {
        effect(player, "slow_falling", 4);
        system.clearRun(id);
      }
    } catch {
      system.clearRun(id);
    }
  }, 1);
}
