extends "res://scripts/enemies/base_enemy.gd"
## Flying enemy that moves in a sine-wave pattern.

@export var speed: float = 60.0
@export var wave_amplitude: float = 40.0
@export var wave_frequency: float = 2.0
@export var direction: float = 1.0

@onready var player_detector: Area2D = $PlayerDetector

var _start_y: float
var _time: float = 0.0


func _setup() -> void:
	_start_y = global_position.y
	_time = randf() * TAU
	if player_detector:
		player_detector.body_entered.connect(_on_player_contact)


func _ai_process(delta: float) -> void:
	_time += delta * wave_frequency
	velocity.x = direction * speed + _knockback_velocity.x
	global_position.y = _start_y + sin(_time) * wave_amplitude
	move_and_slide()
	visuals.scale.x = direction
	# Wing flap
	visuals.scale.y = 0.9 + sin(_time * 4.0) * 0.1


func _on_player_contact(body: Node2D) -> void:
	if _is_dead:
		return
	if body.has_method("take_damage"):
		body.take_damage(global_position)
