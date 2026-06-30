import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TimelineEventEntity } from "@monitor/timeline-api/domain/event/timeline.event.entity.js";

@Injectable()
export class PreprocessingHintsRepository {
    constructor(
        @InjectRepository(TimelineEventEntity)
        private readonly repo: Repository<TimelineEventEntity>,
    ) {}

    async findLatestContextSnapshot(taskId: string): Promise<TimelineEventEntity | null> {
        return this.repo.findOne({
            where: { taskId, kind: "context.snapshot" },
            order: { createdAt: "DESC" },
        });
    }

    async findRecentQuestions(taskId: string, limit: number): Promise<TimelineEventEntity[]> {
        return this.repo.find({
            where: { taskId, kind: "question.logged" },
            order: { createdAt: "DESC" },
            take: limit,
        });
    }

    async findRecentTerminalCommands(taskId: string, limit: number): Promise<TimelineEventEntity[]> {
        return this.repo.find({
            where: { taskId, kind: "terminal.command" },
            order: { createdAt: "DESC" },
            take: limit,
        });
    }
}
