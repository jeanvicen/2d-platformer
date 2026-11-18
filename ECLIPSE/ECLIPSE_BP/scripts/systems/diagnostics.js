// Diagnóstico (desligado por padrão; visível a administradores).
import { world } from "@minecraft/server";
import { VERSION } from "../core/config.js";
import { errorCounts, perfReport, recentErrors } from "../core/log.js";
import { schedulerInfo } from "../core/scheduler.js";
import { thrownStats } from "./thrown_relic_manager.js";
import { lyraStats } from "../lyra/lyra_manager.js";
import { flightCount } from "../abilities/flight.js";
import { cachedProfiles } from "../core/player_profile.js";

export function diagnosticsText() {
  let companions = 0;
  try {
    for (const d of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) companions += world.getDimension(d).getEntities({ families: ["eclipse_companion"] }).length;
  } catch {
    /* */
  }
  const t = thrownStats();
  const l = lyraStats();
  const perf = perfReport().slice(0, 4).map((p) => `${p.scope} ${p.avg.toFixed(2)}ms`).join(", ");
  const errs = recentErrors(3).map((e) => `§c${e.scope}§7: ${e.msg.slice(0, 60)}`).join("\n");
  return [
    `§7v${VERSION} · perfis em memória: §f${cachedProfiles().size}`,
    `§7companheiros carregados: §f${companions}§7 · relíquias lançadas: §f${t.registered}§7 (em voo: ${t.live})`,
    `§7Lyra ativas: §f${l.active}§7 (trabalhando: ${l.busy}) · voando: §f${flightCount()}`,
    `§7rotinas: §f${schedulerInfo().tasks.length}§7 · mais pesadas: §f${perf || "—"}`,
    `§7erros: §f${JSON.stringify(errorCounts())}`,
    errs,
  ].join("\n");
}
