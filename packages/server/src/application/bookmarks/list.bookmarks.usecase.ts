import type { IBookmarkRepository, BookmarkRecord } from "~application/ports/index.js";
import type { ListedBookmarkUseCaseDto, ListBookmarksUseCaseIn, ListBookmarksUseCaseOut } from "./dto/list.bookmarks.usecase.dto.js";

export class ListBookmarksUseCase {
    constructor(private readonly bookmarkRepo: IBookmarkRepository) {}

    async execute(input: ListBookmarksUseCaseIn): Promise<ListBookmarksUseCaseOut> {
        const records = input.taskId
            ? this.bookmarkRepo.findByTaskId(input.taskId)
            : this.bookmarkRepo.findAll();
        return { bookmarks: (await records).map(mapBookmarkRecord) };
    }
}

function mapBookmarkRecord(record: BookmarkRecord): ListedBookmarkUseCaseDto {
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
