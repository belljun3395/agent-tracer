import {
    Inject,
    Injectable,
    Logger,
    type OnApplicationShutdown,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { CLOCK_PORT } from "../../application/task/outbound/tokens.js";
import type { IClock } from "../../application/task/outbound/clock.port.js";
import type { TaskStatus } from "../../domain/task/task.status.const.js";
import { SessionRepository } from "../../repository/session/session.repository.js";
import { TaskRepository } from "../../repository/task/task.repository.js";
import { TaskLifecycleService } from "../../service/task/task.lifecycle.service.js";

const POLL_INTERVAL_MS = 60_000;
const STALE_TTL_MS = 30 * 60_000;
const BATCH_SIZE = 32;

// waiting은 사용자 입력 대기 상태이므로 자동 회수 대상에서 제외한다.
const REAPABLE_STATUSES: readonly TaskStatus[] = ["running"];

@Injectable()
export class StaleTaskReaperJob implements OnApplicationShutdown {
    private readonly logger = new Logger(StaleTaskReaperJob.name);
    private running = false;
    private shuttingDown = false;

    constructor(
        private readonly tasks: TaskRepository,
        private readonly lifecycle: TaskLifecycleService,
        private readonly sessions: SessionRepository,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    // 종료 중에는 진행 중인 tick이 끝나도록 짧게 기다린다.
    async onApplicationShutdown(): Promise<void> {
        this.shuttingDown = true;
        const start = Date.now();
        while (this.running && Date.now() - start < 2000) {
            await new Promise((r) => setTimeout(r, 25));
        }
    }

    @Interval("stale-task-reaper", POLL_INTERVAL_MS)
    async tick(): Promise<void> {
        // 워커 프로세스에서는 리퍼를 돌리지 않는다.
        if (process.env["MONITOR_ROLE"] === "worker") return;
        if (this.running || this.shuttingDown) return;
        this.running = true;
        try {
            const thresholdIso = new Date(this.clock.nowMs() - STALE_TTL_MS).toISOString();
            const candidates = await this.tasks.findByStatusesUpdatedBefore(REAPABLE_STATUSES, thresholdIso, BATCH_SIZE);
            for (const task of candidates) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- onApplicationShutdown에서 변경된다.
                if (this.shuttingDown) break;
                const active = await this.sessions.countRunningByTaskId(task.id);
                if (active > 0) continue;
                // 활성 세션 없이 오래된 running 태스크는 런타임이 사라진 것으로 보고 완료 처리한다.
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
