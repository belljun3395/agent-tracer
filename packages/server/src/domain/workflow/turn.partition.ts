import type { TimelineEvent } from "../monitoring/timeline.event.js";
import { segmentEventsByTurn } from "./segments.js";

/**
 * A contiguous range of turn indices the user has chosen to treat as a unit.
 * Prelude events (pre-first-prompt) are never part of a group; they always
 * render as their own implicit section so groups stay 1:1 with user prompts.
 */
export interface TurnGroup {
    readonly id: string;
    readonly from: number;
    readonly to: number;
    readonly label: string | null;
    readonly visible: boolean;
}

/**
 * Ordered, gap-free partition of a task's non-prelude turns into user-defined groups.
 * Invariants (enforced by validatePartition):
 *   - groups are sorted by `from` ascending
 *   - for every pair (prev, next): next.from === prev.to + 1
 *   - groups[0].from === 1 and groups[last].to === totalTurnCount
 *   - all ids are unique and non-empty
 */
export interface TurnPartition {
    readonly taskId: string;
    readonly groups: readonly TurnGroup[];
    readonly version: number;
    readonly updatedAt: string;
}

export interface ResolveTurnPartitionInput {
    readonly taskId: string;
    readonly stored: TurnPartition | null;
    readonly events: readonly TimelineEvent[];
    readonly fallbackUpdatedAt: string;
}

export function buildDefaultPartition(
    taskId: string,
    events: readonly TimelineEvent[],
    updatedAt: string,
): TurnPartition {
    const segments = segmentEventsByTurn(events).filter((segment) => !segment.isPrelude);
    const groups: TurnGroup[] = segments.map((segment) => ({
        id: generateGroupId(),
        from: segment.turnIndex,
        to: segment.turnIndex,
        label: null,
        visible: true,
    }));
    return { taskId, groups, version: 1, updatedAt };
}

export function validatePartition(partition: TurnPartition, totalTurns: number): void {
    if (partition.groups.length === 0) {
        if (totalTurns !== 0) {
            throw new Error(`Turn partition must cover ${totalTurns} turn(s) but is empty`);
        }
        return;
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < partition.groups.length; i += 1) {
        const group = partition.groups[i]!;
        if (!group.id) throw new Error(`Turn partition group at index ${i} has empty id`);
        if (seenIds.has(group.id)) throw new Error(`Duplicate turn partition group id "${group.id}"`);
        seenIds.add(group.id);
        if (!Number.isInteger(group.from) || !Number.isInteger(group.to)) {
            throw new Error(`Turn partition group "${group.id}" has non-integer range`);
        }
        if (group.from > group.to) {
            throw new Error(`Turn partition group "${group.id}" has inverted range ${group.from}-${group.to}`);
        }
        if (i === 0 && group.from !== 1) {
            throw new Error(`Turn partition must start at turn 1 (got ${group.from})`);
        }
        if (i > 0) {
            const prev = partition.groups[i - 1]!;
            if (group.from <= prev.to) {
                throw new Error(`Turn partition groups "${prev.id}" and "${group.id}" overlap`);
            }
            if (group.from !== prev.to + 1) {
                throw new Error(`Turn partition has gap between turn ${prev.to} and turn ${group.from}`);
            }
        }
    }
    const last = partition.groups[partition.groups.length - 1]!;
    if (last.to !== totalTurns) {
        throw new Error(`Turn partition must cover ${totalTurns} turn(s) but ends at ${last.to}`);
    }
}

export function mergeAdjacentGroups(
    partition: TurnPartition,
    groupId: string,
    updatedAt: string,
): TurnPartition {
    const index = partition.groups.findIndex((g) => g.id === groupId);
    if (index < 0) throw new Error(`Turn partition group "${groupId}" not found`);
    if (index === partition.groups.length - 1) {
        throw new Error(`Cannot merge last turn partition group "${groupId}" (no successor)`);
    }
    const target = partition.groups[index]!;
    const successor = partition.groups[index + 1]!;
    const merged: TurnGroup = {
        id: target.id,
        from: target.from,
        to: successor.to,
        label: target.label ?? successor.label,
        visible: target.visible || successor.visible,
    };
    const next = [...partition.groups.slice(0, index), merged, ...partition.groups.slice(index + 2)];
    return { ...partition, groups: next, version: partition.version + 1, updatedAt };
}

export function splitGroup(
    partition: TurnPartition,
    groupId: string,
    atTurnIndex: number,
    updatedAt: string,
): TurnPartition {
    const index = partition.groups.findIndex((g) => g.id === groupId);
    if (index < 0) throw new Error(`Turn partition group "${groupId}" not found`);
    const target = partition.groups[index]!;
    if (target.from === target.to) {
        throw new Error(`Cannot split single-turn group "${groupId}"`);
    }
    if (!Number.isInteger(atTurnIndex) || atTurnIndex <= target.from || atTurnIndex > target.to) {
        throw new Error(
            `Split point ${atTurnIndex} is outside group range ${target.from}-${target.to}`,
        );
    }
    const left: TurnGroup = {
        id: target.id,
        from: target.from,
        to: atTurnIndex - 1,
        label: target.label,
        visible: target.visible,
    };
    const right: TurnGroup = {
        id: generateGroupId(),
        from: atTurnIndex,
        to: target.to,
        label: null,
        visible: target.visible,
    };
    const next = [...partition.groups.slice(0, index), left, right, ...partition.groups.slice(index + 1)];
    return { ...partition, groups: next, version: partition.version + 1, updatedAt };
}

export function setGroupVisibility(
    partition: TurnPartition,
    groupId: string,
    visible: boolean,
    updatedAt: string,
): TurnPartition {
    return replaceGroup(partition, groupId, (group) => ({ ...group, visible }), updatedAt);
}

export function setGroupLabel(
    partition: TurnPartition,
    groupId: string,
    label: string | null,
    updatedAt: string,
): TurnPartition {
    const normalized = label === null ? null : label.trim() || null;
    return replaceGroup(partition, groupId, (group) => ({ ...group, label: normalized }), updatedAt);
}

export function countNonPreludeTurns(events: readonly TimelineEvent[]): number {
    return segmentEventsByTurn(events).filter((segment) => !segment.isPrelude).length;
}

/**
 * Reconciles a stored partition against the current timeline. If the stored partition
 * does not cover exactly the current non-prelude turn count, we fall back to the default
 * (one group per turn). Callers should persist the fallback when they observe the mismatch.
 */
export function resolveTurnPartition(input: ResolveTurnPartitionInput): TurnPartition {
    const total = countNonPreludeTurns(input.events);
    if (input.stored) {
        try {
            validatePartition(input.stored, total);
            return input.stored;
        } catch {
            /* fall through to default */
        }
    }
    return buildDefaultPartition(input.taskId, input.events, input.fallbackUpdatedAt);
}

function replaceGroup(
    partition: TurnPartition,
    groupId: string,
    map: (group: TurnGroup) => TurnGroup,
    updatedAt: string,
): TurnPartition {
    const index = partition.groups.findIndex((g) => g.id === groupId);
    if (index < 0) throw new Error(`Turn partition group "${groupId}" not found`);
    const next = [...partition.groups];
    next[index] = map(partition.groups[index]!);
    return { ...partition, groups: next, version: partition.version + 1, updatedAt };
}

function generateGroupId(): string {
    return `tg-${globalThis.crypto.randomUUID()}`;
}
