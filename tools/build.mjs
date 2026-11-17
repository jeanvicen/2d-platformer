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
const img = (n) => "data:image/png;base64," + readFileSync(`documentation/img/preview_${n}.png`).toString("base64");
const kb = Math.round(statSync("dist/Shadowbound.mcaddon").size / 1024);
let html = readFileSync("site/template.html", "utf8")
  .replace("__DOWNLOAD_URL__", url)
  .replace("__SIZE__", `${kb} KB`)
  .replace("__PACK_B64__", readFileSync("dist/Shadowbound.mcaddon").toString("base64"))
  .replace("__IMG_LUNA__", img("luna"))
  .replace("__IMG_RAVEN__", img("raven"))
  .replace("__IMG_SORA__", img("sora"))
  .replace("__IMG_YUKI__", img("yuki"));
if (/__[A-Z_]+__/.test(html)) throw new Error("placeholder left in site");
writeFileSync("site/index.html", html);
console.log("site/index.html pronto");
