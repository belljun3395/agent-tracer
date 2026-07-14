import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    InvariantViolationError,
    SEARCH_OUTBOX_TARGET,
    SearchOutboxEntity,
    TaskUserStateEntity,
    type TaskCleanupSuggestionEntity,
} from "@monitor/tracer-domain";
import { generateUlid } from "@monitor/platform";
import { CLOCK, type ClockPort } from "~tracer-api/domain/cleanup/port/clock.port.js";
import {
    CLEANUP_TRANSACTION,
    type CleanupTransactionPort,
    type CleanupTx,
} from "~tracer-api/domain/cleanup/port/cleanup.transaction.port.js";
import { mapCleanupSuggestion, type CleanupSuggestionDto } from "~tracer-api/domain/cleanup/model/cleanup.model.js";

@Injectable()
export class AcceptCleanupSuggestionUseCase {
    constructor(
        @Inject(CLEANUP_TRANSACTION)
        private readonly tx: CleanupTransactionPort,
        @Inject(CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly suggestion: CleanupSuggestionDto }> {
        const now = this.clock.now();
        const suggestion = await this.tx.run((tx) => this.applyInTransaction(tx, userId, id, now));
        return { suggestion: mapCleanupSuggestion(suggestion) };
    }

    private async applyInTransaction(
        tx: CleanupTx,
        userId: string,
        id: string,
        now: Date,
    ): Promise<TaskCleanupSuggestionEntity> {
        const suggestion = await tx.cleanupSuggestions.findById(id);
        // 남의 제안은 존재 자체를 알리지 않는다.
        if (suggestion === null || !suggestion.isOwnedBy(userId)) throw new NotFoundException("Cleanup suggestion not found");

        if (suggestion.isAccepted()) return suggestion;

        const task = await tx.tasks.findById(suggestion.taskId);
        if (task !== null && task.hasActivitySince(suggestion.observedLastEventAt)) {
            throw new InvariantViolationError("cleanup.stale");
        }

        suggestion.accept(now);
        await tx.cleanupSuggestions.upsert(suggestion);
        await this.archiveTask(tx, userId, suggestion.taskId, now);
        return suggestion;
    }

    private async archiveTask(tx: CleanupTx, userId: string, taskId: string, now: Date): Promise<void> {
        const state = (await tx.taskUserStates.findById(taskId)) ?? TaskUserStateEntity.init(taskId, userId, now);
        if (state.isArchived()) return;
        state.archive(now);
        await tx.taskUserStates.save(state);
        await tx.searchOutbox.enqueue(
            SearchOutboxEntity.enqueue({
                id: generateUlid(now.getTime()),
                userId,
                target: SEARCH_OUTBOX_TARGET.task,
                targetId: taskId,
                now,
            }),
        );
    }
}
