/**
 * Text normalisation for Brazilian Portuguese commands. Pure module.
 * - lowercase, strip accents and punctuation
 * - number words -> digits ("vinte e cinco" -> "25", "uma duzia" -> "12", "um pack" -> "64")
 */

const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const TENS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};
const HUNDREDS: Record<string, number> = { cem: 100, cento: 100, duzentos: 200, duzentas: 200 };

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalize(input: string): string {
  let s = stripAccents(input.toLowerCase());
  s = s.replace(/[!?.;:"'()\[\]{}…]+/g, " ").replace(/,/g, " , ").replace(/\s+/g, " ").trim();
  s = s.replace(/\bvc\b/g, "voce").replace(/\bpq\b/g, "por que").replace(/\bq\b/g, "que").replace(/\btb\b/g, "tambem");
  s = s.replace(/\bporque\b/g, "por que").replace(/\bpra\b/g, "para").replace(/\bpro\b/g, "para o");
  s = s.replace(/\bta\b/g, "esta").replace(/\bto\b/g, "estou").replace(/\bne\b/g, "");
  s = numberWords(s);
  return s.replace(/\s+/g, " ").trim();
}

/** Replace number-word sequences with digits. */
export function numberWords(s: string): string {
  // stack units
  s = s.replace(/\b(meio|meia) (pack|pilha|stack|status)\b/g, "32");
  s = s.replace(/\b(\d+|um|uma|dois|duas|tres) (packs?|pilhas?|stacks?|status)\b/g, (_m, n: string) => {
    const k = /^\d+$/.test(n) ? parseInt(n, 10) : UNITS[n] ?? 1;
    return String(k * 64);
  });
  s = s.replace(/\b(packs?|pilhas?|stacks?)\b/g, "64");
  s = s.replace(/\bmeia duzia\b/g, "6").replace(/\b(uma )?duzia\b/g, "12");
  const tokens = s.split(" ");
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let total = 0;
    let consumed = 0;
    let any = false;
    let j = i;
    while (j < tokens.length) {
      const t = tokens[j];
      if (t in HUNDREDS) {
        total += HUNDREDS[t];
        any = true;
        j++;
        consumed = j;
      } else if (t in TENS) {
        total += TENS[t];
        any = true;
        j++;
        consumed = j;
      } else if (t in UNITS && !(any && total % 10 !== 0)) {
        // "um/uma" alone are articles unless followed by a noun we count; keep them as 1 only
        // when part of a larger number or followed by a countable word.
        total += UNITS[t];
        any = true;
        j++;
        consumed = j;
      } else if (t === "e" && any && j + 1 < tokens.length && (tokens[j + 1] in UNITS || tokens[j + 1] in TENS)) {
        j++;
      } else {
        break;
      }
    }
    if (any) {
      const slice = tokens.slice(i, consumed);
      // keep lone articles "um"/"uma" as words (e.g. "uma casa"), unless followed by a count noun
      if (slice.length === 1 && (slice[0] === "um" || slice[0] === "uma")) {
        out.push(slice[0]);
      } else {
        out.push(String(total));
      }
      i = consumed;
    } else {
      out.push(tokens[i]);
      i++;
    }
  }
  return out.join(" ");
}

export function has(s: string, re: RegExp): boolean {
  return re.test(s);
}

export function firstNumber(s: string): number | undefined {
  const m = /\b(\d{1,4})\b/.exec(s);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}
