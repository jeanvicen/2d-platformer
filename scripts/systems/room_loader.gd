extends Node2D
## Attach to the root of every room scene. Spawns the player on _ready.

@export var room_id: String = ""


func _ready() -> void:
	if not room_id.is_empty():
		RoomManager.current_room_id = room_id
	# Direct boot parity: run/main_scene points at a room, so GameManager.
	# start_game() (which grants the starting dash) may never have run. Only
	# fires on truly fresh ability state — New Game and loaded saves always
	# have dash unlocked already.
	if AbilityManager.unlocked.is_empty():
		AbilityManager.unlock("dash")
	# Spawn the player at the correct door
	call_deferred("_spawn_player")


func _spawn_player() -> void:
	RoomManager.spawn_player_in_room(self)
