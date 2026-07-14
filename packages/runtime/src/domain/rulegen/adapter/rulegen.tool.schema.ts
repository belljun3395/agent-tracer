import {
    createSdkMcpServer,
    tool,
    type McpSdkServerConfigWithInstance,
    type SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import {z, type ZodRawShape, type ZodTypeAny} from "zod";
import {
    RULEGEN_MCP_SERVER,
    type RulegenToolInput,
    type RulegenToolParam,
    type RulegenToolSpec,
    type RulegenToolset,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";

function numberField(param: RulegenToolParam): ZodTypeAny {
    let field = z.number().int();
    if (param.min !== undefined) field = field.min(param.min);
    if (param.max !== undefined) field = field.max(param.max);
    return field;
}

function fieldOf(param: RulegenToolParam): ZodTypeAny {
    const field = (param.type === "string" ? z.string() : numberField(param)).describe(param.description);
    return param.optional ? field.optional() : field;
}

function shapeOf(spec: RulegenToolSpec): ZodRawShape {
    const shape: Record<string, ZodTypeAny> = {};
    for (const param of spec.params) shape[param.name] = fieldOf(param);
    return shape;
}

/** 도구 명세 하나를 zod 인자 스키마와 도메인 핸들러를 묶은 SDK 도구로 렌더링한다. */
export function buildRulegenTools(
    specs: readonly RulegenToolSpec[],
    toolset: RulegenToolset,
): SdkMcpToolDefinition<ZodRawShape>[] {
    return specs.map((spec) =>
        tool(spec.name, spec.description, shapeOf(spec), async (args: Record<string, unknown>) => {
            const text = await toolset[spec.name](args as unknown as RulegenToolInput);
            return {content: [{type: "text" as const, text}]};
        }));
}

/** 렌더링한 도구를 실행기가 모델에 노출하는 MCP 서버로 묶는다. */
export function createRulegenMcpServer(
    specs: readonly RulegenToolSpec[],
    toolset: RulegenToolset,
): McpSdkServerConfigWithInstance {
    return createSdkMcpServer({name: RULEGEN_MCP_SERVER, tools: buildRulegenTools(specs, toolset)});
}
