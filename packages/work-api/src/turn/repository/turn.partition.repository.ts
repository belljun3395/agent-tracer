import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { TurnGroup, TurnPartition } from "../domain/turn.partition.model.js";
import { TurnPartitionEntity } from "../domain/turn.partition.entity.js";

@Injectable()
export class TurnPartitionRepository {
    constructor(
        @InjectRepository(TurnPartitionEntity)
        private readonly repo: Repository<TurnPartitionEntity>,
    ) {}

    async get(taskId: string): Promise<TurnPartition | null> {
        const row = await this.repo.findOne({ where: { taskId } });
        return row ? mapRow(row) : null;
    }

    async upsert(partition: TurnPartition): Promise<void> {
        const entity = new TurnPartitionEntity();
        entity.taskId = partition.taskId;
        entity.groupsJson = JSON.stringify(partition.groups);
        entity.version = partition.version;
        entity.updatedAt = partition.updatedAt;
        await this.repo.save(entity);
    }

    async delete(taskId: string): Promise<boolean> {
        const result = await this.repo.delete({ taskId });
        return Boolean(result.affected && result.affected > 0);
    }
}

function mapRow(row: TurnPartitionEntity): TurnPartition {
    return {
        taskId: row.taskId,
        groups: parseGroups(row.groupsJson),
        version: row.version,
        updatedAt: row.updatedAt,
    };
}

function parseGroups(raw: string): readonly TurnGroup[] {
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isTurnGroup);
    }
    catch {
        return [];
    }
}

function isTurnGroup(value: unknown): value is TurnGroup {
    if (!value || typeof value !== "object") return false;
    const g = value as Record<string, unknown>;
    return (
        typeof g["id"] === "string"
        && typeof g["from"] === "number"
        && typeof g["to"] === "number"
        && (g["label"] === null || typeof g["label"] === "string")
        && typeof g["visible"] === "boolean"
    );
}
