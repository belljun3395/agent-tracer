import { KIND } from "@monitor/kernel";
import { describe, expect, it } from "vitest";
import { resolveTaskStatusEffect } from "./task.status.policy.js";

describe("resolveTaskStatusEffect", () => {
    it("명시적 taskStatus 효과가 있으면 그대로 반환한다", () => {
        const status = resolveTaskStatusEffect({ kind: KIND.taskStart, explicitStatus: "errored" });
        expect(status).toBe("errored");
    });

    it("assistant_turn_complete 사유의 세션 종료는 waiting을 반환한다", () => {
        const status = resolveTaskStatusEffect({
            kind: KIND.sessionEnded,
            completeTask: false,
            completionReason: "assistant_turn_complete",
        });
        expect(status).toBe("waiting");
    });

    it("idle 사유의 세션 종료는 waiting을 반환한다", () => {
        const status = resolveTaskStatusEffect({
            kind: KIND.sessionEnded,
            completeTask: false,
            completionReason: "idle",
        });
        expect(status).toBe("waiting");
    });

    it("completeTask가 true인 세션 종료는 completed를 반환한다", () => {
        const status = resolveTaskStatusEffect({
            kind: KIND.sessionEnded,
            completeTask: true,
            completionReason: "assistant_turn_complete",
        });
        expect(status).toBe("completed");
    });

    it("explicit_exit 사유의 세션 종료는 completed를 반환한다", () => {
        const status = resolveTaskStatusEffect({
            kind: KIND.sessionEnded,
            completeTask: false,
            completionReason: "explicit_exit",
        });
        expect(status).toBe("completed");
    });

    it("runtime_terminated 사유의 세션 종료는 completed를 반환한다", () => {
        const status = resolveTaskStatusEffect({
            kind: KIND.sessionEnded,
            completeTask: false,
            completionReason: "runtime_terminated",
        });
        expect(status).toBe("completed");
    });

    it("cleared 사유의 세션 종료(/clear 경계)는 completed를 반환한다", () => {
        const status = resolveTaskStatusEffect({
            kind: KIND.sessionEnded,
            completeTask: false,
            completionReason: "cleared",
        });
        expect(status).toBe("completed");
    });

    it("유저 메시지가 도착하면 running을 반환한다", () => {
        const status = resolveTaskStatusEffect({ kind: KIND.userMessage });
        expect(status).toBe("running");
    });

    it("세션 시작이면 running을 반환한다", () => {
        const status = resolveTaskStatusEffect({ kind: KIND.sessionStarted });
        expect(status).toBe("running");
    });

    it("resume:false인 세션 시작(읽기 전용 재연결)은 효과가 없다", () => {
        const status = resolveTaskStatusEffect({ kind: KIND.sessionStarted, resume: false });
        expect(status).toBeUndefined();
    });

    it("어휘 밖 kind는 효과가 없다", () => {
        const status = resolveTaskStatusEffect({ kind: KIND.taskComplete });
        expect(status).toBeUndefined();
    });
});
