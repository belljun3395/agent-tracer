import { describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import { ContentBlobEntity } from "~activity/event/domain/event-store/content.blob.entity.js";
import { EventLogEntity } from "~activity/event/domain/event-store/event.log.entity.js";
import { EventProcessingJobEntity } from "~activity/event/domain/event-store/event.processing.job.entity.js";
import { EventAsyncRefEntity } from "~activity/event/domain/event.async.ref.entity.js";
import { EventFileEntity } from "~activity/event/domain/event.file.entity.js";
import { EventRelationEntity } from "~activity/event/domain/event.relation.entity.js";
import { EventTagEntity } from "~activity/event/domain/event.tag.entity.js";
import { EventTokenUsageEntity } from "~activity/event/domain/event.token.usage.entity.js";
import { QuestionCurrentEntity } from "~activity/event/domain/question.current.entity.js";
import { SearchDocumentEntity } from "~activity/event/domain/search/search.document.entity.js";
import { TimelineEventEntity } from "~activity/event/domain/timeline.event.entity.js";
import { TodoCurrentEntity } from "~activity/event/domain/todo.current.entity.js";
import { RuntimeBindingEntity } from "~activity/session/domain/runtime.binding.entity.js";
import { SessionEntity } from "~activity/session/domain/session.entity.js";
import { FileAffinityEntity } from "~governance/recipe/domain/file.affinity.entity.js";
import { RecipeApplicationEntity } from "~governance/recipe/domain/recipe.application.entity.js";
import { RecipeCandidateEntity } from "~governance/recipe/domain/recipe.candidate.entity.js";
import { RecipeEntity } from "~governance/recipe/domain/recipe.entity.js";
import { RecipeScanJobEntity } from "~governance/recipe/domain/recipe.scan.job.entity.js";
import { TaskRuleGenerationJobEntity } from "~governance/rule-generation/domain/task.rule.generation.job.entity.js";
import { RuleEntity } from "~governance/rule/domain/rule.entity.js";
import { AppSettingEntity } from "~governance/settings/domain/app.setting.entity.js";
import { TaskCleanupJobEntity } from "~governance/task-cleanup/domain/task.cleanup.job.entity.js";
import { TaskCleanupSuggestionEntity } from "~governance/task-cleanup/domain/task.cleanup.suggestion.entity.js";
import { RuleEnforcementEntity } from "~governance/verification/domain/rule.enforcement.entity.js";
import { TurnEntity } from "~governance/verification/domain/turn.entity.js";
import { TurnEventEntity } from "~governance/verification/domain/turn.event.entity.js";
import { VerdictEntity } from "~governance/verification/domain/verdict.entity.js";
import { TaskEntity } from "~work/task/domain/task.entity.js";
import { TaskRelationEntity } from "~work/task/domain/task.relation.entity.js";
import { TurnPartitionEntity } from "~work/turn/domain/turn.partition.entity.js";

/**
 * Fresh-start 스키마 검증.
 *
 * 마이그레이션을 모두 제거하고 `synchronize: true`로 전환했으므로, 전체 @Entity가
 * 빈 DB에서 그대로 스키마로 생성될 수 있어야 한다(서버가 새 환경에서 부팅 가능).
 * 같은 `events` 테이블을 매핑하던 3벌의 EventLogEntity를 1벌로 합쳤는지도 함께 검증한다.
 */
const ALL_ENTITIES = [
    ContentBlobEntity,
    EventLogEntity,
    EventProcessingJobEntity,
    EventAsyncRefEntity,
    EventFileEntity,
    EventRelationEntity,
    EventTagEntity,
    EventTokenUsageEntity,
    QuestionCurrentEntity,
    SearchDocumentEntity,
    TimelineEventEntity,
    TodoCurrentEntity,
    RuntimeBindingEntity,
    SessionEntity,
    FileAffinityEntity,
    RecipeApplicationEntity,
    RecipeCandidateEntity,
    RecipeEntity,
    RecipeScanJobEntity,
    TaskRuleGenerationJobEntity,
    RuleEntity,
    AppSettingEntity,
    TaskCleanupJobEntity,
    TaskCleanupSuggestionEntity,
    RuleEnforcementEntity,
    TurnEntity,
    TurnEventEntity,
    VerdictEntity,
    TaskEntity,
    TaskRelationEntity,
    TurnPartitionEntity,
];

async function freshDataSource(): Promise<DataSource> {
    const ds = new DataSource({
        type: "better-sqlite3",
        database: ":memory:",
        entities: ALL_ENTITIES,
        synchronize: true,
    });
    await ds.initialize();
    return ds;
}

describe("Fresh-start 스키마(synchronize) 검증", () => {
    it("전체 엔티티가 빈 DB에서 synchronize로 스키마 생성에 성공한다", async () => {
        const ds = await freshDataSource();
        try {
            expect(ds.isInitialized).toBe(true);
        } finally {
            await ds.destroy();
        }
    });

    it("events 테이블은 단일 EventLogEntity로 매핑되어 충돌 없이 생성된다", async () => {
        const ds = await freshDataSource();
        try {
            const repo = ds.getRepository(EventLogEntity);
            await repo.insert({
                eventId: "e1",
                eventTime: 1,
                eventType: "test.event",
                schemaVer: 1,
                aggregateId: "agg1",
                sessionId: null,
                actor: "system",
                correlationId: null,
                causationId: null,
                payloadJson: "{}",
                recordedAt: 1,
            });
            expect(await repo.count()).toBe(1);
        } finally {
            await ds.destroy();
        }
    });

    it("엔티티로 표현 불가능한 FTS5 검색 인덱스도 동기화된 스키마 위에 생성된다", async () => {
        const ds = await freshDataSource();
        try {
            await ds.query(`
                create virtual table if not exists search_documents_fts using fts5(
                    search_text,
                    content='search_documents',
                    content_rowid='rowid',
                    tokenize='unicode61 remove_diacritics 1'
                )
            `);
            const rows = await ds.query(
                `select name from sqlite_master where type='table' and name='search_documents_fts'`,
            );
            expect(rows.length).toBe(1);
        } finally {
            await ds.destroy();
        }
    });
});
