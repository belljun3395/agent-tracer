import { Controller, Get, Query } from "@nestjs/common";
import { TaskId } from "@monitor/domain";
import { MonitorService } from "@monitor/application";

@Controller()
export class BookmarkController {
    constructor(private readonly service: MonitorService) { }

    @Get("/api/bookmarks")
    async listBookmarks(
    @Query("taskId")
    taskId?: string) {
        return { bookmarks: await this.service.listBookmarks(taskId ? TaskId(taskId) : undefined) };
    }
}
