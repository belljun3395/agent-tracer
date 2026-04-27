import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import { segmentEventsByTurn } from "./segments.js";
import type {
    ResolveTurnPartitionInput,
    TurnGroup,
    TurnPartition,
    TurnPartitionUpdateInput,
} from "./turn.partition.model.js";

export function createDefaultTurnPartition(
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

export function countNonPreludeTurns(events: readonly TimelineEvent[]): number {
    return segmentEventsByTurn(events).filter((segment) => !segment.isPrelude).length;
}

export function createTurnPartitionUpdate(input: TurnPartitionUpdateInput): TurnPartition {
    return {
        taskId: input.taskId,
        groups: input.groups.map((group) => ({
            id: group.id,
            from: group.from,
            to: group.to,
            label: normalizeGroupLabel(group.label),
            visible: group.visible,
        })),
        version: (input.existing?.version ?? 0) + 1,
        updatedAt: input.updatedAt,
    };
}

/**
 * Reconciles a stored partition against the current timeline. If the stored partition
 * does not cover exactly the current non-prelude turn count, fall back to the default
 * (one group per turn) BUT preserve the stored version so optimistic-locking on the
 * client's next save still matches the DB row. Otherwise the client would always send
 * baseVersion = 1 (from a synthetic default) while the DB carries the real version,
 * producing an unrecoverable 409 loop.
 */
export function resolveTurnPartition(input: ResolveTurnPartitionInput): TurnPartition {
    const total = countNonPreludeTurns(input.events);
    if (input.stored) {
        try {
            validatePartition(input.stored, total);
            return input.stored;
        } catch {
            const fallback = createDefaultTurnPartition(input.taskId, input.events, input.fallbackUpdatedAt);
            return { ...fallback, version: input.stored.version };
        }
    }
    return createDefaultTurnPartition(input.taskId, input.events, input.fallbackUpdatedAt);
}

function normalizeGroupLabel(label: string | null): string | null {
    return label === null ? null : label.trim() || null;
}

function generateGroupId(): string {
    return `tg-${globalThis.crypto.randomUUID()}`;
}
