// Gera docs/race-abilities.md a partir do catálogo (fonte única: behavior_pack/scripts/race/kits/*.js).
// Uso: node tools/gen_race_doc.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const C = await import(join(ROOT, "behavior_pack/scripts/race/catalog.js"));
const D = await import(join(ROOT, "behavior_pack/scripts/race/data.js"));
const OUT = join(ROOT, "docs/race-abilities.md");

// a tabela de equilíbrio (texto curado) é mantida do arquivo atual
const old = readFileSync(OUT, "utf8");
const balance = old.slice(old.indexOf("## Tabela de equilíbrio"), old.indexOf("\n## ", old.indexOf("## Tabela de equilíbrio") + 5));

const pipe = (t) => String(t).replace(/\|/g, "/");
const L = [];
L.push("# Os 600 poderes das raças (100 por raça)", "");
L.push(`Gerado de \`behavior_pack/scripts/race/kits/*.js\` (fonte única) por \`tools/gen_race_doc.mjs\`. Todos os 100 de cada raça ficam liberados; a barra tem **${D.BAL.quickSlots} lugares** (2 páginas de 9 no painel da direita: a barra de itens 1–9 escolhe e bater usa). O autoteste executa os 600 no servidor e exige efeito real em cada um.`, "");
L.push("⭐ = **poder assinatura** (3.2): mecânica e visual próprios, inspirados no folclore/mitologia da raça — os 10 de cada raça já vêm na barra.", "");
L.push(balance.trim(), "");
L.push("## Poderes assinatura (10 por raça)", "");
for (const [race, R] of Object.entries(D.RACES)) {
  L.push(`### ${R.name}`, "", "| Poder | Categoria | Recarga | Custo | O que faz |", "|---|---|---|---|---|");
  for (const a of C.BY_RACE[race].filter((x) => x.sigpow)) L.push(`| ⭐ ${pipe(a.name)} | ${C.CATEGORIES[a.cat]} | ${a.cd}s | ${a.cost} | ${pipe(a.desc)} |`);
  L.push("");
}
for (const [race, R] of Object.entries(D.RACES)) {
  L.push(`## ${R.name === "DEUS" || R.name === "TREVAS" ? R.name : R.name} (${R.resource})`, "");
  for (const [cat, label] of Object.entries(C.CATEGORIES)) {
    const list = C.BY_RACE[race].filter((a) => a.cat === cat);
    if (!list.length) continue;
    L.push(`### ${label} (${list.length})`, "", "| # | Poder | Modo | Recarga | Custo | O que faz |", "|---|---|---|---|---|---|");
    for (const a of list) {
      L.push(`| ${a.index + 1} | ${a.sigpow ? "⭐ " : ""}${pipe(a.name)} | ${a.mode} | ${a.passive ? "—" : `${a.cd}s`} | ${a.passive ? "—" : a.cost} | ${pipe(a.desc)} |`);
    }
    L.push("");
  }
}
L.push("## Supremas (todas as raças)", "", "| Raça | Poder | Recarga | Custo | Efeito |", "|---|---|---|---|---|");
for (const [race, R] of Object.entries(D.RACES)) {
  for (const a of C.BY_RACE[race].filter((x) => x.cat === "ult")) L.push(`| ${R.name} | ${a.sigpow ? "⭐ " : ""}${pipe(a.name)} | ${a.cd}s | ${a.cost} | ${pipe(a.desc)} |`);
}
L.push("");
writeFileSync(OUT, L.join("\n"));
console.log(`docs/race-abilities.md: ${C.ABILITIES.length} poderes, ${C.ABILITIES.filter((a) => a.sigpow).length} assinatura`);
