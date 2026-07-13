import { z } from "zod";
import { DAEMON_HEALTH_LAST_DEAD_REASONS_MAX, type DaemonHealthReportPayload } from "./daemon.health.const.js";

// 손으로 선언한 보고 타입에 맞춰 검증하므로 필드가 어긋나면 타입 오류로 드러난다.
export const daemonHealthReportSchema: z.ZodType<DaemonHealthReportPayload> = z.object({
    spoolBacklogBytes: z.number().int().nonnegative(),
    deadLetterCount: z.number().int().nonnegative(),
    lastDeadReasons: z.array(z.string().trim().min(1).max(200)).max(DAEMON_HEALTH_LAST_DEAD_REASONS_MAX),
    swallowedErrors: z.number().int().nonnegative(),
    daemonVersion: z.string().trim().min(1).max(32),
    retryStatusSince: z.number().int().nonnegative().nullable(),
}).strict();
