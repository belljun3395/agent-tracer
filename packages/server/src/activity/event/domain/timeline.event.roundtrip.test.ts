import { describe, expect, it } from "vitest";
import type { TimelineEventInsertRequest } from "../application/outbound/event.persistence.port.js";
import {
    buildDerivedTableInserts,
    buildTimelineEventEntity,
} from "./timeline.event.row.builder.js";
import { hydrateTimelineEvent } from "./timeline.event.hydrator.js";

/**
 * 타임라인 이벤트 build → hydrate 라운드트립 골든 테스트.
 *
 * 빌더(metadata → 메인 행 + 파생 7테이블)와 하이드레이터(행 → metadata)는 서로
 * 거울 관계지만 변환이 달라, 이 경로의 동작을 고정해 키 드리프트와 write-only 컬럼
 * (과거 EventTagEntity.source 같은) 재발을 막는다. 표시명은 한글.
 */
function makeRequest(
    metadata: Record<string, unknown>,
    classificationTags: readonly string[] = [],
): TimelineEventInsertRequest {
    return {
        id: "evt-1",
        taskId: "task-1",
        kind: "tool.used",
        lane: "implementation",
        title: "제목",
        metadata,
        classification: { lane: "implementation", tags: classificationTags, matches: [] },
        createdAt: "2026-05-30T00:00:00.000Z",
    };
}

function roundtrip(request: TimelineEventInsertRequest) {
    const row = buildTimelineEventEntity(request);
    const derived = buildDerivedTableInserts(request);
    return { row, derived, event: hydrateTimelineEvent(row, derived) };
}

describe("타임라인 이벤트 build→hydrate 라운드트립", () => {
    it("메인 행의 분류/도구 문자열 컬럼이 metadata로 복원된다", () => {
        const { event } = roundtrip(
            makeRequest({
                subtypeKey: "edit",
                subtypeLabel: "Edit",
                toolFamily: "fs",
                toolName: "Bash",
                entityType: "file",
                entityName: "a.ts",
            }),
        );
        expect(event.metadata).toMatchObject({
            subtypeKey: "edit",
            subtypeLabel: "Edit",
            toolFamily: "fs",
            toolName: "Bash",
            entityType: "file",
            entityName: "a.ts",
        });
    });

    it("DERIVED 키가 아닌 임의 metadata는 extras로 보존된다", () => {
        const { event } = roundtrip(makeRequest({ customField: "kept", count: 7 }));
        expect(event.metadata.customField).toBe("kept");
        expect(event.metadata.count).toBe(7);
    });

    it("파일 경로가 파생 테이블을 거쳐 filePaths로 복원된다", () => {
        const { derived, event } = roundtrip(
            makeRequest({ filePaths: ["/a.ts", "/b.ts"], writeCount: 3 }),
        );
        expect(derived.files.map((f) => f.filePath).sort()).toEqual(["/a.ts", "/b.ts"]);
        expect(event.metadata.filePaths).toEqual(expect.arrayContaining(["/a.ts", "/b.ts"]));
    });

    it("부모/관련 이벤트 관계가 복원된다", () => {
        const { event } = roundtrip(
            makeRequest({
                parentEventId: "p1",
                relatedEventIds: ["r1", "r2"],
                relationType: "implements",
            }),
        );
        expect(event.metadata.parentEventId).toBe("p1");
        expect(event.metadata.relatedEventIds).toEqual(
            expect.arrayContaining(["r1", "r2"]),
        );
        expect(event.metadata.relationType).toBe("implements");
    });

    it("비동기 태스크 참조가 복원된다", () => {
        const { derived, event } = roundtrip(
            makeRequest({ asyncTaskId: "at1", asyncStatus: "running", asyncAgent: "agent" }),
        );
        expect(derived.asyncRef?.asyncTaskId).toBe("at1");
        expect(event.metadata).toMatchObject({
            asyncTaskId: "at1",
            asyncStatus: "running",
            asyncAgent: "agent",
        });
    });

    it("metadata 태그와 분류 태그가 합쳐져 복원된다", () => {
        const { event } = roundtrip(
            makeRequest({ tags: ["alpha", "beta"] }, ["beta", "gamma"]),
        );
        expect(new Set(event.metadata.tags as string[])).toEqual(
            new Set(["alpha", "beta", "gamma"]),
        );
        expect(new Set(event.classification.tags)).toEqual(
            new Set(["alpha", "beta", "gamma"]),
        );
    });

    it("todo / question 상태가 복원된다", () => {
        const { event } = roundtrip(
            makeRequest({
                todoId: "td1",
                todoState: "in_progress",
                questionId: "q1",
                questionPhase: "asked",
                sequence: 2,
            }),
        );
        expect(event.metadata).toMatchObject({
            todoId: "td1",
            todoState: "in_progress",
            questionId: "q1",
            questionPhase: "asked",
            sequence: 2,
        });
    });

    it("토큰 사용량이 복원된다", () => {
        const { derived, event } = roundtrip(
            makeRequest({
                inputTokens: 10,
                outputTokens: 20,
                cacheReadTokens: 5,
                costUsd: 0.01,
                model: "claude",
            }),
        );
        expect(derived.tokenUsage?.inputTokens).toBe(10);
        expect(event.metadata).toMatchObject({
            inputTokens: 10,
            outputTokens: 20,
            cacheReadTokens: 5,
            costUsd: 0.01,
            model: "claude",
        });
    });
});
