extends CharacterBody2D
## NPC that the player can interact with to trigger dialogue.

@export var npc_id: String = "elder"
@export var display_name: String = "Elder"
@export var dialogue_file: String = "res://data/dialogue/elder.json"
@export var body_color: Color = Color(0.4, 0.6, 0.3)
@export var is_shopkeeper: bool = false

@onready var visuals: Node2D = $Visuals
@onready var prompt_label: Label = $PromptLabel

var _player_inside: bool = false
var _in_dialogue: bool = false
var _dialogue_data: Dictionary = {}
var _bob_time: float = 0.0


func _ready() -> void:
	add_to_group("npcs")
	$InteractZone.body_entered.connect(_on_body_entered)
	$InteractZone.body_exited.connect(_on_body_exited)
	prompt_label.visible = false
	_load_dialogue()
	# Set NPC color
	if visuals.get_child_count() > 0:
		visuals.get_child(0).color = body_color


func _process(delta: float) -> void:
	_bob_time += delta
	visuals.position.y = sin(_bob_time * 1.5) * 2.0


func _unhandled_input(event: InputEvent) -> void:
	if not _player_inside or _in_dialogue:
		return
	if event.is_action_pressed("interact"):
		_start_dialogue()
		get_viewport().set_input_as_handled()


func _load_dialogue() -> void:
	if dialogue_file.is_empty():
		return
	var file := FileAccess.open(dialogue_file, FileAccess.READ)
	if not file:
		return
	var json := JSON.new()
	if json.parse(file.get_as_text()) == OK:
		_dialogue_data = json.data


func _start_dialogue() -> void:
	if _dialogue_data.is_empty():
		return
	_in_dialogue = true
	prompt_label.visible = false
	EventBus.dialogue_started.emit(npc_id)

	var conversation: Dictionary = _pick_conversation()
	if conversation.is_empty():
		_end_dialogue()
		return

	# Set flag if specified
	if conversation.has("set_flag") and not conversation["set_flag"].is_empty():
		SaveManager.save_game()  # Flags stored via npc_flags

	# Run dialogue lines
	var runner := preload("res://scripts/npcs/dialogue_runner.gd").new()
	add_child(runner)
	runner.run(conversation.get("lines", []), display_name)
	await runner.dialogue_finished
	runner.queue_free()
	_end_dialogue()


func _end_dialogue() -> void:
	_in_dialogue = false
	EventBus.dialogue_ended.emit(npc_id)
	if is_shopkeeper:
		var shop_scene: PackedScene = load("res://scenes/ui/shop.tscn")
		if shop_scene:
			var shop := shop_scene.instantiate()
			get_tree().current_scene.add_child(shop)
	if _player_inside:
		prompt_label.visible = true


func _pick_conversation() -> Dictionary:
	if not _dialogue_data.has("conversations"):
		return {}
	for conv in _dialogue_data["conversations"]:
		if _check_condition(conv.get("condition", {})):
			return conv
	return {}


func _check_condition(condition: Dictionary) -> bool:
	if condition.is_empty():
		return true
	var type: String = condition.get("type", "always")
	match type:
		"always":
			return true
		"flag_not_set":
			return not SaveManager.has_save()  # Simplified for now
		"has_ability":
			return AbilityManager.has_ability(condition.get("ability", ""))
		"quest_active":
			return QuestManager.get_state(condition.get("quest_id", "")) == "active"
		"quest_completed":
			return QuestManager.get_state(condition.get("quest_id", "")) == "completed"
	return true


func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("player"):
		_player_inside = true
		if not _in_dialogue:
			prompt_label.visible = true


func _on_body_exited(body: Node2D) -> void:
	if body.is_in_group("player"):
		_player_inside = false
		prompt_label.visible = false
