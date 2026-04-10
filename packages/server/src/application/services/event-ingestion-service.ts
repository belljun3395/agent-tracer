import type { MonitorService } from "../monitor-service.js"
import type { IngestEventItem } from "../../presentation/schemas.ingest.js"
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
    type EventId,
} from "@monitor/core"

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

    async ingest(events: readonly IngestEventItem[]): Promise<IngestResult> {
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

    private async dispatchEvent(e: IngestEventItem) {
        const taskId = TaskId(e.taskId)
        const sessionId = e.sessionId ? SessionId(e.sessionId) : undefined
        const base = {
            taskId,
            ...(sessionId ? { sessionId } : {}),
            ...(e.title ? { title: e.title } : {}),
            ...(e.body ? { body: e.body } : {}),
            ...(e.lane ? { lane: e.lane } : {}),
            ...(e.filePaths ? { filePaths: e.filePaths } : {}),
            ...(e.metadata ? { metadata: e.metadata } : {}),
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
                if (e.lane === "exploration") {
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

            default:
                throw new Error(`Unsupported event kind: ${String(e.kind)}`)
        }
    }
}
