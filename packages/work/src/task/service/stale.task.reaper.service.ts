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
import type { TaskStatus } from "../common/task.status.const.js";
import { TaskRepository } from "../repository/task.repository.js";
import { TaskLifecycleService } from "./task.lifecycle.service.js";

const POLL_INTERVAL_MS = 60_000;
const STALE_TTL_MS = 30 * 60_000;
const BATCH_SIZE = 32;

// 회수(reap) 대상 상태 정책. `waiting`은 정상 정지 상태라 일부러 제외한다.
// 리포지토리가 아니라 도메인 정책으로 여기서 소유한다.
const REAPABLE_STATUSES: readonly TaskStatus[] = ["running"];

/**
 * 활성 세션 없이 `running`에 갇힌 태스크를 종료 처리한다. 런타임이 강제 종료
 * (SIGKILL, OS 크래시, 네트워크 끊김)되어 SessionEnd 훅이 발화하지 못한 경우를
 * 다룬다 — 없으면 그런 태스크가 사이드바에 영영 "running"으로 남는다.
 *
 * 안전장치: `updated_at`이 STALE_TTL_MS보다 오래됐고 동시에 countRunningByTaskId가
 * 0일 때만 동작한다. TTL은 태스크 생성 직후 첫 세션 행이 커밋되기 전 짧은 구간에서
 * 발생할 오탐을 막는다.
 *
 * `waiting` 태스크는 일부러 회수하지 않는다 — 사용자 입력 대기라는 정상 상태라
 * 정리하면 사용자가 놀란다.
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

    // ScheduleModule은 종료 시 인터벌을 정리하지만 진행 중인 tick을 기다리지는
    // 않는다 — 그래서 여기서 shuttingDown을 켜고 running이 끝나길 드레인한다.
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
