import type {
  EventRelationType,
  MonitoringSession,
  MonitoringTask,
  TimelineEvent
} from "@monitor/core";

type ObservabilityPhase =
  | "planning"
  | "exploration"
  | "implementation"
  | "verification"
  | "coordination"
  | "waiting";

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
  ruleViolations: number;
  backgroundTransitions: number;
  coordinationActivities: number;
  exploredFiles: number;
}

export interface ObservabilityTaskFocus {
  readonly workItemIds: readonly string[];
  readonly goalIds: readonly string[];
  readonly planIds: readonly string[];
  readonly handoffIds: readonly string[];
  readonly topFiles: readonly ObservabilityFileCount[];
  readonly topTags: readonly ObservabilityTagCount[];
}

export interface TaskObservabilitySummary {
  readonly taskId: string;
  readonly runtimeSource?: string;
  readonly totalDurationMs: number;
  readonly activeDurationMs: number;
  readonly waitingDurationMs: number;
  readonly totalEvents: number;
  readonly explicitRelationCount: number;
  readonly relationCoverageRate: number;
  readonly ruleGapCount: number;
  readonly phaseBreakdown: readonly ObservabilityPhaseStat[];
  readonly sessions: {
    readonly total: number;
    readonly resumed: number;
    readonly open: number;
  };
  readonly signals: ObservabilityTaskSignals;
  readonly focus: ObservabilityTaskFocus;
}

export interface ObservabilityRuntimeSourceSummary {
  readonly runtimeSource: string;
  readonly taskCount: number;
  readonly runningTaskCount: number;
  readonly promptCaptureRate: number;
  readonly explicitFlowCoverageRate: number;
}

export interface ObservabilityOverviewSummary {
  readonly generatedAt: string;
  readonly totalTasks: number;
  readonly runningTasks: number;
  readonly staleRunningTasks: number;
  readonly avgDurationMs: number;
  readonly avgEventsPerTask: number;
  readonly promptCaptureRate: number;
  readonly explicitFlowCoverageRate: number;
  readonly tasksWithQuestions: number;
  readonly tasksWithTodos: number;
  readonly tasksWithCoordination: number;
  readonly tasksWithBackground: number;
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
  "coordination",
  "waiting"
];

// Long idle gaps are treated as waiting even if the preceding event was active.
const WAITING_GAP_THRESHOLD_MS = 90_000;

// Running tasks with no observable activity for 30 minutes are considered stale.
const STALE_RUNNING_TASK_THRESHOLD_MS = 30 * 60_000;

const TOP_LIST_LIMIT = 5;
const UNKNOWN_RUNTIME_SOURCE = "unknown";

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

  const phaseDurations: Record<ObservabilityPhase, number> = {
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
    ruleViolations: 0,
    backgroundTransitions: 0,
    coordinationActivities: 0,
    exploredFiles: 0
  };

  const topFiles = new Map<string, number>();
  const topTags = new Map<string, number>();
  const workItemIds = new Map<string, number>();
  const goalIds = new Map<string, number>();
  const planIds = new Map<string, number>();
  const handoffIds = new Map<string, number>();
  const questionGroups = new Map<string, { readonly concluded: boolean }>();
  const todoGroups = new Map<string, { readonly completed: boolean }>();

  const relationEdges = collectExplicitRelations(timeline);
  const relationCoverageEventIds = new Set<string>();
  for (const edge of relationEdges) {
    relationCoverageEventIds.add(edge.sourceEventId);
    relationCoverageEventIds.add(edge.targetEventId);
  }

  for (const event of timeline) {
    collectSignalsAndFocus({
      event,
      signals,
      questionGroups,
      todoGroups,
      topFiles,
      topTags,
      workItemIds,
      goalIds,
      planIds,
      handoffIds
    });
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
    let previousPhase: ObservabilityPhase = "waiting";

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
  const waitingDurationMs = phaseDurations.waiting;
  const activeDurationMs = Math.max(0, totalDurationMs - waitingDurationMs);
  const totalEvents = timeline.length;
  const explicitRelationCount = relationEdges.length;
  const relationCoverageRate = totalEvents > 0
    ? relationCoverageEventIds.size / totalEvents
    : 0;
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

  return {
    taskId: input.task.id,
    ...(input.task.runtimeSource ? { runtimeSource: input.task.runtimeSource } : {}),
    totalDurationMs,
    activeDurationMs,
    waitingDurationMs,
    totalEvents,
    explicitRelationCount,
    relationCoverageRate,
    ruleGapCount: countRuleGaps(timeline),
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
      workItemIds: topKeys(workItemIds),
      goalIds: topKeys(goalIds),
      planIds: topKeys(planIds),
      handoffIds: topKeys(handoffIds),
      topFiles: topFileCounts(topFiles, TOP_LIST_LIMIT),
      topTags: topTagCounts(topTags, TOP_LIST_LIMIT)
    }
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
  let tasksWithExplicitFlow = 0;
  let tasksWithQuestions = 0;
  let tasksWithTodos = 0;
  let tasksWithCoordination = 0;
  let tasksWithBackground = 0;

  const runtimeSources = new Map<string, {
    taskCount: number;
    runningTaskCount: number;
    promptCaptureCount: number;
    explicitFlowCount: number;
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
    if (analysis.explicitRelationCount > 0) {
      tasksWithExplicitFlow += 1;
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

    const runtimeSource = task.runtimeSource ?? UNKNOWN_RUNTIME_SOURCE;
    const bucket = runtimeSources.get(runtimeSource) ?? {
      taskCount: 0,
      runningTaskCount: 0,
      promptCaptureCount: 0,
      explicitFlowCount: 0
    };

    bucket.taskCount += 1;
    if (task.status === "running") {
      bucket.runningTaskCount += 1;
    }
    if (analysis.signals.rawUserMessages > 0) {
      bucket.promptCaptureCount += 1;
    }
    if (analysis.explicitRelationCount > 0) {
      bucket.explicitFlowCount += 1;
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
      explicitFlowCoverageRate: stats.taskCount > 0 ? stats.explicitFlowCount / stats.taskCount : 0
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
    explicitFlowCoverageRate: totalTasks > 0 ? tasksWithExplicitFlow / totalTasks : 0,
    tasksWithQuestions,
    tasksWithTodos,
    tasksWithCoordination,
    tasksWithBackground,
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
  readonly workItemIds: Map<string, number>;
  readonly goalIds: Map<string, number>;
  readonly planIds: Map<string, number>;
  readonly handoffIds: Map<string, number>;
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

  if (event.kind === "rule.logged") {
    if (extractString(metadata, "ruleStatus") === "violation") {
      input.signals.ruleViolations += 1;
    }
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

  const workItemId = extractString(metadata, "workItemId");
  if (workItemId) {
    incrementCount(input.workItemIds, workItemId);
  }

  const goalId = extractString(metadata, "goalId");
  if (goalId) {
    incrementCount(input.goalIds, goalId);
  }

  const planId = extractString(metadata, "planId");
  if (planId) {
    incrementCount(input.planIds, planId);
  }

  const handoffId = extractString(metadata, "handoffId");
  if (handoffId) {
    incrementCount(input.handoffIds, handoffId);
  }
}

function addDuration(
  phaseDurations: Record<ObservabilityPhase, number>,
  phase: ObservabilityPhase,
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

function phaseForEvent(event: TimelineEvent): ObservabilityPhase {
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

function phaseFromLane(lane: TimelineEvent["lane"]): ObservabilityPhase {
  switch (lane) {
    case "planning":
      return "planning";
    case "exploration":
      return "exploration";
    case "implementation":
      return "implementation";
    case "rules":
      return "verification";
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
  const eventIds = new Set(timeline.map((event) => event.id));
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

function countRuleGaps(timeline: readonly TimelineEvent[]): number {
  let count = 0;

  for (const event of timeline) {
    if (event.lane === "user") {
      continue;
    }

    if (!event.classification.matches.some((match) => match.source === "rules-index")) {
      count += 1;
    }
  }

  return count;
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

function topKeys(map: Map<string, number>): readonly string[] {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, TOP_LIST_LIMIT)
    .map(([key]) => key);
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
