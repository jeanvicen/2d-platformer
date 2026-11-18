extends CanvasLayer
## Brief level complete overlay shown before advancing.

@onready var panel: Control = $PanelContainer
@onready var label: Label = $PanelContainer/Label


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	panel.visible = false
	EventBus.level_completed.connect(_show)


func _show() -> void:
	panel.visible = true
	label.text = "Level Complete!"
	# Animate scale pop
	panel.scale = Vector2(0.5, 0.5)
	var tween: Tween = create_tween()
	tween.tween_property(panel, "scale", Vector2.ONE, 0.3) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
