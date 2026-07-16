import {describe, expect, it} from "vitest";
import {formatTitleNudge} from "~runtime/domain/session/model/task.title.nudge.model.js";

describe("formatTitleNudge", () => {
    it("빈 문자열이 아니고 set_task_title 도구 이름을 포함한다", () => {
        const nudge = formatTitleNudge();

        expect(nudge).not.toBe("");
        expect(nudge).toContain("set_task_title");
    });
});
