extends RefCounted
## Loads a texture whether or not the editor has imported the project.
##
## `load("res://x.png")` only works after the editor has imported the PNG
## (an `x.png.import` file plus `.godot/imported/*.ctex`). A project that was
## just created and never opened in the editor -- which is exactly what
## `summer create` followed by `bash tests/autopilot/run.sh` produces -- has
## neither, and the runtime logs "No loader found for resource". In that case
## decode the source file directly. Prefer the imported resource whenever it
## exists so import settings and exported builds keep working.
##
## Usage: const RuntimeTexture := preload("res://scripts/systems/runtime_texture.gd")
##        sprite.texture = RuntimeTexture.load_texture("res://assets/sprites/x.png")


static func load_texture(path: String) -> Texture2D:
	if _is_imported(path):
		var imported := load(path)
		if imported is Texture2D:
			return imported
	var image := Image.load_from_file(path)
	if image == null or image.is_empty():
		push_warning("RuntimeTexture: could not load %s" % path)
		return null
	return ImageTexture.create_from_image(image)


## True when the editor has imported `path` and the imported file is present.
static func _is_imported(path: String) -> bool:
	if not FileAccess.file_exists(path + ".import"):
		# Exported builds ship .import remaps; a fresh project has none at all.
		return ResourceLoader.exists(path)
	var cfg := ConfigFile.new()
	if cfg.load(path + ".import") != OK:
		return false
	var dest: String = cfg.get_value("remap", "path", "")
	return dest != "" and FileAccess.file_exists(dest)
