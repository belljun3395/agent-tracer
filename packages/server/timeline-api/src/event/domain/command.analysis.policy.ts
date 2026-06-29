export interface CommandTargetLike {
    readonly type?: unknown;
    readonly value?: unknown;
}

interface CommandStepLike {
    readonly commandName?: unknown;
    readonly operation?: unknown;
    readonly effect?: unknown;
    readonly targets?: unknown;
    readonly pipeline?: unknown;
}

// 파일 시스템 경로를 가리키는 command target 종류.
const PATH_BEARING_TARGET_TYPES = new Set(["file", "directory", "path"]);

// target이 경로를 가리키면 정규화 전 경로 문자열을, 아니면 undefined를 돌려준다.
export function commandTargetPath(target: CommandTargetLike): string | undefined {
    if (typeof target.type !== "string" || !PATH_BEARING_TARGET_TYPES.has(target.type)) return undefined;
    if (typeof target.value !== "string") return undefined;
    const value = target.value.trim();
    return value ? value : undefined;
}

export function flattenCommandSteps(values: readonly unknown[]): readonly CommandStepLike[] {
    const flattened: CommandStepLike[] = [];
    for (const value of values) {
        if (!value || typeof value !== "object") continue;
        const step = value as CommandStepLike;
        flattened.push(step);
        if (Array.isArray(step.pipeline)) {
            flattened.push(...flattenCommandSteps(step.pipeline));
        }
    }
    return flattened;
}

// 모든 step의 target에서 경로를 모은다(operation/effect 무관).
export function extractCommandAnalysisPaths(analysis: unknown): readonly string[] {
    if (!analysis || typeof analysis !== "object") return [];
    const steps = (analysis as { readonly steps?: unknown }).steps;
    if (!Array.isArray(steps)) return [];
    const paths: string[] = [];
    for (const step of flattenCommandSteps(steps)) {
        const targets = Array.isArray(step.targets) ? step.targets : [];
        for (const targetValue of targets) {
            if (!targetValue || typeof targetValue !== "object") continue;
            const path = commandTargetPath(targetValue as CommandTargetLike);
            if (path) paths.push(path);
        }
    }
    return paths;
}
