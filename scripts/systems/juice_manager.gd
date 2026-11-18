extends Node
## Spawns floating text and other juice effects in response to game events.

const FloatingTextScene := preload("res://scripts/systems/floating_text.gd")


func _ready() -> void:
	EventBus.coin_collected.connect(_on_coin_collected)
	EventBus.enemy_killed.connect(_on_enemy_killed)
	EventBus.enemy_stomped.connect(_on_enemy_stomped)
	EventBus.level_completed.connect(_on_level_completed)
	EventBus.player_dashed.connect(_on_player_dashed)
	EventBus.gem_collected.connect(_on_gem_collected)


func _spawn_text(pos: Vector2, text: String, color: Color) -> void:
	var ft := Node2D.new()
	ft.set_script(FloatingTextScene)
	ft.global_position = pos
	_add_to_scene(ft)
	ft.setup(text, color)


func _on_coin_collected(pos: Vector2, _total: int) -> void:
	_spawn_text(pos + Vector2(0, -16), "+100", Color(1.0, 0.9, 0.2))


func _on_enemy_killed(pos: Vector2) -> void:
	_spawn_text(pos + Vector2(0, -24), "+500", Color(0.9, 0.4, 0.3))


func _on_enemy_stomped(pos: Vector2) -> void:
	var particles := CPUParticles2D.new()
	particles.emitting = true
	particles.one_shot = true
	particles.explosiveness = 1.0
	particles.amount = 16
	particles.lifetime = 0.35
	particles.direction = Vector2(0, -1)
	particles.spread = 80.0
	particles.initial_velocity_min = 80.0
	particles.initial_velocity_max = 180.0
	particles.gravity = Vector2(0, 500)
	particles.scale_amount_min = 2.0
	particles.scale_amount_max = 5.0
	particles.color = Color(1.0, 0.95, 0.6, 0.9)
	particles.global_position = pos
	_add_to_scene(particles)
	get_tree().create_timer(1.0).timeout.connect(particles.queue_free)


func _on_level_completed() -> void:
	var cam: Camera2D = get_viewport().get_camera_2d()
	if not cam:
		return
	var colors: Array[Color] = [Color(1, 0.85, 0.2), Color(0.2, 0.8, 0.3), Color(0.3, 0.6, 1.0)]
	for i in range(3):
		var particles := CPUParticles2D.new()
		particles.emitting = true
		particles.one_shot = true
		particles.explosiveness = 0.8
		particles.amount = 20
		particles.lifetime = 0.8
		particles.direction = Vector2(0, -1)
		particles.spread = 120.0
		particles.initial_velocity_min = 100.0
		particles.initial_velocity_max = 250.0
		particles.gravity = Vector2(0, 300)
		particles.scale_amount_min = 3.0
		particles.scale_amount_max = 7.0
		particles.color = colors[i]
		particles.global_position = cam.global_position + Vector2(randf_range(-100, 100), randf_range(-50, 50))
		_add_to_scene(particles)
		get_tree().create_timer(1.5).timeout.connect(particles.queue_free)


func _on_player_dashed() -> void:
	# Spawn afterimage ghosts
	var player: Node2D = get_tree().get_first_node_in_group("player")
	if not player:
		return
	for i in range(3):
		var ghost := Polygon2D.new()
		ghost.polygon = PackedVector2Array([-10, -28, 10, -28, 10, 0, -10, 0])
		ghost.color = Color(0.4, 0.7, 1.0, 0.4)
		ghost.global_position = player.global_position
		ghost.scale = player.get_node("Visuals").scale
		_add_to_scene(ghost)
		var tween := ghost.create_tween()
		tween.tween_property(ghost, "modulate:a", 0.0, 0.2 + i * 0.05).set_delay(i * 0.03)
		tween.tween_callback(ghost.queue_free)


func _on_gem_collected(_level_index: int, _gem_id: int) -> void:
	var player: Node2D = get_tree().get_first_node_in_group("player")
	if not player:
		return
	_spawn_text(player.global_position + Vector2(0, -32), "GEM!", Color(0.3, 0.95, 1.0))
	# Sparkle particles
	var particles := CPUParticles2D.new()
	particles.emitting = true
	particles.one_shot = true
	particles.explosiveness = 1.0
	particles.amount = 20
	particles.lifetime = 0.5
	particles.direction = Vector2(0, -1)
	particles.spread = 180.0
	particles.initial_velocity_min = 60.0
	particles.initial_velocity_max = 150.0
	particles.gravity = Vector2(0, 100)
	particles.scale_amount_min = 2.0
	particles.scale_amount_max = 4.0
	particles.color = Color(0.4, 0.95, 1.0, 0.9)
	particles.global_position = player.global_position
	_add_to_scene(particles)
	get_tree().create_timer(1.0).timeout.connect(particles.queue_free)


func _add_to_scene(node: Node) -> void:
	var scene := get_tree().current_scene
	if scene:
		scene.add_child(node)
