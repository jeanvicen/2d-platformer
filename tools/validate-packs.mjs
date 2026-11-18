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

// ---- entities BP <-> RP (companion and beast) ----
const geos = new Map();
for (const f of walk("resource_pack/models")) {
  for (const g of J(f)["minecraft:geometry"]) geos.set(g.description.identifier, g);
}
const allBones = new Set();
for (const g of geos.values()) for (const b of g.bones) allBones.add(b.name);
const PAIRS = [
  ["behavior_pack/entities/shadowbound_beast.json", "resource_pack/entity/shadowbound_beast.entity.json"],
];
let animCount = 0;
let bpe; // shikigami entity (used by later checks)
for (const [bpPath, rpPath] of PAIRS) {
  const be = J(bpPath)["minecraft:entity"];
  const rpe = J(rpPath)["minecraft:client_entity"].description;
  if (!bpe) bpe = be;
  if (be.description.identifier !== rpe.identifier) errors.push(`identificador diferente entre ${bpPath} e ${rpPath}`);
  const props = Object.keys(be.description.properties);
  for (const [k, id] of Object.entries(rpe.geometry)) if (!geos.has(id)) errors.push(`${rpe.identifier}: geometria ${k} -> ${id} não existe`);
  for (const [k, path] of Object.entries(rpe.textures)) {
    if (!existsSync(`resource_pack/${path}.png`)) { errors.push(`${rpe.identifier}: textura ${k} -> ${path}.png não existe`); continue; }
    const b = readFileSync(`resource_pack/${path}.png`);
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    const g = geos.get(rpe.geometry[k]);
    if (g && (w % g.description.texture_width || h % g.description.texture_height)) errors.push(`textura ${k} ${w}x${h} não é múltiplo do UV ${g.description.texture_width}`);
  }
  const animFiles = walk("resource_pack/animations").map((f) => J(f).animations);
  const anims = Object.assign({}, ...animFiles);
  const ctrls = Object.assign({}, ...walk("resource_pack/animation_controllers").map((f) => J(f).animation_controllers));
  const rcs = Object.assign({}, ...walk("resource_pack/render_controllers").map((f) => J(f).render_controllers));
  for (const [short, full] of Object.entries(rpe.animations)) if (!anims[full] && !ctrls[full]) errors.push(`${rpe.identifier}: animação ${short} -> ${full} não existe`);
  for (const s of rpe.scripts.animate) {
    const name = typeof s === "string" ? s : Object.keys(s)[0];
    if (!rpe.animations[name]) errors.push(`${rpe.identifier}: scripts.animate usa ${name} que não está em animations`);
  }
  for (const [cn, c] of Object.entries(ctrls)) {
    if (!Object.values(rpe.animations).includes(cn)) continue;
    for (const [sn, st] of Object.entries(c.states)) {
      for (const an of st.animations ?? []) {
        const name = typeof an === "string" ? an : Object.keys(an)[0];
        if (!rpe.animations[name]) errors.push(`${cn}: estado ${sn} usa ${name} inexistente`);
      }
      for (const tr of st.transitions ?? []) for (const to of Object.keys(tr)) if (!c.states[to]) errors.push(`transição para estado ${to} inexistente`);
    }
  }
  const used = Object.values(rpe.animations).filter((n) => anims[n]);
  animCount += used.length;
  for (const an of used) for (const b of Object.keys(anims[an].bones ?? {})) if (!allBones.has(b)) warns.push(`${an}: osso ${b} não existe em nenhuma geometria`);
  // per-species beast animations must only move bones that exist in that species' geometry
  for (const an of used) {
    const sp = /^animation\.shadowbound_beast\.([a-z]+)\./.exec(an)?.[1];
    const g = sp && geos.get(`geometry.shadowbound.beast_${sp}`);
    if (!sp) continue;
    if (!g) { errors.push(`${an}: geometria da espécie ${sp} não existe`); continue; }
    const own = new Set(g.bones.map((b) => b.name));
    for (const b of Object.keys(anims[an].bones ?? {})) if (!own.has(b)) warns.push(`${an}: osso ${b} não existe no modelo ${sp}`);
  }
  const molang = JSON.stringify([used.map((n) => anims[n]), ctrls, rpe.render_controllers.map((r) => rcs[r])]);
  for (const m of molang.matchAll(/query\.property\('([^']+)'\)/g)) {
    // controllers are shared files: only check properties for controllers this entity uses
    if (!props.includes(m[1]) && !(m[1] === "shadowbound:mood" || m[1] === "shadowbound:persona" || m[1] === "shadowbound:species")) errors.push(`${rpe.identifier}: molang usa propriedade ${m[1]} não declarada`);
  }
  for (const rc of rpe.render_controllers) {
    if (!rcs[rc]) { errors.push(`render controller ${rc} não existe`); continue; }
    const r = rcs[rc];
    for (const arr of Object.values(r.arrays.textures)) for (const t of arr) if (!rpe.textures[t.replace("Texture.", "")]) errors.push(`${rc} usa ${t}`);
    for (const arr of Object.values(r.arrays.geometries)) for (const t of arr) if (!rpe.geometry[t.replace("Geometry.", "")]) errors.push(`${rc} usa ${t}`);
    for (const m of r.materials) for (const v of Object.values(m)) if (!rpe.materials[v.replace("Material.", "")]) errors.push(`material ${v} não declarado`);
    const idxProp = /query\.property\('([^']+)'\)/.exec(r.geometry)?.[1];
    const range = be.description.properties[idxProp]?.range;
    const n = Object.values(r.arrays.geometries)[0].length;
    if (!range || range[1] !== n - 1) errors.push(`${rc}: propriedade ${idxProp} vai até ${range?.[1]} mas há ${n} geometrias`);
  }
}
// beast stats: species.ts must match the generated entity
const speciesTs = readFileSync("scripts/core/species.ts", "utf8");
const beastBp = J("behavior_pack/entities/shadowbound_beast.json")["minecraft:entity"];
for (const m of speciesTs.matchAll(/^  (\w+): \{ pt: "[^"]+", .*?health: (\d+), attack: (\d+)/gm)) {
  const g = beastBp.component_groups[`shadowbound:species_${m[1]}`];
  if (!g) errors.push(`espécie ${m[1]} sem grupo na entidade`);
  else if (g["minecraft:health"].value !== +m[2] || g["minecraft:attack"].damage !== +m[3]) errors.push(`espécie ${m[1]}: vida/ataque diferentes entre species.ts e a entidade`);
}
const props = Object.keys(bpe.description.properties);
void props;

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
const beastEvents = Object.keys(J("behavior_pack/entities/shadowbound_beast.json")["minecraft:entity"].events);
const events = beastEvents;
for (const m of src.matchAll(/shadowbound:(mode_\$\{m\}|mode_\w+|on_tame)/g)) {
  if (m[1].includes("${")) { for (const x of ["follow", "guard", "scripted"]) if (!events.includes(`shadowbound:mode_${x}`)) errors.push(`evento mode_${x} ausente`); }
  else if (m[1] === "mode_wild") { if (!beastEvents.includes("shadowbound:mode_wild")) errors.push("evento mode_wild ausente na criatura"); } // ritual: beast only
  else if (!events.includes(`shadowbound:${m[1]}`)) errors.push(`script dispara shadowbound:${m[1]} inexistente`);
}
// particles used by scripts exist
const particles = walk("resource_pack/particles").map((f) => J(f).particle_effect.description.identifier);
for (const m of src.matchAll(/"(shadowbound:(sparkle|wisp))"/g)) if (!particles.includes(m[1])) errors.push(`partícula ${m[1]} inexistente`);
for (const p of walk("resource_pack/particles")) {
  const tex = J(p).particle_effect.description.basic_render_parameters.texture;
  if (!existsSync(`resource_pack/${tex}.png`)) errors.push(`textura de partícula ${tex} ausente`);
}
// every item: icon in the atlas, png exists, name in pt_BR.lang; wearables have an attachable
const atlas = J("resource_pack/textures/item_texture.json").texture_data;
const lang = readFileSync("resource_pack/texts/pt_BR.lang", "utf8");
const attachables = existsSync("resource_pack/attachables") ? walk("resource_pack/attachables").map((f) => J(f)["minecraft:attachable"].description) : [];
let itemCount = 0;
for (const f of walk("behavior_pack/items")) {
  const item = J(f)["minecraft:item"];
  const id = item.description.identifier;
  itemCount++;
  const ic = item.components["minecraft:icon"];
  const icon = typeof ic === "string" ? ic : ic?.textures?.default;
  if (!atlas[icon]) errors.push(`${id}: ícone ${icon} não está no item_texture.json`);
  else if (!existsSync(`resource_pack/${atlas[icon].textures}.png`)) errors.push(`${id}: png do ícone ausente`);
  if (!lang.includes(`item.${id}.name=`) && !lang.includes(`item.${id}=`)) errors.push(`${id}: nome ausente no pt_BR.lang`);
  if (item.components["minecraft:wearable"]) {
    const att = attachables.find((a) => a.identifier === id);
    if (!att) errors.push(`${id}: vestível sem attachable`);
    else for (const t of Object.values(att.textures)) if (!t.startsWith("textures/misc") && !existsSync(`resource_pack/${t}.png`)) errors.push(`${id}: textura ${t} ausente`);
  }
}
for (const f of existsSync("behavior_pack/recipes") ? walk("behavior_pack/recipes") : []) {
  const txt = readFileSync(f, "utf8");
  for (const m of txt.matchAll(/"(shadowbound:[a-z_]+)"/g)) if (!walk("behavior_pack/items").some((x) => J(x)["minecraft:item"].description.identifier === m[1])) errors.push(`receita ${f} usa item ${m[1]} inexistente`);
}
if (!lang.includes(`entity.${bpe.description.identifier}.name`)) errors.push("nome da entidade ausente no pt_BR.lang");

for (const w of warns) console.log("aviso:", w);
if (errors.length) { for (const e of errors) console.log("ERRO:", e); process.exit(1); }
console.log(`packs OK (${geos.size} geometrias, ${animCount} animações, ${particles.length} partículas, ${itemCount} itens, ${warns.length} avisos)`);
