import { describe, expect, it } from "vitest";
import { AGENT_TRACER_ATTR, KIND, SEMCONV_ATTR } from "@monitor/kernel";
import type { RecipeStepDto } from "@monitor/kernel";
import { evaluateRecipeCompliance, type RecipeVerifyWindowEvent } from "./recipe.compliance.model.js";

function step(order: number, verify?: RecipeStepDto["verify"]): RecipeStepDto {
    return { order, action: `action-${order}`, ...(verify !== undefined ? { verify } : {}) };
}

function toolEvent(overrides: Partial<RecipeVerifyWindowEvent> = {}): RecipeVerifyWindowEvent {
    return {
        kind: KIND.executeTool,
        toolName: null,
        filePaths: [],
        metadata: {},
        ...overrides,
    };
}

describe("evaluateRecipeCompliance", () => {
    it("verify가 없는 스텝은 이행 대상에서 뺀다", () => {
        const result = evaluateRecipeCompliance([step(1)], []);
        expect(result.verifiableStepCount).toBe(0);
        expect(result.followedStepOrders).toEqual([]);
    });

    it("command verify는 metadata 명령 문자열의 부분 일치로 이행을 찾는다", () => {
        const steps = [step(1, { kind: "command", commandMatches: ["npm test"] })];
        const events = [toolEvent({ metadata: { [AGENT_TRACER_ATTR.command]: "npm test -- --run" } })];
        expect(evaluateRecipeCompliance(steps, events).followedStepOrders).toEqual([1]);
    });

    it("command verify는 일치하는 명령이 없으면 미이행이다", () => {
        const steps = [step(1, { kind: "command", commandMatches: ["npm test"] })];
        const events = [toolEvent({ metadata: { [AGENT_TRACER_ATTR.command]: "npm run build" } })];
        expect(evaluateRecipeCompliance(steps, events).followedStepOrders).toEqual([]);
    });

    it("pattern verify는 file_paths에 걸리면 이행이다", () => {
        const steps = [step(1, { kind: "pattern", pattern: "\\.spec\\.ts$" })];
        const events = [toolEvent({ filePaths: ["src/foo.spec.ts"] })];
        expect(evaluateRecipeCompliance(steps, events).followedStepOrders).toEqual([1]);
    });

    it("pattern verify는 명령 문자열에도 걸릴 수 있다", () => {
        const steps = [step(1, { kind: "pattern", pattern: "vitest run" })];
        const events = [toolEvent({ metadata: { [AGENT_TRACER_ATTR.command]: "npx vitest run" } })];
        expect(evaluateRecipeCompliance(steps, events).followedStepOrders).toEqual([1]);
    });

    it("pattern verify의 정규식이 유효하지 않으면 미이행이 아니라 판정 대상에서 뺀다", () => {
        const steps = [step(1, { kind: "pattern", pattern: "[" })];
        const events = [toolEvent({ filePaths: ["src/foo.ts"] })];
        const result = evaluateRecipeCompliance(steps, events);
        expect(result.followedStepOrders).toEqual([]);
        expect(result.verifiableStepCount).toBe(0);
    });

    it("깨진 정규식이 섞여도 남은 스텝의 이행 비율은 그대로 계산한다", () => {
        const steps = [
            step(1, { kind: "pattern", pattern: "[" }),
            step(2, { kind: "action", tool: "file-write" }),
        ];
        const events = [toolEvent({ toolName: "Edit" })];
        const result = evaluateRecipeCompliance(steps, events);
        expect(result.verifiableStepCount).toBe(1);
        expect(result.followedStepOrders).toEqual([2]);
    });

    it("도구 이름이 열이 아니라 metadata에 실려 와도 도구 계열을 알아본다", () => {
        const steps = [step(1, { kind: "action", tool: "file-write" })];
        const events = [toolEvent({ metadata: { [SEMCONV_ATTR.toolName]: "Edit" } })];
        const result = evaluateRecipeCompliance(steps, events);
        expect(result.followedStepOrders).toEqual([1]);
        expect(result.windowComplete).toBe(true);
    });

    it.each([
        ["command", { [AGENT_TRACER_ATTR.command]: "ls" }, null] as const,
        ["file-write", {}, "Edit"] as const,
        ["file-read", {}, "Grep"] as const,
        ["web", {}, "WebFetch"] as const,
    ])("action verify(%s)는 도구 계열이 일치하면 이행이다", (tool, metadata, toolName) => {
        const steps = [step(1, { kind: "action", tool })];
        const events = [toolEvent({ metadata, toolName })];
        expect(evaluateRecipeCompliance(steps, events).followedStepOrders).toEqual([1]);
    });

    it("action verify는 알 수 없는 도구 이름이면 미이행이다", () => {
        const steps = [step(1, { kind: "action", tool: "file-write" })];
        const events = [toolEvent({ toolName: "SomeUnknownTool" })];
        expect(evaluateRecipeCompliance(steps, events).followedStepOrders).toEqual([]);
    });

    it("도구 활동인데 이름도 경로도 명령도 없는 이벤트를 분류 못 한 것으로 센다", () => {
        const events = [toolEvent(), toolEvent({ toolName: "Read" })];
        const result = evaluateRecipeCompliance([], events);
        expect(result.unclassifiedEventCount).toBe(1);
        expect(result.windowComplete).toBe(false);
    });

    it("도구 활동이 아닌 이벤트는 분류 실패에 세지 않는다", () => {
        const events = [toolEvent({ kind: KIND.userMessage })];
        const result = evaluateRecipeCompliance([], events);
        expect(result.unclassifiedEventCount).toBe(0);
        expect(result.windowComplete).toBe(true);
    });
});
