extends StaticBody2D
## One-way platform the player can drop through by pressing down + jump.

@export var drop_through_time: float = 0.25

var _original_layer: int


func _ready() -> void:
	_original_layer = collision_layer


func drop_through() -> void:
	collision_layer = 0
	await get_tree().create_timer(drop_through_time).timeout
	collision_layer = _original_layer
