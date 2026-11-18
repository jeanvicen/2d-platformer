extends "res://scripts/enemies/base_enemy.gd"
## Patrol enemy that walks back and forth. Turns at edges and walls.

@export var speed: float = 80.0
@export var edge_detection: bool = true

@onready var floor_check_left: RayCast2D = $FloorCheckLeft
@onready var floor_check_right: RayCast2D = $FloorCheckRight
@onready var wall_check: RayCast2D = $WallCheck
@onready var player_detector: Area2D = $PlayerDetector

var _direction: float = 1.0


func _setup() -> void:
	if player_detector:
		player_detector.body_entered.connect(_on_player_contact)


func _ai_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y += gravity * delta

	velocity.x = _direction * speed + _knockback_velocity.x

	if is_on_wall():
		_flip_direction()

	if edge_detection and is_on_floor():
		if _direction > 0.0 and floor_check_right and not floor_check_right.is_colliding():
			_flip_direction()
		elif _direction < 0.0 and floor_check_left and not floor_check_left.is_colliding():
			_flip_direction()

	move_and_slide()
	visuals.scale.x = _direction


func _flip_direction() -> void:
	_direction *= -1.0
	if wall_check:
		wall_check.target_position.x *= -1.0


func _on_player_contact(body: Node2D) -> void:
	if _is_dead:
		return
	if body.has_method("take_damage"):
		body.take_damage(global_position)
