extends Control
## Main menu: New Game, Continue (if save exists), Quit.

const RuntimeTexture := preload("res://scripts/systems/runtime_texture.gd")

@onready var bg_image: TextureRect = $BgImage
@onready var title_label: Label = $VBoxContainer/Title
@onready var subtitle_label: Label = $VBoxContainer/Subtitle
@onready var new_game_button: Button = $VBoxContainer/NewGameButton
@onready var continue_button: Button = $VBoxContainer/ContinueButton
@onready var quit_button: Button = $VBoxContainer/QuitButton


func _ready() -> void:
	# Loaded in code so the menu also works on a project that was never opened in the editor.
	bg_image.texture = RuntimeTexture.load_texture("res://assets/sprites/menu_bg.png")
	new_game_button.pressed.connect(_on_new_game)
	continue_button.pressed.connect(_on_continue)
	quit_button.pressed.connect(_on_quit)

	continue_button.visible = SaveManager.has_save()

	if continue_button.visible:
		continue_button.grab_focus()
	else:
		new_game_button.grab_focus()

	_style_ui()
	_animate_title()


func _style_ui() -> void:
	# Title styling
	title_label.add_theme_font_size_override("font_size", 48)
	title_label.add_theme_color_override("font_color", Color(0.95, 0.9, 0.75))
	title_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	title_label.add_theme_constant_override("shadow_offset_x", 2)
	title_label.add_theme_constant_override("shadow_offset_y", 2)

	subtitle_label.add_theme_font_size_override("font_size", 16)
	subtitle_label.add_theme_color_override("font_color", Color(0.8, 0.75, 0.6, 0.7))

	# Button styling
	for btn: Button in [new_game_button, continue_button, quit_button]:
		_apply_button_style(btn)

	# Controls text
	var controls: Label = $Controls
	if controls:
		controls.add_theme_color_override("font_color", Color(0.9, 0.85, 0.7, 0.5))
		controls.add_theme_font_size_override("font_size", 13)


func _apply_button_style(btn: Button) -> void:
	btn.add_theme_font_size_override("font_size", 18)
	btn.add_theme_color_override("font_color", Color(0.95, 0.9, 0.75))

	var normal := StyleBoxFlat.new()
	normal.bg_color = Color(0.15, 0.12, 0.08, 0.7)
	normal.border_width_left = 1
	normal.border_width_right = 1
	normal.border_width_top = 1
	normal.border_width_bottom = 1
	normal.border_color = Color(0.6, 0.5, 0.35, 0.5)
	normal.corner_radius_top_left = 4
	normal.corner_radius_top_right = 4
	normal.corner_radius_bottom_left = 4
	normal.corner_radius_bottom_right = 4
	normal.content_margin_left = 24
	normal.content_margin_right = 24
	normal.content_margin_top = 10
	normal.content_margin_bottom = 10
	btn.add_theme_stylebox_override("normal", normal)

	var hover := normal.duplicate()
	hover.bg_color = Color(0.25, 0.2, 0.12, 0.8)
	hover.border_color = Color(0.8, 0.7, 0.45, 0.7)
	btn.add_theme_stylebox_override("hover", hover)

	var pressed := normal.duplicate()
	pressed.bg_color = Color(0.1, 0.08, 0.05, 0.8)
	btn.add_theme_stylebox_override("pressed", pressed)

	var focus := hover.duplicate()
	btn.add_theme_stylebox_override("focus", focus)


func _animate_title() -> void:
	title_label.pivot_offset = title_label.size / 2.0
	title_label.scale = Vector2(0.8, 0.8)
	title_label.modulate.a = 0.0
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(title_label, "scale", Vector2.ONE, 0.6) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	tween.tween_property(title_label, "modulate:a", 1.0, 0.4)


func _on_new_game() -> void:
	SaveManager.delete_save()
	GameManager.start_game()


func _on_continue() -> void:
	SaveManager.load_game()
	RoomManager.change_room(GameManager.last_bench_room, GameManager.last_bench_door)


func _on_quit() -> void:
	get_tree().quit()
