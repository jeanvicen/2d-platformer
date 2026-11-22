// Efeitos visuais dos poderes (3.2). Cada raça tem um ESTILO (cor principal, cor escura, se brilha
// por soma de luz ou se é "matéria" escura, e um detalhe próprio: gotas de sangue, estilhaços de
// rocha, penas, brasas, estrelas, fumaça do vazio). As funções abaixo desenham formas (orbe,
// impacto, anel, selo, coluna, corte, feixe, raio, corrente, rachadura, redemoinho, domo, runas)
// com o estilo da raça. Tudo é partícula no cliente; o servidor só manda "onde" e "de que cor".
import { MolangVariableMap } from "@minecraft/server";

/** @type {Record<string, {c:number[], k:number[], g:number[], add:boolean, accent:string, sig:number, n:number}>} */
export const STYLE = {
  vampire: { c: [0.86, 0.05, 0.13], k: [0.22, 0, 0.03], g: [1, 0.22, 0.28], add: false, accent: "drops", sig: 0, n: 10 },
  giant: { c: [0.62, 0.52, 0.4], k: [0.3, 0.24, 0.17], g: [1, 0.72, 0.4], add: false, accent: "shards", sig: 1, n: 12 },
  angel: { c: [1, 0.9, 0.55], k: [1, 1, 1], g: [1, 0.97, 0.82], add: true, accent: "feather", sig: 2, n: 8 },
  demon: { c: [1, 0.36, 0.05], k: [0.2, 0.02, 0], g: [1, 0.62, 0.2], add: true, accent: "embers", sig: 3, n: 14 },
  god: { c: [1, 0.84, 0.32], k: [0.7, 0.9, 1], g: [1, 1, 0.86], add: true, accent: "stars", sig: 4, n: 10 },
  dark: { c: [0.56, 0.18, 0.96], k: [0.04, 0, 0.07], g: [0.78, 0.48, 1], add: false, accent: "smoke", sig: 5, n: 6 },
};
const ACCENT_COLOR = { drops: "c", shards: "c", feather: "k", embers: "g", stars: "g", smoke: "k" };

let LOW = false; // "efeitos reduzidos": 1 de cada 3 partículas
export const setLow = (v) => {
  LOW = !!v;
};
export const COUNT = { n: 0 }; // para o autoteste (quantas emissões saíram)

const v3 = (x, y, z) => ({ x, y, z });
/** Emite uma partícula com variáveis (cor = [r,g,b]). */
export function emit(dim, id, at, vars = {}) {
  if (LOW && Math.random() < 0.67) return;
  try {
    const m = new MolangVariableMap();
    for (const [k, v] of Object.entries(vars)) {
      if (Array.isArray(v)) {
        const p = k === "c" ? ["cr", "cg", "cb"] : ["dr", "dg", "db"];
        m.setFloat(`variable.${p[0]}`, v[0]);
        m.setFloat(`variable.${p[1]}`, v[1]);
        m.setFloat(`variable.${p[2]}`, v[2]);
      } else m.setFloat(`variable.${k}`, v);
    }
    dim.spawnParticle(id, at, m);
    COUNT.n++;
  } catch {
    /* fora da área carregada */
  }
}
const S = (race) => STYLE[race] ?? STYLE.god;
const D = (st) => (st.add ? "" : "_d");

/** Orbe de energia (projéteis, espíritos). Gigante = pedregulho com poeira. */
export function orb(dim, at, race, size = 0.45) {
  const st = S(race);
  emit(dim, `lila:vfx_orb${D(st)}`, at, { c: st.c, d: st.k, size });
  if (!st.add) emit(dim, "lila:vfx_dot", at, { c: st.g, size: size * 0.35, life: 0.12 });
  else if (Math.random() < 0.35) emit(dim, `lila:vfx_${st.accent}`, at, { c: st[ACCENT_COLOR[st.accent]], n: 1, size: 0.3 });
}

/** Impacto: clarão + faíscas + o detalhe da raça (+ anel se for forte). */
export function impact(dim, at, race, power = 1) {
  const st = S(race);
  emit(dim, "lila:vfx_flash", at, { c: st.g, size: 0.7 * power });
  emit(dim, "lila:vfx_spark", at, { c: st.g, n: Math.round(10 * power), size: power, grav: st.add ? 2 : 8 });
  if (!st.add) emit(dim, "lila:vfx_spark_d", at, { c: st.c, d: st.k, n: Math.round(8 * power), size: power, grav: 6 });
  emit(dim, `lila:vfx_${st.accent}`, at, { c: st[ACCENT_COLOR[st.accent]], n: Math.round(st.n * power * 0.7), size: power });
  if (power >= 1.4) ring(dim, v3(at.x, at.y - 0.8, at.z), race, 1.2 * power, 0.35);
}

/** Onda/anel no chão. */
export function ring(dim, at, race, r = 3, life = 0.45) {
  const st = S(race);
  emit(dim, `lila:vfx_ring${D(st)}`, v3(at.x, at.y + 0.12, at.z), { c: st.add ? st.c : st.k, d: st.c, size: r, life });
  if (!st.add) emit(dim, "lila:vfx_ring", v3(at.x, at.y + 0.14, at.z), { c: st.g, size: r * 0.95, life: life * 0.8 });
}

/** Selo (círculo mágico) da raça no chão. */
export function sigil(dim, at, race, r = 2, life = 1.2, out = 1) {
  const st = S(race);
  emit(dim, `lila:vfx_sigil${D(st)}`, v3(at.x, at.y + 0.08, at.z), { c: st.add ? st.c : st.k, race: st.sig, size: r, life, rot: Math.random() * 360, out });
  if (!st.add) emit(dim, "lila:vfx_sigil", v3(at.x, at.y + 0.1, at.z), { c: st.g, race: st.sig, size: r * 0.98, life, rot: Math.random() * 360, out });
}

/** Coluna de luz/trevas/fogo/sangue/rocha subindo. */
export function pillar(dim, at, race, h = 8, w = 1.2, life = 0.6) {
  const st = S(race);
  emit(dim, `lila:vfx_pillar${D(st)}`, at, { c: st.c, d: st.k, size: w, h, life });
  emit(dim, "lila:vfx_pillar", at, { c: st.add ? [1, 1, 1] : st.g, size: w * 0.4, h, life: life * 0.8 });
  emit(dim, `lila:vfx_${st.accent}`, v3(at.x, at.y + 0.5, at.z), { c: st[ACCENT_COLOR[st.accent]], n: st.n, size: w });
}

/** Corte em meia-lua (golpes). */
export function slash(dim, at, race, size = 1.6, rot = Math.random() * 360, out = 1) {
  const st = S(race);
  emit(dim, `lila:vfx_slash${D(st)}`, at, { c: st.c, d: st.k, size, rot, out });
  emit(dim, "lila:vfx_slash", at, { c: st.g, size: size * 0.8, rot: rot + 8, out });
}

/** Feixe grosso (raios contínuos): miolo claro + halo da raça. */
export function beam(dim, a, b, race, w = 0.5) {
  const st = S(race);
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const n = Math.min(60, Math.max(2, Math.ceil(d / 0.55)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    emit(dim, `lila:vfx_dot${D(st)}`, p, { c: st.c, d: st.k, size: w, life: 0.3 });
    if (i % 2 === 0) emit(dim, "lila:vfx_dot", p, { c: st.add ? [1, 1, 1] : st.g, size: w * 0.4, life: 0.22 });
  }
  impact(dim, b, race, 1);
}

/** Linha fina de energia (mira, ligação). */
export function trail(dim, a, b, race, step = 0.9, max = 26) {
  const st = S(race);
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const n = Math.min(max, Math.max(1, Math.ceil(d / step)));
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    emit(dim, st.add ? "lila:vfx_dot" : "lila:vfx_dot_d", v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t), { c: st.c, d: st.k, size: 0.22, life: 0.35 });
  }
}

/** Raio em zigue-zague (deus, anjo; também corrente de energia). */
export function bolt(dim, a, b, race, jag = 0.6) {
  const st = S(race);
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const seg = Math.min(14, Math.max(3, Math.ceil(d / 1.6)));
  let prev = a;
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    const off = i === seg ? 0 : jag;
    const p = v3(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * off * 2, a.y + (b.y - a.y) * t + (Math.random() - 0.5) * off * 2, a.z + (b.z - a.z) * t + (Math.random() - 0.5) * off * 2);
    const sd = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    const k = Math.max(2, Math.ceil(sd / 0.35));
    for (let j = 0; j <= k; j++) {
      const u = j / k;
      const q = v3(prev.x + (p.x - prev.x) * u, prev.y + (p.y - prev.y) * u, prev.z + (p.z - prev.z) * u);
      emit(dim, "lila:vfx_dot", q, { c: st.add ? [1, 1, 1] : st.g, size: 0.14, life: 0.18 });
      if (j % 2 === 0) emit(dim, `lila:vfx_dot${D(st)}`, q, { c: st.c, d: st.k, size: 0.38, life: 0.25 });
    }
    prev = p;
  }
  emit(dim, "lila:vfx_flash", b, { c: st.g, size: 0.9 });
}

/** Corrente de elos (demônio, prender, puxar). */
export function chain(dim, a, b, race, life = 0.6) {
  const st = S(race);
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const n = Math.min(40, Math.max(2, Math.ceil(d / 0.42)));
  const col = race === "demon" ? [0.55, 0.12, 0.05] : race === "angel" || race === "god" ? [1, 0.85, 0.4] : [0.25, 0.22, 0.26];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    emit(dim, "lila:vfx_chain", v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t), { c: col, life, rot: i % 2 ? 90 : 0 });
  }
  if (st.add) emit(dim, "lila:vfx_embers", b, { c: st.g, n: 6, size: 0.6 });
}

/** Rachadura no chão (impactos pesados). */
export function crack(dim, at, r = 3, life = 2.5) {
  emit(dim, "lila:vfx_crack", v3(at.x, at.y + 0.02, at.z), { c: [0.12, 0.09, 0.07], size: r, life });
}

/** Redemoinho (puxa = para dentro; explode = para fora). */
export function swirl(dim, at, race, r = 3, inward = true) {
  const st = S(race);
  emit(dim, `lila:vfx_swirl${D(st)}`, at, { c: st.c, d: st.k, size: r, n: 30, out: inward ? 0 : 1 });
  emit(dim, "lila:vfx_swirl", at, { c: st.g, size: r * 0.8, n: 14, out: inward ? 0 : 1 });
}

/** Domo/escudo. */
export function dome(dim, at, race, r = 3) {
  const st = S(race);
  emit(dim, `lila:vfx_dome${D(st)}`, at, { c: st.c, d: st.k, size: r, n: Math.min(90, Math.round(r * 18)) });
  if (!st.add) emit(dim, "lila:vfx_dome", at, { c: st.g, size: r, n: Math.round(r * 8) });
}

/** Runas/estrelas/penas subindo em volta (preparação, cura, apoio). */
export function runes(dim, at, race, r = 1.2) {
  const st = S(race);
  emit(dim, "lila:vfx_runes", at, { c: st.g, size: r, n: 6 });
  emit(dim, `lila:vfx_${st.accent}`, v3(at.x, at.y + 1, at.z), { c: st[ACCENT_COLOR[st.accent]], n: Math.ceil(st.n * 0.6), size: r });
}

/** Detalhe da raça solto (gotas, estilhaços, penas, brasas, estrelas, fumaça). */
export function accent(dim, at, race, n, size = 1) {
  const st = S(race);
  emit(dim, `lila:vfx_${st.accent}`, at, { c: st[ACCENT_COLOR[st.accent]], n: n ?? st.n, size });
}

/** Clarão simples. */
export function flash(dim, at, race, size = 1) {
  emit(dim, "lila:vfx_flash", at, { c: S(race).g, size });
}

/** Tremor de câmera para quem está perto. */
export function shake(dim, at, intensity = 0.3, secs = 0.3, r = 12) {
  try {
    dim.runCommand(`camerashake add @a[x=${Math.floor(at.x)},y=${Math.floor(at.y)},z=${Math.floor(at.z)},r=${r}] ${intensity.toFixed(2)} ${secs.toFixed(2)} positional`);
  } catch {
    /* ignore */
  }
}

/** Floreio ao lançar: brilho nas mãos + mini selo nos pés (forte nas supremas). */
export function castFx(player, race, big = false) {
  const dim = player.dimension, l = player.location;
  let h;
  try {
    h = player.getHeadLocation();
  } catch {
    h = v3(l.x, l.y + 1.6, l.z);
  }
  let dir = { x: 0, y: 0, z: 1 };
  try {
    dir = player.getViewDirection();
  } catch {
    /* ignore */
  }
  const hand = v3(h.x + dir.x * 0.7, h.y - 0.45 + dir.y * 0.7, h.z + dir.z * 0.7);
  const st = S(race);
  emit(dim, "lila:vfx_flash", hand, { c: st.g, size: big ? 1.2 : 0.5 });
  emit(dim, `lila:vfx_spark`, hand, { c: st.g, n: big ? 16 : 6, size: 0.5, grav: 1 });
  sigil(dim, l, race, big ? 4 : 1.3, big ? 1.6 : 0.7);
  if (big) {
    pillar(dim, l, race, 10, 1.6, 0.9);
    ring(dim, l, race, 7, 0.6);
    shake(dim, l, 0.35, 0.5, 16);
  }
}
