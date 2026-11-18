extends Area2D
## Kills the player on contact. Use for spikes, pits, and hazards.

func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node2D) -> void:
	if body.has_method("die"):
		body.die()
