extends CharacterBody2D
## Crystal Queen boss. State machine with two phases.
## Phase 1 (>50% HP): alternates CHARGE and SLAM.
## Phase 2 (<=50% HP): faster attacks.

enum State { IDLE, TELEGRAPH, CHARGE, SLAM, RECOVER, DYING }

@export_group("Stats")
@export var max_hp: int = 20
@export var contact_damage: int = 2
@export var gravity: float = 980.0

@export_group("Charge Attack")
@export var charge_speed: float = 500.0
@export var charge_duration: float = 0.4

@export_group("Slam Attack")
@export var slam_jump_height: float = -400.0
@export var slam_damage_radius: float = 120.0

@export_group("Timing")
@export var telegraph_duration: float = 0.5
@export var recover_duration: float = 1.5
@export var phase2_speed_mult: float = 1.5

var hp: int
var _state: State = State.IDLE
var _is_dead: bool = false
var _player: Node2D = null
var _charge_direction: float = 1.0
var _charge_timer: float = 0.0
var _recover_timer: float = 0.0
var _telegraph_timer: float = 0.0
var _next_attack: State = State.CHARGE
var _attacks_done: int = 0
var _arena_left: float = 0.0
var _arena_right: float = 1200.0
var _slam_target_x: float = 0.0
var _has_landed_slam: bool = false

@onready var visuals: Node2D = $Visuals
@onready var health_bar_fill: ColorRect = $HealthBarLayer/HealthBarBg/HealthBarFill


func _ready() -> void:
	hp = max_hp
	add_to_group("enemies")
	_update_health_bar()
	# Find player after a frame (spawned by RoomManager)
	await get_tree().process_frame
	await get_tree().process_frame
	var players := get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		_player = players[0]
	_state = State.IDLE


func _physics_process(delta: float) -> void:
	if _is_dead:
		return

	# Always apply gravity
	if not is_on_floor():
		velocity.y += gravity * delta

	match _state:
		State.IDLE:
			_process_idle(delta)
		State.TELEGRAPH:
			_process_telegraph(delta)
		State.CHARGE:
			_process_charge(delta)
		State.SLAM:
			_process_slam(delta)
		State.RECOVER:
			_process_recover(delta)

	move_and_slide()
	_check_player_contact()


func _process_idle(delta: float) -> void:
	velocity.x = 0.0
	# Start fighting once we have a player ref
	if _player and is_instance_valid(_player):
		_begin_telegraph()


func _process_telegraph(delta: float) -> void:
	velocity.x = 0.0
	_telegraph_timer -= delta
	# Flash white during telegraph
	var flash: float = sin(_telegraph_timer * 20.0)
	visuals.modulate = Color.WHITE * (2.0 if flash > 0.0 else 1.0)

	if _telegraph_timer <= 0.0:
		visuals.modulate = Color.WHITE
		_execute_attack()


func _process_charge(delta: float) -> void:
	var spd: float = charge_speed * _phase_speed_mult()
	velocity.x = _charge_direction * spd
	_charge_timer -= delta

	if _charge_timer <= 0.0 or is_on_wall():
		velocity.x = 0.0
		_enter_recover()


func _process_slam(delta: float) -> void:
	if not _has_landed_slam:
		# Move toward target X while in air
		var diff: float = _slam_target_x - global_position.x
		velocity.x = clampf(diff * 5.0, -300.0, 300.0)

		if is_on_floor() and velocity.y >= 0.0:
			_has_landed_slam = true
			velocity.x = 0.0
			_do_slam_impact()
			EventBus.screen_shake_requested.emit(8.0, 0.2)
			_enter_recover()


func _process_recover(delta: float) -> void:
	velocity.x = 0.0
	_recover_timer -= delta
	# Dim slightly to show vulnerability
	visuals.modulate = Color(0.8, 0.8, 1.0, 1.0)
	if _recover_timer <= 0.0:
		visuals.modulate = Color.WHITE
		_begin_telegraph()


func _begin_telegraph() -> void:
	_state = State.TELEGRAPH
	var dur: float = telegraph_duration / _phase_speed_mult()
	_telegraph_timer = dur
	EventBus.screen_shake_requested.emit(2.0, dur)


func _execute_attack() -> void:
	if _next_attack == State.CHARGE:
		_state = State.CHARGE
		if _player and is_instance_valid(_player):
			_charge_direction = sign(_player.global_position.x - global_position.x)
			if _charge_direction == 0.0:
				_charge_direction = 1.0
		_charge_timer = charge_duration / _phase_speed_mult()
		visuals.scale.x = _charge_direction
		_next_attack = State.SLAM
	else:
		_state = State.SLAM
		_has_landed_slam = false
		if _player and is_instance_valid(_player):
			_slam_target_x = _player.global_position.x
		else:
			_slam_target_x = global_position.x
		velocity.y = slam_jump_height
		_next_attack = State.CHARGE

	_attacks_done += 1


func _enter_recover() -> void:
	_state = State.RECOVER
	_recover_timer = recover_duration / _phase_speed_mult()


func _do_slam_impact() -> void:
	# Damage player if within radius
	if not _player or not is_instance_valid(_player):
		return
	var dist: float = global_position.distance_to(_player.global_position)
	if dist < slam_damage_radius:
		if _player.has_method("take_damage"):
			_player.take_damage(global_position)

	# Spawn impact particles
	var particles := CPUParticles2D.new()
	particles.emitting = true
	particles.one_shot = true
	particles.explosiveness = 1.0
	particles.amount = 16
	particles.lifetime = 0.5
	particles.direction = Vector2(0, -1)
	particles.spread = 80.0
	particles.initial_velocity_min = 80.0
	particles.initial_velocity_max = 160.0
	particles.gravity = Vector2(0, 300)
	particles.scale_amount_min = 3.0
	particles.scale_amount_max = 5.0
	particles.color = Color(0.6, 0.3, 0.7, 1.0)
	particles.global_position = global_position
	get_tree().current_scene.add_child(particles)
	get_tree().create_timer(1.0).timeout.connect(particles.queue_free)


func _check_player_contact() -> void:
	if not _player or not is_instance_valid(_player):
		return
	if _is_dead:
		return
	# Simple distance-based contact check
	var dist: float = global_position.distance_to(_player.global_position)
	if dist < 40.0:
		if _player.has_method("take_damage"):
			_player.take_damage(global_position)


func _phase_speed_mult() -> float:
	if hp <= max_hp / 2:
		return phase2_speed_mult
	return 1.0


## Called by player combat system.
func take_hit(damage: int, knockback: Vector2, _source: Area2D) -> void:
	if _is_dead:
		return
	hp -= damage
	velocity += knockback * 0.3  # Bosses resist knockback
	_flash_white()
	_update_health_bar()
	EventBus.enemy_damaged.emit(self, damage, global_position)

	if hp <= 0:
		_die()


## Stomp compatibility.
func stomp() -> void:
	take_hit(1, Vector2(0, 100), null)


func _flash_white() -> void:
	visuals.modulate = Color.WHITE * 3.0
	await get_tree().create_timer(0.08).timeout
	if is_instance_valid(self) and not _is_dead:
		if _state == State.RECOVER:
			visuals.modulate = Color(0.8, 0.8, 1.0, 1.0)
		else:
			visuals.modulate = Color.WHITE


func _update_health_bar() -> void:
	if health_bar_fill:
		var ratio: float = clampf(float(hp) / float(max_hp), 0.0, 1.0)
		health_bar_fill.size.x = 200.0 * ratio


func _die() -> void:
	_is_dead = true
	_state = State.DYING
	velocity = Vector2.ZERO
	set_deferred("collision_layer", 0)
	set_deferred("collision_mask", 0)

	EventBus.enemy_killed.emit(global_position)
	EventBus.screen_shake_requested.emit(10.0, 0.4)

	# Death particles
	_spawn_death_particles()

	# Death animation
	var tween := create_tween()
	tween.tween_property(visuals, "modulate", Color(1.0, 1.0, 1.0, 0.0), 0.8)
	tween.parallel().tween_property(visuals, "scale", Vector2(0.1, 2.0), 0.8)
	tween.tween_callback(queue_free)


func _spawn_death_particles() -> void:
	for i in range(3):
		var particles := CPUParticles2D.new()
		particles.emitting = true
		particles.one_shot = true
		particles.explosiveness = 0.8
		particles.amount = 20
		particles.lifetime = 0.6
		particles.direction = Vector2(0, -1)
		particles.spread = 90.0
		particles.initial_velocity_min = 100.0
		particles.initial_velocity_max = 250.0
		particles.gravity = Vector2(0, 400)
		particles.scale_amount_min = 3.0
		particles.scale_amount_max = 8.0
		particles.color = Color(0.7, 0.3, 0.9, 1.0)
		particles.global_position = global_position + Vector2(randf_range(-20, 20), randf_range(-20, 10))
		get_tree().current_scene.add_child(particles)
		get_tree().create_timer(1.5).timeout.connect(particles.queue_free)
