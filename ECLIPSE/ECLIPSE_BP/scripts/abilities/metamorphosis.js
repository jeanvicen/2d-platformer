// Metamorfose em 6 formas.
// Implementação honesta: o Bedrock estável não permite trocar o esqueleto do jogador por script.
// A forma é um modelo 3D completo (attachable) vestido no peito e travado no slot, enquanto a
// pele do jogador fica oculta por invisibilidade. Câmera, controles e skin continuam do jogador —
// e "voltar à forma normal" funciona em qualquer situação (Essência agachado, Grimório, /eclipse:voltar,
// morte, saída do mundo).
import { EquipmentSlot, ItemLockMode } from "@minecraft/server";
import { COLORS } from "../core/config.js";
import { actionbar, particle, playerParticle, playerSound, title } from "../core/fx.js";
import { tryUse } from "../core/cooldowns.js";
import { container, equippable, give, makeItem } from "../core/items.js";
import { getProfile, markDirty, saveSoon } from "../core/player_profile.js";
import { later } from "../core/scheduler.js";
import { GENERATED } from "../data/generated.js";
import { effect, hostilesAround, hurt, push } from "./combat.js";
import { stopFlight } from "./flight.js";
import { addXp, questProgress } from "../progression/progression_manager.js";
import { EntityDamageCause } from "@minecraft/server";

export const FORMS = GENERATED.forms.map((f) => ({ ...f, key: f.id.replace("eclipse:form_", "") }));

const BUFFS = {
  wolf: [["speed", 1], ["night_vision", 0]],
  panther: [["speed", 2], ["jump_boost", 1]],
  eagle: [["slow_falling", 0], ["jump_boost", 2]],
  serpent: [["water_breathing", 0], ["speed", 0]],
  titan: [["strength", 2], ["resistance", 1], ["slowness", 0]],
  guardian: [["resistance", 2], ["absorption", 1], ["slowness", 0]],
};

const usedForms = new Map();

export function currentForm(player) {
  return getProfile(player).form;
}

export function transform(player, key) {
  const p = getProfile(player);
  if (p.form) return formSpecial(player, p.form);
  if (!tryUse(player, "morph", 60, "Metamorfose")) return;
  const eq = equippable(player);
  if (!eq) return;
  stopFlight(player, false);
  // guarda a peça de peito atual (armadura/asas) no inventário
  const chest = eq.getEquipment(EquipmentSlot.Chest);
  if (chest) {
    const inv = container(player);
    if (!inv || inv.emptySlotsCount < 1) {
      actionbar(player, "§cLibere 1 espaço no inventário para guardar sua peça de peito antes da transformação.");
      return;
    }
    p.formChest = chest.typeId;
    inv.addItem(chest);
    eq.setEquipment(EquipmentSlot.Chest, undefined);
  } else p.formChest = null;
  // etapas da transformação
  const l = player.location;
  playerParticle(player, "eclipse:smoke_puff", { x: l.x, y: l.y + 1, z: l.z }, { color: { red: 0.15, green: 0.06, blue: 0.25 }, count: 24, radius: 1, speed: 1 });
  playerSound(player, "eclipse.transform", 1, 1);
  try {
    player.camera.fade({ fadeColor: { red: 0.12, green: 0.04, blue: 0.2 }, fadeTime: { fadeInTime: 0.25, holdTime: 0.2, fadeOutTime: 0.45 } });
  } catch {
    /* câmera indisponível em alguns contextos */
  }
  later(6, () => player.isValid && particle(player.dimension, "eclipse:ring", { x: l.x, y: l.y + 0.1, z: l.z }, { color: COLORS.violet, radius: 3 }), "morph.fx");
  later(10, () => {
    if (!player.isValid) return;
    const item = makeItem(`eclipse:form_${key}`, { lock: "slot", keep: true });
    eq.setEquipment(EquipmentSlot.Chest, item);
    p.form = key;
    applyFormEffects(player, key);
    markDirty(player);
    saveSoon(player);
    const f = FORMS.find((x) => x.key === key);
    title(player, "§5§l" + (f?.name ?? key).replace("Forma: ", "").toUpperCase(), "§7Essência: toque = habilidade · agachado+toque = voltar", 50);
    playerParticle(player, "eclipse:form_shift", player.location, {});
    p.stats.forms++;
    let s = usedForms.get(player.id);
    if (!s) usedForms.set(player.id, (s = new Set()));
    if (!s.has(key)) {
      s.add(key);
      questProgress(player, "shifter");
    }
    addXp(player, 6, `form.${key}`);
  }, "morph.apply");
}

export function applyFormEffects(player, key) {
  effect(player, "invisibility", 15, 0, false);
  for (const [id, amp] of BUFFS[key] ?? []) effect(player, id, 15, amp);
}

/** Mantém efeitos e verifica integridade (a cada 5 s). */
export function maintainForm(player) {
  const p = getProfile(player);
  if (!p.form) return;
  const it = equippable(player)?.getEquipment(EquipmentSlot.Chest);
  if (it?.typeId !== `eclipse:form_${p.form}`) {
    revert(player, true);
    return;
  }
  applyFormEffects(player, p.form);
}

/** Volta à forma normal — funciona sempre (inclusive após morte/reconexão). */
export function revert(player, silent = false) {
  const p = getProfile(player);
  const eq = equippable(player);
  try {
    const it = eq?.getEquipment(EquipmentSlot.Chest);
    if (it?.typeId?.startsWith("eclipse:form_")) eq.setEquipment(EquipmentSlot.Chest, undefined);
    // remove formas que tenham ido parar no inventário por qualquer motivo
    const inv = container(player);
    if (inv) for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId?.startsWith("eclipse:form_")) inv.setItem(i, undefined);
  } catch {
    /* */
  }
  for (const id of ["invisibility", "slowness"]) {
    try {
      player.removeEffect(id);
    } catch {
      /* */
    }
  }
  // devolve a peça de peito guardada
  if (p.formChest && eq && !eq.getEquipment(EquipmentSlot.Chest)) {
    const inv = container(player);
    if (inv) for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it?.typeId === p.formChest && it.lockMode !== ItemLockMode.slot) {
        eq.setEquipment(EquipmentSlot.Chest, it);
        inv.setItem(i, undefined);
        break;
      }
    }
  }
  const was = p.form;
  p.form = null;
  p.formChest = null;
  markDirty(player);
  if (!silent && was) {
    playerParticle(player, "eclipse:form_shift", player.location, {});
    playerSound(player, "eclipse.transform", 0.8, 1.3);
    actionbar(player, "§7Você voltou à forma normal.");
  }
}

export function cycleForm(player) {
  const p = getProfile(player);
  if (p.form) return revert(player);
  const i = (FORMS.findIndex((f) => f.key === p.formSel) + 1) % FORMS.length;
  p.formSel = FORMS[i].key;
  markDirty(player);
  actionbar(player, `§5◆ ${FORMS[i].name} §7— ${FORMS[i].desc}`);
}

function formSpecial(player, key) {
  if (!tryUse(player, `form.special.${key}`, 140, "Habilidade da forma")) return;
  const at = player.location;
  switch (key) {
    case "wolf":
      for (const e of hostilesAround(player, at, 12)) { effect(e, "weakness", 8, 1); effect(e, "slowness", 5, 0); }
      playerSound(player, "eclipse.howl", 1, 1);
      particle(player.dimension, "eclipse:ring", at, { color: COLORS.violet, radius: 12 });
      break;
    case "panther": {
      const d = player.getViewDirection();
      player.applyKnockback({ x: d.x * 2.8, z: d.z * 2.8 }, 0.35);
      later(5, () => {
        for (const e of hostilesAround(player, player.location, 2.6)) hurt(player, e, 10, EntityDamageCause.entityAttack);
      }, "form.pounce");
      break;
    }
    case "eagle":
      player.applyKnockback({ x: 0, z: 0 }, 1.6);
      effect(player, "slow_falling", 12);
      playerSound(player, "eclipse.wings_open", 1, 0.8);
      break;
    case "serpent":
      for (const e of hostilesAround(player, at, 6)) effect(e, "poison", 6, 1);
      particle(player.dimension, "eclipse:spark_burst", { x: at.x, y: at.y + 0.5, z: at.z }, { color: { red: 0.4, green: 1, blue: 0.8 }, count: 20 });
      break;
    case "titan":
      for (const e of hostilesAround(player, at, 6)) { hurt(player, e, 12, EntityDamageCause.entityAttack); push(e, at, 0.6, 1.1); }
      particle(player.dimension, "eclipse:ground_impact", at, {});
      playerSound(player, "random.explode", 0.6, 0.6);
      break;
    case "guardian":
      effect(player, "resistance", 6, 3);
      for (const e of hostilesAround(player, at, 6)) push(e, at, 2.2, 0.4);
      particle(player.dimension, "eclipse:ring", { x: at.x, y: at.y + 1, z: at.z }, { color: COLORS.white, radius: 6 });
      break;
    default:
      break;
  }
  addXp(player, 2, `form.special.${key}`);
}

export function onDeathRevert(player) {
  if (getProfile(player).form) revert(player, true);
}

export { give };
