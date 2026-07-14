import { Inject, Injectable } from "@nestjs/common";
import type { RecipeEntity, SearchOutboxEntity } from "@monitor/tracer-domain";
import { ADVISORY_LOCK_KEY } from "~projector/domain/index/port/advisory.lock.keys.js";
import {
    ADVISORY_LOCK,
    type AdvisoryLockPort,
} from "~projector/domain/index/port/advisory.lock.port.js";
import type {
    SearchOutboxDrainRepositories,
    SearchOutboxRecipeRepository,
    SearchOutboxTaskUserStateRepository,
} from "~projector/domain/index/port/search.outbox.drain.repository.port.js";
import {
    SEARCH_INDEX_WRITER,
    type SearchIndexWriterPort,
} from "~projector/domain/index/port/search.index.writer.port.js";
import { logError } from "~projector/support/log.js";

const RECIPES_ALIAS = "recipes";
const TASKS_ALIAS = "tasks";
const DRAIN_BATCH_SIZE = 100;

function recipeDocument(recipe: RecipeEntity): Record<string, unknown> {
    return {
        userId: recipe.userId,
        title: recipe.title,
        intent: recipe.intent,
        description: recipe.description,
        summaryMd: recipe.summaryMd,
        touchedFiles: recipe.touchedFiles,
        status: recipe.status,
        userEdited: recipe.userEdited,
        rev: recipe.rev,
        updatedAt: recipe.updatedAt.toISOString(),
    };
}

/** 도메인 커밋과 같은 트랜잭션에 적재된 검색 반영 요청을 주기적으로 배출한다. */
@Injectable()
export class SearchOutboxDrainService {
    constructor(
        @Inject(ADVISORY_LOCK) private readonly lock: AdvisoryLockPort<SearchOutboxDrainRepositories>,
        @Inject(SEARCH_INDEX_WRITER) private readonly searchIndex: SearchIndexWriterPort,
    ) {}

    async runOnce(): Promise<number> {
        const drained = await this.lock.withAdvisoryLock(ADVISORY_LOCK_KEY.searchOutboxDrain, async (repos) => {
            const rows = await repos.searchOutbox.findBatch(DRAIN_BATCH_SIZE);
            let applied = 0;
            for (const row of rows) {
                if (await this.apply(row, repos)) {
                    await repos.searchOutbox.delete(row.id);
                    applied += 1;
                    continue;
                }
                await repos.searchOutbox.markFailed(row.id, row.attempts + 1, "search index write failed");
            }
            return applied;
        });
        return drained ?? 0;
    }

    private async apply(row: SearchOutboxEntity, repos: SearchOutboxDrainRepositories): Promise<boolean> {
        return row.isRecipe()
            ? this.applyRecipe(row, repos.recipes)
            : this.applyTask(row, repos.taskUserStates);
    }

    private async applyRecipe(row: SearchOutboxEntity, recipes: SearchOutboxRecipeRepository): Promise<boolean> {
        try {
            const recipe = await recipes.findById(row.targetId);
            if (recipe === null) return true;
            await this.searchIndex.indexDocument(RECIPES_ALIAS, recipe.id, recipeDocument(recipe));
            return true;
        } catch (error) {
            this.logFailure(row, error);
            return false;
        }
    }

    private async applyTask(
        row: SearchOutboxEntity,
        taskUserStates: SearchOutboxTaskUserStateRepository,
    ): Promise<boolean> {
        try {
            const state = await taskUserStates.findById(row.targetId);
            await this.searchIndex.updateDocument(
                TASKS_ALIAS,
                row.targetId,
                { archived: state?.isArchived() ?? false },
            );
            return true;
        } catch (error) {
            this.logFailure(row, error);
            return false;
        }
    }

    private logFailure(row: SearchOutboxEntity, error: unknown): void {
        logError({
            event: "search_outbox_drain_failed",
            target: row.target,
            targetId: row.targetId,
            attempts: row.attempts,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
