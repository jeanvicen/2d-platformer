extends CanvasLayer
## Shop UI overlay. Buy items with coins.

@onready var panel: PanelContainer = $PanelContainer
@onready var item_list: VBoxContainer = $PanelContainer/MarginContainer/VBoxContainer/ScrollContainer/ItemList
@onready var close_button: Button = $PanelContainer/MarginContainer/VBoxContainer/Header/CloseButton
@onready var coin_label: Label = $PanelContainer/MarginContainer/VBoxContainer/Header/CoinLabel

const SHOP_ITEMS: Array = [
	{ "id": "heart_shard", "name": "Heart Shard", "description": "+1 Max HP", "cost": 50, "effect": "max_hp" },
	{ "id": "sharp_nail", "name": "Sharp Nail", "description": "+1 Attack", "cost": 40, "effect": "attack" },
	{ "id": "swift_boots", "name": "Swift Boots", "description": "+40 Speed", "cost": 30, "effect": "speed" },
]

var _buy_buttons: Array[Button] = []


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	close_button.pressed.connect(_close)
	GameManager.coins_changed.connect(_on_coins_changed)
	_update_coin_display()
	_populate_items()
	get_tree().paused = true
	EventBus.shop_opened.emit("shopkeeper")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		_close()
		get_viewport().set_input_as_handled()


func _populate_items() -> void:
	for child in item_list.get_children():
		child.queue_free()
	_buy_buttons.clear()

	for item in SHOP_ITEMS:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)

		# Item info
		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.add_theme_constant_override("separation", 2)

		var name_label := Label.new()
		name_label.text = item["name"]
		name_label.add_theme_color_override("font_color", Color(1, 1, 1, 1))
		info.add_child(name_label)

		var desc_label := Label.new()
		desc_label.text = item["description"]
		desc_label.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6, 1))
		info.add_child(desc_label)

		row.add_child(info)

		# Buy button
		var buy_btn := Button.new()
		buy_btn.text = str(item["cost"]) + " coins"
		buy_btn.custom_minimum_size = Vector2(100, 36)
		buy_btn.pressed.connect(_buy_item.bind(item))
		row.add_child(buy_btn)
		_buy_buttons.append(buy_btn)

		item_list.add_child(row)

		# Separator
		var sep := HSeparator.new()
		item_list.add_child(sep)

	_update_button_states()


func _buy_item(item: Dictionary) -> void:
	var cost: int = item["cost"]
	if GameManager.coins < cost:
		return

	GameManager.coins -= cost
	GameManager.coins_changed.emit(GameManager.coins)

	match item["effect"]:
		"max_hp":
			GameManager.increase_max_hp(1)
		"attack":
			# Store attack bonus on GameManager (player reads it)
			if not GameManager.has_meta("attack_bonus"):
				GameManager.set_meta("attack_bonus", 0)
			GameManager.set_meta("attack_bonus", GameManager.get_meta("attack_bonus") + 1)
		"speed":
			if not GameManager.has_meta("speed_bonus"):
				GameManager.set_meta("speed_bonus", 0)
			GameManager.set_meta("speed_bonus", GameManager.get_meta("speed_bonus") + 40)

	EventBus.item_purchased.emit(item["id"])
	_update_button_states()


func _update_coin_display() -> void:
	coin_label.text = "Coins: " + str(GameManager.coins)


func _update_button_states() -> void:
	for i in range(mini(SHOP_ITEMS.size(), _buy_buttons.size())):
		var cost: int = SHOP_ITEMS[i]["cost"]
		_buy_buttons[i].disabled = GameManager.coins < cost


func _on_coins_changed(total: int) -> void:
	_update_coin_display()
	_update_button_states()


func _close() -> void:
	get_tree().paused = false
	queue_free()
