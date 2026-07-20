import { describe, expect, it } from "vitest";
import { KIND } from "./event.kind.const.js";
import { parseIngestBatch, payloadSchemaByKind } from "./ingest.schema.js";
import {LONE_SURROGATE_REASON, NULL_CHARACTER_REASON} from "./json.text.js";

const ENVELOPE = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", taskId: "task-1", occurredAt: "2026-01-01T00:00:00.000Z" };

function batchOf(kind: string, payload: Record<string, unknown>): unknown {
    return { events: [{ ...ENVELOPE, kind, payload }] };
}

describe("payloadSchemaByKind", () => {
    it("KIND의 모든 값에 대해 정확히 하나의 스키마를 등록한다(누락·유령 kind 없음)", () => {
        expect(new Set(Object.keys(payloadSchemaByKind))).toEqual(new Set(Object.values(KIND)));
    });
});

describe("parseIngestBatch", () => {
    it("등록되지 않은 kind는 그 레코드만 거부한다", () => {
        const {accepted, rejected} = parseIngestBatch(batchOf("not.a.real.kind", {}));

        expect(accepted).toEqual([]);
        expect(rejected[0]!.reason).toContain("unknown event kind");
    });

    it("자유형 timeline payload를 가진 이벤트를 파싱한다", () => {
        const {accepted, rejected} = parseIngestBatch(
            batchOf(KIND.actionLogged, {title: "구현", lane: "implementation"}),
        );

        expect(rejected).toEqual([]);
        expect(accepted).toHaveLength(1);
        expect(accepted[0]!.kind).toBe(KIND.actionLogged);
    });

    it("중간 어시스턴트 발화를 자유형 timeline 이벤트로 수용한다", () => {
        const {accepted, rejected} = parseIngestBatch(
            batchOf(KIND.assistantCommentary, {
                title: "진행 상황",
                body: "테스트를 실행하고 있습니다.",
                lane: "user",
                metadata: {phase: "commentary"},
            }),
        );

        expect(rejected).toEqual([]);
        expect(accepted[0]?.kind).toBe(KIND.assistantCommentary);
    });

    it("session.started는 필수 필드가 없으면 그 레코드만 거부한다", () => {
        const {accepted, rejected} = parseIngestBatch(batchOf(KIND.sessionStarted, {title: "t"}));

        expect(accepted).toEqual([]);
        expect(rejected).toHaveLength(1);
    });

    it("session.started는 백그라운드 태스크 계층을 보존한다", () => {
        const {accepted, rejected} = parseIngestBatch(
            batchOf(KIND.sessionStarted, {
                runtimeSource: "claude-code",
                runtimeSessionId: "s1",
                title: "제목",
                taskKind: "background",
                parentTaskId: "parent-task-1",
                parentSessionId: "parent-session-1",
            }),
        );

        expect(rejected).toEqual([]);
        expect(accepted).toHaveLength(1);
        expect(accepted[0]?.payload).toMatchObject({
            taskKind: "background",
            parentTaskId: "parent-task-1",
            parentSessionId: "parent-session-1",
        });
    });


    it("recipe.injected는 등록된 injectedVia 값만 허용한다", () => {
        const valid = batchOf(KIND.recipeInjected, {
            recipeId: "r1",
            applicationId: "a1",
            injectedVia: "pull",
        });
        expect(parseIngestBatch(valid).accepted).toHaveLength(1);

        const invalid = batchOf(KIND.recipeInjected, {
            recipeId: "r1",
            applicationId: "a1",
            injectedVia: "not-a-real-source",
        });
        expect(parseIngestBatch(invalid).rejected).toHaveLength(1);
    });

    it("짝 잃은 서로게이트를 저장소에 닿기 전에 거부한다", () => {
        const {accepted, rejected} = parseIngestBatch(
            batchOf(KIND.actionLogged, {title: `깨진 ${String.fromCharCode(0xd83d)}`}),
        );

        expect(accepted).toEqual([]);
        expect(rejected[0]!.reason).toBe(LONE_SURROGATE_REASON);
    });

    it("NUL 문자를 담은 payload를 거부한다", () => {
        const {rejected} = parseIngestBatch(
            batchOf(KIND.actionLogged, {title: `널${String.fromCharCode(0)}문자`}),
        );

        expect(rejected[0]!.reason).toBe(NULL_CHARACTER_REASON);
    });

    it("중첩된 metadata의 손상 문자도 거부한다", () => {
        const {rejected} = parseIngestBatch(
            batchOf(KIND.actionLogged, {
                title: "정상",
                metadata: {nested: ["ok", String.fromCharCode(0xdc00)]},
            }),
        );

        expect(rejected[0]!.reason).toBe(LONE_SURROGATE_REASON);
    });

    it("한 레코드가 거부돼도 같은 배치의 나머지는 수용한다", () => {
        const batch = {
            events: [
                {...ENVELOPE, id: "ev-good-1", kind: KIND.actionLogged, payload: {title: "정상"}},
                {
                    ...ENVELOPE,
                    id: "ev-bad",
                    kind: KIND.actionLogged,
                    payload: {title: String.fromCharCode(0xd83d)},
                },
                {...ENVELOPE, id: "ev-good-2", kind: KIND.actionLogged, payload: {title: "정상"}},
            ],
        };

        const {accepted, rejected} = parseIngestBatch(batch);

        expect(accepted.map((event) => event.id)).toEqual(["ev-good-1", "ev-good-2"]);
        expect(rejected).toEqual([{id: "ev-bad", reason: LONE_SURROGATE_REASON}]);
    });

    it("빈 id를 가진 이벤트는 배치 전체를 거부한다", () => {
        const batch = { events: [{ ...ENVELOPE, id: "", kind: KIND.actionLogged, payload: {} }] };
        expect(() => parseIngestBatch(batch)).toThrow();
    });
});

describe("봉투의 턴 식별자", () => {
    it("turnId를 실으면 그대로 통과시킨다", () => {
        const {accepted} = parseIngestBatch({
            events: [{
                id: "ev-1",
                kind: KIND.executeTool,
                taskId: "task-1",
                turnId: "turn-1",
                occurredAt: "2026-07-10T00:00:00.000Z",
                payload: {},
            }],
        });
        expect(accepted[0]?.turnId).toBe("turn-1");
    });

    it("turnId가 없으면 봉투에 키를 만들지 않는다", () => {
        const {accepted} = parseIngestBatch({
            events: [{
                id: "ev-1",
                kind: KIND.executeTool,
                taskId: "task-1",
                occurredAt: "2026-07-10T00:00:00.000Z",
                payload: {},
            }],
        });
        expect(accepted[0]).not.toHaveProperty("turnId");
    });
});
