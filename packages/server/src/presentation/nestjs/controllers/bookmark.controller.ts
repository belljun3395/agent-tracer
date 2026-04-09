import { Controller, Get, Post, Delete, Body, Param, Query, HttpException, HttpStatus, HttpCode } from "@nestjs/common";
import { BookmarkId, TaskId } from "@monitor/core";
import { MonitorServiceProvider } from "../service/monitor-service.provider.js";
import type { TaskBookmarkInput, TaskBookmarkDeleteInput } from "../../../application/types.js";
import { bookmarkSchema } from "../../schemas.js";
@Controller()
export class BookmarkController {
    constructor(private readonly service: MonitorServiceProvider) { }
    @Get("/api/bookmarks")
    async listBookmarks(
    @Query("taskId")
    taskId?: string) {
        return { bookmarks: await this.service.listBookmarks(taskId ? TaskId(taskId) : undefined) };
    }
    @Post("/api/bookmarks")
    @HttpCode(HttpStatus.OK)
    async createBookmark(
    @Body()
    body: unknown) {
        const bookmark = await this.service.saveBookmark(bookmarkSchema.parse(body) as unknown as TaskBookmarkInput);
        return { bookmark };
    }
    @Delete("/api/bookmarks/:bookmarkId")
    async deleteBookmark(
    @Param("bookmarkId")
    bookmarkId: string) {
        const result = await this.service.deleteBookmark({ bookmarkId: BookmarkId(bookmarkId) } as TaskBookmarkDeleteInput);
        if (result === "not_found") {
            throw new HttpException({ ok: false, error: "Bookmark not found" }, HttpStatus.NOT_FOUND);
        }
        return { ok: true };
    }
}
