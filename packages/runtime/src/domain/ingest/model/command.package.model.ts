import type {
    CommandEffect,
    CommandStep,
    CommandTarget,
} from "~runtime/domain/ingest/model/command.analysis.model.js";
import {withStep} from "~runtime/domain/ingest/model/command.classifier.model.js";
import {runnerOperationFromArgs} from "~runtime/domain/ingest/model/command.runner.model.js";

/** npm·pnpm·yarn 호출을 워크스페이스와 스크립트로 풀어 조작 종류로 분류한다. */
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
    const name = (scriptName ?? "").toLowerCase();
    if (name.includes("test")) return "run_test";
    if (name.includes("lint") || name.includes("format")) return "run_lint";
    if (name.includes("build")) return "run_build";
    const runnerOperation = runnerOperationFromArgs(args);
    if (runnerOperation) return runnerOperation;
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
