extends Node
## Tracks quest states and objectives.

signal quest_started(quest_id: String)
signal quest_updated(quest_id: String)
signal quest_completed(quest_id: String)

## Quest states: "not_started", "active", "completed"
var quest_states: Dictionary = {}
## Completed objectives per quest: { "quest_id": ["obj_1", "obj_2"] }
var completed_objectives: Dictionary = {}
## Loaded quest data from JSON
var quest_data: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_load_quest_data()


func _load_quest_data() -> void:
	var dir := DirAccess.open("res://data/quests/")
	if not dir:
		return
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if file_name.ends_with(".json"):
			var path := "res://data/quests/" + file_name
			var file := FileAccess.open(path, FileAccess.READ)
			if file:
				var json := JSON.new()
				if json.parse(file.get_as_text()) == OK:
					var data: Dictionary = json.data
					if data.has("quest_id"):
						quest_data[data["quest_id"]] = data
		file_name = dir.get_next()


func start_quest(quest_id: String) -> void:
	if get_state(quest_id) != "not_started":
		return
	quest_states[quest_id] = "active"
	completed_objectives[quest_id] = []
	quest_started.emit(quest_id)
	EventBus.quest_started.emit(quest_id)


func update_objective(quest_id: String, objective_id: String) -> void:
	if get_state(quest_id) != "active":
		return
	if quest_id not in completed_objectives:
		completed_objectives[quest_id] = []
	if objective_id not in completed_objectives[quest_id]:
		completed_objectives[quest_id].append(objective_id)
	quest_updated.emit(quest_id)
	EventBus.quest_objective_updated.emit(quest_id, objective_id)
	# Check if all objectives done
	_check_auto_complete(quest_id)


func complete_quest(quest_id: String) -> void:
	quest_states[quest_id] = "completed"
	quest_completed.emit(quest_id)
	EventBus.quest_completed.emit(quest_id)


func get_state(quest_id: String) -> String:
	return quest_states.get(quest_id, "not_started")


func is_objective_done(quest_id: String, objective_id: String) -> bool:
	if quest_id not in completed_objectives:
		return false
	return objective_id in completed_objectives[quest_id]


func get_active_quests() -> Array[String]:
	var result: Array[String] = []
	for qid in quest_states:
		if quest_states[qid] == "active":
			result.append(qid)
	return result


func get_completed_quests() -> Array[String]:
	var result: Array[String] = []
	for qid in quest_states:
		if quest_states[qid] == "completed":
			result.append(qid)
	return result


func _check_auto_complete(quest_id: String) -> void:
	if quest_id not in quest_data:
		return
	var data: Dictionary = quest_data[quest_id]
	if not data.has("objectives"):
		return
	var all_done: bool = true
	for obj in data["objectives"]:
		if not is_objective_done(quest_id, obj["id"]):
			all_done = false
			break
	if all_done:
		complete_quest(quest_id)


func reset() -> void:
	quest_states.clear()
	completed_objectives.clear()
