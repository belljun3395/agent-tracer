import {
    Injectable,
    Logger,
    type OnApplicationShutdown,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { AdaptivePoll } from "~main/scheduling/adaptive-poll.js";
import { RecipeScanJobRepository } from "../repository/recipe.scan.job.repository.js";
import { RecipeScanService } from "./recipe.scan.service.js";

const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 5000;
const IDLE_TICKS_BEFORE_BACKOFF = 10;
const BATCH_SIZE = 1;

/**
 * Polls `recipe_scan_jobs` for pending rows and dispatches them. Batch=1 —
 * each scan touches every selected task, so running two in parallel just
 * wastes API calls. Mirrors task-cleanup worker.
 */
@Injectable()
export class RecipeScanWorker implements OnApplicationShutdown {
    private readonly logger = new Logger(RecipeScanWorker.name);
    private running = false;
    private shuttingDown = false;
    private readonly poll = new AdaptivePoll(
        MIN_POLL_INTERVAL_MS,
        MAX_POLL_INTERVAL_MS,
        IDLE_TICKS_BEFORE_BACKOFF,
    );

    constructor(
        private readonly jobs: RecipeScanJobRepository,
        private readonly service: RecipeScanService,
    ) {}

    // ScheduleModule clears this interval on shutdown, but it does not await an
    // in-flight tick — so we still flip `shuttingDown` and drain `running` here.
    async onApplicationShutdown(): Promise<void> {
        this.shuttingDown = true;
        const start = Date.now();
        while (this.running && Date.now() - start < 30_000) {
            await new Promise((r) => setTimeout(r, 100));
        }
    }

    @Interval("recipe-scan-worker", MIN_POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        if (this.running || this.shuttingDown) return;
        if (!this.poll.due(Date.now())) return;
        this.running = true;
        try {
            const pending = await this.jobs.findPending(BATCH_SIZE);
            if (pending.length === 0) {
                this.poll.onIdle(Date.now());
                return;
            }
            this.poll.onWork();
            for (const job of pending) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated by onApplicationShutdown
                if (this.shuttingDown) break;
                const claimed = await this.jobs.claim(
                    job.id,
                    new Date().toISOString(),
                );
                if (!claimed) continue;
                this.logger.log(`Starting recipe scan: jobId=${claimed.id}`);
                await this.service.execute(claimed);
            }
        } catch (err) {
            this.logger.warn(
                `Worker tick failed: ${err instanceof Error ? err.message : String(err)}`,
            );
        } finally {
            this.running = false;
        }
    }
}
