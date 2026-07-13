import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    CLEANUP_SUGGESTION_REPOSITORY,
    type CleanupSuggestionRepositoryPort,
} from "~tracer-api/domain/cleanup/port/cleanup.suggestion.repository.port.js";
import { mapCleanupSuggestion, type CleanupSuggestionDto } from "~tracer-api/domain/cleanup/model/cleanup.model.js";

@Injectable()
export class DismissCleanupSuggestionUseCase {
    constructor(
        @Inject(CLEANUP_SUGGESTION_REPOSITORY)
        private readonly suggestions: CleanupSuggestionRepositoryPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly suggestion: CleanupSuggestionDto }> {
        const suggestion = await this.suggestions.findById(id);
        // 남의 제안은 존재 자체를 알리지 않는다.
        if (suggestion === null || !suggestion.isOwnedBy(userId)) throw new NotFoundException("Cleanup suggestion not found");
        suggestion.dismiss(new Date());
        await this.suggestions.upsert(suggestion);
        return { suggestion: mapCleanupSuggestion(suggestion) };
    }
}
