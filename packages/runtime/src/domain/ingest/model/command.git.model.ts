import type {CommandStep} from "~runtime/domain/ingest/model/command.analysis.model.js";
import {withStep} from "~runtime/domain/ingest/model/command.classifier.model.js";
import {gitPathspecTargets} from "~runtime/domain/ingest/model/command.target.model.js";

/** git 서브커맨드를 조작 종류와 효과로 분류한다. */
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
