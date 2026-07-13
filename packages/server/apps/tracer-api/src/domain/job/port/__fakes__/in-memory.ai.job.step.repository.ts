import type { AiJobStepEntity } from "@monitor/tracer-domain";
import type { AiJobStepRepositoryPort } from "~tracer-api/domain/job/port/ai.job.step.repository.port.js";

/** 잡 스텝 저장소 포트의 인메모리 대역이다. */
export class InMemoryAiJobStepRepository implements AiJobStepRepositoryPort {
    private readonly rows: AiJobStepEntity[] = [];

    seed(...steps: readonly AiJobStepEntity[]): void {
        this.rows.push(...steps);
    }

    all(): readonly AiJobStepEntity[] {
        return [...this.rows];
    }

    findByJobId(jobId: string, userId: string): Promise<AiJobStepEntity[]> {
        return Promise.resolve(
            this.rows
                .filter((step) => step.jobId === jobId && step.userId === userId)
                .sort((left, right) => left.attempt - right.attempt || left.seq - right.seq),
        );
    }
}
