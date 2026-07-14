import { Inject, Injectable } from "@nestjs/common";
import { ADVISORY_LOCK_KEY } from "~projector/domain/index/port/advisory.lock.keys.js";
import {
    ADVISORY_LOCK,
    type AdvisoryLockPort,
} from "~projector/domain/index/port/advisory.lock.port.js";
import {
    SEARCH_INDEX_RETENTION,
    type SearchIndexRetentionPort,
} from "~projector/domain/index/port/search.index.retention.port.js";
import { EVENTS_ALIAS } from "~projector/domain/index/model/search.index.definitions.js";
import { logError, logInfo } from "~projector/support/log.js";

/** occurredAt 기준 보존 기간을 넘긴 events 검색 문서를 주기적으로 삭제한다. */
@Injectable()
export class SearchEventsReaperService {
    constructor(
        @Inject(SEARCH_INDEX_RETENTION) private readonly searchIndex: SearchIndexRetentionPort,
        @Inject(ADVISORY_LOCK) private readonly lock: AdvisoryLockPort,
    ) {}

    async runOnce(now: Date, retentionMs: number): Promise<number> {
        const cutoff = new Date(now.getTime() - retentionMs);
        try {
            const deleted = await this.lock.withAdvisoryLock(
                ADVISORY_LOCK_KEY.searchEventsReaper,
                () => this.searchIndex.deleteBefore(EVENTS_ALIAS, "occurredAt", cutoff),
            );
            if (deleted === null || deleted === 0) return 0;
            logInfo({ msg: "search-events-reaper.completed", count: deleted });
            return deleted;
        } catch (error) {
            logError({
                msg: "search-events-reaper.error",
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
}
