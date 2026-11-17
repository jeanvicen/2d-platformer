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
