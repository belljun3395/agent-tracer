import { Body, Controller, Delete, HttpCode, HttpException, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { SaveBookmarkUseCase, DeleteBookmarkUseCase } from "~application/bookmarks/index.js";
import type { SaveBookmarkUseCaseIn, DeleteBookmarkUseCaseIn } from "~application/bookmarks/index.js";
import { bookmarkSchema } from "../schemas/bookmark.write.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/bookmarks")
export class BookmarkWriteController {
    constructor(
        @Inject(SaveBookmarkUseCase) private readonly saveBookmark: SaveBookmarkUseCase,
        @Inject(DeleteBookmarkUseCase) private readonly deleteBookmark: DeleteBookmarkUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async createBookmark(@Body(new ZodValidationPipe(bookmarkSchema)) body: SaveBookmarkUseCaseIn) {
        const bookmark = await this.saveBookmark.execute(body);
        return { bookmark };
    }

    @Delete(":bookmarkId")
    async deleteBookmarkEndpoint(@Param("bookmarkId", pathParamPipe) bookmarkId: string) {
        const result = await this.deleteBookmark.execute({ bookmarkId } as DeleteBookmarkUseCaseIn);
        if (result === "not_found") {
            throw new HttpException({ ok: false, error: "Bookmark not found" }, HttpStatus.NOT_FOUND);
        }
        return { ok: true };
    }
}
