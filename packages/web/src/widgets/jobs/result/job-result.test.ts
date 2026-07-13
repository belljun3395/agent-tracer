import { describe, expect, it } from "vitest";
import type { JobDto } from "@monitor/kernel";
import { JOB_KIND, JOB_STATUS } from "~web/entities/job/model/job.js";
import { feedbackSubject, readTitleSuggestions } from "~web/widgets/jobs/result/job-result.js";

const JOB: JobDto = {
  id: "job-1",
  userId: "user-1",
  kind: JOB_KIND.titleSuggestion,
  executor: "temporal",
  status: JOB_STATUS.completed,
  attempts: 1,
  taskId: "task-1",
  input: {},
  result: {},
  usage: {},
  error: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:01.000Z",
  startedAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:01.000Z",
};

describe("잡 결과 표시 정책", () => {
  it("잡 종류를 피드백 대상에 대응시킨다", () => {
    expect(feedbackSubject(JOB_KIND.titleSuggestion)).toBe("title");
    expect(feedbackSubject(JOB_KIND.recipeScan)).toBe("recipe");
    expect(feedbackSubject(JOB_KIND.ruleGeneration)).toBe("rule");
    expect(feedbackSubject(JOB_KIND.taskCleanup)).toBe("result");
  });

  it("완전한 제목 제안만 결과에서 읽는다", () => {
    expect(readTitleSuggestions({
      ...JOB,
      result: {
        suggestions: [
          { title: "Keep", rationale: "Valid" },
          { title: "Drop" },
          null,
        ],
      },
    })).toEqual([{ title: "Keep", rationale: "Valid" }]);
  });
});
