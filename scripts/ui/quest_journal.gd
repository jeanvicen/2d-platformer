extends CanvasLayer
## Quest journal overlay. Shows active and completed quests.

@onready var panel: PanelContainer = $PanelContainer
@onready var quest_list: VBoxContainer = $PanelContainer/MarginContainer/VBoxContainer/ScrollContainer/QuestList
@onready var close_button: Button = $PanelContainer/MarginContainer/VBoxContainer/Header/CloseButton


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	close_button.pressed.connect(_close)
	_populate_quests()
	get_tree().paused = true


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		_close()
		get_viewport().set_input_as_handled()


func _populate_quests() -> void:
	# Clear existing entries
	for child in quest_list.get_children():
		child.queue_free()

	# Active quests
	var active: Array[String] = QuestManager.get_active_quests()
	for quest_id in active:
		_add_quest_entry(quest_id, false)

	# Completed quests
	var completed: Array[String] = QuestManager.get_completed_quests()
	for quest_id in completed:
		_add_quest_entry(quest_id, true)

	# Empty state
	if active.is_empty() and completed.is_empty():
		var empty_label := Label.new()
		empty_label.text = "No quests yet."
		empty_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5, 1))
		quest_list.add_child(empty_label)


func _add_quest_entry(quest_id: String, is_completed: bool) -> void:
	var data: Dictionary = QuestManager.quest_data.get(quest_id, {})
	var title: String = data.get("title", quest_id)

	var entry := VBoxContainer.new()
	entry.add_theme_constant_override("separation", 2)

	var title_label := Label.new()
	if is_completed:
		title_label.text = "[Completed] " + title
		title_label.add_theme_color_override("font_color", Color(0.4, 0.4, 0.4, 1))
	else:
		title_label.text = title
		title_label.add_theme_color_override("font_color", Color(1, 1, 1, 1))
	entry.add_child(title_label)

	# Show objectives for active quests
	if not is_completed and data.has("objectives"):
		for obj in data["objectives"]:
			var obj_label := Label.new()
			var done: bool = QuestManager.is_objective_done(quest_id, obj.get("id", ""))
			var prefix: String = "[x] " if done else "[ ] "
			obj_label.text = "  " + prefix + obj.get("description", "")
			obj_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7, 1))
			entry.add_child(obj_label)

	# Spacer
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 4)
	entry.add_child(spacer)

	quest_list.add_child(entry)


func _close() -> void:
	get_tree().paused = false
	queue_free()
