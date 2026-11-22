// Armas da raça: Lâmina Divina (DEUS, 30 de dano) e Foice do Vazio (TREVAS, 35 de dano).
// Presas ao dono por número de série: chamar de novo apaga as cópias antigas (nunca duplica);
// largada/perdida na morte volta para o dono; cópia de série velha se desfaz. Outras raças podem
// segurar, mas sem poder nenhum (dano normal de item).
// Cinzas da foice: SÓ depois que o jogo deixou quebrar o bloco (respeita proteções e modo de jogo),
// nunca em blocos inquebráveis/contêineres/portais/comandos; em jogadores nunca apaga nada.
import { ItemStack, system } from "@minecraft/server";
import { BAL } from "./data.js";
import { saveState, stateOf } from "./state.js";
import { BLOCK_OK, FX, SPECIAL_RUN, ashEntity, fx } from "./engine.js";

export const SWORD = "lila:divine_sword";
export const SCYTHE = "lila:void_scythe";
export const CORE = "lila:race_core";
export const ROULETTE = "lila:race_roulette";
export const WEAPON_OF = { god: SWORD, dark: SCYTHE };
const NAME = { [SWORD]: "§e§lLâmina Divina", [SCYTHE]: "§5§lFoice do Vazio" };

const pendingAsh = [];

function inv(p) {
  return p.getComponent("minecraft:inventory")?.container;
}

/** Remove todas as cópias de armas da raça do inventário do jogador. */
export function removeWeapons(player) {
  const ct = inv(player);
  let n = 0;
  for (let i = 0; ct && i < ct.size; i++) {
    const it = ct.getItem(i);
    if (it && (it.typeId === SWORD || it.typeId === SCYTHE)) {
      ct.setItem(i, undefined);
      n++;
    }
  }
  return n;
}

/** Dá a arma da raça (nova série). Inventário cheio → fica pendente e entra quando houver espaço. */
export function giveWeapon(player) {
  const s = stateOf(player);
  const id = WEAPON_OF[s.race];
  if (!id) return false;
  removeWeapons(player);
  s.serial++;
  const st = new ItemStack(id, 1);
  try {
    st.setDynamicProperty("lila:owner", player.id);
    st.setDynamicProperty("lila:serial", s.serial);
    st.nameTag = NAME[id];
    st.setLore([`§7Presa a: §f${player.name}`, `§7Dano: §f${id === SWORD ? BAL.godSwordDamage : BAL.darkScytheDamage}`, "§8Só o dono usa o poder dela"]);
  } catch {
    /* ignore */
  }
  const ct = inv(player);
  if (!ct || ct.emptySlotsCount === 0) {
    s.pending = false;
    s.tog.weaponPending = true;
    saveState(player);
    player.onScreenDisplay.setActionBar("§eInventário cheio: sua arma entra assim que abrir espaço.");
    return false;
  }
  ct.addItem(st);
  s.tog.weaponPending = false;
  saveState(player);
  return true;
}

/** A arma está valendo para este jogador (dono, série atual, raça certa)? */
export function weaponValid(player, item) {
  if (!item || (item.typeId !== SWORD && item.typeId !== SCYTHE)) return false;
  const s = stateOf(player);
  if (WEAPON_OF[s.race] !== item.typeId) return false;
  try {
    return item.getDynamicProperty("lila:owner") === player.id && item.getDynamicProperty("lila:serial") === s.serial;
  } catch {
    return false;
  }
}

export function heldItem(player) {
  try {
    return inv(player)?.getItem(player.selectedSlotIndex);
  } catch {
    return undefined;
  }
}

/** Dano exato da arma (lido no beforeEvent): 30 / 35 para o dono certo, senão undefined. */
export function weaponDamage(player) {
  const it = heldItem(player);
  if (!weaponValid(player, it)) return undefined;
  return it.typeId === SWORD ? BAL.godSwordDamage : BAL.darkScytheDamage;
}

/** Efeito do golpe (depois do dano): luz da lâmina / sombra fragmentada e cinzas da foice. */
export function weaponHit(player, target) {
  const it = heldItem(player);
  if (!weaponValid(player, it) || !target?.isValid) return;
  const at = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
  if (it.typeId === SWORD) {
    fx(target.dimension, "lila:rc_god_burst", at);
    try {
      target.dimension.playSound("beacon.power", at, { volume: 0.6, pitch: 1.8 });
    } catch {
      /* ignore */
    }
    return;
  }
  fx(target.dimension, "lila:rc_dark_burst", at);
  try {
    target.dimension.playSound("mob.endermen.portal", at, { volume: 0.6, pitch: 0.6 });
  } catch {
    /* ignore */
  }
  if (target.typeId === "minecraft:player") {
    // "sombra fragmentada": nunca apaga nem mata de vez outro jogador
    try {
      target.addEffect("darkness", 60, { amplifier: 0, showParticles: false });
      target.addEffect("slowness", 40, { amplifier: 1, showParticles: false });
    } catch {
      /* ignore */
    }
  } else system.run(() => ashEntity(player, target));
}

/** Quebrou um bloco com a foice (o jogo já permitiu): vira cinza, sem drop. */
export function scytheBreak(player, block, brokenId, before) {
  if (!weaponValid(player, before) || before.typeId !== SCYTHE || !BLOCK_OK(brokenId)) return;
  const at = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
  fx(block.dimension, "lila:rc_ash", at);
  try {
    block.dimension.playSound("dig.sand", at, { volume: 0.7, pitch: 0.6 });
  } catch {
    /* ignore */
  }
  pendingAsh.push({ d: block.dimension.id, at, until: system.currentTick + 3 });
}

/** Item no chão: drop de bloco virado cinza some; arma da raça volta ao dono (série atual) ou se desfaz. */
export function itemSpawned(item) {
  let st;
  try {
    st = item.getComponent("minecraft:item")?.itemStack;
  } catch {
    return;
  }
  if (!st) return;
  const tick = system.currentTick;
  for (let i = pendingAsh.length - 1; i >= 0; i--) {
    const a = pendingAsh[i];
    if (a.until < tick) {
      pendingAsh.splice(i, 1);
      continue;
    }
    if (item.dimension.id === a.d && Math.hypot(item.location.x - a.at.x, item.location.y - a.at.y, item.location.z - a.at.z) < 1.6) {
      item.remove();
      return;
    }
  }
  if (st.typeId === CORE) {
    item.remove(); // o Núcleo nunca fica no chão (o dono sempre recebe um de volta)
    return;
  }
  if (st.typeId !== SWORD && st.typeId !== SCYTHE) return;
  const dimension = item.dimension;
  let owner, serial;
  try {
    owner = st.getDynamicProperty("lila:owner");
    serial = st.getDynamicProperty("lila:serial");
  } catch {
    /* ignore */
  }
  item.remove();
  const p = dimension.getPlayers().find((x) => x.id === owner);
  if (!p) return; // dono offline: a arma é chamada de novo pelo poder "Chamar a arma" (nova série)
  const s = stateOf(p);
  if (serial !== s.serial || WEAPON_OF[s.race] !== st.typeId) return; // cópia velha: se desfaz
  const ct = inv(p);
  if (ct && ct.emptySlotsCount > 0 && p.getComponent("minecraft:health")?.currentValue > 0) {
    ct.addItem(st);
    p.onScreenDisplay.setActionBar("§7Sua arma voltou para você.");
  } else {
    s.tog.weaponPending = true;
    saveState(p);
  }
}

/** Arma pendente (morreu / inventário cheio): entra assim que der. */
export function weaponPendingTick(player) {
  const s = stateOf(player);
  if (!s.tog.weaponPending || !WEAPON_OF[s.race]) return;
  const ct = inv(player);
  if (!ct || ct.emptySlotsCount === 0) return;
  for (let i = 0; i < ct.size; i++) if (weaponValid(player, ct.getItem(i))) {
    s.tog.weaponPending = false;
    return;
  }
  giveWeapon(player);
}

/** Núcleo da Raça (o item de usar poderes): um, sem duplicar. */
export function ensureCore(player) {
  const ct = inv(player);
  if (!ct) return;
  for (let i = 0; i < ct.size; i++) if (ct.getItem(i)?.typeId === CORE) return;
  if (ct.emptySlotsCount === 0) return;
  ct.addItem(new ItemStack(CORE, 1));
}

SPECIAL_RUN.weapon = (ctx) => {
  if (!WEAPON_OF[ctx.race]) return "Sua raça não tem arma própria.";
  const ok = giveWeapon(ctx.player);
  fx(ctx.player.dimension, FX[ctx.race].zone, ctx.player.location, { size: 2.5 });
  ctx.msg = ok ? "a arma voltou para a sua mão (a antiga se desfez)" : "fica pendente: libere espaço";
  ctx.touched = 1;
};
