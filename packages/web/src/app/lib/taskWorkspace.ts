import { buildInspectorEventTitle, buildModelSummary, filterTimelineEvents } from "./insights.js";
import { groupInstructionsBursts } from "./instructionsBurst.js";
import { buildTimelineRelations, type TimelineConnector } from "./timeline.js";
import type { TaskObservabilityResponse, TimelineEventRecord, TimelineLane, TimelineRelation } from "../types.js";

export const FULL_TIMELINE_LANE_FILTERS: Readonly<Record<TimelineLane, boolean>> = {
    user: true,
    questions: true,
    todos: true,
    background: true,
    coordination: true,
    exploration: true,
    planning: true,
    implementation: true,
    telemetry: true
};

function hasCompactPhase(event: TimelineEventRecord): boolean {
    const value = event.metadata["compactPhase"];
    return typeof value === "string" && value.length > 0;
}

/**
 * Returns true for events that should be hidden from the main timeline cards.
 * Only `context.saved` events with `attachmentType === "plan_mode"` remain
 * visible in the planning lane; everything else (thoughts, instructions,
 * compact boundaries, session hooks) is hidden or surfaced elsewhere.
 */
export function isContextHydrationEvent(event: TimelineEventRecord): boolean {
    if (event.kind === "thought.logged") return true;
    if (event.kind === "instructions.loaded") return true;
    if (event.kind === "plan.logged") return true;
    if (event.kind === "context.saved") {
        return event.metadata["attachmentType"] !== "plan_mode";
    }
    return false;
}

/**
 * Pulls instructions/context events out of the timeline for the Context tab.
 * Includes compact-phase and session-hook saves (now shown as timeline markers
 * rather than lane cards).
 */
export function selectContextHydrationEvents(timeline: readonly TimelineEventRecord[]): readonly TimelineEventRecord[] {
    return timeline.filter((event) => event.kind === "instructions.loaded"
        || (event.kind === "context.saved" && event.metadata["attachmentType"] !== "plan_mode"));
}

/**
 * Returns session lifecycle events that are rendered as ruler markers at the
 * top of the timeline rather than as lane cards.
 * Includes: SessionStart (trigger metadata), PreCompact, PostCompact.
 */
export function selectSessionMarkerEvents(timeline: readonly TimelineEventRecord[]): readonly TimelineEventRecord[] {
    return timeline.filter((event) => {
        if (event.kind !== "context.saved") return false;
        if (hasCompactPhase(event)) return true;
        const trigger = event.metadata["trigger"];
        return typeof trigger === "string" && trigger.length > 0 && !event.metadata["attachmentType"];
    });
}

export interface ParsedConnectorKey {
    readonly sourceEventId: string;
    readonly targetEventId: string;
    readonly relationType?: string;
}

export interface SelectedTimelineConnector {
    readonly connector: TimelineConnector;
    readonly source: TimelineEventRecord;
    readonly target: TimelineEventRecord;
}

export interface TaskObservabilityState {
    readonly taskObservability: TaskObservabilityResponse | null;
    readonly refreshTaskObservability: () => Promise<void>;
}

export function parseConnectorKey(key: string): ParsedConnectorKey | null {
    const [sourceEventId, targetPart] = key.split("→");
    if (!sourceEventId || !targetPart) {
        return null;
    }
    const [targetEventId, relationType] = targetPart.split(":");
    if (!targetEventId) {
        return null;
    }
    return { sourceEventId, targetEventId, ...(relationType ? { relationType } : {}) };
}

export function buildFilteredTimeline(input: {
    readonly timeline: readonly TimelineEventRecord[];
    readonly selectedRuleId: string | null;
    readonly selectedTag: string | null;
    readonly showRuleGapsOnly: boolean;
}): readonly TimelineEventRecord[] {
    const withoutContextNoise = input.timeline.filter((event) => !isContextHydrationEvent(event));
    return filterTimelineEvents(withoutContextNoise, {
        laneFilters: FULL_TIMELINE_LANE_FILTERS,
        selectedRuleId: input.selectedRuleId,
        selectedTag: null,
        showRuleGapsOnly: input.showRuleGapsOnly
    });
}

export function buildSelectedConnector(
    timeline: readonly TimelineEventRecord[],
    selectedConnectorKey: string | null
): SelectedTimelineConnector | null {
    if (!selectedConnectorKey) {
        return null;
    }
    const parsed = parseConnectorKey(selectedConnectorKey);
    if (!parsed) {
        return null;
    }
    const source = timeline.find((event) => event.id === parsed.sourceEventId);
    const target = timeline.find((event) => event.id === parsed.targetEventId);
    if (!source || !target) {
        return null;
    }
    const relation = buildTimelineRelations(timeline).find((item) =>
        item.sourceEventId === source.id
        && item.targetEventId === target.id
        && (item.relationType ?? undefined) === parsed.relationType
    );
    return {
        connector: buildTimelineConnector(selectedConnectorKey, source, target, parsed, relation),
        source,
        target
    };
}

function buildTimelineConnector(
    key: string,
    source: TimelineEventRecord,
    target: TimelineEventRecord,
    parsed: ParsedConnectorKey,
    relation: TimelineRelation | undefined
): TimelineConnector {
    return {
        key,
        path: "",
        lane: target.lane,
        cross: source.lane !== target.lane,
        sourceEventId: source.id,
        targetEventId: target.id,
        sourceLane: source.lane,
        targetLane: target.lane,
        isExplicit: relation?.isExplicit ?? parsed.relationType !== "sequence",
        ...((relation?.relationType ?? parsed.relationType) !== undefined
            ? { relationType: relation?.relationType ?? parsed.relationType }
            : {}),
        ...(relation?.label !== undefined ? { label: relation.label } : {}),
        ...(relation?.explanation !== undefined ? { explanation: relation.explanation } : {}),
        ...(relation?.workItemId !== undefined ? { workItemId: relation.workItemId } : {}),
        ...(relation?.goalId !== undefined ? { goalId: relation.goalId } : {}),
        ...(relation?.planId !== undefined ? { planId: relation.planId } : {}),
        ...(relation?.handoffId !== undefined ? { handoffId: relation.handoffId } : {})
    };
}

export function buildTaskWorkspaceSelection(input: {
    readonly timeline: readonly TimelineEventRecord[];
    readonly selectedConnectorKey: string | null;
    readonly selectedEventId: string | null;
    readonly selectedRuleId: string | null;
    readonly selectedTag: string | null;
    readonly showRuleGapsOnly: boolean;
    readonly taskDisplayTitle: string | null;
}): {
    readonly filteredTimeline: readonly TimelineEventRecord[];
    readonly selectedConnector: SelectedTimelineConnector | null;
    readonly selectedEvent: TimelineEventRecord | null;
    readonly selectedEventDisplayTitle: string | null;
    readonly modelSummary: ReturnType<typeof buildModelSummary>;
} {
    const groupedTimeline = groupInstructionsBursts(input.timeline);
    const filteredTimeline = buildFilteredTimeline({
        timeline: groupedTimeline,
        selectedRuleId: input.selectedRuleId,
        selectedTag: input.selectedTag,
        showRuleGapsOnly: input.showRuleGapsOnly
    });
    const selectedConnector = buildSelectedConnector(groupedTimeline, input.selectedConnectorKey);
    const selectedEvent = selectedConnector
        ? null
        : filteredTimeline.find((event) => event.id === input.selectedEventId) ?? filteredTimeline[0] ?? null;
    return {
        filteredTimeline,
        selectedConnector,
        selectedEvent,
        selectedEventDisplayTitle: selectedEvent
            ? buildInspectorEventTitle(selectedEvent, { taskDisplayTitle: input.taskDisplayTitle })
            : null,
        modelSummary: buildModelSummary(input.timeline)
    };
}
