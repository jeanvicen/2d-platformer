// Só para testes no servidor: cria um jogador simulado ("Dono") e entrega para o autoteste da Lila.
import { system, world, GameMode } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "lilatest:spawn_owner") return;
  try {
    const dim = world.getDimension("overworld");
    const p = spawnSimulatedPlayer({ dimension: dim, x: 0.5, y: 151, z: 6.5 }, "Dono", GameMode.Survival);
    console.info(`LILA-HARNESS owner spawned ${p.id}`);
  } catch (e) {
    console.info(`LILA-HARNESS spawn failed ${e}`);
  }
});
