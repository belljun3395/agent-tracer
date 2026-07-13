import { RULE_EXPECTED_ACTION, RULE_EXPECTED_ACTIONS, type RuleExpectedAction } from "../definition/rule.vocabulary.js";

const RULE_EXPECTED_ACTION_SET: ReadonlySet<string> = new Set(RULE_EXPECTED_ACTIONS);

const TOOL_NAME_ALIASES = new Map<string, string>([
    ["bash", "Bash"], ["shell", "Bash"], ["terminal", "Bash"], ["terminal.command", "Bash"],
    ["command", "Bash"], ["command-run", "Bash"], ["run-command", "Bash"], ["run_command", "Bash"],
    ["run-test", "Bash"], ["run_test", "Bash"], ["run-build", "Bash"], ["run_build", "Bash"],
    ["run-lint", "Bash"], ["run_lint", "Bash"],
    ["file", "Read"], ["file-read", "Read"], ["read-file", "Read"], ["view-file", "Read"], ["open-file", "Read"],
    ["edit", "Edit"], ["file-write", "Edit"], ["write-file", "Edit"], ["modify-file", "Edit"], ["edit-file", "Edit"],
    ["applypatch", "Edit"], ["apply_patch", "Edit"], ["apply-patch", "Edit"], ["patch", "Edit"],
    ["multiedit", "MultiEdit"], ["multi_edit", "MultiEdit"], ["multi-edit", "MultiEdit"],
    ["write", "Write"], ["read", "Read"], ["grep", "Grep"], ["glob", "Glob"], ["ls", "LS"], ["list", "LS"],
    ["task", "Task"], ["todowrite", "TodoWrite"], ["todo_write", "TodoWrite"],
    ["web", "WebSearch"], ["webfetch", "WebFetch"], ["web_fetch", "WebFetch"], ["web-fetch", "WebFetch"],
    ["websearch", "WebSearch"], ["web_search", "WebSearch"], ["search-web", "WebSearch"],
]);

const ACTION_BY_TOOL = new Map<string, RuleExpectedAction>([
    ["Bash", RULE_EXPECTED_ACTION.command],
    ["Read", RULE_EXPECTED_ACTION.fileRead],
    ["Grep", RULE_EXPECTED_ACTION.fileRead],
    ["Glob", RULE_EXPECTED_ACTION.fileRead],
    ["LS", RULE_EXPECTED_ACTION.fileRead],
    ["Edit", RULE_EXPECTED_ACTION.fileWrite],
    ["MultiEdit", RULE_EXPECTED_ACTION.fileWrite],
    ["Write", RULE_EXPECTED_ACTION.fileWrite],
    ["WebFetch", RULE_EXPECTED_ACTION.web],
    ["WebSearch", RULE_EXPECTED_ACTION.web],
]);

export function isRuleExpectedAction(value: string): value is RuleExpectedAction {
    return RULE_EXPECTED_ACTION_SET.has(value);
}

export function canonicalizeToolName(tool: string): string {
    const trimmed = tool.trim();
    return TOOL_NAME_ALIASES.get(trimmed.toLowerCase()) ?? trimmed;
}

export function normalizeRuleExpectedAction(value: string): RuleExpectedAction | null {
    const trimmed = value.trim();
    if (isRuleExpectedAction(trimmed)) return trimmed;
    return ACTION_BY_TOOL.get(canonicalizeToolName(trimmed)) ?? null;
}
