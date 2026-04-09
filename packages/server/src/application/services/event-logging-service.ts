import { ActionName, extractPathLikeTokens, type EventId, type MonitoringEventKind, type SessionId, type TaskId, } from "@monitor/core";
import type { MonitorPorts } from "../ports";
import type { GenericEventInput, TaskActionInput, TaskAgentActivityInput, TaskAsyncLifecycleInput, TaskAssistantResponseInput, TaskContextSavedInput, TaskExploreInput, TaskPlanInput, TaskQuestionInput, TaskRuleInput, TaskTerminalCommandInput, TaskThoughtInput, TaskTodoInput, TaskToolUsedInput, TaskUserMessageInput, TaskVerifyInput, } from "../types.js";
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
        if (input.captureMode === "derived" &&
            !input.sourceEventId) {
            throw new Error("sourceEventId is required when captureMode is 'derived'.");
        }
        const phase = input.phase ??
            ((await this.ports.events.countRawUserMessages(input.taskId)) === 0
                ? "initial"
                : "follow_up");
        const meta = {
            ...(input.metadata ?? {}),
            messageId: input.messageId,
            captureMode: input.captureMode,
            source: input.source,
            phase,
            ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
            contractVersion: input.contractVersion ?? "1",
        };
        const existingFilePaths = Array.isArray(input.metadata?.["filePaths"])
            ? (input.metadata["filePaths"] as string[]).filter((p): p is string => typeof p === "string")
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
