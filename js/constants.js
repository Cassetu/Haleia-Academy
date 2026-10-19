export const BINARY_TYPES = ["challenge", "code_fix", "godot_scene", "spot_bug", "project", "cooking_sim"];
export const isBinaryLesson = l => BINARY_TYPES.includes(l.type) || l.type === "document";