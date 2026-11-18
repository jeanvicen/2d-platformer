extends Node
## Audio manager with music crossfade and SFX pool with pitch variance.
## Stub: all play calls are in place but no audio files are loaded yet.
## To add audio, assign AudioStream resources and uncomment calls in game scripts.

var _music_a: AudioStreamPlayer
var _music_b: AudioStreamPlayer
var _active_music: AudioStreamPlayer
var _sfx_pool: Array[AudioStreamPlayer] = []
var _sfx_index: int = 0

const SFX_POOL_SIZE: int = 4
const DEFAULT_MUSIC_VOLUME: float = -6.0
const DEFAULT_SFX_VOLUME: float = -3.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

	_music_a = AudioStreamPlayer.new()
	_music_a.bus = "Master"
	add_child(_music_a)

	_music_b = AudioStreamPlayer.new()
	_music_b.bus = "Master"
	add_child(_music_b)

	_active_music = _music_a

	for i in range(SFX_POOL_SIZE):
		var player := AudioStreamPlayer.new()
		player.bus = "Master"
		add_child(player)
		_sfx_pool.append(player)


## Play music with optional crossfade. Pass null to stop music.
func play_music(stream: AudioStream, crossfade: float = 0.5) -> void:
	if stream == null:
		stop_music(crossfade)
		return
	var old: AudioStreamPlayer = _active_music
	var new_player: AudioStreamPlayer = _music_b if _active_music == _music_a else _music_a
	new_player.stream = stream
	new_player.volume_db = -80.0
	new_player.play()
	_active_music = new_player

	var tween := create_tween().set_parallel(true)
	tween.tween_property(new_player, "volume_db", DEFAULT_MUSIC_VOLUME, crossfade)
	tween.tween_property(old, "volume_db", -80.0, crossfade)
	tween.chain().tween_callback(old.stop)


## Stop music with fade.
func stop_music(fade: float = 0.3) -> void:
	var tween := create_tween()
	tween.tween_property(_active_music, "volume_db", -80.0, fade)
	tween.tween_callback(_active_music.stop)


## Play a one-shot SFX with random pitch variation.
func play_sfx(stream: AudioStream, pitch_variance: float = 0.1) -> void:
	if stream == null:
		return
	var player: AudioStreamPlayer = _sfx_pool[_sfx_index]
	_sfx_index = (_sfx_index + 1) % SFX_POOL_SIZE
	player.stream = stream
	player.volume_db = DEFAULT_SFX_VOLUME
	player.pitch_scale = randf_range(1.0 - pitch_variance, 1.0 + pitch_variance)
	player.play()
