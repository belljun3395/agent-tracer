import { Injectable } from "@nestjs/common";
import { RECIPE_INJECTED_VIA, type RecipeInjectedVia, type TaskStatus } from "@monitor/kernel";
import { parseStoredEventPayload } from "@monitor/kernel/ingest/stored-event.schema.js";
import { RecipeApplicationEntity, RecipeLifecycle, type RecipeEntity, type RecipeVerifyWindowEvent } from "@monitor/tracer-domain";
import type { RecipeProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { LedgerRecord } from "~projector/support/ledger.record.js";

const DEFAULT_INJECTED_VIA: RecipeInjectedVia = RECIPE_INJECTED_VIA[0];

/** 레시피 주입 이벤트를 적용 이력으로 투영하고, 태스크 종결 시점에 원장 관측으로 그 이력의 판정을 종결한다. */
@Injectable()
export class RecipeProjection {
    /** 같은 태스크·레시피에 이미 열린 적용이 있으면 새로 열지 않아 분모가 부풀지 않게 한다. */
    async projectInjected(repositories: RecipeProjectionRepositories, record: LedgerRecord): Promise<void> {
        const payload = parseStoredEventPayload(record.payload);
        const applicationId = payload.applicationId;
        const recipeId = payload.recipeId;
        if (applicationId === undefined || recipeId === undefined) return;

        const open = await repositories.recipeApplications.findOpenByTask(record.taskId);
        if (open.some((application) => application.recipeId === recipeId)) return;

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
        application.verdict = null;
        application.verdictEvidence = null;
        application.createdAt = record.occurredAt;
        application.resolvedAt = null;
        await repositories.recipeApplications.upsert(application);
    }

    /** 작업이 끝난 시점에 아직 열려 있는 레시피 적용 이력의 판정을 원장 관측으로 종결한다. */
    async resolveForTask(
        repositories: RecipeProjectionRepositories,
        taskId: string,
        status: TaskStatus,
        now: Date,
    ): Promise<void> {
        const openApplications = await repositories.recipeApplications.findOpenByTask(taskId);
        if (openApplications.length === 0) return;

        const windowEventsByApplicationId = await this.loadWindowEvents(repositories, openApplications);

        const byRecipe = new Map<string, RecipeApplicationEntity[]>();
        for (const application of openApplications) {
            const group = byRecipe.get(application.recipeId) ?? [];
            group.push(application);
            byRecipe.set(application.recipeId, group);
        }

        for (const [recipeId, applications] of byRecipe) {
            const recipe = await repositories.recipes.findById(recipeId);
            if (recipe === null) continue;
            const changed = new RecipeLifecycle(recipe, applications)
                .resolveVerdicts(status, taskId, windowEventsByApplicationId, now);
            if (changed.length === 0) continue;
            for (const application of changed) await repositories.recipeApplications.upsert(application);
            await this.retireIfWarranted(repositories, recipe, now);
        }
    }

    // 방금 판정이 갱신된 레시피만 확인하며, 전체 이력을 다시 읽어 이 태스크 밖의 적용까지 반영한 성과로 판단한다.
    private async retireIfWarranted(
        repositories: RecipeProjectionRepositories,
        recipe: RecipeEntity,
        now: Date,
    ): Promise<void> {
        const allApplications = await repositories.recipeApplications.findByRecipe(recipe.id);
        if (!new RecipeLifecycle(recipe, allApplications).shouldRetire(now)) return;
        recipe.retire(now);
        await repositories.recipes.upsert(recipe);
    }

    // 앵커가 없는 이력(자기보고로 즉석 생성된 적용)은 관측할 창이 없으므로 빈 창을 준다.
    private async loadWindowEvents(
        repositories: RecipeProjectionRepositories,
        applications: readonly RecipeApplicationEntity[],
    ): Promise<Map<string, readonly RecipeVerifyWindowEvent[]>> {
        const windowEventsByApplicationId = new Map<string, readonly RecipeVerifyWindowEvent[]>();
        for (const application of applications) {
            if (application.anchorSeq === null) {
                windowEventsByApplicationId.set(application.id, []);
                continue;
            }
            const events = await repositories.events.findByTaskSinceSeq(application.taskId, application.anchorSeq);
            windowEventsByApplicationId.set(application.id, events);
        }
        return windowEventsByApplicationId;
    }
}
