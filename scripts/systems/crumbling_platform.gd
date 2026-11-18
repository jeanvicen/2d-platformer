extends StaticBody2D
## Platform that crumbles when the player stands on it, then respawns.

@export var shake_time: float = 0.4
@export var fall_delay: float = 0.1
@export var respawn_time: float = 3.0

@onready var detector: Area2D = $PlayerDetector
@onready var visual: Node2D = $Visual

var _original_position: Vector2
var _crumbling: bool = false
var _original_layer: int


func _ready() -> void:
	_original_position = global_position
	_original_layer = collision_layer
	detector.body_entered.connect(_on_player_entered)


func _on_player_entered(body: Node2D) -> void:
	if _crumbling:
		return
	if not body.is_in_group("player"):
		return
	_crumble()


func _crumble() -> void:
	_crumbling = true

	# Shake phase
	var shake_tween := create_tween()
	for i in range(int(shake_time / 0.05)):
		shake_tween.tween_property(visual, "position", Vector2(randf_range(-3, 3), randf_range(-2, 2)), 0.05)
	await shake_tween.finished
	visual.position = Vector2.ZERO

	# Brief pause
	await get_tree().create_timer(fall_delay).timeout

	# Fall
	collision_layer = 0
	detector.set_deferred("monitoring", false)
	var fall_tween := create_tween().set_parallel(true)
	fall_tween.tween_property(self, "position:y", position.y + 300, 0.4) \
		.set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_QUAD)
	fall_tween.tween_property(visual, "modulate:a", 0.0, 0.35)
	await fall_tween.finished

	# Wait then respawn
	await get_tree().create_timer(respawn_time).timeout
	global_position = _original_position
	visual.modulate.a = 1.0
	collision_layer = _original_layer
	detector.set_deferred("monitoring", true)
	_crumbling = false
