extends AnimatableBody2D
## Platform that moves between two points. Player rides on top.

@export var travel: Vector2 = Vector2(0, -128)  ## Offset from start position.
@export var duration: float = 2.0
@export var pause_at_ends: float = 0.5

var _start_pos: Vector2


func _ready() -> void:
	_start_pos = global_position
	_start_cycle()


func _start_cycle() -> void:
	var tween: Tween = create_tween().set_loops()
	tween.tween_property(self, "global_position", _start_pos + travel, duration) \
		.set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_interval(pause_at_ends)
	tween.tween_property(self, "global_position", _start_pos, duration) \
		.set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	tween.tween_interval(pause_at_ends)
