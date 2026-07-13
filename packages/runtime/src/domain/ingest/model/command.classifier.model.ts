import type {
    CommandEffect,
    CommandRedirect,
    CommandSequencePart,
    CommandStep,
    CommandTarget,
} from "~runtime/domain/ingest/model/command.analysis.model.js";
import {
    containsComplexShell,
    gitPathspecTargets,
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
    return withStep(base, {
        operation: lineRange ? "read_range" : "read_file",
        effect: "read_only",
        targets,
        confidence: targets.length > 0 ? "high" : "medium",
        ...(lineRange ? {selectors: {lineRange}} : {}),
    });
}

export function analyzeGit(base: CommandStep, args: readonly string[]): CommandStep {
    const subcommand = args[0];
    if (!subcommand) return withStep(base, {operation: "unknown", effect: "unknown", confidence: "medium"});

    if (["status", "log", "show"].includes(subcommand)) {
        return withStep(base, {
            subcommand,
            operation: subcommand === "status" ? "inspect_status" : "inspect_history",
            effect: "read_only",
            targets: gitPathspecTargets(args.slice(1)),
            confidence: "high",
        });
    }
    if (subcommand === "diff") {
        return withStep(base, {
            subcommand,
            operation: "inspect_diff",
            effect: "read_only",
            targets: gitPathspecTargets(args.slice(1)),
            confidence: "high",
        });
    }
    if (["add", "commit", "restore", "checkout", "switch", "merge", "rebase", "reset"].includes(subcommand)) {
        return withStep(base, {
            subcommand,
            operation: "vcs_write",
            effect: subcommand === "reset" ? "destructive" : "write",
            targets: gitPathspecTargets(args.slice(1)),
            confidence: "high",
        });
    }
    if (["push", "pull", "fetch", "clone"].includes(subcommand)) {
        return withStep(base, {
            subcommand,
            operation: subcommand === "push" ? "publish" : "fetch_repo",
            effect: subcommand === "push" ? "network" : "read_only",
            targets: [],
            confidence: "high",
        });
    }
    return withStep(base, {subcommand, operation: "git_command", effect: "unknown", confidence: "medium"});
}

export function analyzePackageManager(base: CommandStep, args: readonly string[]): CommandStep {
    const workspace = extractWorkspace(args);
    const scriptName = extractScriptName(base.commandName, args);
    const operation = scriptOperation(scriptName, args);
    const effect = packageManagerEffect(operation, args);
    const targets: CommandTarget[] = workspace ? [{type: "workspace", value: workspace}] : [];
    return withStep(base, {
        operation,
        effect,
        targets,
        confidence: operation === "run_command" ? "medium" : "high",
        ...(workspace ? {workspace} : {}),
        ...(scriptName ? {scriptName} : {}),
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
    return withStep(base, {
        operation: "search",
        effect: "read_only",
        targets: targets.length > 0 ? targets : [{type: "directory", value: "."}],
        confidence: "high",
    });
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

function extractWorkspace(args: readonly string[]): string | undefined {
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? "";
        if (arg === "--workspace" || arg === "-w") return args[index + 1];
        const equalsMatch = arg.match(/^--workspace=(.+)$/);
        if (equalsMatch) return equalsMatch[1];
    }
    return undefined;
}

function extractScriptName(commandName: string, args: readonly string[]): string | undefined {
    const filtered = stripPackageManagerOptions(args);
    if (commandName === "yarn" && filtered[0] && filtered[0] !== "run") return filtered[0];
    if (filtered[0] === "run" || filtered[0] === "run-script") return filtered[1];
    return filtered[0];
}

function scriptOperation(scriptName: string | undefined, args: readonly string[]): string {
    const normalizedArgs = args.join(" ").toLowerCase();
    const name = (scriptName ?? "").toLowerCase();
    if (name.includes("test") || normalizedArgs.includes("vitest") || normalizedArgs.includes("jest")) return "run_test";
    if (name.includes("lint") || name.includes("format") || normalizedArgs.includes("eslint")) return "run_lint";
    if (name.includes("build") || normalizedArgs.includes("tsc")) return "run_build";
    if (["install", "add", "i"].includes(name)) return "install_dependency";
    if (name === "publish") return "publish";
    return "run_command";
}

function packageManagerEffect(operation: string, args: readonly string[]): CommandEffect {
    if (operation === "install_dependency" || operation === "publish") return "network";
    if (["run_test", "run_lint", "run_build"].includes(operation)) return "execute_check";
    if (args.some((arg) => arg === "install" || arg === "add" || arg === "i")) return "network";
    return "unknown";
}

function stripPackageManagerOptions(args: readonly string[]): readonly string[] {
    const result: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index] ?? "";
        if (arg === "--workspace" || arg === "-w" || arg === "--prefix") {
            index += 1;
            continue;
        }
        if (arg.startsWith("--workspace=") || arg.startsWith("--prefix=")) continue;
        if (arg.startsWith("-")) continue;
        result.push(arg);
    }
    return result;
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
