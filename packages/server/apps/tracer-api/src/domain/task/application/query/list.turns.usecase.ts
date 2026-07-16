import { Inject, Injectable } from "@nestjs/common";
import type { TurnDto, TurnVerdictDto } from "@monitor/kernel";
import { TASK_REPOSITORY, type TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";
import { TURN_READER, type TurnReaderPort } from "~tracer-api/domain/task/port/turn.reader.port.js";
import { VERDICT_READER, type VerdictReaderPort } from "~tracer-api/domain/task/port/verdict.reader.port.js";

export type { TurnDto, TurnVerdictDto };

@Injectable()
export class ListTurnsUseCase {
    constructor(
        @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepositoryPort,
        @Inject(TURN_READER) private readonly turns: TurnReaderPort,
        @Inject(VERDICT_READER) private readonly verdicts: VerdictReaderPort,
    ) {}

    async execute(userId: string, taskId: string): Promise<{ readonly items: readonly TurnDto[] } | null> {
        const task = await this.tasks.findById(taskId);
        // 남의 작업은 존재 여부도 드러내지 않는다.
        if (task === null || !task.isOwnedBy(userId)) return null;
        const turns = await this.turns.findByTask(taskId);
        const verdicts = await this.verdicts.findByTurns(turns.map((turn) => turn.id));
        const verdictsByTurn = new Map<string, TurnVerdictDto[]>();
        for (const verdict of verdicts) {
            const bucket = verdictsByTurn.get(verdict.turnId);
            const dto = { ruleId: verdict.ruleId, status: verdict.status };
            if (bucket === undefined) verdictsByTurn.set(verdict.turnId, [dto]);
            else bucket.push(dto);
        }
        const items: TurnDto[] = turns.map((turn) => ({
            id: turn.id,
            taskId: turn.taskId,
            sessionId: turn.sessionId,
            turnIndex: turn.turnIndex,
            status: turn.status,
            startedAt: turn.startedAt.toISOString(),
            endedAt: turn.endedAt !== null ? turn.endedAt.toISOString() : null,
            askedText: turn.askedText,
            assistantText: turn.assistantText,
            aggregateVerdict: turn.aggregateVerdict,
            rulesEvaluatedCount: turn.rulesEvaluatedCount,
            verdicts: verdictsByTurn.get(turn.id) ?? [],
        }));
        return { items };
    }
}
