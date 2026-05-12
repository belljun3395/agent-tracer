import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { addTransactionalDataSource } from "typeorm-transactional";
import { CreateTaskSchema1700000001000 } from "~main/migrations/1700000001000-create-task-schema.js";
import { CreateSessionSchema1700000002000 } from "~main/migrations/1700000002000-create-session-schema.js";
import { CreateEventSchema1700000003000 } from "~main/migrations/1700000003000-create-event-schema.js";
import { CreateRuleSchema1700000004000 } from "~main/migrations/1700000004000-create-rule-schema.js";
import { CreateVerificationSchema1700000005000 } from "~main/migrations/1700000005000-create-verification-schema.js";
import { CreateTurnPartitionSchema1700000006000 } from "~main/migrations/1700000006000-create-turn-partition-schema.js";
import { PurgeCompletedJobs1700000007000 } from "~main/migrations/1700000007000-purge-completed-jobs.js";
import { CreateSearchFts51700000008000 } from "~main/migrations/1700000008000-create-search-fts5.js";
import { CreateAppSettingsSchema1700000009000 } from "~main/migrations/1700000009000-create-app-settings-schema.js";
import { CreateTaskRuleGenerationJobsSchema1700000010000 } from "~main/migrations/1700000010000-create-task-rule-generation-jobs-schema.js";
import { AddTasksArchivedAt1700000011000 } from "~main/migrations/1700000011000-add-tasks-archived-at.js";
import { CreateTaskCleanupSchema1700000012000 } from "~main/migrations/1700000012000-create-task-cleanup-schema.js";
import { CreateRecipeSchema1700000013000 } from "~main/migrations/1700000013000-create-recipe-schema.js";
import { CreateRecipeApplicationsSchema1700000014000 } from "~main/migrations/1700000014000-create-recipe-applications-schema.js";
import { CreateFileAffinitySchema1700000015000 } from "~main/migrations/1700000015000-create-file-affinity-schema.js";
import { AddTasksOrigin1700000016000 } from "~main/migrations/1700000016000-add-tasks-origin.js";

export interface TypeOrmDatabaseModuleOptions {
    readonly databasePath: string;
}

/**
 * TypeORM DataSource for module entities (subscribers, write-side projections).
 * Coexists with the raw better-sqlite3 client (SQLITE_DATABASE_CONTEXT_TOKEN)
 * on the same .db file. SQLite WAL mode (configured below) handles concurrent
 * connections; modules must not write to the same tables from both stacks.
 *
 * The DataSource is registered with `typeorm-transactional` so any
 * `@Transactional()` method or `runInTransaction()` call automatically
 * propagates the transactional EntityManager through AsyncLocalStorage —
 * injected `Repository<T>` instances participate in the transaction without
 * an explicit `manager` parameter.
 */
@Module({})
export class TypeOrmDatabaseModule {
    static forRoot(options: TypeOrmDatabaseModuleOptions): DynamicModule {
        return {
            module: TypeOrmDatabaseModule,
            imports: [
                TypeOrmModule.forRootAsync({
                    useFactory: () => ({
                        type: "better-sqlite3",
                        database: options.databasePath,
                        autoLoadEntities: true,
                        synchronize: false,
                        logging: false,
                        migrations: [
                            CreateTaskSchema1700000001000,
                            CreateSessionSchema1700000002000,
                            CreateEventSchema1700000003000,
                            CreateRuleSchema1700000004000,
                            CreateVerificationSchema1700000005000,
                            CreateTurnPartitionSchema1700000006000,
                            PurgeCompletedJobs1700000007000,
                            CreateSearchFts51700000008000,
                            CreateAppSettingsSchema1700000009000,
                            CreateTaskRuleGenerationJobsSchema1700000010000,
                            AddTasksArchivedAt1700000011000,
                            CreateTaskCleanupSchema1700000012000,
                            CreateRecipeSchema1700000013000,
                            CreateRecipeApplicationsSchema1700000014000,
                            CreateFileAffinitySchema1700000015000,
                            AddTasksOrigin1700000016000,
                        ],
                        migrationsRun: true,
                    }),
                    dataSourceFactory: async (config) => {
                        if (!config) {
                            throw new Error("TypeORM dataSource config is required");
                        }
                        const dataSource = await new DataSource(config).initialize();
                        await applySqlitePragmas(dataSource);
                        return addTransactionalDataSource(dataSource);
                    },
                }),
            ],
            exports: [TypeOrmModule],
        };
    }
}

/**
 * Apply SQLite runtime tuning. Run once at boot; the settings persist for the
 * lifetime of the database file (journal_mode) or the connection (others).
 *
 * Trade-offs:
 *   - `journal_mode=WAL`: readers and a single writer run concurrently. Adds
 *     two sidecar files (`*-wal`, `*-shm`); backups must include them or use
 *     the sqlite3 `.backup` command.
 *   - `synchronous=NORMAL`: WAL still survives application crashes; only loses
 *     the most recent transactions on a power loss / OS crash. Local-only
 *     dev/monitoring tool — this trade is the SQLite-recommended default.
 *   - `cache_size=-65536`: 64 MB page cache (negative = kibibytes).
 *   - `mmap_size`: 256 MB memory-mapped reads; speeds up large scans.
 *   - `temp_store=MEMORY`: temp tables for sorts/joins stay in RAM.
 *
 * Override the pragmas at runtime via env var if needed (rarely useful in
 * practice; documented in docs/guide/perf-tuning.md).
 */
async function applySqlitePragmas(dataSource: DataSource): Promise<void> {
    await dataSource.query("PRAGMA journal_mode = WAL");
    await dataSource.query("PRAGMA synchronous = NORMAL");
    await dataSource.query("PRAGMA cache_size = -65536");
    await dataSource.query("PRAGMA mmap_size = 268435456");
    await dataSource.query("PRAGMA temp_store = MEMORY");
}
