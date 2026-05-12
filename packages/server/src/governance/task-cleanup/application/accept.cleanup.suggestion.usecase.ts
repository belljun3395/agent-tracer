import { Injectable, Logger } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskManagementService } from "~work/task/service/task.management.service.js";
import { TaskCleanupSuggestionRepository } from "../repository/task.cleanup.suggestion.repository.js";
import type {
    AcceptCleanupSuggestionUseCaseIn,
    AcceptCleanupSuggestionUseCaseOut,
} from "./dto/cleanup.usecase.dto.js";

@Injectable()
export class AcceptCleanupSuggestionUseCase {
    private readonly logger = new Logger(AcceptCleanupSuggestionUseCase.name);

    constructor(
        private readonly suggestions: TaskCleanupSuggestionRepository,
        private readonly management: TaskManagementService,
    ) {}

    @Transactional()
    async execute(
        input: AcceptCleanupSuggestionUseCaseIn,
    ): Promise<AcceptCleanupSuggestionUseCaseOut> {
        const row = await this.suggestions.findById(input.suggestionId);
        if (!row) return { status: "not_found" };
        if (row.status !== "pending") return { status: "not_pending" };

        try {
            await this.applySuggestion(row);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Failed to apply cleanup suggestion ${row.id} (${row.kind}): ${message}`,
            );
            await this.suggestions.markResolved({
                id: row.id,
                status: "failed",
                resolvedAt: new Date().toISOString(),
                error: truncate(message, 500),
            });
            return { status: "apply_failed", error: message };
        }

        await this.suggestions.markResolved({
            id: row.id,
            status: "accepted",
            resolvedAt: new Date().toISOString(),
        });
        return { status: "accepted" };
    }

    private async applySuggestion(row: {
        readonly taskId: string;
        readonly kind: string;
        readonly proposedValue: string | null;
    }): Promise<void> {
        const proposed = row.proposedValue ? JSON.parse(row.proposedValue) : null;
        switch (row.kind) {
            case "archive": {
                const result = await this.management.archive(row.taskId);
                if (result.status === "not_found") {
                    throw new Error("Task no longer exists");
                }
                if (result.status === "already_archived") {
                    return;
                }
                return;
            }
            case "rename_title": {
                const title = readStringField(proposed, "title");
                if (!title) throw new Error("Missing proposed title");
                const out = await this.management.update({
                    taskId: row.taskId,
                    title,
                });
                if (!out) throw new Error("Task no longer exists");
                return;
            }
            case "set_parent": {
                const parentTaskId = readStringField(proposed, "parentTaskId");
                if (!parentTaskId) throw new Error("Missing parentTaskId");
                if (parentTaskId === row.taskId) {
                    throw new Error("Task cannot be its own parent");
                }
                await this.management.link({
                    taskId: row.taskId,
                    parentTaskId,
                });
                return;
            }
            case "reslug": {
                const slug = readStringField(proposed, "slug");
                if (!slug) throw new Error("Missing proposed slug");
                const out = await this.management.updateSlug(row.taskId, slug);
                if (!out) throw new Error("Task no longer exists");
                return;
            }
            default:
                throw new Error(`Unsupported suggestion kind: ${row.kind}`);
        }
    }
}

function readStringField(value: unknown, field: string): string | null {
    if (!value || typeof value !== "object") return null;
    const v = (value as Record<string, unknown>)[field];
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}
