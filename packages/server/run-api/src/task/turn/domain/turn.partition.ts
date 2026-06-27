import type { TimelineEvent } from "@monitor/timeline-api/event/public/types/event.types.js";
import { segmentEventsByTurn } from "./segments.js";
import type {
    ResolveTurnPartitionInput,
    TurnGroup,
    TurnPartition,
    TurnPartitionUpdateInput,
} from "./turn.partition.model.js";

export type GroupIdFactory = () => string;

export function createDefaultTurnPartition(
    taskId: string,
    events: readonly TimelineEvent[],
    updatedAt: string,
    generateGroupId: GroupIdFactory,
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
        // 실제 턴이 없을 때만 빈 파티션을 허용한다.
        if (totalTurns !== 0) {
            throw new Error(`Turn partition must cover ${totalTurns} turn(s) but is empty`);
        }
        return;
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < partition.groups.length; i += 1) {
        const group = partition.groups[i]!;
        if (!group.id) throw new Error(`Turn partition group at index ${i} has empty id`);
        // 그룹 id는 UI 편집/저장 기준이므로 중복을 허용하지 않는다.
        if (seenIds.has(group.id)) throw new Error(`Duplicate turn partition group id "${group.id}"`);
        seenIds.add(group.id);
        if (!Number.isInteger(group.from) || !Number.isInteger(group.to)) {
            // 턴 범위는 정수 인덱스만 허용한다.
            throw new Error(`Turn partition group "${group.id}" has non-integer range`);
        }
        if (group.from > group.to) {
            // 시작 턴이 끝 턴보다 크면 표현할 구간이 없다.
            throw new Error(`Turn partition group "${group.id}" has inverted range ${group.from}-${group.to}`);
        }
        if (i === 0 && group.from !== 1) {
            // prelude를 제외한 첫 실제 턴은 항상 1부터 덮어야 한다.
            throw new Error(`Turn partition must start at turn 1 (got ${group.from})`);
        }
        if (i > 0) {
            const prev = partition.groups[i - 1]!;
            if (group.from <= prev.to) {
                // 같은 턴이 두 그룹에 들어가면 UI 표시와 저장 결과가 충돌한다.
                throw new Error(`Turn partition groups "${prev.id}" and "${group.id}" overlap`);
            }
            if (group.from !== prev.to + 1) {
                // 중간 턴이 빠지면 전체 대화가 일부 숨겨지므로 gap을 허용하지 않는다.
                throw new Error(`Turn partition has gap between turn ${prev.to} and turn ${group.from}`);
            }
        }
    }
    const last = partition.groups[partition.groups.length - 1]!;
    if (last.to !== totalTurns) {
        // 마지막 그룹은 현재 실제 턴 수까지 덮어야 한다.
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

export function resolveTurnPartition(
    input: ResolveTurnPartitionInput,
    generateGroupId: GroupIdFactory,
): TurnPartition {
    const total = countNonPreludeTurns(input.events);
    if (input.stored) {
        try {
            validatePartition(input.stored, total);
            return input.stored;
        } catch {
            // 저장된 파티션이 현재 턴 수와 맞지 않으면 기본 파티션으로 복구한다.
            const fallback = createDefaultTurnPartition(
                input.taskId,
                input.events,
                input.fallbackUpdatedAt,
                generateGroupId,
            );
            return { ...fallback, version: input.stored.version };
        }
    }
    return createDefaultTurnPartition(
        input.taskId,
        input.events,
        input.fallbackUpdatedAt,
        generateGroupId,
    );
}

function normalizeGroupLabel(label: string | null): string | null {
    return label === null ? null : label.trim() || null;
}
