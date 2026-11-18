extends Node
## Manages room transitions, player spawning, and visited room tracking.

signal room_changed(room_id: String)

var current_room_id: String = ""
var current_door_id: String = ""
var visited_rooms: Array[String] = []

## Room ID -> scene path mapping.
var room_paths: Dictionary = {
	"room_01": "res://scenes/rooms/room_01.tscn",
	"room_02": "res://scenes/rooms/room_02.tscn",
	"room_03": "res://scenes/rooms/room_03.tscn",
	"room_04": "res://scenes/rooms/room_04.tscn",
	"room_05": "res://scenes/rooms/room_05.tscn",
	"room_06": "res://scenes/rooms/room_06.tscn",
	"room_07": "res://scenes/rooms/room_07.tscn",
}

const PLAYER_SCENE: PackedScene = preload("res://scenes/player/player.tscn")


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func change_room(room_id: String, door_id: String) -> void:
	current_room_id = room_id
	current_door_id = door_id
	if room_id not in visited_rooms:
		visited_rooms.append(room_id)
	var path: String = room_paths.get(room_id, "")
	if path.is_empty():
		push_error("RoomManager: Unknown room_id '%s'" % room_id)
		return
	SceneTransition.change_scene(path)
	room_changed.emit(room_id)


## Called by rooms in _ready to spawn the player at the correct door.
func spawn_player_in_room(room_root: Node) -> void:
	var player := PLAYER_SCENE.instantiate()
	var spawn_pos := Vector2(200, 400)  # Fallback

	# Find the door matching current_door_id and use its spawn point
	if not current_door_id.is_empty():
		var doors := room_root.get_tree().get_nodes_in_group("doors")
		for door in doors:
			if door.get("door_id") == current_door_id:
				var marker: Marker2D = door.get_node_or_null("SpawnPoint")
				if marker:
					spawn_pos = marker.global_position
				else:
					spawn_pos = door.global_position + Vector2(0, -20)
				# Offset away from room edges to prevent wall sticking
				if spawn_pos.x < 100:
					spawn_pos.x = 100
				if spawn_pos.x > 1100:
					spawn_pos.x = 1100
				break

	player.global_position = spawn_pos
	room_root.add_child(player)


func reset() -> void:
	current_room_id = ""
	current_door_id = ""
	visited_rooms.clear()
