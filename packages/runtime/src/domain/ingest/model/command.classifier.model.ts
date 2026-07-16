import type {
    CommandEffect,
    CommandRedirect,
    CommandSequencePart,
    CommandStep,
    CommandTarget,
} from "~runtime/domain/ingest/model/command.analysis.model.js";
import {
    containsComplexShell,
    pathTargets,
    targetTypeForPath,
    uniqueTargets,
} from "~runtime/domain/ingest/model/command.target.model.js";

export const READ_COMMANDS = new Set(["cat", "head", "tail", "wc", "stat", "file", "which", "whereis"]);
export const LIST_COMMANDS = new Set(["pwd", "ls", "tree"]);
export const SEARCH_COMMANDS = new Set(["rg", "grep", "fd", "find"]);
export const STREAM_TRANSFORM_COMMANDS = new Set(["head", "tail", "wc", "sort"]);
export const DESTRUCTIVE_COMMANDS = new Set(["rm", "rmdir"]);
export const WRITE_COMMANDS = new Set(["mv", "cp", "chmod", "chown", "mkdir", "touch"]);
export const NETWORK_COMMANDS = new Set(["curl", "wget"]);

/** 명령 이름으로는 안 드러나고 인자 문자열에만 나타나는 파괴적 조작이다. */
const DANGEROUS_ARG_PATTERNS: readonly RegExp[] = [/\bdrop\s+(table|database)\b/i];

/** psql·mysql의 인자에 실린 SQL 삭제처럼 인자에만 드러나는 파괴성을 판정한다. */
export function hasDangerousArgs(raw: string): boolean {
    return DANGEROUS_ARG_PATTERNS.some((pattern) => pattern.test(raw));
}

export function buildBaseStep(
    part: CommandSequencePart,
    commandName: string,
    redirects: readonly CommandRedirect[],
): CommandStep {
    return {
        raw: part.raw,
        commandName,
        operation: "unknown",
        targets: redirects.map((redirect) => redirect.target),
        effect: "unknown",
        confidence: containsComplexShell(part.raw) ? "low" : "medium",
        ...(part.operatorFromPrevious ? {operatorFromPrevious: part.operatorFromPrevious} : {}),
        ...(redirects.length > 0 ? {redirects} : {}),
    };
}

export function withStep(base: CommandStep, patch: Partial<CommandStep>): CommandStep {
    return {
        ...base,
        ...patch,
        targets: uniqueTargets([...base.targets, ...(patch.targets ?? [])]),
    };
}

export function analyzeSed(base: CommandStep, args: readonly string[]): CommandStep {
    const lineRange = args.map(extractSedLineRange).find((value): value is string => value !== undefined);
    const targets = pathTargets(
        args.filter((arg) => !arg.startsWith("-") && extractSedLineRange(arg) === undefined),
    );
    const inPlace = args.some((arg) => arg === "--in-place" || arg.startsWith("--in-place=") || /^-i/.test(arg));
    if (inPlace) {
        return withStep(base, {
            operation: "edit_in_place",
            effect: "write",
            targets,
            confidence: targets.length > 0 ? "high" : "medium",
            ...(lineRange ? {selectors: {lineRange}} : {}),
        });
    }
    return withStep(base, {
        operation: lineRange ? "read_range" : "read_file",
        effect: "read_only",
        targets,
        confidence: targets.length > 0 ? "high" : "medium",
        ...(lineRange ? {selectors: {lineRange}} : {}),
    });
}

export function analyzeSearch(base: CommandStep, args: readonly string[]): CommandStep {
    const pattern = args.find((arg) => !arg.startsWith("-"));
    const targetArgs = pattern ? args.slice(args.indexOf(pattern) + 1) : args;
    return withStep(base, {
        operation: "search",
        effect: "read_only",
        targets: pathTargets(targetArgs),
        confidence: "high",
        ...(pattern ? {selectors: {pattern}} : {}),
    });
}

export function analyzeFind(base: CommandStep, args: readonly string[]): CommandStep {
    const targets: CommandTarget[] = [];
    for (const arg of args) {
        if (arg.startsWith("-") || isFindExpressionValue(arg)) break;
        targets.push({type: targetTypeForPath(arg), value: arg});
    }
    const resolvedTargets = targets.length > 0 ? targets : [{type: "directory" as const, value: "."}];
    const action = findAction(args);
    if (action) {
        return withStep(base, {operation: action.operation, effect: action.effect, targets: resolvedTargets, confidence: "high"});
    }
    return withStep(base, {operation: "search", effect: "read_only", targets: resolvedTargets, confidence: "high"});
}

const FIND_EXEC_ACTIONS: ReadonlySet<string> = new Set(["-exec", "-execdir", "-ok", "-okdir"]);
const FIND_DESTRUCTIVE_EXEC: ReadonlySet<string> = new Set(["rm", "rmdir", "unlink"]);

/** find의 -delete와 -exec가 검색을 파괴적·쓰기 조작으로 바꾼다. */
function findAction(args: readonly string[]): {operation: string; effect: CommandEffect} | null {
    if (args.includes("-delete")) return {operation: "delete_file", effect: "destructive"};
    const execIndex = args.findIndex((arg) => FIND_EXEC_ACTIONS.has(arg));
    if (execIndex < 0) return null;
    const execCommand = args[execIndex + 1];
    if (execCommand !== undefined && FIND_DESTRUCTIVE_EXEC.has(execCommand)) {
        return {operation: "delete_file", effect: "destructive"};
    }
    return {operation: "execute", effect: "write"};
}

export function analyzeRipgrep(base: CommandStep, args: readonly string[]): CommandStep {
    const filesMode = args.includes("--files");
    const optionsWithValue = new Set(["-g", "--glob", "--type", "-t", "--type-not", "-T", "-e", "--regexp"]);
    const positional = stripOptionArguments(args, optionsWithValue).filter((arg) => !arg.startsWith("-"));
    if (filesMode) {
        return withStep(base, {
            operation: "list",
            effect: "read_only",
            targets: positional.length > 0 ? pathTargets(positional) : [{type: "directory", value: "."}],
            confidence: "high",
        });
    }
    const [pattern, ...targetArgs] = positional;
    return withStep(base, {
        operation: "search",
        effect: "read_only",
        targets: targetArgs.length > 0 ? pathTargets(targetArgs) : [],
        confidence: "high",
        ...(pattern ? {selectors: {pattern}} : {}),
    });
}

export function analyzeRead(base: CommandStep, args: readonly string[]): CommandStep {
    const targets = pathTargets(args);
    return withStep(base, {
        operation: "read_file",
        effect: "read_only",
        targets,
        confidence: targets.length > 0 ? "high" : "medium",
    });
}

export function analyzeList(base: CommandStep, args: readonly string[]): CommandStep {
    const targets = pathTargets(args);
    return withStep(base, {
        operation: "list",
        effect: "read_only",
        targets: targets.length > 0 ? targets : [{type: "directory", value: "."}],
        confidence: "high",
    });
}

export function analyzeStreamTransform(base: CommandStep, args: readonly string[]): CommandStep {
    const targets = pathTargets(args);
    return withStep(base, {
        operation: base.commandName === "sort" ? "sort_output" : "limit_output",
        effect: "read_only",
        targets: targets.length > 0 ? targets : [{type: "stream", value: "stdin"}],
        confidence: "medium",
    });
}

function extractSedLineRange(arg: string): string | undefined {
    const match = arg.match(/^(\d+)(?:,(\d+))?p$/);
    if (!match) return undefined;
    return match[2] ? `${match[1]},${match[2]}` : match[1];
}

function stripOptionArguments(
    args: readonly string[],
    optionsWithValue: ReadonlySet<string>,
): readonly string[] {
    const result: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? "";
        if (optionsWithValue.has(arg)) {
            index += 1;
            continue;
        }
        if ([...optionsWithValue].some((option) => arg.startsWith(`${option}=`))) continue;
        result.push(arg);
    }
    return result;
}

function isFindExpressionValue(arg: string): boolean {
    return arg === "!" || arg === "(" || arg === ")" || arg === "{}" || arg === ";";
}
