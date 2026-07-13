import { describe, expect, it } from "vitest";
import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import { InvariantViolationError } from "@monitor/tracer-domain/error/invariant.error.js";
import { JobFeedbackEntity } from "./job.feedback.entity.js";

const NOW = new Date("2026-07-07T00:00:00.000Z");

describe("JobFeedbackEntity", () => {
    it("잡 피드백 이벤트를 사용자와 잡에 묶어 생성한다", () => {
        const feedback = JobFeedbackEntity.create({
            userId: "u1",
            jobId: "job-1",
            kind: JOB_FEEDBACK_KIND.accept,
            now: NOW,
        });

        expect(feedback.userId).toBe("u1");
        expect(feedback.jobId).toBe("job-1");
        expect(feedback.kind).toBe(JOB_FEEDBACK_KIND.accept);
        expect(feedback.ratingValue).toBeNull();
        expect(feedback.editedContent).toBeNull();
        expect(feedback.ts).toEqual(NOW);
    });

    it("평점 피드백은 1점에서 5점 사이만 받는다", () => {
        expect(() =>
            JobFeedbackEntity.create({
                userId: "u1",
                jobId: "job-1",
                kind: JOB_FEEDBACK_KIND.rating,
                ratingValue: 6,
                now: NOW,
            }),
        ).toThrow(InvariantViolationError);
    });

    it("편집 피드백은 편집 내용을 보존한다", () => {
        const feedback = JobFeedbackEntity.create({
            userId: "u1",
            jobId: "job-1",
            kind: JOB_FEEDBACK_KIND.edit,
            editedContent: { title: "사용자 제목" },
            now: NOW,
        });

        expect(feedback.editedContent).toEqual({ title: "사용자 제목" });
    });
});
