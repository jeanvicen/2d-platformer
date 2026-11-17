# SHADOWBOUND — Agent Handoff

Minecraft Bedrock add-on (Behavior Pack + Resource Pack + Script API in TypeScript): owner-bound shadow companions
(personas Luna and Raven) that take Portuguese orders and perform real actions. Everything below is true for this repo;
keep it true when you change things.

## Layout
- `behavior_pack/` — manifest, entity `shadowbound:companion`, item `shadowbound:shadow_summoner`, recipe, lang. `scripts/main.js` is BUILT (gitignored).
- `resource_pack/` — client entity, 2 geometries, textures, animations, animation controller, render controller, particles, lang. Models/textures/animations are GENERATED.
- `scripts/` — TypeScript source, one folder per brain module (see documentation/ARQUITETURA.md).
- `tools/art/generate_art.py` — generates geometry + texture together (UVs can never drift). `generate_anims.py` — animations, controller, render controller, client entity.
- `tools/build.mjs` (bundle + validate + zip to `dist/`), `tools/validate-packs.mjs` (cross-reference checks), `tools/run-tests.mjs`.
- `tests/` — pure unit tests + `integration.test.ts` running the real brain against `tests/mock/` (a simulator of the API surface we use).
- `dist/` — committed deliverables: `Shadowbound.mcaddon` (+ separate `.mcpack`s). Rebuild after any change.
- `optional/` — LLM backend + BDS-only bridge pack. The main add-on must never depend on them.

## Rules
- Only STABLE Script API. Declared versions: `@minecraft/server` 2.3.0, `@minecraft/server-ui` 2.1.0, min engine 1.26.40. devDependencies are pinned to the same versions so `npm run typecheck` checks exactly what the manifest declares. Never use `chatSend` (beta).
- Owner checks (`isOwner`, by `player.id`, never by name) at every entry point. Messages go only to the owner.
- Inventory/equipment/task/needs live in the world record (`sb:agent:<ownerId>`), never in the body. Never add `minecraft:inventory` or loot to the entity.
- Task runners are generators that must stay RESTARTABLE from `task.data`/`task.progress` (interrupt/death/reload restart them).
- Never report a task as done without verifying (see `finish()` in executor/tasks.ts).
- `AnimState` (scripts/core/constants.ts) must match `STATES` in tools/art/generate_anims.py — the validator enforces it.
- After editing art: `npm run art`. After any change: `npm run all` (typecheck + 41 tests + build). Commit `dist/`.
- User-facing text is Brazilian Portuguese. Keep the companions' designs non-sexualized; do not add sexual content.
