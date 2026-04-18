import { describe, expect, it } from "vitest";
import { ActionName, createTaskSlug, normalizeWorkspacePath, normalizeLane } from "@monitor/domain";
import { classifyEvent, tokenizeActionName } from "@monitor/classification";
describe("normalizeWorkspacePath", () => {
    it("compresses duplicate separators and trims trailing slash", () => {
        expect(normalizeWorkspacePath("/tmp//baden///")).toBe("/tmp/baden");
    });
});
describe("createTaskSlug", () => {
    it("creates a stable slug from a title", () => {
        expect(createTaskSlug({ title: "Build Baden Timeline MVP" })).toBe("build-baden-timeline-mvp");
    });
});
describe("classifyEvent", () => {
    it("derives the lane from action-registry match when action name is provided", () => {
        const classification = classifyEvent({
            kind: "tool.used",
            actionName: ActionName("readFile")
        });
        expect(classification.lane).toBe("exploration");
        expect(classification.tags).toContain("action-registry");
    });
    it("classifies free-form snake_case actions with keyword matches", () => {
        const classification = classifyEvent({
            kind: "action.logged",
            actionName: ActionName("run_test_rule_guard"),
            title: "run_test_rule_guard"
        });
        expect(classification.lane).toBe("implementation");
        expect(classification.tags).toContain("action-registry");
        expect(classification.matches[0]?.source).toBe("action-registry");
    });
});
describe("tokenizeActionName", () => {
    it("drops skip words like run_ before classification", () => {
        expect(tokenizeActionName("run_test_rule_guard")).toEqual(["test", "rule", "guard"]);
    });
});
describe("tokenizeActionName - 추가 케이스", () => {
    it("camelCase를 토큰으로 분리한다", () => {
        expect(tokenizeActionName("readFileContent")).toEqual(["read", "file", "content"]);
    });
    it("앞의 run skip word를 제거한다", () => {
        expect(tokenizeActionName("run_tests")).toEqual(["tests"]);
    });
    it("빈 문자열은 빈 배열을 반환한다", () => {
        expect(tokenizeActionName("")).toEqual([]);
    });
    it("특수문자를 구분자로 처리한다", () => {
        expect(tokenizeActionName("read-file.content")).toEqual(["read", "file", "content"]);
    });
    it("모두 skip word면 빈 배열을 반환한다", () => {
        expect(tokenizeActionName("run")).toEqual([]);
    });
});
describe("classifyEvent - 추가 케이스", () => {
    it("액션 없을 때 기본 레인을 반환한다", () => {
        const result = classifyEvent({ kind: "tool.used", title: "read file" });
        expect(result.lane).toBe("implementation");
        expect(result.matches).toHaveLength(0);
    });
    it("명시적 lane은 action-registry 매치보다 우선한다", () => {
        const result = classifyEvent({ kind: "tool.used", title: "read", lane: "implementation" });
        expect(result.lane).toBe("implementation");
    });
    it("user.message는 user 레인을 유지한다", () => {
        const result = classifyEvent({
            kind: "user.message",
            title: "Discuss background async behavior",
            body: "Need to review background lifecycle"
        });
        expect(result.lane).toBe("user");
    });
    it("task.start도 user 레인을 유지한다", () => {
        const result = classifyEvent({
            kind: "task.start",
            title: "Background task"
        });
        expect(result.lane).toBe("user");
    });
});
describe("normalizeLane - 추가 케이스", () => {
    it("구버전 'file' → 'exploration'", () => {
        expect(normalizeLane("file")).toBe("exploration");
    });
    it("구버전 'terminal' → 'implementation'", () => {
        expect(normalizeLane("terminal")).toBe("implementation");
    });
    it("구버전 'rules' → 'implementation' (backward compat)", () => {
        expect(normalizeLane("rules")).toBe("implementation");
    });
    it("알 수 없는 값 → 'user'", () => {
        expect(normalizeLane("unknown-lane")).toBe("user");
    });
    it("현재 유효한 레인은 그대로 통과한다", () => {
        const lanes = ["user", "exploration", "planning", "implementation", "telemetry"] as const;
        for (const lane of lanes) {
            expect(normalizeLane(lane)).toBe(lane);
        }
    });
    it("'telemetry' → 'telemetry' (token.usage 레인)", () => {
        expect(normalizeLane("telemetry")).toBe("telemetry");
    });
});
