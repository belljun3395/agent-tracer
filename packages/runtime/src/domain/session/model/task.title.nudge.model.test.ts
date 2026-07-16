import {describe, expect, it} from "vitest";
import {formatTitleNudge} from "~runtime/domain/session/model/task.title.nudge.model.js";

describe("formatTitleNudge", () => {
    it("빈 문자열이 아니고 set_task_title 도구 이름과 전달된 sessionId를 포함한다", () => {
        const nudge = formatTitleNudge("session-abc-123");

        expect(nudge).not.toBe("");
        expect(nudge).toContain("set_task_title");
        expect(nudge).toContain("session-abc-123");
    });
});
