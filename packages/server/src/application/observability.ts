import type {
  EventRelationType,
  MonitoringSession,
  MonitoringTask,
  TimelineEvent
} from "@monitor/core";
import {
  getEventEvidence,
  getRuntimeCoverageSummary,
  type EvidenceLevel,
  type RuntimeCoverageItem
} from "@monitor/core";

type ObservabilityPhase =
  | "planning"
  | "exploration"
  | "implementation"
  | "verification"
  | "coordination";

type ObservabilityPhaseBucket = ObservabilityPhase | "waiting";

export interface ObservabilityPhaseStat {
  readonly phase: ObservabilityPhase;
  readonly durationMs: number;
  readonly share: number;
}

export interface ObservabilityFileCount {
  readonly path: string;
  readonly count: number;
}

export interface ObservabilityTagCount {
  readonly tag: string;
  readonly count: number;
}

export interface ObservabilityTaskSignals {
  rawUserMessages: number;
  followUpMessages: number;
  questionsAsked: number;
  questionsClosed: number;
  questionClosureRate: number;
  todosAdded: number;
  todosCompleted: number;
  todoCompletionRate: number;
  thoughts: number;
  toolCalls: number;
  terminalCommands: number;
  verifications: number;
  backgroundTransitions: number;
  coordinationActivities: number;
  exploredFiles: number;
}

export interface ObservabilityTaskFocus {
  readonly topFiles: readonly ObservabilityFileCount[];
  readonly topTags: readonly ObservabilityTagCount[];
}

export interface ObservabilityEvidenceCount {
  readonly level: EvidenceLevel;
  readonly count: number;
}

export interface ObservabilityTaskEvidence {
  readonly defaultLevel: EvidenceLevel;
  readonly summary: string;
  readonly breakdown: readonly ObservabilityEvidenceCount[];
  readonly runtimeCoverage: readonly RuntimeCoverageItem[];
}

export interface ObservabilityRuleAuditSummary {
  readonly total: number;
  readonly checks: number;
  readonly passes: number;
  readonly violations: number;
  readonly other: number;
}

export interface ObservabilityRuleEnforcementSummary {
  readonly warnings: number;
  readonly blocked: number;
  readonly approvalRequested: number;
  readonly approved: number;
  readonly rejected: number;
  readonly bypassed: number;
  readonly activeState: "clear" | "warning" | "blocked" | "approval_required";
  readonly activeRuleId: string | undefined;
  readonly activeLabel: string | undefined;
}

export interface TaskObservabilitySummary {
  readonly taskId: string;
  readonly runtimeSource?: string;
  readonly totalDurationMs: number;
  readonly activeDurationMs: number;
  readonly totalEvents: number;
  readonly traceLinkCount: number;
  readonly traceLinkedEventCount: number;
  readonly traceLinkEligibleEventCount: number;
  readonly traceLinkCoverageRate: number;
  readonly actionRegistryGapCount: number;
  readonly actionRegistryEligibleEventCount: number;
  readonly phaseBreakdown: readonly ObservabilityPhaseStat[];
  readonly sessions: {
    readonly total: number;
    readonly resumed: number;
    readonly open: number;
  };
  readonly signals: ObservabilityTaskSignals;
  readonly focus: ObservabilityTaskFocus;
  readonly evidence: ObservabilityTaskEvidence;
  readonly rules: ObservabilityRuleAuditSummary;
  readonly ruleEnforcement: ObservabilityRuleEnforcementSummary;
}

export interface ObservabilityRuntimeSourceSummary {
  readonly runtimeSource: string;
  readonly taskCount: number;
  readonly runningTaskCount: number;
  readonly promptCaptureRate: number;
  readonly traceLinkedTaskRate: number;
}

export interface ObservabilityOverviewSummary {
  readonly generatedAt: string;
  readonly totalTasks: number;
  readonly runningTasks: number;
  readonly staleRunningTasks: number;
  readonly avgDurationMs: number;
  readonly avgEventsPerTask: number;
  readonly promptCaptureRate: number;
  readonly traceLinkedTaskRate: number;
  readonly tasksWithQuestions: number;
  readonly tasksWithTodos: number;
  readonly tasksWithCoordination: number;
  readonly tasksWithBackground: number;
  readonly tasksAwaitingApproval: number;
  readonly tasksBlockedByRule: number;
  readonly runtimeSources: readonly ObservabilityRuntimeSourceSummary[];
}

export interface TaskObservabilityResponse {
  readonly observability: TaskObservabilitySummary;
}

export interface ObservabilityOverviewResponse {
  readonly observability: ObservabilityOverviewSummary;
}

interface TaskObservabilityInput {
  readonly task: MonitoringTask;
  readonly sessions: readonly MonitoringSession[];
  readonly timeline: readonly TimelineEvent[];
  readonly now?: Date;
}

interface ObservabilityOverviewInput {
  readonly tasks: readonly MonitoringTask[];
  readonly sessionsByTaskId: ReadonlyMap<string, readonly MonitoringSession[]>;
  readonly timelinesByTaskId: ReadonlyMap<string, readonly TimelineEvent[]>;
  readonly now?: Date;
}

interface TimelineRelationEdge {
  readonly sourceEventId: string;
  readonly targetEventId: string;
  readonly relationType?: EventRelationType;
}

interface SessionWindow {
  readonly session: MonitoringSession;
  readonly startMs: number;
  readonly endMs: number;
}

const PHASE_ORDER: readonly ObservabilityPhase[] = [
  "planning",
  "exploration",
  "implementation",
  "verification",
  "coordination"
];

// Long idle gaps are treated as waiting even if the preceding event was active.
const WAITING_GAP_THRESHOLD_MS = 90_000;

// Running tasks with no observable activity for 30 minutes are considered stale.
const STALE_RUNNING_TASK_THRESHOLD_MS = 30 * 60_000;

const TOP_LIST_LIMIT = 5;
const UNKNOWN_RUNTIME_SOURCE = "unknown";
const TRACE_LINK_ELIGIBLE_KINDS = new Set<TimelineEvent["kind"]>([
  "plan.logged",
  "action.logged",
  "verification.logged",
  "rule.logged",
  "agent.activity.logged",
  "file.changed"
]);

export function analyzeTaskObservability(
  input: TaskObservabilityInput
): TaskObservabilitySummary {
  const now = input.now ?? new Date();
  const sessions = [...input.sessions].sort((left, right) => {
    return Date.parse(left.startedAt) - Date.parse(right.startedAt);
  });
  const timeline = [...input.timeline].sort((left, right) => {
    const timeDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (timeDelta !== 0) return timeDelta;
    return left.id.localeCompare(right.id);
  });

  const taskStartMs = resolveTaskStartMs(input.task, sessions, timeline);
  const taskEndMs = resolveTaskEndMs(input.task, sessions, timeline, now);
  const sessionWindows = buildSessionWindows(input.task, sessions, timeline, now, taskEndMs);

  const phaseDurations: Record<ObservabilityPhaseBucket, number> = {
    planning: 0,
    exploration: 0,
    implementation: 0,
    verification: 0,
    coordination: 0,
    waiting: 0
  };

  const signals: ObservabilityTaskSignals = {
    rawUserMessages: 0,
    followUpMessages: 0,
    questionsAsked: 0,
    questionsClosed: 0,
    questionClosureRate: 0,
    todosAdded: 0,
    todosCompleted: 0,
    todoCompletionRate: 0,
    thoughts: 0,
    toolCalls: 0,
    terminalCommands: 0,
    verifications: 0,
    backgroundTransitions: 0,
    coordinationActivities: 0,
    exploredFiles: 0
  };

  const topFiles = new Map<string, number>();
  const topTags = new Map<string, number>();
  const questionGroups = new Map<string, { readonly concluded: boolean }>();
  const todoGroups = new Map<string, { readonly completed: boolean }>();
  const ruleAudit = {
    total: 0,
    checks: 0,
    passes: 0,
    violations: 0,
    other: 0
  };
  const ruleEnforcement = {
    warnings: 0,
    blocked: 0,
    approvalRequested: 0,
    approved: 0,
    rejected: 0,
    bypassed: 0,
    activeState: "clear" as const,
    activeRuleId: undefined as string | undefined,
    activeLabel: undefined as string | undefined
  };
  const evidenceCounts = new Map<EvidenceLevel, number>([
    ["proven", 0],
    ["self_reported", 0],
    ["inferred", 0],
    ["unavailable", 0]
  ]);

  const relationEdges = collectExplicitRelations(timeline);
  const traceLinkEligibleEventIds = new Set<string>(
    timeline
      .filter((event) => isTraceLinkEligible(event))
      .map((event) => event.id)
  );
  const traceLinkedEventIds = new Set<string>();
  for (const edge of relationEdges) {
    if (traceLinkEligibleEventIds.has(edge.sourceEventId)) {
      traceLinkedEventIds.add(edge.sourceEventId);
    }
    if (traceLinkEligibleEventIds.has(edge.targetEventId)) {
      traceLinkedEventIds.add(edge.targetEventId);
    }
  }

  for (const event of timeline) {
    collectSignalsAndFocus({
      event,
      signals,
      questionGroups,
      todoGroups,
      topFiles,
      topTags
    });
    const evidence = getEventEvidence(input.task.runtimeSource, event);
    evidenceCounts.set(evidence.level, (evidenceCounts.get(evidence.level) ?? 0) + 1);
    collectRuleAudit(event, ruleAudit);
    collectRuleEnforcement(event, ruleEnforcement);
  }

  let cursorMs = taskStartMs;
  for (const window of sessionWindows) {
    if (window.startMs > cursorMs) {
      addDuration(phaseDurations, "waiting", window.startMs - cursorMs);
    }

    const sessionEvents = collectSessionEvents({
      timeline,
      session: window.session,
      startMs: window.startMs,
      endMs: window.endMs
    });

    let previousMs = window.startMs;
    let previousPhase: ObservabilityPhaseBucket = "waiting";

    for (const event of sessionEvents) {
      const eventMs = Date.parse(event.createdAt);
      if (eventMs > previousMs) {
        addDuration(phaseDurations, previousPhase, eventMs - previousMs);
      }

      previousMs = eventMs;
      previousPhase = phaseForEvent(event);
    }

    if (window.endMs > previousMs) {
      addDuration(phaseDurations, previousPhase, window.endMs - previousMs);
    }

    cursorMs = window.endMs;
  }

  if (taskEndMs > cursorMs) {
    addDuration(phaseDurations, "waiting", taskEndMs - cursorMs);
  }

  const totalDurationMs = Math.max(0, taskEndMs - taskStartMs);
  const activeDurationMs = Math.max(0, totalDurationMs - phaseDurations.waiting);
  const totalEvents = timeline.length;
  const traceLinkCount = relationEdges.length;
  const traceLinkedEventCount = traceLinkedEventIds.size;
  const traceLinkEligibleEventCount = traceLinkEligibleEventIds.size;
  const traceLinkCoverageRate = traceLinkEligibleEventCount > 0
    ? traceLinkedEventCount / traceLinkEligibleEventCount
    : 0;
  const actionRegistryEligibleEventCount = countActionRegistryGapEligibleEvents(timeline);
  const questionGroupCount = questionGroups.size;
  const todoGroupCount = todoGroups.size;
  signals.questionsClosed = [...questionGroups.values()].filter((group) => group.concluded).length;
  signals.todosCompleted = [...todoGroups.values()].filter((group) => group.completed).length;
  signals.questionClosureRate = questionGroupCount > 0
    ? signals.questionsClosed / questionGroupCount
    : 0;
  signals.todoCompletionRate = todoGroupCount > 0
    ? signals.todosCompleted / todoGroupCount
    : 0;
  signals.exploredFiles = topFiles.size;
  const runtimeCoverage = getRuntimeCoverageSummary(input.task.runtimeSource);

  return {
    taskId: input.task.id,
    ...(input.task.runtimeSource ? { runtimeSource: input.task.runtimeSource } : {}),
    totalDurationMs,
    activeDurationMs,
    totalEvents,
    traceLinkCount,
    traceLinkedEventCount,
    traceLinkEligibleEventCount,
    traceLinkCoverageRate,
    actionRegistryGapCount: countActionRegistryGaps(timeline),
    actionRegistryEligibleEventCount,
    phaseBreakdown: PHASE_ORDER.map((phase) => ({
      phase,
      durationMs: phaseDurations[phase],
      share: totalDurationMs > 0 ? phaseDurations[phase] / totalDurationMs : 0
    })),
    sessions: {
      total: sessions.length,
      resumed: Math.max(0, sessions.length - 1),
      open: sessions.filter((session) => session.status === "running" || !session.endedAt).length
    },
    signals,
    focus: {
      topFiles: topFileCounts(topFiles, TOP_LIST_LIMIT),
      topTags: topTagCounts(topTags, TOP_LIST_LIMIT)
    },
    evidence: {
      defaultLevel: runtimeCoverage.defaultLevel,
      summary: runtimeCoverage.summary,
      breakdown: [
        { level: "proven", count: evidenceCounts.get("proven") ?? 0 },
        { level: "self_reported", count: evidenceCounts.get("self_reported") ?? 0 },
        { level: "inferred", count: evidenceCounts.get("inferred") ?? 0 },
        { level: "unavailable", count: evidenceCounts.get("unavailable") ?? 0 }
      ],
      runtimeCoverage: runtimeCoverage.items
    },
    rules: ruleAudit,
    ruleEnforcement
  };
}

export function analyzeObservabilityOverview(
  input: ObservabilityOverviewInput
): ObservabilityOverviewSummary {
  const now = input.now ?? new Date();
  const analyses = input.tasks.map((task) =>
    analyzeTaskObservability({
      task,
      sessions: input.sessionsByTaskId.get(task.id) ?? [],
      timeline: input.timelinesByTaskId.get(task.id) ?? [],
      now
    })
  );

  let runningTasks = 0;
  let staleRunningTasks = 0;
  let totalDurationMs = 0;
  let totalEvents = 0;
  let tasksWithRawPrompt = 0;
  let tasksWithTraceLinks = 0;
  let tasksWithQuestions = 0;
  let tasksWithTodos = 0;
  let tasksWithCoordination = 0;
  let tasksWithBackground = 0;
  let tasksAwaitingApproval = 0;
  let tasksBlockedByRule = 0;

  const runtimeSources = new Map<string, {
    taskCount: number;
    runningTaskCount: number;
    promptCaptureCount: number;
      traceLinkedTaskCount: number;
  }>();

  for (const analysis of analyses) {
    const task = input.tasks.find((candidate) => candidate.id === analysis.taskId);
    if (!task) continue;

    if (task.status === "running") {
      runningTasks += 1;
      if (isStaleRunningTask(task, input.sessionsByTaskId.get(task.id) ?? [], input.timelinesByTaskId.get(task.id) ?? [], now)) {
        staleRunningTasks += 1;
      }
    }

    totalDurationMs += analysis.totalDurationMs;
    totalEvents += analysis.totalEvents;

    if (analysis.signals.rawUserMessages > 0) {
      tasksWithRawPrompt += 1;
    }
    if (analysis.traceLinkCount > 0) {
      tasksWithTraceLinks += 1;
    }
    if (analysis.signals.questionsAsked > 0 || analysis.signals.questionsClosed > 0) {
      tasksWithQuestions += 1;
    }
    if (analysis.signals.todosAdded > 0 || analysis.signals.todosCompleted > 0) {
      tasksWithTodos += 1;
    }
    if (analysis.signals.coordinationActivities > 0) {
      tasksWithCoordination += 1;
    }
    if (analysis.signals.backgroundTransitions > 0) {
      tasksWithBackground += 1;
    }
    if (analysis.ruleEnforcement.activeState === "approval_required") {
      tasksAwaitingApproval += 1;
    }
    if (analysis.ruleEnforcement.activeState === "blocked") {
      tasksBlockedByRule += 1;
    }

    const runtimeSource = task.runtimeSource ?? UNKNOWN_RUNTIME_SOURCE;
    const bucket = runtimeSources.get(runtimeSource) ?? {
      taskCount: 0,
      runningTaskCount: 0,
      promptCaptureCount: 0,
      traceLinkedTaskCount: 0
    };

    bucket.taskCount += 1;
    if (task.status === "running") {
      bucket.runningTaskCount += 1;
    }
    if (analysis.signals.rawUserMessages > 0) {
      bucket.promptCaptureCount += 1;
    }
    if (analysis.traceLinkCount > 0) {
      bucket.traceLinkedTaskCount += 1;
    }
    runtimeSources.set(runtimeSource, bucket);
  }

  const totalTasks = input.tasks.length;
  const runtimeSourceSummaries = [...runtimeSources.entries()]
    .map(([runtimeSource, stats]) => ({
      runtimeSource,
      taskCount: stats.taskCount,
      runningTaskCount: stats.runningTaskCount,
      promptCaptureRate: stats.taskCount > 0 ? stats.promptCaptureCount / stats.taskCount : 0,
      traceLinkedTaskRate: stats.taskCount > 0 ? stats.traceLinkedTaskCount / stats.taskCount : 0
    }))
    .sort((left, right) => {
      if (right.taskCount !== left.taskCount) {
        return right.taskCount - left.taskCount;
      }

      return left.runtimeSource.localeCompare(right.runtimeSource);
    });

  return {
    generatedAt: now.toISOString(),
    totalTasks,
    runningTasks,
    staleRunningTasks,
    avgDurationMs: totalTasks > 0 ? totalDurationMs / totalTasks : 0,
    avgEventsPerTask: totalTasks > 0 ? totalEvents / totalTasks : 0,
    promptCaptureRate: totalTasks > 0 ? tasksWithRawPrompt / totalTasks : 0,
    traceLinkedTaskRate: totalTasks > 0 ? tasksWithTraceLinks / totalTasks : 0,
    tasksWithQuestions,
    tasksWithTodos,
    tasksWithCoordination,
    tasksWithBackground,
    tasksAwaitingApproval,
    tasksBlockedByRule,
    runtimeSources: runtimeSourceSummaries
  };
}

function collectSignalsAndFocus(input: {
  readonly event: TimelineEvent;
  readonly signals: ObservabilityTaskSignals;
  readonly questionGroups: Map<string, { readonly concluded: boolean }>;
  readonly todoGroups: Map<string, { readonly completed: boolean }>;
  readonly topFiles: Map<string, number>;
  readonly topTags: Map<string, number>;
}): void {
  const { event } = input;
  const metadata = event.metadata;

  if (event.kind === "user.message" && extractString(metadata, "captureMode") === "raw") {
    input.signals.rawUserMessages += 1;
    if (extractString(metadata, "phase") === "follow_up") {
      input.signals.followUpMessages += 1;
    }
  }

  if (event.kind === "question.logged") {
    if (extractString(metadata, "questionPhase") === "asked") {
      input.signals.questionsAsked += 1;
    }
    const questionId = extractString(metadata, "questionId");
    if (questionId) {
      const existing = input.questionGroups.get(questionId) ?? { concluded: false };
      const concluded = existing.concluded || extractString(metadata, "questionPhase") === "concluded";
      input.questionGroups.set(questionId, { concluded });
    }
  }

  if (event.kind === "todo.logged") {
    if (extractString(metadata, "todoState") === "added") {
      input.signals.todosAdded += 1;
    }
    const todoId = extractString(metadata, "todoId");
    if (todoId) {
      const existing = input.todoGroups.get(todoId) ?? { completed: false };
      const completed = existing.completed || extractString(metadata, "todoState") === "completed";
      input.todoGroups.set(todoId, { completed });
    }
  }

  if (event.kind === "thought.logged") {
    input.signals.thoughts += 1;
  }

  if (event.kind === "tool.used") {
    input.signals.toolCalls += 1;
  }

  if (event.kind === "terminal.command") {
    input.signals.terminalCommands += 1;
  }

  if (event.kind === "verification.logged") {
    input.signals.verifications += 1;
  }

  if (event.kind === "agent.activity.logged" || event.lane === "coordination") {
    input.signals.coordinationActivities += 1;
  }

  if (event.lane === "background" || extractString(metadata, "asyncTaskId")) {
    input.signals.backgroundTransitions += 1;
  }

  const filePaths = collectStringArray(metadata, "filePaths");
  if (filePaths.length > 0) {
    for (const filePath of filePaths) {
      incrementCount(input.topFiles, filePath);
    }
  } else if (event.kind === "file.changed" && event.body) {
    incrementCount(input.topFiles, event.body);
  }

  for (const tag of event.classification.tags) {
    incrementCount(input.topTags, tag);
  }

}

function addDuration(
  phaseDurations: Record<ObservabilityPhaseBucket, number>,
  phase: ObservabilityPhaseBucket,
  durationMs: number
): void {
  if (durationMs <= 0) {
    return;
  }

  if (phase === "waiting") {
    phaseDurations.waiting += durationMs;
    return;
  }

  const activeDurationMs = Math.min(durationMs, WAITING_GAP_THRESHOLD_MS);
  phaseDurations[phase] += activeDurationMs;
  phaseDurations.waiting += durationMs - activeDurationMs;
}

function phaseForEvent(event: TimelineEvent): ObservabilityPhaseBucket {
  switch (event.kind) {
    case "user.message":
      return "waiting";
    case "question.logged": {
      const phase = extractString(event.metadata, "questionPhase");
      return phase === "concluded" ? "planning" : "waiting";
    }
    case "todo.logged":
    case "thought.logged":
    case "plan.logged":
    case "context.saved":
    case "task.start":
      return "planning";
    case "file.changed":
      return "exploration";
    case "agent.activity.logged":
      return "coordination";
    case "verification.logged":
    case "rule.logged":
      return "verification";
    case "action.logged":
    case "terminal.command":
    case "tool.used":
      return phaseFromLane(event.lane);
    case "task.complete":
    case "task.error":
      return "verification";
    default:
      return phaseFromLane(event.lane);
  }
}

function collectRuleAudit(
  event: TimelineEvent,
  summary: {
    total: number;
    checks: number;
    passes: number;
    violations: number;
    other: number;
  }
): void {
  if (event.kind !== "rule.logged") {
    return;
  }

  summary.total += 1;
  const status = extractString(event.metadata, "ruleStatus");
  if (status === "check") {
    summary.checks += 1;
    return;
  }
  if (status === "pass" || status === "fix-applied") {
    summary.passes += 1;
    return;
  }
  if (status === "violation") {
    summary.violations += 1;
    return;
  }
  summary.other += 1;
}

function collectRuleEnforcement(
  event: TimelineEvent,
  summary: {
    warnings: number;
    blocked: number;
    approvalRequested: number;
    approved: number;
    rejected: number;
    bypassed: number;
    activeState: "clear" | "warning" | "blocked" | "approval_required";
    activeRuleId?: string | undefined;
    activeLabel?: string | undefined;
  }
): void {
  if (event.kind !== "rule.logged") {
    return;
  }

  const outcome = extractString(event.metadata, "ruleOutcome");
  const policy = extractString(event.metadata, "rulePolicy");
  const status = extractString(event.metadata, "ruleStatus");
  const ruleId = extractString(event.metadata, "ruleId");
  const ruleLabel = normalizeRuleActiveLabel(ruleId, event.title);

  switch (outcome) {
    case "warned":
      summary.warnings += 1;
      summary.activeState = "warning";
      summary.activeRuleId = ruleId;
      summary.activeLabel = ruleLabel;
      return;
    case "blocked":
      summary.blocked += 1;
      summary.activeState = "blocked";
      summary.activeRuleId = ruleId;
      summary.activeLabel = ruleLabel;
      return;
    case "approval_requested":
      summary.approvalRequested += 1;
      summary.activeState = "approval_required";
      summary.activeRuleId = ruleId;
      summary.activeLabel = ruleLabel;
      return;
    case "approved":
      summary.approved += 1;
      summary.activeState = "clear";
      summary.activeRuleId = ruleId;
      summary.activeLabel = ruleLabel;
      return;
    case "rejected":
      summary.rejected += 1;
      summary.activeState = "blocked";
      summary.activeRuleId = ruleId;
      summary.activeLabel = ruleLabel;
      return;
    case "bypassed":
      summary.bypassed += 1;
      summary.activeState = "clear";
      summary.activeRuleId = ruleId;
      summary.activeLabel = ruleLabel;
      return;
  }

  switch (policy) {
    case "warn": {
      summary.warnings += 1;
      if (status === "violation" || status === "check") {
        summary.activeState = "warning";
        summary.activeRuleId = ruleId;
        summary.activeLabel = ruleLabel;
      }
      return;
    }
    case "block": {
      summary.blocked += 1;
      if (status === "violation" || status === "check") {
        summary.activeState = "blocked";
        summary.activeRuleId = ruleId;
        summary.activeLabel = ruleLabel;
      }
      return;
    }
    case "approval_required": {
      summary.approvalRequested += 1;
      if (status === "violation" || status === "check") {
        summary.activeState = "approval_required";
        summary.activeRuleId = ruleId;
        summary.activeLabel = ruleLabel;
      }
      return;
    }
  }
}

function normalizeRuleActiveLabel(ruleId?: string, title?: string): string | undefined {
  const normalizedRuleId = ruleId?.trim();
  if (normalizedRuleId) {
    return normalizedRuleId;
  }

  const normalizedTitle = title?.trim();
  return normalizedTitle ? normalizedTitle : undefined;
}

function phaseFromLane(lane: TimelineEvent["lane"]): ObservabilityPhaseBucket {
  switch (lane) {
    case "planning":
      return "planning";
    case "exploration":
      return "exploration";
    case "implementation":
      return "implementation";
    case "coordination":
      return "coordination";
    case "background":
      return "coordination";
    case "user":
    case "questions":
    case "todos":
      return "waiting";
  }
}

function buildSessionWindows(
  task: MonitoringTask,
  sessions: readonly MonitoringSession[],
  timeline: readonly TimelineEvent[],
  now: Date,
  taskEndMs: number
): readonly SessionWindow[] {
  if (sessions.length === 0) {
    return [];
  }

  const sessionStartHints = sessions.map((session) => Date.parse(session.startedAt));
  const eventStartHints = timeline.map((event) => Date.parse(event.createdAt));
  const startCandidates = [Date.parse(task.createdAt), ...sessionStartHints, ...eventStartHints]
    .filter(Number.isFinite);
  const firstKnownStart = startCandidates.length > 0
    ? Math.min(...startCandidates)
    : Date.parse(task.createdAt);
  const windows: SessionWindow[] = [];

  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index]!;
    const sessionStartMs = Math.max(firstKnownStart, Date.parse(session.startedAt));
    const nextSession = sessions[index + 1];
    const explicitEndMs = session.endedAt ? Date.parse(session.endedAt) : undefined;
    const fallbackEndMs = nextSession ? Date.parse(nextSession.startedAt) : taskEndMs;
    const sessionEndMs = Math.max(sessionStartMs, explicitEndMs ?? fallbackEndMs ?? taskEndMs);
    const resolvedEndMs = session.status === "running" || !session.endedAt
      ? Math.max(sessionEndMs, task.status === "running" ? now.getTime() : taskEndMs)
      : sessionEndMs;

    windows.push({
      session,
      startMs: sessionStartMs,
      endMs: resolvedEndMs
    });
  }

  return windows;
}

function collectSessionEvents(input: {
  readonly timeline: readonly TimelineEvent[];
  readonly session: MonitoringSession;
  readonly startMs: number;
  readonly endMs: number;
}): readonly TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const event of input.timeline) {
    if (event.sessionId === input.session.id) {
      events.push(event);
      continue;
    }

    if (event.sessionId) {
      continue;
    }

    const eventMs = Date.parse(event.createdAt);
    if (eventMs >= input.startMs && eventMs <= input.endMs) {
      events.push(event);
    }
  }

  return events.sort((left, right) => {
    const timeDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function resolveTaskStartMs(
  task: MonitoringTask,
  sessions: readonly MonitoringSession[],
  timeline: readonly TimelineEvent[]
): number {
  const candidates = [
    Date.parse(task.createdAt),
    ...sessions.map((session) => Date.parse(session.startedAt)),
    ...timeline.map((event) => Date.parse(event.createdAt))
  ].filter(Number.isFinite);

  return candidates.length > 0 ? Math.min(...candidates) : Date.parse(task.createdAt);
}

function resolveTaskEndMs(
  task: MonitoringTask,
  sessions: readonly MonitoringSession[],
  timeline: readonly TimelineEvent[],
  now: Date
): number {
  if (task.status === "running") {
    return now.getTime();
  }

  const candidates = [
    Date.parse(task.updatedAt),
    ...sessions.map((session) => {
      if (session.endedAt) {
        return Date.parse(session.endedAt);
      }

      return Date.parse(session.startedAt);
    }),
    ...timeline.map((event) => Date.parse(event.createdAt))
  ].filter(Number.isFinite);

  return candidates.length > 0 ? Math.max(...candidates) : Date.parse(task.updatedAt);
}

function collectExplicitRelations(timeline: readonly TimelineEvent[]): readonly TimelineRelationEdge[] {
  const eventIds = new Set<string>(timeline.map((event) => event.id));
  const seen = new Set<string>();
  const relations: TimelineRelationEdge[] = [];

  for (const event of timeline) {
    const parentEventId = extractString(event.metadata, "parentEventId");
    if (parentEventId && eventIds.has(parentEventId)) {
      const relationType = extractRelationType(event.metadata);
      pushRelation(relations, seen, {
        sourceEventId: parentEventId,
        targetEventId: event.id,
        ...(relationType ? { relationType } : {})
      });
    }

    const sourceEventId = extractString(event.metadata, "sourceEventId");
    if (sourceEventId && eventIds.has(sourceEventId) && event.kind === "file.changed") {
      pushRelation(relations, seen, {
        sourceEventId,
        targetEventId: event.id,
        relationType: "caused_by"
      });
    }

    for (const relatedEventId of collectStringArray(event.metadata, "relatedEventIds")) {
      if (!eventIds.has(relatedEventId)) {
        continue;
      }

      const relationType = extractRelationType(event.metadata);
      pushRelation(relations, seen, {
        sourceEventId: event.id,
        targetEventId: relatedEventId,
        ...(relationType ? { relationType } : {})
      });
    }
  }

  return relations;
}

function extractRelationType(metadata: Record<string, unknown>): EventRelationType | undefined {
  const relationType = extractString(metadata, "relationType");
  if (!relationType) {
    return undefined;
  }

  return relationType as EventRelationType;
}

function pushRelation(
  relations: TimelineRelationEdge[],
  seen: Set<string>,
  relation: TimelineRelationEdge
): void {
  const key = `${relation.sourceEventId}→${relation.targetEventId}:${relation.relationType ?? "relates_to"}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  relations.push(relation);
}

function isTraceLinkEligible(event: TimelineEvent): boolean {
  return TRACE_LINK_ELIGIBLE_KINDS.has(event.kind);
}

function countActionRegistryGaps(timeline: readonly TimelineEvent[]): number {
  let count = 0;

  for (const event of timeline) {
    if (!isActionRegistryGapEligible(event)) {
      continue;
    }

    if (!event.classification.matches.some((match) => match.source === "action-registry")) {
      count += 1;
    }
  }

  return count;
}

function countActionRegistryGapEligibleEvents(timeline: readonly TimelineEvent[]): number {
  let count = 0;

  for (const event of timeline) {
    if (isActionRegistryGapEligible(event)) {
      count += 1;
    }
  }

  return count;
}

function isActionRegistryGapEligible(event: TimelineEvent): boolean {
  if (event.kind === "plan.logged" || event.kind === "verification.logged" || event.kind === "rule.logged") {
    return true;
  }

  if (event.kind === "action.logged") {
    return event.lane !== "background" && !extractString(event.metadata, "asyncTaskId");
  }

  return false;
}

function isStaleRunningTask(
  task: MonitoringTask,
  sessions: readonly MonitoringSession[],
  timeline: readonly TimelineEvent[],
  now: Date
): boolean {
  const candidates = [
    Date.parse(task.updatedAt),
    Date.parse(task.createdAt),
    ...sessions.flatMap((session) => [
      Date.parse(session.startedAt),
      session.endedAt ? Date.parse(session.endedAt) : 0
    ]),
    ...timeline.map((event) => Date.parse(event.createdAt))
  ].filter(Number.isFinite);
  const lastActivityMs = candidates.length > 0
    ? Math.max(...candidates)
    : Date.parse(task.createdAt);

  return now.getTime() - lastActivityMs >= STALE_RUNNING_TASK_THRESHOLD_MS;
}

function extractString(
  metadata: Record<string, unknown>,
  key: string
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function collectStringArray(
  metadata: Record<string, unknown>,
  key: string
): readonly string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function incrementCount(map: Map<string, number>, value: string): void {
  map.set(value, (map.get(value) ?? 0) + 1);
}

function topFileCounts(
  map: Map<string, number>,
  limit: number
): readonly ObservabilityFileCount[] {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([path, count]) => ({ path, count }));
}

function topTagCounts(
  map: Map<string, number>,
  limit: number
): readonly ObservabilityTagCount[] {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}
