import { Injectable, Logger } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { ArchiveTaskUseCase } from "@monitor/run-api/task/application/archive.task.usecase.js";
import { LinkTaskUseCase } from "@monitor/run-api/task/application/link.task.usecase.js";
import { ReslugTaskUseCase } from "@monitor/run-api/task/application/reslug.task.usecase.js";
import { UpdateTaskUseCase } from "@monitor/run-api/task/application/update.task.usecase.js";
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
        private readonly archiveTask: ArchiveTaskUseCase,
        private readonly updateTask: UpdateTaskUseCase,
        private readonly linkTask: LinkTaskUseCase,
        private readonly reslugTask: ReslugTaskUseCase,
    ) {}

    @Transactional()
    async execute(
        input: AcceptCleanupSuggestionUseCaseIn,
    ): Promise<AcceptCleanupSuggestionUseCaseOut> {
        const row = await this.suggestions.findById(input.suggestionId);
        // 존재하지 않는 제안은 적용 대상이 아니므로 not_found로 끝낸다.
        if (!row) return { status: "not_found" };
        // 이미 처리된 제안은 재적용하지 않아 상태 변경을 한 번만 허용한다.
        if (!row.isPending()) return { status: "not_pending" };

        try {
            await this.applySuggestion(row);
        } catch (err) {
            // 적용 중 실패하면 제안을 failed로 닫아 같은 제안이 반복 실행되지 않게 한다.
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
        const proposed: unknown = row.proposedValue
            ? JSON.parse(row.proposedValue)
            : null;
        switch (row.kind) {
            case "archive": {
                await this.archiveTask.execute({ taskId: row.taskId });
                return;
            }
            case "rename_title": {
                const title = readStringField(proposed, "title");
                // 새 제목이 없으면 태스크 상태를 바꾸지 않고 제안을 실패 처리한다.
                if (!title) throw new Error("Missing proposed title");
                const out = await this.updateTask.execute({
                    taskId: row.taskId,
                    title,
                });
                if (!out) throw new Error("Task no longer exists");
                return;
            }
            case "set_parent": {
                const parentTaskId = readStringField(proposed, "parentTaskId");
                // 부모가 없거나 자기 자신이면 관계 그래프가 깨지므로 적용하지 않는다.
                if (!parentTaskId) throw new Error("Missing parentTaskId");
                if (parentTaskId === row.taskId) {
                    throw new Error("Task cannot be its own parent");
                }
                await this.linkTask.execute({
                    taskId: row.taskId,
                    parentTaskId,
                });
                return;
            }
            case "reslug": {
                const slug = readStringField(proposed, "slug");
                // slug가 없으면 공개 경로를 바꿀 기준이 없으므로 적용하지 않는다.
                if (!slug) throw new Error("Missing proposed slug");
                const out = await this.reslugTask.execute({
                    taskId: row.taskId,
                    slug,
                });
                if (out.status === "not_found") {
                    throw new Error("Task no longer exists");
                }
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
