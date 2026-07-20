import { Injectable } from "@nestjs/common";
import { RECIPE_INJECTED_VIA, type RecipeInjectedVia, type TaskStatus } from "@monitor/kernel";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { RecipeApplicationEntity, RecipeLifecycle } from "@monitor/tracer-domain";
import type { RecipeProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";

const DEFAULT_INJECTED_VIA: RecipeInjectedVia = RECIPE_INJECTED_VIA[0];

/** 레시피 주입 이벤트를 적용 이력으로 투영하고, 태스크 종결 시점에 그 이력의 성과를 확정한다. */
@Injectable()
export class RecipeProjection {
    async projectInjected(repositories: RecipeProjectionRepositories, record: LedgerRecord): Promise<void> {
        const payload = parseStoredEventPayload(record.payload);
        const applicationId = payload.applicationId;
        const recipeId = payload.recipeId;
        if (applicationId === undefined || recipeId === undefined) return;

        const application = new RecipeApplicationEntity();
        application.id = applicationId;
        application.userId = record.userId;
        application.recipeId = recipeId;
        application.taskId = record.taskId;
        application.injectedVia = payload.injectedVia ?? DEFAULT_INJECTED_VIA;
        application.outcome = null;
        application.note = null;
        application.createdAt = record.occurredAt;
        application.resolvedAt = null;
        await repositories.recipeApplications.upsert(application);
    }

    /** 작업이 끝난 시점에 아직 열려 있는 레시피 적용 이력의 성과를 확정한다. */
    async resolveForTask(
        repositories: RecipeProjectionRepositories,
        taskId: string,
        status: TaskStatus,
        now: Date,
    ): Promise<void> {
        const openApplications = await repositories.recipeApplications.findOpenByTask(taskId);
        if (openApplications.length === 0) return;

        const byRecipe = new Map<string, RecipeApplicationEntity[]>();
        for (const application of openApplications) {
            const group = byRecipe.get(application.recipeId) ?? [];
            group.push(application);
            byRecipe.set(application.recipeId, group);
        }

        for (const [recipeId, applications] of byRecipe) {
            const recipe = await repositories.recipes.findById(recipeId);
            if (recipe === null) continue;
            const changed = new RecipeLifecycle(recipe, applications).resolveOutcomes(status, taskId, now);
            for (const application of changed) await repositories.recipeApplications.upsert(application);
        }
    }
}
