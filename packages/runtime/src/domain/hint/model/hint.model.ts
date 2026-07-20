export type PreprocessingHintTrigger = "user_prompt" | "pre_tool";
export type PreprocessingHintSeverity = "info" | "warning" | "critical";
export type PreprocessingHintType = "context_pressure" | "command_repetition";

/** 다음 턴 앞에 주입되는 전처리 힌트 하나다. */
export interface PreprocessingHint {
    readonly type: PreprocessingHintType;
    readonly severity: PreprocessingHintSeverity;
    readonly title: string;
    readonly message: string;
}

/** 어떤 계기로 어떤 도구 앞에서 힌트를 묻는지다. */
export interface PreprocessingHintsRequest {
    readonly trigger: PreprocessingHintTrigger;
    readonly toolName?: string;
    readonly command?: string;
    readonly questions?: readonly string[];
}

/** 한 번에 실어 보내는 힌트 수의 상한이며, 넘치면 심각한 것부터 남긴다. */
const MAX_ANNOUNCED_HINTS = 4;

const SEVERITY_ORDER: Record<PreprocessingHintSeverity, number> = {critical: 0, warning: 1, info: 2};

/** 힌트를 에이전트가 읽는 컨텍스트 블록으로 만든다. */
export function formatHintsContext(hints: readonly PreprocessingHint[]): string {
    if (hints.length === 0) return "";
    const shown = [...hints]
        .sort((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity])
        .slice(0, MAX_ANNOUNCED_HINTS);
    const lines = ["<agent-tracer-preprocessing>"];
    for (const hint of shown) {
        const icon = hint.severity === "critical" ? "⛔" : hint.severity === "warning" ? "⚠️" : "ℹ️";
        lines.push(`${icon} [${hint.type}] ${hint.title}`);
        lines.push(`   ${hint.message}`);
    }
    lines.push("</agent-tracer-preprocessing>");
    return lines.join("\n");
}
