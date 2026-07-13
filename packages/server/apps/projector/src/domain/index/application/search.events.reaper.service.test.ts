import { describe, expect, it } from "vitest";
import { SearchEventsReaperService } from "~projector/domain/index/application/search.events.reaper.service.js";
import { InMemoryAdvisoryLock } from "~projector/domain/index/port/__fakes__/in-memory.advisory.lock.js";
import { InMemorySearchIndex } from "~projector/domain/index/port/__fakes__/in-memory.search.index.js";
import { EVENTS_ALIAS } from "~projector/domain/index/model/search.index.definitions.js";

const RETENTION = 90 * 24 * 3_600_000;
const NOW = new Date("2026-08-01T00:00:00.000Z");
const OLD = "2026-01-01T00:00:00.000Z";
const RECENT = "2026-07-31T00:00:00.000Z";

interface Harness {
    readonly reaper: SearchEventsReaperService;
    readonly searchIndex: InMemorySearchIndex;
}

function makeHarness(opts: { occurredAt?: readonly string[]; lockAcquired?: boolean }): Harness {
    const searchIndex = new InMemorySearchIndex();
    (opts.occurredAt ?? []).forEach((occurredAt, position) => {
        searchIndex.seedDocument(EVENTS_ALIAS, `ev-${position}`, { occurredAt });
    });
    const lock = new InMemoryAdvisoryLock<void>(undefined, opts.lockAcquired ?? true);
    return { reaper: new SearchEventsReaperService(searchIndex, lock), searchIndex };
}

describe("SearchEventsReaperService", () => {
    it("보존 기간을 넘긴 문서만 지우고 삭제 건수를 반환한다", async () => {
        const h = makeHarness({ occurredAt: [OLD, OLD, RECENT] });

        const count = await h.reaper.runOnce(NOW, RETENTION);

        expect(count).toBe(2);
        expect(h.searchIndex.documentIds(EVENTS_ALIAS)).toEqual(["ev-2"]);
        expect(h.searchIndex.deletions).toEqual([
            { index: EVENTS_ALIAS, field: "occurredAt", cutoff: new Date(NOW.getTime() - RETENTION) },
        ]);
    });

    it("락을 못 잡으면 아무것도 지우지 않는다", async () => {
        const h = makeHarness({ occurredAt: [OLD], lockAcquired: false });

        const count = await h.reaper.runOnce(NOW, RETENTION);

        expect(count).toBe(0);
        expect(h.searchIndex.deletions).toEqual([]);
    });

    it("삭제 대상이 없으면 0을 반환한다", async () => {
        const h = makeHarness({ occurredAt: [RECENT] });

        const count = await h.reaper.runOnce(NOW, RETENTION);

        expect(count).toBe(0);
    });
});
