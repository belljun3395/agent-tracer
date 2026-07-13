import { describe, expect, it } from "vitest";
import { JOB_FEEDBACK_KIND, JOB_FEEDBACK_KINDS, type JobFeedback } from "./job.feedback.const.js";

describe("JOB_FEEDBACK_KIND", () => {
    it("명시 피드백 어휘를 고정한다", () => {
        expect(JOB_FEEDBACK_KIND.accept).toBe("accept");
        expect(JOB_FEEDBACK_KIND.reject).toBe("reject");
        expect(JOB_FEEDBACK_KIND.edit).toBe("edit");
        expect(JOB_FEEDBACK_KIND.rating).toBe("rating");
        expect(JOB_FEEDBACK_KINDS).toEqual(["accept", "reject", "edit", "rating"]);
    });

    it("피드백 이벤트는 잡ID와 시각을 포함한다", () => {
        const feedback = {
            jobId: "job-1",
            kind: JOB_FEEDBACK_KIND.rating,
            ratingValue: 4,
            ts: "2026-07-07T00:00:00.000Z",
        } satisfies JobFeedback;

        expect(feedback.jobId).toBe("job-1");
        expect(feedback.ts).toBe("2026-07-07T00:00:00.000Z");
    });

});
