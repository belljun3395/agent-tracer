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
  CcSessionEndInput
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
    const task = this.database.upsertTask({
      id: taskId,
      title: input.title,
      slug: createTaskSlug({ title: input.title }),
      status: "running",
      createdAt: existingTask?.createdAt ?? startedAt,
      updatedAt: startedAt,
      lastSessionStartedAt: startedAt,
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
   * 캐노니컬 user.message 이벤트를 기록한다 (contractVersion "1").
   * raw와 derived 이벤트를 같은 태스크에 append-only 로 기록한다.
   * @param input 사용자 메시지 입력
   * @returns 태스크·세션·이벤트 envelope
   */
  logUserMessage(input: TaskUserMessageInput): RecordedEventEnvelope {
    const task = this.database.getTask(input.taskId);

    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    // 자동 이미터(opencode-plugin, claude-hook)는 sessionId를 명시적으로 제공해야 한다.
    // 그 외 소스는 latest-session fallback 허용.
    const automaticSources = ["opencode-plugin", "claude-hook"];
    const sessionId = input.sessionId
      ?? (automaticSources.includes(input.source)
        ? undefined
        : this.database.findLatestSession(input.taskId)?.id);

    // 첫 번째 사용자 메시지(phase=initial)이면:
    // - generic 제목이면 user message 제목으로 자동 업데이트
    // - cliSource가 없으면 input.source로 설정
    if (input.phase === "initial") {
      const updatedTitle = (input.title && isGenericTaskTitle(task.title))
        ? input.title
        : task.title;
      const updatedCliSource = input.source;
      if (updatedTitle !== task.title || updatedCliSource !== task.cliSource) {
        this.database.upsertTask({
          ...task,
          title: updatedTitle,
          slug: createTaskSlug({ title: updatedTitle }),
          cliSource: updatedCliSource,
          updatedAt: new Date().toISOString()
        });
      }
    }

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
        ...(input.phase ? { phase: input.phase } : {}),
        ...(input.sourceEventId ? { sourceEventId: input.sourceEventId } : {}),
        contractVersion: input.contractVersion ?? "1"
      }
    });

    return {
      task,
      ...(sessionId ? { sessionId } : {}),
      events: [{ id: event.id, kind: event.kind }]
    };
  }

  /**
   * 현재 런타임 세션을 종료한다. 태스크는 running 상태를 유지한다.
   * 작업 항목을 닫으려면 completeTask 를 명시적으로 호출해야 한다.
   * @param input 세션 종료 입력
   * @returns 종료된 sessionId와 변경되지 않은 task
   */
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

    try {
      this.database.updateSessionStatus(row.monitor_session_id, "completed", input.summary, now);
    } catch {
      // session already ended — ignore
    }
    this.database.upsertCcSession({
      ...row,
      monitor_session_id: null,
      updated_at: now
    });
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

    return this.recordWithDerivedFiles({
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
      lane: "exploration",
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
      lane: "implementation",
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
      lane: "thoughts",
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


/** Claude Code / OpenCode 등이 자동 생성하는 generic task 제목인지 판별한다. */
function isGenericTaskTitle(title: string): boolean {
  return /^(Claude Code|OpenCode)\s*[—–-]\s*/i.test(title);
}
