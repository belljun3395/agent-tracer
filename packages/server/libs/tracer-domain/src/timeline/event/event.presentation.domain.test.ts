import { describe, expect, it } from "vitest";
import { KIND } from "@monitor/kernel";
import { EventEntity } from "./event.entity.js";
import { EventPresentation } from "./event.presentation.domain.js";
import { META } from "./event.const.js";

function makeEvent(overrides: {
    readonly metadata?: Record<string, unknown>;
    readonly filePaths?: string[];
    readonly title?: string;
    readonly body?: string | null;
    readonly toolName?: string | null;
    readonly sessionId?: string | null;
    readonly turnId?: string | null;
}): EventEntity {
    const event = new EventEntity();
    event.id = "e1";
    event.seq = "1";
    event.taskId = "task-1";
    event.sessionId = overrides.sessionId ?? null;
    event.turnId = overrides.turnId ?? null;
    event.kind = KIND.executeTool;
    event.lane = "implementation";
    event.title = overrides.title ?? "제목";
    event.body = overrides.body ?? null;
    event.toolName = overrides.toolName ?? null;
    event.filePaths = overrides.filePaths ?? [];
    event.metadata = overrides.metadata ?? {};
    event.occurredAt = new Date("2026-01-01T00:00:00.000Z");
    return event;
}

describe("EventPresentation", () => {
    describe("displayTitle", () => {
        it("메타데이터에 displayTitle이 있으면 그것을 쓴다", () => {
            const event = makeEvent({ metadata: { [META.displayTitle]: "표시 제목" }, title: "원본 제목" });
            expect(new EventPresentation(event).toTimelineItem().displayTitle).toBe("표시 제목");
        });

        it("메타데이터에 displayTitle이 없으면 원본 title로 폴백한다", () => {
            const event = makeEvent({ title: "원본 제목" });
            expect(new EventPresentation(event).toTimelineItem().displayTitle).toBe("원본 제목");
        });
    });

    describe("subtype", () => {
        it("알려진 subtypeKey면 레지스트리 기본값으로 subtype을 구성한다", () => {
            const event = makeEvent({ metadata: { [META.subtypeKey]: "run_test" } });
            const item = new EventPresentation(event).toTimelineItem();
            expect(item.subtype).toMatchObject({ key: "run_test", label: "Run test", group: "execution", toolFamily: "terminal" });
        });

        it("알려지지 않은 subtypeKey면 subtype 필드 자체를 생략한다", () => {
            const event = makeEvent({ metadata: { [META.subtypeKey]: "not-a-real-key" } });
            expect(new EventPresentation(event).toTimelineItem()).not.toHaveProperty("subtype");
        });

        it("메타데이터의 subtypeLabel이 있으면 레지스트리 라벨을 덮어쓴다", () => {
            const event = makeEvent({ metadata: { [META.subtypeKey]: "run_test", [META.subtypeLabel]: "커스텀 라벨" } });
            const item = new EventPresentation(event).toTimelineItem();
            expect(item.subtype?.label).toBe("커스텀 라벨");
        });
    });

    describe("evidenceLevel", () => {
        it("유효한 evidenceLevel이면 포함한다", () => {
            const event = makeEvent({ metadata: { [META.evidenceLevel]: "proven" } });
            expect(new EventPresentation(event).toTimelineItem().evidenceLevel).toBe("proven");
        });

        it("유효하지 않은 evidenceLevel이면 필드를 생략한다", () => {
            const event = makeEvent({ metadata: { [META.evidenceLevel]: "made-up-level" } });
            expect(new EventPresentation(event).toTimelineItem()).not.toHaveProperty("evidenceLevel");
        });
    });

    describe("filePaths", () => {
        it("엔티티의 filePaths와 메타데이터의 filePaths를 중복 없이 합친다", () => {
            const event = makeEvent({ filePaths: ["a.ts", "b.ts"], metadata: { [META.filePaths]: ["b.ts", "c.ts"] } });
            const item = new EventPresentation(event).toTimelineItem();
            expect(item.filePaths).toEqual(["a.ts", "b.ts", "c.ts"]);
        });
    });

    describe("선택 필드 생략", () => {
        it("sessionId·turnId·body·toolName이 null이면 필드를 생략한다", () => {
            const item = new EventPresentation(makeEvent({})).toTimelineItem();
            expect(item).not.toHaveProperty("sessionId");
            expect(item).not.toHaveProperty("turnId");
            expect(item).not.toHaveProperty("body");
            expect(item).not.toHaveProperty("toolName");
        });

        it("값이 있으면 필드에 포함한다", () => {
            const event = makeEvent({ sessionId: "s1", turnId: "t1", body: "본문", toolName: "Bash" });
            const item = new EventPresentation(event).toTimelineItem();
            expect(item.sessionId).toBe("s1");
            expect(item.turnId).toBe("t1");
            expect(item.body).toBe("본문");
            expect(item.toolName).toBe("Bash");
        });
    });
});
