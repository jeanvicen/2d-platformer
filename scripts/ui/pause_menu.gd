extends CanvasLayer
## Pause menu overlay. Toggle with ESC / pause action.

@onready var panel: Control = $Center/PanelContainer
@onready var overlay: ColorRect = $Overlay
@onready var resume_button: Button = $Center/PanelContainer/MarginContainer/VBoxContainer/ResumeButton
@onready var journal_button: Button = $Center/PanelContainer/MarginContainer/VBoxContainer/JournalButton
@onready var map_button: Button = $Center/PanelContainer/MarginContainer/VBoxContainer/MapButton
@onready var restart_button: Button = $Center/PanelContainer/MarginContainer/VBoxContainer/RestartButton
@onready var quit_button: Button = $Center/PanelContainer/MarginContainer/VBoxContainer/QuitButton

var _paused: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	resume_button.pressed.connect(_resume)
	journal_button.pressed.connect(_open_journal)
	map_button.pressed.connect(_open_map)
	restart_button.pressed.connect(_restart)
	quit_button.pressed.connect(_quit)
	panel.visible = false
	overlay.visible = false


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		_toggle_pause()
		get_viewport().set_input_as_handled()


func _toggle_pause() -> void:
	_paused = not _paused
	get_tree().paused = _paused
	panel.visible = _paused
	overlay.visible = _paused
	if _paused:
		resume_button.grab_focus()


func _resume() -> void:
	_paused = false
	get_tree().paused = false
	panel.visible = false
	overlay.visible = false


func _open_journal() -> void:
	panel.visible = false
	overlay.visible = false
	var journal_scene: PackedScene = load("res://scenes/ui/quest_journal.tscn")
	if journal_scene:
		var journal := journal_scene.instantiate()
		get_tree().current_scene.add_child(journal)


func _open_map() -> void:
	panel.visible = false
	overlay.visible = false
	var map_scene: PackedScene = load("res://scenes/ui/map.tscn")
	if map_scene:
		var map := map_scene.instantiate()
		get_tree().current_scene.add_child(map)


func _restart() -> void:
	_paused = false
	get_tree().paused = false
	panel.visible = false
	overlay.visible = false
	GameManager.restart_level()


func _quit() -> void:
	_paused = false
	get_tree().paused = false
	panel.visible = false
	overlay.visible = false
	GameManager.go_to_main_menu()
