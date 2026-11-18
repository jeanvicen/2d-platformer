extends CanvasLayer
## Room map overlay. Shows visited rooms and current location.

@onready var panel: PanelContainer = $PanelContainer
@onready var close_button: Button = $PanelContainer/MarginContainer/VBoxContainer/Header/CloseButton
@onready var map_draw: Control = $PanelContainer/MarginContainer/VBoxContainer/MapArea

## Room positions on the map grid (x, y in grid units).
const ROOM_LAYOUT: Dictionary = {
	"room_01": { "pos": Vector2(1, 0), "label": "Hub", "color": Color(0.3, 0.5, 0.3, 1) },
	"room_02": { "pos": Vector2(2, 0), "label": "Mossy Grotto", "color": Color(0.2, 0.6, 0.2, 1) },
	"room_03": { "pos": Vector2(1, 1), "label": "Crystal Caves", "color": Color(0.4, 0.3, 0.7, 1) },
	"room_04": { "pos": Vector2(1, 2), "label": "Fungal Depths", "color": Color(0.5, 0.4, 0.2, 1) },
	"room_05": { "pos": Vector2(2, 1), "label": "Aqueduct", "color": Color(0.2, 0.4, 0.6, 1) },
	"room_06": { "pos": Vector2(2, 2), "label": "Queen's Chamber", "color": Color(0.6, 0.2, 0.3, 1) },
	"room_07": { "pos": Vector2(0, 0), "label": "Hidden Garden", "color": Color(0.3, 0.6, 0.5, 1) },
}

## Connections between rooms (pairs of room IDs).
const CONNECTIONS: Array = [
	["room_01", "room_02"],
	["room_01", "room_03"],
	["room_03", "room_04"],
	["room_03", "room_05"],
	["room_05", "room_06"],
	["room_01", "room_07"],
]

const CELL_SIZE: Vector2 = Vector2(100, 80)
const ROOM_SIZE: Vector2 = Vector2(80, 56)
const OFFSET: Vector2 = Vector2(40, 20)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	close_button.pressed.connect(_close)
	get_tree().paused = true
	map_draw.draw.connect(_on_map_draw)
	map_draw.queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		_close()
		get_viewport().set_input_as_handled()


func _on_map_draw() -> void:
	var visited: Array[String] = RoomManager.visited_rooms
	var current: String = RoomManager.current_room_id

	# Draw connections first
	for conn in CONNECTIONS:
		var id_a: String = conn[0]
		var id_b: String = conn[1]
		if id_a not in visited and id_b not in visited:
			continue
		if id_a not in ROOM_LAYOUT or id_b not in ROOM_LAYOUT:
			continue
		var pos_a: Vector2 = OFFSET + ROOM_LAYOUT[id_a]["pos"] * CELL_SIZE + ROOM_SIZE * 0.5
		var pos_b: Vector2 = OFFSET + ROOM_LAYOUT[id_b]["pos"] * CELL_SIZE + ROOM_SIZE * 0.5
		map_draw.draw_line(pos_a, pos_b, Color(0.35, 0.35, 0.4, 1), 2.0)

	# Draw rooms
	for room_id in ROOM_LAYOUT:
		var info: Dictionary = ROOM_LAYOUT[room_id]
		var rect_pos: Vector2 = OFFSET + info["pos"] * CELL_SIZE
		var rect := Rect2(rect_pos, ROOM_SIZE)

		if room_id in visited:
			var col: Color = info["color"]
			map_draw.draw_rect(rect, col)

			# Current room highlight border
			if room_id == current:
				map_draw.draw_rect(rect, Color(1, 1, 1, 1), false, 2.0)

			# Room label
			var font: Font = ThemeDB.fallback_font
			var font_size: int = 10
			var text_pos: Vector2 = rect_pos + Vector2(4, ROOM_SIZE.y * 0.5 + 4)
			map_draw.draw_string(font, text_pos, info["label"], HORIZONTAL_ALIGNMENT_LEFT, ROOM_SIZE.x - 8, font_size, Color(1, 1, 1, 1))
		else:
			# Unvisited: dark placeholder
			map_draw.draw_rect(rect, Color(0.15, 0.15, 0.18, 1))
			map_draw.draw_rect(rect, Color(0.25, 0.25, 0.3, 1), false, 1.0)


func _close() -> void:
	get_tree().paused = false
	queue_free()
