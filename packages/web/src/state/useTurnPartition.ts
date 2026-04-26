import { useCallback, useEffect, useMemo, useState } from "react";
import { TaskId } from "~domain/monitoring.js";
import type { TimelineEventRecord } from "~domain/monitoring.js";
import { buildDefaultPartition, countNonPreludeTurns, mergeAdjacentGroups, resolveTurnPartition, setGroupLabel, setGroupVisibility, splitGroup, validatePartition } from "~domain/turn-partition.js";
import type { TurnGroup, TurnPartition } from "~domain/turn-partition.js";
import { fetchTurnPartition, resetTurnPartition, saveTurnPartition } from "~io/api.js";

export interface UseTurnPartitionResult {
    readonly partition: TurnPartition | null;
    readonly isLoading: boolean;
    readonly isSaving: boolean;
    readonly error: string | null;
    readonly mergeNext: (groupId: string) => Promise<void>;
    readonly split: (groupId: string, atTurnIndex: number) => Promise<void>;
    readonly toggleVisibility: (groupId: string) => Promise<void>;
    readonly rename: (groupId: string, label: string | null) => Promise<void>;
    readonly reset: () => Promise<void>;
}

export function useTurnPartition(
    taskId: string | null | undefined,
    timeline: readonly TimelineEventRecord[],
): UseTurnPartitionResult {
    const [partition, setPartition] = useState<TurnPartition | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!taskId) {
            setPartition(null);
            setIsLoading(false);
            return;
        }
        let active = true;
        setIsLoading(true);
        setError(null);
        void fetchTurnPartition(TaskId(taskId))
            .then((record) => {
                if (!active) return;
                setPartition(normalizePartition(record));
            })
            .catch((err) => {
                if (!active) return;
                setError(err instanceof Error ? err.message : String(err));
                setPartition(buildDefaultPartition(taskId, timeline, new Date().toISOString()));
            })
            .finally(() => {
                if (active) setIsLoading(false);
            });
        return () => {
            active = false;
        };
    }, [taskId]);

    // Reconcile when the timeline grows (new user.message events arrive) so the
    // stored partition stays valid. If the timeline's turn count no longer matches
    // the stored partition, fall back to default and persist silently.
    const turnCount = useMemo(() => countNonPreludeTurns(timeline), [timeline]);
    useEffect(() => {
        if (!taskId || !partition) return;
        try {
            validatePartition(partition, turnCount);
        } catch {
            const next = resolveTurnPartition({
                taskId,
                stored: null,
                events: timeline,
                fallbackUpdatedAt: new Date().toISOString(),
            });
            setPartition(next);
        }
    }, [taskId, partition, turnCount, timeline]);

    const persist = useCallback(
        async (next: TurnPartition): Promise<void> => {
            if (!taskId) return;
            validatePartition(next, countNonPreludeTurns(timeline));
            setIsSaving(true);
            setError(null);
            try {
                const saved = await saveTurnPartition(TaskId(taskId), {
                    groups: next.groups.map((g) => ({
                        id: g.id,
                        from: g.from,
                        to: g.to,
                        label: g.label,
                        visible: g.visible,
                    })),
                    baseVersion: (partition?.version ?? 0),
                });
                setPartition(normalizePartition(saved));
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                throw err;
            } finally {
                setIsSaving(false);
            }
        },
        [partition, taskId, timeline],
    );

    const mergeNext = useCallback(
        async (groupId: string): Promise<void> => {
            if (!partition) return;
            const next = mergeAdjacentGroups(partition, groupId, new Date().toISOString());
            await persist(next);
        },
        [partition, persist],
    );

    const split = useCallback(
        async (groupId: string, atTurnIndex: number): Promise<void> => {
            if (!partition) return;
            const next = splitGroup(partition, groupId, atTurnIndex, new Date().toISOString());
            await persist(next);
        },
        [partition, persist],
    );

    const toggleVisibility = useCallback(
        async (groupId: string): Promise<void> => {
            if (!partition) return;
            const target = partition.groups.find((g) => g.id === groupId);
            if (!target) return;
            const next = setGroupVisibility(partition, groupId, !target.visible, new Date().toISOString());
            await persist(next);
        },
        [partition, persist],
    );

    const rename = useCallback(
        async (groupId: string, label: string | null): Promise<void> => {
            if (!partition) return;
            const next = setGroupLabel(partition, groupId, label, new Date().toISOString());
            await persist(next);
        },
        [partition, persist],
    );

    const reset = useCallback(async (): Promise<void> => {
        if (!taskId) return;
        setIsSaving(true);
        setError(null);
        try {
            await resetTurnPartition(TaskId(taskId));
            setPartition(buildDefaultPartition(taskId, timeline, new Date().toISOString()));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            throw err;
        } finally {
            setIsSaving(false);
        }
    }, [taskId, timeline]);

    return { partition, isLoading, isSaving, error, mergeNext, split, toggleVisibility, rename, reset };
}

function normalizePartition(record: {
    readonly taskId: string;
    readonly groups: ReadonlyArray<{
        readonly id: string;
        readonly from: number;
        readonly to: number;
        readonly label: string | null;
        readonly visible: boolean;
    }>;
    readonly version: number;
    readonly updatedAt: string;
}): TurnPartition {
    return {
        taskId: record.taskId,
        groups: record.groups.map((g): TurnGroup => ({
            id: g.id,
            from: g.from,
            to: g.to,
            label: g.label,
            visible: g.visible,
        })),
        version: record.version,
        updatedAt: record.updatedAt,
    };
}
