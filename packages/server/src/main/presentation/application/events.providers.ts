import type { Provider } from "@nestjs/common";
import type { INotificationPublisher } from "~application/ports/event/notification.publisher.js";
import type { IEventRepository } from "~application/ports/repository/event.repository.js";
import type { ITaskRepository } from "~application/ports/repository/task.repository.js";
import { IngestEventsUseCase } from "~application/events/ingest.events.usecase.js";
import { LogEventUseCase } from "~application/events/log.event.usecase.js";
import { SearchEventsUseCase } from "~application/events/search.events.usecase.js";
import { UpdateEventUseCase } from "~application/events/update.event.usecase.js";
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
