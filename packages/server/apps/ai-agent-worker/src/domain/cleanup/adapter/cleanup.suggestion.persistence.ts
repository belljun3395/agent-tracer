import { CLEANUP_SUGGESTION_STATUS, TASK_CLEANUP_SUGGESTION_KIND } from "@monitor/kernel";
import { TaskCleanupSuggestionEntity, type TracerTx } from "@monitor/tracer-domain";
import type { GeneratedCleanupSuggestion } from "~ai-agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";

const ARCHIVE_PROPOSAL = JSON.stringify({ archive: true });

/** 보관 제안을 pending 상태로 저장한다. */
export async function persistCleanupSuggestions(
    tx: TracerTx,
    userId: string,
    jobId: string,
    suggestions: readonly GeneratedCleanupSuggestion[],
    now: Date,
): Promise<number> {
    if (suggestions.length === 0) return 0;
    const pendingTaskIds = new Set(
        (await tx.cleanupSuggestions.findPendingByUserTaskIds(
            userId,
            suggestions.map((suggestion) => suggestion.taskId),
            TASK_CLEANUP_SUGGESTION_KIND.archive,
        )).map((suggestion) => suggestion.taskId),
    );

    let suggestionsCreated = 0;
    for (const suggestion of suggestions) {
        // 대기 중인 제안이 이미 있는 태스크는 유니크 제약에 걸려 트랜잭션 전체를 abort시킨다.
        if (pendingTaskIds.has(suggestion.taskId)) continue;
        const entity = new TaskCleanupSuggestionEntity();
        entity.id = suggestion.id;
        entity.userId = userId;
        entity.jobId = jobId;
        entity.taskId = suggestion.taskId;
        entity.kind = TASK_CLEANUP_SUGGESTION_KIND.archive;
        entity.currentValue = null;
        entity.proposedValue = ARCHIVE_PROPOSAL;
        entity.rationale = suggestion.rationale;
        entity.status = CLEANUP_SUGGESTION_STATUS.pending;
        entity.error = null;
        entity.createdAt = now;
        entity.resolvedAt = null;
        entity.observedLastEventAt = suggestion.observedLastEventAt !== null
            ? new Date(suggestion.observedLastEventAt)
            : null;
        await tx.cleanupSuggestions.upsert(entity);
        pendingTaskIds.add(suggestion.taskId);
        suggestionsCreated += 1;
    }
    return suggestionsCreated;
}
