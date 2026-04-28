import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

export interface TypeOrmDatabaseModuleOptions {
    readonly databasePath: string;
}

/**
 * TypeORM DataSource for module entities (subscribers, write-side projections).
 * Coexists with the raw better-sqlite3 client (SQLITE_DATABASE_CONTEXT_TOKEN)
 * on the same .db file. SQLite WAL mode handles concurrent connections; modules
 * must not write to the same tables from both stacks.
 */
@Module({})
export class TypeOrmDatabaseModule {
    static forRoot(options: TypeOrmDatabaseModuleOptions): DynamicModule {
        return {
            module: TypeOrmDatabaseModule,
            imports: [
                TypeOrmModule.forRoot({
                    type: "better-sqlite3",
                    database: options.databasePath,
                    autoLoadEntities: true,
                    synchronize: false,
                    logging: false,
                }),
            ],
            exports: [TypeOrmModule],
        };
    }
}
