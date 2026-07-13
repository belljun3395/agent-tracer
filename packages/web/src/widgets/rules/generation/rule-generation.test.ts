import { describe, expect, it } from "vitest";
import {
  buildRuleGenerationInput,
  isUnhandledCompletedRuleJob,
  parseMaxRulesPerTask,
  readDiscardSummary,
  readRuleGenerationIntent,
} from "~web/widgets/rules/generation/rule-generation.js";

describe("isUnhandledCompletedRuleJob", () => {
  it("완료되고 규칙을 만든 새 잡이면 반영 대상이다", () => {
    const job = { id: "j1", status: "completed", rulesCreated: 3 };
    expect(isUnhandledCompletedRuleJob(job, null)).toBe(true);
  });

  it("같은 개수로 재생성해도 잡 id가 다르면 다시 반영한다", () => {
    const job = { id: "j2", status: "completed", rulesCreated: 3 };
    expect(isUnhandledCompletedRuleJob(job, "j1")).toBe(true);
  });

  it("이미 반영한 잡은 다시 반영하지 않는다", () => {
    const job = { id: "j1", status: "completed", rulesCreated: 3 };
    expect(isUnhandledCompletedRuleJob(job, "j1")).toBe(false);
  });

  it("완료 전이거나 만든 규칙이 없으면 반영하지 않는다", () => {
    expect(isUnhandledCompletedRuleJob({ id: "j1", status: "running", rulesCreated: 0 }, null)).toBe(false);
    expect(isUnhandledCompletedRuleJob({ id: "j1", status: "completed", rulesCreated: 0 }, null)).toBe(false);
    expect(isUnhandledCompletedRuleJob(null, null)).toBe(false);
  });
});

describe("buildRuleGenerationInput", () => {
  it("의도를 적으면 다듬어 함께 싣는다", () => {
    expect(buildRuleGenerationInput("t1", "  린트를 돌렸는지 확인  ")).toEqual({
      taskId: "t1",
      intent: "린트를 돌렸는지 확인",
    });
  });

  it("의도가 비면 intent 키를 싣지 않는다", () => {
    expect(buildRuleGenerationInput("t1", "   ")).toEqual({ taskId: "t1" });
    expect("intent" in buildRuleGenerationInput("t1", "")).toBe(false);
  });
});

describe("parseMaxRulesPerTask", () => {
  it("설정된 개수를 잡 입력에 싣는다", () => {
    expect(buildRuleGenerationInput("t1", "", parseMaxRulesPerTask("5"))).toEqual({
      taskId: "t1",
      maxRules: 5,
    });
  });

  it("설정이 없거나 유효하지 않으면 개수를 싣지 않는다", () => {
    expect(parseMaxRulesPerTask(undefined)).toBeUndefined();
    expect(parseMaxRulesPerTask("0")).toBeUndefined();
    expect("maxRules" in buildRuleGenerationInput("t1", "", parseMaxRulesPerTask("x"))).toBe(false);
  });

  it("잡 입력 스키마의 상한을 넘는 값은 상한으로 자른다", () => {
    expect(parseMaxRulesPerTask("999")).toBe(20);
  });
});

describe("readDiscardSummary", () => {
  it("중복으로 버려진 제안 수를 요약한다", () => {
    const summary = readDiscardSummary({
      rulesCreated: 0,
      proposalsDiscarded: [
        { name: "규칙 A", reason: "duplicate" },
        { name: "규칙 B", reason: "duplicate" },
      ],
    });

    expect(summary).toBe("2 duplicate");
  });

  it("스키마를 어긴 제안과 중복을 함께 요약한다", () => {
    const summary = readDiscardSummary({
      rulesCreated: 0,
      proposalsDiscarded: [{ name: "규칙 A", reason: "duplicate" }],
      proposalsRejected: [{ index: 1, reason: "expect가 없다" }],
    });

    expect(summary).toBe("1 duplicate, 1 malformed");
  });

  it("버린 제안이 없으면 요약하지 않는다", () => {
    expect(readDiscardSummary({ rulesCreated: 2 })).toBeUndefined();
    expect(readDiscardSummary(null)).toBeUndefined();
  });
});

describe("readRuleGenerationIntent", () => {
  it("지난 잡 입력에서 의도를 읽는다", () => {
    expect(readRuleGenerationIntent({ taskId: "t1", intent: "테스트 검증" })).toBe("테스트 검증");
  });

  it("의도가 없거나 문자열이 아니면 undefined다", () => {
    expect(readRuleGenerationIntent({ taskId: "t1" })).toBeUndefined();
    expect(readRuleGenerationIntent({ intent: 7 })).toBeUndefined();
    expect(readRuleGenerationIntent(null)).toBeUndefined();
  });
});
