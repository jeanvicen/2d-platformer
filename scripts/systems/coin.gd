class_name Coin
extends Area2D
## Collectible coin with bob animation and collect juice.

@export var bob_speed: float = 2.0
@export var bob_height: float = 4.0
@export var collect_score: int = 100

@onready var visuals: Node2D = $Visuals

var _base_y: float
var _time: float = 0.0
var _collected: bool = false


func _ready() -> void:
	_base_y = position.y
	_time = randf() * TAU  # Randomize phase so coins don't bob in sync.
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	if _collected:
		return
	_time += delta * bob_speed
	visuals.position.y = sin(_time) * bob_height


func _on_body_entered(body: Node2D) -> void:
	if _collected:
		return
	if body.is_in_group("player"):
		_collected = true
		EventBus.coin_collected.emit(global_position, GameManager.coins + 1)
		# Collect animation: scale pop then shrink
		var tween: Tween = create_tween()
		tween.tween_property(visuals, "scale", Vector2(1.5, 1.5), 0.08).set_ease(Tween.EASE_OUT)
		tween.tween_property(visuals, "scale", Vector2.ZERO, 0.12).set_ease(Tween.EASE_IN)
		tween.tween_callback(queue_free)
		# Disable further collection
		set_deferred("monitoring", false)
