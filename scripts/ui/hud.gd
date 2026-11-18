extends CanvasLayer
## In-game HUD showing hearts and coins.

@onready var hearts_container: HBoxContainer = %HeartsContainer
@onready var coins_label: Label = %CoinsLabel
@onready var controls_hint: Label = %ControlsHint
@onready var health_label: Label = %HealthLabel

var _heart_nodes: Array[Polygon2D] = []


func _ready() -> void:
	EventBus.hp_changed.connect(_on_hp_changed)
	GameManager.coins_changed.connect(_on_coins_changed)
	EventBus.ability_unlocked.connect(_on_ability_changed)

	# Hide the "Health" text label, hearts speak for themselves
	if health_label:
		health_label.visible = false

	# Update controls hint based on unlocked abilities
	_update_controls_hint()

	await get_tree().process_frame
	if hearts_container:
		_build_hearts(GameManager.max_hp, GameManager.hp)
	if coins_label:
		_on_coins_changed(GameManager.coins)


func _build_hearts(max_hp: int, current_hp: int) -> void:
	if not hearts_container:
		return
	for h in _heart_nodes:
		if is_instance_valid(h):
			h.get_parent().queue_free()
	_heart_nodes.clear()

	for i in range(max_hp):
		var heart := Polygon2D.new()
		heart.polygon = PackedVector2Array([
			Vector2(0, -8), Vector2(8, -2), Vector2(0, 8), Vector2(-8, -2)
		])
		heart.color = Color(0.9, 0.2, 0.25) if i < current_hp else Color(0.3, 0.3, 0.3)
		var c := Control.new()
		c.custom_minimum_size = Vector2(22, 20)
		hearts_container.add_child(c)
		heart.position = Vector2(11, 12)
		c.add_child(heart)
		_heart_nodes.append(heart)


func _on_hp_changed(current: int, max_hp: int) -> void:
	if _heart_nodes.size() != max_hp:
		_build_hearts(max_hp, current)
		return
	for i in range(_heart_nodes.size()):
		if not is_instance_valid(_heart_nodes[i]):
			continue
		_heart_nodes[i].color = Color(0.9, 0.2, 0.25) if i < current else Color(0.3, 0.3, 0.3)


func _on_coins_changed(total: int) -> void:
	if coins_label:
		coins_label.text = "x %d" % total


func _on_ability_changed(_ability_name: String) -> void:
	_update_controls_hint()


func _update_controls_hint() -> void:
	if not controls_hint:
		return
	var parts: Array[String] = ["Move A/D", "Jump Space", "Attack X", "Interact E"]
	if AbilityManager.has_ability("dash"):
		parts.append("Dash Shift")
	parts.append("Pause Esc")
	controls_hint.text = "  ".join(parts)
