import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ListBookmarksUseCase } from "~application/bookmarks/index.js";

@Controller("api/bookmarks")
export class BookmarkController {
    constructor(
        @Inject(ListBookmarksUseCase) private readonly listBookmarks: ListBookmarksUseCase,
    ) {}

    @Get()
    async listBookmarksEndpoint(@Query("taskId") taskId?: string) {
        return { bookmarks: await this.listBookmarks.execute(taskId ? { taskId } : {}) };
    }
}
