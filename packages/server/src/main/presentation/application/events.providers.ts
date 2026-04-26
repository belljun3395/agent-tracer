import type { Provider } from "@nestjs/common";
import type { IEventRepository, INotificationPublisher, ITaskRepository } from "~application/index.js";
import type { ITurnRepository } from "~application/ports/repository/turn.repository.js";
import {
    IngestEventsUseCase,
    LogEventUseCase,
    SearchEventsUseCase,
    UpdateEventUseCase,
} from "~application/events/index.js";
import { RunTurnEvaluationUseCase } from "~application/verification/run.turn.evaluation.usecase.js";
import { TurnEvaluationHook } from "~application/verification/turn.evaluation.hook.js";
import {
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    TASK_REPOSITORY_TOKEN,
    TURN_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const EVENTS_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: TurnEvaluationHook,
        useFactory: (
            events: IEventRepository,
            turns: ITurnRepository,
            evaluator: RunTurnEvaluationUseCase,
        ) => new TurnEvaluationHook(events, turns, evaluator),
        inject: [EVENT_REPOSITORY_TOKEN, TURN_REPOSITORY_TOKEN, RunTurnEvaluationUseCase],
    },
    {
        provide: LogEventUseCase,
        useFactory: (tasks: ITaskRepository, events: IEventRepository, notifier: INotificationPublisher, hook: TurnEvaluationHook) =>
            new LogEventUseCase(tasks, events, notifier, hook),
        inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN, TurnEvaluationHook],
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
