import { describe, expect, it } from "vitest";
import type { TimelineEventInsertRequest } from "@monitor/timeline-api/domain/event/type/event.insert.request.type.js";
import { EventMetadata } from "@monitor/timeline-api/domain/event/event.metadata.vo.js";

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

function normalize(request: TimelineEventInsertRequest) {
    const vo = EventMetadata.normalize(request);
    return { metadata: vo.metadata, tags: vo.tags };
}

describe("EventMetadata.normalize 정규화", () => {
    it("메인 행의 분류/도구 문자열이 컬럼과 metadata로 정규화된다", () => {
        const vo = EventMetadata.normalize(
            makeRequest({
                subtypeKey: "edit",
                subtypeLabel: "Edit",
                toolFamily: "fs",
                toolName: "Bash",
                entityType: "file",
                entityName: "a.ts",
            }),
        );
        expect(vo.columns.subtypeKey).toBe("edit");
        expect(vo.metadata).toMatchObject({
            subtypeKey: "edit",
            subtypeLabel: "Edit",
            toolFamily: "fs",
            toolName: "Bash",
            entityType: "file",
            entityName: "a.ts",
        });
    });

    it("DERIVED 키가 아닌 임의 metadata는 보존된다", () => {
        const { metadata } = normalize(makeRequest({ customField: "kept", count: 7 }));
        expect(metadata.customField).toBe("kept");
        expect(metadata.count).toBe(7);
    });

    it("파일 경로가 filePaths로 정규화된다", () => {
        const { metadata } = normalize(makeRequest({ filePaths: ["/a.ts", "/b.ts"], writeCount: 3 }));
        expect(metadata.filePaths).toEqual(expect.arrayContaining(["/a.ts", "/b.ts"]));
    });

    it("부모/관련 이벤트 관계가 정규화된다", () => {
        const { metadata } = normalize(
            makeRequest({
                parentEventId: "p1",
                relatedEventIds: ["r1", "r2"],
                relationType: "implements",
            }),
        );
        expect(metadata.parentEventId).toBe("p1");
        expect(metadata.relatedEventIds).toEqual(expect.arrayContaining(["r1", "r2"]));
        expect(metadata.relationType).toBe("implements");
    });

    it("비동기 태스크 참조가 정규화된다", () => {
        const { metadata } = normalize(
            makeRequest({ asyncTaskId: "at1", asyncStatus: "running", asyncAgent: "agent" }),
        );
        expect(metadata).toMatchObject({
            asyncTaskId: "at1",
            asyncStatus: "running",
            asyncAgent: "agent",
        });
    });

    it("metadata 태그와 분류 태그가 합쳐진다", () => {
        const { metadata, tags } = normalize(makeRequest({ tags: ["alpha", "beta"] }, ["beta", "gamma"]));
        expect(new Set(metadata.tags as string[])).toEqual(new Set(["alpha", "beta", "gamma"]));
        expect(new Set(tags)).toEqual(new Set(["alpha", "beta", "gamma"]));
    });

    it("todo / question 상태가 정규화된다", () => {
        const { metadata } = normalize(
            makeRequest({
                todoId: "td1",
                todoState: "in_progress",
                questionId: "q1",
                questionPhase: "asked",
                sequence: 2,
            }),
        );
        expect(metadata).toMatchObject({
            todoId: "td1",
            todoState: "in_progress",
            questionId: "q1",
            questionPhase: "asked",
            sequence: 2,
        });
    });

    it("토큰 사용량이 정규화된다", () => {
        const { metadata } = normalize(
            makeRequest({
                inputTokens: 10,
                outputTokens: 20,
                cacheReadTokens: 5,
                costUsd: 0.01,
                model: "claude",
            }),
        );
        expect(metadata).toMatchObject({
            inputTokens: 10,
            outputTokens: 20,
            cacheReadTokens: 5,
            costUsd: 0.01,
            model: "claude",
        });
    });

    it("commandAnalysis의 파일 타깃이 filePaths로 정규화된다", () => {
        const { metadata } = normalize(
            makeRequest({
                commandAnalysis: { steps: [{ targets: [{ type: "file", value: "/cmd.ts" }] }] },
            }),
        );
        expect(metadata.filePaths).toEqual(expect.arrayContaining(["/cmd.ts"]));
    });

    it("토큰 폴백 키(lastTurnInputTokens)가 inputTokens로 정규화된다", () => {
        const { metadata } = normalize(makeRequest({ lastTurnInputTokens: 42 }));
        expect(metadata.inputTokens).toBe(42);
    });

    it("relPath가 runtime_relpath 소스를 거쳐 metadata.relPath로 정규화된다", () => {
        const { metadata } = normalize(makeRequest({ relPath: "/rel.ts" }));
        expect(metadata.relPath).toBe("/rel.ts");
        expect(metadata.filePaths).toEqual(expect.arrayContaining(["/rel.ts"]));
    });

    it("source 관계와 라벨/설명이 정규화된다", () => {
        const { metadata } = normalize(
            makeRequest({
                sourceEventId: "s1",
                relationType: "implements",
                relationLabel: "label",
                relationExplanation: "why",
            }),
        );
        expect(metadata.sourceEventId).toBe("s1");
        expect(metadata.relationType).toBe("implements");
        expect(metadata.relationLabel).toBe("label");
        expect(metadata.relationExplanation).toBe("why");
    });
});
