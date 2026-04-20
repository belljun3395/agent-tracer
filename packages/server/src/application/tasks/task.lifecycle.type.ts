import type {
    MonitoringEventKind,
    MonitoringTask,
    MonitoringTaskKind,
    TaskStatus,
    TaskCompletionReason,
} from "~domain/index.js";

export interface RecordedEventEnvelope {
    readonly task: MonitoringTask;
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: MonitoringEventKind }[];
}

export interface TaskStartInput {
    readonly taskId?: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly runtimeSource?: string;
    readonly summary?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface TaskLinkInput {
    readonly taskId: string;
    readonly title?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface TaskPatchInput {
    readonly taskId: string;
    readonly title?: string;
    readonly status?: TaskStatus;
}

export interface TaskCompletionInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly metadata?: Record<string, unknown>;
}

export interface TaskErrorInput extends TaskCompletionInput {
    readonly errorMessage: string;
}

export interface TaskSessionEndInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly summary?: string;
    readonly backgroundCompletions?: string[];
    readonly metadata?: Record<string, unknown>;
}

export interface RuntimeSessionEnsureInput {
    readonly taskId?: string;
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    // When false, the ensure call is read-only: it never resumes a terminal task or
    // creates a new session — it just resolves the most recent (taskId, sessionId).
    // Trailing telemetry/ending hooks (StatusLine, SessionEnd, PreCompact, …) must
    // pass false so that late-firing events don't flip a completed task to "running".
    // Default (true) preserves existing behavior for UserPromptSubmit et al.
    readonly resume?: boolean;
}

export interface RuntimeSessionEnsureResult {
    readonly taskId: string;
    readonly sessionId: string;
    readonly taskCreated: boolean;
    readonly sessionCreated: boolean;
}

export interface RuntimeSessionEndInput {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly summary?: string;
    readonly completeTask?: boolean;
    readonly completionReason?: TaskCompletionReason;
    readonly backgroundCompletions?: readonly string[];
}
