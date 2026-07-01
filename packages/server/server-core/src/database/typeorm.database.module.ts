import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { addTransactionalDataSource } from "typeorm-transactional";
import { AppConfigService } from "../config/app.config.service.js";
import { MIGRATIONS_DIR } from "./cli.datasource.js";

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
                        // prd 는 migrations 로 스키마를 관리한다; autoLoadEntities 의
                        // synchronize 는 local 개발 편의로만 켠다.
                        const isProd = appConfig.profile === "prd";
                        return {
                            type: "postgres",
                            host: pg.host,
                            port: pg.port,
                            username: pg.username,
                            password: pg.password,
                            database: pg.database,
                            autoLoadEntities: true,
                            synchronize: !isProd,
                            // swc-node 소스실행 모델이라 마이그레이션도 .ts 그대로 로드된다.
                            migrations: [`${MIGRATIONS_DIR}/*.js`, `${MIGRATIONS_DIR}/*.ts`],
                            migrationsRun: isProd,
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
