import { describe, expect, it } from "vitest";
import {
    AI_AGENT_BACKEND,
    DEFAULT_AI_AGENT_BACKEND,
    JOB_STATUS,
    RULE_GENERATION_INTENT_MAX_LENGTH,
    isCancelableJobStatus,
    isTerminalJobStatus,
    normalizeAiAgentBackend,
    normalizeRuleGenerationIntent,
} from "./job.const.js";

describe("normalizeAiAgentBackend", () => {
    it("정식 값과 CLI 호환 별칭을 정규화한다", () => {
        expect(normalizeAiAgentBackend("python")).toBe(AI_AGENT_BACKEND.python);
        expect(normalizeAiAgentBackend("claude-sdk")).toBe(AI_AGENT_BACKEND.claudeSdk);
        expect(normalizeAiAgentBackend("ts")).toBe(AI_AGENT_BACKEND.claudeSdk);
    });

    it("사라진 백엔드 이름은 기본값으로 되돌린다", () => {
        expect(normalizeAiAgentBackend("openai")).toBe(DEFAULT_AI_AGENT_BACKEND);
    });

    it("알 수 없는 값은 기본 backend로 되돌린다", () => {
        expect(normalizeAiAgentBackend("unknown")).toBe(DEFAULT_AI_AGENT_BACKEND);
    });
});

describe("isTerminalJobStatus", () => {
    it("완료·실패·취소를 종료 상태로 본다", () => {
        expect(isTerminalJobStatus(JOB_STATUS.completed)).toBe(true);
        expect(isTerminalJobStatus(JOB_STATUS.failed)).toBe(true);
        expect(isTerminalJobStatus(JOB_STATUS.canceled)).toBe(true);
    });

    it("대기·실행은 종료 상태가 아니다", () => {
        expect(isTerminalJobStatus(JOB_STATUS.pending)).toBe(false);
        expect(isTerminalJobStatus(JOB_STATUS.running)).toBe(false);
    });
});

describe("isCancelableJobStatus", () => {
    it("대기·실행 중인 잡만 취소할 수 있다", () => {
        expect(isCancelableJobStatus(JOB_STATUS.pending)).toBe(true);
        expect(isCancelableJobStatus(JOB_STATUS.running)).toBe(true);
    });

    it("종료된 잡은 취소할 수 없다", () => {
        expect(isCancelableJobStatus(JOB_STATUS.completed)).toBe(false);
        expect(isCancelableJobStatus(JOB_STATUS.failed)).toBe(false);
        expect(isCancelableJobStatus(JOB_STATUS.canceled)).toBe(false);
    });
});

describe("normalizeRuleGenerationIntent", () => {
    it("앞뒤 공백을 제거한 문구를 돌려준다", () => {
        expect(normalizeRuleGenerationIntent("  테스트 실행을 검증해줘  ")).toBe("테스트 실행을 검증해줘");
    });

    it("문자열이 아니거나 공백뿐이면 의도가 없는 것으로 본다", () => {
        expect(normalizeRuleGenerationIntent("   ")).toBeUndefined();
        expect(normalizeRuleGenerationIntent("")).toBeUndefined();
        expect(normalizeRuleGenerationIntent(undefined)).toBeUndefined();
        expect(normalizeRuleGenerationIntent(42)).toBeUndefined();
    });

    it("상한을 넘는 문구를 잘라낸다", () => {
        const long = "가".repeat(RULE_GENERATION_INTENT_MAX_LENGTH + 10);
        expect(normalizeRuleGenerationIntent(long)).toHaveLength(RULE_GENERATION_INTENT_MAX_LENGTH);
    });
});
