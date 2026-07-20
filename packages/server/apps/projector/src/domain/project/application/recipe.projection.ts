import { Injectable } from "@nestjs/common";
import { RECIPE_INJECTED_VIA, type RecipeInjectedVia } from "@monitor/kernel";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { RecipeApplicationEntity } from "@monitor/tracer-domain";
import type { RecipeProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";

const DEFAULT_INJECTED_VIA: RecipeInjectedVia = RECIPE_INJECTED_VIA[0];

/** 레시피 주입 이벤트를 적용 이력으로 투영한다. */
@Injectable()
export class RecipeProjection {
    /** 같은 태스크·레시피에 이미 열린 적용이 있으면 새로 열지 않아 분모가 부풀지 않게 한다. */
    async projectInjected(repositories: RecipeProjectionRepositories, record: LedgerRecord): Promise<void> {
        const payload = parseStoredEventPayload(record.payload);
        const applicationId = payload.applicationId;
        const recipeId = payload.recipeId;
        if (applicationId === undefined || recipeId === undefined) return;

        const existing = await repositories.recipeApplications.findByTask(record.taskId);
        if (existing.some((application) => application.recipeId === recipeId)) return;

        const application = new RecipeApplicationEntity();
        application.id = applicationId;
        application.userId = record.userId;
        application.recipeId = recipeId;
        application.taskId = record.taskId;
        application.injectedVia = payload.injectedVia ?? DEFAULT_INJECTED_VIA;
        application.outcome = null;
        application.note = null;
        application.anchorEventId = record.id;
        application.anchorSeq = record.seq;
        application.createdAt = record.occurredAt;
        await repositories.recipeApplications.upsert(application);
    }
}
