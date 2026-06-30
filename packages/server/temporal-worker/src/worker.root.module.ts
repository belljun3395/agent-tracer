import { Module, type DynamicModule } from "@nestjs/common";
import { WorkerModule } from "@monitor/server-core/worker.module.js";
import type { ServerModuleOptions } from "@monitor/server-core/server.module.options.js";
import { WorkerDispatchModule } from "./dispatch.unsupported.js";

// 워커 합성 루트: 도메인 그래프 + 실행 전용 디스패처 바인딩.
@Module({})
export class WorkerRootModule {
    static forRoot(options: ServerModuleOptions): DynamicModule {
        return {
            module: WorkerRootModule,
            imports: [WorkerModule.forRoot(options), WorkerDispatchModule],
        };
    }
}
