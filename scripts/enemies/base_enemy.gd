extends CharacterBody2D
## Base class for all enemies. Handles HP, damage, knockback, death.
## Extend this and override _ai_process() for custom behavior.

@export_group("Stats")
@export var max_hp: int = 3
@export var contact_damage: int = 1
@export var gravity: float = 980.0
@export var knockback_resistance: float = 0.0

@export_group("Drops")
@export var coin_drop_min: int = 1
@export var coin_drop_max: int = 3
@export var drop_color: Color = Color(1, 0.85, 0.2)

@export_group("Feel")
@export var flash_duration: float = 0.08
@export var death_particles_color: Color = Color(0.9, 0.3, 0.2)

var hp: int
var _is_dead: bool = false
var _knockback_velocity: Vector2 = Vector2.ZERO

@onready var visuals: Node2D = $Visuals


func _ready() -> void:
	hp = max_hp
	add_to_group("enemies")
	_setup()


func _physics_process(delta: float) -> void:
	if _is_dead:
		return
	_knockback_velocity = _knockback_velocity.lerp(Vector2.ZERO, 8.0 * delta)
	_ai_process(delta)


## Override this in subclasses for enemy-specific AI.
func _ai_process(_delta: float) -> void:
	pass


## Override for subclass-specific setup.
func _setup() -> void:
	pass


## Called when hit by the player's sword or stomp.
func take_hit(damage: int, knockback: Vector2, _source: Area2D) -> void:
	if _is_dead:
		return
	hp -= damage
	_knockback_velocity = knockback * (1.0 - knockback_resistance)
	velocity += _knockback_velocity
	_flash_white()
	EventBus.enemy_damaged.emit(self, damage, global_position)

	if hp <= 0:
		_die()


## Stomp compatibility (called from player's stomp detector).
func stomp() -> void:
	take_hit(2, Vector2(0, 100), null)


func _die() -> void:
	_is_dead = true
	velocity = Vector2.ZERO
	set_deferred("collision_layer", 0)
	set_deferred("collision_mask", 0)
	# Disable any child areas
	for child in get_children():
		if child is Area2D:
			child.set_deferred("monitoring", false)
			child.set_deferred("monitorable", false)

	_spawn_death_particles()
	_spawn_coin_drops()
	EventBus.enemy_killed.emit(global_position)

	# Death animation
	var tween := create_tween()
	tween.tween_property(visuals, "scale", Vector2(1.2, 0.1), 0.12).set_ease(Tween.EASE_OUT)
	tween.tween_property(visuals, "modulate:a", 0.0, 0.15)
	tween.tween_callback(queue_free)


func _flash_white() -> void:
	visuals.modulate = Color.WHITE * 3.0  # Bright flash
	await get_tree().create_timer(flash_duration).timeout
	if is_instance_valid(self) and not _is_dead:
		visuals.modulate = Color.WHITE


func _spawn_death_particles() -> void:
	var particles := CPUParticles2D.new()
	particles.emitting = true
	particles.one_shot = true
	particles.explosiveness = 1.0
	particles.amount = 12
	particles.lifetime = 0.4
	particles.direction = Vector2(0, -1)
	particles.spread = 60.0
	particles.initial_velocity_min = 100.0
	particles.initial_velocity_max = 200.0
	particles.gravity = Vector2(0, 400)
	particles.scale_amount_min = 3.0
	particles.scale_amount_max = 6.0
	particles.color = death_particles_color
	particles.global_position = global_position
	var scene := get_tree().current_scene
	if scene:
		scene.add_child(particles)
		get_tree().create_timer(1.0).timeout.connect(particles.queue_free)


func _spawn_coin_drops() -> void:
	var count: int = randi_range(coin_drop_min, coin_drop_max)
	for i in range(count):
		EventBus.coin_collected.emit(
			global_position + Vector2(randf_range(-20, 20), -10),
			GameManager.coins + 1
		)
