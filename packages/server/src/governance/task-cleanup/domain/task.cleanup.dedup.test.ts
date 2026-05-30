import { describe, expect, it } from "vitest";
import { dedupeByKindAndTask } from "./task.cleanup.dedup.js";

/**
 * 태스크 정리 제안 dedup 비즈니스 로직 테스트.
 * 메서드명은 영어, 표시명은 한글.
 */
describe("dedupeByKindAndTask — 제안 중복/무효 제거", () => {
    const known = new Set(["t1", "t2"]);

    it("알 수 없는 taskId를 가리키는 제안은 제외한다", () => {
        const out = dedupeByKindAndTask(
            [{ kind: "archive", taskId: "ghost" }],
            known,
        );
        expect(out).toHaveLength(0);
    });

    it("같은 (kind, taskId) 조합은 처음 것만 남긴다", () => {
        const out = dedupeByKindAndTask(
            [
                { kind: "archive", taskId: "t1", n: 1 },
                { kind: "archive", taskId: "t1", n: 2 },
                { kind: "rename_title", taskId: "t1", n: 3 },
            ],
            known,
        );
        expect(out.map((s) => s.n)).toEqual([1, 3]);
    });

    it("입력 순서를 보존한다", () => {
        const out = dedupeByKindAndTask(
            [
                { kind: "archive", taskId: "t2" },
                { kind: "archive", taskId: "t1" },
            ],
            known,
        );
        expect(out.map((s) => s.taskId)).toEqual(["t2", "t1"]);
    });
});
