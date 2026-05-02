import type { EvidenceLevel, RuntimeCoverageItem, RuntimeEvidenceFeatureId, RuntimeEvidenceProfile } from "./runtime-capabilities.types.js";
import type { TimelineEventRecord } from "./monitoring.js";
import { getKnownRuntimeCapabilities, getRuntimeEvidenceProfile, normalizeRuntimeAdapterId } from "./runtime-capabilities.helpers.js";

/**
 * Checks whether the adapter advertises a given evidence feature as automatic.
 */
function hasAutomaticFeature(
    profile: RuntimeEvidenceProfile | undefined,
    featureId: RuntimeEvidenceFeatureId
): boolean {
    if (!profile) {
        return false;
    }
    return profile.features.some(
        (feature) => feature.id === featureId && feature.automatic && feature.evidence === "proven"
    );
}
export interface EventEvidence {
    readonly level: EvidenceLevel;
    readonly reason: string;
}
export interface RuntimeCoverageSummary {
    readonly defaultLevel: EvidenceLevel;
    readonly summary: string;
    readonly items: readonly RuntimeCoverageItem[];
}

/**
 * Builds a self-reported evidence record for semantically logged events.
 */
function selfReported(reason: string): EventEvidence {
    return { level: "self_reported", reason };
}

/**
 * Builds a proven evidence record for events backed by runtime observation.
 */
function proven(reason: string): EventEvidence {
    return { level: "proven", reason };
}

/**
 * Builds an inferred evidence record for data derived from related observations.
 */
function inferred(reason: string): EventEvidence {
    return { level: "inferred", reason };
}

/**
 * Explains how trustworthy an individual event is based on runtime capabilities and metadata.
 */
export function getEventEvidence(runtimeSource: string | undefined, event: Pick<TimelineEventRecord, "kind" | "lane" | "metadata">): EventEvidence {
    const metaLevel = typeof event.metadata["evidenceLevel"] === "string" ? event.metadata["evidenceLevel"] as EvidenceLevel : undefined;
    const metaReason = typeof event.metadata["evidenceReason"] === "string" ? event.metadata["evidenceReason"] : undefined;
    if (metaLevel === "proven" || metaLevel === "inferred" || metaLevel === "unavailable") {
        return { level: metaLevel, reason: metaReason ?? `${metaLevel} (from event metadata)` };
    }
    const capabilities = getKnownRuntimeCapabilities(runtimeSource);
    const adapterId = normalizeRuntimeAdapterId(runtimeSource);
    const profile = adapterId ? getRuntimeEvidenceProfile(adapterId) : undefined;
    const captureMode = typeof event.metadata["captureMode"] === "string"
        ? String(event.metadata["captureMode"]).trim().toLowerCase()
        : "";
    const activityType = typeof event.metadata["activityType"] === "string"
        ? String(event.metadata["activityType"]).trim().toLowerCase()
        : "";
    const source = typeof event.metadata["source"] === "string"
        ? String(event.metadata["source"]).trim().toLowerCase()
        : "";
    if (event.kind === "file.changed") {
        return inferred("Derived from referenced file paths rather than directly emitted by the runtime.");
    }
    if (event.kind === "todo.logged" && hasAutomaticFeature(profile, "todo_tracking")) {
        return proven("Todo changes were emitted directly by the TodoWrite PostToolUse hook.");
    }
    if (event.kind === "context.saved" && hasAutomaticFeature(profile, "context_checkpoints")) {
        return proven("Context checkpoint was emitted by a session/compact hook.");
    }
    if (event.kind === "thought.logged" && hasAutomaticFeature(profile, "agent_thinking")) {
        return proven("Thinking block was parsed directly from the transcript tail.");
    }
    if (event.kind === "instructions.loaded" && hasAutomaticFeature(profile, "instruction_context")) {
        return proven("Instruction context delta was parsed from transcript attachments.");
    }
    if (event.kind === "action.logged" && hasAutomaticFeature(profile, "subagents_background")) {
        const isSubagentAction = source === "subagent-start" || source === "subagent-stop"
            || source === "subagent_start" || source === "subagent_stop";
        if (isSubagentAction) {
            return proven("Subagent action was emitted by a subagent lifecycle hook.");
        }
    }
    if (event.kind === "session.ended" && hasAutomaticFeature(profile, "session_lifecycle")) {
        return proven("Session end was emitted by the SessionEnd hook.");
    }
    if (event.kind === "plan.logged"
        || event.kind === "action.logged"
        || event.kind === "verification.logged"
        || event.kind === "rule.logged"
        || event.kind === "context.saved"
        || event.kind === "question.logged"
        || event.kind === "todo.logged"
        || event.kind === "thought.logged"
        || event.kind === "instructions.loaded"
        || event.kind === "session.ended") {
        return selfReported("Semantic event recorded by the agent/adapter instead of directly observed from the runtime.");
    }
    if (event.kind === "user.message") {
        if (capabilities?.canCaptureRawUserMessage && captureMode === "raw") {
            return proven("Runtime adapter captured the raw prompt directly.");
        }
        return selfReported("Prompt capture depends on adapter-side logging rather than an automatic runtime observer.");
    }
    if (event.kind === "assistant.response") {
        if (capabilities?.canCaptureRawUserMessage) {
            return proven("Runtime adapter emitted the assistant response boundary automatically.");
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
    if (event.kind.startsWith("task.")) {
        if (capabilities?.canCaptureRawUserMessage) {
            return proven("Task lifecycle was emitted by a runtime adapter with automatic session/task handling.");
        }
        return selfReported("Task lifecycle events depend on cooperative adapter logging rather than independent runtime observation.");
    }
    if (event.lane === "background" && capabilities?.canObserveSubagents) {
        return proven("Background activity was observed through runtime-native subagent tracking.");
    }
    return selfReported("Recorded event does not have independent runtime-backed proof metadata.");
}

/**
 * Lists the evidence coverage claims exposed by a runtime adapter for UI/reporting.
 */
function listRuntimeCoverage(runtimeSource: string | undefined): readonly RuntimeCoverageItem[] {
    const adapterId = normalizeRuntimeAdapterId(runtimeSource);
    if (!adapterId) {
        return [];
    }
    const profile = getRuntimeEvidenceProfile(adapterId);
    if (!profile) {
        return [];
    }
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
            level: "self_reported",
            note: "Planning, verification, question, todo, and rule events still depend on semantic logging by the adapter or agent."
        }
    ];
}

/**
 * Summarizes a runtime adapter's overall evidence posture plus itemized coverage details.
 */
function getRuntimeCoverageSummary(runtimeSource: string | undefined): RuntimeCoverageSummary {
    const adapterId = normalizeRuntimeAdapterId(runtimeSource);
    if (!adapterId) {
        return {
            defaultLevel: "inferred",
            summary: "No registered runtime coverage profile is available for this task.",
            items: []
        };
    }
    const profile = getRuntimeEvidenceProfile(adapterId);
    if (!profile) {
        return {
            defaultLevel: "inferred",
            summary: "No registered runtime coverage profile is available for this task.",
            items: []
        };
    }
    return {
        defaultLevel: profile.defaultEvidence,
        summary: profile.summary,
        items: listRuntimeCoverage(runtimeSource)
    };
}
