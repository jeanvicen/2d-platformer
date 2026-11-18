extends Node
## Tracks which abilities the player has unlocked.

signal ability_unlocked(ability_name: String)

const ALL_ABILITIES: Array[String] = [
	"dash", "wall_climb", "double_jump", "down_attack", "charged_attack"
]

var unlocked: Dictionary = {}  # { "dash": true }


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func has_ability(ability_name: String) -> bool:
	return unlocked.get(ability_name, false)


func unlock(ability_name: String) -> void:
	if unlocked.get(ability_name, false):
		return
	unlocked[ability_name] = true
	ability_unlocked.emit(ability_name)
	EventBus.ability_unlocked.emit(ability_name)


func reset() -> void:
	unlocked.clear()


func get_unlocked_list() -> Array[String]:
	var result: Array[String] = []
	for key in unlocked:
		if unlocked[key]:
			result.append(key)
	return result
