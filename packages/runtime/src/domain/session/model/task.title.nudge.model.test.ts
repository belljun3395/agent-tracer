import {describe, expect, it} from "vitest";
import {formatTitleNudge} from "~runtime/domain/session/model/task.title.nudge.model.js";

describe("formatTitleNudge", () => {
    it("도구 이름을 담고 세션 식별자는 요구하지 않는다", () => {
        const nudge = formatTitleNudge();

        expect(nudge).toContain("set_task_title");
        expect(nudge).not.toContain("sessionId");
    });
});
