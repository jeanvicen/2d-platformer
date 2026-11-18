extends Area2D
## Hitbox that deals damage to HurtArea2D on contact.

@export var damage: int = 1
@export var knockback_force: float = 200.0

var source: Node2D  ## Who owns this hitbox (player or enemy).


func get_damage() -> int:
	return damage


func get_knockback(target_pos: Vector2) -> Vector2:
	if not source:
		return Vector2.ZERO
	var dir: Vector2 = (target_pos - source.global_position).normalized()
	return dir * knockback_force
