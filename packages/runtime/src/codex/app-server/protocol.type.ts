export interface CodexAppServerThread {
    readonly id: string;
    readonly name: string | null;
    readonly status: string;
    readonly cwd?: string | null;
    readonly source?: string | null;
}

export interface CodexAppServerTurnError {
    readonly message: string;
    readonly codexErrorInfo?: Record<string, unknown> | null;
    readonly additionalDetails?: unknown;
}

export interface CodexAppServerTurn {
    readonly id: string;
    readonly status: "completed" | "interrupted" | "failed" | "inProgress";
    readonly items: readonly unknown[];
    readonly error: CodexAppServerTurnError | null;
    readonly startedAt: number | null;
    readonly completedAt: number | null;
    readonly durationMs: number | null;
}

export interface CodexAppServerTurnPlanStep {
    readonly step: string;
    readonly status: "pending" | "inProgress" | "completed";
}

export type CodexAppServerPatchChangeKind =
    | { readonly type: "add" }
    | { readonly type: "delete" }
    | { readonly type: "update"; readonly move_path: string | null };

export interface CodexAppServerFileUpdateChange {
    readonly path: string;
    readonly kind: CodexAppServerPatchChangeKind;
    readonly diff: string;
}

export interface CodexAppServerAgentMessageItem {
    readonly type: "agentMessage";
    readonly id: string;
    readonly text: string;
    readonly phase: "commentary" | "final_answer" | null;
    readonly memoryCitation: unknown;
}

export interface CodexAppServerPlanItem {
    readonly type: "plan";
    readonly id: string;
    readonly text: string;
}

export interface CodexAppServerReasoningItem {
    readonly type: "reasoning";
    readonly id: string;
    readonly summary: readonly string[];
    readonly content: readonly string[];
}

export interface CodexAppServerCommandExecutionItem {
    readonly type: "commandExecution";
    readonly id: string;
    readonly command: string;
    readonly cwd: string;
    readonly processId: string | null;
    readonly source: string | null;
    readonly status: "inProgress" | "completed" | "failed" | "declined";
    readonly commandActions: readonly unknown[];
    readonly aggregatedOutput: string | null;
    readonly exitCode: number | null;
    readonly durationMs: number | null;
}

export interface CodexAppServerFileChangeItem {
    readonly type: "fileChange";
    readonly id: string;
    readonly changes: readonly CodexAppServerFileUpdateChange[];
    readonly status: "inProgress" | "completed" | "failed" | "declined";
}

export interface CodexAppServerMcpToolCallItem {
    readonly type: "mcpToolCall";
    readonly id: string;
    readonly server: string;
    readonly tool: string;
    readonly status: "inProgress" | "completed" | "failed";
    readonly arguments: unknown;
    readonly result: unknown;
    readonly error: unknown;
    readonly durationMs: number | null;
}

export interface CodexAppServerSimpleItem {
    readonly type:
        | "userMessage"
        | "hookPrompt"
        | "dynamicToolCall"
        | "collabAgentToolCall"
        | "webSearch"
        | "imageView"
        | "imageGeneration"
        | "enteredReviewMode"
        | "exitedReviewMode"
        | "contextCompaction";
    readonly id: string;
    readonly [key: string]: unknown;
}

export type CodexAppServerThreadItem =
    | CodexAppServerAgentMessageItem
    | CodexAppServerPlanItem
    | CodexAppServerReasoningItem
    | CodexAppServerCommandExecutionItem
    | CodexAppServerFileChangeItem
    | CodexAppServerMcpToolCallItem
    | CodexAppServerSimpleItem;

export type CodexAppServerNotification =
    | {
        readonly method: "thread/started";
        readonly params: {
            readonly thread: CodexAppServerThread;
        };
    }
    | {
        readonly method: "turn/started" | "turn/completed";
        readonly params: {
            readonly threadId: string;
            readonly turn: CodexAppServerTurn;
        };
    }
    | {
        readonly method: "turn/plan/updated";
        readonly params: {
            readonly threadId: string;
            readonly turnId: string;
            readonly explanation: string | null;
            readonly plan: readonly CodexAppServerTurnPlanStep[];
        };
    }
    | {
        readonly method: "item/started" | "item/completed";
        readonly params: {
            readonly threadId: string;
            readonly turnId: string;
            readonly item: CodexAppServerThreadItem;
        };
    };
