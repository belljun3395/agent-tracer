import { TaskCleanupSuggestionRepository, TransactionRunner } from "@monitor/tracer-domain";
import { SystemClock } from "@monitor/platform";
import { AcceptCleanupSuggestionUseCase } from "~tracer-api/domain/cleanup/application/command/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "~tracer-api/domain/cleanup/application/command/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "~tracer-api/domain/cleanup/application/query/list.cleanup.suggestions.usecase.js";
import { CleanupController } from "~tracer-api/domain/cleanup/inbound/cleanup.controller.js";
import { CLOCK } from "~tracer-api/domain/cleanup/port/clock.port.js";
import { CLEANUP_SUGGESTION_REPOSITORY } from "~tracer-api/domain/cleanup/port/cleanup.suggestion.repository.port.js";
import { CLEANUP_TRANSACTION } from "~tracer-api/domain/cleanup/port/cleanup.transaction.port.js";

/** cleanup 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const cleanupFeature = {
    controllers: [CleanupController],
    providers: [
        AcceptCleanupSuggestionUseCase,
        DismissCleanupSuggestionUseCase,
        ListCleanupSuggestionsUseCase,
        { provide: CLOCK, useClass: SystemClock },
        { provide: CLEANUP_SUGGESTION_REPOSITORY, useExisting: TaskCleanupSuggestionRepository },
        { provide: CLEANUP_TRANSACTION, useExisting: TransactionRunner },
    ],
};
