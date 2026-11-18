extends Area2D
## Triggers level completion when the player enters.

@export var next_level_delay: float = 1.0

var _triggered: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node2D) -> void:
	if _triggered:
		return
	if not body.is_in_group("player"):
		return
	_triggered = true
	EventBus.level_completed.emit()
	# Call load_next_level on GameManager after delay.
	# Use call_deferred via timer to avoid issues with node lifecycle.
	get_tree().create_timer(next_level_delay).timeout.connect(GameManager.load_next_level)
