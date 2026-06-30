import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { countNonPreludeTurns, createTurnPartitionUpdate, validatePartition } from "../domain/turn.partition.policy.js";
import { TurnPartitionRepository } from "../repository/turn.partition.repository.js";
import { CLOCK_PORT } from "./outbound/tokens.js";
import { TASK_ACCESS } from "@monitor/run-api/task/public/tokens.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/event/public/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { ITaskAccess } from "@monitor/run-api/task/public/iservice/task.access.iservice.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/event/public/iservice/timeline.event.read.iservice.js";
import type {
    UpsertTurnPartitionUseCaseIn,
    UpsertTurnPartitionUseCaseOut,
} from "./dto/upsert.turn.partition.usecase.dto.js";
import { TaskNotFoundError, TurnPartitionVersionMismatchError } from "../common/turn.partition.errors.js";

@Injectable()
export class UpsertTurnPartitionUseCase {
    constructor(
        @Inject(TASK_ACCESS) private readonly tasks: ITaskAccess,
        @Inject(TIMELINE_EVENT_READ) private readonly events: ITimelineEventRead,
        private readonly turnPartitions: TurnPartitionRepository,
        @Inject(CLOCK_PORT) private readonly clock: IClock,
    ) {}

    @Transactional()
    async execute(input: UpsertTurnPartitionUseCaseIn): Promise<UpsertTurnPartitionUseCaseOut> {
        const task = await this.tasks.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);

        const events = await this.events.findByTaskId(input.taskId);
        const totalTurns = countNonPreludeTurns(events);

        const existing = await this.turnPartitions.get(input.taskId);
        if (
            typeof input.baseVersion === "number"
            && existing !== null
            && existing.version !== input.baseVersion
        ) {
            // 클라이언트가 본 버전과 저장 버전이 다르면 덮어쓰기를 막는다.
            throw new TurnPartitionVersionMismatchError(input.baseVersion, existing.version);
        }

        const updatedAt = this.clock.nowIso();
        const partition = createTurnPartitionUpdate({
            taskId: input.taskId,
            groups: input.groups,
            existing,
            updatedAt,
        });
        validatePartition(partition, totalTurns);
        await this.turnPartitions.upsert(partition);
        return partition;
    }
}
