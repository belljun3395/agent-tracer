export {
    KIND,
    MONITOR_TOOL_NAME,
    POWERSHELL_TOOL_NAME,
    RECIPE_INJECTED_VIA,
    TERMINAL_COMMAND_TOOL_NAME,
} from "@monitor/kernel/ingest/event.kind.const.js";
import type {KIND} from "@monitor/kernel/ingest/event.kind.const.js";

export const EVENT_LANES = [
    "user",
    "assistant",
    "exploration",
    "planning",
    "implementation",
    "rule",
    "questions",
    "todos",
    "background",
    "coordination",
    "telemetry",
] as const;

export type EventLane = (typeof EVENT_LANES)[number];

export const LANE = {
    user: "user",
    assistant: "assistant",
    exploration: "exploration",
    planning: "planning",
    implementation: "implementation",
    rule: "rule",
    questions: "questions",
    todos: "todos",
    background: "background",
    coordination: "coordination",
    telemetry: "telemetry",
} as const satisfies Record<EventLane, EventLane>;

export const EVIDENCE_LEVELS = ["proven", "inferred", "self_reported", "unavailable"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

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
export type EventSubtypeKey = (typeof EVENT_SUBTYPE_KEYS)[number];

export const EVENT_SUBTYPE_GROUPS = [
    "files",
    "search",
    "web",
    "shell",
    "file_ops",
    "execution",
    "coordination",
] as const;
export type EventSubtypeGroup = (typeof EVENT_SUBTYPE_GROUPS)[number];

export const EVENT_TOOL_FAMILIES = ["explore", "file", "terminal", "coordination"] as const;
export type EventToolFamily = (typeof EVENT_TOOL_FAMILIES)[number];

export const TODO_STATES = ["added", "in_progress", "completed", "cancelled"] as const;
export type TodoState = (typeof TODO_STATES)[number];

export const QUESTION_PHASES = ["asked", "answered", "concluded"] as const;
export type QuestionPhase = (typeof QUESTION_PHASES)[number];

export const TASK_COMPLETION_REASONS = [
    "idle",
    "assistant_turn_complete",
    "explicit_exit",
    "runtime_terminated",
] as const;
export type TaskCompletionReason = (typeof TASK_COMPLETION_REASONS)[number];

export const AGENT_ACTIVITY_TYPES = [
    "agent_step",
    "mcp_call",
    "skill_use",
    "delegation",
    "handoff",
    "bookmark",
    "search",
] as const;
export type AgentActivityType = (typeof AGENT_ACTIVITY_TYPES)[number];

export const USER_MESSAGE_CAPTURE_MODES = ["raw", "derived"] as const;
export type UserMessageCaptureMode = (typeof USER_MESSAGE_CAPTURE_MODES)[number];

export const USER_MESSAGE_PHASES = ["initial", "follow_up"] as const;
export type UserMessagePhase = (typeof USER_MESSAGE_PHASES)[number];

export type RuntimeIngestEventKind = (typeof KIND)[keyof typeof KIND];

/** 훅이 만들어 원장으로 보내는 이벤트이며 여기 없는 payload 키는 서버 스키마가 버린다. */
export interface RuntimeIngestEvent {
    readonly id?: string;
    readonly kind: RuntimeIngestEventKind;
    readonly taskId: string;
    readonly sessionId?: string;
    /** 인과 부모 이벤트 ID다. */
    readonly parentId?: string;
    /** 트레이스 경계이자 기본 span 부모가 되는 턴 ID다. */
    readonly turnId?: string;
    readonly title: string;
    readonly body?: string;
    readonly lane: EventLane;
    readonly metadata: object;
    readonly filePaths?: readonly string[];
    readonly toolName?: string;
    readonly command?: string;
    readonly taskEffects?: {readonly taskStatus?: string};
}

/** proven 등급의 근거 메타데이터를 만든다. */
export function provenEvidence(reason: string): {evidenceLevel: EvidenceLevel; evidenceReason: string} {
    return {evidenceLevel: "proven", evidenceReason: reason};
}

/** 이벤트가 붙을 태스크와 세션과 진행 중인 턴이다. */
export interface IngestTarget {
    readonly taskId: string;
    readonly sessionId: string;
    readonly turnId?: string;
}

/** 진행 중인 턴이 있으면 이벤트를 그 턴 span의 자식으로 붙인다. */
export function turnOf(target: Pick<IngestTarget, "turnId">): {readonly turnId?: string} {
    return target.turnId ? {turnId: target.turnId} : {};
}
