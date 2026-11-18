extends Area2D
## Hurtbox that receives damage from HitArea2D.
## Attach to any entity that can take damage. The owner must have take_damage().

func _ready() -> void:
	area_entered.connect(_on_area_entered)


func _on_area_entered(hit_area: Area2D) -> void:
	if not hit_area.has_method("get_damage"):
		return
	var dmg: int = hit_area.get_damage()
	var kb: Vector2 = Vector2.ZERO
	if hit_area.has_method("get_knockback"):
		kb = hit_area.get_knockback(global_position)
	if owner and owner.has_method("take_hit"):
		owner.take_hit(dmg, kb, hit_area)
