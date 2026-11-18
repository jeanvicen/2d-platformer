/**
 * Text input without experimental APIs: a custom slash command.
 *   /sombra pegue 32 troncos e volte
 * The stable chat event is not available, so this command (cheats NOT required) plus the
 * menus are the input methods. Each word arrives as a separate String parameter.
 */
import { openArsenal, openClan, openFingers, openManual, openReveal, openSeal, openShikigamiList, openTechniques } from "../jujutsu/seal_menu";
import { spin } from "../jujutsu/roulette";
import { meditate } from "../jujutsu/sukuna";
import { cast } from "../jujutsu/abilities";
import { ABILITIES, CLANS, TECHS } from "../jujutsu/clans";
import { startRitual } from "../jujutsu/ritual";
import { energyName, maxEnergyOf, sorcerer, summonDivineDogs, summonShikigami } from "../jujutsu/sorcerer";
import { SHIKIGAMI, masteryLevel } from "../jujutsu/canon";
import type { BeastSpecies } from "../core/species";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, type StartupEvent } from "@minecraft/server";
import { addressees, beastFromText, dismiss, squadIndex, squadOf, summon } from "../ai/agent_manager";
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
    p.sendMessage(`§5${r.clan ? CLANS[r.clan].name : "Sem sorteio"} · ${r.tech ? TECHS[r.tech].name : "-"}§r\n§d${energyName(r)}: §f${Math.floor(r.energy)}/${maxEnergyOf(r)} §7· domínio ${masteryLevel(r.xp)} (${r.xp} xp) · giros ${r.spins}${r.vessel ? ` · §cdedos ${r.fingersEaten} · Sukuna ${Math.round(r.influence)}%` : ""}${r.tech === "ten_shadows" ? ` §7· domados: ${r.unlocked.map((x) => SHIKIGAMI[x as BeastSpecies]?.name ?? x).join(", ")}` : ""}`);
    return;
  }
  if (/^(roleta|girar|girar roleta)$/.test(t)) {
    spin(p, false, () => openReveal(p));
    return;
  }
  if (t === "cla" || t === "clan") return openClan(p);
  if (t === "arsenal" || t === "forja") return openArsenal(p);
  if (t === "dedos" || t === "dedos de sukuna") return openFingers(p);
  if (t === "meditar") {
    meditate(p);
    return;
  }
  const ab = abilityFromText(p, t.replace(/^(tecnica|usar) /, ""));
  if (ab) {
    cast(p, ab);
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
    const beast = beastFromText(rest);
    if (!beast) {
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
    for (let i = 0; i < 0; i++) {
      const r = summon(p, { kind: "beast", species: beast });
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

/** "dominio" → the player's own domain; otherwise an ability by id or (normalized) name. */
function abilityFromText(p: Player, t: string): string | undefined {
  const r = sorcerer(p.id);
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/["()]/g, "").trim();
  if (t === "dominio" || t === "expansao de dominio") return (r.tech && TECHS[r.tech].domain) || (r.vessel ? "santuario" : "dominio");
  const alias: Record<string, string> = { "tecnica reversa": "rct", "dominio simples": "dominio_simples", "guardar na sombra": "guardar", "mergulho nas sombras": "mergulho", "black flash": "kokusen" };
  if (alias[t]) return alias[t];
  if (ABILITIES[t.replace(/ /g, "_")]) return t.replace(/ /g, "_");
  for (const a of Object.values(ABILITIES)) if (norm(a.name) === t || norm(a.name).startsWith(t + " ")) return a.id;
  return undefined;
}
