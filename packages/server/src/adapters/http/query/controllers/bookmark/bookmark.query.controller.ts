import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ListBookmarksUseCase } from "~application/bookmarks/index.js";

@Controller("api/v1/bookmarks")
export class BookmarkQueryController {
    constructor(@Inject(ListBookmarksUseCase) private readonly listBookmarks: ListBookmarksUseCase) {}

    @Get()
    async listBookmarksEndpoint(@Query("taskId") taskId?: string) {
        return this.listBookmarks.execute(taskId ? { taskId } : {});
    }
}
