import {isTerminalCommand} from "@monitor/kernel/ingest/event.kind.const.js";
import {AGENT_TRACER_ATTR} from "@monitor/kernel/observability/semconv.const.js";
import type {RecentEvent} from "~runtime/domain/ingest/model/recent.event.model.js";
import type {PreprocessingHint} from "~runtime/domain/hint/model/hint.model.js";
import {isRecord} from "~runtime/support/json.js";

const COMMAND_LOOKBACK = 20;
const REPETITION_THRESHOLD = 3;
const RECENT_WINDOW_MS = 10 * 60 * 1000;
const PATH_BEARING_TARGETS: ReadonlySet<string> = new Set(["file", "directory", "path"]);
const SHORT_PATH_MAX = 50;

/** 같은 명령을 반복하거나 파괴적 명령이 이어지면 알린다. */
export function detectCommandRepetition(
    recent: readonly RecentEvent[],
    command: string,
    now: number,
): PreprocessingHint[] {
    const normalized = command.trim();
    if (!normalized) return [];

    const prior = recent.filter((event) => isTerminalCommand(event)).slice(-COMMAND_LOOKBACK);
    const hints: PreprocessingHint[] = [];
    const targetCounts = new Map<string, number>();
    let sameCommand = 0;
    let destructiveCount = 0;

    for (const event of prior) {
        const ageMs = now - Date.parse(event.occurredAt);
        if (!Number.isFinite(ageMs) || ageMs > RECENT_WINDOW_MS) continue;

        const priorCommand = event.metadata[AGENT_TRACER_ATTR.command];
        if (typeof priorCommand === "string" && priorCommand.trim() === normalized) sameCommand += 1;

        const analysis = event.metadata["commandAnalysis"];
        for (const target of extractCommandAnalysisPaths(analysis)) {
            targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
        }
        if (isRecord(analysis) && analysis["overallEffect"] === "destructive") destructiveCount += 1;
    }

    if (sameCommand >= REPETITION_THRESHOLD) {
        hints.push({
            type: "command_repetition",
            severity: "warning",
            title: "Identical command repeated",
            message: `You've run this exact command ${sameCommand} times in the last 10 min, so check the prior output before retrying.`,
        });
    }

    for (const [target, count] of targetCounts) {
        if (count < REPETITION_THRESHOLD || !normalized.includes(target)) continue;
        hints.push({
            type: "command_repetition",
            severity: "info",
            title: `Repeated reads of ${shortPath(target)}`,
            message: `${target} has been read ${count} times recently. Cache the content mentally or read a larger range once.`,
        });
        break;
    }

    if (isDestructiveCommand(normalized)) {
        hints.push(destructiveCount > 0
            ? {
                type: "destructive_risk",
                severity: "critical",
                title: "Destructive command in a destructive streak",
                message: "Recent commands include destructive operations. Double-check the target path before running this one.",
            }
            : {
                type: "destructive_risk",
                severity: "warning",
                title: "Destructive command incoming",
                message: "This command appears destructive. Confirm the target is correct and that the user authorized it.",
            });
    }

    return hints;
}

/** 명령 분석 결과에서 파일 시스템 대상 경로만 모은다. */
export function extractCommandAnalysisPaths(analysis: unknown): string[] {
    if (!isRecord(analysis) || !Array.isArray(analysis["steps"])) return [];
    const paths: string[] = [];
    for (const step of flattenSteps(analysis["steps"])) {
        const targets = Array.isArray(step["targets"]) ? step["targets"] : [];
        for (const target of targets) {
            const value = targetPath(target);
            if (value) paths.push(value);
        }
    }
    return paths;
}

function flattenSteps(values: readonly unknown[]): Record<string, unknown>[] {
    const flattened: Record<string, unknown>[] = [];
    for (const value of values) {
        if (!isRecord(value)) continue;
        flattened.push(value);
        if (Array.isArray(value["pipeline"])) flattened.push(...flattenSteps(value["pipeline"]));
    }
    return flattened;
}

function targetPath(target: unknown): string | undefined {
    if (!isRecord(target)) return undefined;
    if (typeof target["type"] !== "string" || !PATH_BEARING_TARGETS.has(target["type"])) return undefined;
    if (typeof target["value"] !== "string") return undefined;
    const value = target["value"].trim();
    return value ? value : undefined;
}

function isDestructiveCommand(command: string): boolean {
    return /\brm\s+-[rf]+\b|\brm\s+-r\b|\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-f\b|\bgit\s+push\s+--force\b|\bdrop\s+(table|database)\b/i.test(command);
}

function shortPath(target: string): string {
    return target.length <= SHORT_PATH_MAX ? target : `…${target.slice(-(SHORT_PATH_MAX - 3))}`;
}
