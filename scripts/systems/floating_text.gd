extends Node2D
## Floating text that rises and fades out. Used for score popups.

var _velocity: Vector2 = Vector2.ZERO
var _lifetime: float = 0.0
var _max_lifetime: float = 0.7
var _label: Label


func setup(text: String, color: Color = Color.WHITE) -> void:
	_velocity = Vector2(randf_range(-30, 30), -120)

	_label = Label.new()
	_label.text = text
	_label.add_theme_color_override("font_color", color)
	_label.add_theme_font_size_override("font_size", 18)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.position = Vector2(-40, -10)
	_label.size = Vector2(80, 24)
	add_child(_label)


func _process(delta: float) -> void:
	_lifetime += delta
	var t: float = _lifetime / _max_lifetime

	_velocity.y += 200.0 * delta
	position += _velocity * delta

	modulate.a = 1.0 - t

	if t < 0.15:
		var pop: float = 1.0 + (1.0 - t / 0.15) * 0.4
		scale = Vector2(pop, pop)
	else:
		scale = Vector2.ONE

	if _lifetime >= _max_lifetime:
		queue_free()
