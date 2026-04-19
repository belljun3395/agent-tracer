import type {
    ITaskRepository,
    IEventRepository,
    IBookmarkRepository,
    INotificationPublisher,
    BookmarkRecord,
} from "~application/ports/index.js";
import type { SaveBookmarkUseCaseIn } from "./save.bookmark.usecase.dto.js";

export class SaveBookmarkUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly bookmarkRepo: IBookmarkRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: SaveBookmarkUseCaseIn): Promise<BookmarkRecord> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new Error(`Task not found: ${input.taskId}`);

        const event = input.eventId
            ? await this.eventRepo.findById(input.eventId)
            : undefined;
        if (input.eventId && !event) throw new Error(`Event not found: ${input.eventId}`);
        if (event && event.taskId !== task.id) {
            throw new Error(`Event ${event.id} does not belong to task ${task.id}`);
        }

        const bookmarks = await this.bookmarkRepo.findByTaskId(task.id);
        const existing = bookmarks.find(
            (b) => b.taskId === task.id && (event ? b.eventId === event.id : !b.eventId),
        );
        const bookmark = await this.bookmarkRepo.save({
            id: existing?.id ?? globalThis.crypto.randomUUID(),
            taskId: task.id,
            ...(event ? { eventId: event.id } : {}),
            kind: event ? "event" : "task",
            title: input.title?.trim() || event?.title || task.title,
            ...(input.note?.trim() ? { note: input.note.trim() } : {}),
            metadata: input.metadata ?? {},
        });
        this.notifier.publish({ type: "bookmark.saved", payload: bookmark });
        return bookmark;
    }
}
