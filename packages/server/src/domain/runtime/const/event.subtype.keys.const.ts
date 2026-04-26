export const EVENT_SUBTYPE_KEYS = [
    "read_file",
    "glob_files",
    "grep_code",
    "list_files",
    "web_search",
    "web_fetch",
    "shell_probe",
    "create_file",
    "modify_file",
    "delete_file",
    "rename_file",
    "apply_patch",
    "run_command",
    "run_test",
    "run_build",
    "run_lint",
    "verify",
    "rule_check",
    "mcp_call",
    "skill_use",
    "delegation",
] as const;

export const EVENT_SUBTYPE_GROUPS = ["files", "search", "web", "shell", "file_ops", "execution", "coordination"] as const;
export const EVENT_TOOL_FAMILIES = ["explore", "file", "terminal", "coordination"] as const;
