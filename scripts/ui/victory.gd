extends Control
## Victory screen shown when all levels are completed.

@onready var score_label: Label = $VBoxContainer/ScoreLabel
@onready var gems_label: Label = $VBoxContainer/GemsLabel
@onready var play_again_button: Button = $VBoxContainer/ButtonsContainer/PlayAgainButton
@onready var level_select_button: Button = $VBoxContainer/ButtonsContainer/LevelSelectButton
@onready var menu_button: Button = $VBoxContainer/ButtonsContainer/MenuButton


func _ready() -> void:
	score_label.text = "Final Score: %d" % GameManager.score
	gems_label.text = "Gems: %d / 9" % SaveManager.get_total_gems()
	play_again_button.pressed.connect(_on_play_again)
	level_select_button.pressed.connect(_on_level_select)
	menu_button.pressed.connect(_on_menu)
	play_again_button.grab_focus()

	# Title pop animation
	$VBoxContainer/Title.scale = Vector2.ZERO
	var tween := create_tween()
	tween.tween_property($VBoxContainer/Title, "scale", Vector2.ONE, 0.4) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)


func _on_play_again() -> void:
	GameManager.start_game()


func _on_level_select() -> void:
	SceneTransition.change_scene("res://scenes/ui/level_select.tscn")


func _on_menu() -> void:
	GameManager.go_to_main_menu()
