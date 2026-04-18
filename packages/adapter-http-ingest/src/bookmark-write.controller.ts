import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Param, Post } from "@nestjs/common";
import { BookmarkId } from "@monitor/domain";
import { MonitorService } from "@monitor/application";
import type { TaskBookmarkDeleteInput, TaskBookmarkInput } from "@monitor/application";
import { bookmarkSchema } from "./schemas.js";

@Controller()
export class BookmarkWriteController {
    constructor(private readonly service: MonitorService) { }

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
