import type { MonitorService } from "../monitor-service.js"
import {
    TaskId,
    SessionId,
    ActionName,
    ToolName,
    RuleId,
    AsyncTaskId,
    MessageId,
    QuestionId,
    TodoId,
    ModelName,
    ModelProvider,
    type AgentActivityType,
    type EventId,
    type EventRelationType,
    type MonitoringEventKind,
    type QuestionPhase,
    type TimelineLane,
    type TodoState,
} from "@monitor/domain"
import {
    classifyEvent,
    deriveSemanticMetadata,
    buildSemanticMetadata,
    inferCommandSemantic,
} from "@monitor/classification"

/**
 * Structural input contract for batch event ingestion. Adapters (HTTP, WS, etc.)
 * decode their wire format to this shape before invoking the use case.
 */
export interface IngestEventInput {
    readonly kind: string
    readonly taskId: string
    readonly sessionId?: string | undefined
    readonly title?: string | undefined
    readonly body?: string | undefined
    readonly lane?: TimelineLane | undefined
    readonly filePaths?: readonly string[] | undefined
    readonly metadata?: Record<string, unknown> | undefined
    readonly parentEventId?: string | undefined
    readonly relatedEventIds?: readonly string[] | undefined
    readonly relationType?: EventRelationType | undefined
    readonly relationLabel?: string | undefined
    readonly relationExplanation?: string | undefined
    readonly toolName?: string | undefined
    readonly command?: string | undefined
    readonly action?: string | undefined
    readonly result?: string | undefined
    readonly ruleId?: string | undefined
    readonly severity?: string | undefined
    readonly status?: string | undefined
    readonly source?: string | undefined
    readonly policy?: "audit" | "warn" | "block" | "approval_required" | undefined
    readonly outcome?: "observed" | "warned" | "blocked" | "approval_requested" | "approved" | "rejected" | "bypassed" | undefined
    readonly asyncTaskId?: string | undefined
    readonly asyncStatus?: "pending" | "running" | "completed" | "error" | "cancelled" | "interrupt" | undefined
    readonly description?: string | undefined
    readonly agent?: string | undefined
    readonly category?: string | undefined
    readonly parentSessionId?: string | undefined
    readonly durationMs?: number | undefined
    readonly activityType?: AgentActivityType | undefined
    readonly agentName?: string | undefined
    readonly skillName?: string | undefined
    readonly skillPath?: string | undefined
    readonly mcpServer?: string | undefined
    readonly mcpTool?: string | undefined
    readonly messageId?: string | undefined
    readonly captureMode?: "raw" | "derived" | undefined
    readonly phase?: "initial" | "follow_up" | undefined
    readonly sourceEventId?: string | undefined
    readonly contractVersion?: string | undefined
    readonly questionId?: string | undefined
    readonly questionPhase?: QuestionPhase | undefined
    readonly sequence?: number | undefined
    readonly todoId?: string | undefined
    readonly todoState?: TodoState | undefined
    readonly modelName?: string | undefined
    readonly modelProvider?: string | undefined
}

export interface IngestAccepted {
    readonly eventId: EventId
    readonly kind: string
    readonly taskId: string
}

export interface IngestRejected {
    readonly index: number
    readonly code: string
    readonly message: string
}

export interface IngestResult {
    readonly accepted: readonly IngestAccepted[]
    readonly rejected: readonly IngestRejected[]
}

export class EventIngestionService {
    constructor(private readonly monitor: MonitorService) {}

    async ingest(events: readonly IngestEventInput[]): Promise<IngestResult> {
        const accepted: IngestAccepted[] = []
        const rejected: IngestRejected[] = []

        for (let i = 0; i < events.length; i++) {
            const event = events[i]!
            try {
                const result = await this.dispatchEvent(event)
                for (const ev of result.events) {
                    accepted.push({ eventId: ev.id, kind: ev.kind, taskId: event.taskId })
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error"
                const code = message.includes("not found") ? "task_not_found" : "ingestion_error"
                rejected.push({ index: i, code, message })
            }
        }

        return { accepted, rejected }
    }

    private async dispatchEvent(e: IngestEventInput) {
        const taskId = TaskId(e.taskId)
        const sessionId = e.sessionId ? SessionId(e.sessionId) : undefined
        // For tool.used events the tool name is the closest signal we have to
        // an action verb — fall back to it so "Read"/"Grep"/"Glob" etc. still
        // classify as exploration when the caller omits an explicit action.
        const actionHint = e.action ?? (e.kind === "tool.used" ? e.toolName : undefined)
        // Terminal commands carry a stronger lane signal than the generic default:
        // read-only probes (`ls`, `git status`) belong on exploration; everything
        // else on implementation. Use inferCommandSemantic to pre-seed the lane
        // when the caller didn't pin it explicitly.
        const commandLaneHint: TimelineLane | undefined =
            !e.lane && e.kind === "terminal.command" && e.command
                ? inferCommandSemantic(e.command).lane
                : undefined
        const classification = classifyEvent({
            kind: e.kind as MonitoringEventKind,
            ...(e.title ? { title: e.title } : {}),
            ...(e.body ? { body: e.body } : {}),
            ...(e.command ? { command: e.command } : {}),
            ...(e.toolName ? { toolName: ToolName(e.toolName) } : {}),
            ...(actionHint ? { actionName: ActionName(actionHint) } : {}),
            ...(e.filePaths ? { filePaths: e.filePaths } : {}),
            ...(e.lane ?? commandLaneHint ? { lane: e.lane ?? commandLaneHint! } : {}),
        })
        const resolvedLane: TimelineLane = classification.lane

        // Derive semantic metadata (subtypeKey/toolFamily/operation/…) from the
        // raw ingest payload. Phase 6b: plugin still sends these fields, so we
        // merge with caller-wins semantics (explicit metadata overrides derived).
        // Phase 6c strips the plugin pipeline and server-derived becomes the
        // sole source.
        const derived = deriveSemanticMetadata({
            kind: e.kind,
            ...(e.toolName ? { toolName: e.toolName } : {}),
            ...(e.command ? { command: e.command } : {}),
            ...(e.filePaths ? { filePaths: e.filePaths } : {}),
            ...(e.metadata ? { metadata: e.metadata } : {}),
            ...(e.activityType ? { activityType: e.activityType } : {}),
            ...(e.mcpServer ? { mcpServer: e.mcpServer } : {}),
            ...(e.mcpTool ? { mcpTool: e.mcpTool } : {}),
            ...(e.agentName ? { agentName: e.agentName } : {}),
            ...(e.skillName ? { skillName: e.skillName } : {}),
        })
        const mergedMetadata: Record<string, unknown> | undefined = (() => {
            if (!derived && !e.metadata) return undefined
            const derivedRecord = derived ? buildSemanticMetadata(derived) : {}
            return { ...derivedRecord, ...(e.metadata ?? {}) }
        })()

        const base = {
            taskId,
            ...(sessionId ? { sessionId } : {}),
            ...(e.title ? { title: e.title } : {}),
            ...(e.body ? { body: e.body } : {}),
            lane: resolvedLane,
            ...(e.filePaths ? { filePaths: e.filePaths } : {}),
            ...(mergedMetadata ? { metadata: mergedMetadata } : {}),
        }
        const relations = {
            ...(e.parentEventId ? { parentEventId: e.parentEventId as EventId } : {}),
            ...(e.relatedEventIds ? { relatedEventIds: e.relatedEventIds as EventId[] } : {}),
            ...(e.relationType ? { relationType: e.relationType } : {}),
            ...(e.relationLabel ? { relationLabel: e.relationLabel } : {}),
            ...(e.relationExplanation ? { relationExplanation: e.relationExplanation } : {}),
        }

        switch (e.kind) {
            case "tool.used":
                if (resolvedLane === "exploration") {
                    return this.monitor.logExploration({
                        ...base,
                        title: e.title ?? e.toolName ?? "Explore",
                        toolName: ToolName(e.toolName ?? ""),
                        ...relations,
                    })
                }
                return this.monitor.logToolUsed({
                    ...base,
                    toolName: ToolName(e.toolName ?? ""),
                    ...relations,
                })

            case "terminal.command":
                return this.monitor.logTerminalCommand({
                    ...base,
                    command: e.command ?? "",
                    ...relations,
                })

            case "context.saved":
                return this.monitor.saveContext({
                    ...base,
                    title: e.title ?? "Context",
                    ...relations,
                })

            case "instructions.loaded":
                return this.monitor.logInstructionsLoaded({
                    ...base,
                    title: e.title ?? "Instructions loaded",
                    ...relations,
                })

            case "session.ended":
                return this.monitor.logSessionEnded({
                    ...base,
                    title: e.title ?? "Session ended",
                    ...relations,
                })

            case "plan.logged":
                return this.monitor.logPlan({
                    ...base,
                    action: ActionName(e.action ?? ""),
                    ...relations,
                })

            case "action.logged":
                if (e.asyncTaskId) {
                    return this.monitor.logAsyncLifecycle({
                        ...base,
                        asyncTaskId: AsyncTaskId(e.asyncTaskId),
                        asyncStatus: e.asyncStatus ?? "running",
                        ...(e.description ? { description: e.description } : {}),
                        ...(e.agent ? { agent: e.agent } : {}),
                        ...(e.category ? { category: e.category } : {}),
                        ...(e.parentSessionId ? { parentSessionId: SessionId(e.parentSessionId) } : {}),
                        ...(typeof e.durationMs === "number" ? { durationMs: e.durationMs } : {}),
                        ...relations,
                    })
                }
                return this.monitor.logAction({
                    ...base,
                    action: ActionName(e.action ?? ""),
                    ...relations,
                })

            case "verification.logged":
                return this.monitor.logVerification({
                    ...base,
                    action: ActionName(e.action ?? ""),
                    result: e.result ?? "",
                    ...(e.status ? { status: e.status } : {}),
                    ...relations,
                })

            case "rule.logged":
                return this.monitor.logRule({
                    ...base,
                    action: ActionName(e.action ?? ""),
                    ruleId: RuleId(e.ruleId ?? ""),
                    severity: e.severity ?? "info",
                    status: e.status ?? "ok",
                    ...(e.source ? { source: e.source } : {}),
                    ...(e.policy ? { policy: e.policy } : {}),
                    ...(e.outcome ? { outcome: e.outcome } : {}),
                    ...relations,
                })

            case "agent.activity.logged":
                return this.monitor.logAgentActivity({
                    ...base,
                    activityType: e.activityType ?? "agent_step",
                    ...(e.agentName ? { agentName: e.agentName } : {}),
                    ...(e.skillName ? { skillName: e.skillName } : {}),
                    ...(e.skillPath ? { skillPath: e.skillPath } : {}),
                    ...(e.mcpServer ? { mcpServer: e.mcpServer } : {}),
                    ...(e.mcpTool ? { mcpTool: e.mcpTool } : {}),
                    ...relations,
                })

            case "user.message":
                return this.monitor.logUserMessage({
                    ...base,
                    sessionId: SessionId(e.sessionId ?? ""),
                    messageId: MessageId(e.messageId ?? ""),
                    captureMode: e.captureMode ?? "raw",
                    source: e.source ?? "unknown",
                    phase: e.phase ?? "initial",
                    title: e.title ?? "",
                    ...(e.sourceEventId ? { sourceEventId: e.sourceEventId as EventId } : {}),
                    ...(e.contractVersion ? { contractVersion: e.contractVersion } : {}),
                    ...relations,
                })

            case "question.logged":
                return this.monitor.logQuestion({
                    ...base,
                    questionId: QuestionId(e.questionId ?? ""),
                    questionPhase: e.questionPhase ?? "asked",
                    title: e.title ?? "",
                    ...(typeof e.sequence === "number" ? { sequence: e.sequence } : {}),
                    ...(e.modelName ? { modelName: ModelName(e.modelName) } : {}),
                    ...(e.modelProvider ? { modelProvider: ModelProvider(e.modelProvider) } : {}),
                    ...relations,
                })

            case "todo.logged":
                return this.monitor.logTodo({
                    ...base,
                    todoId: TodoId(e.todoId ?? ""),
                    todoState: e.todoState ?? "added",
                    title: e.title ?? "",
                    ...(typeof e.sequence === "number" ? { sequence: e.sequence } : {}),
                    ...relations,
                })

            case "thought.logged":
                return this.monitor.logThought({
                    ...base,
                    title: e.title ?? "",
                    ...(e.modelName ? { modelName: ModelName(e.modelName) } : {}),
                    ...(e.modelProvider ? { modelProvider: ModelProvider(e.modelProvider) } : {}),
                    ...relations,
                })

            case "assistant.response":
                return this.monitor.logAssistantResponse({
                    ...base,
                    messageId: MessageId(e.messageId ?? ""),
                    source: e.source ?? "unknown",
                    title: e.title ?? "",
                })

            case "token.usage":
                return this.monitor.logTokenUsage({
                    taskId,
                    ...(sessionId ? { sessionId } : {}),
                    inputTokens: typeof e.metadata?.["inputTokens"] === "number" ? e.metadata["inputTokens"] : 0,
                    outputTokens: typeof e.metadata?.["outputTokens"] === "number" ? e.metadata["outputTokens"] : 0,
                    cacheReadTokens: typeof e.metadata?.["cacheReadTokens"] === "number" ? e.metadata["cacheReadTokens"] : 0,
                    cacheCreateTokens: typeof e.metadata?.["cacheCreateTokens"] === "number" ? e.metadata["cacheCreateTokens"] : 0,
                    ...(typeof e.metadata?.["costUsd"] === "number" ? { costUsd: e.metadata["costUsd"] } : {}),
                    ...(typeof e.metadata?.["durationMs"] === "number" ? { durationMs: e.metadata["durationMs"] } : {}),
                    ...(typeof e.metadata?.["model"] === "string" ? { model: e.metadata["model"] } : {}),
                    ...(typeof e.metadata?.["promptId"] === "string" ? { promptId: e.metadata["promptId"] } : {}),
                })

            default:
                throw new Error(`Unsupported event kind: ${String(e.kind)}`)
        }
    }
}
