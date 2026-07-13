import type {CommandTarget} from "~runtime/domain/ingest/model/command.analysis.model.js";

/** 명령 인자에서 파일 시스템 대상을 뽑는다. */
export function pathTargets(args: readonly string[]): readonly CommandTarget[] {
    return args
        .filter((arg) => arg.length > 0 && !arg.startsWith("-") && !isLikelyExpression(arg))
        .map((arg) => ({type: targetTypeForPath(arg), value: arg}));
}

export function urlTargets(args: readonly string[]): readonly CommandTarget[] {
    return args
        .filter((arg) => /^https?:\/\//.test(arg))
        .map((arg) => ({type: "url" as const, value: arg}));
}

export function gitPathspecTargets(args: readonly string[]): readonly CommandTarget[] {
    const separatorIndex = args.indexOf("--");
    const candidates = separatorIndex >= 0
        ? args.slice(separatorIndex + 1)
        : args.filter((arg) => !arg.startsWith("-") && !looksLikeGitRevision(arg));
    return pathTargets(candidates);
}

export function uniqueTargets(targets: readonly CommandTarget[]): readonly CommandTarget[] {
    const seen = new Set<string>();
    const result: CommandTarget[] = [];
    for (const target of targets) {
        const key = `${target.type}:${target.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(target);
    }
    return result;
}

export function targetTypeForPath(value: string): CommandTarget["type"] {
    if (value === "-" || value === "/dev/stdin") return "stream";
    if (value === "." || value.endsWith("/")) return "directory";
    if (value.includes("*")) return "path";
    return "file";
}

export function containsComplexShell(command: string): boolean {
    return command.includes("$(") || command.includes("`") || command.includes("<<");
}

function isLikelyExpression(value: string): boolean {
    return /^[0-9,$/{}().*+?[\\\]^]+p?$/.test(value);
}

function looksLikeGitRevision(value: string): boolean {
    return value === "HEAD" || /^[A-Fa-f0-9]{7,40}$/.test(value) || value.includes("..");
}
