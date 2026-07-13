import type {CommandAnalysis, CommandStep} from "~runtime/domain/ingest/model/command.analysis.model.js";

/** 한 이벤트가 실을 수 있는 파일 경로 수의 상한이다. */
export const MAX_FILE_TARGETS = 100;
/** 경로 하나가 넘어설 수 없는 길이 상한이다. */
export const MAX_FILE_TARGET_LENGTH = 1024;

/** 명령 분석에서 파일 경로를 모으고 상한을 넘는 것은 버린다. */
export function collectFileTargets(analysis: CommandAnalysis): string[] {
    const seen = new Set<string>();
    const filePaths: string[] = [];
    const visit = (step: CommandStep): void => {
        for (const target of step.targets) {
            if (filePaths.length >= MAX_FILE_TARGETS) return;
            if (target.type !== "file" && target.type !== "path") continue;
            if (!target.value || target.value === "-" || seen.has(target.value)) continue;
            if (target.value.length > MAX_FILE_TARGET_LENGTH) continue;
            seen.add(target.value);
            filePaths.push(target.value);
        }
        for (const sub of step.pipeline ?? []) {
            if (filePaths.length >= MAX_FILE_TARGETS) return;
            visit(sub);
        }
    };
    for (const step of analysis.steps) {
        if (filePaths.length >= MAX_FILE_TARGETS) break;
        visit(step);
    }
    return filePaths;
}

/** 도구 입력의 수 표현을 숫자로 정규화한다. */
export function toOptionalNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}
