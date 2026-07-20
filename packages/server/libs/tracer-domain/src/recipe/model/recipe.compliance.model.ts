import { AGENT_TRACER_ATTR, TOOL_ACTIVITY_EVENT_KINDS, isTerminalCommand } from "@monitor/kernel";
import type { RecipeStepDto, RecipeVerifyDto, RecipeVerifyTool } from "@monitor/kernel";

const TOOL_ACTIVITY_KIND_SET = new Set<string>(TOOL_ACTIVITY_EVENT_KINDS);

// 규칙의 도구 별칭 추론 기계를 복제하지 않고, 이 슬라이스가 직접 쓰는 최소한의 이름만 안다.
const WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const READ_TOOL_NAMES = new Set(["Read", "Grep", "Glob", "LS"]);
const WEB_TOOL_NAMES = new Set(["WebFetch", "WebSearch"]);

/** 이행 판정이 먹는 이벤트의 최소 입력이며, 원장 읽기 모델의 events 행이 그대로 만족한다. */
export interface RecipeVerifyWindowEvent {
    readonly kind: string;
    readonly toolName: string | null;
    readonly filePaths: readonly string[];
    readonly metadata: Readonly<Record<string, unknown>>;
}

export interface RecipeComplianceResult {
    readonly verifiableStepCount: number;
    readonly followedStepOrders: readonly number[];
    readonly unclassifiedEventCount: number;
    readonly windowComplete: boolean;
}

function readCommand(event: RecipeVerifyWindowEvent): string | undefined {
    const value = event.metadata[AGENT_TRACER_ATTR.command];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function classifyToolFamily(event: RecipeVerifyWindowEvent): RecipeVerifyTool | null {
    if (isTerminalCommand(event)) return "command";
    const toolName = event.toolName;
    if (toolName === null) return null;
    if (WRITE_TOOL_NAMES.has(toolName)) return "file-write";
    if (READ_TOOL_NAMES.has(toolName)) return "file-read";
    if (WEB_TOOL_NAMES.has(toolName)) return "web";
    return null;
}

function matchesPattern(pattern: string, event: RecipeVerifyWindowEvent): boolean {
    let regex: RegExp;
    try {
        regex = new RegExp(pattern);
    } catch {
        // 레시피가 낸 정규식이 유효하지 않으면 이행 증거 없음으로 취급한다.
        return false;
    }
    const command = readCommand(event);
    if (command !== undefined && regex.test(command)) return true;
    return event.filePaths.some((path) => regex.test(path));
}

function stepSatisfiedBy(verify: RecipeVerifyDto, event: RecipeVerifyWindowEvent): boolean {
    if (verify.kind === "command") {
        const command = readCommand(event);
        return command !== undefined && verify.commandMatches.some((needle) => command.includes(needle));
    }
    if (verify.kind === "pattern") return matchesPattern(verify.pattern, event);
    return classifyToolFamily(event) === verify.tool;
}

function isUnclassifiedToolActivity(event: RecipeVerifyWindowEvent): boolean {
    if (!TOOL_ACTIVITY_KIND_SET.has(event.kind)) return false;
    const toolName = event.toolName !== null && event.toolName.trim().length > 0;
    return !toolName && event.filePaths.length === 0 && readCommand(event) === undefined;
}

/** 창 안 이벤트만으로 verify를 가진 스텝의 이행을 판정하며, 도구를 못 읽은 도구 활동이 하나라도 있으면 창을 불완전으로 표시한다. */
export function evaluateRecipeCompliance(
    steps: readonly RecipeStepDto[],
    windowEvents: readonly RecipeVerifyWindowEvent[],
): RecipeComplianceResult {
    const verifiableSteps = steps.filter((step): step is RecipeStepDto & { readonly verify: RecipeVerifyDto } =>
        step.verify !== undefined);
    const followedStepOrders = verifiableSteps
        .filter((step) => windowEvents.some((event) => stepSatisfiedBy(step.verify, event)))
        .map((step) => step.order);
    const unclassifiedEventCount = windowEvents.filter(isUnclassifiedToolActivity).length;

    return {
        verifiableStepCount: verifiableSteps.length,
        followedStepOrders,
        unclassifiedEventCount,
        windowComplete: unclassifiedEventCount === 0,
    };
}
