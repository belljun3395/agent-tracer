import { aiJobStepCarriesContent, type AiJobStepPayload } from "@monitor/kernel";
import { generateUlid } from "@monitor/platform";
import { AiJobStepEntity } from "@monitor/tracer-domain";
import type { AiJobStepWriterPort } from "~tracer-api/domain/job/port/ai.job.step.repository.port.js";

// 로컬 실행기는 재시도 없이 한 번만 돌므로 이 경로로 들어온 궤적의 시도 번호는 언제나 하나다.
const LOCAL_ATTEMPT = 1;

export interface PersistJobStepsInput {
    readonly jobId: string;
    readonly userId: string;
    readonly steps: readonly AiJobStepPayload[];
    readonly now: Date;
}

/** 저장할 내용이 있는 궤적 스텝에만 식별자를 부여해 원장에 적는다. */
export async function persistJobSteps(
    repo: AiJobStepWriterPort,
    input: PersistJobStepsInput,
): Promise<void> {
    const entities = input.steps
        .filter((step) => aiJobStepCarriesContent(step))
        .map((step) =>
            AiJobStepEntity.create({
                id: generateUlid(input.now.getTime()),
                jobId: input.jobId,
                userId: input.userId,
                attempt: LOCAL_ATTEMPT,
                step,
                now: input.now,
            }),
        );
    if (entities.length === 0) return;
    await repo.insertMany(entities);
}
