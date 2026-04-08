import type { TimelineEvent } from "./domain/types.js";
import {
  getKnownRuntimeCapabilities,
  getRuntimeEvidenceProfile,
  normalizeRuntimeAdapterId
} from "./runtime-capabilities.helpers.js";
import type { RuntimeEvidenceFeatureId } from "./runtime-capabilities.types.js";

export type EvidenceLevel = "proven" | "self_reported" | "inferred" | "unavailable";

export interface EventEvidence {
  readonly level: EvidenceLevel;
  readonly reason: string;
}

export interface RuntimeCoverageItem {
  readonly key: RuntimeEvidenceFeatureId | "semantic_events";
  readonly label: string;
  readonly level: EvidenceLevel;
  readonly note: string;
  readonly automatic?: boolean;
}

export interface RuntimeCoverageSummary {
  readonly defaultLevel: EvidenceLevel;
  readonly summary: string;
  readonly items: readonly RuntimeCoverageItem[];
}

function selfReported(reason: string): EventEvidence {
  return { level: "self_reported", reason };
}

function proven(reason: string): EventEvidence {
  return { level: "proven", reason };
}

function inferred(reason: string): EventEvidence {
  return { level: "inferred", reason };
}

export function getEventEvidence(
  runtimeSource: string | undefined,
  event: Pick<TimelineEvent, "kind" | "lane" | "metadata">
): EventEvidence {
  const adapterId = normalizeRuntimeAdapterId(runtimeSource);
  const capabilities = getKnownRuntimeCapabilities(runtimeSource);
  const source = typeof event.metadata["source"] === "string"
    ? String(event.metadata["source"]).trim().toLowerCase()
    : "";
  const captureMode = typeof event.metadata["captureMode"] === "string"
    ? String(event.metadata["captureMode"]).trim().toLowerCase()
    : "";
  const activityType = typeof event.metadata["activityType"] === "string"
    ? String(event.metadata["activityType"]).trim().toLowerCase()
    : "";

  if (event.kind === "file.changed") {
    return inferred("Derived from referenced file paths rather than directly emitted by the runtime.");
  }

  if (
    event.kind === "plan.logged"
    || event.kind === "action.logged"
    || event.kind === "verification.logged"
    || event.kind === "rule.logged"
    || event.kind === "context.saved"
    || event.kind === "question.logged"
    || event.kind === "todo.logged"
    || event.kind === "thought.logged"
  ) {
    return selfReported("Semantic event recorded by the agent/adapter instead of directly observed from the runtime.");
  }

  if (event.kind === "user.message") {
    if (adapterId === "claude-hook" && source === "claude-hook" && captureMode === "raw") {
      return proven("Claude hook captured the raw prompt directly.");
    }
    if ((adapterId === "opencode-plugin" || adapterId === "opencode-sse") && source === "opencode-plugin" && captureMode === "raw") {
      return proven("OpenCode plugin captured the raw prompt directly.");
    }
    if (adapterId === "codex-skill") {
      return selfReported("Codex records prompts through explicit codex-monitor MCP calls.");
    }
    return selfReported("Prompt capture depends on adapter-side logging rather than an automatic runtime observer.");
  }

  if (event.kind === "assistant.response") {
    if (adapterId === "claude-hook" && source === "claude-hook") {
      return proven("Claude stop hook emitted the assistant response boundary automatically.");
    }
    if ((adapterId === "opencode-plugin" || adapterId === "opencode-sse") && source === "opencode-plugin") {
      return proven("OpenCode plugin emitted the assistant response boundary automatically.");
    }
    if (adapterId === "codex-skill") {
      return selfReported("Codex records assistant responses through explicit codex-monitor MCP calls.");
    }
    return selfReported("Assistant boundary depends on adapter-side logging rather than an automatic runtime observer.");
  }

  if (event.kind === "tool.used" || event.kind === "terminal.command") {
    if (capabilities?.canObserveToolCalls) {
      return proven("The runtime adapter can automatically observe tool and terminal activity.");
    }
    return selfReported("Tool activity was logged, but this runtime does not advertise automatic tool observation.");
  }

  if (event.kind === "agent.activity.logged") {
    if (activityType === "mcp_call" && capabilities?.canObserveToolCalls) {
      return proven("MCP/tool coordination was inferred from an automatically observed tool call.");
    }
    if ((activityType === "delegation" || activityType === "handoff") && capabilities?.canObserveSubagents) {
      return proven("The runtime adapter can automatically observe delegation/background activity.");
    }
    return selfReported("Coordination activity was recorded semantically rather than independently observed.");
  }

  if (event.kind === "task.start" || event.kind === "task.complete" || event.kind === "task.error") {
    if (adapterId === "claude-hook" || adapterId === "opencode-plugin" || adapterId === "opencode-sse") {
      return proven("Task lifecycle was emitted by a runtime adapter with automatic session/task handling.");
    }
    if (adapterId === "codex-skill") {
      return selfReported("Codex task lifecycle is managed through explicit monitor skill calls.");
    }
  }

  if (event.lane === "background" && capabilities?.canObserveSubagents) {
    return proven("Background activity was observed through runtime-native subagent tracking.");
  }

  return selfReported("Recorded event does not have independent runtime-backed proof metadata.");
}

export function listRuntimeCoverage(runtimeSource: string | undefined): readonly RuntimeCoverageItem[] {
  const adapterId = normalizeRuntimeAdapterId(runtimeSource);
  if (!adapterId) {
    return [];
  }
  const profile = getRuntimeEvidenceProfile(adapterId);
  const items: RuntimeCoverageItem[] = profile.features.map((feature) => ({
    key: feature.id,
    label: feature.label,
    level: feature.evidence,
    note: feature.note,
    automatic: feature.automatic
  }));

  const capabilities = getKnownRuntimeCapabilities(runtimeSource);
  if (!capabilities) {
    return items;
  }

  return [
    ...items,
    {
      key: "semantic_events",
      label: "Semantic Events",
      level: adapterId === "codex-skill" ? "self_reported" : "self_reported",
      note: adapterId === "codex-skill"
        ? "Planning, verification, question, todo, and rule events still depend on cooperative monitor calls."
        : "Higher-level planning, verification, question, todo, and rule events still depend on semantic logging by the adapter or agent."
    }
  ];
}

export function getRuntimeCoverageSummary(runtimeSource: string | undefined): RuntimeCoverageSummary {
  const adapterId = normalizeRuntimeAdapterId(runtimeSource);
  if (!adapterId) {
    return {
      defaultLevel: "inferred",
      summary: "No registered runtime coverage profile is available for this task.",
      items: []
    };
  }

  const profile = getRuntimeEvidenceProfile(adapterId);
  return {
    defaultLevel: profile.defaultEvidence,
    summary: profile.summary,
    items: listRuntimeCoverage(runtimeSource)
  };
}
