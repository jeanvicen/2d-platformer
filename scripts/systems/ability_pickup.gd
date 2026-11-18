extends Area2D
## Grants a permanent ability when the player interacts.

@export var ability_name: String = "dash"
@export var display_name: String = "Shadow Dash"
@export var description: String = "Press SHIFT to dash."
@export var glow_color: Color = Color(0.4, 0.8, 1.0)

var _collected: bool = false
var _player_inside: bool = false
var _time: float = 0.0

@onready var visuals: Node2D = $Visuals
@onready var prompt_label: Label = $PromptLabel


func _ready() -> void:
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	# Hide if already collected
	if AbilityManager.has_ability(ability_name):
		queue_free()
		return
	prompt_label.visible = false


func _process(delta: float) -> void:
	_time += delta
	# Floating bob + glow pulse
	visuals.position.y = sin(_time * 2.0) * 6.0
	var pulse: float = 0.7 + sin(_time * 3.0) * 0.3
	visuals.modulate = glow_color * pulse


func _unhandled_input(event: InputEvent) -> void:
	if not _player_inside or _collected:
		return
	if event.is_action_pressed("interact"):
		_collect()
		get_viewport().set_input_as_handled()


func _on_body_entered(body: Node2D) -> void:
	if body.is_in_group("player"):
		_player_inside = true
		prompt_label.visible = true


func _on_body_exited(body: Node2D) -> void:
	if body.is_in_group("player"):
		_player_inside = false
		prompt_label.visible = false


func _collect() -> void:
	_collected = true
	AbilityManager.unlock(ability_name)
	SaveManager.save_game()
	EventBus.screen_shake_requested.emit(5.0, 0.15)
	EventBus.hitstop_requested.emit(0.08)

	# Sparkle effect
	var tween := create_tween()
	tween.tween_property(visuals, "scale", Vector2(3, 3), 0.3).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(visuals, "modulate:a", 0.0, 0.3)
	tween.tween_callback(queue_free)

	# Show "Ability Acquired!" overlay
	_show_acquired_overlay()


func _show_acquired_overlay() -> void:
	var canvas := CanvasLayer.new()
	canvas.layer = 40
	get_tree().current_scene.add_child(canvas)

	# Full-screen container so anchors work
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canvas.add_child(root)

	# Dark backdrop
	var backdrop := ColorRect.new()
	backdrop.color = Color(0, 0, 0, 0.0)
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(backdrop)

	# Panel - centered
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.offset_left = -200
	panel.offset_top = -100
	panel.offset_right = 200
	panel.offset_bottom = 100
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.06, 0.12, 0.92)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.4, 0.7, 0.9, 0.7)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	style.content_margin_left = 20
	style.content_margin_right = 20
	style.content_margin_top = 20
	style.content_margin_bottom = 20
	panel.add_theme_stylebox_override("panel", style)
	root.add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)

	var title := Label.new()
	title.text = "Ability Acquired!"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 28)
	title.add_theme_color_override("font_color", Color(0.4, 0.85, 1.0))
	vbox.add_child(title)

	var name_label := Label.new()
	name_label.text = display_name
	name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_label.add_theme_font_size_override("font_size", 22)
	name_label.add_theme_color_override("font_color", Color(0.95, 0.9, 0.75))
	vbox.add_child(name_label)

	var desc_label := Label.new()
	desc_label.text = description
	desc_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	desc_label.add_theme_font_size_override("font_size", 16)
	desc_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
	vbox.add_child(desc_label)

	# Animate in
	panel.scale = Vector2(0.5, 0.5)
	panel.pivot_offset = panel.size / 2.0
	var overlay_tween := canvas.create_tween()
	overlay_tween.set_parallel(true)
	overlay_tween.tween_property(backdrop, "color:a", 0.5, 0.3)
	overlay_tween.tween_property(panel, "scale", Vector2.ONE, 0.3) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)

	# Auto-dismiss after 2.5s
	await get_tree().create_timer(2.5).timeout
	var out_tween := canvas.create_tween()
	out_tween.tween_property(backdrop, "color:a", 0.0, 0.2)
	out_tween.parallel().tween_property(panel, "modulate:a", 0.0, 0.2)
	await out_tween.finished
	canvas.queue_free()
