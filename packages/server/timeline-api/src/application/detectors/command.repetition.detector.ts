import { Injectable } from "@nestjs/common";
import { PreprocessingHintsRepository } from "@monitor/timeline-api/repository/preprocessing.hints.repository.js";
import { extractCommandAnalysisPaths } from "@monitor/timeline-api/domain/command.analysis.policy.js";
import type { PreprocessingHint } from "../dto/preprocessing.hints.dto.js";

const COMMAND_LOOKBACK = 20;
const REPETITION_THRESHOLD = 3;
const RECENT_WINDOW_MS = 10 * 60 * 1000;

interface CommandAnalysisLike {
    readonly steps?: unknown;
    readonly overallEffect?: unknown;
}

@Injectable()
export class CommandRepetitionDetector {
    constructor(private readonly repo: PreprocessingHintsRepository) {}

    async detect(taskId: string, command: string): Promise<readonly PreprocessingHint[]> {
        const normalized = command.trim();
        if (!normalized) return [];

        const recent = await this.repo.findRecentTerminalCommands(taskId, COMMAND_LOOKBACK);
        const now = Date.now();
        const hints: PreprocessingHint[] = [];

        let sameCommand = 0;
        const targetCounts = new Map<string, number>();
        let destructiveCount = 0;

        for (const event of recent) {
            const ageMs = now - Date.parse(event.createdAt);
            if (!Number.isFinite(ageMs) || ageMs > RECENT_WINDOW_MS) continue;
            const extras = parseExtras(event.extrasJson);
            if (!extras) continue;

            const priorCommand = typeof extras["command"] === "string" ? extras["command"] : "";
            if (priorCommand.trim() === normalized) sameCommand += 1;

            const analysis = extras["commandAnalysis"];
            const targets = extractCommandAnalysisPaths(analysis);
            for (const target of targets) {
                targetCounts.set(target, (targetCounts.get(target) ?? 0) + 1);
            }

            const overall = (analysis as CommandAnalysisLike | undefined)?.overallEffect;
            if (overall === "destructive") destructiveCount += 1;
        }

        if (sameCommand >= REPETITION_THRESHOLD) {
            hints.push({
                type: "command_repetition",
                severity: "warning",
                title: "Identical command repeated",
                message: `You've run this exact command ${sameCommand} times in the last 10 min — check the prior output before retrying.`,
            });
        }

        for (const [target, count] of targetCounts) {
            if (count >= REPETITION_THRESHOLD && !containsTarget(normalized, target)) continue;
            if (count >= REPETITION_THRESHOLD) {
                hints.push({
                    type: "command_repetition",
                    severity: "info",
                    title: `Repeated reads of ${shortPath(target)}`,
                    message: `${target} has been read ${count} times recently. Cache the content mentally or read a larger range once.`,
                });
                break;
            }
        }

        if (destructiveCount > 0 && isDestructiveCommand(normalized)) {
            hints.push({
                type: "destructive_risk",
                severity: "critical",
                title: "Destructive command in a destructive streak",
                message: `Recent commands include destructive operations (rm/reset/etc.). Double-check the target path before running this one.`,
            });
        } else if (isDestructiveCommand(normalized)) {
            hints.push({
                type: "destructive_risk",
                severity: "warning",
                title: "Destructive command incoming",
                message: `This command appears destructive (rm/reset/--force). Confirm the target is correct and that the user authorized it.`,
            });
        }

        return hints;
    }
}

function parseExtras(json: string | null | undefined): Record<string, unknown> | null {
    if (!json) return null;
    try {
        const parsed: unknown = JSON.parse(json);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsTarget(command: string, target: string): boolean {
    return command.includes(target);
}

function isDestructiveCommand(command: string): boolean {
    return /\brm\s+-[rf]+\b|\brm\s+-r\b|\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-f\b|\bgit\s+push\s+--force\b|\bdrop\s+(table|database)\b|\b>\s*\/dev\/null\s*&&\s*rm\b/i.test(command);
}

function shortPath(target: string): string {
    if (target.length <= 50) return target;
    return `…${target.slice(-47)}`;
}
