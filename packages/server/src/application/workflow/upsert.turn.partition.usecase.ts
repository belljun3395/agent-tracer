import type { IEventRepository, ITaskRepository, ITurnPartitionRepository } from "~application/ports/index.js";
import type { TurnGroup, TurnPartition } from "~domain/workflow/turn.partition.js";
import { countNonPreludeTurns, validatePartition } from "~domain/workflow/turn.partition.js";
import { TaskNotFoundError, TurnPartitionVersionMismatchError } from "./workflow.errors.js";

export interface UpsertTurnPartitionInput {
    readonly groups: readonly TurnGroup[];
    readonly baseVersion?: number;
}

export class UpsertTurnPartitionUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly turnPartitionRepo: ITurnPartitionRepository,
    ) {}

    async execute(taskId: string, input: UpsertTurnPartitionInput): Promise<TurnPartition> {
        const task = await this.taskRepo.findById(taskId);
        if (!task) throw new TaskNotFoundError(taskId);

        const events = await this.eventRepo.findByTaskId(taskId);
        const totalTurns = countNonPreludeTurns(events);

        const existing = await this.turnPartitionRepo.get(taskId);
        if (
            typeof input.baseVersion === "number" &&
            existing !== null &&
            existing.version !== input.baseVersion
        ) {
            throw new TurnPartitionVersionMismatchError(input.baseVersion, existing.version);
        }

        const nextVersion = (existing?.version ?? 0) + 1;
        const updatedAt = new Date().toISOString();
        const partition: TurnPartition = {
            taskId,
            groups: input.groups.map((g) => ({
                id: g.id,
                from: g.from,
                to: g.to,
                label: g.label === null ? null : (g.label.trim() || null),
                visible: g.visible,
            })),
            version: nextVersion,
            updatedAt,
        };
        validatePartition(partition, totalTurns);
        await this.turnPartitionRepo.upsert(partition);
        return partition;
    }
}
