/**
 * Text input without experimental APIs: a custom slash command.
 *   /sombra pegue 32 troncos e volte
 * The stable chat event is not available, so this command (cheats NOT required) plus the
 * menus are the input methods. Each word arrives as a separate String parameter.
 */
import { openManual, openSeal, openShikigamiList, openTechniques } from "../jujutsu/seal_menu";
import { startRitual } from "../jujutsu/ritual";
import { sorcerer, summonDivineDogs, summonShikigami, useTechnique } from "../jujutsu/sorcerer";
import { SHIKIGAMI, masteryLevel, maxEnergy } from "../jujutsu/canon";
import type { BeastSpecies } from "../core/species";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, type StartupEvent } from "@minecraft/server";
import { addressees, beastFromText, dismiss, personaFromText, squadIndex, squadOf, summon } from "../ai/agent_manager";
import { dispatchOrder } from "../ai/squad";
import { openMain, openOrder, openSummon } from "./menus";

const WORDS = 16;

export function registerCommands(ev: StartupEvent): void {
  const optional = [];
  for (let i = 2; i <= WORDS; i++) optional.push({ name: `p${i}`, type: CustomCommandParamType.String });
  ev.customCommandRegistry.registerCommand(
    {
      name: "shadowbound:sombra",
      description: "Dá uma ordem para a sua sombra (ex.: /sombra pegue 32 troncos e volte)",
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
      mandatoryParameters: [{ name: "ordem", type: CustomCommandParamType.String }],
      optionalParameters: optional,
    },
    (origin, ...args: unknown[]) => {
      const p = origin.sourceEntity ?? origin.initiator;
      if (!(p instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Só jogadores podem dar ordens." };
      const text = args.filter((x) => typeof x === "string" && x.length).join(" ");
      // command callbacks run in restricted mode: act on the next tick
      system.run(() => runText(p, text));
      return { status: CustomCommandStatus.Success };
    },
  );
}

function runText(p: Player, text: string): void {
  const t = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t === "menu" || t === "" || t === "selo") {
    openSeal(p);
    return;
  }
  if (t === "esquadrao") {
    openMain(p);
    return;
  }
  // Ten Shadows: rituals, energy, techniques
  const rit = /^ritual\b(.*)$/.exec(t);
  if (rit) {
    const sp = beastFromText(rit[1]);
    if (sp) startRitual(p, sp);
    else openShikigamiList(p);
    return;
  }
  if (/^(energia|dominio da tecnica|status jujutsu)$/.test(t)) {
    const r = sorcerer(p.id);
    p.sendMessage(`§5Energia amaldiçoada: §f${Math.floor(r.energy)}/${maxEnergy(r.xp)} §7· domínio ${masteryLevel(r.xp)} (${r.xp} xp) · domados: ${r.unlocked.map((x) => SHIKIGAMI[x as BeastSpecies]?.name ?? x).join(", ")}${r.destroyed.length ? ` · destruídos: ${r.destroyed.map((x) => SHIKIGAMI[x as BeastSpecies]?.name ?? x).join(", ")}` : ""}`);
    return;
  }
  const tech: Record<string, string> = { dominio: "dominio", "expansao de dominio": "dominio", "dominio simples": "dominio_simples", reforco: "reforco", "tecnica reversa": "rct", rct: "rct", mergulho: "mergulho", "mergulho nas sombras": "mergulho", guardar: "guardar", "guardar na sombra": "guardar" };
  const tm = /^(?:tecnica |usar )?(.+)$/.exec(t);
  if (tm && tech[tm[1]]) {
    useTechnique(p, tech[tm[1]]);
    return;
  }
  if (t === "tecnicas") {
    openTechniques(p);
    return;
  }
  if (t === "caderno" || t === "manual") {
    openManual(p);
    return;
  }
  // summon: "/sombra invocar luna", "/sombra invocar 2 lobos", "/sombra invocar dragao"
  const inv = /^(invocar|invoca|invoque|chamar|chame|summon)\b(.*)$/.exec(t);
  if (inv) {
    const rest = inv[2];
    const n = Math.max(1, Math.min(10, parseInt((/\b(\d+)\b/.exec(rest) ?? [])[1] ?? "1", 10)));
    const persona = personaFromText(rest);
    const beast = beastFromText(rest);
    if (!persona && !beast) {
      openSummon(p);
      return;
    }
    if (beast && /\b(caes divinos|cachorros divinos|caes)\b/.test(rest)) {
      summonDivineDogs(p);
      return;
    }
    if (beast) {
      // shikigami go through the technique: unlocked, not destroyed, enough cursed energy, field limit
      summonShikigami(p, beast);
      void n;
      return;
    }
    for (let i = 0; i < 1; i++) {
      const r = summon(p, { kind: "companion", species: persona! });
      if (r === "full") {
        p.sendMessage(`§7Esquadrão no máximo (${squadIndex(p.id).settings.maxMembers}). Aumente o limite em Configurações do esquadrão.`);
        break;
      }
      if (r === "failed") {
        p.sendMessage("§cNão consegui invocar aqui.");
        break;
      }
    }
    return;
  }
  // dismiss: "/sombra desinvocar todos", "/sombra desinvocar lobos"
  const dis = /^(desinvocar|desinvoca|desinvoque|dispensar|dispense|recolher)\b(.*)$/.exec(t);
  if (dis) {
    const { members } = addressees(p.id, dis[2].trim() || "todos");
    members.forEach((m, i) => dismiss(m, i > 0));
    return;
  }
  if (!squadOf(p.id, true).length) {
    p.sendMessage("§7Você ainda não tem sombras ativas. Use o §dSelo das Dez Sombras§7 ou §f/sombra invocar luna§7.");
    return;
  }
  if (t === "ordem") {
    const first = squadOf(p.id, true)[0];
    openOrder(p, first);
    return;
  }
  dispatchOrder(p, text);
}
