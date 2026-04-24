import type { Provider } from "@nestjs/common";
import type {
    IBookmarkRepository,
    IEventRepository,
    INotificationPublisher,
    ITaskRepository,
} from "~application/index.js";
import {
    DeleteBookmarkUseCase,
    ListBookmarksUseCase,
    SaveBookmarkUseCase,
} from "~application/bookmarks/index.js";
import {
    BOOKMARK_REPOSITORY_TOKEN,
    EVENT_REPOSITORY_TOKEN,
    NOTIFICATION_PUBLISHER_TOKEN,
    TASK_REPOSITORY_TOKEN,
} from "../database/database.provider.js";

export const BOOKMARKS_APPLICATION_PROVIDERS: Provider[] = [
    {
        provide: ListBookmarksUseCase,
        useFactory: (bookmarks: IBookmarkRepository) => new ListBookmarksUseCase(bookmarks),
        inject: [BOOKMARK_REPOSITORY_TOKEN],
    },
    {
        provide: SaveBookmarkUseCase,
        useFactory: (
            tasks: ITaskRepository,
            events: IEventRepository,
            bookmarks: IBookmarkRepository,
            notifier: INotificationPublisher,
        ) => new SaveBookmarkUseCase(tasks, events, bookmarks, notifier),
        inject: [TASK_REPOSITORY_TOKEN, EVENT_REPOSITORY_TOKEN, BOOKMARK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
    {
        provide: DeleteBookmarkUseCase,
        useFactory: (bookmarks: IBookmarkRepository, notifier: INotificationPublisher) =>
            new DeleteBookmarkUseCase(bookmarks, notifier),
        inject: [BOOKMARK_REPOSITORY_TOKEN, NOTIFICATION_PUBLISHER_TOKEN],
    },
];

export const BOOKMARKS_APPLICATION_EXPORTS = [
    ListBookmarksUseCase,
    SaveBookmarkUseCase,
    DeleteBookmarkUseCase,
] as const;
