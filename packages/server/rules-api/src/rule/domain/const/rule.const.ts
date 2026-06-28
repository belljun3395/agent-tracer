export const RULE_SEVERITIES = ["info", "warn", "block"] as const;

export const RULE_SCOPES = ["global", "task"] as const;

export const RULE_SOURCES = ["human", "agent"] as const;

export const RULE_TRIGGER_SOURCES = ["assistant", "user"] as const;

export const RULE_EXPECTED_ACTIONS = ["command", "file-read", "file-write", "web"] as const;

export const RULE_EXPECTED_ACTION = {
    command: "command",
    fileRead: "file-read",
    fileWrite: "file-write",
    web: "web",
} as const satisfies Record<string, (typeof RULE_EXPECTED_ACTIONS)[number]>;
