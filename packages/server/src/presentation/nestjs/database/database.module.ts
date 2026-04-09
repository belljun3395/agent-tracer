import { Module, type DynamicModule } from "@nestjs/common";
import { DatabaseProvider, MONITOR_PORTS_TOKEN } from "./database.provider.js";
export interface DatabaseModuleOptions {
    readonly databasePath: string;
}
@Module({})
export class DatabaseModule {
    static forRoot(options: DatabaseModuleOptions): DynamicModule {
        const provider = DatabaseProvider(options);
        return {
            module: DatabaseModule,
            providers: [provider],
            exports: [MONITOR_PORTS_TOKEN]
        };
    }
}
