// Só para testes no servidor: cria jogadores simulados ("Dono", "Intruso") e executa ações
// deles (bater, balançar o braço) para o autoteste do DR-0N.
import { system, world, GameMode } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

const SIMS = new Map();

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  try {
    const dim = world.getDimension("overworld");
    if (ev.id === "lilatest:spawn_owner") {
      const p = spawnSimulatedPlayer({ dimension: dim, x: 0.5, y: 151, z: 6.5 }, "Dono", GameMode.Survival);
      SIMS.set("Dono", p);
      console.info(`LILA-HARNESS owner spawned ${p.id}`);
    } else if (ev.id === "lilatest:spawn_intruder") {
      const p = spawnSimulatedPlayer({ dimension: dim, x: 4.5, y: 151, z: 6.5 }, "Intruso", GameMode.Survival);
      SIMS.set("Intruso", p);
      console.info(`LILA-HARNESS intruder spawned ${p.id}`);
    } else if (ev.id === "lilatest:act") {
      // "<quem> <acao> [alvo-por-id]"
      const [who, act, target] = ev.message.split(" ");
      const p = SIMS.get(who);
      if (!p) return;
      if (act === "swing") p.attack();
      else if (act === "hit") {
        const t = world.getEntity(target);
        if (t) p.attackEntity(t);
      } else if (act === "remove") p.remove?.();
      else if (act === "sneak") {
        // agachar (o jogo desmonta de veículos assim)
        p.isSneaking = true;
        system.runTimeout(() => {
          try {
            p.isSneaking = false;
          } catch {
            /* ignore */
          }
        }, 12);
      }
    }
  } catch (e) {
    console.info(`LILA-HARNESS error ${e}`);
  }
});
