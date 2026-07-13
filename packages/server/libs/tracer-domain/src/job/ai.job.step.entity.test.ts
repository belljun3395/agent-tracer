import { describe, expect, it } from "vitest";
import type { AiJobStepPayload } from "@monitor/kernel";
import { InvariantViolationError } from "../error/invariant.error.js";
import { AiJobStepEntity } from "./ai.job.step.entity.js";

const NOW = new Date("2026-07-09T00:00:00.000Z");

function step(overrides: Partial<AiJobStepPayload> = {}): AiJobStepPayload {
    return {
        seq: 0,
        role: "assistant",
        content: "hello",
        truncated: false,
        toolCalls: [],
        ...overrides,
    };
}

describe("AiJobStepEntity", () => {
    it("호출부가 확정한 id로 궤적 스텝을 만든다", () => {
        const entity = AiJobStepEntity.create({
            id: "step-1",
            jobId: "job-1",
            userId: "u1",
            attempt: 1,
            step: step({ seq: 2, role: "tool", content: "{}", toolName: "search_recipes", toolCallId: "c1" }),
            now: NOW,
        });

        expect(entity.id).toBe("step-1");
        expect(entity.seq).toBe(2);
        expect(entity.role).toBe("tool");
        expect(entity.toolName).toBe("search_recipes");
        expect(entity.toolCallId).toBe("c1");
        expect(entity.toolCalls).toBeNull();
        expect(entity.createdAt).toEqual(NOW);
    });

    it("tool_calls가 있으면 그대로 보존한다", () => {
        const entity = AiJobStepEntity.create({
            id: "step-1",
            jobId: "job-1",
            userId: "u1",
            attempt: 1,
            step: step({
                role: "assistant",
                toolCalls: [{ id: "c1", name: "get_task_summary", args: { taskId: "t1" } }],
            }),
            now: NOW,
        });

        expect(entity.isToolCall).toBe(true);
        expect(entity.toolCalls).toEqual([{ id: "c1", name: "get_task_summary", args: { taskId: "t1" } }]);
    });

    it("tool 역할이면 isToolResult가 참이다", () => {
        const entity = AiJobStepEntity.create({
            id: "step-1",
            jobId: "job-1",
            userId: "u1",
            attempt: 1,
            step: step({ role: "tool", toolName: "search_recipes", toolCallId: "c1" }),
            now: NOW,
        });

        expect(entity.isToolResult).toBe(true);
        expect(entity.isToolCall).toBe(false);
    });

    it("그래프 노드 실행 메타데이터를 보존한다", () => {
        const entity = AiJobStepEntity.create({
            id: "step-graph",
            jobId: "job-1",
            userId: "u1",
            attempt: 1,
            step: step({
                role: "graph",
                content: "증거 계획 노드를 마쳤다.",
                nodeName: "plan_evidence",
                eventKind: "node.completed",
                durationMs: 23,
            }),
            now: NOW,
        });

        expect(entity.nodeName).toBe("plan_evidence");
        expect(entity.eventKind).toBe("node.completed");
        expect(entity.durationMs).toBe(23);
    });

    it("id·jobId·userId가 비어 있으면 거부한다", () => {
        expect(() =>
            AiJobStepEntity.create({ id: "", jobId: "job-1", userId: "u1", attempt: 1, step: step(), now: NOW }),
        ).toThrow(InvariantViolationError);
        expect(() =>
            AiJobStepEntity.create({ id: "step-1", jobId: " ", userId: "u1", attempt: 1, step: step(), now: NOW }),
        ).toThrow(InvariantViolationError);
        expect(() =>
            AiJobStepEntity.create({ id: "step-1", jobId: "job-1", userId: " ", attempt: 1, step: step(), now: NOW }),
        ).toThrow(InvariantViolationError);
    });

    it("음수 seq나 빈 content는 거부한다", () => {
        expect(() =>
            AiJobStepEntity.create({
                id: "step-1",
                jobId: "job-1",
                userId: "u1",
                attempt: 1,
                step: step({ seq: -1 }),
                now: NOW,
            }),
        ).toThrow(InvariantViolationError);
        expect(() =>
            AiJobStepEntity.create({
                id: "step-1",
                jobId: "job-1",
                userId: "u1",
                attempt: 1,
                step: step({ content: "  " }),
                now: NOW,
            }),
        ).toThrow(InvariantViolationError);
    });

    it("tool_calls만 있고 content가 비어도 허용한다", () => {
        const entity = AiJobStepEntity.create({
            id: "step-1",
            jobId: "job-1",
            userId: "u1",
            attempt: 1,
            step: step({
                content: "",
                toolCalls: [{ id: "c1", name: "get_task_summary", args: { taskId: "t1" } }],
            }),
            now: NOW,
        });

        expect(entity.content).toBe("");
        expect(entity.isToolCall).toBe(true);
    });
});
