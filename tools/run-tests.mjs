// Bundles every tests/*.test.ts with esbuild and runs them with node:test.
import { build } from "esbuild";
import { readdirSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const files = readdirSync("tests").filter((f) => f.endsWith(".test.ts"));
mkdirSync("build/tests", { recursive: true });
const outs = [];
for (const f of files) {
  const out = join("build/tests", f.replace(/\.ts$/, ".mjs"));
  await build({ entryPoints: [join("tests", f)], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "error", alias: { "@minecraft/server": "./tests/mock/minecraft-server.ts", "@minecraft/server-ui": "./tests/mock/minecraft-server-ui.ts" } });
  outs.push(out);
}
const r = spawnSync(process.execPath, ["--test", "--test-reporter=spec", ...outs], { stdio: "inherit" });
process.exit(r.status ?? 1);
