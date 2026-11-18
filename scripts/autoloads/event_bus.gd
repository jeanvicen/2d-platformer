extends Node
## Global event bus for decoupled communication between systems.

# -- Player --
signal player_hit(source_position: Vector2)
signal player_died
signal player_respawned
signal player_landed(speed: float)
signal player_jumped
signal player_wall_jumped
signal player_dashed
signal player_attacked(direction: Vector2)
signal player_attack_hit(target: Node2D, damage: int)
signal player_healed(amount: int)
signal hp_changed(current: int, max_hp: int)

# -- Enemies --
signal enemy_killed(position: Vector2)
signal enemy_stomped(position: Vector2)
signal enemy_damaged(enemy: Node2D, damage: int, position: Vector2)

# -- Collectibles --
signal coin_collected(position: Vector2, total: int)
signal gem_collected(level_index: int, gem_id: int)

# -- World --
signal door_entered(room_id: String, door_id: String)
signal ability_unlocked(ability_name: String)
signal level_completed
signal game_over

# -- Quests --
signal quest_started(quest_id: String)
signal quest_completed(quest_id: String)
signal quest_objective_updated(quest_id: String, objective_id: String)

# -- NPCs --
signal dialogue_started(npc_id: String)
signal dialogue_ended(npc_id: String)
signal shop_opened(shop_id: String)
signal item_purchased(item_id: String)

# -- Juice --
signal screen_shake_requested(intensity: float, duration: float)
signal hitstop_requested(duration: float)
