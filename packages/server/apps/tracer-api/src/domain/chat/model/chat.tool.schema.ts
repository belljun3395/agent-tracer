import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import {
    CHAT_TOOLS,
    chatToolArgSpecs,
    type ChatToolArgNumber,
    type ChatToolArgSpec,
    type ChatToolContract,
    type ChatToolSpec,
} from "@monitor/kernel";
import { loadChatToolContract } from "@monitor/kernel/agent/chat.contract.fixture.js";
import type { LlmToolDefinition } from "@monitor/llm-runtime";

/** 두 백엔드와 커널 테스트가 함께 읽는 계약 픽스처이며, 값은 커널이 소유한다. */
export const CHAT_TOOL_CONTRACT: ChatToolContract = loadChatToolContract();

function isEnumSpec(spec: ChatToolArgSpec): spec is { readonly default?: string; readonly values: readonly string[] } {
    return "values" in spec;
}

function buildArg(argSpec: ChatToolArgSpec | undefined, isRequired: boolean): ZodTypeAny {
    let schema: ZodTypeAny;
    if (argSpec !== undefined && isEnumSpec(argSpec)) {
        schema = z.enum([...argSpec.values] as [string, ...string[]]);
    } else if (argSpec !== undefined) {
        schema = z.number().int().min(argSpec.min).max(argSpec.max);
    } else {
        schema = z.string().trim().min(1);
    }
    return isRequired ? schema : schema.optional();
}

function buildShape(spec: ChatToolSpec): ZodRawShape {
    const specs = chatToolArgSpecs(spec);
    const shape: Record<string, ZodTypeAny> = {};
    for (const arg of spec.required) shape[arg] = buildArg(specs.get(arg), true);
    for (const arg of spec.optional) shape[arg] = buildArg(specs.get(arg), false);
    return shape;
}

/** 도구 이름별 zod shape이며, 핸들러가 같은 shape로 인자를 파싱하고 clamp한다. */
export const CHAT_TOOL_SHAPES: Readonly<Record<string, ZodRawShape>> = Object.fromEntries(
    CHAT_TOOLS.map((name) => [name, buildShape(CHAT_TOOL_CONTRACT.tools[name]!)]),
);

/** chat이 모델에게 여는 12개 읽기 도구의 계약이며, 이름·설명·shape 모두 계약 픽스처에서 파생된다. */
export const CHAT_TOOL_DEFINITIONS: readonly LlmToolDefinition[] = CHAT_TOOLS.map((name) => ({
    name,
    description: CHAT_TOOL_CONTRACT.descriptions[name] ?? name,
    shape: CHAT_TOOL_SHAPES[name]!,
}));

export const CHAT_TOOL_NAMES: readonly string[] = CHAT_TOOLS.map((name) => name);

/** 계약이 정한 default·min·max로 도구의 limit 인자를 정규화하며, 없으면 계약 기본값을 쓴다. */
export function chatLimit(toolName: string, raw: number | undefined): number {
    const arg = (CHAT_TOOL_CONTRACT.tools[toolName] as Record<string, unknown> | undefined)?.["limit"] as
        | ChatToolArgNumber
        | undefined;
    if (arg === undefined) return raw ?? 0;
    const value = raw ?? arg.default;
    return Math.max(arg.min, Math.min(arg.max, Math.trunc(value)));
}

/** 도구 이름에 맞는 계약 shape로 원본 인자를 파싱하며, 모델이 낸 값의 타입을 좁힌다. */
export function parseChatToolArgs(toolName: string, raw: unknown): Record<string, unknown> {
    return z.object(CHAT_TOOL_SHAPES[toolName]!).parse(raw);
}

export function strArg(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function numArg(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
