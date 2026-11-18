// Comandos opcionais /eclipse:* (não exigem cheats). O jogo inteiro funciona sem eles.
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, system } from "@minecraft/server";
import { logError } from "../core/log.js";
import { isAdmin } from "../core/permissions.js";
import { chat } from "../core/fx.js";

/** Registros feitos no evento de inicialização; handlers resolvidos tardiamente para evitar ciclos. */
export function registerCommands(registry, handlers) {
  const cmds = [
    { name: "eclipse:menu", description: "Abre o Grimório do Eclipse", run: (p) => handlers.menu(p) },
    { name: "eclipse:codice", description: "Abre o Códice (manual)", run: (p) => handlers.codex(p) },
    { name: "eclipse:kit", description: "Recupera itens do kit que estiverem faltando", run: (p) => handlers.kit(p) },
    { name: "eclipse:voltar", description: "Emergência: volta à forma normal, fecha asas e recupera relíquias", run: (p) => handlers.unstuck(p) },
    { name: "eclipse:limpar", description: "Desfaz suas criações temporárias", run: (p) => handlers.clear(p) },
    { name: "eclipse:forja", description: "Abre a Forja de Sombras", run: (p) => handlers.forge(p) },
    { name: "eclipse:lyra", description: "Fala com a Lyra: /eclipse:lyra \"pega 32 madeiras\"", params: [{ name: "pedido", type: CustomCommandParamType.String }], run: (p, text) => handlers.lyra(p, String(text ?? "")) },
    { name: "eclipse:diag", description: "Diagnóstico do ECLIPSE (admin)", admin: true, run: (p) => handlers.diag(p) },
    { name: "eclipse:autoteste", description: "Autoteste do ECLIPSE no mundo (admin)", admin: true, run: (p) => handlers.selftest(p) },
  ];
  for (const c of cmds) {
    try {
      registry.registerCommand(
        {
          name: c.name,
          description: c.description,
          permissionLevel: c.admin ? CommandPermissionLevel.GameDirectors : CommandPermissionLevel.Any,
          cheatsRequired: false,
          optionalParameters: c.params,
        },
        (origin, ...args) => {
          const src = origin.sourceEntity;
          system.run(() => {
            try {
              if (!src || src.typeId !== "minecraft:player") {
                if (c.name === "eclipse:autoteste") handlers.selftest(undefined);
                return;
              }
              if (c.admin && !isAdmin(/** @type {any} */ (src))) return chat(/** @type {any} */ (src), "§cApenas administradores.");
              c.run(src, ...args);
            } catch (e) {
              logError(`cmd.${c.name}`, e);
            }
          });
          return { status: CustomCommandStatus.Success };
        },
      );
    } catch (e) {
      logError("cmd.register", `${c.name}: ${e}`);
    }
  }
}
