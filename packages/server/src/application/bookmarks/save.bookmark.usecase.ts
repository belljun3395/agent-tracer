import type {
    ITaskRepository,
    IEventRepository,
    IBookmarkRepository,
    INotificationPublisher,
    BookmarkRecord,
} from "~application/ports/index.js";
import { createBookmarkDraft, isSameBookmarkTarget } from "~domain/bookmarks/index.js";
import type { SaveBookmarkUseCaseIn, SaveBookmarkUseCaseOut, SavedBookmarkUseCaseDto } from "./dto/save.bookmark.usecase.dto.js";
import { BookmarkEventNotFoundError, BookmarkEventTaskMismatchError, BookmarkTaskNotFoundError } from "./common/bookmark.errors.js";

export class SaveBookmarkUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly bookmarkRepo: IBookmarkRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: SaveBookmarkUseCaseIn): Promise<SaveBookmarkUseCaseOut> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new BookmarkTaskNotFoundError(input.taskId);

        const event = input.eventId
            ? await this.eventRepo.findById(input.eventId)
            : undefined;
        if (input.eventId && !event) throw new BookmarkEventNotFoundError(input.eventId);
        if (event && event.taskId !== task.id) {
            throw new BookmarkEventTaskMismatchError(event.id, task.id);
        }

        const bookmarks = await this.bookmarkRepo.findByTaskId(task.id);
        const existing = bookmarks.find((bookmark) => isSameBookmarkTarget(bookmark, {
            taskId: task.id,
            ...(event ? { eventId: event.id } : {}),
        }));
        const bookmarkInput = createBookmarkDraft({
            id: existing?.id ?? globalThis.crypto.randomUUID(),
            task,
            ...(event ? { event } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.note !== undefined ? { note: input.note } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        });
        const bookmark = await this.bookmarkRepo.save(bookmarkInput);
        this.notifier.publish({ type: "bookmark.saved", payload: bookmark });
        return { bookmark: mapBookmarkRecord(bookmark) };
    }
}

function mapBookmarkRecord(record: BookmarkRecord): SavedBookmarkUseCaseDto {
    return {
        id: record.id,
        kind: record.kind,
        taskId: record.taskId,
        ...(record.eventId !== undefined ? { eventId: record.eventId } : {}),
        title: record.title,
        ...(record.note !== undefined ? { note: record.note } : {}),
        metadata: record.metadata,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        ...(record.taskTitle !== undefined ? { taskTitle: record.taskTitle } : {}),
        ...(record.eventTitle !== undefined ? { eventTitle: record.eventTitle } : {}),
    };
}
