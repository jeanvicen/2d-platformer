extends StaticBody2D
## Blocks passage until the player has the required ability.
## Disappears (crumbles) when the ability is unlocked.

@export var required_ability: String = "dash"
@export var gate_color: Color = Color(0.4, 0.3, 0.5, 0.8)

@onready var visual: Polygon2D = $Visual


func _ready() -> void:
	if AbilityManager.has_ability(required_ability):
		_open()
		return
	AbilityManager.ability_unlocked.connect(_on_ability_unlocked)
	visual.color = gate_color


func _on_ability_unlocked(ability_name: String) -> void:
	if ability_name == required_ability:
		_open()


func _open() -> void:
	# Crumble animation
	var tween := create_tween()
	tween.tween_property(visual, "modulate:a", 0.0, 0.3)
	tween.parallel().tween_property(visual, "position:y", visual.position.y + 20, 0.3)
	tween.tween_callback(queue_free)
	# Disable collision immediately
	set_deferred("collision_layer", 0)
