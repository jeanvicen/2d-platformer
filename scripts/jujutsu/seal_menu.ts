/**
 * Selo das Dez Sombras: the touch-first control center of the technique.
 * Organized in sections (header / label / divider), every button has an icon, texts are short.
 */
import { Player } from "@minecraft/server";
import { BEAST_INFO, type BeastSpecies } from "../core/species";
import { dismiss, squadOf } from "../ai/agent_manager";
import type { Agent } from "../ai/agent";
import { beastTick } from "../combat/beasts";
import { openMain, order } from "../ui/menus";
import { Menu } from "../ui/menu_kit";
import { ICON, shikiIcon, techIcon } from "../ui/icons";
import { CATEGORY_PT, CLANS, MANUAL, ORIGIN_TAG, SHIKIGAMI, SHIKIGAMI_ORDER, TECHNIQUES, masteryLevel, maxEnergy, shikigamiLimit, type TechCategory } from "./canon";
import { activeRitual, adaptedTo, startRitual } from "./ritual";
import { domainActive, saveSorcerer, sorcerer, summonDivineDogs, summonShikigami, techniqueState, useTechnique, withdraw } from "./sorcerer";

function energyBar(p: Player, len = 14): string {
  const r = sorcerer(p.id);
  const max = maxEnergy(r.xp);
  const n = Math.round((r.energy / max) * len);
  return `§d${"█".repeat(n)}§8${"█".repeat(len - n)}  §f${Math.floor(r.energy)}§7/${max}`;
}

function statusLine(p: Player): string {
  const r = sorcerer(p.id);
  const field = squadOf(p.id, true).filter((m) => m.isBeast).length;
  return `§7Domínio §f${masteryLevel(r.xp)}§7 · Em campo §f${field}/${shikigamiLimit(r.xp)}§7 · ${r.canonMode ? "§aCânone" : "§dLivre"}`;
}

function energyBlock(m: Menu, p: Player): Menu {
  m.header("§5✦ Energia amaldiçoada").label(energyBar(p)).label(statusLine(p));
  const rt = activeRitual(p.id);
  if (domainActive(p.id)) m.label("§5☯ Jardim Sombrio da Quimera ATIVO");
  if (rt) m.label(`§c✠ Ritual em andamento: ${SHIKIGAMI[rt.species].name}`);
  return m.divider();
}

export function openSeal(p: Player): void {
  const m = energyBlock(new Menu("§5§lSelo das Dez Sombras"), p);
  m.header("Técnica das Dez Sombras")
    .button("§lShikigamis§r\n§7invocar · rituais · ordens", ICON.dogs, () => openShikigamiList(p))
    .button("§lTécnicas e Habilidades§r\n§7passivas · ativas · domínio", ICON.hand, () => openTechniques(p))
    .button("§lOrdens rápidas§r\n§7para todas as invocações", ICON.sword, () => openQuickOrders(p))
    .divider()
    .header("Você")
    .button("§lEsquadrão§r\n§7companheiras feiticeiras", ICON.squad, () => openMain(p))
    .button("§lSombra§r\n§7guardar itens", ICON.shadow, () => openStorage(p))
    .button("§lClã e origem§r\n§7Zenin", ICON.clan, () => openClan(p))
    .divider()
    .button("§lCaderno§r\n§7tutorial e cânone", ICON.book, () => openManual(p))
    .button("§lConfigurações", ICON.gear, () => openConfig(p))
    .button("§lRecolher tudo§r\n§7todas voltam para a sombra", ICON.recall, () => {
      const beasts = squadOf(p.id, true).filter((x) => x.isBeast);
      beasts.forEach((x, i) => dismiss(x, i > 0));
      p.sendMessage(beasts.length ? `§8${beasts.length} invocação(ões) voltaram para a sombra.` : "§7Nenhuma invocação em campo.");
    })
    .open(p);
}

type Bucket = "field" | "ready" | "ritual" | "locked" | "forge" | "destroyed";
function bucketOf(p: Player, sp: BeastSpecies): Bucket {
  const r = sorcerer(p.id);
  const info = SHIKIGAMI[sp];
  if (r.destroyed.includes(sp)) return "destroyed";
  if (squadOf(p.id, true).some((x) => x.isBeast && x.persona === sp)) return "field";
  if (info.freeMode) return "forge";
  if (r.unlocked.includes(sp)) return "ready";
  if (info.ritual && masteryLevel(r.xp) >= info.mastery) return "ritual";
  return "locked";
}

function shortState(p: Player, sp: BeastSpecies): string {
  const info = SHIKIGAMI[sp];
  switch (bucketOf(p, sp)) {
    case "field": return "§a⚔ em campo";
    case "ready": return `§f✔ pronto  §d✦${info.cost}`;
    case "ritual": return activeRitual(p.id)?.species === sp ? "§c✠ em ritual" : `§c✠ ritual  §d✦${info.cost}`;
    case "forge": return `§d✦ Forja  ✦${info.cost}`;
    case "destroyed": return "§8☠ destruído";
    default: return info.inherited ? "§8✖ só por herança" : `§8✖ domínio ${info.mastery}`;
  }
}

const SECTIONS: [Bucket, string][] = [
  ["field", "§a⚔ Em campo"], ["ready", "✔ Prontos para invocar"], ["ritual", "§c✠ Rituais disponíveis"],
  ["locked", "§8✖ Ainda bloqueados"], ["forge", "§d✦ Forja de Sombras"], ["destroyed", "§8☠ Destruídos"],
];

export function openShikigamiList(p: Player): void {
  const m = energyBlock(new Menu("§5§lShikigamis"), p);
  const r = sorcerer(p.id);
  if (!r.destroyed.includes("wolf") || !r.destroyed.includes("dog_white")) {
    m.button("§lCães Divinos§r\n§7invocar o par", ICON.dogs, () => void summonDivineDogs(p));
  }
  for (const [bucket, title] of SECTIONS) {
    const list = SHIKIGAMI_ORDER.filter((sp) => bucketOf(p, sp) === bucket);
    if (!list.length) continue;
    m.divider().header(title);
    for (const sp of list) {
      const icon = bucket === "locked" ? ICON.lock : bucket === "destroyed" ? ICON.destroyed : shikiIcon(sp);
      m.button(`§l${SHIKIGAMI[sp].name}§r\n${shortState(p, sp)}`, icon, () => openShikigami(p, sp));
    }
  }
  m.divider().button("Voltar", ICON.back, () => openSeal(p)).open(p);
}

function fieldAgent(p: Player, sp: BeastSpecies): Agent | undefined {
  return squadOf(p.id, true).find((x) => x.isBeast && x.persona === sp);
}

export function openShikigami(p: Player, sp: BeastSpecies): void {
  const info = SHIKIGAMI[sp];
  const a = fieldAgent(p, sp);
  const bucket = bucketOf(p, sp);
  const adapted = a && sp === "colossus" && a.body() ? adaptedTo(a.body()!) : [];
  const m = new Menu(`§l${info.name}`);
  m.header(`${info.name}`)
    .label(`${ORIGIN_TAG[info.origin]}  ${shortState(p, sp)}`)
    .label(`§7${info.lore}`)
    .divider()
    .label(`§e⚡ Habilidade§r  ${BEAST_INFO[sp].ability}  ${ORIGIN_TAG[info.abilityOrigin]}`)
    .label(`§d✦ Custo§r  ${info.cost} de energia${info.ritual ? `   §c✠ Ritual§r  domínio ${info.mastery}` : ""}`);
  if (adapted.length) m.label(`§6⚙ Adaptado a: ${adapted.join(", ")}`);
  m.divider();
  if (a) {
    m.header("Comandos")
      .button("§lUsar habilidade", ICON.ability, () => {
        if (!beastTick(a, true)) p.sendMessage(`§7${info.name} não encontrou um alvo para a habilidade.`);
      })
      .button("Seguir", ICON.follow, () => order(a, p, "me siga"))
      .button("Proteger você", ICON.protect, () => order(a, p, "me proteja"))
      .button("Guarda aqui", ICON.guard, () => order(a, p, "fique de guarda aqui"))
      .button("Caçar inimigos", ICON.hunt, () => order(a, p, "ataque os monstros"))
      .button("Voltar para a sombra", ICON.recall, () => dismiss(a));
  } else if (bucket === "ready" || bucket === "forge") {
    m.button(`§lInvocar§r\n§d✦ ${info.cost} de energia`, ICON.summon, () => void summonShikigami(p, sp));
  } else if (bucket === "ritual") {
    m.button(`§l§cIniciar ritual§r\n§7vença sozinho · §d✦${info.cost}`, ICON.ritual, () => void startRitual(p, sp));
  }
  m.divider().button("Voltar", ICON.back, () => openShikigamiList(p)).open(p);
}

function openQuickOrders(p: Player): void {
  const beasts = squadOf(p.id, true).filter((x) => x.isBeast);
  const all = (text: string) => () => beasts.forEach((x) => order(x, p, text));
  new Menu("§lOrdens rápidas")
    .header(beasts.length ? `${beasts.length} invocação(ões) em campo` : "§7Nenhuma invocação em campo")
    .divider()
    .button("Todas: seguir", ICON.follow, all("me siga"))
    .button("Todas: proteger você", ICON.protect, all("me proteja"))
    .button("Todas: guarda aqui", ICON.guard, all("fique de guarda aqui"))
    .button("Todas: caçar inimigos", ICON.hunt, all("ataque os monstros"))
    .divider()
    .button("Voltar", ICON.back, () => openSeal(p))
    .open(p);
}

const CAT_ORDER: [TechCategory, string][] = [["passiva", "Passivas"], ["alternavel", "Alternáveis  §8(ligam e desligam)"], ["ativa", "Ativas  §8(toque para usar)"], ["suprema", "§5Suprema"]];

export function openTechniques(p: Player): void {
  const m = energyBlock(new Menu("§5§lTécnicas e Habilidades"), p);
  for (const [cat, title] of CAT_ORDER) {
    const list = TECHNIQUES.filter((t) => t.cat === cat);
    if (!list.length) continue;
    m.header(title);
    for (const t of list) {
      m.button(`§l${t.name}§r\n§7${techniqueState(p, t.id)}`, techIcon(t.id), () => (t.id === "guardar" ? openStorage(p) : void useTechnique(p, t.id)));
    }
    m.divider();
  }
  m.button("Como funciona cada uma", ICON.info, () => openTechniqueInfo(p))
    .button("Voltar", ICON.back, () => openSeal(p))
    .open(p);
}

function openTechniqueInfo(p: Player): void {
  const m = new Menu("Técnicas: como funcionam");
  for (const t of TECHNIQUES) {
    m.header(t.name)
      .label(`${ORIGIN_TAG[t.origin]} §7efeito no jogo: ${ORIGIN_TAG[t.effectOrigin]}`)
      .label(`§7${CATEGORY_PT[t.cat]} · domínio ${t.mastery}${t.cost ? ` · custo ${t.cost}` : ""}${t.drain ? ` · ${t.drain}/s` : ""}${t.cooldown ? ` · recarga ${t.cooldown}s` : ""}`)
      .label(t.desc)
      .divider();
  }
  m.button("Voltar", ICON.back, () => openTechniques(p)).open(p);
}

function openStorage(p: Player): void {
  const r = sorcerer(p.id);
  const m = new Menu("§lSombra")
    .header(`Itens na sua sombra: ${r.store.length}/9`)
    .label("§7Guardar custa 5 de energia. Tirar é grátis.")
    .divider()
    .button("§lGuardar o item da mão", techIcon("guardar"), () => void useTechnique(p, "guardar"));
  if (r.store.length) m.divider().header("Tocar para tirar");
  r.store.forEach((s, i) => m.button(`${s.n}× ${s.id.replace("minecraft:", "").replace(/_/g, " ")}`, ICON.shadow, () => void withdraw(p, i)));
  m.divider().button("Voltar", ICON.back, () => openSeal(p)).open(p);
}

function openClan(p: Player): void {
  const m = new Menu("§lClã e origem")
    .header("§5Zenin · Técnica das Dez Sombras")
    .label("§7Sua origem: feiticeiro(a) herdeiro(a) das Dez Sombras.")
    .divider();
  for (const c of CLANS) m.header(c.name).label(`${ORIGIN_TAG.canon} §7${c.techniques}`).label(c.implemented);
  m.divider().label("§7Outras origens (usuário de maldição, espírito amaldiçoado, receptáculo) ainda não estão no mod.")
    .button("Voltar", ICON.back, () => openSeal(p))
    .open(p);
}

export function openManual(p: Player, page = -1): void {
  const pg = MANUAL[page];
  if (pg) {
    const m = new Menu(`§l${pg.title}`).header(pg.title).label(pg.text).divider();
    const next = MANUAL[page + 1];
    if (next) m.button(`Próxima: ${next.title}`, ICON.book, () => openManual(p, page + 1));
    m.button("Índice", ICON.back, () => openManual(p)).open(p);
    return;
  }
  const m = new Menu("§lCaderno").header("Tudo o que você precisa saber").divider();
  MANUAL.forEach((x, i) => m.button(x.title, i === MANUAL.length - 1 ? ICON.canon : ICON.book, () => openManual(p, i)));
  m.divider().button("Voltar", ICON.back, () => openSeal(p)).open(p);
}

function openConfig(p: Player): void {
  const r = sorcerer(p.id);
  const toggle = (fn: () => void) => () => {
    fn();
    saveSorcerer(p.id);
    openConfig(p);
  };
  new Menu("§lConfigurações")
    .header("Modo de jogo")
    .label("§aCânone§7: shikigami destruído não volta e o poder é herdado.")
    .label("§dLivre§7: eles voltam depois de um tempo.")
    .button(r.canonMode ? "§lModo Cânone§r\n§7tocar para mudar para Livre" : "§lModo Livre§r\n§7tocar para mudar para Cânone", r.canonMode ? ICON.on : ICON.off, toggle(() => (r.canonMode = !r.canonMode)))
    .divider()
    .header("Tela")
    .button(r.hud ? "§lBarra de energia: ligada" : "§lBarra de energia: desligada", r.hud ? ICON.on : ICON.off, toggle(() => (r.hud = !r.hud)))
    .divider()
    .button("Voltar", ICON.back, () => openSeal(p))
    .open(p);
}
