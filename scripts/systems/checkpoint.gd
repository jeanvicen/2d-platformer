extends Area2D
## Checkpoint flag. Touching it updates the player's spawn position.

@onready var flag_visual: Polygon2D = $FlagVisual
@onready var pole_visual: Polygon2D = $PoleVisual

var _activated: bool = false
var _inactive_color: Color = Color(0.5, 0.5, 0.5)
var _active_color: Color = Color(0.2, 0.9, 0.3)


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	flag_visual.color = _inactive_color


func _on_body_entered(body: Node2D) -> void:
	if _activated:
		return
	if not body.is_in_group("player"):
		return

	_activated = true
	flag_visual.color = _active_color

	# Update player spawn position
	if body.has_method("set_spawn_position"):
		body.set_spawn_position(global_position + Vector2(0, -20))

	# Activation animation
	var tween: Tween = create_tween()
	tween.tween_property(flag_visual, "scale", Vector2(1.3, 1.3), 0.1)
	tween.tween_property(flag_visual, "scale", Vector2.ONE, 0.15)

	EventBus.screen_shake_requested.emit(2.0, 0.05)
