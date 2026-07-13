import { Injectable } from "@nestjs/common";
import type { TaskStatus } from "@monitor/kernel";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { resolveTaskStatusEffect, type TaskEntity } from "@monitor/tracer-domain";
import type { RunProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";

interface ArrivalEffect {
    readonly occurredAt: Date;
    readonly status?: TaskStatus;
}

export interface ArrivalCoalesced {
    taskId: string;
    lastArrivalAt: Date;
    status?: TaskStatus;
    statusAt?: Date;
    statusSeq?: string;
}

function resolveArrivalEffect(record: LedgerRecord): ArrivalEffect {
    const payload = parseStoredEventPayload(record.payload);
    const explicitStatus = payload.taskEffects?.taskStatus;
    const completeTask = payload.completeTask;
    const completionReason = payload.completionReason;
    const resume = payload.resume;
    const status = resolveTaskStatusEffect({
        kind: record.kind,
        ...(explicitStatus !== undefined ? { explicitStatus } : {}),
        ...(completeTask !== undefined ? { completeTask } : {}),
        ...(completionReason !== undefined ? { completionReason } : {}),
        ...(resume !== undefined ? { resume } : {}),
    });
    return { occurredAt: record.occurredAt, ...(status !== undefined ? { status } : {}) };
}

/** 태스크별 원장 도착 효과를 병합하고 읽기 모델에 투영한다. */
@Injectable()
export class ArrivalProjection {
    merge(arrivals: Map<string, ArrivalCoalesced>, record: LedgerRecord): void {
        const effect = resolveArrivalEffect(record);
        const existing = arrivals.get(record.taskId);
        if (existing === undefined) {
            arrivals.set(record.taskId, {
                taskId: record.taskId,
                lastArrivalAt: effect.occurredAt,
                ...(effect.status !== undefined
                    ? { status: effect.status, statusAt: effect.occurredAt, statusSeq: record.seq }
                    : {}),
            });
            return;
        }
        if (effect.occurredAt.getTime() > existing.lastArrivalAt.getTime()) {
            existing.lastArrivalAt = effect.occurredAt;
        }
        if (
            effect.status !== undefined &&
            (existing.statusSeq === undefined || BigInt(record.seq) > BigInt(existing.statusSeq))
        ) {
            existing.status = effect.status;
            existing.statusAt = effect.occurredAt;
            existing.statusSeq = record.seq;
        }
    }

    async projectRecord(repositories: RunProjectionRepositories, record: LedgerRecord): Promise<TaskEntity | null> {
        const task = await repositories.tasks.findById(record.taskId);
        if (task === null) return null;
        const effect = resolveArrivalEffect(record);
        task.recordEventArrival(effect.occurredAt);
        const changed = effect.status !== undefined
            && task.applyLedgerStatusEffect(effect.status, effect.occurredAt, record.seq);
        await repositories.tasks.upsert(task);
        return changed ? task : null;
    }

    async projectBatch(
        repositories: RunProjectionRepositories,
        arrivals: ReadonlyMap<string, ArrivalCoalesced>,
    ): Promise<TaskEntity[]> {
        const changedTasks: TaskEntity[] = [];
        for (const coalesced of arrivals.values()) {
            const task = await repositories.tasks.findById(coalesced.taskId);
            if (task === null) continue;
            task.recordEventArrival(coalesced.lastArrivalAt);
            const changed = coalesced.status !== undefined
                && coalesced.statusAt !== undefined
                && coalesced.statusSeq !== undefined
                && task.applyLedgerStatusEffect(coalesced.status, coalesced.statusAt, coalesced.statusSeq);
            await repositories.tasks.upsert(task);
            if (changed) changedTasks.push(task);
        }
        return changedTasks;
    }
}
