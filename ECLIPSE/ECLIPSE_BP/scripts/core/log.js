// Diagnóstico: erros ficam em um buffer circular (sem inundar o chat).
const RING = [];
const MAX = 40;
const counters = new Map();

export function logError(scope, err) {
  const msg = err instanceof Error ? `${err.message}` : String(err);
  const stack = err instanceof Error && err.stack ? String(err.stack).split("\n").slice(0, 3).join(" | ") : "";
  RING.push({ t: Date.now(), scope, msg, stack });
  if (RING.length > MAX) RING.shift();
  counters.set(scope, (counters.get(scope) ?? 0) + 1);
  console.warn(`[ECLIPSE:${scope}] ${msg}${stack ? " :: " + stack : ""}`);
}

export function logInfo(scope, msg) {
  console.info(`[ECLIPSE:${scope}] ${msg}`);
}

export function recentErrors(n = 10) {
  return RING.slice(-n);
}

export function errorCounts() {
  return Object.fromEntries(counters);
}

/** Executa fn protegendo contra exceções; retorna fallback em caso de erro. */
export function safe(scope, fn, fallback = undefined) {
  try {
    return fn();
  } catch (e) {
    logError(scope, e);
    return fallback;
  }
}

/** Mede tempo médio (ms) de rotinas periódicas para o painel de diagnóstico. */
const perf = new Map();
export function measure(scope, fn) {
  const t0 = Date.now();
  try {
    return fn();
  } catch (e) {
    logError(scope, e);
  } finally {
    const dt = Date.now() - t0;
    const p = perf.get(scope) ?? { n: 0, total: 0, max: 0 };
    p.n++;
    p.total += dt;
    p.max = Math.max(p.max, dt);
    perf.set(scope, p);
  }
}

export function perfReport() {
  const out = [];
  for (const [k, p] of perf) out.push({ scope: k, avg: p.n ? p.total / p.n : 0, max: p.max, runs: p.n });
  return out.sort((a, b) => b.avg - a.avg);
}
