import { EventId, GoalId, HandoffId, PlanId, WorkItemId } from "@monitor/core";
import type { TimelineEvent, TimelineLane, TimelineRelation } from "../types.js";
import { resolveEventSubtype, type TimelineLaneRow } from "./eventSubtype.js";
export interface TimelineItemLayout {
    readonly event: TimelineEvent;
    readonly laneKey: string;
    readonly baseLane: TimelineLane;
    readonly left: number;
    readonly top: number;
    readonly rowIndex: number;
}
export interface TimelineLayout {
    readonly width: number;
    readonly nowLeft: number;
    readonly leftGutter: number;
    readonly items: readonly TimelineItemLayout[];
    readonly tsToLeft: (ms: number) => number;
}
export interface TimelineNodeBounds {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
}
export interface TimelineConnector {
    readonly key: string;
    readonly path: string;
    readonly lane: TimelineLane;
    readonly cross: boolean;
    readonly sourceEventId: string;
    readonly targetEventId: string;
    readonly sourceLane: TimelineLane;
    readonly targetLane: TimelineLane;
    readonly relationType?: string;
    readonly label?: string;
    readonly explanation?: string;
    readonly isExplicit: boolean;
    readonly workItemId?: string;
    readonly goalId?: string;
    readonly planId?: string;
    readonly handoffId?: string;
}
export const TIMELINE_LANES: readonly TimelineLane[] = [
    "user",
    "questions",
    "todos",
    "planning",
    "coordination",
    "exploration",
    "implementation",
    "background"
];
export const LANE_HEIGHT = 80;
export const RULER_HEIGHT = 32;
export const NODE_WIDTH = 152;
export const NODE_HEIGHT = 76;
export const LEFT_GUTTER = 176;
const CLUSTER_STAGGER = NODE_WIDTH + 8;
export const ROW_VERTICAL_OFFSET = 14;
export interface TimelineLayoutOptions {
    readonly leftGutter?: number;
}
export function buildTimelineLayout(events: readonly TimelineEvent[], zoom: number, nowMs: number = Date.now(), laneRowsOrLanes: readonly TimelineLaneRow[] | readonly TimelineLane[] = TIMELINE_LANES, options?: TimelineLayoutOptions): TimelineLayout {
    const laneRows = normalizeLaneRows(laneRowsOrLanes);
    const leftGutter = options?.leftGutter ?? LEFT_GUTTER;
    if (events.length === 0) {
        return {
            width: 1200,
            nowLeft: 1200 - 32,
            leftGutter,
            items: [],
            tsToLeft: () => 1200 - 32
        };
    }
    const timestamps = events.map((event) => Date.parse(event.createdAt));
    const min = Math.min(...timestamps);
    const anchor = Math.max(nowMs, Math.max(...timestamps));
    const span = Math.max(anchor - min, 1);
    const contentWidth = Math.max(1200, Math.round(events.length * 150 * zoom));
    const trackWidth = contentWidth - leftGutter - 64;
    const NODE_HALF = NODE_WIDTH / 2;
    const trackStart = leftGutter + NODE_HALF;
    const trackEnd = trackStart + Math.max(1, trackWidth - NODE_HALF * 2);
    const usableTrack = Math.max(1, trackWidth - NODE_HALF * 2);
    const nowLeft = trackStart + Math.round(((nowMs - min) / span) * usableTrack);
    const rawItems = events.map((event) => {
        const laneKey = resolveLaneKeyForEvent(event, laneRows);
        const laneIndex = laneRows.findIndex((row) => row.key === laneKey);
        const timePosition = (Date.parse(event.createdAt) - min) / span;
        const laneRow = laneRows[laneIndex] ?? { key: event.lane, baseLane: event.lane, isSubtype: false };
        return {
            event,
            laneKey,
            baseLane: laneRow.baseLane,
            left: trackStart + Math.round(timePosition * usableTrack),
            top: RULER_HEIGHT + laneIndex * LANE_HEIGHT + 18
        };
    });
    const byLane = new Map<string, typeof rawItems>();
    for (const item of rawItems) {
        const key = item.laneKey;
        const laneItems = byLane.get(key);
        if (laneItems) {
            laneItems.push(item);
            continue;
        }
        byLane.set(key, [item]);
    }
    const adjusted = new Map<TimelineEvent, number>();
    for (const laneItems of byLane.values()) {
        const sorted = [...laneItems].sort((a, b) => a.left - b.left);
        let i = 0;
        while (i < sorted.length) {
            const currentItem = sorted[i];
            if (!currentItem)
                break;
            const anchor = currentItem.left;
            const cluster: typeof sorted = [];
            while (i < sorted.length) {
                const candidate = sorted[i];
                if (!candidate || candidate.left - anchor >= NODE_WIDTH)
                    break;
                cluster.push(candidate);
                i++;
            }
            if (cluster.length === 1)
                continue;
            const total = (cluster.length - 1) * CLUSTER_STAGGER;
            const distributedLefts = cluster.map((_, idx) => anchor - total / 2 + idx * CLUSTER_STAGGER);
            const minLeft = Math.min(...distributedLefts);
            const maxLeft = Math.max(...distributedLefts);
            let shift = 0;
            if (minLeft < trackStart) {
                shift = trackStart - minLeft;
            }
            else if (maxLeft > trackEnd) {
                shift = trackEnd - maxLeft;
            }
            for (const [idx, item] of cluster.entries()) {
                const distributedLeft = distributedLefts[idx];
                if (distributedLeft === undefined)
                    continue;
                adjusted.set(item.event, distributedLeft + shift);
            }
        }
    }
    const spreadItems = rawItems.map((item) => adjusted.has(item.event)
        ? { ...item, left: Math.round(adjusted.get(item.event) ?? item.left) }
        : item);
    const laneItemsForRows = new Map<string, typeof spreadItems>();
    for (const item of spreadItems) {
        const list = laneItemsForRows.get(item.laneKey) ?? [];
        list.push(item);
        laneItemsForRows.set(item.laneKey, list);
    }
    const rowIndexMap = new Map<TimelineEvent, number>();
    for (const laneItems of laneItemsForRows.values()) {
        const sorted = [...laneItems].sort((a, b) => a.left - b.left);
        const rowEnds: number[] = [];
        for (const item of sorted) {
            const itemLeft = item.left - NODE_WIDTH / 2;
            const itemRight = item.left + NODE_WIDTH / 2;
            let assigned = -1;
            for (let r = 0; r < rowEnds.length; r++) {
                if ((rowEnds[r] ?? 0) <= itemLeft) {
                    assigned = r;
                    rowEnds[r] = itemRight;
                    break;
                }
            }
            if (assigned === -1) {
                assigned = rowEnds.length;
                rowEnds.push(itemRight);
            }
            rowIndexMap.set(item.event, assigned);
        }
    }
    const items: TimelineItemLayout[] = spreadItems.map((item) => ({
        ...item,
        rowIndex: rowIndexMap.get(item.event) ?? 0
    }));
    const tsToLeft = (ms: number): number => trackStart + Math.round(((ms - min) / span) * usableTrack);
    return { width: contentWidth, nowLeft, leftGutter, items, tsToLeft };
}
export interface TimestampTick {
    readonly x: number;
    readonly label: string;
}
export interface TimelineContextSummary {
    readonly eventSummary: string;
    readonly laneSummary: string;
    readonly focusSummary: string | null;
}
export const DEFAULT_TIMELINE_VIEWPORT_HEIGHT = RULER_HEIGHT + LANE_HEIGHT * 7;
export function resolveTimelineViewportHeight(contentHeight: number, preferredMaxHeight: number): number {
    return Math.min(contentHeight, preferredMaxHeight);
}
export function buildTimelineContextSummary(input: {
    filteredEventCount: number;
    totalEventCount: number;
    activeLaneCount: number;
    totalLaneCount: number;
    selectedRuleId: string | null;
    selectedTag: string | null;
    showRuleGapsOnly: boolean;
}): TimelineContextSummary {
    const eventSummary = `${input.filteredEventCount}/${input.totalEventCount} events`;
    const laneSummary = input.activeLaneCount === input.totalLaneCount
        ? "All lanes"
        : `${input.activeLaneCount}/${input.totalLaneCount} lanes`;
    const focusSummary = input.showRuleGapsOnly
        ? "Rule gaps"
        : input.selectedRuleId
            ? `Rule: ${input.selectedRuleId}`
            : input.selectedTag
                ? `Tag: ${input.selectedTag}`
                : null;
    return {
        eventSummary,
        laneSummary,
        focusSummary
    };
}
export function buildTimestampTicks(events: readonly TimelineEvent[], layout: TimelineLayout, nowMs: number): readonly TimestampTick[] {
    if (events.length === 0)
        return [];
    const timestamps = events.map((e) => Date.parse(e.createdAt));
    const min = Math.min(...timestamps);
    const anchor = Math.max(nowMs, Math.max(...timestamps));
    const span = anchor - min;
    if (span <= 0)
        return [];
    const trackWidth = layout.width - layout.leftGutter - 64;
    const candidates = [2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000];
    const interval = candidates.find((i) => span / i <= 12) ?? 600000;
    const ticks: TimestampTick[] = [];
    const firstTick = Math.ceil(min / interval) * interval;
    for (let t = firstTick; t <= anchor + interval; t += interval) {
        const ratio = (t - min) / span;
        const x = layout.leftGutter + Math.round(ratio * trackWidth);
        if (x < layout.leftGutter || x > layout.width)
            continue;
        const d = new Date(t);
        const h = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        const s = String(d.getSeconds()).padStart(2, "0");
        ticks.push({ x, label: `${h}:${m}:${s}` });
    }
    return ticks;
}
export function buildTimelineConnectors(items: readonly TimelineItemLayout[], nodeBoundsById: Readonly<Record<string, TimelineNodeBounds>> = {}): readonly TimelineConnector[] {
    const relations = buildTimelineRelations(items.map((item) => item.event));
    const itemById = new Map<string, (typeof items)[number]>(items.map((item) => [item.event.id, item]));
    const sorted = [...items].sort((a, b) => {
        const dt = Date.parse(a.event.createdAt) - Date.parse(b.event.createdAt);
        if (dt !== 0)
            return dt;
        const laneOrder = a.top - b.top;
        if (laneOrder !== 0)
            return laneOrder;
        return a.left - b.left;
    });
    const incomingExplicitTargets = new Set(relations.map((relation) => relation.targetEventId));
    const fallbackRelations: TimelineRelation[] = [];
    for (let index = 0; index < sorted.length - 1; index += 1) {
        const source = sorted[index];
        const target = sorted[index + 1];
        if (!source || !target || incomingExplicitTargets.has(target.event.id)) {
            continue;
        }
        fallbackRelations.push({
            sourceEventId: source.event.id,
            targetEventId: target.event.id,
            relationType: "relates_to",
            label: "sequence",
            explanation: "Fallback chronological flow.",
            isExplicit: false
        });
    }
    const result: TimelineConnector[] = [];
    for (const relation of [...relations, ...fallbackRelations]) {
        const sourceItem = itemById.get(relation.sourceEventId);
        const targetItem = itemById.get(relation.targetEventId);
        if (!sourceItem || !targetItem) {
            continue;
        }
        const pathInfo = buildConnectorPath(sourceItem, targetItem, nodeBoundsById[sourceItem.event.id], nodeBoundsById[targetItem.event.id]);
        if (!pathInfo) {
            continue;
        }
        result.push({
            key: `${relation.sourceEventId}→${relation.targetEventId}:${relation.relationType ?? (relation.isExplicit ? "explicit" : "sequence")}`,
            path: pathInfo.path,
            lane: targetItem.event.lane,
            cross: pathInfo.cross,
            sourceEventId: relation.sourceEventId,
            targetEventId: relation.targetEventId,
            sourceLane: sourceItem.event.lane,
            targetLane: targetItem.event.lane,
            isExplicit: relation.isExplicit,
            ...buildOptionalRelationFields(relation)
        });
    }
    return result;
}
export function buildTimelineRelations(events: readonly TimelineEvent[]): readonly TimelineRelation[] {
    const eventIds = new Set<string>(events.map((event) => event.id));
    const seen = new Set<string>();
    const relations: TimelineRelation[] = [];
    for (const event of events) {
        const parentEventId = extractMetadataString(event.metadata, "parentEventId");
        if (parentEventId && eventIds.has(parentEventId)) {
            const relationType = extractMetadataString(event.metadata, "relationType");
            const label = extractMetadataString(event.metadata, "relationLabel");
            const explanation = extractMetadataString(event.metadata, "relationExplanation");
            const workItemId = extractMetadataString(event.metadata, "workItemId");
            const goalId = extractMetadataString(event.metadata, "goalId");
            const planId = extractMetadataString(event.metadata, "planId");
            const handoffId = extractMetadataString(event.metadata, "handoffId");
            const relation: TimelineRelation = {
                sourceEventId: EventId(parentEventId),
                targetEventId: event.id,
                isExplicit: true,
                ...(relationType !== undefined ? { relationType } : {}),
                ...(label !== undefined ? { label } : {}),
                ...(explanation !== undefined ? { explanation } : {}),
                ...(workItemId !== undefined ? { workItemId: WorkItemId(workItemId) } : {}),
                ...(goalId !== undefined ? { goalId: GoalId(goalId) } : {}),
                ...(planId !== undefined ? { planId: PlanId(planId) } : {}),
                ...(handoffId !== undefined ? { handoffId: HandoffId(handoffId) } : {})
            };
            pushRelation(relations, seen, relation);
        }
        for (const relatedEventId of extractMetadataStringArray(event.metadata, "relatedEventIds")) {
            if (!eventIds.has(relatedEventId)) {
                continue;
            }
            const relationType = extractMetadataString(event.metadata, "relationType");
            const label = extractMetadataString(event.metadata, "relationLabel");
            const explanation = extractMetadataString(event.metadata, "relationExplanation");
            const workItemId = extractMetadataString(event.metadata, "workItemId");
            const goalId = extractMetadataString(event.metadata, "goalId");
            const planId = extractMetadataString(event.metadata, "planId");
            const handoffId = extractMetadataString(event.metadata, "handoffId");
            const relation: TimelineRelation = {
                sourceEventId: EventId(relatedEventId),
                targetEventId: event.id,
                isExplicit: true,
                ...(relationType !== undefined ? { relationType } : {}),
                ...(label !== undefined ? { label } : {}),
                ...(explanation !== undefined ? { explanation } : {}),
                ...(workItemId !== undefined ? { workItemId: WorkItemId(workItemId) } : {}),
                ...(goalId !== undefined ? { goalId: GoalId(goalId) } : {}),
                ...(planId !== undefined ? { planId: PlanId(planId) } : {}),
                ...(handoffId !== undefined ? { handoffId: HandoffId(handoffId) } : {})
            };
            pushRelation(relations, seen, relation);
        }
    }
    return relations;
}
export function formatRelativeTime(value: string): string {
    const delta = Date.now() - Date.parse(value);
    const minutes = Math.round(delta / 60000);
    if (minutes < 1) {
        return "just now";
    }
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}
function getTimelineNodeBounds(item: TimelineItemLayout, measuredBounds?: TimelineNodeBounds): {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly centerX: number;
    readonly centerY: number;
} {
    const left = measuredBounds?.left ?? item.left - NODE_WIDTH / 2;
    const top = measuredBounds?.top ?? item.top;
    const width = measuredBounds?.width ?? NODE_WIDTH;
    const height = measuredBounds?.height ?? NODE_HEIGHT;
    return {
        left,
        right: left + width,
        top,
        bottom: top + height,
        centerX: left + width / 2,
        centerY: top + height / 2
    };
}
function buildConnectorPath(sourceItem: TimelineItemLayout, targetItem: TimelineItemLayout, sourceBounds: TimelineNodeBounds | undefined, targetBounds: TimelineNodeBounds | undefined): {
    readonly path: string;
    readonly cross: boolean;
} | null {
    const source = getTimelineNodeBounds(sourceItem, sourceBounds);
    const target = getTimelineNodeBounds(targetItem, targetBounds);
    const sameLane = sourceItem.laneKey === targetItem.laneKey;
    if (sameLane) {
        const x1 = source.right;
        const x2 = target.left;
        if (x2 - x1 < 8) {
            return null;
        }
        const y1 = source.centerY;
        const y2 = target.centerY;
        return {
            cross: false,
            path: Math.abs(y2 - y1) < 2
                ? `M ${roundCoordinate(x1)} ${roundCoordinate(y1)} H ${roundCoordinate(x2)}`
                : `M ${roundCoordinate(x1)} ${roundCoordinate(y1)} H ${roundCoordinate((x1 + x2) / 2)} V ${roundCoordinate(y2)} H ${roundCoordinate(x2)}`
        };
    }
    const movingDown = target.centerY >= source.centerY;
    const startX = source.centerX;
    const startY = movingDown ? source.bottom : source.top;
    const endX = target.centerX;
    const endY = movingDown ? target.top : target.bottom;
    return {
        cross: true,
        path: Math.abs(endX - startX) < 8
            ? `M ${roundCoordinate(startX)} ${roundCoordinate(startY)} V ${roundCoordinate(endY)}`
            : `M ${roundCoordinate(startX)} ${roundCoordinate(startY)} V ${roundCoordinate((startY + endY) / 2)} H ${roundCoordinate(endX)} V ${roundCoordinate(endY)}`
    };
}
function normalizeLaneRows(input: readonly TimelineLaneRow[] | readonly TimelineLane[]): readonly TimelineLaneRow[] {
    if (input.length === 0) {
        return [];
    }
    const [first] = input;
    if (typeof first === "string") {
        return (input as readonly TimelineLane[]).map((lane) => ({
            key: lane,
            baseLane: lane,
            isSubtype: false
        }));
    }
    return input as readonly TimelineLaneRow[];
}
function resolveLaneKeyForEvent(event: TimelineEvent, laneRows: readonly TimelineLaneRow[]): string {
    if (laneRows.some((row) => row.key === event.lane)) {
        return event.lane;
    }
    const subtype = resolveEventSubtype(event);
    if (subtype) {
        const subtypeKey = `${event.lane}:${subtype.key}`;
        if (laneRows.some((row) => row.key === subtypeKey)) {
            return subtypeKey;
        }
    }
    const fallbackKey = `${event.lane}:uncategorized`;
    if (laneRows.some((row) => row.key === fallbackKey)) {
        return fallbackKey;
    }
    return event.lane;
}
function pushRelation(relations: TimelineRelation[], seen: Set<string>, relation: TimelineRelation): void {
    const key = `${relation.sourceEventId}→${relation.targetEventId}:${relation.relationType ?? "relates_to"}`;
    if (seen.has(key)) {
        return;
    }
    seen.add(key);
    relations.push(relation);
}
function buildOptionalRelationFields(relation: TimelineRelation): {
    readonly relationType?: string;
    readonly label?: string;
    readonly explanation?: string;
    readonly workItemId?: string;
    readonly goalId?: string;
    readonly planId?: string;
    readonly handoffId?: string;
} {
    return {
        ...(relation.relationType !== undefined ? { relationType: relation.relationType } : {}),
        ...(relation.label !== undefined ? { label: relation.label } : {}),
        ...(relation.explanation !== undefined ? { explanation: relation.explanation } : {}),
        ...(relation.workItemId !== undefined ? { workItemId: relation.workItemId } : {}),
        ...(relation.goalId !== undefined ? { goalId: relation.goalId } : {}),
        ...(relation.planId !== undefined ? { planId: relation.planId } : {}),
        ...(relation.handoffId !== undefined ? { handoffId: relation.handoffId } : {})
    };
}
function extractMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" ? value : undefined;
}
function extractMetadataStringArray(metadata: Record<string, unknown>, key: string): readonly string[] {
    const value = metadata[key];
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [];
}
function roundCoordinate(value: number): number {
    return Math.round(value);
}
