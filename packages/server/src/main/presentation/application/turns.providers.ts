import type { Provider } from "@nestjs/common";
import { ConfigBackedLlmClient } from "~adapters/llm/llm.client.factory.js";
import type { IAppConfigRepository } from "~application/ports/repository/app.config.repository.js";
import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import {
    GetTurnReceiptUseCase,
    ListTurnsUseCase,
} from "~application/verification/query/index.js";
import { GenerateTurnSummaryUseCase } from "~application/verification/summary/index.js";
import {
    APP_CONFIG_REPOSITORY_TOKEN,
    TURN_QUERY_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const TURNS_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: ListTurnsUseCase,
        useFactory: (turnQueryRepo: ITurnQueryRepository) =>
            new ListTurnsUseCase({ turnQueryRepo }),
        inject: [TURN_QUERY_REPOSITORY_TOKEN],
    },
    {
        provide: GetTurnReceiptUseCase,
        useFactory: (turnQueryRepo: ITurnQueryRepository) =>
            new GetTurnReceiptUseCase({ turnQueryRepo }),
        inject: [TURN_QUERY_REPOSITORY_TOKEN],
    },
    {
        provide: GenerateTurnSummaryUseCase,
        useFactory: (
            turnQueryRepo: ITurnQueryRepository,
            appConfigRepo: IAppConfigRepository,
        ) =>
            new GenerateTurnSummaryUseCase({
                repo: turnQueryRepo,
                llm: new ConfigBackedLlmClient(appConfigRepo),
            }),
        inject: [TURN_QUERY_REPOSITORY_TOKEN, APP_CONFIG_REPOSITORY_TOKEN],
    },
];

export const TURNS_APPLICATION_EXPORTS = [
    ListTurnsUseCase,
    GetTurnReceiptUseCase,
    GenerateTurnSummaryUseCase,
] as const;
