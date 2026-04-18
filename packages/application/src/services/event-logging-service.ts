import { ActionName, extractPathLikeTokens, type EventId, type MonitoringEventKind, type SessionId, type TaskId, } from "@monitor/domain";
import type { MonitorPorts } from "../ports";
import type { GenericEventInput, TaskActionInput, TaskAgentActivityInput, TaskAsyncLifecycleInput, TaskAssistantResponseInput, TaskContextSavedInput, TaskExploreInput, TaskPlanInput, TaskQuestionInput, TaskRuleInput, TaskTerminalCommandInput, TaskThoughtInput, TaskTodoInput, TaskTokenUsageInput, TaskToolUsedInput, TaskUserMessageInput, TaskVerifyInput, } from "../types.js";
import { EventRecorder } from "./event-recorder.js";
import { TraceMetadataFactory as TMF } from "./trace-metadata-factory.js";
import type { TaskLifecycleService } from "./task-lifecycle-service.js";
export interface RecordedEventEnvelope {
    readonly sessionId?: SessionId;
    readonly events: readonly {
        readonly id: EventId;
        readonly kind: MonitoringEventKind;
    }[];
}
export class EventLoggingService {
    private readonly recorder: EventRecorder;
    private readonly seenAsyncEvents = new Map<string, Set<string>>();
    constructor(private readonly ports: MonitorPorts, private readonly taskLifecycle: TaskLifecycleService) {
        this.recorder = new EventRecorder(ports.events, ports.notifier);
    }
    async logUserMessage(input: TaskUserMessageInput): Promise<RecordedEventEnvelope> {
        await this.taskLifecycle.requireTask(input.taskId);
        const meta = {
            ...(input.metadata ?? {}),
            messageId: input.messageId,
            captureMode: input.captureMode,
            source: input.source,
            phase: input.phase,
            ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
            contractVersion: input.contractVersion ?? "1",
        };
        const existingFilePaths = Array.isArray(input.metadata?.["filePaths"])
            ? (input.metadata["filePaths"] as string[])
            : undefined;
        const filePaths = existingFilePaths && existingFilePaths.length > 0
            ? existingFilePaths
            : input.body
                ? [...extractPathLikeTokens(input.body)]
                : [];
        const event = await this.recorder.record({
            taskId: input.taskId,
            kind: "user.message",
            title: input.title,
            ...this.withSessionId(input.sessionId),
            ...(input.body ? { body: input.body } : {}),
            ...(filePaths.length > 0 ? { filePaths } : {}),
            metadata: meta,
        });
        return {
            ...this.withSessionId(input.sessionId),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
    async logAssistantResponse(input: TaskAssistantResponseInput): Promise<RecordedEventEnvelope> {
        await this.taskLifecycle.requireTask(input.taskId);
        const event = await this.recorder.record({
            taskId: input.taskId,
            kind: "assistant.response",
            title: input.title,
            ...this.withSessionId(input.sessionId),
            ...(input.body ? { body: input.body } : {}),
            metadata: {
                ...(input.metadata ?? {}),
                messageId: input.messageId,
                source: input.source,
            },
        });
        return {
            ...this.withSessionId(input.sessionId),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
    async logTokenUsage(input: TaskTokenUsageInput): Promise<RecordedEventEnvelope> {
        await this.taskLifecycle.requireTask(input.taskId);
        const event = await this.recorder.record({
            taskId: input.taskId,
            kind: "token.usage",
            lane: "telemetry",
            title: input.model ? `API call (${input.model})` : "API call",
            body: buildTokenUsageBody(input),
            ...this.withSessionId(input.sessionId),
            ...(input.apiCalledAt ? { createdAt: input.apiCalledAt } : {}),
            metadata: {
                inputTokens: input.inputTokens,
                outputTokens: input.outputTokens,
                cacheReadTokens: input.cacheReadTokens,
                cacheCreateTokens: input.cacheCreateTokens,
                ...(input.costUsd != null ? { costUsd: input.costUsd } : {}),
                ...(input.durationMs != null ? { durationMs: input.durationMs } : {}),
                ...(input.model ? { model: input.model } : {}),
                ...(input.promptId ? { promptId: input.promptId } : {}),
                source: "otlp",
            },
        });
        return {
            ...this.withSessionId(input.sessionId),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
    async logTerminalCommand(input: TaskTerminalCommandInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "terminal.command",
            title: input.title ?? input.command,
            body: input.body ?? input.command,
            metadata: {
                ...(input.metadata ?? {}),
                command: input.command,
            },
            command: input.command,
            ...this.withSessionId(sid),
            ...(input.lane ? { lane: input.lane } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    async logToolUsed(input: TaskToolUsedInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "tool.used",
            title: input.title ?? input.toolName,
            metadata: TMF.build({ ...(input.metadata ?? {}), toolName: input.toolName }, input),
            toolName: input.toolName,
            ...this.withSessionId(sid),
            ...(input.body ? { body: input.body } : {}),
            ...(input.lane ? { lane: input.lane } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    async saveContext(input: TaskContextSavedInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "context.saved",
            title: input.title,
            ...this.withSessionId(sid),
            ...(input.body ? { body: input.body } : {}),
            ...(input.lane ? { lane: input.lane } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
            metadata: TMF.build(input.metadata, input),
        }));
    }
    async logInstructionsLoaded(input: TaskContextSavedInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "instructions.loaded",
            title: input.title,
            ...this.withSessionId(sid),
            ...(input.body ? { body: input.body } : {}),
            ...(input.lane ? { lane: input.lane } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
            metadata: TMF.build(input.metadata, input),
        }));
    }
    async logSessionEnded(input: TaskContextSavedInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "session.ended",
            lane: input.lane ?? "user",
            title: input.title,
            ...this.withSessionId(sid),
            ...(input.body ? { body: input.body } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
            metadata: TMF.build(input.metadata, input),
        }));
    }
    async logExploration(input: TaskExploreInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "tool.used",
            lane: input.lane ?? "exploration",
            title: input.title,
            metadata: TMF.build({ ...(input.metadata ?? {}), toolName: input.toolName }, input),
            toolName: input.toolName,
            ...this.withSessionId(sid),
            ...(input.body ? { body: input.body } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    async logPlan(input: TaskPlanInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "plan.logged",
            lane: "planning",
            title: input.title ?? input.action,
            metadata: TMF.build({ ...(input.metadata ?? {}), action: input.action }, input),
            actionName: input.action,
            ...this.withSessionId(sid),
            ...(input.body ? { body: input.body } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    async logAction(input: TaskActionInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "action.logged",
            title: input.title ?? input.action,
            metadata: TMF.build({ ...(input.metadata ?? {}), action: input.action }, input),
            actionName: input.action,
            ...this.withSessionId(sid),
            ...(input.body ? { body: input.body } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    async logVerification(input: TaskVerifyInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "verification.logged",
            lane: "implementation",
            title: input.title ?? input.action,
            body: input.body ?? input.result,
            metadata: TMF.build({
                ...(input.metadata ?? {}),
                action: input.action,
                result: input.result,
                verificationStatus: TMF.normalizeVerificationStatus(input.status ?? input.result),
            }, input),
            actionName: input.action,
            ...this.withSessionId(sid),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    async logRule(input: TaskRuleInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "rule.logged",
            lane: "implementation",
            title: input.title ?? input.action,
            body: input.body ??
                `${input.ruleId} · ${input.status} · ${input.severity}`,
            metadata: TMF.build({
                ...(input.metadata ?? {}),
                action: input.action,
                ruleId: input.ruleId,
                severity: input.severity,
                ruleStatus: input.status,
                ruleSource: input.source ?? "rule-guard",
                ...(input.policy ? { rulePolicy: input.policy } : {}),
                ...(input.outcome ? { ruleOutcome: input.outcome } : {}),
            }, input),
            actionName: input.action,
            ...this.withSessionId(sid),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    async logAsyncLifecycle(input: TaskAsyncLifecycleInput): Promise<RecordedEventEnvelope> {
        const dedupeKey = `${input.asyncTaskId}:${input.asyncStatus}`;
        const taskSeen = this.seenAsyncEvents.get(input.taskId) ?? new Set<string>();
        if (taskSeen.has(dedupeKey)) {
            return {
                events: [],
            };
        }
        taskSeen.add(dedupeKey);
        this.seenAsyncEvents.set(input.taskId, taskSeen);
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "action.logged",
            lane: "background",
            title: input.title ?? `Async task ${input.asyncStatus}`,
            metadata: TMF.build({
                ...(input.metadata ?? {}),
                asyncTaskId: input.asyncTaskId,
                asyncStatus: input.asyncStatus,
                ...(input.description
                    ? { description: input.description }
                    : {}),
                ...(input.agent ? { asyncAgent: input.agent } : {}),
                ...(input.category
                    ? { asyncCategory: input.category }
                    : {}),
                ...(input.parentSessionId
                    ? { parentSessionId: input.parentSessionId }
                    : {}),
                ...(typeof input.durationMs === "number"
                    ? { asyncDurationMs: input.durationMs }
                    : {}),
            }, input),
            actionName: ActionName(`async_task_${input.asyncStatus}`),
            ...this.withSessionId(sid),
            ...(input.body || input.description
                ? { body: input.body ?? input.description }
                : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    async logQuestion(input: TaskQuestionInput): Promise<RecordedEventEnvelope> {
        await this.taskLifecycle.requireTask(input.taskId);
        const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
        const event = await this.recorder.record({
            taskId: input.taskId,
            kind: "question.logged",
            lane: "questions",
            title: input.title,
            ...this.withSessionId(sessionId),
            ...(input.body ? { body: input.body } : {}),
            metadata: TMF.build({
                ...(input.metadata ?? {}),
                questionId: input.questionId,
                questionPhase: input.questionPhase,
                ...(typeof input.sequence === "number"
                    ? { sequence: input.sequence }
                    : {}),
                ...(input.modelName ? { modelName: input.modelName } : {}),
                ...(input.modelProvider
                    ? { modelProvider: input.modelProvider }
                    : {}),
            }, input),
        });
        return {
            ...this.withSessionId(sessionId),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
    async logTodo(input: TaskTodoInput): Promise<RecordedEventEnvelope> {
        await this.taskLifecycle.requireTask(input.taskId);
        const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
        const event = await this.recorder.record({
            taskId: input.taskId,
            kind: "todo.logged",
            lane: "todos",
            title: input.title,
            ...this.withSessionId(sessionId),
            ...(input.body ? { body: input.body } : {}),
            metadata: TMF.build({
                ...(input.metadata ?? {}),
                todoId: input.todoId,
                todoState: input.todoState,
                ...(typeof input.sequence === "number"
                    ? { sequence: input.sequence }
                    : {}),
            }, input),
        });
        return {
            ...this.withSessionId(sessionId),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
    async logThought(input: TaskThoughtInput): Promise<RecordedEventEnvelope> {
        await this.taskLifecycle.requireTask(input.taskId);
        const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
        const event = await this.recorder.record({
            taskId: input.taskId,
            kind: "thought.logged",
            lane: "planning",
            title: input.title,
            ...this.withSessionId(sessionId),
            ...(input.body ? { body: input.body } : {}),
            metadata: TMF.build({
                ...(input.metadata ?? {}),
                ...(input.modelName ? { modelName: input.modelName } : {}),
                ...(input.modelProvider
                    ? { modelProvider: input.modelProvider }
                    : {}),
            }, input),
        });
        return {
            ...this.withSessionId(sessionId),
            events: [{ id: event.id, kind: event.kind }],
        };
    }
    async logAgentActivity(input: TaskAgentActivityInput): Promise<RecordedEventEnvelope> {
        return this.withSession(input, (sid) => ({
            taskId: input.taskId,
            kind: "agent.activity.logged",
            lane: input.lane ?? "coordination",
            title: input.title ??
                TMF.normalizeAgentActivityTitle(input.activityType),
            metadata: TMF.build(input.metadata, input),
            ...this.withSessionId(sid),
            ...(input.body ? { body: input.body } : {}),
            ...(input.filePaths ? { filePaths: input.filePaths } : {}),
        }));
    }
    private withSessionId(sessionId?: SessionId): {
        sessionId?: SessionId;
    } {
        return sessionId ? { sessionId } : {};
    }
    private async resolveSessionId(taskId: TaskId, sessionId?: SessionId): Promise<SessionId | undefined> {
        if (sessionId) {
            return sessionId;
        }
        return (await this.ports.sessions.findActiveByTaskId(taskId))?.id;
    }
    private async withSession(input: {
        taskId: TaskId;
        sessionId?: SessionId;
    }, buildEvent: (sessionId: SessionId | undefined) => GenericEventInput): Promise<RecordedEventEnvelope> {
        const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
        return this.recordWithDerivedFiles(buildEvent(sessionId));
    }
    private async recordWithDerivedFiles(input: GenericEventInput): Promise<RecordedEventEnvelope> {
        return this.recorder.recordWithDerivedFiles(input);
    }
}

function buildTokenUsageBody(input: TaskTokenUsageInput): string {
    const parts: string[] = [];
    if (input.model) parts.push(input.model);
    if (input.durationMs != null) parts.push(`${(input.durationMs / 1000).toFixed(1)}s`);
    const tokenParts: string[] = [];
    if (input.inputTokens) tokenParts.push(`${input.inputTokens.toLocaleString()} in`);
    if (input.outputTokens) tokenParts.push(`${input.outputTokens.toLocaleString()} out`);
    if (input.cacheReadTokens) tokenParts.push(`${input.cacheReadTokens.toLocaleString()} cache read`);
    if (input.cacheCreateTokens) tokenParts.push(`${input.cacheCreateTokens.toLocaleString()} cache write`);
    if (tokenParts.length > 0) parts.push(tokenParts.join(" / "));
    if (input.costUsd != null) parts.push(`$${input.costUsd.toFixed(4)}`);
    return parts.join(" · ");
}
