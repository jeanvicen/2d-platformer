extends Node
## Manages game state: HP, coins, score, room flow, death/respawn.

signal coins_changed(total: int)
signal score_changed(total: int)

const DEFAULT_MAX_HP: int = 5
const DEFAULT_START_ROOM: String = "room_01"
const DEFAULT_START_DOOR: String = "door_spawn"

var coins: int = 0
var score: int = 0
var hp: int = DEFAULT_MAX_HP
var max_hp: int = DEFAULT_MAX_HP
var last_bench_room: String = DEFAULT_START_ROOM
var last_bench_door: String = DEFAULT_START_DOOR


func _ready() -> void:
	EventBus.coin_collected.connect(_on_coin_collected)
	EventBus.enemy_killed.connect(_on_enemy_killed)
	process_mode = Node.PROCESS_MODE_ALWAYS


func reset() -> void:
	coins = 0
	score = 0
	hp = DEFAULT_MAX_HP
	max_hp = DEFAULT_MAX_HP
	last_bench_room = DEFAULT_START_ROOM
	last_bench_door = DEFAULT_START_DOOR
	coins_changed.emit(coins)
	score_changed.emit(score)
	EventBus.hp_changed.emit(hp, max_hp)


func add_score(amount: int) -> void:
	score += amount
	score_changed.emit(score)


func take_damage(amount: int = 1) -> void:
	hp = maxi(hp - amount, 0)
	EventBus.hp_changed.emit(hp, max_hp)
	if hp <= 0:
		EventBus.player_died.emit()


func heal(amount: int) -> void:
	var old_hp: int = hp
	hp = mini(hp + amount, max_hp)
	if hp > old_hp:
		EventBus.player_healed.emit(hp - old_hp)
		EventBus.hp_changed.emit(hp, max_hp)


func heal_full() -> void:
	heal(max_hp)


func increase_max_hp(amount: int = 1) -> void:
	max_hp += amount
	hp += amount
	EventBus.hp_changed.emit(hp, max_hp)


func set_bench(room_id: String, door_id: String) -> void:
	last_bench_room = room_id
	last_bench_door = door_id
	SaveManager.save_game()


func respawn_at_bench() -> void:
	hp = max_hp
	EventBus.hp_changed.emit(hp, max_hp)
	RoomManager.change_room(last_bench_room, last_bench_door)
	EventBus.player_respawned.emit()


func change_room(room_id: String, door_id: String) -> void:
	RoomManager.change_room(room_id, door_id)


func start_game() -> void:
	reset()
	AbilityManager.reset()
	AbilityManager.unlock("dash")  # Player starts with dash
	QuestManager.reset()
	RoomManager.reset()
	RoomManager.change_room(DEFAULT_START_ROOM, DEFAULT_START_DOOR)


func go_to_main_menu() -> void:
	get_tree().paused = false
	SceneTransition.change_scene("res://scenes/ui/main_menu.tscn")


func _on_coin_collected(_position: Vector2, _total: int) -> void:
	coins += 1
	add_score(10)
	coins_changed.emit(coins)


func _on_enemy_killed(_position: Vector2) -> void:
	add_score(50)
