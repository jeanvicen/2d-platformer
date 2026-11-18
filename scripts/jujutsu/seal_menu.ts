/**
 * Selo das Dez Sombras: the touch-first control center of the technique.
 * Big buttons, short Portuguese labels, every action reachable without a keyboard.
 */
import { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { BEAST_INFO, type BeastSpecies } from "../core/species";
import { dismiss, squadOf } from "../ai/agent_manager";
import type { Agent } from "../ai/agent";
import { beastTick } from "../combat/beasts";
import { openMain, order, show } from "../ui/menus";
import { CATEGORY_PT, CLANS, MANUAL, ORIGIN_TAG, SHIKIGAMI, SHIKIGAMI_ORDER, TECHNIQUES, masteryLevel, maxEnergy, shikigamiLimit } from "./canon";
import { activeRitual, adaptedTo, startRitual } from "./ritual";
import { domainActive, saveSorcerer, sorcerer, summonDivineDogs, summonShikigami, techniqueState, useTechnique, withdraw } from "./sorcerer";

function header(p: Player): string {
  const r = sorcerer(p.id);
  const max = maxEnergy(r.xp);
  const bar = Math.round((r.energy / max) * 12);
  const field = squadOf(p.id, true).filter((m) => m.isBeast).length;
  const rt = activeRitual(p.id);
  return `§5Energia amaldiçoada§r §d${"▮".repeat(bar)}§8${"▮".repeat(12 - bar)}§r ${Math.floor(r.energy)}/${max}\n` +
    `§7Domínio da técnica: §f${masteryLevel(r.xp)}§7 (${r.xp} xp) · Em campo: §f${field}/${shikigamiLimit(r.xp)}` +
    `${domainActive(p.id) ? "\n§5☯ Jardim Sombrio da Quimera ATIVO" : ""}${rt ? `\n§c✠ Ritual em andamento: ${SHIKIGAMI[rt.species].name}` : ""}\n` +
    `§7Modo: ${r.canonMode ? "§aCânone" : "§dLivre"}`;
}

export function openSeal(p: Player): void {
  const f = new ActionFormData()
    .title("§5Selo das Dez Sombras")
    .body(header(p))
    .button("§l🐺 Shikigamis§r\n§8invocar · ritual · ordens")
    .button("§l✋ Técnicas e Habilidades§r\n§8energia · domínio")
    .button("§l⚔ Ordens rápidas§r\n§8para todas as invocações")
    .button("§l👥 Esquadrão§r\n§8companheiras feiticeiras")
    .button("§l🌑 Sombra (armazenamento)")
    .button("§l🏯 Clã e origem")
    .button("§l📖 Caderno")
    .button("§l⚙ Configurações")
    .button("§l§8⬇ Recolher tudo para a sombra");
  show(p, () => f.show(p), (r) => {
    switch (r.selection) {
      case 0: return openShikigamiList(p);
      case 1: return openTechniques(p);
      case 2: return openQuickOrders(p);
      case 3: return openMain(p);
      case 4: return openStorage(p);
      case 5: return openClan(p);
      case 6: return openManual(p);
      case 7: return openConfig(p);
      case 8: {
        const beasts = squadOf(p.id, true).filter((m) => m.isBeast);
        beasts.forEach((m, i) => dismiss(m, i > 0));
        p.sendMessage(beasts.length ? `§8${beasts.length} invocação(ões) voltaram para a sombra.` : "§7Nenhuma invocação em campo.");
        return;
      }
      default: return;
    }
  });
}

function stateOf(p: Player, sp: BeastSpecies): string {
  const r = sorcerer(p.id);
  const info = SHIKIGAMI[sp];
  if (r.destroyed.includes(sp)) return "§8☠ destruído";
  if (squadOf(p.id, true).some((m) => m.isBeast && m.persona === sp)) return "§a⚔ em campo";
  if (activeRitual(p.id)?.species === sp) return "§c✠ em ritual";
  if (info.freeMode) return `§d✦ Forja (custo ${info.cost})`;
  if (!r.unlocked.includes(sp)) return info.inherited ? "§8🔒 só por herança" : `§7🔒 ritual (domínio ${info.mastery})`;
  return `§f✔ pronto · custo ${info.cost}`;
}

export function openShikigamiList(p: Player): void {
  const f = new ActionFormData().title("§5Shikigamis").body(header(p) + "\n\n§7Toque em um shikigami para ver detalhes, invocar ou iniciar o ritual.");
  f.button("§l🐺 Cães Divinos (o par)§r\n§8invocação rápida");
  for (const sp of SHIKIGAMI_ORDER) f.button(`§l${SHIKIGAMI[sp].name}§r\n${stateOf(p, sp)}`);
  f.button("§8« Voltar");
  show(p, () => f.show(p), (r) => {
    if (r.selection === 0) {
      summonDivineDogs(p);
      return;
    }
    const sp = SHIKIGAMI_ORDER[(r.selection ?? 0) - 1];
    if (sp) openShikigami(p, sp);
    else openSeal(p);
  });
}

function fieldAgent(p: Player, sp: BeastSpecies): Agent | undefined {
  return squadOf(p.id, true).find((m) => m.isBeast && m.persona === sp);
}

export function openShikigami(p: Player, sp: BeastSpecies): void {
  const info = SHIKIGAMI[sp];
  const r = sorcerer(p.id);
  const a = fieldAgent(p, sp);
  const unlocked = info.freeMode || r.unlocked.includes(sp);
  const adapted = a && sp === "colossus" ? adaptedTo(a.body()!) : [];
  const body =
    `${ORIGIN_TAG[info.origin]} §l${info.name}§r\n${info.lore}\n\n` +
    `§fHabilidade:§r ${BEAST_INFO[sp].ability} ${ORIGIN_TAG[info.abilityOrigin]}\n` +
    `§fCusto:§r ${info.cost} de energia${info.ritual ? ` · ritual exige domínio ${info.mastery}` : ""}\n§fEstado:§r ${stateOf(p, sp)}` +
    (adapted.length ? `\n§6Adaptado a: ${adapted.join(", ")}` : "");
  const f = new ActionFormData().title(info.name).body(body);
  const acts: (() => void)[] = [];
  if (a) {
    f.button("§l⚡ Usar habilidade agora");
    acts.push(() => {
      if (!beastTick(a, true)) p.sendMessage(`§7${info.name} não encontrou um alvo para a habilidade.`);
    });
    for (const [label, text] of [["🐾 Seguir", "me siga"], ["🛡 Proteger você", "me proteja"], ["📍 Ficar de guarda aqui", "fique de guarda aqui"], ["🔍 Procurar e caçar inimigos", "ataque os monstros"]] as const) {
      f.button(label);
      acts.push(() => order(a, p, text));
    }
    f.button("§8🌑 Voltar para a sombra");
    acts.push(() => dismiss(a));
  } else if (unlocked && !r.destroyed.includes(sp)) {
    f.button(`§l✋ Invocar§r §8(${info.cost})`);
    acts.push(() => void summonShikigami(p, sp));
  } else if (info.ritual && !r.destroyed.includes(sp)) {
    f.button(`§l§c✠ Iniciar ritual de exorcismo§r §8(${info.cost})`);
    acts.push(() => void startRitual(p, sp));
  }
  f.button("§8« Voltar");
  acts.push(() => openShikigamiList(p));
  show(p, () => f.show(p), (res) => acts[res.selection ?? -1]?.());
}

function openQuickOrders(p: Player): void {
  const beasts = squadOf(p.id, true).filter((m) => m.isBeast);
  const opts: [string, string][] = [["🐾 Todas: seguir", "me siga"], ["🛡 Todas: proteger", "me proteja"], ["📍 Todas: guarda aqui", "fique de guarda aqui"], ["🔍 Todas: caçar inimigos", "ataque os monstros"]];
  const f = new ActionFormData().title("Ordens rápidas").body(beasts.length ? `${beasts.length} invocação(ões) em campo.` : "§7Nenhuma invocação em campo.");
  for (const [l] of opts) f.button(l);
  f.button("§8« Voltar");
  show(p, () => f.show(p), (r) => {
    const o = opts[r.selection ?? -1];
    if (!o) return openSeal(p);
    for (const m of beasts) order(m, p, o[1]);
  });
}

export function openTechniques(p: Player): void {
  const r = sorcerer(p.id);
  const f = new ActionFormData().title("§5Técnicas e Habilidades").body(header(p) + "\n\n§7Toque para usar (ativas), ligar/desligar (alternáveis). Passivas funcionam sozinhas.");
  for (const t of TECHNIQUES) f.button(`§l${t.name}§r\n§8${CATEGORY_PT[t.cat]} · ${techniqueState(p, t.id)}`);
  f.button("ℹ Explicações e origem");
  f.button("§8« Voltar");
  show(p, () => f.show(p), (res) => {
    const i = res.selection ?? -1;
    const t = TECHNIQUES[i];
    if (t) {
      if (t.id === "guardar") return openStorage(p);
      useTechnique(p, t.id);
      return;
    }
    if (i === TECHNIQUES.length) {
      const text = TECHNIQUES.map((x) => `§l${x.name}§r ${ORIGIN_TAG[x.origin]} (efeito no jogo: ${ORIGIN_TAG[x.effectOrigin]})\n§7${CATEGORY_PT[x.cat]} · domínio ${x.mastery}${x.cost ? ` · custo ${x.cost}` : ""}${x.drain ? ` · ${x.drain}/s` : ""}${x.cooldown ? ` · recarga ${x.cooldown}s` : ""}§r\n${x.desc}`).join("\n\n");
      const g = new ActionFormData().title("Técnicas: explicações").body(text).button("§8« Voltar");
      show(p, () => g.show(p), () => openTechniques(p));
      return;
    }
    void r;
    openSeal(p);
  });
}

function openStorage(p: Player): void {
  const r = sorcerer(p.id);
  const f = new ActionFormData().title("🌑 Sombra").body(`Itens guardados na sua sombra (${r.store.length}/9). Guardar custa 5 de energia.`);
  f.button("§l⬇ Guardar o item da mão");
  for (const s of r.store) f.button(`⬆ ${s.n}× ${s.id.replace("minecraft:", "")}`);
  f.button("§8« Voltar");
  show(p, () => f.show(p), (res) => {
    const i = res.selection ?? -1;
    if (i === 0) useTechnique(p, "guardar");
    else if (i > 0 && i <= r.store.length) withdraw(p, i - 1);
    else openSeal(p);
  });
}

function openClan(p: Player): void {
  const text = "§fSua origem: §5Feiticeiro(a) do clã Zenin§f, herdeiro(a) da Técnica das Dez Sombras.\n\n" +
    CLANS.map((c) => `§l${c.name}§r ${ORIGIN_TAG.canon}\n§7${c.techniques}\n§f${c.implemented}`).join("\n\n") +
    "\n\n§7Outras origens (usuário de maldição, espírito amaldiçoado, receptáculo) e os outros clãs ainda não estão no mod.";
  const f = new ActionFormData().title("🏯 Clã e origem").body(text).button("§8« Voltar");
  show(p, () => f.show(p), () => openSeal(p));
}

export function openManual(p: Player, page = -1): void {
  if (page >= 0 && MANUAL[page]) {
    const pg = MANUAL[page];
    const f = new ActionFormData().title(`📖 ${pg.title}`).body(pg.text);
    if (page + 1 < MANUAL.length) f.button(`Próxima: ${MANUAL[page + 1].title} »`);
    f.button("§8« Índice");
    show(p, () => f.show(p), (r) => openManual(p, r.selection === 0 && page + 1 < MANUAL.length ? page + 1 : -1));
    return;
  }
  const f = new ActionFormData().title("📖 Caderno").body("Tudo o que você precisa saber, em etapas.");
  for (const pg of MANUAL) f.button(pg.title);
  f.button("§8« Voltar");
  show(p, () => f.show(p), (r) => {
    const i = r.selection ?? -1;
    if (MANUAL[i]) openManual(p, i);
    else openSeal(p);
  });
}

function openConfig(p: Player): void {
  const r = sorcerer(p.id);
  const f = new ActionFormData().title("⚙ Configurações").body(
    `§fModo Cânone:§r shikigami destruído não volta e o poder é herdado.\n§fModo Livre:§r eles voltam depois de um tempo.\n\nAtual: ${r.canonMode ? "§aCânone" : "§dLivre"}§r · Barra de energia: ${r.hud ? "§aligada" : "§7desligada"}`,
  );
  f.button(r.canonMode ? "Mudar para Modo Livre" : "Mudar para Modo Cânone");
  f.button(r.hud ? "Esconder barra de energia" : "Mostrar barra de energia");
  f.button("§8« Voltar");
  show(p, () => f.show(p), (res) => {
    if (res.selection === 0) r.canonMode = !r.canonMode;
    else if (res.selection === 1) r.hud = !r.hud;
    else return openSeal(p);
    saveSorcerer(p.id);
    openConfig(p);
  });
}
