extends Control
## Additive multi-touch controls for the Web export and touchscreen devices.
## Existing keyboard and gamepad input remains unchanged.

var _buttons: Array[Dictionary] = []
var _touch_actions: Dictionary = {}
var _action_counts: Dictionary = {}
var _radius: float = 96.0
var _touch_supported: bool = false


func _ready() -> void:
    set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    mouse_filter = Control.MOUSE_FILTER_IGNORE
    z_index = 100
    process_mode = Node.PROCESS_MODE_ALWAYS
    _touch_supported = DisplayServer.is_touchscreen_available()
    resized.connect(_layout_buttons)
    get_viewport().size_changed.connect(_layout_buttons)
    _layout_buttons()
    _update_visibility()


func _process(_delta: float) -> void:
    _update_visibility()


func _notification(what: int) -> void:
    if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
        _release_all_actions()


func _input(event: InputEvent) -> void:
    if not visible or not _touch_supported:
        return

    if event is InputEventScreenTouch:
        if event.pressed:
            if _touch_actions.has(event.index):
                return
            var action := _action_at(event.position)
            if action.is_empty():
                return
            if get_tree().paused and action != &"pause":
                return
            _touch_actions[event.index] = action
            _change_action_count(action, 1)
        else:
            if not _touch_actions.has(event.index):
                return
            var action: StringName = _touch_actions[event.index]
            _touch_actions.erase(event.index)
            _change_action_count(action, -1)
        get_viewport().set_input_as_handled()
        queue_redraw()


func _update_visibility() -> void:
    var scene := get_tree().current_scene
    var is_gameplay := scene != null and scene.scene_file_path.begins_with("res://scenes/rooms/")
    var should_show := _touch_supported and is_gameplay
    if visible != should_show:
        visible = should_show
        if not visible:
            _release_all_actions()
        queue_redraw()


func _layout_buttons() -> void:
    var viewport_size := size
    if viewport_size.x <= 0.0 or viewport_size.y <= 0.0:
        return

    # Derive hit target size from both axes to avoid controls colliding on
    # compact portrait viewports while keeping them comfortably tappable.
    _radius = clampf(minf(viewport_size.y * 0.095, viewport_size.x * 0.045), 28.0, 118.0)
    var bottom_y := viewport_size.y - _radius * 1.35
    var left_x := _radius * 1.35
    var right_margin := _radius * 1.35
    var second_column := _radius * 3.55
    var top_row_y := bottom_y - _radius * 2.15
    var pause_radius := maxf(_radius * 0.62, 22.0)
    _buttons = [
        {"action": &"move_left", "label": "L", "center": Vector2(left_x, bottom_y), "radius": _radius},
        {"action": &"move_right", "label": "R", "center": Vector2(left_x + _radius * 2.15, bottom_y), "radius": _radius},
        {"action": &"move_down", "label": "DOWN", "center": Vector2(left_x + _radius * 1.075, top_row_y), "radius": _radius},
        {"action": &"jump", "label": "JUMP", "center": Vector2(viewport_size.x - right_margin, bottom_y), "radius": _radius},
        {"action": &"attack", "label": "ATK", "center": Vector2(viewport_size.x - second_column, bottom_y), "radius": _radius},
        {"action": &"dash", "label": "DASH", "center": Vector2(viewport_size.x - right_margin, top_row_y), "radius": _radius},
        {"action": &"interact", "label": "USE", "center": Vector2(viewport_size.x - second_column, top_row_y), "radius": _radius},
        {"action": &"pause", "label": "II", "center": Vector2(viewport_size.x - pause_radius * 1.5, pause_radius * 1.5), "radius": pause_radius},
    ]
    queue_redraw()


func _draw() -> void:
    if not _touch_supported:
        return
    var paused := get_tree().paused
    for button in _buttons:
        var action: StringName = button["action"]
        var center: Vector2 = button["center"]
        var radius: float = button["radius"]
        var pressed := int(_action_counts.get(action, 0)) > 0
        var disabled := paused and action != &"pause"
        var alpha := 0.2 if disabled else (0.74 if pressed else 0.46)
        draw_circle(center, radius, Color(0.025, 0.045, 0.045, alpha))
        draw_arc(center, radius, 0.0, TAU, 40, Color(0.75, 0.9, 0.86, 0.74 if pressed else 0.56), 3.0, true)
        var font_size := int(clampf(radius * (0.32 if String(button["label"]).length() > 2 else 0.42), 18.0, 38.0))
        var label_color := Color(0.94, 0.98, 0.96, 0.92 if not disabled else 0.34)
        var font := ThemeDB.fallback_font
        if font != null:
            draw_string(font, center + Vector2(0.0, font_size * 0.34), String(button["label"]), HORIZONTAL_ALIGNMENT_CENTER, -1.0, font_size, label_color)


func _action_at(position: Vector2) -> StringName:
    for button in _buttons:
        var center: Vector2 = button["center"]
        var radius: float = button["radius"]
        if position.distance_squared_to(center) <= radius * radius:
            return button["action"]
    return &""


func _change_action_count(action: StringName, change: int) -> void:
    var count := int(_action_counts.get(action, 0))
    var next_count := maxi(count + change, 0)
    if next_count == 0:
        _action_counts.erase(action)
        if count > 0:
            _send_action(action, false)
    else:
        _action_counts[action] = next_count
        if count == 0:
            _send_action(action, true)


func _send_action(action: StringName, pressed: bool) -> void:
    var action_event := InputEventAction.new()
    action_event.action = action
    action_event.pressed = pressed
    action_event.strength = 1.0 if pressed else 0.0
    Input.parse_input_event(action_event)


func _release_all_actions() -> void:
    for action in _action_counts.keys():
        _send_action(action, false)
    _action_counts.clear()
    _touch_actions.clear()
    queue_redraw()
