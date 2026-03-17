/**
 * @module application/monitor-service
 *
 * 모니터링 비즈니스 로직 레이어.
 * 태스크·세션·이벤트 생명주기를 조율하고, 이벤트 분류를 적용.
 *
 * 의존성 방향: application → infrastructure, @monitor/core
 */

import crypto from "node:crypto";
import path from "node:path";

import {
  classifyEvent,
  createTaskSlug,
  loadRulesIndex,
  normalizeWorkspacePath,
  tokenizeActionName,
  type MonitoringEventKind,
  type TimelineEvent,
  type TimelineLane,
  type MonitoringTask,
  type RulesIndex
} from "@monitor/core";

import { MonitorDatabase } from "../infrastructure/monitor-database.js";
import type {
  GenericEventInput,
  TaskActionInput,
  TaskCompletionInput,
  TaskContextSavedInput,
  TaskErrorInput,
  TaskExploreInput,
  TaskAsyncLifecycleInput,
  TaskPlanInput,
  TaskLinkInput,
  TaskQuestionInput,
  TaskRenameInput,
  TaskRuleInput,
  TaskSessionEndInput,
  TaskStartInput,
  TaskTerminalCommandInput,
  TaskThoughtInput,
  TaskTodoInput,
  TaskToolUsedInput,
  TaskUserMessageInput,
  TaskVerifyInput,
  CcSessionEnsureInput,
  CcSessionEnsureResult,
  CcSessionEndInput,
  RuntimeSessionEnsureInput,
  RuntimeSessionEnsureResult,
  RuntimeSessionEndInput
} from "./types.js";

export interface MonitorServiceOptions {
  readonly databasePath: string;
  readonly rulesDir: string;
}

export interface RecordedEventEnvelope {
  readonly task: MonitoringTask;
  readonly sessionId?: string;
  readonly events: readonly {
    readonly id: string;
    readonly kind: MonitoringEventKind;
  }[];
}

function extractCompletedBackgroundTaskIds(text: string | undefined): readonly string[] {
  if (!text) return [];

  const ids = new Set<string>();
  for (const match of text.matchAll(/\bbg_[A-Za-z0-9_-]+\b/g)) {
    const id = match[0]?.trim();
    if (id) ids.add(id);
  }

  return [...ids];
}

function hasAllBackgroundCompleteMarker(text: string | undefined): boolean {
  return typeof text === "string" && text.includes("[ALL BACKGROUND TASKS COMPLETE]");
}

function hasBackgroundTaskMissingMarker(text: string | undefined): boolean {
  return typeof text === "string" && text.includes("Task not found:");
}

/**
 * 모니터링 서비스 클래스.
 * 태스크·세션·이벤트 생명주기와 규칙 색인 관리를 담당.
 */
export class MonitorService {
  private readonly database: MonitorDatabase;
  private readonly rulesDir: string;

  #rulesIndex: RulesIndex;

  constructor(options: MonitorServiceOptions) {
    this.database = new MonitorDatabase({
      filename: options.databasePath
    });
    this.rulesDir = options.rulesDir;
    this.#rulesIndex = loadRulesIndex(options.rulesDir);
  }

  /**
   * 규칙 색인을 디스크에서 다시 읽어 갱신한다.
   * @returns 갱신된 RulesIndex
   */
  reloadRules(): RulesIndex {
    this.#rulesIndex = loadRulesIndex(this.rulesDir);
    return this.#rulesIndex;
  }

  /**
   * 현재 로드된 규칙 색인을 반환한다.
   * @returns 현재 RulesIndex
   */
  getRules(): RulesIndex {
    return this.#rulesIndex;
  }

  /**
   * 새 태스크를 시작하고 task.start 이벤트를 기록한다.
   * @param input 태스크 시작 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  startTask(input: TaskStartInput): RecordedEventEnvelope {
    const taskId = input.taskId ?? crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const existingTask = this.database.getTask(taskId);
    const workspacePath = input.workspacePath
      ? normalizeWorkspacePath(input.workspacePath)
      : undefined;
    const taskKind = input.taskKind ?? existingTask?.taskKind ?? "primary";
    const parentTaskId = input.parentTaskId ?? existingTask?.parentTaskId;
    const parentSessionId = input.parentSessionId ?? existingTask?.parentSessionId;
    const backgroundTaskId = input.backgroundTaskId ?? existingTask?.backgroundTaskId;
    const task = this.database.upsertTask({
      id: taskId,
      title: input.title,
      slug: createTaskSlug({ title: input.title }),
      status: "running",
      taskKind,
      createdAt: existingTask?.createdAt ?? startedAt,
      updatedAt: startedAt,
      lastSessionStartedAt: startedAt,
      ...(parentTaskId ? { parentTaskId } : {}),
      ...(parentSessionId ? { parentSessionId } : {}),
      ...(backgroundTaskId ? { backgroundTaskId } : {}),
      ...(workspacePath ? { workspacePath } : {})
    });

    this.database.createSession({
      id: sessionId,
      taskId: task.id,
      status: "running",
      startedAt,
      ...(input.summary ? { summary: input.summary } : {})
    });

    // task.start 이벤트는 신규 태스크에만 생성한다.
    // 기존 태스크의 세션 재개 시에는 이벤트를 생성하지 않아 User 레인 중복을 방지한다.
    if (!existingTask) {
      const event = this.recordGenericEvent({
        taskId: task.id,
        sessionId,
        kind: "task.start",
        title: input.title,
        metadata: {
          ...(input.metadata ?? {}),
          taskKind: task.taskKind,
          ...(task.parentTaskId ? { parentTaskId: task.parentTaskId } : {}),
          ...(task.parentSessionId ? { parentSessionId: task.parentSessionId } : {}),
          ...(task.backgroundTaskId ? { backgroundTaskId: task.backgroundTaskId } : {}),
          ...(task.workspacePath ? { workspacePath: task.workspacePath } : {})
        },
        ...(input.summary ? { body: input.summary } : {})
      });

      return {
        task,
        ...(sessionId ? { sessionId } : {}),
        events: [{ id: event.id, kind: event.kind }]
      };
    }

    return {
      task,
      ...(sessionId ? { sessionId } : {}),
      events: []
    };
  }

  /**
   * 태스크를 완료 처리하고 task.complete 이벤트를 기록한다.
   * @param input 완료 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  completeTask(input: TaskCompletionInput): RecordedEventEnvelope {
    return this.finishTask(input, "completed", "task.complete", input.summary);
  }

  /**
   * 태스크를 에러 처리하고 task.error 이벤트를 기록한다.
   * @param input 에러 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  errorTask(input: TaskErrorInput): RecordedEventEnvelope {
    return this.finishTask(input, "errored", "task.error", input.errorMessage);
  }

  /**
   * 캐노니컬 user.message 이벤트를 기록한다. sessionId는 필수.
   * raw와 derived 이벤트를 같은 태스크에 append-only 로 기록한다.
   * @param input 사용자 메시지 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logUserMessage(input: TaskUserMessageInput): RecordedEventEnvelope {
    const task = this.database.getTask(input.taskId);

    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    const sessionId = input.sessionId;

    // phase가 제공되지 않으면 태스크의 기존 raw user.message 이벤트 수로 derive.
    const phase = input.phase
      ?? (this.database.countRawUserMessages(input.taskId) === 0 ? "initial" : "follow_up");

    const event = this.recordGenericEvent({
      taskId: input.taskId,
      kind: "user.message",
      title: input.title,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      metadata: {
        ...(input.metadata ?? {}),
        messageId: input.messageId,
        captureMode: input.captureMode,
        source: input.source,
        phase,
        ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
        contractVersion: input.contractVersion ?? "1"
      }
    });

    this.#reconcileBackgroundCompletionFromText({
      parentTask: task,
      title: input.title,
      ...(sessionId ? { parentSessionId: sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      source: "user.message"
    });

    return {
      task,
      ...(sessionId ? { sessionId } : {}),
      events: [{ id: event.id, kind: event.kind }]
    };
  }

  #reconcileBackgroundCompletionFromText(input: {
    parentTask: MonitoringTask;
    parentSessionId?: string;
    title?: string;
    body?: string;
    source: "user.message" | "tool.used";
  }): void {
    const text = [input.title, input.body]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join("\n");

    const hasReminderMarker = text.includes("[BACKGROUND TASK COMPLETED]") || text.includes("[ALL BACKGROUND TASKS COMPLETE]");
    const hasMissingMarker = hasBackgroundTaskMissingMarker(text);
    if (!hasReminderMarker && !hasMissingMarker) {
      return;
    }

    const completedBackgroundTaskIds = new Set(extractCompletedBackgroundTaskIds(text));
    const completeAllChildren = hasAllBackgroundCompleteMarker(text);
    const runningChildren = this.database
      .listTasks()
      .filter((candidate) => candidate.parentTaskId === input.parentTask.id)
      .filter((candidate) => candidate.taskKind === "background")
      .filter((candidate) => candidate.status === "running");

    const targets = runningChildren.filter((candidate) => {
      if (completeAllChildren) return true;
      return candidate.backgroundTaskId !== undefined
        && completedBackgroundTaskIds.has(candidate.backgroundTaskId);
    });

    for (const childTask of targets) {
      const childSessionId = this.database.findLatestSession(childTask.id)?.id;
      if (!childSessionId) {
        continue;
      }

      this.endSession({
        taskId: childTask.id,
        sessionId: childSessionId,
        summary: "Background task completed",
        metadata: {
          reminderSource: input.source,
          ...(childTask.backgroundTaskId ? { backgroundTaskId: childTask.backgroundTaskId } : {})
        }
      });

      this.logAsyncLifecycle({
        taskId: input.parentTask.id,
        ...(input.parentSessionId ? { sessionId: input.parentSessionId } : {}),
        asyncTaskId: childTask.backgroundTaskId ?? childTask.id,
        asyncStatus: "completed",
        title: childTask.title,
        ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
        metadata: {
          reminderSource: input.source,
          childTaskId: childTask.id,
          ...(childTask.backgroundTaskId ? { backgroundTaskId: childTask.backgroundTaskId } : {})
        }
      });
    }
  }

  endSession(input: TaskSessionEndInput): { sessionId: string; task: MonitoringTask } {
    const task = this.database.getTask(input.taskId);

    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    if (!sessionId) {
      throw new Error(`No active session for task: ${input.taskId}`);
    }

    const endedAt = new Date().toISOString();
    this.database.updateSessionStatus(sessionId, "completed", input.summary, endedAt);

    if (task.taskKind === "background" && task.status === "running") {
      const runningSessions = this.database.countRunningSessions(task.id);
      if (runningSessions === 0) {
        const completion = this.completeTask({
          taskId: task.id,
          sessionId,
          summary: input.summary ?? "Background session completed",
          ...(input.metadata ? { metadata: input.metadata } : {})
        });
        return { sessionId, task: completion.task };
      }
    }

    if (input.completeTask === true && task.taskKind === "primary" && task.status === "running") {
      const runningSessions = this.database.countRunningSessions(task.id);
      if (runningSessions === 0) {
        const completion = this.completeTask({
          taskId: task.id,
          sessionId,
          summary: input.summary ?? "Session ended",
          ...(input.metadata ? { metadata: input.metadata } : {})
        });
        return { sessionId, task: completion.task };
      }
    }

    return { sessionId, task };
  }

  /**
   * Claude Code 창(window) 단위 세션을 보장한다.
   * cc_session_id 로 기존 task/session 을 재사용하거나, 없으면 신규 생성한다.
   * bumpMessageCount=true 면 message_count 를 증가시키고 phase 를 반환한다.
   */
  ensureCcSession(input: CcSessionEnsureInput): CcSessionEnsureResult {
    const now = new Date().toISOString();
    const workspacePath = input.workspacePath
      ? normalizeWorkspacePath(input.workspacePath)
      : undefined;

    const existing = this.database.getCcSession(input.ccSessionId);

    // 1. 활성 세션이 있으면 그대로 반환
    if (existing?.monitor_session_id) {
      const phase = this.#resolveCcPhase(existing);
      if (input.bumpMessageCount) {
        this.database.upsertCcSession({
          ...existing,
          message_count: existing.message_count + 1,
          updated_at: now
        });
      }
      return {
        taskId: existing.task_id,
        sessionId: existing.monitor_session_id,
        phase,
        isNewTask: false
      };
    }

    // 2. 기존 task가 있지만 세션이 끊긴 경우 — 새 세션 재개
    if (existing) {
      const sessionId = crypto.randomUUID();
      this.database.createSession({
        id: sessionId,
        taskId: existing.task_id,
        status: "running",
        startedAt: now
      });
      this.database.upsertTask({
        ...this.database.getTask(existing.task_id)!,
        status: "running",
        lastSessionStartedAt: now,
        updatedAt: now
      });
      const count = input.bumpMessageCount ? existing.message_count + 1 : existing.message_count;
      this.database.upsertCcSession({
        cc_session_id: input.ccSessionId,
        task_id: existing.task_id,
        monitor_session_id: sessionId,
        message_count: count,
        updated_at: now
      });
      return {
        taskId: existing.task_id,
        sessionId,
        phase: existing.message_count === 0 ? "initial" : "follow_up",
        isNewTask: false
      };
    }

    // 3. 처음 보는 cc_session_id — 신규 task + session 생성
    const result = this.startTask({
      title: input.title,
      ...(workspacePath ? { workspacePath } : {})
    });
    const taskId    = result.task.id;
    const sessionId = result.sessionId!;
    const count     = input.bumpMessageCount ? 1 : 0;
    this.database.upsertCcSession({
      cc_session_id: input.ccSessionId,
      task_id: taskId,
      monitor_session_id: sessionId,
      message_count: count,
      updated_at: now
    });
    return { taskId, sessionId, phase: "initial", isNewTask: true };
  }

  /**
   * Claude Code 창 세션을 종료한다.
   * monitor session 을 종료하고 cc_sessions 의 monitor_session_id 를 null 로 클리어한다.
   */
  endCcSession(input: CcSessionEndInput): void {
    const now = new Date().toISOString();
    const row = this.database.getCcSession(input.ccSessionId);
    if (!row?.monitor_session_id) return;

    if (input.completeTask) {
      // Complete the task (also ends the session internally via finishTask).
      // On the next UserPromptSubmit, cc-session-ensure will find the task in
      // "completed" state with no active session and set it back to "running".
      try {
        this.completeTask({
          taskId: row.task_id,
          sessionId: row.monitor_session_id,
          summary: input.summary ?? "Claude Code session completed"
        });
      } catch {
        // task not found or already completed — fall through to session cleanup
      }
    } else {
      try {
        this.database.updateSessionStatus(row.monitor_session_id, "completed", input.summary, now);
      } catch {
        // session already ended — ignore
      }
    }

    this.database.upsertCcSession({
      ...row,
      monitor_session_id: null,
      updated_at: now
    });
  }

  /**
   * 제너릭 런타임 세션을 보장한다.
   * runtimeSource + runtimeSessionId 쌍으로 task/session을 자동 생성·재개한다.
   */
  ensureRuntimeSession(input: RuntimeSessionEnsureInput): RuntimeSessionEnsureResult {
    const now = new Date().toISOString();

    const binding = this.database.getRuntimeSessionBinding(input.runtimeSource, input.runtimeSessionId);

    // 1. 활성 세션이 있으면 그대로 반환
    if (binding?.monitor_session_id) {
      return {
        taskId: binding.task_id,
        sessionId: binding.monitor_session_id,
        taskCreated: false,
        sessionCreated: false
      };
    }

    // 2. 기존 task가 있지만 세션이 끊긴 경우 — 새 세션 재개
    if (binding) {
      const sessionId = crypto.randomUUID();
      this.database.createSession({
        id: sessionId,
        taskId: binding.task_id,
        status: "running",
        startedAt: now
      });
      this.database.upsertTask({
        ...this.database.getTask(binding.task_id)!,
        status: "running",
        lastSessionStartedAt: now,
        updatedAt: now
      });
      this.database.upsertRuntimeSessionBinding({
        ...binding,
        monitor_session_id: sessionId,
        updated_at: now
      });
      return {
        taskId: binding.task_id,
        sessionId,
        taskCreated: false,
        sessionCreated: true
      };
    }

    // 3. 처음 보는 runtimeSource+runtimeSessionId — 신규 task + session 생성
    const result = this.startTask({
      title: input.title,
      ...(input.workspacePath ? { workspacePath: input.workspacePath } : {})
    });
    const taskId = result.task.id;
    const sessionId = result.sessionId!;
    this.database.upsertRuntimeSessionBinding({
      runtime_source: input.runtimeSource,
      runtime_session_id: input.runtimeSessionId,
      task_id: taskId,
      monitor_session_id: sessionId,
      created_at: now,
      updated_at: now
    });
    return { taskId, sessionId, taskCreated: true, sessionCreated: true };
  }

  /**
   * 제너릭 런타임 세션을 종료한다.
   */
  endRuntimeSession(input: RuntimeSessionEndInput): void {
    const now = new Date().toISOString();
    const binding = this.database.getRuntimeSessionBinding(input.runtimeSource, input.runtimeSessionId);

    // no-op if no binding or session already closed
    if (!binding?.monitor_session_id) return;

    // End the monitor session
    this.database.updateSessionStatus(binding.monitor_session_id, "completed", input.summary, now);

    // Clear the binding
    this.database.upsertRuntimeSessionBinding({
      ...binding,
      monitor_session_id: null,
      updated_at: now
    });

    if (input.completeTask === true) {
      try {
        this.completeTask({
          taskId: binding.task_id,
          sessionId: binding.monitor_session_id,
          summary: input.summary ?? "Runtime session ended"
        });
      } catch {
        // task not found or already completed — ignore
      }
    } else {
      // Background task auto-completion
      const task = this.database.getTask(binding.task_id);
      if (task?.taskKind === "background" && task.status === "running") {
        const runningSessions = this.database.countRunningSessions(binding.task_id);
        if (runningSessions === 0) {
          try {
            this.completeTask({
              taskId: binding.task_id,
              sessionId: binding.monitor_session_id,
              summary: input.summary ?? "Background session completed"
            });
          } catch {
            // ignore
          }
        }
      }
    }
  }

  #resolveCcPhase(row: { message_count: number }): "initial" | "follow_up" {
    return row.message_count === 0 ? "initial" : "follow_up";
  }

  /**
   * 터미널 명령 실행을 기록한다.
   * @param input 터미널 명령 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logTerminalCommand(input: TaskTerminalCommandInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    return this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "terminal.command",
      title: input.title ?? input.command,
      body: input.body ?? input.command,
      metadata: {
        ...(input.metadata ?? {}),
        command: input.command
      },
      command: input.command,
      ...(sessionId ? { sessionId } : {}),
      ...(input.lane ? { lane: input.lane } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {})
    });
  }

  /**
   * 도구 사용 이벤트를 기록한다.
   * @param input 도구 사용 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logToolUsed(input: TaskToolUsedInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    const event = this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "tool.used",
      title: input.title ?? input.toolName,
      metadata: {
        ...(input.metadata ?? {}),
        toolName: input.toolName
      },
      toolName: input.toolName,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      ...(input.lane ? { lane: input.lane } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {})
    });

    const task = this.database.getTask(input.taskId);
    if (task && input.toolName === "background_output") {
      this.#reconcileBackgroundCompletionFromText({
        parentTask: task,
        ...(sessionId ? { parentSessionId: sessionId } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(input.body ? { body: input.body } : {}),
        source: "tool.used"
      });
    }

    return event;
  }

  /**
   * 컨텍스트 저장 이벤트를 기록한다.
   * @param input 컨텍스트 저장 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  saveContext(input: TaskContextSavedInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    return this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "context.saved",
      title: input.title,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      ...(input.lane ? { lane: input.lane } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {})
    });
  }

  /**
   * 탐색(exploration) 이벤트를 기록한다.
   * @param input 탐색 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logExploration(input: TaskExploreInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    return this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "tool.used",
      lane: (input.lane as TimelineLane | undefined) ?? "exploration",
      title: input.title,
      metadata: {
        ...(input.metadata ?? {}),
        toolName: input.toolName
      },
      toolName: input.toolName,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {})
    });
  }

  /**
   * 계획(plan) 이벤트를 기록한다.
   * @param input 계획 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logPlan(input: TaskPlanInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    return this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "plan.logged",
      lane: "planning",
      title: input.title ?? input.action,
      metadata: {
        ...(input.metadata ?? {}),
        action: input.action
      },
      actionName: input.action,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {})
    });
  }

  /**
   * 액션(action) 이벤트를 기록한다.
   * @param input 액션 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logAction(input: TaskActionInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    return this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "action.logged",
      title: input.title ?? input.action,
      metadata: {
        ...(input.metadata ?? {}),
        action: input.action
      },
      actionName: input.action,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {})
    });
  }

  /**
   * 검증(verification) 이벤트를 기록한다.
   * @param input 검증 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logVerification(input: TaskVerifyInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    return this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "verification.logged",
      lane: "rules",
      title: input.title ?? input.action,
      body: input.body ?? input.result,
      metadata: {
        ...(input.metadata ?? {}),
        action: input.action,
        result: input.result,
        verificationStatus: normalizeVerificationStatus(input.status ?? input.result)
      },
      actionName: input.action,
      ...(sessionId ? { sessionId } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {})
    });
  }

  /**
   * 규칙(rule) 이벤트를 기록한다.
   * @param input 규칙 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logRule(input: TaskRuleInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    return this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "rule.logged",
      lane: "rules",
      title: input.title ?? input.action,
      body: input.body ?? `${input.ruleId} · ${input.status} · ${input.severity}`,
      metadata: {
        ...(input.metadata ?? {}),
        action: input.action,
        ruleId: input.ruleId,
        severity: input.severity,
        ruleStatus: input.status,
        ruleSource: input.source ?? "rule-guard"
      },
      actionName: input.action,
      ...(sessionId ? { sessionId } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {})
    });
  }

  /**
   * 비동기 태스크 생명주기 이벤트를 기록한다.
   * @param input 비동기 생명주기 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logAsyncLifecycle(input: TaskAsyncLifecycleInput): RecordedEventEnvelope {
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    return this.recordWithDerivedFiles({
      taskId: input.taskId,
      kind: "action.logged",
      lane: "background",
      title: input.title ?? `Async task ${input.asyncStatus}`,
      metadata: {
        ...(input.metadata ?? {}),
        asyncTaskId: input.asyncTaskId,
        asyncStatus: input.asyncStatus,
        ...(input.description ? { description: input.description } : {}),
        ...(input.agent ? { asyncAgent: input.agent } : {}),
        ...(input.category ? { asyncCategory: input.category } : {}),
        ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
        ...(typeof input.durationMs === "number" ? { asyncDurationMs: input.durationMs } : {})
      },
      actionName: `async_task_${input.asyncStatus}`,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body || input.description ? { body: input.body ?? input.description } : {}),
      ...(input.filePaths ? { filePaths: input.filePaths } : {})
    });
  }

  /**
   * question.logged 이벤트를 기록한다.
   * questionPhase=concluded는 planning 레인, 나머지는 user 레인으로 라우팅된다.
   * @param input 질문 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logQuestion(input: TaskQuestionInput): RecordedEventEnvelope {
    const task = this.database.getTask(input.taskId);
    if (!task) throw new Error(`Task not found: ${input.taskId}`);

    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    const event = this.recordGenericEvent({
      taskId: input.taskId,
      kind: "question.logged",
      lane: "questions",
      title: input.title,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      metadata: {
        ...(input.metadata ?? {}),
        questionId: input.questionId,
        questionPhase: input.questionPhase,
        ...(typeof input.sequence === "number" ? { sequence: input.sequence } : {}),
        ...(input.modelName ? { modelName: input.modelName } : {}),
        ...(input.modelProvider ? { modelProvider: input.modelProvider } : {})
      }
    });

    return {
      task,
      ...(sessionId ? { sessionId } : {}),
      events: [{ id: event.id, kind: event.kind }]
    };
  }

  /**
   * todo.logged 이벤트를 기록한다. planning 레인으로 라우팅된다.
   * @param input 할일 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logTodo(input: TaskTodoInput): RecordedEventEnvelope {
    const task = this.database.getTask(input.taskId);
    if (!task) throw new Error(`Task not found: ${input.taskId}`);

    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    const event = this.recordGenericEvent({
      taskId: input.taskId,
      kind: "todo.logged",
      lane: "todos",
      title: input.title,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      metadata: {
        ...(input.metadata ?? {}),
        todoId: input.todoId,
        todoState: input.todoState,
        ...(typeof input.sequence === "number" ? { sequence: input.sequence } : {})
      }
    });

    return {
      task,
      ...(sessionId ? { sessionId } : {}),
      events: [{ id: event.id, kind: event.kind }]
    };
  }

  /**
   * thought.logged 이벤트를 기록한다. planning 레인으로 라우팅된다.
   * 요약된 추론만 허용 (raw chain-of-thought 금지).
   * @param input 사고 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logThought(input: TaskThoughtInput): RecordedEventEnvelope {
    const task = this.database.getTask(input.taskId);
    if (!task) throw new Error(`Task not found: ${input.taskId}`);

    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    const event = this.recordGenericEvent({
      taskId: input.taskId,
      kind: "thought.logged",
      lane: "planning",
      title: input.title,
      ...(sessionId ? { sessionId } : {}),
      ...(input.body ? { body: input.body } : {}),
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.modelName ? { modelName: input.modelName } : {}),
        ...(input.modelProvider ? { modelProvider: input.modelProvider } : {})
      }
    });

    return {
      task,
      ...(sessionId ? { sessionId } : {}),
      events: [{ id: event.id, kind: event.kind }]
    };
  }

  /**
   * 전체 개요 통계를 반환한다.
   * @returns OverviewStats
   */
  getOverview() {
    return this.database.getOverviewStats();
  }

  /**
   * 모든 태스크 목록을 반환한다.
   * @returns 태스크 배열
   */
  listTasks() {
    return this.database.listTasks();
  }

  /**
   * 특정 태스크를 ID로 조회한다.
   * @param taskId 조회할 태스크 ID
   * @returns 태스크 또는 undefined
   */
  getTask(taskId: string) {
    return this.database.getTask(taskId);
  }

  /**
   * 특정 태스크의 타임라인 이벤트를 반환한다.
   * @param taskId 조회할 태스크 ID
   * @returns 이벤트 배열
   */
  getTaskTimeline(taskId: string) {
    return this.database.getTaskTimeline(taskId);
  }

  /**
   * 태스크 이름을 변경한다.
   * @param input 이름 변경 입력
   * @returns 변경된 태스크, 없으면 undefined
   */
  renameTask(input: TaskRenameInput): MonitoringTask | undefined {
    const task = this.database.getTask(input.taskId);

    if (!task) {
      return undefined;
    }

    const nextTitle = input.title.trim();
    if (nextTitle === task.title) {
      return task;
    }

    return this.database.upsertTask({
      ...task,
      title: nextTitle,
      slug: createTaskSlug({ title: nextTitle }),
      updatedAt: new Date().toISOString()
    });
  }

  linkTask(input: TaskLinkInput): MonitoringTask {
    const normalizedTitle = input.title?.trim();
    const task = this.database.updateTaskLink({
      taskId: input.taskId,
      ...(normalizedTitle ? { title: normalizedTitle, slug: createTaskSlug({ title: normalizedTitle }) } : {}),
      ...(input.taskKind ? { taskKind: input.taskKind } : {}),
      ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
      ...(input.parentSessionId ? { parentSessionId: input.parentSessionId } : {}),
      ...(input.backgroundTaskId ? { backgroundTaskId: input.backgroundTaskId } : {}),
      updatedAt: new Date().toISOString()
    });

    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    return task;
  }

  /**
   * 태스크를 삭제한다.
   * @param taskId 삭제할 태스크 ID
   * @returns "deleted" | "not_found"
   */
  deleteTask(taskId: string): "deleted" | "not_found" {
    return this.database.deleteTask(taskId);
  }

  /**
   * 완료·에러 상태의 모든 태스크를 삭제한다.
   * @returns 삭제된 태스크 수
   */
  deleteFinishedTasks(): number {
    return this.database.deleteFinishedTasks();
  }

  private finishTask(
    input: TaskCompletionInput,
    status: MonitoringTask["status"],
    kind: MonitoringEventKind,
    body?: string
  ): RecordedEventEnvelope {
    const task = this.database.getTask(input.taskId);

    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    const endedAt = new Date().toISOString();
    const sessionId = input.sessionId ?? this.database.findLatestSession(input.taskId)?.id;

    if (sessionId) {
      this.database.updateSessionStatus(sessionId, status, input.summary, endedAt);
    }

    if (task.status === status) {
      return {
        task,
        ...(sessionId ? { sessionId } : {}),
        events: []
      };
    }

    const updatedTask = this.database.upsertTask({
      ...task,
      status,
      updatedAt: endedAt
    });

    const event = this.recordGenericEvent({
      taskId: input.taskId,
      kind,
      title: status === "completed" ? "Task completed" : "Task errored",
      ...(sessionId ? { sessionId } : {}),
      ...(body ? { body } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {})
    });

    return {
      task: updatedTask,
      ...(sessionId ? { sessionId } : {}),
      events: [{ id: event.id, kind: event.kind }]
    };
  }

  private recordWithDerivedFiles(input: GenericEventInput): RecordedEventEnvelope {
    const task = this.database.getTask(input.taskId);

    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    const primaryEvent = this.recordGenericEvent(input);
    const derivedEvents = (input.filePaths ?? []).map((filePath) =>
      this.recordGenericEvent({
        taskId: input.taskId,
        kind: "file.changed",
        title: path.basename(filePath),
        body: filePath,
        filePaths: [filePath],
        metadata: {
          sourceKind: input.kind,
          sourceEventId: primaryEvent.id
        },
        ...(input.sessionId ? { sessionId: input.sessionId } : {})
      })
    );

    return {
      task,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      events: [primaryEvent, ...derivedEvents].map((event) => ({
        id: event.id,
        kind: event.kind
      }))
    };
  }

  private recordGenericEvent(input: GenericEventInput): TimelineEvent {
    const createdAt = new Date().toISOString();
    const classification = classifyEvent(
      {
        kind: input.kind,
        title: input.title,
        ...(input.lane ? { lane: input.lane as TimelineLane } : {}),
        ...(input.body ? { body: input.body } : {}),
        ...(input.command ? { command: input.command } : {}),
        ...(input.toolName ? { toolName: input.toolName } : {}),
        ...(input.actionName ? { actionName: input.actionName } : {}),
        ...(input.filePaths ? { filePaths: input.filePaths } : {})
      },
      this.#rulesIndex
    );
    const contextualTags = deriveContextualTags(input);

    return this.database.appendEvent({
      id: crypto.randomUUID(),
      taskId: input.taskId,
      kind: input.kind,
      lane: classification.lane,
      title: input.title,
      metadata: {
        ...(input.metadata ?? {}),
        filePaths: input.filePaths ?? []
      },
      classification: {
        ...classification,
        tags: [...new Set([...classification.tags, ...contextualTags])]
      },
      createdAt,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      ...(input.body ? { body: input.body } : {})
    });
  }
}

function normalizeVerificationStatus(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.includes("pass") || normalized.includes("ok") || normalized.includes("success")) {
    return "pass";
  }

  if (normalized.includes("fail") || normalized.includes("error")) {
    return "fail";
  }

  if (normalized.includes("warn")) {
    return "warn";
  }

  return normalized;
}

function deriveContextualTags(input: GenericEventInput): readonly string[] {
  const tags = new Set<string>();
  const metadata = input.metadata ?? {};

  if (input.actionName) {
    const rootAction = tokenizeActionName(input.actionName)[0];
    if (rootAction) {
      tags.add(`action:${normalizeTagSegment(rootAction)}`);
    }
  }

  if (input.kind === "verification.logged") {
    tags.add("verification");
  }

  if (input.kind === "rule.logged") {
    tags.add("rule-event");
  }

  const ruleId = extractMetadataString(metadata, "ruleId");
  if (ruleId) {
    tags.add(`rule:${normalizeTagSegment(ruleId)}`);
  }

  const ruleStatus = extractMetadataString(metadata, "ruleStatus");
  if (ruleStatus) {
    tags.add(`status:${normalizeTagSegment(ruleStatus)}`);
  }

  const verificationStatus = extractMetadataString(metadata, "verificationStatus");
  if (verificationStatus) {
    tags.add(`status:${normalizeTagSegment(verificationStatus)}`);
  }

  const severity = extractMetadataString(metadata, "severity");
  if (severity) {
    tags.add(`severity:${normalizeTagSegment(severity)}`);
  }

  const asyncTaskId = extractMetadataString(metadata, "asyncTaskId");
  if (asyncTaskId) {
    tags.add("async-task");
  }

  const asyncStatus = extractMetadataString(metadata, "asyncStatus");
  if (asyncStatus) {
    tags.add(`async:${normalizeTagSegment(asyncStatus)}`);
    tags.add(`status:${normalizeTagSegment(asyncStatus)}`);
  }

  const asyncAgent = extractMetadataString(metadata, "asyncAgent");
  if (asyncAgent) {
    tags.add(`agent:${normalizeTagSegment(asyncAgent)}`);
  }

  const asyncCategory = extractMetadataString(metadata, "asyncCategory");
  if (asyncCategory) {
    tags.add(`category:${normalizeTagSegment(asyncCategory)}`);
  }

  const ruleSource = extractMetadataString(metadata, "ruleSource");
  if (ruleSource) {
    tags.add(`source:${normalizeTagSegment(ruleSource)}`);
  }

  // question/todo/thought/model/MCP 컨텍스트 태그
  const questionId = extractMetadataString(metadata, "questionId");
  if (questionId) tags.add("question");

  const questionPhase = extractMetadataString(metadata, "questionPhase");
  if (questionPhase) tags.add(`question:${normalizeTagSegment(questionPhase)}`);

  const todoId = extractMetadataString(metadata, "todoId");
  if (todoId) tags.add("todo");

  const todoState = extractMetadataString(metadata, "todoState");
  if (todoState) tags.add(`todo:${normalizeTagSegment(todoState)}`);

  const modelName = extractMetadataString(metadata, "modelName");
  if (modelName) tags.add(`model:${normalizeTagSegment(modelName)}`);

  const modelProvider = extractMetadataString(metadata, "modelProvider");
  if (modelProvider) tags.add(`provider:${normalizeTagSegment(modelProvider)}`);

  const mcpServer = extractMetadataString(metadata, "mcpServer");
  if (mcpServer) tags.add(`mcp:${normalizeTagSegment(mcpServer)}`);

  const mcpTool = extractMetadataString(metadata, "mcpTool");
  if (mcpTool) tags.add(`mcp-tool:${normalizeTagSegment(mcpTool)}`);

  if (extractMetadataBoolean(metadata, "compactEvent")) {
    tags.add("compact");
  }

  const compactPhase = extractMetadataString(metadata, "compactPhase");
  if (compactPhase) {
    tags.add(`compact:${normalizeTagSegment(compactPhase)}`);
  }

  const compactEventType = extractMetadataString(metadata, "compactEventType");
  if (compactEventType) {
    tags.add(`compact:${normalizeTagSegment(compactEventType)}`);
  }

  for (const compactSignal of extractMetadataStringArray(metadata, "compactSignals")) {
    tags.add(`compact:${normalizeTagSegment(compactSignal)}`);
  }

  return [...tags];
}

function extractMetadataString(
  metadata: Record<string, unknown>,
  key: string
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function extractMetadataBoolean(
  metadata: Record<string, unknown>,
  key: string
): boolean {
  return metadata[key] === true;
}

function extractMetadataStringArray(
  metadata: Record<string, unknown>,
  key: string
): readonly string[] {
  const value = metadata[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeTagSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
