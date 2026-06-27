import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { addTransactionalDataSource } from "typeorm-transactional";
import { AppConfigService } from "~config/app-config.service.js";

/**
 * Postgres DataSource for all module entities. The schema is derived from the
 * @Entity classes at boot (`synchronize`). Registered with `typeorm-transactional`
 * so `@Transactional()` / `runInTransaction()` propagate the EntityManager
 * through AsyncLocalStorage — injected `Repository<T>` instances join the
 * transaction without an explicit `manager` argument.
 */
@Module({})
export class TypeOrmDatabaseModule {
    static forRoot(): DynamicModule {
        return {
            module: TypeOrmDatabaseModule,
            imports: [
                TypeOrmModule.forRootAsync({
                    inject: [AppConfigService],
                    useFactory: (appConfig: AppConfigService) => {
                        const pg = appConfig.postgres;
                        return {
                            type: "postgres",
                            host: pg.host,
                            port: pg.port,
                            username: pg.username,
                            password: pg.password,
                            database: pg.database,
                            autoLoadEntities: true,
                            synchronize: true,
                            logging: false,
                        };
                    },
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
