// Progressão: XP de domínio por Modo, níveis, pontos, títulos e desafios.
// Por padrão TUDO está liberado (pedido do criador); a progressão dá títulos, bônus e metas.
import { LEVEL_TITLES, MODES, xpForLevel } from "../core/config.js";
import { chat, playerParticle, playerSound, title } from "../core/fx.js";
import { getProfile, markDirty, saveSoon } from "../core/player_profile.js";
import { system } from "@minecraft/server";
import { QUESTS } from "../data/quests.js";

/** Anti-farm: limita XP repetido da mesma fonte por janela de tempo. */
const recent = new Map();

export function addXp(player, amount, source = "misc") {
  try {
    const key = `${player.id}:${source}`;
    const now = system.currentTick;
    const r = recent.get(key) ?? { t: now, n: 0 };
    if (now - r.t > 1200) {
      r.t = now;
      r.n = 0;
    }
    r.n++;
    recent.set(key, r);
    const scale = r.n > 30 ? 0.1 : r.n > 15 ? 0.5 : 1;
    const gain = Math.max(0, Math.round(amount * scale));
    if (!gain) return;
    const p = getProfile(player);
    const m = p.modes[p.mode];
    m.xp += gain;
    p.totalXp += gain;
    let leveled = false;
    while (m.xp >= xpForLevel(m.level)) {
      m.xp -= xpForLevel(m.level);
      m.level++;
      m.points++;
      leveled = true;
    }
    markDirty(player);
    if (leveled) onLevelUp(player, p, m.level);
  } catch {
    /* jogador pode ter saído */
  }
}

function onLevelUp(player, p, level) {
  const t = levelTitle(level);
  const mode = MODES[p.mode];
  title(player, `${mode.color}§lNÍVEL ${level}`, `§7${mode.name} · §f${t}`, 60);
  playerSound(player, "eclipse.levelup", 1, 1);
  playerParticle(player, "eclipse:spark_burst", { x: player.location.x, y: player.location.y + 1.2, z: player.location.z }, { color: mode.rgb, count: 40, speed: 4 });
  chat(player, `§5✦ §fVocê alcançou o nível §d${level}§f no modo ${mode.color}${mode.name}§f — título: §d${t}§f. (+1 ponto de domínio)`);
  saveSoon(player);
}

export function levelTitle(level) {
  return LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.max(0, level - 1))] + (level > LEVEL_TITLES.length ? ` ${"★".repeat(Math.min(5, level - LEVEL_TITLES.length))}` : "");
}

/** Contabiliza progresso de desafios (sem depender só de matar entidades). */
export function questProgress(player, id, amount = 1) {
  const q = QUESTS.find((x) => x.id === id);
  if (!q) return;
  const p = getProfile(player);
  const st = p.quests[id] ?? { n: 0, done: false };
  if (st.done) return;
  st.n += amount;
  if (st.n >= q.goal) {
    st.done = true;
    if (q.title && !p.titles.includes(q.title)) p.titles.push(q.title);
    chat(player, `§6✦ Desafio concluído: §f${q.name}§6 — +${q.xp} XP${q.title ? ` · título §d${q.title}` : ""}`);
    playerSound(player, "eclipse.levelup", 0.8, 1.3);
    p.quests[id] = st;
    markDirty(player);
    addXp(player, q.xp, `quest:${id}`);
    return;
  }
  p.quests[id] = st;
  markDirty(player);
}

/** Exploração: novos biomes e novas regiões dão XP. */
const lastChunk = new Map();
export function explorationTick(player) {
  try {
    const p = getProfile(player);
    const cx = Math.floor(player.location.x / 64), cz = Math.floor(player.location.z / 64);
    const key = `${player.dimension.id}:${cx}:${cz}`;
    if (lastChunk.get(player.id) !== key) {
      lastChunk.set(player.id, key);
      p.chunks++;
      addXp(player, 3, "explore");
      questProgress(player, "wanderer");
    }
    const biome = player.dimension.getBiome(player.location)?.id;
    if (biome && !p.biomes.includes(biome)) {
      p.biomes.push(biome);
      if (p.biomes.length > 1) {
        chat(player, `§b✦ Novo bioma descoberto: §f${biome.replace("minecraft:", "").replace(/_/g, " ")}§b (+15 XP)`);
        addXp(player, 15, "biome");
      }
      questProgress(player, "biomes");
      markDirty(player);
    }
  } catch {
    /* getBiome pode falhar em chunks em geração */
  }
}

export function forget(playerId) {
  lastChunk.delete(playerId);
}
