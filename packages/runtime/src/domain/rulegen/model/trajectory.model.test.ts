import {AI_JOB_STEP_ROLE} from "@monitor/kernel/job/job.step.const.js";
import {describe, expect, it} from "vitest";
import {
    MAX_STEP_CONTENT_BYTES,
    TrajectoryRecorder,
} from "~runtime/domain/rulegen/model/trajectory.model.js";

describe("TrajectoryRecorder", () => {
    it("어시스턴트와 도구 스텝에 0부터 이어지는 seq를 매긴다", () => {
        const recorder = new TrajectoryRecorder();
        recorder.assistant({content: "생각", toolCalls: [{id: "call-1", name: "get_task_turns", args: {}}]});
        recorder.tool({toolName: "get_task_turns", toolCallId: "call-1", content: "결과"});

        const steps = recorder.snapshot();
        expect(steps.map((step) => step.seq)).toEqual([0, 1]);
        expect(steps.map((step) => step.role)).toEqual([AI_JOB_STEP_ROLE.assistant, AI_JOB_STEP_ROLE.tool]);
        expect(steps[1]?.toolName).toBe("get_task_turns");
        expect(steps[1]?.toolCallId).toBe("call-1");
    });

    it("텍스트도 도구 호출도 없는 어시스턴트 응답은 seq를 소비하지 않고 버린다", () => {
        const recorder = new TrajectoryRecorder();
        recorder.assistant({content: "   "});
        recorder.assistant({content: "실질 응답"});

        const steps = recorder.snapshot();
        expect(steps).toHaveLength(1);
        expect(steps[0]?.seq).toBe(0);
        expect(steps[0]?.content).toBe("실질 응답");
    });

    it("텍스트가 비어도 도구 호출이 있으면 궤적에 남긴다", () => {
        const recorder = new TrajectoryRecorder();
        recorder.assistant({content: "", toolCalls: [{id: "call-1", name: "list_rules", args: {}}]});

        expect(recorder.snapshot()).toHaveLength(1);
    });

    it("상한을 넘는 내용은 잘라 표시하되 멀티바이트 문자를 깨뜨리지 않는다", () => {
        const recorder = new TrajectoryRecorder();
        recorder.assistant({content: "가".repeat(20_000)});

        const step = recorder.snapshot()[0];
        expect(step?.truncated).toBe(true);
        expect(new TextEncoder().encode(step?.content ?? "").byteLength).toBeLessThanOrEqual(MAX_STEP_CONTENT_BYTES);
        expect(step?.content).not.toContain("�");
    });

    it("snapshot은 복사본이라 이후 기록이 앞서 찍은 스냅샷을 건드리지 않는다", () => {
        const recorder = new TrajectoryRecorder();
        recorder.assistant({content: "첫 응답"});
        const first = recorder.snapshot();
        recorder.assistant({content: "둘째 응답"});

        expect(first).toHaveLength(1);
        expect(recorder.snapshot()).toHaveLength(2);
    });
});
