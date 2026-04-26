import type { Provider } from "@nestjs/common";
import type { IAppConfigRepository } from "~application/ports/repository/app.config.repository.js";
import { GetConfigUseCase, UpdateConfigUseCase } from "~application/config/index.js";
import { APP_CONFIG_REPOSITORY_TOKEN } from "../database/database.provider.js";

export const CONFIG_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: GetConfigUseCase,
        useFactory: (repo: IAppConfigRepository) => new GetConfigUseCase({ repo }),
        inject: [APP_CONFIG_REPOSITORY_TOKEN],
    },
    {
        provide: UpdateConfigUseCase,
        useFactory: (repo: IAppConfigRepository) => new UpdateConfigUseCase({ repo }),
        inject: [APP_CONFIG_REPOSITORY_TOKEN],
    },
];

export const CONFIG_APPLICATION_EXPORTS = [
    GetConfigUseCase,
    UpdateConfigUseCase,
] as const;
