import { buildInspectorEventTitle, buildModelSummary, filterTimelineEvents } from "./insights.js";
import { groupInstructionsBursts } from "./instructionsBurst.js";
import { buildTimelineRelations, type TimelineConnector } from "./timeline.js";
import type { TaskObservabilityResponse, TimelineEvent, TimelineLane, TimelineRelation } from "../types.js";

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

function hasCompactPhase(event: TimelineEvent): boolean {
    const value = event.metadata["compactPhase"];
    return typeof value === "string" && value.length > 0;
}

/**
 * Returns true for events that hydrate context (instructions files, saved
 * memories, stray thoughts) rather than participate in the task narrative.
 * The main timeline hides these; the Context tab surfaces them on its own.
 * Compact-phase context.saved events stay visible because they mark the
 * boundary between compactions on the timeline.
 */
export function isContextHydrationEvent(event: TimelineEvent): boolean {
    if (event.kind === "thought.logged") return true;
    if (event.kind === "instructions.loaded") return true;
    if (event.kind === "context.saved" && !hasCompactPhase(event)) return true;
    return false;
}

/**
 * Pulls the instructions/context events out of the timeline for the
 * dedicated Context tab. Compact-phase saves are left on the main
 * timeline and are intentionally excluded here.
 */
export function selectContextHydrationEvents(timeline: readonly TimelineEvent[]): readonly TimelineEvent[] {
    return timeline.filter((event) => event.kind === "instructions.loaded"
        || (event.kind === "context.saved" && !hasCompactPhase(event)));
}

export interface ParsedConnectorKey {
    readonly sourceEventId: string;
    readonly targetEventId: string;
    readonly relationType?: string;
}

export interface SelectedTimelineConnector {
    readonly connector: TimelineConnector;
    readonly source: TimelineEvent;
    readonly target: TimelineEvent;
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
    readonly timeline: readonly TimelineEvent[];
    readonly selectedRuleId: string | null;
    readonly selectedTag: string | null;
    readonly showRuleGapsOnly: boolean;
}): readonly TimelineEvent[] {
    const withoutContextNoise = input.timeline.filter((event) => !isContextHydrationEvent(event));
    return filterTimelineEvents(withoutContextNoise, {
        laneFilters: FULL_TIMELINE_LANE_FILTERS,
        selectedRuleId: input.selectedRuleId,
        selectedTag: null,
        showRuleGapsOnly: input.showRuleGapsOnly
    });
}

export function buildSelectedConnector(
    timeline: readonly TimelineEvent[],
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
    source: TimelineEvent,
    target: TimelineEvent,
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
    readonly timeline: readonly TimelineEvent[];
    readonly selectedConnectorKey: string | null;
    readonly selectedEventId: string | null;
    readonly selectedRuleId: string | null;
    readonly selectedTag: string | null;
    readonly showRuleGapsOnly: boolean;
    readonly taskDisplayTitle: string | null;
}): {
    readonly filteredTimeline: readonly TimelineEvent[];
    readonly selectedConnector: SelectedTimelineConnector | null;
    readonly selectedEvent: TimelineEvent | null;
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
