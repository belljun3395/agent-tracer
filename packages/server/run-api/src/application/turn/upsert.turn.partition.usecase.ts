import { Inject, Injectable } from "@nestjs/common";
import { TaskAccessPublicAdapter } from "../../adapter/task/task.access.public.adapter.js";
import { Transactional } from "typeorm-transactional";
import { countNonPreludeTurns, createTurnPartitionUpdate, validatePartition } from "../../domain/turn/turn.partition.policy.js";
import { TurnPartitionRepository } from "../../repository/turn/turn.partition.repository.js";
import { CLOCK_PORT } from "./outbound/tokens.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/public/event/tokens.js";
import type { IClock } from "./outbound/clock.port.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/event/iservice/timeline.event.read.iservice.js";
import type {
    UpsertTurnPartitionUseCaseIn,
    UpsertTurnPartitionUseCaseOut,
} from "./dto/upsert.turn.partition.usecase.dto.js";
import { TaskNotFoundError, TurnPartitionVersionMismatchError } from "../../domain/turn/turn.partition.errors.js";

@Injectable()
export class UpsertTurnPartitionUseCase {
    constructor(
        private readonly tasks: TaskAccessPublicAdapter,
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
