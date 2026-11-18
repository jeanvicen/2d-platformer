extends Node
## Persists game state to disk: abilities, rooms, quests, HP, coins.

const SAVE_PATH: String = "user://save_data.json"


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func save_game() -> void:
	var data: Dictionary = {
		"unlocked_abilities": AbilityManager.get_unlocked_list(),
		"visited_rooms": RoomManager.visited_rooms.duplicate(),
		"quest_states": QuestManager.quest_states.duplicate(),
		"quest_objectives": QuestManager.completed_objectives.duplicate(),
		"coins": GameManager.coins,
		"score": GameManager.score,
		"hp": GameManager.hp,
		"max_hp": GameManager.max_hp,
		"last_bench_room": GameManager.last_bench_room,
		"last_bench_door": GameManager.last_bench_door,
		"current_room": RoomManager.current_room_id,
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))


func load_game() -> bool:
	if not FileAccess.file_exists(SAVE_PATH):
		return false
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return false
	var json := JSON.new()
	if json.parse(file.get_as_text()) != OK:
		return false
	var data: Dictionary = json.data

	# Restore abilities
	AbilityManager.reset()
	if data.has("unlocked_abilities"):
		for ab in data["unlocked_abilities"]:
			AbilityManager.unlocked[ab] = true

	# Restore rooms
	if data.has("visited_rooms"):
		RoomManager.visited_rooms.assign(data["visited_rooms"])

	# Restore quests
	if data.has("quest_states"):
		QuestManager.quest_states = data["quest_states"]
	if data.has("quest_objectives"):
		QuestManager.completed_objectives = data["quest_objectives"]

	# Restore game state
	GameManager.coins = data.get("coins", 0)
	GameManager.score = data.get("score", 0)
	GameManager.hp = data.get("hp", GameManager.DEFAULT_MAX_HP)
	GameManager.max_hp = data.get("max_hp", GameManager.DEFAULT_MAX_HP)
	GameManager.last_bench_room = data.get("last_bench_room", GameManager.DEFAULT_START_ROOM)
	GameManager.last_bench_door = data.get("last_bench_door", GameManager.DEFAULT_START_DOOR)

	return true


func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func delete_save() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(SAVE_PATH)


func reset() -> void:
	delete_save()
