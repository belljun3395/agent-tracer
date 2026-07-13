import { describe, expect, it } from "vitest";
import type { JobDto } from "@monitor/kernel";
import { JOB_KIND, JOB_STATUS } from "~web/entities/job/model/job.js";
import {
  elapsedMs,
  isJobKind,
  isJobStatus,
  readUsage,
  statusDotKind,
  summarizeResult,
} from "~web/widgets/jobs/lib/job-view.js";

const BASE: JobDto = {
  id: "job-1",
  userId: "u1",
  kind: JOB_KIND.recipeScan,
  executor: "temporal",
  status: JOB_STATUS.completed,
  attempts: 1,
  taskId: "task-1",
  input: {},
  result: {},
  usage: {},
  error: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:10.000Z",
  startedAt: "2026-01-01T00:00:01.000Z",
  completedAt: "2026-01-01T00:00:10.000Z",
};

describe("statusDotKind", () => {
  it("취소된 잡은 취소 상태로 표시한다", () => {
    expect(statusDotKind(JOB_STATUS.canceled)).toBe("canceled");
  });

  it("실행 중인 잡은 running 점으로 표시한다", () => {
    expect(statusDotKind(JOB_STATUS.running)).toBe("running");
  });
});

describe("elapsedMs", () => {
  it("종료된 잡은 시작부터 종료까지를 잰다", () => {
    expect(elapsedMs(BASE, Date.parse("2026-01-01T01:00:00.000Z"))).toBe(9000);
  });

  it("실행 중인 잡은 현재까지를 잰다", () => {
    const running = { ...BASE, status: JOB_STATUS.running, completedAt: null };
    expect(elapsedMs(running, Date.parse("2026-01-01T00:00:05.000Z"))).toBe(4000);
  });

  it("아직 시작하지 않은 잡은 경과 시간이 없다", () => {
    expect(elapsedMs({ ...BASE, startedAt: null }, Date.now())).toBeNull();
  });
});

describe("summarizeResult", () => {
  it("완료된 제목 제안은 제안 건수를 요약한다", () => {
    const job = {
      ...BASE,
      kind: JOB_KIND.titleSuggestion,
      result: { suggestions: [{ title: "a", rationale: "b" }] },
    };
    expect(summarizeResult(job)).toBe("1 suggestion");
  });

  it("레시피 스캔은 후보와 개정 건수를 함께 적는다", () => {
    const job = { ...BASE, result: { candidatesCreated: 2, recipesRevised: 1 } };
    expect(summarizeResult(job)).toBe("2 candidates · 1 revised");
  });

  it("완료되지 않은 잡은 요약하지 않는다", () => {
    expect(summarizeResult({ ...BASE, status: JOB_STATUS.running })).toBeNull();
  });

  it("형태가 다른 결과는 조용히 비운다", () => {
    expect(summarizeResult({ ...BASE, result: {} })).toBeNull();
  });
});

describe("readUsage", () => {
  it("사용량 jsonb에서 모델과 비용을 읽는다", () => {
    const job = { ...BASE, usage: { modelUsed: "claude-haiku-4-5", costUsd: 0.01, numTurns: 3 } };
    expect(readUsage(job)).toEqual({
      modelUsed: "claude-haiku-4-5",
      durationMs: null,
      costUsd: 0.01,
      numTurns: 3,
    });
  });
});

describe("필터 파싱", () => {
  it("알려진 잡 종류와 상태만 통과시킨다", () => {
    expect(isJobKind(JOB_KIND.taskCleanup)).toBe(true);
    expect(isJobKind("nope")).toBe(false);
    expect(isJobStatus(JOB_STATUS.canceled)).toBe(true);
    expect(isJobStatus(null)).toBe(false);
  });
});
