extends Control
## Level select screen with unlock status and gem indicators.

@onready var back_button: Button = $VBoxContainer/BackButton
@onready var levels_container: HBoxContainer = $VBoxContainer/LevelsContainer

const LEVEL_NAMES: Array[String] = ["Green Meadows", "Blue Caverns", "Red Fortress"]
const LEVEL_COLORS: Array[Color] = [
	Color(0.3, 0.6, 0.3),
	Color(0.3, 0.4, 0.7),
	Color(0.7, 0.3, 0.3),
]


func _ready() -> void:
	back_button.pressed.connect(_on_back)
	_build_level_buttons()


func _build_level_buttons() -> void:
	for i in range(GameManager.levels.size()):
		var btn := Button.new()
		var unlocked: bool = SaveManager.is_level_unlocked(i)
		var completed: bool = SaveManager.is_level_completed(i)
		var gem_count: int = SaveManager.get_gem_count(i)

		var label_text: String = "%d. %s" % [i + 1, LEVEL_NAMES[i] if i < LEVEL_NAMES.size() else "Level %d" % (i + 1)]
		if not unlocked:
			label_text = "%d. [Locked]" % (i + 1)
		elif completed:
			label_text += " [Done]"
		if unlocked:
			label_text += "\nGems: %d/3" % gem_count

		btn.text = label_text
		btn.disabled = not unlocked
		btn.custom_minimum_size = Vector2(250, 100)

		# Style
		var style := StyleBoxFlat.new()
		style.bg_color = LEVEL_COLORS[i] if i < LEVEL_COLORS.size() else Color(0.3, 0.3, 0.3)
		if not unlocked:
			style.bg_color = Color(0.2, 0.2, 0.2)
		style.corner_radius_top_left = 8
		style.corner_radius_top_right = 8
		style.corner_radius_bottom_left = 8
		style.corner_radius_bottom_right = 8
		style.content_margin_left = 12
		style.content_margin_right = 12
		style.content_margin_top = 12
		style.content_margin_bottom = 12
		btn.add_theme_stylebox_override("normal", style)
		var hover := style.duplicate()
		hover.bg_color = style.bg_color.lightened(0.15)
		btn.add_theme_stylebox_override("hover", hover)
		var pressed_s := style.duplicate()
		pressed_s.bg_color = style.bg_color.darkened(0.1)
		btn.add_theme_stylebox_override("pressed", pressed_s)
		var disabled_s := style.duplicate()
		disabled_s.bg_color = Color(0.15, 0.15, 0.15)
		btn.add_theme_stylebox_override("disabled", disabled_s)

		var idx: int = i
		btn.pressed.connect(func(): _on_level_selected(idx))
		levels_container.add_child(btn)

		if i == 0 and unlocked:
			btn.grab_focus()


func _on_level_selected(index: int) -> void:
	GameManager.load_level(index)


func _on_back() -> void:
	SceneTransition.change_scene("res://scenes/ui/main_menu.tscn")
