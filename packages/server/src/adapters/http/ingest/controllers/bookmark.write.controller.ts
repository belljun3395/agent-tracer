import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { SaveBookmarkUseCase, DeleteBookmarkUseCase } from "~application/bookmarks/index.js";
import type { SaveBookmarkUseCaseIn, DeleteBookmarkUseCaseIn } from "~application/bookmarks/index.js";
import { bookmarkSchema } from "../schemas/bookmark.write.schema.js";

@Controller()
export class BookmarkWriteController {
    constructor(
        @Inject(SaveBookmarkUseCase) private readonly saveBookmark: SaveBookmarkUseCase,
        @Inject(DeleteBookmarkUseCase) private readonly deleteBookmark: DeleteBookmarkUseCase,
    ) {}

    @Post("/api/bookmarks")
    @HttpCode(HttpStatus.OK)
    async createBookmark(@Body() body: unknown) {
        const bookmark = await this.saveBookmark.execute(bookmarkSchema.parse(body) as unknown as SaveBookmarkUseCaseIn);
        return { bookmark };
    }

    @Delete("/api/bookmarks/:bookmarkId")
    async deleteBookmarkEndpoint(@Param("bookmarkId") bookmarkId: string) {
        const result = await this.deleteBookmark.execute({ bookmarkId } as DeleteBookmarkUseCaseIn);
        if (result === "not_found") {
            throw new HttpException({ ok: false, error: "Bookmark not found" }, HttpStatus.NOT_FOUND);
        }
        return { ok: true };
    }
}
