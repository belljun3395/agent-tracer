import {
    Inject,
    Injectable,
    Logger,
    type OnApplicationShutdown,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { CLOCK_PORT, SESSION_ACCESS_PORT } from "../application/outbound/tokens.js";
import type { IClock } from "../application/outbound/clock.port.js";
import type { ISessionAccess } from "../application/outbound/session.access.port.js";
import type { TaskStatus } from "../common/task.status.type.js";
import { TaskRepository } from "../repository/task.repository.js";
import { TaskLifecycleService } from "./task.lifecycle.service.js";

const POLL_INTERVAL_MS = 60_000;
const STALE_TTL_MS = 30 * 60_000;
const BATCH_SIZE = 32;

// Domain policy: which statuses are reap-eligible. `waiting` is intentionally
// excluded (a valid steady state). Owned here, not baked into the repository.
const REAPABLE_STATUSES: readonly TaskStatus[] = ["running"];

/**
 * Finalizes tasks stuck in `running` with no active session. Covers cases
 * where the runtime was force-killed (SIGKILL, OS crash, network drop) and
 * the SessionEnd hook never fired — without this, those tasks would stay
 * "running" forever in the sidebar.
 *
 * Safety: only acts when `updated_at` is older than {@link STALE_TTL_MS}
 * AND `countRunningByTaskId` returns 0. The TTL gates against false positives
 * during the brief window between task creation and the first session row
 * being committed.
 *
 * `waiting` tasks are intentionally not reaped — they are a valid steady
 * state (waiting on user input) and would surprise the user if cleaned up.
 */
@Injectable()
export class StaleTaskReaperService implements OnApplicationShutdown {
    private readonly logger = new Logger(StaleTaskReaperService.name);
    private running = false;
    private shuttingDown = false;

    constructor(
        private readonly tasks: TaskRepository,
        private readonly lifecycle: TaskLifecycleService,
        @Inject(SESSION_ACCESS_PORT) private readonly sessions: ISessionAccess,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    // ScheduleModule clears this interval on shutdown, but it does not await an
    // in-flight tick — so we still flip `shuttingDown` and drain `running` here.
    async onApplicationShutdown(): Promise<void> {
        this.shuttingDown = true;
        const start = Date.now();
        while (this.running && Date.now() - start < 2000) {
            await new Promise((r) => setTimeout(r, 25));
        }
    }

    @Interval("stale-task-reaper", POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        if (this.running || this.shuttingDown) return;
        this.running = true;
        try {
            const thresholdIso = new Date(this.clock.nowMs() - STALE_TTL_MS).toISOString();
            const candidates = await this.tasks.findByStatusesUpdatedBefore(REAPABLE_STATUSES, thresholdIso, BATCH_SIZE);
            for (const task of candidates) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by onApplicationShutdown
                if (this.shuttingDown) break;
                const active = await this.sessions.countRunningByTaskId(task.id);
                if (active > 0) continue;
                await this.lifecycle.finalizeTask({
                    taskId: task.id,
                    summary: "Reaped — runtime terminated without notice",
                    outcome: "completed",
                });
                this.logger.warn(`reaped stale running task ${task.id} (updated_at=${task.updatedAt})`);
            }
        }
        catch (err) {
            this.logger.error("reaper tick failed", err instanceof Error ? err.stack : String(err));
        }
        finally {
            this.running = false;
        }
    }
}
