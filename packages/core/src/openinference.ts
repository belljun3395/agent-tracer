import type { MonitoringTask, TimelineEvent } from "./domain.js";

export type OpenInferenceSpanKind =
  | "AGENT"
  | "CHAIN"
  | "TOOL"
  | "LLM"
  | "RETRIEVER"
  | "UNKNOWN";

export interface OpenInferenceSpanRecord {
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: OpenInferenceSpanKind;
  readonly startTime: string;
  readonly attributes: Record<string, unknown>;
}

export interface OpenInferenceTaskExport {
  readonly taskId: string;
  readonly runtimeSource?: string;
  readonly spans: readonly OpenInferenceSpanRecord[];
}

export function buildOpenInferenceTaskExport(
  task: MonitoringTask,
  timeline: readonly TimelineEvent[]
): OpenInferenceTaskExport {
  return {
    taskId: task.id,
    ...(task.runtimeSource ? { runtimeSource: task.runtimeSource } : {}),
    spans: timeline.map((event) => buildOpenInferenceSpanRecord(task.runtimeSource, event))
  };
}

export function buildOpenInferenceSpanRecord(
  runtimeSource: string | undefined,
  event: TimelineEvent
): OpenInferenceSpanRecord {
  const parentSpanId = extractString(event.metadata, "parentEventId")
    ?? extractString(event.metadata, "sourceEventId");
  const kind = mapEventToOpenInferenceKind(event);

  return {
    spanId: event.id,
    ...(parentSpanId ? { parentSpanId } : {}),
    name: event.title || event.kind,
    kind,
    startTime: event.createdAt,
    attributes: {
      "openinference.span.kind": kind,
      "ai.monitor.event.kind": event.kind,
      "ai.monitor.event.lane": event.lane,
      ...(event.sessionId ? { "session.id": event.sessionId } : {}),
      ...(runtimeSource ? { "gen_ai.system": mapRuntimeSourceToGenAiSystem(runtimeSource) } : {}),
      ...collectAttributeHints(event)
    }
  };
}

function mapEventToOpenInferenceKind(event: TimelineEvent): OpenInferenceSpanKind {
  if (event.kind === "assistant.response" || event.kind === "user.message") {
    return "LLM";
  }
  if (event.kind === "tool.used" || event.kind === "terminal.command") {
    return "TOOL";
  }
  if (event.kind === "agent.activity.logged") {
    return "AGENT";
  }
  if (event.lane === "exploration") {
    return "RETRIEVER";
  }
  if (event.lane === "planning" || event.lane === "implementation" || event.kind === "plan.logged" || event.kind === "action.logged") {
    return "CHAIN";
  }
  return "UNKNOWN";
}

function mapRuntimeSourceToGenAiSystem(runtimeSource: string): string {
  const normalized = runtimeSource.toLowerCase();
  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("opencode")) return "opencode";
  if (normalized.includes("codex")) return "openai";
  return normalized;
}

function collectAttributeHints(event: TimelineEvent): Record<string, unknown> {
  const hints: Record<string, unknown> = {};
  const copyKey = (sourceKey: string, targetKey: string): void => {
    const value = event.metadata[sourceKey];
    if (value !== undefined) {
      hints[targetKey] = value;
    }
  };

  copyKey("toolName", "tool.name");
  copyKey("ruleId", "rule.id");
  copyKey("ruleStatus", "rule.status");
  copyKey("rulePolicy", "rule.policy");
  copyKey("ruleOutcome", "rule.outcome");
  copyKey("activityType", "agent.activity.type");
  copyKey("asyncTaskId", "agent.async_task.id");
  copyKey("questionId", "question.id");
  copyKey("todoId", "todo.id");
  copyKey("captureMode", "message.capture_mode");

  const filePaths = event.metadata["filePaths"];
  if (Array.isArray(filePaths) && filePaths.length > 0) {
    hints["file.paths"] = filePaths;
  }
  return hints;
}

function extractString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}
