import { EVENT_SUBTYPE_KEYS } from "~domain/runtime/const/event.subtype.keys.const.js";
import { SERVER_SUBTYPE_KEYS } from "./const/subtype.registry.const.js";
import type { AllEventSubtypeKey, SubtypeRegistryEntry } from "./type/subtype.registry.type.js";

const SERVER_SUBTYPE_KEY_SET = new Set<string>(SERVER_SUBTYPE_KEYS);
const PROTOCOL_SUBTYPE_KEY_SET = new Set<string>(EVENT_SUBTYPE_KEYS);

export function isAllEventSubtypeKey(value: string): value is AllEventSubtypeKey {
    return PROTOCOL_SUBTYPE_KEY_SET.has(value) || SERVER_SUBTYPE_KEY_SET.has(value);
}

export const SUBTYPE_REGISTRY: Record<AllEventSubtypeKey, SubtypeRegistryEntry> = {
    read_file:     { label: "Read file",    group: "files",       toolFamily: "explore",      operation: "read"     },
    glob_files:    { label: "Glob files",   group: "search",      toolFamily: "explore",      operation: "search"   },
    grep_code:     { label: "Grep code",    group: "search",      toolFamily: "explore",      operation: "search"   },
    list_files:    { label: "List files",   group: "search",      toolFamily: "explore",      operation: "list"     },
    web_search:    { label: "Web search",   group: "web",         toolFamily: "explore",      operation: "search"   },
    web_fetch:     { label: "Web fetch",    group: "web",         toolFamily: "explore",      operation: "fetch"    },
    shell_probe:   { label: "Shell probe",  group: "shell",       toolFamily: "terminal",     operation: "probe"    },
    create_file:   { label: "Create file",  group: "file_ops",    toolFamily: "file",         operation: "modify"   },
    modify_file:   { label: "Modify file",  group: "file_ops",    toolFamily: "file",         operation: "modify"   },
    delete_file:   { label: "Delete file",  group: "file_ops",    toolFamily: "file",         operation: "modify"   },
    rename_file:   { label: "Rename file",  group: "file_ops",    toolFamily: "file",         operation: "modify"   },
    apply_patch:   { label: "Apply patch",  group: "file_ops",    toolFamily: "file",         operation: "modify"   },
    run_command:   { label: "Run command",  group: "execution",   toolFamily: "terminal",     operation: "execute"  },
    run_test:      { label: "Run test",     group: "execution",   toolFamily: "terminal",     operation: "execute"  },
    run_build:     { label: "Run build",    group: "execution",   toolFamily: "terminal",     operation: "execute"  },
    run_lint:      { label: "Run lint",     group: "execution",   toolFamily: "terminal",     operation: "execute"  },
    verify:        { label: "Verify",       group: "execution",   toolFamily: "terminal",     operation: "execute"  },
    rule_check:    { label: "Rule check",   group: "execution",   toolFamily: "terminal",     operation: "execute"  },
    mcp_call:      { label: "MCP call",     group: "coordination",toolFamily: "coordination", operation: "invoke"   },
    skill_use:     { label: "Skill use",    group: "coordination",toolFamily: "coordination", operation: "invoke"   },
    delegation:    { label: "Delegation",   group: "coordination",toolFamily: "coordination", operation: "delegate" },
    handoff:       { label: "Handoff",      group: "coordination",toolFamily: "coordination", operation: "coordinate"},
    bookmark:      { label: "Bookmark",     group: "coordination",toolFamily: "coordination", operation: "coordinate"},
    uncategorized: { label: "Other",        group: "coordination",toolFamily: "coordination", operation: "execute"  },
};
