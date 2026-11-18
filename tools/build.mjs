// Build: typecheck happens in `npm run all`. This bundles the scripts, validates the packs and
// produces dist/Shadowbound.mcaddon (open it on Android/Windows to import into Minecraft).
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, cpSync, existsSync } from "node:fs";

await build({
  entryPoints: ["scripts/main.ts"],
  bundle: true,
  format: "esm",
  target: "es2020",
  platform: "neutral",
  external: ["@minecraft/server", "@minecraft/server-ui"],
  outfile: "behavior_pack/scripts/main.js",
  legalComments: "none",
  logLevel: "warning",
});
execSync("node tools/validate-packs.mjs", { stdio: "inherit" });

rmSync("build/pkg", { recursive: true, force: true });
mkdirSync("build/pkg", { recursive: true });
mkdirSync("dist", { recursive: true });
cpSync("behavior_pack", "build/pkg/Shadowbound_BP", { recursive: true });
cpSync("resource_pack", "build/pkg/Shadowbound_RP", { recursive: true });
for (const f of ["dist/Shadowbound.mcaddon", "dist/Shadowbound_BP.mcpack", "dist/Shadowbound_RP.mcpack"]) if (existsSync(f)) rmSync(f);
const zip = (cwd, out, what) => execSync(`cd ${cwd} && zip -q -r -X ${out} ${what}`, { stdio: "inherit" });
zip("build/pkg", "../../dist/Shadowbound.mcaddon", "Shadowbound_BP Shadowbound_RP");
zip("build/pkg/Shadowbound_BP", "../../../dist/Shadowbound_BP.mcpack", ".");
zip("build/pkg/Shadowbound_RP", "../../../dist/Shadowbound_RP.mcpack", ".");
console.log("dist/Shadowbound.mcaddon pronto");

// ---- download site (site/index.html): the page is self-contained (images inlined) ----
import { readFileSync, writeFileSync, statSync } from "node:fs";
const BRANCH = process.env.SITE_BRANCH ?? "ccr-4bf51eb6-zchos1";
const url = `https://github.com/jeanvicen/2d-platformer/raw/${BRANCH}/dist/Shadowbound.mcaddon`;
const icon = (p) => "data:image/png;base64," + readFileSync(`resource_pack/${p}.png`).toString("base64");
const kb = Math.round(statSync("dist/Shadowbound.mcaddon").size / 1024);
function clanCards() {
  const src = readFileSync("scripts/jujutsu/clans.ts", "utf8");
  const clans = [...src.matchAll(/^  (\w+): \{ id: "\w+", name: "([^"]+)", rarity: "([^"]+)", tag: "[^"]+", weight: (\d+)/gm)];
  const techName = Object.fromEntries([...src.matchAll(/^  (\w+): \{ id: "\w+", name: "([^"]+)", origin:/gm)].map((m) => [m[1], m[2]]));
  return clans
    .map(([, id, name, rarity, weight]) => {
      const block = src.slice(src.indexOf(`  ${id}: { id: "${id}"`));
      const techs = [...block.slice(0, block.indexOf("desc:")).matchAll(/tech: "(\w+)"/g)].map((m) => techName[m[1]] ?? m[1]);
      return `      <article class="who"><img alt="${name}" src="${icon(`textures/ui/shadowbound/clan_${id}`)}"><span class="tag">${rarity} · ${weight}%</span><h3>${name}</h3><p>${techs.join(" · ")}</p></article>`;
    })
    .join("\n");
}
function gearCards() {
  const src = readFileSync("scripts/jujutsu/arsenal.ts", "utf8");
  return [...src.matchAll(/\{ id: [^,]+, name: "([^"]+)", kind: "(ferramenta|uniforme)"[^}]*?icon: "(\w+)"/gs)]
    .map(([, name, , ic]) => `      <div class="beast"><img alt="${name}" src="${icon(`textures/items/${ic}`)}"><b>${name}</b></div>`)
    .join("\n");
}
function beastCards() {
  const src = readFileSync("scripts/core/species.ts", "utf8");
  const rows = [...src.matchAll(/^  (\w+): \{ pt: "([^"]+)".*?ability: "([^"]+)"/gm)];
  return rows
    .map(([, id, pt, ab]) => {
      const data = "data:image/png;base64," + readFileSync(`documentation/img/beast_${id}.png`).toString("base64");
      return `      <div class="beast"><img alt="${pt}" src="${data}"><b>${pt}</b><span>${ab}</span></div>`;
    })
    .join("\n");
}
let html = readFileSync("site/template.html", "utf8")
  .replace("__DOWNLOAD_URL__", url)
  .replace("__SIZE__", `${kb} KB`)
  .replace("__PACK_B64__", readFileSync("dist/Shadowbound.mcaddon").toString("base64"))
  .replace("__CLAN_CARDS__", clanCards())
  .replace("__GEAR_CARDS__", gearCards())
  .replace("__BEAST_CARDS__", beastCards());
if (/__[A-Z_]+__/.test(html)) throw new Error("placeholder left in site");
writeFileSync("site/index.html", html);
console.log("site/index.html pronto");
