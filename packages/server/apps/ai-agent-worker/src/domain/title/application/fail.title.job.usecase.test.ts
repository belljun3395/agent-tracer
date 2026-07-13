import { describe, expect, it } from "vitest";
import { JOB_STATUS } from "@monitor/kernel";
import { FailTitleJobUsecase } from "./fail.title.job.usecase.js";
import {
    CapturingTitleNotification,
    fixedClock,
    InMemoryTitleRepository,
    seedRepository,
} from "./title.test-support.js";

describe("FailTitleJobUsecase", () => {
    it("잡을 실패로 종결하고 오류를 알린다", async () => {
        const repository = seedRepository();
        const notification = new CapturingTitleNotification();
        const target = new FailTitleJobUsecase(repository, notification, fixedClock);

        await target.execute({ jobId: "job-1", message: "rate limited" });

        expect(repository.failures).toEqual([{ jobId: "job-1", message: "rate limited" }]);
        expect(notification.published[0]?.payload).toMatchObject({
            status: JOB_STATUS.failed,
            error: "rate limited",
        });
    });

    it("긴 오류 메시지는 잘라서 남긴다", async () => {
        const repository = seedRepository();
        const target = new FailTitleJobUsecase(repository, new CapturingTitleNotification(), fixedClock);

        await target.execute({ jobId: "job-1", message: "x".repeat(1200) });

        expect(repository.failures[0]?.message).toHaveLength(1003);
    });

    it("이미 종결된 잡은 알리지 않는다", async () => {
        const notification = new CapturingTitleNotification();
        const target = new FailTitleJobUsecase(new InMemoryTitleRepository(), notification, fixedClock);

        await target.execute({ jobId: "job-1", message: "boom" });

        expect(notification.published).toEqual([]);
    });
});
