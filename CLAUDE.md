# 2D Metroidvania Template -- Agent Handoff

You are working on a Hollow Knight-inspired 2D Metroidvania template for Summer Engine (a Godot 4.6+ fork). Developers create projects from it with `summer create 2d-platformer <dir>` and build on top of it. Everything below describes what actually ships in this repository. Check the files before you change anything, and keep this document true when you do.

The game boots straight into gameplay: `run/main_scene` is `scenes/rooms/room_01.tscn`. The main menu is reached from the pause menu (`GameManager.go_to_main_menu()`), not at boot.

## What Exists (DO NOT REWRITE)

The following systems are built and working. Study them before adding anything.

### Core Architecture (9 autoloads, wired in project.godot)
- **EventBus** (`scripts/autoloads/event_bus.gd`) -- Global signal bus. ALL cross-system communication goes through here. When adding a feature, add its signals here first.
- **AbilityManager** (`scripts/autoloads/ability_manager.gd`) -- Tracks unlocked abilities. `ALL_ABILITIES` = dash, wall_climb, double_jump, down_attack, charged_attack. The player controller checks `AbilityManager.has_ability()` before allowing a move. Dash is granted on a fresh boot (`scripts/systems/room_loader.gd`) and by `GameManager.start_game()`.
- **RoomManager** (`scripts/autoloads/room_manager.gd`) -- Room transitions, player spawning at doors, visited-room tracking. All 7 rooms are registered in its `room_paths` dictionary.
- **GameManager** (`scripts/autoloads/game_manager.gd`) -- HP system (hearts, not lives), coins, score, bench respawn, `start_game()`, `go_to_main_menu()`.
- **QuestManager** (`scripts/autoloads/quest_manager.gd`) -- Loads `data/quests/*.json` (explore_grotto, fungal_harvest, defeat_queen), tracks not_started / active / completed.
- **SaveManager** (`scripts/autoloads/save_manager.gd`) -- JSON persistence to `user://save_data.json`: abilities, visited rooms, quests, HP, coins, bench position.
- **SceneTransition** (`scripts/autoloads/scene_transition.gd`) -- Fade-to-black between scenes. Use `SceneTransition.change_scene(path)` instead of `get_tree().change_scene_to_file()`.
- **JuiceManager** (`scripts/systems/juice_manager.gd`) -- Floating text, stomp particles, dash afterimage, gem sparkles. Listens to EventBus.
- **AudioManager** (`scripts/autoloads/audio_manager.gd`) -- Music crossfade + SFX pool with pitch variance. Stub: the calls are in place, no audio files ship (`assets/` holds two background PNGs and nothing else).

### Player
- **PlayerController** (`scripts/player/player_controller.gd`) -- Full movement: walk, jump (coyote time, buffer, variable height, double jump), wall slide, wall jump, dash (8-directional, cooldown, iframes). All values are `@export`. Abilities gated by AbilityManager. Has `take_damage()`, `take_hit()`, `die()`, `respawn()`.
- **PlayerCombat** (`scripts/combat/player_combat.gd`) -- Child node on Player. Sword swing with 3-hit combo, directional attacks (up/down/horizontal). Down-attack bounces the player. Uses `body_entered` on SwordHitArea to detect enemies.
- **CameraController** (`scripts/player/camera_controller.gd`) -- Screen shake (decay-based) + hitstop (Engine.time_scale). Listens to EventBus signals.
- **Player Scene** (`scenes/player/player.tscn`) -- CharacterBody2D with Visuals (Polygon2D body + eyes), StompDetector, particles, PlayerCombat, Camera2D. The player is NOT placed in room scenes; RoomManager spawns it.

### Enemies and Boss
- **BaseEnemy** (`scripts/enemies/base_enemy.gd`) -- Base class. HP, contact_damage, gravity, knockback, coin drops, death particles, white flash on hit. Override `_ai_process(delta)` for behaviour and `_setup()` for init.
- **PatrolEnemy** (`scripts/enemies/patrol_enemy.gd`) -- Walks back and forth, turns at edges/walls. Has a PlayerDetector Area2D.
- **FlyingEnemy** (`scripts/enemies/flying_enemy.gd`) -- Sine-wave flight, wing flap animation.
- **CrystalQueen** (`scripts/bosses/crystal_queen.gd`, `scenes/bosses/crystal_queen.tscn`) -- Boss in room_06. Its own CharacterBody2D state machine (not base_enemy) with telegraphed attacks and a health bar on its own CanvasLayer (`HealthBarLayer/HealthBarBg/HealthBarFill`).
- Enemy scenes live in `scenes/enemies/`. Collision layer 4 (Enemies), mask 1 (World).

### Systems (`scripts/systems/`)
- **Door** (`scenes/doors/door.tscn`) -- Connects rooms. `@export`: door_id, target_room_id, target_door_id, requires_ability, locked, auto_enter. Group "doors". No shipped door sets `requires_ability` or `locked`.
- **Bench** (`scenes/systems/bench.tscn`) -- Heal, save, set respawn point. Placed in room_01.
- **AbilityPickup** (`scenes/systems/ability_pickup.tscn`) -- Glowing orb; interact to unlock an ability permanently and show a code-built "Ability Acquired!" overlay. Placed: dash in room_02, wall_climb in room_04.
- **AbilityGate** (`scenes/systems/ability_gate.tscn`) -- Wall that crumbles when you own `required_ability`. Exists but is not placed in any room.
- **Coin**, **Killzone** (the DeathPlane in every room), **CrumblingPlatform** (room_04), **MovingPlatform** (room_05), **FloatingText**.
- **RoomLoader** -- Attach to the root of every room scene. Sets `room_id`, grants the starting dash on a fresh boot, spawns the player.
- **ParallaxBg** -- Shows `assets/sprites/background.png` full-screen on a CanvasLayer behind the room (procedural stars / mountains / decorations only when no texture is set). Every room has one.
- **RuntimeTexture** (`scripts/systems/runtime_texture.gd`) -- `static load_texture(path)`: the imported resource when the editor has imported the PNG, a direct decode of the source file otherwise. Used for both shipped backgrounds so a never-imported project still renders them.
- Legacy, used only by `scenes/levels/`: **BouncePad**, **OneWayPlatform**, **Checkpoint**, **Gem**, **LevelEnd**.

### NPCs
- **NPC** (`scripts/npcs/npc_controller.gd`, `scenes/npcs/npc.tscn`) -- Interaction zone, loads dialogue from JSON, shows an "E" prompt. `@export`: npc_id, display_name, dialogue_file, body_color, is_shopkeeper. Placed: Elder (room_01), Garden Spirit (room_07). An NPC with `is_shopkeeper = true` opens `scenes/ui/shop.tscn` when its dialogue ends; `data/dialogue/shopkeeper.json` ships but no shopkeeper NPC is placed.
- **DialogueRunner** (`scripts/npcs/dialogue_runner.gd`) -- Typewriter text box at the bottom of the screen. Instantiated by NPCs, not an autoload. Emits `dialogue_finished`.
- Dialogue data in `data/dialogue/*.json`: a conversations array with conditions (flag_not_set, has_ability, quest_active, quest_completed).

### UI (`scenes/ui/`, scripts in `scripts/ui/`)
- **HUD** (`hud.tscn`) -- Hearts (Polygon2D), coin counter, controls hint at the bottom. `hud.gd` reads its nodes as `%HeartsContainer`, `%CoinsLabel`, `%ControlsHint`, `%HealthLabel`; those four nodes carry `unique_name_in_owner = true` in `hud.tscn`. Keep both sides in sync: a `%Name` whose node lacks the flag is a runtime error on every boot.
- **PauseMenu** (`pause_menu.tscn`) -- Resume / Quest Journal / Map / Restart / Main Menu. Loads `quest_journal.tscn` and `map.tscn` on demand.
- **QuestJournal**, **Map**, **Shop**, **MainMenu**, **GameOver**.
- Legacy, unreachable from the room flow: `level_select`, `victory`, `level_complete` (`level_select.gd` reads `GameManager.levels`, which does not exist).

### Collision Layers
| Layer | Name | Value | Used By |
|-------|------|-------|---------|
| 1 | World | 1 | Platforms, walls, NPC bodies |
| 2 | Player | 2 | Player CharacterBody2D |
| 3 | Enemies | 4 | Enemy and boss CharacterBody2Ds |
| 4 | PlayerAttack | 8 | Player sword hitbox |
| 5 | EnemyAttack | 16 | Reserved; no shipped scene uses it |
| 6 | Interactable | 32 | Reserved; doors, benches, pickups and NPC zones are Area2Ds on layer 0 with mask 2 |

### Room Layout (as shipped)
```
room_02 Mossy Grotto ---- room_01 Forgotten Approach (hub) ---- room_03 ---- room_07
(dash pickup)             (Elder NPC, bench, patrol enemy)      (enemies)    (Garden Spirit NPC)
     |
room_04 Fungal Depths ---- room_05 ---- room_06
(wall_climb pickup,        (moving       (Crystal Queen boss arena)
 crumbling platforms)       platforms)
```

| Room | Doors |
|------|-------|
| room_01 | door_spawn (start), door_left -> room_02, door_right -> room_03 |
| room_02 | door_right -> room_01, door_left -> room_04 |
| room_03 | door_left -> room_01, door_right -> room_07 |
| room_04 | door_up -> room_02, door_left -> room_05 |
| room_05 | door_left -> room_04, door_right -> room_06 |
| room_06 | door_left -> room_05 |
| room_07 | door_left -> room_03 |

The world is fully open: no door requires an ability and no AbilityGate is placed. Gating is yours to add. The HUD level label and the pause menu "Area" line are static text ("Forgotten Approach") in every room.

## Adding a Room

Each room is a .tscn following this structure:
```
RoomXX (Node2D, script=room_loader.gd, room_id="room_XX")
  ParallaxBg (ParallaxBackground, script=parallax_bg.gd)
  CamBoundTL (Marker2D) -- top-left camera limit
  CamBoundBR (Marker2D) -- bottom-right camera limit
  Geometry (Node2D)
    Ground (StaticBody2D, collision_layer=1, collision_mask=0)
      Col (CollisionShape2D, position offset by half height)
      V (Polygon2D, visual)
      T (Polygon2D, top highlight line)
    ...more platforms...
  Doors (Node2D)
    DoorXX (instance of door.tscn, with door_id, target_room_id, target_door_id)
  Enemies (Node2D)
  Coins (Node2D)
  DeathPlane (Area2D, killzone script, at y=700)
  HUD (instance of hud.tscn)
  PauseMenu (instance of pause_menu.tscn)
```

**CRITICAL RULES for rooms:**
- The player is NOT in the room scene. RoomManager spawns it at the door.
- Register the room path in `room_manager.gd` `room_paths`, and give every door a matching `target_door_id` on the other side.
- All Color() values in .tscn must have 4 components: `Color(r, g, b, a)`, not `Color(r, g, b)`.
- `[ext_resource]` blocks come before `[sub_resource]` blocks, which come before nodes.
- Platform top surface = StaticBody2D position. CollisionShape2D offset by (0, half_height). Polygon2D draws downward from 0.
- Platforms must be reachable: single jump height is ~88px, double jump adds ~65px. Keep vertical gaps under 150px.

## Code Conventions

- GDScript, fully typed: `var speed: float = 5.0`, `func move(delta: float) -> void:`
- `@export` for all tunable values, grouped with `@export_group()`
- `@onready` for node references. `%Name` requires `unique_name_in_owner = true` on that node in the scene.
- Groups for detection: `"player"`, `"enemies"`, `"doors"`, `"npcs"`
- `has_method()` for duck typing instead of `is ClassName`, so systems stay decoupled and do not depend on class_name resolution
- No external assets beyond the two background PNGs. Visuals are Polygon2D, CPUParticles2D and code-drawn shapes
- PNG textures go through `RuntimeTexture.load_texture(path)`, never `load("res://*.png")` or a `Texture2D` ext_resource in a .tscn: a project that was created but never opened in the editor has no import cache, and the runtime cannot load un-imported PNGs (a scene with a missing ext_resource fails to load at all)
- Scenes reference scripts by `path=` only, with no `uid=` attribute on `[ext_resource]`: the runtime resolves `uid://` through the editor-built `.godot/uid_cache.bin`, so a never-opened project logs a WARNING for every uid it meets
- Event-driven: emit EventBus signals, listen in other systems. Never reference nodes directly across systems.
- `process_mode = PROCESS_MODE_ALWAYS` on any node that must work during pause (UI, transitions)

## How To Test

Projects created with `summer create 2d-platformer <dir>` get `tests/autopilot/` (README, `autopilot.gd`, `probe_base.gd`, `run.sh`). From the project root:

```
bash tests/autopilot/run.sh
```

That boots the game in the engine's offscreen verify mode (no editor window, real renderer), walks the player through two waypoints in room_01, saves frames to `tests/autopilot/out/`, and exits non-zero if the engine logged any ERROR or WARNING. A pristine project must exit 0 with `"errors_seen": []` -- including one that has never been opened in the editor (no `.godot/`, no `.import` files), which is the state `summer create` leaves behind. Agents can run the same probe through the `RunVerification` op (see `tests/autopilot/README.md`).

Inside this template repository (which has no `tests/autopilot/`), the cheapest smoke test is a headless first frame; it prints every `_ready()` error and exits:

```
/Applications/Summer.app/Contents/MacOS/Summer --disable-crash-handler --path . --headless --quit
```

(Windows: `%LOCALAPPDATA%\Summer\current\Summer.exe`.) There is no `godot` binary on a Summer install; do not substitute one. Zero `ERROR:` lines is the bar.

## Input Actions (defined in project.godot)

| Action | Keys | Gamepad |
|--------|------|---------|
| move_left | A, Left Arrow | Left Stick |
| move_right | D, Right Arrow | Left Stick |
| jump | Space, W, Up Arrow | A button |
| move_down | S, Down Arrow | Left Stick |
| dash | Shift | RB |
| attack | X, J | X button |
| interact | E | Y button |
| pause | Escape | Start |

## Known Gaps

- No shopkeeper NPC is placed, so the shop UI is unreachable in the shipped rooms.
- No ability gate or ability-locked door is placed; double_jump, down_attack and charged_attack have no pickup.
- The HUD level label and the pause menu "Area" text are static in every room.
- AudioManager is a stub with no audio files.
- `scenes/levels/`, the level_select / victory / level_complete UI and the gem / checkpoint / bounce_pad / one_way_platform / level_end systems are legacy linear-platformer content that nothing loads.
