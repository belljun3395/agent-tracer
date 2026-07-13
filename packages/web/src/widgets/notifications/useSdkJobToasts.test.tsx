import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JOB_KIND, JOB_STATUS } from "~web/entities/job/model/job.js";
import type { MonitorRealtimeMessage } from "~web/app/realtime/messages.js";
import { useSdkJobToasts } from "~web/widgets/notifications/useSdkJobToasts.js";
import { useToastStore } from "~web/widgets/notifications/toastStore.js";

afterEach(() => {
  useToastStore.getState().clear();
});

describe("useSdkJobToasts", () => {
  it("서버 계약의 제목 제안 완료 알림을 사람이 읽는 제목으로 표시한다", () => {
    const { result } = renderHook(() => useSdkJobToasts());

    act(() => {
      result.current({
        type: "sdk_job.updated",
        payload: {
          jobId: "job-1",
          kind: "title.suggestion",
          status: "completed",
          summary: "3 title suggestions",
        },
      } satisfies MonitorRealtimeMessage);
    });

    expect(useToastStore.getState().toasts[0]).toMatchObject({
      tone: "success",
      title: "Title suggestion complete",
      body: "3 title suggestions",
    });
  });

  it("모든 SDK 잡 종류의 완료 알림을 사람이 읽는 제목으로 표시한다", () => {
    const { result } = renderHook(() => useSdkJobToasts());
    const cases = [
      [JOB_KIND.titleSuggestion, "Title suggestion complete"],
      [JOB_KIND.taskCleanup, "Task cleanup complete"],
      [JOB_KIND.recipeScan, "Recipe scan complete"],
      [JOB_KIND.ruleGeneration, "Rule generation complete"],
    ] as const;

    for (const [kind, title] of cases) {
      act(() => {
        result.current({
          type: "sdk_job.updated",
          payload: { kind, status: JOB_STATUS.completed, summary: title },
        } satisfies MonitorRealtimeMessage);
      });
    }

    expect(useToastStore.getState().toasts.map((t) => t.title)).toEqual(
      cases.map(([, title]) => title),
    );
  });

  it("진행 전/진행 중 잡 알림은 토스트로 표시하지 않는다", () => {
    const { result } = renderHook(() => useSdkJobToasts());

    act(() => {
      result.current({
        type: "sdk_job.updated",
        payload: { kind: JOB_KIND.recipeScan, status: JOB_STATUS.pending },
      } satisfies MonitorRealtimeMessage);
      result.current({
        type: "sdk_job.updated",
        payload: { kind: JOB_KIND.recipeScan, status: JOB_STATUS.running },
      } satisfies MonitorRealtimeMessage);
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("실패 알림을 에러 토스트로 표시한다", () => {
    const { result } = renderHook(() => useSdkJobToasts());

    act(() => {
      result.current({
        type: "sdk_job.updated",
        payload: {
          kind: JOB_KIND.taskCleanup,
          status: JOB_STATUS.failed,
          error: "API key missing",
        },
      } satisfies MonitorRealtimeMessage);
    });

    expect(useToastStore.getState().toasts[0]).toMatchObject({
      tone: "error",
      title: "Task cleanup failed",
      body: "API key missing",
    });
  });
});
