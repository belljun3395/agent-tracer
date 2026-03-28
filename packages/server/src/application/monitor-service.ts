/**
 * @module application/monitor-service
 *
 * 모니터링 비즈니스 로직 레이어.
 * 의존성 방향: application → ports (interfaces), @monitor/core
 */

import {
  createTaskSlug, extractPathLikeTokens, normalizeWorkspacePath,
  type MonitoringEventKind, type MonitoringTask, type TimelineEvent, type TimelineLane
} from "@monitor/core";

import type { MonitorPorts, BookmarkRecord, SearchResults } from "./ports/index.js";
import type {
  GenericEventInput, TaskActionInput, TaskAgentActivityInput, TaskBookmarkDeleteInput,
  TaskBookmarkInput, TaskCompletionInput, TaskContextSavedInput, TaskErrorInput,
  TaskExploreInput, TaskAsyncLifecycleInput, TaskPlanInput, TaskLinkInput,
  TaskQuestionInput, TaskPatchInput, TaskRenameInput, TaskRuleInput, TaskSessionEndInput,
  TaskStartInput, TaskTerminalCommandInput, TaskThoughtInput, TaskTodoInput,
  TaskToolUsedInput, TaskUserMessageInput, TaskVerifyInput,
  RuntimeSessionEnsureInput, RuntimeSessionEnsureResult, RuntimeSessionEndInput, TaskSearchInput,
  TaskAssistantResponseInput, EventPatchInput
} from "./types.js";
import {
  analyzeObservabilityOverview,
  analyzeTaskObservability,
  type ObservabilityOverviewResponse,
  type TaskObservabilityResponse
} from "./observability.js";
import { EventRecorder } from "./services/event-recorder.js";
import { TraceMetadataFactory as TMF } from "./services/trace-metadata-factory.js";
import {
  shouldAutoCompleteBackground,
  shouldAutoCompletePrimary,
  shouldMovePrimaryToWaiting
} from "./services/session-lifecycle-policy.js";

export type { BookmarkRecord, SearchResults };
export interface RecordedEventEnvelope {
  readonly task: MonitoringTask;
  readonly sessionId?: string;
  readonly events: readonly { readonly id: string; readonly kind: MonitoringEventKind }[];
}

export class MonitorService {
  private readonly recorder: EventRecorder;
  // key: taskId → Set<"asyncTaskId:asyncStatus">
  private readonly seenAsyncEvents = new Map<string, Set<string>>();

  constructor(private readonly ports: MonitorPorts) {
    this.recorder = new EventRecorder(ports.events, ports.notifier);
  }
  async startTask(input: TaskStartInput): Promise<RecordedEventEnvelope> {
    const taskId = input.taskId ?? globalThis.crypto.randomUUID();
    const sessionId = globalThis.crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const existingTask = await this.ports.tasks.findById(taskId);
    const workspacePath = input.workspacePath ? normalizeWorkspacePath(input.workspacePath) : undefined;
    const taskKind = input.taskKind ?? existingTask?.taskKind ?? "primary";
    const runtimeSource = input.runtimeSource ?? existingTask?.runtimeSource;

    const task = await this.ports.tasks.upsert({
      id: taskId, title: input.title, slug: createTaskSlug({ title: input.title }),
      status: "running", taskKind, createdAt: existingTask?.createdAt ?? startedAt,
      updatedAt: startedAt, lastSessionStartedAt: startedAt,
      ...(input.parentTaskId ?? existingTask?.parentTaskId ? { parentTaskId: input.parentTaskId ?? existingTask!.parentTaskId } : {}),
      ...(input.parentSessionId ?? existingTask?.parentSessionId ? { parentSessionId: input.parentSessionId ?? existingTask!.parentSessionId } : {}),
      ...(input.backgroundTaskId ?? existingTask?.backgroundTaskId ? { backgroundTaskId: input.backgroundTaskId ?? existingTask!.backgroundTaskId } : {}),
      ...(workspacePath ? { workspacePath } : {}),
      ...(runtimeSource ? { runtimeSource } : {})
    });
    const session = await this.ports.sessions.create({ id: sessionId, taskId: task.id, status: "running", startedAt, ...(input.summary ? { summary: input.summary } : {}) });
    if (existingTask && (existingTask.status !== "running" || existingTask.runtimeSource !== task.runtimeSource)) {
      this.ports.notifier.publish({ type: "task.updated", payload: task });
    }
    this.ports.notifier.publish({ type: "task.started", payload: task });
    this.ports.notifier.publish({ type: "session.started", payload: session });
    if (!existingTask) {
      const startMeta = { ...(input.metadata ?? {}), taskKind: task.taskKind, ...(task.parentTaskId ? { parentTaskId: task.parentTaskId } : {}), ...(task.parentSessionId ? { parentSessionId: task.parentSessionId } : {}), ...(task.backgroundTaskId ? { backgroundTaskId: task.backgroundTaskId } : {}), ...(task.workspacePath ? { workspacePath: task.workspacePath } : {}), ...(runtimeSource ? { runtimeSource } : {}) };
      const event = await this.recorder.record({ taskId: task.id, sessionId, kind: "task.start", title: input.title, metadata: startMeta, ...(input.summary ? { body: input.summary } : {}) });
      return { task, sessionId, events: [{ id: event.id, kind: event.kind }] };
    }
    return { task, sessionId, events: [] };
  }

  async completeTask(input: TaskCompletionInput): Promise<RecordedEventEnvelope> { return this.finishTask(input, "completed", "task.complete", input.summary); }
  async errorTask(input: TaskErrorInput): Promise<RecordedEventEnvelope> { return this.finishTask(input, "errored", "task.error", input.errorMessage); }
  async logUserMessage(input: TaskUserMessageInput): Promise<RecordedEventEnvelope> {
    const task = await this.requireTask(input.taskId);
    if (input.captureMode === "derived" && !input.sourceEventId) throw new Error("sourceEventId is required when captureMode is 'derived'.");
    const phase = input.phase ?? (await this.ports.events.countRawUserMessages(input.taskId) === 0 ? "initial" : "follow_up");

    const meta = {
      ...(input.metadata ?? {}),
      messageId: input.messageId,
      captureMode: input.captureMode,
      source: input.source,
      phase,
      ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
      contractVersion: input.contractVersion ?? "1"
    };

    // EventRecorder가 input.filePaths를 metadata.filePaths로 저장하므로 top-level로 전달.
    const existingFilePaths = Array.isArray(input.metadata?.["filePaths"])
      ? (input.metadata?.["filePaths"] as string[]).filter((p): p is string => typeof p === "string")
      : undefined;
    const filePaths = (existingFilePaths && existingFilePaths.length > 0)
      ? existingFilePaths
      : (input.body ? [...extractPathLikeTokens(input.body)] : []);

    const event = await this.recorder.record({
      taskId: input.taskId,
      kind: "user.message",
      title: input.title,
      ...this.withSessionId(input.sessionId),
      ...(input.body ? { body: input.body } : {}),
      ...(filePaths.length > 0 ? { filePaths } : {}),
      metadata: meta
    });
    return { task, ...this.withSessionId(input.sessionId), events: [{ id: event.id, kind: event.kind }] };
  }

  async logAssistantResponse(input: TaskAssistantResponseInput): Promise<RecordedEventEnvelope> {
    const task = await this.requireTask(input.taskId);
    const event = await this.recorder.record({
      taskId: input.taskId,
      kind: "assistant.response",
      title: input.title,
      ...this.withSessionId(input.sessionId),
      ...(input.body      ? { body: input.body }           : {}),
      metadata: {
        ...(input.metadata ?? {}),
        messageId: input.messageId,
        source:    input.source
      }
    });
    return { task, ...this.withSessionId(input.sessionId), events: [{ id: event.id, kind: event.kind }] };
  }

  async endSession(input: TaskSessionEndInput): Promise<{ sessionId: string; task: MonitoringTask }> {
    const task = await this.requireTask(input.taskId);
    const runningCount = await this.ports.sessions.countRunningByTaskId(input.taskId);
    if (!input.sessionId && runningCount > 1) throw new Error(`sessionId is required to end one of multiple running sessions for task: ${input.taskId}`);
    const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
    if (!sessionId) throw new Error(`No active session for task: ${input.taskId}`);
    const endedAt = new Date().toISOString();
    const sessionBefore = await this.ports.sessions.findById(sessionId);
    await this.ports.sessions.updateStatus(sessionId, "completed", endedAt, input.summary);
    if (sessionBefore) this.ports.notifier.publish({ type: "session.ended", payload: { ...sessionBefore, status: "completed" as const, endedAt } });
    await this.completeBgTasks(input.backgroundCompletions);
    const postRunning = await this.ports.sessions.countRunningByTaskId(task.id);
    const taskKind = task.taskKind ?? "primary";
    const hasRunningBackgroundDescendants = taskKind === "primary"
      ? await this.hasRunningBackgroundDescendants(task.id)
      : false;
    const meta = input.metadata ? { metadata: input.metadata } : {};
    if (shouldAutoCompleteBackground({ taskKind, runningSessionCount: postRunning }) && task.status === "running") {
      const r = await this.completeTask({ taskId: task.id, sessionId, summary: input.summary ?? "Background session completed", ...meta });
      return { sessionId, task: r.task };
    }
    if (shouldAutoCompletePrimary({
      taskKind,
      completeTask: input.completeTask ?? false,
      runningSessionCount: postRunning,
      completionReason: input.completionReason,
      hasRunningBackgroundDescendants
    }) && (task.status === "running" || task.status === "waiting")) {
      const r = await this.completeTask({ taskId: task.id, sessionId, summary: input.summary ?? "Session ended", ...meta });
      return { sessionId, task: r.task };
    }
    if (shouldMovePrimaryToWaiting({
      taskKind,
      completeTask: input.completeTask ?? false,
      runningSessionCount: postRunning,
      completionReason: input.completionReason,
      hasRunningBackgroundDescendants
    }) && task.status === "running") {
      const waitingTask = await this.setTaskStatus(task.id, "waiting");
      return { sessionId, task: waitingTask };
    }
    return { sessionId, task: await this.requireTask(task.id) };
  }

  async ensureRuntimeSession(input: RuntimeSessionEnsureInput): Promise<RuntimeSessionEnsureResult> {
    const workspacePath = input.workspacePath ? normalizeWorkspacePath(input.workspacePath) : undefined;

    // Active binding: same session still running
    const binding = await this.ports.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
    if (binding) return { taskId: binding.taskId, sessionId: binding.monitorSessionId, taskCreated: false, sessionCreated: false };

    // Task association exists but session was cleared (e.g. between turns in the same CC window)
    const existingTaskId = await this.ports.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
    if (existingTaskId) {
      const sessionId = globalThis.crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const task = await this.ports.tasks.findById(existingTaskId);
      if (task && (task.status !== "running" || task.runtimeSource !== input.runtimeSource)) {
        const resumedTask = await this.ports.tasks.upsert({
          ...task,
          taskKind: task.taskKind ?? "primary",
          status: "running",
          updatedAt: startedAt,
          lastSessionStartedAt: startedAt,
          runtimeSource: input.runtimeSource
        });
        this.ports.notifier.publish({ type: "task.updated", payload: resumedTask });
      }
      const session = await this.ports.sessions.create({ id: sessionId, taskId: existingTaskId, status: "running", startedAt });
      this.ports.notifier.publish({ type: "session.started", payload: session });
      await this.ports.runtimeBindings.upsert({ runtimeSource: input.runtimeSource, runtimeSessionId: input.runtimeSessionId, taskId: existingTaskId, monitorSessionId: sessionId });
      return { taskId: existingTaskId, sessionId, taskCreated: false, sessionCreated: true };
    }

    // No binding at all — new task + session
    const result = await this.startTask({
      title: input.title,
      ...(workspacePath ? { workspacePath } : {}),
      runtimeSource: input.runtimeSource,
      ...(input.parentTaskId ? { taskKind: "background" as const, parentTaskId: input.parentTaskId } : {}),
      ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {})
    });
    const taskId = result.task.id;
    const sessionId = result.sessionId!;
    await this.ports.runtimeBindings.upsert({ runtimeSource: input.runtimeSource, runtimeSessionId: input.runtimeSessionId, taskId, monitorSessionId: sessionId });
    return { taskId, sessionId, taskCreated: true, sessionCreated: true };
  }

  async endRuntimeSession(input: RuntimeSessionEndInput): Promise<void> {
    const binding = await this.ports.runtimeBindings.find(input.runtimeSource, input.runtimeSessionId);
    if (!binding) {
      // No active session (already cleared after previous turn) — still handle completeTask: true (e.g. /exit)
      if (input.completeTask === true) {
        const taskId = await this.ports.runtimeBindings.findTaskId(input.runtimeSource, input.runtimeSessionId);
        if (taskId) {
          await this.completeTaskIfIncomplete({
            taskId,
            summary: input.summary ?? "Runtime session ended"
          });
          await this.ports.runtimeBindings.delete(input.runtimeSource, input.runtimeSessionId);
        }
      }
      return;
    }
    const session = await this.ports.sessions.findById(binding.monitorSessionId);
    if (!session || session.status !== "running") return;
    const endedAtRt = new Date().toISOString();
    await this.ports.sessions.updateStatus(binding.monitorSessionId, "completed", endedAtRt, input.summary);
    if (session) this.ports.notifier.publish({ type: "session.ended", payload: { ...session, status: "completed" as const, endedAt: endedAtRt } });
    await this.ports.runtimeBindings.clearSession(input.runtimeSource, input.runtimeSessionId);
    await this.completeBgTasks(input.backgroundCompletions);
    const task = await this.ports.tasks.findById(binding.taskId);
    const hasRunningBackgroundDescendants = task?.taskKind === "primary"
      ? await this.hasRunningBackgroundDescendants(binding.taskId)
      : false;
    if (input.completeTask === true && task) {
      if (shouldAutoCompletePrimary({
        taskKind: task.taskKind ?? "primary",
        completeTask: true,
        runningSessionCount: await this.ports.sessions.countRunningByTaskId(binding.taskId),
        completionReason: input.completionReason,
        hasRunningBackgroundDescendants
      })) {
        await this.completeTaskIfIncomplete({
          taskId: binding.taskId,
          sessionId: binding.monitorSessionId,
          summary: input.summary ?? "Runtime session ended"
        });
      }
    } else if (task?.taskKind === "background" && task.status === "running" && await this.ports.sessions.countRunningByTaskId(binding.taskId) === 0) {
      await this.completeTaskIfIncomplete({
        taskId: binding.taskId,
        sessionId: binding.monitorSessionId,
        summary: input.summary ?? "Background task completed"
      });
    } else if (task && shouldMovePrimaryToWaiting({
      taskKind: task.taskKind ?? "primary",
      completeTask: input.completeTask ?? false,
      runningSessionCount: await this.ports.sessions.countRunningByTaskId(binding.taskId),
      completionReason: input.completionReason,
      hasRunningBackgroundDescendants
    })) {
      await this.setTaskStatus(binding.taskId, "waiting");
    }
  }

  async logTerminalCommand(input: TaskTerminalCommandInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "terminal.command", title: input.title ?? input.command, body: input.body ?? input.command, metadata: { ...(input.metadata ?? {}), command: input.command }, command: input.command, ...this.withSessionId(sid), ...(input.lane ? { lane: input.lane } : {}), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async logToolUsed(input: TaskToolUsedInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "tool.used", title: input.title ?? input.toolName, metadata: TMF.build({ ...(input.metadata ?? {}), toolName: input.toolName }, input), toolName: input.toolName, ...this.withSessionId(sid), ...(input.body ? { body: input.body } : {}), ...(input.lane ? { lane: input.lane } : {}), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async saveContext(input: TaskContextSavedInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "context.saved", title: input.title, ...this.withSessionId(sid), ...(input.body ? { body: input.body } : {}), ...(input.lane ? { lane: input.lane } : {}), ...(input.filePaths ? { filePaths: input.filePaths } : {}), metadata: TMF.build(input.metadata, input) }));
  }

  async logExploration(input: TaskExploreInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "tool.used", lane: (input.lane as TimelineLane | undefined) ?? "exploration", title: input.title, metadata: TMF.build({ ...(input.metadata ?? {}), toolName: input.toolName }, input), toolName: input.toolName, ...this.withSessionId(sid), ...(input.body ? { body: input.body } : {}), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async logPlan(input: TaskPlanInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "plan.logged", lane: "planning", title: input.title ?? input.action, metadata: TMF.build({ ...(input.metadata ?? {}), action: input.action }, input), actionName: input.action, ...this.withSessionId(sid), ...(input.body ? { body: input.body } : {}), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async logAction(input: TaskActionInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "action.logged", title: input.title ?? input.action, metadata: TMF.build({ ...(input.metadata ?? {}), action: input.action }, input), actionName: input.action, ...this.withSessionId(sid), ...(input.body ? { body: input.body } : {}), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async logVerification(input: TaskVerifyInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "verification.logged", lane: "implementation", title: input.title ?? input.action, body: input.body ?? input.result, metadata: TMF.build({ ...(input.metadata ?? {}), action: input.action, result: input.result, verificationStatus: TMF.normalizeVerificationStatus(input.status ?? input.result) }, input), actionName: input.action, ...this.withSessionId(sid), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async logRule(input: TaskRuleInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "rule.logged", lane: "implementation", title: input.title ?? input.action, body: input.body ?? `${input.ruleId} · ${input.status} · ${input.severity}`, metadata: TMF.build({ ...(input.metadata ?? {}), action: input.action, ruleId: input.ruleId, severity: input.severity, ruleStatus: input.status, ruleSource: input.source ?? "rule-guard" }, input), actionName: input.action, ...this.withSessionId(sid), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async logAsyncLifecycle(input: TaskAsyncLifecycleInput): Promise<RecordedEventEnvelope> {
    const dedupeKey = `${input.asyncTaskId}:${input.asyncStatus}`;
    const taskSeen = this.seenAsyncEvents.get(input.taskId) ?? new Set<string>();
    if (taskSeen.has(dedupeKey)) {
      const task = await this.requireTask(input.taskId);
      return { task, events: [] };
    }
    taskSeen.add(dedupeKey);
    this.seenAsyncEvents.set(input.taskId, taskSeen);
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "action.logged", lane: "background", title: input.title ?? `Async task ${input.asyncStatus}`, metadata: TMF.build({ ...(input.metadata ?? {}), asyncTaskId: input.asyncTaskId, asyncStatus: input.asyncStatus, ...(input.description ? { description: input.description } : {}), ...(input.agent ? { asyncAgent: input.agent } : {}), ...(input.category ? { asyncCategory: input.category } : {}), ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}), ...(typeof input.durationMs === "number" ? { asyncDurationMs: input.durationMs } : {}) }, input), actionName: `async_task_${input.asyncStatus}`, ...this.withSessionId(sid), ...(input.body || input.description ? { body: input.body ?? input.description } : {}), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async logQuestion(input: TaskQuestionInput): Promise<RecordedEventEnvelope> {
    const task = await this.requireTask(input.taskId);
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
        ...(typeof input.sequence === "number" ? { sequence: input.sequence } : {}),
        ...(input.modelName ? { modelName: input.modelName } : {}),
        ...(input.modelProvider ? { modelProvider: input.modelProvider } : {})
      }, input)
    });
    return { task, ...this.withSessionId(sessionId), events: [{ id: event.id, kind: event.kind }] };
  }

  async logTodo(input: TaskTodoInput): Promise<RecordedEventEnvelope> {
    const task = await this.requireTask(input.taskId);
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
        ...(typeof input.sequence === "number" ? { sequence: input.sequence } : {})
      }, input)
    });
    return { task, ...this.withSessionId(sessionId), events: [{ id: event.id, kind: event.kind }] };
  }

  async logThought(input: TaskThoughtInput): Promise<RecordedEventEnvelope> {
    const task = await this.requireTask(input.taskId);
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
        ...(input.modelProvider ? { modelProvider: input.modelProvider } : {})
      }, input)
    });
    return { task, ...this.withSessionId(sessionId), events: [{ id: event.id, kind: event.kind }] };
  }

  async logAgentActivity(input: TaskAgentActivityInput): Promise<RecordedEventEnvelope> {
    return this.withSession(input, (sid) => ({ taskId: input.taskId, kind: "agent.activity.logged", lane: (input.lane as TimelineLane | undefined) ?? "coordination", title: input.title ?? TMF.normalizeAgentActivityTitle(input.activityType), metadata: TMF.build(input.metadata, input), ...this.withSessionId(sid), ...(input.body ? { body: input.body } : {}), ...(input.filePaths ? { filePaths: input.filePaths } : {}) }));
  }

  async getOverview() { return this.ports.tasks.getOverviewStats(); }
  async listTasks() { return this.ports.tasks.findAll(); }
  async getTask(taskId: string) { return this.ports.tasks.findById(taskId); }
  async getTaskTimeline(taskId: string): Promise<readonly TimelineEvent[]> { return this.ports.events.findByTaskId(taskId); }
  async getTaskObservability(taskId: string): Promise<TaskObservabilityResponse | undefined> {
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
    const sessionEntries = await Promise.all(
      tasks.map(async (task) => [task.id, await this.ports.sessions.findByTaskId(task.id)] as const)
    );
    const timelineEntries = await Promise.all(
      tasks.map(async (task) => [task.id, await this.ports.events.findByTaskId(task.id)] as const)
    );

    return {
      observability: analyzeObservabilityOverview({
        tasks,
        sessionsByTaskId: new Map(sessionEntries),
        timelinesByTaskId: new Map(timelineEntries)
      })
    };
  }

  async listBookmarks(taskId?: string): Promise<readonly BookmarkRecord[]> { return taskId ? this.ports.bookmarks.findByTaskId(taskId) : this.ports.bookmarks.findAll(); }

  async saveBookmark(input: TaskBookmarkInput): Promise<BookmarkRecord> {
    const task = await this.requireTask(input.taskId);
    const event = input.eventId ? await this.ports.events.findById(input.eventId) : undefined;
    if (input.eventId && !event) throw new Error(`Event not found: ${input.eventId}`);
    if (event && event.taskId !== task.id) throw new Error(`Event ${event.id} does not belong to task ${task.id}`);
    const bookmarks = await this.ports.bookmarks.findByTaskId(task.id);
    const existing = bookmarks.find((b) => b.taskId === task.id && (event ? b.eventId === event.id : !b.eventId));
    const bookmark = await this.ports.bookmarks.save({ id: existing?.id ?? globalThis.crypto.randomUUID(), taskId: task.id, ...(event ? { eventId: event.id } : {}), kind: event ? "event" : "task", title: input.title?.trim() || event?.title || task.title, ...(input.note?.trim() ? { note: input.note.trim() } : {}), metadata: input.metadata ?? {} });
    this.ports.notifier.publish({ type: "bookmark.saved", payload: bookmark });
    return bookmark;
  }

  async deleteBookmark(input: TaskBookmarkDeleteInput): Promise<"deleted" | "not_found"> {
    const all = await this.ports.bookmarks.findAll();
    if (!all.some((b) => b.id === input.bookmarkId)) return "not_found";
    await this.ports.bookmarks.delete(input.bookmarkId);
    this.ports.notifier.publish({ type: "bookmark.deleted", payload: { bookmarkId: input.bookmarkId } });
    return "deleted";
  }
  async search(input: TaskSearchInput): Promise<SearchResults> { return this.ports.events.search(input.query, { ...(input.taskId ? { taskId: input.taskId } : {}), ...(input.limit ? { limit: input.limit } : {}) }); }
  async renameTask(input: TaskRenameInput): Promise<MonitoringTask | null> {
    const task = await this.ports.tasks.findById(input.taskId);
    if (!task) return null;
    const nextTitle = input.title.trim();
    if (nextTitle === task.title) return task;
    await this.ports.tasks.updateTitle(input.taskId, nextTitle, createTaskSlug({ title: nextTitle }), new Date().toISOString());
    const updated = await this.ports.tasks.findById(input.taskId);
    if (updated) this.ports.notifier.publish({ type: "task.updated", payload: updated });
    return updated ?? null;
  }

  async updateTask(input: TaskPatchInput): Promise<MonitoringTask | null> {
    const task = await this.ports.tasks.findById(input.taskId);
    if (!task) return null;
    const titleUpdate = input.title !== undefined ? input.title.trim() : undefined;
    const hasNewTitle = titleUpdate !== undefined && titleUpdate !== task.title;
    const hasNewStatus = input.status !== undefined && input.status !== task.status;
    if (!hasNewTitle && !hasNewStatus) return task;
    const updated = await this.ports.tasks.upsert({ ...task, taskKind: task.taskKind ?? "primary", ...(hasNewTitle && titleUpdate !== undefined ? { title: titleUpdate, slug: createTaskSlug({ title: titleUpdate }) } : {}), ...(hasNewStatus && input.status !== undefined ? { status: input.status } : {}), updatedAt: new Date().toISOString() });
    this.ports.notifier.publish({ type: "task.updated", payload: updated });
    return updated;
  }

  async updateEvent(input: EventPatchInput): Promise<TimelineEvent | null> {
    const event = await this.ports.events.findById(input.eventId);
    if (!event) return null;

    const nextMetadata = { ...event.metadata };
    const nextDisplayTitle = typeof input.displayTitle === "string"
      ? input.displayTitle.trim()
      : null;
    const normalizedDisplayTitle = nextDisplayTitle && nextDisplayTitle !== event.title.trim()
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
    } else {
      delete nextMetadata["displayTitle"];
    }

    const updated = await this.ports.events.updateMetadata(event.id, nextMetadata);
    if (updated) {
      this.ports.notifier.publish({ type: "event.updated", payload: updated });
    }
    return updated;
  }

  async linkTask(input: TaskLinkInput): Promise<MonitoringTask> {
    const task = await this.requireTask(input.taskId);
    const t = input.title?.trim();
    const updated = await this.ports.tasks.upsert({ ...task, taskKind: input.taskKind ?? task.taskKind ?? "primary", ...(t ? { title: t, slug: createTaskSlug({ title: t }) } : {}), ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}), ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}), ...(input.backgroundTaskId ? { backgroundTaskId: input.backgroundTaskId } : {}), updatedAt: new Date().toISOString() });
    this.ports.notifier.publish({ type: "task.updated", payload: updated });
    return updated;
  }

  async deleteTask(taskId: string): Promise<"deleted" | "not_found"> {
    if (!await this.ports.tasks.findById(taskId)) return "not_found";
    const result = await this.ports.tasks.delete(taskId);
    for (const id of result.deletedIds) this.ports.notifier.publish({ type: "task.deleted", payload: { taskId: id } });
    return "deleted";
  }
  async deleteFinishedTasks(): Promise<number> {
    const count = await this.ports.tasks.deleteFinished();
    this.ports.notifier.publish({ type: "tasks.purged", payload: { count } });
    return count;
  }
  private async requireTask(taskId: string): Promise<MonitoringTask> {
    const task = await this.ports.tasks.findById(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }
  private async setTaskStatus(taskId: string, status: MonitoringTask["status"]): Promise<MonitoringTask> {
    const updatedAt = new Date().toISOString();
    await this.ports.tasks.updateStatus(taskId, status, updatedAt);
    const task = await this.requireTask(taskId);
    this.ports.notifier.publish({ type: "task.updated", payload: task });
    return task;
  }
  private async completeTaskIfIncomplete(input: TaskCompletionInput): Promise<void> {
    const task = await this.ports.tasks.findById(input.taskId);
    if (!task || task.status === "completed" || task.status === "errored") {
      return;
    }

    await this.completeTask(input);
  }
  private async resolveSessionId(taskId: string, sessionId?: string): Promise<string | undefined> {
    if (sessionId) {
      return sessionId;
    }
    return (await this.ports.sessions.findActiveByTaskId(taskId))?.id;
  }
  private async hasRunningBackgroundDescendants(taskId: string): Promise<boolean> {
    const stack = [taskId];
    while (stack.length > 0) {
      const parentId = stack.pop();
      if (!parentId) continue;
      const children = await this.ports.tasks.findChildren(parentId);
      for (const child of children) {
        if (child.taskKind === "background" && child.status === "running") {
          return true;
        }
        stack.push(child.id);
      }
    }
    return false;
  }
  private withSessionId(sessionId?: string): { sessionId?: string } {
    return sessionId ? { sessionId } : {};
  }
  private async completeBgTasks(ids?: readonly string[]): Promise<void> {
    if (!ids?.length) return;
    for (const bgTaskId of ids) {
      const bgTask = await this.ports.tasks.findById(bgTaskId);
      if (bgTask?.status === "running") await this.completeTask({ taskId: bgTask.id, summary: "Background task completed" });
    }
  }
  private async withSession(input: { taskId: string; sessionId?: string }, buildEvent: (sessionId: string | undefined) => GenericEventInput): Promise<RecordedEventEnvelope> {
    const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
    return this.recordWithDerivedFiles(buildEvent(sessionId));
  }
  private async finishTask(input: TaskCompletionInput, status: "completed" | "errored", kind: MonitoringEventKind, body?: string): Promise<RecordedEventEnvelope> {
    const task = await this.requireTask(input.taskId);
    const endedAt = new Date().toISOString();
    const sessionId = await this.resolveSessionId(input.taskId, input.sessionId);
    if (sessionId) {
      const sOld = await this.ports.sessions.findById(sessionId);
      await this.ports.sessions.updateStatus(sessionId, status, endedAt, input.summary);
      if (sOld) this.ports.notifier.publish({ type: "session.ended", payload: { ...sOld, status, endedAt } });
    }
    if (task.status === status) return { task, ...this.withSessionId(sessionId), events: [] };
    await this.ports.tasks.updateStatus(input.taskId, status, endedAt);
    const finalTask = await this.ports.tasks.findById(input.taskId) ?? task;
    this.ports.notifier.publish(status === "completed" ? { type: "task.completed", payload: finalTask } : { type: "task.updated", payload: finalTask });
    const event = await this.recorder.record({ taskId: input.taskId, kind, title: status === "completed" ? "Task completed" : "Task errored", ...this.withSessionId(sessionId), ...(body ? { body } : {}), ...(input.metadata ? { metadata: input.metadata } : {}) });
    return { task: finalTask, ...this.withSessionId(sessionId), events: [{ id: event.id, kind: event.kind }] };
  }

  private async recordWithDerivedFiles(input: GenericEventInput): Promise<RecordedEventEnvelope> {
    const task = await this.requireTask(input.taskId);
    return { ...(await this.recorder.recordWithDerivedFiles(input)), task };
  }

  // ── Workflow Evaluation ───────────────────────────────────────────────────────

  async upsertTaskEvaluation(
    taskId: string,
    input: {
      readonly rating: "good" | "skip";
      readonly useCase?: string;
      readonly workflowTags?: string[];
      readonly outcomeNote?: string;
      readonly approachNote?: string;
      readonly reuseWhen?: string;
      readonly watchouts?: string;
    }
  ): Promise<void> {
    const task = await this.requireTask(taskId);
    const events = await this.ports.events.findByTaskId(taskId);
    const snapshot = buildReusableTaskSnapshot({
      objective: task.title,
      events,
      evaluation: {
        useCase: input.useCase ?? null,
        workflowTags: input.workflowTags ?? [],
        outcomeNote: input.outcomeNote ?? null,
        approachNote: input.approachNote ?? null,
        reuseWhen: input.reuseWhen ?? null,
        watchouts: input.watchouts ?? null
      }
    });

    await this.ports.evaluations.upsertEvaluation({
      taskId,
      rating: input.rating,
      useCase: input.useCase ?? null,
      workflowTags: input.workflowTags ?? [],
      outcomeNote: input.outcomeNote ?? null,
      approachNote: input.approachNote ?? null,
      reuseWhen: input.reuseWhen ?? null,
      watchouts: input.watchouts ?? null,
      searchText: snapshot.searchText,
      evaluatedAt: new Date().toISOString()
    });
  }

  async getTaskEvaluation(taskId: string) {
    return this.ports.evaluations.getEvaluation(taskId);
  }

  async listEvaluations(rating?: "good" | "skip") {
    return this.ports.evaluations.listEvaluations(rating);
  }

  async searchWorkflowLibrary(query: string, rating?: "good" | "skip", limit?: number) {
    return this.ports.evaluations.searchWorkflowLibrary(query, rating, limit);
  }

  async searchSimilarWorkflows(query: string, tags?: string[], limit?: number) {
    return this.ports.evaluations.searchSimilarWorkflows(query, tags, limit);
  }
}
import { buildReusableTaskSnapshot } from "@monitor/core";
