import { describe, expect, it } from "vitest";
import {
    AGENT_TRACER_ATTR,
    GEN_AI_OBSERVABILITY_METRIC,
    GEN_AI_OPERATION,
    GEN_AI_TOKEN_TYPE,
    SEMCONV_ATTR,
    promoteAttributeKey,
    toSemconvAttributes,
} from "./semconv.const.js";

describe("SEMCONV_ATTR", () => {
    it("GenAI semconv 핵심 속성 이름을 고정한다", () => {
        expect(SEMCONV_ATTR.operationName).toBe("gen_ai.operation.name");
        expect(SEMCONV_ATTR.requestModel).toBe("gen_ai.request.model");
        expect(SEMCONV_ATTR.inputTokens).toBe("gen_ai.usage.input_tokens");
        expect(SEMCONV_ATTR.outputTokens).toBe("gen_ai.usage.output_tokens");
        expect(SEMCONV_ATTR.conversationId).toBe("gen_ai.conversation.id");
        expect(SEMCONV_ATTR.responseFinishReasons).toBe("gen_ai.response.finish_reasons");
    });

    it("표준 속성만 gen_ai·mcp·error 네임스페이스를 쓴다", () => {
        for (const value of Object.values(SEMCONV_ATTR)) {
            expect(value.startsWith("gen_ai.") || value.startsWith("mcp.") || value === "error.type").toBe(true);
        }
    });
});

describe("AGENT_TRACER_ATTR", () => {
    it("표준 대응이 없는 속성은 agent_tracer 네임스페이스에 격리한다", () => {
        for (const value of Object.values(AGENT_TRACER_ATTR)) {
            expect(value.startsWith("agent_tracer.")).toBe(true);
        }
    });

    it("AI 잡 상관키를 표준 네임스페이스 밖에 둔다", () => {
        expect(AGENT_TRACER_ATTR.jobId).toBe("agent_tracer.job.id");
    });

    it("턴 상관키를 인과 부모와 별도 속성으로 둔다", () => {
        expect(AGENT_TRACER_ATTR.turnResponseEventId).toBe("agent_tracer.turn.response_event_id");
    });

    it("과금 기준 base input 토큰을 OTel 표준 input_tokens와 별도 속성으로 둔다", () => {
        expect(AGENT_TRACER_ATTR.billableBaseInputTokens).toBe("agent_tracer.usage.billable_base_input_tokens");
    });
});

describe("GEN_AI_OPERATION", () => {
    it("잡·LLM·도구·계획 경계를 같은 어휘로 표현한다", () => {
        expect(GEN_AI_OPERATION.invokeAgent).toBe("invoke_agent");
        expect(GEN_AI_OPERATION.chat).toBe("chat");
        expect(GEN_AI_OPERATION.executeTool).toBe("execute_tool");
        expect(GEN_AI_OPERATION.plan).toBe("plan");
    });
});

describe("GEN_AI_OBSERVABILITY_METRIC", () => {
    it("현재 GenAI metric 이름을 사용한다", () => {
        expect(GEN_AI_OBSERVABILITY_METRIC.clientTokenUsage).toBe("gen_ai.client.token.usage");
        expect(GEN_AI_OBSERVABILITY_METRIC.clientOperationDuration).toBe("gen_ai.client.operation.duration");
        expect(GEN_AI_OBSERVABILITY_METRIC.invokeAgentDuration).toBe("gen_ai.invoke_agent.duration");
        expect(GEN_AI_OBSERVABILITY_METRIC.executeToolDuration).toBe("gen_ai.execute_tool.duration");
    });
});

describe("GEN_AI_TOKEN_TYPE", () => {
    it("토큰 타입은 input/output만 기본 방출한다", () => {
        expect(GEN_AI_TOKEN_TYPE.input).toBe("input");
        expect(GEN_AI_TOKEN_TYPE.output).toBe("output");
    });
});

describe("promoteAttributeKey", () => {
    it("표준 대응이 있는 키는 semconv 이름으로 올린다", () => {
        expect(promoteAttributeKey("toolName")).toBe(SEMCONV_ATTR.toolName);
        expect(promoteAttributeKey("stopReason")).toBe(SEMCONV_ATTR.responseFinishReasons);
        expect(promoteAttributeKey("inputTokens")).toBe(SEMCONV_ATTR.inputTokens);
    });

    it("표준 대응이 없는 제품 속성은 agent_tracer 네임스페이스로 올린다", () => {
        expect(promoteAttributeKey("command")).toBe(AGENT_TRACER_ATTR.command);
        expect(promoteAttributeKey("turnResponseEventId")).toBe(AGENT_TRACER_ATTR.turnResponseEventId);
    });

    it("도구별 상세 키는 그대로 둔다", () => {
        expect(promoteAttributeKey("exitCode")).toBe("exitCode");
        expect(promoteAttributeKey("commandAnalysis")).toBe("commandAnalysis");
    });
});

describe("toSemconvAttributes", () => {
    it("훅이 만든 camelCase 메타데이터를 저장 전에 정규화한다", () => {
        expect(toSemconvAttributes({ toolName: "Bash", command: "npm test", exitCode: 0 })).toEqual({
            [SEMCONV_ATTR.toolName]: "Bash",
            [AGENT_TRACER_ATTR.command]: "npm test",
            exitCode: 0,
        });
    });

    it("값은 건드리지 않고 키만 바꾼다", () => {
        const analysis = { overallEffect: "destructive" };
        expect(toSemconvAttributes({ commandAnalysis: analysis })["commandAnalysis"]).toBe(analysis);
    });
});

