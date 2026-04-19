import type { IBookmarkRepository, BookmarkRecord } from "~application/ports/index.js";
import type { ListBookmarksUseCaseIn } from "./list.bookmarks.usecase.dto.js";

export class ListBookmarksUseCase {
    constructor(private readonly bookmarkRepo: IBookmarkRepository) {}

    async execute(input: ListBookmarksUseCaseIn): Promise<readonly BookmarkRecord[]> {
        return input.taskId
            ? this.bookmarkRepo.findByTaskId(input.taskId)
            : this.bookmarkRepo.findAll();
    }
}
