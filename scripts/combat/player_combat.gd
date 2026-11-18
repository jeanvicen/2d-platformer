extends Node2D
## Handles player melee combat: sword swings, combos, directional attacks.

@export var combo_window: float = 0.4
@export var attack_cooldown: float = 0.15
@export var sword_damage: int = 1
@export var sword_knockback: float = 250.0
@export var down_bounce_velocity: float = -380.0

var _combo_count: int = 0
var _combo_timer: float = 0.0
var _cooldown_timer: float = 0.0
var _is_attacking: bool = false

@onready var hit_area: Area2D = $SwordHitArea
@onready var sword_visual: Node2D = $SwordVisual
@onready var _player: CharacterBody2D = get_parent()


func _ready() -> void:
	hit_area.set_deferred("monitoring", false)
	# Use body_entered to detect enemy CharacterBody2D directly
	hit_area.body_entered.connect(_on_sword_hit_body)
	sword_visual.visible = false


func _process(delta: float) -> void:
	_cooldown_timer = maxf(_cooldown_timer - delta, 0.0)
	_combo_timer = maxf(_combo_timer - delta, 0.0)
	if _combo_timer <= 0.0:
		_combo_count = 0

	if Input.is_action_just_pressed("attack") and _cooldown_timer <= 0.0:
		_swing()


func _swing() -> void:
	_is_attacking = true
	_cooldown_timer = attack_cooldown
	_combo_count = (_combo_count % 3) + 1
	_combo_timer = combo_window

	var dir := _get_attack_direction()

	# Position and rotate sword visual
	sword_visual.visible = true
	sword_visual.rotation = dir.angle()
	sword_visual.position = dir * 20

	# Position hitbox
	hit_area.position = dir * 24
	hit_area.set_deferred("monitoring", true)

	EventBus.player_attacked.emit(dir)
	EventBus.screen_shake_requested.emit(1.5, 0.05)

	# Disable after brief active window
	await get_tree().create_timer(0.12).timeout
	hit_area.set_deferred("monitoring", false)

	await get_tree().create_timer(0.06).timeout
	sword_visual.visible = false
	_is_attacking = false


func _get_attack_direction() -> Vector2:
	if Input.is_action_pressed("jump") and not _player.is_on_floor():
		return Vector2.UP
	if Input.is_action_pressed("move_down") and not _player.is_on_floor():
		return Vector2.DOWN
	var facing_right: bool = _player._facing_right if "_facing_right" in _player else true
	return Vector2.RIGHT if facing_right else Vector2.LEFT


func _on_sword_hit_body(body: Node2D) -> void:
	if body == _player:
		return
	if not body.has_method("take_hit"):
		return
	var dmg: int = sword_damage
	var kb := _get_attack_direction() * sword_knockback
	body.take_hit(dmg, kb, hit_area)
	EventBus.player_attack_hit.emit(body, dmg)
	EventBus.screen_shake_requested.emit(3.0, 0.08)
	EventBus.hitstop_requested.emit(0.04)

	# Down-attack bounce
	if _get_attack_direction() == Vector2.DOWN:
		_player.velocity.y = down_bounce_velocity
