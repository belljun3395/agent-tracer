import { AGENT_TRACER_ATTR } from "@monitor/kernel";

// 이벤트가 표시 세부 유형으로 분류될 때 쓰는 키.
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

// 서버가 부여하는 보조 세부 유형.
export const SERVER_SUBTYPE_KEYS = ["handoff", "bookmark", "uncategorized"] as const;

export const EVENT_SUBTYPE_GROUPS = ["files", "search", "web", "shell", "file_ops", "execution", "coordination"] as const;

export const EVENT_TOOL_FAMILIES = ["explore", "file", "terminal", "coordination"] as const;

export type EventSubtypeKey = (typeof EVENT_SUBTYPE_KEYS)[number];
export type ServerSubtypeKey = (typeof SERVER_SUBTYPE_KEYS)[number];
export type AllEventSubtypeKey = EventSubtypeKey | ServerSubtypeKey;
export type EventSubtypeGroup = (typeof EVENT_SUBTYPE_GROUPS)[number];
export type EventToolFamily = (typeof EVENT_TOOL_FAMILIES)[number];

export interface SubtypeRegistryEntry {
    readonly label: string;
    readonly group: EventSubtypeGroup;
    readonly toolFamily: EventToolFamily;
    readonly operation: string;
}

export const SUBTYPE_REGISTRY: Record<AllEventSubtypeKey, SubtypeRegistryEntry> = {
    read_file: { label: "Read file", group: "files", toolFamily: "explore", operation: "read" },
    glob_files: { label: "Glob files", group: "search", toolFamily: "explore", operation: "search" },
    grep_code: { label: "Grep code", group: "search", toolFamily: "explore", operation: "search" },
    list_files: { label: "List files", group: "search", toolFamily: "explore", operation: "list" },
    web_search: { label: "Web search", group: "web", toolFamily: "explore", operation: "search" },
    web_fetch: { label: "Web fetch", group: "web", toolFamily: "explore", operation: "fetch" },
    shell_probe: { label: "Shell probe", group: "shell", toolFamily: "terminal", operation: "probe" },
    create_file: { label: "Create file", group: "file_ops", toolFamily: "file", operation: "modify" },
    modify_file: { label: "Modify file", group: "file_ops", toolFamily: "file", operation: "modify" },
    delete_file: { label: "Delete file", group: "file_ops", toolFamily: "file", operation: "modify" },
    rename_file: { label: "Rename file", group: "file_ops", toolFamily: "file", operation: "modify" },
    apply_patch: { label: "Apply patch", group: "file_ops", toolFamily: "file", operation: "modify" },
    run_command: { label: "Run command", group: "execution", toolFamily: "terminal", operation: "execute" },
    run_test: { label: "Run test", group: "execution", toolFamily: "terminal", operation: "execute" },
    run_build: { label: "Run build", group: "execution", toolFamily: "terminal", operation: "execute" },
    run_lint: { label: "Run lint", group: "execution", toolFamily: "terminal", operation: "execute" },
    verify: { label: "Verify", group: "execution", toolFamily: "terminal", operation: "execute" },
    rule_check: { label: "Rule check", group: "execution", toolFamily: "terminal", operation: "execute" },
    mcp_call: { label: "MCP call", group: "coordination", toolFamily: "coordination", operation: "invoke" },
    skill_use: { label: "Skill use", group: "coordination", toolFamily: "coordination", operation: "invoke" },
    delegation: { label: "Delegation", group: "coordination", toolFamily: "coordination", operation: "delegate" },
    handoff: { label: "Handoff", group: "coordination", toolFamily: "coordination", operation: "coordinate" },
    bookmark: { label: "Bookmark", group: "coordination", toolFamily: "coordination", operation: "coordinate" },
    uncategorized: { label: "Other", group: "coordination", toolFamily: "coordination", operation: "execute" },
};

const SUBTYPE_KEY_SET = new Set<string>([...EVENT_SUBTYPE_KEYS, ...SERVER_SUBTYPE_KEYS]);
const SUBTYPE_GROUP_SET = new Set<string>(EVENT_SUBTYPE_GROUPS);
const TOOL_FAMILY_SET = new Set<string>(EVENT_TOOL_FAMILIES);

export function isEventSubtypeKey(value: string | undefined): value is AllEventSubtypeKey {
    return value !== undefined && SUBTYPE_KEY_SET.has(value);
}

export function isEventSubtypeGroup(value: string | undefined): value is EventSubtypeGroup {
    return value !== undefined && SUBTYPE_GROUP_SET.has(value);
}

export function isEventToolFamily(value: string | undefined): value is EventToolFamily {
    return value !== undefined && TOOL_FAMILY_SET.has(value);
}

// 표시 세부 유형·근거 수준을 실어 나르는 속성 키다.
export const META = {
    subtypeKey: AGENT_TRACER_ATTR.subtypeKey,
    subtypeLabel: AGENT_TRACER_ATTR.subtypeLabel,
    subtypeGroup: AGENT_TRACER_ATTR.subtypeGroup,
    toolFamily: AGENT_TRACER_ATTR.toolFamily,
    operation: AGENT_TRACER_ATTR.operation,
    sourceTool: AGENT_TRACER_ATTR.sourceTool,
    entityType: AGENT_TRACER_ATTR.entityType,
    entityName: AGENT_TRACER_ATTR.entityName,
    displayTitle: AGENT_TRACER_ATTR.displayTitle,
    evidenceLevel: AGENT_TRACER_ATTR.evidenceLevel,
    filePaths: AGENT_TRACER_ATTR.filePaths,
    turnResponseEventId: AGENT_TRACER_ATTR.turnResponseEventId,
    asyncTaskId: AGENT_TRACER_ATTR.asyncTaskId,
    asyncStatus: AGENT_TRACER_ATTR.asyncStatus,
} as const;

// action.logged 이벤트가 나타내는 비동기 작업의 진행 상태이며, 시작~종료 사이 다른 턴을 여러 개 거칠 수 있어 턴 조립이 별도로 상관시켜야 한다.
export const ASYNC_ACTION_STATUS = {
    running: "running",
} as const;

export const EVIDENCE_LEVELS = ["proven", "inferred", "self_reported", "unavailable"] as const;

export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

// 읽기 시점에 파생되는 표시 세부 유형.
export interface TimelineItemSubtype {
    readonly key: AllEventSubtypeKey;
    readonly label: string;
    readonly group: EventSubtypeGroup;
    readonly toolFamily: EventToolFamily;
    readonly operation: string;
    readonly sourceTool?: string;
    readonly entityType?: string;
    readonly entityName?: string;
}

// 타임라인 표시용 직렬화 형태는 공유 계약에서 온다(web과 동일 타입).
export type { TimelineItemDto } from "@monitor/kernel";
