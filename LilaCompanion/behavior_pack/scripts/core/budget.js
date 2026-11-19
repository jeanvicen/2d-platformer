// Orçamento de CPU por tick: todo trabalho pesado (A*, varredura de blocos, obras) consulta
// isto e cede o tick quando passa do limite. Evita engasgos e o "vigia" (watchdog) do jogo,
// que derruba o mundo quando um script demora demais num único tick (muito mais rígido no celular).
let tickStart = Date.now();

/** Chamado no começo de cada tick pelo agendador. */
export function beginTick() {
  tickStart = Date.now();
}

/** Milissegundos gastos pelos scripts da Lila neste tick. */
export function spent() {
  return Date.now() - tickStart;
}

/** Passou do limite deste tick? (padrão 8 ms) */
export function overBudget(ms = 8) {
  return Date.now() - tickStart > ms;
}

/** Dentro de um generator: `yield* breathe()` cede o tick só se o orçamento acabou. */
export function* breathe(ms = 8) {
  if (Date.now() - tickStart > ms) yield 1;
}
