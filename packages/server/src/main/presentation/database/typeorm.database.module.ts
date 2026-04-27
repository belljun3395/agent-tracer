import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

export interface TypeOrmDatabaseModuleOptions {
    readonly databasePath: string;
}

/**
 * TypeORM DataSource for modules that have migrated to TypeORM (currently: session).
 * Coexists with the legacy better-sqlite3/drizzle context on the same .db file.
 * SQLite WAL mode handles concurrent connections; modules must not write to the
 * same tables from both stacks.
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
