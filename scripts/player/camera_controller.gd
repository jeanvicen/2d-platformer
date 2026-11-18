extends Camera2D
## Camera with screen shake and smooth following.

@export var shake_decay: float = 8.0
@export var max_shake_offset: float = 12.0

var _shake_intensity: float = 0.0
var _hitstop_timer: float = 0.0
var _owns_timescale: bool = false


func _ready() -> void:
	EventBus.screen_shake_requested.connect(_on_shake_requested)
	EventBus.hitstop_requested.connect(_on_hitstop_requested)
	process_mode = Node.PROCESS_MODE_ALWAYS


func _process(delta: float) -> void:
	# Hitstop (uses unscaled delta since we control time_scale)
	if _hitstop_timer > 0.0:
		var real_delta: float = delta / maxf(Engine.time_scale, 0.001)
		_hitstop_timer -= real_delta
		if _hitstop_timer <= 0.0:
			_hitstop_timer = 0.0
			if _owns_timescale:
				Engine.time_scale = 1.0
				_owns_timescale = false
		return

	# Shake
	if _shake_intensity > 0.0:
		_shake_intensity = maxf(_shake_intensity - shake_decay * delta, 0.0)
		offset = Vector2(
			randf_range(-1.0, 1.0) * _shake_intensity * max_shake_offset,
			randf_range(-1.0, 1.0) * _shake_intensity * max_shake_offset,
		)
	else:
		offset = offset.lerp(Vector2.ZERO, 10.0 * delta)


func _on_shake_requested(intensity: float, _duration: float) -> void:
	_shake_intensity = maxf(_shake_intensity, intensity)


func _on_hitstop_requested(duration: float) -> void:
	Engine.time_scale = 0.05
	_owns_timescale = true
	_hitstop_timer = maxf(_hitstop_timer, duration)
