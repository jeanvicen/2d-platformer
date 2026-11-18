extends Area2D
## Save/heal bench. Player interacts to rest, heal to full HP, and save.

@export var bench_room_id: String = ""  ## Filled by room or manually.
@export var bench_door_id: String = ""  ## Door ID for respawn position.

var _player_inside: bool = false
var _resting: bool = false

@onready var visual: Node2D = $Visual


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func _unhandled_input(event: InputEvent) -> void:
	if not _player_inside or _resting:
		return
	if event.is_action_pressed("interact"):
		_rest()
		get_viewport().set_input_as_handled()


func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("player"):
		_player_inside = true


func _on_body_exited(body: Node2D) -> void:
	if body.is_in_group("player"):
		_player_inside = false


func _rest() -> void:
	_resting = true
	GameManager.heal_full()
	GameManager.set_bench(
		bench_room_id if not bench_room_id.is_empty() else RoomManager.current_room_id,
		bench_door_id if not bench_door_id.is_empty() else "bench"
	)
	# Visual feedback
	var tween := create_tween()
	tween.tween_property(visual, "modulate", Color(1.5, 1.5, 1.5), 0.2)
	tween.tween_property(visual, "modulate", Color.WHITE, 0.3)
	tween.tween_callback(func(): _resting = false)
	EventBus.screen_shake_requested.emit(1.0, 0.05)
