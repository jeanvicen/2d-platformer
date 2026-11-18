extends Node
## Runs a sequence of dialogue lines with typewriter effect.
## Instantiated by NPCs, not an autoload.

signal dialogue_finished

var _lines: Array = []
var _current_line: int = 0
var _typing: bool = false
var _box: PanelContainer
var _speaker_label: Label
var _text_label: Label
var _canvas: CanvasLayer

const CHARS_PER_SECOND: float = 40.0


func run(lines: Array, default_speaker: String = "") -> void:
	_lines = lines
	_current_line = 0
	_create_ui()
	_show_line()


func _create_ui() -> void:
	_canvas = CanvasLayer.new()
	_canvas.layer = 50
	add_child(_canvas)

	_box = PanelContainer.new()
	_box.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_box.offset_top = -120
	_box.offset_left = 200
	_box.offset_right = -200
	# Style
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.07, 0.12, 0.92)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.3, 0.35, 0.5)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	_box.add_theme_stylebox_override("panel", style)
	_canvas.add_child(_box)

	var vbox := VBoxContainer.new()
	_box.add_child(vbox)

	_speaker_label = Label.new()
	_speaker_label.add_theme_color_override("font_color", Color(0.6, 0.8, 1.0))
	_speaker_label.add_theme_font_size_override("font_size", 16)
	vbox.add_child(_speaker_label)

	_text_label = Label.new()
	_text_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text_label.add_theme_font_size_override("font_size", 14)
	_text_label.custom_minimum_size = Vector2(0, 50)
	vbox.add_child(_text_label)


func _show_line() -> void:
	if _current_line >= _lines.size():
		_close()
		return
	var line: Dictionary = _lines[_current_line]
	_speaker_label.text = line.get("speaker", "")
	var full_text: String = line.get("text", "")
	_text_label.text = ""
	_typing = true

	# Typewriter effect
	for i in range(full_text.length()):
		_text_label.text = full_text.substr(0, i + 1)
		var delay: float = 1.0 / CHARS_PER_SECOND
		await get_tree().create_timer(delay).timeout
		if not _typing:
			# Player skipped ahead
			_text_label.text = full_text
			break

	_typing = false


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("interact") or event.is_action_pressed("jump") or event.is_action_pressed("attack"):
		if _typing:
			_typing = false  # Skip typewriter
		else:
			_current_line += 1
			_show_line()
		get_viewport().set_input_as_handled()


func _close() -> void:
	if _canvas:
		_canvas.queue_free()
	dialogue_finished.emit()
