import type { RuleExpectedAction } from "./type/rule.value.type.js";
import { isRuleExpectedAction } from "./rule.expected-action.js";

const TOOL_ALIASES = new Map<string, string>([
    ["bash", "Bash"],
    ["shell", "Bash"],
    ["terminal", "Bash"],
    ["terminal.command", "Bash"],
    ["command", "Bash"],
    ["command-run", "Bash"],
    ["run-command", "Bash"],
    ["run_command", "Bash"],
    ["run-test", "Bash"],
    ["run_test", "Bash"],
    ["run-build", "Bash"],
    ["run_build", "Bash"],
    ["run-lint", "Bash"],
    ["run_lint", "Bash"],
    ["file", "Read"],
    ["file-read", "Read"],
    ["read-file", "Read"],
    ["view-file", "Read"],
    ["open-file", "Read"],
    ["edit", "Edit"],
    ["file-write", "Edit"],
    ["write-file", "Edit"],
    ["modify-file", "Edit"],
    ["edit-file", "Edit"],
    ["applypatch", "Edit"],
    ["apply_patch", "Edit"],
    ["apply-patch", "Edit"],
    ["patch", "Edit"],
    ["multiedit", "MultiEdit"],
    ["multi_edit", "MultiEdit"],
    ["multi-edit", "MultiEdit"],
    ["write", "Write"],
    ["read", "Read"],
    ["grep", "Grep"],
    ["glob", "Glob"],
    ["ls", "LS"],
    ["list", "LS"],
    ["task", "Task"],
    ["todowrite", "TodoWrite"],
    ["todo_write", "TodoWrite"],
    ["web", "WebSearch"],
    ["webfetch", "WebFetch"],
    ["web_fetch", "WebFetch"],
    ["web-fetch", "WebFetch"],
    ["websearch", "WebSearch"],
    ["web_search", "WebSearch"],
    ["web-search", "WebSearch"],
    ["search-web", "WebSearch"],
]);

const ACTION_BY_TOOL = new Map<string, RuleExpectedAction>([
    ["Bash", "command"],
    ["Read", "file-read"],
    ["Grep", "file-read"],
    ["Glob", "file-read"],
    ["LS", "file-read"],
    ["Edit", "file-write"],
    ["MultiEdit", "file-write"],
    ["Write", "file-write"],
    ["WebFetch", "web"],
    ["WebSearch", "web"],
]);

export function normalizeVerificationToolName(tool: string): string {
    const trimmed = tool.trim();
    return TOOL_ALIASES.get(trimmed.toLowerCase()) ?? trimmed;
}

export function normalizeRuleExpectedAction(value: string): RuleExpectedAction | null {
    const trimmed = value.trim();
    if (isRuleExpectedAction(trimmed)) return trimmed;
    return ACTION_BY_TOOL.get(normalizeVerificationToolName(trimmed)) ?? null;
}

export function verificationToolMatchesExpectedAction(
    actualTool: string,
    expectedAction: RuleExpectedAction,
): boolean {
    return normalizeRuleExpectedAction(actualTool) === expectedAction;
}
