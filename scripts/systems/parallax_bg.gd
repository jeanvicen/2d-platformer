extends ParallaxBackground
## Multi-layer parallax background using procedural shapes.
## Add as a child of any level scene. Layers auto-generate stars, mountains, clouds.

@export var sky_color_top: Color = Color(0.06, 0.06, 0.12)
@export var sky_color_bottom: Color = Color(0.12, 0.1, 0.2)
@export var star_count: int = 60
@export var mountain_color_far: Color = Color(0.15, 0.13, 0.22)
@export var mountain_color_near: Color = Color(0.2, 0.17, 0.28)
## 0 = trees (green), 1 = crystals (blue), 2 = pillars (red), -1 = none
@export var decoration_type: int = 0
## If set, uses this texture as the background instead of procedural generation.
@export var background_texture: Texture2D
@export var background_parallax: float = 0.15

const RuntimeTexture := preload("res://scripts/systems/runtime_texture.gd")

var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 42
	# Load game background if not set via export
	if not background_texture:
		background_texture = RuntimeTexture.load_texture("res://assets/sprites/background.png")
	if background_texture:
		_create_image_layer()
	else:
		_create_star_layer()
		_create_mountain_layer(0.1, mountain_color_far, -200, 120, 8)
		_create_mountain_layer(0.25, mountain_color_near, -100, 180, 6)
		if decoration_type >= 0:
			_create_decoration_layer()


func _create_image_layer() -> void:
	# Use a CanvasLayer behind everything so the bg always fills the screen
	var canvas := CanvasLayer.new()
	canvas.layer = -10
	add_child(canvas)
	var rect := TextureRect.new()
	rect.texture = background_texture
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	canvas.add_child(rect)


func _create_star_layer() -> void:
	var layer := ParallaxLayer.new()
	layer.motion_scale = Vector2(0.05, 0.05)
	add_child(layer)

	var container := Node2D.new()
	layer.add_child(container)

	for i in range(star_count):
		var star := Polygon2D.new()
		var size: float = _rng.randf_range(1.0, 3.0)
		star.polygon = PackedVector2Array([
			Vector2(-size, 0), Vector2(0, -size), Vector2(size, 0), Vector2(0, size)
		])
		star.color = Color(1, 1, 1, _rng.randf_range(0.3, 0.9))
		star.position = Vector2(
			_rng.randf_range(-1000, 3000),
			_rng.randf_range(-500, 200)
		)
		container.add_child(star)


func _create_mountain_layer(parallax: float, color: Color, y_base: float, height: float, peak_count: int) -> void:
	var layer := ParallaxLayer.new()
	layer.motion_scale = Vector2(parallax, parallax)
	add_child(layer)

	var points: PackedVector2Array = PackedVector2Array()
	var width: float = 5000.0
	# Start bottom-left
	points.append(Vector2(-500, y_base + 200))

	for i in range(peak_count + 1):
		var x: float = -500.0 + (width / peak_count) * i
		var y: float = y_base - _rng.randf_range(height * 0.3, height)
		points.append(Vector2(x, y))
		# Add midpoint for smoother silhouette
		if i < peak_count:
			var mid_x: float = x + (width / peak_count) * 0.5
			var mid_y: float = y_base - _rng.randf_range(0, height * 0.4)
			points.append(Vector2(mid_x, mid_y))

	# Close bottom-right
	points.append(Vector2(width, y_base + 200))

	var mountain := Polygon2D.new()
	mountain.polygon = points
	mountain.color = color
	layer.add_child(mountain)


func _create_decoration_layer() -> void:
	var layer := ParallaxLayer.new()
	layer.motion_scale = Vector2(0.35, 0.35)
	add_child(layer)

	var container := Node2D.new()
	layer.add_child(container)

	var count: int = _rng.randi_range(8, 14)
	for i in range(count):
		var x: float = _rng.randf_range(-200, 4500)
		var deco: Polygon2D
		match decoration_type:
			0:
				deco = _make_tree(x)
			1:
				deco = _make_crystal(x)
			2:
				deco = _make_pillar(x)
			_:
				continue
		container.add_child(deco)


func _make_tree(x: float) -> Polygon2D:
	var h: float = _rng.randf_range(40, 80)
	var w: float = h * _rng.randf_range(0.5, 0.8)
	var tree := Polygon2D.new()
	tree.polygon = PackedVector2Array([
		Vector2(0, -h), Vector2(w * 0.5, 0), Vector2(-w * 0.5, 0)
	])
	tree.color = Color(0.12, 0.22, 0.12, 0.6)
	tree.position = Vector2(x, 100)
	return tree


func _make_crystal(x: float) -> Polygon2D:
	var h: float = _rng.randf_range(30, 70)
	var w: float = _rng.randf_range(8, 16)
	var crystal := Polygon2D.new()
	crystal.polygon = PackedVector2Array([
		Vector2(0, -h), Vector2(w, -h * 0.3), Vector2(w * 0.6, 0),
		Vector2(-w * 0.6, 0), Vector2(-w, -h * 0.3)
	])
	crystal.color = Color(0.15, 0.2, 0.4, 0.5)
	crystal.position = Vector2(x, 100)
	return crystal


func _make_pillar(x: float) -> Polygon2D:
	var h: float = _rng.randf_range(50, 100)
	var w: float = _rng.randf_range(14, 24)
	var pillar := Polygon2D.new()
	pillar.polygon = PackedVector2Array([
		Vector2(-w, 0), Vector2(-w, -h), Vector2(-w * 0.6, -h - 10),
		Vector2(w * 0.6, -h - 10), Vector2(w, -h), Vector2(w, 0)
	])
	pillar.color = Color(0.25, 0.12, 0.12, 0.5)
	pillar.position = Vector2(x, 100)
	return pillar
