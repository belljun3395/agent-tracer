import { Module, type DynamicModule, type Provider, type Type } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { createOpenSearchClient, TokenBucketLimiter } from "@monitor/platform";
import type { createDataSource, createKafka } from "@monitor/platform";
import { chatFeature } from "~tracer-api/domain/chat/chat.feature.js";
import { cleanupFeature } from "~tracer-api/domain/cleanup/cleanup.feature.js";
import { healthFeature } from "~tracer-api/domain/health/health.feature.js";
import { jobFeature } from "~tracer-api/domain/job/job.feature.js";
import { memoFeature } from "~tracer-api/domain/memo/memo.feature.js";
import { recipeFeature } from "~tracer-api/domain/recipe/recipe.feature.js";
import { ruleFeature } from "~tracer-api/domain/rule/rule.feature.js";
import { searchFeature } from "~tracer-api/domain/search/search.feature.js";
import { sessionFeature } from "~tracer-api/domain/session/session.feature.js";
import { settingsFeature } from "~tracer-api/domain/settings/settings.feature.js";
import { tagFeature } from "~tracer-api/domain/tag/tag.feature.js";
import { taskFeature } from "~tracer-api/domain/task/task.feature.js";
import { timelineFeature } from "~tracer-api/domain/timeline/timeline.feature.js";
import { userFeature } from "~tracer-api/domain/user/user.feature.js";
import { AuthGuard } from "~tracer-api/config/auth.guard.js";
import { RateLimitGuard, resolveApiRateLimiter } from "~tracer-api/config/rate.limit.guard.js";
import { GlobalExceptionFilter } from "~tracer-api/config/exception.filter.js";
import { ResponseEnvelopeInterceptor } from "~tracer-api/config/response.envelope.interceptor.js";
import { AccessLogInterceptor } from "~tracer-api/config/access.log.interceptor.js";
import { NotificationBroadcaster } from "~tracer-api/config/notification.broadcaster.js";
import { OPENSEARCH_CLIENT } from "~tracer-api/config/opensearch.client.const.js";
import { TRACER_DATA_SOURCE, TRACER_KAFKA } from "~tracer-api/config/tracer.datasource.token.js";
import { repositoryProviders } from "~tracer-api/config/repository.providers.js";

type TracerDataSource = ReturnType<typeof createDataSource>;
type TracerKafka = ReturnType<typeof createKafka>;

/** 슬라이스 하나가 조립 근원에 공급하는 controller와 provider 목록이다. */
interface ApiFeatureCatalog {
    readonly controllers: readonly Type[];
    readonly providers: readonly Provider[];
}

const apiFeatures: readonly ApiFeatureCatalog[] = [
    chatFeature,
    cleanupFeature,
    healthFeature,
    jobFeature,
    memoFeature,
    recipeFeature,
    ruleFeature,
    searchFeature,
    sessionFeature,
    settingsFeature,
    tagFeature,
    taskFeature,
    timelineFeature,
    userFeature,
];

/** tracer-api 열두 슬라이스를 모아 앱 전역 배선과 함께 조립하는 근원 모듈이다. */
@Module({})
export class TracerApiModule {
    static forRoot(
        dataSource: TracerDataSource,
        kafka: TracerKafka,
        broadcaster: NotificationBroadcaster,
    ): DynamicModule {
        return {
            module: TracerApiModule,
            controllers: apiFeatures.flatMap((feature) => feature.controllers),
            providers: [
                { provide: TokenBucketLimiter, useFactory: resolveApiRateLimiter },
                { provide: APP_GUARD, useClass: AuthGuard },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: TRACER_DATA_SOURCE, useValue: dataSource },
                { provide: TRACER_KAFKA, useValue: kafka },
                { provide: NotificationBroadcaster, useValue: broadcaster },
                { provide: OPENSEARCH_CLIENT, useFactory: () => createOpenSearchClient() },
                ...repositoryProviders,
                ...apiFeatures.flatMap((feature) => feature.providers),
                { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
                { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
                { provide: APP_FILTER, useClass: GlobalExceptionFilter },
            ],
        };
    }
}
