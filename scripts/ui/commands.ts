/**
 * Text input without experimental APIs: a custom slash command.
 *   /sombra pegue 32 troncos e volte
 * The stable chat event is not available, so this command (cheats NOT required) plus the
 * menus are the input methods. Each word arrives as a separate String parameter.
 */
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player, system, type StartupEvent } from "@minecraft/server";
import { agentFor, personaFromText, summon } from "../ai/agent_manager";
import { handleOrder } from "../ai/brain";
import { openMain, openOrder } from "./menus";

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
  const t = text.trim().toLowerCase();
  if (t === "menu" || t === "") {
    openMain(p);
    return;
  }
  const inv = /^(invocar|invoca|chamar|summon)\b/.exec(t);
  if (inv) {
    const r = summon(p, personaFromText(t));
    if (r === "failed") p.sendMessage("§cNão consegui invocar aqui.");
    return;
  }
  const a = agentFor(p.id);
  if (!a || !a.record.active) {
    p.sendMessage("§7Você ainda não tem uma sombra ativa. Use o §dInvocador das Sombras§7 ou §f/sombra invocar luna§7.");
    return;
  }
  if (t === "ordem") {
    openOrder(p, a);
    return;
  }
  handleOrder(a, p, text);
}
