extends Area2D
## Collectible gem. 3 hidden per level, tracked by SaveManager.

@export var gem_id: int = 0  ## 0, 1, or 2 per level.
@export var gem_color: Color = Color(0.3, 0.9, 1.0)

@onready var visuals: Node2D = $Visuals

var _bob_time: float = 0.0
var _collected: bool = false


func _ready() -> void:
	_bob_time = randf() * TAU
	body_entered.connect(_on_body_entered)
	# Check if already collected this session
	var level_idx: int = GameManager.current_level_index
	if SaveManager.gems.size() > level_idx and SaveManager.gems[level_idx].size() > gem_id:
		if SaveManager.gems[level_idx][gem_id]:
			queue_free()  # Already collected in a previous run


func _process(delta: float) -> void:
	if _collected:
		return
	_bob_time += delta * 3.0
	visuals.position.y = sin(_bob_time) * 5.0
	visuals.rotation = sin(_bob_time * 0.5) * 0.15


func _on_body_entered(body: Node2D) -> void:
	if _collected:
		return
	if not body.is_in_group("player"):
		return
	_collected = true
	var level_idx: int = GameManager.current_level_index
	EventBus.gem_collected.emit(level_idx, gem_id)
	SaveManager.mark_gem_collected(level_idx, gem_id)
	# Collect animation: sparkle and grow
	var tween: Tween = create_tween()
	tween.tween_property(visuals, "scale", Vector2(2.0, 2.0), 0.15).set_ease(Tween.EASE_OUT)
	tween.parallel().tween_property(visuals, "modulate:a", 0.0, 0.2)
	tween.tween_callback(queue_free)
	set_deferred("monitoring", false)
	EventBus.screen_shake_requested.emit(3.0, 0.08)
