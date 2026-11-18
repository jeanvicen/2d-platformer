/**
 * Grimório Jujutsu: the touch-first hub. Sections with headers, icon buttons, short texts.
 * Innate abilities are cast with one tap from the main screen; sneak + use the Grimório casts the quick ability.
 */
import { Player } from "@minecraft/server";
import { BEAST_INFO, type BeastSpecies } from "../core/species";
import { dismiss, squadOf } from "../ai/agent_manager";
import type { Agent } from "../ai/agent";
import { beastTick } from "../combat/beasts";
import { order } from "../ui/menus";
import { Menu } from "../ui/menu_kit";
import { ICON, abilityIcon, clanIcon, itemIcon, shikiIcon, techCrest } from "../ui/icons";
import { MANUAL, ORIGIN_TAG, SHIKIGAMI, SHIKIGAMI_ORDER, masteryLevel, shikigamiLimit } from "./canon";
import { ABILITIES, CLANS, CLAN_ORDER, TECHS, type AbilityInfo } from "./clans";
import { abilitiesFor, abilityState, blocked, cast } from "./abilities";
import { activeRitual, adaptedTo, startRitual } from "./ritual";
import { energyName, maxEnergyOf, saveSorcerer, sorcerer, summonDivineDogs, summonShikigami, usesVigor, withdraw } from "./sorcerer";
import { GEAR, forge, missing, prettyId, type GearInfo } from "./arsenal";
import { FINGERS_TOTAL, fingersInWorld, isPossessed, meditate } from "./sukuna";
import { spin } from "./roulette";

const CAT_PT = { ativa: "Ativa", alternavel: "Alternável", passiva: "Passiva", dominio: "Domínio" } as const;

function energyLines(m: Menu, p: Player): Menu {
  const r = sorcerer(p.id);
  const max = maxEnergyOf(r);
  const n = Math.round((r.energy / max) * 14);
  const col = usesVigor(r) ? "§6" : "§d";
  m.label(`${col}${"█".repeat(n)}§8${"█".repeat(14 - n)}  §f${Math.floor(r.energy)}§7/${max} ${energyName(r).toLowerCase()}`);
  const extra: string[] = [];
  if (r.tech === "speech") extra.push(`§5garganta ${Math.round(r.throat)}%`);
  if (r.vessel) extra.push(`§cSukuna ${Math.round(r.influence)}% · ${r.fingersEaten} dedo(s)`);
  if (r.domain && r.domain.until > Date.now()) extra.push("§5☯ domínio aberto");
  if (activeRitual(p.id)) extra.push(`§c✠ ritual: ${SHIKIGAMI[activeRitual(p.id)!.species].name}`);
  if (extra.length) m.label(extra.join("§7 · "));
  return m;
}

function header(m: Menu, p: Player): Menu {
  const r = sorcerer(p.id);
  if (!r.clan || !r.tech) return m.header("§7Clã ainda não sorteado").label("§7A roleta começa sozinha ao entrar no mundo.");
  const c = CLANS[r.clan];
  m.header(`${c.tag}${c.name}§r · ${TECHS[r.tech].name}`)
    .label(`§7${c.rarity} · domínio §f${masteryLevel(r.xp)}§7 · giros §f${r.spins}`);
  return energyLines(m, p).divider();
}

function abilityButton(m: Menu, p: Player, a: AbilityInfo, after?: () => void): void {
  m.button(`§l${a.name}§r\n${abilityState(p, a.id)}`, abilityIcon(a.icon), () => {
    cast(p, a.id);
    after?.();
  });
}

export function openSeal(p: Player): void {
  const r = sorcerer(p.id);
  if (isPossessed(p.id)) {
    p.sendMessage("§c[Sukuna]§r Este corpo é meu agora. Espere.");
    return;
  }
  const m = header(new Menu("§5§lGrimório Jujutsu"), p);
  if (r.tech) {
    const innate = abilitiesFor(r).filter((a) => TECHS[r.tech!].abilities.includes(a.id) && a.kind !== "passiva").slice(0, 4);
    m.header(usesVigor(r) ? "Habilidades" : "Técnica inata");
    for (const a of innate) abilityButton(m, p, a);
    m.button("§lTodas as técnicas§r\n§7domínio · gerais · rápida", ICON.hand, () => openTechniques(p)).divider();
  }
  m.header("Jujutsu");
  if (r.tech === "ten_shadows") {
    m.button("§lShikigamis§r\n§7invocar · rituais · ordens", ICON.dogs, () => openShikigamiList(p))
      .button("§lOrdens rápidas§r\n§7para as invocações", ICON.sword, () => openQuickOrders(p))
      .button("§lSombra§r\n§7guardar itens", ICON.shadow, () => openStorage(p));
  }
  m.button("§lArsenal§r\n§7forjar armas e uniformes", itemIcon("sb_split_soul_katana"), () => openArsenal(p))
    .button(`§lDedos de Sukuna§r\n§7${fingersInWorld()}/${FINGERS_TOTAL} encontrados no mundo`, itemIcon("sb_sukuna_finger"), () => openFingers(p))
    .button(`§lClã e roleta§r\n§7${r.spins} giro(s)`, r.clan ? clanIcon(r.clan) : ICON.clan, () => openClan(p))
    .divider()
    .button("§lCaderno§r\n§7tutorial e cânone", ICON.book, () => openManual(p))
    .button("§lConfigurações", ICON.gear, () => openConfig(p));
  if (r.tech === "ten_shadows") {
    m.button("§lRecolher invocações", ICON.recall, () => {
      const beasts = squadOf(p.id, true).filter((x) => x.isBeast);
      beasts.forEach((x, i) => dismiss(x, i > 0));
      p.sendMessage(beasts.length ? `§8${beasts.length} invocação(ões) voltaram para a sombra.` : "§7Nenhuma invocação em campo.");
    });
  }
  m.open(p);
}

/** Shown after the roulette lands. */
export function openReveal(p: Player): void {
  const r = sorcerer(p.id);
  if (!r.clan || !r.tech) return;
  const c = CLANS[r.clan];
  const t = TECHS[r.tech];
  const m = new Menu("§5§lRoleta de Clã")
    .header(`${c.tag}§l${c.name}`)
    .label(`${ORIGIN_TAG[c.origin]} §7${c.rarity} · chance ${c.weight}%`)
    .label(`§7${c.desc}`)
    .divider()
    .header(`§f${t.name}`)
    .label(`${ORIGIN_TAG[t.origin]} §7${t.desc}`)
    .divider()
    .header("Habilidades");
  for (const id of [...t.abilities, ...(t.domain ? [t.domain] : [])]) {
    const a = ABILITIES[id];
    m.label(`§f${a.name}§7 · ${CAT_PT[a.kind]}${a.mastery ? ` · domínio ${a.mastery}` : ""}`);
  }
  m.divider()
    .button("§lComeçar§r\n§7abrir o Grimório", clanIcon(r.clan), () => openSeal(p))
    .button("§lCaderno§r\n§7como funciona", ICON.book, () => openManual(p))
    .open(p);
}

export function openTechniques(p: Player): void {
  const r = sorcerer(p.id);
  const all = abilitiesFor(r);
  const m = header(new Menu("§5§lTécnicas e Habilidades"), p);
  const groups: [string, AbilityInfo[]][] = [];
  if (r.tech) groups.push([`§fTécnica inata: ${TECHS[r.tech].name}`, all.filter((a) => TECHS[r.tech!].abilities.includes(a.id))]);
  if (r.vessel) groups.push(["§cSantuário (Sukuna)", all.filter((a) => TECHS.shrine.abilities.includes(a.id))]);
  groups.push(["§5Expansão de Domínio", all.filter((a) => a.kind === "dominio")]);
  groups.push(["Técnicas gerais", all.filter((a) => ["reforco", "kokusen", "dominio_simples", "rct"].includes(a.id))]);
  for (const [title, list] of groups) {
    if (!list.length) continue;
    m.header(title);
    for (const a of list) abilityButton(m, p, a);
    m.divider();
  }
  if (r.tech && !TECHS[r.tech].domain && !r.vessel) m.label("§7Sua técnica não tem Expansão de Domínio conhecida na obra.");
  m.button(`§lHabilidade rápida§r\n§7agachar + usar o Grimório: ${r.quick ? ABILITIES[r.quick]?.name ?? "-" : "escolher"}`, ICON.ability, () => openQuick(p))
    .button("Como funciona cada uma", ICON.info, () => openAbilityInfo(p))
    .button("Voltar", ICON.back, () => openSeal(p))
    .open(p);
}

function openQuick(p: Player): void {
  const r = sorcerer(p.id);
  const m = new Menu("§lHabilidade rápida").header("Toque na habilidade que sai ao agachar e usar o Grimório").divider();
  for (const a of abilitiesFor(r).filter((x) => x.kind !== "passiva" && !blocked(r, x))) {
    m.button(`§l${a.name}${r.quick === a.id ? " §a(atual)" : ""}`, abilityIcon(a.icon), () => {
      r.quick = a.id;
      saveSorcerer(p.id);
      p.sendMessage(`§5Habilidade rápida:§f ${a.name}`);
      openTechniques(p);
    });
  }
  m.divider().button("Voltar", ICON.back, () => openTechniques(p)).open(p);
}

function openAbilityInfo(p: Player): void {
  const r = sorcerer(p.id);
  const m = new Menu("Habilidades: como funcionam");
  for (const a of abilitiesFor(r)) {
    m.header(a.name)
      .label(`${ORIGIN_TAG[a.origin]} §7efeito no jogo: ${ORIGIN_TAG[a.effectOrigin]}`)
      .label(`§7${CAT_PT[a.kind]} · domínio ${a.mastery}${a.fingers ? ` · ${a.fingers} dedos` : ""}${a.cost ? ` · custo ${a.cost}` : ""}${a.drain ? ` · ${a.drain}/s` : ""}${a.cooldown ? ` · recarga ${a.cooldown}s` : ""}${a.hp ? ` · ${a.hp} de vida` : ""}${a.throat ? ` · garganta +${a.throat}` : ""}`)
      .label(a.desc)
      .divider();
  }
  m.button("Voltar", ICON.back, () => openTechniques(p)).open(p);
}

// ------------------------------------------------------------------------------------------
// Clan & roulette
// ------------------------------------------------------------------------------------------
export function openClan(p: Player): void {
  const r = sorcerer(p.id);
  const m = new Menu("§lClã e roleta");
  if (r.clan && r.tech) m.header(`Seu clã: ${CLANS[r.clan].tag}${CLANS[r.clan].name}`).label(`§f${TECHS[r.tech].name}`);
  m.label(`§7Giros: §f${r.spins}§7 (ganhe +1 a cada nível de domínio). Girar troca o clã e a técnica; domínio, dedos e itens continuam.`)
    .button(`§lGirar a roleta§r\n§7${r.spins} giro(s) disponível(is)`, ICON.canon, () => {
      new Menu("§lGirar a roleta?")
        .header("Trocar de clã e técnica?")
        .label("§7Você perde o clã atual e as técnicas dele. Isso usa 1 giro.")
        .button("§lGirar!", ICON.canon, () => void spin(p, false, () => openReveal(p)))
        .button("Cancelar", ICON.back, () => openClan(p))
        .open(p);
    })
    .divider()
    .header("Todos os clãs");
  for (const id of CLAN_ORDER) {
    const c = CLANS[id];
    m.button(`${c.tag}§l${c.name}§r\n§7${c.rarity} · ${c.weight}%`, clanIcon(id), () => openClanInfo(p, id));
  }
  m.divider().button("Voltar", ICON.back, () => openSeal(p)).open(p);
}

function openClanInfo(p: Player, id: keyof typeof CLANS): void {
  const c = CLANS[id];
  const total = c.techs.reduce((s, t) => s + t.weight, 0);
  const m = new Menu(`§l${c.name}`).header(`${c.tag}${c.name}`).label(`${ORIGIN_TAG[c.origin]} §7${c.desc}`).divider();
  for (const t of c.techs) {
    const ti = TECHS[t.tech];
    m.button(`§l${ti.name}§r\n§7${Math.round((t.weight / total) * 100)}% dentro do clã`, techCrest(t.tech), () => {
      const g = new Menu(ti.name).header(ti.name).label(`${ORIGIN_TAG[ti.origin]} §7${ti.desc}`).divider();
      for (const aid of [...ti.abilities, ...(ti.domain ? [ti.domain] : [])]) {
        const a = ABILITIES[aid];
        g.label(`§f${a.name}§7 · ${CAT_PT[a.kind]} ${ORIGIN_TAG[a.origin]}`).label(`§7${a.desc}`);
      }
      g.divider().button("Voltar", ICON.back, () => openClanInfo(p, id)).open(p);
    });
  }
  m.divider().button("Voltar", ICON.back, () => openClan(p)).open(p);
}

// ------------------------------------------------------------------------------------------
// Arsenal & Sukuna's fingers
// ------------------------------------------------------------------------------------------
export function openArsenal(p: Player): void {
  const m = new Menu("§lArsenal").label("§7Forje com os materiais do seu inventário. Fragmentos Amaldiçoados caem de inimigos derrotados.");
  const sections: [GearInfo["kind"], string][] = [["ferramenta", "Ferramentas amaldiçoadas"], ["uniforme", "Uniformes e roupas"], ["consumivel", "Consumíveis"]];
  for (const [kind, title] of sections) {
    m.divider().header(title);
    for (const g of GEAR.filter((x) => x.kind === kind)) {
      const miss = Object.keys(g.cost).length ? missing(p, g) : ["não forjável"];
      m.button(`§l${g.name}§r\n${miss.length ? `§7falta: ${miss.slice(0, 2).join(", ")}` : "§apronto para forjar"}`, itemIcon(g.icon), () => openGear(p, g));
    }
  }
  m.divider().button("Voltar", ICON.back, () => openSeal(p)).open(p);
}

function openGear(p: Player, g: GearInfo): void {
  const m = new Menu(`§l${g.name}`).header(g.name).label(`${ORIGIN_TAG[g.origin]} §7efeito no jogo: ${ORIGIN_TAG[g.effectOrigin]}`).label(g.desc).divider();
  const cost = Object.entries(g.cost);
  if (cost.length) {
    m.header("Materiais");
    for (const [id, n] of cost) m.label(`§f${n}× ${prettyId(id)}`);
    m.divider().button("§lForjar", ICON.hand, () => {
      forge(p, g);
      openArsenal(p);
    });
  }
  m.button("Voltar", ICON.back, () => openArsenal(p)).open(p);
}

export function openFingers(p: Player): void {
  const r = sorcerer(p.id);
  const m = new Menu("§lDedos de Sukuna")
    .header(`§c${fingersInWorld()}/${FINGERS_TOTAL}§r encontrados neste mundo`)
    .label("§7São 20 dedos, indestrutíveis, com a alma do Rei das Maldições. Caem raramente de inimigos derrotados. Para comer, segure o dedo e use (como comida).")
    .divider();
  if (r.vessel) {
    m.header("§cVocê é o receptáculo")
      .label(`§fDedos comidos: §c${r.fingersEaten}§f · influência de Sukuna: §c${Math.round(r.influence)}%`)
      .label("§7Com influência alta (e vida baixa), Sukuna pode assumir seu corpo por alguns segundos. Meditar empurra ele de volta.")
      .label("§fLiberado: Desmantelar · Clivar (3) · Fuga (10) · Santuário Malevolente (15)")
      .button("§lMeditar§r\n§7-12% de influência · 40 de energia", ICON.energy, () => {
        meditate(p);
        openFingers(p);
      });
  } else {
    m.header("Você ainda não é um receptáculo")
      .label("§7Na obra, quase todo mundo morre ao comer um dedo. No mod: 25% de chance de o corpo aceitar; se não aceitar, você sobrevive por pouco.");
  }
  m.label(`§8Cânone: os 20 dedos e o veneno ${ORIGIN_TAG.canon} · chance e influência ${ORIGIN_TAG.original}`)
    .divider()
    .button("Voltar", ICON.back, () => openSeal(p))
    .open(p);
}

// ------------------------------------------------------------------------------------------
// Ten Shadows: shikigami, orders, storage
// ------------------------------------------------------------------------------------------
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
  const r = sorcerer(p.id);
  if (r.tech !== "ten_shadows") {
    p.sendMessage("§7Só quem herdou a §fTécnica das Dez Sombras§7 tem shikigamis.");
    return;
  }
  const m = header(new Menu("§5§lShikigamis"), p);
  m.label(`§7Em campo: §f${squadOf(p.id, true).filter((x) => x.isBeast).length}/${shikigamiLimit(r.xp)}`);
  if (!r.destroyed.includes("wolf") || !r.destroyed.includes("dog_white")) m.button("§lCães Divinos§r\n§7invocar o par", ICON.dogs, () => void summonDivineDogs(p));
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
  m.header(info.name)
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

function openStorage(p: Player): void {
  const r = sorcerer(p.id);
  const m = new Menu("§lSombra")
    .header(`Itens na sua sombra: ${r.store.length}/9`)
    .label("§7Guardar custa 5 de energia. Tirar é grátis.")
    .divider()
    .button("§lGuardar o item da mão", abilityIcon("guardar"), () => void cast(p, "guardar"));
  if (r.store.length) m.divider().header("Tocar para tirar");
  r.store.forEach((s, i) => m.button(`${s.n}× ${s.id.replace(/^\w+:/, "").replace(/_/g, " ")}`, ICON.shadow, () => void withdraw(p, i)));
  m.divider().button("Voltar", ICON.back, () => openSeal(p)).open(p);
}

// ------------------------------------------------------------------------------------------
// Manual & settings
// ------------------------------------------------------------------------------------------
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
    .header("Shikigamis (Dez Sombras)")
    .label("§aCânone§7: shikigami destruído não volta e o poder é herdado. §dLivre§7: eles voltam.")
    .button(r.canonMode ? "§lModo Cânone§r\n§7tocar para mudar para Livre" : "§lModo Livre§r\n§7tocar para mudar para Cânone", r.canonMode ? ICON.on : ICON.off, toggle(() => (r.canonMode = !r.canonMode)))
    .divider()
    .header("Tela")
    .button(r.hud ? "§lBarra de energia: ligada" : "§lBarra de energia: desligada", r.hud ? ICON.on : ICON.off, toggle(() => (r.hud = !r.hud)))
    .divider()
    .button("Voltar", ICON.back, () => openSeal(p))
    .open(p);
}
