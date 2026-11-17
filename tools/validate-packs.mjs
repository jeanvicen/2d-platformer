// Cross-reference validator for both packs. Fails (exit 1) on any broken reference.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const errors = [];
const warns = [];
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

for (const f of [...walk("behavior_pack"), ...walk("resource_pack")].filter((f) => f.endsWith(".json"))) {
  try { J(f); } catch (e) { errors.push(`JSON inválido: ${f}: ${e.message}`); }
}

const bpm = J("behavior_pack/manifest.json");
const rpm = J("resource_pack/manifest.json");
const uuids = [bpm.header.uuid, rpm.header.uuid, ...bpm.modules.map((m) => m.uuid), ...rpm.modules.map((m) => m.uuid)];
if (new Set(uuids).size !== uuids.length) errors.push("UUIDs repetidos nos manifests");
if (!bpm.dependencies.some((d) => d.uuid === rpm.header.uuid)) errors.push("BP não depende do RP");
if (!rpm.dependencies.some((d) => d.uuid === bpm.header.uuid)) errors.push("RP não depende do BP");
if (!existsSync("behavior_pack/pack_icon.png") || !existsSync("resource_pack/pack_icon.png")) errors.push("pack_icon.png ausente");

// ---- entity BP <-> RP
const bpe = J("behavior_pack/entities/shadowbound_companion.json")["minecraft:entity"];
const rpe = J("resource_pack/entity/shadowbound_companion.entity.json")["minecraft:client_entity"].description;
if (bpe.description.identifier !== rpe.identifier) errors.push("identificador da entidade diferente entre BP e RP");
const props = Object.keys(bpe.description.properties);

// geometry
const geos = new Map();
for (const f of walk("resource_pack/models")) {
  for (const g of J(f)["minecraft:geometry"]) geos.set(g.description.identifier, g);
}
for (const [k, id] of Object.entries(rpe.geometry)) if (!geos.has(id)) errors.push(`geometria ${k} -> ${id} não existe`);
for (const [k, path] of Object.entries(rpe.textures)) if (!existsSync(`resource_pack/${path}.png`)) errors.push(`textura ${k} -> ${path}.png não existe`);

// textures sizes vs geometry declared UV space (must be an integer multiple)
// (PNG header width/height at bytes 16..24)
for (const [k, path] of Object.entries(rpe.textures)) {
  const b = readFileSync(`resource_pack/${path}.png`);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const g = geos.get(rpe.geometry[k]);
  if (g && (w % g.description.texture_width || h % g.description.texture_height)) errors.push(`textura ${k} ${w}x${h} não é múltiplo do UV ${g.description.texture_width}`);
}

// animations
const anims = J("resource_pack/animations/shadowbound_companion.animation.json").animations;
const ctrls = J("resource_pack/animation_controllers/shadowbound_companion.animation_controllers.json").animation_controllers;
for (const [short, full] of Object.entries(rpe.animations)) if (!anims[full] && !ctrls[full]) errors.push(`animação ${short} -> ${full} não existe`);
for (const s of rpe.scripts.animate) {
  const name = typeof s === "string" ? s : Object.keys(s)[0];
  if (!rpe.animations[name]) errors.push(`scripts.animate usa ${name} que não está em animations`);
}
for (const c of Object.values(ctrls)) {
  for (const [sn, st] of Object.entries(c.states)) {
    for (const an of st.animations ?? []) {
      const name = typeof an === "string" ? an : Object.keys(an)[0];
      if (!rpe.animations[name]) errors.push(`controller estado ${sn} usa ${name} inexistente`);
    }
    for (const tr of st.transitions ?? []) for (const to of Object.keys(tr)) if (!c.states[to]) errors.push(`transição para estado ${to} inexistente`);
  }
}
const allBones = new Set();
for (const g of geos.values()) for (const b of g.bones) allBones.add(b.name);
for (const [an, a] of Object.entries(anims)) for (const b of Object.keys(a.bones ?? {})) if (!allBones.has(b)) warns.push(`${an}: osso ${b} não existe em nenhuma geometria`);
// molang property references
const molang = JSON.stringify([anims, ctrls, J("resource_pack/render_controllers/shadowbound_companion.render_controllers.json")]);
for (const m of molang.matchAll(/query\.property\('([^']+)'\)/g)) if (!props.includes(m[1])) errors.push(`molang usa propriedade ${m[1]} não declarada`);

// render controller
const rcs = J("resource_pack/render_controllers/shadowbound_companion.render_controllers.json").render_controllers;
for (const rc of rpe.render_controllers) if (!rcs[rc]) errors.push(`render controller ${rc} não existe`);
for (const rc of Object.values(rcs)) {
  for (const arr of Object.values(rc.arrays.textures)) for (const t of arr) if (!rpe.textures[t.replace("Texture.", "")]) errors.push(`render controller usa ${t}`);
  for (const arr of Object.values(rc.arrays.geometries)) for (const t of arr) if (!rpe.geometry[t.replace("Geometry.", "")]) errors.push(`render controller usa ${t}`);
  for (const m of rc.materials) for (const v of Object.values(m)) if (!rpe.materials[v.replace("Material.", "")]) errors.push(`material ${v} não declarado`);
}

// state numbers: python STATES vs AnimState enum
const py = readFileSync("tools/art/generate_anims.py", "utf8");
const ts = readFileSync("scripts/core/constants.ts", "utf8");
const pyStates = Object.fromEntries([...py.matchAll(/"(\w+)": (\d+)/g)].map((m) => [m[1], +m[2]]));
const enumBlock = ts.slice(ts.indexOf("export enum AnimState"), ts.indexOf("}", ts.indexOf("export enum AnimState")));
for (const m of enumBlock.matchAll(/(\w+) = (\d+)/g)) {
  const k = m[1].toLowerCase();
  if (pyStates[k] !== +m[2]) errors.push(`AnimState.${m[1]}=${m[2]} difere do gerador (${pyStates[k]})`);
}

// events triggered by scripts exist
const src = walk("scripts").map((f) => readFileSync(f, "utf8")).join("\n");
const events = Object.keys(bpe.events);
for (const m of src.matchAll(/shadowbound:(mode_\$\{m\}|mode_\w+|on_tame)/g)) {
  if (m[1].includes("${")) { for (const x of ["follow", "guard", "scripted"]) if (!events.includes(`shadowbound:mode_${x}`)) errors.push(`evento mode_${x} ausente`); }
  else if (!events.includes(`shadowbound:${m[1]}`)) errors.push(`script dispara shadowbound:${m[1]} inexistente`);
}
// particles used by scripts exist
const particles = walk("resource_pack/particles").map((f) => J(f).particle_effect.description.identifier);
for (const m of src.matchAll(/"(shadowbound:(sparkle|wisp))"/g)) if (!particles.includes(m[1])) errors.push(`partícula ${m[1]} inexistente`);
for (const p of walk("resource_pack/particles")) {
  const tex = J(p).particle_effect.description.basic_render_parameters.texture;
  if (!existsSync(`resource_pack/${tex}.png`)) errors.push(`textura de partícula ${tex} ausente`);
}
// item icon + lang
const item = J("behavior_pack/items/shadow_summoner.json")["minecraft:item"];
const atlas = J("resource_pack/textures/item_texture.json").texture_data;
const icon = item.components["minecraft:icon"];
if (!atlas[icon]) errors.push(`ícone ${icon} não está no item_texture.json`);
else if (!existsSync(`resource_pack/${atlas[icon].textures}.png`)) errors.push("png do ícone ausente");
const lang = readFileSync("resource_pack/texts/pt_BR.lang", "utf8");
if (!lang.includes(item.components["minecraft:display_name"].value)) errors.push("chave de nome do item ausente no pt_BR.lang");
if (!lang.includes(`entity.${bpe.description.identifier}.name`)) errors.push("nome da entidade ausente no pt_BR.lang");

for (const w of warns) console.log("aviso:", w);
if (errors.length) { for (const e of errors) console.log("ERRO:", e); process.exit(1); }
console.log(`packs OK (${geos.size} geometrias, ${Object.keys(anims).length} animações, ${particles.length} partículas, ${warns.length} avisos)`);
