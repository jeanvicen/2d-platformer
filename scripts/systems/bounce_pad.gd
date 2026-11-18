extends Area2D
## Launches the player upward when touched from above.

@export var bounce_velocity: float = -850.0
@export var visual_squash: Vector2 = Vector2(1.4, 0.6)

@onready var visuals: Node2D = $Visuals

var _base_scale: Vector2 = Vector2.ONE


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node2D) -> void:
	if not body.is_in_group("player"):
		return
	if not body is CharacterBody2D:
		return
	# Only bounce if player is falling/landing on top
	if body.velocity.y < 0:
		return

	body.velocity.y = bounce_velocity
	# Visual feedback
	var tween: Tween = create_tween()
	tween.tween_property(visuals, "scale", visual_squash, 0.05)
	tween.tween_property(visuals, "scale", Vector2.ONE, 0.2) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_ELASTIC)

	EventBus.screen_shake_requested.emit(3.0, 0.08)
	EventBus.player_jumped.emit()
