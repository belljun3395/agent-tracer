import type { ActionPrefixRule, ActionKeywordRule } from "./action-registry.types.js";
export const ACTION_SKIP_WORDS = new Set(["run"]);
export const ACTION_PREFIX_RULES: readonly ActionPrefixRule[] = [
    {
        lane: "exploration",
        prefixes: ["read", "search", "scan", "inspect", "list", "open", "find", "fetch", "lookup", "grep"],
        tags: ["action-registry", "exploration"]
    },
    {
        lane: "planning",
        prefixes: ["plan", "analyze", "assess", "review", "design", "decide"],
        tags: ["action-registry", "planning"]
    },
    {
        lane: "implementation",
        prefixes: ["create", "modify", "write", "edit", "update", "fix", "refactor", "implement"],
        tags: ["action-registry", "implementation"]
    },
    {
        lane: "implementation",
        prefixes: ["test", "build", "lint", "verify", "validate", "check", "assert"],
        tags: ["action-registry", "implementation"]
    }
];
export const ACTION_KEYWORD_RULES: readonly ActionKeywordRule[] = [
    {
        lane: "implementation",
        keywords: ["test", "tests", "build", "lint", "verify", "validate", "validation", "check", "checks", "guard", "rule", "violation", "pass", "compliance"],
        tags: ["verification"]
    },
    {
        lane: "planning",
        keywords: ["plan", "design", "approach", "analysis", "review", "assess", "strategy"],
        tags: ["planning"]
    },
    {
        lane: "exploration",
        keywords: ["read", "search", "scan", "inspect", "lookup", "explore"],
        tags: ["exploration"]
    }
];
