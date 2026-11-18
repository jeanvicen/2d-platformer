/**
 * Text input without experimental APIs: a custom slash command.
 *   /sombra pegue 32 troncos e volte
 * The stable chat event is not available, so this command (cheats NOT required) plus the
 * menus are the input methods. Each word arrives as a separate String parameter.
 */
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
  if (t === "menu" || t === "") {
    openMain(p);
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
    for (let i = 0; i < (beast ? n : 1); i++) {
      const r = summon(p, persona ? { kind: "companion", species: persona } : { kind: "beast", species: beast! });
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
    p.sendMessage("§7Você ainda não tem sombras ativas. Use o §dInvocador das Sombras§7 ou §f/sombra invocar luna§7.");
    return;
  }
  if (t === "ordem") {
    const first = squadOf(p.id, true)[0];
    openOrder(p, first);
    return;
  }
  dispatchOrder(p, text);
}
