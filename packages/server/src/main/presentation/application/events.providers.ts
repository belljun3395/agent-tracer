import type { Provider } from "@nestjs/common";
import type { IEventRepository, INotificationPublisher, ITaskRepository } from "~application/index.js";
import {
    IngestEventsUseCase,
    LogEventUseCase,
    SearchEventsUseCase,
    UpdateEventUseCase,
} from "~application/events/index.js";
import { RuleEnforcementPostProcessor } from "~application/verification/services/rule.enforcement.post.processor.js";
import { TurnLifecyclePostProcessor } from "~application/verification/services/turn.lifecycle.post.processor.js";
import {
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    TASK_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const EVENTS_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: LogEventUseCase,
        useFactory: (
            tasks: ITaskRepository,
            events: IEventRepository,
            notifier: INotificationPublisher,
            ruleEnforcement: RuleEnforcementPostProcessor,
            turnLifecycle: TurnLifecyclePostProcessor,
        ) => new LogEventUseCase(tasks, events, notifier, ruleEnforcement, turnLifecycle),
        inject: [
            TASK_REPOSITORY_TOKEN,
            EVENT_REPOSITORY_TOKEN,
            NOTIFICATION_PUBLISHER_TOKEN,
            RuleEnforcementPostProcessor,
            TurnLifecyclePostProcessor,
        ],
    },
    {
        provide: UpdateEventUseCase,
        useFactory: (events: IEventRepository, notifier: INotificationPublisher) =>
            new UpdateEventUseCase(events, notifier),
        inject: [EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: IngestEventsUseCase,
        useFactory: (logEvent: LogEventUseCase) => new IngestEventsUseCase(logEvent),
        inject: [LogEventUseCase],
    },
    {
        provide: SearchEventsUseCase,
        useFactory: (events: IEventRepository) => new SearchEventsUseCase(events),
        inject: [EVENT_REPOSITORY_TOKEN],
    },
];

export const EVENTS_APPLICATION_EXPORTS = [
    LogEventUseCase,
    UpdateEventUseCase,
    IngestEventsUseCase,
    SearchEventsUseCase,
] as const;
