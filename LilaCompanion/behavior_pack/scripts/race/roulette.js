// Roleta das Essências: uma transação por jogador (trava contra clique duplo), confirmação ao
// trocar de raça, consumo de EXATAMENTE 1 item (sobrevivência/aventura; criativo não gasta),
// sorteio NO SERVIDOR (pontos-base) e a roda 3D que gira e para no resultado (só visual).
// O resultado é salvo na hora (desconectar no meio não duplica nem perde nada); a transformação
// aparece quando a roda para.
import { GameMode, system } from "@minecraft/server";
import { MessageFormData } from "@minecraft/server-ui";
import { BY_RACE } from "./catalog.js";
import { RACES, RACE_IDS, oddsText, pickRace, rollInt } from "./data.js";
import { defaultSlots, saveState, stateOf } from "./state.js";
import { applyBody, clearBody } from "./passives.js";
import { ROULETTE, ensureCore, giveWeapon, removeWeapons, WEAPON_OF } from "./weapons.js";
import { fx, setPose } from "./engine.js";

const ROLLING = new Set();
export const SPIN_TICKS = 92; // 4,6 s (a animação da roda usa o mesmo tempo)
export const LOG = [];

function consumeOne(player, slot) {
  let gm;
  try {
    gm = player.getGameMode();
  } catch {
    /* ignore */
  }
  if (gm === GameMode.Creative) return true;
  const ct = player.getComponent("minecraft:inventory")?.container;
  const it = ct?.getItem(slot);
  if (!it || it.typeId !== ROULETTE) return false; // o item sumiu: não sorteia
  if (it.amount > 1) {
    it.amount -= 1;
    ct.setItem(slot, it);
  } else ct.setItem(slot, undefined);
  return true;
}

/**
 * Jogador usou a roleta. `o.confirm` permite ao autoteste responder a confirmação.
 * @returns {Promise<{ok:boolean, race?:string, reason?:string}>}
 */
export async function useRoulette(player, slot = player.selectedSlotIndex, o = {}) {
  if (ROLLING.has(player.id)) return { ok: false, reason: "rolling" };
  ROLLING.add(player.id);
  try {
    const s = stateOf(player);
    if (s.race) {
      let yes = o.confirm;
      if (yes === undefined) {
        const f = new MessageFormData().title("§l§6Roleta das Essências")
          .body(`§fVocê já é ${RACES[s.race].title}§r§f.\nGirar de novo §ctroca a sua raça§f (a roleta é gasta; poderes, asas e arma da raça atual somem).\n\n§7Chances: ${oddsText()}`)
          .button1("§cCancelar").button2("§aGirar e trocar");
        const r = await f.show(player);
        yes = !r.canceled && r.selection === 1;
      }
      if (!yes) {
        player.onScreenDisplay.setActionBar("§7Cancelado: nada foi gasto.");
        return { ok: false, reason: "cancel" };
      }
    }
    if (!consumeOne(player, slot)) return { ok: false, reason: "noitem" };
    const roll = o.roll ?? rollInt();
    const race = pickRace(roll);
    commit(player, race);
    LOG.push({ player: player.id, roll, race });
    if (LOG.length > 50) LOG.shift();
    spin(player, race, o.fast);
    return { ok: true, race };
  } finally {
    // libera depois da animação (evita reabrir/gastar duas no mesmo giro)
    system.runTimeout(() => ROLLING.delete(player.id), o.fast ? 2 : SPIN_TICKS + 30);
  }
}

/** Grava a raça nova (servidor). A aparência só muda quando a roda para (pending). */
function commit(player, race) {
  const s = stateOf(player);
  const prev = s.race;
  if (prev && WEAPON_OF[prev]) removeWeapons(player);
  clearBody(player);
  s.race = race;
  s.wing = race === "god" || race === "dark" ? 20 : 0;
  s.tog = { wingAcc: 0 };
  s.cd = {};
  s.res = 60;
  s.slots = defaultSlots(BY_RACE[race]);
  s.active = 0;
  s.rolls++;
  s.pending = true;
  saveState(player);
  try {
    player.setProperty("lila:race", 0); // some com a aparência antiga enquanto gira
  } catch {
    /* ignore */
  }
}

/** Revela e transforma (também chamado ao relogar se ficou pendente). */
export function reveal(player) {
  const s = stateOf(player);
  if (!s.race) return;
  s.pending = false;
  saveState(player);
  const race = s.race, R = RACES[race];
  applyBody(player);
  ensureCore(player);
  if (WEAPON_OF[race]) giveWeapon(player);
  setPose(player, "transform", 46);
  const dim = player.dimension, at = player.location;
  const color = { vampire: [0.45, 0, 0.05], giant: [0.4, 0.3, 0.15], angel: [1, 0.96, 0.82], demon: [0.6, 0.12, 0], god: [1, 0.92, 0.55], dark: [0.02, 0, 0.06] }[race];
  try {
    player.camera.fade({ fadeColor: { red: color[0], green: color[1], blue: color[2] }, fadeTime: { fadeInTime: 0.25, holdTime: 0.3, fadeOutTime: 0.9 } });
  } catch {
    /* ignore */
  }
  fx(dim, `lila:rc_${race}_zone`, at, { size: 4 });
  fx(dim, race === "dark" ? "lila:rc_pillar_void" : race === "god" || race === "angel" ? "lila:rc_pillar_light" : `lila:rc_${race}_burst`, at);
  if (race === "vampire") fx(dim, "lila:rc_bats", { x: at.x, y: at.y + 1, z: at.z });
  if (race === "giant") fx(dim, "lila:rc_debris", at);
  const sounds = { vampire: [["mob.bat.takeoff", 1, 0.8], ["ambient.cave", 0.6, 1]], giant: [["mob.irongolem.repair", 1, 0.5], ["random.explode", 0.6, 0.6]],
    angel: [["beacon.activate", 1, 1.4], ["random.orb", 0.8, 1.6]], demon: [["mob.blaze.shoot", 1, 0.6], ["mob.ghast.scream", 0.4, 0.6]],
    god: [["ui.toast.challenge_complete", 1, 1], ["beacon.power", 1, 0.8], ["block.bell.hit", 1, 0.7]], dark: [["mob.wither.spawn", 0.5, 0.6], ["mob.warden.sonic_boom", 0.4, 0.5]] }[race];
  for (const [id, v, p] of sounds) {
    try {
      dim.playSound(id, at, { volume: v, pitch: p });
    } catch {
      /* ignore */
    }
  }
  try {
    player.onScreenDisplay.setTitle(R.title, { subtitle: `§f${R.blurb}`, fadeInDuration: 6, stayDuration: 70, fadeOutDuration: 20 });
  } catch {
    /* ignore */
  }
  system.runTimeout(() => {
    if (!player.isValid) return;
    player.sendMessage(`${R.color}§l✦ ${R.name}!§r §7${R.blurb}\n§7Ponto fraco: §f${R.weakness}\n§7Segure o §bNúcleo da Raça§7: bater = usa o poder ativo · usar = painel com 20 poderes · agachar + usar = grimório com os 100.`);
  }, 30);
  if (race === "god" || race === "dark") {
    try {
      dim.runCommand(`tellraw @a {"rawtext":[{"text":"${race === "god" ? "§e§l✦ " : "§5§l✦ "}${player.name} tirou ${R.name} na Roleta das Essências (1%)!"}]}`);
    } catch {
      /* ignore */
    }
  }
}

/** A roda 3D na frente do jogador + o letreiro girando no ritmo dela, desacelerando. */
function spin(player, race, fast) {
  const idx = RACE_IDS.indexOf(race);
  if (fast) {
    reveal(player);
    return;
  }
  const dim = player.dimension;
  const d = player.getViewDirection();
  const l = Math.hypot(d.x, d.z) || 1;
  const at = { x: player.location.x + (d.x / l) * 3.2, y: player.location.y + 0.2, z: player.location.z + (d.z / l) * 3.2 };
  try {
    const wheel = dim.spawnEntity("lila:roulette", at);
    wheel.setProperty("lila:result", idx);
    wheel.teleport(at, { facingLocation: player.location });
    system.runTimeout(() => {
      try {
        if (wheel.isValid) wheel.triggerEvent("lila:despawn");
      } catch {
        /* ignore */
      }
    }, SPIN_TICKS + 50);
  } catch {
    /* sem a entidade: só o letreiro */
  }
  // letreiro: o mesmo "ease-out" da roda (rápido no começo, devagar no fim)
  const names = RACE_IDS.map((r) => `${RACES[r].color}${RACES[r].name}`);
  const steps = [];
  const total = 5 * 6 + idx; // 5 voltas + o setor sorteado
  for (let k = 0; k <= total; k++) {
    const u = 1 - Math.cbrt(1 - k / total); // inverso de 1-(1-u)^3
    steps.push(Math.round(u * (SPIN_TICKS - 4)));
  }
  steps.forEach((t, k) => {
    system.runTimeout(() => {
      if (!player.isValid) return;
      const cur = names[k % 6];
      try {
        player.onScreenDisplay.setActionBar(`§6⟪ ${cur} §6⟫`);
        player.playSound("random.click", { volume: 0.5, pitch: 0.8 + (k / total) * 0.9 });
      } catch {
        /* ignore */
      }
    }, t);
  });
  system.runTimeout(() => player.isValid && reveal(player), SPIN_TICKS + 4);
}
