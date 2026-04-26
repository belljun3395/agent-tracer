export const RULE_EXPECT_TOOL_OPTIONS = [
    { value: "", label: "Any action" },
    { value: "command", label: "Run command" },
    { value: "file-read", label: "Read file" },
    { value: "file-write", label: "Modify file" },
    { value: "web", label: "Search/open web" },
] as const;

const RULE_EXPECT_TOOL_LABELS = new Map<string, string>(
    RULE_EXPECT_TOOL_OPTIONS.map((option) => [option.value, option.label]),
);

const RULE_EXPECT_TOOL_PLACEHOLDERS = {
    "": {
        command: "e.g., npm test\nnpm run lint\npytest",
        pattern: "e.g., npm (run )?test|src/.+\\.ts$|docs\\.example\\.com",
    },
    command: {
        command: "e.g., npm test\nnpm run lint\npytest",
        pattern: "e.g., ^npm (run )?test$",
    },
    "file-read": {
        command: "",
        pattern: "e.g., README\\.md$|src/.+\\.ts$|package\\.json$",
    },
    "file-write": {
        command: "",
        pattern: "e.g., src/auth\\.ts$|packages/.+\\.tsx$|\\.env\\.example$",
    },
    web: {
        command: "",
        pattern: "e.g., docs\\.anthropic\\.com|openai\\.com|verification",
    },
} as const;

type RuleExpectToolValue = keyof typeof RULE_EXPECT_TOOL_PLACEHOLDERS;

const TOOL_ALIASES = new Map<string, string>([
    ["bash", "command"],
    ["shell", "command"],
    ["terminal", "command"],
    ["command", "command"],
    ["run-command", "command"],
    ["run-test", "command"],
    ["run-build", "command"],
    ["run-lint", "command"],
    ["read", "file-read"],
    ["grep", "file-read"],
    ["glob", "file-read"],
    ["ls", "file-read"],
    ["file", "file-read"],
    ["file-read", "file-read"],
    ["read-file", "file-read"],
    ["view-file", "file-read"],
    ["edit", "file-write"],
    ["multiedit", "file-write"],
    ["multi-edit", "file-write"],
    ["write", "file-write"],
    ["file-write", "file-write"],
    ["write-file", "file-write"],
    ["modify-file", "file-write"],
    ["apply-patch", "file-write"],
    ["web", "web"],
    ["websearch", "web"],
    ["web-search", "web"],
    ["webfetch", "web"],
    ["web-fetch", "web"],
]);

export function normalizeRuleExpectTool(value: string | undefined): string {
    const key = (value ?? "").trim().toLowerCase().replace(/[\s._]+/g, "-");
    return TOOL_ALIASES.get(key) ?? "";
}

export function labelRuleExpectTool(value: string): string {
    const normalized = normalizeRuleExpectTool(value);
    return RULE_EXPECT_TOOL_LABELS.get(normalized) ?? value;
}

export function getRuleExpectToolPlaceholders(value: string): { readonly command: string; readonly pattern: string } {
    const normalized = normalizeRuleExpectTool(value);
    return isRuleExpectToolValue(normalized)
        ? RULE_EXPECT_TOOL_PLACEHOLDERS[normalized]
        : RULE_EXPECT_TOOL_PLACEHOLDERS[""];
}

export function supportsCommandMatches(value: string): boolean {
    const normalized = normalizeRuleExpectTool(value);
    return normalized === "" || normalized === "command";
}

function isRuleExpectToolValue(value: string): value is RuleExpectToolValue {
    return Object.prototype.hasOwnProperty.call(RULE_EXPECT_TOOL_PLACEHOLDERS, value);
}
