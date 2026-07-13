import { beforeEach, describe, expect, test, vi } from "vitest";
import { AI_AGENT_BACKEND, JOB_KIND } from "~web/entities/job/model/job.js";
import { TaskId } from "~web/shared/identity.js";
import type { GenerateRulesJobStatus } from "~web/entities/job/model/rule-generation.js";
import { getJson, postJson } from "~web/shared/api/client/json-methods.js";
import { JOB_FEEDBACK_KIND } from "@monitor/kernel";
import {
  enqueueJob,
  fetchJob,
  fetchJobSteps,
  fetchLatestJob,
  submitJobFeedback,
} from "~web/entities/job/api/api-jobs.js";

vi.mock("~web/shared/api/client/json-methods.js", () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}));

const mockGetJson = vi.mocked(getJson);
const mockPostJson = vi.mocked(postJson);

beforeEach(() => {
  mockGetJson.mockReset();
  mockPostJson.mockReset();
});

describe("enqueueJob", () => {
  test("idempotency key를 요청 본문에 싣는다", async () => {
    mockPostJson.mockResolvedValue({
      jobId: "job-1",
      status: "pending",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await enqueueJob(JOB_KIND.recipeScan, { filters: {} }, { idempotencyKey: "scan-click-1" });

    expect(mockPostJson).toHaveBeenCalledWith("/api/v1/jobs", {
      kind: JOB_KIND.recipeScan,
      input: { filters: {} },
      idempotencyKey: "scan-click-1",
    });
  });

  test("agent backend를 요청 본문 최상위에 싣는다", async () => {
    mockPostJson.mockResolvedValue({
      jobId: "job-1",
      status: "pending",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await enqueueJob(
      JOB_KIND.recipeScan,
      { taskId: "task-1" },
      { agentBackend: AI_AGENT_BACKEND.claudeSdk },
    );

    expect(mockPostJson).toHaveBeenCalledWith("/api/v1/jobs", {
      kind: JOB_KIND.recipeScan,
      input: { taskId: "task-1" },
      agentBackend: AI_AGENT_BACKEND.claudeSdk,
    });
  });
});

describe("submitJobFeedback", () => {
  test("잡 피드백을 잡별 엔드포인트로 전송한다", async () => {
    mockPostJson.mockResolvedValue({
      feedback: {
        jobId: "job-1",
        kind: JOB_FEEDBACK_KIND.rating,
        ratingValue: 4,
        ts: "2026-07-07T00:00:00.000Z",
      },
    });

    await submitJobFeedback("job-1", {
      kind: JOB_FEEDBACK_KIND.rating,
      ratingValue: 4,
    });

    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/v1/jobs/job-1/feedback",
      { kind: JOB_FEEDBACK_KIND.rating, ratingValue: 4 },
    );
  });
});

describe("fetchLatestJob", () => {
  test("서버 JobDto의 result와 usage를 화면용 잡 상태로 정규화한다", async () => {
    mockGetJson.mockResolvedValue({
      job: {
        id: "job-1",
        userId: "u1",
        kind: JOB_KIND.ruleGeneration,
        executor: "local",
        status: "completed",
        attempts: 1,
        taskId: "task-1",
        input: { taskId: "task-1" },
        result: { rulesCreated: 3 },
        usage: { model: "claude-sonnet-4-6", durationMs: 1234 },
        error: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:02.000Z",
        startedAt: "2026-01-01T00:00:01.000Z",
        completedAt: "2026-01-01T00:00:02.234Z",
      },
    });

    const res = await fetchLatestJob<GenerateRulesJobStatus>(
      JOB_KIND.ruleGeneration,
      { taskId: TaskId("task-1") },
    );

    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/v1/jobs/latest?kind=rule.generation&taskId=task-1",
    );
    expect(res.job).toMatchObject({
      id: "job-1",
      kind: JOB_KIND.ruleGeneration,
      status: "completed",
      rulesCreated: 3,
      modelUsed: "claude-sonnet-4-6",
      durationMs: 1234,
    });
  });
});

describe("fetchJobEvidence", () => {
  test("잡 상세와 trajectory를 인코딩된 잡 경로로 조회한다", async () => {
    mockGetJson
      .mockResolvedValueOnce({ job: { id: "job/1" } })
      .mockResolvedValueOnce([{
        seq: 0,
        role: "assistant",
        content: "Inspect task evidence",
        truncated: false,
        toolCalls: [],
      }]);

    const job = await fetchJob("job/1");
    const steps = await fetchJobSteps("job/1");

    expect(mockGetJson).toHaveBeenNthCalledWith(1, "/api/v1/jobs/job%2F1");
    expect(mockGetJson).toHaveBeenNthCalledWith(2, "/api/v1/jobs/job%2F1/steps");
    expect(job.job.id).toBe("job/1");
    expect(steps[0]?.content).toBe("Inspect task evidence");
  });
});
