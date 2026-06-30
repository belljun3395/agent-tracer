import { Injectable } from "@nestjs/common";
import { PreprocessingHintsRepository } from "@monitor/timeline-api/repository/preprocessing.hints.repository.js";
import { parseJsonRecord } from "@monitor/timeline-api/domain/event.json.policy.js";
import type { PreprocessingHint } from "../dto/preprocessing.hints.dto.js";

const USED_PCT_WARNING = 80;
const USED_PCT_CRITICAL = 95;
const RATE_LIMIT_WARNING = 85;
const SNAPSHOT_FRESHNESS_MS = 10 * 60 * 1000;

@Injectable()
export class ContextPressureDetector {
    constructor(private readonly repo: PreprocessingHintsRepository) {}

    async detect(taskId: string): Promise<readonly PreprocessingHint[]> {
        const snapshot = await this.repo.findLatestContextSnapshot(taskId);
        if (!snapshot?.extrasJson) return [];
        const ageMs = Date.now() - Date.parse(snapshot.createdAt);
        if (Number.isFinite(ageMs) && ageMs > SNAPSHOT_FRESHNESS_MS) return [];

        const extras = parseJsonRecord(snapshot.extrasJson);

        const hints: PreprocessingHint[] = [];
        const usedPct = readNumber(extras, "contextWindowUsedPct");
        if (usedPct != null) {
            if (usedPct >= USED_PCT_CRITICAL) {
                hints.push({
                    type: "context_pressure",
                    severity: "critical",
                    title: `Context window ${Math.round(usedPct)}% used`,
                    message: `Context window is near full (${Math.round(usedPct)}%). Compaction is imminent — keep this turn short and avoid pasting large outputs.`,
                });
            } else if (usedPct >= USED_PCT_WARNING) {
                hints.push({
                    type: "context_pressure",
                    severity: "warning",
                    title: `Context window ${Math.round(usedPct)}% used`,
                    message: `Context window is ${Math.round(usedPct)}% used. Prefer concise responses and avoid re-reading files you've already inspected.`,
                });
            }
        }

        const fiveHourPct = readNumber(extras, "rateLimitFiveHourUsedPct");
        if (fiveHourPct != null && fiveHourPct >= RATE_LIMIT_WARNING) {
            hints.push({
                type: "context_pressure",
                severity: fiveHourPct >= 95 ? "critical" : "warning",
                title: `5-hour rate limit ${Math.round(fiveHourPct)}% used`,
                message: `5-hour rate window is ${Math.round(fiveHourPct)}% consumed. Heavy tool use this turn may exhaust the quota.`,
            });
        }

        return hints;
    }
}

function readNumber(metadata: Record<string, unknown>, key: string): number | undefined {
    const value = metadata[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
