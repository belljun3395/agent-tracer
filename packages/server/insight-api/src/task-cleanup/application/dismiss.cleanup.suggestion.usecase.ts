import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { TaskCleanupSuggestionRepository } from "../repository/task.cleanup.suggestion.repository.js";
import type {
    DismissCleanupSuggestionUseCaseIn,
    DismissCleanupSuggestionUseCaseOut,
} from "./dto/dismiss.cleanup.suggestion.usecase.dto.js";

@Injectable()
export class DismissCleanupSuggestionUseCase {
    constructor(
        private readonly suggestions: TaskCleanupSuggestionRepository,
    ) {}

    @Transactional()
    async execute(
        input: DismissCleanupSuggestionUseCaseIn,
    ): Promise<DismissCleanupSuggestionUseCaseOut> {
        const userId = currentUserId();
        const row = await this.suggestions.findOwned(input.suggestionId, userId);
        if (!row) return { status: "not_found" };
        if (!row.isPending()) return { status: "not_pending" };
        await this.suggestions.markResolved({
            id: row.id,
            userId,
            status: "dismissed",
            resolvedAt: new Date().toISOString(),
        });
        return { status: "dismissed" };
    }
}
