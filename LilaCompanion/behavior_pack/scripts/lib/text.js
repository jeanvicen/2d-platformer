// Processamento de texto em português (puro): normalização, números por extenso, similaridade.

export function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s) {
  return normalize(s).split(" ").filter(Boolean);
}

const UNITS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500,
};
const VAGUE = { pouco: 8, poucos: 8, poucas: 8, algumas: 12, alguns: 12, bastante: 48, muito: 64, muita: 64, muitos: 64, muitas: 64, monte: 64 };

/** Extrai a primeira quantidade do texto ("32", "vinte e cinco", "2 pilhas", "uma duzia", "muita"). */
export function parseAmount(text, fallback = null) {
  const t = tokens(text);
  for (let i = 0; i < t.length; i++) {
    const w = t[i];
    if (/^\d+$/.test(w)) {
      let n = parseInt(w, 10);
      if (t[i + 1] === "pilhas" || t[i + 1] === "pilha" || t[i + 1] === "stacks" || t[i + 1] === "stack") n *= 64;
      if (t[i + 1] === "duzias" || t[i + 1] === "duzia") n *= 12;
      return n;
    }
    if (w === "duzia" || w === "duzias") return (t[i - 1] === "meia" ? 6 : 12);
    if (w === "pilha" || w === "stack") return 64;
    if (w in UNITS) {
      // soma composições: "vinte e cinco", "cento e vinte"
      let n = UNITS[w];
      let j = i + 1;
      while (j + 1 < t.length && t[j] === "e" && t[j + 1] in UNITS && UNITS[t[j + 1]] < n) {
        n += UNITS[t[j + 1]];
        j += 2;
      }
      if (t[j] === "pilhas" || t[j] === "pilha") n *= 64;
      if (t[j] === "duzias" || t[j] === "duzia") n *= 12;
      // "um", "uma" sozinhos geralmente são artigos ("uma casa"): só valem se seguidos de unidade de contagem
      if ((w === "um" || w === "uma") && n === 1 && !["pilha", "pilhas", "duzia", "duzias", "bloco", "blocos", "tronco"].includes(t[j] ?? "")) continue;
      return n;
    }
    if (w in VAGUE) return VAGUE[w];
  }
  return fallback;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Palavras parecidas (tolerância a erros de digitação no celular). */
export function similar(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const tol = a.length >= 8 ? 2 : 1;
  return levenshtein(a, b) <= tol;
}

/** Retorna true se algum token do texto casa (exato/prefixo/similar) com alguma palavra-chave. */
export function hasAny(tok, words) {
  for (const w of words) {
    if (w.includes(" ")) {
      if (tok.join(" ").includes(w)) return true;
      continue;
    }
    for (const t of tok) {
      if (t === w || (w.length >= 5 && t.startsWith(w)) || similar(t, w)) return true;
    }
  }
  return false;
}
