import "reflect-metadata";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataSource } from "typeorm";

import { RuleEntity } from "@monitor/rules-api/domain/rule/rule.entity.js";
import { TurnEntity } from "@monitor/rules-api/domain/verification/turn.entity.js";
import { TurnEventEntity } from "@monitor/rules-api/domain/verification/turn.event.entity.js";
import { VerdictEntity } from "@monitor/rules-api/domain/verification/verdict.entity.js";
import { RuleEnforcementEntity } from "@monitor/rules-api/domain/verification/rule.enforcement.entity.js";
import { RuleJobEntity } from "@monitor/rules-api/domain/job/rule.job.entity.js";

import { RuntimeBindingEntity } from "@monitor/run-api/domain/session/runtime.binding.entity.js";
import { SessionEntity } from "@monitor/run-api/domain/session/session.entity.js";
import { TaskEntity } from "@monitor/run-api/domain/task/task.entity.js";
import { TaskRelationEntity } from "@monitor/run-api/domain/task/task.relation.entity.js";
import { TurnPartitionEntity } from "@monitor/run-api/domain/turn/turn.partition.entity.js";

import { AppSettingEntity } from "@monitor/identity-api/settings/domain/app.setting.entity.js";
import { UserEntity } from "@monitor/identity-api/user/domain/user.entity.js";

import { InsightJobEntity } from "@monitor/insight-api/domain/job/insight.job.entity.js";
import { FileAffinityEntity } from "@monitor/insight-api/domain/recipe/file.affinity.entity.js";
import { RecipeApplicationEntity } from "@monitor/insight-api/domain/recipe/recipe.application.entity.js";
import { RecipeCandidateEntity } from "@monitor/insight-api/domain/recipe/recipe.candidate.entity.js";
import { RecipeEntity } from "@monitor/insight-api/domain/recipe/recipe.entity.js";
import { TaskCleanupSuggestionEntity } from "@monitor/insight-api/domain/task-cleanup/task.cleanup.suggestion.entity.js";

import { TimelineEventEntity } from "@monitor/timeline-api/domain/event/timeline.event.entity.js";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(PACKAGE_ROOT, "migrations");

/**
 * Standalone DataSource for the TypeORM CLI (migration:generate/run/revert).
 * NestJS's autoLoadEntities can't run outside app bootstrap, so every
 * entity registered via TypeOrmModule.forFeature across the feature
 * modules (see feature.modules.ts) is listed explicitly here — keep the
 * two in sync when adding an entity.
 */
export const cliDataSource = new DataSource({
    type: "postgres",
    host: process.env["POSTGRES_HOST"] ?? "127.0.0.1",
    port: Number(process.env["POSTGRES_PORT"] ?? 5432),
    username: process.env["POSTGRES_USER"] ?? "monitor",
    password: process.env["POSTGRES_PASSWORD"] ?? "monitor",
    database: process.env["POSTGRES_DB"] ?? "monitor",
    entities: [
        RuleEntity,
        TurnEntity,
        TurnEventEntity,
        VerdictEntity,
        RuleEnforcementEntity,
        RuleJobEntity,
        RuntimeBindingEntity,
        SessionEntity,
        TaskEntity,
        TaskRelationEntity,
        TurnPartitionEntity,
        AppSettingEntity,
        UserEntity,
        InsightJobEntity,
        FileAffinityEntity,
        RecipeApplicationEntity,
        RecipeCandidateEntity,
        RecipeEntity,
        TaskCleanupSuggestionEntity,
        TimelineEventEntity,
    ],
    migrations: [path.join(MIGRATIONS_DIR, "*.js"), path.join(MIGRATIONS_DIR, "*.ts")],
    synchronize: false,
    logging: false,
});
