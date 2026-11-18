extends Node
## Smooth fade-to-black scene transitions.

var _canvas: CanvasLayer
var _rect: ColorRect
var _is_transitioning: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_canvas = CanvasLayer.new()
	_canvas.layer = 100
	add_child(_canvas)

	_rect = ColorRect.new()
	_rect.color = Color(0, 0, 0, 0)
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# Set size directly instead of anchors to avoid blocking input
	_rect.size = Vector2(1920, 1080)
	_rect.position = Vector2.ZERO
	_canvas.add_child(_rect)


func change_scene(path: String, duration: float = 0.3) -> void:
	if _is_transitioning:
		# Stuck guard: force the scene change
		_is_transitioning = false
		_rect.color.a = 0.0
		_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		get_tree().change_scene_to_file(path)
		return

	_is_transitioning = true
	_rect.mouse_filter = Control.MOUSE_FILTER_STOP

	# Fade out
	var tween := create_tween()
	tween.tween_property(_rect, "color:a", 1.0, duration)
	await tween.finished

	# Change scene
	get_tree().change_scene_to_file(path)
	await get_tree().process_frame
	await get_tree().process_frame

	# Fade in
	var tween_in := create_tween()
	tween_in.tween_property(_rect, "color:a", 0.0, duration)
	await tween_in.finished

	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_is_transitioning = false
