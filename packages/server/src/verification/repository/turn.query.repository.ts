import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
    BackfillTurnRow,
    ITurnQueryRepository,
    TaskTurnSummaryRow,
} from "~application/ports/repository/turn.query.repository.js";
import type { VerdictStatus } from "~verification/domain/model/verdict.model.js";
import { TurnEntity } from "../domain/turn.entity.js";
import { VerdictEntity } from "../domain/verdict.entity.js";

@Injectable()
export class TurnQueryRepository implements ITurnQueryRepository {
    constructor(
        @InjectRepository(TurnEntity)
        private readonly turns: Repository<TurnEntity>,
        @InjectRepository(VerdictEntity)
        private readonly verdicts: Repository<VerdictEntity>,
    ) {}

    async listAllTurnsForBackfill(): Promise<ReadonlyArray<BackfillTurnRow>> {
        const rows = await this.turns.find();
        return rows.map(mapBackfill);
    }

    async listTurnsForTaskBackfill(taskId: string): Promise<ReadonlyArray<BackfillTurnRow>> {
        const rows = await this.turns.find({ where: { taskId } });
        return rows.map(mapBackfill);
    }

    async listVerdictStatusesForTask(taskId: string): Promise<readonly VerdictStatus[]> {
        const rows = await this.verdicts
            .createQueryBuilder("v")
            .innerJoin(TurnEntity, "t", "t.id = v.turn_id")
            .where("t.task_id = :taskId", { taskId })
            .select("v.status", "status")
            .getRawMany<{ status: VerdictStatus }>();
        return rows.map((row) => row.status);
    }

    async listTurnSummariesForTask(taskId: string): Promise<ReadonlyArray<TaskTurnSummaryRow>> {
        const rows = await this.turns.find({
            where: { taskId },
            order: { startedAt: "ASC", turnIndex: "ASC" },
        });
        return rows.map((row) => ({
            id: row.id,
            sessionId: row.sessionId,
            taskId: row.taskId,
            turnIndex: row.turnIndex,
            status: row.status,
            startedAt: row.startedAt,
            endedAt: row.endedAt,
            aggregateVerdict: row.aggregateVerdict,
            rulesEvaluatedCount: row.rulesEvaluatedCount,
        }));
    }
}

function mapBackfill(row: TurnEntity): BackfillTurnRow {
    return {
        id: row.id,
        sessionId: row.sessionId,
        taskId: row.taskId,
        status: row.status,
        assistantText: row.assistantText ?? "",
        userMessageText: row.askedText ?? "",
    };
}
