// Verifica que todo identificador "minecraft:..." usado nos scripts existe no jogo
// (itens, blocos, entidades, componentes, estados, dimensões) segundo @minecraft/vanilla-data.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const vd = require("../tools/node_modules/@minecraft/vanilla-data/lib/index.js");
const known = new Set();
for (const k of ["MinecraftItemTypes", "MinecraftBlockTypes", "MinecraftEntityTypes", "MinecraftDimensionTypes", "MinecraftEffectTypes"]) {
  for (const v of Object.values(vd[k] ?? {})) known.add(String(v).startsWith("minecraft:") ? v : `minecraft:${v}`);
}
const EXTRA = new Set([
  // componentes e estados usados pelo script
  "minecraft:inventory", "minecraft:health", "minecraft:type_family", "minecraft:durability", "minecraft:item", "minecraft:tameable",
  "minecraft:is_tamed", "minecraft:is_sheared", "minecraft:color", "minecraft:cardinal_direction", "minecraft:vertical_half",
  "minecraft:circle", "minecraft:on_sheared", "minecraft:sheared", "minecraft:overworld", "minecraft:nether", "minecraft:the_end",
  "minecraft:equippable", "minecraft:rideable", "minecraft:player.hunger", "minecraft:onfire", "minecraft:enchantable", "minecraft:riding", "minecraft:scale",
]);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../behavior_pack/scripts");
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".js")) files.push(p);
  }
})(ROOT);
const bad = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/["'`]minecraft:([a-z0-9_]+)["'`]/g)) {
    const id = `minecraft:${m[1]}`;
    if (known.has(id) || EXTRA.has(id) || id.endsWith("_")) continue;
    bad.set(id, [...(bad.get(id) ?? []), path.relative(ROOT, f)]);
  }
}
// ids gerados por template: madeiras e ferramentas
const { WOODS } = await import(path.join(ROOT, "lib/items.js"));
const gen = [];
for (const w of WOODS) for (const s of ["log", "planks", "slab", "stairs", "fence", "door", "leaves", "sapling"]) gen.push(`minecraft:${w}_${s}`);
for (const t of ["wooden", "stone", "iron", "golden", "diamond", "netherite"]) for (const k of ["pickaxe", "axe", "shovel", "hoe", "sword"]) gen.push(`minecraft:${t}_${k}`);
for (const t of ["iron", "golden", "diamond", "netherite"]) for (const k of ["helmet", "chestplate", "leggings", "boots"]) gen.push(`minecraft:${t}_${k}`);
const genBad = gen.filter((id) => !known.has(id) && !(id === "minecraft:oak_door"));
const { RECIPES } = await import(path.join(ROOT, "lib/recipes.js"));
const recBad = RECIPES.flatMap((r) => [r.out, ...r.needs.map((n) => n.id).filter(Boolean)]).filter((id) => !known.has(id));
let fail = 0;
for (const [id, where] of bad) {
  console.log(`UNKNOWN ${id}  (${[...new Set(where)].join(", ")})`);
  fail++;
}
for (const id of new Set(genBad)) console.log(`TEMPLATE-ONLY ${id}`);
for (const id of new Set(recBad)) {
  console.log(`RECIPE-UNKNOWN ${id}`);
  fail++;
}
console.log(`checked ${files.length} files, known=${known.size}, unknown=${fail}`);
process.exit(fail ? 1 : 0);
