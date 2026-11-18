extends Area2D
## Door that transitions the player to another room.

@export var door_id: String = ""
@export var target_room_id: String = ""
@export var target_door_id: String = ""
@export var requires_ability: String = ""
@export var locked: bool = false
@export var auto_enter: bool = false

var _player_inside: bool = false
var _prompt_label: Label
var _spawn_cooldown: float = 0.0  ## Prevents auto_enter on spawn.


func _ready() -> void:
	add_to_group("doors")
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	# If this is the door the player spawns at, add a cooldown
	if door_id == RoomManager.current_door_id:
		_spawn_cooldown = 0.5
	# Create floating prompt
	_prompt_label = Label.new()
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_label.position = Vector2(-40, -85)
	_prompt_label.size = Vector2(80, 20)
	_prompt_label.add_theme_font_size_override("font_size", 14)
	_prompt_label.add_theme_color_override("font_color", Color(0.95, 0.9, 0.7))
	_prompt_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	_prompt_label.add_theme_constant_override("shadow_offset_x", 1)
	_prompt_label.add_theme_constant_override("shadow_offset_y", 1)
	_prompt_label.visible = false
	add_child(_prompt_label)


func _process(delta: float) -> void:
	if _spawn_cooldown > 0.0:
		_spawn_cooldown -= delta


func _unhandled_input(event: InputEvent) -> void:
	if not _player_inside:
		return
	if auto_enter:
		return
	if target_room_id.is_empty():
		return
	if event.is_action_pressed("interact"):
		_enter_door()
		get_viewport().set_input_as_handled()


func _on_body_entered(body: Node2D) -> void:
	if not body.is_in_group("player"):
		return
	_player_inside = true
	if auto_enter and _spawn_cooldown <= 0.0:
		_enter_door()
	elif not auto_enter:
		_show_prompt()


func _on_body_exited(body: Node2D) -> void:
	if body.is_in_group("player"):
		_player_inside = false
		_prompt_label.visible = false


func _show_prompt() -> void:
	if not requires_ability.is_empty() and not AbilityManager.has_ability(requires_ability):
		_prompt_label.text = "Requires: %s" % requires_ability.capitalize()
		_prompt_label.add_theme_color_override("font_color", Color(0.8, 0.4, 0.3))
	elif locked:
		_prompt_label.text = "Locked"
		_prompt_label.add_theme_color_override("font_color", Color(0.8, 0.4, 0.3))
	else:
		_prompt_label.text = "E to Enter"
		_prompt_label.add_theme_color_override("font_color", Color(0.95, 0.9, 0.7))
	_prompt_label.visible = true


func _enter_door() -> void:
	if target_room_id.is_empty():
		return
	if locked:
		return
	if not requires_ability.is_empty() and not AbilityManager.has_ability(requires_ability):
		return
	EventBus.door_entered.emit(target_room_id, target_door_id)
	GameManager.change_room(target_room_id, target_door_id)
