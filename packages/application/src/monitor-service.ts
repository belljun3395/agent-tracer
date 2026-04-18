import { BookmarkId, normalizeWorkspacePath, type EventId, type MonitoringEventKind, type MonitoringTask, type PlaybookStatus, type ReusableTaskSnapshot, type RuntimeSessionId, type RuntimeSource, type SessionId, type TaskId, type TimelineEvent, } from "@monitor/domain";
import { buildOpenInferenceTaskExport } from "./interop/openinference.js";
import type { MonitorPorts, BookmarkRecord, SearchResults, } from "./ports";
import type { TaskActionInput, TaskAgentActivityInput, TaskBookmarkDeleteInput, TaskBookmarkInput, TaskCompletionInput, TaskContextSavedInput, TaskErrorInput, TaskExploreInput, TaskAsyncLifecycleInput, TaskPlanInput, TaskLinkInput, TaskQuestionInput, TaskPatchInput, TaskRuleInput, TaskSessionEndInput, TaskStartInput, TaskTerminalCommandInput, TaskThoughtInput, TaskTodoInput, TaskTokenUsageInput, TaskToolUsedInput, TaskUserMessageInput, TaskVerifyInput, RuntimeSessionEnsureInput, RuntimeSessionEnsureResult, RuntimeSessionEndInput, TaskSearchInput, TaskAssistantResponseInput, EventPatchInput, } from "./types.js";
import { analyzeObservabilityOverview, analyzeTaskObservability, type ObservabilityOverviewResponse, type TaskObservabilityResponse, } from "./observability.js";
import { TaskLifecycleService } from "./services/task-lifecycle-service.js";
import { EventLoggingService } from "./services/event-logging-service.js";
import { WorkflowEvaluationService } from "./services/workflow-evaluation-service.js";
export type { BookmarkRecord, SearchResults };
export interface RecordedEventEnvelope {
    readonly task: MonitoringTask;
    readonly sessionId?: SessionId;
    readonly events: readonly {
        readonly id: EventId;
        readonly kind: MonitoringEventKind;
    }[];
}
export class MonitorService {
    private readonly taskLifecycle: TaskLifecycleService;
    private readonly eventLogging: EventLoggingService;
    private readonly workflowEvaluation: WorkflowEvaluationService;
    constructor(private readonly ports: MonitorPorts) {
        this.taskLifecycle = new TaskLifecycleService(ports);
        this.eventLogging = new EventLoggingService(ports, this.taskLifecycle);
        this.workflowEvaluation = new WorkflowEvaluationService(ports, this.taskLifecycle);
    }
    async startTask(input: TaskStartInput): Promise<RecordedEventEnvelope> {
        return this.taskLifecycle.startTask(input);
    }
    async completeTask(input: TaskCompletionInput): Promise<RecordedEventEnvelope> {
        return this.taskLifecycle.completeTask(input);
    }
    async errorTask(input: TaskErrorInput): Promise<RecordedEventEnvelope> {
        return this.taskLifecycle.errorTask(input);
    }
    async logUserMessage(input: TaskUserMessageInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logUserMessage(input);
        return { task, ...result };
    }
    async logAssistantResponse(input: TaskAssistantResponseInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logAssistantResponse(input);
        return { task, ...result };
    }
    async logTokenUsage(input: TaskTokenUsageInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logTokenUsage(input);
        return { task, ...result };
    }
    async endSession(input: TaskSessionEndInput): Promise<{
        sessionId: SessionId;
        task: MonitoringTask;
    }> {
        return this.taskLifecycle.endSession(input);
    }
    async ensureRuntimeSession(input: RuntimeSessionEnsureInput): Promise<RuntimeSessionEnsureResult> {
        return this.taskLifecycle.ensureRuntimeSession(input);
    }
    async endRuntimeSession(input: RuntimeSessionEndInput): Promise<void> {
        return this.taskLifecycle.endRuntimeSession(input);
    }
    async logTerminalCommand(input: TaskTerminalCommandInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logTerminalCommand(input);
        return { task, ...result };
    }
    async logToolUsed(input: TaskToolUsedInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logToolUsed(input);
        return { task, ...result };
    }
    async saveContext(input: TaskContextSavedInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.saveContext(input);
        return { task, ...result };
    }
    async logInstructionsLoaded(input: TaskContextSavedInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logInstructionsLoaded(input);
        return { task, ...result };
    }
    async logSessionEnded(input: TaskContextSavedInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logSessionEnded(input);
        return { task, ...result };
    }
    async logExploration(input: TaskExploreInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logExploration(input);
        return { task, ...result };
    }
    async logPlan(input: TaskPlanInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logPlan(input);
        return { task, ...result };
    }
    async logAction(input: TaskActionInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logAction(input);
        return { task, ...result };
    }
    async logVerification(input: TaskVerifyInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logVerification(input);
        return { task, ...result };
    }
    async logRule(input: TaskRuleInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logRule(input);
        const updatedTask = await this.applyRuleEnforcementStatus(input, result.events.length > 0 ? { ...task, ...result } : task);
        return {
            ...result,
            task: updatedTask,
        };
    }
    private async applyRuleEnforcementStatus(input: TaskRuleInput, task: MonitoringTask): Promise<MonitoringTask> {
        if (task.status === "completed") {
            return task;
        }
        const desiredStatus = this.resolveRuleGuardStatus(input);
        if (!desiredStatus || desiredStatus === task.status) {
            return task;
        }
        const updatedAt = new Date().toISOString();
        await this.ports.tasks.updateStatus(task.id, desiredStatus, updatedAt);
        const updatedTask = await this.taskLifecycle.requireTask(task.id);
        this.ports.notifier.publish({
            type: "task.updated",
            payload: updatedTask,
        });
        return updatedTask;
    }
    private resolveRuleGuardStatus(input: TaskRuleInput): MonitoringTask["status"] | undefined {
        const outcome = input.outcome;
        if (outcome === "approval_requested")
            return "waiting";
        if (outcome === "blocked" || outcome === "rejected")
            return "errored";
        if (outcome === "approved" || outcome === "bypassed")
            return "running";
        const violation = input.status === "violation";
        if (!violation) {
            return undefined;
        }
        if (input.policy === "approval_required")
            return "waiting";
        if (input.policy === "block")
            return "errored";
        return undefined;
    }
    async logAsyncLifecycle(input: TaskAsyncLifecycleInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logAsyncLifecycle(input);
        return { task, ...result };
    }
    async logQuestion(input: TaskQuestionInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logQuestion(input);
        return { task, ...result };
    }
    async logTodo(input: TaskTodoInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logTodo(input);
        return { task, ...result };
    }
    async logThought(input: TaskThoughtInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logThought(input);
        return { task, ...result };
    }
    async logAgentActivity(input: TaskAgentActivityInput): Promise<RecordedEventEnvelope> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const result = await this.eventLogging.logAgentActivity(input);
        return { task, ...result };
    }
    async getOverview() {
        return this.ports.tasks.getOverviewStats();
    }
    getDefaultWorkspacePath() {
        // Read cwd without a direct `process` reference so downstream packages whose
        // tsconfigs lack node types (e.g. web-state via paths mapping) can still
        // typecheck this file. At runtime the server always executes on Node.
        const nodeProcess = (globalThis as { process?: { cwd: () => string } }).process;
        const cwd = nodeProcess ? nodeProcess.cwd() : "";
        return normalizeWorkspacePath(cwd);
    }
    async listTasks() {
        return this.ports.tasks.findAll();
    }
    async getTask(taskId: TaskId) {
        return this.ports.tasks.findById(taskId);
    }
    async getTaskTimeline(taskId: TaskId): Promise<readonly TimelineEvent[]> {
        return this.ports.events.findByTaskId(taskId);
    }
    async getTaskLatestRuntimeSession(taskId: TaskId): Promise<{
        runtimeSource: RuntimeSource;
        runtimeSessionId: RuntimeSessionId;
    } | null> {
        return this.ports.runtimeBindings.findLatestByTaskId(taskId);
    }
    async getTaskOpenInference(taskId: TaskId): Promise<{
        openinference: ReturnType<typeof buildOpenInferenceTaskExport>;
    } | undefined> {
        const task = await this.ports.tasks.findById(taskId);
        if (!task) {
            return undefined;
        }
        const timeline = await this.ports.events.findByTaskId(taskId);
        return {
            openinference: buildOpenInferenceTaskExport(task, timeline)
        };
    }
    async getTaskObservability(taskId: TaskId): Promise<TaskObservabilityResponse | undefined> {
        const task = await this.ports.tasks.findById(taskId);
        if (!task) {
            return undefined;
        }
        const [sessions, timeline] = await Promise.all([
            this.ports.sessions.findByTaskId(taskId),
            this.ports.events.findByTaskId(taskId)
        ]);
        return {
            observability: analyzeTaskObservability({
                task,
                sessions,
                timeline
            })
        };
    }
    async getObservabilityOverview(): Promise<ObservabilityOverviewResponse> {
        const tasks = await this.ports.tasks.findAll();
        const sessionEntries = await Promise.all(tasks.map(async (task) => [task.id, await this.ports.sessions.findByTaskId(task.id)] as const));
        const timelineEntries = await Promise.all(tasks.map(async (task) => [task.id, await this.ports.events.findByTaskId(task.id)] as const));
        return {
            observability: analyzeObservabilityOverview({
                tasks,
                sessionsByTaskId: new Map(sessionEntries),
                timelinesByTaskId: new Map(timelineEntries)
            })
        };
    }
    async listBookmarks(taskId?: TaskId): Promise<readonly BookmarkRecord[]> {
        return taskId
            ? this.ports.bookmarks.findByTaskId(taskId)
            : this.ports.bookmarks.findAll();
    }
    async saveBookmark(input: TaskBookmarkInput): Promise<BookmarkRecord> {
        const task = await this.taskLifecycle.requireTask(input.taskId);
        const event = input.eventId
            ? await this.ports.events.findById(input.eventId)
            : undefined;
        if (input.eventId && !event) {
            throw new Error(`Event not found: ${input.eventId}`);
        }
        if (event && event.taskId !== task.id) {
            throw new Error(`Event ${event.id} does not belong to task ${task.id}`);
        }
        const bookmarks = await this.ports.bookmarks.findByTaskId(task.id);
        const existing = bookmarks.find((b) => b.taskId === task.id &&
            (event ? b.eventId === event.id : !b.eventId));
        const bookmark = await this.ports.bookmarks.save({
            id: existing?.id ?? BookmarkId(globalThis.crypto.randomUUID()),
            taskId: task.id,
            ...(event ? { eventId: event.id } : {}),
            kind: event ? "event" : "task",
            title: input.title?.trim() || event?.title || task.title,
            ...(input.note?.trim() ? { note: input.note.trim() } : {}),
            metadata: input.metadata ?? {},
        });
        this.ports.notifier.publish({
            type: "bookmark.saved",
            payload: bookmark,
        });
        return bookmark;
    }
    async deleteBookmark(input: TaskBookmarkDeleteInput): Promise<"deleted" | "not_found"> {
        const all = await this.ports.bookmarks.findAll();
        if (!all.some((b) => b.id === input.bookmarkId)) {
            return "not_found";
        }
        await this.ports.bookmarks.delete(input.bookmarkId);
        this.ports.notifier.publish({
            type: "bookmark.deleted",
            payload: { bookmarkId: input.bookmarkId },
        });
        return "deleted";
    }
    async search(input: TaskSearchInput): Promise<SearchResults> {
        return this.ports.events.search(input.query, {
            ...(input.taskId ? { taskId: input.taskId } : {}),
            ...(input.limit ? { limit: input.limit } : {}),
        });
    }
    async updateTask(input: TaskPatchInput): Promise<MonitoringTask | null> {
        return this.taskLifecycle.updateTask(input);
    }
    async updateEvent(input: EventPatchInput): Promise<TimelineEvent | null> {
        const event = await this.ports.events.findById(input.eventId);
        if (!event) {
            return null;
        }
        const nextMetadata = { ...event.metadata };
        const nextDisplayTitle = typeof input.displayTitle === "string"
            ? input.displayTitle.trim()
            : null;
        const normalizedDisplayTitle = nextDisplayTitle &&
            nextDisplayTitle !== event.title.trim()
            ? nextDisplayTitle
            : null;
        const currentDisplayTitle = typeof event.metadata["displayTitle"] === "string"
            ? event.metadata["displayTitle"].trim()
            : null;
        if ((normalizedDisplayTitle ?? null) === (currentDisplayTitle ?? null)) {
            return event;
        }
        if (normalizedDisplayTitle) {
            nextMetadata["displayTitle"] = normalizedDisplayTitle;
        }
        else {
            delete nextMetadata["displayTitle"];
        }
        const updated = await this.ports.events.updateMetadata(event.id, nextMetadata);
        if (updated) {
            this.ports.notifier.publish({
                type: "event.updated",
                payload: updated,
            });
        }
        return updated;
    }
    async linkTask(input: TaskLinkInput): Promise<MonitoringTask> {
        return this.taskLifecycle.linkTask(input);
    }
    async deleteTask(taskId: TaskId): Promise<"deleted" | "not_found"> {
        return this.taskLifecycle.deleteTask(taskId);
    }
    async deleteFinishedTasks(): Promise<number> {
        return this.taskLifecycle.deleteFinishedTasks();
    }
    async upsertTaskEvaluation(taskId: TaskId, input: {
        readonly scopeKey?: string;
        readonly rating: "good" | "skip";
        readonly useCase?: string;
        readonly workflowTags?: string[];
        readonly outcomeNote?: string;
        readonly approachNote?: string;
        readonly reuseWhen?: string;
        readonly watchouts?: string;
        readonly workflowSnapshot?: ReusableTaskSnapshot | null;
        readonly workflowContext?: string;
    }): Promise<void> {
        return this.workflowEvaluation.upsertTaskEvaluation(taskId, input);
    }
    async getTaskEvaluation(taskId: TaskId, scopeKey?: string) {
        return this.workflowEvaluation.getTaskEvaluation(taskId, scopeKey);
    }
    async recordBriefingCopy(taskId: TaskId, scopeKey?: string) {
        return this.workflowEvaluation.recordBriefingCopy(taskId, scopeKey);
    }
    async saveBriefing(taskId: TaskId, input: Parameters<WorkflowEvaluationService["saveBriefing"]>[1]) {
        return this.workflowEvaluation.saveBriefing(taskId, input);
    }
    async listBriefings(taskId: TaskId) {
        return this.workflowEvaluation.listBriefings(taskId);
    }
    async getWorkflowContent(taskId: TaskId, scopeKey?: string) {
        return this.workflowEvaluation.getWorkflowContent(taskId, scopeKey);
    }
    async listEvaluations(rating?: "good" | "skip") {
        return this.workflowEvaluation.listEvaluations(rating);
    }
    async searchWorkflowLibrary(query: string, rating?: "good" | "skip", limit?: number) {
        return this.workflowEvaluation.searchWorkflowLibrary(query, rating, limit);
    }
    async searchSimilarWorkflows(query: string, tags?: string[], limit?: number) {
        return this.workflowEvaluation.searchSimilarWorkflows(query, tags, limit);
    }
    async listPlaybooks(query?: string, status?: PlaybookStatus, limit?: number) {
        return this.workflowEvaluation.listPlaybooks(query, status, limit);
    }
    async getPlaybook(playbookId: string) {
        return this.workflowEvaluation.getPlaybook(playbookId);
    }
    async createPlaybook(input: Parameters<WorkflowEvaluationService["createPlaybook"]>[0]) {
        return this.workflowEvaluation.createPlaybook(input);
    }
    async updatePlaybook(playbookId: string, input: Parameters<WorkflowEvaluationService["updatePlaybook"]>[1]) {
        return this.workflowEvaluation.updatePlaybook(playbookId, input);
    }
}
