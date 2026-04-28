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

export interface TypeOrmDatabaseModuleOptions {
    readonly databasePath: string;
}

/**
 * TypeORM DataSource for module entities (subscribers, write-side projections).
 * Coexists with the raw better-sqlite3 client (SQLITE_DATABASE_CONTEXT_TOKEN)
 * on the same .db file. SQLite WAL mode handles concurrent connections; modules
 * must not write to the same tables from both stacks.
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
                        ],
                        migrationsRun: true,
                    }),
                    dataSourceFactory: async (config) => {
                        if (!config) {
                            throw new Error("TypeORM dataSource config is required");
                        }
                        const dataSource = await new DataSource(config).initialize();
                        return addTransactionalDataSource(dataSource);
                    },
                }),
            ],
            exports: [TypeOrmModule],
        };
    }
}
