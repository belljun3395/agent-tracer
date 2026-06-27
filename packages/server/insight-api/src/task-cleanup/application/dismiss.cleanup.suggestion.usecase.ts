import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { TaskCleanupSuggestionRepository } from "../repository/task.cleanup.suggestion.repository.js";
import type {
    DismissCleanupSuggestionUseCaseIn,
    DismissCleanupSuggestionUseCaseOut,
} from "./dto/cleanup.usecase.dto.js";

@Injectable()
export class DismissCleanupSuggestionUseCase {
    constructor(
        private readonly suggestions: TaskCleanupSuggestionRepository,
    ) {}

    @Transactional()
    async execute(
        input: DismissCleanupSuggestionUseCaseIn,
    ): Promise<DismissCleanupSuggestionUseCaseOut> {
        const row = await this.suggestions.findById(input.suggestionId);
        if (!row) return { status: "not_found" };
        if (!row.isPending()) return { status: "not_pending" };
        await this.suggestions.markResolved({
            id: row.id,
            status: "dismissed",
            resolvedAt: new Date().toISOString(),
        });
        return { status: "dismissed" };
    }
}
