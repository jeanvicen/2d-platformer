class_name PlayerController
extends CharacterBody2D
## 2D platformer player controller with tight, responsive feel.
##
## Features: coyote time, jump buffering, variable jump height, asymmetric gravity,
## squash/stretch, stomp-to-kill, wall slide, wall jump, dash.

# -- Movement --
@export_group("Movement")
@export var max_speed: float = 280.0
@export var acceleration: float = 1800.0
@export var friction: float = 2400.0
@export var air_acceleration: float = 1400.0
@export var air_friction: float = 300.0
@export var turn_boost: float = 1.6  ## Extra accel when reversing direction.

# -- Jumping --
@export_group("Jumping")
@export var jump_velocity: float = -440.0
@export var jump_cut_multiplier: float = 0.4
@export var gravity_up: float = 1100.0
@export var gravity_down: float = 1400.0
@export var max_fall_speed: float = 700.0
@export var coyote_time: float = 0.08
@export var jump_buffer_time: float = 0.1
@export var stomp_bounce_velocity: float = -340.0
@export var double_jump_velocity: float = -380.0  ## Slightly weaker than first jump.
@export var max_air_jumps: int = 1  ## Number of extra jumps in the air.

# -- Wall Slide --
@export_group("Wall Slide")
@export var wall_slide_speed: float = 80.0
@export var wall_jump_velocity: Vector2 = Vector2(320.0, -400.0)
@export var wall_jump_lock_time: float = 0.15  ## Brief input lock after wall jump.

# -- Dash --
@export_group("Dash")
@export var dash_speed: float = 480.0
@export var dash_duration: float = 0.12
@export var dash_cooldown: float = 0.35

# -- Feel --
@export_group("Feel")
@export var landing_squash: Vector2 = Vector2(1.3, 0.7)
@export var jump_stretch: Vector2 = Vector2(0.8, 1.2)
@export var squash_lerp_speed: float = 14.0
@export var invincibility_duration: float = 1.2
@export var knockback_force: float = 300.0
@export var hurt_jump_force: float = -250.0

# -- Node References --
@onready var visuals: Node2D = $Visuals
@onready var collision_shape: CollisionShape2D = $CollisionShape2D
@onready var stomp_detector: Area2D = $StompDetector
@onready var landing_particles: CPUParticles2D = $LandingParticles
@onready var jump_particles: CPUParticles2D = $JumpParticles

# -- State --
var _coyote_timer: float = 0.0
var _jump_buffer_timer: float = 0.0
var _was_on_floor: bool = false
var _visual_scale: Vector2 = Vector2.ONE
var _is_invincible: bool = false
var _invincibility_timer: float = 0.0
var _is_dead: bool = false
var _spawn_position: Vector2
var _facing_right: bool = true
var _run_time: float = 0.0  # For run animation

# Double jump state
var _air_jumps_left: int = 0

# Wall slide state
var _is_wall_sliding: bool = false
var _wall_direction: int = 0  # -1 = left wall, 1 = right wall
var _wall_jump_lock_timer: float = 0.0

# Dash state
var _is_dashing: bool = false
var _dash_timer: float = 0.0
var _dash_cooldown_timer: float = 0.0
var _dash_direction: Vector2 = Vector2.ZERO
var _has_air_dash: bool = true


func set_spawn_position(pos: Vector2) -> void:
	_spawn_position = pos


func _ready() -> void:
	add_to_group("player")
	_spawn_position = global_position
	stomp_detector.body_entered.connect(_on_stomp_body_entered)


func _physics_process(delta: float) -> void:
	if _is_dead:
		return

	var input_x: float = Input.get_axis("move_left", "move_right")

	# Dash overrides everything
	if _is_dashing:
		_update_dash(delta)
		move_and_slide()
		_update_invincibility(delta)
		return

	_update_dash_cooldown(delta)
	_try_dash(input_x)
	if _is_dashing:
		return  # Dash just started, skip normal movement this frame

	_update_wall_jump_lock(delta)
	_apply_horizontal_movement(input_x, delta)
	_apply_gravity(delta)
	_update_wall_slide(input_x)
	_update_coyote_time(delta)
	_update_jump_buffer(delta)
	_try_jump(input_x)
	_handle_jump_cut()
	_detect_landing()
	_update_squash_stretch(delta)
	_update_facing(input_x)
	_update_invincibility(delta)

	move_and_slide()


# -- Horizontal Movement --

func _apply_horizontal_movement(input_x: float, delta: float) -> void:
	if _wall_jump_lock_timer > 0.0:
		return  # Locked out briefly after wall jump
	if input_x != 0.0:
		var accel: float = acceleration if is_on_floor() else air_acceleration
		if sign(input_x) != sign(velocity.x) and absf(velocity.x) > 10.0:
			accel *= turn_boost
		velocity.x = move_toward(velocity.x, input_x * max_speed, accel * delta)
	else:
		var fric: float = friction if is_on_floor() else air_friction
		velocity.x = move_toward(velocity.x, 0.0, fric * delta)


# -- Gravity --

func _apply_gravity(delta: float) -> void:
	if is_on_floor():
		return
	if _is_wall_sliding:
		velocity.y = minf(velocity.y + gravity_down * 0.2 * delta, wall_slide_speed)
		return
	var grav: float = gravity_up if velocity.y < 0.0 else gravity_down
	velocity.y = minf(velocity.y + grav * delta, max_fall_speed)


# -- Wall Slide --

func _update_wall_slide(input_x: float) -> void:
	_is_wall_sliding = false
	_wall_direction = 0
	if not AbilityManager.has_ability("wall_climb"):
		return
	if is_on_floor() or velocity.y < 0.0:
		return
	if not is_on_wall_only():
		return
	# Check player is pushing toward wall
	var wall_normal: Vector2 = get_wall_normal()
	if input_x == 0.0:
		return
	if sign(input_x) == sign(wall_normal.x):
		return  # Pushing away from wall
	_is_wall_sliding = true
	_wall_direction = -int(sign(wall_normal.x))
	_coyote_timer = coyote_time
	_air_jumps_left = max_air_jumps  # Refresh air jumps on wall contact
	_has_air_dash = true


func _update_wall_jump_lock(delta: float) -> void:
	_wall_jump_lock_timer = maxf(_wall_jump_lock_timer - delta, 0.0)


# -- Jump --

func _update_coyote_time(delta: float) -> void:
	if is_on_floor():
		_coyote_timer = coyote_time
	elif not _is_wall_sliding:
		_coyote_timer = maxf(_coyote_timer - delta, 0.0)


func _update_jump_buffer(delta: float) -> void:
	if Input.is_action_just_pressed("jump"):
		_jump_buffer_timer = jump_buffer_time
	else:
		_jump_buffer_timer = maxf(_jump_buffer_timer - delta, 0.0)


func _try_jump(input_x: float) -> void:
	# Drop through one-way platform
	if Input.is_action_pressed("move_down") and Input.is_action_just_pressed("jump"):
		if is_on_floor():
			# Check if standing on a one-way platform
			var col := get_last_slide_collision()
			if col and col.get_collider().has_method("drop_through"):
				col.get_collider().drop_through()
				_jump_buffer_timer = 0.0
				return

	if _jump_buffer_timer <= 0.0:
		return

	if _is_wall_sliding and _coyote_timer > 0.0:
		# Wall jump
		var wall_normal: Vector2 = get_wall_normal()
		velocity.x = wall_normal.x * wall_jump_velocity.x
		velocity.y = wall_jump_velocity.y
		_coyote_timer = 0.0
		_jump_buffer_timer = 0.0
		_wall_jump_lock_timer = wall_jump_lock_time
		_is_wall_sliding = false
		_visual_scale = jump_stretch
		_emit_jump_particles()
		EventBus.player_wall_jumped.emit()
		return

	if _coyote_timer > 0.0:
		# Normal jump (grounded or coyote)
		velocity.y = jump_velocity
		_coyote_timer = 0.0
		_jump_buffer_timer = 0.0
		_visual_scale = jump_stretch
		_emit_jump_particles()
		EventBus.player_jumped.emit()
		return

	# Double jump (air jump)
	if _air_jumps_left > 0:
		velocity.y = double_jump_velocity
		_air_jumps_left -= 1
		_jump_buffer_timer = 0.0
		_visual_scale = jump_stretch
		_emit_jump_particles()
		EventBus.player_jumped.emit()


func _handle_jump_cut() -> void:
	if Input.is_action_just_released("jump") and velocity.y < 0.0:
		velocity.y *= jump_cut_multiplier


# -- Dash --

func _try_dash(input_x: float) -> void:
	if not AbilityManager.has_ability("dash"):
		return
	if not Input.is_action_just_pressed("dash"):
		return
	if _dash_cooldown_timer > 0.0:
		return
	if not is_on_floor() and not _has_air_dash:
		return

	# Determine direction (8-directional from input, or facing)
	var input_y: float = Input.get_axis("jump", "move_down")  # Up = negative
	var dir := Vector2(input_x, input_y)
	if dir.length() < 0.1:
		dir = Vector2(1.0 if _facing_right else -1.0, 0.0)
	else:
		dir = dir.normalized()

	_dash_direction = dir
	_is_dashing = true
	_dash_timer = dash_duration
	_dash_cooldown_timer = dash_cooldown
	if not is_on_floor():
		_has_air_dash = false
	velocity = _dash_direction * dash_speed
	_visual_scale = Vector2(0.7, 1.3) if absf(dir.x) > absf(dir.y) else Vector2(1.3, 0.7)
	EventBus.player_dashed.emit()
	EventBus.hitstop_requested.emit(0.02)


func _update_dash(delta: float) -> void:
	_dash_timer -= delta
	velocity = _dash_direction * dash_speed  # Maintain direction
	if _dash_timer <= 0.0:
		_is_dashing = false
		# Kill excess velocity on non-horizontal dashes
		if absf(_dash_direction.y) > 0.3:
			velocity.y *= 0.3
		if absf(_dash_direction.x) < 0.1:
			velocity.x *= 0.3


func _update_dash_cooldown(delta: float) -> void:
	_dash_cooldown_timer = maxf(_dash_cooldown_timer - delta, 0.0)


# -- Landing --

func _detect_landing() -> void:
	var on_floor_now: bool = is_on_floor()
	if not _was_on_floor and on_floor_now and velocity.y >= 0.0:
		_on_landed()
	_was_on_floor = on_floor_now


func _on_landed() -> void:
	_visual_scale = landing_squash
	_has_air_dash = true
	_air_jumps_left = max_air_jumps
	_emit_landing_particles()
	EventBus.player_landed.emit(velocity.y)


# -- Visual --

func _update_squash_stretch(delta: float) -> void:
	_visual_scale = _visual_scale.lerp(Vector2.ONE, squash_lerp_speed * delta)
	visuals.scale = _visual_scale

	# Run animation: bob + lean when moving on ground
	var speed_ratio: float = absf(velocity.x) / max_speed
	if is_on_floor() and speed_ratio > 0.2:
		_run_time += delta * 14.0 * speed_ratio
		visuals.position.y = sin(_run_time) * 2.5 * speed_ratio
		visuals.rotation = sin(_run_time * 0.5) * 0.06 * speed_ratio
	else:
		_run_time = 0.0
		visuals.position.y = lerpf(visuals.position.y, 0.0, 12.0 * delta)
		visuals.rotation = lerpf(visuals.rotation, 0.0, 12.0 * delta)


func _update_facing(input_x: float) -> void:
	if _wall_jump_lock_timer > 0.0:
		return
	if input_x > 0.1:
		_facing_right = true
		visuals.scale.x = absf(visuals.scale.x)
	elif input_x < -0.1:
		_facing_right = false
		visuals.scale.x = -absf(visuals.scale.x)


func _update_invincibility(delta: float) -> void:
	if not _is_invincible:
		return
	_invincibility_timer -= delta
	visuals.visible = fmod(_invincibility_timer, 0.15) > 0.075
	if _invincibility_timer <= 0.0:
		_is_invincible = false
		visuals.visible = true


# -- Particles --

func _emit_landing_particles() -> void:
	if landing_particles:
		landing_particles.restart()
		landing_particles.emitting = true


func _emit_jump_particles() -> void:
	if jump_particles:
		jump_particles.restart()
		jump_particles.emitting = true


# -- Combat --

func _on_stomp_body_entered(body: Node2D) -> void:
	if _is_dead:
		return
	if body.has_method("stomp") and velocity.y > 0.0:
		body.stomp()
		velocity.y = stomp_bounce_velocity
		_visual_scale = jump_stretch
		_has_air_dash = true  # Refresh dash on stomp too
		EventBus.enemy_stomped.emit(body.global_position)
		EventBus.screen_shake_requested.emit(4.0, 0.1)
		EventBus.hitstop_requested.emit(0.04)


## Called by enemies/hazards. Also used by HurtArea2D.
func take_damage(source_position: Vector2) -> void:
	if _is_invincible or _is_dead:
		return
	if _is_dashing:
		return  # Invincible during dash
	_is_invincible = true
	_invincibility_timer = invincibility_duration
	_is_dashing = false
	var dir: float = sign(global_position.x - source_position.x)
	if dir == 0.0:
		dir = 1.0
	velocity.x = dir * knockback_force
	velocity.y = hurt_jump_force
	GameManager.take_damage(1)
	EventBus.screen_shake_requested.emit(6.0, 0.15)
	EventBus.player_hit.emit(source_position)


## Called by combat HurtArea2D system.
func take_hit(damage: int, knockback: Vector2, _source: Area2D) -> void:
	if _is_invincible or _is_dead:
		return
	if _is_dashing:
		return
	_is_invincible = true
	_invincibility_timer = invincibility_duration
	velocity += knockback
	velocity.y = hurt_jump_force
	GameManager.take_damage(damage)
	EventBus.screen_shake_requested.emit(6.0, 0.15)
	EventBus.player_hit.emit(global_position)


func die() -> void:
	if _is_dead:
		return
	_is_dead = true
	_is_dashing = false
	velocity = Vector2.ZERO
	visible = false
	EventBus.screen_shake_requested.emit(8.0, 0.2)
	await get_tree().create_timer(1.0).timeout
	GameManager.respawn_at_bench()


func respawn() -> void:
	_is_dead = false
	visible = true
	global_position = _spawn_position
	velocity = Vector2.ZERO
	_is_invincible = true
	_invincibility_timer = invincibility_duration
	_is_dashing = false
	_has_air_dash = true
	_air_jumps_left = max_air_jumps
	EventBus.player_respawned.emit()
