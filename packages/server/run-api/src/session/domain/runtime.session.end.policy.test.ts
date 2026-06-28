import { describe, expect, it } from "vitest";
import { RuntimeSessionEnd, type RuntimeSessionEndProps } from "./runtime.session.end.policy.js";

function makeEnd(overrides: Partial<RuntimeSessionEndProps> = {}): RuntimeSessionEnd {
    return new RuntimeSessionEnd({
        taskKind: "primary",
        taskStatus: "running",
        completeTask: false,
        runningSessionCount: 0,
        hasRunningBackgroundDescendants: false,
        ...overrides,
    });
}

describe("RuntimeSessionEnd.decide", () => {
    describe("gating conditions", () => {
        it("leaves open when task is not running", () => {
            expect(makeEnd({ taskStatus: "waiting" }).decide())
                .toEqual({ action: "leave_open" });
            expect(makeEnd({ taskStatus: "completed" }).decide())
                .toEqual({ action: "leave_open" });
            expect(makeEnd({ taskStatus: "errored" }).decide())
                .toEqual({ action: "leave_open" });
        });

        it("leaves open when other sessions are still running for this task", () => {
            const end = makeEnd({
                runningSessionCount: 1,
                completionReason: "explicit_exit",
                completeTask: true,
            });
            expect(end.decide()).toEqual({ action: "leave_open" });
        });
    });

    describe("background tasks", () => {
        it("completes regardless of completeTask or completionReason", () => {
            for (const reason of ["idle", "assistant_turn_complete", "explicit_exit", "runtime_terminated"] as const) {
                for (const completeTask of [true, false]) {
                    const end = makeEnd({
                        taskKind: "background",
                        completionReason: reason,
                        completeTask,
                    });
                    expect(end.decide()).toEqual({
                        action: "complete_task",
                        summary: "Background task completed",
                    });
                }
            }
        });
    });

    describe("primary tasks — session-terminating reasons", () => {
        it("completes on explicit_exit even when completeTask is false", () => {
            const end = makeEnd({
                completionReason: "explicit_exit",
                completeTask: false,
            });
            expect(end.decide()).toEqual({
                action: "complete_task",
                summary: "Runtime session ended",
            });
        });

        it("completes on runtime_terminated even when completeTask is false", () => {
            const end = makeEnd({
                completionReason: "runtime_terminated",
                completeTask: false,
            });
            expect(end.decide()).toEqual({
                action: "complete_task",
                summary: "Runtime session ended",
            });
        });

        it("completes on runtime_terminated even with running background descendants", () => {
            const end = makeEnd({
                completionReason: "runtime_terminated",
                completeTask: false,
                hasRunningBackgroundDescendants: true,
            });
            expect(end.decide()).toEqual({
                action: "complete_task",
                summary: "Runtime session ended",
            });
        });
    });

    describe("primary tasks — assistant_turn_complete", () => {
        it("moves to waiting when completeTask is false", () => {
            const end = makeEnd({
                completionReason: "assistant_turn_complete",
                completeTask: false,
            });
            expect(end.decide()).toEqual({ action: "move_task_to_waiting" });
        });

        it("completes when completeTask is true and no background descendants", () => {
            const end = makeEnd({
                completionReason: "assistant_turn_complete",
                completeTask: true,
            });
            expect(end.decide()).toEqual({
                action: "complete_task",
                summary: "Runtime session ended",
            });
        });

        it("moves to waiting when background descendants still run, even with completeTask=true", () => {
            const end = makeEnd({
                completionReason: "assistant_turn_complete",
                completeTask: true,
                hasRunningBackgroundDescendants: true,
            });
            expect(end.decide()).toEqual({ action: "move_task_to_waiting" });
        });
    });

    describe("primary tasks — idle", () => {
        it("moves to waiting when completeTask is false", () => {
            const end = makeEnd({
                completionReason: "idle",
                completeTask: false,
            });
            expect(end.decide()).toEqual({ action: "move_task_to_waiting" });
        });

        it("completes when completeTask is true", () => {
            const end = makeEnd({
                completionReason: "idle",
                completeTask: true,
            });
            expect(end.decide()).toEqual({
                action: "complete_task",
                summary: "Runtime session ended",
            });
        });
    });

    describe("primary tasks — undefined completionReason", () => {
        it("leaves open when completeTask is false", () => {
            const end = makeEnd({ completeTask: false });
            expect(end.decide()).toEqual({ action: "leave_open" });
        });

        it("completes when completeTask is true", () => {
            const end = makeEnd({ completeTask: true });
            expect(end.decide()).toEqual({
                action: "complete_task",
                summary: "Runtime session ended",
            });
        });
    });
});
