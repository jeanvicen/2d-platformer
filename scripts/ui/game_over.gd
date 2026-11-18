extends CanvasLayer
## Game over screen. Shown when lives reach 0.

@onready var panel: Control = $PanelContainer
@onready var retry_button: Button = $PanelContainer/VBoxContainer/RetryButton
@onready var quit_button: Button = $PanelContainer/VBoxContainer/QuitButton


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	panel.visible = false
	retry_button.pressed.connect(_on_retry)
	quit_button.pressed.connect(_on_quit)
	EventBus.game_over.connect(_show)


func _show() -> void:
	panel.visible = true
	get_tree().paused = true
	retry_button.grab_focus()


func _on_retry() -> void:
	panel.visible = false
	get_tree().paused = false
	GameManager.reset()
	GameManager.restart_level()


func _on_quit() -> void:
	panel.visible = false
	get_tree().paused = false
	GameManager.go_to_main_menu()
